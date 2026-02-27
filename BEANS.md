---
version: 1
enabled: true
---

# Beans Code Memory

## Project Preferences

- Always use TypeScript strict mode
- Prefer functional components with hooks in React
- Use Vitest for testing, not Jest
- Follow the gemini-cli patterns for UI components

## Code Style

- Use 2-space indentation
- Prefer `const` over `let`
- Use descriptive variable names
- Add JSDoc comments for public APIs

## Testing Guidelines

- Co-locate test files with source files (\*.test.ts)
- Use `vi.mock()` for mocking dependencies
- Always clean up mocks in `afterEach`
