---
type: ProductRequirementsDocument
domain: Session
stage: in-progress
version: 8
maturity: L3
created: 2026-02-01
updated: 2026-02-21
foundation: "[[PBI-002 Documentation Sessions]]"
maturity_score_strategy: 5
maturity_score_scope: 4
maturity_score_architecture: 4
maturity_score_event_integration: 5
maturity_score_data_model: 4
maturity_score_ui_consistency: 4
maturity_score_validation_testing: 5
fri_score: 31
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
  - core
plugin: "[[Development/flowti/README|README]]"
---

# Feature PRD: Session Workspaces → Session v2 – Focus & Execution Environment

# Executive Summary

# Session v2 – Focus & Execution Environment

## Strategic Purpose

Session v2 transforms Sessions from a simple timer into a **structured execution environment** inside Flowti.

It enables intentional work, structured reflection, and measurable outcomes — for both deep individual work and workshop facilitation.

Sessions become a core building block of Flowti’s execution layer.

---

## Why This Matters

Current sessions support timing and notes, but lack:

- Clear outcome definition
    
- Measurable execution progress
    
- Structured reflection
    
- Formal closure discipline
    
- Energy awareness
    
- Lifecycle management
    

This limits their impact and prevents Sessions from becoming a true execution framework.

Session v2 addresses these gaps.

---

## What Will Change

### 1. Intent-Driven Work

Each session begins with a defined **Primary Outcome** and optional rationale.  
Focus shifts from “time spent” to “outcome achieved.”

---

### 2. Structured Execution Layer

Sessions include a prioritized execution checklist with visible progress tracking.

This:

- Improves focus
    
- Reduces scope creep
    
- Enables measurable completion
    

---

### 3. Context Intelligence

Users bind relevant knowledge artifacts (PRDs, canvases, notes).  
The session becomes a **micro execution hub** connected to the knowledge graph.

---

### 4. Energy Awareness

Users track and adjust energy levels during the session.  
Energy changes are logged and can later support performance analytics.

---

### 5. Structured Reflection

Sessions capture:

- Observations
    
- Blockers
    
- Ideas
    
- Decisions
    

This increases learning and accountability.

---

### 6. Mandatory Closure Ritual

When time expires, the session enters a **Review state**.

Users must:

- Confirm outcome achievement
    
- Reflect on effectiveness
    
- Define next actions
    

Closure templates are configurable globally and per session type.

---

### 7. Two Usage Modes

**Main Workspace Mode**  
Full execution environment for deep work.

**Sidebar Companion Mode**  
Lightweight monitoring interface designed for:

- Canvas work
    
- PRD refinement
    
- Live workshops
    

The sidebar avoids action clutter and acts as a control surface.

---

### 8. Lifecycle & State Model

Sessions now follow a defined lifecycle:

- Prepared
    
- Running
    
- Paused
    
- Reviewing
    
- Completed
    
- Archived
    

All transitions are event-driven and traceable.

---

## Business Impact

Session v2 strengthens Flowti as:

- A Personal Focus Tool
    
- An Execution Container
    
- A Workshop Facilitation Companion
    
- A Measurable Performance System
    

It increases:

- Completion rates
    
- Structured thinking
    
- Knowledge binding
    
- Decision traceability
    
- Execution discipline
    

---

## Strategic Positioning

Session v2 positions Flowti not as a productivity app, but as:

> A Focus-Oriented Execution Orchestrator  
> embedded inside an event-driven business operating environment.

This feature becomes a foundational execution primitive for the broader IBDE vision.

---

## 1. Feature Overview

**Feature Name:** Session v2 – Focus & Execution Environment
**Domain:** Flowti – Integrated Business Development Environment / Personal Productivity / Execution Orchestration
**Maturity Target:** L3 (Development Ready)
**Foundation:** PBI-002 Documentation Sessions (10 increments delivered) + 5 development cycles
**Evolution:** Session Workspaces v1 (8/8 FRs delivered, FRI 34/35) → Session v2

### Purpose

Session Workspaces extend Flowti's existing session infrastructure into a comprehensive, context-aware working environment. Building on the foundation of Documentation Sessions (timer, goals, notes, focus file, artifacts, links, canvas), this feature adds activity tracking, context bindings, decision recording, session-type orchestration, and structured session summaries.

**Session v2** transforms sessions from a tracking tool into a **structured, state-driven execution environment**:

- A **focus orchestration system** — defining intentional outcomes before execution
- A **micro execution environment** — binding context, tracking progress, capturing reflection
- A **contextual container** — binding sessions to vault entities (domains, features, products)
- An **activity tracker** — recording vault file activity scoped to the session
- A **decision log** — capturing decisions within session context
- A **stateful working memory** — persisting full session state for resume
- A **documentation anchor** — generating structured summaries on completion
- A **closure discipline** — enforcing structured review and reflection
- A **workshop facilitation tool** — supporting agenda tracking and live decision capture
- An **energy-aware system** — tracking cognitive energy and detecting overload

Sessions act as **micro execution environments** inside Flowti and integrate into the event-driven knowledge graph.

### Scope Boundary

This PRD targets **L3 (Development Ready)** for single-user structured sessions. Multi-user collaboration, real-time sync, and role-based access are documented as future L4 scope and explicitly excluded from this delivery phase.

**v1 scope (delivered):** Activity tracking, context bindings, decision recording, session-type orchestration, structured summaries, state restoration, output artifacts, daily auto-session & nudges.

**v2 scope (planned):** Session lifecycle state machine, intent layer, energy tracking, execution plan, structured reflection, closure ritual, activity intelligence, cognitive overload detection, main/sidebar mode separation, workshop mode.

---

## 2. Problem Statement

### What Exists (Foundation from PBI-002)

The Documentation Sessions feature delivered under the Hubs PRD provides:

- **Session domain core**: types, events (68 registered), SessionService state machine (1,267 LOC)
- **SessionWorkspaceView**: timer, goals checklist, notes, focus file, artifacts, links, canvas, decisions, activity log, context bindings, output artifacts
- **User Hub integration**: sessions tab, NewSessionModal, templates, preparation flow, command palette, dashboard quick actions
- **Session persistence**: TypedStorage, session notes as markdown files
- **650+ tests** across SessionService, SessionWorkspaceView, and domain layer

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

### What's Still Missing (v2 Gaps)

Despite a fully delivered v1 infrastructure (8/8 FRs, 68 events, 396+ tests), sessions remain a basic tracking tool rather than a focus orchestration system:

- **No structured intent definition** — sessions start without a clear outcome or "why"
- **Execution progress not meaningfully tracked** — goals exist but there's no dedicated task checklist with progress indicators
- **Reflection is unstructured** — only decisions are captured; observations, blockers, and ideas have no dedicated structure
- **Sidebar mode is overloaded** — all actions available in sidebar; no separation between workspace and control surface
- **No closure ritual** — sessions complete without structured review or reflection enforcement
- **No energy awareness** — no way to track cognitive energy or detect fatigue during sessions
- **No cognitive load detection** — no warnings when sessions become overloaded (too many tasks, bindings, or duration)
- **No state-based lifecycle** — no "reviewing" state between running and completed; no enforcement of closure before completion
- **No workshop facilitation support** — sessions don't adapt for facilitator use cases (agenda tracking, live decision capture, participant visibility)

---

## 3. Objectives

The Session Workspaces feature shall:

1. **Track vault activity** during sessions with configurable folder filtering — ✅ Delivered
2. **Bind sessions to vault context** (domains, features, products, vault paths) — ✅ Delivered
3. **Capture decisions** as structured, searchable, linked records — ✅ Delivered
4. **Generate session summaries** on completion with goals, decisions, artifacts, activity — ✅ Delivered
5. **Orchestrate by session type** — type-specific layouts, guiding questions, tools — ✅ Delivered
6. **Restore workspace state** on session resume — ✅ Delivered
7. **Generate output artifacts** — template-driven documents from completed sessions — ✅ Delivered
8. ~~**Auto-track daily activity** — passive daily session with concurrent support, daily note integration, nudge system, daily summary — ✅ Delivered (Cycles 4+5)~~ — ❌ **Removed in v8**: conflicts with intentional execution philosophy
9. **Introduce a session lifecycle state machine** — prepared → running → paused → reviewing → completed → archived with event-driven transitions
10. **Provide structured intentional focus** — define primary outcome, why it matters, and session mode before execution
11. **Track dynamic energy levels** — 1–5 scale energy indicator, adjustable during sessions, logged as events
12. **Support structured execution plans** — checklist-based task lists with progress indicators and recommended limits
13. **Introduce structured reflection** — observations, blockers, ideas, and decisions as four distinct categories
14. **Introduce a configurable closure ritual** — structured review overlay required before session completion
15. **Provide activity intelligence** — computed analytics from session activity (files, tasks, time breakdown)
16. **Detect cognitive overload** — threshold-based warnings for task count, binding count, duration, and energy
17. **Separate main workspace and sidebar companion modes** — full execution environment vs. monitoring control surface
18. **Support workshop facilitation** — agenda tracking, timed items, live decision capture, participant visibility

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

