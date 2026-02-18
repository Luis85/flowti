---
type: ProductRequirementsDocument
domain: Session
stage: in-progress
version: 4
maturity: L3
created: 2026-02-01
updated: 2026-02-18
foundation: "[[PBI-002 Documentation Sessions]]"
maturity_score_strategy: 5
maturity_score_scope: 5
maturity_score_architecture: 4
maturity_score_event_integration: 5
maturity_score_data_model: 4
maturity_score_ui_consistency: 3
maturity_score_validation_testing: 3
fri_score: 29
business_value: 5
implementation_cost: 4
maintenance_cost: 3
discovery_cost: 3
design_cost: 4
test_cost: 4
priority: 5
tags:
  - session
  - workspace
  - prd
---

# Feature PRD: Session Workspaces

## 1. Feature Overview

**Feature Name:** Session Workspaces
**Domain:** Flowti – Integrated Business Development Environment
**Maturity Target:** L3 (Development Ready)
**Foundation:** PBI-002 Documentation Sessions (10 increments delivered, 2 planned)

### Purpose

Session Workspaces extend Flowti's existing session infrastructure into a comprehensive, context-aware working environment. Building on the foundation of Documentation Sessions (timer, goals, notes, focus file, artifacts, links, canvas), this feature adds activity tracking, context bindings, decision recording, session-type orchestration, and structured session summaries.

It acts as:

- A **contextual container** — binding sessions to vault entities (domains, features, products)
- An **activity tracker** — recording vault file activity scoped to the session
- A **decision log** — capturing decisions within session context
- A **stateful working memory** — persisting full session state for resume
- A **documentation anchor** — generating structured summaries on completion

### Scope Boundary

This PRD targets **L2 (single-user structured sessions)**. Multi-user collaboration, real-time sync, and role-based access are documented as L3 future scope and explicitly excluded from this delivery phase.

---

## 2. Problem Statement

### What Exists (Foundation from PBI-002)

The Documentation Sessions feature delivered under the Hubs PRD provides:

- **Session domain core**: types, events (29 registered), SessionService state machine
- **SessionWorkspaceView**: timer, goals checklist, notes, focus file, artifacts, links, canvas
- **User Hub integration**: sessions tab, NewSessionModal, templates, preparation flow
- **Session persistence**: TypedStorage, session notes as markdown files
- **148+ tests** across SessionService and SessionWorkspaceView

### What's Missing

Despite a working session infrastructure, users still experience:

- **No activity tracking** — file creates, edits, and opens during a session are not logged; there's no visibility into what happened
- **No folder filtering** — activity noise from system folders (.obsidian, templates, node_modules) clutters the view
- **No context binding** — sessions float freely; no link to the feature, domain, or product being worked on
- **No decision capture** — decisions made during sessions exist only in notes as unstructured text
- **No structured summary** — session completion produces a notes file but no structured outcome document
- **No session-type orchestration** — all session types share the same workspace layout; no type-specific guidance or tools
- **Limited resume** — sessions can be resumed but workspace state (open files, scroll positions) is not restored

### Impact

- Activity during sessions is invisible and untraceable
- Decisions made in sessions are lost or buried in notes
- Context switching between sessions and their related vault entities is manual
- No structured post-session review is possible
- Session types are labels only — they don't drive workspace behavior

---

## 3. Objectives

The Session Workspaces feature shall:

1. **Track vault activity** during sessions with configurable folder filtering
2. **Bind sessions to vault context** (domains, features, products, vault paths)
3. **Capture decisions** as structured, searchable, linked records
4. **Generate session summaries** on completion with goals, decisions, artifacts, activity
5. **Orchestrate by session type** — type-specific layouts, guiding questions, tools
6. **Restore workspace state** on session resume

---

## 4. Jobs To Be Done (JTBD)

### JTBD 1 — Focused Work Context

> When I start working on a specific topic, I want a dedicated workspace that shows only relevant activity so that I can focus without noise.

### JTBD 2 — Capture & Persist Outcomes

> When a session ends, I want a structured summary with decisions, artifacts, and activity so that outcomes are traceable and reviewable.

