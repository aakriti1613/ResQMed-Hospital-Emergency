/** Stable ID for challenge progress. Logged-in user or persistent guest. */
export function getChallengeUserId(authUid?: string | null): string {
  if (authUid) return authUid;
  let gid = localStorage.getItem('arogya_guest_uid');
  if (!gid) {
    gid = `guest-${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem('arogya_guest_uid', gid);
  }
  return gid;
}

export function isLoggedInUser(authUid?: string | null): boolean {
  return Boolean(authUid);
}
