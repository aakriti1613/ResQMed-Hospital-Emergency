# Helmet → Firestore bridge

A 130-line Node script that polls the ESP32 helmet's local JSON endpoint
(`http://192.168.4.1/data`) and writes the readings to Firestore
`helmets/{ownerUid}`. The Aarogya Raksha dashboard already subscribes to that
doc, so the data appears live with **no ESP32 firmware change and no frontend
change**.

```
ESP32 helmet (Wi-Fi AP)  ── HTTP GET ──▶  this script  ── HTTPS ──▶  Firestore
                                              │
                              laptop = bridge (helmet Wi-Fi + USB tether)
```

---

## Setup (10 minutes, one time)

### 1. Install Node 18+

Check: `node --version` (must be 18 or higher).

### 2. Install dependencies

```
cd tools/helmet-bridge
npm install
```

### 3. Get a Firebase service account key

This file gives the bridge permission to write to Firestore.

1. Open <https://console.firebase.google.com> and pick the **arogya-raksha-b43a5** project.
2. Click the gear icon (top-left) -> **Project settings**.
3. Open the **Service accounts** tab.
4. Click **Generate new private key** -> confirm. A JSON file downloads.
5. Rename that file to **`serviceAccountKey.json`** and drop it inside `tools/helmet-bridge/` (next to `helmet-bridge.mjs`).

> The file is already gitignored. **Never commit it.** It's an admin credential.

### 4. Find your Firebase UID

1. In Firebase Console, open **Build -> Authentication -> Users**.
2. Find your phone number row. Copy the **User UID** (long string).

### 5. Edit `helmet-bridge.mjs`

Open the file, change two lines near the top:

```js
const HELMET_URL = 'http://192.168.4.1/data';      // confirm this URL in your browser
const OWNER_UID  = 'PASTE_YOUR_FIREBASE_UID_HERE'; // from step 4
```

(If `/data` isn't the JSON endpoint you tested, swap it for `/json`, `/api`, `/status`, etc.)

---

## Run

Before launching the bridge:

1. **Connect the laptop's Wi-Fi to "Smart Helmet"** (the AP the ESP32 hosts).
2. **USB-tether your phone** to the laptop with mobile data ON, so the laptop has internet via cellular while still on the helmet's Wi-Fi.
3. Sanity check: open <http://192.168.4.1/data> AND <https://google.com> in the laptop browser. Both should load.

Then start the bridge:

```
node helmet-bridge.mjs
```

You should see one line printed every 2 seconds, e.g.:

```
[12:34:56] #  1  HR=78  SpO2=97  vib=120  dist=184cm  accident=Safe  gps=28.6353,77.2924
```

Open the Aarogya Raksha dashboard in another tab — the Helmet Status card
will switch from "Helmet Offline" to "Riding Protected" within a second.

---

## What gets written to Firestore

Each poll writes (with `merge: true`) to `helmets/{ownerUid}`:

| Field          | Source                | Example                  |
| -------------- | --------------------- | ------------------------ |
| `heartRate`    | `bpm`                 | 78                       |
| `spo2`         | `spo2`                | 97                       |
| `vibration`    | `vibrationValue`      | 120                      |
| `vibrationLabel` | `vibration`         | "Normal" / "Impact"      |
| `distanceCm`   | `ultrasonic`          | 184.6                    |
| `lat`, `lon`   | `lat`, `lng` (if `gps_valid`) | 28.6353, 77.2924 |
| `gsmStatus`    | `gsm`                 | "No Network"             |
| `relayOn`      | `relay === "ON"`      | false                    |
| `accel`        | `ax`, `ay`, `az`      | { x: 0, y: -82, z: 16 }  |
| `gyro`         | `gx`, `gy`, `gz`      | { x: -1.3, y: -4.3, z: -1 } |
| `lastPingAt`   | server timestamp      |                          |
| `connected`    | `true`                |                          |
| `sensorsActive`| `true`                |                          |

On a confirmed crash (when `accident !== "Safe"`):

```js
crashEvent: {
  at: <serverTimestamp>,
  severity: 'minor' | 'major' | 'critical',  // from vibration value
  lat, lon,
  channel: 'wifi-bridge',
  rawAccident: '<what the helmet sent>'
}
```

The existing `useSosEscalationMonitor` hook in the app will react to this and
fire the SOS escalation flow.

A 30-second cooldown prevents repeated triggers from a single sustained
vibration spike. Adjust `CRASH_COOLDOWN_S` in the script if needed.

---

## When the SIM/SMS path comes online

This Wi-Fi bridge is for tonight's test only. Once you start using the
SIM800L's SMS path:

- The helmet will fire an SMS on a confirmed crash to your phone number.
- An SMS-forwarder app on your phone (or a Cloud Function webhook) will
  forward that to a `gsmIngest` HTTPS endpoint.
- That endpoint will write the same `crashEvent` shape to the same Firestore
  doc.

Both paths write to `helmets/{ownerUid}` so the dashboard behaves the same
regardless of which channel delivered the data.

---

## Troubleshooting

- **`poll failed: fetch failed`** — laptop is not on the "Smart Helmet" Wi-Fi, OR the helmet is off. Re-check `http://192.168.4.1/data` in the browser.
- **`Firestore write failed: 7 PERMISSION_DENIED`** — the service account file is wrong, or your Firestore rules don't allow the admin SDK (admin SDK normally bypasses rules — this means a bad SA key).
- **Dashboard doesn't update** — the UID in `OWNER_UID` doesn't match the user you're logged in as. Verify with `Auth -> Users` in Firebase Console.
- **CRASH not firing the SOS** — make sure you're logged in to the app as the same user. The escalation watcher only fires for the logged-in user's doc.