### JTBD 3 — Tool Orchestration

> When I select a session type like "Domain Design," I want the workspace pre-configured with relevant tools and guiding questions so that I can start working immediately.

### JTBD 4 — Resume Work

> When I return to a paused session, I want the workspace restored exactly as I left it so that I lose no context.

### JTBD 5 — Traceability

> When reviewing what happened, I want to see which session produced which artifacts and decisions so that I can trace outcomes to their origin.

### JTBD 6 — Activity Visibility

> When working in a session, I want to see a live activity log of file changes filtered to my working area so that I know what's happening.

---

## 5. Personas

| Persona | Primary JTBD | Key Session Types |
|---------|-------------|-------------------|
| Domain Architect | Focused Work, Traceability | Domain Design, Event Storming |
| Product Owner | Capture Outcomes, Tool Orchestration | Requirements Refinement, Backlog Structuring |
| Engineer | Focused Work, Resume | Knowledge Cleanup, Vault Hygiene |
| Delivery Manager | Traceability, Capture Outcomes | Review, Retrospective |

---

## 6. User Stories

### Epic: Activity Tracking

- As a session user, I want to see a live log of file changes during my session so that I know what was created and modified
- As a vault user, I want to filter folders from the activity log so that system folders don't create noise
- As a session user, I want per-session folder filters so that each session only tracks its relevant vault area

### Epic: Context Binding

- As a domain architect, I want to bind my session to a domain so that artifacts are automatically scoped
- As a product owner, I want to bind a session to a feature or PBI so that session work is traceable to the backlog
- As a user, I want to see the bound context in the workspace header so that I always know what I'm working on

### Epic: Decision Recording

- As a session user, I want to record a decision during my session so that it's captured with context
- As a reviewer, I want to see all decisions made in a session so that I can verify outcomes
- As a user, I want decisions linked to the session and its bound context

### Epic: Session Summary

- As a user, I want a structured summary generated when I complete a session
- As a reviewer, I want the summary to include goals achieved, decisions made, artifacts produced, and activity timeline

### Epic: Session Type Orchestration

- As a domain architect, I want a "Domain Design" session type that pre-loads domain documentation tools
- As a user, I want guiding questions specific to my session type visible during work
- As a user, I want to create custom session types with their own guiding questions

### Epic: Resume & State Restoration

- As a user, I want to resume a session and have my workspace layout restored
- As a user, I want the files I had open during the session reopened on resume

---

## 7. Solution Concept

The Session Workspace extends the existing `SessionService` and `SessionWorkspaceView` with six capabilities:

```
SessionWorkspace (L2)
 ├── Activity Log          ← NEW: file event tracking + folder filters
 ├── Context Bindings      ← NEW: link to domains/features/products
 ├── Decision Log          ← NEW: structured decision records
 ├── Session Summary       ← NEW: generated on completion
 ├── Type Orchestration    ← NEW: type-specific config + guiding questions
 └── State Restoration     ← NEW: workspace state persistence on resume
```

### Architecture Alignment

- **EventBus**: all new capabilities communicate via events (no direct service coupling)
- **Domain layer**: new types and services in `src/domain/session/`
- **UI layer**: new workspace panels in `src/ui/sessionWorkspace/` (component extraction from monolithic view)
- **Persistence**: TypedStorage for session state, vault files for summaries/decisions
- **Catalog**: all new events registered with category "Session", tagged `[]` (user-visible)

---

## 8. Data Model Extensions

### Implemented Types (delivered in Inc 10)

```typescript
// Activity log entry — tracked per session
interface SessionActivity {
  timestamp: string;     // ISO 8601
  action: SessionActivityAction;  // "created" | "modified" | "opened" | "deleted" | "renamed"
  path: string;
  oldPath?: string;      // for renames
}

// Context binding — links session to vault entity
interface SessionContextBinding {
  id: string;
  type: ContextBindingType;  // "file" | "folder" | "domain" | "feature" | "product"
  label: string;             // auto-derived from path basename
  path: string;              // vault path to the entity doc or folder
  boundAt: string;           // ISO 8601
}
```

