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

import React, { createContext, useContext, useState, useCallback, useRef, useMemo } from 'react';
import type { ReactNode } from 'react';
import { ChatSession, Config } from '@beans/core';
import type { AgentActivityEvent, Message as LLMMessage } from '@beans/core';
import type { AgentProfile } from '@beans/core';
import { useChatHistory } from '../hooks/useChatHistory.js';
import type { Message, ToolCallInfo } from '../hooks/useChatHistory.js';

// Re-export types for convenience
export type { Message, ToolCallInfo } from '../hooks/useChatHistory.js';

/**
 * Read-only state context
 */
interface ChatStateValue {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  profile: AgentProfile | null;
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
}

const ChatStateContext = createContext<ChatStateValue | null>(null);
const ChatActionsContext = createContext<ChatActionsValue | null>(null);

export interface ChatProviderProps {
  children: ReactNode;
  config: Config;
  systemPrompt: string;
  profile?: AgentProfile;
}

export function ChatProvider({ children, config, systemPrompt, profile }: ChatProviderProps): React.ReactElement {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use custom hook for message management
  const history = useChatHistory();

  const chatSessionRef = useRef<ChatSession | null>(null);

  // Initialize chat session lazily
  const getChatSession = useCallback(() => {
    if (!chatSessionRef.current) {
      chatSessionRef.current = new ChatSession(
        config.getLLMClient(),
        config.getToolRegistry(),
        {
          systemPrompt,
          modelConfig: config.getLLMConfig(),
          runConfig: config.getAgentConfig(),
          toolConfig: {
            allowAllTools: true,
          },
        }
      );
    }
    return chatSessionRef.current;
  }, [config, systemPrompt]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim()) return;

    // Add user message
    history.addUserMessage(content);

    // Add empty assistant message (will be filled via streaming)
    const assistantMessageId = history.addAssistantMessage();

    setIsLoading(true);
    setError(null);

    try {
      const session = getChatSession();
      let currentContent = '';
      const toolCalls: ToolCallInfo[] = [];

      await session.sendMessage(content.trim(), {
        onActivity: (event: AgentActivityEvent) => {
          switch (event.type) {
            case 'content_chunk':
              currentContent += event.content;
              history.updateMessageContent(assistantMessageId, currentContent);
              break;

            case 'tool_call_start':
              toolCalls.push({
                id: event.toolCall.id,
                name: event.toolCall.name,
                args: event.toolCall.arguments,
                isComplete: false,
              });
              history.updateMessageToolCalls(assistantMessageId, toolCalls);
              break;

            case 'tool_call_end': {
              const toolIndex = toolCalls.findIndex(t => t.id === event.toolCallId);
              if (toolIndex !== -1) {
                toolCalls[toolIndex] = {
                  ...toolCalls[toolIndex],
                  result: event.result.length > 200
                    ? event.result.slice(0, 200) + '...'
                    : event.result,
                  isComplete: true,
                };
                history.updateMessageToolCalls(assistantMessageId, toolCalls);
              }
              break;
            }

            case 'error':
              setError(event.error.message);
              break;
          }
        },
      });

      // Mark streaming as complete
      history.completeMessage(assistantMessageId);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      // Remove the empty assistant message on error
      history.removeMessage(assistantMessageId);
    } finally {
      setIsLoading(false);
    }
  }, [getChatSession, history]);

  const addSystemMessage = useCallback((content: string) => {
    history.addSystemMessage(content);
  }, [history]);

  const clearHistory = useCallback(() => {
    const session = getChatSession();
    session.clearHistory();
    history.clearMessages();
    setError(null);
  }, [getChatSession, history]);

  const getLLMHistory = useCallback((): LLMMessage[] => {
    const session = getChatSession();
    return session.getHistory();
  }, [getChatSession]);

  const getSystemPrompt = useCallback((): string => {
    const session = getChatSession();
    return session.getSystemPrompt();
  }, [getChatSession]);

  // Memoize state value to prevent unnecessary re-renders
  const stateValue = useMemo<ChatStateValue>(() => ({
    messages: history.messages,
    isLoading,
    error,
    profile: profile || null,
  }), [history.messages, isLoading, error, profile]);

  // Memoize actions value to prevent unnecessary re-renders
  const actionsValue = useMemo<ChatActionsValue>(() => ({
    sendMessage,
    addSystemMessage,
    clearHistory,
    getLLMHistory,
    getSystemPrompt,
  }), [sendMessage, addSystemMessage, clearHistory, getLLMHistory, getSystemPrompt]);

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
    throw new Error('useChatState must be used within a ChatProvider');
  }
  return context;
}

/**
 * Hook to access chat actions (sendMessage, addSystemMessage, clearHistory)
 */
export function useChatActions(): ChatActionsValue {
  const context = useContext(ChatActionsContext);
  if (!context) {
    throw new Error('useChatActions must be used within a ChatProvider');
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
