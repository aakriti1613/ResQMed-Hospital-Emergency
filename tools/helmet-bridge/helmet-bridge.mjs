/**
 * helmet-bridge.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * AAROGYA RAKSHA — local helmet → Firestore bridge.
 *
 * The ESP32 helmet hosts a JSON endpoint at  http://192.168.4.1/<path>
 * but that IP is only reachable from devices joined to the helmet's own
 * Wi-Fi AP. This script runs on a laptop that is:
 *
 *    1) connected to the "Smart Helmet" Wi-Fi  (to read the helmet)
 *    2) USB-tethered to a phone with mobile data  (to reach Firebase)
 *
 * It polls the helmet every 2 seconds, normalises the payload, and writes
 * to Firestore at  helmets/{OWNER_UID}  — the SAME doc the dashboard already
 * subscribes to via listenHelmet().  Zero firmware change, zero frontend
 * change.
 *
 * Setup (one time):
 *   cd tools/helmet-bridge
 *   npm install
 *   # download serviceAccountKey.json from Firebase Console (see README)
 *   # set OWNER_UID below
 *
 * Run:
 *   node helmet-bridge.mjs
 *
 * Stop with Ctrl+C.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import admin from 'firebase-admin';
import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// ── CONFIG ──────────────────────────────────────────────────────────────────
//
// Edit these four values, then run the script.

/** JSON endpoint on the helmet. Try /data, /json, /api or /status — whichever
 *  returns the JSON you saw in your browser. */
const HELMET_URL = 'http://192.168.4.1/data';

/** Your Firebase Auth UID. Find it in Firebase Console → Authentication →
 *  Users → the row for your phone number → "User UID" column. */
const OWNER_UID = 'l7isrSrQQwNUmLtb5dM3RJXwU7P2';

/** How often to poll the helmet, in milliseconds. 2 s is a good demo balance. */
const POLL_MS = 2000;

/** Seconds between crash events. Prevents a single sustained-vibration event
 *  from firing the SOS escalation repeatedly. */
const CRASH_COOLDOWN_S = 30;

// ─── End of config ──────────────────────────────────────────────────────────


// ── Service account ─────────────────────────────────────────────────────────
const __dir = dirname(fileURLToPath(import.meta.url));
const saPath = join(__dir, 'serviceAccountKey.json');

if (!existsSync(saPath)) {
  console.error('\n❌ serviceAccountKey.json not found next to this script.');
  console.error('   See README.md for the 5-step download flow.\n');
  process.exit(1);
}
if (OWNER_UID.startsWith('PASTE')) {
  console.error('\n❌ OWNER_UID is not set. Edit helmet-bridge.mjs (top of file)\n');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const db = admin.firestore();
const docRef = db.doc(`helmets/${OWNER_UID}`);

// ── Helpers ─────────────────────────────────────────────────────────────────
const num = (v) => {
  if (v === undefined || v === null) return undefined;
  const n = Number(String(v).trim());
  return Number.isFinite(n) ? n : undefined;
};

const severityFromVibration = (v) => {
  if (typeof v !== 'number') return 'minor';
  if (v >= 3500) return 'critical';
  if (v >= 2000) return 'major';
  return 'minor';
};

let pollCount = 0;
let lastCrashTs = 0;

// ── Main poll → write loop ─────────────────────────────────────────────────
async function tick() {
  let raw;
  try {
    const r = await fetch(HELMET_URL, { signal: AbortSignal.timeout(3000) });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    raw = await r.json();
  } catch (e) {
    console.log(`[bridge] ⚠  poll failed: ${e.message}`);
    return;
  }

  const heartRate  = num(raw.bpm);
  const spo2       = num(raw.spo2);
  const vibration  = num(raw.vibrationValue);
  const distanceCm = num(raw.ultrasonic);
  const lat        = raw.gps_valid ? num(raw.lat) : undefined;
  const lon        = raw.gps_valid ? num(raw.lng) : undefined;
  const accidentRaw = String(raw.accident ?? '').trim();
  const isCrash    = accidentRaw && accidentRaw.toLowerCase() !== 'safe';

  const update = {
    ownerUid:      OWNER_UID,
    deviceId:      'HELMET-001',
    model:         'Aarogya Helmet One',
    connected:     true,
    sensorsActive: true,
    lastPingAt:    admin.firestore.FieldValue.serverTimestamp(),
    // Live telemetry — the dashboard can show whichever it wants.
    heartRate, spo2, vibration, distanceCm, lat, lon,
    vibrationLabel: raw.vibration ?? null,
    gsmStatus:      raw.gsm ?? null,
    relayOn:        String(raw.relay ?? '').toUpperCase() === 'ON',
    accel: { x: num(raw.ax), y: num(raw.ay), z: num(raw.az) },
    gyro:  { x: num(raw.gx), y: num(raw.gy), z: num(raw.gz) },
    // Battery is not exposed by the helmet yet — placeholder so the badge
    // doesn't show 0%.
    batteryPct: 90,
  };

  // Strip undefined leaves so partial pings don't blank out earlier values.
  for (const k of Object.keys(update)) {
    if (update[k] === undefined) delete update[k];
  }

  if (isCrash) {
    const now = Date.now();
    if (now - lastCrashTs > CRASH_COOLDOWN_S * 1000) {
      lastCrashTs = now;
      const severity = severityFromVibration(vibration);
      update.crashEvent = {
        at:       admin.firestore.FieldValue.serverTimestamp(),
        severity,
        lat:      lat ?? null,
        lon:      lon ?? null,
        gForce:   null,
        channel:  'wifi-bridge',
        rawAccident: accidentRaw,
      };
      console.log(`\n🚨  CRASH detected (${severity})  -> wrote crashEvent`);
      console.log(`    accident=${accidentRaw}  vib=${vibration}  lat=${lat}  lon=${lon}\n`);
    }
  }

  try {
    await docRef.set(update, { merge: true });
  } catch (e) {
    console.log(`[bridge] ⚠  Firestore write failed: ${e.message}`);
    return;
  }

  pollCount++;
  const stamp = new Date().toISOString().slice(11, 19);
  console.log(
    `[${stamp}] #${String(pollCount).padStart(3)} ` +
    `HR=${heartRate ?? '-'}  SpO2=${spo2 ?? '-'}  vib=${vibration ?? '-'}  ` +
    `dist=${distanceCm ?? '-'}cm  accident=${accidentRaw || '-'}  ` +
    `gps=${raw.gps_valid ? `${lat},${lon}` : 'searching'}`
  );
}

console.log('\n──────────────────────────────────────────────────────────');
console.log('  Aarogya Raksha — Helmet → Firestore bridge');
console.log('──────────────────────────────────────────────────────────');
console.log(`  Source:  ${HELMET_URL}`);
console.log(`  Target:  helmets/${OWNER_UID}`);
console.log(`  Poll:    every ${POLL_MS} ms`);
console.log('  Ctrl+C to stop.');
console.log('──────────────────────────────────────────────────────────\n');

setInterval(tick, POLL_MS);
tick();