### JTBD 7 — Passive Daily Tracking

> ~~When I open my vault, I want my daily activity automatically tracked without starting a session manually so that I have a record of what I did even on days I don't run focused sessions.~~

**Removed:** Daily tracking feature removed from scope in v8 (see Stage History). The daily-tracking session type, auto-start, concurrent session support, and daily note integration have been deprecated. Session v2 focuses on intentional execution environments rather than passive background tracking.

### JTBD 8 — Focus Intentionality

> When I start working, I want to define a clear outcome so that I stay focused and can measure whether I achieved what I intended.

### JTBD 9 — Workshop Facilitation

> When facilitating a workshop, I want to track agenda items and time, log decisions live, and capture follow-ups immediately so that the session produces structured, actionable outcomes.

### JTBD 10 — Structured Closure

> When I finish a session, I want to be guided through a structured reflection so that I capture what worked, what didn't, and what comes next.

### JTBD 11 — Energy Awareness

> When working in a session, I want to track my energy level so that I can recognize when to take breaks and build awareness of my productive patterns.

---

## 5. Personas

| Persona | Primary JTBD | Key Session Types |
|---------|-------------|-------------------|
| Domain Architect | Focused Work, Traceability | Domain Design, Event Storming |
| Product Owner | Capture Outcomes, Tool Orchestration | Requirements Refinement, Backlog Structuring |
| Engineer | Focused Work, Resume | Knowledge Cleanup, Vault Hygiene |
| Delivery Manager | Traceability, Capture Outcomes | Review, Retrospective |
| Workshop Facilitator | Workshop Facilitation, Structured Closure | Workshop, Domain Design, Event Storming |

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

### Epic: Intent & Focus (v2)

- As a session user, I want to define a primary outcome before starting so that I stay focused
- As a session user, I want to see my intended outcome at all times so that I'm reminded of my goal
- As a session user, I want to select a session mode (Deep Work, Workshop, Planning) so that the workspace adapts

### Epic: Execution Plan (v2)

- As a session user, I want a checklist of tasks so that I can track execution progress
- As a session user, I want to see a progress indicator so that I know how far I've come
- As a session user, I want to reorder tasks so that I can reprioritize during execution

### Epic: Structured Reflection (v2)

- As a session user, I want to log observations during my session so that insights are captured in context
- As a session user, I want to log blockers so that impediments are visible and actionable
- As a session user, I want to log ideas so that creative thoughts are preserved
- As a session user, I want decisions separated from observations and ideas for clear traceability

### Epic: Closure Ritual (v2)

- As a session user, I want to be prompted for structured reflection when my session ends
- As a session user, I want to record whether I achieved my outcome so that I can track effectiveness
- As a session user, I want configurable closure questions so that different session types have different review structures

### Epic: Energy & Awareness (v2)

- As a session user, I want to track my energy level during sessions so that I can build self-awareness
- As a session user, I want to be warned when my session is becoming overloaded so that I can adjust scope

### Epic: Workshop Facilitation (v2)

- As a facilitator, I want to track agenda items with time so that I can keep workshops on schedule
- As a facilitator, I want to log decisions live so that participants see decisions as they're made
- As a facilitator, I want follow-ups captured immediately so that action items don't get lost

### Epic: Sidebar Companion (v2)

- As a session user, I want a compact monitoring view in the sidebar so that I can see status while working
- As a session user, I want the sidebar to be read-only for most actions so that I don't accidentally modify session state

---

## 7. Solution Concept

The Session Workspace extends the existing `SessionService` and `SessionWorkspaceView` with six capabilities:

```
SessionWorkspace (L2 → L3)
 ├── Activity Log          ✅ Delivered (Inc 10): file event tracking + folder filters
 ├── Context Bindings      ✅ Delivered (Inc 10): link to domains/features/products
 ├── Decision Log          ✅ Delivered (Cycle 2): structured decision records
 ├── Session Summary       ✅ Delivered (Inc 8 + Cycle 2): generated on completion
 ├── Type Orchestration    ✅ Delivered (Cycle 2): type-specific config + guiding questions
 ├── State Restoration     ✅ Delivered (Cycle 3): workspace state persistence on resume
 ├── Output Artifacts      ✅ Delivered (Cycle 3): template-driven output generation
 ├── Daily Auto-Session    ✅ Delivered (Cycles 4+5): daily tracking, concurrent sessions, auto-start, nudges, daily summary
 ├── Session UX Polish     ✅ Delivered (Cycle 5): command palette commands, dashboard quick actions
 ├── Daily Auto-Session    ❌ Removed (v8): daily tracking deprecated in favor of intentional sessions
 └── Domain Design Session 🔜 Planned (Cycle 7+): guided domain decomposition workflow

Session v2 – Focus & Execution (L3 Extension)
 ├── Session Lifecycle v2      🔜 FR-09: prepared → running → paused → reviewing → completed → archived
 ├── Intent Layer              🔜 FR-10: primary outcome, why it matters, session mode
 ├── Energy Tracking           ✅ FR-11: 1–5 scale, event-driven (Cycle 8)
 ├── Execution Plan            ✅ FR-12: checklist tasks, progress indicator
 ├── Structured Reflection     ✅ FR-13: observations, blockers, ideas, decisions (Cycle 8)
 ├── Closure Ritual System     ✅ FR-14: configurable review overlay (Cycle 7)
 ├── Activity Intelligence     🔜 FR-15: computed analytics from activity
 ├── Cognitive Overload        ✅ FR-16: threshold-based warnings (Cycle 8)
 ├── Main/Sidebar Separation   🔜 FR-17: workspace vs. control surface
 └── Workshop Mode             🔜 FR-18: agenda, timed items, decision highlighting
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

### Delivered Types (Cycle 2)

```typescript
// Decision record — FR-03 ✅ Delivered Cycle 2
interface SessionDecision {
  id: string;
  title: string;
  description?: string;
  recordedAt: string;    // ISO 8601
}

// Session type configuration — FR-05 ✅ Delivered Cycle 2
interface SessionTypeConfig {
  type: SessionType;     // 8 built-in + custom
  label: string;
  description: string;
  guidingQuestions: string[];
  defaultDurationMinutes: number;
  icon: string;
}
```

### Delivered Types (Cycle 3)

```typescript
// Workspace state — FR-06 ✅ Delivered Cycle 3
interface WorkspaceState {
  openFiles: string[];
  activeFile: string | null;
  scrollPositions: Record<string, number>;
}

// Output artifact — FR-07 ✅ Delivered Cycle 3
type SessionOutputType = "meeting-invite" | "action-items" | "review-summary" | "custom";

interface SessionOutputTemplate {
  type: SessionOutputType;
  title: string;
  description: string;
  sections: SessionOutputSection[];
}

interface SessionOutputArtifact {
  type: SessionOutputType;
  path: string;
  generatedAt: string;   // ISO 8601
}
```

### Delivered Types (Cycles 4+5 — Daily Auto-Session & Nudges)

```typescript
// SessionType union extends from 8 → 9 members
type SessionType = /* existing 8 */ | "daily-tracking";

// SessionState gains dailySessionId for concurrent session support
interface SessionState {
  sessions: Session[];
  activeSessionId: string | null;     // focused session (unchanged)
  dailySessionId: string | null;      // ✅ Delivered Cycle 4 — separate daily tracker
  savedTemplates?: SessionTemplate[];
}

// Constant for daily sessions (30s vs 1s for focused)
const DAILY_ACTIVITY_DEDUP_WINDOW_MS = 30_000;

// Session nudge — ✅ Delivered Cycle 5
interface SessionNudge {
  id: string;
  time: string;           // HH:mm format
  templateId?: string;    // reference to SessionTemplate
  message: string;
  enabled: boolean;
}
```

### Planned Types (v2)

```typescript
// Session intent — FR-10
interface SessionIntent {
  primaryOutcome: string;       // required
  whyItMatters?: string;        // optional
  mode: SessionMode;
}

// Session modes — FR-10
type SessionMode = "deep-work" | "planning" | "workshop" | "review" | "exploration";

// Energy level — FR-11
type EnergyLevel = 1 | 2 | 3 | 4 | 5;

// Execution task — FR-12
interface ExecutionTask {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: string;         // ISO 8601
  order: number;
}

