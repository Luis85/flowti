---
type: TechDebt
stage: open
domain: session
severity: medium
source: "[[Closure review does not open when completing from dashboard with sidebar occupied]]"
---

## Description

When completing a session from the User Hub Dashboard while the sidebar is occupied by another view, the closure review overlay does not open. The session transitions to "reviewing" state but the overlay is not visible.

## Impact

Users may skip the closure ritual unintentionally when completing sessions from the dashboard.

## Proposed Fix

Ensure `SessionClosureOverlay` is rendered regardless of sidebar state. May need to open/focus the SessionWorkspaceView before showing the overlay.
