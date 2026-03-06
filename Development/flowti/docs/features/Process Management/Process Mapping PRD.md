---
type: ProductRequirementsDocument
description: "We need to provide tools to guide the user through the process creation process"
created: 2026-03-05T19:37:43.574Z
origin: quick-capture
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
stage: in-progress
version: "1.0"
maturity: L2
maturity_score_strategy: 4
maturity_score_scope: 4
maturity_score_architecture: 3
maturity_score_event_integration: 4
maturity_score_data_model: 3
maturity_score_ui_consistency: 2
maturity_score_validation_testing: 2
foundation:
  - "[[PRD: Journey Builder — Visual E2E Journey Authoring]]"
  - "[[Canvas Session Journey]]"
related_events:
  - process.opened
  - process.created
  - process.updated
  - process.node.added
  - process.node.updated
  - process.node.removed
  - process.edge.created
  - process.edge.removed
  - process.compiled
  - process.execution.started
  - process.execution.completed
  - process.canvas.synced
stage_history:
  - stage: approved
    date: 2026-03-05
    note: "PRD created from vault inbox, FRI 22/35"
  - stage: in-progress
    date: 2026-03-06
    cycle: 59
    note: "Phase 1 delivered: 4 node types, canvas parser, validation (10 rules), reference process, phase mapping. Domain-layer only — UI wiring deferred to C60"
tags:
  - process
  - canvas
  - workflow
  - orchestration
  - journey

---

# 1. Problem Statement

Flowti currently supports **Journeys** — executable sequences of steps used for E2E tests and automated workflows.

However, **Journeys only represent linear execution paths.**

Real processes often include:

- decision points
    
- branching flows
    
- parallel activities
    
- loops
    
- event triggers
    
- subprocesses
    

These cannot be represented clearly in a simple step list.

Additionally:

- **Journey Builder is developer-centric**
    
- **Canvas Sessions enable visual work but do not structure processes**
    
- **there is no process abstraction above journeys**
    

Without a **Process Mapping capability**, teams cannot:

- visualize real workflows
    
- reason about process logic
    
- map responsibilities
    
- orchestrate multiple journeys
    
- use Canvas as a modeling tool.
    

Flowti needs a **Process Mapping layer** that combines:

- Canvas modeling
    
- Journey execution
    
- Session interaction
    
- Event-driven architecture
    

into a **visual, executable process system**.

---

# 2. Outcome

After implementation:

Users can design **processes visually on Canvas** using Flowti process nodes.

A process can contain:

- start events
    
- activities
    
- decisions
    
- parallel branches
    
- subprocesses
    
- end states
    

Processes can be:

- **executed**
    
- **simulated**
    
- **compiled into journeys**
    
- **run via Journey Runner**
    
- **operated within Canvas Sessions**
    

Canvas becomes:

**Flowti's visual process engine.**

---

# 3. Conceptual Model

### Relationship of Systems

```
Process Map
   │
   ├─ activities
   ├─ decisions
   ├─ events
   └─ subprocesses
        │
        ▼
Journeys
   │
   ▼
Journey Runner
   │
   ▼
Execution + Canvas Visualization
```

---

### Example

Canvas process:

```
Start
  ↓
Open Session
  ↓
Decision: Template selected?
  ├─ No → End
  └─ Yes
        ↓
Create Canvas
        ↓
Run Session
        ↓
Pause / Resume
        ↓
Complete Session
        ↓
Closure
        ↓
End
```

This **maps directly to your Canvas Session journey test.**

---

# 4. Scope

## In Scope

- Process modeling on Canvas
    
- Process node types
    
- Process execution model
    
- Process → Journey compilation
    
- Session-based process execution
    
- Event-driven orchestration
    
- Swimlanes / responsibility lanes
    
- Process validation
    
- Process simulation
    

---

## Out of Scope

- BPMN file import/export
    
- external workflow engines
    
- multi-user editing
    
- enterprise workflow management
    

---

# 5. UX Entry Points

## 1 — Create Process

Command:

```
flowti:create-process
```

User selects:

```
Process Template
```

Examples:

- Linear Process
    
- Decision Flow
    
- Session Workflow
    
- Test Automation Flow
    

A **Canvas file is created**.

---

## 2 — Canvas Process Editor

The process is edited directly on Canvas.

Nodes represent process elements.

Edges represent control flow.

---

## 3 — Run Process

From Canvas:

```
Run Process
```

