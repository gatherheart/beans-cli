---
name: testing-patterns
triggers:
  - write tests
  - unit test
  - integration test
  - test coverage
  - mocking
---

# Testing Patterns

## Use When

User requests help with:
- Writing unit or integration tests
- Setting up test frameworks
- Mocking dependencies
- Improving test coverage
- Test-driven development

## Instructions

### Unit Testing Principles

1. **AAA Pattern**: Arrange, Act, Assert
2. **Single Responsibility**: One assertion per test concept
3. **Descriptive Names**: `should_returnError_when_inputIsInvalid`
4. **Isolation**: No dependencies between tests
5. **Fast Execution**: Milliseconds per test

### Mocking Strategies

```typescript
// Dependency injection for testability
class UserService {
  constructor(private readonly userRepo: UserRepository) {}

  async getUser(id: string): Promise<User> {
    return this.userRepo.findById(id);
  }
}

// Test with mock
const mockRepo = { findById: vi.fn() };
const service = new UserService(mockRepo);
```

### Integration Testing

- Test real interactions between components
- Use test databases or containers
- Clean up state between tests
- Focus on critical paths

### Coverage Guidelines

| Type | Target |
|------|--------|
| Critical business logic | 90%+ |
| API endpoints | 80%+ |
| Utility functions | 70%+ |
| UI components | 60%+ |

## Resources

### Jest/Vitest Setup

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
  },
});
```

### Pytest Setup

```python
# conftest.py
import pytest

@pytest.fixture
def db_session():
    session = create_test_session()
    yield session
    session.rollback()
```
