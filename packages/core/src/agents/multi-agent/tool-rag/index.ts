/**
 * Tool RAG - Retrieval-Augmented Generation for tool selection
 *
 * This module provides semantic search over tool knowledge to
 * intelligently select tools based on user input.
 */

export type {
  ToolKnowledge,
  EmbeddingEntry,
  SearchResult,
  ToolRecommendation,
} from './types.js';

export {
  toolKnowledgeBase,
  getToolKnowledge,
  getAllToolKnowledge,
} from './tool-knowledge.js';

export {
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
} from './embeddings.js';

export {
  getVectorStore,
  resetVectorStore,
} from './vector-store.js';

export {
  initializeToolRAG,
  retrieveTools,
  suggestAgent,
  isToolRAGInitialized,
  resetToolRAG,
  clearRAG,
} from './tool-retriever.js';
