/**
 * Kaya — the ResQMed in-app health companion.
 *
 * A caring, safety-first assistant that can:
 *   1. Help book an appointment (the UI renders interactive cards; this module
 *      provides the intent hint + knowledge).
 *   2. Explain medicines / summarise the user's prescriptions in plain language.
 *   3. Answer questions about the ResQMed platform and general wellbeing.
 *
 * Answer quality is enhanced by Gemini when a key is available. Resolution order:
 *   1. Cloud Function proxy (`/assistant`) — key stays server-side (PRODUCTION).
 *   2. Direct client call with VITE_GEMINI_API_KEY — DEV/DEMO ONLY (key is public).
 *   3. Local rule-based fallback — always works, never blocks the UI.
 */
import { geminiApiKey, geminiModel, functionsOrigin } from '../app/env';
import type { Appointment } from './appointments';

export type AssistantRole = 'user' | 'model';
export interface AssistantMessage {
  role: AssistantRole;
  text: string;
}

export interface AssistantContext {
  /** The signed-in user's first name, for a warm tone. */
  userName?: string;
  /** Completed visits with a doctor's summary, used for prescription questions. */
  prescriptions?: Appointment[];
}

// ─────────────────────────────────────────────────────────────────────────────
// Persona + platform knowledge (kept here so both Gemini and the fallback share it)
// ─────────────────────────────────────────────────────────────────────────────
export const ASSISTANT_NAME = 'Kaya';

const PLATFORM_KNOWLEDGE = `
ResQMed (Arogya Raksha) is an emergency + everyday-care app for India.
Key features:
- SOS emergency: one tap raises an alert; a smart helmet can auto-detect crashes and trigger SOS. Nearby helpers and the partner hospital are notified with live location; an ambulance can be dispatched.
- Care & appointments: browse departments and doctors, book a slot at Arogya Medicare, pay via Google Pay or at the hospital. After a visit the doctor adds a summary (diagnosis, prescription, advice) visible under Appointments → Past.
- Hospital command center: hospital staff see incoming emergencies, accept them, dispatch ambulances, and manage appointments.
- Health Vault: store medical records and a Medical ID (blood group, allergies, conditions).
- Safety Circle: trusted contacts who are alerted in an emergency.
- Health challenges, first-aid guides, and reward points.
Emergency numbers in India: 112 (all), 108 (ambulance), 100 (police).
`.trim();

