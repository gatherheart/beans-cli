/**
 * E2E Tests for Anti-Flicker Behavior
 *
 * These tests verify the terminal escape codes and rendering behavior
 * that prevent UI flickering.
 */

import { describe, it, expect, afterEach } from 'vitest';
import { spawnCLI, getRawOutput, hasEscapeCode, EscapeCodes, type CLIProcess } from './cli-helper.js';

describe('Anti-Flicker E2E', () => {
  let cli: CLIProcess | null = null;

  afterEach(() => {
    if (cli) {
      cli.kill();
      cli = null;
    }
  });

  describe('Terminal Line Wrapping Control', () => {
    it('should disable line wrapping on startup', async () => {
      cli = spawnCLI({
        args: ['--ui-test'],
        timeout: 5000,
      });

      // Wait for initial render
      await cli.waitForOutput('Type a message', 3000);

      const output = getRawOutput(cli);

      // Verify line wrapping is disabled
      expect(hasEscapeCode(output, EscapeCodes.DISABLE_LINE_WRAP)).toBe(true);
    });

    it('should re-enable line wrapping on exit', async () => {
      cli = spawnCLI({
        args: ['--ui-test'],
        timeout: 15000,
      });

      // Wait for initial render
      await cli.waitForOutput('Type a message', 3000);

      // Small delay to ensure input is ready
      await new Promise(resolve => setTimeout(resolve, 200));

      // Send exit command
      cli.write('/exit\r');

      // Wait for Goodbye message (indicates exit is in progress)
      await cli.waitForOutput('Goodbye', 8000);

      const output = getRawOutput(cli);

      // Verify line wrapping is re-enabled (should appear before "Goodbye!")
      expect(hasEscapeCode(output, EscapeCodes.ENABLE_LINE_WRAP)).toBe(true);
    });
  });

  describe('UI Test Scenarios', () => {
    it('should render basic scenario without errors', async () => {
      cli = spawnCLI({
        args: ['--ui-test', '--ui-test-scenario', 'basic'],
        timeout: 10000,
      });

      // Wait for UI to render
      await cli.waitForOutput('Type a message', 3000);

      // Send a test message
      cli.write('test message\r');

      // Wait for response
      await cli.waitForOutput('mock response', 5000);

      // Check no errors
      expect(cli.errors.join('')).not.toContain('Error');
    });

    it('should handle rapid-stream scenario', async () => {
      cli = spawnCLI({
        args: ['--ui-test', '--ui-test-scenario', 'rapid-stream'],
        timeout: 10000,
      });

      // Wait for UI to render
      await cli.waitForOutput('Type a message', 3000);

      // Send a test message
      cli.write('test\r');

      // Wait for streaming to complete
      await cli.waitForOutput('Rapid Streaming Test', 5000);

      // Check no errors occurred during rapid updates
      expect(cli.errors.join('')).not.toContain('Error');
    });

    it('should handle tool-calls scenario', async () => {
      cli = spawnCLI({
        args: ['--ui-test', '--ui-test-scenario', 'tool-calls'],
        timeout: 15000,
      });

      // Wait for UI to render
      await cli.waitForOutput('Type a message', 3000);

      // Send a test message to trigger tool calls
      cli.write('use tools\r');

      // Wait for tool calls to appear
      await cli.waitForOutput('read_file|glob|shell', 8000);

      // Check no duplicate key errors
      const allOutput = cli.errors.join('') + getRawOutput(cli);
      expect(allOutput).not.toContain('Encountered two children with the same key');
    });
  });

  describe('Message Rendering', () => {
    it('should render user message correctly', async () => {
      cli = spawnCLI({
        args: ['--ui-test'],
        timeout: 10000,
      });

      await cli.waitForOutput('Type a message', 3000);

      // Send user message
      cli.write('test\r');

      // Wait for the mock response to appear (confirms message was processed)
      await cli.waitForOutput('mock response', 5000);

      const output = getRawOutput(cli);
      // User message prefix ">" should be in output
      expect(output).toContain('>');
      // And the mock response should appear
      expect(output).toContain('mock response');
    });

    it('should render assistant response correctly', async () => {
      cli = spawnCLI({
        args: ['--ui-test', '--ui-test-scenario', 'basic'],
        timeout: 10000,
      });

      await cli.waitForOutput('Type a message', 3000);

      // Send message to get response
      cli.write('test\r');

      // Wait for assistant response
      await cli.waitForOutput('mock response', 5000);

      const output = getRawOutput(cli);
      expect(output).toContain('mock response');
    });
  });

  describe('Error Handling', () => {
    it('should handle error scenario gracefully', async () => {
      cli = spawnCLI({
        args: ['--ui-test', '--ui-test-scenario', 'error'],
        timeout: 10000,
      });

      await cli.waitForOutput('Type a message', 3000);

      // Send message to trigger error
      cli.write('trigger error\r');

      // Wait for error to be displayed
      await cli.waitForOutput('error|Error', 5000);

      // App should still be running (not crashed)
      expect(cli.process.killed).toBe(false);
    });
  });

  describe('Static Component Behavior', () => {
    it('should accumulate multiple messages', async () => {
      cli = spawnCLI({
        args: ['--ui-test', '--ui-test-scenario', 'multi-turn'],
        timeout: 20000,
      });

      await cli.waitForOutput('Type a message', 3000);

      // Send first message and wait for the response
      cli.write('first message\r');
      await cli.waitForOutput('turn 1', 8000);

      // Small delay to ensure queue is fully processed
      await new Promise(resolve => setTimeout(resolve, 500));

      // Send second message and wait for the response
      cli.write('second message\r');
      await cli.waitForOutput('turn 2', 8000);

      const output = getRawOutput(cli);

      // Both turn responses should be visible
      expect(output).toContain('turn 1');
      expect(output).toContain('turn 2');
    });
  });
});

describe('CLI Help and Version', () => {
  let cli: CLIProcess | null = null;

  afterEach(() => {
    if (cli) {
      cli.kill();
      cli = null;
    }
  });

  it('should show help with --help flag', async () => {
    cli = spawnCLI({
      args: ['--help'],
      timeout: 5000,
    });

    await cli.waitForExit(3000);

    const output = getRawOutput(cli);
    expect(output).toContain('Usage');
    expect(output).toContain('Options');
  });

  it('should show version with --version flag', async () => {
    cli = spawnCLI({
      args: ['--version'],
      timeout: 5000,
    });

    await cli.waitForExit(3000);

    const output = getRawOutput(cli);
    expect(output).toMatch(/\d+\.\d+\.\d+/); // Version number pattern
  });
});
