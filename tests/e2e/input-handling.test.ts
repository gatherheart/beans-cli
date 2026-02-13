/**
 * E2E Tests for Input Handling
 *
 * Tests input area behavior: typing, navigation, submission.
 * Note: Character-by-character typing tests are flaky due to terminal rendering
 * timing, so we focus on end-to-end behavior.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  spawnInteractive,
  type InteractiveRun,
} from './cli-helper.js';

describe('Input Handling E2E', () => {
  let run: InteractiveRun | null = null;

  afterEach(() => {
    if (run) {
      run.kill();
      run = null;
    }
  });

  describe('Basic Input', () => {
    it('should submit message on Enter and get response', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      await run.sendLine('test message');

      await run.expectText('mock response', 5000);

      const output = run.getCleanOutput();
      expect(output).toContain('mock response');
    });

    it('should handle empty input gracefully', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      // Just press Enter without typing
      await run.sendKeys('\r');

      // Should not crash, should still show input area
      await new Promise((resolve) => setTimeout(resolve, 500));

      const output = run.getCleanOutput();
      expect(output).toContain('Type a message');
    });

    it('should display user input in prompt area', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      // Send keys and check they appear
      await run.sendKeys('hello world');

      await new Promise((resolve) => setTimeout(resolve, 300));

      const output = run.getCleanOutput();
      // The input should be visible somewhere in the output
      expect(output).toMatch(/hello|world|h.*w/);
    });
  });

  describe('Message Submission', () => {
    it('should show user message after submission', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      await run.sendLine('my test message');

      await run.expectText('mock response', 5000);

      const output = run.getCleanOutput();
      // User message should be visible
      expect(output).toContain('my test message');
    });

    it('should show assistant response after submission', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'basic'],
      });

      await run.sendLine('test');

      await run.expectText('mock response', 5000);

      const output = run.getCleanOutput();
      expect(output).toContain('mock response');
    });
  });

  describe('Input During Streaming', () => {
    it('should maintain input area visibility during streaming', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'slow-stream'],
      });

      // Send message to start streaming
      await run.sendLine('start');

      // Wait for streaming to start
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Input area should still be visible
      const output = run.getCleanOutput();
      expect(output).toContain('Type a message');
    });
  });

  describe('Multiple Messages', () => {
    it('should handle multiple sequential messages', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'multi-turn'],
      });

      // First message
      await run.sendLine('first');
      await run.expectText('turn 1', 8000);

      // Wait for response to complete
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Second message
      await run.sendLine('second');
      await run.expectText('turn 2', 8000);

      const output = run.getCleanOutput();
      expect(output).toContain('turn 1');
      expect(output).toContain('turn 2');
    });
  });

  describe('Long Input', () => {
    it('should handle and submit long input', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      const longText = 'This is a longer message to test input handling';
      await run.sendLine(longText);

      await run.expectText('mock response', 5000);

      // Should have processed the message
      const output = run.getCleanOutput();
      expect(output).toContain('mock response');
    });
  });
});
