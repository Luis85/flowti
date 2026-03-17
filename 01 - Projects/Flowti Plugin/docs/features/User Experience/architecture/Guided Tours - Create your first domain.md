---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: Feature
stage: draft
owner:
related_hubs:
  - User Hub
  - Areas Hub
  - Event Catalog
related_events:
  - domain.created
  - domain.documented
  - area.saved
  - hub.registered
  - documentation.session.completed
tags:
  - onboarding
  - domain-modeling
  - areas
  - guided-tour
---

# Feature PRD: Guided Tour – Create Your First Domain

---

# 1. Executive Summary

The **Guided Tour: Create Your First Domain** helps users model and document their first business domain inside Flowti.

It guides them step-by-step to:

- Define a domain (bounded context)
- Document its purpose and responsibilities
- Identify core entities and events
- Assign ownership
- Generate a Domain Hub
- Automatically persist the domain into `02 - Areas`
- Connect it to the Event Catalog
- Enrich the Knowledge Graph

The goal is to help the user **start building their own documentation systematically**, not just create structure.

This is a foundational onboarding flow.

---

# 2. Problem Statement

Users entering Flowti often:

- Do not know how to define a “Domain”
- Start creating random notes instead of structured Areas
- Fail to define boundaries and ownership
- Do not link domains to events
- Build documentation without structure

We need a guided, structured, interactive flow that:

- Teaches domain thinking
- Creates real artifacts
- Persists documentation in `02 - Areas`
- Registers a new Hub automatically
- Encourages event discipline

---

# 3. Vision

> A Domain is a bounded context.
> It defines responsibility.
> It owns entities.
> It emits and consumes events.

This guided tour should:

- Teach the mental model
- Create a documented domain
- Generate a functioning Domain Hub
- Update the Event Catalog

After completion, the user has:

- One documented Area
- One active Hub
- Linked entities and draft events
- Structured documentation

---

# 4. Strategic Positioning

This feature is:

- Onboarding-critical
- Structural foundation
- Documentation accelerator
- Knowledge Graph bootstrap

It complements:

- Guided Tour: First Feature
- Story Mapping Tool
- Documentation Sessions

---

# 5. Scope

## In Scope (v1)

- Interactive guided flow
- Domain definition form
- Responsibility documentation
- Ownership definition
- Entity brainstorming
- Event brainstorming
- Markdown generation
- Save domain into `02 - Areas`
- Auto-register Hub
- Update Knowledge Graph

## Out of Scope (v1)

- Cross-domain validation
- AI auto-generated domain models
- Advanced DDD validation
- Multi-user approval workflow

---

# 6. Functional Requirements

---

## 6.1 Tour Orchestration

- [ ] User can start “Create Your First Domain” from User Hub
- [ ] Tour progress is saved and resumable
- [ ] Steps are sequential but skippable (with warning)
- [ ] Final step enforces documentation completeness check

---

## 6.2 Step 1 – Domain Identity

User defines:

- Domain Name
- Short Description
- Why it exists
- Primary responsibility
- Owner (person/team)

Output:

- Draft Domain Markdown note
- Frontmatter scaffold

Example frontmatter:

