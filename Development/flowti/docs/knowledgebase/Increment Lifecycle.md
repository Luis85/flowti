---
type: Process
domain: Flowti/Process
stage: draft
version: 1
review_cycle: quarterly
tags:
  - process
  - lifecycle
  - increment
  - quality
  - delivery
---

# Flowti Increment Lifecycle

> This document zooms into the **increment** — the atomic unit of delivery in the [[Development Lifecycle]]. Where the Development Lifecycle describes the full journey from idea to release, this document describes how a single increment moves from planning through delivery.

## 1. Purpose

An **increment** is a vertical slice of a PBI that delivers end-to-end value: implemented, tested, documented, and reviewed. It is the smallest unit of work that crosses the finish line.

This document defines:
- how an increment gets **refined** from a PBI slice into an actionable plan
- how it gets **developed** through disciplined implementation
- how it gets **tested** to close quality gaps
- how it gets **reviewed** to catch drift, bugs, and structural issues
- how it gets **documented** so knowledge stays current
- how findings **feed back** into the next increment

The Development Lifecycle defines the *what* and *why* across 10 phases. This document defines the *how* for phases 6 through 10 — the phases where code gets written, quality gets enforced, and knowledge gets captured.

---

## 2. What Is an Increment

An increment is a **vertical slice** through a PBI. It must:
- deliver observable value (not partial infrastructure alone)
- be implementable, testable, and documentable independently
- produce a working build at its boundary

Increments are not branches, sprints, or tasks. They are **units of delivered quality**. A PBI may contain one or many increments, but each increment stands on its own.

### Increment vs. PBI vs. Feature

```
Feature (PRD)
└── PBI (vertical slice of the feature)
    └── Increment (vertical slice of the PBI)
        ├── Implementation (code + manifests)
        ├── Tests (unit + integration)
        ├── Documentation (component docs + PRD updates)
        └── Review (Three Amigos + TASM)
```

A Feature is delivered through PBIs. A PBI is delivered through increments. Each increment crosses the Definition of Done independently.

---

## 3. Increment States

An increment moves through five states. Each state has a clear entry condition and exit gate.

```
Planned → In Development → In Review → Documented → Done
```

| State | Entry Condition | Exit Gate |
|-------|----------------|-----------|
| **Planned** | PBI chunked; scope, acceptance criteria, test intent, and documentation intent defined | Implementation plan approved |
| **In Development** | Implementation plan exists; architectural seams confirmed | Build pipeline passes (tests + tsc + eslint + esbuild) |
| **In Review** | Build is green; code ready for inspection | Three Amigos review complete; all blocking findings resolved |
| **Documented** | Review findings resolved; tests added/updated | All documentation artifacts updated; PRD reflects current state |
| **Done** | Definition of Done checklist fully satisfied | Increment accepted; improvement backlog captured |

---

## 4. Phase Details

### Phase A — Increment Planning

This phase refines a PBI slice into a concrete, reviewable implementation plan.

**Inputs**
- PBI with defined scope, acceptance criteria, and constraints
- Architecture seams confirmed (layout, adapter, manifest, event boundaries)
- Test approach aligned with [[Testplan and Teststrategy]]

**Activities**
1. Define the increment scope — what this slice delivers and what it deliberately excludes
2. List all files to create or modify, with purpose and estimated LOC
3. Define implementation order (dependencies between files)
4. Identify events to produce or consume
5. Identify manifest changes (layout, component, tab)
6. State the test intent — which behaviors will be tested and at what level
7. State the documentation intent — which docs will be created or updated

**Outputs**
- Implementation plan (file list, order, purpose, LOC estimate)
- Increment scope statement
- Test intent
- Documentation intent

**Gate**
- Implementation plan reviewed and approved before any code is written
- Scope must produce end-to-end value, not partial infrastructure only

---

### Phase B — Implementation

This phase turns the plan into working code.

**Activities**
1. Implement files in the planned order
2. Follow TDD where possible — write the test, then the implementation
3. Maintain architectural boundaries:
   - Domain logic in services/adapters, not UI
   - Events through EventBus, not direct coupling
   - Manifests updated when UI structure changes
