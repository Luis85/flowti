---
type: Process
domain: Flowti/Process
stage: draft
version: 1
review_cycle: quarterly
tags:
  - process
  - lifecycle
  - quality
  - delivery
---

# Flowti Development Lifecycle

> **Answered**: The [[Feature Lifecycle PRD]] implements this process as a first-class Flowti domain. PRDs flow through 6 stages (idea → draft → approved → in-progress → review → done), gate readiness is computed automatically, sessions track progress, and FRI/TASM scores enforce quality.

> Objective: 
> 1. Make this document processable by Flowti to document the domain and as codified process inside the plugin — **see [[Feature Lifecycle PRD]] for implementation**
> 2. Auto-Generate this Document out of settings

## 1. Purpose

This process defines how Flowti turns **feedback and ideas** into **tested, documented, published increments**.

It ensures:
- customer alignment
- event-driven architectural integrity
- continuous documentation
- predictable quality gates
- repeatable release outcomes

In short: We document a new solution-idea as [[PRD Template|PRD]], review and refine that PRD during discovery while developing the solution incrementally and in parallel, Flowti supports us by keeping track of undocumented Features and our learnings, each increment must run trough a extensive [[Three Amigos Session Template|Three Amigos Review Session]] where technical-debt and deviations get collected and documented for further improvements. Imagine PRDs as tokens trough the process. Each Phase Gate triggers a thorough review from the three amigos to ensure quality over time.

---

## 2. Roles and Responsibilities

### 2.1 Core Roles

| Role | Primary Responsibilities |
|------|--------------------------|
| Product (PM/PO) | Vision, outcomes, scope, prioritization, stakeholder alignment |
| Engineering (Dev) | Architecture, implementation, testing, performance, maintainability |
| UX | Interaction design, usability, workflow clarity, IA & discoverability |
| QA / Quality | Test strategy execution, regression prevention, quality gates |
| Tech Lead / Architect | Architectural coherence, boundaries, reviews, constitution enforcement |
| Documentation Owner | Ensures docs reflect reality; coordinates updates & structure |
| Customer/User Representative | Feedback, validation, acceptance, workflow verification |

### 2.2 RACI (per increment)

| Activity | Product | Eng | UX | QA | Architect | Doc Owner | Customer |
|----------|--------:|----:|---:|---:|----------:|----------:|---------:|
| Define problem & outcome | A | C | C | C | C | C | C |
| Create PRD | A | C | C | C | C | C | C |
| Technical review | C | R | C | C | A | C | - |
| Design solution | C | C | A/R | C | C | C | C |
| Implement | - | A/R | C | C | C | - | - |
| Write tests (TDD) | - | A/R | - | C | C | - | - |
| Validate & integrate | - | R | - | A/R | C | - | - |
| Publish & release notes | A | R | C | C | C | A/R | C |

Legend: R=Responsible, A=Accountable, C=Consulted

---

## 3. Principles

- Event Catalog is **source of truth**
- Hubs are **workspaces** (User Hub + Domain Hubs + System Hubs)
- UI is **configuration-driven** (tabs/layouts/manifests)
- Domain logic lives in **adapters/services**, not UI
- Every increment is:
  **implemented + tested + documented + published**
- Quality is enforced via:
  **TestPlan**, **Technical Review**, **Three Amigos**

---

## 4. Lifecycle Overview

### 4.1 Phases

1) Feedback & Idea Intake  
2) Discovery (problem space)  
3) Solution Exploration  
4) Solution Design + PRD Drafting  
5) PRD → Development Ready  
6) Delivery Planning + Chunking  
7) Iterative Implementation (increments)  
8) Review + Quality Assurance  
9) Documentation + Publication  
10) Post-Release Feedback Loop

---

## 5. Phase Details

### Phase 1 — Feedback & Idea Intake

**Inputs**
- customer feedback (captured as User Stories while using existing solutions)
- user issues
- Three Amigos findings
- tech debt review
- telemetry/usage signals (if available)

**Primary feedback mechanism: User Stories**
Feedback is captured primarily through **User Stories** that emerge while users work with existing solutions. When a user encounters friction, discovers a gap, or imagines an improvement, the observation is documented as a User Story linked to the affected Domain and Actor. This keeps feedback grounded in real usage rather than abstract feature requests.

**Activities**
- observe Jobs to be done by Actors within a Domain
- capture the observation as a User Story (user voice)
- link the story to affected hubs/domains/actors
- initial hypothesis: "what improvement do we expect?"

**Outputs**
- User Stories (linked to domain + actor + evidence)
- initial priority signal

**Quality Gate**
- Is this a real problem or a symptom?

---

