/**
 * Custom hook for managing chat message history
 *
 * Encapsulates message state management following gemini-cli patterns:
 * - ID generation
 * - Message CRUD operations
 * - Streaming state updates
 */

import { useState, useCallback, useRef } from 'react';

export interface ToolCallInfo {
  id: string;
  name: string;
  args: Record<string, unknown>;
  result?: string;
  isComplete: boolean;
  metadata?: Record<string, unknown>;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming: boolean;
  toolCalls?: ToolCallInfo[];
  agentType?: string;
}

export interface UseChatHistoryReturn {
  messages: Message[];
  addUserMessage: (content: string) => string;
  addAssistantMessage: (agentType?: string) => string;
  addSystemMessage: (content: string) => string;
  updateMessageContent: (id: string, content: string) => void;
  updateMessageToolCalls: (id: string, toolCalls: ToolCallInfo[]) => void;
  updateMessageAgentType: (id: string, agentType: string) => void;
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

  const addUserMessage = useCallback((content: string): string => {
    const id = generateId('user');
    setMessages(prev => [...prev, {
      id,
      role: 'user',
      content: content.trim(),
      isStreaming: false,
    }]);
    return id;
  }, [generateId]);

  const addAssistantMessage = useCallback((agentType?: string): string => {
    const id = generateId('assistant');
    setMessages(prev => [...prev, {
      id,
      role: 'assistant',
      content: '',
      isStreaming: true,
      toolCalls: [],
      agentType,
    }]);
    return id;
  }, [generateId]);

  const addSystemMessage = useCallback((content: string): string => {
    const id = generateId('system');
    setMessages(prev => [...prev, {
      id,
      role: 'system',
      content,
      isStreaming: false,
    }]);
    return id;
  }, [generateId]);

  const updateMessageContent = useCallback((id: string, content: string) => {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, content } : msg
    ));
  }, []);

  const updateMessageToolCalls = useCallback((id: string, toolCalls: ToolCallInfo[]) => {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, toolCalls: [...toolCalls] } : msg
    ));
  }, []);

  const updateMessageAgentType = useCallback((id: string, agentType: string) => {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, agentType } : msg
    ));
  }, []);

  const completeMessage = useCallback((id: string) => {
    setMessages(prev => prev.map(msg =>
      msg.id === id ? { ...msg, isStreaming: false } : msg
    ));
  }, []);

  const removeMessage = useCallback((id: string) => {
    setMessages(prev => prev.filter(msg => msg.id !== id));
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
    updateMessageAgentType,
    completeMessage,
    removeMessage,
    clearMessages,
  };
}
