---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: planned
cycle: "[[Cycle 4 - Auto-Session and Activity Polish]]"
priority: medium
effort: large
dependencies: []
user_story: "[[I want to automatically start a Day Session to track my usage]]"
note: "Cycle 4 delivers core: daily-tracking type, concurrent sessions, auto-start, daily note summary. Nudges deferred to Cycle 5."
tags:
  - backlog
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

**In scope (Cycle 4):**
- [x→planned] New session type: `"daily-tracking"` — passive, no timer countdown, no goals
- [x→planned] Auto-start daily session on `workspace-ready` (configurable in settings: on/off, default off)
- [x→planned] Concurrent session support: daily session runs alongside one focused session (two concurrent)
- [x→planned] Daily session activity written to daily note on vault close
- [x→planned] Daily note integration: append activity summary as a section in the user's daily note
- [x→planned] Activity log aggregation: group file events by path (one row per file + edit count)

**Deferred to Cycle 5:**
- [ ] Session nudge system: `SessionNudge` type with `{ time, templateId, message }`
- [ ] Nudge configuration in FlowtiSettingTab (add/edit/remove nudges)
- [ ] Nudge triggers Notice with "Start" / "Dismiss" buttons
- [ ] Pre-prepared sessions: nudges can reference a `SessionTemplate` for one-click start
- [ ] Midnight rollover for daily sessions spanning midnight

### Functional Requirements (full PBI scope)

- [ ] New session type: `"daily-tracking"` — passive, no timer countdown, no goals
- [ ] Auto-start daily session on `workspace-ready` (configurable in settings: on/off, default off)
- [ ] Concurrent session support: daily session runs alongside one focused session (two active sessions)
- [ ] Daily session activity written to daily note on vault close (or midnight rollover)
- [ ] Daily note integration: append activity summary as a section in the user's daily note
- [ ] Session nudge system: `SessionNudge` type with `{ time, templateId, message }`
- [ ] Nudge configuration in FlowtiSettingTab (add/edit/remove nudges)
- [ ] Nudge triggers Notice with "Start" / "Dismiss" buttons
- [ ] Pre-prepared sessions: nudges can reference a `SessionTemplate` for one-click start

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

## Acceptance Criteria

- [ ] Daily session auto-starts on vault open when enabled in settings
- [ ] Daily session tracks activity alongside focused sessions
- [ ] Daily summary appended to daily note on vault close
- [ ] Session nudges appear at configured times
- [ ] Nudge "Start" button creates session from template
- [ ] Nudge "Dismiss" suppresses until next scheduled time
- [ ] Concurrent sessions do not interfere with each other's activity logs
- [ ] Performance: daily session adds < 5ms overhead per file event
- [ ] `npm run build` passes with all tests green

### INVEST Checklist

| Criterion | Met? | Notes |
|-----------|------|-------|
| **I**ndependent — can be delivered without other PBIs in flight | Yes | No blockers; daily-tracking type can coexist with existing types |
| **N**egotiable — scope can be adjusted without losing core value | Yes | Nudges can be deferred; daily session alone delivers core value |
| **V**aluable — delivers user-facing or architectural value | Yes | Passive tracking + nudges = high quality-of-life improvement |
| **E**stimable — effort and scope are understood | Partial | Concurrent session handling needs spike; daily note integration TBD |
| **S**mall — deliverable in 1-3 increments | Yes | Inc 1: daily session + concurrent support, Inc 2: nudges, Inc 3: daily note integration |
| **T**estable — acceptance criteria are verifiable | Yes | All criteria are testable via unit + integration tests |

## Related

- PRD: [[Session Workspaces PRD]]
- User Story: [[I want to automatically start a Day Session to track my usage]]
- Inbox: [[I want to easily start a new session while working inside Obsidian]]
- PBI-SW-003: Session Types (daily-tracking type definition)
