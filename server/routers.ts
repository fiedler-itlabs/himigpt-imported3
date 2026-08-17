import { COOKIE_NAME } from "@shared/const";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { storagePut, storageGet } from "./storage";
import { nanoid } from "nanoid";
import {
  createContract,
  getContractById,
  getAllContracts,
  updateContractStatus,
  updateContractMetadata,
  deleteContract,
  createContractChunks,
  getChunksByContractId,
  deleteChunksByContractId,
  createChat,
  getChatById,
  getChatsByUserId,
  updateChatTitle,
  deleteChat,
  createChatMessage,
  getMessagesByChatId,
  getDb,
  createCustomColumn,
  getAllCustomColumns,
  deleteCustomColumn,
  upsertContractCustomData,
  getAllContractsWithCustomData,
  createSummaryTemplate,
  getSummaryTemplateById,
  getAllSummaryTemplates,
  deleteSummaryTemplate,
  createContractSummary,
  getContractSummaryById,
  getSummariesByContractId,
  getSummaryByContractAndTemplate,
  deleteContractSummary,
  getSummariesWithTemplatesByContractId,
} from "./db";
import { chatMessages, chats } from "../drizzle/schema";
import { eq } from "drizzle-orm";
import { extractTextFromPdf, extractContractMetadata, splitIntoChunks } from "./pdfProcessor";
import { generateEmbeddings } from "./embeddings";
import { queryContracts, generateChatTitle, type ComparisonData } from "./rag";
import { generateContractSummary } from "./summaryService";
import { exportSummaryAsWord, exportSummaryAsPDF } from "./summaryExport";
import { compareContracts } from "./comparisonService";
import { exportComparisonToExcel, exportComparisonToPDF } from "./comparisonExport";
import { 
  createComparisonHistory, 
  getComparisonHistoryByUserId, 
  getComparisonHistoryById, 
  deleteComparisonHistory 
} from "./db";
import { debugSearch } from "./ragDebug";
import { generateComparisonExcel, generateComparisonPDF } from "./exportService";
import { extractAllCustomColumns } from "./customColumnExtractor";

