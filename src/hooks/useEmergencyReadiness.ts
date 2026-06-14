import { useMemo } from 'react';
import { useAuth } from '../auth/AuthProvider';
import { getChallengeUserId } from '../lib/challengeUserId';
import { listenUserProfile, type UserProfile } from '../data/user';
import { useSharedLocation } from './useSharedLocation';
import { computeEmergencyReadiness } from '../data/readinessScore';
import { useEffect, useState } from 'react';

export function useEmergencyReadiness() {
  const { user } = useAuth();
  const { currentLocation } = useSharedLocation();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [progressTick, setProgressTick] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setProfile(null);
      return;
    }
    return listenUserProfile(user.uid, setProfile);
  }, [user?.uid]);

  useEffect(() => {
    const refresh = () => setProgressTick((t) => t + 1);
    window.addEventListener('arogya-challenge-progress', refresh);
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'arogya_challenge_progress_v1') refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener('arogya-challenge-progress', refresh);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const readiness = useMemo(
    () =>
      computeEmergencyReadiness(
        profile,
        getChallengeUserId(user?.uid),
        Boolean(currentLocation)
      ),
    [profile, user?.uid, currentLocation, progressTick]
  );

  const refresh = () => setProgressTick((t) => t + 1);

  return { readiness, profile, refresh };
}
