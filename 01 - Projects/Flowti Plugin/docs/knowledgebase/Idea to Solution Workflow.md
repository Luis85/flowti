---
type: Process
domain: Flowti/Process
stage: draft
version: 1
review_cycle: quarterly
tags:
  - process
  - workflow
  - lifecycle
  - end-to-end
---

# Idea to Solution — End-to-End Workflow

> This document is the single reference for the complete Flowti delivery workflow. It traces an idea from raw capture through structured delivery to post-release feedback, linking every phase to its governing process, quality instrument, artifact, template, and session type.

---

## 1. Purpose

This workflow answers a single question: **How does a raw idea become a delivered, documented, tested solution in Flowti?**

The answer is a 7-stage pipeline. Each stage has:
- **Inputs** — what enters the stage
- **Activities** — what happens
- **Quality gates** — what must be true before moving forward
- **Outputs** — what the stage produces
- **Artifacts** — which document types are created or updated
- **Session type** — which Flowti session type supports the work

The workflow is designed to be:
- **Traceable** — every artifact links back to the original idea
- **Incremental** — value is delivered in vertical slices, not big-bang releases
- **Quality-gated** — no stage transition without explicit verification
- **Session-driven** — every stage of work happens inside a Flowti session

---

## 2. Workflow Overview

```
Stage 1    Stage 2      Stage 3       Stage 4       Stage 5        Stage 6       Stage 7
CAPTURE → DISCOVER → DESIGN PRD → PLAN DELIVERY → IMPLEMENT → REVIEW & SHIP → FEEDBACK
  │          │            │             │              │              │              │
  │          │            │             │              │              │              │
Inbox     Enriched    PRD (dev-     Cycle Plan +   Working       Published      User Stories
Note      Idea +      ready) +     Increment      Increment +   Increment +    (next cycle
          JTBD +      FRI +        Plans          Tests +       Updated        inputs)
          User        Technical                   Docs          Docs +
          Stories     Review                                    TASM Score
```

### Stage Map

| # | Stage | Process Document | Quality Gate | Key Artifact | Template | Session Type |
|---|-------|-----------------|--------------|--------------|----------|-------------|
| 1 | Capture & Ingest | [[Idea Lifecycle]] §1-2 | Problem must be written | Inbox Note (enriched) | — | `documentation` |
| 2 | Discover & Qualify | [[Idea Lifecycle]] §3-5 | Three Amigos qualification | Qualified Idea + JTBD + User Stories | [[JTBD Template]], [[User Story Template]] | `requirements-refinement` |
| 3 | Design PRD | [[Development Lifecycle]] §4-5 | FRI ≥ 19/35 + Technical Review Pass | PRD (development-ready) | [[PRD Template]] | `service-design` |
| 4 | Plan Delivery | [[Delivery Planning]], [[Definition of Ready (Cycle)]] | DoR checklist satisfied | Cycle Plan + PBIs + Increment Plans | [[Cycle Planning Template]], [[Product Backlog Item Template]], [[Increment Template]] | `backlog-structuring` |
| 5 | Implement | [[Increment Lifecycle]] §B, [[Development Lifecycle]] §7 | Build pipeline green | Working increment + tests | [[Increment Template]] | `documentation` |
| 6 | Review & Ship | [[Increment Lifecycle]] §C-E, [[Definition of Done (Cycle)]] | TASM ≥ 19/35 + DoD checklist | Published increment + review | [[Three Amigos Session Template]] | `requirements-refinement` |
| 7 | Feedback | [[Development Lifecycle]] §10 | Feedback captured as User Stories | User Stories + next cycle inputs | [[User Story Template]] | `documentation` |

---

## 3. Stage 1 — Capture & Ingest

> **Process**: [[Idea Lifecycle]] Steps 1-2
> **Session type**: `documentation`

### What Happens

An idea is born. Someone observes a Job to be Done, encounters friction, or imagines an improvement. The idea is captured as a Markdown file in the inbox — zero friction, no formatting required.

A documentation session is started with the idea note as the focus file. Within that session, the idea is enriched: problem statement clarified, domain identified, context added, potential business value assessed.