// Reflection entry — FR-13
interface ReflectionEntry {
  id: string;
  type: "observation" | "blocker" | "idea" | "decision";
  content: string;
  timestamp: string;            // ISO 8601
}

// Closure response — FR-14 ✅ Done (Cycle 7)
interface ClosureResponse {
  outcomeAchieved: "yes" | "partial" | "no";
  whatWorked: string;
  whatDidnt: string;
  nextAction: string;
  answers: Record<string, string>;
}

// Closure template — FR-14 ✅ Done (Cycle 7)
interface ClosureTemplate {
  questions: ClosureQuestion[];
  requiredFields: string[];
}

interface ClosureQuestion {
  id: string;
  question: string;
  type: "text" | "select" | "rating";
  required: boolean;
  options?: string[];
}

// Cognitive load thresholds — ✅ Done FR-16 (Cycle 8)
interface CognitiveLoadThresholds {
  maxTasks: number;             // default: 5
  maxBindings: number;          // default: 8
  maxDurationMinutes: number;   // default: 120
  lowEnergyThreshold: number;   // default: 2
}

// Session lifecycle v2 status — FR-09
type SessionStatusV2 = "prepared" | "running" | "paused" | "reviewing" | "completed" | "archived";
```

### Extended Session Interface (actual + planned)

```typescript
interface Session {
  // ... existing fields (id, type, title, status, timer, goals, notes, focusFile, notesFile, canvasFile, links, artifacts, timeline) ...
  activity: SessionActivity[];              // ✅ Delivered Inc 10
  activityFilter: string[];                 // ✅ Delivered Inc 10 (per-session folder exclusions)
  contextBindings: SessionContextBinding[]; // ✅ Delivered Inc 10
  decisions: SessionDecision[];             // ✅ Delivered Cycle 2 (FR-03)
  workspaceState: WorkspaceState | null;    // ✅ Delivered Cycle 3 (FR-06)
  outputArtifacts: SessionOutputArtifact[]; // ✅ Delivered Cycle 3 (FR-07)
  // v2 extensions
  intent: SessionIntent | null;             // 🔜 Planned FR-10
  energy: EnergyLevel | null;              // ✅ Done FR-11 (Cycle 8)
  executionTasks: ExecutionTask[];          // ✅ Done FR-12
  reflections: ReflectionEntry[];          // ✅ Done FR-13 (Cycle 8)
  closureResponse: ClosureResponse | null; // ✅ Done FR-14 (Cycle 7)
}
```

### Persistence

| Data | Storage | Lifecycle | Status |
|------|---------|-----------|--------|
| Activity log | Session state via TypedStorage | Cleared on archive | ✅ Delivered |
| Folder filters (global) | Settings via SettingsService | Permanent | ✅ Delivered |
| Folder filters (per-session) | Session state via TypedStorage | Per session | ✅ Delivered |
| Context bindings | Session state via TypedStorage | Per session | ✅ Delivered |
| Decisions | Session state via TypedStorage | Per session | ✅ Delivered (Cycle 2) |
| Session summary | Vault markdown file (notes file) | Permanent | ✅ Delivered (via notesFile) |
| Session type config | Settings via SettingsService | Permanent | ✅ Delivered (Cycle 2, `customSessionTypes`) |
| Workspace state | Session state via TypedStorage | Per session | ✅ Delivered (Cycle 3) |
| Output artifacts | Session state via TypedStorage | Per session | ✅ Delivered (Cycle 3) |
| Custom output templates | Settings via SettingsService | Permanent | ✅ Delivered (Cycle 3, `customOutputTemplates`) |
| Daily session config | Settings via SettingsService (`enableDailySession`, `dailyNotePath`) | Permanent | ✅ Delivered (Cycle 4) |
| Daily session ID | Session state via TypedStorage (`dailySessionId`) | Per vault session | ✅ Delivered (Cycle 4) |
| Nudge configs | Settings via SettingsService (`sessionNudges`) | Permanent | ✅ Delivered (Cycle 5) |

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

### Delivered Events (Cycle 2 — Decision Log + Session Types)

| Event | Trigger | Payload | FR |
|-------|---------|---------|-----|
| `session.decision.record` | User records decision | `{ sessionId, title, description?, context? }` | FR-03 |
| `session.decision.recorded` | Decision stored | `{ sessionId, decision: SessionDecision }` | FR-03 |
| `session.decision.remove` | User removes decision | `{ sessionId, decisionId: string }` | FR-03 |
| `session.decision.removed` | Decision removed | `{ sessionId, decisionId: string }` | FR-03 |
| `session.type.configure` | User configures type settings | `{ type, config: Partial<SessionTypeConfig> }` | FR-05 |
| `session.type.configured` | Type config updated | `{ type, config: SessionTypeConfig }` | FR-05 |
| `session.type.create` | User creates custom type | `{ config: SessionTypeConfig }` | FR-05 |
| `session.type.created` | Custom type created | `{ config: SessionTypeConfig }` | FR-05 |

### Delivered Events (Cycle 3 — State Restoration + Output Artifacts)

| Event | Trigger | Payload | FR |
|-------|---------|---------|-----|
| `session.state.save` | Pause/complete triggers save | `{ sessionId }` | FR-06 |
| `session.state.saved` | View captured workspace state | `{ sessionId, state: WorkspaceState }` | FR-06 |
| `session.state.restore` | Resume triggers restore | `{ sessionId, state: WorkspaceState }` | FR-06 |
| `session.state.restored` | State applied to workspace | `{ sessionId }` | FR-06 |
| `session.output.generate` | User requests output | `{ sessionId, template: SessionOutputTemplate }` | FR-07 |
| `session.output.generated` | Output file created | `{ sessionId, artifact: SessionOutputArtifact }` | FR-07 |

> **Note:** `session.summary.generate`/`session.summary.generated` removed from plan — summary generation is handled synchronously via `writeSessionSummary()` on `session.completed`, making dedicated events unnecessary.

### Delivered Events (Cycles 4+5 — Daily Auto-Session & Nudges)

| Event | Trigger | Payload | FR |
|-------|---------|---------|-----|
| `session.daily.start` | Vault open (auto) or manual | `{}` | FR-08 |
| `session.daily.started` | Daily session created + activated | `{ session: Session }` | FR-08 |
| `session.daily.stop` | Vault close or manual | `{}` | FR-08 |
| `session.daily.stopped` | Daily session completed | `{ session: Session }` | FR-08 |
| `session.daily.summary.generated` | Daily summary appended to note | `{ sessionId, path: string }` | FR-08 |
| `session.nudge.triggered` | Configured nudge time reached | `{ nudge: SessionNudge }` | FR-08 |
| `session.nudge.dismissed` | User dismisses nudge | `{ nudgeId: string }` | FR-08 |
| `session.nudge.accepted` | User accepts nudge | `{ nudgeId: string }` | FR-08 |

### Event Count Summary

| Source | Events |
|--------|--------|
| PBI-002 foundation (lifecycle, workspace, timer, artifact, goal, duration, notes, files, links) | 38 |
| Session Workspaces Inc 10 (activity, context) | 8 |
| Cycle 2 (decisions: 4, types: 4) | 8 |
| Cycle 3 (state: 4, output: 2) | 6 |
| Cycles 4+5 (daily: 5, nudges: 3) — *8 deprecated with FR-08* | 8 |
| Cycle 6 (v2 foundation: intent 3, energy 2, lifecycle 2, tasks 8, template 2) | 17 |
| Cycle 7 (notes sync: 3, closure: 2, goal reorder: 2) | 7 |
| Cycle 8 (energy command: 1, overload: 1, reflection commands + states: 4) | 6 |
| **Total session events (delivered)** | **98** |
| *Active (excluding 8 deprecated FR-08 events)* | *90* |

### Planned Events (v2 — remaining)

| Event | Trigger | Payload | FR |
|-------|---------|---------|-----|
| `session.intent.set` | User defines intent | `{ sessionId, intent: SessionIntent }` | FR-10 |
| `session.intent.updated` | User modifies intent | `{ sessionId, intent: SessionIntent }` | FR-10 |
| `session.mode.set` | User selects mode | `{ sessionId, mode: SessionMode }` | FR-10 |
| `session.energy.set` | Command: set energy level | `{ sessionId, level: EnergyLevel }` | FR-11 |
| `session.energy.changed` | User adjusts energy | `{ sessionId, before: EnergyLevel, after: EnergyLevel }` | FR-11 |
| `session.task.add` | Command: add task | `{ sessionId, label: string }` | FR-12 |
| `session.task.toggle` | Command: toggle task | `{ sessionId, taskId: string }` | FR-12 |
| `session.task.remove` | Command: remove task | `{ sessionId, taskId: string }` | FR-12 |
| `session.task.reorder` | Command: reorder tasks | `{ sessionId, taskIds: string[] }` | FR-12 |
| `session.task.added` | Task added to plan | `{ sessionId, task: ExecutionTask }` | FR-12 |
| `session.task.completed` | Task toggled complete | `{ sessionId, taskId: string }` | FR-12 |
| `session.task.removed` | Task removed from plan | `{ sessionId, taskId: string }` | FR-12 |
| `session.task.reordered` | Tasks reordered | `{ sessionId, taskIds: string[] }` | FR-12 |
| `session.reflection.add` | Command: add reflection | `{ sessionId, type, content }` | FR-13 |
| `session.reflection.remove` | Command: remove reflection | `{ sessionId, entryId }` | FR-13 |
| `session.reflection.added` | Reflection entry added | `{ sessionId, entry: ReflectionEntry }` | FR-13 |
| `session.reflection.removed` | Reflection entry removed | `{ sessionId, entryId: string }` | FR-13 |
| `session.review.started` | Timer reaches zero / manual | `{ sessionId }` | FR-09 |
| `session.closure.started` | Closure overlay shown | `{ sessionId }` | FR-14 |
| `session.closure.completed` | User completes closure | `{ sessionId, response: ClosureResponse }` | FR-14 |
| `session.overload.detected` | Thresholds exceeded | `{ sessionId, reasons: string[] }` | FR-16 |

| Status | Events | Notes |
|--------|--------|-------|
| Delivered (from planned table above) | 20 | intent (3), energy (2), tasks (8), reflection (4), closure (2), overload (1) |
| Remaining planned | 1 | `session.review.started` (FR-09 UI timer wiring) |
| **Total session events (delivered + planned)** | **99** |
| *Active (excluding deprecated)* | *91* |

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

### FR-03: Decision Log — ✅ Delivered (Cycle 2)

- [x] Record decisions with title and optional description during active sessions
- [x] Display decisions in a dedicated workspace panel (`SessionDecisionPanel`)
- [x] Remove decisions from the panel
- [x] Decisions persisted with session state (max 100 per session)
- [x] Decisions included in session summary on completion
- [x] Decisions carried through rerun and template flows
- [x] Backward compat: `decisions ??= []` in `load()`

> **Implementation note:** Delivered in Cycle 2 (PBI-SW-004). 4 decision events registered. `SessionDecisionPanel` follows the shared component pattern (`constructor(el, deps)`, `renderMaster()` + `renderDetail()`).

### FR-04: Session Summary — ✅ Delivered (Inc 8 + Cycle 2)

- [x] Generate a structured markdown file on session completion
- [x] Summary includes: metadata, goals (completed/total), artifacts, activity timeline, context bindings, time summary
- [x] Summary file stored in `SESSION_NOTES_FOLDER` alongside session notes
- [x] Summary includes decisions (unblocked by FR-03 delivery in Cycle 2)
- [x] ~~`summaryFile` field~~ — not needed; `notesFile` serves dual purpose via `mergeSessionNotes()`

> **Implementation note:** `generateSessionSummary()` + `writeSessionSummary()` delivered in Inc 8. Decisions section added in Cycle 2 after FR-03 delivery. Summary written to `notesFile` path with merge semantics (`mergeSessionNotes()` preserves user-added content).

### FR-05: Session Type Orchestration — ✅ Delivered (Cycle 2)

- [x] Session types define guiding questions, default duration, and icon
- [x] Guiding questions displayed in workspace during active/paused sessions
- [x] Pre-built types (8): Event Storming, Service Design, Requirements Refinement, Backlog Structuring, Knowledge Cleanup, Vault Hygiene, Documentation, Domain Design
- [x] Custom session type creation via settings (`customSessionTypes` in SettingsService)
- [x] Global folder filter configurable in settings (bundled from PBI-SW-001 remainder)

> **Implementation note:** Delivered in Cycle 2 (PBI-SW-003). `resolveTypeConfig()` helper resolves built-in + custom types. `SessionTypeConfig` stored in settings via Zod schema. Guiding questions rendered in workspace detail panel.

### FR-06: State Restoration — ✅ Delivered (Cycle 3)

- [x] On pause/complete: save workspace state (open files, active file)
- [x] On resume: restore saved workspace state
- [x] Graceful degradation if files have been moved/deleted since pause
- [x] 4 system events: `session.state.save/saved/restore/restored`
- [x] Backward compat: `workspaceState ??= null` in `load()`

> **Implementation note:** Delivered in Cycle 3 Inc 1 (PBI-SW-006). Architecture: Service emits `session.state.save` → View captures workspace via `app.workspace` → emits `session.state.saved` → Service persists. Reverse flow for restore. Domain stays pure (no Obsidian API).

### FR-07: Output Artifacts — ✅ Delivered (Cycle 3)

- [x] Generate typed output documents from completed sessions (meeting invite, action items, review summary)
- [x] 3 pre-built templates via `BUILT_IN_OUTPUT_TEMPLATES` constant
- [x] Pure function: `generateSessionOutput(session, template)` with 10 mustache placeholders
- [x] Output file created in `SESSION_NOTES_FOLDER` and linked to session notes via wikilink
- [x] `SessionOutputPanel` shows existing artifacts + "Generate Output" button (completed/archived only)
- [x] `SessionOutputPickerModal` for template selection (3 built-in + custom)
- [x] Custom output templates configurable in settings (`customOutputTemplates`)
- [x] Max 20 output artifacts per session (`MAX_OUTPUT_ARTIFACTS`)
- [x] Backward compat: `outputArtifacts ??= []` in `load()`

> **Implementation note:** Delivered in Cycle 3 Inc 2-3 (PBI-SW-008). 10 placeholders: `{{title}}`, `{{date}}`, `{{type}}`, `{{duration}}`, `{{goals}}`, `{{decisions}}`, `{{artifacts}}`, `{{context}}`, `{{overview}}`, `{{notes}}`.

### FR-08: Daily Auto-Session, Concurrent Tracking & Nudges — ✅ Delivered (Cycles 4+5) → ❌ Removed (v8)

- [x] New session type: `"daily-tracking"` — passive, no timer countdown (duration = 0), no goals, no guiding questions
- [x] `SessionState.dailySessionId` tracks daily session separately from `activeSessionId`
- [x] `getDailySession()` returns daily session; `getActiveSession()` unchanged (focused only)
- [x] Auto-start daily session on vault open when `enableDailySession` setting is enabled (default off)
- [x] Auto-stop daily session on plugin unload (vault close)
- [x] Concurrent session support: activity tracked in **both** daily and focused sessions simultaneously
- [x] Daily session uses 30s dedup window (`DAILY_ACTIVITY_DEDUP_WINDOW_MS`) for reduced noise
- [x] `generateDailySummary(session)` pure function — grouped markdown activity summary
- [x] Daily summary appended to daily note file on session stop (configurable `dailyNotePath` with `{{date:YYYY-MM-DD}}` placeholder)
- [x] Missing daily note handled gracefully (summary generated but not written)
- [x] Activity log aggregation: group file events by path (one row per file with latest action + edit count)
- [x] 5 daily events: `session.daily.start/started/stop/stopped`, `session.daily.summary.generated`
- [x] Backward compat: `state.dailySessionId ??= null` in `load()`
- [x] Session nudge system: `SessionNudge` type with `{ id, time, templateId, message, enabled }` (Cycle 5)
- [x] Nudge configuration in FlowtiSettingTab (add/edit/remove nudges) (Cycle 5)
- [x] Nudge triggers Notice with "Start" / "Dismiss" buttons (Cycle 5)
- [x] Pre-prepared sessions: nudges can reference a `SessionTemplate` for one-click start (Cycle 5)
- [x] Daily summary generation with activity grouping and session metrics (Cycle 5)
- [x] 3 nudge events: `session.nudge.triggered/dismissed/accepted` (Cycle 5)
- [x] Command palette: `flowti:create-session` and `flowti:resume-session` commands (Cycle 5 polish)
- [x] Dashboard quick action: "New Session" button on User Hub Dashboard (Cycle 5 polish)

> **Architecture note:** Daily session uses the existing Session entity with `type: "daily-tracking"`. No new entity types. Concurrent tracking is achieved by modifying `onActivityEvent()` to emit to both `activeSessionId` and `dailySessionId`. Settings use Zod schema defaults for zero-migration backward compat. Nudge scheduler uses `setInterval` with minute-level resolution, cleared on `onunload()`.

> **⚠ Removed in v8:** The daily-tracking feature (FR-08) has been removed from the Session v2 scope. Session v2 focuses on **intentional execution environments** — structured, outcome-driven sessions with closure discipline. Passive background tracking conflicts with this philosophy. The `daily-tracking` session type, `dailySessionId` state field, auto-start behavior, concurrent session routing, daily note integration, and nudge scheduler are deprecated. Related code (`DAILY_ACTIVITY_DEDUP_WINDOW_MS`, `getDailySession()`, `generateDailySummary()`, daily events) will be removed during v2 implementation. PBI-SW-007 status changed from "Done" to "Done → Removed". 5 daily events and 3 nudge events removed from active event count.

---

### FR-09: Session Lifecycle v2 — ✅ Done (Cycle 6, domain-first)

- [x] Introduce 6-state lifecycle: `prepared → running → paused → reviewing → completed → archived` *(Cycle 6 — `SessionStatusV2`, `VALID_TRANSITIONS` map, `isValidTransition()`)*
- [ ] `reviewing` state triggered automatically when timer reaches zero *(deferred — UI timer wiring, PBI-SW-017)*
- [x] `reviewing` → `completed` requires closure ritual completion or explicit skip *(FR-14, Cycle 7)*
- [x] State changes emit per-transition events: `session.started`, `session.paused`, `session.resumed`, `session.completed`, `session.archived` *(Cycle 6 — individual events preferred over generic `state.changed`)*
- [x] Backward compatible: existing `active` maps to `running`, existing `completed` unchanged *(Cycle 6 — UI compat accepts both)*
- [x] All state transitions validated (no skipping states, no invalid transitions) *(Cycle 6 — `isValidTransition()` pure function)*

### FR-10: Intent Layer — ✅ Done (Cycle 6, domain-first)

- [x] Primary Outcome field (required text, set before session start) *(Cycle 6 — `SessionIntent.primaryOutcome`, `handleSetIntent()`)*
- [x] Why this matters field (optional text) *(Cycle 6 — `SessionIntent.whyThisMatters`)*
- [x] Session Mode selector: Deep Work, Planning, Workshop, Review, Exploration *(Cycle 6 — `SessionMode` type, `handleSetMode()`)*
- [x] Intent editable in `prepared` and `paused` states *(Cycle 6 — state guard in handler)*
- [ ] Intent locked during `running` unless manually edited via explicit action *(deferred — UI enforcement, PBI-SW-017)*
- [ ] Intent visible in both Main and Sidebar modes *(deferred — PBI-SW-017)*
- [ ] Outcome immutability configurable per session type *(deferred — future enhancement)*

### FR-11: Energy Tracking — ✅ Done (Cycle 8 Inc 1)

- [x] 1–5 scale energy indicator (clickable) *(SessionEnergyIndicator component, ⚡ visual)*
- [x] User-adjustable during active session *(running/paused states, read-only in completed/archived)*
- [x] Changes emit `session.energy.changed` event with `{ before, after }` *(via session.energy.set command)*
- [ ] Energy level visible in Main and Sidebar modes *(Main done; Sidebar deferred — PBI-SW-017)*
- [x] Energy persisted with session state *(saveState() + note sync via scheduleSyncNotesFile())*
- [x] Energy changes logged in event timeline *(session.energy.changed emitted)*
- [x] Used for cognitive overload detection (FR-16) *(energy field available for threshold check)*

### FR-12: Execution Plan — ✅ Done (domain + UI delivered)

- [x] Checklist-based task list within sessions *(Cycle 7 Inc 1 — domain CRUD)*
- [x] Add/remove/toggle tasks in Main mode *(Cycle 7 Inc 2 — SessionExecutionPanel)*
- [x] Max recommended tasks: 5 (configurable threshold via `CognitiveLoadThresholds`)
- [x] Up/down arrow reorder in Main mode *(Cycle 7 Inc 2 — simpler alternative to DnD)*
- [x] Progress indicator: `getTaskProgress()` returns `{ completed, total, percent }` *(Cycle 7 Inc 1)*
- [x] Task completion emits `session.task.completed` event *(Cycle 7 Inc 1)*
- [ ] Sidebar: read-only with check/uncheck allowed, no adding or reordering *(deferred — PBI-SW-017)*
- [x] Tasks persist with session state *(Cycle 7 Inc 1)*
- [x] Task count feeds cognitive overload detection (FR-16)

### FR-13: Structured Reflection — ✅ Done (Cycle 8 Inc 3 + Inc 4)

- [x] 4 reflection categories: Observations, Blockers, Ideas, Decisions
- [x] Extends existing FR-03 Decision Log architecture
- [x] Each entry: `{ id, type, content, timestamp }`
- [x] Add/remove entries per category with state guards (running/paused only)
- [ ] Decisions can emit domain events and convert to decision records *(deferred)*
- [ ] Sidebar: collapsed summary view (expandable) *(deferred — PBI-SW-017)*
- [x] Reflections included in session summary (note sync) with category icons
- [x] Template threading: reflections saved/restored through rerun + template + import/export
- [ ] Backward compatible: existing `decisions[]` migrated to `reflections[]` with `type: "decision"` *(deferred — decisions coexist)*
- [x] UI panel rendering: `SessionReflectionPanel` with category-grouped entries, add form, remove button (Inc 4)

### FR-14: Closure Ritual System — ✅ Done (Cycle 7)

- [x] Triggered automatically when session enters `reviewing` state (`completeSession()` emits `session.closure.started`)
- [x] Overlay blocks main UI with configurable review questions (`SessionClosureOverlay` component)
- [x] Standard fields: Outcome achieved? (Yes/Partial/No), What worked?, What didn't?, Next action? (`DEFAULT_CLOSURE_TEMPLATE`)
- [x] 3-tier template inheritance: Global defaults → Session Type override → Instance override (`resolveClosureTemplate()`)
- [x] Completion of required fields required to submit (validation with visual error indicators). Skip option available.
- [ ] Follow-up actions: Convert to follow-up session, convert to backlog item, archive (deferred — standalone UX enhancement)
- [x] Closure responses persisted with session state (`closureResponse` field on `Session`)
- [ ] Global closure template configurable in settings (deferred — works via parameter passing)

### FR-15: Activity Intelligence — ✅ Done (Cycle 9)

- [x] Extends FR-01 Activity Log with computed analytics (`computeActivityIntelligence()` pure function)
- [x] Counters: files modified, artifacts produced, events emitted, tasks completed
- [x] Time analytics: wall clock, active time, paused time (from existing timeline data)
- [x] Compact stats row in workspace (`SessionActivityIntelligencePanel`, 67 LOC)
- [ ] Full analytics card in Main mode (deferred — Main/Sidebar differentiation via PBI-SW-017)
- [x] Data sourced from event stream and session state (no additional tracking)
- [x] Unified `### Activity Intelligence` section in session notes (replaces former Artifacts + Time Summary)
- [x] Artifact wiki-links inside Activity Intelligence section
- [x] Activity metrics in session note frontmatter (flat key:value pairs)
- [x] Closure ritual responses rendered as `### Closure Ritual` section in session notes
- [x] Global + per-session folder filters respected at render time via `isExcluded()` threading

