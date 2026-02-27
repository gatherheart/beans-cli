import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  LLMRouter,
  createRouter,
  DEFAULT_ROUTER_CONFIG,
  type RoutingEvent,
  type ClientFactory,
} from "../../../packages/core/src/llm/router.js";
import type {
  LLMClient,
  ChatRequest,
  ChatResponse,
} from "../../../packages/core/src/llm/types.js";

function createMockClient(
  responses?: ChatResponse[],
  errors?: Error[],
): LLMClient {
  let callIndex = 0;
  return {
    async chat(request: ChatRequest): Promise<ChatResponse> {
      const idx = callIndex++;
      if (errors && errors[idx]) {
        throw errors[idx];
      }
      return (
        responses?.[idx] ?? {
          content: "test response",
          model: request.model,
          finishReason: "stop",
        }
      );
    },
  };
}

function createMockClientFactory(
  clients: Map<string, LLMClient>,
): ClientFactory {
  return (model: string) => clients.get(model);
}

describe("LLMRouter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("successful calls", () => {
    it("should route to primary model", async () => {
      const mockResponse: ChatResponse = {
        content: "Hello from primary",
        model: "primary-model",
        finishReason: "stop",
      };

      const clients = new Map<string, LLMClient>();
      clients.set("primary-model", createMockClient([mockResponse]));

      const router = new LLMRouter(createMockClientFactory(clients), {
        primary: "primary-model",
      });

      const response = await router.chat({
        model: "primary-model",
        messages: [],
      });

      expect(response.content).toBe("Hello from primary");
    });

    it("should emit success event", async () => {
      const events: RoutingEvent[] = [];
      const clients = new Map<string, LLMClient>();
      clients.set("model", createMockClient());

      const router = new LLMRouter(createMockClientFactory(clients), {
        primary: "model",
        onRouting: (event) => events.push(event),
      });

      await router.chat({ model: "model", messages: [] });

      expect(events).toHaveLength(1);
      expect(events[0].type).toBe("success");
      expect(events[0].model).toBe("model");
    });
  });

  describe("retry logic", () => {
    it("should retry on retryable errors", async () => {
      vi.useRealTimers(); // Use real timers for this test

      let callCount = 0;
      const mockClient: LLMClient = {
        async chat(request: ChatRequest): Promise<ChatResponse> {
          callCount++;
          if (callCount === 1) {
            throw new Error("HTTP 500 Internal Server Error");
          }
          return {
            content: "success",
            model: request.model,
            finishReason: "stop",
          };
        },
      };

      const clients = new Map<string, LLMClient>();
      clients.set("model", mockClient);

      const events: RoutingEvent[] = [];
      const router = new LLMRouter(createMockClientFactory(clients), {
        primary: "model",
        maxRetries: 3,
        retryDelayMs: 10, // Short delay for test
        onRouting: (event) => events.push(event),
      });

      const response = await router.chat({ model: "model", messages: [] });

      expect(response.content).toBe("success");
      expect(events.filter((e) => e.type === "retry")).toHaveLength(1);
      expect(events.filter((e) => e.type === "success")).toHaveLength(1);

      vi.useFakeTimers(); // Restore fake timers
    });

    it("should not retry on non-retryable errors", async () => {
      const clients = new Map<string, LLMClient>();
      clients.set(
        "model",
        createMockClient([], [new Error("invalid request format")]),
      );

      const events: RoutingEvent[] = [];
      const router = new LLMRouter(createMockClientFactory(clients), {
        primary: "model",
        maxRetries: 3,
        onRouting: (event) => events.push(event),
      });

      await expect(
        router.chat({ model: "model", messages: [] }),
      ).rejects.toThrow("invalid request format");

      // Should only have one failure event, no retries
      expect(events.filter((e) => e.type === "retry")).toHaveLength(0);
      expect(events.filter((e) => e.type === "failure")).toHaveLength(1);
    });
  });

  describe("fallback logic", () => {
    it("should fallback on quota errors", async () => {
      const clients = new Map<string, LLMClient>();
      clients.set(
        "primary",
        createMockClient([], [new Error("quota exceeded")]),
      );
      clients.set(
        "fallback",
        createMockClient([
          {
            content: "fallback response",
            model: "fallback",
            finishReason: "stop",
          },
        ]),
      );

      const events: RoutingEvent[] = [];
      const router = new LLMRouter(createMockClientFactory(clients), {
        primary: "primary",
        fallbacks: ["fallback"],
        fallbackOn: ["quota_exceeded"],
        onRouting: (event) => events.push(event),
      });

      const response = await router.chat({ model: "primary", messages: [] });

      expect(response.content).toBe("fallback response");
      expect(events.some((e) => e.type === "fallback")).toBe(true);
    });

    it("should try multiple fallbacks in order", async () => {
      const clients = new Map<string, LLMClient>();
      clients.set(
        "primary",
        createMockClient([], [new Error("quota exceeded")]),
      );
      clients.set("fallback1", createMockClient([], [new Error("rate limit")]));
      clients.set(
        "fallback2",
        createMockClient([
          {
            content: "second fallback",
            model: "fallback2",
            finishReason: "stop",
          },
        ]),
      );

      const router = new LLMRouter(createMockClientFactory(clients), {
        primary: "primary",
        fallbacks: ["fallback1", "fallback2"],
        fallbackOn: ["quota_exceeded", "rate_limit"],
        maxRetries: 1,
      });

      const response = await router.chat({ model: "primary", messages: [] });

      expect(response.content).toBe("second fallback");
    });
  });

  describe("circuit breaker integration", () => {
    it("should skip models with open circuit", async () => {
      let primaryCallCount = 0;
      let fallbackCallCount = 0;

      const primaryClient: LLMClient = {
        async chat(): Promise<ChatResponse> {
          primaryCallCount++;
          throw new Error("server error");
        },
      };

      const fallbackClient: LLMClient = {
        async chat(request: ChatRequest): Promise<ChatResponse> {
          fallbackCallCount++;
          return {
            content: `fallback-${fallbackCallCount}`,
            model: request.model,
            finishReason: "stop",
          };
        },
      };

      const clients = new Map<string, LLMClient>();
      clients.set("primary", primaryClient);
      clients.set("fallback", fallbackClient);

      const events: RoutingEvent[] = [];
      const router = new LLMRouter(createMockClientFactory(clients), {
        primary: "primary",
        fallbacks: ["fallback"],
        fallbackOn: ["server_error"],
        maxRetries: 1,
        circuitBreaker: { failureThreshold: 2, resetTimeout: 30000 },
        onRouting: (event) => events.push(event),
      });

      // First call - primary fails, falls back
      const response1 = await router.chat({ model: "primary", messages: [] });
      expect(response1.content).toBe("fallback-1");
      expect(primaryCallCount).toBe(1);

      // Second call - primary fails again, circuit opens, falls back
      const response2 = await router.chat({ model: "primary", messages: [] });
      expect(response2.content).toBe("fallback-2");
      expect(primaryCallCount).toBe(2);

      // Third call - circuit is open for primary, should skip directly to fallback
      const response3 = await router.chat({ model: "primary", messages: [] });
      expect(response3.content).toBe("fallback-3");
      expect(primaryCallCount).toBe(2); // Should NOT have called primary again

      expect(events.some((e) => e.type === "circuit_open")).toBe(true);
    });
  });

  describe("getCircuitMetrics", () => {
    it("should return circuit metrics", async () => {
      const clients = new Map<string, LLMClient>();
      clients.set("model", createMockClient());

      const router = new LLMRouter(createMockClientFactory(clients), {
        primary: "model",
      });

      await router.chat({ model: "model", messages: [] });

      const metrics = router.getCircuitMetrics();
      const modelMetrics = metrics.get("model");
      expect(modelMetrics?.state).toBe("closed");
    });
  });

  describe("resetCircuits", () => {
    it("should reset all circuits", async () => {
      const mockClient: LLMClient = {
        async chat(): Promise<ChatResponse> {
          throw new Error("server error");
        },
      };

      const clients = new Map<string, LLMClient>();
      clients.set("model", mockClient);

      const router = new LLMRouter(createMockClientFactory(clients), {
        primary: "model",
        maxRetries: 1, // Don't retry to speed up test
        circuitBreaker: { failureThreshold: 2, resetTimeout: 30000 },
      });

      // Make calls to open the circuit
      await expect(
        router.chat({ model: "model", messages: [] }),
      ).rejects.toThrow();
      await expect(
        router.chat({ model: "model", messages: [] }),
      ).rejects.toThrow();

      // Circuit should be open now
      const metricsBeforeReset = router.getCircuitMetrics();
      expect(metricsBeforeReset.get("model")?.state).toBe("open");

      // Reset
      router.resetCircuits();

      // Should be allowed again
      const metricsAfterReset = router.getCircuitMetrics();
      expect(metricsAfterReset.get("model")?.state).toBe("closed");
    });
  });
});

