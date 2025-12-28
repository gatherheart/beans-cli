import { config } from 'dotenv';
import { resolve } from 'path';

let envLoaded = false;

/**
 * Load environment variables from .env file
 * Searches in current directory and parent directories
 */
export function loadEnv(): void {
  if (envLoaded) return;

  // Try to load from current working directory
  const result = config();

  if (result.error) {
    // Try to load from project root (up to 5 levels)
    let dir = process.cwd();
    for (let i = 0; i < 5; i++) {
      const envPath = resolve(dir, '.env');
      const attempt = config({ path: envPath });
      if (!attempt.error) {
        envLoaded = true;
        return;
      }
      const parent = resolve(dir, '..');
      if (parent === dir) break;
      dir = parent;
    }
  } else {
    envLoaded = true;
  }
}
