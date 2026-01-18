/**
 * Chat context for managing state across Ink components
 */

import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import type { ReactNode } from 'react';
import { ChatSession, Config } from '@beans/core';
import type { AgentActivityEvent } from '@beans/core';
import type { AgentProfile } from '@beans/core';

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming: boolean;
  toolCalls?: ToolCallInfo[];
}

export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  isComplete: boolean;
}

interface ChatContextValue {
  messages: Message[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  addSystemMessage: (content: string) => void;
  clearHistory: () => void;
  updateSOP: (sop: string) => void;
  profile: AgentProfile | null;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export interface ChatProviderProps {
  children: ReactNode;
  config: Config;
  systemPrompt: string;
  profile?: AgentProfile;
}

export function ChatProvider({ children, config, systemPrompt, profile }: ChatProviderProps): React.ReactElement {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const userMessageId = `user-${Date.now()}`;
    const assistantMessageId = `assistant-${Date.now()}`;

    // Add user message
    setMessages(prev => [...prev, {
      id: userMessageId,
      role: 'user',
      content: content.trim(),
      isStreaming: false,
    }]);

    // Add empty assistant message (will be filled via streaming)
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      toolCalls: [],
    }]);

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
              setMessages(prev => prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, content: currentContent }
                  : msg
              ));
              break;

            case 'tool_call_start':
              toolCalls.push({
                id: event.toolCall.id,
                name: event.toolCall.name,
                args: event.toolCall.arguments,
                isComplete: false,
              });
              setMessages(prev => prev.map(msg =>
                msg.id === assistantMessageId
                  ? { ...msg, toolCalls: [...toolCalls] }
                  : msg
              ));
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
                setMessages(prev => prev.map(msg =>
                  msg.id === assistantMessageId
                    ? { ...msg, toolCalls: [...toolCalls] }
                    : msg
                ));
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
      setMessages(prev => prev.map(msg =>
        msg.id === assistantMessageId
          ? { ...msg, isStreaming: false }
          : msg
      ));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      // Remove the empty assistant message on error
      setMessages(prev => prev.filter(msg => msg.id !== assistantMessageId));
    } finally {
      setIsLoading(false);
    }
  }, [getChatSession]);

  const addSystemMessage = useCallback((content: string) => {
    const messageId = `system-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: messageId,
      role: 'system',
      content,
      isStreaming: false,
    }]);
  }, []);

  const clearHistory = useCallback(() => {
    const session = getChatSession();
    session.clearHistory();
    setMessages([]);
    setError(null);
  }, [getChatSession]);

  const updateSOP = useCallback((sop: string) => {
    const session = getChatSession();
    // Append SOP to existing system prompt
    const newPrompt = `${systemPrompt}\n\n## Standard Operating Procedure\n${sop}`;
    session.updateSystemPrompt(newPrompt);
  }, [getChatSession, systemPrompt]);

  const value: ChatContextValue = {
    messages,
    isLoading,
    error,
    sendMessage,
    addSystemMessage,
    clearHistory,
    updateSOP,
    profile: profile || null,
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error('useChatContext must be used within a ChatProvider');
  }
  return context;
}
