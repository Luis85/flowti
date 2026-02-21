---
type: ProductBacklogItem
domain: Signal
feature: "[[Azure DevOps Integration PRD]]"
stage: delivered
delivered_in: "[[Cycle 11 - Azure DevOps Integration]]"
delivered_date: 2026-02-21
actual_loc: 407
actual_tests: 19
priority: 4
cycle: "[[Cycle 11 - Azure DevOps Integration]]"
increment: 4
estimated_loc: 200
estimated_tests: 15
tags:
  - signal
  - ui
  - pbi
---

# PBI-SIG-004: Signal Management UI

## Problem Statement

Users need a way to configure, monitor, and trigger signal operations. The signal domain (PBI-SIG-001) provides the service API, but without a UI users cannot interact with it.

## Solution Approach

Add a Signals tab to the Data Exchange Hub and implement a Signal Configuration Modal. Both follow established patterns: the tab uses the master/detail split layout, the modal uses the multi-page wizard pattern.

## INVEST Assessment

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Independent | Partial | Depends on SignalService API from PBI-SIG-001. Can start after Inc 1. |
| Negotiable | Yes | Modal page count, detail panel sections, status visualization |
| Valuable | Yes | Primary user interaction point for signals |
| Estimable | Yes | ~200 LOC, ~15 tests, ~4 files |
| Small | Yes | Single increment, UI only |
| Testable | Yes | DOM rendering tests following established patterns |

## Acceptance Criteria

- [x] Signals tab added to DX Hub tab definitions: `{ id: "signals", label: "Signals", icon: "radio", searchPlaceholder: "Search signals..." }`
- [x] `SignalsTab.ts` implements master/detail split layout following established component pattern
- [x] Master panel: signal list with name, project, status indicator (green/red/grey dot), last sync, item count
- [x] Detail panel: connection info, sync controls, last result, configuration, Edit/Remove actions
- [x] "+" button opens Signal Configuration Modal (simple form — 4-page wizard deferred to Inc 5)
- [ ] "Sync Now" triggers `SignalService.sync()` with inline progress bar (button rendered disabled — deferred to Inc 5)
- [ ] "Test Connection" validates credentials with success/error feedback (button rendered disabled — deferred to Inc 5)
- [x] "Remove" removes signal config after confirmation dialog (notes preserved)
- [ ] DX Hub documentation updated with Signals tab (deferred to Inc 5 wrap-up)
- [x] `npm test` green with 19 UI tests (2,998 total, 117 suites)

## Test Intent

- Tab rendering: empty state, signal list, status indicators
- Modal: page navigation, field validation, connection test feedback
- Actions: sync trigger, remove confirmation
- Event wiring: UI responds to signal.sync.progress, signal.sync.completed

## Documentation Intent

- Update Data Exchange Hub tab inventory (6 → 7 tabs) in Frontend Architecture docs
- Add Signals tab to DX Hub PRD scope section

## Related

- [[PBI-SIG-001 Signal Domain Foundation]] — provides SignalService API
- [[PBI-SIG-005 End-to-End Sync Orchestration]] — wires full flow through UI
- [[Azure DevOps Integration PRD]] — parent PRD (§9, §12)
