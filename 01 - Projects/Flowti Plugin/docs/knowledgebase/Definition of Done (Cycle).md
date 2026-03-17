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
  - done
---

# Definition of Done — Cycle Scope

> A cycle is **done** when all items on this checklist are satisfied. This document aggregates completion criteria from the [[Development Lifecycle]] (phases 7–10), [[Increment Lifecycle]] (Phases B–E), and established cycle retrospective patterns.

## Purpose

This checklist prevents cycles from being declared "done" with incomplete deliverables. A cycle that closes without proper verification leaves hidden debt, stale documentation, and untracked improvements. The Definition of Done ensures that the cycle produces verifiable, documented, and reviewable outcomes.

## Scope

This document targets **development cycles** — the unit of planned delivery that groups multiple increments around a shared goal. For increment-level done criteria, see [[Increment Lifecycle]] §5.

A cycle is the aggregate of its increments. The cycle DoD builds on — but does not replace — the increment DoD.

---

## Done Checklist

### 1. All Increments Completed

Source: [[Increment Lifecycle]] §5

- [ ] **Each increment satisfies its own DoD** — acceptance criteria met, tests added, build passes, review done, documentation updated
- [ ] **No increment left in partial state** — all increments either fully delivered or explicitly deferred to the next cycle with documented rationale
- [ ] **Deferred increments documented** — any increment that was planned but not delivered is listed in the cycle retrospective with reason

### 2. Build & Test Quality

Source: [[Development Lifecycle]] §7, [[Testplan and Teststrategy]]

- [ ] **Build pipeline green** — `npm run build` passes: vitest → typedoc → tsc → eslint → esbuild
- [ ] **Test count meets target** — actual tests ≥ estimated_tests from cycle plan (or deviation documented)
- [ ] **No test regressions** — all previously passing tests still pass; no tests silently removed
- [ ] **No skipped tests introduced** — any new `skip` annotations have documented rationale
- [ ] **Test coverage per TestPlan** — pure functions 100%, domain services tested (lifecycle, events, edges), UI components tested (render, interaction, state)

### 3. Three Amigos Review

Source: [[Development Lifecycle]] §6, [[Increment Lifecycle]] Phase C

- [ ] **Cycle-level review conducted** — Three Amigos review covering all increments delivered in the cycle
- [ ] **All three perspectives represented** — Product (value alignment), Engineering (architecture integrity), QA (quality and coverage)
- [ ] **All blocker findings resolved** — no blocking issues remain from any increment review
- [ ] **TASM scores recorded** — at least one TASM score per reviewed increment
- [ ] **Observations documented** — non-blocking observations captured with explicit action items or deferral decisions

### 4. PRD & Backlog Updates

Source: [[Development Lifecycle]] phases 9–10, [[Increment Lifecycle]] Phase D

- [ ] **PRD updated** — parent feature PRD reflects current state:
  - [ ] Version incremented (if scope changed)
  - [ ] FRI re-scored (if dimensions improved or worsened)
  - [ ] Functional requirements checked off (delivered items)
  - [ ] Stage history entry added with cycle summary
  - [ ] Backlog table updated (PBI statuses, new PBIs if created)
- [ ] **PBIs updated** — each PBI touched during the cycle has:
  - [ ] Stage updated (planned → in-progress → done)
  - [ ] File lists and test counts reflecting actual delivery
  - [ ] Acceptance criteria checked off
- [ ] **Event model current** — new events registered in catalog, event count updated in PRD

### 5. Documentation

Source: [[Increment Lifecycle]] Phase D

- [ ] **Component docs created/updated** — new or modified components have documentation
- [ ] **Architecture docs updated** — if the cycle changed architectural surface (new views, new services, new patterns)
- [ ] **Flow docs updated** — if the cycle introduced or changed user flows
- [ ] **Technical debt register updated** — new debt items created for shortcuts taken; resolved debt items closed
- [ ] **ADRs produced** — if the cycle required architectural decisions, ADRs are documented in `docs/decisions/`

### 6. Cycle Plan Completion

Source: Established cycle document pattern

- [ ] **Cycle plan frontmatter updated** — `actual_increments`, `actual_tests`, `total_tests_after`, `total_test_files_after` filled in
- [ ] **Success metrics verified** — each metric from the plan has an actual value recorded
- [ ] **Deviations documented** — any difference between planned and actual scope is explained
- [ ] **Risks reviewed** — each identified risk either materialized (with resolution) or didn't (noted)

### 7. Cycle Retrospective

Source: [[Development Lifecycle]] phase 10, established cycle pattern

- [ ] **"What Went Well" section completed** — positive patterns and practices identified
- [ ] **"Deviations from Plan" section completed** — scope changes, dropped increments, unplanned work
- [ ] **"Improvement Backlog" section completed** — actionable items for future cycles
- [ ] **"Learnings" section completed** — reusable patterns, anti-patterns, and insights
- [ ] **Improvement items classified** — each item assigned to: next cycle input, new PBI, tech debt item, future PRD, or observation

### 8. Inbox & Feedback Loop

Source: [[Development Lifecycle]] phase 10, [[Idea Lifecycle]]

- [ ] **Inbox items reviewed** — items related to this cycle's scope are updated (stage, planned_in, delivered_in, note)
- [ ] **New feedback captured** — any user stories, friction points, or ideas that emerged during the cycle are captured as inbox items
- [ ] **Next cycle inputs identified** — items that feed into the next cycle's planning are flagged

---

## Verification Sequence

Apply this checklist in order:

1. **Verify increments** — confirm each increment's DoD
2. **Run build** — `npm run build` on final state
3. **Conduct review** — Three Amigos on the full cycle
4. **Update docs** — PRD, PBIs, component docs, architecture
5. **Complete retrospective** — fill in all retrospective sections
6. **Close cycle** — update cycle plan frontmatter, mark stage as done

---

## Cycle Closure Gate

The cycle is formally closed when:

| Criterion | Verified By |
|-----------|------------|
| All increments done or deferred | Increment DoD checklists |
| Build green | `npm run build` output |
| Three Amigos review passed | Review document with TASM score |
| PRD and PBIs current | PRD stage history, PBI stages |
| Retrospective completed | Cycle plan retrospective sections |
| Improvement backlog captured | Retrospective "Improvement Backlog" section |

---

## When a Cycle Cannot Be Closed

If the checklist cannot be fully satisfied:

| Situation | Action |
|-----------|--------|
| Increment incomplete | Either finish it or defer with documented rationale — do not silently drop |
| Build failing | Fix before closing — a red build is never acceptable as cycle end state |
| No Three Amigos review | Conduct the review — it is mandatory, not optional |
| PRD stale | Update before closing — documentation debt compounds across cycles |
| No retrospective | Complete it — the retrospective is the primary feedback mechanism |

---

## Related

- [[Development Lifecycle]] — full 10-phase process
- [[Increment Lifecycle]] — inner loop: how increments move through delivery
- [[Definition of Ready (Cycle)]] — companion document: what makes a cycle ready to start
- [[Testplan and Teststrategy]] — test coverage expectations
- [[Three Amigos Session Template]] — review format and TASM scoring
