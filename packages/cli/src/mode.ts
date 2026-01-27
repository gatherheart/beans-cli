/**
 * Application mode management using binary flags
 */

export const Mode = {
  NONE: 0b0000,
  DEBUG: 0b0001,
} as const;

export type ModeFlags = number;

let currentMode: ModeFlags = Mode.NONE;

export function setMode(flags: ModeFlags): void {
  currentMode = flags;
}

export function addMode(flag: ModeFlags): void {
  currentMode |= flag;
}

export function removeMode(flag: ModeFlags): void {
  currentMode &= ~flag;
}

export function hasMode(flag: ModeFlags): boolean {
  return (currentMode & flag) !== 0;
}

export function getMode(): ModeFlags {
  return currentMode;
}

export function isDebug(): boolean {
  return hasMode(Mode.DEBUG);
}
