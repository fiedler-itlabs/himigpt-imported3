import { eq, desc, and, sql, like, inArray, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, users, 
  contracts, InsertContract, Contract,
  contractChunks, InsertContractChunk, ContractChunk,
  chats, InsertChat, Chat,
  chatMessages, InsertChatMessage, ChatMessage,
  customColumns, InsertCustomColumn, CustomColumn,
  contractCustomData, InsertContractCustomData, ContractCustomData,
  summaryTemplates, InsertSummaryTemplate, SummaryTemplate,
  contractSummaries, InsertContractSummary, ContractSummary,
  comparisonHistory, InsertComparisonHistory, ComparisonHistory
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ============ USER FUNCTIONS ============

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }

  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ============ CONTRACT FUNCTIONS ============

export async function createContract(contract: InsertContract): Promise<Contract> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(contracts).values(contract).$returningId();
  const [created] = await db.select().from(contracts).where(eq(contracts.id, result.id));
  return created;
}

export async function getContractById(id: number): Promise<Contract | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const [result] = await db.select().from(contracts).where(eq(contracts.id, id));
  return result;
}

export async function getAllContracts(): Promise<Contract[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select().from(contracts).orderBy(desc(contracts.createdAt));
}

export async function updateContractStatus(
  id: number, 
  status: Contract["status"], 
  errorMessage?: string
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(contracts)
    .set({ status, errorMessage: errorMessage ?? null })
    .where(eq(contracts.id, id));
}

export async function updateContractMetadata(
  id: number,
  metadata: {
    insuranceCompany?: string;
    contractNumber?: string;
    productArea?: string;
    validFrom?: Date;
    validUntil?: Date;
    contactPerson?: string;
    contactEmail?: string;
    contactPhone?: string;
    notes?: string;
    totalPages?: number;
  }
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(contracts).set(metadata).where(eq(contracts.id, id));
}

export async function deleteContract(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete chunks first
  await db.delete(contractChunks).where(eq(contractChunks.contractId, id));
  // Then delete contract
  await db.delete(contracts).where(eq(contracts.id, id));
}

/**
 * Delete contract and all its children (cascading delete)
 */
export async function deleteContractWithChildren(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get all child contracts
  const children = await db.select().from(contracts).where(eq(contracts.parentContractId, id));
  
  // Delete all children first
  for (const child of children) {
    await deleteContract(child.id);
  }
  
  // Then delete the parent
  await deleteContract(id);
}

/**
 * Get contract hierarchy (parent + all children)
 */
export async function getContractHierarchy(contractId: number): Promise<{ parent: Contract | null; children: Contract[] }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const contract = await getContractById(contractId);
  if (!contract) {
    return { parent: null, children: [] };
  }

  // If this is a child, get its parent and siblings
  let parent: Contract | null = null;
  let children: Contract[] = [];
  
  if (contract.parentContractId) {
    // This is a child contract - get parent and all siblings
    parent = await getContractById(contract.parentContractId) || null;
    if (parent) {
      children = await db.select()
        .from(contracts)
        .where(eq(contracts.parentContractId, parent.id))
        .orderBy(contracts.displayOrder, contracts.createdAt);
    }
  } else {
    // This is a parent contract - return itself as parent and its children
    parent = contract;
    children = await db.select()
      .from(contracts)
      .where(eq(contracts.parentContractId, contractId))
      .orderBy(contracts.displayOrder, contracts.createdAt);
  }

  return { parent, children };
}

/**
 * Get all main contracts (parentContractId = NULL)
 */
export async function getMainContracts(): Promise<Contract[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(contracts)
    .where(isNull(contracts.parentContractId))
    .orderBy(contracts.insuranceCompany, contracts.name);
}

/**
 * Get all child contracts of a parent
 */
export async function getChildContracts(parentId: number): Promise<Contract[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select()
    .from(contracts)
    .where(eq(contracts.parentContractId, parentId))
    .orderBy(contracts.displayOrder, contracts.createdAt);
}

