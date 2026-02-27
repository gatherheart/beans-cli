/**
 * Memory Store
 *
 * Manages discovery, loading, and caching of memory files.
 * Provides the main interface for the memory system.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import { createHash } from 'crypto';
import type {
  MemoryConfig,
  MemoryFile,
  MemorySegment,
  MemoryTier,
  MemoryDiscoveryResult,
  MemoryCacheStats,
  TokenBudget,
  HierarchicalMemory,
  SaveMemoryOptions,
  SaveMemoryResult,
  MemoryMetadata,
} from './types.js';
import { DEFAULT_MEMORY_CONFIG } from './types.js';
import { resolveImports } from './import-resolver.js';

/**
 * Default beans directory name
 */
const BEANS_DIR = '.beans';

/**
 * Global beans directory in home
 */
const GLOBAL_BEANS_DIR = path.join(homedir(), '.beans');

/**
 * Section header for LLM-added memories
 */
const MEMORY_SECTION_HEADER = '## Beans Added Memories';

/**
 * Parse YAML frontmatter from markdown content
 */
function parseFrontmatter(content: string): { metadata: MemoryMetadata; body: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);

  if (!match) {
    return { metadata: {}, body: content };
  }

  const [, yamlContent, body] = match;
  const metadata: MemoryMetadata = {};

  // Simple YAML parsing for our limited use case
  const lines = yamlContent.split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex === -1) continue;

    const key = line.slice(0, colonIndex).trim();
    const value = line.slice(colonIndex + 1).trim();

    switch (key) {
      case 'version':
        metadata.version = parseInt(value, 10);
        break;
      case 'enabled':
        metadata.enabled = value === 'true';
        break;
      case 'priority':
        metadata.priority = parseInt(value, 10);
        break;
    }
  }

  return { metadata, body };
}

/**
 * Compute hash of content for cache invalidation
 */
function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * Estimate token count from content
 * Uses simple heuristic: ~4 characters per token
 */
function estimateTokens(content: string): number {
  return Math.ceil(content.length / 4);
}

/**
 * Get default priority for a memory tier
 */
function getTierPriority(tier: MemoryTier): number {
  switch (tier) {
    case 'global':
      return 0;
    case 'plugin':
      return 50;
    case 'project':
      return 100;
  }
}

/**
 * Check if a file exists and is readable
 */
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath, fs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * MemoryStore - Main class for managing memory files
 */
export class MemoryStore {
  private config: MemoryConfig;
  private workspace: string;
  private cache: Map<string, MemoryFile> = new Map();
  private lastRefresh: Date = new Date(0);
  private cacheHits = 0;
  private cacheMisses = 0;

  constructor(config: Partial<MemoryConfig> = {}, workspace: string = process.cwd()) {
    this.config = { ...DEFAULT_MEMORY_CONFIG, ...config };
    this.workspace = workspace;
  }

  /**
   * Discover and load all memory files
   */
  async discover(): Promise<MemoryDiscoveryResult> {
    if (!this.config.enabled) {
      return { files: [], content: '', totalTokens: 0, loadedPaths: [] };
    }

    const files: MemoryFile[] = [];

    // Discover global memory
    const globalFiles = await this.discoverGlobal();
    files.push(...globalFiles);

    // Discover project memory
    const projectFiles = await this.discoverProject();
    files.push(...projectFiles);

    // Sort by priority (global first, then project)
    files.sort((a, b) => a.priority - b.priority);

    // Build combined content
    const content = this.formatContent(files);
    const totalTokens = files.reduce((sum, f) => sum + f.tokens, 0);
    const loadedPaths = files.map(f => f.path);

    this.lastRefresh = new Date();

    return { files, content, totalTokens, loadedPaths };
  }