> **Deviation from PRD v2:** Context binding types changed from `"domain" | "feature" | "product" | "path"` to 5 types: `"file" | "folder" | "domain" | "feature" | "product"`. The single `"path"` type was split into `"file"` and `"folder"` because folder bindings need different click behavior (reveal in file explorer vs. open as note). The type cycles via click: file → folder → domain → feature → product → file.

### Folder Filtering (implemented)

Folder filtering uses a split persistence model rather than a single `SessionFolderFilter` interface:

| Filter Scope | Storage | Accessed Via |
|-------------|---------|-------------|
| Global | `SettingsService` (`sessionActivityFilterGlobal: string[]`) | `settingsService.getSettings().sessionActivityFilterGlobal` |
| Per-session | `Session.activityFilter: string[]` | `session.activityFilter` |

Combined filter applied via `isExcluded(path, global, perSession)` pure function (ADR-026).

### Planned Types (not yet implemented)

```typescript
// Decision record — FR-03
interface SessionDecision {
  id: string;
  title: string;
  description: string;
  recordedAt: string;    // ISO 8601
  context?: string;      // optional reference to bound entity
}

// Guiding question set per session type — FR-05
interface SessionTypeConfig {
  type: SessionType;
  guidingQuestions: string[];
  defaultDuration: number;
  defaultGoals: SessionGoal[];
}
```

### Extended Session Interface (actual)

```typescript
interface Session {
  // ... existing fields (id, type, title, status, timer, goals, notes, focusFile, notesFile, canvasFile, links, artifacts, timeline) ...
  activity: SessionActivity[];              // ✅ Delivered Inc 10
  activityFilter: string[];                 // ✅ Delivered Inc 10 (per-session folder exclusions)
  contextBindings: SessionContextBinding[]; // ✅ Delivered Inc 10
  // decisions: SessionDecision[];          // ❌ Planned (FR-03)
  // summaryFile: string | null;            // ❌ Planned (FR-04) — notesFile serves dual purpose for now
}
```

### Persistence

| Data | Storage | Lifecycle | Status |
|------|---------|-----------|--------|
| Activity log | Session state via TypedStorage | Cleared on archive | ✅ Delivered |
| Folder filters (global) | Settings via SettingsService | Permanent | ✅ Delivered |
| Folder filters (per-session) | Session state via TypedStorage | Per session | ✅ Delivered |
| Context bindings | Session state via TypedStorage | Per session | ✅ Delivered |
| Decisions | Session state via TypedStorage | Per session | ❌ Planned |
| Session summary | Vault markdown file (notes file) | Permanent | ✅ Partial (via notesFile) |
| Session type config | Settings via SettingsService | Permanent | ❌ Planned |

---

## 9. Event Model

### Delivered Events (Inc 10)

| Event | Trigger | Payload | Status |
|-------|---------|---------|--------|
| `session.activity.tracked` | File event during active session | `{ sessionId, activity: SessionActivity }` | ✅ |
| `session.activity.filter.updated` | Per-session folder filter changed | `{ sessionId, filter: string[] }` | ✅ |
| `session.context.bind` | User binds context | `{ sessionId, type, path }` | ✅ |
| `session.context.bound` | Context bound successfully | `{ sessionId, binding: SessionContextBinding }` | ✅ |
| `session.context.unbind` | User removes binding | `{ sessionId, bindingId: string }` | ✅ |
| `session.context.unbound` | Context removed | `{ sessionId, bindingId: string }` | ✅ |
| `session.context.changeType` | User cycles binding type | `{ sessionId, bindingId, newType }` | ✅ |
| `session.context.typeChanged` | Binding type changed | `{ sessionId, bindingId, newType }` | ✅ |
| `session.paths.updated` | File/folder rename path reconciliation | `{ sessionIds: string[] }` | ✅ |

### Planned Events (not yet implemented)