/**
 * Update contract parent (for reassigning contracts)
 * Validates that target parent is a main contract (no 3+ levels)
 */
export async function updateContractParent(contractId: number, newParentId: number | null): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // If setting a parent, validate it's a main contract
  if (newParentId !== null) {
    const targetParent = await getContractById(newParentId);
    if (!targetParent) {
      throw new Error("Target parent contract not found");
    }
    if (targetParent.parentContractId !== null) {
      throw new Error("Cannot create 3+ level hierarchy. Target parent must be a main contract.");
    }
  }

  // Update the contract
  await db.update(contracts)
    .set({ parentContractId: newParentId })
    .where(eq(contracts.id, contractId));
}

/**
 * Get all contracts in a family (parent + all siblings + self)
 * Useful for displaying related contracts
 */
export async function getContractFamily(contractId: number): Promise<Contract[]> {
  const db = await getDb();
  if (!db) return [];

  const contract = await getContractById(contractId);
  if (!contract) return [];

  // If this is a main contract, return itself + all children
  if (contract.parentContractId === null) {
    const children = await getChildContracts(contractId);
    return [contract, ...children];
  }

  // If this is a child, get parent + all siblings
  const parent = await getContractById(contract.parentContractId);
  const siblings = await getChildContracts(contract.parentContractId);
  
  return parent ? [parent, ...siblings] : siblings;
}

/**
 * Filter contracts by metadata using fuzzy matching
 * Returns contract IDs that match the filter criteria
 */
export async function filterContractsByMetadata(
  insuranceCompanyKeyword?: string
): Promise<number[]> {
  const db = await getDb();
  if (!db) return [];

  // Build where conditions
  const conditions = [
    eq(contracts.status, "ready"),
    eq(contracts.isArchived, false) // Exclude archived contracts from RAG search
  ];
  
  // Apply insurance company filter with fuzzy matching (LIKE %keyword%)
  if (insuranceCompanyKeyword) {
    conditions.push(
      like(contracts.insuranceCompany, `%${insuranceCompanyKeyword}%`)
    );
  }

  const results = await db.select({ id: contracts.id })
    .from(contracts)
    .where(and(...conditions));
    
  return results.map(r => r.id);
}

// ============ CONTRACT VERSIONING FUNCTIONS ============

/**
 * Archive a contract (mark as old version)
 */
export async function archiveContract(id: number, replacedByContractId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(contracts)
    .set({
      isArchived: true,
      archivedAt: new Date(),
      replacedByContractId,
    })
    .where(eq(contracts.id, id));
}

/**
 * Get all versions of a contract (including archived)
 * Returns contracts with same name and insurance company, ordered by version number
 */
export async function getContractVersions(contractId: number): Promise<Contract[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Get the reference contract
  const refContract = await getContractById(contractId);
  if (!refContract) return [];

  // Find all contracts with similar name and same insurance company
  const versions = await db.select()
    .from(contracts)
    .where(
      and(
        eq(contracts.insuranceCompany, refContract.insuranceCompany || ""),
        like(contracts.name, `%${refContract.name.split(/\d{4}/)[0].trim()}%`) // Match base name without year
      )
    )
    .orderBy(desc(contracts.versionNumber));

  return versions;
}

/**
 * Restore an archived contract (make it active again)
 * Archives the currently active version
 */
export async function restoreArchivedContract(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const contract = await getContractById(id);
  if (!contract || !contract.isArchived) {
    throw new Error("Contract not found or not archived");
  }

  // Find the contract that replaced this one
  if (contract.replacedByContractId) {
    await db.update(contracts)
      .set({
        isArchived: true,
        archivedAt: new Date(),
        replacedByContractId: id,
      })
      .where(eq(contracts.id, contract.replacedByContractId));
  }

  // Restore this contract
  await db.update(contracts)
    .set({
      isArchived: false,
      archivedAt: null,
      replacedByContractId: null,
    })
    .where(eq(contracts.id, id));
}

