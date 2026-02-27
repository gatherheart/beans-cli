/**
 * Policy Engine Types
 *
 * Configuration-based tool approval rules with multiple modes
 */

import type { ToolConfirmation } from "../tools/types.js";

/**
 * Approval modes for tool execution
 *
 * - DEFAULT: Ask for confirmation based on tool type (read=auto, write/execute=ask)
 * - AUTO_EDIT: Auto-approve file edits, ask for shell commands
 * - PLAN: Read-only mode, block all write/execute operations
 * - YOLO: Auto-approve everything (dangerous)
 */
export type ApprovalMode = "DEFAULT" | "AUTO_EDIT" | "PLAN" | "YOLO";

/**
 * Tool policy definition
 */
export interface ToolPolicy {
  /** Tool name or pattern (supports wildcards: 'read_*', '*') */
  name: string;
  /** Whether the tool is allowed to execute */
  allowed: boolean;
  /** Whether to auto-approve without asking user */
  autoApprove?: boolean;
  /** Custom message to show when blocked */
  blockMessage?: string;
}

/**
 * Policy decision result
 */
export interface PolicyDecision {
  /** Whether the tool is allowed to execute */
  allowed: boolean;
  /** Whether user confirmation is required */
  requiresApproval: boolean;
  /** Reason for the decision */
  reason?: string;
}

/**
 * Policy configuration
 */
export interface PolicyConfig {
  /** Current approval mode */
  mode: ApprovalMode;
  /** Custom tool policies (override defaults) */
  toolPolicies?: ToolPolicy[];
  /** Whether to show blocked tool messages to user */
  showBlockedMessages?: boolean;
}

/**
 * Context for policy evaluation
 */
export interface PolicyContext {
  /** Name of the tool being evaluated */
  toolName: string;
  /** Tool's confirmation requirements */
  confirmation?: ToolConfirmation;
  /** Tool parameters (for advanced policy rules) */
  params?: Record<string, unknown>;
}

/**
 * Events emitted by the policy engine
 */
export type PolicyEvent =
  | { type: "policy_check"; context: PolicyContext; decision: PolicyDecision }
  | { type: "tool_blocked"; toolName: string; reason: string }
  | { type: "approval_required"; toolName: string; message: string }
  | { type: "auto_approved"; toolName: string };