| Event | Trigger | Payload | FR |
|-------|---------|---------|-----|
| `session.decision.record` | User records decision | `{ sessionId, decision: SessionDecision }` | FR-03 |
| `session.decision.recorded` | Decision stored | `{ sessionId, decision: SessionDecision }` | FR-03 |
| `session.decision.remove` | User removes decision | `{ sessionId, decisionId: string }` | FR-03 |
| `session.decision.removed` | Decision removed | `{ sessionId, decisionId: string }` | FR-03 |
| `session.state.save` | Workspace state snapshot | `{ sessionId, state: WorkspaceState }` | FR-06 |
| `session.state.saved` | State persisted | `{ sessionId }` | FR-06 |
| `session.state.restore` | Resume triggers restore | `{ sessionId }` | FR-06 |
| `session.state.restored` | State applied to workspace | `{ sessionId }` | FR-06 |

> **Note:** `session.summary.generate`/`session.summary.generated` removed from plan — summary generation is handled synchronously via `writeSessionSummary()` on `session.completed`, making dedicated events unnecessary.

### Existing Events (from PBI-002, unchanged)

19 session lifecycle events + 10 workspace enrichment events = 29 existing events. Plus 9 delivered Session Workspaces events = **38 total session events**.

---

## 10. Functional Requirements

### FR-01: Activity Log — ✅ Delivered (Inc 10)

- [x] Track file creates, modifications, opens, deletes, and renames during active sessions
- [x] Display activity as a chronological timeline in the workspace
- [x] Global folder filter (settings) excludes paths from all session activity logs
- [x] Per-session folder filter excludes paths for a specific session only
- [x] Combined filter: global + per-session exclusions merged via `isExcluded()` pure function (ADR-026)
- [x] Activity persisted with session state; cleared on archive

> **Implementation note:** ADR-025 (separate artifacts vs. activity) was superseded — Inc 10 consolidated artifacts into the unified activity log. The `SessionArtifact` type and `session.artifacts` array remain for backward compatibility and summary generation.

### FR-02: Context Bindings — ✅ Delivered (Inc 10)

- [x] Bind a session to one or more vault entities (domain, feature, product, file, folder)
- [x] Display bound context in workspace with clickable navigation and type badges
- [x] Context binding persisted with session state
- [x] Unbind context via workspace UI

> **Deviation:** Binding types expanded from 4 (`domain | feature | product | path`) to 5 (`file | folder | domain | feature | product`). Folder bindings reveal in file explorer; file bindings open as notes. Type cycles via click. Max 10 bindings per session (`MAX_CONTEXT_BINDINGS`).

### FR-03: Decision Log — ❌ Not Yet Delivered

- [ ] Record decisions with title, description, and optional context reference
- [ ] Display decisions in a dedicated workspace panel
- [ ] Decisions persisted with session state
- [ ] Decisions included in session summary

### FR-04: Session Summary — ✅ Partially Delivered (Inc 8)

- [x] Generate a structured markdown file on session completion
- [x] Summary includes: metadata, goals (completed/total), artifacts, activity timeline, context bindings, time summary
- [x] Summary file stored in `SESSION_NOTES_FOLDER` alongside session notes
- [ ] Summary file path stored on session as `summaryFile` — **not implemented; `notesFile` serves dual purpose**
- [ ] Summary includes decisions — **blocked by FR-03**

> **Implementation note:** `generateSessionSummary()` + `writeSessionSummary()` delivered in Inc 8. Summary written to `notesFile` path with merge semantics (`mergeSessionNotes()` preserves user-added content). No separate `summaryFile` field needed.

### FR-05: Session Type Orchestration — ❌ Not Yet Delivered

- [ ] Session types define guiding questions, default duration, and default goals
- [ ] Guiding questions displayed in workspace during active/paused sessions
- [x] Pre-built types: Event Storming, Service Design, Requirements Refinement, Backlog Structuring, Knowledge Cleanup, Vault Hygiene *(types exist as labels but without orchestration)*
- [ ] Custom session type creation via settings

### FR-06: State Restoration — ❌ Not Yet Delivered