### FR-16: Cognitive Overload Detection — ✅ Delivered (Cycle 8)

- [x] Threshold-based detection triggers:
  - [x] More than 5 execution tasks (configurable)
  - [x] More than 8 context bindings (configurable)
  - [x] Duration exceeds threshold (configurable)
  - [x] Low energy + high task complexity (compound)
- [x] Non-blocking warning rendered between ExecutionPanel and NotesPanel
- [x] Warning includes overload reasons and suggestion text
- [x] Warning dismissible
- [ ] Configurable thresholds in settings (`CognitiveLoadThresholds`) *(deferred — defaults hardcoded, settings UI via PBI-SW-017)*

### FR-17: Main/Sidebar Mode Separation — 🔜 Planned

- [ ] SessionMainView: full execution environment (all cards, all actions)
- [ ] SessionSidebarView: monitoring control surface (snapshots, toggle-only)
- [ ] State-based rendering rules per session state:
  - [ ] `prepared`: Main editable, Sidebar static snapshot
  - [ ] `running`: Main all cards active, Sidebar monitoring dashboard
  - [ ] `paused`: Main editable, Sidebar monitoring + resume indicator
  - [ ] `reviewing`: Main overlay replaces content, Sidebar "Review Required" status
  - [ ] `completed`: Main read-only, Sidebar compact summary
  - [ ] `archived`: Main read-only, Sidebar minimal meta only
