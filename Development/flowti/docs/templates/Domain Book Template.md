---
type: BookTemplate
template_id: domain_book
version: 1.0
status: draft
owner:
created_at:
last_reviewed_at:
tags:
  - template
  - book
  - domain
  - documentation
---

# Domain Book Template

> A structured outline for compiling a comprehensive book that showcases a single domain. Captures purpose, boundaries, entities, events, features, flows, components, quality posture, and operational maturity in one navigable document.

---

# How to Use This Template

1. Replace `{{Domain Name}}` throughout with the actual domain name
2. Each chapter pulls from documented artifacts scattered across the docs directory
3. **Source Artifacts** sections point to where content already exists
4. Not every chapter applies to every domain — omit sections that have no content yet and note them in the Coverage Matrix
5. A domain book is both a reference and a showcase — write for someone who needs to understand *this* domain end-to-end

---

# Book Metadata

```yaml
title: "{{Domain Name}} — Domain Book"
domain_id:
product:
version:
authors:
reviewers:
audience: # e.g., domain owner | developers | stakeholders | new team members
classification: # e.g., internal | partner | public
created_at:
last_updated:
domain_maturity_level: # undefined | emerging | structured | operational | mature
```

---

# Part I — Domain Identity

---

## Chapter 1: Domain Overview

**Purpose:** Introduce the domain, establish why it exists, and frame the reader's understanding of its role within the product.

### 1.1 What Is This Domain

- Domain name and identifier
- One-paragraph description
- Core capability this domain owns
- Position within the broader product architecture

### 1.2 Why This Domain Exists

- The problem this domain solves
- The value it delivers
- What would break or be missing without it

### 1.3 Domain History

- When and why this domain was carved out
- Key decisions that shaped it (link to ADRs)
- Evolution milestones

**Source Artifacts:**
- `/domains/{{Domain Name}}.md`
- Related ADRs in `/decisions/`

---

## Chapter 2: Boundaries & Ownership

**Purpose:** Define what belongs inside this domain and what does not. Boundaries prevent scope creep and clarify contracts with neighboring domains.

### 2.1 Inside This Domain

- Entities owned
- Processes managed
- Decisions governed
- Services operated
- Data owned

### 2.2 Outside This Domain

- Responsibilities explicitly delegated to other domains
- Related domains and the nature of the relationship
- Boundaries that have been contested or clarified

### 2.3 Upstream & Downstream Dependencies

| Domain | Direction | Contract | Events Exchanged |
|--------|-----------|----------|-----------------|
| | Upstream / Downstream | | |

### 2.4 Ownership

- Domain Owner
- Technical Owner
- Product Owner
- Review Cadence

**Source Artifacts:**
- `/domains/{{Domain Name}}.md`
- Domain Documentation Template (sections 3, 4, 8)

---

## Chapter 3: Problem Space

**Purpose:** Ground the domain in user needs. Show *who* needs this domain and *what jobs* it fulfills.

### 3.1 Target Users & Personas

- Who interacts with this domain (directly or indirectly)
- Persona characteristics relevant to this domain
- Primary vs. secondary users

### 3.2 Jobs to Be Done

- User jobs this domain addresses
- Job stories in context of domain capabilities
- Prioritization by frequency and criticality

### 3.3 User Stories

- Narrative user stories specific to this domain
- Acceptance criteria per story
- Links to feature backlogs

**Source Artifacts:**
- `/personas/`
- `/jobs to be done/` (filter by domain relevance)
- `/user-stories/` (filter by domain relevance)

---

# Part II — Domain Model

---

## Chapter 4: Core Entities

**Purpose:** Document the data structures this domain owns. Entities are the nouns of the domain — the things it creates, manages, and exposes.

### 4.1 Entity Inventory

| Entity | Description | Owner | Status |
|--------|-------------|-------|--------|
| | | | |

### 4.2 Entity Definitions

For each entity, document:

- **Purpose** — What this entity represents
- **Fields** — Properties with types and constraints
- **Relationships** — Links to other entities (within and across domains)
- **Lifecycle** — States and transitions
- **Frontmatter Schema** — YAML fields for Markdown-based entities
- **Validation Rules** — Required fields, value constraints