/**
 * Detect similar contracts for auto-archiving suggestion
 * Returns contracts with similar name and same insurance company
 */
export async function detectSimilarContracts(
  name: string,
  insuranceCompany: string | null
): Promise<Contract[]> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (!insuranceCompany) return [];

  // Extract base name without year (e.g., "Preisliste 2024" -> "Preisliste")
  const baseName = name.split(/\d{4}/)[0].trim();

  const similar = await db.select()
    .from(contracts)
    .where(
      and(
        eq(contracts.insuranceCompany, insuranceCompany),
        like(contracts.name, `%${baseName}%`),
        eq(contracts.isArchived, false) // Only active contracts
      )
    );

  return similar;
}

// ============ CONTRACT CHUNKS FUNCTIONS ============

export async function createContractChunks(chunks: InsertContractChunk[]): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  if (chunks.length === 0) return;
  
  // Insert in batches of 100
  const batchSize = 100;
  for (let i = 0; i < chunks.length; i += batchSize) {
    const batch = chunks.slice(i, i + batchSize);
    await db.insert(contractChunks).values(batch);
  }
}

export async function getChunksByContractId(contractId: number): Promise<ContractChunk[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(contractChunks)
    .where(eq(contractChunks.contractId, contractId))
    .orderBy(contractChunks.pageNumber, contractChunks.chunkIndex);
}

export async function deleteChunksByContractId(contractId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(contractChunks).where(eq(contractChunks.contractId, contractId));
}

// ============ CHAT FUNCTIONS ============

export async function createChat(chat: InsertChat): Promise<Chat> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(chats).values(chat).$returningId();
  const [created] = await db.select().from(chats).where(eq(chats.id, result.id));
  return created;
}

export async function getChatById(id: number): Promise<Chat | undefined> {
  const db = await getDb();
  if (!db) return undefined;

  const [result] = await db.select().from(chats).where(eq(chats.id, id));
  return result;
}

export async function getChatsByUserId(userId: number): Promise<Chat[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(chats)
    .where(eq(chats.userId, userId))
    .orderBy(desc(chats.updatedAt));
}

export async function updateChatTitle(id: number, title: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.update(chats).set({ title }).where(eq(chats.id, id));
}

export async function deleteChat(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Delete messages first
  await db.delete(chatMessages).where(eq(chatMessages.chatId, id));
  // Then delete chat
  await db.delete(chats).where(eq(chats.id, id));
}

// ============ CHAT MESSAGE FUNCTIONS ============

export async function createChatMessage(message: InsertChatMessage): Promise<ChatMessage> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(chatMessages).values(message).$returningId();
  const [created] = await db.select().from(chatMessages).where(eq(chatMessages.id, result.id));
  
  // Update chat's updatedAt
  await db.update(chats).set({ updatedAt: new Date() }).where(eq(chats.id, message.chatId));
  
  return created;
}

export async function getMessagesByChatId(chatId: number): Promise<ChatMessage[]> {
  const db = await getDb();
  if (!db) return [];

  return db.select()
    .from(chatMessages)
    .where(eq(chatMessages.chatId, chatId))
    .orderBy(chatMessages.createdAt);
}

// ============ VECTOR SEARCH FUNCTIONS ============

/**
 * Simple cosine similarity search using stored embeddings
 * Note: For production, consider using a dedicated vector database
 * @param contractIds Optional array of contract IDs to filter by
 */
