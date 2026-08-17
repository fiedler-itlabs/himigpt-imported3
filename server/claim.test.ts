import { describe, expect, it } from "vitest";
import { classifyClaimToken } from "./_core/claim";

const NOW = new Date("2026-07-17T12:00:00Z");
const future = new Date("2026-07-24T12:00:00Z");
const past = new Date("2026-07-10T12:00:00Z");

describe("classifyClaimToken", () => {
  it("treats a missing token as invalid", () => {
    expect(classifyClaimToken(undefined, NOW)).toBe("invalid");
  });

  it("treats an already-used token as used (even if unexpired)", () => {
    expect(
      classifyClaimToken({ expiresAt: future, usedAt: past }, NOW)
    ).toBe("used");
  });

  it("treats an expired token as expired", () => {
    expect(classifyClaimToken({ expiresAt: past, usedAt: null }, NOW)).toBe(
      "expired"
    );
  });

  it("treats a token expiring exactly now as expired (boundary)", () => {
    expect(classifyClaimToken({ expiresAt: NOW, usedAt: null }, NOW)).toBe(
      "expired"
    );
  });

  it("accepts an unused, unexpired token", () => {
    expect(classifyClaimToken({ expiresAt: future, usedAt: null }, NOW)).toBe(
      "valid"
    );
  });
});
