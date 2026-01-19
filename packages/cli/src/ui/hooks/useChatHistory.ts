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
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  isStreaming: boolean;
  toolCalls?: ToolCallInfo[];
}

export interface UseChatHistoryReturn {
  messages: Message[];
  addUserMessage: (content: string) => string;
  addAssistantMessage: () => string;
  addSystemMessage: (content: string) => string;
  updateMessageContent: (id: string, content: string) => void;
  updateMessageToolCalls: (id: string, toolCalls: ToolCallInfo[]) => void;
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

  const addAssistantMessage = useCallback((): string => {
    const id = generateId('assistant');
    setMessages(prev => [...prev, {
      id,
      role: 'assistant',
      content: '',
      isStreaming: true,
      toolCalls: [],
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
    completeMessage,
    removeMessage,
    clearMessages,
  };
}
