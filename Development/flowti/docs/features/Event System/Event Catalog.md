# Event Catalog — Design Concept

## One-Sentence Design Summary

> **The Event Catalog is a semantic map of what can happen in the system, connecting events to meaning, domains, and documentation.**

## Purpose of the Event Catalog

From the user’s perspective, the Event Catalog answers three questions:

1. **What kinds of things can happen in my system?**
    
2. **What do these events mean?**
    
3. **Where can I learn more or act on them?**
    

It is a **map of meaning** across the system.

---

## Mental Model (User Perspective)

> “This is a glossary of things that can happen in my system — and what they belong to.”

The catalog should feel like:

- a **dictionary**
    
- a **reference manual**
    
- a **navigation hub**
    

Not like:

- a log
    
- a technical registry
    
- a developer console
    

---

## Core Design Principles

### 1. Semantic First, Technical Second

- Events are described by **what they represent**, not how they’re emitted.
    
- Technical details are available, but not dominant.
    

### 2. Domain-Oriented

- Events belong to **domains**, not folders or plugins.
    
- Domains are the user’s conceptual anchor.
    

### 3. Progressive Disclosure

- Overview first
    
- Details on demand
    
- Deep technical references one click away
    

### 4. Single Source of Truth

- The catalog is _the_ place where an event is defined and explained.
    
- Subscriptions, logs, and workflows link back here.
    

---

## High-Level Structure of the Event Catalog

### Level 1 — Catalog Overview

**Purpose**

- Orientation
    
- Discovery
    

**What the user sees**

- List or grid of **domains**
    
- Each domain shows:
    
    - name
        
    - short description
        
    - number of events
        

**Example domains**

- Files & Vault
    
- Ingestion
    
- Reports
    
- Knowledge
    
- Projects
    
- System
    

---

### Level 2 — Domain Page

**Purpose**

- Context
    
- Understanding scope
    

**Contents**

- Domain description (plain language)
    
- What kind of events belong here
    
- Related domains
    
- List of events in this domain
    

**Example**

> **Reports**  
> Events related to incoming, updated, or derived reports from external systems.

---

### Level 3 — Event Detail Page (Core Artifact)

This is the heart of the catalog.

---

## Event Detail Page — Recommended Sections

### 1. Event Header

- **Event Name**
    
    - human-readable title
        
    - canonical identifier (secondary)
        
- **Domain**
    
- **Stability**
    
    - stable / evolving / experimental
        
- **Visibility**
    
    - user-facing / system-internal
        

---

### 2. Description (Non-Technical)

**Plain language explanation**

> “This event occurs when a new daily report is delivered to the system.”

This should answer:

- What happened?
    
- Why does this event exist?
    

---

### 3. When This Event Occurs

Describe triggering situations in **human terms**:

- “A new CSV report is synced into the vault”
    
- “Multiple reports arrive at once”
    
- “Reports are detected during catch-up after downtime”
    

Avoid technical phrasing here.

---

### 4. Why This Event Matters

Explain:

- What decision or reaction this event enables
    
- Why a user might care
    

Example:

> “This event allows you to automatically process daily reports without manually checking folders.”

---

### 5. Typical Use Cases

Concrete, recognizable scenarios:

- Create follow-up tasks
    
- Update dashboards
    
- Link reports to projects
    
- Notify or log changes
    

This helps users _immediately imagine value_.

---

### 6. Payload Overview (Abstracted)

Describe **what kind of information** the event carries — not raw schemas.

Example:

- report metadata (date, source)
    
- file reference
    
- summary values
    

Optionally:

- expandable “technical payload” section
    

---

### 7. Subscription Guidance

This section is critical.

Answer:

- When should I subscribe to this?
    
- When should I not?
    

Example:

> Subscribe to this event if you receive recurring reports and want consistent handling.  
> Do not subscribe if reports are ad-hoc or manually reviewed.

---

### 8. Related Events

Help users navigate meaning:

- Preceding events
    
- Derived events
    
- Follow-up events
    

Example:

- `file.created`
    
- `ingestion.job.succeeded`
    
- `report.daily_processed`
    

This builds an **event graph** in the user’s head.

---

### 9. Related Domains & Services

This is where the Catalog becomes a **documentation hub**.

Link to:

- Domain documentation
    
- Service descriptions
    
- Data models
    
- Processes
    

Example:

- Reports Domain
    
- Ingestion Service
    
- CSV Import Guidelines
    

---

### 10. Operational Notes (Optional / Collapsible)

For advanced users:

- Idempotency behavior
    
- High-volume considerations
    
- Known edge cases
    

Keep this **out of the way by default**.

---

## Event Categorization Dimensions

Each event can be classified along multiple axes:

### Domain

- Files
    
- Ingestion
    
- Reports
    
- Knowledge
    
- System
    

### Event Type

- System Event
    
- Domain Event
    
- Derived Event
    

### Stability

- Stable
    
- Evolving
    
- Experimental
    

### Source

- Internal
    
- External
    
- User-defined
    

This enables:

- filtering
    
- future governance
    
- safe evolution
    

---

## Navigation & Cross-Linking

The Event Catalog should be **deeply linked**:

- Subscriptions link → Event Detail
    
- Event Log entries link → Event Detail
    
- Domain pages link → Events
    
- Events link → Domain docs
    

This turns the catalog into a **knowledge graph**, not a flat list.

---

## What the Event Catalog Is _Not_

Be explicit in design:

- Not a log
    
- Not a workflow editor
    
- Not a technical API reference only
    
- Not plugin-specific
    

It describes **what can happen**, not **what just happened**.

---

## Success Criteria for the Event Catalog

The catalog is successful when users can:

- Explain what an event means without reading code
    
- Decide whether to subscribe confidently
    
- Discover related concepts naturally
    
- Navigate from an event to deeper documentation
    
- Trust the system’s vocabulary
    

