---
type: TechDebt
severity: medium
category: performance
layer: domain
status: open
effort: medium
updated: 2026-02-19
description: Session workspace performance and note sync behaviour feels sluggish and inconsistent. Needs investigation — profiling, debounce tuning, potential race conditions between forward/reverse sync.
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

- `src/domain/session/SessionService.ts` (~1,662 LOC) — sync handlers, debounce timers
- `src/domain/session/helpers.ts` (~843 LOC) — `generateSessionSummaryBody()`, `reverseParseSessionNotes()`
- `src/ui/session/SessionWorkspaceView.ts` (~537 LOC) — render subscriptions
- `src/ui/session/SessionWorkspaceSubscriptions.ts` (~304 LOC) — 24+ event listeners

## Resolution

Investigate first, then decide on fixes. Potential mitigations:
- Tune debounce values based on profiling
- Batch related event emissions to reduce render frequency
- Move file I/O to background where possible
- Add render coalescing in SessionWorkspaceView

## Related

- [[TD-12 Wildcard listeners degrade performance]]
- [[TD-58 Performance baseline and monitoring thresholds]]
- [[Session Workspaces PRD]]
