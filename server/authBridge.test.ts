import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "../drizzle/schema";

vi.mock("./db", () => ({
  getUserByBetterAuthId: vi.fn(),
  createUserFromAuth: vi.fn(),
}));

import * as db from "./db";
import { resolveAuthUser } from "./_core/authBridge";

const mocked = vi.mocked(db);

function legacyUser(overrides: Partial<User> = {}): User {
  return {
    id: 30003,
    openId: "legacy-open-id-1",
    betterAuthId: null,
    name: "Jane Example",
    email: "jane@example.com",
    loginMethod: "google",
    role: "user",
    claimStatus: "pending",
    createdAt: new Date("2026-07-01"),
    updatedAt: new Date("2026-07-01"),
    lastSignedIn: new Date("2026-07-08"),
    ...overrides,
  };
}

const authUser = {
  id: "ba-uuid-1",
  email: "jane@example.com",
  name: "Jane Example",
};

describe("resolveAuthUser", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns the already-linked legacy user by betterAuthId", async () => {
    const linked = legacyUser({
      betterAuthId: "ba-uuid-1",
      claimStatus: "claimed",
    });
    mocked.getUserByBetterAuthId.mockResolvedValue(linked);

    const result = await resolveAuthUser(authUser);

    expect(result).toEqual(linked);
    expect(mocked.createUserFromAuth).not.toHaveBeenCalled();
  });

  it("SECURITY: never claims a legacy user by matching email", async () => {
    // A stranger signs up with the same email as a migrated (pending) user.
    // The bridge must NOT hand them the legacy row — it creates a fresh, empty
    // account instead. The legacy data stays reachable only via a claim token
    // (server/_core/claim.ts), never from knowledge of the email alone.
    const created = legacyUser({
      id: 30004,
      openId: "ba:ba-uuid-1",
      betterAuthId: "ba-uuid-1",
      loginMethod: "password",
      claimStatus: "claimed",
    });
    mocked.getUserByBetterAuthId.mockResolvedValue(undefined);
    mocked.createUserFromAuth.mockResolvedValue(created);

    const result = await resolveAuthUser(authUser);

    expect(mocked.createUserFromAuth).toHaveBeenCalledWith({
      betterAuthId: "ba-uuid-1",
      email: "jane@example.com",
      name: "Jane Example",
    });
    expect(result).toEqual(created);
    expect(result.id).not.toBe(30003);
  });

  it("creates a fresh legacy user for a genuinely new sign-up", async () => {
    const created = legacyUser({
      id: 30005,
      openId: "ba:ba-uuid-2",
      betterAuthId: "ba-uuid-2",
      email: "new@example.com",
      loginMethod: "password",
      claimStatus: "claimed",
    });
    mocked.getUserByBetterAuthId.mockResolvedValue(undefined);
    mocked.createUserFromAuth.mockResolvedValue(created);

    const result = await resolveAuthUser({
      id: "ba-uuid-2",
      email: "new@example.com",
      name: "New Person",
    });

    expect(result).toEqual(created);
  });

  it("handles a sign-up with no email", async () => {
    const created = legacyUser({
      id: 30006,
      email: null,
      claimStatus: "claimed",
    });
    mocked.getUserByBetterAuthId.mockResolvedValue(undefined);
    mocked.createUserFromAuth.mockResolvedValue(created);

    const result = await resolveAuthUser({
      id: "ba-uuid-3",
      email: "",
      name: "X",
    });

    expect(mocked.createUserFromAuth).toHaveBeenCalledWith({
      betterAuthId: "ba-uuid-3",
      email: null,
      name: "X",
    });
    expect(result).toEqual(created);
  });
});
