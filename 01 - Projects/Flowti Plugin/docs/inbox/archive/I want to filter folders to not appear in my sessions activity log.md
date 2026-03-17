---
type: Idea
stage: delivered
origin: inbox
domain: session
parent: "[[Session Workspaces PRD]]"
description: "Configure global and per-session folder exclusions for the activity log."
tags:
priority: 01 - medium
rank:
status: delivered
delivered_in:
  - "[[Phase 4 Inc 9 - Sidebar Workspace and Activity Consolidation]]"
  - "[[Cycle 4 - Auto-Session and Activity Polish]]"
delivered_date: 2026-02-18
related:
  - "[[file events in the sessions activity log should only be displayed in one item]]"
  - "[[I always want to have a daily-session to track what I have done over the day]]"
---

I want to configure general folders for all sessions and I want to configure filtered folders for every session independently.

**Status (2026-02-18):** Fully delivered. Per-session folder filter in Inc 10 — `SessionActivityPanel` renders filter tags with add/remove. Global session filter delivered in Cycle 4 — `sessionActivityFilterGlobal` in settings, configurable via User Hub Preferences > Sessions > Activity Log Filter. Applied to all sessions by default via `SessionService.globalActivityFilter`.
