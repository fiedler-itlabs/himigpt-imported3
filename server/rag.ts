import { invokeLLM } from './_core/llm';
import { generateEmbeddings } from './embeddings';
import { searchSimilarChunks, searchByKeyword } from './db';
import type { Contract, ContractChunk } from '../drizzle/schema';

export type Source = {
  contractId: number;
  contractName: string;
  insuranceCompany: string | null;
  pageNumber: number;
  excerpt: string;
  similarity: number;
};

export type ComparisonData = {
  insuranceCompany: string;
  contractName: string;
  price?: string;
  conditions?: string[];
  pageNumber: number;
};

export type RAGResponse = {
  answer: string;
  sources: Source[];
  isComparison?: boolean;
  comparisonData?: ComparisonData[];
};

/**
 * Re-rank chunks using LLM to assess relevance to the question
 * Returns chunks sorted by relevance score (highest first)
 */
async function rerankChunks(
  question: string,
  chunks: Array<ContractChunk & { contract: Contract; similarity: number }>
): Promise<Array<ContractChunk & { contract: Contract; similarity: number }>> {
  if (chunks.length === 0) {
    return [];
  }
  
  // For small number of chunks, skip re-ranking
  if (chunks.length <= 3) {
    return chunks;
  }
  
  console.log(`[rerankChunks] Re-ranking ${chunks.length} chunks for question: ${question}`);
  
  // Prepare chunks for LLM evaluation
  const chunksForEval = chunks.map((chunk, idx) => ({
    index: idx,
    content: chunk.content.substring(0, 500), // Limit to 500 chars for efficiency
    contractName: chunk.contract.name,
    insuranceCompany: chunk.contract.insuranceCompany || 'Unbekannt',
    pageNumber: chunk.pageNumber,
  }));
  
  try {
    // Ask LLM to score each chunk's relevance
    const response = await invokeLLM({
      messages: [
        {
          role: "system",
          content: `Du bist ein Experte für Krankenkassenverträge. Bewerte die Relevanz von Vertragsauszügen für eine gegebene Frage.

Für jeden Auszug, gib einen Relevanz-Score von 0-10:
- 10: Perfekt relevant, beantwortet die Frage direkt
- 7-9: Sehr relevant, enthält wichtige Informationen
- 4-6: Mäßig relevant, enthält verwandte Informationen
- 1-3: Wenig relevant, nur tangential verwandt
- 0: Nicht relevant

Berücksichtige:
- Hilfsmittelpositionsnummern (z.B. 19.40.01.7) sind sehr wichtig
- Preise und Konditionen sind wichtig
- Allgemeine Vertragsbedingungen sind weniger wichtig
- Kontaktdaten sind nur bei entsprechenden Fragen relevant`
        },
        {
          role: "user",
          content: `Frage: "${question}"

Vertragsauszüge:
${chunksForEval.map((c, i) => `[${i}] ${c.contractName} - ${c.insuranceCompany} (Seite ${c.pageNumber}):
${c.content}`).join('\n\n')}`
        }
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "relevance_scores",
          strict: true,
          schema: {
            type: "object",
            properties: {
              scores: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    index: { type: "number" },
                    score: { type: "number" }
                  },
                  required: ["index", "score"],
                  additionalProperties: false
                }
              }
            },
            required: ["scores"],
            additionalProperties: false
          }
        }
      }
    });
    
    const content = response.choices[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      console.warn('[rerankChunks] Invalid response from LLM, returning original order');
      return chunks;
    }
    
    const result = JSON.parse(content) as { scores: Array<{ index: number; score: number }> };
    
    // Create a map of index -> score
    const scoreMap = new Map<number, number>();
    for (const item of result.scores) {
      scoreMap.set(item.index, item.score);
    }
    
    // Sort chunks by LLM score (descending)
    const reranked = chunks
      .map((chunk, idx) => ({
        chunk,
        score: scoreMap.get(idx) || 0
      }))
      .sort((a, b) => b.score - a.score)
      .map(item => item.chunk);
    
    console.log(`[rerankChunks] Re-ranking complete. Top 3 scores: ${Array.from(scoreMap.values()).sort((a, b) => b - a).slice(0, 3).join(', ')}`);
    
    return reranked;
  } catch (error) {
    console.error('[rerankChunks] Error during re-ranking:', error);
    // Fallback to original order on error
    return chunks;
  }
}

