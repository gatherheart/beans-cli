# Beans Agent

A TypeScript CLI for working with LLM agents, tools, and agent profiles. The repository also includes an MBPP evaluation runner for comparing single-pass and Coder/Critic workflows.

## What it includes

- Agent profiles defined in Markdown with YAML frontmatter
- Google Gemini, OpenAI, Anthropic, and local Ollama provider adapters
- File, shell, search, and web tools; streamed terminal UI built with Ink
- MBPP evaluator with per-problem checkpoints and JSON results

## Get started

Requires Node.js 20 or newer. MBPP evaluation also requires Python 3.

```bash
npm ci
npm run build
cp .env.example .env
```

Set `GOOGLE_API_KEY` in `.env`, then start an interactive session:

```bash
npm run dev
```

For a single prompt with an explicit model:

```bash
npm run dev -- --model gemini-3.6-flash "Explain this repository"
```

Run `npm run dev -- --help` for CLI options. Other providers use `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or a local Ollama server. Settings can be placed in `~/.config/beans-agent/settings.json` or `.beans/settings.json`; see [documentation](docs/guides/) for additional examples. Keep keys in `.env`, which Git ignores.

## Benchmarks

An [evaluation audit](docs/reports/evaluation-audit-2026-11-13.md) found defects that could affect the historical scores below: raw-code extraction discarded imports and globals, and the test harness rewrote assertions. These have been corrected. Earlier scores, including the [paired comparison](docs/reports/mbpp-paired-critic-20-five-runs-2026-11-13.md), remain archived as pipeline observations and should not be used as validated model-performance claims.

The earlier exploratory reports below use the same sanitized MBPP problem order but different initial prompts. Agentic mode uses a Coder/Critic workflow with up to five attempts per problem.

| Experiment                                                                                                     |     Single pass |         Agentic | Time                      | Token usage              |
| -------------------------------------------------------------------------------------------------------------- | --------------: | --------------: | ------------------------- | ------------------------ |
| [First 100 problems, one run per mode](docs/reports/mbpp-gemini-3.6-flash-single-vs-agentic-100-2026-11-12.md) |          87/100 |          91/100 | 744.4 s / 1369.7 s        | Unavailable for this run |
| [First 20 problems, five runs per mode](docs/reports/mbpp-gemini-3.6-flash-20-five-runs-2026-11-12.md)         | 17.6/20 average | 19.0/20 average | 125.9 s / 161.3 s average | 23,762 / 49,927 average  |

The 100-problem report includes checkpoints at 10-problem intervals and links to raw JSON results. The repeated 20-problem report includes every run, timing, tokens, and per-problem differences. Both modes use different prompts, so their score gap cannot be attributed solely to Critic revisions.

## Development

```bash
npm run build
npm test
npm run typecheck
npm run lint
```

`npm run preflight` runs these checks together. End-to-end tests are available through `npm run test:e2e`.

The npm workspaces are `packages/core` (agent and provider logic), `packages/cli` (terminal interface), and `packages/eval` (benchmark runner). Agent definitions live in `plugins/`; architecture and development notes live in `docs/`.

## License

No license has been added yet.
