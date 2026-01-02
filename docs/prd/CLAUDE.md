# Product Requirement Documents

## Overview

This directory contains product requirement documents (PRDs) for features in the Beans Agent project.

## Structure

Each PRD should follow this structure:
1. **Overview**: What the feature does
2. **Goals**: What we're trying to achieve
3. **Requirements**: Detailed requirements
4. **Design**: How it will be implemented
5. **Testing**: How to verify it works

## Guidelines

1. **One file per feature**: Keep PRDs focused
2. **Update when requirements change**: PRDs should match implementation
3. **Reference gemini-cli**: Check `../../gemini-cli/docs` for examples
4. **Link to code**: Reference relevant files in packages/

## Current Features

- Interactive chat mode (implemented in packages/cli/src/app.ts)
- Multi-provider LLM support (packages/core/src/llm/)
- Built-in tools (packages/core/src/tools/builtin/)
