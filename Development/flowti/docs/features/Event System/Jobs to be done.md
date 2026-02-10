# Jobs To Be Done — Event System

## One-Sentence JTBD Summary

> **Enable users to transform incoming files into reliable domain events that drive observable, scalable automation in Obsidian.**

## Purpose

Enable users to **react to meaningful events in Obsidian**, including high-volume external file ingestion, by transforming low-level file changes into **explicit, trustworthy domain events** that can be subscribed to and processed reliably.

---

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
    