/**
 * Deduplicate chunks with very similar content
 * Removes chunks that are >80% similar to avoid redundant context
 */
function deduplicateChunks(
  chunks: Array<ContractChunk & { contract: Contract; similarity: number }>
): Array<ContractChunk & { contract: Contract; similarity: number }> {
  if (chunks.length <= 1) {
    return chunks;
  }
  
  const deduplicated: Array<ContractChunk & { contract: Contract; similarity: number }> = [];
  const SIMILARITY_THRESHOLD = 0.8; // 80% similarity
  
  for (const chunk of chunks) {
    let isDuplicate = false;
    
    for (const existing of deduplicated) {
      // Calculate simple text similarity (Jaccard similarity on words)
      const words1 = new Set(chunk.content.toLowerCase().split(/\s+/));
      const words2 = new Set(existing.content.toLowerCase().split(/\s+/));
      
      const words1Array = Array.from(words1);
      const words2Array = Array.from(words2);
      
      const intersection = new Set(words1Array.filter(x => words2.has(x)));
      const union = new Set([...words1Array, ...words2Array]);
      
      const similarity = intersection.size / union.size;
      
      if (similarity >= SIMILARITY_THRESHOLD) {
        isDuplicate = true;
        break;
      }
    }
    
    if (!isDuplicate) {
      deduplicated.push(chunk);
    }
  }
  
  return deduplicated;
}

/**
 * Validate answer quality based on question type
 */
function validateAnswer(
  question: string,
  answer: string,
  positionNumbers: string[]
): { isValid: boolean; reason?: string; suggestion?: string } {
  const questionLower = question.toLowerCase();
  const answerLower = answer.toLowerCase();
  
  // Check 1: If question asks for price, answer should contain a price
  if (questionLower.match(/preis|kosten|zahlt|bezahlt|vergütung/)) {
    const hasPricePattern = /\d+[,.]\d{2}\s*(€|eur|euro)/i.test(answer);
    if (!hasPricePattern) {
      return {
        isValid: false,
        reason: 'Price question but no price found in answer',
        suggestion: 'Die Antwort enthält möglicherweise keine Preisinformation. Bitte prüfen Sie die Quelldokumente.'
      };
    }
  }
  
  // Check 2: If question mentions position number, answer should mention it too
  if (positionNumbers.length > 0) {
    const hasPositionInAnswer = positionNumbers.some(pos => answer.includes(pos));
    if (!hasPositionInAnswer) {
      return {
        isValid: false,
        reason: 'Position number in question but not in answer',
        suggestion: 'Die Antwort bezieht sich möglicherweise nicht auf die angefragte Position.'
      };
    }
  }
  
  // Check 3: Answer should not be too short (less than 10 chars)
  if (answer.trim().length < 10) {
    return {
      isValid: false,
      reason: 'Answer too short',
      suggestion: 'Die Antwort ist sehr kurz. Bitte prüfen Sie die Quelldokumente für mehr Details.'
    };
  }
  
  // Check 4: Answer should contain source citations
  const hasSourceCitation = /\[.*?Seite\s+\d+.*?\]/.test(answer);
  if (!hasSourceCitation) {
    return {
      isValid: false,
      reason: 'No source citation found',
      suggestion: 'Die Antwort enthält keine Quellenangabe.'
    };
  }
  
  return { isValid: true };
}

/**
 * Extract structured comparison data from chunks
 */