### 4.3 Data Ownership

- Which data is authoritative in this domain
- Which data is read from upstream domains
- Data flow direction and freshness guarantees

**Source Artifacts:**
- `Data Dictionary.md` (filter by domain)
- Entity Markdown files within the domain

---

## Chapter 5: Event Contract

**Purpose:** Document the events this domain produces and consumes. Events are the verbs of the domain — the actions and facts it communicates.

### 5.1 Events Produced

| Event Name | Category | Payload | Description |
|------------|----------|---------|-------------|
| | | | |

### 5.2 Events Consumed

| Event Name | Source Domain | Reaction | Description |
|------------|-------------|----------|-------------|
| | | | |

### 5.3 Event Naming Conventions

- Naming pattern used (e.g., `domain.action` for commands, `domain.fact` for facts)
- Canonical name rules
- Type safety enforcement

### 5.4 Event Sequences

- Typical event chains within this domain
- Trigger-reaction patterns
- Cross-domain event handoffs

**Source Artifacts:**
- `Event Catalog.md` (filter by domain)
- Domain service `events.ts` source file

---

## Chapter 6: Domain Service

**Purpose:** Document the service that implements this domain's business logic. The service is the engine — it reacts to events, enforces rules, and manages state.

### 6.1 Service Overview

- Service name and registration
- Responsibility summary
- Dependencies (other services, infrastructure)

### 6.2 Service Interface

- Public methods and their purpose
- Input/output contracts
- Error handling patterns

### 6.3 Initialization & Lifecycle

- How and when the service starts
- Registration in the ServiceContainer
- Cleanup and shutdown behavior

### 6.4 State Management

- Internal state model
- Storage backend and schema
- Persistence guarantees

**Source Artifacts:**
- `Backend Architecture.md` (service section)
- Service source file

---

# Part III — Features & Capabilities

---

## Chapter 7: Feature Inventory

**Purpose:** Catalog the features that belong to this domain. Features are the capabilities the domain exposes to users.

### 7.1 Feature List

| Feature | Stage | FRI Score | Description |
|---------|-------|-----------|-------------|
| | | | |

### 7.2 Feature Maturity

- Distribution across maturity levels (L0–L5)
- Features in active development
- Features planned but not yet started

**Source Artifacts:**
- `/features/` (filter by domain-relevant folders)
- Feature databases (`.base` files)

---

## Chapter 8: Feature Details

**Purpose:** Deep-dive into each feature this domain provides. Repeat this section for every significant feature.

### 8.1 Feature Section Template

For each feature, document:

- **Problem Statement** — What problem this feature solves
- **Outcome** — What changes after implementation
- **Scope** — In scope vs. out of scope
- **Functional Requirements** — Atomic, testable behaviors
- **Data Model Impact** — Entities, fields, relationships affected
- **Event Impact** — Events produced, consumed, transformed
- **UI Entry Points** — Where and how users access this feature
- **Acceptance Criteria** — Binary pass/fail checks
- **Backlog** — Open work items and their priority

### 8.2 Feature Sections

*Repeat section 8.1 for each feature. Order by maturity or user importance.*

**Source Artifacts:**
- `/features/{{Feature Name}}/index.md`
- `/features/{{Feature Name}}/backlog/`
- Feature PRDs

---

## Chapter 9: User Journeys

**Purpose:** Walk through end-to-end workflows that involve this domain. Journeys show how features compose into real usage.

### 9.1 Journey Inventory

| Flow | Trigger | Domain Role | Stage |
|------|---------|-------------|-------|
| | | Primary / Supporting | |

### 9.2 Journey Documentation

For each flow involving this domain, document:

- **Trigger** — What initiates the journey
- **Prerequisites** — What must be true before starting
- **Steps** — Sequential walkthrough with decision points
  - View / Service involved
  - User action
  - System response
  - Events emitted
- **Outcome** — Expected end state
- **Error Paths** — What happens when things go wrong
- **Cross-Domain Handoffs** — Where control passes to another domain

