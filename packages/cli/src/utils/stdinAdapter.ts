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
import { createMockStdin, isRawModeSupported } from './mockStdin.js';

export interface StdinAdapter {
  renderOptions: Partial<RenderOptions>;
  cleanup: () => void;
}

/**
 * Creates a stdin adapter for Ink rendering.
 *
 * @param config - Application configuration. If config.ui.uiTestMode is true
 *   and raw mode is not supported, creates a mock stdin that emits characters
 *   one at a time for e2e testing.
 */
export function createStdinAdapter(config: Config): StdinAdapter {
  const uiTestMode = config.getUIConfig().uiTestMode ?? false;

  // In normal mode or when raw mode is supported, use standard options
  if (isRawModeSupported() || !uiTestMode) {
    return {
      renderOptions: {},
      cleanup: () => {},
    };
  }

  // Only create mock stdin in UI test mode when raw mode is not supported
  const mockStdin = createMockStdin();

  // Forward actual stdin to mock stdin
  const onData = (data: Buffer) => mockStdin.write(data);
  const onEnd = () => mockStdin.end();

  process.stdin.on('data', onData);
  process.stdin.on('end', onEnd);

  return {
    renderOptions: {
      stdin: mockStdin as unknown as NodeJS.ReadStream,
    },
    cleanup: () => {
      process.stdin.off('data', onData);
      process.stdin.off('end', onEnd);
      mockStdin.end();
    },
  };
}
