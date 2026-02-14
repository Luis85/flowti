---
severity: info
category: review
layer: cross-cutting
status: reference
effort: n/a
description: Comprehensive technical debt review of the Flowti IBDE codebase as of 2026-02-13. Serves as the baseline reference for all individual debt items.
reviewed: 2026-02-13
updated: 2026-02-15
reviewer: Technical Architect
---
# Technical Debt Review - 2026-02-13

Baseline audit of the Flowti IBDE plugin codebase. This document summarises the findings; each actionable item has its own file in this folder and is tracked through the `Technical Debt.base` view.

---

## Scope

| Metric | Value (original) | Value (2026-02-14) |
|--------|-----------------|-------------------|
| Source files | 92 TypeScript files | 154 TypeScript files |
| Test files | 35 suites, 654 tests (4 skipped) | 48 suites, 1172 tests (4 skipped) |
| Test result | All passing | All passing |
| Type check | Clean (`tsc -noEmit -skipLibCheck`) | Clean (`strict: true`) |
| Lint | Clean (`eslint ./src/`) | Clean |
| Production deps | 2 (papaparse, zod) | 2 (papaparse, zod) |
| Dev deps | 13 packages | 13 packages |
| Build pipeline | vitest > typedoc > tsc > eslint > esbuild | vitest > typedoc > tsc > eslint > esbuild |

The codebase is healthy at the surface: all tests pass, types check, and lint is clean. The debt identified below is structural and architectural in nature.

---

## Progress Update (2026-02-14)

Phases 7 (main.ts decomposition) and 8 (DocService centralization) resolved or reduced multiple debt items. A source-code audit on 2026-02-14 reassessed all 26 items, finding 8 additional items fully resolved and 4 reclassified to lower severity.

A comprehensive plugin review ([[Technical Review 2026-02-14]]) added 9 new items (TD-27 through TD-35) and expanded TD-18 from "5+" to "75+ occurrences".

Refactoring phase on 2026-02-14 resolved 5 additional items (TD-18, TD-31, TD-32, TD-33, TD-35) and mitigated TD-29 (silent swallow fixed, severity downgraded to low). High-severity items reduced to zero.

Tech debt Round 2 (2026-02-14/15) resolved TD-13 (UUID-based keys), TD-34 (BaseEntityTab deduplication), and completed TD-30 Tier 1 (298 pure function tests, 100% coverage on 3 files). Test count: 854 → 1172 across 48 suites.

### Summary by Status (35 total items)

| Status | Count | Items |
|--------|-------|-------|
| Resolved | 25 | TD-02, TD-03, TD-04, TD-05, TD-07, TD-08, TD-09, TD-10, TD-11, TD-13, TD-14, TD-15, TD-17, TD-18, TD-19, TD-20, TD-21, TD-24, TD-25, TD-26, TD-31, TD-32, TD-33, TD-34, TD-35 |
| Mitigated | 2 | TD-01 (severity: low), TD-29 (severity: low) |
| Reclassified | 2 | TD-06 (high→medium), TD-12 (high→low) |
| Open | 8 | TD-06, TD-12, TD-16, TD-22, TD-23, TD-27, TD-28, TD-30 |

### Summary by Severity (current open items)

| Severity | Count | Items |
|----------|-------|-------|
| High | 0 | — |
| Medium | 4 | TD-06, TD-16, TD-27, TD-30 |
| Low | 6 | TD-01, TD-12, TD-22, TD-23, TD-28, TD-29 |

---

## Architectural Observations

### What Works Well

1. **Event-driven backbone** -- The EventBus + EventBridge pattern delivers on its promise. Services are decoupled and testable.
2. **Type safety** -- Strict TypeScript with Zod validation at boundaries. The composed `FlowtiEventMap` keeps event contracts explicit.
3. **Registry pattern** -- Commands, views, and services are declaratively registered and automatically wired. Extending the plugin requires minimal boilerplate.
4. **Test coverage** -- 1172 tests across 48 suites with mirrors of the source tree. Infrastructure and domain layers are well-covered.
5. **Separation of concerns** -- The DDD layer structure (`infrastructure/`, `domain/`, `ui/`) is consistently applied in the codebase.
6. **Service lifecycle** -- 9 of 11 domain services implement `IDisposable` with proper `dispose()` methods. `ServiceContainer.disposeAll()` handles cleanup on unload.
7. **DocService centralization** -- All doc creation routes through `doc.create` events (Phase 8), eliminating 16+ scattered `fileSystemClient.createFile()` calls.

### Where Debt Accumulates

