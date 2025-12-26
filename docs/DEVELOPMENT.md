# Development Guide

## Prerequisites

- Node.js >= 20.0.0

## Installation

```bash
npm install
```

This installs dependencies for all workspaces.

## Build

Build all packages:

```bash
npm run build
```

Build individual packages:

```bash
npm run build:core   # Build @beans/core
npm run build:cli    # Build @beans/cli
```

Clean build artifacts:

```bash
npm run clean
```

## Run

Start the application:

```bash
npm start
```

Run in development mode (with hot reload):

```bash
npm run dev
```

## Test

Run all tests:

```bash
npm test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run tests with coverage:

```bash
npm run test:coverage
```

## Code Quality

Type checking:

```bash
npm run typecheck
```

Lint code:

```bash
npm run lint
```

Lint and auto-fix:

```bash
npm run lint:fix
```

Format code:

```bash
npm run format
```

## Project Structure

```
beans-code/
├── packages/
│   ├── core/          # @beans/core - Agent framework, tools, LLM integration
│   └── cli/           # @beans/cli - Interactive terminal interface
├── docs/              # Documentation
├── package.json       # Root workspace configuration
└── tsconfig.json      # TypeScript configuration
```
