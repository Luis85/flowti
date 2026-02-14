---
severity: medium
category: testing
layer: cross-cutting
status: open
created: 2026-02-14
effort: medium
description: 15 non-UI source files (~4,200 LOC) with testable pure functions and injectable services have no test coverage. Distinct from TD-27 which covers UI component testing.
source: "[[Technical Review 2026-02-14]]"
---
# TD-30: Untested domain and infrastructure logic

## Problem

While 45 test suites cover domain services, EventBus, and utilities, 15 non-UI source files containing testable logic have no tests. This is distinct from [[TD-27 Limited UI component testing]] which covers UI rendering tests.

### Tier 1: Pure functions (highest ROI, ~1,740 LOC)

| File | LOC | Testability |
|------|-----|-------------|
| `domain/dataExchange/configDocContent.ts` | 579 | Pure — generates markdown from config objects |
| `domain/dataExchange/contentGenerator.ts` | 708 | Pure — builds note content from CSV rows |
| `domain/docs/pathResolver.ts` | 180 | Pure — path resolution functions |
| `ui/eventDocTemplate.ts` | ~275 | Pure — template generation functions |

### Tier 2: Injectable services (~1,360 LOC)

| File | LOC | Testability |
|------|-----|-------------|
| `domain/dataExchange/ConfigDocService.ts` | 435 | Injectable — depends on fileSystem + eventBus |
| `domain/dataExchange/ConfigPathTracker.ts` | ~200 | Injectable — depends on metadataCache |
| `domain/dataExchange/DataDictionaryBuilder.ts` | ~250 | Injectable — aggregates property data |
| `domain/dataExchange/PipelineExecutor.ts` | ~280 | Injectable — orchestrates multi-import |
| `infrastructure/filesystem/FileSystemClient.ts` | ~195 | Injectable — wraps vault operations |

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
