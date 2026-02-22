---
type: Idea
stage: delivered
delivered_in: Cycle 6
origin: inbox
domain: session
parent: "[[Session Workspaces PRD]]"
description: "Service Design Blueprint for Session v2 — 5 phases (Preparation, Execution, Monitoring, Review, Post-Processing), 4 layers (User Actions, Frontstage, Backstage, Supporting Systems), service boundary lines."
tags:
  - service-blueprint
priority: 2 - high
rank:
related:
  - "[[Run Intentional Session]]"
  - "[[Monitor Session from Sidebar]]"
  - "[[Sessions User Flow]]"
  - "[[PBI-SW-010 Session Lifecycle v2 and Intent Layer]]"
  - "[[PBI-SW-017 Main Sidebar Mode Separation]]"
note: "Session v2 Service Design Blueprint. Consistent with PRD v8 and flow docs. Minor event name deviations from PRD: uses session.energy.set (PRD: session.energy.changed), session.observation.added/session.idea.added (PRD: session.reflection.added with type field), session.followup.created (not yet in PRD event model — candidate for v2 event registration). Useful as architecture spike validation material for Cycle 6 Inc 3."
---
# Feature: Session v2 – Focus & Execution Environment

---

# 1. Scope

This blueprint covers the complete lifecycle of a Session:

- Creation
    
- Preparation
    
- Execution
    
- Monitoring (Sidebar mode)
    
- Closure Ritual
    
- Completion / Archival
    

Includes both:

- Deep Work scenario
    
- Workshop facilitation scenario
    

---

# 2. Blueprint Structure

We divide into:

1. User Actions
    
2. Frontstage (Visible UI)
    
3. Backstage (Application Logic)
    
4. Supporting Systems
    
5. Data / Events
    

Interaction Phases:

- Phase A: Preparation
    
- Phase B: Execution
    
- Phase C: Monitoring
    
- Phase D: Review
    
- Phase E: Post-Processing
    

---

# Phase A — Session Preparation

|Layer|Description|
|---|---|

### User Actions

- Click “Create Session”
    
- Define Primary Outcome
    
- Define Why (optional)
    
- Add execution tasks
    
- Bind context artifacts
    
- Set duration
    
- Set initial energy
    

---

### Frontstage (Visible UI)

- SessionMainView renders
    
- IntentCard editable
    
- ExecutionCard editable
    
- ContextIntelligenceCard active
    
- TimerEnergyCard configurable
    
- Start button enabled only if outcome defined
    

---

### Backstage (Logic)

- Create Session aggregate
    
- Initialize state = prepared
    
- Validate required fields
    
- Register task list
    
- Store context bindings
    
- Store initial energy
    
- Persist session to storage
    
- Emit event: session.created
    

---

### Supporting Systems

- Persistence layer
    
- EventBus
    
- Context binding service
    
- Validation service
    

---

### Data / Events

Emitted:

- session.created
    
- session.task.added
    
- session.context.bound
    
- session.energy.set
    

Stored:

- Session entity
    
- Task entities
    
- Context references
    

---

# Phase B — Session Execution

|Layer|Description|
|---|---|

### User Actions

- Click “Start”
    
- Work in main workspace (Canvas, PRD, Code)
    
- Check tasks complete
    
- Add Observations / Ideas / Blockers
    
- Adjust energy
    

---

### Frontstage (Visible UI)

Main Mode:

- Timer countdown active
    
- Energy indicator clickable
    
- Progress bar updates
    
- Reflection sections available
    

Sidebar Mode:

- Status header
    
- Timer
    
- Progress snapshot
    
- Event timeline
    
- Activity metrics
    

---

### Backstage (Logic)

On Start:

- Transition state: prepared → running
    
- Start timer
    
- Emit session.started
    

On Task Complete:

- Update task state
    
- Recalculate progress
    
- Emit session.task.completed
    

On Energy Change:

- Update energy value
    
- Emit session.energy.changed
    

On Activity:

- Track file changes
    
- Track emitted events
    
- Update activity metrics
    

Cognitive Overload Check:

- Evaluate task count
    
- Evaluate context count
    
- Evaluate energy
    
- Trigger alert if thresholds exceeded
    

---

### Supporting Systems

- Timer service
    
- EventBus
    
- Activity tracking service
    
- Cognitive Load evaluator
    
- File watcher (if enabled)
    

---

