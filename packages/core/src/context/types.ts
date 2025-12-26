/**
 * Workspace context - information about the current working environment
 */
export interface WorkspaceContext {
  /** Root directory of the workspace */
  rootPath: string;
  /** Whether this is a git repository */
  isGitRepo: boolean;
  /** Current git branch (if applicable) */
  gitBranch?: string;
  /** Detected project type */
  projectType?: ProjectType;
  /** Package manager in use */
  packageManager?: PackageManager;
  /** Main programming language */
  primaryLanguage?: string;
}

/**
 * Detected project type
 */
export type ProjectType =
  | 'nodejs'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'dotnet'
  | 'ruby'
  | 'unknown';

/**
 * Package manager type
 */
export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'pip' | 'cargo' | 'go' | 'maven' | 'gradle';

/**
 * Session context - information about the current agent session
 */
export interface SessionContext {
  /** Unique session ID */
  sessionId: string;
  /** Session start time */
  startedAt: Date;
  /** Number of turns in this session */
  turnCount: number;
  /** Total tokens used */
  totalTokens: number;
  /** Files modified in this session */
  modifiedFiles: string[];
  /** Commands executed */
  commandsExecuted: number;
}

/**
 * Conversation turn
 */
export interface ConversationTurn {
  /** Turn number */
  turnNumber: number;
  /** User message */
  userMessage: string;
  /** Assistant response */
  assistantResponse: string;
  /** Tool calls made */
  toolCalls: TurnToolCall[];
  /** Timestamp */
  timestamp: Date;
  /** Token usage */
  tokens: {
    prompt: number;
    completion: number;
  };
}

/**
 * Tool call within a turn
 */
export interface TurnToolCall {
  /** Tool name */
  name: string;
  /** Parameters used */
  parameters: Record<string, unknown>;
  /** Result content */
  result: string;
  /** Whether it succeeded */
  success: boolean;
  /** Execution duration in ms */
  durationMs: number;
}
