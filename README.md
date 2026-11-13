# Beans Agent

A TypeScript CLI for working with LLM agents, tools, and agent profiles. The repository also includes an MBPP evaluation runner for comparing single-pass and Coder/Critic workflows.

## What it includes

- Agent profiles defined in Markdown with YAML frontmatter
- Google Gemini, OpenAI, Anthropic, and local Ollama provider adapters
- File, shell, search, and web tools; streamed terminal UI built with Ink
- MBPP evaluator with per-problem checkpoints and JSON results
- Experimental code-similarity retrieval for Critic context, with sequential and predicted preparation during test execution

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

An [evaluation audit](docs/reports/evaluation-audit-2026-11-13.md) found that the old loader missed sanitized MBPP problem statements, raw-code extraction discarded imports and globals, and the test harness rewrote assertions. These defects have been corrected. All earlier scores below are archived pipeline outputs and are **invalid as MBPP performance evidence**. The [first corrected 100-problem evaluation](docs/reports/mbpp-validated-100-2026-11-13.md) recorded 96/100 for single-call generation and 99/100 after iterative Critic feedback, using 27.5% more recorded time and 31.0% more tokens. This is one run with four initial failures, including one inconsistent test; the report documents the limits of this comparison.

Archived outputs are retained for transparency: [the original 100-problem comparison](docs/reports/mbpp-gemini-3.6-flash-single-vs-agentic-100-2026-11-12.md), [the original repeated 20-problem comparison](docs/reports/mbpp-gemini-3.6-flash-20-five-runs-2026-11-12.md), and [the pre-audit paired comparison](docs/reports/mbpp-paired-critic-20-five-runs-2026-11-13.md). Their JSON reports are explicitly marked invalid and cannot be replayed as new baselines.

## Development

The [speculative review preparation guide](docs/guides/speculative-review-preparation.md) describes the optional predictor and related-code index. An [initial five-repeat replay](docs/reports/speculative-review-preparation-2026-11-14.md) reduced wasted prefetches but did not demonstrate a latency improvement over sequential retrieval. It measures scheduling without additional LLM calls, not full agent speed or answer quality.

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
