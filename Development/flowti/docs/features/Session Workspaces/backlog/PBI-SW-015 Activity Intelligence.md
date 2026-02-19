---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: planned
priority: low
effort: small
dependencies: []
user_story: "[[I want to track lead-time and cycle-time of certain entities worth the effort]]"
note: "Extends existing FR-01 Activity Log with computed analytics. Counters (files modified, tasks completed, events emitted) and time breakdown (active vs paused). No new tracking infrastructure — all data already exists in session state. Pure computation layer."
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

- [ ] `computeActivityIntelligence(session): ActivityIntelligence` pure function
- [ ] `ActivityIntelligence` type: `{ filesModified, tasksCompleted, eventsEmitted, activeTimeMs, pauseTimeMs }`
- [ ] Files modified: count of unique paths in `session.activity`
- [ ] Tasks completed: count of `executionTasks.filter(t => t.completed)`
- [ ] Active/pause time: computed from existing `computeActiveTimeMs()` and `computeTotalPauseMs()` helpers
- [ ] Events emitted: count of timeline entries
- [ ] Compact stats row in Sidebar
- [ ] Full analytics card in Main mode
- [ ] Analytics included in session summary

### Technical Requirements

- Pure computation functions in `src/domain/session/helpers.ts`
- Reuses existing timeline helpers: `computeActiveTimeMs()`, `computeTotalPauseMs()`, `computeWallClockMs()`
- No new events or storage — all data derived from existing session state
- UI components follow shared component pattern

### Constraints

- No new data tracking — all metrics computed from existing session fields
- Performance: computation must be < 16ms for real-time display

## Acceptance Criteria

- [ ] Activity intelligence shows file count, task count, event count
- [ ] Time breakdown shows active vs paused duration
- [ ] Analytics visible in both Main and Sidebar modes
- [ ] Analytics included in session summary
- [ ] `npm run build` passes

### INVEST Checklist

| Criterion | Met? | Notes |
|-----------|------|-------|
| **I**ndependent | Yes | Pure computation — no dependencies |
| **N**egotiable | Yes | Which metrics to show and display format |
| **V**aluable | Yes | Quantitative session insights |
| **E**stimable | Yes | ~100 LOC, ~15 tests |
| **S**mall | Yes | Single increment |
| **T**estable | Yes | Pure functions with mock session data |

## Estimated Size

- **Source LOC:** ~100
- **Tests:** ~15
- **Increments:** 1

## Related

- PRD: [[Session Workspaces PRD]] (FR-15)
- Extends: [[PBI-SW-001 Activity Log]] (FR-01 foundation)
- Reuses: `computeActiveTimeMs()`, `computeTotalPauseMs()` from session helpers
