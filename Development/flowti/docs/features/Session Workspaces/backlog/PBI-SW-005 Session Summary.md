---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: planned
priority: medium
dependencies:
  - "[[PBI-SW-001 Activity Log]]"
  - "[[PBI-SW-004 Decision Log]]"
note: "Generates structured markdown summaries on session completion. Best delivered after Activity Log and Decision Log are available."
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

- [ ] `session.summary.generate` / `session.summary.generated` event pair
- [ ] Summary generated automatically on `session.completed` event
- [ ] Summary markdown template:
  ```markdown
  ---
  type: SessionSummary
  session_id: {id}
  session_type: {type}
  started: {startedAt}
  completed: {completedAt}
  duration: {actualDuration}
  ---
  # Session Summary: {title}
  ## Goals ({completed}/{total})
  - [x] Goal 1
  - [ ] Goal 2
  ## Decisions ({count})
  - **Decision title** — description
  ## Artifacts ({count})
  - created: path/to/file.md
  - modified: path/to/other.md
  ## Activity Timeline ({count} events)
  - 14:32 created events.ts
  - 14:28 modified types.ts
  ## Notes
  {session notes content}
  ```
- [ ] Summary file stored in `SESSION_NOTES_FOLDER`
- [ ] Summary file path stored on session as `summaryFile`
- [ ] Graceful fallback: if no activity/decisions, sections omitted

### Events

| Event | Category | Tags |
|-------|----------|------|
| `session.summary.generate` | Session | `["system"]` |
| `session.summary.generated` | Session | `[]` |

### Acceptance Criteria

- [ ] Completing a session generates a summary markdown file
- [ ] Summary includes goals, decisions, artifacts, and activity
- [ ] Summary file stored in configured session notes folder
- [ ] Session object references the summary file path
- [ ] Empty sections gracefully omitted
- [ ] Build passes: tests + tsc + eslint + esbuild
