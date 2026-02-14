/**
 * Tests for the multi-agent debug logger
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  setMultiAgentDebug,
  isMultiAgentDebugEnabled,
} from '../../../packages/core/src/agents/multi-agent/debug-logger.js';

describe('MultiAgent Debug Logger', () => {
  beforeEach(() => {
    // Reset debug state before each test
    setMultiAgentDebug(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setMultiAgentDebug(false);
  });

  describe('setMultiAgentDebug', () => {
    it('should enable debug mode', () => {
      expect(isMultiAgentDebugEnabled()).toBe(false);

      setMultiAgentDebug(true);

      expect(isMultiAgentDebugEnabled()).toBe(true);
    });

    it('should disable debug mode', () => {
      setMultiAgentDebug(true);
      expect(isMultiAgentDebugEnabled()).toBe(true);

      setMultiAgentDebug(false);

      expect(isMultiAgentDebugEnabled()).toBe(false);
    });
  });

  describe('isMultiAgentDebugEnabled', () => {
    it('should return false by default', () => {
      expect(isMultiAgentDebugEnabled()).toBe(false);
    });

    it('should return true after enabling', () => {
      setMultiAgentDebug(true);
      expect(isMultiAgentDebugEnabled()).toBe(true);
    });
  });
});
