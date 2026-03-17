---
type: DevelopmentCycleTemplate
domain: Flowti/Process
stage: active
version: 1
review_cycle: quarterly
tags:
  - template
  - cycle
  - planning
  - delivery
---

# Cycle Planning Template

> This template defines the structure for a **Development Cycle** — a focused delivery unit that bundles 1-3 PBIs and optionally tech debt into a sequence of increments. Each cycle moves through: plan → implement → review → document → close. See [[Increment Lifecycle]] for per-increment details.

## Usage

1. Copy this template to `docs/cycles/Cycle N - [Short Title].md`
2. Fill in the frontmatter fields
3. Complete the Pre-Cycle State assessment
4. Define Cycle Goals, Tech Debt, and Increment Plan
5. During delivery: mark acceptance criteria as they are met
6. Post-delivery: fill in Post-Cycle State, Success Metrics actuals, and Retrospective

---

## Frontmatter Schema

```yaml
---
type: DevelopmentCycle
feature: "[[Feature PRD]]"       # wikilink to parent PRD
stage: planned                   # planned | in-progress | done
cycle: 0                         # sequential cycle number
date_planned: YYYY-MM-DD
date_completed:                  # filled post-delivery
pbis:                            # wikilinks to PBIs delivered in this cycle
  - "[[PBI-XXX Title]]"
tech_debt:                       # wikilinks to TDs bundled in this cycle
  - "[[TD-XX Title]]"
estimated_increments: 0
actual_increments:               # filled post-delivery
estimated_tests: 0
actual_tests:                    # filled post-delivery
total_tests_after:               # filled post-delivery
total_test_files_after:          # filled post-delivery
---
```

---

## Section Guide

### 1. Title

```markdown
# Cycle N: [Short Descriptive Title]
```

### 2. Situation Assessment

Two subsections — Pre-Cycle (filled at planning time) and Post-Cycle (filled after delivery).

```markdown
## Situation Assessment

### Pre-Cycle State (YYYY-MM-DD)

**Plugin health:**
- X tests passing (Y skipped), Z test files
- Build status: green / red
- `npm run build` pipeline: vitest + typedoc + tsc + eslint + esbuild

**Feature status:**
- PRD version, FRI score, stage
- What's delivered so far (list completed PBIs)
- Current domain metrics (LOC, event count)

**What's next per PRD priority ranking:**
1. PBI-XXX — priority, effort, dependencies
2. PBI-YYY — priority, effort, dependencies

### Post-Cycle State (YYYY-MM-DD)
<!-- Filled post-delivery -->

**Plugin health:**
- X tests passing (Y skipped), Z test files (+N tests, +M files)

**Feature status:**
- PBI-XXX: **done** — brief summary of what was delivered
- TD-XX: **resolved** — brief summary
- Updated domain metrics (LOC, event count)
```

### 3. Cycle Goals

```markdown
## Cycle Goals

1. **Deliver PBI-XXX** — one-sentence description of what this achieves
2. **Deliver PBI-YYY** — one-sentence description
3. **Fix TD-ZZ** — why-now rationale in one sentence
4. **Resolve TD-WW** — what this unblocks
```

### 4. Tech Debt Bundled

One subsection per TD. Explain **why now** (not just what).

```markdown
## Tech Debt Bundled

### TD-XX: [Title] (SEVERITY, effort)

**Why now:** Explain the delivery dependency or risk that makes this TD relevant to this cycle.

**Fix:** Describe the solution approach and estimated LOC.
```

If no tech debt is bundled, state it explicitly:

```markdown
## Tech Debt Bundled

**None bundled this cycle.** [Brief explanation of why.]
```

### 5. Increment Plan

One subsection per increment. Each follows this structure:

```markdown
## Increment Plan

### Inc N: [Title]

**Goal:** One-sentence goal statement.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/path/to/file.ts` | What this step does | ~NN |
| 2 | `tests/path/to/file.test.ts` | What this tests | ~NN |

**Est. total:** ~NNN LOC source, ~NN tests

**Acceptance criteria:**
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] `npm run build` passes

<!-- Post-delivery: check boxes, add Status and Deviation notes -->
```

**Conventions:**
- Increments follow domain-first order: Types → Events → Domain → Infrastructure → UI → Orchestrator
- Each increment must produce a green build at its boundary
- Acceptance criteria use `- [ ]` checkboxes (checked `- [x]` post-delivery)
- Add `**Status: Done**` after acceptance criteria when the increment is complete
- Add `**Deviation:**` notes for any scope changes from the original plan

### 6. Dependency Graph

```markdown
## Dependency Graph

\`\`\`
Inc 1: [Title] (independent / depends on X)
  |
Inc 2: [Title] (requires Inc 1 types)
  |
Inc 3: [Title] (requires Inc 2 events)
  |
Inc 4: [Title] (requires all prior)
\`\`\`

**Note:** [Explain parallelization opportunities or ordering constraints.]
```

### 7. Risks & Mitigations

```markdown
## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Risk description | High/Medium/Low | How to mitigate |
```

### 8. Success Metrics

Two-column at planning time; expanded to four columns post-delivery.

**At planning time:**
```markdown
## Success Metrics

| Metric | Target |
|--------|--------|
| Tests added | ~NNN new |
| Tests total | ~NNN+ |
| PBIs closed | PBI-XXX, PBI-YYY |
| New events | N |
```

**Post-delivery (replace the table):**
```markdown
## Success Metrics

| Metric | Target | Actual | Status |
|--------|--------|--------|--------|
| Tests added | ~NNN new | NNN new | On target / Above / Below |
| Tests total | ~NNN+ | NNN | On target |
| PBIs closed | PBI-XXX, PBI-YYY | All N closed | Done |
```

### 9. Cycle Retrospective

Filled entirely post-delivery.

```markdown
## Cycle Retrospective

### What Went Well
- Observation 1
- Observation 2

### Deviations from Plan
- **Item**: explanation of what changed and why

### Improvement Backlog (from this cycle)
- [ ] Item that feeds into next cycle
- [ ] Item tracked as future TD

### Learnings
- **L-NN**: [Title] — one-sentence description of the learning
```

### 10. Related

```markdown
## Related

- PRD: [[Feature PRD]] (version, FRI score)
- PBIs: [[PBI-XXX]], [[PBI-YYY]]
- Tech Debt: [[TD-XX]], [[TD-YY]]
- Learnings (input): [[L-NN Title]], [[L-MM Title]]
- Learnings (output): [[L-PP Title]]  <!-- filled post-delivery -->
- Previous Cycle: [[Cycle N-1 - Title]]
```

---

## Quality Checklist

Before marking a cycle as `stage: done`, verify:

- [ ] All increment acceptance criteria checked off
- [ ] Post-Cycle State section filled in
- [ ] Success Metrics table expanded with Actual/Status columns
- [ ] Cycle Retrospective completed (all 4 subsections)
- [ ] New learnings captured as standalone `L-NN` files
- [ ] Improvement Backlog items either captured as TDs or fed into next cycle
- [ ] `date_completed` and `actual_*` frontmatter fields populated
- [ ] `stage: done` in frontmatter

---

## Related

- [[Increment Lifecycle]] — per-increment phase details (A through E)
- [[Development Lifecycle]] — full journey from idea to release
- [[Testplan and Teststrategy]] — test coverage expectations
- [[Three Amigos Session Template]] — review and TASM scoring
- [[PRD Template]] — parent feature documentation
