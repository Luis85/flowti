---
type: Bug
stage: fixed
origin: inbox
domain: session
priority: "01 - medium"
description: "Sessions with identical titles are visually indistinguishable in the User Hub sessions list."
parent: "[[Session Workspaces PRD]]"
fixed_in: "Cycle 8 — post-delivery hotfix"
---
## Context

When two or more sessions share the same title (e.g., "Domain Design"), the sessions list in the User Hub renders identical rows. Users cannot tell which session is which without clicking each one to inspect the detail panel.

## Root Cause

`UserHubSessions.renderSessionRow()` only displayed title + type badge with no timestamp or other unique identifier.

## Fix (2026-02-20)

Added a creation date+time hint (`M/D HH:MM`) to each session row, displayed after the title with `margin-left: auto` to push it to the right edge. Always visible, not just when titles collide.

**File changed**: `src/ui/userHub/UserHubSessions.ts` (line 141-146)

**Verification**: 2,794 tests passing, 0 failures. 1 new test added for disambiguation.
