# Coding Standards

TypeScript and React coding standards for the Beans Agent project.

## TypeScript Guidelines

### Prefer Plain Objects over Classes

```typescript
// Preferred: Plain object with interface
interface User {
  id: string;
  name: string;
}

function createUser(name: string): User {
  return { id: crypto.randomUUID(), name };
}

// Avoid: Class-based approach
class User {
  constructor(public id: string, public name: string) {}
}
```

**Why:**
- Seamless React integration (easily passed as props)
- Reduced boilerplate
- Enhanced readability
- Simplified immutability
- Better JSON serialization

### Use ES Module Encapsulation

```typescript
// Private (not exported)
function internalHelper() { ... }

// Public API (exported)
export function publicFunction() {
  return internalHelper();
}
```

**Why:**
- Clear public API boundaries
- Encourages testing public API, not internals
- If you need to test a "private" function, extract it to a separate module

### Avoid `any` Types

```typescript
// Bad
function process(data: any) {
  return data.value;
}

// Good
function process(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: unknown }).value;
  }
  throw new Error('Invalid data');
}
```

### Type Narrowing in Switch

```typescript
type Action = { type: 'add' } | { type: 'remove' };

function handleAction(action: Action) {
  switch (action.type) {
    case 'add':
      // handle add
      break;
    case 'remove':
      // handle remove
      break;
    default:
      // TypeScript will error if a case is missing
      const _exhaustive: never = action;
      throw new Error(`Unhandled action: ${_exhaustive}`);
  }
}
```

### Embrace Array Operators

```typescript
// Preferred: Functional approach
const active = users
  .filter(u => u.active)
  .map(u => u.name)
  .sort();

// Avoid: Imperative loops
const active = [];
for (const u of users) {
  if (u.active) {
    active.push(u.name);
  }
}
active.sort();
```

## React Guidelines

### Functional Components Only

```typescript
// Good
function MyComponent({ name }: { name: string }): React.ReactElement {
  return <Text>{name}</Text>;
}

// Bad - no class components
class MyComponent extends React.Component { ... }
```

### Keep Components Pure

- No side effects during rendering
- One-way data flow (props down, callbacks up)
- Never mutate state directly

### useEffect Best Practices

```typescript
// Primary use: Sync with external state
useEffect(() => {
  const subscription = subscribe(callback);
  return () => subscription.unsubscribe(); // Cleanup
}, [callback]);

// Avoid:
// - useEffect when you can compute during render
// - setState inside useEffect (causes extra renders)
// - Missing dependencies
```

### State Management (gemini-cli pattern)

Split contexts for performance:

```typescript
// State context (read-only)
const MyStateContext = createContext<State | null>(null);

// Actions context (handlers)
const MyActionsContext = createContext<Actions | null>(null);

// Memoize context values
const stateValue = useMemo(() => ({ ... }), [deps]);
const actionsValue = useMemo(() => ({ ... }), [deps]);
```

### Custom Hooks for Domain Logic

```typescript
// Extract reusable logic
function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);

  const addMessage = useCallback((content: string) => {
    setMessages(prev => [...prev, { id: Date.now(), content }]);
  }, []);

  return { messages, addMessage };
}
```

## Style Guidelines

### Naming

- Files: `kebab-case.ts`, `PascalCase.tsx` for components
- Variables/functions: `camelCase`
- Types/interfaces: `PascalCase`
- Constants: `SCREAMING_SNAKE_CASE`
- CLI flags: `--kebab-case` (not `--snake_case`)

### Comments

Only write high-value comments:

```typescript
// Good: Explains WHY
// We batch updates to avoid overwhelming the API rate limit
const batchedUpdates = batch(updates, 100);

// Bad: Explains WHAT (obvious from code)
// Loop through users
for (const user of users) { ... }
```

### Imports

```typescript
// 1. Node.js built-ins
import fs from 'fs';
import path from 'path';

// 2. External packages
import React from 'react';
import { Box, Text } from 'ink';

// 3. Internal packages
import { Config } from '@beans/core';

// 4. Relative imports
import { MyComponent } from './MyComponent.js';
```
