---
type: ProductBacklogItem
feature: "[[Quick Capture PRD]]"
stage: planned
priority: high
estimated_loc: 230
estimated_tests: 25
planned_in: "[[Cycle 12 - User Hub Inbox]]"
user_story: "[[Quick capture ribbons for ideas and feedback]]"
tags:
  - release-blocker
  - inbox
  - capture
related:
  - "[[PBI-005 Vault Folder Inbox]]"
  - "[[I want to capture feedback and input as fast as possible]]"
---

# PBI-QC-001: Quick Capture Ribbons

## User Story — Problem Space

As a vault user, I want one-click ribbon actions to capture ideas and feedback so that I can quickly feed the knowledge graph without disrupting my current work.

### User Pains

- Capturing ideas requires navigating to a folder, creating a note, adding frontmatter — high friction means ideas get lost
- No way to capture without leaving current context
- The gap between "thought" and "typed, structured note" has no bridge

### User Needs

- "Add Idea" and "Add Feedback" ribbon actions visible at all times
- Minimal modal with title input only — Enter to confirm
- Note auto-created with typed frontmatter in configured folder
- "Quick Capture" command with type selector for command palette users

---

## Solution Statement

### Functional Requirements

- [ ] Two ribbon actions: "Add Idea" (lightbulb icon) and "Add Feedback" (message-circle icon)
- [ ] Minimal modal: title input, Enter to confirm
- [ ] Note created in configured folder with frontmatter template (type, description placeholder, timestamp)
- [ ] "Quick Capture" command: type selector (idea, feedback, bug, custom) → title input
- [ ] Configurable target folder per type in Settings
- [ ] Custom capture types: type name, template, target folder
- [ ] Navigation option: stay or open new note
- [ ] Events: `capture.idea.created`, `capture.feedback.created`, `capture.note.created`

### Technical Requirements

- New bounded context `src/domain/capture/` with types, events, CaptureService
- CaptureService uses `FileSystemClient.createFile()` for note creation — existing infrastructure
- Ribbon actions via `plugin.addRibbonIcon()` — Obsidian API
- Command palette via `plugin.addCommand()` — established pattern (see `dataExchangeSetup.ts`)
- Settings integration for configurable folders and custom types via `SettingsService`
- QuickCaptureModal extends Obsidian `Modal` — minimal UI (title input, type selector)
- Events registered in Event Catalog with category "Capture"

### Constraints

- Modal must be minimal: title-only input, no rich text editor
- Notes created with frontmatter only — content is empty (user fills in later or via inbox triage)
- Must not conflict with existing Obsidian ribbon actions or commands

---

## INVEST Assessment

| Criterion | Met? | Notes |
|-----------|------|-------|
| Independent | Yes | Greenfield domain (`src/domain/capture/`). No hard dependency on PBI-005 (Vault Folder Inbox). Standalone value: users can capture notes immediately. |
| Negotiable | Yes | Custom capture types and navigation option can be deferred. Core value is 2 ribbon actions + 1 command. |
| Valuable | Yes | Directly resolves user pain: high-friction capture process. Enables one-click note creation. Feeds the inbox triage pipeline (PBI-005). |
| Estimable | Yes | ~230 LOC total, ~25 tests. Small bounded context, well-defined Obsidian APIs. |
| Small | Yes | Single increment. Deliverable in one development session. |
| Testable | Yes | Unit tests for CaptureService (note creation, frontmatter, folder routing). UI tests for modal (rendering, keyboard shortcuts). Command registration verifiable. |

---

## Acceptance Criteria

- [ ] "Add Idea" (lightbulb) and "Add Feedback" (message-circle) ribbon actions visible
- [ ] Clicking ribbon opens minimal modal with title input
- [ ] Notes created in configured folder with correct typed frontmatter
- [ ] "Quick Capture" command available in command palette with type selector
- [ ] Custom capture types configurable in Settings
- [ ] Navigation option: stay or open new note after creation
- [ ] Capture events emitted on note creation
- [ ] `npm run build` passes

---

## Events

| Event | Category | Direction | Payload |
|-------|----------|-----------|---------|
| `capture.idea.created` | Capture | Produced | `{ path: string, title: string }` |
| `capture.feedback.created` | Capture | Produced | `{ path: string, title: string }` |
| `capture.note.created` | Capture | Produced | `{ path: string, title: string, type: string }` |

---

## Related

- PRD: [[Quick Capture PRD]]
- Companion: [[PBI-005 Vault Folder Inbox]] (inbox triage side)
- Inbox: [[Quick capture ribbons for ideas and feedback]], [[I want to capture feedback and input as fast as possible]]
