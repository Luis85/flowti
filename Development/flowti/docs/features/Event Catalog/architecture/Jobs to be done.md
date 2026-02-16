---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: Feature
---
# Jobs To Be Done — Event System

## One-Sentence JTBD Summary

> **Enable users to transform incoming files into reliable domain events that drive observable, scalable automation in Obsidian.**

## Purpose

Enable users to **react to meaningful events in Obsidian**, including high-volume external file ingestion, by transforming low-level file changes into **explicit, trustworthy domain events** that can be subscribed to and processed reliably.

---
## 🎯 Core Job (High Level)

> **When** new information enters my Obsidian system (especially from outside),  
> **I want** the system to automatically react in meaningful ways,  
> **so that** my knowledge base stays structured, actionable, and up to date without manual babysitting.

---

## 🧩 Primary Jobs to be Done

### 1. _Automated Sense-Making_

> **When** new files appear in my vault,  
> **I want** them to trigger semantic events instead of being “just files”,  
> **so that** Obsidian understands _what happened_, not only _that something changed_.

**Examples**

- `event.file.imported`
    
- `event.erp.order_received`
    
- `event.meeting.notes_created`
    
- `event.invoice.received`
    

👉 Your `type=Event` property is the key move here:  
a file becomes **a fact in the system**, not just content.

---

### 2. _Reduce Manual Work & Context Switching_

> **When** recurring reactions to new content are needed,  
> **I want** to subscribe to events once and let the system handle them,  
> **so that** I don’t repeat the same manual steps every time.

**Triggered processes**

- Auto-tagging
    
- Moving files to correct folders
    
- Creating follow-up tasks
    
- Linking to entities (Customer, Project, Order)
    
- Updating dashboards / indices
    

This is classic _“Stop being the glue”_ JTBD.

---

### 3. _Make External Systems First-Class Citizens_

> **When** files arrive from external systems (ERP, CRM, M365, Email, APIs),  
> **I want** Obsidian to treat them as business events,  
> **so that** my vault becomes a true operational cockpit, not a passive archive.

**Examples**

- ERP export → `event.order.created`
    
- Email import → `event.email.received`
    
- CSV drop → `event.report.updated`
    
- Git pull → `event.system.changed`
    

This directly fits your **WAGBOS / IBDE** mental model.

---

### 4. _User-Controlled Automation (No Magic)_

> **When** automation happens,  
> **I want** to explicitly decide which events I subscribe to,  
> **so that** I stay in control and trust the system.

Key here:

- **Event Catalog**
    
- Explicit subscriptions
    
- Transparent triggers
    

This avoids the “Obsidian plugin chaos” problem.

---

## 🧠 Knowledge Graph & State Awareness

### 5. _Track What Happened, Not Just What Exists_

> **When** I look at my vault,  
> **I want** to see a history of meaningful events,  
> **so that** I can reconstruct decisions, changes, and evolution.

Events become:

- Audit log
    
- Change history
    
- Process trace
    

Perfect for:

- ISO 9001
    
- Living documentation
    
- Decision logs
    

---

## ⚙️ Power User / Builder Jobs

### 6. _Compose My Own Workflows_

> **When** I want to build workflows,  
> **I want** events to be reusable building blocks,  
> **so that** I can combine them into larger automations over time.

Think:

- Event → Rule → Action
    
- Event → Task → Follow-up Event
    
- Event chains (sagas 👀)
    

This aligns beautifully with:

- ECS / Event Bus thinking
    
- Simulation & replay later on
    

---

### 7. _Observe & Debug My System_

> **When** automation behaves unexpectedly,  
> **I want** to inspect which events fired and why,  
> **so that** I can debug and refine my setup.

This leads naturally to:

- Event Log UI
    
- “Why did this happen?”
    
- Replay / dry-run (future)
    

---

## 🧑‍🤝‍🧑 Collaboration Jobs

### 8. _Shared Understanding in Teams_

> **When** multiple people work in the same vault or process,  
> **I want** events to express intent and meaning,  
> **so that** everyone understands what happened without explanation.

Example:

> “An `event.requirement.changed` occurred”  
> vs  
> “Someone edited a markdown file”

Huge difference.

---

## 🧱 Secondary / Enabler Jobs

These aren’t primary motivations, but they **increase adoption**:

- Avoid vendor lock-in (events are portable)
    
- Keep automation declarative
    
- Enable incremental complexity (start simple, grow powerful)
    
- Make Obsidian programmable _without_ coding for end users
    

---

## 🗂 Suggested Event Catalog Categories

This helps translate JTBD → UX:

- **File Events**  
    `file.imported`, `file.updated`, `file.deleted`
    
- **Content Semantics**  
    `note.became_event`, `property.changed`
    
- **Business Events**  
    `order.created`, `invoice.received`
    
- **Knowledge Events**  
    `decision.made`, `assumption.invalidated`
    
- **System Events**  
    `sync.completed`, `external.update_received`
    

---

## 🧠 One-Sentence Product Framing

