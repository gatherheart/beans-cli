# Benchmark Evaluation Guide

This guide explains how to use the evaluation system to measure code generation performance.

## Overview

The eval package provides a framework for running standardized benchmarks against LLM models. Currently supports:

- **MBPP** (Mostly Basic Programming Problems) - 427 Python coding problems

## Requirements

### Environment

- **Node.js** >= 20.0.0
- **Python 3** - Required for executing generated code
- **Network access** - To fetch benchmark datasets from GitHub

### API Keys

Configure your LLM provider in `~/.beans/config.json`:

```json
{
  "llm": {
    "provider": "google",
    "model": "gemini-2.0-flash"
  }
}
```

Set your API key:
```bash
export GOOGLE_API_KEY="your-api-key"
```

## Building

The eval package is separate from the default build. Use `build:all` to include it:

```bash
# Build everything including eval
npm run build:all

# Or build separately
npm run build:eval   # Just eval package
npm run build        # Core + CLI (no eval)
```

## Usage

### Basic Evaluation (Single-shot)

Run problems once without retry:

```bash
beans --eval --benchmark mbpp --limit 10
```

### Agentic Evaluation (Iterative)

Allow the model to see test failures and retry:

```bash
beans --eval --benchmark mbpp --agentic --limit 10
```

### CLI Options

| Flag | Description | Default |
|------|-------------|---------|
| `--eval` | Enable evaluation mode | - |
| `--benchmark <name>` | Benchmark to run (e.g., `mbpp`) | Required |
| `--limit <n>` | Limit to first N problems | All |
| `--offset <n>` | Skip first N problems | 0 |
| `--agentic` | Enable multi-agent iterative mode | false |
| `--max-iterations <n>` | Max retries per problem | 5 |
| `--timeout <ms>` | Timeout per problem | 30000 |
| `-m, --model <name>` | Model to use | Config default |
| `--output <path>` | Save report to file | stdout |
| `--resume <run-id>` | Resume previous run | - |
| `--verbose` | Show detailed agent interactions | false |

### Examples

```bash
# Quick test with 5 problems
beans --eval --benchmark mbpp --limit 5

# Full evaluation with gemini-2.5-pro
beans --eval --benchmark mbpp -m gemini-2.5-pro

# Agentic mode with 10 iterations max
beans --eval --benchmark mbpp --agentic --max-iterations 10

# Agentic mode with verbose output (shows agent interactions)
beans --eval --benchmark mbpp --agentic --verbose --limit 5

# Save results to file
beans --eval --benchmark mbpp --output results.json

# Resume interrupted run
beans --eval --benchmark mbpp --resume mlpash0z-p0067o
```

## Evaluation Modes

### Single-shot Mode

```
Problem → LLM generates code → Run tests → Pass/Fail
```

- One attempt per problem
- Measures raw model capability
- Fast (~2s per problem with flash models)

### Agentic Mode (Multi-Agent)

Agentic mode uses a **multi-agent architecture** with two specialized agents:

```
┌──────────────────┐
│   CODER AGENT    │ ─── Generates code ───────────────┐
└──────────────────┘                                    │
                                                        ▼
                                              ┌─────────────────┐
                                              │   RUN TESTS     │
                                              └─────────────────┘
                                                        │
                                        Tests pass?     │
                                           Yes ─────────┼──────► Done (Success)
                                           No           ▼
                                              ┌─────────────────┐
                                              │  CRITIC AGENT   │
                                              │  Analyzes error │
                                              └─────────────────┘
                                                        │
                              WRONG: [mistake]          │
                              KEY: [requirement]        ▼
                              HINT: [fix]      ┌──────────────────┐
                                               │   CODER AGENT    │
                                               │   Retries with   │
                                               │   critic feedback│
                                               └──────────────────┘
                                                        │
                                                        ▼
                                                   (repeat)
```

#### Coder Agent
- Generates Python code to solve the problem
- On retry, receives structured feedback from the Critic Agent
- Uses the feedback to understand and fix mistakes

#### Critic Agent
- Activated when tests fail
- Analyzes the failed code and test results
- Provides structured feedback in three parts:
  - **WRONG**: What specific mistake the code made
  - **KEY**: What requirement was missed or misunderstood
  - **HINT**: A specific suggestion to fix the issue

#### Benefits
- Multiple attempts allowed (up to `--max-iterations`)
- Critic helps identify root cause, not just symptoms
- Structured feedback improves fix accuracy
- Higher pass rates than single-shot mode

#### Verbose Output

Use `--verbose` to see the multi-agent interaction:

```
============================================================
[Problem 7] Iteration 1
============================================================
[CODER AGENT] Generating initial solution...

[CODE GENERATED]
def find_char_long(text):
  return [word for word in text.split() if len(word) > 4]

[TEST RESULTS] 0/3 passed
  ❌ assert set(find_char_long('Please move back')) == set(['Please', 'move', 'back'])
     Expected: {'Please', 'move', 'back'}, Got: {'Please'}

🔄 [RETRY] Moving to iteration 2...

[CRITIC AGENT] Analyzing errors...
  WRONG: Code uses > 4 but should use >= 4
  KEY: Include words with exactly 4 characters
  HINT: Change condition to len(word) >= 4

[CODER AGENT] Generating fix based on critic feedback...
```

## MBPP Benchmark

### Dataset

