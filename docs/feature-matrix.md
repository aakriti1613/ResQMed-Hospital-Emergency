# Feature Matrix (Merged from both repos)

This project merges and extends:
- **Project 1**: `Ranshika-Yadav/AarogyaSOS-`
- **Project 2**: `Aayushgupta2005/resQMed_pat`

Legend:
- ✅ implemented
- 🟡 partial / UI-only / simulated
- ❌ missing

## Care (non-emergency)

| Feature | Project 1 | Project 2 | Unified implementation |
|---|---:|---:|---|
| Auth (email/password) | ✅ (Appwrite) | ✅ (Appwrite) | ✅ (Firebase Auth + optional Google) |
| Specialty browse (cardio/ortho…) | ❌ | ❌ | ✅ (directory + filters) |
| Doctor profiles + availability | ❌ | ❌ | ✅ (Firestore `doctors` + `availability`) |
| Hospital browse / list | 🟡 (dummy list on dashboard) | 🟡 (dummy list) | ✅ (map+list + departments) |
| Appointment create/list/delete | 🟡 (Appwrite + demo fallback) | 🟡 (Appwrite) | ✅ (Firestore `appointments`) |
| Prescriptions (post-visit) | 🟡 (UI concept in reports) | 🟡 | ✅ (records type = Prescription + doctor upload) |
| Test reports + imaging | 🟡 (UI concept in reports) | 🟡 (table) | ✅ (Storage upload + metadata) |
| Share records with doctor | ❌ | ❌ | ✅ (rules + share tokens) |
| Dependents (family profiles) | ❌ | ❌ | ✅ (patients/dependents) |

## Health Vault (records)

| Feature | Project 1 | Project 2 | Unified implementation |
|---|---:|---:|---|
| Records UI (filter + view) | ✅ | 🟡 | ✅ (timeline + filters) |
| Upload files (real) | 🟡 (simulated attachments) | ❌ | ✅ (Firebase Storage) |
| Download/export | ✅ (text export) | 🟡 | ✅ (download stored file + export summary) |
| Permissions/ACL | ❌ | ❌ | ✅ (Firestore/Storage rules) |

## SOS + Emergency response

| Feature | Project 1 | Project 2 | Unified implementation |
|---|---:|---:|---|
| Geolocation | ✅ | ✅ | ✅ |
| Nearby hospitals (Nominatim) | ✅ | ✅ | ✅ (MVP) |
| One-tap SOS UX | ✅ (multi-phase modal) | 🟡 | ✅ |
| Auto accident detection (sensor simulation) | ❌ | ❌ | ✅ |
| 10s cancel countdown | 🟡 (confirm+searching) | 🟡 | ✅ |
| Victim/Helper modes (tabs) | ❌ | ❌ | ✅ |
| Nearby helpers feed + accept | 🟡 (concept) | ❌ | ✅ (Firestore + FCM) |
| Primary helper selection (first to reach <50m) | ❌ | ❌ | ✅ |
| Points-by-effort | 🟡 (coins concept) | ❌ | ✅ (coin ledger + movement checks) |
| Emergency contacts notifications | ❌ | ❌ | 🟡 (MVP share sheet; production via provider) |

## Assistant / Chatbot

| Feature | Project 1 | Project 2 | Unified implementation |
|---|---:|---:|---|
| Medicine info assistant | ✅ (OpenFDA + Gemini; key in client) | ❌ | ✅ (Cloud Functions proxy; no keys in client) |
| Appointment booking via chat | ❌ | ✅ | ✅ |
| Triage + routing (non-diagnostic) | ❌ | ❌ | ✅ (rule-based + optional AI) |
| SOS coach (first aid checklists) | ❌ | ❌ | ✅ |

## UI / UX

| Feature | Project 1 | Project 2 | Unified implementation |
|---|---:|---:|---|
| Modern dashboard | ✅ | 🟡 | ✅ |
| Animations (Framer Motion) | ✅ | 🟡 | ✅ |
| Consistent design system | 🟡 | 🟡 | ✅ (tokens + components) |
| Dark mode | 🟡 | ❌ | ✅ |

