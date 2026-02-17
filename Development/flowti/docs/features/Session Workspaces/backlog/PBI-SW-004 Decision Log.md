---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: planned
priority: medium
dependencies: []
note: "Adds structured decision recording to sessions. Independent of other PBIs — can be implemented in parallel."
---

## User Story — Problem Space

As a session user, I want to record decisions during my session with structured metadata so that they are traceable, searchable, and included in session summaries.

### User Pains

- Decisions made during sessions are captured only as unstructured text in notes
- No way to search for or filter decisions across sessions
- Decisions lack context — no link to what they relate to
- Post-session review requires manually extracting decisions from notes

### User Needs

- Quick decision recording during active sessions (title + description)
- Optional context reference (link to bound entity or vault path)
- Decision list visible in workspace
- Decisions included in session summary on completion
- Decisions persisted with session state

## Solution Statement

### Functional Requirements

- [ ] `SessionDecision` type: `{ id, title, description, recordedAt, context? }`
- [ ] Command/state event pairs: `session.decision.record/recorded`, `session.decision.remove/removed`
- [ ] Max 100 decisions per session
- [ ] Decision panel in SessionWorkspaceView with inline add form
- [ ] Decisions persisted with session state via TypedStorage
- [ ] Decisions included in session summary (FR-04)

### Events

| Event | Category | Tags |
|-------|----------|------|
| `session.decision.record` | Session | `[]` |
| `session.decision.recorded` | Session | `[]` |
| `session.decision.remove` | Session | `[]` |
| `session.decision.removed` | Session | `[]` |

### Acceptance Criteria

- [ ] Record a decision with title and description during active session
- [ ] Decision appears in workspace decision panel
- [ ] Remove a decision from the panel
- [ ] Decisions persist across pause/resume
- [ ] Max 100 decisions enforced
- [ ] Build passes: tests + tsc + eslint + esbuild
