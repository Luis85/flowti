---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: done
related_events:
  - log.info
  - log.warn
  - log.error
  - error.occurred
  - error.handled
maturity: L5
---

# Feature: Infrastructure

> Architecture reference: [[Infrastructure]]

---

## 1. Problem Statement

An Obsidian plugin managing complex domains (events, subscriptions, ingestion, data exchange) needs a robust infrastructure layer that provides event-driven communication, service registration, structured logging, and error handling — without coupling any domain to Obsidian's API surface.

- **Who is affected?** All domain services and UI components in the plugin.
- **What breaks?** Without infrastructure, each domain would directly depend on Obsidian APIs, making testing impossible and creating tight coupling.
- **Why it matters:** The infrastructure layer is the foundation of Flowti IBDE's DDD architecture — every other feature depends on it.

---

## 2. Outcome

- **User can** rely on a stable, well-tested plugin that handles errors gracefully and logs diagnostics.
- **System can** route all inter-domain communication through a typed EventBus, register services via a container, and bridge to Obsidian through a single contact point (EventBridge).
- **Domain gains** a clean separation where business logic never imports from `obsidian` directly.

---

## 3. Scope

### In Scope

- EventBus with typed event map, wildcard listeners, and event tracing
- EventBridge as the sole Obsidian API contact point
- ServiceContainer for dependency injection and lifecycle management
- Logger service with structured log events
- ErrorService for centralized error handling
- FileSystemClient for vault file operations

### Out of Scope

- UI components (handled by `src/ui/`)
- Domain-specific business logic
- External API integrations

---

## 4. UX Entry Points

- Infrastructure has no direct UX — it is consumed by all other features
- Logger output visible in browser console and optionally in Event Catalog log
- Error toasts surfaced via Obsidian's `Notice` API

---

## 5. Functional Requirements

- [x] EventBus supports typed `emit()`, `on()`, `off()`, and wildcard `*` listeners
- [x] EventBridge translates Obsidian vault events (`file-open`, `modify`, `create`, `delete`, `rename`) into EventBus events
- [x] ServiceContainer registers and resolves services by key
- [x] Logger emits structured `log.info`, `log.warn`, `log.error` events
- [x] ErrorService catches unhandled errors and emits `error.occurred`
- [x] FileSystemClient wraps Obsidian's `vault.create`, `vault.read`, `vault.modify`, `vault.delete`
- [x] Event trace (wildcard listener) skips `log.*` events to avoid infinite recursion

---

## 6. Data Model Impact

No persistent entities — infrastructure operates in memory.

Key interfaces:

```
FlowtiEventMap
  Composed from all domain EventMap interfaces via `extends`
  Single source of truth for all event types and payloads

ServiceContainer
  registry: Map<string, unknown>
  Keyed service resolution with type casting
```

---

## 7. Event Impact

### Produced

- `log.info` / `log.warn` / `log.error` — payload: `{ message, context?, timestamp }`
- `error.occurred` — payload: `{ error, source, context? }`
- `error.handled` — payload: `{ error, handler }`
- All vault bridge events: `file.created`, `file.modified`, `file.deleted`, `file.renamed`, `file.opened`

### Consumed

- Obsidian workspace and vault events (via EventBridge)

---

## 8. UI Layout Impact

- No views, tabs, or modals
- Error toasts rendered via Obsidian's `Notice` constructor

---

## 9. Adapter Impact

```
EventBus<T extends FlowtiEventMap>
├── emit<K>(event: K, payload: T[K]): void
├── on<K>(event: K, handler: (payload: T[K]) => void): void
├── off<K>(event: K, handler): void
└── dispose(): void

EventBridge
├── attach(workspace, vault, metadataCache): void
└── detach(): void

FileSystemClient
├── createFile(path, content, options?): Promise<TFile>
├── readFile(path): Promise<string>
├── modifyFile(path, content): Promise<void>
├── deleteFile(path): Promise<void>
└── exists(path): boolean
```

---

## 10. Non-Functional Requirements

- **Reliability**: EventBus must never drop events; handler errors must not break the bus
- **Performance**: Wildcard listener overhead < 1ms per event emission
- **Testability**: All infrastructure classes work without Obsidian runtime (via stubs)
- **Memory**: All listeners cleaned up on `dispose()` — no leaked subscriptions

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| Infinite recursion from log events triggering log listeners | Wildcard listener explicitly skips `log.*` events |
| Shared EventBus leaks between tests | Use isolated EventBus instances in test suites |
| EventBridge timing with metadataCache | Use `setTimeout()` delay for scan-based views after file creation |

---

## 12. Acceptance Criteria

- [x] EventBus correctly routes typed events to registered handlers
- [x] Wildcard listener receives all events except `log.*`
- [x] EventBridge translates Obsidian vault events into bus events
- [x] Logger produces structured log events without recursion
- [x] ErrorService catches and reports unhandled errors
- [x] FileSystemClient wraps all vault CRUD operations
- [x] All 679+ tests pass with infrastructure in place

---

## 13. Definition of Done

- [x] EventBus implemented with full typed API
- [x] EventBridge wired to Obsidian workspace/vault/metadataCache
- [x] ServiceContainer with register/resolve/dispose
- [x] Logger and ErrorService operational
- [x] FileSystemClient wrapping vault operations
- [x] Per-domain `events.ts` files composed into `FlowtiEventMap`
- [x] Unit tests cover all infrastructure classes
- [x] `npm run build` passes
