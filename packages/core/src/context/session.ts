import { randomUUID } from 'crypto';
import type { SessionContext, ConversationTurn, TurnToolCall } from './types.js';

/**
 * Session manager - tracks the current agent session
 */
export class SessionManager {
  private session: SessionContext;
  private turns: ConversationTurn[] = [];

  constructor() {
    this.session = {
      sessionId: randomUUID(),
      startedAt: new Date(),
      turnCount: 0,
      totalTokens: 0,
      modifiedFiles: [],
      commandsExecuted: 0,
    };
  }

  /**
   * Get current session context
   */
  getSession(): SessionContext {
    return { ...this.session };
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.session.sessionId;
  }

  /**
   * Record a new turn
   */
  recordTurn(turn: Omit<ConversationTurn, 'turnNumber' | 'timestamp'>): void {
    this.session.turnCount++;

    const fullTurn: ConversationTurn = {
      ...turn,
      turnNumber: this.session.turnCount,
      timestamp: new Date(),
    };

    this.turns.push(fullTurn);

    // Update session stats
    this.session.totalTokens += turn.tokens.prompt + turn.tokens.completion;

    // Track tool calls
    for (const toolCall of turn.toolCalls) {
      if (toolCall.name === 'shell') {
        this.session.commandsExecuted++;
      }
      if (toolCall.name === 'write_file' && toolCall.success) {
        const filePath = toolCall.parameters.path as string;
        if (!this.session.modifiedFiles.includes(filePath)) {
          this.session.modifiedFiles.push(filePath);
        }
      }
    }
  }

  /**
   * Get all turns in this session
   */
  getTurns(): ConversationTurn[] {
    return [...this.turns];
  }

  /**
   * Get the last N turns
   */
  getRecentTurns(count: number): ConversationTurn[] {
    return this.turns.slice(-count);
  }

  /**
   * Get session duration in milliseconds
   */
  getDuration(): number {
    return Date.now() - this.session.startedAt.getTime();
  }

  /**
   * Get session metrics summary
   */
  getMetrics(): SessionMetrics {
    const duration = this.getDuration();
    const successfulToolCalls = this.turns.reduce(
      (sum, turn) => sum + turn.toolCalls.filter((tc) => tc.success).length,
      0
    );
    const failedToolCalls = this.turns.reduce(
      (sum, turn) => sum + turn.toolCalls.filter((tc) => !tc.success).length,
      0
    );

    return {
      sessionId: this.session.sessionId,
      durationMs: duration,
      turnCount: this.session.turnCount,
      totalTokens: this.session.totalTokens,
      averageTokensPerTurn:
        this.session.turnCount > 0
          ? Math.round(this.session.totalTokens / this.session.turnCount)
          : 0,
      filesModified: this.session.modifiedFiles.length,
      commandsExecuted: this.session.commandsExecuted,
      successfulToolCalls,
      failedToolCalls,
      toolCallSuccessRate:
        successfulToolCalls + failedToolCalls > 0
          ? successfulToolCalls / (successfulToolCalls + failedToolCalls)
          : 1,
    };
  }

  /**
   * Export session for saving/resuming
   */
  export(): SessionExport {
    return {
      session: this.session,
      turns: this.turns,
    };
  }

  /**
   * Import a previous session
   */
  static import(data: SessionExport): SessionManager {
    const manager = new SessionManager();
    manager.session = {
      ...data.session,
      startedAt: new Date(data.session.startedAt),
    };
    manager.turns = data.turns.map((turn) => ({
      ...turn,
      timestamp: new Date(turn.timestamp),
    }));
    return manager;
  }
}

/**
 * Session metrics summary
 */
export interface SessionMetrics {
  sessionId: string;
  durationMs: number;
  turnCount: number;
  totalTokens: number;
  averageTokensPerTurn: number;
  filesModified: number;
  commandsExecuted: number;
  successfulToolCalls: number;
  failedToolCalls: number;
  toolCallSuccessRate: number;
}

/**
 * Session export format for persistence
 */
export interface SessionExport {
  session: SessionContext;
  turns: ConversationTurn[];
}