- [ ] On pause/complete: save workspace state (open tabs in adjacent leaf, scroll position)
- [ ] On resume: restore saved workspace state
- [ ] Graceful degradation if files have been moved/deleted since pause

---

## 11. Non-Functional Requirements

### Performance

- Activity log updates: < 16ms (debounced to not block UI)
- Session state save: < 100ms
- Session state restore: < 300ms
- Summary generation: < 500ms

### Reliability

- Session state persisted atomically via TypedStorage
- Activity log survives pause/resume cycles
- Crash recovery: session state restored from last persisted snapshot

### Scalability

- Activity log capped at 1000 entries per session (oldest evicted)
- Decisions capped at 100 per session
- Context bindings capped at 10 per session

---

## 12. UI Concept

The SessionWorkspaceView gains new panels within the existing layout:

```
+--------------------------------------------------+
| [Context: Domain Design] [Type] [Status]         |
| [Pause] [Complete] [Add Context] [Record Decision]|
+--------------------------------------------------+
|              ##  25:00  ##                         |
|              Time Remaining                        |
+--------------------------------------------------+
| Guiding Questions (Domain Design)                 |
| • What services does this domain provide?         |
| • What events does this domain produce/consume?   |
+--------------------------------------------------+
| Goals  (2/5)           | Activity Log             |
| [ ] Review types.ts    | 14:32 created events.ts  |
| [v] Update events.ts   | 14:28 modified types.ts  |
| [+ Add goal...]        | 14:25 opened README.md   |
|                        | [Filter: src/domain/]    |
+--------------------------------------------------+
| Decisions (1)                                     |
| ✓ "Use event sourcing for audit trail"            |
|   [+ Record Decision]                             |
+--------------------------------------------------+
| Notes | Links (3) | Canvas                        |
| +----------------------------------------------+ |
| | [textarea - debounced save]                   | |
+--------------------------------------------------+
```

---

## 13. Product Backlog Items

| Rank | PBI | Title | Priority | Depends On | Status |
|------|-----|-------|----------|------------|--------|
| — | PBI-SW-001 | Activity Log & Folder Filtering | High | PBI-002 (foundation) | ✅ Done (Inc 10) |
| — | PBI-SW-002 | Context Bindings | High | PBI-SW-001 | ✅ Done (Inc 10) |
| 1 | PBI-SW-003 | Session Types & Orchestration | High | PBI-SW-001 | Planned — bundles global filter settings UI; enables PBI-SW-009 |
| 2 | PBI-SW-004 | Decision Log | Medium | — | Planned — independent, unblocks PBI-SW-005 completion |
| 3 | PBI-SW-007 | Auto-Session & Session Nudges | Medium | — | Planned — daily tracking + nudges; independent |
| 4 | PBI-SW-009 | Domain Design Session | Medium | PBI-SW-003 | Planned — guided domain decomposition workflow |
| 5 | PBI-SW-005 | Session Summary | Low | PBI-SW-001, PBI-SW-004 | ✅ Partial (Inc 8 — remaining: decisions section) |
| 6 | PBI-SW-008 | Session Output Artifacts | Low | PBI-SW-005 | Planned — typed output docs from completed sessions |
| 7 | PBI-SW-006 | State Restoration | Low | — | Planned — no user demand yet (L-12) |

> **Cross-delivery:** PBI-SW-001 and PBI-SW-002 were delivered together in PBI-002 Increment 10 (Sidebar Workspace & Activity Consolidation), not as standalone increments. This was more efficient — activity log and context bindings share workspace UI surface area and were delivered as one cohesive increment.

> **Priority ranking:** PBIs are ranked by interleaved user value, not sequential delivery order. PBI-SW-003 is ranked highest because it provides the foundation for type-specific tooling (enabling PBI-SW-009) and bundles the global filter settings UI from PBI-SW-001's remainder.

See `backlog/PBI-SW-*.md` for detailed specifications.

---

## 14. Lifecycle Stage Tracking