- [ ] No add/create/template-editing buttons in Sidebar above fold
- [ ] Sidebar = Control Surface design principle enforced

### FR-18: Workshop Mode — 🔜 Planned

- [ ] When `session.mode === "workshop"`:
  - [ ] ExecutionCard label changes to "Agenda"
  - [ ] Task items may support duration per agenda item
  - [ ] Event timeline auto-expanded in Sidebar
  - [ ] Decision entries visually highlighted
- [ ] Workshop-specific guiding questions
- [ ] Facilitator-optimized layout (screen-share friendly)

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
- Decisions capped at 100 per session (`MAX_DECISIONS`)
- Context bindings capped at 10 per session (`MAX_CONTEXT_BINDINGS`)
- Output artifacts capped at 20 per session (`MAX_OUTPUT_ARTIFACTS`)

---

## 12. UI Concept

### v1 Layout (delivered — SessionWorkspaceView)

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

### v2 UI Composition Map (planned)

Session v2 has two rendering modes:

```
SessionView
 ├── SessionMainView      (full execution environment)
 └── SessionSidebarView   (monitoring control surface)
```

#### Main Workspace Mode

```
SessionMainView
 ├── SessionHeader         (title, type badge, state badge, meta, controls)
 ├── IntentCard            (primary outcome, why, mode selector)
 ├── TimerEnergyCard       (countdown, energy 1-5, controls)
 ├── ExecutionCard         (task checklist, progress bar, add/reorder)
 ├── ContextIntelligenceCard (bound entities, metadata, quick preview)
 ├── ReflectionCard        (observations, blockers, ideas, decisions)
 ├── ActivityIntelligenceCard (files, tasks, events, time analytics)
 ├── CognitiveLoadAlert    (conditional — threshold exceeded)
 └── SessionClosureOverlay (conditional — reviewing state, FR-14 ✅)
```

