import { z } from "zod";
import { BaseTool } from "../base-tool.js";
import type {
  ToolExecutionResult,
  ToolExecutionOptions,
  ToolConfirmation,
} from "../types.js";
import { getAgentTypes } from "../../agents/multi-agent/specialized/index.js";

/**
 * Available agent types for spawning
 */
const AGENT_TYPES = [
  "explore",
  "plan",
  "bash",
  "coder",
  "general",
  "critic",
] as const;

/**
 * Tool policies for restricted agents
 */
const RESTRICTED_TOOL_SETS: Record<string, string[]> = {
  explore: ["glob", "grep", "read_file", "list_directory"],
  plan: ["glob", "grep", "read_file", "list_directory"],
  bash: ["shell", "glob", "grep", "read_file"],
  coder: ["read_file", "write_file", "glob", "grep", "shell", "list_directory"],
  general: [], // Uses all tools
  critic: ["read_file", "glob", "grep"],
};

const SpawnAgentSchema = z.object({
  agent_type: z
    .enum(AGENT_TYPES)
    .describe("The type of specialized agent to spawn"),
  task: z.string().describe("The task or prompt to give to the sub-agent"),
  max_turns: z
    .number()
    .optional()
    .default(10)
    .describe("Maximum turns for the sub-agent (default: 10)"),
  restrict_tools: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether to restrict tools based on agent type (default: true)"),
});

type SpawnAgentParams = z.infer<typeof SpawnAgentSchema>;

/**
 * Store for the agent manager - injected via context
 */
interface SpawnAgentContext {
  agentManager?: {
    spawn: (
      agentType: string,
      prompt: string,
      options?: {
        maxTurns?: number;
        cwd?: string;
      },
    ) => Promise<{
      success: boolean;
      content: string;
      error?: string;
      turnCount: number;
    }>;
  };
}

/**
 * Tool for spawning specialized sub-agents with restricted tool sets
 */
export class SpawnAgentTool extends BaseTool<SpawnAgentParams> {
  readonly name = "spawn_agent";
  readonly description = `Spawn a specialized sub-agent to handle a specific task. Use this when a task requires specialized expertise or when you want to delegate work to a focused agent.

Available agent types:
- **explore**: Codebase exploration - finding files, searching code, understanding structure
- **plan**: Planning and analysis - read-only, no write operations
- **bash**: Shell command execution specialist
- **coder**: Code writing and modification specialist
- **general**: General-purpose agent with all capabilities
- **critic**: Code review and analysis specialist

Each agent has access to a restricted set of tools appropriate for its specialty.`;
  readonly schema = SpawnAgentSchema;

  getConfirmation(params: SpawnAgentParams): ToolConfirmation {
    return {
      required: false, // Sub-agents don't need explicit confirmation
      type: "execute",
      message: `Spawn ${params.agent_type} agent: ${params.task.slice(0, 100)}...`,
    };
  }

  async execute(
    params: SpawnAgentParams,
    options?: ToolExecutionOptions,
  ): Promise<ToolExecutionResult> {
    const context = options?.context as SpawnAgentContext | undefined;

    // Check if agent manager is available
    if (!context?.agentManager) {
      return {
        content:
          "Agent manager not available. spawn_agent can only be used within a multi-agent context.",
        isError: true,
      };
    }

    // Validate agent type
    const availableTypes = getAgentTypes();
    if (!availableTypes.includes(params.agent_type)) {
      return {
        content: `Unknown agent type: ${params.agent_type}. Available types: ${availableTypes.join(", ")}`,
        isError: true,
      };
    }

    try {
      // Spawn the sub-agent
      const result = await context.agentManager.spawn(
        params.agent_type,
        params.task,
        {
          maxTurns: params.max_turns,
          cwd: options?.cwd,
        },
      );

      if (!result.success) {
        return {
          content: `Sub-agent failed: ${result.error || "Unknown error"}`,
          isError: true,
          metadata: {
            agentType: params.agent_type,
            turnCount: result.turnCount,
          },
        };
      }

      return {
        content: result.content || "(no output from sub-agent)",
        isError: false,
        metadata: {
          agentType: params.agent_type,
          turnCount: result.turnCount,
          restrictedTools: params.restrict_tools
            ? RESTRICTED_TOOL_SETS[params.agent_type]
            : undefined,
        },
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: `Failed to spawn sub-agent: ${errorMessage}`,
        isError: true,
      };
    }
  }
}

/**
 * Get the restricted tool set for an agent type
 */
export function getRestrictedTools(agentType: string): string[] | undefined {
  return RESTRICTED_TOOL_SETS[agentType];
}
