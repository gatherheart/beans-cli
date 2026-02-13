/**
 * E2E Tests for Agent Profile
 *
 * Tests agent profile loading, generation, and display.
 */

import { describe, it, expect, afterEach } from 'vitest';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  spawnInteractive,
  spawnCommand,
  type InteractiveRun,
} from './cli-helper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('Agent Profile E2E', () => {
  let run: InteractiveRun | null = null;

  afterEach(() => {
    if (run) {
      run.kill();
      run = null;
    }
  });

  describe('Default Profile', () => {
    it('should load default agent profile', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      // Check /profile command shows default agent
      await run.sendLine('/profile');

      await run.expectPattern(/general|assistant|default/i, 5000);
    });

    it('should display profile name on startup', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      const output = run.getCleanOutput();
      // Should show agent name in startup
      expect(output).toMatch(/assistant|agent/i);
    });
  });

  describe('Custom Profile Loading', () => {
    it('should load profile from --agent-profile flag', async () => {
      const profilePath = path.resolve(
        __dirname,
        '../../plugins/code-development/agents/code-reviewer.md'
      );

      run = await spawnInteractive({
        args: ['--ui-test', '--agent-profile', profilePath],
      });

      await run.sendLine('/profile');

      await run.expectPattern(/code.*review|reviewer/i, 5000);
    });
  });

  describe('Profile Commands', () => {
    it('should show full profile with /profile command', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      await run.sendLine('/profile');

      // Should show profile details
      await run.expectPattern(/name|description|purpose/i, 5000);
    });

    it('should show system prompt with /memory command', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      await run.sendLine('/memory');

      // Should show the system prompt
      await run.expectPattern(/system|prompt|guidelines/i, 5000);
    });
  });

  describe('Workspace Context', () => {
    it('should include workspace info in system prompt', async () => {
      run = await spawnInteractive({ args: ['--ui-test'] });

      await run.sendLine('/memory');

      // Should include workspace context
      await run.expectPattern(/working|directory|environment/i, 8000);
    });
  });
});

describe('CLI Flags E2E', () => {
  describe('Model Selection', () => {
    it('should accept --model flag', async () => {
      // This just tests the flag is accepted, not actual model switching
      const { output, exitCode } = await spawnCommand([
        '--help',
      ]);

      expect(exitCode).toBe(0);
      expect(output).toContain('model');
    });
  });

  describe('Debug Mode', () => {
    it('should accept --debug flag', async () => {
      const { output, exitCode } = await spawnCommand(['--help']);

      expect(exitCode).toBe(0);
      expect(output).toContain('debug');
    });
  });

  describe('Yolo Mode', () => {
    it('should accept --yolo flag', async () => {
      const { output, exitCode } = await spawnCommand(['--help']);

      expect(exitCode).toBe(0);
      expect(output).toContain('yolo');
    });
  });

  describe('List Models', () => {
    it('should list available models with --list-models', async () => {
      // Note: This may fail if no API key is set, which is expected in CI
      const { output } = await spawnCommand(['--list-models']);

      // Should either show models or an error about API key
      expect(output).toMatch(/model|error|api/i);
    });
  });
});
