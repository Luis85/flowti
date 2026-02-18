---
type: ProductBacklogItem
feature: "[[Session Workspaces PRD]]"
stage: planned
priority: high
dependencies:
  - "[[PBI-SW-001 Activity Log]]"
note: "Expands session types from labels to configured orchestration with guiding questions and defaults. Bundles global folder filter settings UI (from PBI-SW-001 remainder). Foundation PBI — enables PBI-SW-009 (Domain Design Session). No longer blocked on PBI-002 Inc 11/12 (those are independent: Focus Profiles, Spawning)."
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

**Domain layer (Inc 1):**
- [ ] `SessionTypeConfig`: `{ type, label, icon, guidingQuestions, defaultDuration, defaultGoals, color? }`
- [ ] Pre-built configs for: Documentation, Event Storming, Service Design, Requirements Refinement, Backlog Structuring, Knowledge Cleanup, Vault Hygiene, Domain Design
- [ ] `SESSION_TYPE_CONFIGS: Record<SessionType, SessionTypeConfig>` registry — pure data, no service
- [ ] `resolveTypeConfig(type: SessionType): SessionTypeConfig` — pure function
- [ ] `SessionType` expanded union: add `"domain-design"` (enables PBI-SW-009)
- [ ] Backward compat: `session.type ??= "documentation"` in `load()`
- [ ] Type configs persisted in SettingsService (custom types override defaults)
- [ ] 4 new events: `session.type.configure/configured`, `session.type.create/created`

**UI layer (Inc 2):**
- [ ] Guiding questions panel in SessionWorkspaceView (visible during active/paused)
- [ ] NewSessionModal pre-fills duration and goals from type config
- [ ] Custom type creation via FlowtiSettingTab (name, guiding questions, duration, goals)
- [ ] Global folder filter setting in FlowtiSettingTab (`sessionActivityFilterGlobal: string[]`) — bundled from PBI-SW-001 remainder

### Guiding Questions (Pre-built)

| Type | Questions |
|------|-----------|
| Documentation | What needs to be documented? What is the current gap? |
| Event Storming | What events does this domain produce? What triggers each event? |
| Service Design | What services does this domain expose? What are the contracts? |
| Domain Design | What are the bounded contexts? What entities belong here? What events cross boundaries? |
| Requirements Refinement | What are the acceptance criteria? What edge cases exist? |
| Backlog Structuring | What are the priorities? What delivers the most value first? |
| Knowledge Cleanup | What is outdated? What is missing? What is duplicated? |
| Vault Hygiene | What files are orphaned? What links are broken? What needs reorganizing? |

### Implementation Approach (from learnings)

- **L-01/L-13 Domain-first**: Inc 1 = types, events, config registry, service wiring, tests. Inc 2 = workspace UI, settings tab, modal prefill.
- **L-09 Field threading**: `type` is already threaded through creation paths. New `guidingQuestions` only lives in config, not on `Session` — no threading needed.
- **L-10/L-20 Pure functions**: `resolveTypeConfig()` as a pure helper — testable without mocks.
- **L-11 Backward compat**: Sessions without `type` field get `"documentation"` default.
- **Global filter bundling**: FlowtiSettingTab is already modified for custom types → add global folder filter in the same increment to minimize settings UI churn.

### Size Estimate

- Inc 1 (domain): ~80 LOC source, ~25 tests
- Inc 2 (UI): ~120 LOC source, ~15 tests

### Acceptance Criteria

- [ ] Selecting a session type pre-fills duration and goals from config
- [ ] Guiding questions displayed in workspace during active sessions
- [ ] Custom session types can be created and edited via settings
- [ ] Pre-built types have sensible defaults for all 8 types
- [ ] Global folder filter configurable in settings (bundled from PBI-SW-001)
- [ ] Domain Design type available in type picker (foundation for PBI-SW-009)
- [ ] Build passes: tests + tsc + eslint + esbuild