export async function searchSimilarChunks(
  queryEmbedding: number[],
  limit: number = 10,
  contractIds?: number[]
): Promise<(ContractChunk & { contract: Contract; similarity: number })[]> {
  const db = await getDb();
  if (!db) return [];

  // Build where conditions
  const conditions = [eq(contracts.status, "ready")];
  
  // Filter by contract IDs if provided
  if (contractIds && contractIds.length > 0) {
    conditions.push(inArray(contracts.id, contractIds));
  }

  // Get all chunks with embeddings
  const allChunks = await db
    .select({
      chunk: contractChunks,
      contract: contracts,
    })
    .from(contractChunks)
    .innerJoin(contracts, eq(contractChunks.contractId, contracts.id))
    .where(and(...conditions));

  // Calculate cosine similarity for each chunk
  const chunksWithSimilarity = allChunks
    .filter(row => row.chunk.embedding && row.chunk.embedding.length > 0)
    .map(row => {
      const embedding = row.chunk.embedding as number[];
      const similarity = cosineSimilarity(queryEmbedding, embedding);
      return {
        ...row.chunk,
        contract: row.contract,
        similarity,
      };
    })
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, limit);

  return chunksWithSimilarity;
}

/**
 * Search chunks by keyword (for exact matches like position numbers)
 * @param contractIds Optional array of contract IDs to filter by
 */
export async function searchByKeyword(
  keyword: string,
  limit: number = 10,
  contractIds?: number[]
): Promise<(ContractChunk & { contract: Contract; similarity: number })[]> {
  const db = await getDb();
  if (!db) return [];

  // Build where conditions
  const conditions = [like(contractChunks.content, `%${keyword}%`)];
  
  // Filter by contract IDs if provided
  if (contractIds && contractIds.length > 0) {
    conditions.push(inArray(contracts.id, contractIds));
  }
  
  // Search for chunks containing the keyword
  const results = await db
    .select({
      chunk: contractChunks,
      contract: contracts,
    })
    .from(contractChunks)
    .innerJoin(contracts, eq(contractChunks.contractId, contracts.id))
    .where(and(...conditions))
    .limit(limit);

  // Return with high similarity score (1.0) since these are exact matches
  return results.map(row => ({
    ...row.chunk,
    contract: row.contract,
    similarity: 1.0,
  }));
}

function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  return magnitude === 0 ? 0 : dotProduct / magnitude;
}

// ============ CUSTOM COLUMN FUNCTIONS ============

export async function createCustomColumn(column: InsertCustomColumn): Promise<CustomColumn> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(customColumns).values(column);
  const insertedId = Number(result[0].insertId);
  
  const inserted = await db.select().from(customColumns).where(eq(customColumns.id, insertedId)).limit(1);
  return inserted[0]!;
}

export async function getAllCustomColumns(): Promise<CustomColumn[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(customColumns).orderBy(customColumns.displayOrder);
}

export async function deleteCustomColumn(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Delete associated data first
  await db.delete(contractCustomData).where(eq(contractCustomData.columnId, id));
  // Then delete the column
  await db.delete(customColumns).where(eq(customColumns.id, id));
}

export async function upsertContractCustomData(data: InsertContractCustomData): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.insert(contractCustomData).values(data).onDuplicateKeyUpdate({
    set: {
      value: data.value,
      extractedAt: new Date(),
    },
  });
}

export async function getCustomDataForContract(contractId: number): Promise<Record<number, string | null>> {
  const db = await getDb();
  if (!db) return {};

  const data = await db
    .select()
    .from(contractCustomData)
    .where(eq(contractCustomData.contractId, contractId));

  const result: Record<number, string | null> = {};
  for (const item of data) {
    result[item.columnId] = item.value;
  }
  return result;
}

export async function getAllContractsWithCustomData(): Promise<(Contract & { customData: Record<number, string | null> })[]> {
  const db = await getDb();
  if (!db) return [];

  const allContracts = await getAllContracts();
  
  const result = await Promise.all(
    allContracts.map(async (contract) => ({
      ...contract,
      customData: await getCustomDataForContract(contract.id),
    }))
  );

  return result;
}


