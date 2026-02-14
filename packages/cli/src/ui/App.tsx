/**
 * Root Ink application component
 *
 * Simple layout - content flows naturally from top to bottom:
 * - Messages appear at top
 * - Input follows after messages
 * - No height constraints to avoid rendering corruption
 */

import React, { useEffect, Component, type ReactNode } from 'react';
import { Box, Text, useApp } from 'ink';
import { ChatProvider, useChatActions } from './contexts/ChatContext.js';
import { TaskProvider } from './contexts/TaskContext.js';
import { ChatView } from './components/ChatView.js';
import { InputArea } from './components/InputArea.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import type { Config } from '@beans/core';
import type { AgentProfile } from '@beans/core';

// Error boundary to catch React errors
class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] React error:', error.message);
    console.error('[ErrorBoundary] Stack:', error.stack);
    console.error('[ErrorBoundary] Component stack:', info.componentStack);
  }

  render() {
    if (this.state.error) {
      return <Text color="red">Error: {this.state.error.message}</Text>;
    }
    return this.props.children;
  }
}

interface AppProps {
  config: Config;
  systemPrompt: string;
  profile?: AgentProfile;
  initialPrompt?: string;
}

function AppContent({ initialPrompt, onExit }: { initialPrompt?: string; onExit: () => void }): React.ReactElement {
  const { sendMessage } = useChatActions();
  const { columns } = useTerminalSize();

  // Send initial prompt if provided
  useEffect(() => {
    if (initialPrompt) {
      sendMessage(initialPrompt);
    }
  }, []); // Only run once on mount

  return (
    <Box flexDirection="column" width={columns}>
      <ChatView width={columns} />
      <InputArea onExit={onExit} width={columns} />
    </Box>
  );
}

export function App({ config, systemPrompt, profile, initialPrompt }: AppProps): React.ReactElement {
  const { exit } = useApp();

  const handleExit = () => {
    exit();
  };

  return (
    <ErrorBoundary>
      <TaskProvider>
        <ChatProvider config={config} systemPrompt={systemPrompt} profile={profile}>
          <AppContent initialPrompt={initialPrompt} onExit={handleExit} />
        </ChatProvider>
      </TaskProvider>
    </ErrorBoundary>
  );
}
