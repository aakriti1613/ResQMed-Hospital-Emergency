/// <reference types="google.maps" />
// ─────────────────────────────────────────────────────────────────────────────
// Arogya Raksha. Hospital / Care data layer.
//
// Strategy (per product spec):
//  • Nearby hospitals on the map come from **Google Places "hospital" search**
//    (real, live data). We only render name/address/rating; we do NOT fabricate
//    doctor rosters for them.
//  • A single **showcase hospital** ("Arogya Medicare") is always surfaced at
//    the top of every list. It has a full doctor roster across all departments
//    so users can actually complete an end-to-end booking.
//  • Appointment creation still writes to Firestore through
//    `createAppointment` (see `./appointments.ts`). Booking is 100 % real; the
//    doctors/hospitals catalogued here are the "menu" the user picks from.
// ─────────────────────────────────────────────────────────────────────────────

import { loadGoogleMaps } from '../lib/googleMaps';
import { functionsOrigin } from '../app/env';

// ── Types ───────────────────────────────────────────────────────────────────
export type DepartmentId =
  | 'general'
  | 'cardio'
  | 'ortho'
  | 'derma'
  | 'neuro'
  | 'peds'
  | 'ent'
  | 'gyno'
  | 'dental'
  | 'psych'
  | 'eye'
  | 'onco';

export interface Department {
  id: DepartmentId;
  name: string;
  /** Short blurb used on cards. */
  tagline: string;
  /** Emoji-based icon (no asset loading). */
  icon: string;
  /** Tailwind-like gradient used for cards & header strips. */
  gradient: string;
  /** Accent colour for badges / highlights. */
  accent: string;
}

export interface Doctor {
  id: string;
  name: string;
  department: DepartmentId;
  /** Short 1-line tagline shown under the name. */
  title: string;
  /** Longer bio displayed on the doctor profile. */
  bio: string;
  qualifications: string;
  experienceYears: number;
  rating: number;           // 0–5
  reviewsCount: number;
  feeRupees: number;        // ₹ fee
  /** How many users have already booked this doctor (for social proof). */
  bookingsCount: number;
  /** Avatar emoji. Avoids depending on hosted images. */
  avatarEmoji: string;
  /** Accent colour for the avatar disc. */
  avatarTint: string;
  /** Consulting-hours label, e.g. "Mon–Sat · 10:00 AM – 6:00 PM". */
  consultingHours: string;
  /** Languages spoken. */
  languages: string[];
}

export interface HospitalInfo {
  id: string;
  name: string;
  /** Short human address. */
  address: string;
  /** Tagline used on cards. */
  tagline?: string;
  /** Google rating (0–5) if known. */
  rating?: number;
  /** Distance in km (filled in when returning search results). */
  distanceKm?: number;
  location?: { lat: number; lon: number };
  /** True for our seeded showcase hospital. Only showcase hospitals have
   *  doctors in this codebase; all other entries are real Google Places. */
  isShowcase?: boolean;
  /** Available departments (for showcase we list all; for real hospitals,
   *  we assume every dept is available but mark hospital as "general" until
   *  the user picks one). */
  departments?: DepartmentId[];
  /** Photo URL (Google Places photo reference resolved). */
  photoUrl?: string;
  /** Opening hours summary. */
  openingHours?: string;
  /** User review count from Google. */
  reviewsCount?: number;
  /** Phone number (if available from Places details). */
  phone?: string;
}

