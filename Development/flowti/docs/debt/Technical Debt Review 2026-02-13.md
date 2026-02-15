---
severity: info
category: review
layer: cross-cutting
status: reference
effort: n/a
description: Comprehensive technical debt review of the Flowti IBDE codebase as of 2026-02-13. Serves as the baseline reference for all individual debt items.
reviewed: 2026-02-13
updated: 2026-02-16
reviewer: Technical Architect
tags:
  - qa
---
# Technical Debt Review - 2026-02-13

Baseline audit of the Flowti IBDE plugin codebase. This document summarises the findings; each actionable item has its own file in this folder and is tracked through the `Technical Debt.base` view.

---

## Scope

| Metric | Value (original) | Value (2026-02-14) | Value (2026-02-16) |
|--------|-----------------|-------------------|-------------------|
| Source files | 92 TypeScript files | 155 TypeScript files | 166 TypeScript files |
| Test files | 35 suites, 654 tests (4 skipped) | 54 suites, 1330 tests (4 skipped) | 79 suites, 1786 tests (32 skipped) |
| Total source LOC | — | — | ~31,700 LOC |
| Files > 500 LOC | 4 (>1,000 LOC) | 14 files | 13 files |
| Test result | All passing | All passing | All passing |
| Type check | Clean (`tsc -noEmit -skipLibCheck`) | Clean (`strict: true`) | Clean (`strict: true`) |
| Lint | Clean (`eslint ./src/`) | Clean | Clean |
| Production deps | 2 (papaparse, zod) | 2 (papaparse, zod) | 2 (papaparse, zod) |
| Dev deps | 13 packages | 13 packages | 13 packages |
| Build pipeline | vitest > typedoc > tsc > eslint > esbuild | vitest > typedoc > tsc > eslint > esbuild | vitest > typedoc > tsc > eslint > esbuild |

The codebase is healthy at the surface: all tests pass, types check, and lint is clean. The debt identified below is structural and architectural in nature.

---

## Progress Update (2026-02-14)

Phases 7 (main.ts decomposition) and 8 (DocService centralization) resolved or reduced multiple debt items. A source-code audit on 2026-02-14 reassessed all 26 items, finding 8 additional items fully resolved and 4 reclassified to lower severity.

A comprehensive plugin review ([[Technical Review 2026-02-14]]) added 9 new items (TD-27 through TD-35) and expanded TD-18 from "5+" to "75+ occurrences".

Refactoring phase on 2026-02-14 resolved 5 additional items (TD-18, TD-31, TD-32, TD-33, TD-35) and mitigated TD-29 (silent swallow fixed, severity downgraded to low). High-severity items reduced to zero.

Tech debt Round 2 (2026-02-14/15) resolved TD-13 (UUID-based keys), TD-34 (BaseEntityTab deduplication), and completed TD-30 Tier 1 (298 pure function tests, 100% coverage on 3 files). Test count: 854 → 1172 across 48 suites.

Tech debt Round 3 (2026-02-15/16) resolved TD-22 (already fixed during Phase 8), TD-16 (TypedStorage<T> abstraction, 9 services migrated), and completed TD-30 Tier 2 (149 injectable service tests, 95-100% coverage on 5 files). Test count: 1172 → 1330 across 54 suites.

Dead code cleanup (2026-02-16) removed `persistence.ts` + test (superseded by TypedStorage<T>) and deprecated `CUSTOM_EVENTS_CATEGORY` alias. Test count: 1330 → 1319 across 53 suites. TD-23 reclassified from medium to low (stable modal, runs once per vault, low ROI). Three pre-existing items (TD-36, TD-37, TD-38) integrated into this tracker.

### Summary by Status (38 total items)

| Status | Count | Items |
|--------|-------|-------|
| Resolved | 27 | TD-02, TD-03, TD-04, TD-05, TD-07, TD-08, TD-09, TD-10, TD-11, TD-13, TD-14, TD-15, TD-16, TD-17, TD-18, TD-19, TD-20, TD-21, TD-22, TD-24, TD-25, TD-26, TD-31, TD-32, TD-33, TD-34, TD-35 |
| Mitigated | 2 | TD-01 (severity: low), TD-29 (severity: low) |
| Reclassified | 3 | TD-06 (high→medium), TD-12 (high→low), TD-23 (medium→low) |
| Postponed | 1 | TD-37 |
| Open | 8 | TD-06, TD-12, TD-23, TD-27, TD-28, TD-30, TD-36, TD-38 |

### Summary by Severity (current open items + mitigated)

| Severity | Count | Items |
|----------|-------|-------|
| High | 0 | — |
| Medium | 3 | TD-06, TD-27, TD-30 |
| Low | 7 | TD-01, TD-12, TD-23, TD-28, TD-29, TD-36, TD-38 |
| Postponed | 1 | TD-37 |

