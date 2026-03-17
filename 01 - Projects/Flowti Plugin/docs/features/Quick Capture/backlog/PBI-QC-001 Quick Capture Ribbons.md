---
type: ProductBacklogItem
feature: "[[Quick Capture PRD]]"
stage: done
priority: high
estimated_loc: 230
actual_loc: 258
estimated_tests: 25
actual_tests: 34
planned_in: "[[Cycle 12 - User Hub Inbox]]"
delivered_in: "[[Cycle 12 - User Hub Inbox]]"
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

- [x] Two ribbon actions: "Add Idea" (lightbulb icon) and "Add Feedback" (message-circle icon)
- [x] Minimal modal: title input, Enter to confirm
- [x] Note created in configured folder with frontmatter template (type, description placeholder, timestamp)
- [x] "Quick Capture" command: type selector (idea, feedback, bug, custom) → title input
- [ ] Configurable target folder per type in Settings — DEFERRED
- [ ] Custom capture types: type name, template, target folder — DEFERRED
- [ ] Navigation option: stay or open new note — DEFERRED
- [x] Events: `capture.idea.created`, `capture.feedback.created`, `capture.note.created`

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

- [x] "Add Idea" (lightbulb) and "Add Feedback" (message-circle) ribbon actions visible
- [x] Clicking ribbon opens minimal modal with title input
- [x] Notes created in configured folder with correct typed frontmatter
- [x] "Quick Capture" command available in command palette with type selector
- [ ] Custom capture types configurable in Settings — DEFERRED (negotiable per INVEST)
- [ ] Navigation option: stay or open new note after creation — DEFERRED (negotiable per INVEST)
- [x] Capture events emitted on note creation
- [x] `npm run build` passes

---

## Events

| Event | Category | Direction | Payload |
|-------|----------|-----------|---------|
| `capture.idea.created` | Capture | Produced | `{ path: string, title: string }` |
| `capture.feedback.created` | Capture | Produced | `{ path: string, title: string }` |
| `capture.note.created` | Capture | Produced | `{ path: string, title: string, type: string }` |

---

## Delivered Files

### New Files (4 source + 2 test)

| File | LOC | Purpose |
|------|-----|---------|
| `src/domain/capture/types.ts` | 26 | CaptureType (11 built-in types), CaptureInput (with description), CaptureResult |
| `src/domain/capture/events.ts` | 17 | CaptureEventMap (3 events) |
| `src/domain/capture/CaptureService.ts` | 84 | Stateless capture service (file creation + event emission + description frontmatter) |
| `src/ui/capture/QuickCaptureModal.ts` | 131 | Modal with title input, description textarea, grouped type selector (General + RAID), Enter to submit |
| `tests/domain/capture/CaptureService.test.ts` | ~160 | 17 unit tests |
| `tests/ui/capture/QuickCaptureModal.test.ts` | ~140 | 17 UI tests |

### Modified Files (7 infrastructure + 2 test fixes)

| File | Change |
|------|--------|
| `src/domain/settings/settings.ts` | +`captureFolder` setting, +`Capture` in DEFAULT_CATALOG_CATEGORIES |
| `src/infrastructure/events/events.ts` | +CaptureEventMap in FlowtiEventMap extends |
| `src/infrastructure/events/catalog.ts` | +4 catalog entries (3 capture + 1 ui.openQuickCapture), +`Capture` in EVENT_CATEGORIES |
| `src/infrastructure/ui/events.ts` | +`ui.openQuickCapture` event in UiCommandEventMap |
| `src/infrastructure/services/registry.ts` | +CaptureService factory |
| `src/infrastructure/commands/registry.ts` | +12 commands: `flowti:quick-capture`, `flowti:add-idea`, `flowti:add-feedback`, `flowti:add-note`, `flowti:add-task`, `flowti:add-question`, `flowti:add-bug`, `flowti:add-risk`, `flowti:add-assumption`, `flowti:add-issue`, `flowti:add-decision`, `flowti:add-learning` |
| `src/main.ts` | +7 ribbon icons (idea, note, task, question, feedback, bug, learning), +modal listener with Notice confirmation, +captureService field + wiring |
| `src/domain/settings/FlowtiSettingTab.ts` | +captureFolder text setting exposed in Settings UI |
| `tests/infrastructure/events/EventBus.test.ts` | +`captureFolder` in inline settings objects |
| `tests/ui/catalog/helpers.test.ts` | +`Capture` in allVisibleCats array |

### Delivery Summary

- **Total new source LOC:** 258
- **Total new tests:** 34 (17 service + 17 UI)
- **Capture types:** 11 (idea, note, task, question, feedback, bug, risk, assumption, issue, decision, learning)
- **Ribbon icons:** 7 (idea, note, task, question, feedback, bug, learning)
- **Command palette commands:** 12 (quick-capture + 11 type-specific)
- **UI features:** description textarea, grouped optgroups (General + RAID), captureFolder setting, post-capture Notice

---

## Related

- PRD: [[Quick Capture PRD]]
- Companion: [[PBI-005 Vault Folder Inbox]] (inbox triage side)
- Inbox: [[Quick capture ribbons for ideas and feedback]], [[I want to capture feedback and input as fast as possible]]