4. Emit and consume events via the EventBus following xstate v5 conventions
5. Run full build pipeline after each significant step: `npm run build` (tests → typedoc → tsc → eslint → esbuild)
6. Track deviations from the plan — any scope change is documented, not silently absorbed

**Implementation Order Convention**
Increments follow a domain-first, UI-second pattern:
1. **Types** — type definitions and interfaces
2. **Events** — event type definitions and catalog entries
3. **Domain services** — business logic, state machines, pure helpers
4. **Infrastructure wiring** — service registration, event catalog, main.ts
5. **UI components** — views, tabs, modals
6. **Orchestrator updates** — view orchestrators, event listeners, dependency injection

This order ensures each layer builds on a stable foundation. The domain contract is settled before UI consumes it.

**Outputs**
- Working increment (all new and modified files)
- Green build pipeline
- Deviation notes (if any)

**Gate**
- Build pipeline passes: tests → typedoc → tsc → eslint → esbuild
- No architectural boundary violations introduced

---

### Phase C — Review and Quality Assurance

This phase validates the increment through structured review. Review is not optional — it is where real issues surface.

**Activities**

#### C.1 Three Amigos Review
Conduct a [[Three Amigos Session Template|Three Amigos Review]] covering:
- **Product**: Does this increment deliver the intended value? Any scope drift?
- **Engineering**: Are architectural boundaries respected? Event discipline intact? Code quality acceptable?
- **UX/QA**: Is the interaction clear? Any friction? Test coverage adequate?

Findings are classified as:
| Classification | Meaning | Action |
|---------------|---------|--------|
| **Blocker** | Must fix before increment can proceed | Fix in same session |
| **Improvement** | Should fix but does not block delivery | Capture in improvement backlog |
| **Observation** | Worth noting for future reference | Document in review notes |

#### C.2 Bug Resolution
Bugs found during review are fixed immediately in the same session. After fixing:
- Re-run the full build pipeline
- Verify the fix addresses the finding

#### C.3 Test Coverage
Tests are written or updated after the code review pass. This serves as a **verification pass** — the reviewer has seen the code, and now tests confirm the contract.

Test coverage follows the [[Testplan and Teststrategy]]:
- **Pure functions and helpers**: 100% coverage
- **Domain services**: test lifecycle, state transitions, event emissions, edge cases
- **UI components**: test rendering, user interactions, event handling, state updates
- **Integration**: test cross-component wiring where applicable

After adding tests:
- Run full build pipeline
- Resolve any test failures (mismatched expectations, missing mocks, invalid payloads)
- Update mock factories if dependency interfaces changed

#### C.4 TASM Scoring
Score the increment using the Three Amigos Scoring Model (7 dimensions, 0–5 each, max 35):

| Dimension | What It Measures |
|-----------|-----------------|
| Product Value | Does the increment solve the intended problem? |
| Architectural Integrity | Layout, adapter, and manifest compliance |
| Event Discipline | Canonical naming, no circular emissions, catalog integrity |
| Data Model Integrity | Entity consistency, no redundant fields |
| UX Quality | Discoverability, workflow clarity, cognitive load |
| Performance & Scalability | Virtualization, event-driven refresh, bounded queries |
| Documentation Discipline | Docs updated, PRD current, drift captured |

| Score Range | Health Level |
|-------------|-------------|
| 0–10 | Critical |
| 11–18 | Unstable |
| 19–25 | Stable |
| 26–30 | Strong |
| 31–35 | Excellent |

**Outputs**
- Review findings (classified and resolved or captured)
- Test suite (new and updated test files)
- TASM score
- Green build pipeline (post-review)

**Gate**
- All blockers resolved
- Tests added per TestPlan requirements
- Build pipeline passes after all fixes and test additions
- TASM score recorded

---

### Phase D — Documentation

This phase ensures the knowledge base reflects reality. Documentation is not a follow-up — it is part of the increment.

