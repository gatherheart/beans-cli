# Testing Guidelines

This project uses **Vitest** as its primary testing framework.

## Test Structure

- **Framework**: Vitest (`describe`, `it`, `expect`, `vi`)
- **File Location**: Test files co-located with source (`*.test.ts`, `*.test.tsx`)
- **Configuration**: `vitest.config.ts`

## Setup and Teardown

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('MyModule', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should do something', () => {
    // test
  });
});
```

## Mocking

### ES Modules

```typescript
vi.mock('module-name', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    someFunction: vi.fn(),
  };
});
```

### Hoisted Mocks

For mocks needed before imports:

```typescript
const myMock = vi.hoisted(() => vi.fn());

vi.mock('some-module', () => ({
  default: myMock,
}));
```

### Mock Functions

```typescript
const mockFn = vi.fn();
mockFn.mockImplementation(() => 'value');
mockFn.mockResolvedValue('async value');
mockFn.mockRejectedValue(new Error('error'));
```

### Spying

```typescript
const spy = vi.spyOn(object, 'methodName');
// ... test
spy.mockRestore();
```

## Commonly Mocked Modules

- **Node.js**: `fs`, `fs/promises`, `os`, `path`, `child_process`
- **External SDKs**: `@google/genai`, `@modelcontextprotocol/sdk`
- **Internal**: Dependencies from other packages

## React Component Testing (Ink)

```typescript
import { render } from 'ink-testing-library';

it('renders correctly', () => {
  const { lastFrame } = render(<MyComponent />);
  expect(lastFrame()).toContain('expected text');
});
```

- Use `render()` from `ink-testing-library`
- Assert output with `lastFrame()`
- Wrap in necessary `Context.Provider`s
- Mock complex child components

## Async Testing

```typescript
// Async/await
it('handles async', async () => {
  const result = await asyncFunction();
  expect(result).toBe('value');
});

// Fake timers
it('handles timers', async () => {
  vi.useFakeTimers();
  // ... test
  await vi.advanceTimersByTimeAsync(1000);
  vi.useRealTimers();
});

// Promise rejections
it('handles errors', async () => {
  await expect(failingPromise).rejects.toThrow('error message');
});
```

## Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage
```
