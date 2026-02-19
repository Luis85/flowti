---
type: DocumentType
name: DevelopmentCycle
abbreviation: Cycle
folder: cycles/
icon: refresh-cw
---

# DevelopmentCycle

A **Development Cycle** is a focused delivery unit that bundles 1-3 PBIs and optionally tech debt into a sequence of increments. Each cycle moves through: plan → implement → review → document → close.

Cycles live in the `cycles/` folder and follow the naming convention `Cycle N - Short Title.md`.

## Frontmatter Schema

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"DevelopmentCycle"` | yes | Document type discriminator |
| `feature` | wikilink | yes | Link to parent PRD |
| `stage` | enum | yes | `planned` · `in-progress` · `done` |
| `cycle` | number | yes | Sequential cycle number |
| `date_planned` | date | yes | Planning date (YYYY-MM-DD) |
| `date_completed` | date | no | Completion date (filled post-delivery) |
| `pbis` | wikilink[] | yes | Links to PBIs delivered in this cycle |
| `tech_debt` | wikilink[] | no | Links to TDs bundled in this cycle |
| `estimated_increments` | number | yes | Planned number of increments |
| `actual_increments` | number | no | Actual increments delivered (filled post-delivery) |
| `estimated_tests` | number | yes | Planned number of new tests |
| `actual_tests` | number | no | Actual tests added (filled post-delivery) |
| `total_tests_after` | number | no | Total test count after cycle (filled post-delivery) |
| `total_test_files_after` | number | no | Total test file count after cycle (filled post-delivery) |

## Section Template

1. Situation Assessment (Pre-Cycle / Post-Cycle)
2. Cycle Goals (2-4 goals with deliverables)
3. Tech Debt Bundled (per-TD subsections with "why now" rationale)
4. Increment Plan (per-increment scope, steps, LOC, acceptance criteria)
5. Dependency Graph (increment ordering and parallelism)
6. Risks & Mitigations (risk table)
7. Success Metrics (planned → actual)
8. Cycle Retrospective (What Went Well / Deviations / Improvement Backlog / Learnings)
9. Related (PRD, PBIs, TDs, learnings, previous cycle)

## Lifecycle

```
planned → in-progress → done
```

- **planned**: Cycle plan created, [[Definition of Ready (Cycle)]] satisfied
- **in-progress**: Increments being implemented and reviewed
- **done**: [[Definition of Done (Cycle)]] satisfied, retrospective completed

## Quality Gates

| Gate | When | Checklist |
|------|------|-----------|
| Definition of Ready | Before implementation starts | [[Definition of Ready (Cycle)]] |
| Definition of Done | Before closing the cycle | [[Definition of Done (Cycle)]] |