If you ever need to explain this feature:

> _“The Event System turns Obsidian from a note-taking tool into an event-driven system that reacts to what happens, not just what exists.”_
## Target Personas

### Primary Persona — System Builder

**Context**

- Builds structured Obsidian systems
    
- Integrates external sources (OneDrive, ERP, Email, CSV exports, Git)
    
- Thinks in workflows, states, and cause–effect chains
    

**Core Need**

> “I want Obsidian to behave like a system that understands what happened.”

**Success**

- External inputs become semantic signals
    
- Automation is explicit, observable, and resilient
    

---

### Secondary Persona — Knowledge Worker

**Context**

- Receives recurring reports or datasets
    
- Wants organization without scripting
    
- Uses Obsidian daily as an operational inbox
    

**Core Need**

> “I don’t want to manually process incoming files every day.”

**Success**

- Reports are recognized and handled automatically
    
- Important changes surface without manual effort
    

---

### Tertiary Persona — Integrator / Plugin Developer

**Context**

- Builds plugins or automations
    
- Needs stable, decoupled signals
    

**Core Need**

> “I need reliable events that represent intent, not file mechanics.”

---

## Core Jobs to Be Done

---

### JTBD 1 — Detect Meaningful Events from File Activity

**When** files are created, synced, or updated in my vault  
**I want** the system to detect when these changes represent meaningful events  
**So that** I can react to intent rather than raw file operations

**Examples**

- “A new CSV report was delivered”
    
- “A note representing an event was created”
    
- “External data entered the system”
    

**Problem today**

- File creation is ambiguous
    
- Users must infer meaning manually
    

---

### JTBD 2 — Define Domain Events from Files

**When** a file enters the system  
**I want** to define a new semantic event based on its properties or contents  
**So that** external data becomes actionable knowledge

**Examples**

- CSV → `report.daily_received`
    
- File metadata → event payload
    
- Parsed CSV properties → domain fields
    

**Outcome**

- Files become _facts_
    
- Events become _signals_
    

---

### JTBD 3 — Subscribe Explicitly to Events

**When** specific events occur  
**I want** to explicitly subscribe to them  
**So that** automation is predictable, intentional, and reversible

**Design principle**

- No implicit behavior
    
- No hidden triggers
    

**User framing**

> “When this happens, I care.”

---

### JTBD 4 — Trigger Follow-Up Processes Reliably

**When** an event I care about occurs  
**I want** it to trigger follow-up processes  
**So that** repetitive reactions happen automatically

**Examples**

- Create tasks
    
- Link reports to entities
    
- Update indexes or dashboards
    
- Emit downstream events
    

---

### JTBD 5 — Handle High-Volume and Delayed Inputs Safely

**When** many files arrive at once  
**Or** files arrive while Obsidian is not running  
**I want** the system to catch up and process them safely  
**So that** no events are missed or duplicated

**Key expectations**

- Burst-safe processing
    
- Catch-up on startup
    
- No UI freezes
    
- Deterministic behavior
    

---

### JTBD 6 — Avoid Duplicate or Accidental Events

**When** files are re-synced, renamed, or re-processed  
**I want** the system to avoid emitting duplicate events  
**So that** automation remains trustworthy

**Outcome**

- Idempotent event emission
    
- Logical event identity (not just file name)
    

---

### JTBD 7 — Observe and Trust Automation

**When** automation runs or does not run  
**I want** to understand what happened and why  
**So that** I can trust, debug, and refine my setup

**Required**

- Event log
    
- Batch visibility
    
- Clear causality
    

---

### JTBD 8 — Scale Automation Incrementally

**When** my system evolves over time  
**I want** to add automation gradually  
**So that** complexity grows under control

**Outcome**

- Start with one CSV subscription
    
- Expand into ingestion pipelines
    
- Avoid brittle systems
    

---

## Supporting Jobs

### Knowledge & Documentation

- Capture events as historical facts
    
- Enable traceability and audits
    
- Support living documentation
    

### Collaboration

- Make intent explicit across teams
    
- Reduce ambiguity around changes
    
- Share semantic understanding
    

---

## Problems & Constraints to Acknowledge

### Ambiguous File Semantics

- Same file action can mean different things  
    → Require semantic markers or configuration
    

### Burst & Sync Storms

- Hundreds of files may appear at once  
    → Queueing, batching, backpressure required
    

### Partial Writes & Sync Artifacts

- Files may appear before fully written  
    → Stability windows and retries required
    

### Trust & Transparency

- Automation without visibility erodes confidence  
    → Observability is mandatory
    

---

## Non-Goals

This feature does **not** aim to:

- Replace full ETL pipelines
    
- Perform heavy analytics by default
    
- Hide system behavior
    
- Serve casual note-taking workflows
    

---

## Success Criteria

The Event System is successful when:

- Users describe workflows as  
    _“When this happens, the system reacts automatically.”_
    
- External files become domain events, not clutter
    
- No events are lost during bursts or downtime
    
- Users trust the system enough to rely on it daily
    