// ── Departments ─────────────────────────────────────────────────────────────
export const DEPARTMENTS: Department[] = [
  { id: 'general',  name: 'General Physician', tagline: 'Fever, flu, check-ups',        icon: '🩺', gradient: 'linear-gradient(135deg,#10b981,#047857)', accent: '#34d399' },
  { id: 'cardio',   name: 'Cardiology',        tagline: 'Heart, BP & chest pain',       icon: '❤️', gradient: 'linear-gradient(135deg,#ef4444,#991b1b)', accent: '#f87171' },
  { id: 'ortho',    name: 'Orthopedics',       tagline: 'Bones, joints & injuries',     icon: '🦴', gradient: 'linear-gradient(135deg,#f59e0b,#b45309)', accent: '#fbbf24' },
  { id: 'derma',    name: 'Dermatology',       tagline: 'Skin, hair & nails',           icon: '✨', gradient: 'linear-gradient(135deg,#ec4899,#9d174d)', accent: '#f472b6' },
  { id: 'neuro',    name: 'Neurology',         tagline: 'Brain, nerves & migraine',     icon: '🧠', gradient: 'linear-gradient(135deg,#6366f1,#3730a3)', accent: '#818cf8' },
  { id: 'peds',     name: 'Pediatrics',        tagline: 'Children & newborn care',      icon: '🧸', gradient: 'linear-gradient(135deg,#06b6d4,#0e7490)', accent: '#67e8f9' },
  { id: 'ent',      name: 'ENT',               tagline: 'Ear, nose & throat',           icon: '👂', gradient: 'linear-gradient(135deg,#8b5cf6,#5b21b6)', accent: '#a78bfa' },
  { id: 'gyno',     name: 'Gynaecology',       tagline: "Women's health & prenatal",    icon: '🤰', gradient: 'linear-gradient(135deg,#d946ef,#86198f)', accent: '#e879f9' },
  { id: 'dental',   name: 'Dental',            tagline: 'Teeth & oral care',            icon: '🦷', gradient: 'linear-gradient(135deg,#0ea5e9,#075985)', accent: '#38bdf8' },
  { id: 'psych',    name: 'Psychiatry',        tagline: 'Mental health & therapy',      icon: '🧘', gradient: 'linear-gradient(135deg,#14b8a6,#115e59)', accent: '#5eead4' },
  { id: 'eye',      name: 'Ophthalmology',     tagline: 'Eyes & vision care',           icon: '👁️', gradient: 'linear-gradient(135deg,#3b82f6,#1e40af)', accent: '#60a5fa' },
  { id: 'onco',     name: 'Oncology',          tagline: 'Cancer care & screening',      icon: '🎗️', gradient: 'linear-gradient(135deg,#a855f7,#6b21a8)', accent: '#c084fc' },
];

export const getDepartment = (id: DepartmentId | string | undefined): Department => {
  const found = DEPARTMENTS.find((d) => d.id === id);
  return found ?? (DEPARTMENTS[0] as Department);
};

// ── Showcase hospital ───────────────────────────────────────────────────────
export const SHOWCASE_HOSPITAL_ID = 'arogya-medicare';

export const SHOWCASE_HOSPITAL: HospitalInfo = {
  id: SHOWCASE_HOSPITAL_ID,
  name: 'Arogya Medicare',
  address: 'Sector 18, City Centre',
  tagline: 'Multi-speciality partner hospital',
  rating: 4.8,
  reviewsCount: 4821,
  isShowcase: true,
  departments: DEPARTMENTS.map((d) => d.id),
  openingHours: 'Open 24 × 7',
  phone: '+91 99999 88888',
};

