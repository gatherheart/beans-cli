/**
 * Loop Detection System
 *
 * Detects and prevents infinite tool call cycles in agent execution.
 * Uses a sliding window algorithm to identify repeating patterns.
 */

import type { ToolCall } from "./types.js";

/**
 * Configuration for loop detection
 */
export interface LoopDetectorConfig {
  /** Whether loop detection is enabled */
  enabled: boolean;
  /** Minimum sequence length to consider as a loop */
  minSequenceLength: number;
  /** Number of repetitions before emitting a warning */
  warningThreshold: number;
  /** Number of repetitions before stopping execution */
  stopThreshold: number;
  /** Maximum number of tool calls to keep in history */
  maxHistorySize: number;
}

/**
 * Result from loop detection check
 */
export interface LoopDetectionResult {
  /** Whether a loop was detected */
  isLoop: boolean;
  /** Whether execution should stop */
  shouldStop: boolean;
  /** Whether a warning should be emitted */
  shouldWarn: boolean;
  /** The detected repeating pattern (tool names) */
  pattern?: string[];
  /** Number of times the pattern has repeated */
  repetitions?: number;
  /** Suggestion for breaking the loop */
  suggestion?: string;
}

/**
 * Tracked tool call for history
 */
interface TrackedCall {
  /** Tool name */
  name: string;
  /** Hash of arguments */
  argsHash: string;
  /** Turn number when called */
  turn: number;
}

/**
 * Default loop detector configuration
 */
export const DEFAULT_LOOP_CONFIG: LoopDetectorConfig = {
  enabled: true,
  minSequenceLength: 2,
  warningThreshold: 2,
  stopThreshold: 3,
  maxHistorySize: 50,
};

/**
 * Loop detector for agent execution
 */
export class LoopDetector {
  private config: LoopDetectorConfig;
  private history: TrackedCall[] = [];
  private warningEmitted = false;

  constructor(config: Partial<LoopDetectorConfig> = {}) {
    this.config = { ...DEFAULT_LOOP_CONFIG, ...config };
  }

  /**
   * Reset the detector state
   */
  reset(): void {
    this.history = [];
    this.warningEmitted = false;
  }

  /**
   * Record a tool call and check for loops
   */
  check(toolCall: ToolCall, turn: number): LoopDetectionResult {
    if (!this.config.enabled) {
      return { isLoop: false, shouldStop: false, shouldWarn: false };
    }

    // Add to history
    const argsHash = this.hashArgs(toolCall.arguments);
    this.history.push({
      name: toolCall.name,
      argsHash,
      turn,
    });

    // Trim history if needed
    if (this.history.length > this.config.maxHistorySize) {
      this.history = this.history.slice(-this.config.maxHistorySize);
    }

    // Check for repeating patterns
    const detection = this.detectPattern();

    if (detection.isLoop) {
      const shouldWarn =
        detection.repetitions! >= this.config.warningThreshold &&
        !this.warningEmitted;
      const shouldStop = detection.repetitions! >= this.config.stopThreshold;

      if (shouldWarn) {
        this.warningEmitted = true;
      }

      return {
        isLoop: true,
        shouldStop,
        shouldWarn,
        pattern: detection.pattern,
        repetitions: detection.repetitions,
        suggestion: this.generateSuggestion(detection.pattern!),
      };
    }

    return { isLoop: false, shouldStop: false, shouldWarn: false };
  }

  /**
   * Get the current tool call history
   */
  getHistory(): TrackedCall[] {
    return [...this.history];
  }

  /**
   * Detect repeating patterns in the history
   */
  private detectPattern(): {
    isLoop: boolean;
    pattern?: string[];
    repetitions?: number;
  } {
    const history = this.history;
    const len = history.length;

    // First check for exact repeated calls (same tool + same args)
    // This can work with just 2 calls
    const exactResult = this.checkExactRepeats();
    if (exactResult.isLoop) {
      return exactResult;
    }

    if (len < this.config.minSequenceLength * 2) {
      return { isLoop: false };
    }

    // Try different pattern lengths, starting from smallest
    for (
      let patternLen = this.config.minSequenceLength;
      patternLen <= len / 2;
      patternLen++
    ) {
      const result = this.checkPatternLength(patternLen);
      if (
        result.isLoop &&
        result.repetitions! >= this.config.warningThreshold
      ) {
        return result;
      }
    }

    return { isLoop: false };
  }

  /**
   * Check for a pattern of specific length
   */
  private checkPatternLength(patternLen: number): {
    isLoop: boolean;
    pattern?: string[];
    repetitions?: number;
  } {
    const history = this.history;
    const len = history.length;

    // Get the most recent pattern
    const pattern = history.slice(-patternLen);

    // Count how many times this pattern appears consecutively at the end
    let repetitions = 1;
    let pos = len - patternLen * 2;

    while (pos >= 0) {
      const segment = history.slice(pos, pos + patternLen);
      if (this.patternsMatch(segment, pattern)) {
        repetitions++;
        pos -= patternLen;
      } else {
        break;
      }
    }

    if (repetitions >= this.config.warningThreshold) {
      return {
        isLoop: true,
        pattern: pattern.map((t) => `${t.name}(${t.argsHash.slice(0, 8)})`),
        repetitions,
      };
    }

    return { isLoop: false };
  }

  /**
   * Check for exact repeated calls (same tool with same args)
   */
  private checkExactRepeats(): {
    isLoop: boolean;
    pattern?: string[];
    repetitions?: number;
  } {
    if (this.history.length < this.config.warningThreshold) {
      return { isLoop: false };
    }

    // Get the most recent call
    const last = this.history[this.history.length - 1];

    // Count consecutive exact repeats from the end
    let repetitions = 1;
    for (let i = this.history.length - 2; i >= 0; i--) {
      const call = this.history[i];
      if (call.name === last.name && call.argsHash === last.argsHash) {
        repetitions++;
      } else {
        break;
      }
    }

    if (repetitions >= this.config.warningThreshold) {
      return {
        isLoop: true,
        pattern: [`${last.name}(${last.argsHash.slice(0, 8)})`],
        repetitions,
      };
    }

    return { isLoop: false };
  }

  /**
   * Check if two patterns match (by tool name and args hash)
   */
  private patternsMatch(a: TrackedCall[], b: TrackedCall[]): boolean {
    if (a.length !== b.length) return false;
    return a.every(
      (call, i) => call.name === b[i].name && call.argsHash === b[i].argsHash,
    );
  }

  /**
   * Hash tool call arguments for comparison
   */
  private hashArgs(args: Record<string, unknown>): string {
    // Simple hash using JSON stringification
    const str = JSON.stringify(args, Object.keys(args).sort());
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash.toString(16);
  }

  /**
   * Generate a suggestion for breaking the loop
   */
  private generateSuggestion(pattern: string[]): string {
    const toolNames = pattern.map((p) => p.split("(")[0]);
    const uniqueTools = [...new Set(toolNames)];

    if (uniqueTools.length === 1) {
      return (
        `The agent is repeatedly calling '${uniqueTools[0]}' with the same arguments. ` +
        `Consider providing more specific guidance or changing the approach.`
      );
    }

    return (
      `The agent is stuck in a loop calling: ${uniqueTools.join(" -> ")}. ` +
      `Consider breaking down the task differently or providing additional context.`
    );
  }
}

/**
 * Create a loop detector with the given configuration
 */
export function createLoopDetector(
  config?: Partial<LoopDetectorConfig>,
): LoopDetector {
  return new LoopDetector(config);
}
