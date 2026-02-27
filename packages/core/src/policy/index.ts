/**
 * Policy Engine Module
 *
 * Configuration-based tool approval rules with multiple modes:
 * - DEFAULT: Ask for confirmation based on tool type
 * - AUTO_EDIT: Auto-approve file edits, ask for shell commands
 * - PLAN: Read-only mode, block all write/execute operations
 * - YOLO: Auto-approve everything (dangerous)
 */

export * from "./types.js";
export * from "./defaults.js";
export { PolicyEngine, createPolicyEngine } from "./engine.js";
