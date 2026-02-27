/**
 * Policy Engine
 *
 * Evaluates tool execution requests against configured policies
 */

import type {
  PolicyConfig,
  PolicyContext,
  PolicyDecision,
  ToolPolicy,
  PolicyEvent,
  ApprovalMode,
} from "./types.js";
import { getDefaultPolicies, DEFAULT_POLICY_CONFIG } from "./defaults.js";

/**
 * Policy engine for evaluating tool execution permissions
 */
export class PolicyEngine {
  private config: PolicyConfig;
  private eventListeners: Set<(event: PolicyEvent) => void> = new Set();

  constructor(config: Partial<PolicyConfig> = {}) {
    this.config = { ...DEFAULT_POLICY_CONFIG, ...config };
  }

  /**
   * Get the current approval mode
   */
  getMode(): ApprovalMode {
    return this.config.mode;
  }

  /**
   * Set the approval mode
   */
  setMode(mode: ApprovalMode): void {
    this.config.mode = mode;
  }

  /**
   * Add a custom tool policy
   */
  addPolicy(policy: ToolPolicy): void {
    if (!this.config.toolPolicies) {
      this.config.toolPolicies = [];
    }
    // Remove existing policy with same name
    this.config.toolPolicies = this.config.toolPolicies.filter(
      (p) => p.name !== policy.name,
    );
    this.config.toolPolicies.push(policy);
  }

  /**
   * Remove a custom tool policy
   */
  removePolicy(toolName: string): void {
    if (this.config.toolPolicies) {
      this.config.toolPolicies = this.config.toolPolicies.filter(
        (p) => p.name !== toolName,
      );
    }
  }

  /**
   * Evaluate a tool execution request
   */
  evaluate(context: PolicyContext): PolicyDecision {
    const { toolName, confirmation } = context;

    // Get applicable policies (custom first, then defaults)
    const customPolicy = this.findPolicy(
      toolName,
      this.config.toolPolicies || [],
    );
    const defaultPolicies = getDefaultPolicies(this.config.mode);
    const defaultPolicy = this.findPolicy(toolName, defaultPolicies);

    // Custom policies override defaults
    const policy = customPolicy || defaultPolicy;

    let decision: PolicyDecision;

    if (!policy) {
      // No policy found - use confirmation info or default to require approval
      decision = this.evaluateByConfirmation(confirmation);
    } else if (!policy.allowed) {
      // Tool is blocked
      decision = {
        allowed: false,
        requiresApproval: false,
        reason:
          policy.blockMessage ||
          `Tool '${toolName}' is blocked in ${this.config.mode} mode`,
      };
    } else if (policy.autoApprove) {
      // Tool is auto-approved
      decision = {
        allowed: true,
        requiresApproval: false,
        reason: "Auto-approved by policy",
      };
    } else {
      // Tool requires approval
      decision = {
        allowed: true,
        requiresApproval: true,
        reason: confirmation?.message || `Approve ${toolName}?`,
      };
    }

    // Emit event
    this.emit({ type: "policy_check", context, decision });

    // Emit specific events based on decision
    if (!decision.allowed) {
      this.emit({
        type: "tool_blocked",
        toolName,
        reason: decision.reason || "Blocked by policy",
      });
    } else if (decision.requiresApproval) {
      this.emit({
        type: "approval_required",
        toolName,
        message: decision.reason || `Approve ${toolName}?`,
      });
    } else {
      this.emit({ type: "auto_approved", toolName });
    }

    return decision;
  }

  /**
   * Check if a tool is allowed (without emitting events)
   */
  isToolAllowed(toolName: string): boolean {
    const customPolicy = this.findPolicy(
      toolName,
      this.config.toolPolicies || [],
    );
    const defaultPolicies = getDefaultPolicies(this.config.mode);
    const defaultPolicy = this.findPolicy(toolName, defaultPolicies);
    const policy = customPolicy || defaultPolicy;

    return policy ? policy.allowed : true;
  }

  /**
   * Check if a tool will be auto-approved
   */
  isToolAutoApproved(toolName: string): boolean {
    const customPolicy = this.findPolicy(
      toolName,
      this.config.toolPolicies || [],
    );
    const defaultPolicies = getDefaultPolicies(this.config.mode);
    const defaultPolicy = this.findPolicy(toolName, defaultPolicies);
    const policy = customPolicy || defaultPolicy;

    return policy?.autoApprove ?? false;
  }

  /**
   * Subscribe to policy events
   */
  on(listener: (event: PolicyEvent) => void): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  /**
   * Get the current configuration
   */
  getConfig(): PolicyConfig {
    return { ...this.config };
  }

  /**
   * Find a matching policy for a tool name
   * Supports exact matches and wildcard patterns
   */
  private findPolicy(
    toolName: string,
    policies: ToolPolicy[],
  ): ToolPolicy | undefined {
    // First try exact match
    const exactMatch = policies.find((p) => p.name === toolName);
    if (exactMatch) return exactMatch;

    // Then try prefix wildcard (e.g., 'read_*')
    const prefixMatch = policies.find((p) => {
      if (p.name.endsWith("*")) {
        const prefix = p.name.slice(0, -1);
        return toolName.startsWith(prefix);
      }
      return false;
    });
    if (prefixMatch) return prefixMatch;

    // Finally try global wildcard
    const globalMatch = policies.find((p) => p.name === "*");
    return globalMatch;
  }

  /**
   * Evaluate based on tool confirmation info when no policy exists
   */
  private evaluateByConfirmation(confirmation?: {
    required: boolean;
    type?: string;
  }): PolicyDecision {
    if (!confirmation) {
      // No confirmation info - default to require approval
      return {
        allowed: true,
        requiresApproval: true,
        reason: "No policy defined, requiring approval",
      };
    }

    if (confirmation.type === "read") {
      // Read operations are generally safe
      return {
        allowed: true,
        requiresApproval: false,
        reason: "Read operation auto-approved",
      };
    }

    if (confirmation.type === "destructive") {
      // Destructive operations always require approval
      return {
        allowed: true,
        requiresApproval: true,
        reason: "Destructive operation requires approval",
      };
    }

    // Default to requiring approval if confirmation says so
    return {
      allowed: true,
      requiresApproval: confirmation.required,
      reason: confirmation.required
        ? "Tool requires approval"
        : "Auto-approved",
    };
  }

  /**
   * Emit an event to all listeners
   */
  private emit(event: PolicyEvent): void {
    for (const listener of this.eventListeners) {
      try {
        listener(event);
      } catch {
        // Ignore listener errors
      }
    }
  }
}

/**
 * Create a policy engine with the given configuration
 */
export function createPolicyEngine(
  config?: Partial<PolicyConfig>,
): PolicyEngine {
  return new PolicyEngine(config);
}
