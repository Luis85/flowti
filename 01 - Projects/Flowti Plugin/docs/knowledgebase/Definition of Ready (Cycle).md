---
type: Process
domain: Flowti/Process
stage: draft
version: 1
review_cycle: quarterly
tags:
  - process
  - quality
  - cycle
  - readiness
---

# Definition of Ready — Cycle Scope

> A cycle is **ready to start** when all items on this checklist are satisfied. This document aggregates readiness criteria from the [[Development Lifecycle]] (phases 1–6), [[Increment Lifecycle]] (Phase A), and [[Delivery Planning]].

## Purpose

This checklist prevents cycles from starting with incomplete inputs. A cycle that begins without proper readiness wastes effort on mid-cycle pivots, scope renegotiation, and unplanned design work. The Definition of Ready ensures that the cycle team has everything they need to deliver.

## Scope

This document targets **development cycles** — the unit of planned delivery that groups multiple increments around a shared goal. Cycles typically span 1–2 weeks and contain 2–6 increments.

For increment-level readiness, see [[Increment Lifecycle]] Phase A.

---

## Readiness Checklist

### 1. Feature PRD Readiness

Source: [[Development Lifecycle]] phases 1–5

- [ ] **PRD exists and is approved** — the parent feature PRD has completed phases 1–5 (Feedback → Discovery → Solution Exploration → PRD Drafting → Development Ready)
- [ ] **PRD stage is `approved` or `in-progress`** — not `draft` or `idea`
- [ ] **FRI scored** — Feature Readiness Index computed across 7 dimensions (Strategy, Scope, Architecture, Event Integration, Data Model, UI Consistency, Validation & Testing)
- [ ] **FRI meets threshold** — score ≥ 19/35 (Technically Ready) for new features; score ≥ 11/35 (Stable) for continuation cycles
- [ ] **Technical Review passed** — Pass or Conditional Pass with documented action items

### 2. Backlog Readiness

Source: [[Development Lifecycle]] phase 6, [[Delivery Planning]]

- [ ] **PBIs defined** — each PBI scoped with problem statement, solution approach, acceptance criteria, and INVEST assessment
- [ ] **PBIs chunked into increments** — vertical slices producing end-to-end value, not partial infrastructure only
- [ ] **Dependencies mapped** — increment dependency graph documented; blocking dependencies resolved or planned
- [ ] **Priority ranked** — delivery order defined by value, not technical sequence

### 3. Cycle Plan Document

Source: Established cycle document pattern (see existing cycles in `docs/cycles/`)

- [ ] **Cycle document exists** — created from established pattern with frontmatter (type, feature, stage, pbis, bugs, tech_debt, estimated_increments, estimated_tests)
- [ ] **Situation assessment written** — pre-cycle state: plugin health, feature status, test counts, open bugs, recent reviews
- [ ] **Cycle goals defined** — 2–4 numbered goals, each with a clear deliverable
- [ ] **Proposed increments specified** — each increment has: goal, scope, estimated LOC, estimated tests
- [ ] **Dependency graph drawn** — increments ordered by dependency, parallelism opportunities identified
- [ ] **Risks identified** — risk/mitigation table for known threats
- [ ] **Success metrics defined** — measurable targets (tests added, LOC, FRI delta, PBIs progressed)
- [ ] **Deferred items documented** — what was explicitly excluded from this cycle and why

### 4. Increment Readiness

Source: [[Increment Lifecycle]] Phase A

For each increment in the cycle:

- [ ] **Scope statement defined** — what this increment delivers and what it excludes
- [ ] **Acceptance criteria written** — testable criteria that determine "done"
- [ ] **Test intent stated** — which behaviors will be tested and at what level
- [ ] **Documentation intent stated** — which docs will be created or updated
- [ ] **Architecture seams confirmed** — layout, adapter, manifest, and event boundaries identified
- [ ] **Estimated size** — LOC and test count estimates provided

### 5. Quality Baseline

Source: [[Development Lifecycle]] §7, [[Testplan and Teststrategy]]

- [ ] **Build pipeline green** — `npm run build` passes before cycle starts (no pre-existing failures)
- [ ] **No critical bugs open** — any blocking bugs from previous cycles resolved or explicitly deferred with rationale
- [ ] **Previous cycle closed** — retrospective completed, improvement backlog captured, stage history updated

### 6. Pre-Cycle Completion

- [ ] **Pre-cycle work documented** — any work done before the cycle formally starts (bug fixes, PRD refinements, planning) is listed in the cycle plan under "Completed pre-cycle"
- [ ] **Inbox signals reviewed** — relevant inbox items linked to cycle goals or explicitly deferred

---

## When to Apply

Apply this checklist **before writing any cycle implementation code**. Planning, PRD refinement, and bug fixes that happen before the cycle starts are "pre-cycle" work and should be documented as such.

The cycle formally begins when the first increment enters Phase B (Implementation).

---

## Escalation

If the checklist cannot be fully satisfied:

| Missing Item | Action |
|-------------|--------|
| PRD not approved | Complete phases 1–5 before starting the cycle |
| FRI below threshold | Identify and address the weakest dimensions |
| No cycle plan | Create the plan — planning IS part of the cycle investment |
| Pre-existing build failures | Fix before starting new work |
| Critical bugs open | Resolve or explicitly defer with documented rationale |

---

## Related

- [[Development Lifecycle]] — full 10-phase process
- [[Increment Lifecycle]] — inner loop: how increments move through delivery
- [[Delivery Planning]] — chunking strategy and increment sizing
- [[Definition of Done (Cycle)]] — companion document: what makes a cycle complete
- [[Testplan and Teststrategy]] — test coverage expectations