**Activities**
1. **Component documentation** — create or update component docs for new/modified components
2. **Sitemap updates** — add use cases to view-level sitemap entries
3. **PRD updates** — update the parent PRD: stage, FRI score, checked requirements, stage history, increment descriptions
4. **PBI updates** — update the PBI with file lists, LOC counts, test counts
5. **Technical debt updates** — update debt items if the increment resolved, mitigated, or created debt
6. **Architecture documentation** — update Frontend Architecture, Backend Architecture, or Event Catalog if the increment changed architectural surface
7. **Manifest and schema updates** — ensure layout-manifest, component-manifest, and tab definitions match the delivered code

**Outputs**
- Updated component docs
- Updated sitemap entries
- Updated PRD (stage, FRI, requirements, history)
- Updated PBI (file list, test counts)
- Updated debt register (if applicable)
- Updated architecture docs (if applicable)

**Gate**
- Documentation reflects the current state of the codebase — no stale references, no missing components

---

### Phase E — Closure and Feedback

This phase formally closes the increment and captures inputs for the next cycle.

**Activities**
1. Verify the Definition of Done checklist (Section 5)
2. Capture the **improvement backlog** — items discovered during review that were classified as improvements or observations
3. Determine if improvement items feed into:
   - The next increment of the same PBI
   - A new PBI
   - A technical debt item
   - A future PRD
4. Update the parent PBI and PRD with the increment outcome

**Outputs**
- Completed Definition of Done checklist
- Improvement backlog (classified and assigned to next cycle)
- Updated PBI/PRD with increment outcome

**Gate**
- Definition of Done fully satisfied
- Improvement backlog captured (not lost)

---

## 5. Definition of Done (Increment)

An increment is **Done** only when all items are satisfied:

- [ ] Acceptance criteria met
- [ ] Tests added or updated according to [[Testplan and Teststrategy|TestPlan]]
- [ ] Build pipeline passes (tests → typedoc → tsc → eslint → esbuild)
- [ ] Three Amigos review completed
- [ ] All blocker findings resolved
- [ ] TASM score recorded
- [ ] Documentation updated:
  - [ ] Component docs (new/modified components)
  - [ ] PRD updated (stage, FRI, requirements, history)
  - [ ] PBI updated (file list, test counts)
  - [ ] Architecture docs updated (if impacted)
  - [ ] Sitemap updated (if new use cases)
  - [ ] Technical debt register updated (if impacted)
- [ ] Manifests updated (layout/component/tab) if impacted
- [ ] No architectural boundary violations introduced
- [ ] Improvement items captured in backlog

---

## 6. Increment Flow Diagram

```
PBI (scoped, accepted)
│
├─ A. PLAN
│  ├─ Define scope (what this slice delivers)
│  ├─ List files (create/modify, purpose, LOC)
│  ├─ Define order (dependencies)
│  ├─ State test intent
│  └─ State documentation intent
│  Gate: plan approved
│
├─ B. IMPLEMENT
│  ├─ Types → Events → Domain → Infrastructure → UI → Orchestrator
│  ├─ TDD where possible
│  ├─ Build after each step
│  └─ Track deviations
│  Gate: build pipeline green
│
├─ C. REVIEW
│  ├─ Three Amigos (Product + Engineering + UX/QA)
│  ├─ Fix blockers
│  ├─ Add tests (verification pass)
│  ├─ Resolve test failures
│  └─ TASM scoring
│  Gate: blockers resolved, tests pass, TASM recorded
│
├─ D. DOCUMENT
│  ├─ Component docs
│  ├─ Sitemap / use cases
│  ├─ PRD + PBI updates
│  ├─ Debt register
│  └─ Architecture docs (if impacted)
│  Gate: docs reflect reality
│
└─ E. CLOSE
   ├─ Definition of Done verified
   ├─ Improvement backlog captured
   └─ Feed back into next increment
   Gate: DoD satisfied, backlog captured
```

---

## 7. Roles per Increment Phase

| Phase | Product | Engineering | UX/QA | Architect | Doc Owner |
|-------|--------:|------------:|------:|----------:|----------:|
| A. Plan | C | A/R | C | C | C |
| B. Implement | - | A/R | - | C | - |
| C. Review | R | R | R | C | - |
| D. Document | C | R | C | C | A/R |
| E. Close | A | R | C | C | C |

Legend: R=Responsible, A=Accountable, C=Consulted

---

## 8. Quality Instruments

Three instruments govern increment quality. Together they form a closed loop.

