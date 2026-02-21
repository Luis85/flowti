---
type: ProductBacklogItem
domain: Signal
feature: "[[Azure DevOps Integration PRD]]"
stage: delivered
delivered_in: "[[Cycle 11 - Azure DevOps Integration]]"
delivered_date: 2026-02-21
actual_loc: 312
actual_tests: 23
priority: 1
cycle: "[[Cycle 11 - Azure DevOps Integration]]"
increment: 1
estimated_loc: 150
estimated_tests: 25
tags:
  - signal
  - foundation
  - pbi
---

# PBI-SIG-001: Signal Domain Foundation

## Problem Statement

No infrastructure exists for external data source connections. The plugin currently supports only local data entry and CSV import. Before any signal adapter can be built, the domain must be established with types, events, a service skeleton, and an adapter interface contract.

## Solution Approach

Create `src/domain/signal/` as a new domain following established DDD patterns. Define the core types (SignalConfig, SignalState, SyncResult), register signal events in the EventBus type map, implement a SignalService skeleton for CRUD operations on signal configurations, and define the SignalAdapter interface that all future adapters must implement.

This increment also serves as the **HTTP spike** — validate Obsidian's `requestUrl()` for external API calls, document error handling patterns and timeout behavior in an ADR.

## INVEST Assessment

| Criterion | Score | Rationale |
|-----------|-------|-----------|
| Independent | Yes | No dependency on other PBIs or external systems |
| Negotiable | Yes | Adapter interface shape can evolve; spike scope can be trimmed |
| Valuable | Yes | Enables all subsequent PBIs; establishes integration architecture |
| Estimable | Yes | ~150 LOC, ~25 tests, ~6 files |
| Small | Yes | Single increment, foundation only |
| Testable | Yes | Service CRUD, event emission, state persistence are all testable |

## Acceptance Criteria

- [x] `src/domain/signal/types.ts` defines `SignalConfig`, `SignalState`, `SyncResult`, `SyncError`, `WorkItemMapping`
- [x] `src/domain/signal/events.ts` defines `SignalEventMap` with 10 signal events
- [x] `src/domain/signal/SignalService.ts` manages state via `TypedStorage<SignalState>` — `configure()`, `update()`, `remove()`, `getSignals()`, `getSignal()`, `load()`, `dispose()`
- [x] `src/domain/signal/adapters/SignalAdapter.ts` defines adapter interface with `testConnection()` and `fetchItems()` contracts
- [x] Signal events compile and are emittable through EventBus
- [x] "Signal" category registered and visible in Event Catalog
- [x] HTTP spike: `requestUrl()` usage validated, error patterns documented in ADR-034
- [x] `npm test` green with 23 foundation tests (2,919 total, 114 suites)

## Test Intent

- Service CRUD: configure, remove, get, load, save
- Event emission: signal.configured, signal.removed, signal.loaded
- State persistence: load from storage, save to storage, default state handling
- Type compilation: all types compile without errors

## Documentation Intent

- ADR: HTTP integration patterns (`requestUrl()` usage, error handling, timeout approach)
- Event Catalog: Signal category with 10 events registered

## Related

- [[Azure DevOps Integration PRD]] — parent PRD (§12)
- [[PBI-SIG-002 Azure DevOps Adapter]] — next increment, depends on adapter interface
