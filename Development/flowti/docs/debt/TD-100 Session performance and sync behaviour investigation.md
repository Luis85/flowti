---
type: TechDebt
severity: medium
category: performance
layer: domain
status: resolved
effort: medium
updated: 2026-02-21
resolved_in: "Cycle 9 Inc 2"
description: Session workspace render performance investigated and fixed. Added 16ms render debounce + batched panel refreshes to SessionWorkspaceView. Sync timing validated at 500ms (not 2,500ms as documented). No race conditions found.
domain: session
parent: "[[Session Workspaces PRD]]"
---

# TD-100: Session Performance and Sync Behaviour Investigation

## Observation

During real usage of the session workspace, the performance and sync behaviour does not feel right. Specific symptoms need investigation:

- Forward sync (session → note file) debounce at 2,500ms may feel laggy
- Reverse sync (note file → session) suppression window (1,000ms) may miss rapid edits
- Multiple event handlers firing on state changes may cause redundant re-renders
- Session workspace view re-renders on every event subscription — potential cascade
- Note file read/write during sync may block UI thread

## Investigation Areas

1. **Sync timing**: Profile forward/reverse sync debounce values. Are 2,500ms / 1,000ms appropriate?
2. **Event cascade**: Map which events trigger re-renders and whether any are redundant
3. **File I/O**: Measure `readFile` / `updateFile` latency during sync operations
4. **Race conditions**: Verify forward/reverse sync loop prevention under rapid edits
5. **Render performance**: Profile `scheduleRender()` frequency during active sessions
6. **Memory**: Check for listener accumulation during long sessions

## Affected Files

- `src/domain/session/handlers/syncHandlers.ts` — sync handlers, debounce timers
- `src/domain/session/helpers.ts` (~843 LOC) — `generateSessionSummaryBody()`, `reverseParseSessionNotes()`
- `src/ui/SessionWorkspaceView.ts` — render scheduling, panel refresh batching
- `src/ui/session/SessionWorkspaceSubscriptions.ts` — 27 event listeners

## Resolution (Cycle 9 Inc 2, 2026-02-21)

### Findings

| Area | Finding | Severity |
|------|---------|----------|
| **Sync timing** | `SESSION_NOTES_SYNC_DELAY_MS = 500ms` (both forward and reverse) — not 2,500ms as documented in TD-100. 500ms is appropriate for responsiveness. | LOW — documentation discrepancy only |
| **Render debounce** | SessionWorkspaceView had **NO render debounce** (unlike BaseHubView's 16ms). Every event handler called `render()` synchronously, rebuilding all DOM panels immediately. | **HIGH** — fixed |
| **Event cascade** | 27 event listeners, 13 triggered full `render()`, rapid cascading events (e.g. complete → closure.started → closure.completed) caused 3+ full DOM rebuilds in quick succession. | **MEDIUM** — fixed |
| **Reverse sync batching** | `session.notes.reverseSynced` handler triggered 3 separate panel refreshes (goals, tasks, notes) inline — no batching. | **MEDIUM** — fixed |
| **Race conditions** | Forward/reverse sync loop prevention is **safe** — `lastSyncedContent` cache in reverse sync correctly detects and skips content it just wrote. | NONE |
| **Listener accumulation** | All 27 listeners are properly unsubscribed in `onClose()`. No accumulation risk. | NONE |

### Fixes Applied

1. **Render debouncing** — Added `scheduleRender()` method to SessionWorkspaceView with 16ms debounce (matching BaseHubView pattern). All full re-render triggers now use `scheduleRender()` instead of direct `render()`. Only `session.timer.completed` and `session.deleted` retain immediate `render()` (important state transitions that must be visible instantly).

2. **Panel refresh batching** — Added `schedulePanelRefresh(panelId)` method that collects panel refresh requests in a `Set<string>` and flushes them in a single 16ms timer callback. 10 panel types supported: goals, tasks, notes, activity, decisions, reflections, energy, output, overload, actions.

3. **Subscription event categorization** — Reorganized all 27 subscriptions into 4 categories:
   - **Synchronous** (2): timer.tick (lightweight DOM update), timer.completed (important transition)
   - **Debounced full re-render** (11): lifecycle events, closure, notes/canvas file set, context bindings, activity filter, path reconciliation, deleted
   - **Debounced panel refresh** (12): energy, goals, tasks, decisions, reflections, notes, artifacts, activity, output, overload, reverse sync (batched)
   - **Async passthrough** (2): workspace state save/restore

### Outcome

| Metric | Before | After |
|--------|--------|-------|
| Render debounce | None | 16ms |
| Panel refresh batching | None | 16ms with Set<string> coalescing |
| Full renders per lifecycle transition | 1-3 (cascade) | 1 (coalesced) |
| Reverse sync panel refreshes | 3 synchronous calls | 1 batched call (3 panels) |
| Tests passing | 2,794 | 2,805 (+11 new/updated) |
| Files modified | — | 4 source + 2 test |

## Related

- [[TD-12 Wildcard listeners degrade performance]]
- [[TD-58 Performance baseline and monitoring thresholds]]
- [[Session Workspaces PRD]]
