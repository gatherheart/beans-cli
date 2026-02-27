/**
 * Chat contexts for managing state across Ink components
 *
 * Following gemini-cli patterns:
 * - ChatStateContext: Read-only state (messages, loading, error, profile)
 * - ChatActionsContext: Action handlers (sendMessage, addSystemMessage, clearHistory)
 *
 * This separation prevents unnecessary re-renders:
 * - Components that only need actions won't re-render when messages change
 * - Components that only need state won't re-render when actions are recreated
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
} from "react";
import type { ReactNode } from "react";
import {
  Config,
  createAgentManager,
  clearTasks,
  inferProviderFromModel,
} from "@beans/core";
import type {
  AgentManager,
  MultiAgentEvent,
  Message as LLMMessage,
  AgentProfile,
  ApprovalMode,
} from "@beans/core";
import { useChatHistory } from "../hooks/useChatHistory.js";
import type { Message, ToolCallInfo } from "../hooks/useChatHistory.js";

// Re-export types for convenience
export type { Message, ToolCallInfo } from "../hooks/useChatHistory.js";

/**
 * Read-only state context
 */
interface ChatStateValue {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  profile: AgentProfile | null;
  currentAgent: string | null;
  approvalMode: ApprovalMode;
}

/**
 * Action handlers context
 */
interface ChatActionsValue {
  sendMessage: (content: string) => Promise<void>;
  addSystemMessage: (content: string) => void;
  clearHistory: () => void;
  getLLMHistory: () => LLMMessage[];
  getSystemPrompt: () => string;
  switchModel: (model: string) => Promise<void>;
  getCurrentModel: () => string;
  listModels: () => Promise<void>;
  setApprovalMode: (mode: ApprovalMode) => void;
  enterPlanMode: () => void;
  exitPlanMode: () => void;
}

const ChatStateContext = createContext<ChatStateValue | null>(null);
const ChatActionsContext = createContext<ChatActionsValue | null>(null);

export interface ChatProviderProps {
  children: ReactNode;
  config: Config;
  systemPrompt: string;
  profile?: AgentProfile;
  initialApprovalMode?: ApprovalMode;
}