---

## Architectural Observations

### What Works Well

1. **Event-driven backbone** -- The EventBus + EventBridge pattern delivers on its promise. Services are decoupled and testable.
2. **Type safety** -- Strict TypeScript with Zod validation at boundaries. The composed `FlowtiEventMap` keeps event contracts explicit.
3. **Registry pattern** -- Commands, views, and services are declaratively registered and automatically wired. Extending the plugin requires minimal boilerplate.
4. **Test coverage** -- 1786 tests across 79 suites with mirrors of the source tree. Infrastructure, domain, and UI layers are well-covered. Tier 1+2 pure function and service tests provide 95-100% coverage on 8 critical files. User Hub components (Dashboard, Inbox, Activity) and Hub domain (HubRegistry, providers) have dedicated test suites. Inbox domain (mappers + InboxService) has 100% statement coverage.
5. **Separation of concerns** -- The DDD layer structure (`infrastructure/`, `domain/`, `ui/`) is consistently applied in the codebase.
6. **Service lifecycle** -- 10 of 12 domain services implement `IDisposable` with proper `dispose()` methods. `ServiceContainer.disposeAll()` handles cleanup on unload. InboxService added with full dispose() pattern.
7. **DocService centralization** -- All doc creation routes through `doc.create` events (Phase 8), eliminating 16+ scattered `fileSystemClient.createFile()` calls.
8. **TypedStorage abstraction** -- All 9 persistent services use `TypedStorage<T>` with key-scoped, mutex-protected read-merge-write. Eliminates unsafe `as object` casts and duplicated merge patterns.
9. **Dead code hygiene** -- `persistence.ts` (superseded), deprecated aliases, and unused exports are regularly identified and removed.

### Where Debt Accumulates

1. **EventBridge boundary erosion** -- The UI layer bypasses EventBridge in ~112 locations, directly calling `app.vault`, `app.metadataCache`, and `app.workspace`. All are **read-only** queries; write operations route through events. Acceptable architectural trade-off (TD-06, reclassified to medium).
2. **UI file sizes** -- 13 files exceed 500 LOC (down from 14). Orchestrator files (600-850 LOC) are expected to be larger. Further decomposition opportunities exist for `contentGenerator.ts` (708), `EventConfigModal.ts` (629), and `DomainsTab.ts` (565) — see TD-01 (mitigated).
3. **Duplicated infrastructure patterns** -- All major duplication items resolved: storage merging (TD-16 → TypedStorage), path extraction (TD-18 → pathUtils.ts), SKIPPED_PREFIXES (TD-17 → catalog.ts), entity tabs (TD-34 → BaseEntityTab). No new duplication patterns detected.
4. **Console.log usage** -- 36 `console.*` occurrences remain in `src/`. Most are in infrastructure/error paths where LoggerService is unavailable (e.g., bootstrap, catch blocks). Acceptable for now; no silent swallows remain (TD-29 mitigated).

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
| 16 | Duplicated storage merging pattern across 8+ services | Cross-cutting | **Resolved** (TypedStorage<T> abstraction) |
| 17 | SKIPPED_PREFIXES duplicated in 4 services | Cross-cutting | **Resolved** (centralized in catalog.ts) |
| 18 | Path extraction pattern duplicated 75+ times | Cross-cutting | **Resolved** (pathUtils.ts created) |
| 19 | tsconfig.json not using strict: true | Infrastructure | **Resolved** (strict: true enabled) |
| 20 | BaseQueryEngine regex patterns not pre-compiled | Domain | **Resolved** (false positive — already pre-compiled at module level) |
| 21 | ImportService uses exception-based fileExists() | Domain | **Resolved** (boolean API used) |
| 22 | ExportService type-unsafe payload cast | Domain | **Resolved** (removed during Phase 8 refactoring) |
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
| 30 | Untested domain and infrastructure logic (~15 files, 4,200 LOC) | Cross-cutting | Medium | Open (Tier 1+2 complete: 447 tests, 95-100% coverage) |
| 31 | Direct write mutations bypass EventBridge (4 locations) | UI | Medium | **Resolved** (3/4 routed through events) |
| 32 | normalizeDocFrontmatter writes during render | UI | High | **Resolved** (scan now read-only) |
| 33 | Storage save race condition (read-merge-write not atomic) | Infrastructure | Medium | **Resolved** (PathMutex added) |
| 34 | Entity tab structural duplication (~800 LOC) | UI | Low | **Resolved** (BaseEntityTab deduplication, -438 LOC) |
| 35 | Fire-and-forget persistence risk (3 void saveState calls) | Domain | Medium | **Resolved** (void prefix + safeSaveState) |

