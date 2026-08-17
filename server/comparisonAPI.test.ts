import { describe, it, expect, beforeAll } from "vitest";
import { appRouter } from "./routers";
import { getDb } from "./db";
import type { User } from "../drizzle/schema";

describe("Contract Comparison API", () => {
  let caller: ReturnType<typeof appRouter.createCaller>;
  let testUser: User;
  let contractIds: number[];

  beforeAll(async () => {
    const db = await getDb();
    
    // Get test user (owner)
    const users = await db.query.users.findMany({ limit: 1 });
    testUser = users[0];

    // Get available contracts for testing
    const contracts = await db.query.contracts.findMany({ 
      where: (contracts, { eq }) => eq(contracts.status, "ready"),
      limit: 3 
    });
    contractIds = contracts.map(c => c.id);

    // Create test caller with authenticated context
    caller = appRouter.createCaller({
      user: testUser,
      req: {} as any,
      res: {} as any,
    });
  });

  it("should compare multiple contracts successfully", async () => {
    if (contractIds.length < 2) {
      console.log("Skipping test: need at least 2 ready contracts");
      return;
    }

    const result = await caller.comparison.compare({
      contractIds: contractIds.slice(0, 2),
      query: "Vergleiche die Gültigkeitszeiträume",
    });

    expect(result).toBeDefined();
    expect(result.query).toBe("Vergleiche die Gültigkeitszeiträume");
    expect(result.summary).toBeDefined();
    expect(typeof result.summary).toBe("string");
    expect(result.summary.length).toBeGreaterThan(0);
    expect(result.comparisons).toBeDefined();
    expect(result.comparisons.length).toBe(2);
  });

  it("should fail with less than 2 contracts", async () => {
    if (contractIds.length < 1) {
      console.log("Skipping test: need at least 1 contract");
      return;
    }

    await expect(
      caller.comparison.compare({
        contractIds: [contractIds[0]],
        query: "Test query",
      })
    ).rejects.toThrow();
  });

  it("should fail with non-existent contract", async () => {
    await expect(
      caller.comparison.compare({
        contractIds: [999999, 999998],
        query: "Test query",
      })
    ).rejects.toThrow();
  });

  it("should handle price comparison queries", async () => {
    if (contractIds.length < 2) {
      console.log("Skipping test: need at least 2 ready contracts");
      return;
    }

    const result = await caller.comparison.compare({
      contractIds: contractIds.slice(0, 2),
      query: "Vergleiche alle Preise",
    });

    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
  });

  it("should handle position number comparison queries", async () => {
    if (contractIds.length < 2) {
      console.log("Skipping test: need at least 2 ready contracts");
      return;
    }

    const result = await caller.comparison.compare({
      contractIds: contractIds.slice(0, 2),
      query: "Vergleiche Positionsnummern",
    });

    expect(result).toBeDefined();
    expect(result.summary).toBeDefined();
  });
});
