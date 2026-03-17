---
type: ProductBacklogItem
feature: "[[Settings PRD]]"
priority: medium
stage: draft
userStories:
  - "[[As User, I want to only use specific features of Flowti, so that the cognitive load keeps low]]"
useCases: []
---

## User Story

As a user, I want to selectively enable or disable individual Flowti features so that the interface stays focused on the capabilities I actually use and cognitive load remains low.

## Functional Requirements

- [ ] Feature toggle section in Settings tab listing all optional Flowti features
- [ ] Each feature toggle enables/disables its associated commands, views, and ribbon icons
- [ ] Disabled features do not register commands or render UI elements
- [ ] Feature state persists across plugin reloads via SettingsService
- [ ] Toggling a feature emits a settings event so dependent services can react at runtime
- [ ] Sensible defaults: core features enabled, advanced features (e.g., Ingestion, Event Definitions) opt-in

## Acceptance Criteria

- [ ] Settings tab displays a list of toggleable features with descriptions
- [ ] Disabling a feature hides its commands from the command palette
- [ ] Disabling a feature removes its tab or view from the UI
- [ ] Re-enabling a feature restores full functionality without a restart
- [ ] Feature toggle state survives plugin reload
- [ ] `npm run build` passes
