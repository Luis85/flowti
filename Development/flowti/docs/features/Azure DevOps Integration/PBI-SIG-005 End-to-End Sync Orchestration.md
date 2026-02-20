---
type: ProductBacklogItem
domain: Signal
feature: "[[Azure DevOps Integration PRD]]"
stage: planned
priority: 5
cycle: "[[Cycle 11 - Azure DevOps Integration]]"
increment: 5
estimated_loc: 120
estimated_tests: 15
tags:
  - signal
  - orchestration
  - pbi
---

# PBI-SIG-005: End-to-End Sync Orchestration

## Problem Statement

Individual pieces (adapter, mapper, UI) need to work together as a complete sync flow. Each component works in isolation, but the full configure → test → sync → report pipeline needs to be wired, hardened with per-item error resilience, and validated with a flow test.

## Solution Approach

Implement `SignalService.sync(signalId)` as the orchestrator that calls adapter, mapper, and file operations in sequence. Add per-item error collection (one bad work item doesn't abort the sync), progress reporting, sync status persistence, command palette registration, and inbox integration for failed syncs. Validate with a flow-level integration test.

## INVEST Assessment

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Independent | No | Depends on all previous PBIs (SIG-001 through SIG-004) |
| Negotiable | Yes | Command palette, inbox integration, and flow test depth |
| Valuable | Yes | Completes the feature — without this, nothing works end-to-end |
| Estimable | Yes | ~120 LOC, ~15 tests, ~4 files |
| Small | Yes | Single increment, wiring + hardening |
| Testable | Yes | Flow test validates full pipeline |

## Acceptance Criteria

- [ ] `SignalService.sync(signalId)` executes full flow: fetch → map → create/update → progress → result
- [ ] Per-item error resilience: one bad work item is collected as SyncError, sync continues
- [ ] `signal.sync.progress` emitted per item with `{ signalId, current, total }`
- [ ] `SyncResult` includes `itemsCreated`, `itemsUpdated`, `itemsSkipped`, `errors` counts
- [ ] `SignalConfig.lastSync`, `lastSyncItemCount`, `status` updated after sync completes
- [ ] `flowti:signal-sync` command registered in CommandRegistry
- [ ] Failed sync (`signal.sync.failed`) creates inbox notification via inbox mapper
- [ ] Flow test `tests/flows/flow14-signalSync.test.ts` passes ("Configure and sync Azure DevOps signal")
- [ ] FRI updated to reflect delivery (target 28/35)
- [ ] PRD, cycle plan, and Event Catalog docs updated with final delivery state
- [ ] `npm test` green with ~15 tests

## Test Intent

- Flow test: configure signal → test connection → sync → verify notes created → verify status updated
- Error resilience: inject one bad item in batch → sync completes → error collected
- Progress: verify progress events emitted with correct current/total
- Command: verify `flowti:signal-sync` triggers sync for all configured signals
- Inbox: verify failed sync creates inbox notification

## Documentation Intent

- Update Azure DevOps Integration PRD with final FRI scores
- Update Cycle 11 plan with delivery results
- Update Event Catalog metadata with signal events
- Update DX Hub tab documentation (7 tabs)

## Related

- [[PBI-SIG-001 Signal Domain Foundation]] through [[PBI-SIG-004 Signal Management UI]] — all prior PBIs
- [[Azure DevOps Integration PRD]] — parent PRD (§12)
- [[Cycle 11 - Azure DevOps Integration]] — delivery cycle
