# Standard Operating Procedures

Development guidelines and coding standards for the Beans Agent project.

## Documents

| Document | Description |
|----------|-------------|
| [development.md](development.md) | Development setup, build, test commands |
| [testing.md](testing.md) | Testing guidelines with Vitest |
| [coding.md](coding.md) | TypeScript and React coding standards |

## Quick Reference

### Before Committing

```bash
npm run preflight   # Build, test, typecheck, lint
```

### Key Principles

1. **No external state libraries** - Use React Context + hooks (gemini-cli pattern)
2. **Prefer plain objects** - Over classes for React compatibility
3. **Avoid `any` types** - Use `unknown` and type narrowing
4. **Functional components** - With hooks, no class components
5. **Test the public API** - Not internal implementations