### Inputs

| Input | Source |
|-------|--------|
| Raw observation or idea | User, stakeholder, Three Amigos finding, tech debt review |

### Activities

1. Create Markdown file in `/00 - Connectivity/inbox/`
2. Start a documentation session from the inbox note (context binding)
3. Clarify the problem statement
4. Add affected domain and stakeholders
5. Add potential business value
6. Assign priority (`0-low`, `01-medium`, `2-high`) and optional rank (`0-5`)
7. Set `stage: discovery`

### Quality Gate

- Is this a real problem or a symptom?
- Problem statement must be written, not assumed

### Outputs

| Artifact | Type | Template |
|----------|------|----------|
| Enriched Idea Note | Inbox Note | — (frontmatter schema only) |

### Frontmatter After Stage 1

```yaml
type: idea
stage: discovery
domain: <affected domain>
priority: 01 - medium
rank: null
```

### Traceability

The inbox note is a **permanent anchor**. It is never moved, deleted, or locked. All subsequent work — sessions, backlog items, PRDs, increments — traces back to this note.

---

## 4. Stage 2 — Discover & Qualify

> **Process**: [[Idea Lifecycle]] Steps 3-5
> **Session type**: `requirements-refinement`

### What Happens

The idea is typed (feature, improvement, technical enabler, etc.), structured according to its type's required sections, and submitted for Three Amigos qualification. Jobs to be Done and User Stories are documented to ground the idea in real user needs.

### Inputs

| Input | Source |
|-------|--------|
| Enriched Idea Note | Stage 1 |
| Domain knowledge | Stakeholder interviews, existing workflows |

### Activities

1. **Type the idea** — assign a type (feature, improvement, technical_enabler, ux_enhancement, refactoring, experiment)
2. **Document JTBDs** — capture Jobs to be Done using the [[JTBD Template]]
3. **Write User Stories** — capture user voice using the [[User Story Template]]
4. **Complete required sections** per type:

   | Type | Required Sections |
   |------|------------------|
   | feature | Problem, JTBD, Scope, Acceptance Criteria |
   | improvement | Current State, Desired State |
   | technical_enabler | Technical Context, Constraints |
   | ux_enhancement | User Impact, Flow Changes |

5. **Three Amigos Qualification** — Product Owner validates value, Architect validates feasibility, Engineer validates clarity
6. Set `stage: qualified`

### Quality Gate

- All required sections for the assigned type are complete
- Three Amigos review passed (all three perspectives represented)
- Idea is explicitly qualified, rejected, or parked

### Outputs

| Artifact | Type | Template |
|----------|------|----------|
| Qualified Idea Note | Inbox Note | — |
| Job to be Done | [[JTBD Template]] | JTBD Template |
| User Story (1+) | [[UserStory]] | User Story Template |

### Maturity Model

| Level | Description | Stage |
|-------|-------------|-------|
| L0 | Raw thought | (empty) |
| L1 | Context enriched | discovery |
| L2 | Typed and structured | refinement |
| L3 | Reviewed | qualified |
| L4 | Backlog ready | promoted |

### Alternative Flows

- **Rejected** → `stage: rejected`, rationale documented, note remains in inbox
- **Parked** → `stage: parked`, review scheduled for later

---

## 5. Stage 3 — Design PRD

> **Process**: [[Development Lifecycle]] Phases 2-5
> **Session type**: `service-design`

### What Happens

The qualified idea becomes a formal Product Requirements Document. The PRD is the single source of truth for the feature — it captures problem, scope, functional requirements, data model, event impact, UI layout impact, and acceptance criteria.

Two quality instruments gate this stage: the **Feature Readiness Index** (FRI) measures design completeness, and the **Technical Review** validates architectural soundness.

### Inputs

| Input | Source |
|-------|--------|
| Qualified Idea Note | Stage 2 |
| JTBDs and User Stories | Stage 2 |
| Architecture constraints | Event Catalog, existing patterns |

### Activities

