# Firebase schema (MVP)

This project uses **Firebase Auth + Firestore + Storage + Cloud Functions + FCM**.

## Collections

### `users/{uid}`

Stores role + basic account profile.

```ts
type UserDoc = {
  role: 'patient' | 'helper' | 'doctor' | 'hospital_admin' | 'admin';
  name: string;
  email: string;
  createdAt: FirebaseFirestoreTypes.Timestamp;
};
```

### `patients/{uid}`

Patient emergency profile. Uses `uid` as document id for simple security rules.

```ts
type PatientDoc = {
  name: string;
  phone?: string;
  bloodGroup?: string;
  allergies?: string[];
  conditions?: string[];
  emergencyContacts: Array<{ name: string; phone: string; relation?: string }>;
  helperOptIn?: boolean;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
};
```

### `hospitals/{hospitalId}`

```ts
type HospitalDoc = {
  name: string;
  geo: { lat: number; lon: number };
  address: string;
  departments: string[];
  verified: boolean;
};
```

### `doctors/{doctorId}`

```ts
type DoctorDoc = {
  name: string;
  specialties: string[];
  hospitalIds: string[];
  fee?: number;
  rating?: number;
};
```

### `appointments/{appointmentId}`

```ts
type AppointmentDoc = {
  patientId: string; // uid
  doctorId: string;
  hospitalId: string;
  startAt: FirebaseFirestoreTypes.Timestamp;
  endAt: FirebaseFirestoreTypes.Timestamp;
  reason: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
};
```

### `medicalRecords/{recordId}`

Metadata for Storage files. Files are stored under:
`medical-records/{patientId}/{recordId}/{filename}`

```ts
type MedicalRecordDoc = {
  patientId: string; // uid
  doctorId?: string;
  hospitalId?: string;
  type: 'Prescription' | 'LabReport' | 'XRay' | 'Imaging' | 'Consultation';
  title: string;
  notes?: string;
  storagePaths: string[];
  recordDate: FirebaseFirestoreTypes.Timestamp;
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
};
```

### `sosRequests/{requestId}`

Created by victim (manual SOS or auto crash detection).

```ts
type SosRequestDoc = {
  victimId: string; // uid
  status: 'idle' | 'countdown' | 'active' | 'resolved' | 'cancelled';
  severity: 'minor' | 'major' | 'critical';
  location: { lat: number; lon: number };
  crashSignal?: {
    speed: number;
    acceleration: number;
    orientation: 'normal' | 'flipped' | 'unknown';
    vibration: number;
  };
  primaryHelperId?: string;
  radiusKm: number; // starts 1.0–1.5, can expand
  createdAt: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
};
```

### `sosAssignments/{assignmentId}`

One assignment per helper per request (MVP uses a flat collection for simple queries).

```ts
type SosAssignmentDoc = {
  requestId: string;
  victimId: string;
  helperId: string; // uid
  status: 'accepted' | 'enroute' | 'reached' | 'secondary' | 'cancelled';
  lastLocation?: { lat: number; lon: number };
  distanceMeters?: number;
  distanceTrend?: 'closing' | 'stalled' | 'unknown';
  acceptedAt: FirebaseFirestoreTypes.Timestamp;
  reachedAt?: FirebaseFirestoreTypes.Timestamp;
  updatedAt: FirebaseFirestoreTypes.Timestamp;
};
```

### `helpers/{uid}`

```ts
type HelperDoc = {
  verificationStatus: 'unverified' | 'verified';
  radiusKm: number;
  coinBalance: number;
  lastLocation?: { lat: number; lon: number };
  lastSeenAt?: FirebaseFirestoreTypes.Timestamp;
};
```

### `coinLedger/{entryId}`

Append-only entries written by Cloud Functions (server/admin context).

```ts
type CoinLedgerEntry = {
  userId: string; // helper uid
  requestId?: string;
  amount: number;
  reason: 'primary_reached' | 'active_helper' | 'support_helper' | 'penalty_inactive';
  createdAt: FirebaseFirestoreTypes.Timestamp;
};
```

## Indexes (planned)

As the project grows, you’ll likely add indexes for:
- `sosRequests` filtered by `status` and geohash/radius
- `sosAssignments` filtered by `requestId`
- `appointments` filtered by `patientId` + `startAt`

## Security rules notes

Rules are in `firestore.rules` and are intentionally MVP-safe:
- Patients can only read/write their own patient profile, records, and appointments.
- Helpers should see only anonymized request cards until they accept (enforced by client schema discipline + rules).
- Coin ledger is written server-side only (Cloud Functions) to prevent cheating.