### Pre-existing items (integrated 2026-02-16)

| # | Item | Layer | Severity | Status |
|---|------|-------|----------|--------|
| 36 | Folder scans instead of events (relates to TD-32) | Infrastructure | Low | Open |
| 37 | No release- and publishing strategy | Cross-cutting | Low | Postponed |
| 38 | Outdated Component Library View | UI | Low | Open |

---

## Improvement Plan — Pre-Feature Priorities

> Updated 2026-02-16. All four prioritized rounds completed. Dead code cleanup done.

### State: 27 of 38 items resolved, 0 high-severity open items

The codebase is in excellent shape. All high-severity items are resolved. The remaining 8 open items are 3 medium + 7 low (including 2 mitigated, 1 postponed). None are blockers for feature work.

### Completed: Round 3 (TD-22, TD-30 Tier 2, TD-16)

- **TD-22** — ExportService type-unsafe cast already removed during Phase 8 refactoring
- **TD-30 Tier 2** — 4 new test files + 1 expanded (149 tests, 95-100% coverage). Combined with Tier 1: 447 tests across 8 files
- **TD-16** — `TypedStorage<T>` abstraction with `ITypedStorage<T>` interface. 9 persistent services migrated. SettingsService intentionally excluded (root-level Zod pattern, `FlowtiSettingTab` directly calls `plugin.saveSettings()`)

### Completed: Dead Code Cleanup (2026-02-16)

- **Deleted `persistence.ts`** — `loadStateFromStorage`, `saveStateToStorage`, `safeLoadState`, `safeSaveState` had zero source imports after TypedStorage migration. Test file also removed (-11 tests, -1 suite)
- **Removed `CUSTOM_EVENTS_CATEGORY`** — deprecated alias in `catalog/helpers.ts`, no remaining references
- **Verified `main.ts:saveSettings()` is NOT dead code** — called 6 times by `FlowtiSettingTab.ts` via `this.plugin.saveSettings()`. The `as object` cast in this method is the last remaining instance of the old storage pattern, intentionally preserved since SettingsService stores settings at root level (not key-scoped)

### Insights from Fresh Scan (2026-02-16)

- **Console usage**: 36 `console.*` calls in `src/`. Concentrated in infrastructure/error/bootstrap paths where LoggerService is unavailable. No silent swallows remain (TD-29 mitigated). Acceptable.
- **Wildcard listeners**: Up to 7 (UserHubActivity added). All use `isSkippedEvent()` filter. UserHubActivity and EventLogView are view-scoped (only active while respective view is open). InboxService uses 4 specific event listeners (not wildcard) — no performance concern. No performance concern at current volumes.
- **Files > 500 LOC**: Down to 13 (from 14). `helpers.ts` dropped from 579 to 531.
- **No new debt patterns detected**: No TODO/FIXME comments, no unsafe `any` casts beyond justified exceptions, no circular dependencies.

### Remaining Open Items (deferred)

| Item | Severity | Reason to defer |
|------|----------|-----------------|
| **TD-06** (EventBridge bypass, 112 calls) | Medium | All 112 calls are **read-only** UI queries. Routing reads through EventBridge would add boilerplate without safety benefit. |
| **TD-12** (Wildcard listeners) | Low | 7 listeners (2 view-scoped), all properly filtered via `isSkippedEvent()`. No measured performance issue. |
| **TD-23** (InstallerWizardModal state) | Low | Stable modal, runs once per vault, 396 LOC. Low ROI to refactor. |
| **TD-27** (UI component tests) | Medium | ~32 untested components (down from ~40). User Hub components + Inbox domain fully tested. Address incrementally as components are modified for features. |
| **TD-28** (Scanner duplication) | Low | Catalog and Hub use fundamentally different data sources (files vs storage). Low actual duplication. |
| **TD-30** (Tier 3 bootstrap tests) | Medium | Bootstrap/wiring files have low ROI for unit testing. Tiers 1+2 (447 tests) + Hub domain (26 tests) complete. |
| **TD-36** (Folder scans vs events) | Low | Deferred normalization pattern from TD-32 already addresses this. EventBus approach possible but adds complexity for marginal benefit. |
| **TD-37** (Release strategy) | Postponed | Manual build → copy to plugins folder. GitHub releases deferred until plugin matures. |
| **TD-38** (Component Library View) | Low | `ComponentShowcaseView` needs update to reflect current component inventory. Low priority. |

### Recommended Next Steps

1. **Feature development** — the codebase is clean; proceed with new features
2. **TD-27** — address incrementally as UI components are touched for features
3. **TD-38** — update `ComponentShowcaseView` if showcasing new components
4. **TD-37** — establish release strategy when ready for external distribution
