<div align="center">

# ResQMed · Uber Hospital & Emergency

**One app for hospital care, health records, and live SOS — Firebase-first, India-ready.**

[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Firebase](https://img.shields.io/badge/Firebase-Auth%20%7C%20Firestore%20%7C%20Storage%20%7C%20Functions-FFCA28?style=flat-square&logo=firebase&logoColor=black)](https://firebase.google.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)](https://tailwindcss.com/)

</div>

---

## Hero preview

**Live (local dev):** [http://localhost:5173/](http://localhost:5173/) · **Route:** `/`

<p align="center">
  <a href="http://localhost:5173/" title="Open landing">
    <img src="docs/screenshots/00-landing.png" alt="Landing — add docs/screenshots/00-landing.png" width="720" />
  </a>
</p>

> **Screenshots:** drop PNGs into [`docs/screenshots/`](docs/screenshots/). File names below match the placeholders so links stay copy-paste friendly.

---

## Table of contents

1. [Why this project](#why-this-project)
2. [Feature tour (with links & screenshot slots)](#feature-tour-with-links--screenshot-slots)
3. [Tech stack & specs](#tech-stack--specs)
4. [Quick start](#quick-start)
5. [Environment variables](#environment-variables)
6. [Scripts](#scripts)
7. [Firebase & Cloud Functions](#firebase--cloud-functions)
8. [Further reading](#further-reading)

---

## Why this project

ResQMed merges **non-emergency care** (departments, doctors, slots, pay) with **emergency SOS** (countdown, helpers, live maps, hospital notify) and a **health vault** — in one **dark, high-contrast** mobile-first UI (Helmet One–style references throughout).

---

## Feature tour (with links & screenshot slots)

Local base URL: **`http://localhost:5173`** (Vite default). Replace with your deployed URL when hosting.

### Home & quick actions

| | |
| --- | --- |
| **Try it** | [Open Home](http://localhost:5173/app) · `/app` |
| **What** | Partner hospital, helmet status, department browse, **Quick actions** (accident, ambulance, share location, safety circle), community stats. |

[![Home dashboard](docs/screenshots/01-home.png)](http://localhost:5173/app)

---

### SOS — victim flow

| | |
| --- | --- |
| **Try it** | [Open SOS](http://localhost:5173/app/sos) · `/app/sos` |
| **What** | Countdown, manual + crash path, live location, **single assigned helper**, mutual **name · age · short address · ETA**, map + route, safety guide, mood check-in, medical ID shortcut. |

[![SOS victim](docs/screenshots/02-sos-victim.png)](http://localhost:5173/app/sos)

---

### I Can Help — helper flow

| | |
| --- | --- |
| **Try it** | [Open I Can Help](http://localhost:5173/app/help) · `/app/help` |
| **What** | Nearby requests (≤5 km), accept with **helper brief**, **On the way** / **At hospital** tabs, live map, victim shared details, **hospital ER notify** with “preparing for treatment” success, points on complete. |

[![I Can Help](docs/screenshots/03-help.png)](http://localhost:5173/app/help)

---

### Trips — helmet rides & rewards

| | |
| --- | --- |
| **Try it** | [Open Trips](http://localhost:5173/app/trips) · `/app/trips` |
| **What** | **Rides** (day-grouped helmet movement demo), **Helped** (SOS history), **Earned** (points / rewards link). |

[![Trips](docs/screenshots/04-trips.png)](http://localhost:5173/app/trips)

---

### Care — book a doctor

| | |
| --- | --- |
| **Try it** | [Departments](http://localhost:5173/app/care) · `/app/care` → hospital → doctor → [Book](http://localhost:5173/app/care/book) |
| **What** | Specialties, partner hospitals, doctor profiles, **slots**, **tell the doctor** notes, **Google Pay** (test) + pay-at-hospital, appointments synced to Firestore. |

[![Care booking](docs/screenshots/05-care-book.png)](http://localhost:5173/app/care)

---

### Appointments & Health Vault

| | |
| --- | --- |
| **Try it** | [Appointments](http://localhost:5173/app/appointments) · [Vault](http://localhost:5173/app/vault) |
| **What** | Upcoming / past visits; upload prescriptions & reports with **Firebase Storage** + metadata. |

[![Appointments](docs/screenshots/06-appointments.png)](http://localhost:5173/app/appointments) · [![Vault](docs/screenshots/07-vault.png)](http://localhost:5173/app/vault)

---

### Safety hub — Medical ID & Safety Circle

| | |
| --- | --- |
| **Try it** | [Safety](http://localhost:5173/app/safety) · [Medical ID](http://localhost:5173/app/medical-id) · [Safety Circle](http://localhost:5173/app/safety-circle) |
| **What** | Lock-screen-friendly medical summary; trusted contacts for SOS / alerts. |

[![Safety](docs/screenshots/08-safety.png)](http://localhost:5173/app/safety)

---

### Profile & portals

| | |
| --- | --- |
| **Try it** | [Profile](http://localhost:5173/app/profile) · [Doctor portal](http://localhost:5173/doctor) · [Hospital portal](http://localhost:5173/hospital) |
| **What** | Rewards, medical profile, addresses; stub portals for doctor / hospital staff. |

[![Profile](docs/screenshots/09-profile.png)](http://localhost:5173/app/profile)

---

### Admin (simulator)

| | |
| --- | --- |
| **Try it** | [Admin](http://localhost:5173/admin) · `/admin` |
| **What** | Hardware / crash simulator hooks for demos (see in-app copy). |

[![Admin](docs/screenshots/10-admin.png)](http://localhost:5173/admin)

---

## Tech stack & specs

| Layer | Choice |
| --- | --- |
| **UI** | React 19, React Router 7, Tailwind CSS 3, Framer Motion, Lucide icons |
| **Build** | Vite 8, TypeScript ~6 |
| **Backend** | Firebase Auth, Firestore, Storage, Callable / HTTPS Cloud Functions |
| **Maps / routing** | Google Maps JS + Directions-style helpers (see `src/data/routing.ts`, `VITE_*` keys) |
| **Payments** | Google Pay for Web (`src/lib/googlePay.ts`), test + production env |
| **Monorepo** | npm **workspaces** — `functions` is a workspace; **one** root `node_modules` (run `npm install` only at repo root) |

**Quality bar:** mobile-first `max-w-lg` shells, accessible SOS FAB, demo mode when Firebase is unset (`src/app/env.ts` pattern).

---

## Quick start

```bash
git clone <repository-url>
cd "Uber Hospital and Emergency"
npm install          # installs app + functions workspace
npm run dev          # Vite → http://localhost:5173/
```

- UI runs **without** Firebase using demo / local fallbacks where implemented.
- For full SOS, care, and vault persistence, configure Firebase (below).

---

## Environment variables

### Web app (`.env.local` at repo root)

| Variable | Purpose |
| --- | --- |
| `VITE_FIREBASE_*` | `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId` |
| `VITE_GOOGLE_MAPS_API_KEY` | Maps / Places (client) |
| `VITE_GOOGLE_PAY_ENV` | `TEST` or `PRODUCTION` |
| `VITE_GOOGLE_PAY_MERCHANT_ID` / `MERCHANT_NAME` | Production Google Pay |
| `VITE_GOOGLE_PAY_GATEWAY` / `GATEWAY_MERCHANT_ID` | Payment processor (production) |

### Cloud Functions (`functions/.env` — do not commit)

Copy from [`functions/.env.example`](functions/.env.example):

| Variable | Purpose |
| --- | --- |
| `GEMINI_API_KEY` | Server-side AI proxy (never exposed to browser) |
| `MAPS_API_KEY` | Places / routing on server if used |

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production client build → `dist/` |
| `npm run preview` | Preview production build |
| `npm run build:functions` | Compile Cloud Functions (`tsc` in workspace) |
| `npm run serve:functions` | Build + Firebase emulators (functions only) |

---

## Firebase & Cloud Functions

1. Install CLI: `npm i -g firebase-tools` → `firebase login`
2. From repo root: `firebase init` (use existing `firebase.json`, rules, etc. when prompted)
3. **Dependencies:** always `npm install` at **repo root** (workspaces). Do **not** maintain a second `functions/node_modules` locally.
4. Set secrets for Functions (`GEMINI_API_KEY`, etc.) via Secret Manager or `firebase functions:secrets:set`
5. Deploy: `firebase deploy` (or `--only hosting`, `--only functions`, …)

**Rules & schema**

- Firestore: [`firestore.rules`](firestore.rules)
- Storage: [`storage.rules`](storage.rules)
- Notes: [`docs/firebase-schema.md`](docs/firebase-schema.md)

---

## Further reading

| Doc | Contents |
| --- | --- |
| [`docs/feature-matrix.md`](docs/feature-matrix.md) | Detailed feature comparison / MVP vs full |
| [`docs/firebase-schema.md`](docs/firebase-schema.md) | Collections & fields |
| [`docs/ui-design-system.md`](docs/ui-design-system.md) | UI tokens & patterns |

---

<div align="center">

**Built for real emergencies and real clinics — ship carefully, test in staging, and keep API keys on the server.**

</div>