1. **Discovery** (Phase 2) — understand the problem space, map impacted domains, identify constraints
2. **Solution Exploration** (Phase 3) — explore 2-3 alternatives, align with architecture, early UX sketching
3. **PRD Drafting** (Phase 4) — create PRD from [[PRD Template]]:
   - Problem Statement + Success Definition
   - Scope (In/Out)
   - Functional Requirements (checkboxes)
   - Data Model Impact (new types, fields)
   - Event Impact (produced/consumed/transformed)
   - UI Layout Impact (tabs, regions, entry points)
   - Non-Functional Requirements
   - Risks + Acceptance Criteria
4. **Development Ready** (Phase 5) — refine into testable acceptance criteria, confirm architecture seams
5. **Score FRI** across 7 dimensions (0-5 each, max 35):

   | Dimension | What it measures |
   |-----------|-----------------|
   | Strategy | Vision clarity, problem-solution fit |
   | Scope | Boundary definition, what's in/out |
   | Architecture | Pattern alignment, seam identification |
   | Event Integration | Event model completeness |
   | Data Model | Type definitions, persistence design |
   | UI Consistency | Layout alignment, pattern reuse |
   | Validation & Testing | Test approach, coverage strategy |

6. **Technical Review** — Architect validates the PRD against 10 review sections

### Quality Gates

| Gate | Threshold | Instrument |
|------|-----------|------------|
| FRI Score | ≥ 19/35 (Technically Ready) | [[PRD Template]] §FRI |
| Technical Review | Pass or Conditional Pass | [[PRD Template]] §Technical Review |

### FRI Thresholds

| Range | Level | Meaning |
|-------|-------|---------|
| 0-10 | Not Ready | Fundamental gaps |
| 11-18 | Conceptual | Direction clear, details missing |
| 19-25 | Technically Ready | Implementation can begin |
| 26-30 | Integration Ready | Well-defined, low risk |
| 31-35 | Production Ready | Battle-tested, fully specified |

### Outputs

| Artifact | Type | Template |
|----------|------|----------|
| PRD (development-ready) | [[ProductRequirementsDocument]] | PRD Template |
| Technical Review | [[TechnicalReview]] | PRD Template §Technical Review |
| FRI Scorecard | embedded in PRD | PRD Template §FRI |

### PRD Lifecycle

```
idea → draft → approved → in-progress → done → archived
```

---

## 6. Stage 4 — Plan Delivery

> **Process**: [[Delivery Planning]], [[Definition of Ready (Cycle)]]
> **Session type**: `backlog-structuring`

### What Happens

The development-ready PRD is decomposed into Product Backlog Items (PBIs) and then chunked into vertical slices (increments). Increments are grouped into development cycles. The cycle must satisfy the [[Definition of Ready (Cycle)]] before implementation begins.

### Inputs

| Input | Source |
|-------|--------|
| PRD (development-ready) | Stage 3 |
| Technical Review findings | Stage 3 |
| Architecture seams | Stage 3 |
| Existing learnings | `docs/learnings/` |

### Activities

1. **Define PBIs** — break the PRD into deliverable work packages using [[Product Backlog Item Template]]:
   - Problem Space (User Story, Pains, Needs)
   - Solution (Use Cases, Functional Requirements, Technical Requirements)
   - Acceptance Criteria
   - INVEST assessment
2. **Chunk into Increments** — decompose PBIs into vertical slices:
   - **Domain-first, UI-second** (L-01): types + events + service first, UI later
   - **Thematic bundling** (L-15): group related small features into cohesive increments
   - **Cross-PBI delivery** (L-18): when features from different PBIs share code surface
3. **Size Increments**:

   | Metric | Target | Anti-Pattern |
   |--------|--------|-------------|
   | LOC (new/modified) | 100-400 | < 50 (micro) or > 500 (mega) |
   | Tests added | 10-50 | 0 tests (untested) |
   | Files touched | 3-12 | > 15 (blast radius) |
   | Duration | 1-3 sessions | > 5 sessions (mega) |