```yaml
type: Domain
domain_id:
description:
owner:
created_at:
status: draft
````

---

## 6.3 Step 2 – Boundary Definition

User defines:

- What belongs to this domain
    
- What does NOT belong
    
- External dependencies
    
- Upstream/downstream domains
    

Output:

- Boundary section in domain note
    
- Optional links to other Areas
    

---

## 6.4 Step 3 – Core Entities

User identifies:

- Key entities (Products, Orders, Contracts, etc.)
    
- Short description per entity
    
- Entity ownership
    

Output:

- Entity stubs generated as Markdown files
    
- Linked to domain
    
- Registered in Knowledge Graph
    

---

## 6.5 Step 4 – Events

User identifies:

- Events this domain emits
    
- Events this domain consumes
    

Output:

- Draft event files (optional)
    
- Linked to domain
    
- Registered in Event Catalog
    
- Marked as `draft_event`
    

---

## 6.6 Step 5 – Documentation Completion

Checklist:

-  Description filled
    
-  Boundaries defined
    
-  At least 1 entity created
    
-  At least 1 event defined
    
-  Owner assigned
    
-  Domain saved in `02 - Areas`
    
-  Hub created
    

Mandatory final checkbox:

-  Documentation updated and reviewed
    

---

## 6.7 Persistence

On completion:

- Create domain note in:
    
    ```
    02 - Areas/<DomainName>.md
    ```
    
- Create related entity files (in domain folder or entity folder)
    
- Register new Hub
    
- Emit:
    
    - `domain.created`
        
    - `hub.registered`
        
    - `area.saved`
        

---

# 7. UI Composition

Primary entry point: **User Hub → Dashboard**

Layout:

- Use `SessionFocusLayout`
    

```
DomainTourView
├─ TourHeader (progress indicator)
├─ StepContentRegion
├─ ChecklistRegion
└─ ArtifactPreviewRegion
```

Each step:

- Instruction block
    
- Inline editor
    
- Save/Next
    
- “Why this matters” explanation
    

---

# 8. Hub Integration

After completion:

- New Hub appears in LeftRail
    
- Hub type: `user`
    
- Adapter: `DomainHubAdapter`
    
- HubDashboard initialized
    
- DomainTab prefilled
    

The new hub must:

- Show created entities
    
- Show linked events
    
- Show documentation coverage
    

---

# 9. Data Model

## Domain

```
domain_id
name
description
owner
responsibilities[]
exclusions[]
linked_entities[]
linked_events[]
created_at
```

## TourRun

```
tour_run_id
user_id
tour_type: create_first_domain
current_step
completed_steps[]
linked_domain_id
status
```

---

# 10. Event Impact

Emits:

- `domain.created`
    
- `domain.updated`
    
- `entity.stub.created`
    
- `event.draft.created`
    
- `hub.registered`
    

Consumes:

- `doc.created`
    
- `doc.updated`
    
- `knowledgeGraph.updated`
    

---

# 11. Non-Functional Requirements

- Idempotent artifact creation
    
- No duplicate domain names
    
- Performance: no full vault scan required
    
- Event-driven updates only
    
- Markdown-first storage
    
- Deterministic folder placement
    
- Hub registration atomic
    

---

# 12. UX Requirements

- Clear explanation of bounded context
    
- Examples provided
    
- Not overwhelming
    
- Encourages minimal viable documentation
    
- Shows progress clearly
    
- Avoids bureaucratic feeling
    

---

# 13. Risks

|Risk|Mitigation|
|---|---|
|User overwhelmed by DDD terminology|Provide simplified explanations|
|Too much structure|Keep v1 minimal|
|Duplicate domains|Name validation|
|Users skip events step|Require at least 1 event|
|Hub registration failure|Transaction-like artifact creation|

---

# 14. Acceptance Criteria

-  User can start domain creation tour
    
-  Domain note created in `02 - Areas`
    
-  Entity stubs created
    
-  Event stubs created
    
-  Hub automatically registered
    
-  Domain visible in Areas Hub
    
-  Knowledge graph updated
    
-  Documentation checklist enforced
    

---

# 15. Definition of Done (v1)

-  Tour implemented
    
-  Markdown generation working
    
-  Folder structure correct
    
-  Hub registration working
    
-  Entity stub generation working
    
-  Draft event generation working
    
-  Tests for DomainTourService
    
-  Documentation updated
    

---

# 16. Conceptual Summary

This feature transforms:

```
Empty Vault → First Bounded Context → Structured Domain → Active Hub
```

It turns onboarding into:

- Documentation
    
- Structure
    
- Events
    
- Ownership
    
- Knowledge Graph growth
    

It teaches Flowti’s mental model through creation.
