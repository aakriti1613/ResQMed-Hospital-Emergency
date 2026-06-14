export type LatLon = { lat: number; lon: number };

export function distanceMeters(a: LatLon, b: LatLon): number {
  const R = 6371e3;
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lon - a.lon) * Math.PI) / 180;
  const x =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

export function etaMinutes(distanceM: number, speedKmh = 25): number {
  const mps = (speedKmh * 1000) / 3600;
  return Math.max(1, Math.round(distanceM / mps / 60));
}