4. **Sequence Increments** by dependency, value, and risk:
   ```
   1. Types and interfaces (no dependencies)
   2. Events (depends on types)
   3. Domain service methods (depends on events)
   4. Infrastructure wiring (catalog, main.ts)
   5. UI components (depends on service)
   6. Orchestrator updates (depends on components)
   ```
5. **Create Cycle Plan** from [[Cycle Planning Template]]:
   - Situation assessment
   - Cycle goals (2-4)
   - Increment plan with scope, LOC, tests per increment
   - Dependency graph
   - Risks + mitigations
   - Success metrics
6. **Verify Definition of Ready** — apply [[Definition of Ready (Cycle)]] checklist

### Quality Gate

| Gate | Checklist |
|------|-----------|
| DoR (Cycle) | PRD approved + FRI ≥ 19 + PBIs defined + Increments planned + Cycle plan exists + Build green + Previous cycle closed |

### Outputs

| Artifact | Type | Template |
|----------|------|----------|
| PBI (1+) | [[ProductBacklogItem]] | Product Backlog Item Template |
| Increment Plan (1+ per PBI) | [[Increment]] | Increment Template |
| Cycle Plan | [[DevelopmentCycle]] | Cycle Planning Template |

### PBI Lifecycle

```
draft → refined → ready → in-progress → done
```

---

## 7. Stage 5 — Implement

> **Process**: [[Increment Lifecycle]] Phase B, [[Development Lifecycle]] Phase 7
> **Session type**: `documentation`

### What Happens

Each increment is implemented following the domain-first approach. Implementation happens within Flowti sessions. The build pipeline (`npm run build`) gates every increment: vitest → typedoc → tsc → eslint → esbuild.

### Inputs

| Input | Source |
|-------|--------|
| Increment Plan | Stage 4 |
| Architecture seams | PRD + Technical Review |
| Test strategy | [[Testplan and Teststrategy]] |

### Activities (per increment)

1. Start a session with the increment doc as focus file
2. **Types** — define interfaces, enums, constants
3. **Events** — define event types, register in catalog
4. **Domain Service** — implement business logic, emit events
5. **Infrastructure Wiring** — catalog entries, main.ts registration
6. **UI Components** — render, interact, consume service state
7. **Orchestrator** — wire components into views
8. **Tests** — unit tests (pure functions 100%, services 80%+), integration tests, flow tests
9. **Documentation** — update PRD, architecture docs, component docs alongside code

### Implementation Order

```
Types → Events → Domain Service → Infrastructure → UI → Orchestrator
```

### Test Strategy (per increment)

| Layer | Target Coverage | Approach |
|-------|----------------|----------|
| Pure functions | 100% | Direct input→output, zero mocking |
| Domain services | 80%+ | Injected EventBus + mock storage |
| View orchestrators | Event wiring | Assert on EventBus subscriptions |
| UI components | Render + interaction | Extract testable logic into helpers |

### Quality Gate

| Gate | Criterion |
|------|-----------|
| Build pipeline | `npm run build` passes (vitest → typedoc → tsc → eslint → esbuild) |
| Tests | New tests added per increment plan estimate |
| No regressions | All previously passing tests still pass |

### Outputs

| Artifact | Type | Template |
|----------|------|----------|
| Working code increment | source code | — |
| Tests | test files | — |
| Updated Increment Doc | [[Increment]] | Increment Template |

### Increment Lifecycle

```
planned → in-progress → done
```

---

## 8. Stage 6 — Review & Ship

> **Process**: [[Increment Lifecycle]] Phases C-E, [[Definition of Done (Cycle)]]
> **Session type**: `requirements-refinement`

### What Happens

Every increment passes through a Three Amigos review. The review scores the increment across 7 dimensions using the TASM (Three Amigos Scoring Model). After review, documentation is finalized and the increment is published. At cycle end, the full [[Definition of Done (Cycle)]] checklist is verified.

### Inputs

| Input | Source |
|-------|--------|
| Working increment | Stage 5 |
| Acceptance criteria | Increment Plan |
| Previous TASM scores | Earlier reviews (for drift detection) |

### Activities

