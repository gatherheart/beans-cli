import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import type { WorkspaceContext, ProjectType, PackageManager } from './types.js';

const execAsync = promisify(exec);

/**
 * Detect workspace context from a directory
 */
export async function detectWorkspaceContext(
  rootPath: string
): Promise<WorkspaceContext> {
  const context: WorkspaceContext = {
    rootPath: path.resolve(rootPath),
    isGitRepo: false,
  };

  // Check for git repo
  const gitInfo = await detectGitInfo(rootPath);
  context.isGitRepo = gitInfo.isRepo;
  context.gitBranch = gitInfo.branch;

  // Detect project type and package manager
  const projectInfo = await detectProjectType(rootPath);
  context.projectType = projectInfo.type;
  context.packageManager = projectInfo.packageManager;
  context.primaryLanguage = projectInfo.language;

  return context;
}

/**
 * Detect git repository information
 */
async function detectGitInfo(
  rootPath: string
): Promise<{ isRepo: boolean; branch?: string }> {
  try {
    // Check if .git exists
    await fs.access(path.join(rootPath, '.git'));

    // Get current branch
    const { stdout } = await execAsync('git branch --show-current', {
      cwd: rootPath,
    });

    return {
      isRepo: true,
      branch: stdout.trim() || 'HEAD',
    };
  } catch {
    return { isRepo: false };
  }
}

/**
 * Detect project type from files
 */
async function detectProjectType(rootPath: string): Promise<{
  type: ProjectType;
  packageManager?: PackageManager;
  language?: string;
}> {
  const files = await fs.readdir(rootPath);

  // Node.js project
  if (files.includes('package.json')) {
    let packageManager: PackageManager = 'npm';
    if (files.includes('yarn.lock')) packageManager = 'yarn';
    if (files.includes('pnpm-lock.yaml')) packageManager = 'pnpm';

    return {
      type: 'nodejs',
      packageManager,
      language: files.some((f) => f.endsWith('.ts') || f === 'tsconfig.json')
        ? 'typescript'
        : 'javascript',
    };
  }

  // Python project
  if (
    files.includes('pyproject.toml') ||
    files.includes('setup.py') ||
    files.includes('requirements.txt')
  ) {
    return {
      type: 'python',
      packageManager: 'pip',
      language: 'python',
    };
  }

  // Rust project
  if (files.includes('Cargo.toml')) {
    return {
      type: 'rust',
      packageManager: 'cargo',
      language: 'rust',
    };
  }

  // Go project
  if (files.includes('go.mod')) {
    return {
      type: 'go',
      packageManager: 'go',
      language: 'go',
    };
  }

  // Java project
  if (files.includes('pom.xml')) {
    return {
      type: 'java',
      packageManager: 'maven',
      language: 'java',
    };
  }

  if (files.includes('build.gradle') || files.includes('build.gradle.kts')) {
    return {
      type: 'java',
      packageManager: 'gradle',
      language: files.includes('build.gradle.kts') ? 'kotlin' : 'java',
    };
  }

  // .NET project
  if (files.some((f) => f.endsWith('.csproj') || f.endsWith('.fsproj'))) {
    return {
      type: 'dotnet',
      language: files.some((f) => f.endsWith('.fsproj')) ? 'fsharp' : 'csharp',
    };
  }

  // Ruby project
  if (files.includes('Gemfile')) {
    return {
      type: 'ruby',
      language: 'ruby',
    };
  }

  return { type: 'unknown' };
}

/**
 * Create a workspace context service
 */
export class WorkspaceService {
  private context: WorkspaceContext | null = null;

  constructor(private rootPath: string) {}

  /**
   * Get or initialize workspace context
   */
  async getContext(): Promise<WorkspaceContext> {
    if (!this.context) {
      this.context = await detectWorkspaceContext(this.rootPath);
    }
    return this.context;
  }

  /**
   * Refresh workspace context
   */
  async refresh(): Promise<WorkspaceContext> {
    this.context = await detectWorkspaceContext(this.rootPath);
    return this.context;
  }

  /**
   * Get workspace root path
   */
  getRootPath(): string {
    return this.rootPath;
  }

  /**
   * Resolve a path relative to workspace root
   */
  resolvePath(relativePath: string): string {
    return path.resolve(this.rootPath, relativePath);
  }

  /**
   * Get path relative to workspace root
   */
  relativePath(absolutePath: string): string {
    return path.relative(this.rootPath, absolutePath);
  }
}
