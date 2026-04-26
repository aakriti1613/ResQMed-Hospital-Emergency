import { useEffect } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { updateUserProfile } from '../data/user';

export function useLiveLocationTracking(enabled: boolean = true) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user || !enabled) return;

    let watchId: number;

    const requestLocation = () => {
      if (!navigator.geolocation) {
        console.warn('Geolocation is not supported by this browser.');
        return;
      }

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          updateUserProfile(user.uid, {
            location: { lat: latitude, lon: longitude },
          });
        },
        (error) => {
          console.warn('Live location tracking failed:', error.message);
        },
        { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
      );
    };

    requestLocation();

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [user, enabled]);
}