// ── Showcase doctors ────────────────────────────────────────────────────────
// At least one doctor per department, with full bio + rating + experience.
export const SHOWCASE_DOCTORS: Doctor[] = [
  {
    id: 'doc-cardio-1', name: 'Dr. Ananya Iyer', department: 'cardio',
    title: 'Interventional Cardiologist',
    bio: 'Specialises in coronary angioplasty and preventive heart care. Has performed 1,200+ angioplasties and leads the heart-failure clinic at Arogya Medicare.',
    qualifications: 'MBBS, MD (Medicine), DM (Cardiology)',
    experienceYears: 15, rating: 4.9, reviewsCount: 842,
    feeRupees: 900, bookingsCount: 2430,
    avatarEmoji: '👩‍⚕️', avatarTint: '#f87171',
    consultingHours: 'Mon–Sat · 10:00 AM – 1:00 PM, 5:00 PM – 8:00 PM',
    languages: ['English', 'Hindi', 'Tamil'],
  },
  {
    id: 'doc-ortho-1', name: 'Dr. Rahul Gupta', department: 'ortho',
    title: 'Joint Replacement Surgeon',
    bio: 'Fellowship-trained in knee and hip replacement. Runs a dedicated sports-injury clinic for athletes and an arthroplasty programme for seniors.',
    qualifications: 'MBBS, MS (Orthopedics), FRCS',
    experienceYears: 18, rating: 4.8, reviewsCount: 611,
    feeRupees: 800, bookingsCount: 1980,
    avatarEmoji: '🦴', avatarTint: '#fbbf24',
    consultingHours: 'Mon–Fri · 11:00 AM – 2:00 PM, 6:00 PM – 9:00 PM',
    languages: ['English', 'Hindi'],
  },
  {
    id: 'doc-derma-1', name: 'Dr. Sunita Rao', department: 'derma',
    title: 'Cosmetic Dermatologist',
    bio: 'Focus on acne, pigmentation and laser procedures. Trained at AIIMS and the Mayo Clinic; regularly speaks at IADVL conferences.',
    qualifications: 'MBBS, MD (Dermatology), DNB',
    experienceYears: 12, rating: 4.7, reviewsCount: 734,
    feeRupees: 700, bookingsCount: 2150,
    avatarEmoji: '👩‍🔬', avatarTint: '#f472b6',
    consultingHours: 'Tue–Sun · 10:30 AM – 7:30 PM',
    languages: ['English', 'Hindi', 'Kannada'],
  },
  {
    id: 'doc-neuro-1', name: 'Dr. Kabir Menon', department: 'neuro',
    title: 'Consultant Neurologist',
    bio: 'Expert in stroke management, epilepsy and movement disorders. Runs the tele-stroke helpline for Arogya Medicare partner network.',
    qualifications: 'MBBS, MD (Medicine), DM (Neurology)',
    experienceYears: 14, rating: 4.8, reviewsCount: 402,
    feeRupees: 950, bookingsCount: 1340,
    avatarEmoji: '🧠', avatarTint: '#818cf8',
    consultingHours: 'Mon–Sat · 11:00 AM – 3:00 PM',
    languages: ['English', 'Hindi', 'Malayalam'],
  },
  {
    id: 'doc-peds-1', name: 'Dr. Priya Mehta', department: 'peds',
    title: 'Senior Paediatrician',
    bio: 'Child wellness, immunisation and developmental paediatrics. Gentle with anxious kids; preferred by 2,000+ parents in the network.',
    qualifications: 'MBBS, MD (Paediatrics), IAP Fellow',
    experienceYears: 16, rating: 4.9, reviewsCount: 1290,
    feeRupees: 600, bookingsCount: 3510,
    avatarEmoji: '🧒', avatarTint: '#67e8f9',
    consultingHours: 'Daily · 9:00 AM – 1:00 PM, 5:00 PM – 9:00 PM',
    languages: ['English', 'Hindi', 'Gujarati'],
  },
  {
    id: 'doc-ent-1', name: 'Dr. Vikram Desai', department: 'ent',
    title: 'ENT Surgeon',
    bio: 'Minimally-invasive sinus surgery, snoring & sleep-apnoea management. Certified in endoscopic rhinology.',
    qualifications: 'MBBS, MS (ENT), DNB',
    experienceYears: 13, rating: 4.6, reviewsCount: 358,
    feeRupees: 650, bookingsCount: 980,
    avatarEmoji: '👂', avatarTint: '#a78bfa',
    consultingHours: 'Mon–Sat · 10:00 AM – 1:00 PM, 6:00 PM – 9:00 PM',
    languages: ['English', 'Hindi', 'Marathi'],
  },
  {
    id: 'doc-gyno-1', name: 'Dr. Meera Krishnan', department: 'gyno',
    title: 'Obstetrician & Gynaecologist',
    bio: 'High-risk pregnancy, fertility care and minimally-invasive gynae surgery. Has delivered over 3,500 babies.',
    qualifications: 'MBBS, MS (OBG), DNB',
    experienceYears: 20, rating: 4.9, reviewsCount: 1560,
    feeRupees: 850, bookingsCount: 2780,
    avatarEmoji: '🤱', avatarTint: '#e879f9',
    consultingHours: 'Mon–Sat · 10:00 AM – 2:00 PM, 4:00 PM – 7:00 PM',
    languages: ['English', 'Hindi', 'Tamil'],
  },
  {
    id: 'doc-dental-1', name: 'Dr. Arjun Shah', department: 'dental',
    title: 'Dental & Implant Specialist',
    bio: 'Implants, smile-makeovers and pain-free root canals. Certified in advanced endodontics.',
    qualifications: 'BDS, MDS (Prosthodontics)',
    experienceYears: 10, rating: 4.7, reviewsCount: 512,
    feeRupees: 500, bookingsCount: 1220,
    avatarEmoji: '🦷', avatarTint: '#38bdf8',
    consultingHours: 'Daily · 10:00 AM – 8:00 PM',
    languages: ['English', 'Hindi', 'Gujarati'],
  },
  {
    id: 'doc-psych-1', name: 'Dr. Neha Kapoor', department: 'psych',
    title: 'Consultant Psychiatrist & Therapist',
    bio: 'Anxiety, depression, sleep and relationship issues. Uses a blend of CBT and medication with a strong confidentiality guarantee.',
    qualifications: 'MBBS, MD (Psychiatry)',
    experienceYears: 9, rating: 4.8, reviewsCount: 421,
    feeRupees: 1100, bookingsCount: 880,
    avatarEmoji: '🧘‍♀️', avatarTint: '#5eead4',
    consultingHours: 'Mon–Fri · 11:00 AM – 6:00 PM (Tele-consult available)',
    languages: ['English', 'Hindi', 'Punjabi'],
  },
  {
    id: 'doc-eye-1', name: 'Dr. Saurabh Verma', department: 'eye',
    title: 'LASIK & Cataract Surgeon',
    bio: 'LASIK, cataract and retina care. Has performed 7,000+ cataract surgeries with phaco technology.',
    qualifications: 'MBBS, MS (Ophthalmology), FICO',
    experienceYears: 17, rating: 4.9, reviewsCount: 902,
    feeRupees: 700, bookingsCount: 2100,
    avatarEmoji: '👁️', avatarTint: '#60a5fa',
    consultingHours: 'Mon–Sat · 9:00 AM – 12:00 PM, 4:00 PM – 7:00 PM',
    languages: ['English', 'Hindi'],
  },
  {
    id: 'doc-onco-1', name: 'Dr. Ritu Bansal', department: 'onco',
    title: 'Medical Oncologist',
    bio: 'Breast and GI cancers, chemotherapy and targeted therapy. Leads a patient-support group for survivors.',
    qualifications: 'MBBS, MD (Medicine), DM (Medical Oncology)',
    experienceYears: 13, rating: 4.8, reviewsCount: 338,
    feeRupees: 1200, bookingsCount: 540,
    avatarEmoji: '🎗️', avatarTint: '#c084fc',
    consultingHours: 'Mon–Fri · 10:00 AM – 2:00 PM',
    languages: ['English', 'Hindi'],
  },
  {
    id: 'doc-general-1', name: 'Dr. Sanjay Patel', department: 'general',
    title: 'Senior General Physician',
    bio: 'Fever, seasonal illness, lifestyle and preventive health. Holistic approach with 25+ years in community medicine.',
    qualifications: 'MBBS, MD (General Medicine)',
    experienceYears: 25, rating: 4.9, reviewsCount: 2210,
    feeRupees: 450, bookingsCount: 4620,
    avatarEmoji: '🩺', avatarTint: '#34d399',
    consultingHours: 'Daily · 8:00 AM – 11:00 AM, 5:00 PM – 9:00 PM',
    languages: ['English', 'Hindi', 'Gujarati'],
  },
  // A second general physician so there's always >1 choice for the default dept
  {
    id: 'doc-general-2', name: 'Dr. Fatima Khan', department: 'general',
    title: 'Family Medicine Consultant',
    bio: 'Women-friendly family doctor known for long, careful consultations and integrated care for diabetes & hypertension.',
    qualifications: 'MBBS, DFM',
    experienceYears: 11, rating: 4.8, reviewsCount: 612,
    feeRupees: 400, bookingsCount: 1770,
    avatarEmoji: '👩‍⚕️', avatarTint: '#34d399',
    consultingHours: 'Mon–Sat · 10:00 AM – 2:00 PM',
    languages: ['English', 'Hindi', 'Urdu'],
  },
  // A second cardiologist so users see multiple choices on a popular dept
  {
    id: 'doc-cardio-2', name: 'Dr. Harsh Malhotra', department: 'cardio',
    title: 'Preventive Cardiologist',
    bio: 'Lifestyle-first approach to heart disease. Non-invasive diagnostics, stress tests and long-term risk management.',
    qualifications: 'MBBS, MD (Cardiology)',
    experienceYears: 9, rating: 4.7, reviewsCount: 318,
    feeRupees: 750, bookingsCount: 1120,
    avatarEmoji: '❤️', avatarTint: '#f87171',
    consultingHours: 'Tue–Sun · 11:00 AM – 3:00 PM',
    languages: ['English', 'Hindi', 'Punjabi'],
  },
];