// ============ SUMMARY TEMPLATE FUNCTIONS ============

export async function createSummaryTemplate(template: InsertSummaryTemplate): Promise<SummaryTemplate> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(summaryTemplates).values(template);
  const created = await getSummaryTemplateById(Number(result.insertId));
  if (!created) throw new Error("Failed to create summary template");
  return created;
}

export async function getSummaryTemplateById(id: number): Promise<SummaryTemplate | null> {
  const db = await getDb();
  if (!db) return null;

  const [template] = await db.select().from(summaryTemplates).where(eq(summaryTemplates.id, id));
  return template || null;
}

export async function getAllSummaryTemplates(): Promise<SummaryTemplate[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(summaryTemplates).orderBy(summaryTemplates.displayOrder);
}

export async function deleteSummaryTemplate(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(summaryTemplates).where(eq(summaryTemplates.id, id));
}

// ============ CONTRACT SUMMARY FUNCTIONS ============

export async function createContractSummary(summary: InsertContractSummary): Promise<ContractSummary> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(contractSummaries).values(summary);
  const created = await getContractSummaryById(Number(result.insertId));
  if (!created) throw new Error("Failed to create contract summary");
  return created;
}

export async function getContractSummaryById(id: number): Promise<ContractSummary | null> {
  const db = await getDb();
  if (!db) return null;

  const [summary] = await db.select().from(contractSummaries).where(eq(contractSummaries.id, id));
  return summary || null;
}

export async function getSummariesByContractId(contractId: number): Promise<ContractSummary[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(contractSummaries).where(eq(contractSummaries.contractId, contractId));
}

export async function getSummaryByContractAndTemplate(contractId: number, templateId: number): Promise<ContractSummary | null> {
  const db = await getDb();
  if (!db) return null;

  const [summary] = await db.select().from(contractSummaries).where(
    and(
      eq(contractSummaries.contractId, contractId),
      eq(contractSummaries.templateId, templateId)
    )
  );
  return summary || null;
}

export async function deleteContractSummary(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(contractSummaries).where(eq(contractSummaries.id, id));
}

export async function deleteSummariesByContractId(contractId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;

  await db.delete(contractSummaries).where(eq(contractSummaries.contractId, contractId));
}


export async function getSummariesWithTemplatesByContractId(contractId: number): Promise<Array<ContractSummary & { template: SummaryTemplate }>> {
  const db = await getDb();
  if (!db) return [];

  const summaries = await db
    .select({
      summary: contractSummaries,
      template: summaryTemplates,
    })
    .from(contractSummaries)
    .leftJoin(summaryTemplates, eq(contractSummaries.templateId, summaryTemplates.id))
    .where(eq(contractSummaries.contractId, contractId));

  return summaries
    .filter(row => row.template !== null)
    .map(row => ({
      ...row.summary,
      template: row.template!,
    }));
}

// ============ COMPARISON HISTORY FUNCTIONS ============

export async function createComparisonHistory(data: InsertComparisonHistory): Promise<ComparisonHistory> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [result] = await db.insert(comparisonHistory).values(data);
  const [created] = await db.select().from(comparisonHistory).where(eq(comparisonHistory.id, result.insertId));
  return created;
}

export async function getComparisonHistoryByUserId(userId: number): Promise<ComparisonHistory[]> {
  const db = await getDb();
  if (!db) return [];

  return await db.select().from(comparisonHistory)
    .where(eq(comparisonHistory.userId, userId))
    .orderBy(desc(comparisonHistory.createdAt));
}

export async function getComparisonHistoryById(id: number): Promise<ComparisonHistory | null> {
  const db = await getDb();
  if (!db) return null;

  const [history] = await db.select().from(comparisonHistory).where(eq(comparisonHistory.id, id));
  return history || null;
}

export async function deleteComparisonHistory(id: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db.delete(comparisonHistory).where(eq(comparisonHistory.id, id));
}
