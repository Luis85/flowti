---
type: DomainTemplate
domain_id:
description:
owner:
status: draft
created_at:
last_reviewed_at:
related_domains:
related_hubs:
tags:
  - domain
---

# {{Domain Name}}

> A bounded context that owns responsibility over {{core capability}}.

---

# 1. Purpose

## Why does this domain exist?

Describe:

- The core problem this domain solves
- The value it delivers
- The primary capability it owns

---

# 2. Responsibilities

## This domain is responsible for:

- Responsibility 1
- Responsibility 2
- Responsibility 3

Be explicit. Avoid overlaps.

---

# 3. Boundaries

## Inside this domain

What belongs here?

- Entities or Props
- Processes
- Decisions
- Services
- Products
- Data ownership and Interfaces
- Systems and relations

## Outside this domain

What does NOT belong here?

- Related domains
- Responsibilities delegated elsewhere

---

# 4. Ownership

- Domain Owner:
- Technical Owner:
- Product Owner:
- Review Cadence:

---

# 5. Core Entities

| Entity | Description | Owner | Status |
|--------|------------|-------|--------|
| | | | draft |

Each entity must:

- Have its own Markdown file
- Be linked to events
- Be part of Knowledge Graph

---

# 6. Domain Events

## Emits

- event.name.created
- event.name.updated

## Consumes

- upstream.event.name

Each event should:

- Follow naming convention
- Be registered in Event Catalog
- Be linked to at least one entity

---

# 7. Event Flow Overview

Describe:

- Typical lifecycle inside this domain
- Event sequence patterns
- Trigger → Reaction chains

Optional: link to Story Map or Session artifacts.

---

# 8. External Dependencies

| Domain | Type | Description |
|--------|------|------------|
| | Upstream / Downstream | |

Clarify contracts:

- What events are exchanged?
- Who owns data?

---

# 9. Documentation & Artifacts

| Artifact | Path | Last Updated |
|----------|------|-------------|
| PRDs | | |
| Story Maps | | |
| Technical Reviews | | |
| Session Artifacts | | |

---

# 10. Open Questions / Risks

- Open architectural risks
- Undefined ownership
- Boundary conflicts
- Missing event definitions

---

# 11. Review Log

| Date | Reviewer | Notes | Maturity Score |
|------|----------|-------|----------------|

---

# 12. Domain Maturity Model

This domain is evaluated across structural and operational dimensions.

---

## 12.1 Scoring Scale

| Score | Meaning |
|-------|--------|
| 0 | Undefined |
| 1 | Informal |
| 2 | Documented |
| 3 | Structured |
| 4 | Operational |
| 5 | Mature & Optimized |

---

## 12.2 Maturity Dimensions

### A) Purpose Clarity

- Is the domain purpose clearly articulated?
- Is responsibility explicit?
- Are overlaps minimized?

Score: 0–5

---

### B) Boundary Definition

- Are inclusions/exclusions defined?
- Are upstream/downstream dependencies explicit?
- Are contracts event-based?

Score: 0–5

---

### C) Entity Modeling

- Are core entities documented?
- Are entities linked to events?
- Are entity ownership and status defined?

Score: 0–5

---

### D) Event Discipline

- Are emitted/consumed events defined?
- Are names canonical?
- Are events registered in Event Catalog?
- No duplicate semantics?

Score: 0–5

---

### E) Documentation Coverage

- PRDs linked?
- Story Maps linked?
- Sessions documented?
- Review cadence defined?

Score: 0–5

---

### F) Operational Alignment

- Is the domain actively used?
- Are real events flowing?
- Is there feedback from implementation?
- Are technical reviews conducted?

Score: 0–5

---

## 12.3 Maturity Calculation

Maximum Score = 30

```

Domain Maturity Index (DMI) = Sum(A–F)

````

---

## 12.4 Maturity Levels

| DMI Score | Level | Meaning |
|------------|--------|--------|
| 0–5 | 🌑 Undefined | No real structure |
| 6–12 | 🌘 Emerging | Basic documentation |
| 13–18 | 🌓 Structured | Clear boundaries + entities |
| 19–24 | 🌔 Operational | Events + reviews active |
| 25–30 | 🌕 Mature | Stable, optimized, measurable |

---

## 12.5 YAML Block for Tracking

```yaml
domain_maturity:
  version: 1.0
  evaluated_at:
  reviewer:

  purpose_clarity: 0
  boundary_definition: 0
  entity_modeling: 0
  event_discipline: 0
  documentation_coverage: 0
  operational_alignment: 0

  total_score: 0
  max_score: 30
  level: undefined | emerging | structured | operational | mature

  improvement_targets:
    - 
````

---

## 12.6 Improvement Guidance

If score is low:

|Weak Area|Recommended Action|
|---|---|
|Purpose|Run a Domain Session|
|Boundaries|Map upstream/downstream|
|Entities|Conduct entity modeling session|
|Events|Run Event Storming|
|Documentation|Link missing artifacts|
|Operational|Conduct Three Amigos Review|

---

# Conceptual Summary

A Domain is:

- A bounded responsibility
    
- A set of entities
    
- A producer/consumer of events
    
- A documented capability
    
- A Hub in Flowti
    
- A node in the Knowledge Graph
    

This template ensures:

- Structural clarity
    
- Event integrity
    
- Ownership visibility
    
- Measurable maturity
    
- Continuous improvement
    
