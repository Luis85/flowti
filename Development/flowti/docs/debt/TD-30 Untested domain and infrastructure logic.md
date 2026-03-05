---
type: TechDebt
severity: medium
category: testing
layer: cross-cutting
status: mitigated
created: 2026-02-14
updated: 2026-03-05
effort: medium
description: "Tiers 1, 2, 4 complete. Tier 3 (bootstrap/wiring) deferred — low ROI at 6,764 tests across 283 suites. All testable domain logic covered."
source: "[[Technical Review 2026-02-14]]"
---
# TD-30: Untested domain and infrastructure logic

**Tier 1 complete** — 3 test files, 298 tests, 100% coverage on pure functions.
**Tier 2 complete** — 4 new test files + 1 expanded, 149 tests, 95-100% coverage on injectable services.
**Tier 3 open** — bootstrap/wiring files (low ROI).
**Tier 4 complete** — 10 flow integration test suites, 87 passing, 28 skipped (emitCustom/UI limitations).

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

1. **Tier 1 first** — pure function tests with zero mocking, highest ROI ✅ DONE
2. **Tier 2 next** — service tests following existing mock patterns from `IngestionService.test.ts`, `ImportService.test.ts` ✅ DONE
3. **Tier 3 skip** — bootstrap/wiring files have low ROI for unit testing
4. **Tier 4** — flow integration tests covering 10 documented user journeys ✅ DONE

Target: ~12 new test files, ~50-150 LOC each.

## Assessment (2026-02-16)

Tiers 1, 2, and 4 are complete. Hub domain layer fully tested. Current metrics: **1,787 tests passing, 32 skipped across 79 test files**. Mock factories consolidated into shared modules (see TD-27). Remaining untested domain files are:
- `installer/folders.ts` — pure data array, low complexity
- `installer/steps/UserCreationStep.ts`, `FolderScaffoldStep.ts` — covered indirectly by InstallerService.test.ts and Flow 01 integration test
- `settings/FlowtiSettingTab.ts` — Obsidian UI component, low ROI for unit testing
- Tier 3 bootstrap files (`main.ts`, `pluginBootstrap.ts`, `dataExchangeSetup.ts`) — require Obsidian runtime

All remaining untested domain files have low ROI for unit testing. UI component coverage tracked separately in TD-27.

### Hub domain coverage (2026-02-15)

| File | LOC | Test File | Tests | Coverage |
|------|-----|-----------|-------|----------|
| `domain/hub/HubRegistry.ts` | 65 | `tests/domain/hub/HubRegistry.test.ts` | 11 | 100% |
| `domain/hub/EventCatalogProvider.ts` | 50 | `tests/domain/hub/providers.test.ts` | 6 | 100% |
| `domain/hub/DataExchangeProvider.ts` | 46 | `tests/domain/hub/providers.test.ts` | 5 | 100% |
| `domain/hub/UserHubProvider.ts` | 41 | `tests/domain/hub/providers.test.ts` | 4 | 100% |

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
- `tests/domain/hub/HubRegistry.test.ts` (new — 11 tests, 100% coverage)
- `tests/domain/hub/providers.test.ts` (new — 15 tests, 100% coverage)

## Mitigation (2026-03-05)

Reclassified as **mitigated**. All testable domain and infrastructure logic (Tiers 1, 2, 4) is covered. Remaining Tier 3 files (main.ts, pluginBootstrap.ts, dataExchangeSetup.ts) are bootstrap/wiring with Obsidian runtime dependencies — low ROI for unit testing at 6,764 tests across 283 suites. These are exercised by E2E tests and manual QA.
