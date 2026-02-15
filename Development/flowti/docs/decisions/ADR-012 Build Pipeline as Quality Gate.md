---
type: DecisionNote
adr: ADR-012
title: Build Pipeline as Quality Gate
status: Accepted
date: 2026-01-15
domain: infrastructure
category: Quality
drivers:
  - Regression Prevention
  - Confidence
  - Automation
tags:
  - decision
  - testing
  - quality
---

# ADR-012: Build Pipeline as Quality Gate

## Status

**Accepted** — enforced since project inception.

## Context

An Obsidian plugin ships as a single `main.js` file. Bugs in production are difficult to diagnose without the Obsidian runtime. We need a build pipeline that catches issues before they reach users.

### Alternatives Considered

1. **Manual testing only** — slow, error-prone, doesn't scale
2. **CI/CD pipeline** — ideal but requires hosting; deferred to future (see TD-37)
3. **Local build pipeline as quality gate (chosen)** — `npm run build` runs the full suite locally

## Decision

Every `npm run build` runs 5 sequential stages. If any stage fails, the build stops:

```
npm run build = vitest run --coverage → typedoc → tsc -noEmit → eslint → esbuild
```

| Stage | What It Validates | Failure Example |
|-------|-------------------|-----------------|
| **vitest** | All 1,344 tests pass; coverage report generated | Regression in service logic |
| **typedoc** | TSDoc comments parse without errors | Invalid JSDoc syntax |
| **tsc** | Type-checking with `strict: true`, `-skipLibCheck` | Type mismatch, missing import |
| **eslint** | Lint rules pass on `src/` | Unused variable, missing await |
| **esbuild** | Bundle produces `main.js` | Circular dependency, missing export |

### Rule: Always Use `npm run build`

Quick builds via `node esbuild.config.mjs` are available for development but must not be used for verification. Only `npm run build` is accepted as a quality gate.

## Consequences

### Positive

- **Catch-before-ship**: Type errors, test failures, and lint issues caught before any code reaches Obsidian
- **Fast feedback**: Full pipeline completes in ~30 seconds locally
- **Coverage tracking**: V8 coverage reports generated on every build

### Negative

- **No CI**: Pipeline runs locally only — relies on developer discipline
- **Full suite on every build**: Can't selectively run tests for faster iteration — mitigated by vitest watch mode during development

## Related

- [[Testplan and Teststrategy]] — Build Pipeline section
- [[ADR-016 Real EventBus in Tests]]
