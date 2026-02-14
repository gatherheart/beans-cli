/**
 * Embedding generation for tool RAG
 *
 * Uses Gemini's text-embedding API for semantic similarity.
 * Falls back to simple keyword matching if embedding fails.
 */

import {
  isMultiAgentDebugEnabled,
  logRAGEmbeddingFallback,
} from '../debug-logger.js';

// Using gemini-embedding-001 (text-embedding-004 was deprecated Jan 2026)
const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768; // Can be 768, 1536, or 3072

/**
 * Generate embeddings using Gemini's embedding API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    // Fall back to simple hash-based pseudo-embedding
    return generateSimpleEmbedding(text);
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:embedContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: `models/${EMBEDDING_MODEL}`,
          content: {
            parts: [{ text }],
          },
          outputDimensionality: EMBEDDING_DIMENSIONS,
        }),
      }
    );

    if (!response.ok) {
      if (isMultiAgentDebugEnabled()) {
        logRAGEmbeddingFallback('API error', `Status: ${response.status}`);
      }
      return generateSimpleEmbedding(text);
    }

    const data = (await response.json()) as {
      embedding?: { values: number[] };
    };

    if (!data.embedding?.values) {
      return generateSimpleEmbedding(text);
    }

    return data.embedding.values;
  } catch (error) {
    if (isMultiAgentDebugEnabled()) {
      logRAGEmbeddingFallback('Exception', error instanceof Error ? error.message : String(error));
    }
    return generateSimpleEmbedding(text);
  }
}

/**
 * Generate embeddings for multiple texts in batch
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    return texts.map(t => generateSimpleEmbedding(t));
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requests: texts.map(text => ({
            model: `models/${EMBEDDING_MODEL}`,
            content: {
              parts: [{ text }],
            },
            outputDimensionality: EMBEDDING_DIMENSIONS,
          })),
        }),
      }
    );

    if (!response.ok) {
      if (isMultiAgentDebugEnabled()) {
        logRAGEmbeddingFallback('Batch API error', `Status: ${response.status}`);
      }
      return texts.map(t => generateSimpleEmbedding(t));
    }

    const data = (await response.json()) as {
      embeddings?: Array<{ values: number[] }>;
    };

    if (!data.embeddings || data.embeddings.length !== texts.length) {
      return texts.map(t => generateSimpleEmbedding(t));
    }

    return data.embeddings.map(e => e.values);
  } catch (error) {
    if (isMultiAgentDebugEnabled()) {
      logRAGEmbeddingFallback('Batch exception', error instanceof Error ? error.message : String(error));
    }
    return texts.map(t => generateSimpleEmbedding(t));
  }
}

/**
 * Simple fallback embedding using keyword hashing
 * Creates a sparse vector based on word frequencies and character n-grams
 */
function generateSimpleEmbedding(text: string): number[] {
  const normalized = text.toLowerCase().trim();
  const words = normalized.split(/\s+/);
  const vector = new Array(EMBEDDING_DIMENSIONS).fill(0);

  // Word-based features
  for (const word of words) {
    const hash = simpleHash(word);
    const index = Math.abs(hash) % EMBEDDING_DIMENSIONS;
    vector[index] += 1;
  }

  // Character n-gram features (trigrams)
  for (let i = 0; i < normalized.length - 2; i++) {
    const trigram = normalized.slice(i, i + 3);
    const hash = simpleHash(trigram);
    const index = Math.abs(hash) % EMBEDDING_DIMENSIONS;
    vector[index] += 0.5;
  }

  // Normalize the vector
  const magnitude = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0));
  if (magnitude > 0) {
    for (let i = 0; i < vector.length; i++) {
      vector[i] /= magnitude;
    }
  }

  return vector;
}

/**
 * Simple string hash function
 */
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    magnitudeA += a[i] * a[i];
    magnitudeB += b[i] * b[i];
  }

  magnitudeA = Math.sqrt(magnitudeA);
  magnitudeB = Math.sqrt(magnitudeB);

  if (magnitudeA === 0 || magnitudeB === 0) {
    return 0;
  }

  return dotProduct / (magnitudeA * magnitudeB);
}
