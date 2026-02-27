import { describe, it, expect } from "vitest";
import {
  classifyError,
  shouldTriggerFallback,
  calculateBackoff,
  type ErrorCategory,
} from "../../../packages/core/src/llm/error-classifier.js";

describe("classifyError", () => {
  describe("quota_exceeded", () => {
    it("should classify quota errors", () => {
      const result = classifyError(new Error("quota exceeded"));
      expect(result.category).toBe("quota_exceeded");
      expect(result.retryable).toBe(false);
      expect(result.shouldFallback).toBe(true);
    });

    it("should classify resource exhausted errors", () => {
      const result = classifyError(new Error("resource has been exhausted"));
      expect(result.category).toBe("quota_exceeded");
    });

    it("should classify insufficient quota errors", () => {
      const result = classifyError(
        new Error("insufficient quota for this request"),
      );
      expect(result.category).toBe("quota_exceeded");
    });
  });

  describe("rate_limit", () => {
    it("should classify rate limit errors", () => {
      const result = classifyError(new Error("rate limit reached"));
      expect(result.category).toBe("rate_limit");
      expect(result.retryable).toBe(true);
      expect(result.shouldFallback).toBe(true);
    });

    it("should classify 429 errors", () => {
      const result = classifyError(new Error("HTTP 429 Too Many Requests"));
      expect(result.category).toBe("rate_limit");
    });

    it("should classify throttling errors", () => {
      const result = classifyError(new Error("request was throttled"));
      expect(result.category).toBe("rate_limit");
    });
  });

  describe("server_error", () => {
    it("should classify 500 errors", () => {
      const result = classifyError(new Error("HTTP 500 Internal Server Error"));
      expect(result.category).toBe("server_error");
      expect(result.retryable).toBe(true);
      expect(result.shouldFallback).toBe(true);
    });

    it("should classify 503 errors", () => {
      const result = classifyError(new Error("503 Service Unavailable"));
      expect(result.category).toBe("server_error");
    });

    it("should classify service unavailable errors", () => {
      const result = classifyError(
        new Error("service is temporarily unavailable"),
      );
      expect(result.category).toBe("server_error");
    });
  });

  describe("network_error", () => {
    it("should classify network errors", () => {
      const result = classifyError(new Error("network request failed"));
      expect(result.category).toBe("network_error");
      expect(result.retryable).toBe(true);
      expect(result.shouldFallback).toBe(false);
    });

    it("should classify connection refused errors", () => {
      const result = classifyError(new Error("ECONNREFUSED"));
      expect(result.category).toBe("network_error");
    });

    it("should classify timeout errors", () => {
      const result = classifyError(new Error("ETIMEDOUT"));
      expect(result.category).toBe("network_error");
    });
  });

  describe("invalid_request", () => {
    it("should classify invalid request errors", () => {
      const result = classifyError(new Error("invalid request format"));
      expect(result.category).toBe("invalid_request");
      expect(result.retryable).toBe(false);
      expect(result.shouldFallback).toBe(false);
    });

    it("should classify 400 errors", () => {
      const result = classifyError(new Error("HTTP 400 Bad Request"));
      expect(result.category).toBe("invalid_request");
    });
  });

  describe("auth_error", () => {
    it("should classify 401 errors", () => {
      const result = classifyError(new Error("HTTP 401 Unauthorized"));
      expect(result.category).toBe("auth_error");
      expect(result.retryable).toBe(false);
      expect(result.shouldFallback).toBe(false);
    });

    it("should classify invalid key errors", () => {
      const result = classifyError(new Error("invalid API key"));
      expect(result.category).toBe("auth_error");
    });
  });

  describe("unknown", () => {
    it("should classify unknown errors", () => {
      const result = classifyError(new Error("something went wrong"));
      expect(result.category).toBe("unknown");
      expect(result.retryable).toBe(false);
      expect(result.shouldFallback).toBe(false);
    });
  });
});

describe("shouldTriggerFallback", () => {
  it("should return true when category is in fallback list", () => {
    const fallbackCategories: ErrorCategory[] = [
      "quota_exceeded",
      "rate_limit",
    ];
    expect(shouldTriggerFallback("quota_exceeded", fallbackCategories)).toBe(
      true,
    );
    expect(shouldTriggerFallback("rate_limit", fallbackCategories)).toBe(true);
  });

  it("should return false when category is not in fallback list", () => {
    const fallbackCategories: ErrorCategory[] = [
      "quota_exceeded",
      "rate_limit",
    ];
    expect(shouldTriggerFallback("invalid_request", fallbackCategories)).toBe(
      false,
    );
    expect(shouldTriggerFallback("auth_error", fallbackCategories)).toBe(false);
  });
});

describe("calculateBackoff", () => {
  it("should calculate exponential backoff", () => {
    const delay1 = calculateBackoff(1, 1000);
    const delay2 = calculateBackoff(2, 1000);
    const delay3 = calculateBackoff(3, 1000);

    // Allow for jitter (up to 10%)
    expect(delay1).toBeGreaterThanOrEqual(1000);
    expect(delay1).toBeLessThanOrEqual(1100);

    expect(delay2).toBeGreaterThanOrEqual(2000);
    expect(delay2).toBeLessThanOrEqual(2200);

    expect(delay3).toBeGreaterThanOrEqual(4000);
    expect(delay3).toBeLessThanOrEqual(4400);
  });

  it("should respect max delay", () => {
    const delay = calculateBackoff(10, 1000, 5000);
    expect(delay).toBeLessThanOrEqual(5000);
  });
});
