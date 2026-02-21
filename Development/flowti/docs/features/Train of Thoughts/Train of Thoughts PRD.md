---
domain: Session
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: approved
maturity: L2
version: 1
created: 2026-02-21
updated: 2026-02-21
foundation: "[[Session Workspaces PRD]]"
maturity_score_strategy: 4
maturity_score_scope: 3
maturity_score_architecture: 3
maturity_score_event_integration: 3
maturity_score_data_model: 3
maturity_score_ui_consistency: 2
maturity_score_validation_testing: 2
business_value: 5
implementation_cost: 4
maintenance_cost: 3
discovery_cost: 3
design_cost: 4
test_cost: 3
priority: 3
fri_score: 20
tags:
  - session
  - capture
  - train-of-thought
  - innovation
planned_in: "[[Cycle 13 - Train of Thoughts]]"
---

# Feature PRD: Train of Thoughts — Serial Capture Sessions

> Inbox source: [[I want to have the option to create a serial note session on every enter a new quick capture modal opens with the last note title in the description]]

---

## 1. Vision & Strategic Context

> Thinking happens in chains, not in isolation. A Train of Thoughts session captures the flow of rapid ideation as a navigable, branching timeline of linked notes — turning fleeting thought sequences into a permanent, structured knowledge graph.

**Strategic position**: Train of Thoughts bridges Quick Capture (single-shot capture) and Sessions (structured execution). It creates a new modality: **serial capture sessions** where the act of capturing IS the session. This fills a gap in Flowti's execution model — currently there's no dedicated mode for rapid, sequential ideation where each thought connects to the previous one.

**Relationship to existing features:**
- **Quick Capture** provides the modal interface for single-shot capture
- **Session Workspaces** provides the lifecycle, state machine, and workspace infrastructure
- **Train of Thoughts** combines both into a new session mode with unique UI (timeline graph, branching navigation)

---

## 2. Problem Statement

### What Exists

- **Quick Capture**: fast single-shot note creation (10 types, command palette + ribbons)
- **Session Workspaces**: structured execution environments with lifecycle, intent, reflection, closure
- **Inbox**: surfaces captured notes for triage and routing

### What's Missing

When brainstorming or exploring a topic, thoughts arrive in rapid succession. Current tools force a choice:

1. **Quick Capture repeatedly** — notes are created but unrelated; the chain of thought is lost
2. **Session with notes** — structured but too heavy for rapid ideation; breaks the flow
3. **Long-form note** — captures everything but loses the granularity of individual thoughts and their connections

There is no way to:
- Capture thoughts serially with each one linked to the previous
- Visualize the journey of a thought chain over time
- Branch from any point in a thought sequence to explore alternatives
- Navigate a thought timeline interactively

### Impact

- Brainstorming sessions produce unstructured output with no trace of how ideas evolved
- Related thoughts are scattered across individual notes with no explicit connections
- The evolution of an idea from initial spark to refined concept is invisible
- Users cannot revisit the branching points where they chose one direction over another

---

## 3. Jobs To Be Done (JTBD)

### JTBD 1 — Rapid Serial Capture

> When I'm brainstorming, I want to capture each thought with minimal friction and have it automatically linked to my previous thought so that I don't break my flow to organize.

### JTBD 2 — Thought Chain Visualization

> When reviewing a brainstorming session, I want to see the full timeline of my thoughts as a navigable graph so that I can understand how my ideas evolved and branched.

### JTBD 3 — Exploratory Branching

> When I reach a fork in my thinking, I want to branch from any previous thought to explore an alternative direction so that I don't lose the original train while exploring a tangent.

### JTBD 4 — Thought Elaboration

> When a particular thought needs more detail, I want to open its underlying note and add content so that I can deepen an idea without leaving the session context.

### JTBD 5 — Session Context Preservation

> When I start a new train of thoughts while another is running, I want the current train paused and linked so that I can return to it later without losing context.

---

## 4. Personas

| Persona | Primary JTBD | Use Case |
|---------|-------------|----------|
| Knowledge Worker | Rapid Serial Capture | Morning brain dump, meeting notes, problem decomposition |
| Product Owner | Exploratory Branching | Feature ideation, stakeholder feedback processing |
| Domain Architect | Thought Chain Visualization | Domain exploration, concept mapping, decision trees |
| Researcher | Thought Elaboration | Literature review connections, hypothesis chains |

---

## 5. User Stories

### Epic: Serial Capture Loop

- As a user, I want to start a "Train of Thoughts" session from the command palette so that I enter a rapid capture mode
- As a user, I want the first thought to become the session title and description so that the session is named after its origin
- As a user, I want each Enter to save the current thought and open a new capture modal so that I can keep capturing without interruption
- As a user, I want the previous thought title shown as context in each new capture modal so that I remember where I left off
- As a user, I want to stop the train at any point by closing the modal so that I can review my journey

### Epic: Thought Linking & Relations

- As a user, I want each thought automatically linked to its predecessor with a "next" relation so that the chain is traceable
- As a user, I want to choose a direction (next, branch) when capturing so that I can create forks in my thinking
- As a user, I want the default direction to be "next" so that linear capture requires no extra input
- As a user, I want branch relations to create a tree structure so that alternative thought paths are preserved