// Admin-only procedure
const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
  if (ctx.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
  return next({ ctx });
});

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // Contract management (admin only)
  contracts: router({
    list: protectedProcedure.query(async () => {
      return await getAllContractsWithCustomData();
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const contract = await getContractById(input.id);
        if (!contract) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contract not found" });
        }
        return contract;
      }),

    upload: adminProcedure
      .input(z.object({
        fileName: z.string(),
        fileData: z.string(), // base64 encoded
        mimeType: z.string().default("application/pdf"),
        parentContractId: z.number().nullable().optional(),
        contractType: z.enum(["main", "extension", "pricelist", "productgroup", "regional"]).optional(),
        productGroups: z.string().nullable().optional(),
        displayOrder: z.number().optional(),
        insuranceCompany: z.string().nullable().optional(), // For version detection
        versionLabel: z.string().nullable().optional(), // User-provided version label
      }))
      .mutation(async ({ ctx, input }) => {
        // 1. Decode and upload to S3
        const buffer = Buffer.from(input.fileData, "base64");
        const fileKey = `contracts/${nanoid()}-${input.fileName}`;
        const { url: pdfUrl } = await storagePut(fileKey, buffer, input.mimeType);

        // 2. Extract version information from filename
        const { extractVersionFromFilename } = await import('./versionDetection');
        const { year, versionLabel: autoVersionLabel, baseName } = extractVersionFromFilename(input.fileName);
        
        // 3. Create contract record with hierarchical and versioning fields
        const contract = await createContract({
          name: input.fileName.replace(/\.pdf$/i, ""),
          pdfUrl,
          pdfKey: fileKey,
          uploadedBy: ctx.user.id,
          status: "pending",
          parentContractId: input.parentContractId ?? null,
          contractType: input.contractType ?? "main",
          productGroups: input.productGroups ?? null,
          displayOrder: input.displayOrder ?? 0,
          insuranceCompany: input.insuranceCompany ?? null,
          versionLabel: input.versionLabel ?? autoVersionLabel,
          versionNumber: 1, // Will be updated if replacing another contract
        });

        // 4. Start async processing
        processContract(contract.id, pdfUrl).catch(err => {
          console.error(`Failed to process contract ${contract.id}:`, err);
          updateContractStatus(contract.id, "error", err.message);
        });

        return contract;
      }),

    suggestParent: adminProcedure
      .input(z.object({
        fileName: z.string(),
        insuranceCompany: z.string().nullable(),
      }))
      .query(async ({ input }) => {
        const { suggestParentContract } = await import('./contractParentSuggestion');
        return await suggestParentContract(input.fileName, input.insuranceCompany);
      }),

    getHierarchy: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const { getContractHierarchy } = await import('./db');
        return await getContractHierarchy(input.id);
      }),

    getMainContracts: protectedProcedure
      .query(async () => {
        const { getMainContracts } = await import('./db');
        return await getMainContracts();
      }),

    getChildContracts: protectedProcedure
      .input(z.object({ parentId: z.number() }))
      .query(async ({ input }) => {
        const { getChildContracts } = await import('./db');
        return await getChildContracts(input.parentId);
      }),

    updateParent: adminProcedure
      .input(z.object({
        contractId: z.number(),
        newParentId: z.number().nullable(),
      }))
      .mutation(async ({ input }) => {
        const { updateContractParent } = await import('./db');
        await updateContractParent(input.contractId, input.newParentId);
        return { success: true };
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const { deleteContractWithChildren } = await import('./db');
        await deleteContractWithChildren(input.id);
        return { success: true };
      }),

    reprocess: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const contract = await getContractById(input.id);
        if (!contract) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contract not found" });
        }

        await updateContractStatus(contract.id, "pending");
        await deleteChunksByContractId(contract.id);

        processContract(contract.id, contract.pdfUrl).catch(err => {
          console.error(`Failed to reprocess contract ${contract.id}:`, err);
          updateContractStatus(contract.id, "error", err.message);
        });

        return { success: true };
      }),

    getChunks: adminProcedure
      .input(z.object({ contractId: z.number() }))
      .query(async ({ input }) => {
        return getChunksByContractId(input.contractId);
      }),

    // Versioning endpoints
    getVersions: protectedProcedure
      .input(z.object({ contractId: z.number() }))
      .query(async ({ input }) => {
        const { getContractVersions } = await import('./db');
        return await getContractVersions(input.contractId);
      }),

    archiveContract: adminProcedure
      .input(z.object({
        contractId: z.number(),
        replacedByContractId: z.number(),
      }))
      .mutation(async ({ input }) => {
        const { archiveContract } = await import('./db');
        await archiveContract(input.contractId, input.replacedByContractId);
        return { success: true };
      }),

    restoreContract: adminProcedure
      .input(z.object({ contractId: z.number() }))
      .mutation(async ({ input }) => {
        const { restoreArchivedContract } = await import('./db');
        await restoreArchivedContract(input.contractId);
        return { success: true };
      }),

    detectSimilar: adminProcedure
      .input(z.object({
        name: z.string(),
        insuranceCompany: z.string().nullable(),
      }))
      .query(async ({ input }) => {
        const { detectSimilarContracts } = await import('./db');
        return await detectSimilarContracts(input.name, input.insuranceCompany);
      }),

    suggestReplacement: adminProcedure
      .input(z.object({
        newContractName: z.string(),
        newInsuranceCompany: z.string().nullable(),
      }))
      .query(async ({ input }) => {
        const { detectSimilarContracts } = await import('./db');
        const { suggestVersionReplacement } = await import('./versionDetection');
        
        const similarContracts = await detectSimilarContracts(
          input.newContractName,
          input.newInsuranceCompany
        );
        
        return await suggestVersionReplacement(
          input.newContractName,
          input.newInsuranceCompany,
          similarContracts.map(c => ({
            id: c.id,
            name: c.name,
            insuranceCompany: c.insuranceCompany,
            versionLabel: c.versionLabel,
          }))
        );
      }),
  }),

  // Export functionality
  export: router({
    comparisonTable: protectedProcedure
      .input(
        z.object({
          data: z.array(
            z.object({
              insuranceCompany: z.string(),
              contractName: z.string(),
              price: z.string().optional(),
              conditions: z.array(z.string()).optional(),
              pageNumber: z.number(),
            })
          ),
          positionNumber: z.string().optional(),
          format: z.enum(['xlsx', 'pdf']),
        })
      )
      .mutation(async ({ input }) => {
        const { data, positionNumber, format } = input;
        
        let buffer: Buffer;
        let mimeType: string;
        let extension: string;
        
        if (format === 'xlsx') {
          buffer = await generateComparisonExcel(data as ComparisonData[], positionNumber);
          mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
          extension = 'xlsx';
        } else {
          buffer = await generateComparisonPDF(data as ComparisonData[], positionNumber);
          mimeType = 'application/pdf';
          extension = 'pdf';
        }
        
        // Upload to S3
        const fileName = `vergleich-${positionNumber || 'alle'}-${Date.now()}.${extension}`;
        const { url } = await storagePut(
          `exports/${fileName}`,
          buffer,
          mimeType
        );
        
        return { url, fileName };
      }),
  }),

  // Chat functionality
  chats: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      return getChatsByUserId(ctx.user.id);
    }),

    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        const chat = await getChatById(input.id);
        if (!chat) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Chat not found" });
        }
        if (chat.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        return chat;
      }),

    create: protectedProcedure
      .input(z.object({
        contractIds: z.array(z.number()).optional(), // null/undefined = all contracts, array = specific contracts
      }).optional())
      .mutation(async ({ ctx, input }) => {
        return createChat({
          userId: ctx.user.id,
          title: "Neuer Chat",
          scopedContractIds: input?.contractIds || null,
        });
      }),

    getDiff: adminProcedure
      .input(z.object({
        oldContractId: z.number(),
        newContractId: z.number(),
      }))
      .query(async ({ input }) => {
        const { extractContractDiff } = await import('./contractDiff');
        return await extractContractDiff(input.oldContractId, input.newContractId);
      }),

    getChunks: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const chat = await getChatById(input.id);
        if (!chat) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Chat not found" });
        }
        if (chat.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        await deleteChat(input.id);
        return { success: true };
      }),

    updateTitle: protectedProcedure
      .input(z.object({ id: z.number(), title: z.string() }))
      .mutation(async ({ ctx, input }) => {
        const chat = await getChatById(input.id);
        if (!chat) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Chat not found" });
        }
        if (chat.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        await updateChatTitle(input.id, input.title);
        return { success: true };
      }),

    updateScope: protectedProcedure
      .input(z.object({ 
        id: z.number(), 
        contractIds: z.array(z.number()).nullable() // null = all contracts, array = specific contracts
      }))
      .mutation(async ({ ctx, input }) => {
        const chat = await getChatById(input.id);
        if (!chat) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Chat not found" });
        }
        if (chat.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        // Check if chat has messages - scope can only be changed before first message
        const messages = await getMessagesByChatId(input.id);
        if (messages.length > 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot change scope after messages have been sent" });
        }
        // Update scope
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database connection failed" });
        await db.update(chats).set({ scopedContractIds: input.contractIds }).where(eq(chats.id, input.id));
        return { success: true };
      }),

    getMessages: protectedProcedure
      .input(z.object({ chatId: z.number() }))
      .query(async ({ ctx, input }) => {
        const chat = await getChatById(input.chatId);
        if (!chat) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Chat not found" });
        }
        if (chat.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        return getMessagesByChatId(input.chatId);
      }),

    sendMessage: protectedProcedure
      .input(z.object({
        chatId: z.number(),
        content: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        const chat = await getChatById(input.chatId);
        if (!chat) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Chat not found" });
        }
        if (chat.userId !== ctx.user.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }

        // Save user message
        const userMessage = await createChatMessage({
          chatId: input.chatId,
          role: "user",
          content: input.content,
        });

        // Get conversation history
        const messages = await getMessagesByChatId(input.chatId);
        const history = messages
          .filter(m => m.role !== "system")
          .slice(-10) // Last 10 messages for context
          .map(m => ({
            role: m.role as "user" | "assistant",
            content: m.content,
          }));

        // Generate response with RAG (pass scoped contract IDs if set)
        const { answer, sources } = await queryContracts(
          input.content,
          history.slice(0, -1),
          chat.scopedContractIds || undefined
        );

        // Save assistant message
        const assistantMessage = await createChatMessage({
          chatId: input.chatId,
          role: "assistant",
          content: answer,
          sources: sources.map(s => ({
            contractId: s.contractId,
            contractName: s.contractName,
            pageNumber: s.pageNumber,
            excerpt: s.excerpt,
          })),
        });

        // Update chat title if this is the first message
        if (messages.length <= 1) {
          const title = await generateChatTitle(input.content);
          await updateChatTitle(input.chatId, title);
        }

        return {
          userMessage,
          assistantMessage,
        };
      }),

    submitFeedback: protectedProcedure
      .input(z.object({
        messageId: z.number(),
        feedback: z.enum(["positive", "negative"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
        
        await db.update(chatMessages)
          .set({ feedback: input.feedback })
          .where(eq(chatMessages.id, input.messageId));
        
        return { success: true };
      }),

    debugSearch: protectedProcedure
      .input(z.object({
        query: z.string(),
        contractIds: z.array(z.number()),
      }))
      .query(async ({ input }) => {
        return await debugSearch(input.query, input.contractIds);
      }),
  }),

  // PDF viewer
  pdf: router({
    getUrl: protectedProcedure
      .input(z.object({ contractId: z.number() }))
      .query(async ({ input }) => {
        const contract = await getContractById(input.contractId);
        if (!contract) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contract not found" });
        }
        // Return proxy URL instead of direct S3 URL to avoid CORS issues
        return { 
          url: `/api/pdf/proxy/${contract.id}`,
          totalPages: contract.totalPages 
        };
      }),
  }),

  // Dashboard stats
  stats: router({
    dashboard: protectedProcedure.query(async ({ ctx }) => {
      const contracts = await getAllContracts();
      const chats = await getChatsByUserId(ctx.user.id);
      
      const totalContracts = contracts.length;
      const readyContracts = contracts.filter(c => c.status === 'ready').length;
      const totalPages = contracts.reduce((sum, c) => sum + (c.totalPages || 0), 0);
      const totalChats = chats.length;
      
      // Get total messages count
      const db = await getDb();
      if (!db) {
        throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR', message: 'Database not available' });
      }
      const allMessages = await db.select().from(chatMessages);
      const totalMessages = allMessages.length;
      
      // Get recent activity (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const recentChats = chats.filter(c => c.createdAt >= sevenDaysAgo).length;
      
      return {
        totalContracts,
        readyContracts,
        totalPages,
        totalChats,
        totalMessages,
        recentChats,
      };
    }),
  }),

  // Summary templates and summaries
  summaries: router({
    // Get all templates
    templates: protectedProcedure.query(async () => {
      return await getAllSummaryTemplates();
    }),

    // Create custom template
    createTemplate: adminProcedure
      .input(
        z.object({
          title: z.string().min(1).max(256),
          prompt: z.string().min(1),
        })
      )
      .mutation(async ({ input, ctx }) => {
        return await createSummaryTemplate({
          type: "custom",
          title: input.title,
          prompt: input.prompt,
          displayOrder: 999,
          createdBy: ctx.user.id,
        });
      }),

    // Delete template
    deleteTemplate: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteSummaryTemplate(input.id);
        return { success: true };
      }),

    // Generate summary for a contract
    generate: adminProcedure
      .input(
        z.object({
          contractId: z.number(),
          templateId: z.number(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const contract = await getContractById(input.contractId);
        if (!contract) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Contract not found" });
        }

        const template = await getSummaryTemplateById(input.templateId);
        if (!template) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Template not found" });
        }

        // Check if summary already exists
        const existing = await getSummaryByContractAndTemplate(input.contractId, input.templateId);
        if (existing) {
          return existing;
        }

        // Generate summary
        const content = await generateContractSummary(contract.pdfUrl, template.prompt);

        // Save to database
        return await createContractSummary({
          contractId: input.contractId,
          templateId: input.templateId,
          content,
          generatedBy: ctx.user.id,
        });
      }),

    // Get summaries for a contract
    byContract: protectedProcedure
      .input(z.object({ contractId: z.number() }))
      .query(async ({ input }) => {
        return await getSummariesByContractId(input.contractId);
      }),

    // Get summaries with template info for a contract
    byContractWithTemplates: protectedProcedure
      .input(z.object({ contractId: z.number() }))
      .query(async ({ input }) => {
        return await getSummariesWithTemplatesByContractId(input.contractId);
      }),

    // Get specific summary
    get: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        const summary = await getContractSummaryById(input.id);
        if (!summary) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Summary not found" });
        }
        return summary;
      }),

    // Delete summary
    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteContractSummary(input.id);
        return { success: true };
      }),

    // Export summary as Word
    exportWord: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const buffer = await exportSummaryAsWord(input.id);
        const base64 = buffer.toString('base64');
        return { data: base64, filename: `summary-${input.id}.docx` };
      }),

    // Export summary as PDF
    exportPdf: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        const buffer = await exportSummaryAsPDF(input.id);
        const base64 = buffer.toString('base64');
        return { data: base64, filename: `summary-${input.id}.pdf` };
      }),
  }),

  comparison: router({
    // Compare multiple contracts
    compare: protectedProcedure
      .input(
        z.object({
          contractIds: z.array(z.number()).min(2),
          query: z.string().min(1),
        })
      )
      .mutation(async ({ input }) => {
        // Get contracts
        const contracts = await Promise.all(
          input.contractIds.map(async (id) => {
            const contract = await getContractById(id);
            if (!contract) {
              throw new TRPCError({
                code: "NOT_FOUND",
                message: `Contract ${id} not found`,
              });
            }
            return {
              id: contract.id,
              name: contract.name,
              pdfUrl: contract.pdfUrl,
            };
          })
        );

        // Generate comparison
        const result = await compareContracts(contracts, input.query);
        return result;
      }),

    // Export comparison as Excel
    exportExcel: protectedProcedure
      .input(
        z.object({
          query: z.string(),
          contractIds: z.array(z.number()),
          result: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const contracts = await Promise.all(
          input.contractIds.map(async (id) => {
            const contract = await getContractById(id);
            if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: `Contract ${id} not found` });
            return { id: contract.id, name: contract.name };
          })
        );

        const { url } = await exportComparisonToExcel({
          query: input.query,
          contracts,
          result: input.result,
        });

        return { url };
      }),

    // Export comparison as PDF
    exportPdf: protectedProcedure
      .input(
        z.object({
          query: z.string(),
          contractIds: z.array(z.number()),
          result: z.string(),
        })
      )
      .mutation(async ({ input }) => {
        const contracts = await Promise.all(
          input.contractIds.map(async (id) => {
            const contract = await getContractById(id);
            if (!contract) throw new TRPCError({ code: "NOT_FOUND", message: `Contract ${id} not found` });
            return { id: contract.id, name: contract.name };
          })
        );

        const { url } = await exportComparisonToPDF({
          query: input.query,
          contracts,
          result: input.result,
        });

        return { url };
      }),

    // Save comparison to history
    save: protectedProcedure
      .input(
        z.object({
          name: z.string().min(1),
          query: z.string(),
          contractIds: z.array(z.number()),
          result: z.string(),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const history = await createComparisonHistory({
          userId: ctx.user.id,
          name: input.name,
          query: input.query,
          contractIds: input.contractIds as any,
          result: input.result,
        });

        return history;
      }),

    // Get comparison history for current user
    getHistory: protectedProcedure.query(async ({ ctx }) => {
      const history = await getComparisonHistoryByUserId(ctx.user.id);
      return history;
    }),

    // Get specific comparison from history
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input, ctx }) => {
        const history = await getComparisonHistoryById(input.id);
        if (!history || history.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Comparison not found" });
        }
        return history;
      }),

    // Delete comparison from history
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input, ctx }) => {
        const history = await getComparisonHistoryById(input.id);
        if (!history || history.userId !== ctx.user.id) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Comparison not found" });
        }
        await deleteComparisonHistory(input.id);
        return { success: true };
      }),
  }),

  customColumns: router({    list: protectedProcedure.query(async () => {
      return await getAllCustomColumns();
    }),

    create: adminProcedure
      .input(
        z.object({
          name: z.string().min(1).max(128),
          description: z.string().min(1),
          dataType: z.enum(["text", "number", "date"]),
        })
      )
      .mutation(async ({ input, ctx }) => {
        const column = await createCustomColumn({
          ...input,
          displayOrder: 0,
          createdBy: ctx.user.id,
        });

        // Extract values for all existing contracts
        const contracts = await getAllContracts();
        for (const contract of contracts) {
          if (contract.status === "ready") {
            try {
              const extracted = await extractTextFromPdf(contract.pdfUrl);
              const fullText = extracted.pages.map(p => p.content).join('\n');
              const values = await extractAllCustomColumns(fullText, [column]);
              
              if (values[column.id]) {
                await upsertContractCustomData({
                  contractId: contract.id,
                  columnId: column.id,
                  value: values[column.id],
                });
              }
            } catch (error) {
              console.error(`[CustomColumn] Failed to extract for contract ${contract.id}:`, error);
            }
          }
        }

        return column;
      }),

    delete: adminProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await deleteCustomColumn(input.id);
        return { success: true };
      }),
  }),
});

