---
type: ProductBacklogItem
feature: "[[Analytics Hub PRD]]"
stage: done
priority: high
dependencies:
  - "[[PBI-ANA-071 Visual Filter Builder]]"
tags:
  - analytics
  - extraction
  - tech-debt
planned_in: "[[Cycle 38 - Query Builder Improvements]]"
delivered_in: "[[Cycle 38 - Query Builder Improvements]]"
---

# PBI-ANA-075: QueriesTab Source and Actions Extraction

## User Story

As a developer, I want the ActionsBar extracted from QueriesTab so that the query action buttons (run, save, export, etc.) live in a focused component, keeping QueriesTab under the maintainability threshold.

## Solution Statement

Extract the actions bar section from QueriesTab into `ActionsBar.ts`, reducing QueriesTab from 950 to 820 LOC. This resolves TD-ANA-003.

**`ActionsBar.ts` (~170 LOC):**
- Run query button with Ctrl+Enter shortcut
- Save query button and save-as flow
- Export actions (CSV download, Add to Dashboard)
- Query metadata display (row count, execution time)
- Filter and sort count badges

**QueriesTab retains:**
- State management and orchestration
- Source panel delegation
- Query builder panel delegation
- Results section delegation
- Saved query list delegation

## Acceptance Criteria

- [x] `ActionsBar.ts` extracted as standalone component
- [x] QueriesTab reduced to 820 LOC or less
- [x] All action buttons and shortcuts preserved
- [x] All existing tests pass without modification
- [x] `npm test` passes

## Related

- PRD: [[Analytics Hub PRD]] (v13)
- Cycle: [[Cycle 38 - Query Builder Improvements]] (Inc 6)
- Tech debt: TD-ANA-003
- Depends on: [[PBI-ANA-071 Visual Filter Builder]] (cleaner filter UI reduces QueriesTab complexity)
- Pattern: Follows [[PBI-ANA-030 QueriesTab Extraction]] extraction approach