#### Sidebar Companion Mode

```
SessionSidebarView
 ├── SidebarStatusHeader   (state, remaining time, energy, progress)
 ├── SidebarIntentSnapshot (primary outcome, mode badge — read-only)
 ├── SidebarExecutionSnapshot (compact task list, toggle allowed)
 ├── SidebarContextSnapshot (compact context cards — collapsed)
 ├── SidebarActivitySnapshot (one-line metrics: files, tasks, events)
 └── SidebarEventTimeline  (collapsible event log)
```

#### State-Based Rendering Rules

| State | Main Mode | Sidebar Mode |
|-------|-----------|--------------|
| prepared | Editable intent & tasks | Static snapshot |
| running | All cards active | Monitoring dashboard |
| paused | Editable | Monitoring + Resume indicator |
| reviewing | Overlay replaces content | Status shows "Review Required" |
| completed | Read-only | Compact summary |
| archived | Read-only | Minimal meta only |

#### Interaction Zones

**Zone A — Above the Fold (Main):** Intent, Timer + Energy, Execution progress
**Zone B — Mid Focus:** Execution tasks, Context bindings
**Zone C — Deep Reflection:** Reflection categories, Activity intelligence

**Sidebar Above Fold:** Only State, Timer, Energy, Progress

#### Design Principles

- Outcome before time
- Sidebar is monitor, not workspace
- Reflection is structured, not free-text chaos
- Overlays for transitions, not hidden state
- Progressive disclosure for complexity
- No action clutter above the fold

---

## 13. Product Backlog Items

| Rank | PBI | Title | Priority | Depends On | Status |
|------|-----|-------|----------|------------|--------|
| — | PBI-SW-001 | Activity Log & Folder Filtering | High | PBI-002 (foundation) | ✅ Done (Inc 10) |
| — | PBI-SW-002 | Context Bindings | High | PBI-SW-001 | ✅ Done (Inc 10) |
| — | PBI-SW-003 | Session Types & Orchestration | High | PBI-SW-001 | ✅ Done (Cycle 2) — 8 built-in types, guiding questions, custom types, global filter settings |
| — | PBI-SW-004 | Decision Log | Medium | — | ✅ Done (Cycle 2) — structured decisions, workspace panel, summary integration |
| — | PBI-SW-005 | Session Summary | Low | PBI-SW-001, PBI-SW-004 | ✅ Done (Inc 8 + Cycle 2) — decisions section completed after SW-004 delivery |
| — | PBI-SW-006 | State Restoration | Low | — | ✅ Done (Cycle 3) — workspace state save/restore on pause/resume |
| — | PBI-SW-008 | Session Output Artifacts | Low | PBI-SW-005 | ✅ Done (Cycle 3) — 3 built-in templates, custom templates, picker modal |
| — | PBI-SW-007 | Auto-Session & Session Nudges | Medium | — | ✅ Done (Cycles 4+5) — daily tracking, concurrent sessions, auto-start, nudges, daily summary, command palette, dashboard quick action |
| 1 | PBI-SW-009 | Domain Design Session | Medium | PBI-SW-003 | 🔜 Planned (Cycle 7+) — guided domain decomposition workflow (SW-003 unblocked) |
| 2 | PBI-SW-010 | Session Lifecycle v2 & Intent Layer | High | — | ✅ Done (Cycle 6) — v2 state machine + intent + energy handlers (domain-first) |
| 3 | PBI-SW-011 | Energy Tracking | Medium | PBI-SW-010 | ✅ Done (Cycle 8 Inc 1) — SessionEnergyIndicator component, session.energy.set command, note sync, 20 tests |
| 4 | PBI-SW-012 | Execution Plan (Task Checklist) | High | — | ✅ Done (Cycle 7) — domain CRUD (Inc 1), UI panel + progress bar + reorder (Inc 2) |
| 5 | PBI-SW-013 | Structured Reflection | Medium | FR-03 (delivered) | ✅ Done (Cycle 8 Inc 3 + Inc 4) |
| 6 | PBI-SW-014 | Closure Ritual System | High | PBI-SW-010 | ✅ Done (Cycle 7) — configurable review overlay |
| 7 | PBI-SW-015 | Activity Intelligence | Low | FR-01 (delivered) | ✅ Done (Cycle 9 Inc 3) — computed analytics, unified session note, frontmatter metrics, filter respect |
| 8 | PBI-SW-016 | Cognitive Overload Detection | Low | — | ✅ Done (Cycle 8 Inc 2) — pure detection + non-blocking alert |
| 9 | PBI-SW-017 | Main/Sidebar Mode Separation | High | PBI-SW-010 | 🔜 Planned — workspace vs. control surface |
| 10 | PBI-SW-018 | Session Preparation Checklist | Medium | PBI-SW-010 | 🔜 Discovery — guided pre-session workflow |
| 11 | PBI-SW-019 | Session Auto-Documentation | Medium | PBI-SW-001 | 🔜 Discovery — auto-link artifacts on file events |

> **Cross-delivery:** PBI-SW-001 and PBI-SW-002 were delivered together in PBI-002 Increment 10 (Sidebar Workspace & Activity Consolidation). PBI-SW-003 and PBI-SW-004 were delivered together in Cycle 2 (Session Types and Decision Log). PBI-SW-006 and PBI-SW-008 were delivered together in Cycle 3 (Session Output Artifacts and State Restoration). PBI-SW-007 was delivered across Cycles 4+5 (core daily session in Cycle 4; nudges, daily summary, and UX polish in Cycle 5).

> **v8 change — Daily tracking removed:** PBI-SW-007 (Auto-Session & Session Nudges) has been deprecated. The daily-tracking session type, auto-start, concurrent session support, daily note integration, and nudge system conflict with Session v2's philosophy of intentional execution environments. The `daily-tracking` session type, `dailySessionId`, `getDailySession()`, `generateDailySummary()`, nudge scheduler, and 8 related events (5 daily + 3 nudge) will be removed during v2 implementation. PBI-SW-007 status: Done → Removed.

> **Remaining backlog:** 5 PBIs planned (PBI-SW-009, SW-015, SW-017, SW-018, SW-019). 6 v2 PBIs delivered: SW-010 (Cycle 6), SW-012 + SW-014 (Cycle 7), SW-011 + SW-013 + SW-016 (Cycle 8). 7/8 v1 PBIs remain valid (SW-001 through SW-006, SW-008).

> **Priority ranking** (remaining delivery order by value): PBI-SW-017 (Main/Sidebar Mode Separation) → PBI-SW-009 (Domain Design Session). **Rationale:** SW-017 is the major UI architecture change (large, unblocked by TD-101 completion); SW-009 deferred (depends on Workshop mode patterns from FR-18). TD-101 resolved (Cycle 9 Inc 1). PBI-SW-015 resolved (Cycle 9 Inc 3).

