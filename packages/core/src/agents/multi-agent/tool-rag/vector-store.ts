/**
 * Simple in-memory vector store for tool RAG
 *
 * Stores embeddings and enables semantic search via cosine similarity.
 */

import type { EmbeddingEntry, SearchResult } from './types.js';
import { cosineSimilarity } from './embeddings.js';

/**
 * In-memory vector store for embeddings
 */
class VectorStore {
  private entries: EmbeddingEntry[] = [];
  private initialized = false;

  /**
   * Add an entry to the store
   */
  add(entry: EmbeddingEntry): void {
    this.entries.push(entry);
  }

  /**
   * Add multiple entries
   */
  addAll(entries: EmbeddingEntry[]): void {
    this.entries.push(...entries);
  }

  /**
   * Clear all entries
   */
  clear(): void {
    this.entries = [];
    this.initialized = false;
  }

  /**
   * Check if store is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Mark store as initialized
   */
  markInitialized(): void {
    this.initialized = true;
  }

  /**
   * Get entry count
   */
  size(): number {
    return this.entries.length;
  }

  /**
   * Search for similar entries
   *
   * @param queryVector - The query embedding vector
   * @param topK - Number of results to return
   * @param threshold - Minimum similarity score (0-1)
   * @returns Array of search results sorted by similarity
   */
  search(queryVector: number[], topK = 10, threshold = 0.3): SearchResult[] {
    const results: SearchResult[] = [];

    for (const entry of this.entries) {
      const score = cosineSimilarity(queryVector, entry.vector);

      if (score >= threshold) {
        results.push({
          toolName: entry.toolName,
          score,
          matchedText: entry.text,
          contentType: entry.contentType,
        });
      }
    }

    // Sort by score descending
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, topK);
  }

  /**
   * Search and aggregate results by tool
   *
   * @param queryVector - The query embedding vector
   * @param topK - Number of top tools to return
   * @param threshold - Minimum similarity score
   * @returns Map of tool name to aggregated results
   */
  searchByTool(
    queryVector: number[],
    topK = 5,
    threshold = 0.3
  ): Map<string, SearchResult[]> {
    const allResults = this.search(queryVector, topK * 3, threshold);
    const byTool = new Map<string, SearchResult[]>();

    for (const result of allResults) {
      const existing = byTool.get(result.toolName) || [];
      existing.push(result);
      byTool.set(result.toolName, existing);
    }

    return byTool;
  }

  /**
   * Get all entries (for debugging)
   */
  getAllEntries(): EmbeddingEntry[] {
    return [...this.entries];
  }
}

// Singleton instance
let storeInstance: VectorStore | null = null;

/**
 * Get the vector store instance
 */
export function getVectorStore(): VectorStore {
  if (!storeInstance) {
    storeInstance = new VectorStore();
  }
  return storeInstance;
}

/**
 * Reset the vector store (for testing)
 */
export function resetVectorStore(): void {
  if (storeInstance) {
    storeInstance.clear();
  }
  storeInstance = null;
}