Execution options:

```
simulate
execute
compile to journey
```

---

## 4 — Canvas Session Integration

Processes can run inside a **Canvas Session**.

Example:

```
Start session
↓
Process execution begins
↓
User works inside canvas
↓
Process continues
```

---

# 6. Process Modeling Language

Flowti introduces a **lightweight BPMN-inspired language** optimized for Canvas.

---

# Node Types

## Start Event

```
● Start
```

Triggers a process.

Possible types:

- manual
    
- command
    
- event
    
- scheduled
    

Example:

```
ui.startCanvasSession
```

---

## Activity

Represents work.

Examples:

- run journey step
    
- execute command
    
- open UI
    
- create file
    
- run action
    

Example:

```
Create Canvas
```

---

## Decision

Branching logic.

```
◇ Decision
```

Example:

```
Template selected?
```

---

## Parallel Split

```
|| Fork
```

Runs multiple branches.

---

## Merge

```
Merge
```

Joins parallel flows.

---

## Subprocess

Represents a nested process or journey.

Example:

```
Run Canvas Session Journey
```

---

## End Event

```
End
```

Process finished.

---

# 7. Canvas Representation

Each node is a **canvas node with metadata**.

Example:

```
type: process-node
node_type: activity
title: Create Canvas
command: flowti:create-canvas
```

Edges represent transitions.

```
type: process-edge
condition: templateSelected == true
```

---

# 8. Process Data Model

```ts
interface ProcessDefinition {

    id: string
    name: string
    description?: string

    nodes: ProcessNode[]
    edges: ProcessEdge[]

}
```

---

## Process Node

```ts
interface ProcessNode {

    id: string
    type:
        | "start"
        | "activity"
        | "decision"
        | "fork"
        | "merge"
        | "subprocess"
        | "end"

    title: string

    command?: string
    event?: string
    journey?: string

    uiContext?: string[]

}
```

---

## Edge

```ts
interface ProcessEdge {

    id: string
    from: string
    to: string

    condition?: string

}
```

---

# 9. Process Execution

Execution engine traverses graph.

```
Start
 ↓
Activity
 ↓
Decision
 ├ true
 └ false
```

Algorithm:

```
execute node
evaluate edges
choose next
continue
```

---

# 10. Process → Journey Compilation

A process can compile into **multiple journeys**.

Example:

Decision flow:

```
Start
 ↓
Decision
 ├ Path A
 └ Path B
```

Produces:

```
journey-path-a.json
journey-path-b.json
```

This integrates perfectly with:

```
Journey Runner
```

---

# 11. Canvas Synchronization

Process definitions sync with Canvas.

Two directions:

```
Canvas → Process
Process → Canvas
```

Nodes map to canvas nodes.

Edges map to canvas edges.

---

# 12. Canvas Session Integration

A process can run **inside a Canvas Session**.

Example lifecycle:

```
Session start
↓
Process started
↓
User executes activities
↓
Process monitors events
↓
Process completes
```

Example:

Canvas Session Journey becomes a **Process Map**.

---

# 13. Architecture

```
Canvas
  │
  ▼
ProcessEditor
  │
  ▼
ProcessService
  │
  ├ ProcessParser
  ├ ProcessCompiler
  ├ ProcessExecutor
  │
  ▼
JourneyRunner
```

---

# 14. Event Flow

```
Canvas edit
 → process.node.updated
 → ProcessService.update()

Run process
 → process.execution.started
 → JourneyRunner

Completion
 → process.execution.completed
```

---

# 15. Example: Canvas Session Process

```
Start
 ↓
Open Template Picker
 ↓
Select Template
 ↓
Enter Goal
 ↓
Create Canvas
 ↓
Session Running
 ↓
Pause / Resume
 ↓
Complete
 ↓
Closure
 ↓
End
```

This maps **exactly to your E2E journey**.

---

# 16. Success Metrics

|Metric|Target|
|---|---|
|Process design time|< 15 min|
|Process → Journey compile|< 1 sec|
|Canvas sync accuracy|100%|
|Process simulation success|>95%|

---

# 17. Risks

|Risk|Mitigation|
|---|---|
|Canvas complexity|Simple node set|
|User confusion vs BPMN|simplified visual language|
|Graph cycles|validation rules|

---

# 18. Delivery Plan

### Phase 1 — Process Canvas (Cycle 56)

- Node types
    
- Canvas parsing
    
- ProcessDefinition model
    