> **Inbox triage (2026-02-20):** 2 new PBIs added from inbox:
> - PBI-SW-018 (Session Preparation Checklist) — guided pre-session workflow from [[Session preparation checklist as guided pre-session workflow]]. Discovery stage, depends on SW-010.
> - PBI-SW-019 (Session Auto-Documentation) — auto-link artifacts on file events from [[Session auto-documentation links artifacts on file events]]. Discovery stage, depends on SW-001.
> - Related design documents moved from inbox: [[Sessions Service Design Blueprint]], [[Sessions User Flow]]

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
| 7 — Implementation | In-Progress | 2026-02-21 | v1: FR-01–FR-08 delivered (Cycles 2–5). v2: FR-09–FR-16 delivered (Cycles 6–9). 16/18 FRs complete. 14/17 PBIs delivered. Cycle 9 in-progress (TD-101 + TD-100 resolved, FR-15 delivered). |
| 8 — Review | In-Progress | 2026-02-19 | Three Amigos review Cycle 8 (2026-02-19): PASS with 5 observations, 3 action items. FRI 30/35. 2,768 tests. |
| 9–10 | Pending | — | Remaining: FR-17 (Main/Sidebar — post Cycle 9), FR-18 (Workshop Mode — deferred) |

### Stage History

| Date | From | To | Gate | FRI | Reviewer | Notes |
|------|------|----|------|-----|----------|-------|
| 2026-02-17 | — | draft | — | — | — | PRD v2 created with L2 scope, 6 FRs, 16 events, 6 PBIs |
| 2026-02-17 | draft | approved | Design Gate + Readiness Gate | 29/35 | Technical Architect | Technical Review: Pass. Technically Ready. No follow-ups required |
| 2026-02-18 | approved | in-progress | — | 29/35 | — | FR-01 (Activity Log) + FR-02 (Context Bindings) delivered via PBI-002 Inc 10. FR-04 (Summary) partially delivered. 9 new events registered. 3 ADRs accepted (025 superseded, 026 accepted, 029 proposed). |
| 2026-02-18 | in-progress | in-progress | Backlog Refinement | 29/35 | — | PRD v4. PBI-SW-001/002 closed. PBI-SW-003 promoted to High (bundles global filter, enables SW-009). PBI-SW-005 updated to In Progress (partial). 3 new PBIs: SW-007, SW-008, SW-009. |
| 2026-02-18 | in-progress | in-progress | Cycle 2 Delivery | 29/35 | — | Cycle 2 delivered: PBI-SW-003 (Session Types), PBI-SW-004 (Decision Log), PBI-SW-005 (Summary complete). FR-03, FR-04, FR-05 all delivered. 54 session events. |
| 2026-02-18 | in-progress | in-progress | Cycle 3 Delivery + Three Amigos | 33/35 | Business, Dev, QA | PRD v5. Cycle 3 delivered: PBI-SW-006 (State Restoration), PBI-SW-008 (Output Artifacts). FR-06, FR-07 delivered. 60 session events. FRI updated: architecture 4→5, data_model 4→5, ui_consistency 3→4, validation_testing 3→4. 2,318 tests, 90 files. |
| 2026-02-18 | in-progress | in-progress | Cycle 4 Planning + Backlog Refinement | 33/35 | — | PRD v6. FR-08 (Daily Auto-Session) added as planned. PBI-SW-007 scoped for Cycle 4 (core: daily tracking + concurrent sessions + daily note; nudges deferred). PBI-SW-009 deferred to Cycle 5+. 65 inbox items reviewed and normalized. Activity log aggregation bundled with TD-01 extraction. |
| 2026-02-18 | in-progress | in-progress | Cycle 4 Delivery | 33/35 | — | Cycle 4 delivered: PBI-SW-007 core (daily-tracking type, concurrent sessions, auto-start, daily note integration, activity log aggregation). FR-08 partially delivered. 2,440 tests, 95 files. |
| 2026-02-18 | in-progress | in-progress | Cycle 5 Delivery + Session UX Polish | 34/35 | — | PRD v7. Cycle 5 delivered: PBI-SW-007 complete (nudge system, daily summary, default nudge configs, dashboard indicator). Session UX polish: command palette commands (`create-session`, `resume-session`), dashboard "New Session" quick action. FR-08 fully delivered. 8/8 FRs, 8/9 PBIs done. 68 session events. FRI updated: validation_testing 4→5 (2,507 tests, 99 files, 13 flow tests). |
| 2026-02-19 | in-progress | in-progress | Three Amigos Review (Cycles 4+5) | 34/35 | Business, Dev, QA | PASS with 5 observations. All 3 perspectives agree: feature production-ready. OBS: (1) PBI-SW-009 scope decision needed, (2) nudge flow test gap, (3) path reconciliation edge cases, (4) daily tracking disable toggle, (5) Cycle 6 increment ordering. 6 action items logged. |
| 2026-02-19 | in-progress | in-progress | Backlog Refinement (v2) | 22/35 | — | PRD v8: Session v2 – Focus & Execution Environment. **Added:** Executive Summary (strategic purpose, business impact, strategic positioning), 10 new FRs (FR-09–FR-18), 8 new PBIs (SW-010–SW-017), v2 data model (9 new types), v2 event model (14 new events), v2 UI Composition Map (Main + Sidebar modes), Section 16 (Business Value), Section 17 (Strategic Perspective). **Removed:** Daily tracking feature (FR-08, PBI-SW-007 deprecated) — conflicts with intentional execution philosophy. FRI re-scored 34→22 to reflect undelivered v2 scope. Cycle 6 revised: Inc 3–4 replaced with v2 foundation work. |
| 2026-02-19 | in-progress | in-progress | Cycle 6 Delivery | 26/35 | — | Cycle 6 delivered: Inc 1 (template import/export), Inc 2 (Three Amigos gaps pre-satisfied), Inc 3 (ADR-031, v2 types, state machine, 14 events registered), Inc 4 (PBI-SW-010 domain-first: lifecycle v2, intent, energy handlers). FRI updated: architecture 3→4, event_integration 3→4, data_model 3→4, validation_testing 2→3. 2,540 tests passing, 102 suites. `"active"` → `"running"` canonical status migration with backward compat. |
| 2026-02-19 | in-progress | in-progress | Cycle 7 Planning | 26/35 | — | Cycle 7 planned: PBI-SW-012 (Execution Plan — domain + UI), PBI-SW-014 (Closure Ritual — domain + UI), PBI-SW-016 (Cognitive Overload Detection — spike). 4 increments. Inbox hygiene completed (both inboxes normalized). Feature Lifecycle PRD deferred (stays approved, no planning yet). |
| 2026-02-19 | in-progress | in-progress | Cycle 7 Inc 1 — Execution Plan Domain | 26/35 | — | PBI-SW-012 Part 1 delivered: task CRUD (`addTask`, `toggleTask`, `removeTask`, `reorderTasks`), state guards, `getTaskProgress()` helper, template/rerun threading, 8 new events (4 commands + 4 state). `tasks?: string[]` added to `SessionTemplate`. 36 new tests, 2,576 total. Deviation: command/state event split added to avoid infinite listener loops (follows goal event pattern). SessionService ~1,420 LOC (+120). |
| 2026-02-19 | in-progress | in-progress | Cycle 7 Inc 2 — Execution Plan UI | 26/35 | — | PBI-SW-012 Part 2 delivered: `SessionExecutionPanel` component (task checklist + progress bar + up/down reorder + add input). Integrated into `SessionWorkspaceView` between goals and notes. 4 new task event subscriptions in `SessionWorkspaceSubscriptions`. Up/down arrows chosen over drag-and-drop (simpler, more accessible). PBI-SW-012 **Done**. 26 new tests, 2,602 total, 104 suites. |
| 2026-02-19 | in-progress | in-progress | Cycle 7 Inc 2.5 — Note Sync + Templates | 26/35 | — | User-reprioritized increment: debounced session note sync (2.5s) wired to 17 handlers (goals, tasks, decisions, context, notes, lifecycle). `generateSessionSummaryBody()` extended with Execution Plan section. `SessionTemplate` extended with `contextBindings` and `notes` fields — threaded through create/save/rerun/export/import. 2 new events (`session.notes.synced`, `session.notes.syncFailed`). `SESSION_NOTES_SYNC_DELAY_MS = 2500` constant. 28 new tests, 2,628 total, 105 suites. |
| 2026-02-19 | in-progress | in-progress | Cycle 7 Inc 2.5b — Reverse Sync + UX Polish | 27/35 | — | Reverse note sync (note file → session state): `reverseParseSessionNotes()`, `computeReverseSyncDiff()`, content-based sync loop prevention. Workspace subscribes to `session.notes.reverseSynced`. Conditional forward sync (toggles-only = no rewrite). Session note reorder: Guiding Questions → Goals → Execution → Notes → Decisions → Context → Artifacts → Timeline → Time. Goals sortable (2 new events). Horizontal reorder buttons. Copy-to-clipboard for note path. Focus file wikilink in note body. Auto-open workspace on `session.created`. Full template field threading (`tasks`, `decisions`, `contextBindings`, `notes`) through `session.create` event + modal + all emit sites. ISO date prefix on note filenames (ADR-029 implemented). Notes file written at creation. 32 new tests, 2,660 total, 105 suites. |
| 2026-02-19 | in-progress | in-progress | Cycle 7 Inc 3 — Closure Ritual | 28/35 | — | PBI-SW-014 delivered: `completeSession()` now stops at "reviewing" state (was passthrough). `completeClosure(id, response)` saves `ClosureResponse` and transitions to completed. `skipClosure(id)` bypasses ritual. `finishReview()` gated on non-null closureResponse. `DEFAULT_CLOSURE_TEMPLATE` (4 questions). `resolveClosureTemplate()` 3-tier inheritance. `SessionClosureOverlay` UI component (~130 LOC) renders in reviewing state. `closureTemplate` added to `SessionTypeConfig`. `transitionToCompleted()` extracted as shared private method. FRI updated: validation_testing 3→4. 27 new tests, 2,687 total, 106 suites. FR-14 **Done**. |
| 2026-02-19 | in-progress | in-progress | Cycle 8 Inc 1 — Energy Tracking UI | 29/35 | — | PBI-SW-011 delivered: `session.energy.set` command event + catalog entry. `SessionEnergyIndicator` component (~90 LOC) — clickable 1–5 scale with ⚡ visual, editable in running/paused, read-only otherwise. Integrated into SessionWorkspaceView between timer and guiding questions. Energy subscription wired in SessionWorkspaceSubscriptions. Energy level added to `generateSessionSummaryBody()` for note sync. FRI updated: ui_consistency 2→3. 20 new tests, 2,707 total, 107 suites. FR-11 **Done**. |
| 2026-02-19 | in-progress | in-progress | Cycle 8 Inc 2 — Cognitive Overload Detection | 30/35 | — | PBI-SW-016 delivered: `detectCognitiveOverload()` pure function in helpers (~40 LOC) — checks 4 thresholds (tasks, bindings, duration, compound energy+tasks). `OverloadResult` + `DEFAULT_COGNITIVE_LOAD_THRESHOLDS` types. `CognitiveLoadAlert` component (~80 LOC) — non-blocking warning banner with reason list, suggestion, dismissible. `checkCognitiveOverload()` in SessionService — deduped emission via reason-key comparison, wired to 5 handlers (addTask, removeTask, contextBind, contextUnbind, energyChange). `session.overload.detected` subscription in workspace. FRI updated: validation_testing 4→5. 26 new tests, 2,733 total, 108 suites. FR-16 **Done**. |
| 2026-02-19 | in-progress | in-progress | Cycle 8 Inc 3 — Structured Reflection Domain | 30/35 | — | PBI-SW-013 Part 1 delivered: `session.reflection.add`/`remove` command events + catalog entries. `handleReflectionAdd()`/`handleReflectionRemove()` handlers in SessionService with state guards (running/paused only). Reflections section added to `generateSessionSummaryBody()` with category icons (👁🚫💡⚖️). Template threading: `reflections` field on `SessionTemplate`, threaded through `saveTemplateFromSession`, `rerunSession`, `createFromTemplate`, `handleCreate`, `exportTemplate`. `session.create` event payload extended. 15 new tests, 2,748 total, 108 suites. FR-13 domain **Done**. |
| 2026-02-19 | in-progress | in-progress | Cycle 8 Inc 4 — Structured Reflection UI | 30/35 | — | PBI-SW-013 Part 2 delivered: `SessionReflectionPanel` component (~130 LOC) — category-grouped entries with Lucide icons (eye, alert-circle, lightbulb, scale), add form with category dropdown + text input, remove button per entry, read-only in completed/archived. Integrated into `SessionWorkspaceView` between decisions and activity. 2 reflection event subscriptions wired in `SessionWorkspaceSubscriptions`. PBI-SW-013 **Done**. FR-13 fully **Done**. 20 new tests, 2,768 total, 109 suites. |
| 2026-02-19 | in-progress | in-progress | Three Amigos Review (Cycle 8) | 30/35 | Business, Dev, QA | PASS with 5 observations, 3 action items. AI-1: TD-101 promoted to required for Cycle 9. AI-2: PRD priority ranking updated. AI-3: MAX_REFLECTIONS guard planned for Cycle 9 Inc 4. OBS: SessionService 1,729 LOC, inline styles, decisions/reflections coexistence, no reflection integration test. |
| 2026-02-20 | in-progress | in-progress | Cycle 9 Pre-Cycle Hotfixes | 30/35 | — | 3 bugs fixed: activity log display-time filtering (8 new tests), session title disambiguation (1 test), closure review auto-open on `session.closure.started`. SessionService grew to 1,766 LOC. Cycle 9 planned: TD-101 handler extraction + TD-100 performance + PBI-SW-015 Activity Intelligence + hardening. DoR check: PASS. 2,794 tests, 110 suites. |
| 2026-02-19 | in-progress | in-progress | Cycle 8 Closure + Three Amigos | 30/35 | Business, Dev, QA | **PASS** with 5 observations, 3 action items. Cycle 8 delivered: 4/4 planned increments, 3 PBIs done (SW-011, SW-013, SW-016), 3 FRs done (FR-11, FR-13, FR-16). 81 new tests, 2,768 total, 109 suites. TD-101 stretch deferred (SessionService at 1,729 LOC — extract required for Cycle 9). AI-1: promote TD-101 to required. AI-2: priority ranking updated. AI-3: add MAX_REFLECTIONS guard. v2 status: 7/10 FRs, 6/8 PBIs delivered. |
| 2026-02-19 | in-progress | in-progress | Full Audit + Cycle 9 Planning | 30/35 | — | Full plugin audit: 17 drift points found and fixed. **Critical:** TD-092 phantom resolved — actual TD-92 = "No pull-request process"; created TD-101 for SessionService extraction. All TD-092 refs across 5 docs updated to TD-101. TD-54/TD-55 marked resolved (BaseHubView Phase 12). Frontend Architecture reconciled (17 session components, 28 subscriptions, 90 session events, 109 suites, 2,768 tests). Cycle 9 planned: TD-101 (required) + TD-100 (investigation) + PBI-SW-015 (Activity Intelligence) + hardening. 4 increments. |
| 2026-02-21 | in-progress | in-progress | Cycle 9 Inc 3 — Activity Intelligence | 31/35 | — | PBI-SW-015 delivered (FR-15 Done): `computeActivityIntelligence()` pure function, `SessionActivityIntelligencePanel` component (67 LOC), unified `### Activity Intelligence` section in session notes (replaces Artifacts + Time Summary), artifact wiki-links, `### Closure Ritual` section in session notes, `SessionFrontmatter` restructured (`type: "SessionNote"`, flat activity metrics), `isExcluded()` filter threading through all note generation. FRI updated: ui_consistency 3→4. 60 new tests, 2,849 total, 111 suites. TASM: 33/35 (Excellent). |

