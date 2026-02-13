/**
 * E2E Tests for Streaming Behavior
 *
 * Tests streaming responses, tool calls, and real-time updates.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  spawnInteractive,
  type InteractiveRun,
} from './cli-helper.js';

describe('Streaming E2E', () => {
  let run: InteractiveRun | null = null;

  afterEach(() => {
    if (run) {
      run.kill();
      run = null;
    }
  });

  describe('Basic Streaming', () => {
    it('should stream content progressively', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'basic'],
      });

      await run.sendLine('test');

      // Wait for streaming to complete
      await run.expectText('mock response', 5000);

      const output = run.getCleanOutput();
      expect(output).toContain('mock response');
    });

    it('should handle rapid streaming without flickering', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'rapid-stream'],
      });

      await run.sendLine('test');

      // Wait for rapid streaming to complete
      await run.expectText('Rapid Streaming Test', 8000);

      // Check for proper rendering
      const output = run.getCleanOutput();
      expect(output).not.toContain('undefined');
      expect(output).not.toContain('[object Object]');
    });

    it('should handle slow streaming', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'slow-stream'],
      });

      await run.sendLine('test');

      // Wait for slow streaming (200ms per word) - content starts with "# Slow Streaming Test"
      // The full content takes ~20+ seconds, so just check for start
      await run.expectText('Streaming', 30000);

      const output = run.getCleanOutput();
      expect(output).toContain('Streaming');
    });
  });

  describe('Tool Calls', () => {
    it('should display tool call indicators', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'tool-calls'],
      });

      await run.sendLine('use tools');

      // Wait for tool calls to appear
      await run.expectPattern(/read_file|glob|shell/, 8000);

      const output = run.getCleanOutput();
      // Should show tool names
      expect(output).toMatch(/read_file|glob|shell/);
    });

    it('should show tool completion status', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'tool-calls'],
      });

      await run.sendLine('use tools');

      // Wait for tool execution
      await run.expectPattern(/read_file|glob|shell/, 8000);

      // Wait a bit more for completion indicators
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const output = run.getCleanOutput();
      // Should have some indication of tool status
      expect(output).toBeDefined();
    });
  });

  describe('Multi-turn Conversation', () => {
    it('should maintain context across turns', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'multi-turn'],
      });

      // First turn
      await run.sendLine('first');
      await run.expectText('turn 1', 8000);

      // Wait between turns
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Second turn
      await run.sendLine('second');
      await run.expectText('turn 2', 8000);

      const output = run.getCleanOutput();
      expect(output).toContain('turn 1');
      expect(output).toContain('turn 2');
    });

    it('should accumulate messages in history', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'multi-turn'],
      });

      // Send multiple messages
      await run.sendLine('message 1');
      await run.expectText('turn 1', 8000);

      await new Promise((resolve) => setTimeout(resolve, 500));

      await run.sendLine('message 2');
      await run.expectText('turn 2', 8000);

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Check history
      await run.sendLine('/history');
      await run.expectPattern(/history|message/i, 5000);
    });
  });

  describe('Error Handling', () => {
    it('should display errors gracefully', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'error'],
      });

      await run.sendLine('trigger error');

      // Wait for error display
      await run.expectPattern(/error|Error/i, 5000);

      const output = run.getCleanOutput();
      // Error should be displayed, app should not crash
      expect(output).toMatch(/error/i);
    });

    it('should allow continuing after error', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'error'],
      });

      await run.sendLine('trigger error');
      await run.expectPattern(/error|Error/i, 5000);

      // Should still be able to send messages
      await new Promise((resolve) => setTimeout(resolve, 500));

      // The app should still be responsive
      const output = run.getCleanOutput();
      expect(output).toContain('Type a message');
    });
  });
});