### 8.1 Feature Readiness Index (FRI)

FRI is scored **before implementation begins** (Development Lifecycle Phase 5). It measures structural maturity across 7 dimensions (max 35). FRI answers: *Is this feature ready to build?*

The increment inherits the FRI score from its parent PRD. If the increment reveals that the FRI was overestimated (e.g., architecture assumptions were wrong), the FRI is adjusted downward and the gap is documented.

### 8.2 Three Amigos Scoring Model (TASM)

TASM is scored **after each increment** (Phase C of this lifecycle). It measures delivered quality across 7 dimensions (max 35). TASM answers: *Did we build it right?*

TASM scores are tracked per increment. A declining TASM trend across increments signals drift and triggers escalation (see [[Three Amigos Session Template]] Section 6 for drift rules).

### 8.3 TestPlan

The [[Testplan and Teststrategy|TestPlan]] defines coverage expectations by code category. It is enforced through the build pipeline. Tests are the executable verification of the increment's contract.

### Instrument Relationship

```
FRI  → gate before building   → "Build the right thing"
TASM → gate after building    → "Build the thing right"
Tests → continuous enforcement → "Keep it right"
```

---

## 9. Anti-Patterns

These patterns undermine increment quality. Recognize and avoid them.

| Anti-Pattern | Why It Fails | Remedy |
|-------------|-------------|--------|
| **Infrastructure-only increment** | Delivers no observable value; cannot be reviewed by Product or UX | Every increment must include a user-facing or domain-observable outcome |
| **Documentation debt** | "We'll document it later" compounds into stale knowledge | Documentation is part of the increment, not a follow-up task |
| **Review skipping** | "It's a small change" — small changes accumulate into drift | Every increment gets a Three Amigos review, regardless of size |
| **Silent scope change** | Plan says X, code does X+Y without updating the plan | Deviations are documented; scope changes require plan amendment |
| **Test-last without review** | Tests written only to satisfy coverage, not to verify behavior | Tests are written after code review as a verification pass — reviewers identify what to test |
| **Monolith increment** | One huge increment instead of multiple focused slices | If an increment touches more than 3 bounded contexts, it should be split |
| **Orphan improvement** | Review findings acknowledged but never captured | Every finding becomes a backlog item, debt entry, or next-increment input |

---

## 10. Relationship to the Development Lifecycle

This document details phases 6–10 of the [[Development Lifecycle]]:

| Development Lifecycle Phase | Increment Lifecycle Phase |
|----------------------------|--------------------------|
| Phase 6 — Delivery Planning + Chunking | Phase A — Increment Planning |
| Phase 7 — Iterative Implementation | Phase B — Implementation |
| Phase 8 — Review + Quality Assurance | Phase C — Review and Quality Assurance |
| Phase 9 — Documentation + Publication | Phase D — Documentation |
| Phase 10 — Post-Release Feedback Loop | Phase E — Closure and Feedback |

The Development Lifecycle governs the full journey from idea to release. The Increment Lifecycle governs the inner loop where value is actually delivered. Multiple increments cycle through phases A–E within a single pass of Development Lifecycle phases 6–10.

```
Development Lifecycle (phases 1–10)
└── Phase 6: chunk PBI into increments
    └── Increment 1: A → B → C → D → E
    └── Increment 2: A → B → C → D → E
    └── Increment N: A → B → C → D → E
└── Phase 9–10: publication + feedback (spans all increments)
```

---

## 11. Cycle-Level Checklists

The increment DoD (Section 5) governs individual increments. For the **cycle** level — where multiple increments are grouped into a planned delivery unit — see:

- [[Definition of Ready (Cycle)]] — what must be true before a cycle starts
- [[Definition of Done (Cycle)]] — what must be true for a cycle to close

These documents aggregate increment-level criteria with cycle-level planning, review, and retrospective requirements.

---

## 12. Appendix

- [[Development Lifecycle]]
- [[Testplan and Teststrategy]]
- [[Three Amigos Session Template]]
- [[PRD Template]]
- [[Feature Lifecycle PRD]]
- [[Definition of Ready (Cycle)]]
- [[Definition of Done (Cycle)]]