- Graph validation
    

---

### Phase 2 — Execution Engine (Cycle 57)

- traversal engine
    
- event triggers
    
- activity execution
    

---

### Phase 3 — Journey Integration (Cycle 58)

- compile process → journeys
    
- run journeys
    

---

### Phase 4 — Simulation (Cycle 59)

- process preview
    
- step animation on canvas
    

---

# 19. Why This Fits Flowti Perfectly

Your platform already has:

- **EventBus**
    
- **Journey execution**
    
- **Canvas**
    
- **Sessions**
    


---

# 20. Strategic Value

This feature unlocks:

- **Process documentation**
    
- **Process automation**
    
- **process simulation**
    
- **journey orchestration**
    
- **test orchestration**
    
- **product workflow modeling**
    

inside the **same canvas system**.

---
# Flowti Process Visual Language System

A lightweight, BPMN-inspired visual grammar designed for **Obsidian Canvas**, aligned with **Journey Builder** and **Canvas Sessions**, and optimized for **executable** process maps.

---

## 1. Design goals

### Must

- **Readable in 5 seconds** (even when zoomed out)
    
- **Executable semantics** (every node can compile to something runnable or verifiable)
    
- **Canvas-native** (uses standard Canvas nodes + edges; no custom rendering required)
    
- **Round-trip safe** (Canvas ↔ ProcessDefinition is lossless)
    
- **Consistent with Journey Builder** (steps, actions, events, commands)
    
- **Session-aware** (process execution can live inside Canvas Session lifecycle)
    

### Should

- Support **branching, merges, parallel flows, loops**
    
- Support **swimlanes** for ownership / responsibility
    
- Provide **visual status overlays** during execution (planned/running/passed/failed/blocked)
    

---

## 2. Core primitives

Flowti Process Mapping uses only two primitives:

- **Nodes** = work / events / decisions / containers
    
- **Edges** = control flow (and optional conditions)
    

Everything else is a convention.

---

## 3. Node catalog

Each node has:

- a **shape**
    
- a **color role**
    
- a **title format**
    
- a **minimum metadata set**
    
- a **compilation target** (what it becomes when executed)
    

### Color roles (semantic palette)

Use a small set of semantic “roles” (not random colors).

|Role|Meaning|Used for|
|---|---|---|
|**Neutral**|default / informational|activities, notes|
|**Trigger**|something starts|start events|
|**Decision**|branching|decisions|
|**Control**|orchestration|forks/joins, timers|
|**Terminal**|end state|end events|
|**Risk/Issue**|attention needed|blockers, errors|
|**Success**|passed|execution overlay|
|**Warning**|skipped / partial|execution overlay|

> Implementation note: Obsidian Canvas color support is limited; store the semantic role in metadata (`style.role`) and map it to the closest available canvas color.

---

## 4. Shapes and their meanings

Because Canvas nodes are mostly rectangles, “shape” is expressed via **node prefix icon** + **title grammar**, and optionally by **ASCII shape marker** in the title.

### Title grammar (required)

All process nodes start with a **type token**:

- `●` Start
    
- `■` Activity
    
- `◇` Decision
    
- `‖` Fork (parallel split)
    
- `⊼` Join (parallel merge)
    
- `↻` Loop / Retry
    
- `▣` Subprocess
    
- `◎` Milestone
    
- `⦿` End
    

Example titles:

- `● Start: Manual Trigger`
    
- `■ Activity: Open Template Picker`
    
- `◇ Decision: Template selected?`
    
- `▣ Subprocess: Canvas Session Journey`
    
- `⦿ End: Session Completed`
    

This makes the map readable even when zoomed out.

---

## 5. Node types specification

## 5.1 Start node

**Meaning:** a trigger that starts execution

**Title format**

- `● Start: <trigger name>`
    

**Metadata**

- `node_type: start`
    
- `trigger.type: manual | command | event | schedule`
    
- One of:
    
    - `trigger.command_id`
        
    - `trigger.event_name`
        
    - `trigger.cron`
        

**Execution**

- Starts the process instance and emits `process.execution.started`
    

---

## 5.2 Activity node

**Meaning:** a unit of work (something that can be executed or checked)

**Title format**

- `■ Activity: <verb phrase>`
    

**Metadata (minimum)**

- `node_type: activity`
    
- `activity.kind: command | action | journey_step | manual | note`
    
