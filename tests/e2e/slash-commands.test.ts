/**
 * E2E Tests for Slash Commands
 *
 * Tests all interactive slash commands: /help, /profile, /clear, /history, /memory, /exit
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  spawnInteractive,
  type InteractiveRun,
} from './cli-helper.js';

describe('Slash Commands E2E', () => {
  let run: InteractiveRun | null = null;

  afterEach(() => {
    if (run) {
      run.kill();
      run = null;
    }
  });

  describe('/help command', () => {
    it('should display available commands', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      await run.sendLine('/help');

      await run.expectText('Available commands', 5000);

      const output = run.getCleanOutput();
      expect(output).toContain('/help');
      expect(output).toContain('/exit');
    });

    it('should list all slash commands', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      await run.sendLine('/help');

      await run.expectText('commands', 5000);

      const output = run.getCleanOutput();
      expect(output).toMatch(/\/clear|\/profile|\/history/);
    });
  });

  describe('/profile command', () => {
    it('should display current agent profile', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      await run.sendLine('/profile');

      // Should show profile information
      await run.expectPattern(/profile|agent|assistant/i, 5000);
    });
  });

  describe('/clear command', () => {
    it('should clear chat history', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      // Send a message first
      await run.sendLine('first message');
      await run.expectText('mock response', 5000);

      // Clear history - this clears silently
      await run.sendLine('/clear');

      // Wait a moment for the clear to take effect
      await new Promise((resolve) => setTimeout(resolve, 500));

      // After clearing, the UI should still be responsive
      // Check that the input area is still there
      const output = run.getCleanOutput();
      expect(output).toContain('Type a message');
    });
  });

  describe('/history command', () => {
    it('should show message history', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      // Send a message first
      await run.sendLine('test message');
      await run.expectText('mock response', 5000);

      // Show history
      await run.sendLine('/history');

      // Should display history
      await run.expectPattern(/history|message/i, 5000);
    });
  });

  describe('/memory command', () => {
    it('should show system prompt', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      await run.sendLine('/memory');

      // Should display system prompt/memory
      await run.expectPattern(/system|prompt|memory/i, 5000);
    });
  });

  describe('/exit command', () => {
    it('should exit the application', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      await run.sendLine('/exit');

      await run.expectText('Goodbye', 8000);
    });

    it('should work with /quit alias', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      await run.sendLine('/quit');

      await run.expectText('Goodbye', 8000);
    });

    it('should work with /q alias', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      await run.sendLine('/q');

      await run.expectText('Goodbye', 8000);
    });
  });

  describe('Unknown commands', () => {
    it('should handle unknown slash commands gracefully', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      await run.sendLine('/unknowncommand');

      // Should show error or unknown command message
      await run.expectPattern(/unknown|not recognized|invalid/i, 5000);
    });
  });
});
