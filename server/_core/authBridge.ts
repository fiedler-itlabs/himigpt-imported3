import type { User } from "../../drizzle/schema";
import { createUserFromAuth, getUserByBetterAuthId } from "../db";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

// Maps a Better Auth session user to the legacy `users` row that owns the app
// data (tasks.userId references users.id). Resolution order:
// 1. Already linked via users.betterAuthId — this includes users who just
//    completed the token-gated claim flow (see server/_core/claim.ts), which
//    sets betterAuthId on their legacy row before the session resolves.
// 2. Create a fresh legacy row for genuinely new sign-ups.
//
// SECURITY: there is deliberately NO "claim by matching email" path here.
// Migrated legacy users are reclaimed ONLY by presenting a single-use claim
// token issued by the control plane (server/_core/claim.ts). Claiming an
// account from mere knowledge of its email address is an account-takeover
// vector, so plain sign-ups never inherit a legacy user's data.
export async function resolveAuthUser(authUser: AuthUser): Promise<User> {
  const linked = await getUserByBetterAuthId(authUser.id);
  if (linked) return linked;

  return createUserFromAuth({
    betterAuthId: authUser.id,
    email: authUser.email || null,
    name: authUser.name || null,
  });
}
