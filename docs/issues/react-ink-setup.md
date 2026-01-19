# React and Ink Setup Issues

Issues encountered while setting up React 19 with Ink 6 in a monorepo.

---

## Issue: React Version Mismatch

### Problem
```
TypeError: Cannot read properties of undefined (reading 'ReactCurrentOwner')
```

Multiple React versions were installed in the monorepo:
- `ink@6.x` requires `react@>=19.0.0`
- `ink-spinner@5.0.0` bundled `ink@5.2.1` which required `react@18.x`
- `ink-text-input@6.0.0` also had version conflicts

### Solution
1. Use exact same versions as gemini-cli reference project:
   ```json
   {
     "ink": "^6.2.3",
     "ink-spinner": "^5.0.0",
     "react": "^19.1.0"
   }
   ```

2. Remove `ink-text-input` (caused conflicts) and implement custom input handling using Ink's `useInput` hook

3. Clean reinstall to dedupe dependencies:
   ```bash
   rm -rf node_modules packages/*/node_modules package-lock.json
   npm install
   ```

**File:** `packages/cli/package.json`

---

## Issue: JSX Namespace Not Found

### Problem
```
error TS2503: Cannot find namespace 'JSX'.
```

With React 19 and the new JSX transform, `JSX.Element` is no longer directly available.

### Solution
Replace `JSX.Element` with `React.ReactElement` in all component return types:

```typescript
// Before
function Component(): JSX.Element { ... }

// After
function Component(): React.ReactElement { ... }
```

**Files:** All `.tsx` files in `packages/cli/src/ui/`

---

## Issue: TSX File Extension Required

### Problem
TypeScript files using JSX syntax (React components) need the `.tsx` extension, but `app.ts` was importing React components.

### Solution
Rename `app.ts` to `app.tsx`:

```bash
mv packages/cli/src/app.ts packages/cli/src/app.tsx
```

The import in `index.ts` (`import { runApp } from './app.js'`) continues to work because TypeScript compiles `.tsx` to `.js`.

**File:** `packages/cli/src/app.tsx`

---

## Issue: tsconfig.json JSX Configuration

### Problem
TypeScript wasn't recognizing JSX syntax properly for React 19.

### Solution
Update `tsconfig.json` with proper JSX settings:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "react",
    "esModuleInterop": true
  },
  "include": ["src/**/*", "src/**/*.tsx"]
}
```

**File:** `packages/cli/tsconfig.json`

---

## Issue: Monorepo Dependency Hoisting

### Problem
In a monorepo with npm workspaces, React was installed in multiple locations:
- Root `node_modules/react`
- `packages/cli/node_modules/react`

This caused "Invalid hook call" errors because components used different React instances.

### Solution
1. Keep React in the CLI package's dependencies (not root)
2. Let npm workspaces handle hoisting naturally
3. Clean install to ensure proper deduplication:

```bash
rm -rf node_modules packages/*/node_modules package-lock.json
npm install
```

Verify single React version:
```bash
npm ls react
```

Should show single deduped version:
```
└─┬ @beans/cli@0.1.0
  └── react@19.2.3
```

---

## Issue: npm Cache Permission Error

### Problem
```
npm error EACCES: permission denied, rename '/Users/bean/.npm/_cacache/tmp/...'
npm error Your cache folder contains root-owned files
```

The global npm cache had permission issues preventing package installation.

### Solution
Use a local cache directory for npm install:

```bash
npm install --cache .npm-cache
```

Add `.npm-cache/` to `.gitignore`:
```
# Cache
.cache/
.npm/
.npm-cache/
```

**File:** `.gitignore`
