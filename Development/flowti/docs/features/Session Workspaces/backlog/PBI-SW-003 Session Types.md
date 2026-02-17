---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: planned
priority: medium
dependencies:
  - "[[PBI-002 Documentation Sessions]]"
note: "Expands session types from labels to configured orchestration with guiding questions and defaults. Depends on PBI-002 Inc 11 for guiding questions foundation."
---

## User Story — Problem Space

As a domain architect, I want session types to drive workspace behavior — pre-configured guiding questions, default durations, and default goals — so that starting a Domain Design Session is immediately productive.

### User Pains

- Session types are labels only — selecting "Event Storming" vs "Documentation" produces the same workspace
- No guidance during sessions — users must remember what to focus on
- Default durations and goals must be set manually each time
- No way to create custom session types for recurring workflows

### User Needs

- Session types define guiding questions visible during work
- Session types define default duration and default goals
- Pre-built types with sensible defaults for each workflow
- Custom session type creation via settings
- Guiding questions visible in workspace during active/paused sessions

## Solution Statement

### Functional Requirements

- [ ] `SessionTypeConfig`: `{ type, guidingQuestions, defaultDuration, defaultGoals }`
- [ ] Pre-built configs for: Documentation, Event Storming, Service Design, Requirements Refinement, Backlog Structuring, Knowledge Cleanup, Vault Hygiene, Domain Design
- [ ] Custom type creation via settings (name, guiding questions, duration, goals)
- [ ] Guiding questions panel in SessionWorkspaceView (visible during active/paused)
- [ ] NewSessionModal pre-fills duration and goals from type config
- [ ] Type configs persisted in SettingsService

### Guiding Questions (Pre-built)

| Type | Questions |
|------|-----------|
| Documentation | What needs to be documented? What is the current gap? |
| Event Storming | What events does this domain produce? What triggers each event? |
| Service Design | What services does this domain expose? What are the contracts? |
| Domain Design | What are the bounded contexts? What entities belong here? |
| Requirements Refinement | What are the acceptance criteria? What edge cases exist? |
| Backlog Structuring | What are the priorities? What delivers the most value first? |
| Knowledge Cleanup | What is outdated? What is missing? What is duplicated? |
| Vault Hygiene | What files are orphaned? What links are broken? What needs reorganizing? |

### Acceptance Criteria

- [ ] Selecting a session type pre-fills duration and goals from config
- [ ] Guiding questions displayed in workspace during active sessions
- [ ] Custom session types can be created via settings
- [ ] Pre-built types have sensible defaults
- [ ] Build passes: tests + tsc + eslint + esbuild