### Phase 2 — Discovery (Problem Space)

**Goal**
- understand the problem and constraints before designing solutions

**Activities**
- stakeholder interviews / customer sync
- review existing behavior + workflows
- map impacted domains (bounded contexts)
- identify acceptance constraints (performance, compatibility, maintainability)

**Outputs**
- problem statement
- success outcomes (measurable)
- initial scope boundaries

**Gate**
- Problem and outcome must be written (not assumed).

---

### Phase 3 — Solution Exploration

**Activities**
- explore alternatives (2–3 options)
- align with architecture constraints (Event Catalog, adapters, manifests)
- early UX sketching
- risk identification

**Outputs**
- solution options + tradeoffs
- preferred direction

**Gate**
- solution must not violate architecture principles.

---

### Phase 4 — Solution Design + PRD Drafting

**Activities**
- PRD one-pager created
- define:
  - functional requirements
  - event impact (produced/consumed)
  - data model impact
  - hub entry points
  - UI layout impact (tabs/layouts/regions)

**Outputs**
- PRD draft
- initial tab definition (if UI change)
- initial adapter method list

**Gate**
- PRD must be reviewable by Engineering + UX + QA.

---

### Phase 5 — PRD → Development Ready

**Activities**
- refine requirements into testable acceptance criteria
- confirm architecture seams:
  - layout vs domain vs adapter
  - manifest changes
- confirm test approach aligns with TestPlan
- align with customers/users (expectations + acceptance)

**Outputs**
- PRD at “development_ready”
- Feature Readiness metrics block filled (FRI)
- Technical Review done (pass/conditional/fail)

**Gate**
- Technical Review must be ✅ Pass or ⚠ Conditional Pass with actions.

---

### Phase 6 — Delivery Planning + Chunking

**Goal**
- break PRD into vertical slices / manageable increments

**Activities**
- define increments by value
- identify dependencies
- define test coverage per slice
- define doc updates per slice

**Outputs**
- increment plan (slices)
- each slice has:
  - scope
  - acceptance criteria
  - test intent
  - documentation intent

**Gate**
- slices must produce end-to-end value, not partial infrastructure only.

---

### Phase 7 — Iterative Implementation (Increments)

**Activities per increment**
- implement via TDD where possible
- maintain architectural boundaries
- update manifests when needed:
  - layout-manifest
  - component-manifest
  - tab definitions
- emit/consume events via EventBus
- ensure vault artifacts are created/updated correctly

**Outputs**
- working increment
- tests passing
- docs updated alongside work (no “later”)

**Gate**
- build pipeline passes: tests → typedoc → tsc → eslint → esbuild

---

### Phase 8 — Review + Quality Assurance

**Activities**
- code review
- regression checks
- integration flow checks
- Three Amigos (regular cadence, not only at release)
- update tech debt register if shortcuts were needed

**Outputs**
- validated increment
- discovered improvements captured
- updated quality score (TASM) if applicable

**Gate**
- no increment is “done” without tests + docs.

---

### Phase 9 — Documentation + Publication

**Activities**
- finalize PRD status
- update:
  - feature docs
  - architecture docs (if impacted)
  - manifests and schemas
  - release notes (if release boundary)
- publish increment (plugin release or internal publish)
- ensure documentation is discoverable from hubs/catalog

**Outputs**
- published increment
- release note (if applicable)
- updated documentation

**Gate**
- documentation must reflect current behavior.

---

### Phase 10 — Post-Release Feedback Loop

**Activities**
- collect feedback as User Stories while users work with the published solution
- monitor issues and friction points observed in real usage
- schedule improvements based on captured stories
- incorporate findings into next cycle (new Phase 1 inputs)

**Outputs**
- User Stories (the primary feedback artifact — grounded in real usage)
- new inputs to Phase 1

---

## 6. Ceremonies (Cadence)

| Ceremony | Frequency | Purpose | Output |
|----------|----------:|---------|--------|
| Customer/User Sync | weekly/biweekly | validate outcomes & direction | feedback items |
| Three Amigos Review | biweekly/monthly | quality + drift detection | score + improvements |
| Technical Review | per feature | architecture gate | pass/conditional/fail |
| Increment Review | per slice | accept increment | accepted slice |
| Documentation Review | per release | docs alignment | updated docs |

---

## 7. Quality Gates Summary

- Feature Readiness Index required before implementation
- Technical Review checklist required before “approved”
- TestPlan strategy enforced (build gate)
- Three Amigos scoring used for ongoing quality health
- Documentation update is mandatory at every increment boundary

---

## 8. Artifacts (Outputs by Phase)

