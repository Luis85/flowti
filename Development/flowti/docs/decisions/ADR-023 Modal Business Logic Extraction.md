---
type: DecisionNote
adr: ADR-023
title: Modal Business Logic Extraction
status: Accepted
date: 2026-02-15
domain: cross-cutting
category: Architecture
drivers:
  - Testability
  - Separation of Concerns
  - DDD Layering
tags:
  - decision
  - architecture
  - ui
  - testing
---

# ADR-023: Modal Business Logic Extraction

## Status

**Accepted** — applied to PipelineSourceModal and PipelinePreview.

## Context

The Technical Review (2026-02-15, Section 8) identified ~85 untested business logic functions across 21 UI files. A significant portion of this logic lives inside modals and view components that mix data transforms with presentation code, making it impossible to test without DOM environments.

Two patterns were identified:

1. **Pure functions trapped in UI files** — deterministic data transforms (CSV column matching, mapping synchronization) inlined in modal methods instead of being in `utils/`.
2. **Data-gathering pipelines in UI** — async multi-step operations (parse CSV, extract keys, check vault) interleaved with DOM rendering in the same method.

### The Question: Do We Need a ModalService?

No. A centralized `ModalService` would be the wrong abstraction because:

- Modals don't share behavior — each modal has a unique domain concern
- The domain services already exist (`DataExchangeService`, `SubscriptionService`, etc.)
- A `ModalService` would become a god-object coupling all modal-to-service interactions
- Modals emitting domain events (e.g., `subscription.create`) is the correct pattern — they act as thin command senders, not service bypasses

## Decision

Extract business logic from UI components using two targeted patterns:

### Pattern 1: Pure Functions → `utils/`

Move pure, deterministic functions from UI files to `src/utils/`. These functions have zero dependencies on Obsidian APIs and are trivially testable.

**Applied to:**
- `matchMergeKeyColumn(mergeKey, headers)` — fuzzy column name matching (from `PipelineSourceModal.parseCsv()`)
- `syncColumnMappings(headers, existing)` — column mapping diff/sync (from `PipelineSourceModal.parseCsv()`)
- All 5 functions from `ui/csv/csvUtils.ts` — relocated to `utils/csvUtils.ts` with backward-compatible re-export barrel

**When to apply this pattern:**
- The function has no side effects (no DOM, no events, no vault writes)
- The function is deterministic (same input → same output)
- The function could be reused outside its current UI context

### Pattern 2: Data Pipelines → Domain Service Methods

Move async data-gathering logic from UI components into existing domain services. The UI component then calls a single service method and renders the result.

**Applied to:**
- `PipelineExecutor.buildPreview(pipeline, fileExists)` — extracted from `PipelinePreview.run()`. Parses all source CSVs, extracts merge keys, deduplicates, builds expected filenames, and checks existence via an injected callback.

**Before:**
```typescript
// PipelinePreview.run() — 80 LOC of data logic + 80 LOC of rendering
async run(pipe) {
  const importService = this.deps.dataExchangeService.getImportService();
  for (const source of pipe.sources) {
    const parsed = await importService.parseFile(source.csvPath);
    // 40 more lines of data gathering...
  }
  // 80 lines of DOM rendering...
}
```

**After:**
```typescript
// PipelinePreview.run() — 15 LOC of orchestration + 80 LOC of rendering
async run(pipe) {
  const executor = this.deps.dataExchangeService.getPipelineExecutor();
  const result = await executor.buildPreview(pipe, fileExists);
  this.renderContent(section, pipe, result);
}
```

**When to apply this pattern:**
- The logic involves async operations (file reads, service calls)
- The logic transforms domain data (not just formatting for display)
- The logic could be tested with mocked dependencies (no DOM needed)

### What Stays in UI

These patterns are acceptable in UI components and should NOT be extracted:

| Pattern | Why It's Fine |
|---------|--------------|
| Event emission for commands (`eventBus.emit("subscription.create", ...)`) | Modals act as thin command senders — this IS the service interface |
| Form-to-payload mapping (`pathPattern \|\| undefined`) | Trivial transforms that are tightly coupled to form structure |
| DOM rendering and event listener setup | Core UI responsibility |
| Progress event subscriptions with cleanup | Event-driven feedback is a UI concern |

## Consequences

### Positive

- **85+ LOC of business logic** moved from UI to testable locations
- **~45 new tests** cover the extracted logic (csvUtils: ~35, buildPreview: ~12)
- `PipelinePreview.ts` reduced from 263 → 189 LOC (all remaining LOC is rendering)
- `PipelineSourceModal.parseCsv()` reduced from 48 → 14 LOC
- Clear boundary: UI calls service methods and renders results

### Negative

- `DataExchangeService` gains a new accessor (`getPipelineExecutor()`)
- `PipelineExecutor` gains a dependency on `pathUtils.basename()`
- `ui/csv/csvUtils.ts` becomes a re-export barrel (minor indirection)

### Neutral

- Modals continue to emit domain events directly — this is by design (ADR-008: UI Command Bus)
- No new services created — logic moved to existing service methods

## Affected Files

| Action | File |
|--------|------|
| CREATE | `src/utils/csvUtils.ts` (7 pure functions) |
| CREATE | `tests/utils/csvUtils.test.ts` (~35 tests) |
| MODIFY | `src/ui/csv/csvUtils.ts` → re-export barrel |
| MODIFY | `src/ui/PipelineSourceModal.ts` (uses `matchMergeKeyColumn`, `syncColumnMappings`) |
| MODIFY | `src/domain/dataExchange/PipelineExecutor.ts` (adds `buildPreview()`) |
| MODIFY | `src/domain/dataExchange/DataExchangeService.ts` (adds `getPipelineExecutor()`) |
| MODIFY | `src/domain/dataExchange/types.ts` (adds preview types) |
| MODIFY | `src/ui/hub/pipelines/PipelinePreview.ts` (delegates to `buildPreview()`) |
| MODIFY | `tests/domain/dataExchange/PipelineExecutor.test.ts` (adds ~12 preview tests) |
