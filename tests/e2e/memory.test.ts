/**
 * E2E Tests for Memory System
 *
 * Tests hierarchical memory loading from BEANS.md files
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";
import { spawnInteractive, type InteractiveRun } from "./cli-helper.js";

describe("Memory System E2E", () => {
  let run: InteractiveRun | null = null;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "beans-memory-test-"));
  });

  afterEach(async () => {
    if (run) {
      run.kill();
      run = null;
    }
    // Clean up temp directory
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  describe("Project memory (BEANS.md)", () => {
    it("should load BEANS.md from project root", async () => {
      // Create BEANS.md in temp directory
      const beansContent = `---
version: 1
enabled: true
---

# Test Memory File

## Test Preferences

- This is a test memory entry
- Custom guideline for testing
`;
      await fs.writeFile(path.join(tempDir, "BEANS.md"), beansContent);

      // Spawn CLI in temp directory
      run = await spawnInteractive({
        args: ["--ui-test"],
        cwd: tempDir,
      });

      // Check memory via /memory command
      await run.sendLine("/memory");

      // Should display the memory content in system prompt
      await run.expectPattern(
        /Test Memory File|Test Preferences|test memory entry/i,
        10000,
      );
    });

    it("should load BEANS.md from .beans directory", async () => {
      // Create .beans directory
      const beansDir = path.join(tempDir, ".beans");
      await fs.mkdir(beansDir);

      // Create BEANS.md in .beans directory
      const beansContent = `---
version: 1
---

# Project Guidelines

## Coding Standards

- Use TypeScript strict mode
- Follow functional patterns
`;
      await fs.writeFile(path.join(beansDir, "BEANS.md"), beansContent);

      // Spawn CLI in temp directory
      run = await spawnInteractive({
        args: ["--ui-test"],
        cwd: tempDir,
      });

      // Check memory via /memory command
      await run.sendLine("/memory");

      // Should display the memory content
      await run.expectPattern(
        /Project Guidelines|Coding Standards|TypeScript strict mode/i,
        10000,
      );
    });

    it("should merge root and .beans directory memory files", async () => {
      // Create BEANS.md in root
      const rootContent = `# Root Memory

- Root preference one
`;
      await fs.writeFile(path.join(tempDir, "BEANS.md"), rootContent);

      // Create .beans directory with another BEANS.md
      const beansDir = path.join(tempDir, ".beans");
      await fs.mkdir(beansDir);

      const beansDirContent = `# Beans Dir Memory

- Beans dir preference two
`;
      await fs.writeFile(path.join(beansDir, "BEANS.md"), beansDirContent);

      // Spawn CLI in temp directory
      run = await spawnInteractive({
        args: ["--ui-test"],
        cwd: tempDir,
      });

      // Check memory via /memory command
      await run.sendLine("/memory");

      // Should display content from both files
      await run.expectPattern(/Root Memory|Root preference one/i, 10000);

      const output = run.getCleanOutput();
      expect(output).toMatch(/Beans Dir Memory|Beans dir preference two/i);
    });

    it("should respect enabled: false in frontmatter", async () => {
      // Create disabled BEANS.md
      const beansContent = `---
enabled: false
---

# Disabled Memory

- This should NOT appear
`;
      await fs.writeFile(path.join(tempDir, "BEANS.md"), beansContent);

      // Spawn CLI in temp directory
      run = await spawnInteractive({
        args: ["--ui-test"],
        cwd: tempDir,
      });

      // Check memory via /memory command
      await run.sendLine("/memory");

      // Wait for the command to complete
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Should NOT contain the disabled memory content
      const output = run.getCleanOutput();
      expect(output).not.toContain("Disabled Memory");
      expect(output).not.toContain("This should NOT appear");
    });
  });

  describe("Memory content in system prompt", () => {
    it("should inject memory into agent system prompt", async () => {
      // Create BEANS.md with specific instructions
      const beansContent = `# Agent Instructions

## Important Rules

- Always respond in formal tone
- Never use emojis
`;
      await fs.writeFile(path.join(tempDir, "BEANS.md"), beansContent);

      // Spawn CLI in temp directory
      run = await spawnInteractive({
        args: ["--ui-test"],
        cwd: tempDir,
      });

      // The /memory command shows system prompt which should include memory
      await run.sendLine("/memory");

      // Should display memory content
      await run.expectPattern(
        /Agent Instructions|Important Rules|formal tone/i,
        10000,
      );
    });
  });

  describe("No memory file", () => {
    it("should work without any BEANS.md file", async () => {
      // Don't create any BEANS.md - temp directory is empty

      // Spawn CLI in temp directory (should still work)
      run = await spawnInteractive({
        args: ["--ui-test"],
        cwd: tempDir,
      });

      // Should be able to use /memory command without errors
      await run.sendLine("/memory");

      // Should show system prompt (even without memory content)
      await run.expectPattern(
        /System Prompt|Working Directory|Environment/i,
        10000,
      );
    });
  });
});
