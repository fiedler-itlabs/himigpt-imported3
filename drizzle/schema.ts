import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, bigint, boolean } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * Contracts table - stores uploaded PDF contracts with metadata
 */
export const contracts = mysqlTable("contracts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 512 }).notNull(),
  insuranceCompany: varchar("insuranceCompany", { length: 256 }),
  contractNumber: varchar("contractNumber", { length: 128 }),
  productArea: varchar("productArea", { length: 512 }),
  validFrom: timestamp("validFrom"),
  validUntil: timestamp("validUntil"),
  contactPerson: varchar("contactPerson", { length: 256 }),
  contactEmail: varchar("contactEmail", { length: 320 }),
  contactPhone: varchar("contactPhone", { length: 64 }),
  notes: text("notes"),
  
  // Hierarchical structure fields
  parentContractId: int("parentContractId"), // NULL = main contract, otherwise references parent
  contractType: mysqlEnum("contractType", ["main", "extension", "pricelist", "productgroup", "regional"]).default("main").notNull(),
  displayOrder: int("displayOrder").default(0).notNull(), // Sort order within hierarchy
  productGroups: varchar("productGroups", { length: 128 }), // e.g., "4" or "7,8" for product group contracts
  
  // Versioning fields
  isArchived: boolean("isArchived").default(false).notNull(), // true if this is an old version
  archivedAt: timestamp("archivedAt"), // when this version was archived
  replacedByContractId: int("replacedByContractId"), // ID of the contract that replaced this one
  versionNumber: int("versionNumber").default(1).notNull(), // 1, 2, 3, ...
  versionLabel: varchar("versionLabel", { length: 64 }), // "2024", "2025", "Q1 2024", "v2"
  
  pdfUrl: text("pdfUrl").notNull(),
  pdfKey: varchar("pdfKey", { length: 512 }).notNull(),
  totalPages: int("totalPages").default(0),
  status: mysqlEnum("status", ["pending", "processing", "ready", "error"]).default("pending").notNull(),
  errorMessage: text("errorMessage"),
  uploadedBy: int("uploadedBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Contract = typeof contracts.$inferSelect;
export type InsertContract = typeof contracts.$inferInsert;

/**
 * Contract chunks - stores text chunks with page numbers for RAG
 */
export const contractChunks = mysqlTable("contractChunks", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  content: text("content").notNull(),
  pageNumber: int("pageNumber").notNull(),
  chunkIndex: int("chunkIndex").notNull(),
  metadata: json("metadata").$type<{
    section?: string;
    heading?: string;
    tableData?: boolean;
  }>(),
  embedding: json("embedding").$type<number[]>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ContractChunk = typeof contractChunks.$inferSelect;
export type InsertContractChunk = typeof contractChunks.$inferInsert;

/**
 * Chats table - stores chat sessions
 */
export const chats = mysqlTable("chats", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  title: varchar("title", { length: 256 }).default("Neuer Chat").notNull(),
  scopedContractIds: json("scopedContractIds").$type<number[] | null>(), // null = all contracts, array = specific contracts
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Chat = typeof chats.$inferSelect;
export type InsertChat = typeof chats.$inferInsert;

/**
 * Chat messages table - stores individual messages in a chat
 */
export const chatMessages = mysqlTable("chatMessages", {
  id: int("id").autoincrement().primaryKey(),
  chatId: int("chatId").notNull(),
  role: mysqlEnum("role", ["user", "assistant", "system"]).notNull(),
  content: text("content").notNull(),
  sources: json("sources").$type<{
    contractId: number;
    contractName: string;
    pageNumber: number;
    excerpt: string;
  }[]>(),
  feedback: mysqlEnum("feedback", ["positive", "negative"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

/**
 * Custom columns table - stores user-defined columns for contract metadata
 */
export const customColumns = mysqlTable("customColumns", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 128 }).notNull(),
  description: text("description").notNull(), // Describes what to extract for the LLM
  dataType: mysqlEnum("dataType", ["text", "number", "date"]).default("text").notNull(),
  displayOrder: int("displayOrder").default(0).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type CustomColumn = typeof customColumns.$inferSelect;
export type InsertCustomColumn = typeof customColumns.$inferInsert;

/**
 * Contract custom data table - stores extracted values for custom columns
 */
export const contractCustomData = mysqlTable("contractCustomData", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  columnId: int("columnId").notNull(),
  value: text("value"),
  extractedAt: timestamp("extractedAt").defaultNow().notNull(),
});

export type ContractCustomData = typeof contractCustomData.$inferSelect;
export type InsertContractCustomData = typeof contractCustomData.$inferInsert;

/**
 * Summary templates table - stores predefined and custom summary templates
 */
export const summaryTemplates = mysqlTable("summaryTemplates", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["backOffice", "sales", "management", "all", "custom"]).notNull(),
  title: varchar("title", { length: 256 }).notNull(),
  prompt: text("prompt").notNull(), // Instructions for LLM on what to extract
  displayOrder: int("displayOrder").default(0).notNull(),
  createdBy: int("createdBy"), // null for predefined templates
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SummaryTemplate = typeof summaryTemplates.$inferSelect;
export type InsertSummaryTemplate = typeof summaryTemplates.$inferInsert;

/**
 * Contract summaries table - stores generated summaries for contracts
 */
export const contractSummaries = mysqlTable("contractSummaries", {
  id: int("id").autoincrement().primaryKey(),
  contractId: int("contractId").notNull(),
  templateId: int("templateId").notNull(),
  content: text("content").notNull(), // Markdown formatted summary
  generatedAt: timestamp("generatedAt").defaultNow().notNull(),
  generatedBy: int("generatedBy").notNull(),
});

export type ContractSummary = typeof contractSummaries.$inferSelect;
export type InsertContractSummary = typeof contractSummaries.$inferInsert;

/**
 * Comparison history table - stores saved contract comparisons
 */
export const comparisonHistory = mysqlTable("comparisonHistory", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 256 }).notNull(), // User-provided name for the comparison
  query: text("query").notNull(), // The comparison question
  contractIds: json("contractIds").notNull(), // Array of contract IDs that were compared
  result: text("result").notNull(), // The markdown comparison result
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ComparisonHistory = typeof comparisonHistory.$inferSelect;
export type InsertComparisonHistory = typeof comparisonHistory.$inferInsert;
