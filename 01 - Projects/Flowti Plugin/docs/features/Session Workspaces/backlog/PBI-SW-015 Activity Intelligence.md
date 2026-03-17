---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: delivered
priority: low
effort: small
dependencies: []
delivered_in: "Cycle 9 Inc 3"
user_story: "[[I want to track lead-time and cycle-time of certain entities worth the effort]]"
note: "Extends existing FR-01 Activity Log with computed analytics. Counters (files modified, artifacts produced, tasks completed, events emitted) and time breakdown (wall clock, active vs paused). Unified session note: Activity Intelligence section, artifact links, closure ritual, restructured frontmatter. Filter respect via isExcluded() threading."
tags:
  - backlog
  - session-v2
---

## User Story — Problem Space

As a session user, I want to see computed analytics about my session activity so that I understand how I spent my time and what I accomplished.

### User Pains

- Activity log shows raw events but no aggregated metrics
- No visibility into active vs paused time breakdown
- No count of files modified, tasks completed, or events emitted
- Session summary lacks quantitative analytics

### User Needs

- Counters: files modified, tasks completed, events emitted
- Time breakdown: active time vs paused time
- Compact analytics display in Sidebar
- Full analytics card in Main mode

## Solution Statement

### Functional Requirements

- [x] `computeActivityIntelligence(session, now, globalFilter): ActivityIntelligence` pure function
- [x] `ActivityIntelligence` type: `{ filesModified, artifactsProduced, tasksCompleted, eventsEmitted, wallClockMs, activeTimeMs, pauseTimeMs }`
- [x] Files modified: count of unique paths in `session.activity` (filtered via `isExcluded()`)
- [x] Artifacts produced: count of `session.artifacts` (filtered via `isExcluded()`)
- [x] Tasks completed: count of `executionTasks.filter(t => t.completed)`
- [x] Active/pause/wall clock time: computed from existing helpers
- [x] Events emitted: count of timeline entries
- [x] Compact stats row in workspace (`SessionActivityIntelligencePanel`, 67 LOC)
- [ ] Full analytics card in Main mode (deferred — Main/Sidebar differentiation via PBI-SW-017)
- [x] Analytics included in session summary (unified `### Activity Intelligence` section)
- [x] Artifact wiki-links inside Activity Intelligence section
- [x] Closure ritual responses rendered as `### Closure Ritual` section
- [x] Activity metrics in session note frontmatter (flat key:value pairs)
- [x] `SessionFrontmatter` restructured with `type: "SessionNote"` literal
- [x] Global + per-session folder filters respected via `isExcluded()` threading

### Technical Requirements

- Pure computation functions in `src/domain/session/helpers.ts`
- Reuses existing timeline helpers: `computeActiveTimeMs()`, `computeTotalPauseMs()`, `computeWallClockMs()`
- No new events or storage — all data derived from existing session state
- UI components follow shared component pattern
- Filter threading via optional `globalFilter: string[]` parameter (backward compatible)

### Constraints

- No new data tracking — all metrics computed from existing session fields
- Performance: computation must be < 16ms for real-time display

## Acceptance Criteria

- [x] Activity intelligence shows file count, artifact count, task count, event count
- [x] Time breakdown shows wall clock, active, and paused duration
- [x] Analytics visible in workspace (compact stats row)
- [x] Analytics included in session summary (unified section)
- [x] Closure ritual included in session notes
- [x] Frontmatter includes activity metrics as flat key:value pairs
- [x] Global + per-session filters respected retroactively
- [x] `npm test` passes (2,849 tests, 0 failures)

### INVEST Checklist

| Criterion | Met? | Notes |
|-----------|------|-------|
| **I**ndependent | Yes | Pure computation — no dependencies |
| **N**egotiable | Yes | Which metrics to show and display format |
| **V**aluable | Yes | Quantitative session insights + unified session note |
| **E**stimable | Yes | ~221 LOC production, ~60 tests (expanded from original estimate) |
| **S**mall | Yes | Single increment (with user-directed expansions) |
| **T**estable | Yes | Pure functions with mock session data |

## Delivery Outcome

### Files Created

| File | LOC | Purpose |
|------|-----|---------|
| `src/ui/session/SessionActivityIntelligencePanel.ts` | 67 | Compact stats row |
| `tests/ui/session/SessionActivityIntelligencePanel.test.ts` | 181 | 7 UI tests |

### Files Modified

| File | LOC | Change |
|------|-----|--------|
| `src/domain/session/types.ts` | 490 | `ActivityIntelligence` interface (+7) |
| `src/domain/session/helpers.ts` | 982 | `computeActivityIntelligence()`, frontmatter restructure, body rewrite (+139) |
| `src/ui/SessionWorkspaceView.ts` | 612 | Intelligence panel wiring (+75) |
| `src/ui/session/SessionWorkspaceSubscriptions.ts` | 340 | Panel refresh on task/activity events (+20) |
| `src/domain/session/handlers/syncHandlers.ts` | 123 | globalFilter passed to `mergeSessionNotes()` |
| `src/sessionSetup.ts` | 221 | globalFilter passed to summary/merge functions |
| `tests/domain/session/helpers.test.ts` | 2,243 | 53 new + 2 updated tests |

### Metrics

| Metric | Estimated | Actual |
|--------|-----------|--------|
| Source LOC | ~100 | **221** (expanded scope) |
| Tests | ~15 | **60** |
| Increments | 1 | **1** |
| TASM | — | **33/35 (Excellent)** |

## Related

- PRD: [[Session Workspaces PRD]] (FR-15)
- Extends: [[PBI-SW-001 Activity Log]] (FR-01 foundation)
- Reuses: `computeActiveTimeMs()`, `computeTotalPauseMs()`, `computeWallClockMs()`, `isExcluded()` from session helpers
- Review: [[Cycle 9 Inc 3 Review - Activity Intelligence]]
