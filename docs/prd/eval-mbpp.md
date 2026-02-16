# MBPP Evaluation System

## Overview

MBPP (Mostly Basic Programming Problems) is a benchmark dataset of 974 crowd-sourced Python programming problems designed to evaluate code generation capabilities. This document specifies the integration of MBPP evaluation into Beans Agent.

## Background

### What is MBPP?

- **Created by**: Google (2021)
- **Paper**: "Program Synthesis with Large Language Models"
- **Size**: 974 problems (427 in sanitized subset)
- **Purpose**: Evaluate basic Python code generation

### Problem Structure

Each MBPP problem contains:

| Field | Description |
|-------|-------------|
| `task_id` | Unique identifier |
| `text` | Natural language problem description |
| `code` | Reference solution |
| `test_list` | 3 test assertions |
| `test_setup_code` | Setup code for tests |
| `challenge_test_list` | Additional challenge tests |

### Example Problem

```python
{
  "task_id": 1,
  "text": "Write a function to find the minimum cost path to reach (m, n) from (0, 0) for the given cost matrix.",
  "code": "def min_cost(cost, m, n): ...",
  "test_list": [
    "assert min_cost([[1,2,3],[4,8,2],[1,5,3]], 2, 2) == 8",
    "assert min_cost([[2,3,4],[5,9,3],[2,6,4]], 2, 2) == 12",
    "assert min_cost([[3,4,5],[6,10,4],[3,7,5]], 2, 2) == 16"
  ]
}
```

### Evaluation Metric

**Pass@1**: Percentage of problems solved correctly on the first attempt.

```
Pass@1 = (Problems with all tests passing) / (Total problems) × 100%
```

## Requirements

### Functional Requirements

#### FR-1: Dataset Loading
- Load MBPP dataset from HuggingFace or local JSON file
- Support both full (974) and sanitized (427) subsets
- Allow limiting to specific number of problems
- Allow selecting specific problem IDs

#### FR-2: Agent Execution
- Run Beans Agent on each problem programmatically
- Use configurable model and provider
- Support custom system prompts for code generation
- Capture full agent response and token usage

#### FR-3: Code Extraction
- Extract Python code from agent responses
- Handle markdown code blocks (```python ... ```)
- Handle raw code responses
- Handle multiple code blocks (use last/largest)

#### FR-4: Test Execution
- Execute generated code with test assertions
- Capture pass/fail for each test
- Handle execution errors and timeouts
- Support sandboxed execution (Docker)

#### FR-5: Metrics Collection
- Track pass@1 rate
- Track token usage (prompt, completion, total)
- Track time per problem
- Calculate estimated cost

#### FR-6: Resume Support
- Save checkpoint after each problem
- Resume interrupted runs from checkpoint
- Store checkpoints in `~/.beans/eval/<run-id>/`

#### FR-7: Report Generation
- Generate JSON report with full details
- Generate Markdown report for human reading
- Include summary statistics and per-problem results

### Non-Functional Requirements

#### NFR-1: Performance
- Sequential execution by default (rate limit safe)
- Optional parallel execution with configurable concurrency
- Target: ~2-5 seconds per problem (excluding LLM latency)

#### NFR-2: Safety
- Timeout for Python execution (default: 30 seconds)
- Memory limits for sandboxed execution
- No network access in sandbox mode

#### NFR-3: Extensibility
- Abstract `Benchmark` interface for future benchmarks
- Pluggable Python runner (local, Docker, cloud)
- Configurable report formats

## Architecture

### Package Structure

```
packages/eval/
├── src/
│   ├── benchmarks/           # Benchmark implementations
│   │   ├── types.ts          # Benchmark interface
│   │   └── mbpp/             # MBPP-specific code
│   ├── execution/            # Code execution
│   │   └── python-runner.ts  # Python subprocess runner
│   ├── extraction/           # Response parsing
│   │   └── code-extractor.ts # Extract code from text
│   ├── runner/               # Evaluation orchestration
│   │   ├── eval-runner.ts    # Main loop
│   │   └── checkpoint.ts     # Resume support
│   └── reports/              # Report generation
│       ├── json-report.ts
│       └── markdown-report.ts
```

### Key Interfaces

