---
severity: medium
category: testing
layer: cross-cutting
status: open
created: 2026-02-14
effort: medium
description: "15 non-UI source files (~4,200 LOC) with testable pure functions and injectable services. Tier 1 complete (298 tests, 100%). Tier 2 complete (149 tests, 95-100% coverage). Tier 3 (bootstrap) remains open."
source: "[[Technical Review 2026-02-14]]"
---
# TD-30: Untested domain and infrastructure logic

**Tier 1 complete** — 3 test files, 298 tests, 100% coverage on pure functions.
**Tier 2 complete** — 4 new test files + 1 expanded, 149 tests, 95-100% coverage on injectable services.
**Tier 3 open** — bootstrap/wiring files (low ROI).

## Problem

While 45 test suites cover domain services, EventBus, and utilities, 15 non-UI source files containing testable logic have no tests. This is distinct from [[TD-27 Limited UI component testing]] which covers UI rendering tests.

### Tier 1: Pure functions (highest ROI, ~1,740 LOC) — COMPLETE

| File | LOC | Test File | Tests | Coverage |
|------|-----|-----------|-------|----------|
| `domain/dataExchange/configDocContent.ts` | 579 | `tests/domain/dataExchange/configDocContent.test.ts` | 152 | 100% |
| `domain/docs/contentGenerator.ts` | 708 | `tests/domain/docs/contentGenerator.test.ts` | 64 | 100% |
| `domain/docs/pathResolver.ts` | 180 | `tests/domain/docs/pathResolver.test.ts` | 82 | 100% |
| `ui/eventDocTemplate.ts` | ~275 | `tests/ui/eventDocTemplate.test.ts` | (pre-existing) | — |

### Tier 2: Injectable services (~1,360 LOC) — COMPLETE

| File | LOC | Test File | Tests | Coverage |
|------|-----|-----------|-------|----------|
| `domain/dataExchange/ConfigDocService.ts` | 435 | `tests/domain/dataExchange/ConfigDocService.test.ts` | 49 | 95.74% |
| `domain/dataExchange/ConfigPathTracker.ts` | ~200 | `tests/domain/dataExchange/ConfigPathTracker.test.ts` | 22 | 100% |
| `domain/dataExchange/DataDictionaryBuilder.ts` | ~250 | `tests/domain/dataExchange/DataDictionaryBuilder.test.ts` | 30 | 95.65% |
| `domain/dataExchange/PipelineExecutor.ts` | ~280 | `tests/domain/dataExchange/PipelineExecutor.test.ts` | 31 | 98.73% |
| `domain/discovery/DiscoveryService.ts` | ~200 | `tests/domain/discovery/DiscoveryService.test.ts` | 27 (+17) | 100% |
| `infrastructure/filesystem/FileSystemClient.ts` | ~195 | — | — | Deferred (thin Obsidian wrapper) |

### Tier 3: Bootstrap/wiring (~1,030 LOC)

| File | LOC | Testability |
|------|-----|-------------|
| `main.ts` | 450 | Low — Obsidian plugin lifecycle |
| `pluginBootstrap.ts` | ~300 | Low — registration wiring |
| `dataExchangeSetup.ts` | ~280 | Low — DataExchange wiring |

## Impact

- Regressions in content generation (`configDocContent.ts`, `contentGenerator.ts`) go undetected
- `ConfigDocService` has complex branching logic with no safety net
- `PipelineExecutor` orchestrates multi-step imports with retry logic — untested
- Pure functions in Tier 1 are trivially testable with zero mocking

## Suggested Approach

1. **Tier 1 first** — pure function tests with zero mocking, highest ROI
2. **Tier 2 next** — service tests following existing mock patterns from `IngestionService.test.ts`, `ImportService.test.ts`
3. **Tier 3 skip** — bootstrap/wiring files have low ROI for unit testing

Target: ~12 new test files, ~50-150 LOC each.

## Affected Files

- `tests/domain/dataExchange/configDocContent.test.ts` (new)
- `tests/domain/dataExchange/contentGenerator.test.ts` (new)
- `tests/domain/docs/pathResolver.test.ts` (new)
- `tests/ui/eventDocTemplate.test.ts` (new)
- `tests/domain/dataExchange/ConfigDocService.test.ts` (new)
- `tests/domain/dataExchange/ConfigPathTracker.test.ts` (new)
- `tests/domain/dataExchange/DataDictionaryBuilder.test.ts` (new)
- `tests/domain/dataExchange/PipelineExecutor.test.ts` (new)
- `tests/infrastructure/filesystem/FileSystemClient.test.ts` (new)
