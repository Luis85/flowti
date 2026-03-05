---
type: TechnicalDebt
severity: low
status: open
domain: journey-builder
created: 2026-03-05
identified_in: C55
source: Cycle 55 retrospective
tags:
  - architecture
  - canvas
  - duplication
---

# TD-131: Canvas layout logic duplicated between plugin and report script

## Description

Canvas layout generation exists in two places:
1. `src/domain/journeyBuilder/canvasSync.ts` (153 LOC) — generates companion canvas from sidebar state
2. `scripts/generate-e2e-report.mjs` (~300 LOC) — generates journey canvases from test results

Both produce START → Steps → END layouts with step groups, config nodes, and edges. Layout constants (dimensions, gaps, colors) are not shared.

## Impact

Low — the two implementations serve different inputs (sidebar state vs test results) and have divergent features (active step highlighting vs pass/fail coloring). However, layout drift will increase over time.

## Suggested Resolution

Extract shared layout constants and node generation helpers into a common module (`src/domain/canvas/journeyLayout.ts`). Keep input-specific logic in each consumer. Unify in C56-C57 when Canvas→JSON (PBI-JB-008) is implemented.

## Related

- [[Cycle 55 - Journey Builder]] — retrospective improvement backlog
- PBI-JB-008: Canvas → JSON conversion
