/// <reference types="google.maps" />

/**
 * Shared Google Maps JS API loader.
 *
 * - Single script tag guaranteed, even when multiple components request different
 *   library sets concurrently (we request the union of all libraries ever asked for).
 * - Returns the resolved `google.maps` namespace so callers can `await` it.
 */

type MapsLibrary = 'places' | 'geometry' | 'drawing' | 'visualization' | 'marker';

let loadPromise: Promise<typeof google.maps> | null = null;
const requestedLibs = new Set<MapsLibrary>(['places', 'geometry']);

export function loadGoogleMaps(libraries: MapsLibrary[] = []): Promise<typeof google.maps> {
  libraries.forEach((l) => requestedLibs.add(l));

  if (typeof google !== 'undefined' && google?.maps) {
    return Promise.resolve(google.maps);
  }

  if (loadPromise) return loadPromise;

  const key = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!key) {
    return Promise.reject(new Error('Missing VITE_GOOGLE_MAPS_API_KEY'));
  }

  loadPromise = new Promise((resolve, reject) => {
    const libs = Array.from(requestedLibs).join(',');
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=${libs}&v=weekly`;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      if (typeof google !== 'undefined' && google?.maps) resolve(google.maps);
      else reject(new Error('Google Maps failed to initialize'));
    };
    script.onerror = () => reject(new Error('Failed to load Google Maps JS API'));
    document.head.appendChild(script);
  });

  return loadPromise;
}
