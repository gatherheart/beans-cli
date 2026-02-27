/**
 * Default Policy Configurations
 *
 * Defines default tool policies for each approval mode
 */

import type { ApprovalMode, ToolPolicy, PolicyConfig } from "./types.js";

/**
 * Read-only tools that are safe to auto-approve
 */
export const READ_ONLY_TOOLS = [
  "read_file",
  "glob",
  "grep",
  "list_directory",
  "get_file_info",
];

/**
 * Write tools that modify files
 */
export const WRITE_TOOLS = [
  "write_file",
  "edit_file",
  "delete_file",
  "create_directory",
];

/**
 * Execute tools that run commands
 */
export const EXECUTE_TOOLS = ["shell", "spawn_agent"];

/**
 * Default policies for DEFAULT mode
 * - Read operations: auto-approve
 * - Write operations: require approval
 * - Execute operations: require approval
 */
export const DEFAULT_MODE_POLICIES: ToolPolicy[] = [
  ...READ_ONLY_TOOLS.map((name) => ({
    name,
    allowed: true,
    autoApprove: true,
  })),
  ...WRITE_TOOLS.map((name) => ({ name, allowed: true, autoApprove: false })),
  ...EXECUTE_TOOLS.map((name) => ({ name, allowed: true, autoApprove: false })),
];

/**
 * Default policies for AUTO_EDIT mode
 * - Read operations: auto-approve
 * - Write operations: auto-approve
 * - Shell commands: require approval
 */
export const AUTO_EDIT_MODE_POLICIES: ToolPolicy[] = [
  ...READ_ONLY_TOOLS.map((name) => ({
    name,
    allowed: true,
    autoApprove: true,
  })),
  ...WRITE_TOOLS.map((name) => ({ name, allowed: true, autoApprove: true })),
  { name: "shell", allowed: true, autoApprove: false },
  { name: "spawn_agent", allowed: true, autoApprove: true },
];

/**
 * Default policies for PLAN mode
 * - Read operations: auto-approve
 * - Write operations: blocked
 * - Execute operations: blocked
 */
export const PLAN_MODE_POLICIES: ToolPolicy[] = [
  ...READ_ONLY_TOOLS.map((name) => ({
    name,
    allowed: true,
    autoApprove: true,
  })),
  ...WRITE_TOOLS.map((name) => ({
    name,
    allowed: false,
    blockMessage:
      "BLOCKED: Plan Mode is active (read-only). Cannot write files. " +
      "Tell the user to exit Plan Mode with `/plan exit` or `/mode default` to enable writing.",
  })),
  ...EXECUTE_TOOLS.map((name) => ({
    name,
    allowed: false,
    blockMessage:
      "BLOCKED: Plan Mode is active (read-only). Cannot execute commands. " +
      "Tell the user to exit Plan Mode with `/plan exit` or `/mode default` to enable execution.",
  })),
];

/**
 * Default policies for YOLO mode
 * - Everything: auto-approve
 */
export const YOLO_MODE_POLICIES: ToolPolicy[] = [
  { name: "*", allowed: true, autoApprove: true },
];

/**
 * Get default policies for an approval mode
 */
export function getDefaultPolicies(mode: ApprovalMode): ToolPolicy[] {
  switch (mode) {
    case "DEFAULT":
      return DEFAULT_MODE_POLICIES;
    case "AUTO_EDIT":
      return AUTO_EDIT_MODE_POLICIES;
    case "PLAN":
      return PLAN_MODE_POLICIES;
    case "YOLO":
      return YOLO_MODE_POLICIES;
  }
}

/**
 * Default policy configuration
 */
export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  mode: "DEFAULT",
  toolPolicies: [],
  showBlockedMessages: true,
};
