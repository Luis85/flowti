---
type: idea
stage: delivered
delivered_in: Cycle 6
origin: inbox
domain: Session
parent: "[[Session Workspaces PRD]]"
description: Session v2 user flow drafts — deep work, sidebar companion, workshop facilitation, state model, and edge cases.
tags:
priority: 2 - high
rank:
related:
  - "[[Create and Manage Sessions]]"
  - "[[PBI-SW-010 Session Lifecycle v2 and Intent Layer]]"
  - "[[PBI-SW-017 Main Sidebar Mode Separation]]"
note: "First draft of Session v2 user flows. Decomposed into two formal flow docs: Run Intentional Session (deep work + workshop + edge cases) and Monitor Session from Sidebar (companion mode). Source material for Cycle 6 Inc 3 architecture spike validation."
---
# 1. User Journey – Experience Level

## Persona A: Deep Work User

### Phase 1 — Preparation

User decides to focus on a specific outcome.

- Opens Flowti
    
- Creates new Session
    
- Defines Primary Outcome
    
- Adds 3–5 execution tasks
    
- Binds relevant PRD / Canvas / Notes
    
- Sets duration (e.g., 45 min)
    
- Sets energy level
    

**Emotional State:** Intentional, organized.

---

### Phase 2 — Execution

User starts session.

- Timer begins
    
- Session state → running
    
- User works in Canvas or Code
    
- Sidebar monitors progress
    
- User checks off tasks
    
- Energy may change
    
- Observations & Ideas captured
    

**Emotional State:** Focused, structured.

---

### Phase 3 — Overload Detection (Optional)

If:

- Too many tasks
    
- Too much context
    
- Energy drops
    

System shows Cognitive Load Warning.

User may:

- Remove tasks
    
- Split session
    
- Continue anyway
    

---

### Phase 4 — Completion

Timer ends → Session state → reviewing

Overlay appears:

- Outcome achieved? Yes / Partial / No
    
- Reflection questions
    
- Define next action
    

User completes ritual → session → completed

**Emotional State:** Closure, clarity.

---

### Phase 5 — Aftermath

User may:

- Convert to follow-up session
    
- Convert to backlog item
    
- Archive session
    

Session becomes traceable execution artifact.

---

# 2. Core User Flow – Deep Work Mode

---

## Flow A – Create & Run Session

```
User → Create Session
  → Define Intent
  → Add Execution Tasks
  → Bind Context
  → Set Duration
  → Set Energy
  → Click Start
  → Session State = running
```

---

## Flow B – During Session

```
Running
  → Work in main window
  → Toggle tasks complete
  → Add observations
  → Change energy
  → Context usage
  → Activity tracked
```

Optional:

```
If overloaded → Show warning
```

---

## Flow C – Timer Expiry

```
Timer reaches 0
  → State = reviewing
  → Review Overlay appears
  → User answers closure questions
  → Complete
  → State = completed
```

---

# 3. Sidebar Companion Flow

## Scenario: Working on Canvas

```
User opens Canvas in Main
User opens Session in Sidebar
```

Sidebar shows:

- Timer
    
- Energy
    
- Progress
    
- Context Snapshot
    
- Event Timeline
    

Flow:

```
User edits Canvas
  → Files modified counter increases
  → Event emitted
  → Sidebar timeline updates
  → User checks agenda item
```

When timer ends:

```
Sidebar indicates Review Required
User switches to Main
Review Overlay shown
```

---

# 4. Workshop Facilitation Flow

## Workshop Mode Variant

```
Create Session
  → Mode = Workshop
  → Execution tasks = Agenda items
  → Bind Canvas
  → Start session
  → Share screen
```

During workshop:

```
Facilitator:
  → Marks agenda item complete
  → Records decisions live
  → Adjusts energy (group energy proxy)
  → Uses timeline to show structure
```

Timer ends:

```
Review Ritual
  → Outcome achieved?
  → Decisions summary
  → Follow-up tasks generated
```

Session becomes workshop documentation artifact.

---

# 5. State-Based Flow Model

```
prepared
   ↓ Start
running
   ↓ Pause
paused
   ↓ Resume
running
   ↓ Timer Expiry
reviewing
   ↓ Complete Review
completed
   ↓ Archive
archived
```

Edge Case:

- User manually stops early → transition to reviewing
    

---

# 6. Failure / Edge Flows

### Edge Case 1 – User closes app mid-session

On reload:

```
If state = running
  → Restore session
  → Resume or mark as interrupted
```

---

### Edge Case 2 – User ignores review

System blocks:

```
No transition to completed without closure ritual
```

---

### Edge Case 3 – User starts session without outcome

System prevents:

```
Start disabled until Primary Outcome defined
```

---

# 7. Interaction Flow Diagram (Mermaid)

## Deep Work Flow

```mermaid
flowchart TD

A[Create Session] --> B[Define Intent]
B --> C[Add Execution Tasks]
C --> D[Bind Context]
D --> E[Set Duration & Energy]
E --> F[Start Session]

F --> G[Running State]

G --> H[Work & Update Tasks]
H --> I[Energy Changes]
H --> J[Add Observations / Ideas]

G --> K{Timer Expired?}

K -- No --> G
K -- Yes --> L[Review State]

L --> M[Closure Ritual]
M --> N[Completed State]

N --> O{Archive?}
O -- Yes --> P[Archived]
O -- No --> Q[Remain Completed]
```

---

## Sidebar Monitoring Flow

```mermaid
flowchart TD

A[Session Running] --> B[Sidebar Displays Status]
B --> C[User Works in Canvas]
C --> D[Activity Updates]
D --> B
B --> E[User Completes Task]
E --> B
B --> F{Timer Expired?}
F -- Yes --> G[Review Required Indicator]
```

---

# 8. Interaction Philosophy

The flow enforces:

1. Intent before execution
    
2. Measurable execution
    
3. Continuous awareness (energy + progress)
    
4. Mandatory reflection
    
5. Explicit closure
    

---

# 9. Strategic Outcome of This Flow

Sessions become:

- Execution artifacts
    
- Workshop documentation tools
    
- Measurable focus containers
    
- Event-emitting domain entities
    
