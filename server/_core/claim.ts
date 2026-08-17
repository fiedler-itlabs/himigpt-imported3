import { createHash } from "node:crypto";
import type { Express, Request, Response } from "express";
import { auth } from "../auth";
import {
  completeUserClaim,
  findClaimTokenByHash,
  getUserById,
} from "../db";
import { beginClaim, endClaim } from "./claimGuard";

export type ClaimStatus = "valid" | "invalid" | "expired" | "used";

/**
 * Pure token classification — the single source of truth for whether a claim
 * token may be spent. Kept side-effect-free so it can be unit-tested.
 */
export function classifyClaimToken(
  token: { expiresAt: Date; usedAt: Date | null } | undefined,
  now: Date
): ClaimStatus {
  if (!token) return "invalid";
  if (token.usedAt) return "used";
  if (token.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}

const CLAIM_ERROR: Record<Exclude<ClaimStatus, "valid">, string> = {
  invalid: "This claim link is not valid.",
  expired: "This claim link has expired. Please request a new one.",
  used: "This claim link has already been used.",
};

const MIN_PASSWORD_LENGTH = 8;

const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

const readField = (body: unknown, field: string): string => {
  if (body && typeof body === "object" && field in body) {
    const value = (body as Record<string, unknown>)[field];
    if (typeof value === "string") return value;
  }
  return "";
};

export function registerClaimRoutes(app: Express): void {
  // Inspect a claim link so the /claim page can greet the right person before
  // asking them to set a password. Never reveals anything beyond the email the
  // link was issued for.
  app.post("/api/claim/verify", async (req: Request, res: Response) => {
    const token = readField(req.body, "token");
    const row = await findClaimTokenByHash(hashToken(token));
    const status = classifyClaimToken(row, new Date());
    if (status !== "valid") {
      return res.status(400).json({ error: CLAIM_ERROR[status] });
    }
    return res.json({ email: row?.email ?? null });
  });

  // Complete the claim: create the Better Auth account, atomically bind it to
  // the legacy row and burn the token, then hand back the session cookie.
  app.post("/api/claim/complete", async (req: Request, res: Response) => {
    const token = readField(req.body, "token");
    const password = readField(req.body, "password");
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
      });
    }

    const row = await findClaimTokenByHash(hashToken(token));
    const status = classifyClaimToken(row, new Date());
    if (status !== "valid" || !row) {
      return res
        .status(400)
        .json({ error: CLAIM_ERROR[status as Exclude<ClaimStatus, "valid">] });
    }

    const legacy = await getUserById(row.userId);
    if (!legacy || legacy.betterAuthId) {
      return res
        .status(400)
        .json({ error: "This account has already been claimed." });
    }

    const email = row.email ?? legacy.email;
    if (!email) {
      return res
        .status(400)
        .json({ error: "This account has no email address to sign in with." });
    }

    beginClaim(email);
    try {
      const signUp = await auth.api.signUpEmail({
        body: { email, password, name: legacy.name ?? email },
        returnHeaders: true,
      });
      const betterAuthId = signUp.response?.user?.id;
      if (!betterAuthId) {
        return res
          .status(500)
          .json({ error: "Could not create your account. Please try again." });
      }
      await completeUserClaim({
        tokenId: row.id,
        userId: legacy.id,
        betterAuthId,
      });
      const setCookie = signUp.headers?.get("set-cookie");
      if (setCookie) res.append("set-cookie", setCookie);
      return res.json({ ok: true });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Claiming your account failed.";
      return res.status(400).json({ error: message });
    } finally {
      endClaim(email);
    }
  });
}