1. **Three Amigos Review** — Product, Engineering, QA perspectives:

   | Dimension | What it scores (0-5) |
   |-----------|---------------------|
   | A. Product Value | Feature delivers real user value |
   | B. Architectural Integrity | Boundaries respected, patterns followed |
   | C. Event Discipline | Events correctly designed, registered, wired |
   | D. Data Model Integrity | Types consistent, persistence correct |
   | E. UX/Flow Quality | Interaction intuitive, flows documented |
   | F. Performance/Scalability | No degradation, efficient patterns |
   | G. Documentation Discipline | Docs current, cross-referenced |

2. **Resolve findings** — blocker findings must be resolved before increment is "done"
3. **Drift detection** — auto-flags if: Arch Integrity ≤ 2 → refactor; Event Discipline ≤ 2 → event audit; Total ≤ 18 → stabilization; 3 consecutive drops → architecture review
4. **Update documentation** — PRD status, architecture docs, component docs, flow docs
5. **Publish increment** — plugin release or internal publish
6. **Update PRD** — version, FRI re-score, functional requirements checked off, stage history entry
7. **Close cycle** (at cycle end) — verify [[Definition of Done (Cycle)]] checklist:
   - All increments done or deferred with rationale
   - Build green
   - Three Amigos review passed
   - PRD and PBIs current
   - Retrospective completed

### TASM Health Levels

| Score | Health Level |
|-------|-------------|
| 31-35 | Excellent |
| 26-30 | Strong |
| 19-25 | Stable |
| 11-18 | Unstable |
| 0-10 | Critical |

### Quality Gates

| Gate | Threshold |
|------|-----------|
| TASM Score | ≥ 19/35 (Stable) |
| DoD (Cycle) | All 8 checklist categories satisfied |

### Outputs

| Artifact | Type | Template |
|----------|------|----------|
| Review Session | [[ReviewSession]] | Three Amigos Session Template |
| Published increment | release | — |
| Updated PRD | [[ProductRequirementsDocument]] | PRD Template |
| Cycle Retrospective | embedded in Cycle Plan | Cycle Planning Template |

---

## 9. Stage 7 — Feedback

> **Process**: [[Development Lifecycle]] Phase 10
> **Session type**: `documentation`

### What Happens

After release, feedback is collected as User Stories while users work with the published solution. Friction points, new ideas, and improvement opportunities are captured and fed back into Stage 1 as inputs for the next cycle.

### Inputs

| Input | Source |
|-------|--------|
| Published solution | Stage 6 |
| User observations | Real usage |

### Activities

1. Observe how users work with the delivered solution
2. Capture friction and opportunities as User Stories
3. Log improvement items discovered during the cycle retrospective
4. Update inbox items related to this cycle's scope
5. Identify next cycle inputs

### Quality Gate

- Feedback captured as structured User Stories, not vague requests
- Improvement backlog items classified: next cycle input, new PBI, tech debt, future PRD, or observation

### Outputs

| Artifact | Type | Template |
|----------|------|----------|
| User Story (1+) | [[UserStory]] | User Story Template |
| Inbox Items (new) | Inbox Note | — |
| Next cycle inputs | — | — |

### The Loop Closes

```
Stage 7 outputs → Stage 1 inputs
```

User Stories from Stage 7 become the feedback and ideas that enter Stage 1. The cycle repeats, each iteration building on the last. The inbox note from Stage 1 remains as the permanent traceability anchor through every subsequent cycle.

---

## 10. Traceability Chain

Every artifact in the workflow links to its predecessors and successors:

```
Inbox Note (permanent anchor)
  ↓ context binding
Session (work effort)
  ↓ derived from
JTBD + User Stories
  ↓ qualifies into
PRD (single source of truth)
  ↓ decomposes into
PBIs (work packages)
  ↓ chunks into
Increments (vertical slices)
  ↓ grouped into
Cycle Plan (delivery unit)
  ↓ reviewed by
Three Amigos (quality gate)
  ↓ delivers
Published Feature
  ↓ observed by
User Stories (feedback → next cycle)
```

### Traceability Matrix