- Depending on kind:
    
    - `activity.command_id`
        
    - `activity.action` (Journey tool schema)
        
    - `activity.journey_ref`
        
    - `activity.instructions` (manual)
        

**Compilation targets**

- `command` → Journey action `{ tool: "command", id: ... }`
    
- `action` → Journey action `{ tool: ..., ... }`
    
- `journey_step` → step reference in compiled journey
    
- `manual` → Journey action `{ tool: "manual", instruction: ... }`
    

---

## 5.3 Decision node

**Meaning:** branches execution into one of multiple paths

**Title format**

- `◇ Decision: <question>`
    

**Metadata**

- `node_type: decision`
    
- `decision.mode: rule | manual | event`
    
- Optional:
    
    - `decision.expression` (rule)
        
    - `decision.event_name` (event-based decision)
        
    - `decision.default_edge_id`
        

**Edge labeling rules**

- outgoing edges MUST have labels:
    
    - `Yes` / `No`, or
        
    - `A` / `B`, or
        
    - explicit conditions like `status == "paused"`
        

**Execution**

- Evaluates outgoing edges by:
    
    - rule expression, or
        
    - user prompt (manual), or
        
    - waits for an event (event)
        

---

## 5.4 Fork node

**Meaning:** start parallel branches

**Title format**

- `‖ Fork: <name>`
    

**Metadata**

- `node_type: fork`
    
- `fork.mode: parallel`
    
- `fork.branches_expected: number`
    

**Execution**

- Spawns branch tokens for each outgoing edge
    

---

## 5.5 Join node

**Meaning:** merge parallel branches

**Title format**

- `⊼ Join: <name>`
    

**Metadata**

- `node_type: join`
    
- `join.mode: all | any`
    
    - `all` = wait for all branches
        
    - `any` = continue when one branch completes
        

---

## 5.6 Loop / Retry node

**Meaning:** repeat part of a process

**Title format**

- `↻ Loop: <condition/intent>`
    

**Metadata**

- `node_type: loop`
    
- `loop.max_iterations?: number`
    
- `loop.until?: expression`
    
- `loop.on_fail?: retry | abort | skip`
    

**Execution**

- Re-enters a target node based on edge definition + constraints
    

---

## 5.7 Subprocess node

**Meaning:** call another process or a journey

**Title format**

- `▣ Subprocess: <name>`
    

**Metadata**

- `node_type: subprocess`
    
- `subprocess.kind: process | journey`
    
- One of:
    
    - `subprocess.process_ref`
        
    - `subprocess.journey_ref`
        

**Execution**

- Executes referenced artifact and returns status + outputs
    

---

## 5.8 Milestone node

**Meaning:** checkpoint / stage boundary used for reporting

**Title format**

- `◎ Milestone: <name>`
    

**Metadata**

- `node_type: milestone`
    
- `milestone.tags?: string[]`
    

**Execution**

- Emits `process.milestone.reached` (non-blocking)
    

---

## 5.9 End node

**Meaning:** terminate process

**Title format**

- `⦿ End: <result>`
    

**Metadata**

- `node_type: end`
    
- `end.status: success | failed | cancelled | skipped`
    

---

## 6. Edge language

Edges represent **control flow**, not relationships.

### Edge rules

- Default reading direction: **left → right** (primary), **top → bottom** (secondary)
    
- Every edge has:
    
    - `edge_type: control_flow`
        
    - optional `condition`
        
    - optional `label`
        

### Edge label grammar

- For decisions: `Yes`, `No`, or a condition string
    
- For normal flow: label omitted (clean diagram)
    

### Edge metadata

- `condition?: string`
    
- `priority?: number` (tie-breakers)
    
- `guard?: string` (validation rule)
    
- `on_traverse.emit?: string[]` (optional events)
    

---

## 7. Swimlanes

Swimlanes are **containers** (Canvas group nodes) with a lane header.

### Lane title grammar

- `LANE: <role/team>`
    

Examples:

- `LANE: User`
    
- `LANE: Flowti Plugin`
    
- `LANE: External System (Azure DevOps)`
    

### Lane usage rules

- Nodes belong to exactly one lane
    
- Edges may cross lanes
    
- Lane membership becomes `owner.role` metadata for compilation and reporting
    

---

## 8. Status overlays (execution visualization)

When a process runs, nodes and edges get a **status badge** in their text and metadata.

### Node status

- `planned`
    
- `active`
    
- `passed`
    
- `failed`
    
