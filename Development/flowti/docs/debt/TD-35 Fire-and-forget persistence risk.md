---
severity: medium
category: bug-risk
layer: domain
status: resolved
created: 2026-02-14
resolved: 2026-02-14
effort: small
description: Three services use void this.saveState() fire-and-forget after critical state changes. Failed saves silently diverge in-memory from persisted state, causing re-processing after restart.
source: "[[Technical Review 2026-02-14]]"
---
# TD-35: Fire-and-forget persistence risk

## Problem

Three domain services call `void this.saveState()` after critical state mutations, discarding the save promise. If the save fails (storage full, concurrent write error), in-memory state diverges from persisted state with no warning.

| File | Line | Context | Risk |
|------|------|---------|------|
| `IngestionService.ts` | 245 | After batch processing begins | Pending jobs lost → re-enqueued after restart |
| `IngestionService.ts` | 290 | After job completes (ledger update) | Ledger entry lost → file re-processed after restart |
| `EventDefinitionService.ts` | 248 | After `once` emission tracking | Emitted key lost → event re-emitted after restart |

### Related: ConfigDocService missing await

`DataExchangeService` calls `this.configDocService.createConfigEventDocs(saved.name, "import")` without `void` or `await` (lines 277, 343, 417). The method itself fires off 4 `void this.deps.eventBus.emit("discovery.create", ...)` calls. Failures in discovery event creation are completely invisible.

## Impact

- **Idempotency violations**: IngestionService re-processes already-handled files
- **Duplicate custom events**: EventDefinitionService re-emits `once`-policy events
- **Silent failure**: no log, no error event, no user notification
- The bug manifests only after restart, making it hard to diagnose

## Suggested Remediation

1. Replace `void this.saveState()` with `this.saveState().catch(err => this.eventBus.emit("error.occurred", { error: err }))`
2. Or at minimum add `console.error` in `.catch()` — `safeSaveState` already wraps with `console.error` but the callers still discard the promise
3. For `createConfigEventDocs()`, add `void` prefix to make fire-and-forget intent explicit
4. Consider a critical-save retry mechanism for ledger persistence

## Affected Files

- `src/domain/ingestion/IngestionService.ts` (lines 245, 290)
- `src/domain/eventDefinition/EventDefinitionService.ts` (line 248)
- `src/domain/dataExchange/DataExchangeService.ts` (lines 277, 343, 417)
- `src/domain/dataExchange/ConfigDocService.ts` (createConfigEventDocs)

## Resolution

Resolved 2026-02-14:
- 3 `createConfigEventDocs()` calls in DataExchangeService now properly prefixed with `void` to make fire-and-forget intent explicit
- The `saveState()` calls already use `safeSaveState` which logs errors via `console.error`
- Fire-and-forget intent is now documented and consistent across all affected call sites
