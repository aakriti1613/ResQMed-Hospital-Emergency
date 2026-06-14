// ─────────────────────────────────────────────────────────────────────────────
// Arogya Raksha — Helper Rewards ladder
//
// Every helper earns points when they respond to an SOS (see `rewardHelperPoints`
// in `./user.ts`). Those points unlock progressive tiers in the Profile page.
//
// Keep the tier list in ASCENDING order of `points`. The first tier MUST be
// `points: 0` so that even new users have a valid "current" tier.
// ─────────────────────────────────────────────────────────────────────────────

export type RewardTier = {
  id: string;
  name: string;
  /** Minimum points required to enter this tier. */
  points: number;
  /** Short one-liner shown under the tier name. */
  tagline: string;
  /** The main perk shown as the big headline unlock. */
  headlinePerk: string;
  /** Additional perks shown as bullets. */
  perks: string[];
  /** CSS gradient used for the badge, ring & progress bar. */
  gradient: string;
  /** Accent colour (hex) used for text highlights. */
  accent: string;
  /** Badge emoji (Unicode so it works without any extra asset loading). */
  emoji: string;
};

export const REWARD_TIERS: RewardTier[] = [
  {
    id: 'newcomer',
    name: 'Newcomer',
    points: 0,
    tagline: 'Welcome to the community',
    headlinePerk: 'Start helping to earn rewards',
    perks: [
      'Respond to SOS alerts near you',
      'Earn 50 points per verified rescue',
      'Access to basic health tracking',
    ],
    gradient: 'linear-gradient(135deg,#64748b,#334155)',
    accent: '#94a3b8',
    emoji: '👋',
  },
  {
    id: 'bronze',
    name: 'Bronze Helper',
    points: 100,
    tagline: "You've saved a day",
    headlinePerk: '1 free consultation voucher',
    perks: [
      'One free doctor consultation / month',
      'Priority listing in help radius',
      'Bronze responder badge on profile',
    ],
    gradient: 'linear-gradient(135deg,#b45309,#78350f)',
    accent: '#f59e0b',
    emoji: '🥉',
  },
  {
    id: 'silver',
    name: 'Silver Responder',
    points: 300,
    tagline: 'A trusted first responder',
    headlinePerk: '15% off any hospital booking',
    perks: [
      '15% off appointment bookings',
      'Free monthly health check-up',
      'Ambulance priority dispatch',
      'Silver responder badge',
    ],
    gradient: 'linear-gradient(135deg,#64748b,#94a3b8)',
    accent: '#cbd5e1',
    emoji: '🥈',
  },
  {
    id: 'gold',
    name: 'Gold Guardian',
    points: 600,
    tagline: 'A guardian of your locality',
    headlinePerk: 'Free quarterly full-body check-up',
    perks: [
      'Free quarterly full-body check-up',
      '25% off specialist consultations',
      'Unlocked AI health insights',
      'Gold guardian badge',
    ],
    gradient: 'linear-gradient(135deg,#f59e0b,#b45309)',
    accent: '#fbbf24',
    emoji: '🏅',
  },
  {
    id: 'platinum',
    name: 'Platinum Lifesaver',
    points: 1000,
    tagline: 'A verified lifesaver',
    headlinePerk: '₹5,000 health-insurance credit',
    perks: [
      '₹5,000 credit on annual health insurance',
      'Free annual full-body master check-up',
      'Concierge doctor on-call 24×7',
      'Platinum lifesaver badge',
      'Priority SOS responder verification',
    ],
    gradient: 'linear-gradient(135deg,#06b6d4,#6366f1)',
    accent: '#67e8f9',
    emoji: '💎',
  },
];

export type TierProgress = {
  current: RewardTier;
  next: RewardTier | null;
  /** 0–100 progress within the current tier (0 if max tier). */
  pct: number;
  /** Points still needed to hit the next tier (0 if max tier). */
  remaining: number;
  /** Points already earned within the current tier. */
  earnedInTier: number;
  /** Total points span of the current tier (1 if max tier, to avoid /0 in UIs). */
  tierSpan: number;
};

/** Returns the highest tier the user has already reached. */
export function currentTier(points: number): RewardTier {
  // REWARD_TIERS is guaranteed non-empty by this module's contract.
  let tier: RewardTier = REWARD_TIERS[0]!;
  for (const t of REWARD_TIERS) {
    if (points >= t.points) tier = t;
    else break;
  }
  return tier;
}

/** Returns the next tier, or `null` if the user is already at the top. */
export function nextTier(points: number): RewardTier | null {
  return REWARD_TIERS.find((t) => points < t.points) ?? null;
}

/** Convenience: all progress info needed by UI components. */
export function tierProgress(points: number): TierProgress {
  const safe = Math.max(0, Math.floor(points || 0));
  const cur = currentTier(safe);
  const nxt = nextTier(safe);

  if (!nxt) {
    return {
      current: cur,
      next: null,
      pct: 100,
      remaining: 0,
      earnedInTier: safe - cur.points,
      tierSpan: 1,
    };
  }

  const span = nxt.points - cur.points;
  const earned = safe - cur.points;
  return {
    current: cur,
    next: nxt,
    pct: Math.min(100, Math.max(0, (earned / span) * 100)),
    remaining: Math.max(0, nxt.points - safe),
    earnedInTier: earned,
    tierSpan: span,
  };
}
