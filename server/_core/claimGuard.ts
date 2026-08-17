// Tracks emails whose Better Auth sign-up is a sanctioned account-claim in
// progress, so the sign-up block hook (server/auth.ts) lets exactly those
// through while still rejecting strangers. In-process state is sufficient: the
// claim endpoint (server/_core/claim.ts) and the Better Auth handler run in the
// same Node process and the window is a single synchronous sign-up call.

const claimsInProgress = new Set<string>();

const key = (email: string): string => email.trim().toLowerCase();

export function beginClaim(email: string): void {
  claimsInProgress.add(key(email));
}

export function endClaim(email: string): void {
  claimsInProgress.delete(key(email));
}

export function isClaimInProgress(email: string): boolean {
  return claimsInProgress.has(key(email));
}