### Epic: Train Main View

- As a user, I want a dedicated main view showing the current thought's content so that I can see what I'm working with
- As a user, I want to navigate between thoughts in the train so that I can review any point in my journey
- As a user, I want to see branch links when a thought has multiple continuations so that I can explore different paths
- As a user, I want to open the underlying note in Obsidian's editor so that I can add detail to any thought

### Epic: Timeline Sidebar

- As a user, I want a sidebar showing a top-down timeline graph of all thoughts so that I see the full journey at a glance
- As a user, I want to click any node in the timeline to navigate to that thought so that I can jump to any point
- As a user, I want branches visualized as tree forks so that the structure of my thinking is visible
- As a user, I want timestamps on the timeline axis so that I can see when each thought occurred

### Epic: Session Integration

- As a user, I want Train of Thoughts to use the existing session lifecycle (prepared, running, paused, reviewing, completed) so that it integrates with my session history
- As a user, I want to start a new train while another is running so that a sudden new direction doesn't require stopping the current train
- As a user, I want the paused train linked to the new one so that I can navigate between related trains
- As a user, I want the closure ritual to trigger when I end a train so that I reflect on what I captured

---

## 6. Outcome (Success Definition)

- "Start Train of Thoughts" command available in command palette
- First thought creates session + first note
- Each Enter creates a linked note and opens next capture modal
- Previous thought title shown as context in capture modal
- Dedicated Train Main View with thought detail and navigation
- Timeline Sidebar with top-down graph showing branches
- Session lifecycle integration (pause, resume, closure)
- Session nesting (new train pauses current)
- All thoughts are standard vault notes with frontmatter

---

## 7. Scope

### In Scope (v1)

- "Start Train of Thoughts" command
- Serial capture loop via Quick Capture modal
- ThoughtNode type with directional relations (next, branch)
- Train Main View (thought detail, navigation, branch links)
- Timeline Sidebar (graph visualization)
- Session lifecycle integration
- Session nesting (pause current, link trains)
- Closure ritual on train end

### Out of Scope (v1)

- Custom direction types beyond next/branch
- AI-assisted thought suggestions
- Collaborative trains (multi-user)
- Canvas rendering of thought graphs
- Export to external mind-mapping tools
- Drag-and-drop reordering of thoughts
- Merge/split operations on thought chains

---

## 8. Solution Concept

### Architecture

```
Train of Thoughts
 ├── Domain Layer
 │   ├── ThoughtNode type         # id, title, path, timestamp, relations[]
 │   ├── ThoughtRelation type     # from, to, direction (next|branch)
 │   ├── TrainState type          # sessionId, nodes[], activeNodeId, rootNodeId
 │   ├── TrainService             # CRUD for trains, node management, navigation
 │   └── Events                   # train.started, thought.added, thought.branched, train.paused, train.resumed
 │
 ├── UI Layer
 │   ├── TrainMainView            # extends ItemView — thought detail, navigation, branch links
 │   ├── TrainTimelineSidebar     # extends ItemView — top-down timeline graph
 │   ├── TrainCaptureModal        # extends QuickCaptureModal — serial capture with context
 │   └── TrainTimelineRenderer    # canvas-based timeline graph component
 │
 └── Integration
     ├── Session type config      # "train-of-thought" type in SessionService
     ├── Command registration     # "flowti:start-train" command
     └── Quick Capture bridge     # TrainCaptureModal → CaptureService → TrainService
```

### Data Model

```typescript
interface ThoughtNode {
  id: string;
  title: string;
  filePath: string;         // path to vault note
  timestamp: string;        // ISO creation time
  relations: ThoughtRelation[];
}

interface ThoughtRelation {
  targetId: string;
  direction: "next" | "branch";
}

interface TrainState {
  sessionId: string;
  rootNodeId: string;
  activeNodeId: string;
  nodes: ThoughtNode[];
}
```

### Event Model

| Event | Payload | When |
|-------|---------|------|
| `train.started` | `{ sessionId, firstThought }` | Train session created with first thought |
| `train.thought.added` | `{ sessionId, nodeId, parentId, direction }` | New thought captured and linked |
| `train.thought.activated` | `{ sessionId, nodeId }` | User navigates to a thought |
| `train.paused` | `{ sessionId }` | User closes capture modal to review |
| `train.resumed` | `{ sessionId, fromNodeId }` | User resumes capture from a point |
| `train.completed` | `{ sessionId, totalThoughts, branches }` | Train session ended |

### Key Interactions

```
[Command Palette: "Start Train of Thoughts"]
    │
    ▼
[TrainCaptureModal: "Enter first thought..."]
    │  Enter
    ▼
[Session created + Note created + TrainMainView opens]
    │
    ▼
[TrainCaptureModal: "Continue from: {last thought}..."]
    │  Enter          │  Escape/Pause
    ▼                 ▼
[Note linked →       [Review mode: navigate timeline,
 next modal]          browse thoughts, open notes]
                         │  Resume
                         ▼
                     [TrainCaptureModal reopens from active node]
```

