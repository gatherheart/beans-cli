import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import type { AppConfig } from './types.js';

/**
 * Settings file format (subset of AppConfig that's persisted)
 */
export type Settings = Partial<AppConfig>;

/**
 * Get the settings directory path
 */
export function getSettingsDir(): string {
  const configDir =
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
  return path.join(configDir, 'beans-agent');
}

/**
 * Get the user settings file path
 */
export function getUserSettingsPath(): string {
  return path.join(getSettingsDir(), 'settings.json');
}

/**
 * Get the project settings file path
 */
export function getProjectSettingsPath(cwd: string = process.cwd()): string {
  return path.join(cwd, '.beans', 'settings.json');
}

/**
 * Load settings from user and project files
 */
export async function loadSettings(): Promise<Settings> {
  const userSettings = await loadSettingsFile(getUserSettingsPath());
  const projectSettings = await loadSettingsFile(getProjectSettingsPath());

  // Project settings override user settings
  return mergeSettings(userSettings, projectSettings);
}

/**
 * Save settings to the user settings file
 */
export async function saveSettings(settings: Settings): Promise<void> {
  const settingsPath = getUserSettingsPath();
  const settingsDir = path.dirname(settingsPath);

  // Ensure directory exists
  await fs.mkdir(settingsDir, { recursive: true });

  // Write settings with pretty formatting
  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2), 'utf-8');
}

/**
 * Load settings from a specific file
 */
async function loadSettingsFile(filePath: string): Promise<Settings> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as Settings;
  } catch {
    // File doesn't exist or is invalid - return empty settings
    return {};
  }
}

/**
 * Deep merge two settings objects
 */
function mergeSettings(base: Settings, override: Settings): Settings {
  const result: Settings = { ...base };

  for (const key of Object.keys(override) as (keyof Settings)[]) {
    const baseValue = base[key];
    const overrideValue = override[key];

    if (
      typeof baseValue === 'object' &&
      typeof overrideValue === 'object' &&
      !Array.isArray(baseValue) &&
      !Array.isArray(overrideValue)
    ) {
      // Deep merge objects
      result[key] = { ...baseValue, ...overrideValue } as Settings[typeof key];
    } else if (overrideValue !== undefined) {
      // Override with new value
      result[key] = overrideValue;
    }
  }

  return result;
}
