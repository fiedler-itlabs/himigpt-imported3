import { invokeLLM } from "./_core/llm";
import { generateEmbeddings } from './embeddings';
import { searchSimilarChunks, searchByKeyword } from './db';

export type DebugSearchResult = {
  query: string;
  embeddingSearch: {
    chunks: Array<{
      id: number;
      content: string;
      pageNumber: number;
      contractName: string;
      insuranceCompany: string | null;
      similarity: number;
    }>;
    totalFound: number;
  };
  keywordSearch: {
    chunks: Array<{
      id: number;
      content: string;
      pageNumber: number;
      contractName: string;
      insuranceCompany: string | null;
    }>;
    totalFound: number;
  };
  hybridSearch: {
    chunks: Array<{
      id: number;
      content: string;
      pageNumber: number;
      contractName: string;
      insuranceCompany: string | null;
      similarity: number;
      source: 'embedding' | 'keyword' | 'both';
    }>;
    totalFound: number;
  };
};

/**
 * Debug function to inspect RAG search results
 * Shows embedding search, keyword search, and hybrid results
 */
export async function debugSearch(
  query: string,
  contractIds: number[]
): Promise<DebugSearchResult> {
  console.log(`[debugSearch] Query: "${query}", Contracts: ${contractIds.join(', ')}`);

  // 1. Embedding search
  const queryEmbedding = await generateEmbeddings([query]);
  const embeddingResults = await searchSimilarChunks(queryEmbedding[0], 20);
  // Filter by contractIds
  const filteredEmbeddingResults = embeddingResults.filter(c => contractIds.includes(c.contract.id));
  
  console.log(`[debugSearch] Embedding search found ${filteredEmbeddingResults.length} chunks`);
  filteredEmbeddingResults.slice(0, 5).forEach((r, i) => {
    console.log(`  [${i}] Similarity: ${r.similarity.toFixed(4)}, Page: ${r.pageNumber}, Content: ${r.content.substring(0, 100)}...`);
  });

  // 2. Keyword search
  const keywordResults = await searchByKeyword(query, 20);
  // Filter by contractIds
  const filteredKeywordResults = keywordResults.filter(c => contractIds.includes(c.contract.id));
  
  console.log(`[debugSearch] Keyword search found ${filteredKeywordResults.length} chunks`);
  filteredKeywordResults.slice(0, 5).forEach((r, i) => {
    console.log(`  [${i}] Page: ${r.pageNumber}, Content: ${r.content.substring(0, 100)}...`);
  });

  // 3. Hybrid search (combine both)
  const hybridMap = new Map<number, {
    chunk: typeof embeddingResults[0];
    similarity: number;
    source: 'embedding' | 'keyword' | 'both';
  }>();

  // Add embedding results
  filteredEmbeddingResults.forEach(chunk => {
    hybridMap.set(chunk.id, {
      chunk,
      similarity: chunk.similarity,
      source: 'embedding'
    });
  });

  // Add keyword results (boost similarity if already exists)
  filteredKeywordResults.forEach(chunk => {
    const existing = hybridMap.get(chunk.id);
    if (existing) {
      // Boost similarity for chunks found by both methods
      existing.similarity = Math.min(1.0, existing.similarity * 1.2);
      existing.source = 'both';
    } else {
      // Assign moderate similarity for keyword-only matches
      hybridMap.set(chunk.id, {
        chunk: { ...chunk, similarity: 0.6 },
        similarity: 0.6,
        source: 'keyword'
      });
    }
  });

  // Sort by similarity
  const hybridResults = Array.from(hybridMap.values())
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 20);

  console.log(`[debugSearch] Hybrid search combined to ${hybridResults.length} chunks`);
  hybridResults.slice(0, 5).forEach((r, i) => {
    console.log(`  [${i}] Similarity: ${r.similarity.toFixed(4)}, Source: ${r.source}, Page: ${r.chunk.pageNumber}, Content: ${r.chunk.content.substring(0, 100)}...`);
  });

  return {
    query,
    embeddingSearch: {
      chunks: filteredEmbeddingResults.map(c => ({
        id: c.id,
        content: c.content,
        pageNumber: c.pageNumber,
        contractName: c.contract.name,
        insuranceCompany: c.contract.insuranceCompany,
        similarity: c.similarity
      })),
      totalFound: filteredEmbeddingResults.length
    },
    keywordSearch: {
      chunks: filteredKeywordResults.map(c => ({
        id: c.id,
        content: c.content,
        pageNumber: c.pageNumber,
        contractName: c.contract.name,
        insuranceCompany: c.contract.insuranceCompany
      })),
      totalFound: filteredKeywordResults.length
    },
    hybridSearch: {
      chunks: hybridResults.map(r => ({
        id: r.chunk.id,
        content: r.chunk.content,
        pageNumber: r.chunk.pageNumber,
        contractName: r.chunk.contract.name,
        insuranceCompany: r.chunk.contract.insuranceCompany,
        similarity: r.similarity,
        source: r.source
      })),
      totalFound: hybridResults.length
    }
  };
}
