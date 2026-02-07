import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { parseArgs } from '../../packages/cli/src/args.js';

describe('CLI Args Parser', () => {
  const originalArgv = process.argv;

  beforeEach(() => {
    process.argv = ['node', 'beans'];
  });

  afterEach(() => {
    process.argv = originalArgv;
  });

  it('should parse --list-models flag', async () => {
    process.argv = ['node', 'beans', '--list-models'];
    const args = await parseArgs();
    expect(args.listModels).toBe(true);
  });

  it('should parse -h flag', async () => {
    process.argv = ['node', 'beans', '-h'];
    const args = await parseArgs();
    expect(args.help).toBe(true);
  });

  it('should parse --help flag', async () => {
    process.argv = ['node', 'beans', '--help'];
    const args = await parseArgs();
    expect(args.help).toBe(true);
  });

  it('should parse -v flag', async () => {
    process.argv = ['node', 'beans', '-v'];
    const args = await parseArgs();
    expect(args.version).toBe(true);
  });

  it('should parse -m flag with model name', async () => {
    process.argv = ['node', 'beans', '-m', 'gpt-4o'];
    const args = await parseArgs();
    expect(args.model).toBe('gpt-4o');
  });

  it('should parse --model flag with model name', async () => {
    process.argv = ['node', 'beans', '--model', 'gemini-2.0-flash'];
    const args = await parseArgs();
    expect(args.model).toBe('gemini-2.0-flash');
  });

  it('should parse --yolo flag', async () => {
    process.argv = ['node', 'beans', '--yolo'];
    const args = await parseArgs();
    expect(args.yolo).toBe(true);
  });

  it('should parse --verbose flag', async () => {
    process.argv = ['node', 'beans', '--verbose'];
    const args = await parseArgs();
    expect(args.verbose).toBe(true);
  });

  it('should parse --cwd flag with path', async () => {
    process.argv = ['node', 'beans', '--cwd', '/path/to/project'];
    const args = await parseArgs();
    expect(args.cwd).toBe('/path/to/project');
  });

  it('should parse -c flag for continue', async () => {
    process.argv = ['node', 'beans', '-c'];
    const args = await parseArgs();
    expect(args.continue).toBe(true);
  });

  it('should parse positional arguments as prompt', async () => {
    process.argv = ['node', 'beans', 'fix', 'the', 'bug'];
    const args = await parseArgs();
    expect(args.prompt).toBe('fix the bug');
  });

  it('should handle multiple flags together', async () => {
    process.argv = ['node', 'beans', '--model', 'gpt-4o', '--yolo', 'write tests'];
    const args = await parseArgs();
    expect(args.model).toBe('gpt-4o');
    expect(args.yolo).toBe(true);
    expect(args.prompt).toBe('write tests');
  });

  it('should default all boolean flags to false', async () => {
    process.argv = ['node', 'beans'];
    const args = await parseArgs();
    expect(args.help).toBe(false);
    expect(args.version).toBe(false);
    expect(args.continue).toBe(false);
    expect(args.yolo).toBe(false);
    expect(args.verbose).toBe(false);
    expect(args.listModels).toBe(false);
    expect(args.debug).toBe(false);
  });

  it('should parse --debug flag', async () => {
    process.argv = ['node', 'beans', '--debug'];
    const args = await parseArgs();
    expect(args.debug).toBe(true);
  });

  it('should parse --ui-test flag', async () => {
    process.argv = ['node', 'beans', '--ui-test'];
    const args = await parseArgs();
    expect(args.uiTest).toBe(true);
  });

  it('should parse --ui-test-scenario flag with scenario name', async () => {
    process.argv = ['node', 'beans', '--ui-test', '--ui-test-scenario', 'rapid-stream'];
    const args = await parseArgs();
    expect(args.uiTest).toBe(true);
    expect(args.uiTestScenario).toBe('rapid-stream');
  });

  it('should default uiTest to false', async () => {
    process.argv = ['node', 'beans'];
    const args = await parseArgs();
    expect(args.uiTest).toBe(false);
    expect(args.uiTestScenario).toBeUndefined();
  });
});
