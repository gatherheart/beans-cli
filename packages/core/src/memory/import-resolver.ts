/**
 * Import Resolver
 *
 * Handles @import directive resolution in memory files.
 * Implements circular import prevention and depth limiting.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { homedir } from 'os';
import type { ImportResult } from './types.js';

/**
 * Options for import resolution
 */
export interface ImportOptions {
  /** Maximum recursion depth */
  maxDepth: number;
  /** Maximum imports per file */
  maxImportsPerFile: number;
  /** Allowed file extensions */
  allowedExtensions: string[];
}

/**
 * Default import options
 */
const DEFAULT_OPTIONS: ImportOptions = {
  maxDepth: 5,
  maxImportsPerFile: 20,
  allowedExtensions: ['.md'],
};

/**
 * Regex to match @import directives
 * Matches: @import path/to/file.md
 * Does not match @import inside code blocks
 */
const IMPORT_REGEX = /^@import\s+(.+)$/gm;

/**
 * Check if a position is inside a code block
 */
function isInsideCodeBlock(content: string, position: number): boolean {
  // Find all code block regions
  const codeBlockRegex = /```[\s\S]*?```|`[^`]+`/g;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (position >= match.index && position < match.index + match[0].length) {
      return true;
    }
  }

  return false;
}

/**
 * Find all @import directives in content
 */
function findImports(content: string): Array<{ start: number; end: number; path: string }> {
  const imports: Array<{ start: number; end: number; path: string }> = [];
  let match;

  // Reset regex state
  IMPORT_REGEX.lastIndex = 0;

  while ((match = IMPORT_REGEX.exec(content)) !== null) {
    // Skip if inside code block
    if (isInsideCodeBlock(content, match.index)) {
      continue;
    }

    const importPath = match[1].trim();
    if (importPath) {
      imports.push({
        start: match.index,
        end: match.index + match[0].length,
        path: importPath,
      });
    }
  }

  return imports;
}

/**
 * Resolve an import path relative to a base directory
 */
function resolveImportPath(importPath: string, baseDir: string): string {
  // Handle home directory
  if (importPath.startsWith('~/')) {
    return path.join(homedir(), importPath.slice(2));
  }

  // Handle absolute paths
  if (path.isAbsolute(importPath)) {
    return importPath;
  }

  // Handle relative paths
  return path.resolve(baseDir, importPath);
}

/**
 * Validate an import path for security
 */
function validateImportPath(
  importPath: string,
  baseDir: string,
  options: ImportOptions
): { valid: boolean; reason?: string } {
  // Check extension
  const ext = path.extname(importPath);
  if (!options.allowedExtensions.includes(ext)) {
    return { valid: false, reason: `Extension ${ext} not allowed` };
  }

  // Reject URLs
  if (/^(file|https?):\/\//.test(importPath)) {
    return { valid: false, reason: 'URLs not allowed' };
  }

  // Resolve the full path
  const resolvedPath = resolveImportPath(importPath, baseDir);

  // Check for path traversal outside allowed directories
  const normalizedPath = path.normalize(resolvedPath);
  const home = homedir();

  // Allow paths within home directory or within base directory
  const isWithinHome = normalizedPath.startsWith(home);
  const isWithinBase = normalizedPath.startsWith(path.normalize(baseDir));

  // For paths with .., ensure they don't escape
  if (importPath.includes('..')) {
    if (!isWithinHome && !isWithinBase) {
      return { valid: false, reason: 'Path traversal outside allowed directories' };
    }
  }

  return { valid: true };
}

/**
 * Read file content safely
 */
async function readFileSafe(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Resolve imports recursively
 */
async function resolveImportsRecursive(
  content: string,
  baseDir: string,
  options: ImportOptions,
  visited: Set<string>,
  depth: number,
  importedFiles: string[],
  errors: string[]
): Promise<string> {
  // Check depth limit
  if (depth > options.maxDepth) {
    errors.push(`Maximum import depth (${options.maxDepth}) exceeded`);
    return content;
  }

  // Find all imports
  const imports = findImports(content);

  // Check import count limit
  if (imports.length > options.maxImportsPerFile) {
    errors.push(`Maximum imports per file (${options.maxImportsPerFile}) exceeded`);
    // Process only up to the limit
    imports.length = options.maxImportsPerFile;
  }

  // No imports to process
  if (imports.length === 0) {
    return content;
  }

  // Process imports in reverse order to preserve positions
  let result = content;

  for (let i = imports.length - 1; i >= 0; i--) {
    const imp = imports[i];
    const resolvedPath = resolveImportPath(imp.path, baseDir);
    const normalizedPath = path.normalize(resolvedPath);

    // Check for circular import
    if (visited.has(normalizedPath)) {
      const comment = `<!-- Circular import detected: ${imp.path} -->`;
      result = result.slice(0, imp.start) + comment + result.slice(imp.end);
      errors.push(`Circular import detected: ${imp.path}`);
      continue;
    }

    // Validate path
    const validation = validateImportPath(imp.path, baseDir, options);
    if (!validation.valid) {
      const comment = `<!-- Import rejected: ${validation.reason} -->`;
      result = result.slice(0, imp.start) + comment + result.slice(imp.end);
      errors.push(`Import rejected (${imp.path}): ${validation.reason}`);
      continue;
    }

    // Read the file
    const importedContent = await readFileSafe(normalizedPath);
    if (importedContent === null) {
      const comment = `<!-- Import not found: ${imp.path} -->`;
      result = result.slice(0, imp.start) + comment + result.slice(imp.end);
      errors.push(`Import not found: ${imp.path}`);
      continue;
    }

    // Mark as visited
    visited.add(normalizedPath);
    importedFiles.push(normalizedPath);

    // Recursively resolve imports in the imported file
    const resolvedContent = await resolveImportsRecursive(
      importedContent,
      path.dirname(normalizedPath),
      options,
      visited,
      depth + 1,
      importedFiles,
      errors
    );

    // Replace the import with the content
    const importComment = `<!-- Imported from: ${imp.path} -->`;
    const endComment = `<!-- End of import: ${imp.path} -->`;
    const replacement = `${importComment}\n${resolvedContent.trim()}\n${endComment}`;

    result = result.slice(0, imp.start) + replacement + result.slice(imp.end);
  }

  return result;
}

/**
 * Resolve all @import directives in content
 *
 * @param content - The content to process
 * @param baseDir - Base directory for resolving relative imports
 * @param options - Import resolution options
 * @returns ImportResult with resolved content and metadata
 */
export async function resolveImports(
  content: string,
  baseDir: string,
  options: Partial<ImportOptions> = {}
): Promise<ImportResult> {
  const mergedOptions = { ...DEFAULT_OPTIONS, ...options };
  const visited = new Set<string>();
  const importedFiles: string[] = [];
  const errors: string[] = [];

  const resolvedContent = await resolveImportsRecursive(
    content,
    baseDir,
    mergedOptions,
    visited,
    0,
    importedFiles,
    errors
  );

  return {
    content: resolvedContent,
    importedFiles,
    errors,
  };
}

/**
 * Check if content has any @import directives
 */
export function hasImports(content: string): boolean {
  IMPORT_REGEX.lastIndex = 0;
  return IMPORT_REGEX.test(content);
}

/**
 * Extract import paths without resolving them
 */
export function extractImportPaths(content: string): string[] {
  const imports = findImports(content);
  return imports.map(i => i.path);
}
