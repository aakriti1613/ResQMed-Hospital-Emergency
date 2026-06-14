/// <reference types="google.maps" />
import { loadGoogleMaps } from '../lib/googleMaps';

export type LatLon = { lat: number; lon: number };

export type RouteInfo = {
  etaSeconds: number;
  distanceMeters: number;
  /** Encoded polyline for the full route (Google format) */
  routeEncoded: string;
};

let directionsService: google.maps.DirectionsService | null = null;

async function getService(): Promise<google.maps.DirectionsService> {
  if (directionsService) return directionsService;
  await loadGoogleMaps(['geometry']);
  directionsService = new google.maps.DirectionsService();
  return directionsService;
}

/**
 * Compute driving route from `origin` → `destination` using Google Directions API.
 * Returns ETA (seconds), distance (meters), and the encoded polyline.
 *
 * NOTE: Each call is billed. Callers should throttle (e.g. once per 30 s while
 * helper is actively en-route).
 */
export async function computeRoute(
  origin: LatLon,
  destination: LatLon,
  mode: google.maps.TravelMode | 'DRIVING' | 'WALKING' | 'BICYCLING' = 'DRIVING'
): Promise<RouteInfo | null> {
  const svc = await getService();

  const travelMode =
    typeof mode === 'string'
      ? (google.maps.TravelMode as any)[mode]
      : mode;

  const res = await svc.route({
    origin: { lat: origin.lat, lng: origin.lon },
    destination: { lat: destination.lat, lng: destination.lon },
    travelMode,
  });

  const route = res.routes?.[0];
  const leg = route?.legs?.[0];
  if (!route || !leg) return null;

  return {
    etaSeconds: leg.duration?.value ?? 0,
    distanceMeters: leg.distance?.value ?? 0,
    routeEncoded: route.overview_polyline ?? '',
  };
}

/**
 * Decode an encoded polyline string into an array of LatLngLiteral.
 * Requires the `geometry` library to be loaded.
 */
export async function decodePolyline(
  encoded: string
): Promise<google.maps.LatLngLiteral[]> {
  if (!encoded) return [];
  await loadGoogleMaps(['geometry']);
  const path = google.maps.geometry.encoding.decodePath(encoded);
  return path.map((p) => ({ lat: p.lat(), lng: p.lng() }));
}

/** Haversine distance in meters. Used for cheap arrival detection. */
export function haversineMeters(a: LatLon, b: LatLon): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Format a seconds value as a short "mins" label (e.g. "12 min", "45 s"). */
export function formatEta(seconds: number | undefined | null): string {
  if (!seconds || seconds <= 0) return '—';
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h} h ${m} min`;
}

/** Format meters → "850 m" or "2.3 km". */
export function formatDistance(meters: number | undefined | null): string {
  if (!meters || meters <= 0) return '—';
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(1)} km`;
}
