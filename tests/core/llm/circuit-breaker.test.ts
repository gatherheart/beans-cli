import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  CircuitBreaker,
  CircuitBreakerRegistry,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from "../../../packages/core/src/llm/circuit-breaker.js";

describe("CircuitBreaker", () => {
  let breaker: CircuitBreaker;

  beforeEach(() => {
    vi.useFakeTimers();
    breaker = new CircuitBreaker();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("initial state", () => {
    it("should start in closed state", () => {
      expect(breaker.getState()).toBe("closed");
    });

    it("should allow requests initially", () => {
      expect(breaker.isAllowed()).toBe(true);
    });
  });

  describe("recording failures", () => {
    it("should stay closed below threshold", () => {
      // Default threshold is 5
      for (let i = 0; i < 4; i++) {
        breaker.recordFailure();
      }
      expect(breaker.getState()).toBe("closed");
      expect(breaker.isAllowed()).toBe(true);
    });

    it("should open circuit at threshold", () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure();
      }
      expect(breaker.getState()).toBe("open");
      expect(breaker.isAllowed()).toBe(false);
    });

    it("should respect custom threshold", () => {
      const customBreaker = new CircuitBreaker({ failureThreshold: 2 });

      customBreaker.recordFailure();
      expect(customBreaker.getState()).toBe("closed");

      customBreaker.recordFailure();
      expect(customBreaker.getState()).toBe("open");
    });
  });

  describe("recording successes", () => {
    it("should reset failure count on success", () => {
      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordSuccess();

      // Now add more failures - should need full threshold again
      for (let i = 0; i < 4; i++) {
        breaker.recordFailure();
      }
      expect(breaker.getState()).toBe("closed");
    });
  });

  describe("half-open state", () => {
    it("should transition to half-open after timeout", () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure();
      }
      expect(breaker.getState()).toBe("open");

      // Advance time past reset timeout (default 30s)
      vi.advanceTimersByTime(30001);

      expect(breaker.getState()).toBe("half_open");
      expect(breaker.isAllowed()).toBe(true);
    });

    it("should close after success threshold in half-open", () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure();
      }

      // Transition to half-open
      vi.advanceTimersByTime(30001);
      expect(breaker.getState()).toBe("half_open");

      // Default success threshold is 2
      breaker.recordSuccess();
      expect(breaker.getState()).toBe("half_open");

      breaker.recordSuccess();
      expect(breaker.getState()).toBe("closed");
    });

    it("should reopen on failure in half-open", () => {
      // Open the circuit
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure();
      }

      // Transition to half-open
      vi.advanceTimersByTime(30001);
      expect(breaker.getState()).toBe("half_open");

      // Failure should reopen
      breaker.recordFailure();
      expect(breaker.getState()).toBe("open");
    });
  });

  describe("reset", () => {
    it("should reset to closed state", () => {
      for (let i = 0; i < 5; i++) {
        breaker.recordFailure();
      }
      expect(breaker.getState()).toBe("open");

      breaker.reset();
      expect(breaker.getState()).toBe("closed");
      expect(breaker.isAllowed()).toBe(true);
    });
  });

  describe("getMetrics", () => {
    it("should return circuit metrics", () => {
      breaker.recordFailure();
      breaker.recordFailure();

      const metrics = breaker.getMetrics();
      expect(metrics.state).toBe("closed");
      expect(metrics.failureCount).toBe(2);
      expect(metrics.successCount).toBe(0);
      expect(metrics.lastFailureTime).toBeDefined();
    });
  });
});

describe("CircuitBreakerRegistry", () => {
  let registry: CircuitBreakerRegistry;

  beforeEach(() => {
    vi.useFakeTimers();
    registry = new CircuitBreakerRegistry();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("should create breakers on demand", () => {
    const breaker = registry.get("model-1");
    expect(breaker).toBeInstanceOf(CircuitBreaker);
  });

  it("should return same breaker for same model", () => {
    const breaker1 = registry.get("model-1");
    const breaker2 = registry.get("model-1");
    expect(breaker1).toBe(breaker2);
  });

  it("should track multiple models independently", () => {
    // Open circuit for model-1
    for (let i = 0; i < 5; i++) {
      registry.recordFailure("model-1");
    }

    expect(registry.isAllowed("model-1")).toBe(false);
    expect(registry.isAllowed("model-2")).toBe(true);
  });

  it("should get all metrics", () => {
    registry.recordFailure("model-1");
    registry.recordSuccess("model-2");

    const metrics = registry.getAllMetrics();
    expect(metrics.get("model-1")?.failureCount).toBe(1);
    expect(metrics.get("model-2")?.successCount).toBe(0); // Success resets count
  });

  it("should reset all breakers", () => {
    for (let i = 0; i < 5; i++) {
      registry.recordFailure("model-1");
      registry.recordFailure("model-2");
    }

    expect(registry.isAllowed("model-1")).toBe(false);
    expect(registry.isAllowed("model-2")).toBe(false);

    registry.resetAll();

    expect(registry.isAllowed("model-1")).toBe(true);
    expect(registry.isAllowed("model-2")).toBe(true);
  });
});

describe("DEFAULT_CIRCUIT_BREAKER_CONFIG", () => {
  it("should have expected default values", () => {
    expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.failureThreshold).toBe(5);
    expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.resetTimeout).toBe(30000);
    expect(DEFAULT_CIRCUIT_BREAKER_CONFIG.successThreshold).toBe(2);
  });
});
