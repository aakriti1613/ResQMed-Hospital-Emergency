import { useState, useEffect } from 'react';

export type LocationSource = 'gps' | 'manual' | 'hardware' | 'lastKnown';

export interface SavedLocation {
  lat: number;
  lon: number;
  displayName?: string;
  source: LocationSource;
  timestamp: number;
}

const DEFAULT_STORAGE_KEY = 'arogya_raksha_location';
const BASE_EVENT_KEY = 'arogya_location_updated';
export const GPS_GRANTED_KEY = 'arogya_gps_ever_granted';

// Returns true if the user has EVER granted GPS permission (persists forever)
export const hasGrantedGPS = () => localStorage.getItem(GPS_GRANTED_KEY) === 'true';

export const isLocationFresh = (timestamp: number) => {
  return (Date.now() - timestamp) <= 8 * 60 * 1000; // ≤ 8 minutes
};

export const useSharedLocation = (storageKey = DEFAULT_STORAGE_KEY) => {
  const eventKey = `${BASE_EVENT_KEY}_${storageKey}`;

  const [currentLocation, setCurrentLocation] = useState<SavedLocation | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'pending' | 'ok' | 'denied'>('idle');

  // Unified load function
  const loadLoc = () => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        setCurrentLocation(JSON.parse(stored) as SavedLocation);
      } else {
        setCurrentLocation(null);
      }
    } catch {
      // Ignored
    }
  };

  // Load from localStorage on mount & listen for cross-component updates
  useEffect(() => {
    loadLoc();
    window.addEventListener(eventKey, loadLoc);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === storageKey) loadLoc();
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(eventKey, loadLoc);
      window.removeEventListener('storage', handleStorage);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const saveLocation = (loc: Omit<SavedLocation, 'timestamp'>) => {
    const fullLoc: SavedLocation = { ...loc, timestamp: Date.now() };
    setCurrentLocation(fullLoc);
    localStorage.setItem(storageKey, JSON.stringify(fullLoc));
    setLocStatus('ok');
    // Mark that the user has ever granted/used GPS (persists even after logout)
    if (loc.source === 'gps') {
      localStorage.setItem(GPS_GRANTED_KEY, 'true');
    }
    window.dispatchEvent(new Event(eventKey));
    return fullLoc;
  };

  const requestGPS = async (options?: { silent?: boolean; showAlert?: boolean }): Promise<SavedLocation | null> => {
    let timeoutMs = 12000; // Default 12 seconds for normal connections
    try {
      if (navigator.permissions) {
        const perm = await navigator.permissions.query({ name: 'geolocation' });
        
        // If it's a first time prompt, give them 60 full seconds to read the browser popup!
        if (perm.state === 'prompt') {
          timeoutMs = 60000;
          if (options?.silent) return null;
        }

        if (perm.state === 'denied') {
          setLocStatus('denied');
          if (!options?.silent && options?.showAlert !== false) {
            alert('Location is blocked. Please click the Lock icon 🔒 in your browser URL bar to allow location access, then try again.');
          }
          return null;
        }
      }
    } catch {
      // Ignored for older browsers
    }

    if (!options?.silent) setLocStatus('pending');

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (p) => {
          const loc = saveLocation({
            lat: p.coords.latitude,
            lon: p.coords.longitude,
            source: 'gps',
            displayName: 'Current Location',
          });
          resolve(loc);
        },
        (err) => {
          if (!options?.silent) {
            if (err.code === err.PERMISSION_DENIED) setLocStatus('denied');
            else setLocStatus('idle');
          }
          resolve(null);
        },
        { timeout: timeoutMs, enableHighAccuracy: true }
      );
    });
  };

  const clearLocation = () => {
    setCurrentLocation(null);
    setLocStatus('idle');
    localStorage.removeItem(storageKey);
    window.dispatchEvent(new Event(eventKey));
  };

  return {
    currentLocation,
    locStatus,
    setLocStatus,
    saveLocation,
    requestGPS,
    clearLocation,
  };
};
