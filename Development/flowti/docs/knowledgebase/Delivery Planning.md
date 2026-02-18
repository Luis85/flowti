---
type: Process
domain: Flowti/Process
stage: draft
version: 1
review_cycle: quarterly
tags:
  - process
  - planning
  - delivery
  - increments
---

# Delivery Planning

> This document expands on **Phase 6 — Delivery Planning + Chunking** of the [[Development Lifecycle]]. It describes how to break a PRD's PBIs into increments, using the patterns learned from PBI-002 Documentation Sessions (10 increments delivered).

Before: [[Development Lifecycle]] (phases 1-5)
During: this document (phase 6)
After: [[Increment Lifecycle]] (phases A-E per increment)

---

## 1. Purpose

Delivery Planning translates a development-ready PRD into a sequence of **vertical slices** (increments) that can be independently implemented, tested, documented, and reviewed. Each slice must cross the finish line — no partial infrastructure without observable value.

This phase answers:
- **How many increments?** — decompose the PBI into the smallest meaningful delivery units
- **In what order?** — sequence by dependency, value, and risk
- **What does each slice include?** — scope, acceptance criteria, test intent, documentation intent

---

## 2. Inputs

| Input | Source | Required? |
|-------|--------|-----------|
| Approved PRD | Phase 5 (Development Ready) | Yes |
| Technical Review results | Phase 5 | Yes |
| PBI backlog items | PRD Section 13 | Yes |
| Architecture seams | Technical Review findings | Yes |
| Existing learnings | `docs/learnings/` | Recommended |

---

## 3. Chunking Strategy

### 3.1 Domain-First, UI-Second

The most reliable chunking pattern separates domain from UI:

```
Inc 1: Domain types + events + service + tests       ← no UI
Inc 2: UI tab/component consuming the service         ← pure presentation
Inc 3+: Enrichment, polish, new capabilities          ← feature by feature
```

This pattern (learned in [[L-01 Domain-first UI-second]]) means:
- Domain contract is stable before UI consumes it
- Domain-only increments are small, focused, and nearly 100% testable
- UI increments are thin rendering shells — no business logic to debug

### 3.2 Thematic Bundling

When individual features are too small for standalone increments, bundle them by theme:

```
Inc N: "Workspace Enrichment"
  ├── Links (attach files to sessions)
  ├── Notes persistence (auto-create notes file)
  ├── Canvas (create .canvas file)
  ├── Duration editing
  ├── Template unlock (save from any status)
  └── Context menu ("Add to Session")
```

The key is **thematic cohesion** — features in a bundle share code surface area and tell a coherent story in review. See [[L-15 Bundle related small features into cohesive increments]].

### 3.3 Cross-PBI Delivery

When a child PRD's requirements naturally fit into the current PBI's next increment, deliver them together. Tag the increment with `cross_pbi` references in frontmatter. See [[L-18 Cross-PBI delivery keeps momentum]].

---

## 4. Increment Sizing

### Guidelines

| Metric | Target | Rationale |
|--------|--------|-----------|
| LOC (new/modified) | 100–400 | Reviewable in one Three Amigos session |
| Tests added | 10–50 | Sufficient coverage without test maintenance burden |
| Files touched | 3–12 | Focused scope, limited blast radius |
| Duration | 1–3 sessions | Maintains momentum, enables fast feedback |

### Anti-Patterns

- **Micro-increments** (< 50 LOC, 1-2 files): overhead of review + docs exceeds the code change. Bundle with related work.
- **Mega-increments** (> 500 LOC, 15+ files): too large to review effectively. Split by layer or theme.
- **Infrastructure-only**: delivering service changes without any observable value. Always include at least one user-visible change.

---

## 5. Sequencing

### Dependency-Based Order

```
1. Types and interfaces (no dependencies)
2. Events (depends on types)
3. Domain service methods (depends on events)
4. Infrastructure wiring (catalog, main.ts)
5. UI components (depends on service)
6. Orchestrator updates (depends on components)
```

### Value-Based Order

After the domain foundation (Inc 1), prioritize by user impact:
1. **Must-have**: core workflow (timer, lifecycle, basic UI)
2. **Should-have**: enrichment (links, notes, canvas, templates)
3. **Nice-to-have**: polish (auto-open, sidebar, file profiles)

### Risk-Based Order

Move uncertain or risky work early:
- Obsidian API quirks (adjacent leaf, sidebar singleton) — discover early
- Performance-sensitive paths (timer ticks, activity tracking) — validate early
- External dependencies (file system, metadataCache) — test early

---

## 6. Increment Plan Format

Each increment in the delivery plan should specify:

```markdown
### Increment N: Title

**Scope**: 1-3 sentence summary of what this slice delivers

**Acceptance Criteria**:
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] `npm run build` passes

**Estimated**:
- LOC: ~NNN
- Tests: ~NN
- Files: N new, M modified

**Dependencies**: Inc N-1, ADR-NNN, TD-NN

**Test Intent**: What will be tested and at what level (unit, integration, flow)

**Documentation Intent**: Which docs will be created or updated
```

---

## 7. Planning Checklist

Before starting implementation:

- [ ] PRD is at `development-ready` or `approved` stage
- [ ] Technical Review passed or conditionally passed
- [ ] PBI has acceptance criteria
- [ ] Increment plan reviewed — each slice has scope, AC, test intent, doc intent
- [ ] Dependencies between increments are explicit
- [ ] Backward compatibility plan for persisted state ([[L-11 Backward compat is the tax on persisted state]])
- [ ] New Session fields threaded through all creation paths ([[L-09 Thread new fields through all creation paths]])
- [ ] Increment docs created from [[Increment Template]]

---

## 8. Expect Plans to Change

Plans are starting points, not contracts. After every 2-3 increments:
- Re-evaluate remaining planned increments against real-world feedback
- Pull forward urgent features, defer less pressing ones
- Renumber as needed — document the shift in the increment doc

> "The planned Inc 11 (Session Document) got pulled forward into Inc 8 because `generateSessionSummary()` was needed immediately." — [[L-16 Planned increments shift as reality unfolds]]

---

## 9. Related

- [[Development Lifecycle]] — phases 1-10 overview
- [[Increment Lifecycle]] — per-increment delivery phases A-E
- [[Increment Template]] — increment document template
- [[Product Backlog Item Template]] — PBI structure
- [[Testplan and Teststrategy]] — test approach per increment
- [[Three Amigos Session Template]] — review format
