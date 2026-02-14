---
severity: low
category: architecture
layer: cross-cutting
status: mitigated
created: 2026-02-14
updated: 2026-02-14
effort: medium
description: 62 catch blocks across 24 files use 4 distinct error handling strategies with no unified convention. One catch silently swallows errors.
source: "[[Technical Review 2026-02-14]]"
---
# TD-29: Error handling inconsistency

## Problem

The codebase has 62 `catch` blocks across 24 files, using 4 distinct strategies with no documented convention:

| Strategy | Count | Files | Example |
|----------|-------|-------|---------|
| Domain wrapping | ~12 | ErrorService, FlowtiError, EventBridge | Wraps in `FlowtiError`, emits `error.*` event |
| Logged + emitted | ~18 | CommandRegistry, DataExchangeService, CsvActionView | `console.error()` + emits failure event |
| Console-only | ~25 | ExportView, PipelinePreview, IngestionService | `console.error()` with no further propagation |
| Silent swallow | 1 | SourcesExportsGrid | `.catch(() => { /* parse error */ })` |

### Top-affected files

| File | Catch blocks | Strategy |
|------|-------------|----------|
| EventBridge | 9 | Domain wrapping (consistent) |
| CsvActionView | 7 | Mixed (logged + emitted, console-only) |
| ExportView | 5 | Console-only |
| ConfigDocService | 4 | Nearly identical catch blocks (candidate for extraction) |
| main.ts | 4 | Console-only |

## Impact

- Silent swallow in `SourcesExportsGrid.ts:279` hides parse errors from users and logs
- Console-only catches lose errors in production (Obsidian has no persistent console)
- No way to surface domain errors to UI notifications uniformly
- `ConfigDocService` has 4 near-identical catch blocks that should be a shared handler

## Suggested Remediation

1. **Establish convention**: domain services use `FlowtiError` + `error.*` event; UI uses `console.error()` + user notification
2. **Fix silent swallow**: add `console.warn()` in SourcesExportsGrid catch
3. **Extract shared handler**: `ConfigDocService` 4 identical catches → single utility
4. **Consider ErrorBoundary**: UI-level error boundary that catches and displays errors via Notice

## Affected Files

- `src/ui/hub/pipelines/SourcesExportsGrid.ts` (silent swallow)
- `src/domain/dataExchange/ConfigDocService.ts` (4 identical catches)
- `src/ui/CsvActionView.ts` (mixed strategies)
- `src/ui/ExportView.ts` (console-only, 5 catches)
- 20 additional files with catch blocks

## Resolution

Partially mitigated in refactoring phase 2026-02-14:
- Silent swallow in `SourcesExportsGrid.ts` replaced with `console.warn`
- Severity downgraded from medium to low
- Remaining error handling inconsistency (62 catch blocks, 4 strategies) documented but not fully addressed
- Broader convention unification deferred to future phase
