---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: done
related_events:
  - plugin.ready
  - plugin.loading
  - plugin.unloaded
  - file.created
  - file.modified
  - file.deleted
  - file.renamed
  - event.file.triggered
  - ingestion.job.completed
  - subscription.created
  - eventDefinition.created
maturity: L5
business_value: 5
implementation_cost: 4
maintenance_cost: 2
discovery_cost: 3
design_cost: 3
test_cost: 3
priority: 5
---

# Event System PRD

> Architecture reference: [[Event System]]

---

## 1. Problem Statement

Obsidian reacts to files, not to meaning. Users who sync external systems (OneDrive, ERP exports, CSV reports, Git) into their vault face repetitive manual processing, fragile automation, and no system-level mechanism to interpret file changes semantically. Burst imports overwhelm the system and files added while Obsidian is closed may be missed or duplicated. There is no way to subscribe explicitly to meaningful events, process large ingestion volumes safely, or observe and trust automation behavior.

---

## 2. Outcome

Users can react to meaningful domain events instead of raw file changes. The system provides explicit, user-controlled subscriptions with filtering, reliable ingestion of external files at scale via a concurrent job queue, and full observability through an event log. A stable event contract enables incremental automation complexity and serves as a foundation for workflows and pipelines.

---

## 3. Scope

### In Scope
- Typed EventBus with pub/sub, wildcard listeners, and sequential handler execution
- Per-domain event ownership via composable EventMap interfaces (56+ events across 15 categories)
- Event subscriptions with path, extension, and filename pattern filters
- File ingestion pipeline with configurable concurrency, batching, and retry with backoff
- Domain event definition from file metadata with payload mapping
- Idempotency ledger with deterministic event keys and ledger eviction
- Catch-up processing on startup for files added while Obsidian was closed
- Event catalog, event log, and observability UI

### Out of Scope
- Full ETL or analytics pipelines
- Heavy data analysis by default
- Automation without explicit user opt-in
- Cross-plugin event consumption (future)
- Web Worker-based parsing (future)
- Visual event flow editor (future)

---

## 4. UX Entry Points

- **Event Catalog View**: sidebar leaf showing all events grouped by category with 8 tabs (Domains, Services, Events, Flows, Systems, Actors, Products, and dashboard)
- **Subscription panel**: per-event config opened from catalog with CRUD forms
- **Event Definition panel**: per-event config for domain event definitions
- **Settings tab**: Event System section with debug mode, system event toggle, ingestion concurrency, batch window, watch folders

---

## 5. Functional Requirements

- [x] EventBus implements `emit`, `on`, `once`, `off`, `clear` with full TypeScript generics
- [x] Events follow xstate v5 convention `{ type, payload, timestamp }`
- [x] Per-domain EventMap interfaces composed into central FlowtiEventMap via `extends`
- [x] Wildcard (`*`) listeners fire after type-specific handlers
- [x] Sequential handler execution with async/await support
- [x] Event subscriptions with enable/disable, path/extension/name pattern filters
- [x] IngestionService with wildcard listener, time-windowed batching, concurrent processing
- [x] Retry with exponential backoff for failed ingestion jobs
- [x] Idempotency ledger with deterministic keys (`eventType::path`) and MAX_LEDGER_SIZE eviction
- [x] Catch-up processing scans configured folders on startup, skips ledger entries
- [x] EventDefinitionService maps sourceEventType + filePattern to domain events with payload extraction
- [x] Emission policy: `"once"` (deduplicated) or `"always"`
- [x] Persistence of subscriptions, event definitions, and processing state across restarts

---

## 6. Data Model Impact

| Entity | Key Fields |
|--------|-----------|
| `FlowtiEvent<T>` | `type`, `payload`, `timestamp` |
| `FlowtiEventMap` | 56+ event types with typed payloads |
| `SubscriptionFilter` | `pathPattern?`, `extension?`, `namePattern?` |
| `EventDefinition` | `sourceEventType`, `filePattern`, `domainEventName`, `payloadMappings[]`, `emissionPolicy` |
| `PayloadMapping` | `field`, `source` (`path`/`metadata`/`derived`), `expression` |
| `JobQueue` | Generic concurrent queue with configurable concurrency |
| Idempotency ledger | `Set<string>` of `"eventType::path"` keys |

---

## 7. Event Impact

### Produced
- All 56+ events defined in FlowtiEventMap (infrastructure + domain)
- Custom domain events via `emitCustom()` from EventDefinitionService

### Consumed
- EventBus is the backbone; all services consume events through it
- IngestionService uses wildcard listener for batch collection
- SubscriptionService uses wildcard listener for filter matching
- EventDefinitionService listens to `ingestion.job.completed`

---

## 8. UI Layout Impact

- Event Catalog View registered as a sidebar leaf (`flowti-event-catalog`)
- 8-tab master/detail layout: Domains, Services, Events, Flows, Systems, Actors, Products
- Dashboard with stats grid, quick actions, and recent events
- Per-event config modal with overview, subscription form, and definition form pages

---

## 9. Adapter Impact

- EventBridge is the sole Obsidian API adapter (see Event Bridge PRD)
- FileSystemClient uses EventBus request/response pattern (see File System PRD)
- No direct Obsidian imports in any service

---

## 10. Non-Functional Requirements

- No UI blocking during ingestion; configurable concurrency limits
- Graceful degradation under load; no event loss during bursts
- Deterministic behavior across restarts
- Outcome-focused language in UI ("When this happens...")
- Every automated action must be explainable
- Event trace skips `log.*` events to prevent infinite recursion
- Test isolation: fresh EventBus per test to avoid wildcard listener leakage

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Handler throws and blocks emit chain | Medium | High | Fail-fast; error propagates to emit caller |
| Wildcard listener leaks across tests | Medium | Medium | Isolated EventBus instances per test |
| Ledger grows unbounded | Low | Medium | MAX_LEDGER_SIZE=10000 with oldest-first eviction |
| metadataCache not ready on file creation | High | Medium | Pending-set handoff between vault.create and metadataCache.changed |
| Burst import causes memory pressure | Low | High | Configurable concurrency + batch windowing |

---

## 12. Acceptance Criteria

- [x] EventBus emits events with correct `type`, `payload`, and `timestamp`
- [x] Type-specific handlers fire before wildcard handlers in registration order
- [x] `once()` handlers auto-unsubscribe after first invocation
- [x] Subscriptions can be created, enabled/disabled, and filtered by path/extension/name
- [x] No automation occurs unless a subscription is explicitly enabled
- [x] File events enqueue ingestion jobs without blocking UI
- [x] Large burst imports (500+ files) are queued with no event loss
- [x] Failed jobs retry with exponential backoff; exceeded retries logged as failed
- [x] Domain events are emitted once per logical file by default (idempotency)
- [x] Catch-up on startup detects unprocessed files without reprocessing already-handled ones
- [x] Event definitions, subscriptions, and processing state persist across restarts
- [x] Event log shows event name, timestamp, source file, subscription, and status
- [x] Users can disable the entire Event System; when disabled, no events are processed

---

## 13. Definition of Done

The Event System is done when all acceptance criteria above are met, no events are lost during burst or offline scenarios, users can explain why an event was emitted, and the system behaves deterministically and transparently. All 679+ tests pass, `npm run build` succeeds, and the feature is fully integrated into the Event Catalog view.