// ── Helpers over the showcase catalogue ─────────────────────────────────────
export function getShowcaseDoctorsForDept(dept: DepartmentId | string): Doctor[] {
  return SHOWCASE_DOCTORS.filter((d) => d.department === dept);
}

export function getShowcaseDoctorById(id: string): Doctor | undefined {
  return SHOWCASE_DOCTORS.find((d) => d.id === id);
}

/** Returns the hospital record for the given id. Currently only the showcase
 *  hospital has a stored record; real Google Places hospitals are returned
 *  by the caller via the nearby-search results. */
export function getHospitalById(id: string): HospitalInfo | undefined {
  if (id === SHOWCASE_HOSPITAL_ID) return SHOWCASE_HOSPITAL;
  return undefined;
}

// ── Google Places "hospital" nearby search ─────────────────────────────────
// Uses the classic `PlacesService.nearbySearch` which is battle-tested.
// We wrap it in a clean promise-based API and a small 60-second cache.

type PlacesCacheEntry = { at: number; items: HospitalInfo[]; key: string };
const placesCache: Map<string, PlacesCacheEntry> = new Map();
const PLACES_CACHE_MS = 60_000;

function cacheKey(lat: number, lon: number, radiusKm: number) {
  return `${lat.toFixed(3)}_${lon.toFixed(3)}_${radiusKm}`;
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * When Google Places is unavailable (no API key, billing, quota, or ad-blocker)
 * we still show plausible nearby hospitals so search / list UX stays usable.
 */
export function buildFallbackNearbyHospitals(origin: { lat: number; lon: number }): HospitalInfo[] {
  const seeds = [
    { dlat: 0.0042, dlon: 0.0055, name: 'City General Hospital', tagline: 'Emergency & multi-speciality' },
    { dlat: -0.0035, dlon: 0.0041, name: 'Metro Multispeciality Hospital', tagline: '24×7 casualty' },
    { dlat: 0.006, dlon: -0.0028, name: 'Apollo Clinic', tagline: 'Diagnostics & OPD' },
    { dlat: -0.0048, dlon: -0.0045, name: 'Care & Cure Nursing Home', tagline: 'In-patient care' },
    { dlat: 0.0025, dlon: -0.006, name: 'Sunrise Medical Centre', tagline: 'OPD & pharmacy' },
    { dlat: -0.0065, dlon: 0.003, name: 'Lifeline Superspeciality', tagline: 'Cardiac & neuro' },
  ] as const;

  return seeds.map((s, i) => {
    const lat = origin.lat + s.dlat;
    const lon = origin.lon + s.dlon;
    const dist = haversineKm(origin, { lat, lon });
    return {
      id: `demo_nearby_${i}_${origin.lat.toFixed(3)}_${origin.lon.toFixed(3)}`,
      name: s.name,
      address: `${s.tagline} · ~${dist < 1 ? `${Math.round(dist * 1000)} m` : `${dist.toFixed(1)} km`} away`,
      tagline: s.tagline,
      rating: 4.1 + (i % 5) * 0.15,
      reviewsCount: 180 + i * 73,
      distanceKm: dist,
      location: { lat, lon },
      openingHours: 'Open now',
    };
  });
}

/**
 * Returns real hospitals around `origin` within `radiusKm` using Google
 * Places. Results are augmented with distanceKm and sorted by proximity.
 *
 * NOTE: We do **not** attach doctors to these hospitals. In this app only the
 * showcase hospital has a bookable roster. If the caller needs an always-
 * bookable first item, prepend `SHOWCASE_HOSPITAL` manually.
 */
export async function findNearbyHospitals(
  origin: { lat: number; lon: number },
  radiusKm: number = 8
): Promise<HospitalInfo[]> {
  const key = cacheKey(origin.lat, origin.lon, radiusKm);
  const cached = placesCache.get(key);
  if (cached && Date.now() - cached.at < PLACES_CACHE_MS) return cached.items;

  let maps: typeof google.maps;
  try {
    maps = await loadGoogleMaps(['places']);
  } catch (e) {
    console.warn('[hospitals] Google Maps failed to load', e);
    // If a server proxy is configured, try that before demo results.
    const proxied = await tryServerPlaces(origin, radiusKm);
    return proxied ?? [];
  }

  return new Promise((resolve) => {
    // PlacesService needs a DOM node. We render an invisible one.
    const host = document.createElement('div');
    const svc = new maps.places.PlacesService(host);

    svc.nearbySearch(
      {
        location: { lat: origin.lat, lng: origin.lon },
        radius: Math.min(50_000, Math.max(1000, radiusKm * 1000)),
        type: 'hospital',
      },
      (results, status) => {
        if (status !== maps.places.PlacesServiceStatus.OK || !results) {
          console.warn('[hospitals] nearbySearch status:', status);
          // Try server proxy when browser Places is denied/quota-limited.
          void (async () => {
            const proxied = await tryServerPlaces(origin, radiusKm);
            resolve(proxied ?? []);
          })();
          return;
        }

        const items: HospitalInfo[] = results
          .map((p): HospitalInfo | null => {
            const loc = p.geometry?.location;
            if (!loc) return null;
            const lat = loc.lat();
            const lon = loc.lng();
            const dist = haversineKm(origin, { lat, lon });
            return {
              id: p.place_id || `g_${lat}_${lon}`,
              name: p.name || 'Hospital',
              address: p.vicinity || '',
              rating: typeof p.rating === 'number' ? p.rating : undefined,
              reviewsCount: typeof p.user_ratings_total === 'number' ? p.user_ratings_total : undefined,
              distanceKm: dist,
              location: { lat, lon },
              openingHours: p.opening_hours?.isOpen?.() ? 'Open now' : undefined,
              photoUrl: p.photos?.[0]?.getUrl({ maxWidth: 600, maxHeight: 400 }),
            };
          })
          .filter((x): x is HospitalInfo => x !== null)
          .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

        const finalItems = items;

        placesCache.set(key, { at: Date.now(), items: finalItems, key });
        resolve(finalItems);
      }
    );
  });
}

async function tryServerPlaces(
  origin: { lat: number; lon: number },
  radiusKm: number,
): Promise<HospitalInfo[] | null> {
  if (!functionsOrigin) return null;
  try {
    // `functionsOrigin` should point to the Firebase Functions base.
    // For local emulator: http://127.0.0.1:5001
    // The remaining path is: /<projectId>/<region>/<functionName>
    const projectId = (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || 'arogya-raksha-b43a5';
    const url = `${functionsOrigin}/${projectId}/asia-south1/nearbyHospitals?lat=${encodeURIComponent(String(origin.lat))}&lon=${encodeURIComponent(String(origin.lon))}&radiusKm=${encodeURIComponent(String(radiusKm))}`;
    const r = await fetch(url);
    if (!r.ok) return null;
    const data: any = await r.json();
    const results = (data?.results ?? []) as any[];
    if (!Array.isArray(results) || results.length === 0) return [];

    const items: HospitalInfo[] = results
      .map((p): HospitalInfo | null => {
        if (!p?.location?.lat || !p?.location?.lon) return null;
        const dist = haversineKm(origin, { lat: p.location.lat, lon: p.location.lon });
        return {
          id: p.id || `srv_${p.location.lat}_${p.location.lon}`,
          name: p.name || 'Hospital',
          address: p.address || '',
          rating: typeof p.rating === 'number' ? p.rating : undefined,
          reviewsCount: typeof p.reviewsCount === 'number' ? p.reviewsCount : undefined,
          distanceKm: dist,
          location: { lat: p.location.lat, lon: p.location.lon },
          openingHours: p.openingHours,
          photoUrl: p.photoUrl,
        };
      })
      .filter((x): x is HospitalInfo => x !== null)
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));

    return items;
  } catch (e) {
    console.warn('[hospitals] server proxy failed', e);
    return null;
  }
}