async function extractComparisonData(
  chunks: Array<ContractChunk & { contract: Contract; similarity: number }>,
  positionNumber: string,
  requestedCompanies: string[]
): Promise<ComparisonData[]> {
  // Group chunks by insurance company
  const chunksByCompany = new Map<string, Array<ContractChunk & { contract: Contract; similarity: number }>>();
  
  for (const chunk of chunks) {
    const company = chunk.contract.insuranceCompany || 'Unbekannt';
    if (!chunksByCompany.has(company)) {
      chunksByCompany.set(company, []);
    }
    chunksByCompany.get(company)!.push(chunk);
  }
  
  // Extract data for each company using LLM
  const comparisonData: ComparisonData[] = [];
  
  const companiesArray = Array.from(chunksByCompany.entries());
  for (const [company, companyChunks] of companiesArray) {
    // Skip if company not in requested list (if specified)
    if (requestedCompanies.length > 0 && !requestedCompanies.some(req => company.toLowerCase().includes(req.toLowerCase()))) {
      continue;
    }
    
    const context = companyChunks
      .slice(0, 3) // Use top 3 chunks per company
      .map((c: ContractChunk & { contract: Contract; similarity: number }) => c.content)
      .join('\n\n');
    
    try {
      const response = await invokeLLM({
        messages: [
          {
            role: 'system',
            content: `Extrahiere Preis- und Konditionsinformationen für eine Hilfsmittelposition aus Vertragstext.`
          },
          {
            role: 'user',
            content: `Position: ${positionNumber}\n\nVertragstext:\n${context}`
          }
        ],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'comparison_data',
            strict: true,
            schema: {
              type: 'object',
              properties: {
                price: { type: 'string', description: 'Preis mit Währung, z.B. "150,00 €"' },
                conditions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Liste von Konditionen oder Bedingungen'
                }
              },
              required: ['price', 'conditions'],
              additionalProperties: false
            }
          }
        }
      });
      
      const content = response.choices[0]?.message?.content;
      if (content && typeof content === 'string') {
        const extracted = JSON.parse(content) as { price: string; conditions: string[] };
        comparisonData.push({
          insuranceCompany: company,
          contractName: companyChunks[0].contract.name,
          price: extracted.price,
          conditions: extracted.conditions,
          pageNumber: companyChunks[0].pageNumber
        });
      }
    } catch (error) {
      console.error(`[extractComparisonData] Error extracting data for ${company}:`, error);
      // Add entry with no data
      comparisonData.push({
        insuranceCompany: company,
        contractName: companyChunks[0].contract.name,
        pageNumber: companyChunks[0].pageNumber
      });
    }
  }
  
  return comparisonData;
}

/**
 * Detect if question is asking for a comparison
 */
function isComparisonQuestion(text: string): boolean {
  const comparisonKeywords = [
    'vergleich',
    'vergleiche',
    'unterschied',
    'unterschiede',
    'besser',
    'günstiger',
    'teurer',
    'versus',
    'vs',
    'gegenüber',
    'im vergleich'
  ];
  
  const textLower = text.toLowerCase();
  return comparisonKeywords.some(keyword => textLower.includes(keyword));
}

/**
 * Extract insurance company names from question
 */
function extractInsuranceCompanies(text: string): string[] {
  // Common insurance company patterns
  const patterns = [
    /\b(AOK[\s\w]*?)(?:\s|,|\.|$)/gi,
    /\b(IKK[\s\w]*?)(?:\s|,|\.|$)/gi,
    /\b(TK|Techniker Krankenkasse)\b/gi,
    /\b(Barmer)\b/gi,
    /\b(DAK[\s\w]*?)(?:\s|,|\.|$)/gi,
    /\b(KKH[\s\w]*?)(?:\s|,|\.|$)/gi,
  ];
  
  const companies = new Set<string>();
  
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      companies.add(match[1].trim());
    }
  }
  
  return Array.from(companies);
}

/**
 * Extract Hilfsmittelpositionsnummern from question
 * Patterns: XX.XX.XX.X or XX.XX.XX or XX.XX.XX.XXXX (supports 1-4 digits per segment)
 */
function extractPositionNumbers(text: string): string[] {
  const pattern = /\b\d{1,4}\.\d{1,4}\.\d{1,4}(?:\.\d{1,4})?\b/g;
  const matches = text.match(pattern);
  return matches ? Array.from(new Set(matches)) : [];
}

/**
 * Perform RAG search and generate answer with hybrid search
 */