  /**
   * Discover global memory files (~/.beans/)
   */
  private async discoverGlobal(): Promise<MemoryFile[]> {
    const files: MemoryFile[] = [];

    // Main global memory file
    const globalPath = path.join(GLOBAL_BEANS_DIR, this.config.fileName);
    const globalFile = await this.loadFile(globalPath, 'global');
    if (globalFile) {
      files.push(globalFile);
    }

    // Local secrets file (if enabled)
    if (this.config.loadLocalFiles) {
      const localName = this.config.fileName.replace('.md', '.local.md');
      const localPath = path.join(GLOBAL_BEANS_DIR, localName);
      const localFile = await this.loadFile(localPath, 'global');
      if (localFile) {
        // Local files have slightly higher priority within their tier
        localFile.priority += 1;
        files.push(localFile);
      }
    }

    return files;
  }

  /**
   * Discover project memory files
   */
  private async discoverProject(): Promise<MemoryFile[]> {
    const files: MemoryFile[] = [];

    // Check workspace root for memory file
    const rootPath = path.join(this.workspace, this.config.fileName);
    const rootFile = await this.loadFile(rootPath, 'project');
    if (rootFile) {
      files.push(rootFile);
    }

    // Check .beans directory
    const beansPath = path.join(this.workspace, BEANS_DIR, this.config.fileName);
    const beansFile = await this.loadFile(beansPath, 'project');
    if (beansFile) {
      // .beans directory has slightly lower priority than root
      beansFile.priority -= 1;
      files.push(beansFile);
    }

    // Local secrets files (if enabled)
    if (this.config.loadLocalFiles) {
      const localName = this.config.fileName.replace('.md', '.local.md');

      const rootLocalPath = path.join(this.workspace, localName);
      const rootLocalFile = await this.loadFile(rootLocalPath, 'project');
      if (rootLocalFile) {
        rootLocalFile.priority += 1;
        files.push(rootLocalFile);
      }

      const beansLocalPath = path.join(this.workspace, BEANS_DIR, localName);
      const beansLocalFile = await this.loadFile(beansLocalPath, 'project');
      if (beansLocalFile) {
        files.push(beansLocalFile);
      }
    }

    return files;
  }

