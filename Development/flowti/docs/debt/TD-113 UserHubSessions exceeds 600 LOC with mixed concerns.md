---
type: TechDebt
severity: medium
category: architecture
layer: ui
status: open
created: 2026-02-20
effort: medium
description: "UserHubSessions.ts is 633 LOC, mixing master list rendering, detail panel rendering, state management (collapsed categories), and timer display into a single class."
---

# TD-113: UserHubSessions exceeds 600 LOC with mixed concerns

## Problem

`UserHubSessions.ts` (633 LOC) handles four distinct responsibilities in a single class:

1. **Master list rendering**: Session items grouped by status (active, paused, completed, archived), with collapsible category headers.
2. **Detail panel rendering**: Full session detail including timeline, goals, tasks, reflections, artifacts, and template save.
3. **State management**: `collapsedCategories: Set<string>` for UI state, filter application, selection tracking.
4. **Timer display**: Live countdown rendering for active sessions, including duration formatting.

This exceeds the project's informal size convention (~400 LOC for UI components, per [[TD-01 UI files exceed size convention]]) and makes the file difficult to navigate, modify, and test.

## Impact

- High blast radius: changes to detail panel rendering risk breaking the master list or timer logic.
- Difficult to test individual concerns in isolation.
- The detail panel alone (~300 LOC) is large enough to be its own component, similar to how `EventDetailPanel`, `DomainDetailPanel` etc. are extracted in the catalog layer.

## Suggested Fix

Extract into focused components following the pattern established in the catalog layer:

| Component | Responsibility | Est. LOC |
|-----------|---------------|----------|
| `UserHubSessions` | Orchestration, master list, delegation | ~200 |
| `SessionDetailPanel` | Detail view rendering (timeline, goals, tasks, reflections) | ~250 |
| `SessionTimerDisplay` | Active timer countdown rendering | ~80 |

## Related

- [[TD-01 UI files exceed size convention]]
- [[TD-101 SessionService Handler Extraction]] (same class of issue in domain layer)

## Affected Files

- `src/ui/userHub/UserHubSessions.ts` (633 LOC)