1. **EventBridge boundary erosion** -- The UI layer bypasses EventBridge in ~112 locations, directly calling `app.vault`, `app.metadataCache`, and `app.workspace`. This is the largest remaining architectural issue (TD-06, reclassified to medium — acceptable for read-only UI access patterns).
2. **UI file sizes** -- 14 files exceed 500 LOC (down from 4 exceeding 1,000 LOC). Orchestrator files (600-850 LOC) are expected to be larger. Further decomposition opportunities exist for `contentGenerator.ts` (708), `EventConfigModal.ts` (629), and `DomainsTab.ts` (563) — see TD-01 (mitigated).
3. **Duplicated infrastructure patterns** -- Storage merging pattern is copy-pasted across services (TD-16). Path extraction duplication (TD-18) has been resolved via `pathUtils.ts`. SKIPPED_PREFIXES duplication (TD-17) has been resolved via centralization in `catalog.ts`. Entity tab structural duplication (TD-34) has been resolved via `BaseEntityTab<T>` base class (-438 LOC).

---

## Individual Debt Items

Each item below has a dedicated file in this folder with full details. See the `Technical Debt.base` view for the live tracker.

### Critical (originally)

| # | Item | Layer | Status |
|---|------|-------|--------|
| 1 | UI files exceed size convention (14 files > 500 LOC) | UI | **Mitigated** (severity: low) |
| 2 | Missing dispose() on domain services | Domain | **Resolved** |
| 3 | JobQueue swallows exceptions silently | Domain | **Resolved** (onError callback added) |
| 4 | Global document listeners without cleanup | UI | **Resolved** |
| 5 | main.ts exceeds orchestrator role | Infrastructure | **Resolved** |

### High (originally)

| # | Item | Layer | Status |
|---|------|-------|--------|
| 6 | UI layer bypasses EventBridge (~112 direct API calls) | UI | Open (reclassified to medium) |
| 7 | FileSystemClient timeout/response race condition | Infrastructure | **Resolved** (settled guard added) |
| 8 | DataExchangeService append not atomic | Domain | **Resolved** (PathMutex implemented) |
| 9 | Catalog tab render listener accumulation | UI | **Resolved** (false positive — .empty() GCs listeners) |
| 10 | IngestionService batch timer leak on dispose | Domain | **Resolved** |
| 11 | No error handling on storage load/save across services | Domain | **Resolved** (try/catch on all paths) |
| 12 | Wildcard listeners on all events degrade performance at scale | Domain | Open (reclassified to low — 7 listeners, properly filtered) |
| 13 | Weak ID generation (collision risk) | Domain | **Resolved** (generateUUID replaces Date.now fallback) |
| 14 | SettingsService event listeners leak | Domain | **Resolved** |
| 15 | EventBridge createFolder only handles one level of nesting | Infrastructure | **Resolved** |

### Medium (originally)

| # | Item | Layer | Status |
|---|------|-------|--------|
| 16 | Duplicated storage merging pattern across 8+ services | Cross-cutting | Open |
| 17 | SKIPPED_PREFIXES duplicated in 4 services | Cross-cutting | **Resolved** (centralized in catalog.ts) |
| 18 | Path extraction pattern duplicated 75+ times | Cross-cutting | **Resolved** (pathUtils.ts created) |
| 19 | tsconfig.json not using strict: true | Infrastructure | **Resolved** (strict: true enabled) |
| 20 | BaseQueryEngine regex patterns not pre-compiled | Domain | **Resolved** (false positive — already pre-compiled at module level) |
| 21 | ImportService uses exception-based fileExists() | Domain | **Resolved** (boolean API used) |
| 22 | ExportService type-unsafe payload cast | Domain | Open |
| 23 | InstallerWizardModal mixes state and rendering | Domain | Open |

### Low (originally)

| # | Item | Layer | Status |
|---|------|-------|--------|
| 24 | AGENTS.md source tree is outdated | Documentation | **Resolved** |
| 25 | ComponentShowcaseView contains German text and inline styles | UI | **Resolved** (all English, styles cleaned) |
| 26 | eventDocTemplate.ts could use template engine | UI | **Resolved** |

### Added 2026-02-14 (from [[Technical Review 2026-02-14]])

