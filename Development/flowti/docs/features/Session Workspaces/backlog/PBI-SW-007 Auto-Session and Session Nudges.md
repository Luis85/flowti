---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: done
cycle: "[[Cycle 5 - Daily Summary and Session Nudges]]"
priority: medium
effort: large
dependencies: []
user_story: "[[I want to automatically start a Day Session to track my usage]]"
delivered_date: 2026-02-18
delivered_cycles:
  - "[[Cycle 4 - Auto-Session and Activity Polish]]"
  - "[[Cycle 5 - Daily Summary and Session Nudges]]"
note: "Fully delivered across Cycles 4+5. Core daily session in Cycle 4; nudges, daily summary, and UX polish in Cycle 5."
tags:
  - backlog
  - delivered
---

## User Story — Problem Space

As a vault user, I want a daily session to automatically start when I open Obsidian so that my day-to-day usage is captured without manual effort.

As a session user, I want to be nudged to start a focused session at configured times so that I give my activity more meaning and don't forget to start sessions.

### User Pains

- Users forget to start sessions — daily activity goes untracked
- No passive tracking mode — every session requires manual start
- Starting a session interrupts the current workflow
- No way to pre-configure sessions by time of day (morning standup, afternoon review)
- Activity log is only captured during explicitly started sessions

### User Needs

- Auto-start a "Daily" session on vault open (configurable on/off)
- Daily session runs passively alongside focused sessions (two concurrent sessions)
- Daily session writes activity summary to the daily note on vault close or day end
- Session nudges: configurable prompts to start sessions at specific times
- Pre-prepared sessions by time of day

## Solution Statement

### Use Cases

**Daily session flow:**
User opens Obsidian → daily session auto-starts (if enabled) → vault activity is tracked passively → user starts/stops focused sessions normally → on vault close, daily summary is appended to daily note

**Session nudge flow:**
Configured time arrives → Notice appears: "Ready to start your afternoon review?" → user clicks → session starts from pre-configured template → or dismisses

**Gherkin:**
```gherkin
Given the user has enabled daily auto-session in settings
And today's daily note exists
When the user opens the vault
Then a "Daily" session starts automatically
And vault activity is tracked alongside any focused sessions
And when the vault closes, a summary is appended to the daily note
```

### Cycle 4 Delivery Scope (core — nudges deferred)

**Delivered (Cycle 4):**
- [x] New session type: `"daily-tracking"` — passive, no timer countdown, no goals
- [x] Auto-start daily session on `workspace-ready` (configurable in settings: on/off, default off)
- [x] Concurrent session support: daily session runs alongside one focused session (two concurrent)
- [x] Daily session activity written to daily note on vault close
- [x] Daily note integration: append activity summary as a section in the user's daily note
- [x] Activity log aggregation: group file events by path (one row per file + edit count)

**Delivered (Cycle 5):**
- [x] Session nudge system: `SessionNudge` type with `{ id, time, templateId, message, enabled }`
- [x] Nudge configuration in FlowtiSettingTab (add/edit/remove nudges)
- [x] Nudge triggers Notice with "Start" / "Dismiss" buttons
- [x] Pre-prepared sessions: nudges can reference a `SessionTemplate` for one-click start
- [x] Daily summary generation with activity grouping and session metrics
- [x] Default nudge configurations
- [x] Dashboard nudge indicator

**Session UX Polish (Cycle 5):**
- [x] Command palette: `flowti:create-session` and `flowti:resume-session` commands
- [x] Dashboard quick action: "New Session" button on User Hub Dashboard

### Functional Requirements (full PBI scope) — All Delivered

- [x] New session type: `"daily-tracking"` — passive, no timer countdown, no goals
- [x] Auto-start daily session on `workspace-ready` (configurable in settings: on/off, default off)
- [x] Concurrent session support: daily session runs alongside one focused session (two active sessions)
- [x] Daily session activity written to daily note on vault close (or midnight rollover)
- [x] Daily note integration: append activity summary as a section in the user's daily note
- [x] Session nudge system: `SessionNudge` type with `{ id, time, templateId, message, enabled }`
- [x] Nudge configuration in FlowtiSettingTab (add/edit/remove nudges)
- [x] Nudge triggers Notice with "Start" / "Dismiss" buttons
- [x] Pre-prepared sessions: nudges can reference a `SessionTemplate` for one-click start

### Technical Requirements

- Daily session must NOT impact performance — lightweight activity tracking with larger dedup window
- Concurrent session handling: `getActiveSession()` returns focused session; `getDailySession()` is separate
- Daily note path resolution via Obsidian's daily notes plugin API (or configurable path pattern)
- Activity cap for daily sessions: consider higher cap or streaming to file instead of in-memory
- Nudge scheduler: `setInterval` with minute-level resolution, cleared on `onunload()`

### Constraints

- Maximum 2 concurrent sessions (1 daily + 1 focused) — not arbitrary multi-session
- Daily session type cannot be used for focused sessions
- Nudge timing is approximate (minute-level, not second-level)
- Daily note integration requires Obsidian's daily notes plugin or compatible configuration

## Acceptance Criteria — All Met

- [x] Daily session auto-starts on vault open when enabled in settings
- [x] Daily session tracks activity alongside focused sessions
- [x] Daily summary appended to daily note on vault close
- [x] Session nudges appear at configured times
- [x] Nudge "Start" button creates session from template
- [x] Nudge "Dismiss" suppresses until next scheduled time
- [x] Concurrent sessions do not interfere with each other's activity logs
- [x] Performance: daily session adds < 5ms overhead per file event
- [x] `npm run build` passes with all tests green (2,507 tests, 99 files)

### INVEST Checklist

| Criterion | Met? | Notes |
|-----------|------|-------|
| **I**ndependent — can be delivered without other PBIs in flight | Yes | No blockers; daily-tracking type can coexist with existing types |
| **N**egotiable — scope can be adjusted without losing core value | Yes | Nudges can be deferred; daily session alone delivers core value |
| **V**aluable — delivers user-facing or architectural value | Yes | Passive tracking + nudges = high quality-of-life improvement |
| **E**stimable — effort and scope are understood | Yes | Delivered across 2 cycles (~72 tests, ~400 LOC source) |
| **S**mall — deliverable in 1-3 increments | Yes | Inc 1: daily session + concurrent support, Inc 2: nudges, Inc 3: daily note integration |
| **T**estable — acceptance criteria are verifiable | Yes | All criteria are testable via unit + integration tests |

## Related

- PRD: [[Session Workspaces PRD]]
- User Story: [[I want to automatically start a Day Session to track my usage]]
- Inbox: [[I want to easily start a new session while working inside Obsidian]]
- PBI-SW-003: Session Types (daily-tracking type definition)
