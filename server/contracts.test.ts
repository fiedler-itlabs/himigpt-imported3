import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock the database functions
vi.mock("./db", () => ({
  getDb: vi.fn().mockResolvedValue({}),
  upsertUser: vi.fn().mockResolvedValue(undefined),
  getUserByOpenId: vi.fn().mockResolvedValue(undefined),
  updateContractMetadata: vi.fn().mockResolvedValue(undefined),
  createContractChunks: vi.fn().mockResolvedValue(undefined),
  deleteChunksByContractId: vi.fn().mockResolvedValue(undefined),
  searchSimilarChunks: vi.fn().mockResolvedValue([]),
  createContract: vi.fn().mockResolvedValue({
    id: 1,
    name: "Test Contract",
    pdfUrl: "https://example.com/test.pdf",
    pdfKey: "contracts/test.pdf",
    status: "pending",
    uploadedBy: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getAllContracts: vi.fn().mockResolvedValue([
    {
      id: 1,
      name: "Test Contract",
      insuranceCompany: "AOK Bayern",
      productArea: "Hilfsmittel",
      totalPages: 50,
      status: "ready",
      createdAt: new Date(),
    },
  ]),
  getContractById: vi.fn().mockResolvedValue({
    id: 1,
    name: "Test Contract",
    pdfUrl: "https://example.com/test.pdf",
    pdfKey: "contracts/test.pdf",
    status: "ready",
  }),
  updateContractStatus: vi.fn().mockResolvedValue(undefined),
  deleteContract: vi.fn().mockResolvedValue(undefined),
  getChatsByUserId: vi.fn().mockResolvedValue([]),
  createChat: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    title: "Neuer Chat",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getChatById: vi.fn().mockResolvedValue({
    id: 1,
    userId: 1,
    title: "Test Chat",
    createdAt: new Date(),
    updatedAt: new Date(),
  }),
  getMessagesByChatId: vi.fn().mockResolvedValue([]),
  deleteChat: vi.fn().mockResolvedValue(undefined),
}));

// Mock storage
vi.mock("./storage", () => ({
  storagePut: vi.fn().mockResolvedValue({
    key: "contracts/test.pdf",
    url: "https://storage.example.com/contracts/test.pdf",
  }),
  storageGet: vi.fn().mockResolvedValue({
    key: "contracts/test.pdf",
    url: "https://storage.example.com/contracts/test.pdf?signed=true",
  }),
}));

// Mock PDF processor
vi.mock("./pdfProcessor", () => ({
  extractTextFromPdf: vi.fn().mockResolvedValue({
    pages: [{ pageNumber: 1, content: "Test content" }],
    totalPages: 1,
  }),
  extractContractMetadata: vi.fn().mockResolvedValue({
    insuranceCompany: "AOK Bayern",
    contractNumber: "12345",
    productArea: "Hilfsmittel",
    validFrom: null,
    validUntil: null,
  }),
  splitIntoChunks: vi.fn().mockReturnValue([
    { content: "Test chunk", pageNumber: 1, chunkIndex: 0 },
  ]),
}));

// Mock embeddings
vi.mock("./embeddings", () => ({
  generateEmbeddings: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3]]),
}));

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createUnauthenticatedContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("contracts.list", () => {
  it("returns list of contracts for authenticated users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.contracts.list();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(0);
  });

  it("throws for unauthenticated users", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.contracts.list()).rejects.toThrow();
  });
});

describe("contracts.upload", () => {
  it("allows admin to upload contracts", async () => {
    const ctx = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.contracts.upload({
      fileName: "test.pdf",
      fileData: "dGVzdA==", // base64 "test"
      mimeType: "application/pdf",
    });

    expect(result).toBeDefined();
    expect(result.name).toBe("Test Contract");
  });

  it("denies non-admin users from uploading", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.contracts.upload({
        fileName: "test.pdf",
        fileData: "dGVzdA==",
        mimeType: "application/pdf",
      })
    ).rejects.toThrow("Admin access required");
  });
});

describe("chats.create", () => {
  it("creates a new chat for authenticated users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.chats.create();

    expect(result).toBeDefined();
    expect(result.title).toBe("Neuer Chat");
  });

  it("throws for unauthenticated users", async () => {
    const ctx = createUnauthenticatedContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.chats.create()).rejects.toThrow();
  });
});

describe("chats.list", () => {
  it("returns chats for authenticated users", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.chats.list();

    expect(Array.isArray(result)).toBe(true);
  });
});

describe("pdf.getUrl", () => {
  it("returns PDF URL for valid contract", async () => {
    const ctx = createUserContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.pdf.getUrl({ contractId: 1 });

    expect(result).toBeDefined();
    expect(result.url).toContain("storage.example.com");
  });
});
