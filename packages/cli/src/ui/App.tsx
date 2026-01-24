/**
 * Root Ink application component
 *
 * Resize handling follows claude-code pattern:
 * - Parent tracks dimensions state
 * - Passes width to children
 * - Ink/Yoga handles re-layout automatically (no terminal clearing needed)
 */

import React, { useEffect } from 'react';
import { Box, useApp } from 'ink';
import { ChatProvider, useChatActions } from './contexts/ChatContext.js';
import { ChatView } from './components/ChatView.js';
import { InputArea } from './components/InputArea.js';
import { useTerminalSize } from './hooks/useTerminalSize.js';
import type { Config } from '@beans/core';
import type { AgentProfile } from '@beans/core';

interface AppProps {
  config: Config;
  systemPrompt: string;
  profile?: AgentProfile;
  initialPrompt?: string;
}

function AppContent({ initialPrompt, onExit }: { initialPrompt?: string; onExit: () => void }): React.ReactElement {
  const { sendMessage } = useChatActions();
  const { columns, rows } = useTerminalSize();

  // Send initial prompt if provided
  useEffect(() => {
    if (initialPrompt) {
      sendMessage(initialPrompt);
    }
  }, []); // Only run once on mount

  return (
    <Box flexDirection="column" width={columns} height={rows}>
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
    <ChatProvider config={config} systemPrompt={systemPrompt} profile={profile}>
      <AppContent initialPrompt={initialPrompt} onExit={handleExit} />
    </ChatProvider>
  );
}
