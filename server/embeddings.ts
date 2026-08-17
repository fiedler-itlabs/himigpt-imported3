// Embedding generation using OpenAI API

/**
 * Generate embeddings for text chunks using OpenAI text-embedding-3-large
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  
  if (!apiKey) {
    console.error('[generateEmbeddings] OPENAI_API_KEY not found');
    throw new Error('OPENAI_API_KEY environment variable is required');
  }

  try {
    console.log(`[generateEmbeddings] Generating embeddings for ${texts.length} texts using OpenAI text-embedding-3-large`);
    
    // OpenAI API has a limit of ~8000 tokens per request
    // Process in batches of 100 texts to stay safe
    const batchSize = 100;
    const allEmbeddings: number[][] = [];
    
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, Math.min(i + batchSize, texts.length));
      console.log(`[generateEmbeddings] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)}`);
      
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'text-embedding-3-large',
          input: batch,
          encoding_format: 'float'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[generateEmbeddings] OpenAI API error:', error);
        throw new Error(`OpenAI API error: ${response.status} - ${error}`);
      }

      const data = await response.json();
      const batchEmbeddings = data.data.map((item: any) => item.embedding);
      allEmbeddings.push(...batchEmbeddings);
    }

    console.log(`[generateEmbeddings] Generated ${allEmbeddings.length} embeddings with ${allEmbeddings[0]?.length || 0} dimensions`);
    return allEmbeddings;
  } catch (error) {
    console.error('[generateEmbeddings] Error:', error);
    throw new Error(`Failed to generate embeddings: ${error}`);
  }
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have the same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