- `blocked`
    
- `skipped`
    

### Visual convention

Prepend the title with an execution marker:

- `⏳` planned
    
- `▶` active
    
- `✅` passed
    
- `❌` failed
    
- `⛔` blocked
    
- `⏭` skipped
    

Example:

- `▶ ■ Activity: Create Canvas`
    
- `✅ ■ Activity: Enter Goal`
    
- `❌ ◇ Decision: Template selected?`
    

> Important: keep the original type token (`■`, `◇`, etc.) so parsing remains stable.

---

## 9. Metadata format (Canvas-safe)

Obsidian Canvas nodes should remain human-readable, so metadata must be:

1. embedded in the node text as a fenced YAML block, OR
    
2. stored in the node’s `meta` (if you already do this via your sync service)
    

### Recommended: fenced YAML in node body

Example node content:

```yaml
■ Activity: Open Template Picker

---
flowti:
  type: process-node
  node_type: activity
  activity:
    kind: command
    command_id: flowti:start-canvas-session
  uiContext:
    components:
      - CanvasTemplatePickerModal
---
```


---

## 10. Layout rules (so maps look consistent)

### Global layout

- Start at **far left**
    
- End at **far right**
    
- Decisions branch **downward** for the “No / alternate” path
    
- Prefer **orthogonal routing**: straight edges, minimal diagonals
    

### Spacing

- Nodes: consistent width
    
- Vertical spacing between parallel branches: 2× normal spacing
    
- Subprocess nodes slightly larger than activities
    

### Grouping

- Use swimlane containers as primary grouping
    
- Use milestone nodes for stage boundaries instead of massive group boxes
    

---

## 11. Compilation rules (Process → Journey)

A **Process** compiles into one or more **Journeys**.

### Default compilation strategy

- One primary “happy path” journey
    
- Each decision branch can become:
    
    - separate journey, or
        
    - conditional blocks in one journey (if runner supports it later)
        

### Node-to-Journey mapping table

|Process Node|Journey Output|
|---|---|
|Start (command)|first step includes `command` action|
|Activity (command)|`{ tool: "command", id: ... }`|
|Activity (action)|`{ tool: <tool>, ... }`|
|Activity (manual)|`{ tool: "manual", instruction: ... }`|
|Decision (manual)|`{ tool: "manual", instruction: "Choose path..." }` + branch selection|
|Subprocess (journey)|step that runs referenced journey (future: nested execution)|
|Milestone|`{ tool: "write-run-log" }` or event emit|
|End|teardown / completion marker|

---

## 12. Validation rules (linting)

A Process Map is “Flowti Executable” only if it passes validation:

### Structural

- exactly **1 Start**
    
- at least **1 End**
    
- all nodes reachable from Start
    
- no dead ends (unless end)
    
- fork must have join (unless explicitly “fire-and-forget”)
    

### Semantic

- activity nodes must have a resolvable `kind`
    
- command ids must exist in command registry
    
- event names must exist in event catalog (if strict mode enabled)
    

### Canvas hygiene

- no duplicate node ids
    
- edges cannot reference missing nodes
    

---

## 13. Templates (starter maps)

Provide templates as **Canvas blueprints** so users begin fast.

### Template 1 — Linear

Start → Activities → End

### Template 2 — Decision Flow

Start → Decision → (A/B) → End

### Template 3 — Session Workflow (matches your E2E)

Start → Template Picker → Goal → Create Canvas → Running → Pause/Resume → Complete → Closure → End

---

## 14. Governance rules (so teams don’t create chaos)

### Naming

- Activities start with a verb: `Open`, `Create`, `Verify`, `Emit`, `Run`
    
- Decisions are phrased as questions
    
- Subprocess nodes reference a stable artifact name (journey/process id)
    

### Ownership

- Everything belongs to a lane
    
- Lane titles are a controlled vocabulary (User, Flowti, External)
    

### Versioning

- Store `process_id` and `version` in the Start node metadata
    
- Export produces:
    
    - `<name>.process.canvas`
        
    - `<name>.process.json` (canonical)
        
    - compiled journeys in `/journeys/compiled/`
        

---

## 15. “Definition of Done” for the language system

You can consider the language system ready when:

- You can create a process map using only these tokens and metadata blocks
    
- The parser can reliably detect node types from title tokens + `flowti.type`
    
- A process can compile into a journey without guesswork
    
- Execution can update node titles with status markers without breaking round-trip parsing
    