export function ChatProvider({
  children,
  config,
  systemPrompt,
  profile,
  initialApprovalMode = "DEFAULT",
}: ChatProviderProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAgent, setCurrentAgent] = useState<string | null>(null);
  const [approvalMode, setApprovalModeState] =
    useState<ApprovalMode>(initialApprovalMode);

  // Use custom hook for message management
  const history = useChatHistory();

  // Track conversation history for getLLMHistory
  const conversationHistoryRef = useRef<LLMMessage[]>([]);

  const agentManagerRef = useRef<AgentManager | null>(null);

  // Initialize agent manager lazily
  const getAgentManager = useCallback(() => {
    if (!agentManagerRef.current) {
      agentManagerRef.current = createAgentManager(config, {
        cwd: process.cwd(),
      });
    }
    return agentManagerRef.current;
  }, [config]);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      // Add user message
      history.addUserMessage(content);

      // Track in conversation history (before sending so agent has context)
      const userMessage: LLMMessage = { role: "user", content };
      conversationHistoryRef.current.push(userMessage);

      // Add empty assistant message (will be filled via streaming)
      const assistantMessageId = history.addAssistantMessage();

      setIsLoading(true);
      setError(null);
      setCurrentAgent(null);

      try {
        const agentManager = getAgentManager();
        let currentContent = "";
        const toolCalls: ToolCallInfo[] = [];

        // Pass conversation history for context (exclude the current message since it's the query)
        const historyForContext = conversationHistoryRef.current.slice(0, -1);

        const result = await agentManager.processInput(content.trim(), {
          conversationHistory:
            historyForContext.length > 0 ? historyForContext : undefined,
          onActivity: (event: MultiAgentEvent) => {
            switch (event.type) {
              case "input_analysis_complete":
                // Show which agent is being used
                if (event.analysis.suggestedAgent) {
                  setCurrentAgent(event.analysis.suggestedAgent);
                }
                break;

              case "agent_spawn_start":
                setCurrentAgent(event.agentType);
                // Update the assistant message with the agent type
                history.updateMessageAgentType(
                  assistantMessageId,
                  event.agentType,
                );
                break;

              case "content_chunk":
                currentContent += event.content;
                history.updateMessageContent(
                  assistantMessageId,
                  currentContent,
                );
                break;

              case "tool_call_start": {
                // Create a unique ID for this tool call
                const toolId = `${event.agentType}_${event.toolName}_${Date.now()}`;
                toolCalls.push({
                  id: toolId,
                  name: event.toolName,
                  args: {},
                  isComplete: false,
                });
                history.updateMessageToolCalls(assistantMessageId, [
                  ...toolCalls,
                ]);
                break;
              }

              case "tool_call_end": {
                // Find and update the most recent incomplete tool call with matching name
                const toolIndex = toolCalls.findIndex(
                  (t) => !t.isComplete && t.name === event.toolName,
                );
                if (toolIndex !== -1) {
                  toolCalls[toolIndex] = {
                    ...toolCalls[toolIndex],
                    result:
                      event.result.length > 200
                        ? event.result.slice(0, 200) + "..."
                        : event.result,
                    isComplete: true,
                  };
                  history.updateMessageToolCalls(assistantMessageId, [
                    ...toolCalls,
                  ]);
                }
                break;
              }

              case "agent_spawn_complete":
                // Update content with final result if different
                if (
                  event.result.content &&
                  event.result.content !== currentContent
                ) {
                  currentContent = event.result.content;
                  history.updateMessageContent(
                    assistantMessageId,
                    currentContent,
                  );
                }
                break;

              case "error":
                setError(event.error.message);
                break;
            }
          },
        });

        // Track assistant response in conversation history
        conversationHistoryRef.current.push({
          role: "assistant",
          content: result.content,
        });

        // Mark streaming as complete
        history.completeMessage(assistantMessageId);
        setCurrentAgent(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        // Remove the empty assistant message on error
        history.removeMessage(assistantMessageId);
      } finally {
        setIsLoading(false);
        setCurrentAgent(null);
      }
    },
    [getAgentManager, history],
  );

  const addSystemMessage = useCallback(
    (content: string) => {
      history.addSystemMessage(content);
    },
    [history],
  );

  const clearHistory = useCallback(() => {
    // Clear UI messages
    history.clearMessages();
    // Clear conversation history
    conversationHistoryRef.current = [];
    // Clear task store
    clearTasks();
    // Clear error
    setError(null);
    // Note: AgentManager doesn't maintain history, so no need to clear it
  }, [history]);

  const getLLMHistory = useCallback((): LLMMessage[] => {
    return [...conversationHistoryRef.current];
  }, []);

  const getSystemPrompt = useCallback((): string => {
    return systemPrompt;
  }, [systemPrompt]);

  const getCurrentModel = useCallback((): string => {
    return config.getLLMConfig().model;
  }, [config]);

  const switchModel = useCallback(
    async (model: string): Promise<void> => {
      const provider = inferProviderFromModel(model);
      await config.updateConfig({
        llm: { ...config.getLLMConfig(), model, provider },
      });
      // Reset agent manager to use new model
      agentManagerRef.current = null;
      history.addSystemMessage(
        `Switched to model: **${model}** (provider: ${provider})`,
      );
    },
    [config, history],
  );

  const listModels = useCallback(async (): Promise<void> => {
    const llmClient = config.getLLMClient();
    if (llmClient.listModels) {
      try {
        const models = await llmClient.listModels();
        const currentModel = config.getLLMConfig().model;
        const modelList = models
          .map((m) => {
            const isCurrent = m.id === currentModel ? " ← current" : "";
            return `- **${m.id}**${isCurrent}${m.description ? ` - ${m.description}` : ""}`;
          })
          .join("\n");
        history.addSystemMessage(`## Available Models\n\n${modelList}`);
      } catch (err) {
        history.addSystemMessage(
          `Error listing models: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    } else {
      history.addSystemMessage(
        "Model listing is not supported for the current provider.",
      );
    }
  }, [config, history]);

  const setApprovalMode = useCallback(
    (mode: ApprovalMode): void => {
      setApprovalModeState(mode);
      // Update the policy engine
      const policyEngine = config.getPolicyEngine();
      policyEngine.setMode(mode);
      history.addSystemMessage(`Approval mode set to: **${mode}**`);
    },
    [config, history],
  );

  const enterPlanMode = useCallback((): void => {
    if (approvalMode === "PLAN") {
      history.addSystemMessage("Already in Plan mode.");
      return;
    }
    setApprovalMode("PLAN");
    history.addSystemMessage(
      "**Plan Mode enabled** - Read-only mode. Write and execute operations are blocked.\n\n" +
        "Allowed tools: `read_file`, `glob`, `grep`, `list_directory`\n\n" +
        "Use `/plan exit` to exit plan mode.",
    );
  }, [approvalMode, setApprovalMode, history]);

  const exitPlanMode = useCallback((): void => {
    if (approvalMode !== "PLAN") {
      history.addSystemMessage("Not in Plan mode.");
      return;
    }
    setApprovalMode("DEFAULT");
    history.addSystemMessage(
      "**Plan Mode disabled** - Write and execute operations are now allowed.",
    );
  }, [approvalMode, setApprovalMode, history]);

  // Memoize state value to prevent unnecessary re-renders
  const stateValue = useMemo<ChatStateValue>(
    () => ({
      messages: history.messages,
      isLoading,
      error,
      profile: profile || null,
      currentAgent,
      approvalMode,
    }),
    [history.messages, isLoading, error, profile, currentAgent, approvalMode],
  );

  // Memoize actions value to prevent unnecessary re-renders
  const actionsValue = useMemo<ChatActionsValue>(
    () => ({
      sendMessage,
      addSystemMessage,
      clearHistory,
      getLLMHistory,
      getSystemPrompt,
      switchModel,
      getCurrentModel,
      listModels,
      setApprovalMode,
      enterPlanMode,
      exitPlanMode,
    }),
    [
      sendMessage,
      addSystemMessage,
      clearHistory,
      getLLMHistory,
      getSystemPrompt,
      switchModel,
      getCurrentModel,
      listModels,
      setApprovalMode,
      enterPlanMode,
      exitPlanMode,
    ],
  );

  return (
    <ChatStateContext.Provider value={stateValue}>
      <ChatActionsContext.Provider value={actionsValue}>
        {children}
      </ChatActionsContext.Provider>
    </ChatStateContext.Provider>
  );
}

/**
 * Hook to access chat state (messages, loading, error, profile)
 */
export function useChatState(): ChatStateValue {
  const context = useContext(ChatStateContext);
  if (!context) {
    throw new Error("useChatState must be used within a ChatProvider");
  }
  return context;
}

/**
 * Hook to access chat actions (sendMessage, addSystemMessage, clearHistory)
 */
export function useChatActions(): ChatActionsValue {
  const context = useContext(ChatActionsContext);
  if (!context) {
    throw new Error("useChatActions must be used within a ChatProvider");
  }
  return context;
}

/**
 * Combined hook for components that need both state and actions
 * @deprecated Prefer using useChatState() and useChatActions() separately
 */
export function useChatContext(): ChatStateValue & ChatActionsValue {
  const state = useChatState();
  const actions = useChatActions();
  return { ...state, ...actions };
}
