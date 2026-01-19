/**
 * Root Ink application component
 */

import React, { useEffect } from 'react';
import { Box, Text, useApp } from 'ink';
import { ChatProvider, useChatState, useChatActions } from './contexts/ChatContext.js';
import { ChatView } from './components/ChatView.js';
import { InputArea } from './components/InputArea.js';
import type { Config } from '@beans/core';
import type { AgentProfile } from '@beans/core';

interface AppProps {
  config: Config;
  systemPrompt: string;
  profile?: AgentProfile;
  initialPrompt?: string;
}

function Header({ profile }: { profile?: AgentProfile }): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor="cyan"
      paddingX={1}
    >
      <Box>
        <Text color="cyan" bold>
          {profile?.displayName || 'Beans Agent'} v{profile?.version || '0.1.0'}
        </Text>
      </Box>
      {profile?.description && (
        <Box>
          <Text color="gray">{profile.description}</Text>
        </Box>
      )}
    </Box>
  );
}

function AppContent({ initialPrompt, onExit }: { initialPrompt?: string; onExit: () => void }): React.ReactElement {
  const { profile } = useChatState();
  const { sendMessage } = useChatActions();

  // Send initial prompt if provided
  useEffect(() => {
    if (initialPrompt) {
      sendMessage(initialPrompt);
    }
  }, []); // Only run once on mount

  return (
    <Box flexDirection="column" height="100%">
      <Header profile={profile || undefined} />
      <ChatView />
      <InputArea onExit={onExit} />
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
