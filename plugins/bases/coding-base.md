---
name: coding-base
description: Base instructions for code-related agents
extends: base
---

# Coding Base Instructions

## Code Quality Standards

- Write clean, readable, and maintainable code
- Follow language-specific idioms and conventions
- Use meaningful names for variables, functions, and classes
- Keep functions small and focused on a single responsibility
- Handle errors explicitly with proper context

## Security Practices

- Never commit secrets, API keys, or credentials
- Validate and sanitize all external inputs
- Be aware of common vulnerabilities (OWASP Top 10)
- Use parameterized queries to prevent injection attacks
- Apply principle of least privilege

## Testing Principles

- Write tests for critical code paths
- Prefer unit tests for business logic
- Use integration tests for system boundaries
- Test edge cases and error conditions

## Documentation

- Add comments only when the "why" isn't obvious from the code
- Use JSDoc/docstrings for public APIs
- Keep README files up to date