| # | Item | Layer | Severity | Status |
|---|------|-------|----------|--------|
| 27 | Limited UI component testing (~40 components untested) | UI | Medium | Open |
| 28 | Scanner duplication between Catalog and Hub | UI | Low | Open |
| 29 | Error handling inconsistency (62 catches, 4 strategies) | Cross-cutting | Low | **Mitigated** (silent swallow fixed) |
| 30 | Untested domain and infrastructure logic (~15 files, 4,200 LOC) | Cross-cutting | Medium | Open (Tier 1 complete: 298 tests, 100% coverage) |
| 31 | Direct write mutations bypass EventBridge (4 locations) | UI | Medium | **Resolved** (3/4 routed through events) |
| 32 | normalizeDocFrontmatter writes during render | UI | High | **Resolved** (scan now read-only) |
| 33 | Storage save race condition (read-merge-write not atomic) | Infrastructure | Medium | **Resolved** (PathMutex added) |
| 34 | Entity tab structural duplication (~800 LOC) | UI | Low | **Resolved** (BaseEntityTab deduplication, -438 LOC) |
| 35 | Fire-and-forget persistence risk (3 void saveState calls) | Domain | Medium | **Resolved** (void prefix + safeSaveState) |

---

## Improvement Plan — Pre-Feature Priorities

> Updated 2026-02-15. This section identifies the recommended improvements to address before continuing feature development.

### State: 25 of 35 items resolved, 0 high-severity open items

The codebase is in good shape. All high-severity items are resolved. The remaining 8 open items are 4 medium + 6 low (including 2 mitigated). None are blockers for feature work, but addressing the medium items will reduce friction and risk as the codebase grows.

### Priority 1: TD-30 Tier 2 — Injectable Service Tests (medium effort, medium value)

**Why now**: Coverage on `ConfigDocService` (48%), `PipelineExecutor` (45%), `DataDictionaryBuilder` (52%), and `DiscoveryService` (52%) is below the domain average. These files contain branching logic that accumulates risk as features grow.

**Work**:
- `tests/domain/dataExchange/ConfigDocService.test.ts` — doc creation/update paths, path resolution
- `tests/domain/dataExchange/PipelineExecutor.test.ts` — multi-source orchestration, retry, `.base` generation
- `tests/domain/dataExchange/DataDictionaryBuilder.test.ts` — property aggregation logic
- `tests/domain/dataExchange/ConfigPathTracker.test.ts` — rename tracking
- `tests/domain/discovery/DiscoveryService.test.ts` — expand beyond current 10 tests

**Estimate**: ~5 new test files, ~200 tests, ~2 hours

### Priority 2: TD-16 — Shared Storage Abstraction (medium effort, medium value)

**Why now**: The `((await storage.load()) as object) || {}` pattern is duplicated across all 10 persistent services. Adding new services or modifying storage structure risks silent data loss. A `TypedStorage<T>` wrapper with Zod validation at the boundary would eliminate this risk.

**Work**:
- Create `src/utils/TypedStorage.ts` — `load(): Promise<T>`, `save(state: T): Promise<void>`, Zod schema validation
- Migrate 10 services to use `TypedStorage<T>` instead of raw `IStorageProvider`
- Update `persistence.ts` helpers or deprecate in favor of TypedStorage

**Estimate**: ~1 new file, 10 file edits, ~2 hours

### Priority 3: TD-22 — ExportService Type Safety (small effort, low risk)

**Why now**: Single `as Record<string, unknown>` cast. Small, low-risk fix that improves type safety.

**Work**: Replace unsafe cast with typed event listener or Zod runtime validation.

**Estimate**: 1 file, <30 min

### Defer: TD-06, TD-12, TD-23, TD-27, TD-28

| Item | Reason to defer |
|------|-----------------|
| **TD-06** (EventBridge bypass, 112 calls) | All 112 calls are **read-only** UI queries (`metadataCache`, `vault.getFiles()`). Routing reads through EventBridge would add boilerplate without safety benefit. Acceptable architectural trade-off. |
| **TD-12** (Wildcard listeners) | Only 7 listeners, all properly filtered via `isSkippedEvent()`. No measured performance issue at current event volumes. |
| **TD-23** (InstallerWizardModal state) | Modal is stable, rarely modified, and only runs once per vault. Low ROI to refactor. |
| **TD-27** (UI component tests) | ~40 untested components. Important but effort-intensive (~40 test files). Better addressed incrementally as components are modified for features. |
| **TD-28** (Scanner duplication) | Catalog and Hub use different data sources (files vs storage). Low actual duplication. |

### Recommended Sequence

1. **TD-22** (30 min) — quick type safety fix
2. **TD-30 Tier 2** (2 hours) — injectable service tests fill coverage gaps
3. **TD-16** (2 hours) — storage abstraction eliminates 10-service duplication
4. **Feature development** — address TD-27 incrementally as components are touched
