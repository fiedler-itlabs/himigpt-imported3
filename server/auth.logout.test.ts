import { beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_NAME } from "../shared/const";
import type { TrpcContext } from "./_core/context";

const { signOut } = vi.hoisted(() => ({ signOut: vi.fn() }));
vi.mock("./auth", () => ({
  auth: { api: { signOut } },
}));

import { appRouter } from "./routers";

type CookieCall = {
  name: string;
  options: Record<string, unknown>;
};

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): {
  ctx: TrpcContext;
  clearedCookies: CookieCall[];
} {
  const clearedCookies: CookieCall[] = [];

  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: (name: string, options: Record<string, unknown>) => {
        clearedCookies.push({ name, options });
      },
    } as TrpcContext["res"],
  };

  return { ctx, clearedCookies };
}

describe("auth.logout", () => {
  beforeEach(() => {
    signOut.mockReset();
    signOut.mockResolvedValue({ success: true });
  });

  it("revokes the Better Auth session and clears the legacy cookie", async () => {
    const { ctx, clearedCookies } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.logout();

    expect(result).toEqual({ success: true });
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(clearedCookies).toHaveLength(1);
    expect(clearedCookies[0]?.name).toBe(COOKIE_NAME);
    // Only the invariants this migration owns: the legacy session cookie is
    // really expired and stays unreadable to scripts. `sameSite` is the app's
    // own policy (iframe previews need "none", standalone apps prefer "lax") —
    // asserting it here would fail apps that legitimately tightened it.
    expect(clearedCookies[0]?.options).toMatchObject({
      maxAge: -1,
      secure: true,
      httpOnly: true,
      path: "/",
    });
  });

  it("still succeeds when there is no Better Auth session to revoke", async () => {
    signOut.mockRejectedValue(new Error("no session"));
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.auth.logout()).resolves.toEqual({ success: true });
  });
});