| Phase | Core Artifacts |
|------:|----------------|
| 1 | Idea record, evidence links |
| 2 | Problem statement, outcome, constraints |
| 3 | Solution options, tradeoffs |
| 4 | PRD draft + initial UI/adapter plan |
| 5 | PRD dev-ready + FRI + technical review |
| 6 | Increment plan (slices) |
| 7 | Code + tests + doc updates + manifest updates |
| 8 | Review notes, QA results, TASM score |
| 9 | Release note, updated docs, published increment |
| 10 | Feedback records + next iteration inputs |
All bundled and linked into the original PRD.

---

## 9. Definition of Done (Increment)

An increment is “Done” only if:

- [ ] Acceptance criteria met
- [ ] Tests added/updated according to TestPlan
- [ ] Build pipeline passes
- [ ] Documentation updated (PRD + user-facing + architecture if impacted)
- [ ] Manifests updated (layout/component/tab) if impacted
- [ ] No architectural boundary violations introduced
- [ ] Improvement items captured (if found)

---

## 10. Mental Model — From Domain to Delivery

This section describes the conceptual flow that drives the entire lifecycle. It answers: *How does an observation in a domain become a delivered solution?*

### The Starting Point: A Domain

Everything begins inside a **Domain** — a bounded context where real work happens. Domains are the natural unit of organization in Flowti. They have Actors, Services, Events, and documented knowledge.

### Observe: Jobs to be Done

While working inside a Domain, we **discover or observe Jobs to be Done** performed by **Actors**. These are the real tasks, workflows, and struggles that people encounter. We don't invent problems in the abstract — we observe them in context.

A user struggling to find related events. An architect unable to trace a file operation. A maintainer who can't tell which docs are stale. These are Jobs to be Done that signal an opportunity.

### Capture: User Voice as User Stories

When we observe a Job to be Done, we capture the **User Voice** as a **User Story**. User Stories are the primary feedback artifact throughout the lifecycle — not just at the beginning. They emerge continuously as users work with existing solutions.

> "As a vault maintainer, I want to see where each feature stands so that I can decide what to work on next."

User Stories are grounded in real usage. They carry the Actor's perspective, the context of the Domain, and the friction that triggered the observation.

### Define: PRD as Solution Boundary

When enough User Stories cluster around a common problem, we define a **Solution** and document it as a **PRD** (Product Requirements Document).

A PRD is **tool-agnostic** in its first draft. Before thinking about tabs, events, or adapters, we:

1. **Scope the Domain** — which bounded context does this problem live in?
2. **Define the Problem** — what breaks, who is affected, why it matters?
3. **Set Boundaries** — what's in scope, what's deliberately excluded?

The PRD defines a single solution for a single problem. It doesn't prescribe implementation yet — it captures *what* needs to change and *why*.

### Name: Solution as Product

As the PRD matures, we give the Solution a **Product Name**. This name becomes the anchor for all related artifacts. A PRD can be **attached to a Product** later — Products are the user-facing containers that group related solutions.

The relationship: **Products contain Features, Features are defined by PRDs, PRDs solve problems observed through User Stories.**

### Decompose: Features → PBIs → Use Cases

Once the PRD is scoped:

1. **Break into Features** — identify the distinct capabilities the solution provides
2. **Chunk into PBIs** (Product Backlog Items) — each PBI is a vertical slice of value that can be implemented, tested, and documented independently
3. **Design Use Cases** — each PBI drives one or more Use Cases that describe the user's interaction step by step
4. **Link User Stories** — each PBI and Use Case traces back to the User Stories that motivated it

### The Decomposition Hierarchy

```
Domain
└── Jobs to be Done (observed from Actors)
    └── User Stories (captured user voice)
        └── Solution / PRD (tool-agnostic problem boundary)
            └── Product (named solution, user-facing container)
                └── Features (distinct capabilities)
                    └── PBIs (vertical slices of value)
                        └── Use Cases + User Stories (interaction design)
```

### The Feedback Loop

The hierarchy is not a one-way waterfall. At every level, **User Stories flow back up**:

- Using the delivered Use Case generates new User Stories (friction, improvements, ideas)
- New stories may refine the PBI, expand the Feature, or spawn an entirely new PRD
- The Domain's documented knowledge grows with every cycle

This is why PRDs are **tokens through the process** — they carry context forward and accumulate knowledge as they advance through stages. And this is why **Sessions** matter: each session picks a PRD, advances it one step, and the work done is documented automatically. Knowledge builds over time.

---

## 11. Appendix

- [[Testplan and Teststrategy]]
- [[Three Amigos Session Template]]
- [[PRD Template]]
- [[Feature Lifecycle PRD]]


