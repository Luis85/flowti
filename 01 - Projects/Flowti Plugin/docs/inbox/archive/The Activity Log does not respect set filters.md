---
type: Bug
stage: fixed
origin: inbox
domain: session
priority: "01 - medium"
description: "Activity log does not respect configured folder filters."
parent: "[[Session Workspaces PRD]]"
fixed_in: "Cycle 8 — post-delivery hotfix"
---
## Context

The session activity log (`SessionActivityPanel`) displayed all stored activity entries without applying folder filters. The `isExcluded()` filter was only called at **write time** in `SessionService.trackActivityToSession()`, meaning entries stored before a filter was configured still appeared.

## Root Cause

`renderActivityList()` passed the raw unfiltered `session.activity` array directly to `groupActivityByFile()`. No call to `isExcluded()` happened at render time, and `SessionPanelDeps` did not expose the global filter.

## Fix (2026-02-20)

1. Added `getGlobalActivityFilter: () => string[]` to `SessionPanelDeps` interface
2. Wired it in `SessionWorkspaceView.createPanelDeps()` via `sessionService.globalActivityFilter`
3. Added `getFilteredActivity()` method to `SessionActivityPanel` — applies `isExcluded()` at display time, skips filtering for completed/archived sessions
4. Header count now reflects filtered count
5. 8 new tests covering: global filter, per-session filter, combined, retroactive, completed/archived bypass, count update, empty-after-filter

**Files changed**: `src/ui/session/types.ts`, `src/ui/SessionWorkspaceView.ts`, `src/ui/session/SessionActivityPanel.ts`, + 8 test files updated for new deps field.

**Verification**: 2,794 tests passing, 0 failures.
