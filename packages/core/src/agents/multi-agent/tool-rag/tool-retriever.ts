/**
 * Tool Retriever - RAG-based tool selection
 *
 * Retrieves relevant tools based on semantic similarity to user input.
 */

import type { EmbeddingEntry, ToolRecommendation } from './types.js';
import { getAllToolKnowledge } from './tool-knowledge.js';
import { generateEmbedding, generateEmbeddings } from './embeddings.js';
import { getVectorStore } from './vector-store.js';
import {
  isMultiAgentDebugEnabled,
  logRAGInit,
  logRAGRetrieval,
} from '../debug-logger.js';

let initializationPromise: Promise<void> | null = null;

/**
 * Initialize the tool RAG system
 *
 * Generates embeddings for all tool knowledge and stores them
 * in the vector store. This should be called once at startup.
 */
export async function initializeToolRAG(): Promise<void> {
  const store = getVectorStore();

  // If already initialized, skip
  if (store.isInitialized()) {
    return;
  }

  // Prevent multiple concurrent initializations
  if (initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = doInitialize();
  return initializationPromise;
}

/**
 * Reset the RAG system (for testing)
 */
export function resetToolRAG(): void {
  initializationPromise = null;
  resetVectorStoreInternal();
}

/**
 * Clear the RAG system and force re-initialization on next use
 * Useful when tool knowledge has been updated
 */
export function clearRAG(): void {
  resetToolRAG();
}

// Import reset function
import { resetVectorStore as resetVectorStoreInternal } from './vector-store.js';

async function doInitialize(): Promise<void> {
  const store = getVectorStore();

  // Skip if already initialized
  if (store.isInitialized()) {
    return;
  }

  const knowledge = getAllToolKnowledge();
  const entries: EmbeddingEntry[] = [];
  const textsToEmbed: Array<{ text: string; meta: Omit<EmbeddingEntry, 'vector'> }> = [];

  // Collect all texts to embed
  for (const tool of knowledge) {
    // Tool description
    textsToEmbed.push({
      text: tool.description,
      meta: {
        id: `${tool.name}-desc`,
        toolName: tool.name,
        text: tool.description,
        contentType: 'description',
      },
    });

    // Example queries
    for (let i = 0; i < tool.exampleQueries.length; i++) {
      const query = tool.exampleQueries[i];
      textsToEmbed.push({
        text: query,
        meta: {
          id: `${tool.name}-query-${i}`,
          toolName: tool.name,
          text: query,
          contentType: 'query',
        },
      });
    }

    // Keywords (combined for efficiency)
    const keywordText = tool.keywords.join(' ');
    textsToEmbed.push({
      text: keywordText,
      meta: {
        id: `${tool.name}-keywords`,
        toolName: tool.name,
        text: keywordText,
        contentType: 'keyword',
      },
    });

    // Use cases
    for (let i = 0; i < tool.useCases.length; i++) {
      const useCase = tool.useCases[i];
      textsToEmbed.push({
        text: useCase,
        meta: {
          id: `${tool.name}-usecase-${i}`,
          toolName: tool.name,
          text: useCase,
          contentType: 'usecase',
        },
      });
    }
  }

  // Generate embeddings in batch
  const texts = textsToEmbed.map(t => t.text);
  const embeddings = await generateEmbeddings(texts);

  // Create entries with embeddings
  for (let i = 0; i < textsToEmbed.length; i++) {
    entries.push({
      ...textsToEmbed[i].meta,
      vector: embeddings[i],
    });
  }

  // Add to store
  store.addAll(entries);
  store.markInitialized();

  if (isMultiAgentDebugEnabled()) {
    logRAGInit(entries.length, knowledge.length);
  }
}

/**
 * Retrieve relevant tools for a user query
 *
 * @param query - User input text
 * @param topK - Number of tools to recommend
 * @returns Array of tool recommendations sorted by relevance
 */
export async function retrieveTools(
  query: string,
  topK = 5
): Promise<ToolRecommendation[]> {
  // Ensure initialized
  await initializeToolRAG();

  const store = getVectorStore();

  // Generate query embedding
  const queryVector = await generateEmbedding(query);

  // Search for similar entries
  const resultsByTool = store.searchByTool(queryVector, topK, 0.2);

  // Aggregate results into recommendations
  const recommendations: ToolRecommendation[] = [];
  const knowledge = getAllToolKnowledge();

  for (const [toolName, results] of resultsByTool) {
    // Calculate aggregated relevance
    // Weight: best match contributes most, diminishing returns for additional matches
    let relevance = 0;
    for (let i = 0; i < results.length; i++) {
      const weight = 1 / (i + 1); // 1, 0.5, 0.33, ...
      relevance += results[i].score * weight;
    }
    // Normalize by theoretical max (1 + 0.5 + 0.33 + ...) ≈ 2.08 for first 5
    relevance = Math.min(relevance / 2.08, 1);

    // Get agent types from knowledge
    const toolKnowledge = knowledge.find(k => k.name === toolName);

    recommendations.push({
      toolName,
      relevance,
      matchCount: results.length,
      topMatches: results.slice(0, 3).map(r => ({
        text: r.matchedText,
        score: r.score,
        type: r.contentType,
      })),
      suggestedAgent: toolKnowledge?.agentTypes?.[0],
    });
  }

  // Sort by relevance
  recommendations.sort((a, b) => b.relevance - a.relevance);

  const finalRecommendations = recommendations.slice(0, topK);

  // Log retrieval results in debug mode
  if (isMultiAgentDebugEnabled()) {
    logRAGRetrieval(
      query,
      finalRecommendations.map(r => ({ toolName: r.toolName, relevance: r.relevance }))
    );
  }

  return finalRecommendations;
}

/**
 * Get the best agent type for a query based on tool recommendations
 */
export async function suggestAgent(query: string): Promise<string> {
  const recommendations = await retrieveTools(query, 3);

  if (recommendations.length === 0) {
    return 'general';
  }

  // Use the suggested agent from the most relevant tool
  const best = recommendations[0];

  // If web_search is highly relevant, use general agent
  if (best.toolName === 'web_search' && best.relevance > 0.4) {
    return 'general';
  }

  // If code exploration tools are relevant, use explore agent
  const exploreTools = ['glob', 'grep', 'read_file'];
  const hasExploreTools = recommendations.some(
    r => exploreTools.includes(r.toolName) && r.relevance > 0.3
  );
  if (hasExploreTools && !recommendations.some(r => r.toolName === 'write_file')) {
    return 'explore';
  }

  // If shell is highly relevant, use bash agent
  if (best.toolName === 'shell' && best.relevance > 0.5) {
    return 'bash';
  }

  // Default to general for anything else
  return best.suggestedAgent || 'general';
}

/**
 * Check if RAG is initialized
 */
export function isToolRAGInitialized(): boolean {
  return getVectorStore().isInitialized();
}
