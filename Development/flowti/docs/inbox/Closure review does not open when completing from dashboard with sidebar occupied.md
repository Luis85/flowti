---
type: Bug
stage: fixed
origin: inbox
domain: session
priority: "2 - high"
description: "Completing a session from the dashboard does not open the closure review when another session is already visible in the sidebar workspace."
parent: "[[Session Workspaces PRD]]"
fixed_in: "Cycle 8 — post-delivery hotfix"
related:
  - "[[The Activity Log does not respect set filters]]"
  - "[[Sessions list does not disambiguate same-titled sessions]]"
---
## Context

When a completed session is displayed in the sidebar workspace and the user clicks "Complete" on a different running session from the User Hub dashboard, the closure review overlay does not appear. Collapsing the sidebar first and then clicking Complete causes the review to open in a new tab instead of reusing the sidebar.

## Root Cause (two issues)

1. **Missing auto-open listener**: `main.ts` had no listener for `session.closure.started`. Only `session.created` triggered `openSessionWorkspaceInSidebar()`. When closure began, nothing opened or switched the workspace to the new session.

2. **Missing `state: { sessionId }` in `setViewState()`**: `sessionSetup.ts` `openSessionWorkspaceInSidebar()` called `leaf.setViewState()` without passing the `sessionId` in the state object. When reusing an existing sidebar leaf, `SessionWorkspaceView.setState()` was never called with the new session ID, so the view kept showing the old session.

## Fix (2026-02-20)

1. Added `session.closure.started` listener in `main.ts` (after the existing `session.created` listener) that calls `openSessionWorkspaceInSidebar(event.payload.sessionId)`
2. Fixed `openSessionWorkspaceInSidebar()` in `sessionSetup.ts` to pass `state: sessionId ? { sessionId } : undefined` in the `setViewState()` call, matching the pattern already used in `UserHubView.openSessionWorkspace()`

**Files changed**: `src/main.ts`, `src/sessionSetup.ts`

**Verification**: 2,794 tests passing, 0 failures.