/** Human-friendly distance like "450 m" or "2.3 km". */
export function formatDistanceKm(km: number | undefined | null): string {
  if (km === undefined || km === null || !isFinite(km)) return '';
  if (km < 1) return `${Math.round(km * 1000)} m`;
  return `${km.toFixed(1)} km`;
}

/** Build a list of evenly-spaced time slots for the next N days.
 *  We use the doctor's fee + hours string only for display; slots themselves
 *  are generated on the fly so they're always fresh. */
export interface Slot {
  key: string;            // ISO start
  start: Date;
  end: Date;
  label: string;          // "10:30 AM"
  dateLabel: string;      // "Today" / "Tomorrow" / "Wed, 22 Apr"
}

export function generateSlots(opts: {
  startHour?: number;       // 9
  endHour?: number;         // 20
  stepMinutes?: number;     // 30
  days?: number;            // 5
  slotDurationMinutes?: number; // 30
} = {}): Slot[] {
  const startHour = opts.startHour ?? 9;
  const endHour = opts.endHour ?? 20;
  const step = opts.stepMinutes ?? 30;
  const days = opts.days ?? 5;
  const dur = opts.slotDurationMinutes ?? 30;

  const now = new Date();
  const slots: Slot[] = [];
  for (let d = 0; d < days; d++) {
    const day = new Date(now);
    day.setDate(now.getDate() + d);
    day.setHours(0, 0, 0, 0);

    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += step) {
        const start = new Date(day);
        start.setHours(h, m, 0, 0);
        if (start <= new Date(Date.now() + 15 * 60 * 1000)) continue; // skip past + <15m
        const end = new Date(start.getTime() + dur * 60 * 1000);

        const dateLabel = d === 0 ? 'Today'
          : d === 1 ? 'Tomorrow'
          : start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

        slots.push({
          key: start.toISOString(),
          start,
          end,
          label: start.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
          dateLabel,
        });
      }
    }
  }
  return slots;
}
