/**
 * Memory System Types
 *
 * Defines types for the hierarchical memory system that provides
 * persistent instructions injected into the LLM system prompt.
 */

/**
 * Memory tier hierarchy (priority order: project > plugin > global)
 */
export type MemoryTier = 'global' | 'plugin' | 'project';

/**
 * Configuration for the memory system
 */
export interface MemoryConfig {
  /** Enable memory system */
  enabled: boolean;

  /** Memory file name (default: BEANS.md) */
  fileName: string;

  /** Token budget as percentage of model context (default: 10) */
  tokenBudgetPercent: number;

  /** Maximum import depth for @import directives (default: 5) */
  maxImportDepth: number;

  /** Maximum imports per file (default: 20) */
  maxImportsPerFile: number;

  /** Enable file watching for auto-refresh */
  watchFiles: boolean;

  /** Paths to exclude from memory discovery */
  excludePaths: string[];

  /** Enable .local.md file loading for secrets */
  loadLocalFiles: boolean;

  /** Show provenance in debug mode */
  debugProvenance: boolean;
}

/**
 * Default memory configuration
 */
export const DEFAULT_MEMORY_CONFIG: MemoryConfig = {
  enabled: true,
  fileName: 'BEANS.md',
  tokenBudgetPercent: 10,
  maxImportDepth: 5,
  maxImportsPerFile: 20,
  watchFiles: false,
  excludePaths: ['node_modules', '.git', 'dist', 'build', 'coverage'],
  loadLocalFiles: true,
  debugProvenance: false,
};

/**
 * YAML frontmatter metadata for memory files
 */
export interface MemoryMetadata {
  /** Schema version for migrations */
  version?: number;
  /** Enable/disable this memory file */
  enabled?: boolean;
  /** Override default tier priority */
  priority?: number;
}

/**
 * Represents a discovered memory file
 */
export interface MemoryFile {
  /** Absolute path to the file */
  path: string;
  /** Raw file content (before import resolution) */
  rawContent: string;
  /** Resolved content (after import resolution) */
  content: string;
  /** Memory tier (global, plugin, project) */
  tier: MemoryTier;
  /** Priority for sorting (higher = later in output) */
  priority: number;
  /** Parsed frontmatter metadata */
  metadata: MemoryMetadata;
  /** List of imported file paths */
  imports: string[];
  /** Estimated token count */
  tokens: number;
  /** Content hash for cache invalidation */
  hash: string;
  /** When the file was loaded */
  loadedAt: Date;
}

/**
 * Source information for a memory segment
 */
export interface MemorySource {
  /** Which tier this came from */
  tier: MemoryTier;
  /** File path */
  path: string;
  /** If imported, the file that imported it */
  importedFrom?: string;
}

/**
 * A segment of memory content with provenance
 */
export interface MemorySegment {
  /** The content */
  content: string;
  /** Source information */
  source: MemorySource;
  /** Estimated token count */
  tokens: number;
  /** Content hash */
  hash: string;
}

/**
 * Hierarchical memory structure
 */
export interface HierarchicalMemory {
  /** Global memory content (~/.beans/BEANS.md) */
  global?: string;
  /** Plugin memory content */
  plugin?: string;
  /** Project memory content */
  project?: string;
}

/**
 * Result of memory discovery
 */
export interface MemoryDiscoveryResult {
  /** All discovered memory files */
  files: MemoryFile[];
  /** Combined content for injection */
  content: string;
  /** Total token count */
  totalTokens: number;
  /** File paths that were loaded */
  loadedPaths: string[];
}

/**
 * Import resolution state (for circular detection)
 */
export interface ImportState {
  /** Files already processed in this chain */
  processedFiles: Set<string>;
  /** Current recursion depth */
  currentDepth: number;
  /** Maximum allowed depth */
  maxDepth: number;
  /** Base directory for relative imports */
  baseDir: string;
}

/**
 * Result of import resolution
 */
export interface ImportResult {
  /** Resolved content */
  content: string;
  /** Files that were imported */
  importedFiles: string[];
  /** Any errors encountered */
  errors: string[];
}

/**
 * Options for saving memory
 */
export interface SaveMemoryOptions {
  /** Content to save */
  content: string;
  /** Section header to add under (optional) */
  section?: string;
  /** Target: global or project */
  target: 'global' | 'project';
  /** Show diff preview before saving */
  showDiff?: boolean;
  /** Require user confirmation */
  requireConfirmation?: boolean;
}

/**
 * Result of saving memory
 */
export interface SaveMemoryResult {
  /** Whether save was successful */
  success: boolean;
  /** Path where content was saved */
  path?: string;
  /** Error message if failed */
  error?: string;
  /** Diff of changes (if showDiff was true) */
  diff?: string;
}

/**
 * Cache statistics
 */
export interface MemoryCacheStats {
  /** Number of files in cache */
  fileCount: number;
  /** Total bytes cached */
  totalBytes: number;
  /** Total tokens cached */
  totalTokens: number;
  /** Cache hit rate */
  hitRate: number;
  /** Last refresh time */
  lastRefresh: Date;
}

/**
 * Token budget information
 */
export interface TokenBudget {
  /** Model's context window size */
  modelContextLimit: number;
  /** Percentage of context allocated to memory */
  memoryBudgetPercent: number;
  /** Calculated max tokens for memory */
  maxMemoryTokens: number;
  /** Current memory token usage */
  currentTokens: number;
  /** Whether within budget */
  withinBudget: boolean;
}