| Artifact | Links To |
|----------|----------|
| Inbox Note | Session, JTBD, User Story, PBI, PRD |
| Session | Inbox Note (via context binding) |
| JTBD | Inbox Note, PRD, User Story |
| User Story | Inbox Note, PRD, PBI |
| PRD | Inbox Note, PBI, Increment, Technical Review, FRI |
| PBI | PRD, Increment, User Story |
| Increment | PBI, PRD, Review Session |
| Cycle Plan | PBI, Increment, Review Session |
| Review Session | Increment, Cycle Plan |
| Technical Review | PRD |

---

## 11. Quality Instruments

The workflow uses four quality instruments at different points:

### 11.1 Feature Readiness Index (FRI)

- **When**: Stage 3 (PRD → Development Ready)
- **What**: 7-dimension design completeness score (0-35)
- **Gate**: ≥ 19/35 to begin implementation
- **Embedded in**: [[PRD Template]]

### 11.2 Technical Review

- **When**: Stage 3 (PRD → Development Ready)
- **What**: 10-section architecture validation
- **Gate**: Pass or Conditional Pass
- **Template**: [[PRD Template]] §Technical Review
- **Document type**: [[TechnicalReview]]

### 11.3 Three Amigos Scoring Model (TASM)

- **When**: Stage 6 (per increment + cycle end)
- **What**: 7-dimension implementation quality score (0-35)
- **Gate**: ≥ 19/35 (Stable) for cycle closure
- **Template**: [[Three Amigos Session Template]]
- **Document type**: [[ReviewSession]]

### 11.4 TestPlan

- **When**: Stage 5 (continuous during implementation)
- **What**: Build pipeline gate (vitest → typedoc → tsc → eslint → esbuild)
- **Gate**: All tests pass, no regressions
- **Document**: [[Testplan and Teststrategy]]

---

## 12. Document Types

Each artifact in the workflow is a typed Markdown document. The type determines the frontmatter schema, required sections, and lifecycle states.

| Type | Abbreviation | Folder | Lifecycle | Template |
|------|-------------|--------|-----------|----------|
| [[ProductRequirementsDocument]] | PRD | feature root | idea → draft → approved → in-progress → done → archived | [[PRD Template]] |
| [[ProductBacklogItem]] | PBI | backlog/ | draft → refined → ready → in-progress → done | [[Product Backlog Item Template]] |
| [[Increment]] | Inc | increments/ | planned → in-progress → done | [[Increment Template]] |
| [[DevelopmentCycle]] | Cycle | cycles/ | planned → in-progress → done | [[Cycle Planning Template]] |
| [[ReviewSession]] | Review | reviews/ | — (single-use) | [[Three Amigos Session Template]] |
| [[TechnicalReview]] | TR | reviews/ | pre-implementation → mid → post | — (embedded in PRD Template) |
| [[UserStory]] | US | backlog/ | draft → refined → ready → done | [[User Story Template]] |
| [[JobToBeDone]] | JTBD | — | idea → draft → validated → done | [[JTBD Template]] |
| [[Persona]] | — | — | — | [[Persona Template]] |

---

## 13. Session Types

Each stage of the workflow maps to a Flowti session type. Sessions provide structured execution environments with guiding questions, time boxes, and artifact tracking.

| Stage | Session Type | Duration | Guiding Questions |
|-------|-------------|----------|-------------------|
| 1. Capture | `documentation` | 25 min | What needs to be documented? / What is the current gap? |
| 2. Discover | `requirements-refinement` | 25 min | What are the acceptance criteria? / What edge cases exist? |
| 3. Design PRD | `service-design` | 50 min | What services does this domain expose? / What are the contracts? |
| 4. Plan Delivery | `backlog-structuring` | 25 min | What are the priorities? / What delivers the most value first? |
| 5. Implement | `documentation` | 25 min | What needs to be documented? / What is the current gap? |
| 6. Review | `requirements-refinement` | 25 min | What are the acceptance criteria? / What edge cases exist? |
| 7. Feedback | `documentation` | 25 min | What needs to be documented? / What is the current gap? |

### Dedicated Session Type: Idea-to-Solution