**Source Artifacts:**
- `/flows/` (filter by `domains:` frontmatter containing this domain)

---

# Part IV — User Interface

---

## Chapter 10: Components

**Purpose:** Document the UI components that belong to this domain. Components are the visual building blocks users interact with.

### 10.1 Component Inventory

| Component | Type | Parent | Stage | Description |
|-----------|------|--------|-------|-------------|
| | View / Modal / Tab / Panel / Widget | | | |

### 10.2 Component Specifications

For each component, document:

- **Responsibility** — What the component does
- **Dependencies** — Interfaces, helpers, services required
- **State** — What it reads and writes
- **Renders** — UI elements and layout
- **Events** — Events consumed and produced
- **Parent/Child Relationships** — Component hierarchy

### 10.3 Component Hierarchy

- Tree view of the component structure within this domain
- Which component serves as the entry point (orchestrator view)
- Navigation paths between components

**Source Artifacts:**
- `/components/` (filter by domain tag)
- Component Library database (`.base`)

---

## Chapter 11: Navigation & Sitemap

**Purpose:** Show where this domain's UI surfaces within the product navigation. Users need to *find* the domain before they can *use* it.

### 11.1 Entry Points

- How users navigate to this domain's views
- Commands that open domain views
- Sidebar / ribbon / menu integration

### 11.2 Internal Navigation

- Tab structure within the domain's primary view
- Modal flows and their triggers
- Deep-link patterns

### 11.3 Cross-Domain Navigation

- Links to and from other domains' views
- Shared components or embedded panels

**Source Artifacts:**
- `/sitemap/`
- `Frontend Architecture.md` (navigation section)

---

# Part V — Quality & Health

---

## Chapter 12: Test Coverage

**Purpose:** Document how this domain is tested. Tests are evidence that the domain works as designed.

### 12.1 Test Inventory

| Test File | Category | Tests | Description |
|-----------|----------|-------|-------------|
| | Unit / Integration / Flow | | |

### 12.2 Test Categories

- **Service Tests** — Domain service logic
- **Component Tests** — UI component behavior
- **Event Tests** — Event production and consumption
- **Flow Tests** — End-to-end journey validation
- **Validation Tests** — Schema and rule enforcement

### 12.3 Coverage Assessment

- Covered scenarios
- Known gaps and their risk
- Critical paths that must never regress

**Source Artifacts:**
- `Testplan and Teststrategy.md` (filter by domain)
- Test source files

---

## Chapter 13: Technical Debt

**Purpose:** Maintain transparency about known issues within this domain. Debt is tracked openly so it can be managed deliberately.

### 13.1 Debt Inventory

| ID | Title | Severity | Category | Status |
|----|-------|----------|----------|--------|
| | | | | |

### 13.2 Debt by Category

- **Architecture** — Boundary violations, coupling issues
- **Performance** — Bottlenecks, missing optimization
- **Error Handling** — Swallowed errors, missing recovery
- **Concurrency** — Race conditions, timer leaks
- **Code Quality** — Naming, duplication, maintainability
- **Data Integrity** — Schema drift, validation gaps

### 13.3 Debt Trends

- New debt added in recent cycles
- Debt resolved in recent cycles
- Net debt direction (improving / stable / degrading)

**Source Artifacts:**
- `/debt/TD-*.md` (filter by domain/PRD owner)
- Technical Debt database (`.base`)

---

## Chapter 14: Domain Maturity

**Purpose:** Assess the overall health and maturity of this domain using structured scoring. Maturity drives investment decisions.

### 14.1 Maturity Dimensions

| Dimension | Score (0–5) | Evidence |
|-----------|-------------|----------|
| Purpose Clarity | | |
| Boundary Definition | | |
| Entity Modeling | | |
| Event Discipline | | |
| Documentation Coverage | | |
| Operational Alignment | | |

### 14.2 Domain Maturity Index (DMI)

- **Total Score:** /30
- **Level:** undefined | emerging | structured | operational | mature
- **Evaluated At:**
- **Evaluator:**