---

## 16. Concrete example (Canvas Session as Process Map)

**Nodes (titles):**

- `● Start: Command Trigger`
    
- `■ Activity: Open Template Picker`
    
- `■ Activity: Select Template`
    
- `■ Activity: Enter Goal`
    
- `■ Activity: Create Canvas`
    
- `■ Activity: Run Session`
    
- `◇ Decision: Pause session?`
    
- `■ Activity: Pause`
    
- `■ Activity: Resume`
    
- `■ Activity: Complete Session`
    
- `■ Activity: Closure`
    
- `⦿ End: Completed`
    

**Edges:**

- Decision edges labeled `Yes` / `No`
    
- `Yes` → Pause → Resume → back to Run Session (loop)
    
- `No` → Complete Session
    


---
Below is a **Process Lint Rules spec** you can drop into Flowti docs and implement as a validator/linter. It’s designed to be:

- **Canvas-native** (works on parsed canvas nodes/edges)
    
- **Executable-first** (guards compilation + execution)
    
- **Actionable** (every rule yields fix suggestions)
    
- **Aligned with your event-driven + Journey Builder semantics**
    

---

# Flowti Process Lint Rules

**Artifact type:** Validator spec (ProcessDefinition + Canvas)  
**Applies to:** `*.process.canvas`, `ProcessDefinition` parsed from Canvas, compiled journeys

## 1. Severity model

|Severity|Meaning|Gate behavior|
|---|---|---|
|`error`|invalid / unsafe|blocks **Executable** + blocks **Compile/Run**|
|`warn`|risky / ambiguous|compile allowed but warns; execution allowed in “non-strict”|
|`info`|improvement|never blocks|

**Strictness modes**

- **Strict**: errors + selected warnings block execution (recommended for “Flowti Executable” badge)
    
- **Normal**: only errors block
    
- **Draft**: nothing blocks; only reports
    

---

## 2. Lint output format (recommended)

Each finding should include:

- `rule_id`
    
- `severity`
    
- `message`
    
- `node_id` / `edge_id` (optional)
    
- `location` (canvas node title / edge label)
    
- `fix` (one-liner guidance)
    
- `autofix` (optional; if safe)
    

Example:

```yaml
rule_id: PM-STRUCT-002
severity: error
message: "Process has 0 Start nodes. Exactly 1 is required."
fix: "Add a ● Start node and connect it to the first activity."
autofix: false
```

---

## 3. Rule catalog

### A) Structure rules (graph correctness)

#### PM-STRUCT-001 — Process must contain nodes

- **Severity:** error
    
- **Condition:** nodes array is empty
    
- **Fix:** Add at least Start → Activity → End
    

---

#### PM-STRUCT-002 — Exactly one Start node

- **Severity:** error
    
- **Condition:** count(start) != 1
    
- **Fix:** Ensure exactly one `node_type: start` (title token `●`)
    
- **Autofix:** if >1, offer “Mark others as milestones” or “Convert to activity”
    

---

#### PM-STRUCT-003 — At least one End node

- **Severity:** error
    
- **Condition:** count(end) < 1
    
- **Fix:** Add `⦿ End` node and connect the last step
    

---

#### PM-STRUCT-004 — Start node must have at least one outgoing edge

- **Severity:** error
    
- **Condition:** outdegree(start) == 0
    
- **Fix:** Connect Start to first Activity/Decision
    

---

#### PM-STRUCT-005 — End nodes must have no outgoing edges

- **Severity:** error
    
- **Condition:** outdegree(end) > 0
    
- **Fix:** Remove outgoing edges or convert End node to Activity/Milestone
    

---

#### PM-STRUCT-006 — No disconnected nodes

- **Severity:** warn (error in strict mode)
    
- **Condition:** any node not reachable from Start
    
- **Fix:** Connect node into flow or delete it
    
- **Autofix:** offer “Delete unreachable nodes” (only if node has no edges)
    

---

#### PM-STRUCT-007 — No dead ends

- **Severity:** error
    
- **Condition:** any non-end node has outdegree == 0
    
- **Fix:** Add outgoing edge to a next node or convert node to End
    

---

#### PM-STRUCT-008 — No orphan edges

- **Severity:** error
    
- **Condition:** any edge references missing `from` or `to` node
    
- **Fix:** Reconnect edge or remove it
    
- **Autofix:** remove orphan edges
    

---

#### PM-STRUCT-009 — Unique node ids

