/**
 * E2E Tests for Anti-Flicker Behavior
 *
 * These tests verify the terminal escape codes and rendering behavior
 * that prevent UI flickering.
 *
 * Uses @lydell/node-pty to create a pseudo-terminal, allowing Ink to
 * render properly even in CI environments.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  spawnInteractive,
  spawnCommand,
  hasEscapeCode,
  EscapeCodes,
  type InteractiveRun,
} from './cli-helper.js';

describe('Anti-Flicker E2E', () => {
  let run: InteractiveRun | null = null;

  afterEach(() => {
    if (run) {
      run.kill();
      run = null;
    }
  });

  describe('Terminal Line Wrapping Control', () => {
    it('should disable line wrapping on startup', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      const rawOutput = run.getRawOutput();
      expect(hasEscapeCode(rawOutput, EscapeCodes.DISABLE_LINE_WRAP)).toBe(true);
    });

    it('should re-enable line wrapping on exit', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      // Send exit command
      await run.sendLine('/exit');

      // Wait for Goodbye message
      await run.expectText('Goodbye', 8000);

      const rawOutput = run.getRawOutput();
      expect(hasEscapeCode(rawOutput, EscapeCodes.ENABLE_LINE_WRAP)).toBe(true);
    });
  });

  describe('UI Test Scenarios', () => {
    it('should render basic scenario without errors', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'basic'],
      });

      // Send a test message
      await run.sendLine('test message');

      // Wait for response
      await run.expectText('mock response', 5000);
    });

    it('should handle rapid-stream scenario', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'rapid-stream'],
      });

      // Send a test message
      await run.sendLine('test');

      // Wait for streaming to complete
      await run.expectText('Rapid Streaming Test', 5000);
    });

    it('should handle tool-calls scenario', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'tool-calls'],
      });

      // Send a test message to trigger tool calls
      await run.sendLine('use tools');

      // Wait for tool calls to appear
      await run.expectPattern(/read_file|glob|shell/, 8000);

      // Check no duplicate key errors
      const output = run.getCleanOutput();
      expect(output).not.toContain('Encountered two children with the same key');
    });
  });

  describe('Message Rendering', () => {
    it('should render user message correctly', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      // Send user message
      await run.sendLine('test');

      // Wait for the mock response
      await run.expectText('mock response', 5000);

      const output = run.getCleanOutput();
      expect(output).toContain('>');
      expect(output).toContain('mock response');
    });

    it('should render assistant response correctly', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'basic'],
      });

      // Send message to get response
      await run.sendLine('test');

      // Wait for assistant response
      await run.expectText('mock response', 5000);

      const output = run.getCleanOutput();
      expect(output).toContain('mock response');
    });
  });

  describe('Error Handling', () => {
    it('should handle error scenario gracefully', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'error'],
      });

      // Send message to trigger error
      await run.sendLine('trigger error');

      // Wait for error to be displayed
      await run.expectPattern(/error|Error/, 5000);
    });
  });

  describe('Static Component Behavior', () => {
    it('should accumulate multiple messages', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'multi-turn'],
      });

      // Send first message and wait for response
      await run.sendLine('first message');
      await run.expectText('turn 1', 8000);

      // Small delay to ensure queue is processed
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Send second message and wait for response
      await run.sendLine('second message');
      await run.expectText('turn 2', 8000);

      const output = run.getCleanOutput();
      expect(output).toContain('turn 1');
      expect(output).toContain('turn 2');
    });
  });
});

describe('CLI Help and Version', () => {
  it('should show help with --help flag', async () => {
    const { output, exitCode } = await spawnCommand(['--help']);

    expect(exitCode).toBe(0);
    expect(output).toContain('Usage');
    expect(output).toContain('Options');
  });

  it('should show version with --version flag', async () => {
    const { output, exitCode } = await spawnCommand(['--version']);

    expect(exitCode).toBe(0);
    expect(output).toMatch(/\d+\.\d+\.\d+/);
  });
});
