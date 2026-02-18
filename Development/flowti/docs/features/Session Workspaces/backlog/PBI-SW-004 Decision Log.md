---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: planned
priority: medium
dependencies: []
note: "Adds structured decision recording to sessions. Independent — can be implemented in parallel with PBI-SW-003. Unblocks PBI-SW-005 (decisions in summary). Consider TD-93 overlap (TypedStorage vs vault file canonical source)."
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

**Domain layer (Inc 1):**
- [ ] `SessionDecision` type: `{ id, title, description, recordedAt, context? }`
- [ ] `decisions: SessionDecision[]` on `Session` interface
- [ ] `decisions?: SessionDecision[]` on `SessionTemplate` (optional, carried through templates)
- [ ] Command/state event pairs: `session.decision.record/recorded`, `session.decision.remove/removed`
- [ ] Max 100 decisions per session (`MAX_SESSION_DECISIONS = 100`)
- [ ] Field threading: `handleCreate`, `rerunSession`, `createFromTemplate`, `saveTemplateFromSession` (L-09)
- [ ] Backward compat: `session.decisions ??= []` in `load()` (L-11)
- [ ] Decisions persisted with session state via TypedStorage
- [ ] Pure helper: `formatDecisionsForSummary(decisions: SessionDecision[]): string` for PBI-SW-005 (L-10/L-20)

**UI layer (Inc 2):**
- [ ] Decision panel in SessionWorkspaceView with inline add form
- [ ] Decisions included in session summary (unblocks PBI-SW-005)
- [ ] Auto-link decisions to bound context entities when writing to session notes (L-17)

### Implementation Approach (from learnings)

- **L-01/L-13 Domain-first**: Inc 1 = types, events, service handlers, helpers, tests. Inc 2 = workspace UI panel, summary integration.
- **L-09 Field threading**: `decisions` must flow through ALL creation paths — use the same pattern as `contextBindings`, `links`, `activity`.
- **L-11 Backward compat**: `??= []` guard in `load()` for sessions created before this PBI.
- **L-10/L-20 Pure helpers**: `formatDecisionsForSummary()` as a pure function — used by `generateSessionSummary()` once integrated.
- **L-17 Auto-linking**: When decisions reference bound context (domain, feature), include wikilinks in notes output.
- **TD-93 awareness**: TypedStorage is canonical for decision data during the session lifecycle. Vault file (session notes) is the permanent output artifact. No conflict — they serve different purposes.

### Size Estimate

- Inc 1 (domain): ~100 LOC source, ~25 tests
- Inc 2 (UI): ~60 LOC source, ~10 tests

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
- [ ] Decisions carried through rerun and template flows
- [ ] Max 100 decisions enforced
- [ ] Decisions included in session summary on completion
- [ ] Legacy sessions load cleanly with `decisions: []`
- [ ] Build passes: tests + tsc + eslint + esbuild