For end-to-end workflow sessions that span multiple stages, use the dedicated `idea-to-solution` session type defined below.

```json
{
  "type": "idea-to-solution",
  "label": "Idea to Solution",
  "icon": "rocket",
  "defaultDuration": 50,
  "defaultGoals": [
    "Move the idea forward by at least one stage",
    "Update all affected artifacts",
    "Capture any new learnings or observations"
  ],
  "guidingQuestions": [
    "What stage is the idea currently in?",
    "What is the next quality gate to pass?",
    "Which artifacts need to be created or updated?",
    "Are there any blockers or dependencies?",
    "What did we learn that should be captured?"
  ],
  "color": "#6366f1",
  "stages": [
    {
      "id": "capture",
      "label": "Capture & Ingest",
      "description": "Create inbox note, enrich with context, assign priority",
      "checklist": [
        "Inbox note created with clear title",
        "Problem statement clarified",
        "Domain and priority assigned",
        "Stage set to discovery"
      ]
    },
    {
      "id": "discover",
      "label": "Discover & Qualify",
      "description": "Type the idea, document JTBDs and User Stories, Three Amigos qualification",
      "checklist": [
        "Idea typed (feature/improvement/enabler)",
        "At least one JTBD documented",
        "At least one User Story written",
        "Required sections for type completed",
        "Three Amigos review conducted",
        "Stage set to qualified"
      ]
    },
    {
      "id": "design",
      "label": "Design PRD",
      "description": "Create PRD, score FRI, conduct Technical Review",
      "checklist": [
        "PRD created from template",
        "Functional requirements defined",
        "Data model and event impact documented",
        "FRI scored (≥ 19/35 for implementation)",
        "Technical Review passed",
        "PRD stage set to approved"
      ]
    },
    {
      "id": "plan",
      "label": "Plan Delivery",
      "description": "Define PBIs, chunk into increments, create cycle plan",
      "checklist": [
        "PBIs defined with acceptance criteria",
        "Increments chunked (domain-first, UI-second)",
        "Cycle plan created with goals and metrics",
        "Definition of Ready satisfied",
        "Increment docs created"
      ]
    },
    {
      "id": "implement",
      "label": "Implement",
      "description": "Build the increment: types → events → service → UI → tests",
      "checklist": [
        "Types and events defined",
        "Domain service implemented",
        "Tests written and passing",
        "Build pipeline green",
        "Documentation updated alongside code"
      ]
    },
    {
      "id": "review",
      "label": "Review & Ship",
      "description": "Three Amigos review, TASM scoring, publish increment",
      "checklist": [
        "Three Amigos review conducted",
        "TASM score ≥ 19/35",
        "All blocker findings resolved",
        "Documentation finalized",
        "PRD and PBIs updated"
      ]
    },
    {
      "id": "feedback",
      "label": "Feedback",
      "description": "Capture user feedback, close the loop",
      "checklist": [
        "User feedback captured as User Stories",
        "Improvement items classified",
        "Inbox items updated",
        "Next cycle inputs identified"
      ]
    }
  ]
}
```

> **Note**: The `stages` array is an extension beyond the current `SessionTypeConfig` schema. When Session v2 delivers the Execution Plan feature (FR-12), these stages can be loaded as task checklists for structured execution. Until then, the `defaultGoals` and `guidingQuestions` fields are used by the existing session infrastructure.

---

## 14. Learnings

The workflow is informed by 24 documented learnings. Key learnings per stage:

### Stage 4 — Plan Delivery
- [[L-01 Domain-first UI-second]] — separate domain from UI increments
- [[L-15 Bundle related small features into cohesive increments]] — thematic cohesion
- [[L-16 Planned increments shift as reality unfolds]] — plans are starting points
- [[L-18 Cross-PBI delivery keeps momentum]] — deliver related PBIs together

### Stage 5 — Implement
- [[L-04 Type safety at boundaries]] — validate at system edges
- [[L-09 Thread new fields through all creation paths]] — no partial updates
- [[L-10 Pure helpers scale safely]] — extract pure functions
- [[L-11 Backward compat is the tax on persisted state]] — migration strategy
- [[L-13 Domain-only increments build confidence]] — test before UI
- [[L-24 Component extraction before feature addition]] — refactor first