### 14.3 Maturity Interpretation

| DMI Score | Level | Meaning |
|-----------|-------|---------|
| 0–5 | Undefined | No real structure |
| 6–12 | Emerging | Basic documentation |
| 13–18 | Structured | Clear boundaries and entities |
| 19–24 | Operational | Events and reviews active |
| 25–30 | Mature | Stable, optimized, measurable |

### 14.4 Improvement Targets

| Weak Area | Recommended Action | Priority |
|-----------|-------------------|----------|
| | | |

**Source Artifacts:**
- Domain Documentation Template (maturity model section)
- Architecture Stability Index Template

---

# Part VI — Decisions & Evolution

---

## Chapter 15: Architecture Decisions

**Purpose:** Collect the decisions that shaped this domain. Decisions explain *why* the domain is built the way it is.

### 15.1 Decision Index

| ADR | Title | Status | Impact on Domain |
|-----|-------|--------|-----------------|
| | | accepted / superseded / deprecated | |

### 15.2 Key Decisions

For each decision relevant to this domain:

- **Context** — What situation prompted the decision
- **Decision** — What was decided
- **Rationale** — Why this option was chosen
- **Consequences** — What followed from the decision

**Source Artifacts:**
- `/decisions/ADR-*.md` (filter by domain relevance)

---

## Chapter 16: Roadmap & Backlog

**Purpose:** Show where this domain is headed. The roadmap turns current state into future vision.

### 16.1 Active Work

- Features currently in development
- Debt items being resolved
- Ongoing refactoring

### 16.2 Planned Work

- Features approved but not started
- Architectural improvements planned
- Integration milestones

### 16.3 Ideas & Exploration

- Speculative capabilities under consideration
- Research topics
- Dependencies on other domains' evolution

### 16.4 Open Questions & Risks

- Unresolved architectural questions
- Boundary conflicts with other domains
- Missing event definitions or entity models
- External dependencies or blockers

**Source Artifacts:**
- `/features/*/backlog/`
- `/ideas/`
- Backlog databases (`.base` files)

---

# Appendices

---

## Appendix A: Domain Glossary

- Domain-specific terms and definitions
- Abbreviations and acronyms
- Ubiquitous language for this bounded context

---

## Appendix B: Event Reference

- Complete event table for this domain (produced and consumed)
- Payload schemas
- Event sequence diagrams

**Source Artifacts:**
- `Event Catalog.md` (domain-specific extract)

---

## Appendix C: Entity Schema Reference

- Full field definitions for each entity
- Frontmatter YAML schemas
- Validation rules and constraints

**Source Artifacts:**
- `Data Dictionary.md` (domain-specific extract)

---

## Appendix D: Change Log

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | | | Initial edition |

---

# Compilation Notes

## Content Coverage Matrix

Track which chapters have source material ready for this domain.

| Chapter | Source Material Exists | Content Complete | Review Status |
|---------|----------------------|------------------|---------------|
| 1. Domain Overview | | | |
| 2. Boundaries & Ownership | | | |
| 3. Problem Space | | | |
| 4. Core Entities | | | |
| 5. Event Contract | | | |
| 6. Domain Service | | | |
| 7. Feature Inventory | | | |
| 8. Feature Details | | | |
| 9. User Journeys | | | |
| 10. Components | | | |
| 11. Navigation & Sitemap | | | |
| 12. Test Coverage | | | |
| 13. Technical Debt | | | |
| 14. Domain Maturity | | | |
| 15. Architecture Decisions | | | |
| 16. Roadmap & Backlog | | | |
| A. Domain Glossary | | | |
| B. Event Reference | | | |
| C. Entity Schema Reference | | | |
| D. Change Log | | | |

## Audience Variants

| Audience | Recommended Chapters |
|----------|---------------------|
| Domain Owner | All chapters |
| New Developer on Domain | 1–6, 10, 12, 15 |
| Product Owner | 1–3, 7–9, 14, 16 |
| Stakeholder / Executive | 1, 3, 7 (summary), 14, 16 |
| Neighboring Domain Team | 1–2, 5, 9 |
