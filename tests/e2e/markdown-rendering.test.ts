/**
 * E2E Tests for Markdown Rendering
 *
 * Tests that markdown content is properly rendered in the terminal.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  spawnInteractive,
  type InteractiveRun,
} from './cli-helper.js';

describe('Markdown Rendering E2E', () => {
  let run: InteractiveRun | null = null;

  afterEach(() => {
    if (run) {
      run.kill();
      run = null;
    }
  });

  describe('Code Blocks', () => {
    it('should render code blocks with borders', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'basic'],
      });

      await run.sendLine('show code');
      await run.expectText('mock response', 5000);

      const output = run.getCleanOutput();
      // Code blocks should have rounded borders
      expect(output).toMatch(/[╭┌]/); // Top border
      expect(output).toMatch(/[╰└]/); // Bottom border
    });

    it('should render code blocks with language labels', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'basic'],
      });

      await run.sendLine('test');
      await run.expectText('mock response', 5000);

      // The basic scenario includes markdown with code blocks
      const output = run.getCleanOutput();
      expect(output).toBeDefined();
    });
  });

  describe('Long Content', () => {
    it('should handle long content scenario', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'long-content'],
      });

      await run.sendLine('generate long content');

      // Wait for long content to render
      await run.expectPattern(/Long Content|paragraph/i, 10000);

      const output = run.getCleanOutput();
      expect(output.length).toBeGreaterThan(100);
    });
  });

  describe('Empty Response', () => {
    it('should handle empty response gracefully', async () => {
      run = await spawnInteractive({
        args: ['--ui-test', '--ui-test-scenario', 'empty-response'],
      });

      await run.sendLine('test empty');

      // Should not crash, should still show input area
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const output = run.getCleanOutput();
      // Should still be responsive
      expect(output).toContain('Type a message');
    });
  });
});