### Stage 6 — Review & Ship
- [[L-12 Feedback loops generate the best requirements]] — iterate on real usage
- [[L-19 Superseding ADRs is a healthy sign]] — architecture evolves
- [[L-21 Documentation debt compounds silently]] — document continuously

### Stage 7 — Feedback
- [[L-17 Auto-linking artifacts builds the knowledge graph]] — traceability
- [[L-22 Every major event domain needs a flow doc]] — document flows

---

## 15. Event Model

Events emitted across the workflow:

### Stage 1-2 (Idea Lifecycle)

| Event | Trigger |
|-------|---------|
| `idea.created` | Inbox file created |
| `idea.enriched` | Stage → discovery |
| `idea.typed` | Type assigned |
| `idea.review.requested` | Review initiated |
| `idea.qualified` | Approved |
| `idea.rejected` | Declined |
| `backlog.item.generated` | Promoted to backlog |

### Stage 5-6 (Implementation & Review)

| Event | Trigger |
|-------|---------|
| `session.started` | Work session begins |
| `session.completed` | Work session ends |
| `file.created` | New source/doc file |
| `file.modified` | File updated |
| `doc.created` | Documentation created |

---

## 16. Visual Lifecycle

```
                    ┌─────────────────────────────────────────────┐
                    │                FEEDBACK LOOP                 │
                    │                                             │
    ┌───────┐   ┌──▼──────┐   ┌──────────┐   ┌──────────┐      │
    │CAPTURE│──►│DISCOVER &│──►│DESIGN PRD│──►│  PLAN    │      │
    │       │   │QUALIFY   │   │          │   │ DELIVERY │      │
    └───────┘   └──────────┘   └──────────┘   └────┬─────┘      │
                                                    │             │
                Quality Gates:                      ▼             │
                • Three Amigos               ┌──────────┐        │
                • FRI ≥ 19/35                │IMPLEMENT │        │
                • Technical Review Pass       │(per inc) │        │
                • DoR Checklist               └────┬─────┘        │
                                                    │             │
                                                    ▼             │
                                              ┌──────────┐       │
                                              │REVIEW &  │       │
                                              │  SHIP    │       │
                                              └────┬─────┘       │
                                                    │             │
                Quality Gates:                      ▼             │
                • TASM ≥ 19/35               ┌──────────┐        │
                • Build Green                │ FEEDBACK │────────┘
                • DoD Checklist              └──────────┘
```

---

## 17. Related

### Process Documents
- [[Idea Lifecycle]] — Stage 1-2 detailed process
- [[Development Lifecycle]] — Stages 3-7 detailed process (10 phases)
- [[Increment Lifecycle]] — Stage 5-6 inner loop (Phases A-E)
- [[Delivery Planning]] — Stage 4 chunking strategy
- [[Definition of Ready (Cycle)]] — Stage 4 readiness gate
- [[Definition of Done (Cycle)]] — Stage 6 completion gate
- [[Testplan and Teststrategy]] — Stage 5 test approach

### Templates
- [[PRD Template]] — Product Requirements Document (with FRI + Technical Review)
- [[Product Backlog Item Template]] — PBI structure
- [[Increment Template]] — Increment document
- [[Cycle Planning Template]] — Cycle plan structure
- [[Three Amigos Session Template]] — Review session (with TASM)
- [[User Story Template]] — User Story
- [[JTBD Template]] — Job to Be Done

### Type Definitions
- [[ProductRequirementsDocument]] — PRD type schema
- [[ProductBacklogItem]] — PBI type schema
- [[Increment]] — Increment type schema
- [[DevelopmentCycle]] — Cycle type schema
- [[ReviewSession]] — Review type schema
- [[TechnicalReview]] — Technical Review type schema
- [[UserStory]] — User Story type schema
- [[JobToBeDone]] — JTBD type schema
- [[Persona]] — Persona type schema

### Learnings
- `docs/learnings/` — 24 documented learnings (L-01 through L-24)
