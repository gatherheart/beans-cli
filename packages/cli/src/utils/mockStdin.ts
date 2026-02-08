/**
 * Mock stdin for non-TTY environments (e2e testing)
 *
 * Ink requires stdin to support setRawMode(), which is only available
 * in TTY environments. This module creates a compatible stdin stream
 * for e2e tests where the CLI is spawned as a subprocess.
 *
 * Key insight: Ink's parseKeypress expects each character to be emitted
 * separately (like a real TTY in raw mode). When data is written as a
 * bulk string, we need to emit each character individually with small
 * delays so Ink can process them correctly.
 */

import { Readable } from 'node:stream';

interface MockStdin extends Readable {
  isTTY: boolean;
  isRaw: boolean;
  setRawMode: (mode: boolean) => MockStdin;
  ref: () => MockStdin;
  unref: () => MockStdin;
  write: (chunk: Buffer | string) => boolean;
  end: () => void;
}

/**
 * Creates a mock stdin stream that supports setRawMode for Ink compatibility.
 * In non-TTY environments, this allows Ink to render without throwing errors.
 *
 * This implementation emits each character separately to simulate TTY behavior,
 * allowing Ink's useInput hook to correctly detect key presses like Enter.
 */
export function createMockStdin(): MockStdin {
  // Queue for pending characters
  const pendingChars: string[] = [];
  let isRunning = false;
  const CHAR_DELAY_MS = 25;

  const stream = new Readable({
    read() {
      // No-op: we push data via the write method
    },
  }) as MockStdin;

  // Mark as TTY-like for Ink
  stream.isTTY = true;
  stream.isRaw = false;

  // setRawMode is required by Ink but can be a no-op in test mode
  stream.setRawMode = function (mode: boolean): MockStdin {
    this.isRaw = mode;
    return this;
  };

  // ref/unref are called by Ink's useInput hook - no-op in mock
  stream.ref = function (): MockStdin {
    return this;
  };

  stream.unref = function (): MockStdin {
    return this;
  };

  // end() is called when stdin closes
  stream.end = function (): void {
    stream.push(null);
  };

  // Process characters from queue one at a time
  const processNextChar = () => {
    if (pendingChars.length === 0) {
      isRunning = false;
      return;
    }

    const char = pendingChars.shift()!;
    stream.push(char);

    // Schedule next character
    setTimeout(processNextChar, CHAR_DELAY_MS);
  };

  // Start the processing loop if not already running
  const startProcessing = () => {
    if (isRunning) return;
    isRunning = true;
    // Use setTimeout(0) to start on next tick
    setTimeout(processNextChar, 0);
  };

  // write() accepts input data and queues characters for sequential emission
  stream.write = function (chunk: Buffer | string): boolean {
    const str = typeof chunk === 'string' ? chunk : chunk.toString();

    // Add all characters to the queue
    for (const char of str) {
      pendingChars.push(char);
    }

    // Start processing if not already running
    startProcessing();

    return true;
  };

  return stream;
}

/**
 * Check if the current stdin supports raw mode.
 * Returns false in non-TTY environments (CI, piped input, etc.)
 */
export function isRawModeSupported(): boolean {
  return (
    process.stdin.isTTY === true &&
    typeof (process.stdin as NodeJS.ReadStream).setRawMode === 'function'
  );
}
