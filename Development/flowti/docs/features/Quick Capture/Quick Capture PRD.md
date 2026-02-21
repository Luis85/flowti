---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: in-progress
maturity: L2
maturity_score_strategy: 4
maturity_score_scope: 4
maturity_score_architecture: 4
maturity_score_event_integration: 4
maturity_score_data_model: 3
maturity_score_ui_consistency: 3
maturity_score_validation_testing: 3
business_value: 5
implementation_cost: 2
maintenance_cost: 1
discovery_cost: 2
design_cost: 2
test_cost: 2
priority: 4
fri_score: 25
tags:
  - inbox
  - capture
  - user-experience
  - release-blocker
planned_in: "[[Cycle 12 - User Hub Inbox]]"
---

# Feature: Quick Capture — Ideas & Feedback Ribbons

> Inbox source: [[Quick capture ribbons for ideas and feedback]]

---

## 1. Vision & Strategic Context

> Capturing ideas and feedback should be as fast as pressing a key. Two dedicated ribbon actions and a universal command minimize friction and feed the knowledge graph.

**Strategic position**: The inbox is the entry point for Flowti's idea-to-solution workflow. Without frictionless capture, ideas get lost before they reach the inbox. Quick Capture turns fleeting thoughts into structured, typed notes in the vault.

---

## 2. Problem Statement

Capturing ideas and feedback currently requires: navigate to folder → create note → add frontmatter → write content. This multi-step process means ideas are lost before they reach the inbox. There is no way to quickly capture a thought without leaving the current context.

---

## 3. Outcome (Success Definition)

- Two ribbon actions: "Add Idea" and "Add Feedback" visible at all times
- One-click capture: title input → note created in configured folder with typed frontmatter
- Universal command: "Quick Capture" with type selector (idea, feedback, bug, custom)
- Configurable target folders and templates per capture type
- Users can define custom capture types

---

## 4. Scope

### In Scope

- "Add Idea" ribbon action and command
- "Add Feedback" ribbon action and command
- "Quick Capture" command with type selector
- Minimal modal: title input, Enter to confirm
- Auto-create note in configured folder with type-specific template
- Configurable target folder and template per capture type
- Custom capture type definitions in settings
- Navigation option: stay or navigate to new note

### Out of Scope

- Rich text capture (markdown editor in modal)
- Voice capture / transcription
- Image capture
- External API integration (email, Slack, etc.)

---

## 5. Functional Requirements

- [x] "Add Idea" ribbon action: opens minimal modal with title input
- [x] "Add Feedback" ribbon action: opens minimal modal with title input
- [x] "Quick Capture" command: asks for type first, then title
- [x] Note created in configured folder with correct frontmatter template
- [x] Default folders: `00 - Connectivity/inbox` for ideas, `00 - Connectivity/inbox` for feedback
- [ ] Configurable target folder per capture type in Settings — DEFERRED (PBI-QC-001 I-1)
- [ ] Custom capture types definable in Settings (type name, template, target folder) — DEFERRED (PBI-QC-001 I-2)
- [ ] Navigation option: "Stay here" or "Open note" after creation — DEFERRED (PBI-QC-001 I-3)
- [x] Events: `capture.idea.created`, `capture.feedback.created`, `capture.note.created`

---

## 6. Acceptance Criteria

- [x] "Add Idea" and "Add Feedback" ribbon actions visible
- [x] Clicking ribbon opens modal with title input
- [x] Note created in configured folder with correct frontmatter
- [x] "Quick Capture" command available in command palette
- [ ] Custom capture types configurable in settings — DEFERRED
- [x] npm run build passes

---

## Product Backlog Items

| PBI | Title | Status | Priority |
|-----|-------|--------|----------|
| [[PBI-QC-001 Quick Capture Ribbons]] | Ribbon actions and capture modal | DONE | High |

---

## Stage History

| Date | Stage | FRI | Notes |
|------|-------|-----|-------|
| 2026-02-21 | approved → in-progress | 19 → 25 | Cycle 12 Inc 1: PBI-QC-001 delivered. 2 ribbon icons, 3 commands, 3 events, 23 tests. Deferred: custom types, Settings UI, navigation option. |

---

## Related

- Inbox: [[Quick capture ribbons for ideas and feedback]], [[I want to quickly capture a note to my inbox to distribute the note inside my vault later]], [[I want to capture feedback and input as fast as possible]]
