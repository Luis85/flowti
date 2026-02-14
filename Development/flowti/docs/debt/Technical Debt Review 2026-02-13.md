---
severity: info
category: review
layer: cross-cutting
status: reference
effort: n/a
description: Comprehensive technical debt review of the Flowti IBDE codebase as of 2026-02-13. Serves as the baseline reference for all individual debt items.
reviewed: 2026-02-13
reviewer: Technical Architect
---
# Technical Debt Review — 2026-02-13

Baseline audit of the Flowti IBDE plugin codebase. This document summarises the findings; each actionable item has its own file in this folder and is tracked through the `Technical Debt.base` view.

---

## Scope

| Metric | Value |
|--------|-------|
| Source files | 92 TypeScript files |
| Test files | 35 suites, 654 tests (4 skipped) |
| Test result | All passing |
| Type check | Clean (`tsc -noEmit -skipLibCheck`) |
| Lint | Clean (`eslint ./src/`) |
| Production deps | 2 (papaparse, zod) |
| Dev deps | 13 packages |
| Build pipeline | vitest > typedoc > tsc > eslint > esbuild |

The codebase is healthy at the surface: all tests pass, types check, and lint is clean. The debt identified below is structural and architectural in nature.

---

## Summary by Severity

| Severity | Count | Description |
|----------|-------|-------------|
| Critical | 5 | Memory leaks, silent exception swallowing, file size violations |
| High | 10 | Missing dispose patterns, EventBridge boundary violations, race conditions |
| Medium | 8 | Duplicated patterns, weak ID generation, missing error handling |
| Low | 3 | Documentation drift, tsconfig strictness, showcase code quality |

---

## Architectural Observations

### What Works Well

1. **Event-driven backbone** — The EventBus + EventBridge pattern delivers on its promise. Services are decoupled and testable.
2. **Type safety** — Strict TypeScript with Zod validation at boundaries. The composed `FlowtiEventMap` keeps event contracts explicit.
3. **Registry pattern** — Commands, views, and services are declaratively registered and automatically wired. Extending the plugin requires minimal boilerplate.
4. **Test coverage** — 654 tests across 35 suites with mirrors of the source tree. Infrastructure and domain layers are well-covered.
5. **Separation of concerns** — The DDD layer structure (`infrastructure/`, `domain/`, `ui/`) is consistently applied in the codebase.

### Where Debt Accumulates

1. **UI layer** — Four files exceed 1,000 LOC (CsvActionView, DataExchangeHubView, ExportView, EventsTab). These are monolithic view classes that mix state, rendering, and Obsidian API access.
2. **Service lifecycle** — Most domain services register event listeners in `initialize()` but lack a `dispose()` method. The EventBus retains references until `clear()` on plugin unload, but this is implicit and fragile.
3. **EventBridge boundary** — The UI layer bypasses EventBridge in 30+ locations, directly calling `app.vault`, `app.metadataCache`, and `app.workspace`. This undermines the architectural decision to isolate Obsidian API access.
4. **main.ts growth** — At 956 lines, `main.ts` has accumulated view registration, command registration, context menus, and Data Exchange wiring that belongs in dedicated registries or services.
5. **Duplicated infrastructure patterns** — Storage merging, path extraction, and event skipping prefixes are copy-pasted across 8+ services.

---

## Individual Debt Items

Each item below has a dedicated file in this folder with full details. See the `Technical Debt.base` view for the live tracker.

### Critical

| # | Item | Layer |
|---|------|-------|
| 1 | UI files exceed size convention (4 files > 1,000 LOC) | UI |
| 2 | Missing dispose() on domain services (memory leaks) | Domain |
| 3 | JobQueue swallows exceptions silently | Domain |
| 4 | Global document listeners without cleanup (ExportView, CsvActionView) | UI |
| 5 | main.ts exceeds orchestrator role (956 LOC) | Infrastructure |

### High

| # | Item | Layer |
|---|------|-------|
| 6 | UI layer bypasses EventBridge (30+ direct API calls) | UI |
| 7 | FileSystemClient timeout/response race condition | Infrastructure |
| 8 | DataExchangeService append not atomic (concurrent export data loss) | Domain |
| 9 | Catalog tab render re-attaches DOM listeners without cleanup | UI |
| 10 | IngestionService batch timer leak on dispose | Domain |
| 11 | No error handling on storage load/save across services | Domain |
| 12 | Wildcard listeners on all events degrade performance at scale | Domain |
| 13 | Weak ID generation (collision risk) | Domain |
| 14 | SettingsService event listeners leak (no unsubscribe) | Domain |
| 15 | EventBridge createFolder only handles one level of nesting | Infrastructure |

### Medium

| # | Item | Layer |
|---|------|-------|
| 16 | Duplicated storage merging pattern across 8+ services | Cross-cutting |
| 17 | SKIPPED_PREFIXES duplicated in 4 services | Cross-cutting |
| 18 | Path extraction pattern duplicated 5+ times | Cross-cutting |
| 19 | tsconfig.json not using strict: true (uses individual flags) | Infrastructure |
| 20 | BaseQueryEngine regex patterns not pre-compiled | Domain |
| 21 | ImportService uses exception-based fileExists() | Domain |
| 22 | ExportService type-unsafe payload cast | Domain |
| 23 | InstallerWizardModal mixes state and rendering | Domain |

### Low

| # | Item | Layer |
|---|------|-------|
| 24 | AGENTS.md source tree is outdated | Documentation |
| 25 | ComponentShowcaseView contains German text and inline styles | UI |
| 26 | eventDocTemplate.ts could use template engine | UI |
