---
severity: info
category: review
layer: cross-cutting
status: reference
effort: n/a
description: Comprehensive technical debt review of the Flowti IBDE codebase as of 2026-02-13. Serves as the baseline reference for all individual debt items.
reviewed: 2026-02-13
updated: 2026-02-14
reviewer: Technical Architect
---
# Technical Debt Review - 2026-02-13

Baseline audit of the Flowti IBDE plugin codebase. This document summarises the findings; each actionable item has its own file in this folder and is tracked through the `Technical Debt.base` view.

---

## Scope

| Metric | Value (original) | Value (2026-02-14) |
|--------|-----------------|-------------------|
| Source files | 92 TypeScript files | 141 TypeScript files |
| Test files | 35 suites, 654 tests (4 skipped) | 41 suites, 811 tests (4 skipped) |
| Test result | All passing | All passing |
| Type check | Clean (`tsc -noEmit -skipLibCheck`) | Clean |
| Lint | Clean (`eslint ./src/`) | Clean |
| Production deps | 2 (papaparse, zod) | 2 (papaparse, zod) |
| Dev deps | 13 packages | 13 packages |
| Build pipeline | vitest > typedoc > tsc > eslint > esbuild | vitest > typedoc > tsc > eslint > esbuild |

The codebase is healthy at the surface: all tests pass, types check, and lint is clean. The debt identified below is structural and architectural in nature.

---

## Progress Update (2026-02-14)

Phases 7 (main.ts decomposition) and 8 (DocService centralization) resolved or reduced multiple debt items. An audit on 2026-02-14 reassessed all 26 items.

### Summary by Status

| Status | Count | Items |
|--------|-------|-------|
| Resolved | 10 | TD-02, TD-04, TD-05, TD-09, TD-10, TD-14, TD-15, TD-24, TD-26 |
| Reclassified | 2 | TD-01 (critical->high), TD-09 (high->low) |
| Open | 16 | TD-01, TD-03, TD-06, TD-07, TD-08, TD-09, TD-11, TD-12, TD-13, TD-16, TD-17, TD-18, TD-19, TD-20, TD-21, TD-22, TD-23, TD-25 |

### Summary by Severity (current)

| Severity | Open | Resolved | Description |
|----------|------|----------|-------------|
| Critical | 1 | 4 | TD-03 (JobQueue exceptions) remains |
| High | 5 | 4 | TD-06 (EventBridge bypass), TD-07, TD-08, TD-11, TD-12 |
| Medium | 8 | 0 | Duplicated patterns, type safety, tsconfig |
| Low | 2 | 2 | TD-09 (reclassified), TD-25 remain |

---

## Architectural Observations

### What Works Well

1. **Event-driven backbone** -- The EventBus + EventBridge pattern delivers on its promise. Services are decoupled and testable.
2. **Type safety** -- Strict TypeScript with Zod validation at boundaries. The composed `FlowtiEventMap` keeps event contracts explicit.
3. **Registry pattern** -- Commands, views, and services are declaratively registered and automatically wired. Extending the plugin requires minimal boilerplate.
4. **Test coverage** -- 811 tests across 41 suites with mirrors of the source tree. Infrastructure and domain layers are well-covered.
5. **Separation of concerns** -- The DDD layer structure (`infrastructure/`, `domain/`, `ui/`) is consistently applied in the codebase.
6. **Service lifecycle** -- 9 of 11 domain services implement `IDisposable` with proper `dispose()` methods. `ServiceContainer.disposeAll()` handles cleanup on unload.
7. **DocService centralization** -- All doc creation routes through `doc.create` events (Phase 8), eliminating 16+ scattered `fileSystemClient.createFile()` calls.

### Where Debt Accumulates

1. **EventBridge boundary erosion** -- The UI layer bypasses EventBridge in 121 locations, directly calling `app.vault`, `app.metadataCache`, and `app.workspace`. This is the largest remaining architectural issue (TD-06).
2. **UI file sizes** -- 10 files exceed 500 LOC (down from 4 exceeding 1,000 LOC). Orchestrator files are expected to be larger, but HubDashboard (766), CsvLanding (701), and EventsTab (655) have further decomposition opportunities.
3. **Duplicated infrastructure patterns** -- Storage merging, path extraction, and event skipping prefixes are copy-pasted across 8+ services (TD-16, TD-17, TD-18).
4. **Safety gaps** -- JobQueue swallows exceptions silently (TD-03), weak ID generation in 5 services (TD-13), no error handling on storage operations (TD-11).

---

## Individual Debt Items

Each item below has a dedicated file in this folder with full details. See the `Technical Debt.base` view for the live tracker.

### Critical

| # | Item | Layer | Status |
|---|------|-------|--------|
| 1 | UI files exceed size convention (10 files > 500 LOC) | UI | Open (reclassified to high) |
| 2 | Missing dispose() on domain services | Domain | **Resolved** |
| 3 | JobQueue swallows exceptions silently | Domain | Open |
| 4 | Global document listeners without cleanup | UI | **Resolved** |
| 5 | main.ts exceeds orchestrator role | Infrastructure | **Resolved** |

### High

| # | Item | Layer | Status |
|---|------|-------|--------|
| 6 | UI layer bypasses EventBridge (121 direct API calls) | UI | Open |
| 7 | FileSystemClient timeout/response race condition | Infrastructure | Open |
| 8 | DataExchangeService append not atomic | Domain | Open |
| 9 | Catalog tab render listener accumulation | UI | **Reclassified to low** |
| 10 | IngestionService batch timer leak on dispose | Domain | **Resolved** |
| 11 | No error handling on storage load/save across services | Domain | Open |
| 12 | Wildcard listeners on all events degrade performance at scale | Domain | Open |
| 13 | Weak ID generation (collision risk) | Domain | Open |
| 14 | SettingsService event listeners leak | Domain | **Resolved** |
| 15 | EventBridge createFolder only handles one level of nesting | Infrastructure | **Resolved** |

### Medium

| # | Item | Layer | Status |
|---|------|-------|--------|
| 16 | Duplicated storage merging pattern across 8+ services | Cross-cutting | Open |
| 17 | SKIPPED_PREFIXES duplicated in 4 services | Cross-cutting | Open |
| 18 | Path extraction pattern duplicated 5+ times | Cross-cutting | Open |
| 19 | tsconfig.json not using strict: true | Infrastructure | Open |
| 20 | BaseQueryEngine regex patterns not pre-compiled | Domain | Open |
| 21 | ImportService uses exception-based fileExists() | Domain | Open |
| 22 | ExportService type-unsafe payload cast | Domain | Open |
| 23 | InstallerWizardModal mixes state and rendering | Domain | Open |

### Low

| # | Item | Layer | Status |
|---|------|-------|--------|
| 24 | AGENTS.md source tree is outdated | Documentation | **Resolved** |
| 25 | ComponentShowcaseView contains German text and inline styles | UI | Open |
| 26 | eventDocTemplate.ts could use template engine | UI | **Resolved** |
