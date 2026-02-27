// Built-in tools for the agent
export * from './read-file.js';
export * from './write-file.js';
export * from './shell.js';
export * from './glob.js';
export * from './grep.js';
export * from './web-search.js';
export * from './task-tools.js';
export * from './save-memory.js';

import { ReadFileTool } from './read-file.js';
import { WriteFileTool } from './write-file.js';
import { ShellTool } from './shell.js';
import { GlobTool } from './glob.js';
import { GrepTool } from './grep.js';
import { WebSearchTool } from './web-search.js';
import { TaskCreateTool, TaskUpdateTool, TaskGetTool, TaskListTool } from './task-tools.js';
import { SaveMemoryTool } from './save-memory.js';
import type { Tool } from '../types.js';

/**
 * Create all built-in tools with default configuration
 */
export function createBuiltinTools(): Tool[] {
  return [
    new ReadFileTool(),
    new WriteFileTool(),
    new ShellTool(),
    new GlobTool(),
    new GrepTool(),
    new WebSearchTool(),
    new TaskCreateTool(),
    new TaskUpdateTool(),
    new TaskGetTool(),
    new TaskListTool(),
    new SaveMemoryTool(),
  ];
}