  /**
   * Load a single memory file
   */
  private async loadFile(filePath: string, tier: MemoryTier): Promise<MemoryFile | null> {
    // Check cache first
    const cached = this.cache.get(filePath);
    if (cached) {
      // Verify file hasn't changed
      try {
        const stat = await fs.stat(filePath);
        if (stat.mtime <= cached.loadedAt) {
          this.cacheHits++;
          return cached;
        }
      } catch {
        // File may have been deleted
        this.cache.delete(filePath);
        return null;
      }
    }

    this.cacheMisses++;

    // Check if file exists
    if (!(await fileExists(filePath))) {
      return null;
    }

    try {
      const rawContent = await fs.readFile(filePath, 'utf-8');
      const { metadata, body } = parseFrontmatter(rawContent);

      // Skip if disabled in frontmatter
      if (metadata.enabled === false) {
        return null;
      }

      // Resolve imports
      const { content, importedFiles, errors } = await resolveImports(
        body,
        path.dirname(filePath),
        {
          maxDepth: this.config.maxImportDepth,
          maxImportsPerFile: this.config.maxImportsPerFile,
          allowedExtensions: ['.md'],
        }
      );

      if (errors.length > 0 && this.config.debugProvenance) {
        console.warn(`Import errors in ${filePath}:`, errors);
      }

      const memoryFile: MemoryFile = {
        path: filePath,
        rawContent,
        content,
        tier,
        priority: metadata.priority ?? getTierPriority(tier),
        metadata,
        imports: importedFiles,
        tokens: estimateTokens(content),
        hash: computeHash(content),
        loadedAt: new Date(),
      };

      // Cache it
      this.cache.set(filePath, memoryFile);

      return memoryFile;
    } catch (error) {
      // Graceful degradation - log but don't crash
      console.warn(`Failed to load memory file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Format memory files into combined content
   */
  private formatContent(files: MemoryFile[]): string {
    if (files.length === 0) {
      return '';
    }

    const sections: string[] = [];

    for (const file of files) {
      const relativePath = this.getRelativePath(file.path);
      const tierLabel = file.tier.toUpperCase();

      sections.push(`--- ${tierLabel}: ${relativePath} ---`);
      sections.push(file.content.trim());
      sections.push(`--- End of ${relativePath} ---`);
      sections.push('');
    }

    return sections.join('\n').trim();
  }

  /**
   * Get a relative path for display
   */
  private getRelativePath(filePath: string): string {
    if (filePath.startsWith(homedir())) {
      return filePath.replace(homedir(), '~');
    }
    if (filePath.startsWith(this.workspace)) {
      return path.relative(this.workspace, filePath);
    }
    return filePath;
  }

  /**
   * Reload all memory from disk
   */
  async reload(): Promise<MemoryDiscoveryResult> {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
    return this.discover();
  }

  /**
   * Get combined memory content
   */
  async getContent(): Promise<string> {
    const result = await this.discover();
    return result.content;
  }

  /**
   * Get formatted content for display
   */
  async getFormattedContent(): Promise<string> {
    const result = await this.discover();
    if (!result.content) {
      return 'No memory files found.';
    }

    const stats = `Loaded ${result.files.length} file(s), ~${result.totalTokens} tokens`;
    return `${stats}\n\n${result.content}`;
  }

  /**
   * Get all memory segments with provenance
   */
  async getSegments(): Promise<MemorySegment[]> {
    const result = await this.discover();
    return result.files.map(f => ({
      content: f.content,
      source: {
        tier: f.tier,
        path: f.path,
      },
      tokens: f.tokens,
      hash: f.hash,
    }));
  }

  /**
   * List all discovered memory file paths
   */
  async listFiles(): Promise<string[]> {
    const result = await this.discover();
    return result.loadedPaths.map(p => this.getRelativePath(p));
  }

  /**
   * Get hierarchical memory structure
   */
  async getHierarchical(): Promise<HierarchicalMemory> {
    const result = await this.discover();
    const memory: HierarchicalMemory = {};

    const globalFiles = result.files.filter(f => f.tier === 'global');
    if (globalFiles.length > 0) {
      memory.global = globalFiles.map(f => f.content).join('\n\n');
    }

    const pluginFiles = result.files.filter(f => f.tier === 'plugin');
    if (pluginFiles.length > 0) {
      memory.plugin = pluginFiles.map(f => f.content).join('\n\n');
    }

    const projectFiles = result.files.filter(f => f.tier === 'project');
    if (projectFiles.length > 0) {
      memory.project = projectFiles.map(f => f.content).join('\n\n');
    }

    return memory;
  }

  /**
   * Get total token count
   */
  async getTokenCount(): Promise<number> {
    const result = await this.discover();
    return result.totalTokens;
  }

  /**
   * Check if memory is within token budget
   */
  async getTokenBudget(modelContextLimit: number): Promise<TokenBudget> {
    const result = await this.discover();
    const maxMemoryTokens = Math.floor(modelContextLimit * (this.config.tokenBudgetPercent / 100));

    return {
      modelContextLimit,
      memoryBudgetPercent: this.config.tokenBudgetPercent,
      maxMemoryTokens,
      currentTokens: result.totalTokens,
      withinBudget: result.totalTokens <= maxMemoryTokens,
    };
  }

  /**
   * Append content to global memory
   */
  async appendToGlobal(content: string): Promise<SaveMemoryResult> {
    return this.appendToFile(
      path.join(GLOBAL_BEANS_DIR, this.config.fileName),
      content
    );
  }

  /**
   * Append content to project memory
   */
  async appendToProject(content: string): Promise<SaveMemoryResult> {
    // Prefer .beans directory if it exists
    const beansDir = path.join(this.workspace, BEANS_DIR);
    const targetPath = (await fileExists(beansDir))
      ? path.join(beansDir, this.config.fileName)
      : path.join(this.workspace, this.config.fileName);

    return this.appendToFile(targetPath, content);
  }

  /**
   * Save memory with options
   */
  async saveMemory(options: SaveMemoryOptions): Promise<SaveMemoryResult> {
    const targetPath = options.target === 'global'
      ? path.join(GLOBAL_BEANS_DIR, this.config.fileName)
      : path.join(this.workspace, BEANS_DIR, this.config.fileName);

    return this.appendToFile(targetPath, options.content, options.section);
  }

  /**
   * Append content to a memory file
   */
  private async appendToFile(
    filePath: string,
    content: string,
    section?: string
  ): Promise<SaveMemoryResult> {
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      // Sanitize content (single line, no markdown injection)
      const sanitized = content
        .replace(/[\r\n]/g, ' ')
        .replace(/^#+\s*/g, '')
        .trim();

      const newEntry = `- ${sanitized}`;

      // Read existing content or start fresh
      let existingContent = '';
      if (await fileExists(filePath)) {
        existingContent = await fs.readFile(filePath, 'utf-8');
      }

      // Compute new content
      let newContent: string;
      const targetSection = section || MEMORY_SECTION_HEADER;

      const sectionIndex = existingContent.indexOf(targetSection);
      if (sectionIndex === -1) {
        // Section doesn't exist, append it
        const separator = existingContent.endsWith('\n') ? '\n' : '\n\n';
        newContent = existingContent + separator + targetSection + '\n' + newEntry + '\n';
      } else {
        // Insert into existing section
        const beforeSection = existingContent.slice(0, sectionIndex + targetSection.length);
        const afterSectionStart = existingContent.slice(sectionIndex + targetSection.length);

        // Find next section or end
        const nextSectionMatch = afterSectionStart.match(/\n## /);
        const insertPoint = nextSectionMatch
          ? nextSectionMatch.index!
          : afterSectionStart.length;

        const sectionContent = afterSectionStart.slice(0, insertPoint).trimEnd();
        const afterSection = afterSectionStart.slice(insertPoint);

        newContent = beforeSection + sectionContent + '\n' + newEntry + afterSection;
      }

      // Write the file
      await fs.writeFile(filePath, newContent, 'utf-8');

      // Invalidate cache
      this.cache.delete(filePath);

      return {
        success: true,
        path: filePath,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): MemoryCacheStats {
    let totalBytes = 0;
    let totalTokens = 0;

    for (const file of this.cache.values()) {
      totalBytes += file.content.length;
      totalTokens += file.tokens;
    }

    const totalRequests = this.cacheHits + this.cacheMisses;
    const hitRate = totalRequests > 0 ? this.cacheHits / totalRequests : 0;

    return {
      fileCount: this.cache.size,
      totalBytes,
      totalTokens,
      hitRate,
      lastRefresh: this.lastRefresh,
    };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
    this.cacheHits = 0;
    this.cacheMisses = 0;
  }

  /**
   * Update workspace path
   */
  setWorkspace(workspace: string): void {
    this.workspace = workspace;
    this.clearCache();
  }

  /**
   * Update configuration
   */
  setConfig(config: Partial<MemoryConfig>): void {
    this.config = { ...this.config, ...config };
    this.clearCache();
  }

  /**
   * Get current configuration
   */
  getConfig(): MemoryConfig {
    return { ...this.config };
  }
}

/**
 * Flatten hierarchical memory into a single string
 */
export function flattenMemory(memory: HierarchicalMemory | string | undefined): string {
  if (!memory) return '';
  if (typeof memory === 'string') return memory;

  const sections: string[] = [];

  if (memory.global?.trim()) {
    sections.push(`=== GLOBAL PREFERENCES ===\n${memory.global.trim()}`);
  }
  if (memory.plugin?.trim()) {
    sections.push(`=== PLUGIN CONTEXT ===\n${memory.plugin.trim()}`);
  }
  if (memory.project?.trim()) {
    sections.push(`=== PROJECT CONTEXT ===\n${memory.project.trim()}`);
  }

  return sections.join('\n\n');
}