### Data / Events

Emitted:

- session.started
    
- session.task.completed
    
- session.energy.changed
    
- session.observation.added
    
- session.idea.added
    
- session.decision.recorded
    

Updated:

- Task states
    
- Energy history
    
- Activity counters
    

---

# Phase C — Sidebar Monitoring (Companion Mode)

|Layer|Description|
|---|---|

### User Actions

- Open Canvas in Main
    
- Keep Session in Sidebar
    
- Check progress
    
- Toggle task
    
- Observe timeline
    

---

### Frontstage

Sidebar renders:

- Compact Status Header
    
- ProgressBar
    
- Context snapshot
    
- Activity snapshot
    
- Collapsible Event Timeline
    

No heavy actions above fold.

---

### Backstage

- Subscribe Sidebar view to Session state
    
- Stream event updates
    
- Maintain lightweight reactive state
    
- Log timeline events
    

---

### Supporting Systems

- Reactive state store
    
- Event subscription layer
    
- Timeline aggregator
    

---

### Data / Events

Read:

- Session state
    
- Task list
    
- Activity metrics
    
- Event stream
    

No structural mutations allowed (except task toggle).

---

# Phase D — Review & Closure Ritual

Trigger:

- Timer expires  
    OR
    
- User manually ends session
    

---

### User Actions

- Respond to closure questions:
    
    - Outcome achieved?
        
    - What worked?
        
    - What didn’t?
        
    - Next action?
        
- Convert to follow-up session (optional)
    
- Convert to backlog item (optional)
    
- Complete session
    

---

### Frontstage

- SessionReviewOverlay appears
    
- Blocks further editing
    
- Requires completion of required fields
    

Sidebar:

- Displays “Review Required” indicator
    

---

### Backstage

- Transition state: running → reviewing
    
- Load GlobalClosureTemplate
    
- Apply SessionType overrides
    
- Validate required inputs
    
- Persist closure data
    
- Emit session.review.started
    

On Complete:

- Transition reviewing → completed
    
- Emit session.completed
    

If follow-up created:

- Emit session.followup.created
    

---

### Supporting Systems

- Closure configuration service
    
- Template inheritance resolver
    
- Validation engine
    
- EventBus
    

---

### Data / Events

Emitted:

- session.review.started
    
- session.completed
    
- session.followup.created
    

Stored:

- Closure result
    
- Outcome achievement flag
    
- Reflection entries
    

---

# Phase E — Post Processing

|Layer|Description|
|---|---|

### User Actions

- Archive session
    
- Review historical sessions
    
- Analyze energy vs completion
    

---

### Frontstage

- Completed state badge
    
- Read-only mode
    
- Archive button
    

---

### Backstage

- Transition completed → archived
    
- Freeze entity (read-only)
    
- Emit session.archived
    

---

### Supporting Systems

- Session repository
    
- Analytics module (future)
    
- Reporting engine
    

---

### Data / Events

Emitted:

- session.archived
    

Stored:

- Final immutable record
    

---

# Workshop Mode Variation

Additional logic:

- ExecutionCard label changes to Agenda
    
- Timeline auto-expanded
    
- Decision entries highlighted
    
- Optional time-per-agenda tracking
    

No architectural change — only mode-based UI variation.

---

# Service Boundary Lines

## Line of Interaction

User interacts with:

- SessionMainView
    
- SessionSidebarView
    

---

## Line of Visibility

User sees:

- Intent
    
- Timer
    
- Tasks
    
- Context
    
- Reflection
    
- Activity
    
- Review overlay
    

User does NOT see:

- State machine transitions
    
- Event emission
    
- Cognitive load calculations
    
- Template inheritance resolution
    

---

## Line of Internal Interaction

Between:

- Session aggregate
    
- EventBus
    
- Timer service
    
- Context binding service
    
- Activity tracking
    
- Closure service
    

---

# Architectural Summary

Session v2 behaves as:

A state-driven aggregate with:

- Intent definition
    
- Execution plan
    
- Context binding
    
- Reflection logging
    
- Closure enforcement
    
- Event emission
    

All interactions are event-backed.

---

# Strategic Outcome of This Blueprint

This blueprint ensures:

- Clear separation of UI and logic
    
- Strong event-driven design
    
- Workshop-ready capability
    
- Measurable execution tracking
    
- Scalable architecture for analytics and AI augmentation
    
