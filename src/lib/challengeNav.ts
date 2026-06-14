/** Preserve entry point when navigating health-challenge routes. */
export type ChallengeFrom = 'safety' | 'home' | 'profile';

/** Broader back-navigation context (includes SOS). */
export type AppFrom = ChallengeFrom | 'sos' | 'help';

export function challengeFromQuery(raw: string | null): ChallengeFrom | null {
  if (raw === 'safety' || raw === 'home' || raw === 'profile') return raw;
  return null;
}

export function appFromQuery(raw: string | null): AppFrom | null {
  if (raw === 'safety' || raw === 'home' || raw === 'profile' || raw === 'sos' || raw === 'help') return raw;
  return null;
}

export function challengeBackPath(from: ChallengeFrom | null): string {
  return appBackPath(from);
}

export function appBackPath(from: AppFrom | null): string {
  if (from === 'safety') return '/app/safety';
  if (from === 'profile') return '/app/profile';
  if (from === 'sos') return '/app/sos';
  if (from === 'help') return '/app/help?from=safety';
  return '/app';
}

export function challengesHref(from?: ChallengeFrom | null): string {
  return from ? `/app/challenges?from=${from}` : '/app/challenges';
}

export function challengeEventHref(eventId: string, from?: ChallengeFrom | null): string {
  const base = `/app/challenges/${eventId}`;
  return from ? `${base}?from=${from}` : base;
}

export function challengeQuerySuffix(from: ChallengeFrom | null): string {
  return from ? `?from=${from}` : '';
}

/** Append ?from= when opening sub-pages from profile/safety/home context. */
export function withFromContext(path: string, from?: ChallengeFrom | null): string {
  if (!from) return path;
  if (path.startsWith('/app/challenges')) return challengesHref(from);
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}from=${from}`;
}

export function withAppFrom(path: string, from?: AppFrom | null): string {
  if (!from) return path;
  if (from === 'safety' || from === 'home' || from === 'profile') {
    return withFromContext(path, from);
  }
  const sep = path.includes('?') ? '&' : '?';
  return `${path}${sep}from=${from}`;
}
