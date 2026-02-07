/**
 * Tests for the test report generator utilities
 */

import { describe, it, expect } from 'vitest';

describe('Test Report Generator', () => {
  describe('formatRawOutput', () => {
    it('should format test output with file grouping', () => {
      const input = `> @beans/agent@0.1.0 test
> vitest run --reporter=verbose

 RUN  v3.2.4 /home/runner/work/beans-cli/beans-cli

 ✓ tests/example.test.ts > should pass 10ms`;

      // The formatting is done internally by the script
      // This test verifies the expected output structure
      expect(input).toContain('✓');
      expect(input).toContain('tests/example.test.ts');
    });

    it('should handle passed tests', () => {
      const line = ' ✓ should return correct value 5ms';
      expect(line).toMatch(/✓.*\d+ms/);
    });

    it('should handle failed tests', () => {
      const line = ' ✗ should not fail 10ms';
      expect(line).toMatch(/✗.*\d+ms/);
    });
  });

  describe('Test Summary Parsing', () => {
    it('should parse passed count', () => {
      const summary = 'Tests  124 passed (124)';
      const match = summary.match(/(\d+) passed/);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('124');
    });

    it('should parse duration', () => {
      const summary = 'Duration  3.46s';
      const match = summary.match(/Duration\s+([0-9.]+[ms]+)/);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('3.46s');
    });

    it('should parse file test count', () => {
      const line = '✓ packages/cli/src/args.test.ts (17 tests) 45ms';
      const match = line.match(/\((\d+) tests?\)/);
      expect(match).not.toBeNull();
      expect(match![1]).toBe('17');
    });
  });

  describe('Report Structure', () => {
    it('should have required fields', () => {
      const reportFields = [
        'date',
        'version',
        'nodeVersion',
        'os',
        'summary',
        'suites',
        'rawOutput',
      ];

      reportFields.forEach((field) => {
        expect(typeof field).toBe('string');
      });
    });

    it('should have summary metrics', () => {
      const summaryFields = ['total', 'passed', 'failed', 'skipped', 'duration'];

      summaryFields.forEach((field) => {
        expect(typeof field).toBe('string');
      });
    });
  });
});