### Related Architecture Decisions

| ADR | Title | Status | Relevance |
|-----|-------|--------|-----------|
| ADR-025 | Activity Log Separate from Artifacts | Superseded | Activity consolidated into unified log; artifacts section removed |
| ADR-026 | Composable Folder Filtering | Accepted | `isExcluded()` pure function for global + per-session folder filtering |
| ADR-029 | ISO Date Prefix for Session Files | Accepted | Session notes file naming convention — implemented in Cycle 7 Inc 2.5b |
| ADR-031 | Session v2 Architecture | Accepted | 6-state lifecycle, dual rendering, closure ritual, intent layer, energy tracking |

### Related Flows

| Flow | Status | Scope |
|------|--------|-------|
| [[Create and Manage Sessions]] | Done | v1 session lifecycle — create, configure, track, pause, complete, output |
| [[Run Intentional Session]] | Planned | v2 session lifecycle — intent, execution, energy, reflection, closure ritual |
| [[Monitor Session from Sidebar]] | Planned | v2 sidebar companion — monitoring control surface while working in main |

---

## 15. Future Extensions (L4 — Collaboration & Intelligence)

The following capabilities are documented for future maturity levels and explicitly excluded from current scope:

- **Multi-user sessions** — participant registry, invite/join flow
- **Real-time collaboration** — shared workspace state, live cursor sync
- **Role-based access** — facilitator, participant, observer roles
- **AI-assisted reflection** — automated pattern detection from reflections
- **Energy analytics dashboard** — historical energy tracking across sessions
- **Team session mode** — multi-participant sessions with shared state
- **Workshop timer per agenda item** — individual agenda item countdown
- **Auto session splitting suggestions** — AI-driven session scope recommendations
- **Decision quality scoring** — structured evaluation of decision outcomes
- **Session maturity model** — progressive capability levels per session type
- **Pattern detection** — recurring blocker/idea identification across sessions

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
