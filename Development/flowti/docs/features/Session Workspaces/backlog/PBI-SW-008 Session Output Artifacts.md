---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: planned
priority: low
effort: medium
dependencies:
  - "[[PBI-SW-005 Session Summary]]"
user_story: "[[I want to create an event type document out of a session to prepare an invite for a follow up]]"
note: "Generate typed output documents from completed sessions (meeting invites, action item lists, review summaries). Extends existing summary capability."
tags:
  - backlog
---

## User Story — Problem Space

As a session user, I want to generate structured output documents from a completed session so that I can prepare follow-up invites, action item lists, or review summaries without manual formatting.

### User Pains

- Session summaries are a single format — no way to generate different output types
- Creating a meeting invite from session notes requires manual copy-paste and reformatting
- Action items are embedded in session notes but not extractable as a standalone document
- No template-driven output — every post-session artifact is manual work

### User Needs

- Generate typed output documents from completed sessions
- Template-driven output: meeting invite, action items list, review summary
- Output files auto-linked to session notes
- One-click generation from the workspace or session detail panel

## Solution Statement

### Use Cases

**Flow:**
User completes session → clicks "Generate Output" → selects output type (e.g., "Meeting Invite") → system generates structured document from session data → document created in vault and linked to session notes

**Gherkin:**
```gherkin
Given a session has been completed with goals, decisions, and activity
When the user clicks "Generate Meeting Invite"
Then a new markdown file is created with structured meeting invite format
And the file includes summary, decisions, action items, and attendees placeholder
And the file is linked from the session notes via wikilink
```

### Functional Requirements

- [ ] `SessionOutputType`: `"meeting-invite" | "action-items" | "review-summary" | "custom"`
- [ ] `SessionOutputTemplate` type: `{ type, title, sections, format }`
- [ ] Pre-built templates for: Meeting Invite, Action Items List, Review Summary
- [ ] Generate output from completed session data (goals, decisions, activity, notes)
- [ ] Output file created in `SESSION_NOTES_FOLDER` with type-specific naming
- [ ] Output file auto-linked to session notes via wikilink insertion (L-17)
- [ ] Custom template creation via settings
- [ ] Command/state events: `session.output.generate/generated`

### Technical Requirements

- Pure function: `generateSessionOutput(session, template): string` — testable without mocks
- Output generation is synchronous — no service needed, just a helper
- Templates use mustache-style placeholders resolved against session data
- Output file created via `FileSystemClient.createFile()`

### Constraints

- Only available for completed sessions (not active/paused)
- Decisions section requires PBI-SW-004 to be delivered first for full content
- Custom templates are persisted in SettingsService alongside session type configs

## Acceptance Criteria

- [ ] Generate a meeting invite document from a completed session
- [ ] Generate an action items list from a completed session
- [ ] Generate a review summary from a completed session
- [ ] Output file created in session notes folder
- [ ] Output file linked from session notes via wikilink
- [ ] Custom output templates can be created via settings
- [ ] `npm run build` passes with all tests green

### INVEST Checklist

| Criterion | Met? | Notes |
|-----------|------|-------|
| **I**ndependent — can be delivered without other PBIs in flight | Partial | Full value requires PBI-SW-004 (decisions in output); basic output works without |
| **N**egotiable — scope can be adjusted without losing core value | Yes | Custom templates can be deferred; pre-built templates deliver core value |
| **V**aluable — delivers user-facing or architectural value | Yes | Reduces manual post-session work significantly |
| **E**stimable — effort and scope are understood | Yes | ~80 LOC helpers + ~60 LOC UI, ~20 tests |
| **S**mall — deliverable in 1-3 increments | Yes | Inc 1: pre-built templates + generation, Inc 2: custom templates + settings UI |
| **T**estable — acceptance criteria are verifiable | Yes | Pure function output can be snapshot-tested |

## Related

- PRD: [[Session Workspaces PRD]]
- User Story: [[I want to create an event type document out of a session to prepare an invite for a follow up]]
- PBI-SW-005: Session Summary (extends summary with typed outputs)
- PBI-SW-004: Decision Log (decisions content in output)