```typescript
interface Benchmark<T extends BenchmarkProblem> {
  name: string;
  description: string;
  load(options?: LoadOptions): Promise<T[]>;
  buildPrompt(problem: T): string;
  evaluate(problem: T, solution: string): Promise<EvaluationResult>;
}

interface EvaluationResult {
  problemId: string;
  success: boolean;
  passed: number;
  total: number;
  generatedCode: string;
  metrics: ProblemMetrics;
}

interface BenchmarkReport {
  benchmarkName: string;
  model: string;
  summary: {
    total: number;
    passed: number;
    passRate: number;
    totalTokens: number;
  };
  results: EvaluationResult[];
}
```

### Data Flow

```
1. Load MBPP dataset
       ↓
2. For each problem:
   a. Build prompt from problem text
   b. Run agent (AgentExecutor)
   c. Extract code from response
   d. Execute code with tests
   e. Record result
   f. Save checkpoint
       ↓
3. Generate report
```

## CLI Interface

### Commands

```bash
# Basic usage
beans eval --benchmark mbpp

# With options
beans eval --benchmark mbpp \
  --model gemini-2.0-flash \
  --limit 100 \
  --output report.json \
  --sandbox docker

# Resume interrupted run
beans eval --benchmark mbpp --resume abc123
```

### Arguments

| Argument | Type | Default | Description |
|----------|------|---------|-------------|
| `--benchmark` | string | required | Benchmark name (mbpp, humaneval) |
| `--model` | string | gemini-2.0-flash | Model to use |
| `--limit` | number | all | Limit number of problems |
| `--offset` | number | 0 | Skip first N problems |
| `--problems` | string | - | Specific problem IDs (comma-separated) |
| `--output` | string | stdout | Output file path |
| `--sandbox` | string | none | Sandbox mode (none, docker) |
| `--resume` | string | - | Run ID to resume |
| `--timeout` | number | 30000 | Per-problem timeout (ms) |

## Report Format

### JSON Report

```json
{
  "benchmarkName": "mbpp",
  "timestamp": "2024-01-15T10:30:00Z",
  "model": "gemini-2.0-flash",
  "summary": {
    "total": 427,
    "passed": 298,
    "passRate": 0.698,
    "totalTokens": 125000,
    "totalTimeMs": 45000,
    "avgTimePerProblem": 105,
    "estimatedCost": 0.0125
  },
  "results": [
    {
      "problemId": "1",
      "success": true,
      "passed": 3,
      "total": 3,
      "generatedCode": "def min_cost(cost, m, n): ...",
      "metrics": {
        "promptTokens": 150,
        "completionTokens": 80,
        "totalTokens": 230,
        "turnCount": 1,
        "timeMs": 1200
      }
    }
  ]
}
```

### Markdown Report

```markdown
# MBPP Evaluation Report

**Model:** gemini-2.0-flash
**Date:** 2024-01-15

## Summary

| Metric | Value |
|--------|-------|
| Total Problems | 427 |
| Passed | 298 |
| Pass Rate | 69.8% |
| Total Tokens | 125,000 |
| Estimated Cost | $0.0125 |

## Results

### Problem 1 - ✅ PASS
- Tests: 3/3
- Tokens: 230
- Time: 1.2s
```

## Implementation Phases

### Phase 1: Foundation
- [ ] Create packages/eval package structure
- [ ] Implement code extractor
- [ ] Implement Python runner

### Phase 2: MBPP Benchmark
- [ ] Implement dataset loader
- [ ] Implement MBPP benchmark class
- [ ] Write unit tests

### Phase 3: Runner
- [ ] Implement checkpoint system
- [ ] Implement evaluation runner
- [ ] Add progress reporting

### Phase 4: CLI
- [ ] Add eval arguments to CLI
- [ ] Implement eval command handler
- [ ] Add help documentation

### Phase 5: Reports
- [ ] Implement JSON report
- [ ] Implement Markdown report
- [ ] Add report customization

## Future Extensions

### HumanEval Support
- Similar structure to MBPP
- Different prompt format (function signature provided)
- 164 problems from OpenAI

### SWE-bench Support
- Real GitHub issues from OSS projects
- Requires git repository management
- Multi-file code changes
- Much more complex evaluation

## References

- [MBPP Paper](https://arxiv.org/abs/2108.07732)
- [MBPP Dataset on HuggingFace](https://huggingface.co/datasets/mbpp)
- [HumanEval Paper](https://arxiv.org/abs/2107.03374)
- [SWE-bench Paper](https://arxiv.org/abs/2310.06770)