- **Severity:** error
    
- **Condition:** duplicate node ids
    
- **Fix:** regenerate ids; ensure stable mapping for round-trip
    

---

#### PM-STRUCT-010 — Unique edge ids

- **Severity:** error
    
- **Condition:** duplicate edge ids
    
- **Fix:** regenerate ids
    

---

### B) Type semantics rules (node-level correctness)

#### PM-TYPE-001 — Node type must be recognized

- **Severity:** error
    
- **Condition:** node_type not in catalog (start/activity/decision/fork/join/loop/subprocess/milestone/end)
    
- **Fix:** set `flowti.node_type` and align title token
    

---

#### PM-TYPE-002 — Title token must match node_type

- **Severity:** warn (error in strict mode)
    
- **Condition:** title begins with wrong token (`●/■/◇/…`) for declared node_type
    
- **Fix:** update title token or node_type
    
- **Autofix:** update title token (safe)
    

---

#### PM-TYPE-003 — Activity nodes must declare activity.kind

- **Severity:** error
    
- **Condition:** node_type=activity and missing `activity.kind`
    
- **Fix:** set `command | action | journey_step | manual | note`
    

---

#### PM-TYPE-004 — Activity kind requires corresponding payload

- **Severity:** error
    
- **Conditions + Fixes:**
    
    - `command` missing `activity.command_id` → add command id
        
    - `action` missing `activity.action` → add action schema
        
    - `journey_step` missing `activity.journey_ref` → link journey
        
    - `manual` missing `activity.instructions` → add instruction text
        

---

#### PM-TYPE-005 — Decision node must have ≥ 2 outgoing edges

- **Severity:** error
    
- **Condition:** node_type=decision and outdegree < 2
    
- **Fix:** add at least 2 paths (e.g., Yes/No)
    

---

#### PM-TYPE-006 — Fork node must have ≥ 2 outgoing edges

- **Severity:** error
    
- **Condition:** node_type=fork and outdegree < 2
    
- **Fix:** add at least 2 branches
    

---

#### PM-TYPE-007 — Join node must have ≥ 2 incoming edges

- **Severity:** error
    
- **Condition:** node_type=join and indegree < 2
    
- **Fix:** connect at least 2 branches into join
    

---

#### PM-TYPE-008 — Subprocess node must reference a target

- **Severity:** error
    
- **Condition:** node_type=subprocess and missing `(process_ref or journey_ref)`
    
- **Fix:** set `subprocess.kind` + ref id/path
    

---

#### PM-TYPE-009 — Loop node must be bounded (strict)

- **Severity:** warn (error in strict mode)
    
- **Condition:** loop node has no `max_iterations` and no `until`
    
- **Fix:** add `max_iterations` or `until` expression
    

---

#### PM-TYPE-010 — Milestone should be non-blocking

- **Severity:** info
    
- **Condition:** milestone has outgoing conditions or action payloads
    
- **Fix:** move actions into an activity node
    

---

### C) Control-flow and branching rules (edge correctness)

#### PM-FLOW-001 — Decision outgoing edges must be labeled or conditioned

- **Severity:** error
    
- **Condition:** from decision node, any outgoing edge missing both `label` and `condition`
    
- **Fix:** set label (Yes/No) or `condition: <expr>`
    

---

#### PM-FLOW-002 — Duplicate branch labels from a decision

- **Severity:** warn
    
- **Condition:** two outgoing edges from same decision share same `label`
    
- **Fix:** make labels unique
    

---

#### PM-FLOW-003 — Condition syntax must validate

- **Severity:** warn (error in strict mode)
    
- **Condition:** condition expression cannot be parsed (whatever expression engine you choose)
    
- **Fix:** correct expression or switch to manual decision mode
    

---

#### PM-FLOW-004 — Priority ties must be explicit (if used)

- **Severity:** info
    
- **Condition:** multiple conditional edges and no priority specified
    
- **Fix:** add `priority` values or ensure mutually exclusive conditions
    

---

#### PM-FLOW-005 — Loops must have explicit back-edge semantics

- **Severity:** warn
    
- **Condition:** cycle detected but no loop node present in cycle
    
- **Fix:** insert `↻ Loop` node to document intent + bounds
    

---

### D) Execution safety rules (run-time hazards)

#### PM-EXEC-001 — Commands must exist in registry

- **Severity:** error
    
- **Condition:** activity.kind=command and command id not registered
    