export async function queryContracts(
  question: string,
  conversationHistory: { role: "user" | "assistant"; content: string }[] = [],
  scopedContractIds?: number[] // If provided, only search in these contracts
): Promise<RAGResponse> {
  console.log('[queryContracts] Question:', question);
  
  // 1. Extract contract filters from question (conservative approach)
  const { extractContractFilters } = await import('./contractFilters');
  const { filterContractsByMetadata } = await import('./db');
  
  const filters = await extractContractFilters(question);
  console.log('[queryContracts] Extracted filters:', filters);
  
  // 2. Determine which contracts to search
  let contractIds: number[] | undefined = undefined;
  
  // Priority 1: Use scoped contract IDs if provided (user explicitly selected contracts)
  if (scopedContractIds && scopedContractIds.length > 0) {
    contractIds = scopedContractIds;
    console.log(`[queryContracts] Using scoped contracts (${contractIds.length}):`, contractIds);
  }
  // Priority 2: Filter by metadata if high confidence (LLM extracted filters)
  else if (filters.confidence === 'high' && filters.insuranceCompanyKeyword) {
    contractIds = await filterContractsByMetadata(filters.insuranceCompanyKeyword);
    console.log(`[queryContracts] Filtered to ${contractIds.length} contracts:`, contractIds);
    
    // Fallback: If no contracts found, search all
    if (contractIds.length === 0) {
      console.log('[queryContracts] No contracts match filters, searching all');
      contractIds = undefined;
    }
  }
  // Priority 3: Search all contracts (no scope, no filters)
  else {
    console.log('[queryContracts] No scope or filters, searching all contracts');
  }
  
  // 2.5. Expand contract IDs to include all children (hierarchical search)
  if (contractIds && contractIds.length > 0) {
    const { expandContractIdsWithChildren } = await import('./contractHierarchyHelper');
    const expandedIds = await expandContractIdsWithChildren(contractIds);
    console.log(`[queryContracts] Expanded ${contractIds.length} contracts to ${expandedIds.length} (including children)`);
    contractIds = expandedIds;
  }
  
  // 3. Detect if this is a comparison question
  const isComparison = isComparisonQuestion(question);
  const requestedCompanies = isComparison ? extractInsuranceCompanies(question) : [];
  console.log('[queryContracts] Is comparison:', isComparison, 'Companies:', requestedCompanies);
  
  // 4. Check for Hilfsmittelpositionsnummern in the question
  const positionNumbers = extractPositionNumbers(question);
  console.log('[queryContracts] Extracted position numbers:', positionNumbers);
  
  // 5. Generate embedding for semantic search
  const queryEmbeddings = await generateEmbeddings([question]);
  const queryEmbedding = queryEmbeddings[0];

  // 6. Perform hybrid search (with optional contract filtering)
  let similarChunks: Array<ContractChunk & { contract: Contract; similarity: number }> = [];
  
  // If position numbers found, do keyword search first
  if (positionNumbers.length > 0) {
    console.log('[queryContracts] Performing keyword search for position numbers');
    for (const posNum of positionNumbers) {
      const keywordResults = await searchByKeyword(posNum, 10, contractIds);
      similarChunks.push(...keywordResults);
    }
    console.log(`[queryContracts] Found ${similarChunks.length} chunks via keyword search`);
  }
  
  // Always do semantic search and merge results
  console.log('[queryContracts] Performing semantic search');
  const semanticResults = await searchSimilarChunks(queryEmbedding, 10, contractIds);
  console.log(`[queryContracts] Found ${semanticResults.length} chunks via semantic search`);
  
  // Merge and deduplicate (prioritize keyword matches)
  const chunkMap = new Map<number, typeof similarChunks[0]>();
  
  // Add keyword results first (higher priority)
  for (const chunk of similarChunks) {
    chunkMap.set(chunk.id, chunk);
  }
  
  // Add semantic results
  for (const chunk of semanticResults) {
    if (!chunkMap.has(chunk.id)) {
      chunkMap.set(chunk.id, chunk);
    }
  }
  
  similarChunks = Array.from(chunkMap.values());
  console.log(`[queryContracts] Total unique chunks after merge: ${similarChunks.length}`);

  if (similarChunks.length === 0) {
    return {
      answer: "Ich konnte keine relevanten Informationen in den hinterlegten Verträgen finden. Bitte stellen Sie sicher, dass Verträge hochgeladen wurden, die Ihre Frage beantworten können.",
      sources: [],
    };
  }

  // 4. Filter by similarity threshold
  const SIMILARITY_THRESHOLD = 0.65; // Only use chunks with >65% similarity
  const filteredChunks = similarChunks.filter(chunk => chunk.similarity >= SIMILARITY_THRESHOLD);
  console.log(`[queryContracts] Chunks after similarity filter (>=${SIMILARITY_THRESHOLD}): ${filteredChunks.length}`);
  
  // 5. Re-rank chunks using LLM for better relevance
  const rerankedChunks = await rerankChunks(question, filteredChunks.slice(0, 20));
  console.log(`[queryContracts] Re-ranked ${rerankedChunks.length} chunks`);
  
  // 6. Prepare context from re-ranked chunks with deduplication and metadata enrichment
  const topChunks = rerankedChunks.slice(0, 10);
  
  // Deduplicate similar content (e.g., repeated table headers)
  const deduplicatedChunks = deduplicateChunks(topChunks);
  console.log(`[queryContracts] Deduplicated ${topChunks.length} chunks to ${deduplicatedChunks.length}`);
  
  const context = deduplicatedChunks
    .map((chunk) => {
      // Enrich with metadata
      const metadata: string[] = [];
      if (chunk.contract.insuranceCompany) {
        metadata.push(`Krankenkasse: ${chunk.contract.insuranceCompany}`);
      }
      if (chunk.contract.validFrom) {
        metadata.push(`Gültig ab: ${chunk.contract.validFrom}`);
      }
      if (chunk.contract.productArea) {
        metadata.push(`Produktbereich: ${chunk.contract.productArea}`);
      }
      
      const metadataStr = metadata.length > 0 ? `\n${metadata.join(' | ')}` : '';
      const contractInfo = `[Vertrag: ${chunk.contract.name}, Seite ${chunk.pageNumber}${metadataStr}]`;
      return `${contractInfo}\n${chunk.content}`;
    })
    .join("\n\n---\n\n");

  // 7. Build conversation messages
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    {
      role: "system",
      content: `Du bist HimiGPT, ein KI-Assistent für Krankenkassenverträge in der Hilfsmittelbranche.

ANTWORTSTIL (dynamisch nach Fragetyp):

EINFACHE FRAGEN (Preis, Datum, Ja/Nein): 1 Satz
- Preisfragen: Nur Betrag und Position, z.B. "150,00 € für Position 19.40.01.7."
- Ja/Nein-Fragen: Mit Ja/Nein beginnen, dann kurze Begründung in 1 Satz
- Datumsfragen: Nur das Datum nennen

MITTLERE FRAGEN (Konditionen, Bedingungen): 2-3 Sätze
- Hauptinformation im ersten Satz
- Wichtige Details im zweiten Satz
- Optional: Einschränkung oder Zusatzinfo im dritten Satz

KOMPLEXE FRAGEN (Vergleiche, mehrere Aspekte): 3-4 Sätze
- Strukturierte Antwort mit klarer Gliederung
- Aufzählungen bei mehreren gleichwertigen Punkten erlaubt

VERGLEICHSFRAGEN (spezielle Behandlung):
- Erstelle eine übersichtliche Gegenüberstellung
- Format: "**Krankenkasse A**: Preis/Kondition [Quelle] | **Krankenkasse B**: Preis/Kondition [Quelle]"
- Hebe den besten Wert hervor (z.B. "günstigster Preis", "beste Konditionen")
- Bei fehlenden Daten: Explizit erwähnen "Keine Information verfügbar"

ALLGEMEIN:
- Keine Einleitungen wie "Basierend auf dem Vertrag..." oder "Laut den Unterlagen..."
- Komm sofort zur Sache und beantworte die Frage direkt

QUELLENANGABEN:
- Gib am Ende IMMER Quellenangaben im Format [Vertragsname, Seite X] an
- Bei mehreren Quellen: Alle Quellen auflisten, z.B. [AOK Bayern Vertrag, Seite 66] [IKK Classic Vertrag, Seite 12]
- Die Quellen werden automatisch als klickbare Links angezeigt

WICHTIGE REGELN:
1. Nutze NUR die bereitgestellten Vertragsauszüge - KEINE ERFUNDENEN INFORMATIONEN!
2. Wenn Information fehlt: "Diese Information ist in den vorliegenden Verträgen nicht enthalten."
3. Keine Spekulationen oder Annahmen
4. Bei Hilfsmittelpositionsnummern: Vollständige Nummer angeben (z.B. 19.40.01.7)
5. KRITISCH: Nenne NUR Krankenkassen, die EXPLIZIT in den Vertragsauszügen vorkommen
6. KRITISCH: Erfinde KEINE Verträge oder Krankenkassen, die nicht in den Quellen stehen
7. KRITISCH: Wenn eine Position nur in EINEM Vertrag vorkommt, sage das klar und deutlich

BEISPIELE FÜR GUTE ANTWORTEN:

Frage: "Was zahlt die AOK für 19.40.01.7?"
Gut: "Die AOK Bayern zahlt 150,00 € (Brutto) für Position 19.40.01.7. [AOK Bayern Vertrag, Seite 66]"
Schlecht: "Basierend auf den Vertragsunterlagen der AOK Bayern, die ich analysiert habe, kann ich Ihnen mitteilen, dass..."

Frage: "Wie ist die Kündigungsfrist?"
Gut: "Die Kündigungsfrist beträgt 3 Monate zum Quartalsende. [Rahmenvertrag 2024, Seite 12]"
Schlecht: "In den vorliegenden Verträgen finde ich Informationen zur Kündigungsfrist. Diese beträgt..."

Frage: "Gibt es einen Rabatt für Großbestellungen?"
Gut: "Ja, ab 100 Stück gibt es 5% Mengenrabatt. [Preisliste 2024, Seite 8]"
Schlecht: "Laut Vertrag existiert tatsächlich eine Rabattregelung für größere Bestellmengen..."

KONTEXT AUS DEN VERTRÄGEN:
${context}`
    },
  ];

  // Add conversation history
  for (const msg of conversationHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Add current question
  messages.push({
    role: "user",
    content: question,
  });

  // 8. Generate answer with LLM
  const response = await invokeLLM({ messages });
  let answer = response.choices[0]?.message?.content;

  if (!answer || typeof answer !== 'string') {
    throw new Error("Failed to generate answer");
  }
  
  // 9. Validate answer quality
  const validationResult = validateAnswer(question, answer, positionNumbers);
  if (!validationResult.isValid) {
    console.warn(`[queryContracts] Answer validation failed: ${validationResult.reason}`);
    // Optionally: Add a note to the answer
    answer = `${answer}\n\n_Hinweis: ${validationResult.suggestion}_`;
  }
  
  // 9b. Validate against hallucinations (check if mentioned companies exist in sources)
  const { validateAnswerAgainstSources } = await import('./hallucinationValidator');
  const hallucinationCheck = validateAnswerAgainstSources(answer, rerankedChunks.slice(0, 10));
  
  if (!hallucinationCheck.isValid) {
    console.warn(`[queryContracts] HALLUCINATION DETECTED! Invented companies:`, hallucinationCheck.hallucinatedCompanies);
    console.warn(`[queryContracts] Valid companies:`, hallucinationCheck.validCompanies);
    console.warn(`[queryContracts] Regenerating answer with stricter prompt...`);
    
    // Extract valid company names from source chunks for strict validation
    const validCompanyNames = Array.from(
      new Set(
        rerankedChunks
          .slice(0, 10)
          .map(c => c.contract.insuranceCompany)
          .filter(Boolean)
      )
    );
    
    // Regenerate answer with stricter prompt
    const strictMessages = [
      {
        role: "system" as const,
        content: `Du bist HimiGPT. Beantworte die Frage basierend NUR auf den folgenden Vertragsauszügen.

KRITISCH WICHTIG:
- Nenne NUR Krankenkassen, die EXPLIZIT in den Vertragsauszügen vorkommen
- Die verfügbaren Krankenkassen in den Quellen sind: ${validCompanyNames.join(', ')}
- Erfinde KEINE anderen Krankenkassen
- Wenn eine Position nur in EINEM Vertrag vorkommt, sage klar: "Die Position ist nur im Vertrag [Name] enthalten."
- Wenn eine Position in MEHREREN Verträgen vorkommt, liste NUR die Krankenkassen auf, die in den Quellen stehen

QUELLENANGABEN:
- Gib am Ende IMMER Quellenangaben im Format [Vertragsname, Seite X] an

KONTEXT AUS DEN VERTRÄGEN:
${context}`
      },
      ...conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      })),
      {
        role: "user" as const,
        content: question
      }
    ];
    
    const retryResponse = await invokeLLM({ messages: strictMessages });
    const retryAnswer = retryResponse.choices[0]?.message?.content;
    
    if (retryAnswer && typeof retryAnswer === 'string') {
      // Validate retry answer
      const retryCheck = validateAnswerAgainstSources(retryAnswer, rerankedChunks.slice(0, 10));
      
      if (retryCheck.isValid) {
        console.log(`[queryContracts] Retry successful - no hallucinations detected`);
        answer = retryAnswer;
      } else {
        console.error(`[queryContracts] Retry failed - still hallucinating:`, retryCheck.hallucinatedCompanies);
        // Use retry answer but add warning
        answer = `${retryAnswer}\n\n_⚠️ Hinweis: Die Antwort konnte nicht vollständig validiert werden. Bitte prüfen Sie die Quellenangaben sorgfältig._`;
      }
    } else {
      console.error(`[queryContracts] Retry failed - no valid answer generated`);
      answer = `${answer}\n\n_⚠️ Hinweis: ${hallucinationCheck.suggestion}_`;
    }
  }

  // 9. Extract unique sources from re-ranked chunks (deduplicate by contract and page)
  const sourceMap = new Map<string, Source>();
  const { buildSourcePath } = await import('./contractHierarchyHelper');
  
  for (const chunk of rerankedChunks.slice(0, 10)) {
    const key = `${chunk.contract.id}-${chunk.pageNumber}`;
    if (!sourceMap.has(key)) {
      // Build hierarchical path (e.g., "AOK Bayern Orthopädie > Produktgruppe 4")
      const hierarchicalName = await buildSourcePath(chunk.contract.id, chunk.contract.name);
      
      sourceMap.set(key, {
        contractId: chunk.contract.id,
        contractName: hierarchicalName,
        insuranceCompany: chunk.contract.insuranceCompany,
        pageNumber: chunk.pageNumber,
        excerpt: chunk.content.substring(0, 200) + (chunk.content.length > 200 ? "..." : ""),
        similarity: chunk.similarity,
      });
    }
  }

  const sources = Array.from(sourceMap.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5); // Show up to 5 most relevant sources
  
  // 10. If comparison question, extract structured comparison data
  let comparisonData: ComparisonData[] | undefined;
  if (isComparison && positionNumbers.length > 0) {
    comparisonData = await extractComparisonData(
      rerankedChunks.slice(0, 10),
      positionNumbers[0],
      requestedCompanies
    );
    console.log('[queryContracts] Extracted comparison data:', comparisonData);
  }

  return {
    answer,
    sources,
    isComparison,
    comparisonData,
  };
}

/**
 * Generate a title for a chat based on the first message
 */
export async function generateChatTitle(firstMessage: string): Promise<string> {
  const response = await invokeLLM({
    messages: [
      {
        role: "system",
        content: "Generiere einen kurzen, prägnanten Titel (max. 50 Zeichen) für einen Chat basierend auf der ersten Nachricht. Der Titel sollte das Thema der Frage zusammenfassen. Antworte NUR mit dem Titel, ohne Anführungszeichen."
      },
      {
        role: "user",
        content: firstMessage
      }
    ]
  });

  const title = response.choices[0]?.message?.content;
  if (!title || typeof title !== 'string') {
    return "Neuer Chat";
  }

  return title.trim().substring(0, 50);
}