export type AppRouter = typeof appRouter;

// Async contract processing function
async function processContract(contractId: number, pdfUrl: string): Promise<void> {
  try {
    await updateContractStatus(contractId, "processing");

    // 1. Extract metadata
    console.log(`[Contract ${contractId}] Extracting metadata...`);
    const metadata = await extractContractMetadata(pdfUrl);
    // Parse and validate dates
    let validFrom: Date | undefined;
    let validUntil: Date | undefined;
    
    try {
      if (metadata.validFrom && metadata.validFrom !== 'unbekannt' && metadata.validFrom !== 'nicht angegeben') {
        const parsed = new Date(metadata.validFrom);
        if (!isNaN(parsed.getTime())) {
          validFrom = parsed;
        }
      }
    } catch (e) {
      console.warn(`[Contract ${contractId}] Invalid validFrom date:`, metadata.validFrom);
    }
    
    try {
      if (metadata.validUntil && metadata.validUntil !== 'unbekannt' && metadata.validUntil !== 'nicht angegeben' && metadata.validUntil !== 'unbefristet') {
        const parsed = new Date(metadata.validUntil);
        if (!isNaN(parsed.getTime())) {
          validUntil = parsed;
        }
      }
    } catch (e) {
      console.warn(`[Contract ${contractId}] Invalid validUntil date:`, metadata.validUntil);
    }
    
    // Filter out "unbekannt" values for contact fields
    const contactPerson = metadata.contactPerson && metadata.contactPerson !== 'unbekannt' ? metadata.contactPerson : undefined;
    const contactEmail = metadata.contactEmail && metadata.contactEmail !== 'unbekannt' ? metadata.contactEmail : undefined;
    const contactPhone = metadata.contactPhone && metadata.contactPhone !== 'unbekannt' ? metadata.contactPhone : undefined;
    
    await updateContractMetadata(contractId, {
      insuranceCompany: metadata.insuranceCompany ?? undefined,
      contractNumber: metadata.contractNumber ?? undefined,
      productArea: metadata.productArea ?? undefined,
      validFrom,
      validUntil,
      contactPerson,
      contactEmail,
      contactPhone,
    });

    // 2. Extract text from PDF
    console.log(`[Contract ${contractId}] Extracting text...`);
    const { pages, totalPages } = await extractTextFromPdf(pdfUrl);
    await updateContractMetadata(contractId, { totalPages });

    // 3. Split into chunks
    console.log(`[Contract ${contractId}] Splitting into chunks...`);
    const chunks = splitIntoChunks(pages);
    console.log(`[Contract ${contractId}] Created ${chunks.length} chunks`);

    // 4. Generate embeddings
    console.log(`[Contract ${contractId}] Generating embeddings...`);
    const texts = chunks.map(c => c.content);
    const embeddings = await generateEmbeddings(texts);

    // 5. Save chunks with embeddings
    console.log(`[Contract ${contractId}] Saving chunks...`);
    await createContractChunks(
      chunks.map((chunk, idx) => ({
        contractId,
        content: chunk.content,
        pageNumber: chunk.pageNumber,
        chunkIndex: chunk.chunkIndex,
        embedding: embeddings[idx],
      }))
    );

    // 6. Mark as ready
    await updateContractStatus(contractId, "ready");
    console.log(`[Contract ${contractId}] Processing complete!`);
  } catch (error) {
    console.error(`[Contract ${contractId}] Processing failed:`, error);
    throw error;
  }
}