---

## 9. Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | "Start Train of Thoughts" command creates session and opens first capture modal | Must | Planned |
| FR-02 | Each Enter creates a vault note with typed frontmatter and opens next modal | Must | Planned |
| FR-03 | Previous thought title displayed as context in capture modal | Must | Planned |
| FR-04 | Notes linked with directional relations (next, branch) via frontmatter | Must | Planned |
| FR-05 | Train Main View shows current thought detail with navigation and branch links | Must | Planned |
| FR-06 | Timeline Sidebar shows top-down graph of all thoughts with branch visualization | Must | Planned |
| FR-07 | User can navigate to any thought in the timeline (click in sidebar or via main view) | Must | Planned |
| FR-08 | User can branch from any thought (navigate to it, then resume capture) | Should | Planned |
| FR-09 | Session nesting: new train pauses current, trains are linked | Should | Planned |
| FR-10 | Closure ritual triggers on session end | Should | Planned |
| FR-11 | All thoughts are standard .md vault notes with type frontmatter | Must | Planned |

---

## 10. Acceptance Criteria

- [ ] "Start Train of Thoughts" command visible in command palette
- [ ] First thought creates session + vault note
- [ ] Each Enter creates linked note and opens next capture modal
- [ ] Previous thought title shown as context in modal
- [ ] Train Main View renders with thought navigation
- [ ] Timeline Sidebar renders with graph visualization
- [ ] User can navigate to any thought
- [ ] User can branch from any thought
- [ ] Session lifecycle (pause, resume, closure) works
- [ ] npm test passes

---

## 11. Feature Readiness Index (FRI)

| Dimension | Score | Rationale |
|-----------|-------|-----------|
| Strategy | 4/5 | Clear strategic fit between Quick Capture and Sessions; fills a real gap in Flowti's execution model |
| Scope | 3/5 | Core scope well-defined; timeline graph visualization complexity needs spike; branching UX needs design |
| Architecture | 3/5 | Builds on Session + Quick Capture infrastructure; new domain (ThoughtNode) is straightforward; timeline rendering needs design spike |
| Event Integration | 3/5 | 6 new events mapped; integrates with existing session lifecycle events; inbox integration via capture.note.created |
| Data Model | 3/5 | ThoughtNode + ThoughtRelation types defined; storage strategy (per-session TrainState in TypedStorage) clear; frontmatter relation format needs validation |
| UI Consistency | 2/5 | New views (Train Main, Timeline Sidebar) follow ItemView pattern; timeline graph rendering is novel — no existing pattern to follow; needs design spike |
| Validation & Testing | 2/5 | TrainService testable as pure logic; UI views need happy-dom setup; timeline renderer needs visual testing strategy |
| **Total FRI** | **20/35** | **Technically Ready** — implementation can begin after architecture spike for timeline rendering |

---

## 12. Technical Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| Timeline graph rendering complexity | High | Medium | Start with simple HTML/CSS tree; defer canvas-based rendering to v2 |
| Session nesting edge cases | Medium | Medium | Implement simple pause/resume first; defer multi-level nesting |
| Frontmatter relation format conflicts | Low | Low | Use dedicated `thought-relations` frontmatter key; validate on load |
| Performance with large thought chains (100+ nodes) | Medium | Low | Virtualize timeline sidebar; lazy-load thought content |

---

## 13. Dependencies

| Dependency | Status | Impact |
|------------|--------|--------|
| Session Workspaces v2 (lifecycle, state machine) | Delivered | TrainService uses session lifecycle directly |
| Quick Capture (modal, CaptureService) | Delivered | TrainCaptureModal extends capture modal pattern |
| EventBus + Event Catalog | Delivered | 6 new train events registered |
| FileSystemClient | Delivered | Note creation and linking |

All dependencies are met — this feature can begin implementation immediately.

---

## Product Backlog Items

| PBI | Title | Status | Priority | Est. Increments |
|-----|-------|--------|----------|-----------------|
| [[PBI-TOT-001 Train Domain and Serial Capture]] | Domain types, TrainService, serial capture loop | Planned | Must | 2 |
| [[PBI-TOT-002 Train Main View and Timeline Sidebar]] | Dedicated views, navigation, branching | Planned | Must | 2 |
| [[PBI-TOT-003 Session Nesting and Lifecycle]] | Pause/resume, nesting, closure integration | Planned | Should | 1 |

---

## Stage History

| Date | Stage | FRI | Notes |
|------|-------|-----|-------|
| 2026-02-21 | discovery → approved | 20/35 | Initial PRD created from vault inbox idea. 3 PBIs defined, 5 increments estimated. Dependencies met (Session v2 + Quick Capture delivered). |

---

## Related

- Inbox: [[I want to have the option to create a serial note session on every enter a new quick capture modal opens with the last note title in the description]]
- Parent: [[Session Workspaces PRD]]
- Sibling: [[Quick Capture PRD]]
- Domain: [[Session Workspaces PRD|Session domain]]
