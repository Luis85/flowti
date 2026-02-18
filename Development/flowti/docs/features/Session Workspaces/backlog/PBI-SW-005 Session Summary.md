---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: in-progress
priority: low
dependencies:
  - "[[PBI-SW-001 Activity Log]]"
  - "[[PBI-SW-004 Decision Log]]"
note: "Core summary generation delivered in PBI-002 Inc 8-9. Remaining: decisions section (blocked by PBI-SW-004). Design decisions: no separate summaryFile (notesFile serves dual purpose), no dedicated events (synchronous on completion)."
---

## User Story — Problem Space

As a session user, I want a structured summary document generated when I complete a session so that I have a permanent, reviewable record of what happened.

### User Pains

- Session completion produces only a notes file with user-written content
- No automatic summary of goals achieved, artifacts produced, or decisions made
- Session history in the User Hub shows metadata but no outcome details
- No permanent vault artifact that represents "what this session accomplished"

### User Needs

- Structured markdown summary generated on session completion
- Summary includes: metadata, goals (completed/total), decisions, artifacts, activity timeline
- Summary stored as a vault file alongside session notes
- Summary linked from session metadata for easy retrieval

## Solution Statement

### Functional Requirements

- [x] Summary generated automatically on `session.completed` event — `generateSessionSummary()` + `writeSessionSummary()` in SessionService
- [x] Summary markdown template (metadata, goals with checkboxes, activity timeline, notes section)
- [x] Summary content merged into existing `notesFile` via `mergeSessionNotes()`
- [x] Graceful fallback: empty sections omitted (no activity → no timeline section)
- [ ] Summary includes decisions section (blocked by PBI-SW-004 Decision Log)
- [~] ~~`session.summary.generate` / `session.summary.generated` event pair~~ — **Design decision:** handled synchronously on completion, no dedicated events needed
- [~] ~~Summary file path stored on session as `summaryFile`~~ — **Design decision:** `notesFile` serves dual purpose (user notes + summary), no separate file needed

### Delivery Status

**Partially delivered in PBI-002 Inc 8-9** (Session Workspace Enrichment):
- `generateSessionSummary()` pure function: **done** (Inc 8)
- `writeSessionSummary()` writes to `notesFile`: **done** (Inc 8)
- `mergeSessionNotes()` merges user notes into summary: **done** (Inc 9)
- Summary template with frontmatter, goals, activity, notes: **done**
- Decisions section in summary: **blocked** (requires PBI-SW-004)

### Design Decisions (from implementation)

1. **No separate `summaryFile`**: The `notesFile` serves as both user notes and session summary. `writeSessionSummary()` appends the summary to the existing notes file, and `mergeSessionNotes()` combines them cleanly. This avoids file proliferation and keeps all session content in one place.
2. **No dedicated events**: Summary generation is synchronous within the `session.completed` handler. Adding a `session.summary.generate/generated` event pair would add complexity without benefit — no other consumer needs to react to summary creation.
3. **Activity timeline in summary**: The summary includes a chronological activity timeline derived from `session.activity[]`, not just artifacts. This leverages PBI-SW-001's unified activity log.

### Events

No new events — summary generation is handled synchronously within existing `session.completed` flow.

### Acceptance Criteria

- [x] Completing a session generates a summary in the session notes file
- [x] Summary includes goals with completion checkboxes
- [x] Summary includes activity timeline
- [ ] Summary includes decisions (blocked by PBI-SW-004)
- [x] Summary written to configured session notes folder (`notesFile`)
- [x] Empty sections gracefully omitted
- [x] Build passes: tests + tsc + eslint + esbuild