| Phase | Status | Date | Notes |
|-------|--------|------|-------|
| 1 — Feedback & Idea Intake | Done | 2026-02-17 | 3 inbox items ingested as user stories |
| 2 — Discovery | Done | 2026-02-17 | Problem grounded in PBI-002 foundation gaps |
| 3 — Solution Exploration | Done | 2026-02-17 | L2 scope selected; L3 deferred |
| 4 — Solution Design + PRD | Done | 2026-02-17 | PRD v2 with concrete requirements |
| 5 — Development Ready | Done | 2026-02-17 | FRI 29/35; Technical Review: Pass |
| 6 — Delivery Planning | Done | 2026-02-18 | 9 PBIs defined (6 original + 3 new from inbox). SW-001/002 done, SW-005 partial. Priority ranked by value. |
| 7 — Implementation | In-Progress | 2026-02-18 | FR-01 + FR-02 delivered; FR-04 partial; FR-03/05/06 pending |
| 8 — Review | In-Progress | 2026-02-18 | Inc 10 in review (TASM pending) |
| 9–10 | Pending | — | — |

### Stage History

| Date | From | To | Gate | FRI | Reviewer | Notes |
|------|------|----|------|-----|----------|-------|
| 2026-02-17 | — | draft | — | — | — | PRD v2 created with L2 scope, 6 FRs, 16 events, 6 PBIs |
| 2026-02-17 | draft | approved | Design Gate + Readiness Gate | 29/35 | Technical Architect | Technical Review: Pass. Technically Ready. No follow-ups required |
| 2026-02-18 | approved | in-progress | — | 29/35 | — | FR-01 (Activity Log) + FR-02 (Context Bindings) delivered via PBI-002 Inc 10. FR-04 (Summary) partially delivered. 9 new events registered. 3 ADRs accepted (025 superseded, 026 accepted, 029 proposed). |
| 2026-02-18 | in-progress | in-progress | Backlog Refinement | 29/35 | — | PRD v4. PBI-SW-001/002 closed. PBI-SW-003 promoted to High (bundles global filter, enables SW-009). PBI-SW-005 updated to In Progress (partial). 3 new PBIs: SW-007 (Auto-Session), SW-008 (Output Artifacts), SW-009 (Domain Design). Priority ranking interleaved by value. |

### Related Architecture Decisions

| ADR | Title | Status | Relevance |
|-----|-------|--------|-----------|
| ADR-025 | Activity Log Separate from Artifacts | Superseded | Activity consolidated into unified log; artifacts section removed |
| ADR-026 | Composable Folder Filtering | Accepted | `isExcluded()` pure function for global + per-session folder filtering |
| ADR-029 | ISO Date Prefix for Session Files | Proposed | Session notes/canvas file naming convention |

---

## 15. Future Extensions (L3 — Collaboration)

The following capabilities are documented for future maturity levels and explicitly excluded from L2 scope:

- **Multi-user sessions** — participant registry, invite/join flow
- **Real-time collaboration** — shared workspace state, live cursor sync
- **Role-based access** — facilitator, participant, observer roles
- **AI-assisted summary** — automated session summary generation
- **Session analytics** — time analysis, participation heatmap
- **Decision quality scoring** — structured evaluation of decision outcomes
- **Session maturity model** — progressive capability levels per session type

---

## 16. Business Value

- **Reduced cognitive load** — context bindings and activity filtering keep focus tight
- **Better traceability** — decisions, artifacts, and activity linked to sessions
- **Structured outcomes** — session summaries replace scattered notes
- **Documentation discipline** — guiding questions and type-specific tools enforce structure
- **Operational visibility** — activity logs make session work transparent
- **Resume continuity** — state restoration eliminates re-orientation time

---

## 17. Strategic Perspective

The Session Workspace is the **bounded event domain for structured work**. Within Flowti's architecture:

- It acts as a **temporary bounded context** scoped to a work session
- It **tracks events** (activity, decisions) within that boundary
- It **aggregates state** (goals, notes, artifacts, decisions, activity)
- It is the **human equivalent of a process instance**

At L2, it serves the single user working in their vault. At L3, it becomes the operational backbone for team collaboration across Refinement, Story Mapping, Architecture Workshops, Retrospectives, and R&D Sessions.
