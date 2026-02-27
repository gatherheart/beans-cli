/**
 * Error Classification System
 *
 * Categorizes LLM errors to determine appropriate retry/fallback behavior.
 */

/**
 * Categories of errors that can occur during LLM calls
 */
export type ErrorCategory =
  | "quota_exceeded"
  | "rate_limit"
  | "server_error"
  | "network_error"
  | "invalid_request"
  | "auth_error"
  | "unknown";

/**
 * Classified error with metadata
 */
export interface ClassifiedError {
  /** Original error */
  error: Error;
  /** Classified category */
  category: ErrorCategory;
  /** Whether this error is retryable */
  retryable: boolean;
  /** Whether to try a fallback model */
  shouldFallback: boolean;
  /** Suggested retry delay in milliseconds */
  retryDelayMs?: number;
}

/**
 * Patterns for classifying errors by message content
 */
const ERROR_PATTERNS: Array<{
  patterns: RegExp[];
  category: ErrorCategory;
  retryable: boolean;
  shouldFallback: boolean;
  retryDelayMs?: number;
}> = [
  {
    patterns: [
      /quota/i,
      /limit exceeded/i,
      /resource.*exhausted/i,
      /insufficient.*quota/i,
    ],
    category: "quota_exceeded",
    retryable: false,
    shouldFallback: true,
  },
  {
    patterns: [/rate.?limit/i, /too many requests/i, /429/, /throttl/i],
    category: "rate_limit",
    retryable: true,
    shouldFallback: true,
    retryDelayMs: 1000,
  },
  {
    patterns: [
      /500/,
      /502/,
      /503/,
      /504/,
      /internal.*error/i,
      /server.*error/i,
      /service.*unavailable/i,
      /temporarily.*unavailable/i,
    ],
    category: "server_error",
    retryable: true,
    shouldFallback: true,
    retryDelayMs: 2000,
  },
  {
    patterns: [
      /network/i,
      /econnrefused/i,
      /enotfound/i,
      /etimedout/i,
      /socket/i,
      /connection.*refused/i,
      /failed.*fetch/i,
    ],
    category: "network_error",
    retryable: true,
    shouldFallback: false,
    retryDelayMs: 1000,
  },
  {
    patterns: [
      /invalid.*request/i,
      /bad.*request/i,
      /400/,
      /malformed/i,
      /validation.*failed/i,
    ],
    category: "invalid_request",
    retryable: false,
    shouldFallback: false,
  },
  {
    patterns: [
      /401/,
      /403/,
      /unauthorized/i,
      /forbidden/i,
      /invalid.*key/i,
      /api.*key/i,
      /authentication/i,
    ],
    category: "auth_error",
    retryable: false,
    shouldFallback: false,
  },
];

/**
 * Classify an error into a category with retry/fallback metadata
 */
export function classifyError(error: Error): ClassifiedError {
  const message = error.message || "";
  const errorString = error.toString();
  const combinedText = `${message} ${errorString}`;

  for (const {
    patterns,
    category,
    retryable,
    shouldFallback,
    retryDelayMs,
  } of ERROR_PATTERNS) {
    for (const pattern of patterns) {
      if (pattern.test(combinedText)) {
        return {
          error,
          category,
          retryable,
          shouldFallback,
          retryDelayMs,
        };
      }
    }
  }

  // Default to unknown error
  return {
    error,
    category: "unknown",
    retryable: false,
    shouldFallback: false,
  };
}

/**
 * Check if an error category should trigger fallback
 */
export function shouldTriggerFallback(
  category: ErrorCategory,
  fallbackCategories: ErrorCategory[],
): boolean {
  return fallbackCategories.includes(category);
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoff(
  attempt: number,
  baseDelayMs: number = 1000,
  maxDelayMs: number = 30000,
): number {
  const delay = baseDelayMs * Math.pow(2, attempt - 1);
  const jitter = Math.random() * 0.1 * delay;
  return Math.min(delay + jitter, maxDelayMs);
}
