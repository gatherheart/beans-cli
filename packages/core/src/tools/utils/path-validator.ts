/**
 * Path Validation Utility
 *
 * Prevents path traversal attacks by ensuring file operations
 * stay within allowed boundaries.
 */

import * as path from "path";
import * as fs from "fs/promises";
import { homedir } from "os";

/**
 * Sensitive paths that should never be accessed
 */
const SENSITIVE_PATHS = [
  // SSH keys
  ".ssh",
  // AWS credentials
  ".aws",
  // GCP credentials
  ".config/gcloud",
  // Azure credentials
  ".azure",
  // NPM tokens
  ".npmrc",
  // Docker config (may contain registry creds)
  ".docker/config.json",
  // Git credentials
  ".git-credentials",
  ".gitconfig",
  // Shell history (may contain secrets)
  ".bash_history",
  ".zsh_history",
  // Environment files in home
  ".env",
  ".envrc",
];

/**
 * System paths that should be blocked
 */
const BLOCKED_SYSTEM_PATHS = [
  "/etc/passwd",
  "/etc/shadow",
  "/etc/sudoers",
  "/etc/ssh",
  "/proc",
  "/sys",
  "/dev",
];

export interface PathValidationResult {
  valid: boolean;
  resolvedPath: string;
  error?: string;
}

export interface PathValidationOptions {
  /** Working directory (project root) */
  cwd: string;
  /** Allow reading files outside project directory */
  allowOutsideProject?: boolean;
  /** Allow accessing home directory files */
  allowHomeAccess?: boolean;
  /** Allow absolute paths */
  allowAbsolutePaths?: boolean;
}

/**
 * Validate and resolve a file path, preventing path traversal attacks
 */
export async function validatePath(
  inputPath: string,
  options: PathValidationOptions,
): Promise<PathValidationResult> {
  const {
    cwd,
    allowOutsideProject = false,
    allowHomeAccess = false,
    allowAbsolutePaths = true,
  } = options;

  // Expand ~ to home directory
  let expandedPath = inputPath;
  if (inputPath.startsWith("~/")) {
    if (!allowHomeAccess) {
      return {
        valid: false,
        resolvedPath: "",
        error: "Access to home directory files is not allowed",
      };
    }
    expandedPath = path.join(homedir(), inputPath.slice(2));
  } else if (inputPath === "~") {
    return {
      valid: false,
      resolvedPath: "",
      error: "Cannot access home directory root",
    };
  }

  // Resolve to absolute path
  const resolvedPath = path.isAbsolute(expandedPath)
    ? path.normalize(expandedPath)
    : path.resolve(cwd, expandedPath);

  // Check for blocked system paths
  for (const blockedPath of BLOCKED_SYSTEM_PATHS) {
    if (resolvedPath.startsWith(blockedPath)) {
      return {
        valid: false,
        resolvedPath,
        error: `Access to system path '${blockedPath}' is blocked`,
      };
    }
  }

  // Check for sensitive paths in home directory
  const home = homedir();
  if (resolvedPath.startsWith(home)) {
    const relativePath = path.relative(home, resolvedPath);
    for (const sensitive of SENSITIVE_PATHS) {
      if (
        relativePath === sensitive ||
        relativePath.startsWith(sensitive + path.sep)
      ) {
        return {
          valid: false,
          resolvedPath,
          error: `Access to sensitive path '~/${sensitive}' is blocked`,
        };
      }
    }
  }

  // Check if path escapes project directory
  if (!allowOutsideProject) {
    const normalizedCwd = path.normalize(cwd);
    if (
      !resolvedPath.startsWith(normalizedCwd + path.sep) &&
      resolvedPath !== normalizedCwd
    ) {
      // Allow if it's within common parent directories (for monorepos)
      // But block if it goes above the workspace entirely
      const relativePath = path.relative(normalizedCwd, resolvedPath);
      const parentTraversals = relativePath
        .split(path.sep)
        .filter((p) => p === "..").length;

      // Allow up to 2 levels of parent traversal for monorepo support
      if (parentTraversals > 2) {
        return {
          valid: false,
          resolvedPath,
          error: `Path '${inputPath}' escapes project directory boundaries`,
        };
      }
    }
  }

  // Check for absolute paths if not allowed
  if (
    !allowAbsolutePaths &&
    path.isAbsolute(inputPath) &&
    !inputPath.startsWith("~")
  ) {
    return {
      valid: false,
      resolvedPath,
      error: "Absolute paths are not allowed",
    };
  }

  // Check for symlink attacks - resolve symlinks and re-validate
  try {
    const realPath = await fs.realpath(resolvedPath).catch(() => resolvedPath);
    if (realPath !== resolvedPath) {
      // Path contains symlinks - re-validate the real path
      const symlinkResult = await validatePath(realPath, {
        ...options,
        allowAbsolutePaths: true, // Real path will be absolute
      });
      if (!symlinkResult.valid) {
        return {
          valid: false,
          resolvedPath,
          error: `Symlink resolves to blocked path: ${symlinkResult.error}`,
        };
      }
    }
  } catch {
    // File doesn't exist yet - that's OK for write operations
  }

  return {
    valid: true,
    resolvedPath,
  };
}

/**
 * Quick check if a path looks suspicious (without full validation)
 */
export function isSuspiciousPath(inputPath: string): boolean {
  const suspicious = [
    /\.\.[/\\]/, // Parent directory traversal
    /^[/\\]etc[/\\]/, // /etc access
    /^[/\\]proc[/\\]/, // /proc access
    /^[/\\]sys[/\\]/, // /sys access
    /^[/\\]dev[/\\]/, // /dev access
    /\.ssh[/\\]/, // SSH directory
    /\.aws[/\\]/, // AWS credentials
    /\.env$/, // Environment files
    /id_rsa/, // SSH keys
    /credentials/i, // Credential files
  ];

  return suspicious.some((pattern) => pattern.test(inputPath));
}