function systemPrompt(ctx: AssistantContext): string {
  const rx = (ctx.prescriptions ?? [])
    .filter((a) => a.prescription || a.diagnosis || a.advice)
    .slice(0, 5)
    .map((a) => {
      const when = a.startAt instanceof Date ? a.startAt.toLocaleDateString() : '';
      return `• ${a.doctorName ?? 'Doctor'} (${a.departmentName ?? ''}, ${when}): diagnosis="${a.diagnosis ?? '-'}", prescription="${a.prescription ?? '-'}", advice="${a.advice ?? '-'}"`;
    })
    .join('\n');

  return [
    `You are ${ASSISTANT_NAME}, the warm, caring health companion inside the ResQMed app.`,
    `Personality: kind, calm, reassuring, encouraging — you genuinely care about the person. Use simple language. Keep replies short (2-6 sentences) and use bullet points when listing. A gentle emoji occasionally is fine.`,
    `HARD SAFETY RULES (never break):`,
    `- You are NOT a doctor. Never diagnose or prescribe. Give general information only and always encourage seeing a qualified doctor.`,
    `- For emergency signs (chest pain, trouble breathing, heavy bleeding, stroke signs, unconsciousness, suicidal thoughts), tell them to use the SOS button or call 112/108 immediately.`,
    `- Never invent medical facts. If unsure, say so and suggest consulting a doctor or pharmacist.`,
    `When explaining a medicine: cover in plain words what it's for, how to take it, common precautions, and when to see a doctor — but remind them to follow their doctor's/pharmacist's exact instructions.`,
    `To book an appointment, tell the user to tap "Book appointment" (the app opens a booking card) — you don't book silently.`,
    `\nPLATFORM KNOWLEDGE:\n${PLATFORM_KNOWLEDGE}`,
    ctx.userName ? `\nThe user's name is ${ctx.userName}. Greet warmly when natural.` : '',
    rx ? `\nThe user's recent visit summaries (use ONLY to answer their questions about their own prescriptions):\n${rx}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────
export async function askAssistant(
  history: AssistantMessage[],
  userMessage: string,
  ctx: AssistantContext = {},
): Promise<{ text: string; source: 'gemini' | 'proxy' | 'fallback' }> {
  const sys = systemPrompt(ctx);

  // 1) Direct client call (dev/demo) — only when a public key is explicitly set.
  if (geminiApiKey) {
    try {
      const text = await callGeminiDirect(sys, history, userMessage, geminiApiKey);
      return { text, source: 'gemini' };
    } catch (e) {
      console.warn('[assistant] direct Gemini failed, trying proxy/fallback:', e);
    }
  }

  // 2) Cloud Function proxy (production-safe).
  if (functionsOrigin) {
    try {
      const text = await callProxy(userMessage);
      if (text) return { text, source: 'proxy' };
    } catch (e) {
      console.warn('[assistant] proxy failed, using fallback:', e);
    }
  }

  // 3) Local fallback — always available.
  return { text: localFallback(userMessage, ctx), source: 'fallback' };
}

// ── Gemini (direct) ──────────────────────────────────────────────────────────
async function callGeminiDirect(
  sys: string,
  history: AssistantMessage[],
  userMessage: string,
  apiKey: string,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const contents = [
    ...history.slice(-8).map((m) => ({ role: m.role, parts: [{ text: m.text }] })),
    { role: 'user' as const, parts: [{ text: userMessage }] },
  ];
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: sys }] },
      contents,
      generationConfig: { temperature: 0.5, maxOutputTokens: 700 },
    }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const data: any = await r.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '';
  if (!text) throw new Error('Empty Gemini response');
  return text.trim();
}

// ── Cloud Function proxy ─────────────────────────────────────────────────────
async function callProxy(userMessage: string): Promise<string> {
  const origin = functionsOrigin!.replace(/\/$/, '');
  const mode = detectIntent(userMessage) === 'book' ? 'book' : detectIntent(userMessage) === 'meds' ? 'meds' : 'triage';
  const r = await fetch(`${origin}/assistant`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, message: userMessage }),
  });
  if (!r.ok) throw new Error(`proxy ${r.status}`);
  const data: any = await r.json();
  return (data?.reply as string) || '';
}

// ── Local fallback (no key, no proxy) ────────────────────────────────────────
export type Intent = 'book' | 'meds' | 'prescription' | 'platform' | 'emergency' | 'greeting' | 'other';

const EMERGENCY_WORDS = ['chest pain', 'can\'t breathe', 'cant breathe', 'breathing', 'bleeding', 'unconscious', 'stroke', 'heart attack', 'suicid'];

export function detectIntent(msg: string): Intent {
  const m = msg.toLowerCase();
  if (EMERGENCY_WORDS.some((w) => m.includes(w))) return 'emergency';
  if (/(^|\b)(hi|hello|hey|namaste|hii)\b/.test(m)) return 'greeting';
  if (/(book|appointment|schedule|consult|see a doctor|doctor for)/.test(m)) return 'book';
  if (/(my prescription|my medicine|last visit|summary|what did the doctor)/.test(m)) return 'prescription';
  if (/(medicine|tablet|dose|dosage|how to take|side effect|paracetamol|ibuprofen|antibiotic)/.test(m)) return 'meds';
  if (/(sos|emergency|helmet|helper|hospital|vault|safety circle|points|app|feature|how do i|how does)/.test(m)) return 'platform';
  return 'other';
}

function localFallback(msg: string, ctx: AssistantContext): string {
  const intent = detectIntent(msg);
  const name = ctx.userName ? ` ${ctx.userName}` : '';
  switch (intent) {
    case 'emergency':
      return `I'm really concerned about that. 🚨 If this is a medical emergency, please tap the red **SOS** button now or call **112** (or **108** for an ambulance). Stay as calm as you can — help can be on the way in seconds.`;
    case 'greeting':
      return `Hi${name}! 🌸 I'm ${ASSISTANT_NAME}, your health companion. I can help you **book an appointment**, understand **your prescriptions & medicines**, or answer questions about the app. How are you feeling today?`;
    case 'book':
      return `I'd be happy to help you see a doctor. Tap **"Book appointment"** below and I'll walk you through choosing a department, doctor, and time. If you tell me your symptom, I can suggest the right specialty. 💙`;
    case 'prescription': {
      const rx = (ctx.prescriptions ?? []).find((a) => a.prescription || a.advice);
      if (rx) {
        return `Here's your most recent visit summary:\n\n• **Doctor:** ${rx.doctorName ?? '—'}\n• **Diagnosis:** ${rx.diagnosis ?? '—'}\n• **Prescription:** ${rx.prescription ?? '—'}\n• **Advice:** ${rx.advice ?? '—'}\n\nAlways take medicines exactly as your doctor advised. Want me to explain any of these in simple words?`;
      }
      return `I couldn't find a completed visit with a prescription yet. Once a doctor completes your visit, the summary shows up under **Appointments → Past**, and I can explain it for you. 💙`;
    }
    case 'meds':
      return `I can share general information about medicines — what they're for, how they're usually taken, and common precautions. I can't prescribe, though, so please follow your doctor's or pharmacist's exact instructions. Which medicine would you like to know about?`;
    case 'platform':
      return `Happy to help! ResQMed keeps you safe and cared for:\n\n• **SOS** — one tap alerts helpers, the hospital, and shares your live location.\n• **Care** — book doctors and appointments.\n• **Health Vault & Medical ID** — store records, blood group, allergies.\n• **Safety Circle** — trusted contacts alerted in emergencies.\n\nWhat would you like to do?`;
    default:
      return `I'm here for you${name}. 💙 I can **book an appointment**, explain **your medicines/prescriptions**, or answer questions about the app. For anything urgent, use the **SOS** button. What would you like help with?`;
  }
}

/** Map a free-text symptom to a likely department id (used by the booking card). */
export function suggestDepartment(text: string): string | null {
  const m = text.toLowerCase();
  const rules: [RegExp, string][] = [
    [/heart|chest|palpitation|bp|blood pressure/, 'cardio'],
    [/bone|joint|fracture|knee|back pain|sprain/, 'ortho'],
    [/skin|acne|rash|hair|nail/, 'derma'],
    [/head|migraine|nerve|seizure|dizzy/, 'neuro'],
    [/child|baby|kid|infant/, 'peds'],
    [/ear|nose|throat|sinus|tonsil/, 'ent'],
    [/tooth|teeth|dental|gum/, 'dental'],
    [/eye|vision|sight/, 'eye'],
    [/anxiety|depress|stress|mental|sleep/, 'psych'],
    [/pregnan|period|menstrual|women/, 'gyno'],
    [/fever|cold|flu|cough|general|check ?up/, 'general'],
  ];
  for (const [re, dept] of rules) if (re.test(m)) return dept;
  return null;
}