- **Fix:** pick a valid command via Command Picker
    

---

#### PM-EXEC-002 — Events must exist in Event Catalog (strict)

- **Severity:** warn (error in strict mode)
    
- **Condition:** node uses `trigger.event_name` or decision uses `decision.event_name` not found
    
- **Fix:** choose catalog event or disable strict event validation
    

---

#### PM-EXEC-003 — Manual nodes must be explicitly marked non-executable

- **Severity:** warn
    
- **Condition:** activity.kind=manual but process is marked executable without manual policy
    
- **Fix:** set process policy: `manual_policy: allow | disallow | require_confirmation`
    

---

#### PM-EXEC-004 — Subprocess recursion guard

- **Severity:** error
    
- **Condition:** subprocess references itself directly or via chain (cycle in process refs)
    
- **Fix:** remove recursion or add guard policy `max_depth`
    

---

#### PM-EXEC-005 — Parallel fork must have a join or be marked “fire-and-forget”

- **Severity:** warn (error in strict mode)
    
- **Condition:** fork branches never rejoin before end, and fork not marked `fork.fire_and_forget=true`
    
- **Fix:** add join or mark as fire-and-forget
    

---

#### PM-EXEC-006 — Join mode must be defined

- **Severity:** warn
    
- **Condition:** node_type=join and missing `join.mode`
    
- **Fix:** set `all` or `any`
    

---

### E) Session integration rules (Canvas Sessions compatibility)

These align with your Canvas Session lifecycle journey.

#### PM-SESS-001 — Process requires session context if it uses session events

- **Severity:** warn
    
- **Condition:** any node references `session.*` events but process lacks `requires_session=true`
    
- **Fix:** add process metadata `requires_session: true`
    

---

#### PM-SESS-002 — Canvas-opening activities should declare uiContext.canvas

- **Severity:** info
    
- **Condition:** activity opens canvas (command/action known) but uiContext missing
    
- **Fix:** add `uiContext.components: ["Canvas"]`
    

---

#### PM-SESS-003 — Closure activities require a terminal node

- **Severity:** warn
    
- **Condition:** nodes mention closure overlay / completion but no End(success) present
    
- **Fix:** add `⦿ End: Completed`
    

---

### F) Layout and readability rules (non-blocking, but important)

#### PM-UX-001 — Nodes should belong to a swimlane

- **Severity:** info (warn in strict “team maps”)
    
- **Condition:** node missing `owner.role` or not inside lane container
    
- **Fix:** assign lane: User / Flowti / External
    

---

#### PM-UX-002 — Unlabeled decisions are unclear

- **Severity:** info
    
- **Condition:** decision title does not end with `?`
    
- **Fix:** rewrite as question
    

---

#### PM-UX-003 — Verb-first activities

- **Severity:** info
    
- **Condition:** activity title doesn’t start with verb (Open/Create/Verify/Emit/Run/Select/Enter/Complete/…)
    
- **Fix:** rename for clarity
    

---

## 4. Executable badge rule set

A process can be marked **Flowti Executable** when:

- all `error` rules pass
    
- and in strict mode:
    
    - PM-STRUCT-006, PM-TYPE-009, PM-FLOW-003, PM-EXEC-002, PM-EXEC-005 have no findings
        

This yields a simple gating outcome:

```yaml
executable: true|false
compile_allowed: true|false
run_allowed: true|false
```

---

## 5. Autofix policy (safe automation only)

Allow autofix only for:

- orphan edges removal (PM-STRUCT-008)
    
- title token normalization (PM-TYPE-002)
    
- add missing join.mode default (`all`) (PM-EXEC-006) — **only if you can justify**
    
- generate ids for duplicates (PM-STRUCT-009/010) — careful: can break references; only do if you also update all edges
    

Never autofix:

- flow semantics (decisions, forks, loops)
    
- anything requiring user intent (conditions, manual policies)
    

---

## 6. Minimal implementation checklist (so you can ship quickly)

1. Build graph indexes: `inEdges`, `outEdges`, reachability from Start
    
2. Run rules in order:
    
    - Structure → Type → Flow → Exec → Session → UX
        
3. Return findings sorted by:
    
    - severity desc, then rule_id, then node title
        
4. Add an “Issues” panel in Process Sidebar:
    
    - click finding → focus node on canvas
        
    - “Apply Autofix” when available
        
5. Add “Strict mode” toggle + badge display
    
