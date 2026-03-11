/**
 * Custom hook for managing chat message history
 *
 * Encapsulates message state management following gemini-cli patterns:
 * - ID generation
 * - Message CRUD operations
 * - Streaming state updates
 */

import { useState, useCallback, useRef } from "react";
import type { ToolMetadata } from "@beans/core";

export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  argsSummary?: string;
  result?: string;
  resultSummary?: string;
  isComplete: boolean;
  metadata?: ToolMetadata;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  isStreaming: boolean;
  toolCalls?: ToolCallInfo[];
  agentType?: string;
  planningContent?: string;
  isPlanningComplete?: boolean;
  /** True when waiting for LLM response after tools complete */
  isThinking?: boolean;
}

export interface UseChatHistoryReturn {
  messages: Message[];
  addUserMessage: (content: string) => string;
  addAssistantMessage: (agentType?: string) => string;
  addSystemMessage: (content: string) => string;
  updateMessageContent: (id: string, content: string) => void;
  updateMessageToolCalls: (id: string, toolCalls: ToolCallInfo[]) => void;
  addToolCall: (id: string, toolCall: ToolCallInfo) => void;
  updateToolCall: (
    id: string,
    toolId: string,
    updates: Partial<ToolCallInfo>,
  ) => void;
  updateMessageAgentType: (id: string, agentType: string) => void;
  updatePlanningContent: (id: string, content: string) => void;
  completePlanning: (id: string) => void;
  setMessageThinking: (id: string, isThinking: boolean) => void;
  updateToolResultSummary: (
    id: string,
    toolId: string,
    resultSummary: string,
  ) => void;
  completeMessage: (id: string) => void;
  removeMessage: (id: string) => void;
  clearMessages: () => void;
}

export function useChatHistory(): UseChatHistoryReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const messageIdCounter = useRef(0);

  const generateId = useCallback((prefix: string): string => {
    messageIdCounter.current += 1;
    return `${prefix}-${Date.now()}-${messageIdCounter.current}`;
  }, []);

  const addUserMessage = useCallback(
    (content: string): string => {
      const id = generateId("user");
      setMessages((prev) => [
        ...prev,
        {
          id,
          role: "user",
          content: content.trim(),
          isStreaming: false,
        },
      ]);
      return id;
    },
    [generateId],
  );

  const addAssistantMessage = useCallback(
    (agentType?: string): string => {
      const id = generateId("assistant");
      setMessages((prev) => [
        ...prev,
        {
          id,
          role: "assistant",
          content: "",
          isStreaming: true,
          toolCalls: [],
          agentType,
        },
      ]);
      return id;
    },
    [generateId],
  );

  const addSystemMessage = useCallback(
    (content: string): string => {
      const id = generateId("system");
      setMessages((prev) => [
        ...prev,
        {
          id,
          role: "system",
          content,
          isStreaming: false,
        },
      ]);
      return id;
    },
    [generateId],
  );

  const updateMessageContent = useCallback((id: string, content: string) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, content } : msg)),
    );
  }, []);

  const updateMessageToolCalls = useCallback(
    (id: string, toolCalls: ToolCallInfo[]) => {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === id ? { ...msg, toolCalls: [...toolCalls] } : msg,
        ),
      );
    },
    [],
  );

  // Add a single tool call (more efficient than replacing entire array)
  const addToolCall = useCallback((id: string, toolCall: ToolCallInfo) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id
          ? { ...msg, toolCalls: [...(msg.toolCalls || []), toolCall] }
          : msg,
      ),
    );
  }, []);

  // Update a single tool call by toolId (more efficient)
  const updateToolCall = useCallback(
    (id: string, toolId: string, updates: Partial<ToolCallInfo>) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== id || !msg.toolCalls) return msg;
          const updatedTools = msg.toolCalls.map((tool) =>
            tool.id === toolId ? { ...tool, ...updates } : tool,
          );
          return { ...msg, toolCalls: updatedTools };
        }),
      );
    },
    [],
  );

  const updateMessageAgentType = useCallback(
    (id: string, agentType: string) => {
      setMessages((prev) =>
        prev.map((msg) => (msg.id === id ? { ...msg, agentType } : msg)),
      );
    },
    [],
  );

  const updatePlanningContent = useCallback((id: string, content: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? { ...msg, planningContent: content } : msg,
      ),
    );
  }, []);

  const completePlanning = useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? { ...msg, isPlanningComplete: true } : msg,
      ),
    );
  }, []);

  const setMessageThinking = useCallback((id: string, isThinking: boolean) => {
    setMessages((prev) =>
      prev.map((msg) => (msg.id === id ? { ...msg, isThinking } : msg)),
    );
  }, []);

  const updateToolResultSummary = useCallback(
    (id: string, toolId: string, resultSummary: string) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id !== id || !msg.toolCalls) return msg;
          const updatedToolCalls = msg.toolCalls.map((tool) =>
            tool.id === toolId ? { ...tool, resultSummary } : tool,
          );
          return { ...msg, toolCalls: updatedToolCalls };
        }),
      );
    },
    [],
  );

  const completeMessage = useCallback((id: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === id ? { ...msg, isStreaming: false, isThinking: false } : msg,
      ),
    );
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => prev.filter((msg) => msg.id !== id));
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    messageIdCounter.current = 0;
  }, []);

  return {
    messages,
    addUserMessage,
    addAssistantMessage,
    addSystemMessage,
    updateMessageContent,
    updateMessageToolCalls,
    addToolCall,
    updateToolCall,
    updateMessageAgentType,
    updatePlanningContent,
    completePlanning,
    setMessageThinking,
    updateToolResultSummary,
    completeMessage,
    removeMessage,
    clearMessages,
  };
}
