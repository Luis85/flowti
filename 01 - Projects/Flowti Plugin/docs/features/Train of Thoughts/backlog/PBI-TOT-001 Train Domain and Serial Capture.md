---
type: ProductBacklogItem
feature: "[[Train of Thoughts PRD]]"
stage: planned
priority: high
effort: large
dependencies: []
user_story: "[[I want to have the option to create a serial note session on every enter a new quick capture modal opens with the last note title in the description]]"
note: "Core domain for Train of Thoughts — ThoughtNode types, TrainService, serial capture loop via extended Quick Capture modal. Builds on existing CaptureService + SessionService infrastructure. 2 increments: Inc 1 = domain + serial capture, Inc 2 = thought linking + navigation."
tags:
  - backlog
  - train-of-thought
  - session
---

## User Story — Problem Space

As a user, I want to start a "Train of Thoughts" session that opens a rapid serial capture loop so that I can capture a chain of linked thoughts without breaking my flow.

### User Pains

- Quick Capture creates isolated notes — no chain of thought is preserved
- Manual linking between notes is tedious and breaks the capture flow
- No dedicated mode for rapid sequential ideation
- Previous thought context is lost between captures

### User Needs

- "Start Train of Thoughts" command that enters a serial capture loop
- First thought becomes the session title and description
- Each Enter creates a linked note and opens the next capture modal
- Previous thought title shown as context in each new modal
- All thoughts are standard vault notes with typed frontmatter

## Solution Statement

### Use Cases

**Gherkin:**
```gherkin
Given no active train session
When the user executes "Start Train of Thoughts"
Then a TrainCaptureModal opens with placeholder "Enter first thought..."

Given the user types "Domain-driven design" and presses Enter
Then a vault note is created at the configured capture folder
And a session is created with title "Domain-driven design"
And a new TrainCaptureModal opens with context "Previous: Domain-driven design"

Given the user types "Bounded contexts" and presses Enter
Then a vault note "Bounded contexts" is created
And it is linked to "Domain-driven design" with direction "next"
And a new TrainCaptureModal opens with context "Previous: Bounded contexts"

Given the user presses Escape during capture
Then the capture modal closes
And the session enters "paused" state
And the user can review the thought chain in the Train Main View
```

### Functional Requirements

- [ ] `ThoughtNode` type: `{ id, title, filePath, timestamp, relations[] }`
- [ ] `ThoughtRelation` type: `{ targetId, direction: "next" | "branch" }`
- [ ] `TrainState` type: `{ sessionId, rootNodeId, activeNodeId, nodes[] }`
- [ ] `TrainService`: manages train lifecycle, node CRUD, navigation
- [ ] `TrainCaptureModal`: extends Quick Capture modal pattern with serial loop and context display
- [ ] "Start Train of Thoughts" command registered in CommandRegistry
- [ ] First thought creates session + first ThoughtNode + vault note
- [ ] Each subsequent Enter creates linked ThoughtNode + vault note
- [ ] Previous thought title shown as context in modal
- [ ] Escape/close pauses the session
- [ ] Vault notes created with frontmatter: `type: thought`, `train-session: {sessionId}`, `thought-relations: [...]`
- [ ] Events: `train.started`, `train.thought.added`, `train.paused`, `train.resumed`

### Technical Requirements

- [ ] `src/domain/train/types.ts` — ThoughtNode, ThoughtRelation, TrainState, TrainEventMap
- [ ] `src/domain/train/events.ts` — Train events extending FlowtiEventMap
- [ ] `src/domain/train/TrainService.ts` — state management, node CRUD, capture loop coordination
- [ ] `src/ui/train/TrainCaptureModal.ts` — serial capture modal with context display
- [ ] `src/infrastructure/commands/registry.ts` — `flowti:start-train` command
- [ ] `train.started` → `train.thought.added` → inbox integration via existing `capture.note.created`
- [ ] TrainState persisted via TypedStorage (key: `"train-{sessionId}"`)

### Constraints

- Must reuse CaptureService for note creation (no parallel note creation logic)
- Session type `"train-of-thought"` must be registered in session type config
- Thought notes must be standard vault notes (not plugin-internal storage)

### Inc 1: Train Domain Types + Serial Capture

**Goal:** Establish the Train of Thoughts domain types and implement the serial capture loop.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/types.ts` | ThoughtNode, ThoughtRelation, TrainState types | ~50 |
| 2 | `src/domain/train/events.ts` | Train events: started, thought.added, paused, resumed | ~40 |
| 3 | `src/domain/train/TrainService.ts` | Train lifecycle: start, addThought, pause, resume | ~200 |
| 4 | `src/ui/train/TrainCaptureModal.ts` | Serial capture modal with context display | ~100 |
| 5 | `src/infrastructure/commands/registry.ts` | `flowti:start-train` command | ~15 |
| 6 | `src/infrastructure/events/events.ts` | Compose TrainEventMap into FlowtiEventMap | ~5 |

**Est. total:** ~410 LOC source, ~180 LOC tests, ~35 new tests

### Inc 2: Thought Linking + Frontmatter + Navigation

**Goal:** Wire thought-to-thought linking via frontmatter relations and add basic navigation.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/train/TrainService.ts` | addThought with directional linking, getTrainTimeline | ~120 |
| 2 | `src/domain/train/TrainService.ts` | branch support: resume from any node | ~80 |
| 3 | `src/ui/train/TrainCaptureModal.ts` | Direction selector (next/branch), branching UX | ~40 |
| 4 | Integration | Frontmatter: `thought-relations` field on vault notes | ~40 |

**Est. total:** ~280 LOC source, ~120 LOC tests, ~25 new tests
