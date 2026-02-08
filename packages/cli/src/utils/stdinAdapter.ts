/**
 * Stdin adapter for e2e testing
 *
 * Provides a mock stdin stream for Ink when running e2e tests.
 * Only used when uiTestMode is enabled in config AND raw mode is not supported.
 *
 * In normal non-TTY environments (CI, Docker, pipes), the CLI will
 * fail gracefully rather than using mock stdin, since interactive
 * input isn't expected in those cases anyway.
 */

import { type RenderOptions } from 'ink';
import type { Config } from '@beans/core';
import { createMockStdin } from './mockStdin.js';

export interface StdinAdapter {
  renderOptions: Partial<RenderOptions>;
  cleanup: () => void;
}

/**
 * Creates a stdin adapter for Ink rendering.
 *
 * @param config - Application configuration. If config.ui.uiTestMode is true,
 *   creates a mock stdin that emits characters one at a time for e2e testing.
 *   This is required because PTY stdin in CI environments can block Ink's render loop.
 */
export function createStdinAdapter(config: Config): StdinAdapter {
  const uiTestMode = config.getUIConfig().uiTestMode ?? false;

  // In normal mode, use standard options (let Ink handle stdin directly)
  if (!uiTestMode) {
    return {
      renderOptions: {},
      cleanup: () => {},
    };
  }

  // UI test mode: use mock stdin for consistent e2e testing behavior
  const mockStdin = createMockStdin();

  // Put process.stdin in raw mode so we get character-by-character input
  // (instead of line-buffered input that waits for Enter)
  const stdinIsTTY = process.stdin.isTTY === true;
  const hasSetRawMode = typeof (process.stdin as NodeJS.ReadStream).setRawMode === 'function';

  if (stdinIsTTY && hasSetRawMode) {
    (process.stdin as NodeJS.ReadStream).setRawMode(true);
  }

  // Forward actual stdin to mock stdin
  const onData = (data: Buffer) => mockStdin.write(data);
  const onEnd = () => mockStdin.end();

  process.stdin.on('data', onData);
  process.stdin.on('end', onEnd);
  process.stdin.resume(); // Ensure stdin is in flowing mode

  return {
    renderOptions: {
      stdin: mockStdin as unknown as NodeJS.ReadStream,
    },
    cleanup: () => {
      process.stdin.off('data', onData);
      process.stdin.off('end', onEnd);

      // Restore stdin to normal mode
      if (stdinIsTTY && hasSetRawMode) {
        (process.stdin as NodeJS.ReadStream).setRawMode(false);
      }

      mockStdin.end();
    },
  };
}