- **Source**: [Google Research MBPP](https://github.com/google-research/google-research/tree/master/mbpp)
- **Sanitized subset**: 427 hand-verified problems
- **Full dataset**: 974 crowd-sourced problems

### Problem Structure

Each problem includes:
- `text`: Problem description
- `tests`: Python assertion statements
- `code`: Reference solution (not shown to model)

### Example Problem

```json
{
  "task_id": 14,
  "text": "Write a python function to find the volume of a triangular prism.",
  "test_list": [
    "assert find_Volume(10,8,6) == 240",
    "assert find_Volume(3,2,2) == 6",
    "assert find_Volume(1,2,1) == 1"
  ]
}
```

## Architecture

### Package Structure

```
packages/eval/
├── src/
│   ├── benchmarks/
│   │   ├── types.ts              # Benchmark interfaces
│   │   └── mbpp/                 # MBPP implementation
│   ├── execution/
│   │   ├── python-runner.ts      # Python subprocess execution
│   │   └── types.ts              # Execution result types
│   ├── extraction/
│   │   └── code-extractor.ts     # Extract code from LLM responses
│   ├── runner/
│   │   ├── eval-runner.ts        # Single-shot runner
│   │   ├── agentic-runner.ts     # Multi-agent runner (Coder + Critic)
│   │   ├── checkpoint.ts         # Resume support
│   │   └── types.ts
│   └── reports/
│       ├── json-report.ts
│       └── markdown-report.ts
```

### Key Components

| Component | File | Description |
|-----------|------|-------------|
| EvalRunner | `runner/eval-runner.ts` | Single-shot evaluation |
| AgenticEvalRunner | `runner/agentic-runner.ts` | Multi-agent with Critic |
| MBPPBenchmark | `benchmarks/mbpp/index.ts` | MBPP dataset loader |
| executeWithTests | `execution/python-runner.ts` | Run Python with assertions |
| extractCode | `extraction/code-extractor.ts` | Parse code from responses |

### Multi-Agent Implementation

The `AgenticEvalRunner` implements the Coder-Critic pattern:

1. **Coder Agent** receives the problem and generates code
2. **Test Runner** executes the code with assertions
3. If tests fail, **Critic Agent** analyzes the error
4. Critic provides structured feedback (WRONG/KEY/HINT)
5. **Coder Agent** retries with the feedback
6. Repeat until success or max iterations

## Resource Estimates

### Time

| Model | Time per Problem | 427 Problems |
|-------|------------------|--------------|
| gemini-2.0-flash | ~2s | ~14 min |
| gemini-2.5-pro | ~18s | ~2 hours |

### API Costs

Approximate costs for full MBPP evaluation:

| Model | Input Tokens | Output Tokens | Estimated Cost |
|-------|--------------|---------------|----------------|
| gemini-2.0-flash | ~200K | ~100K | ~$0.05 |
| gemini-2.5-pro | ~200K | ~100K | ~$2.50 |

*Agentic mode with retries will multiply these costs.*

### Storage

- Checkpoints: ~1MB per 100 problems
- Reports: ~50KB JSON, ~10KB Markdown

Checkpoints are saved to: `~/.beans/eval/<run-id>/`

## Output Formats

### Console Output

```
📊 Starting MBPP Evaluation
   Model: gemini-2.0-flash
   Mode: Agentic (max 5 iterations)

   ✅ Problem 2 [1 iter] (1/10 - 10.0%)
   ✅ Problem 3 [1 iter] (2/10 - 20.0%)
   ❌ Problem 14 [5 iter] (10/10 - 100.0%)

📈 Results Summary
   Total: 10
   Passed: 9
   Pass Rate: 90.0%
```

### JSON Report

```json
{
  "benchmarkName": "mbpp-agentic",
  "timestamp": "2026-02-17T...",
  "model": "gemini-2.0-flash",
  "summary": {
    "total": 10,
    "passed": 9,
    "passRate": 0.9,
    "avgIterations": 1.5
  },
  "results": [...]
}
```

### Markdown Report

```markdown
# MBPP-AGENTIC Evaluation Report

| Metric | Value |
|--------|-------|
| Pass Rate | 90.0% |
| Avg Iterations | 1.5 |
```

## Interpreting Results

### Pass@1

Standard metric for single-shot evaluation:
```
Pass@1 = problems_passed / total_problems
```

### Agentic Pass Rate

For iterative evaluation, also consider:
- **Avg Iterations**: Lower is better (model gets it right faster)
- **Max Iterations Used**: Problems that hit the limit are genuinely hard

### Model Comparison

| Model | Pass@1 | Agentic Pass | Avg Iter |
|-------|--------|--------------|----------|
| gemini-2.0-flash | ~80% | ~90-100% | 1.2 |
| gemini-2.5-pro | ~95% | ~100% | 1.0 |

*Results may vary. The multi-agent Critic system significantly improves pass rates for gemini-2.0-flash.*

## Troubleshooting

### "No code found in response"

The code extractor couldn't find Python code. Check:
- Model is returning code (not refusing)
- Code is in markdown blocks or starts with `def`

### Empty responses

Verify:
- API key is set correctly
- Model name is valid (`beans --list-models`)
- Network connectivity

### Test timeouts

Increase timeout for complex problems:
```bash
beans --eval --benchmark mbpp --timeout 60000
```

### Resume interrupted run

Find your run ID in the output, then:
```bash
beans --eval --benchmark mbpp --resume <run-id>
```

Checkpoints are in `~/.beans/eval/`.

## Adding New Benchmarks

To add a new benchmark (e.g., HumanEval):

1. Create `packages/eval/src/benchmarks/humaneval/`
2. Implement `Benchmark<T>` interface
3. Add to `getBenchmark()` in runners
4. Export from `packages/eval/src/index.ts`

See `packages/eval/src/benchmarks/mbpp/` for reference.
