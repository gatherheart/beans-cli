/**
 * Shared utilities for tools
 */

import * as path from 'path';
import * as os from 'os';

/**
 * Expand tilde (~) to home directory
 */
export function expandTilde(filePath: string): string {
  if (filePath.startsWith('~/')) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  if (filePath === '~') {
    return os.homedir();
  }
  return filePath;
}
