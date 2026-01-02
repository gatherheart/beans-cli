# Architecture Documentation

## Overview

This directory contains architecture documentation for the Beans Agent project.

## Files

- `overview.md` - System architecture overview, data flows, design decisions

## Guidelines

1. **Keep diagrams simple**: Use ASCII art for portability
2. **Document decisions**: Explain WHY, not just WHAT
3. **Reference gemini-cli**: Check `../../gemini-cli` for patterns
4. **Update when code changes**: Architecture docs must match implementation

## Adding New Architecture Docs

When adding new architectural components:
1. Update `overview.md` with component overview
2. Create new file for detailed component docs if needed
3. Update relevant CLAUDE.md files in code directories
