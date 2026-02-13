#!/usr/bin/env npx tsx
/**
 * Advanced lint fixer for errors that ESLint --fix can't handle
 *
 * Handles:
 * - no-useless-escape: Removes unnecessary escape characters
 * - @typescript-eslint/no-unused-vars: Removes or prefixes unused imports
 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';

interface LintMessage {
  ruleId: string;
  message: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
}

interface LintResult {
  filePath: string;
  messages: LintMessage[];
}

function runEslint(): LintResult[] {
  const result = spawnSync('npx', ['eslint', '.', '--format', 'json'], {
    encoding: 'utf-8',
    shell: true,
  });

  // ESLint outputs JSON to stdout even on error
  try {
    return JSON.parse(result.stdout);
  } catch {
    console.error('Failed to parse ESLint output:', result.stdout?.slice(0, 200));
    return [];
  }
}

function fixUnusedImport(filePath: string, message: LintMessage): boolean {
  // Extract variable name from message like "'execSync' is defined but never used"
  const match = message.message.match(/^'([^']+)' is defined but never used/);
  if (!match) return false;

  const varName = match[1];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const line = lines[message.line - 1];

  // Handle import { a, b } from 'module' - remove just the unused one
  const importMatch = line.match(/^import\s*\{([^}]+)\}\s*from/);
  if (importMatch) {
    const imports = importMatch[1].split(',').map(s => s.trim());
    const filtered = imports.filter(imp => {
      const name = imp.includes(' as ') ? imp.split(' as ')[1].trim() : imp;
      return name !== varName;
    });

    if (filtered.length === 0) {
      // Remove entire line
      lines.splice(message.line - 1, 1);
    } else {
      // Replace with filtered imports
      lines[message.line - 1] = line.replace(
        /\{[^}]+\}/,
        `{ ${filtered.join(', ')} }`
      );
    }

    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`Fixed unused import '${varName}' in ${filePath}`);
    return true;
  }

  return false;
}

function fixUselessEscape(filePath: string, message: LintMessage): boolean {
  // Extract the character from message like "Unnecessary escape character: \["
  const match = message.message.match(/Unnecessary escape character: \\(.)/);
  if (!match) return false;

  const char = match[1];
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const line = lines[message.line - 1];
  const col = message.column - 1;

  // Find and remove the backslash at the specific position
  if (line[col] === '\\' && line[col + 1] === char) {
    lines[message.line - 1] = line.slice(0, col) + line.slice(col + 1);
    fs.writeFileSync(filePath, lines.join('\n'));
    console.log(`Fixed useless escape '\\${char}' in ${filePath}:${message.line}`);
    return true;
  }

  return false;
}

function main() {
  console.log('Running ESLint to find errors...');
  const results = runEslint();

  let fixedCount = 0;

  for (const result of results) {
    for (const msg of result.messages) {
      if (msg.ruleId === '@typescript-eslint/no-unused-vars') {
        if (fixUnusedImport(result.filePath, msg)) {
          fixedCount++;
        }
      } else if (msg.ruleId === 'no-useless-escape') {
        if (fixUselessEscape(result.filePath, msg)) {
          fixedCount++;
        }
      }
    }
  }

  console.log(`Fixed ${fixedCount} errors`);

  // Run ESLint --fix for remaining auto-fixable errors
  console.log('Running ESLint --fix for remaining errors...');
  spawnSync('npm', ['run', 'lint', '--', '--fix'], {
    stdio: 'inherit',
    shell: true,
  });
}

main();
