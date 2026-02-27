/**
 * Root Ink application component
 *
 * Simple layout - content flows naturally from top to bottom:
 * - Messages appear at top
 * - Input follows after messages
 * - No height constraints to avoid rendering corruption
 */

import React, { useEffect, Component, type ReactNode } from "react";
import { Box, Text, useApp } from "ink";
import { ChatProvider, useChatActions } from "./contexts/ChatContext.js";
import { TaskProvider } from "./contexts/TaskContext.js";
import { ChatView } from "./components/ChatView.js";
import { InputArea } from "./components/InputArea.js";
import { useTerminalSize } from "./hooks/useTerminalSize.js";
import type { Config, ApprovalMode } from "@beans/core";
import type { AgentProfile } from "@beans/core";

// Error boundary to catch React errors
class ErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary] React error:", error.message);
    console.error("[ErrorBoundary] Stack:", error.stack);
    console.error("[ErrorBoundary] Component stack:", info.componentStack);
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
  initialApprovalMode?: ApprovalMode;
}

/**
 * Calculate main content area width (following gemini-cli pattern)
 * Uses 90-98% of terminal width to leave margin and avoid edge artifacts
 */
function calculateMainAreaWidth(terminalWidth: number): number {
  if (terminalWidth <= 80) {
    return Math.round(0.98 * terminalWidth);
  }
  if (terminalWidth >= 132) {
    return Math.round(0.9 * terminalWidth);
  }
  // Linearly interpolate between 80 columns (98%) and 132 columns (90%)
  const t = (terminalWidth - 80) / (132 - 80);
  const percentage = 98 - t * 8; // lerp from 98 to 90
  return Math.round(percentage * terminalWidth * 0.01);
}

function AppContent({
  initialPrompt,
  onExit,
}: {
  initialPrompt?: string;
  onExit: () => void;
}): React.ReactElement {
  const { sendMessage } = useChatActions();
  const { columns } = useTerminalSize();

  // Calculate main area width with margin (gemini-cli pattern)
  const mainAreaWidth = calculateMainAreaWidth(columns);

  // Send initial prompt if provided
  useEffect(() => {
    if (initialPrompt) {
      sendMessage(initialPrompt);
    }
  }, []); // Only run once on mount

  return (
    <Box flexDirection="column" width={mainAreaWidth}>
      <ChatView width={mainAreaWidth} />
      <InputArea onExit={onExit} width={mainAreaWidth} />
    </Box>
  );
}

export function App({
  config,
  systemPrompt,
  profile,
  initialPrompt,
  initialApprovalMode,
}: AppProps): React.ReactElement {
  const { exit } = useApp();

  const handleExit = () => {
    exit();
  };

  return (
    <ErrorBoundary>
      <TaskProvider>
        <ChatProvider
          config={config}
          systemPrompt={systemPrompt}
          profile={profile}
          initialApprovalMode={initialApprovalMode}
        >
          <AppContent initialPrompt={initialPrompt} onExit={handleExit} />
        </ChatProvider>
      </TaskProvider>
    </ErrorBoundary>
  );
}
