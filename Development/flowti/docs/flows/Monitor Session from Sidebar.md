---
type: Flow
domain: Flowti
stage: planned
description: Session v2 sidebar companion flow — monitor session progress, energy, and activity while working in Canvas or other main content. Compact control surface with limited actions.
domains:
  - Session
services:
  - SessionService
events:
  - session.activity.tracked
  - session.task.completed
  - session.energy.changed
  - session.review.started
  - session.pause
  - session.paused
  - session.resume
  - session.resumed
tags:
  - session
  - session-v2
---

# Monitor Session from Sidebar

## Overview

The Sidebar Companion flow describes how a user monitors an active session while working in the main Obsidian window (typically Canvas, a PRD, or code). The sidebar acts as a **control surface** — showing status, progress, and activity snapshots — without duplicating the full execution environment.

This flow is central to Session v2's dual-rendering architecture (FR-17): **Main = workspace, Sidebar = monitor**.

## Personas

| Persona | Primary Use Case |
|---------|-----------------|
| Domain Architect | Canvas work with session monitoring |
| Workshop Facilitator | Screen-sharing Canvas while tracking agenda in sidebar |
| Engineer | Code editing with sidebar progress tracking |

## Trigger

User opens a session in the Obsidian sidebar panel while working in the main view area (Canvas, note, code, etc.).

## Steps

### 1. Open Session in Sidebar

- **View/Service**: SessionSidebarView
- **User Action**: User opens the session sidebar panel (via command palette, sidebar icon, or drag-to-sidebar)
- **System Response**: `SessionSidebarView` renders compact snapshots based on the current session state. Components displayed:
  - **SidebarStatusHeader**: state badge, remaining time, energy level, progress bar
  - **SidebarIntentSnapshot**: primary outcome text, mode badge (read-only)
  - **SidebarExecutionSnapshot**: compact task list with checkboxes
  - **SidebarContextSnapshot**: collapsed context binding cards
  - **SidebarActivitySnapshot**: one-line metrics (files modified, tasks completed, events emitted)
  - **SidebarEventTimeline**: collapsible event log
- **Design Principle**: No add/create/configure buttons above the fold. Sidebar = monitor, not workspace

### 2. Work in Main View

- **View/Service**: Canvas / Note Editor / Code Editor (main)
- **User Action**: User works normally — editing canvas nodes, writing notes, modifying code
- **System Response**: File events are tracked by EventBridge → SessionService. The sidebar updates in real-time:
  - Files modified counter increments
  - Event emitted counter increments
  - Event timeline gains new entries
  - Activity snapshot refreshes

### 3. Toggle Task Completion (Sidebar Action)

- **View/Service**: SessionSidebarView (SidebarExecutionSnapshot)
- **User Action**: User checks/unchecks execution tasks directly from the sidebar
- **System Response**: Task state toggles. Progress bar and `completedTasks / totalTasks` indicator update. This is the primary action allowed in the sidebar execution view
- **Events**: `session.task.completed`
- **Note**: Adding, removing, and reordering tasks is only available in Main mode

### 4. Adjust Energy (Sidebar Action)

- **View/Service**: SessionSidebarView (SidebarStatusHeader)
- **User Action**: User clicks energy indicator (1–5 scale) to adjust current energy level
- **System Response**: Energy level updates on session state. If energy drops below threshold with high task count, cognitive overload detection may trigger in Main mode
- **Events**: `session.energy.changed`

### 5. Monitor Activity Stream

- **View/Service**: SessionSidebarView (SidebarEventTimeline)
- **User Action**: User expands the event timeline to see recent activity
- **System Response**: Timeline shows chronological event entries. In Workshop mode, the timeline is auto-expanded. Decision entries are visually highlighted
- **Interaction**: Timeline is collapsible — collapsed by default in Deep Work, expanded in Workshop mode

### 6. Timer Expiry — Review Required

