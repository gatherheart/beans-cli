/**
 * Types for RAG-based tool selection
 */

/**
 * Rich knowledge about a tool for RAG retrieval
 */
export interface ToolKnowledge {
  /** Tool name (matches tool registry) */
  name: string;
  /** Short description */
  description: string;
  /** Example user queries that should trigger this tool */
  exampleQueries: string[];
  /** Related keywords and concepts */
  keywords: string[];
  /** Use cases describing when to use this tool */
  useCases: string[];
  /** Agent types that commonly use this tool */
  agentTypes?: string[];
}

/**
 * Embedding vector with metadata
 */
export interface EmbeddingEntry {
  /** Unique ID */
  id: string;
  /** Tool name this embedding relates to */
  toolName: string;
  /** Original text that was embedded */
  text: string;
  /** Type of content (query, keyword, usecase, description) */
  contentType: 'query' | 'keyword' | 'usecase' | 'description';
  /** Embedding vector */
  vector: number[];
}

/**
 * Search result from vector store
 */
export interface SearchResult {
  /** Tool name */
  toolName: string;
  /** Similarity score (0-1) */
  score: number;
  /** Matched content */
  matchedText: string;
  /** Type of match */
  contentType: string;
}

/**
 * Tool recommendation from RAG
 */
export interface ToolRecommendation {
  /** Tool name */
  toolName: string;
  /** Aggregated relevance score */
  relevance: number;
  /** Number of matches */
  matchCount: number;
  /** Best matching examples */
  topMatches: Array<{
    text: string;
    score: number;
    type: string;
  }>;
  /** Suggested agent type */
  suggestedAgent?: string;
}