describe("createRouter", () => {
  it("should create a router with default config", () => {
    const router = createRouter(() => undefined);
    expect(router).toBeInstanceOf(LLMRouter);
  });

  it("should create a router with custom config", () => {
    const router = createRouter(() => undefined, {
      primary: "custom-model",
      maxRetries: 5,
    });
    expect(router).toBeInstanceOf(LLMRouter);
  });
});

describe("DEFAULT_ROUTER_CONFIG", () => {
  it("should have expected default values", () => {
    expect(DEFAULT_ROUTER_CONFIG.primary).toBe("gemini-2.0-flash");
    expect(DEFAULT_ROUTER_CONFIG.fallbacks).toEqual([]);
    expect(DEFAULT_ROUTER_CONFIG.fallbackOn).toContain("quota_exceeded");
    expect(DEFAULT_ROUTER_CONFIG.fallbackOn).toContain("rate_limit");
    expect(DEFAULT_ROUTER_CONFIG.fallbackOn).toContain("server_error");
    expect(DEFAULT_ROUTER_CONFIG.maxRetries).toBe(3);
    expect(DEFAULT_ROUTER_CONFIG.retryDelayMs).toBe(1000);
    expect(DEFAULT_ROUTER_CONFIG.maxRetryDelayMs).toBe(30000);
  });
});