- **Trigger**: Session timer reaches zero
- **System Response**: Sidebar displays **"Review Required"** status badge in the SidebarStatusHeader. The session has entered `reviewing` state. The sidebar does NOT show the closure overlay — that renders only in Main mode
- **User Action**: User switches to Main mode to complete the closure ritual (SessionClosureOverlay). The user may complete the closure questions or skip the ritual entirely
- **Events**: `session.closure.started`

### 7. Pause / Resume from Sidebar

- **View/Service**: SessionSidebarView (SidebarStatusHeader)
- **User Action**: User clicks Pause/Resume controls in the sidebar header
- **System Response**: Session transitions `running` → `paused` or `paused` → `running`. Timer stops/starts. Workspace state saved/restored
- **Events**: `session.pause` → `session.paused` / `session.resume` → `session.resumed`

---

## State-Based Sidebar Rendering

| Session State | Sidebar Rendering |
|---------------|-------------------|
| prepared | Static snapshot — intent, tasks, context (all read-only) |
| running | Monitoring dashboard — live counters, task toggle, energy, timeline |
| paused | Monitoring + Resume indicator — "Session Paused" badge, resume button |
| reviewing | "Review Required" status — prompt to switch to Main |
| completed | Compact summary — outcome, stats, closure response summary |
| archived | Minimal meta only — title, type, date, outcome |

## Sidebar Above-the-Fold Content

Only essential information appears above the fold:

```
+------------------------------------------+
| [State: Running] [25:14] [Energy: ●●●○○] |
| Progress: ████████░░ 3/5 tasks           |
+------------------------------------------+
```

Everything else (intent snapshot, task list, context, activity, timeline) is below the fold or collapsed.

## Workshop Mode Sidebar

When `session.mode === "workshop"`:

- Event timeline is **auto-expanded** (facilitator needs to see live activity)
- Decision entries are **visually highlighted** (important for workshop outcomes)
- ExecutionSnapshot label shows "Agenda" instead of "Tasks"
- Energy indicator acts as a **group energy proxy** (facilitator sets on behalf of group)

Typical setup: Facilitator shares Canvas in main view, keeps sidebar visible for agenda tracking and decision capture.

## Constraints

- Sidebar must work both as standalone panel and as Obsidian sidebar leaf
- Rendering must be < 16ms (debounced via `scheduleRender()`)
- No add/create/configure buttons in sidebar above fold
- Closure overlay renders ONLY in Main mode — sidebar prompts switch to Main
- Sidebar reuses `SessionWorkspaceSubscriptions.ts` for event wiring (shared with Main)

## Events Sequence

```
[Session Running in Sidebar]
    → [User works in Canvas] → session.activity.tracked (repeated, sidebar updates)
    → [Toggle task] → session.task.completed (sidebar action)
    → [Change energy] → session.energy.changed (sidebar action)
    → [Pause] → session.pause → session.paused (sidebar action)
    → [Resume] → session.resume → session.resumed (sidebar action)
    → [Timer expires] → session.review.started
        → Sidebar shows "Review Required"
        → User switches to Main for closure ritual
```

## Related Decisions

- [[ADR-031 Session v2 Architecture]] — dual rendering (Main workspace + Sidebar monitor), 6-state lifecycle
- [[ADR-024 BaseHubView Shell Extraction]] — sidebar reuses hub shell patterns (debounced render, unsubscribe cleanup)
- [[ADR-032 Plugin State and Vault Metadata Reconciliation]] — session notes sync while monitoring from sidebar

## Known Debt

- [[TD-101 SessionService Handler Extraction]] — must complete before implementing PBI-SW-017 sidebar mode
- [[TD-100 Session performance and sync behaviour investigation]] — sidebar rendering performance under high activity

## Learnings

- [[L-22 Every major event domain needs a flow doc]] — sidebar companion deserves its own flow (not just a subsection of Run Intentional Session)

## Related

- [[Run Intentional Session]] — main v2 session flow (all phases)
- [[Create and Manage Sessions]] — v1 session flow (foundation)
- [[Session Workspaces PRD]] (FR-17: Main/Sidebar Mode Separation)
- [[PBI-SW-017 Main Sidebar Mode Separation]]
- [[PBI-SW-010 Session Lifecycle v2 and Intent Layer]]
