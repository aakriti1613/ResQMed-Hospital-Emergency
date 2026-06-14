import type { UserProfile } from './user';
import { hasGrantedGPS } from '../hooks/useSharedLocation';
import { getCompletedChallengeCount } from './challengeProgress';

export type ReadinessFactor = {
  id: string;
  label: string;
  description: string;
  maxPoints: number;
  earned: number;
  complete: boolean;
  actionPath?: string;
  actionLabel?: string;
};

export type EmergencyReadinessResult = {
  score: number;
  grade: 'Critical' | 'Low' | 'Moderate' | 'Good' | 'Excellent';
  gradeColor: string;
  factors: ReadinessFactor[];
  tips: string[];
};

function profileCompletionScore(profile: UserProfile | null): number {
  if (!profile) return 0;
  let pts = 0;
  if (profile.name?.trim()) pts += 5;
  if (profile.phone?.trim()) pts += 5;
  if (profile.dob?.trim()) pts += 5;
  if (profile.bloodGroup?.trim()) pts += 5;
  if (profile.gender) pts += 5;
  return Math.min(25, pts);
}

function contactsScore(profile: UserProfile | null): number {
  const valid = profile?.contacts?.filter(
    (c) => c.name?.trim() && c.phone?.replace(/\D/g, '').length >= 10
  ) ?? [];
  if (valid.length >= 2) return 25;
  if (valid.length === 1) return 18;
  return 0;
}

function locationScore(hasLocation: boolean): number {
  if (hasGrantedGPS() || hasLocation) return 20;
  return 0;
}

function medicalInfoScore(profile: UserProfile | null): number {
  if (!profile) return 0;
  let pts = 0;
  if (profile.allergies?.trim()) pts += 5;
  if (profile.medicalConditions?.trim()) pts += 5;
  if (profile.medications?.trim()) pts += 5;
  if (profile.addresses?.some((a) => a.line?.trim())) pts += 5;
  return Math.min(15, pts);
}

function firstAidAwarenessScore(userId: string | undefined): number {
  if (!userId) return 0;
  const completed = getCompletedChallengeCount(userId);
  if (completed >= 3) return 15;
  if (completed >= 1) return 10;
  return 0;
}

function gradeFromScore(score: number): EmergencyReadinessResult['grade'] {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Moderate';
  if (score >= 30) return 'Low';
  return 'Critical';
}

const GRADE_COLORS: Record<EmergencyReadinessResult['grade'], string> = {
  Critical: '#ef4444',
  Low: '#f97316',
  Moderate: '#eab308',
  Good: '#22c55e',
  Excellent: '#06b6d4',
};

export function computeEmergencyReadiness(
  profile: UserProfile | null,
  userId: string | undefined,
  hasLocation: boolean
): EmergencyReadinessResult {
  const profilePts = profileCompletionScore(profile);
  const contactPts = contactsScore(profile);
  const locPts = locationScore(hasLocation);
  const medicalPts = medicalInfoScore(profile);
  const aidPts = firstAidAwarenessScore(userId);

  const factors: ReadinessFactor[] = [
    {
      id: 'contacts',
      label: 'Emergency contacts',
      description: 'At least one trusted contact with phone number',
      maxPoints: 25,
      earned: contactPts,
      complete: contactPts >= 18,
      actionPath: '/app/profile',
      actionLabel: 'Add contacts',
    },
    {
      id: 'location',
      label: 'Location access',
      description: 'GPS enabled for faster SOS dispatch',
      maxPoints: 20,
      earned: locPts,
      complete: locPts >= 20,
      actionPath: '/app/safety',
      actionLabel: 'Enable GPS',
    },
    {
      id: 'profile',
      label: 'Profile completion',
      description: 'Name, phone, DOB, blood group on file',
      maxPoints: 25,
      earned: profilePts,
      complete: profilePts >= 20,
      actionPath: '/app/profile',
      actionLabel: 'Complete profile',
    },
    {
      id: 'medical',
      label: 'Medical info',
      description: 'Allergies, conditions, or saved addresses',
      maxPoints: 15,
      earned: medicalPts,
      complete: medicalPts >= 10,
      actionPath: '/app/medical-id',
      actionLabel: 'Add health info',
    },
    {
      id: 'firstaid',
      label: 'First-aid awareness',
      description: 'Health day quizzes & scenario challenges',
      maxPoints: 15,
      earned: aidPts,
      complete: aidPts >= 10,
      actionPath: '/app/challenges',
      actionLabel: 'Play challenges',
    },
  ];

  const score = Math.min(100, profilePts + contactPts + locPts + medicalPts + aidPts);
  const grade = gradeFromScore(score);

  const tips = factors
    .filter((f) => !f.complete)
    .slice(0, 3)
    .map((f) => f.description);

  return { score, grade, gradeColor: GRADE_COLORS[grade], factors, tips };
}
