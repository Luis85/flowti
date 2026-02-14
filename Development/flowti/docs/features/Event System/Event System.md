---
stage: done
domain: Flowti/System
plugin: "[[Development/flowti/README|README]]"
tags:
  - infrastructure
  - core
type: Feature
---
# Product Requirements Document (PRD)

## Feature: Event System

---

## 1. Overview

### Feature Name

**Event System**

### Summary

The Event System enables users to transform low-level file activity in Obsidian into **explicit, semantic domain events** that can be subscribed to and used to trigger downstream processes.  
It is designed to handle **external file ingestion**, **high-volume bursts**, and **offline catch-up scenarios** reliably and transparently.

---

## 2. Problem Statement

Obsidian today reacts to _files_, not to _meaning_.

Users who sync external systems (OneDrive, ERP exports, email imports, CSV reports, Git) into their vault face recurring problems:

- Incoming files require repetitive manual processing
    
- File creation alone does not express intent
    
- Automation is fragile, implicit, or opaque
    
- Burst imports (hundreds of files) overwhelm the system
    
- Files added while Obsidian is closed may be missed or duplicated
    

There is no system-level mechanism to:

- interpret file changes semantically
    
- subscribe explicitly to events
    
- process large ingestion volumes safely
    
- observe and trust automation behavior
    

---

## 3. Goals & Objectives

### Primary Goals

- Enable users to react to **meaningful events**, not raw file changes
    
- Provide **explicit, user-controlled subscriptions**
    
- Support **reliable ingestion** of external files at scale
    
- Maintain **trust through observability**
    

### Secondary Goals

- Establish a stable event contract for future automation
    
- Enable incremental system complexity
    
- Serve as a foundation for workflows and pipelines
    

---

## 4. Non-Goals

The Event System will **not**:

- Replace full ETL or analytics pipelines
    
- Perform heavy data analysis by default
    
- Automate anything without explicit user opt-in
    
- Serve casual or purely manual note-taking workflows
    

---

## 5. Target Users / Personas

### Primary Persona — System Builder

- Power user, Product Owner, Engineer, Ops
    
- Builds structured systems in Obsidian
    
- Integrates external data sources
    

### Secondary Persona — Knowledge Worker

- Receives recurring reports or datasets
    
- Wants automation without scripting
    

### Tertiary Persona — Integrator / Plugin Developer

- Needs stable, semantic hooks for automation
    

---

## 6. User Jobs to Be Done (JTBD Summary)

- Detect meaningful events from file activity
    
- Define domain events from file properties and content
    
- Subscribe explicitly to events
    
- Trigger follow-up processes reliably
    
- Handle high-volume ingestion and offline catch-up
    
- Avoid duplicate or accidental events
    
- Observe, debug, and trust automation
    
- Scale automation incrementally
    

---

## 7. User Stories

### US-1: Subscribe to File-Based Events

> As a user, I want to subscribe to file events (e.g. new CSV files) so I can react when new data arrives.

### US-2: Define a Domain Event from a File

> As a user, I want to define a new event type based on file metadata or content so the system understands what happened.

### US-3: Handle Burst Imports Safely

> As a user, I want the system to process many incoming files without freezing or losing events.

### US-4: Catch Up After Downtime

> As a user, I want the system to detect and process files that arrived while Obsidian was not running.

### US-5: Inspect Event Activity

> As a user, I want to see which events were emitted and why, so I can trust and debug automation.

---

## 8. Functional Requirements

### 8.1 Event Catalog

- Display available events grouped by category:
    
    - System Events (file created, modified, deleted)
        
    - Ingestion Events (job started, batch completed)
        
    - Domain Events (user-defined)
        
- Each event includes:
    
    - Name
        
    - Description
        
    - Source
        
    - Payload schema (high-level)
        

---

### 8.2 Event Subscriptions

- Users can:
    
    - Subscribe to one or more events
        
    - Apply filters (path, extension, filename pattern)
        
- Subscriptions are:
    
    - Explicit
        
    - Enable/disableable
        
    - Inspectable
        

---

### 8.3 File Ingestion Pipeline

#### Requirements

- File events enqueue ingestion jobs instead of processing immediately
    
- Jobs are processed with configurable concurrency
    
- Failed jobs retry with backoff
    

#### Supported Scenarios

- Single file arrival
    
- Burst imports (e.g. 500 files)
    
- Files added while Obsidian was closed
    

---

### 8.4 Define Domain Events from Files

Users can configure:

- Event name to emit
    
- Payload mapping from:
    
    - File metadata
        
    - Derived metadata (e.g. date from filename)
        
    - CSV properties (headers, row count, selected fields)
        
- Emission policy:
    
    - Emit once per file (default)
        
    - Emit on change (advanced)
        

---

### 8.5 Idempotency & Deduplication

- Each file-derived event must have a deterministic event key
    
- System must prevent duplicate domain event emission
    
- Ledger of processed files/events must persist across restarts
    

---

### 8.6 Catch-Up Processing

On plugin startup:

- Scan configured folders
    
- Detect unprocessed files
    
- Enqueue ingestion jobs
    
- Emit events as needed
    

---

### 8.7 Observability & Event Log

- Provide an Event Log UI showing:
    
    - Events emitted
        
    - Source file
        
    - Timestamp
        
    - Triggering subscription
        
    - Success/failure
        
- Batch-level visibility for large imports
    

---

## 9. Non-Functional Requirements

### Performance

- No UI blocking during ingestion
    
- Configurable concurrency limits
    
- Graceful degradation under load
    

### Reliability

- No event loss during bursts
    
- Deterministic behavior across restarts
    

### Usability

- Outcome-focused language (“When this happens…”)
    
- No architectural jargon in UI
    

### Transparency

- Every automated action must be explainable
    

---

## 10. UX / UI Components (v0)

- Event Catalog view
    
- Subscription configuration panel
    
- Event Log view
    
- Ingestion status indicators (batch / progress)
    

---

## 11. Example Workflow (Daily CSV Reports)

1. CSV files sync into `Reports/Daily/`
    
2. `file.created` events detected
    
3. Ingestion jobs enqueued
    
4. CSV parsed
    
5. `report.daily_received` domain event emitted
    
6. Event logged
    
7. Downstream subscriptions triggered
    

---

## 12. Success Metrics

- Reduction in manual file processing steps
    
- Zero lost events during burst imports
    
- User adoption of subscriptions
    
- Positive user feedback on trust and transparency
    

---

## 13. Open Questions / Future Extensions

- Web Worker–based parsing
    
- Replay or dry-run mode
    
- Cross-plugin event consumption
    
- Event chaining / workflows
    
- Visual event flow editor
    

---

## 14. Release Scope

### v0 (Foundational)

- File events
    
- Ingestion queue
    
- Domain event definition
    
- Subscriptions
    
- Event log
    
- Catch-up processing
    

### v1+

- Advanced payload transforms
    
- Event chaining
    
- Replay & testing tools
    

---

# Acceptance Criteria — Event System Feature

---

## 1. Event Catalog

### AC-1.1 — Event Visibility

- The system displays a catalog of available events.
    
- Events are grouped into:
    
    - System Events
        
    - Ingestion Events
        
    - Domain Events
        
- Each event shows:
    
    - Name
        
    - Short description
        
    - Source category
        

### AC-1.2 — Domain Event Registration

- When a user defines a new domain event, it appears in the Event Catalog.
    
- The event remains visible after restarting Obsidian.
    

---

## 2. Event Subscriptions

### AC-2.1 — Subscription Creation

- Users can create a subscription by selecting an event from the Event Catalog.
    
- A subscription can be enabled or disabled.
    

### AC-2.2 — Subscription Filtering

- Users can define filters for a subscription, including:
    
    - File path
        
    - File extension
        
    - Filename pattern
        
- Only matching events trigger the subscription.
    

### AC-2.3 — Explicit Behavior

- No automation occurs unless a subscription is explicitly enabled.
    
- Disabling a subscription immediately prevents further triggers.
    

---

## 3. File Event Detection

### AC-3.1 — File Creation Detection

- When a new file is added to the vault, a file-created event is emitted.
    
- The event includes file metadata (path, name, timestamp).
    

### AC-3.2 — File Sync Scenarios

- Files synced via external tools (e.g. OneDrive) are detected the same as locally created files.
    
- Temporary or ignored files are not processed.
    

---

## 4. Ingestion Pipeline

### AC-4.1 — Job Queuing

- File events enqueue ingestion jobs instead of being processed immediately.
    
- Job queuing does not block the UI.
    

### AC-4.2 — Controlled Concurrency

- The system processes ingestion jobs with a defined concurrency limit.
    
- Large numbers of incoming files do not freeze Obsidian.
    

### AC-4.3 — Retry on Failure

- If file parsing fails due to incomplete or locked files, the job retries automatically.
    
- After exceeding retry limits, the job is marked as failed and logged.
    

---

## 5. Domain Event Definition from Files

### AC-5.1 — Event Definition

- Users can define a domain event based on a file event.
    
- The user can choose the emitted event name.
    

### AC-5.2 — Payload Mapping

- Event payloads can include:
    
    - File metadata
        
    - Derived metadata (e.g. from filename)
        
    - CSV properties (headers, row count, selected fields)
        
- The emitted event contains only the configured payload fields.
    

### AC-5.3 — CSV Handling

- CSV files are parsed according to user-defined settings (delimiter, header presence).
    
- Parsing errors are surfaced in the Event Log.
    

---

## 6. Idempotency & Deduplication

### AC-6.1 — Single Emission per Logical File

- A domain event is emitted only once per logical file by default.
    
- Re-syncing or renaming a previously processed file does not emit duplicate events.
    

### AC-6.2 — Deterministic Event Identity

- The system uses a deterministic event key to track processed files.
    
- Event identity persists across restarts.
    

---

## 7. Burst Handling (High Volume)

### AC-7.1 — Burst Safety

- When a large number of files (e.g. 500) are added at once:
    
    - All files are queued
        
    - No events are lost
        
    - UI remains responsive
        

### AC-7.2 — Batch Visibility

- The system indicates when batch ingestion is in progress.
    
- Users can see progress or completion status.
    

---

## 8. Catch-Up Processing

### AC-8.1 — Startup Catch-Up

- On plugin startup, the system scans configured folders.
    
- Files that arrived while Obsidian was closed are detected.
    

### AC-8.2 — No Duplicate Catch-Up

- Files already processed before shutdown are not reprocessed.
    
- Catch-up processing respects idempotency rules.
    

---

## 9. Event Log & Observability

### AC-9.1 — Event Log Visibility

- Users can view an Event Log listing:
    
    - Event name
        
    - Timestamp
        
    - Source file
        
    - Triggering subscription
        
    - Status (success / failure)
        

### AC-9.2 — Explainability

- For each domain event, the system shows:
    
    - Which subscription triggered it
        
    - Which file caused it
        

### AC-9.3 — Failure Transparency

- Failed ingestion or event emission is visible in the Event Log.
    
- Failures do not silently block subsequent events.
    

---

## 10. Persistence & Reliability

### AC-10.1 — Persistence Across Restarts

- Subscriptions, event definitions, and processing state persist across restarts.
    
- No configuration is lost when Obsidian is closed.
    

### AC-10.2 — System Recovery

- If Obsidian crashes during ingestion:
    
    - Pending jobs resume on next startup
        
    - Already completed jobs are not repeated
        

---

## 11. Usability & Trust

### AC-11.1 — Outcome-Focused Language

- UI text uses outcome-based phrasing (e.g. “When a new CSV report arrives…”).
    
- Technical terms are hidden unless explicitly needed.
    

### AC-11.2 — User Control

- Users can disable the entire Event System.
    
- When disabled, no events are emitted or processed.
    

---

## 12. Canonical Scenario Acceptance (Daily CSV Reports)

### AC-12.1 — End-to-End Flow

Given:

- A subscription exists for new CSV files in a configured folder  
    When:
    
- New CSV files are synced into the vault  
    Then:
    
- Each CSV is processed exactly once
    
- A domain event is emitted per logical report
    
- Events appear in the Event Log
    
- No manual intervention is required
    

---

## Definition of Done (Feature-Level)

The Event System feature is considered **Done** when:

- All acceptance criteria above are met
    
- No events are lost during burst or offline scenarios
    
- Users can explain _why_ an event was emitted
    
- The system behaves deterministically and transparently
    

---
# Event System Tech

The EventBus is the communication backbone of Flowti IBDE. All inter-service communication flows through it — services never call each other directly. Events follow the xstate v5 convention `{ type, payload, timestamp }`, enabling future state machine integration.

## Architecture

```
src/infrastructure/events/
├── EventBus.ts      # Pub/sub implementation
├── events.ts        # FlowtiEventMap — central event registry (56 events)
└── types.ts         # IEventBus, FlowtiEvent, EventHandler, branded types
```

### How It Works

1. A service subscribes to an event type via `eventBus.on("user.created", handler)`.
2. Another service emits the event via `await eventBus.emit("user.created", { user })`.
3. The EventBus wraps the payload into a `FlowtiEvent` object with `type`, `payload`, and `timestamp`.
4. Type-specific handlers are called first, in registration order (sequentially, awaiting async handlers).
5. Wildcard (`*`) handlers are called after all type-specific handlers.
6. `emit()` returns a Promise that resolves when all handlers have completed.

---

## API Reference

| Method | Signature | Description |
|--------|-----------|-------------|
| `emit` | `<T>(type: T, payload: EventPayload<T>): Promise<void>` | Emit event to all handlers |
| `on` | `<T>(type: T, handler: EventHandler<T>): () => void` | Subscribe, returns unsubscribe function |
| `on` | `(type: "*", handler: WildcardEventHandler): () => void` | Subscribe to all events |
| `once` | `<T>(type: T, handler: EventHandler<T>): () => void` | One-time handler, auto-unsubscribes |
| `off` | `<T>(type: T, handler: EventHandler<T>): void` | Unsubscribe specific handler |
| `clear` | `(): void` | Remove all handlers |

### Constructor

No options — instantiate directly:

```typescript
const eventBus = new EventBus();
```

---

## Event Structure

Every event is a `FlowtiEvent<T>`:

```typescript
interface FlowtiEvent<T extends EventType> {
  readonly type: T;                    // e.g. "user.created"
  readonly payload: FlowtiEventMap[T]; // type-safe payload
  readonly timestamp: string;          // ISO 8601
}
```

The `FlowtiEventMap` interface defines all valid event types and their payloads. Adding a new event is a single line:

```typescript
// in src/infrastructure/events/events.ts
export interface FlowtiEventMap {
  "task.created": { task: Task };
  "task.completed": { taskId: string };
  // ...
}
```

---

## Subscribe and Emit

### Basic Usage

```typescript
// Subscribe — handler receives the full FlowtiEvent
const unsubscribe = eventBus.on("user.created", (event) => {
  console.log(event.type);             // "user.created"
  console.log(event.payload.user.name); // type-safe
  console.log(event.timestamp);         // "2026-02-09T14:30:00.123Z"
});

// Emit — payload is type-checked against FlowtiEventMap
await eventBus.emit("user.created", { user: newUser });

// Cleanup
unsubscribe();
```

### Multiple Handlers

Multiple handlers can be registered for the same event type. They are called sequentially in registration order:

```typescript
eventBus.on("settings.changed", (e) => {
  logger.setDebugMode(e.payload.settings.debugMode);
});

eventBus.on("settings.changed", (e) => {
  applyTheme(e.payload.settings);
});
```

### Async Handlers

Handlers can be async — the EventBus awaits each handler before calling the next:

```typescript
eventBus.on("file.created", async (event) => {
  const content = await readFile(event.payload.path);
  await processContent(content);
});
```

---

## One-Time Handlers

`once()` registers a handler that auto-unsubscribes after its first invocation:

```typescript
eventBus.once("plugin.ready", (event) => {
  showWelcomeMessage();
  // Handler is automatically removed — won't fire again
});
```

The returned function can cancel the handler before it fires:

```typescript
const cancel = eventBus.once("installer.completed", handler);
cancel(); // Never fires
```

---

## Wildcard Listener

The `*` type receives every event emitted on the bus. Wildcard handlers fire after type-specific handlers:

```typescript
eventBus.on("*", (event) => {
  console.log(`[${event.timestamp}] ${event.type}`, event.payload);
});
```

### Execution Order

```
eventBus.on("user.created", handlerA);   // 1st — type-specific
eventBus.on("user.created", handlerB);   // 2nd — type-specific
eventBus.on("*", wildcardHandler);       // 3rd — wildcard

await eventBus.emit("user.created", payload);
// handlerA → handlerB → wildcardHandler
```

### Use Cases

| Use Case | Pattern |
|----------|---------|
| **Event Trace (debug)** | LoggerService registers `*` to log every event to console |
| **Request/Response** | FileSystemClient registers `*` to match responses by `requestId` |
| **Monitoring** | External tools can observe all events without modifying services |

### Recursion Prevention

The LoggerService's event trace skips events starting with `log.*` to prevent infinite recursion (emitting a log event would trigger the trace, which would emit another log event, etc.).

---

## Unsubscribing

### Via Return Value (preferred)

`on()` returns an unsubscribe function:

```typescript
const unsubscribe = eventBus.on("user.updated", handler);
// ...later
unsubscribe();
```

### Via `off()`

Pass the exact same function reference:

```typescript
const handler = (event) => { /* ... */ };
eventBus.on("user.created", handler);
// ...later
eventBus.off("user.created", handler);
```

### Clear All

Remove every handler of every type (used during plugin shutdown):

```typescript
eventBus.clear();
```

---

## Type Safety

The EventBus is fully generic over `FlowtiEventMap`. TypeScript enforces:

- **Emit**: payload must match the event's type definition
- **Subscribe**: handler receives the correctly typed event
- **Compile-time errors**: misspelled event types or wrong payloads are caught

```typescript
// OK — payload matches
await eventBus.emit("user.created", { user: newUser });

// Compile error — wrong payload
await eventBus.emit("user.created", { settings: {} });

// Compile error — unknown event type
await eventBus.emit("user.blah", {});
```

### Per-Domain Event Ownership

Each domain defines its own events in a local `events.ts`:

```
src/domain/user/events.ts         → UserEventMap
src/domain/settings/events.ts     → SettingsEventMap
src/domain/installer/events.ts    → InstallerEventMap
```

These are composed into the central `FlowtiEventMap` via interface extension:

```typescript
// src/infrastructure/events/events.ts
export interface FlowtiEventMap
  extends UserEventMap, SettingsEventMap, InstallerEventMap {
  // Infrastructure events defined here
  "plugin.ready": { timestamp: string };
  // ...
}
```

This keeps event definitions close to the code that emits them, while providing a single global type for the EventBus.

---

## Event Catalog

60 events across 15 categories. See the [[Backend Architecture|Backend Architecture]] for the full catalog with payloads.

| Category | Count | Examples |
|----------|-------|---------|
| Plugin Lifecycle | 5 | `plugin.loading`, `plugin.ready`, `plugin.unloaded` |
| Service Lifecycle | 4 | `service.registered`, `service.initialized` |
| Commands | 4 | `command.executing`, `command.failed` |
| Views | 1 | `view.registered` |
| Logging | 2 | `log.entry`, `log.error` |
| Errors | 2 | `error.occurred`, `error.handled` |
| File Requests | 6 | `file.create.request`, `file.read.request` |
| File Responses | 6 | `file.create.response`, `file.read.response` |
| File Notifications | 4 | `file.created`, `file.modified`, `file.renamed` |
| Folder Notifications | 3 | `folder.created`, `folder.deleted`, `folder.renamed` |
| Event-File Notifications | 1 | `event.file.triggered` |
| Frontmatter Req/Res | 6 | `frontmatter.get.request`, `frontmatter.update.response` |
| Workspace | 3 | `workspace.leaf-changed`, `workspace.file-opened` |
| Metadata | 2 | `metadata.changed`, `metadata.resolved` |
| Domain (User/Settings/Installer) | 11 | `user.created`, `settings.changed`, `installer.completed` |

---

## Adding a New Event

1. If it belongs to an existing domain, add it to that domain's `events.ts`:

```typescript
// src/domain/user/events.ts
export interface UserEventMap {
  "user.created": { user: FlowtiUser };
  "user.updated": { user: FlowtiUser };
  "user.loaded": { user: FlowtiUser };
  "user.deleted": { userId: string };  // ← new
}
```

2. If it belongs to infrastructure, add it directly to `FlowtiEventMap` in `events.ts`.

3. If it belongs to a new domain, create a new `events.ts` and extend `FlowtiEventMap`:

```typescript
// src/domain/tasks/events.ts
export interface TaskEventMap {
  "task.created": { task: Task };
  "task.completed": { taskId: string };
}

// src/infrastructure/events/events.ts
import type { TaskEventMap } from "../../domain/tasks/events";

export interface FlowtiEventMap
  extends UserEventMap, SettingsEventMap, InstallerEventMap, TaskEventMap {
  // ...
}
```

No runtime registration needed — events are purely a TypeScript type-level construct.

---

## Lifecycle

| Phase | What Happens |
|-------|-------------|
| Phase 1 (Core) | `new EventBus()` — created first, before any service |
| Phase 1–6 | All services receive `eventBus` as a constructor dependency |
| `onunload()` | `eventBus.clear()` — called last so unload listeners can still fire |

---

## Internal Implementation

Handlers are stored in a `Map<EventType | "*", Set<Handler>>`:

- **Set** ensures each handler reference is unique per event type
- **Sequential execution** — handlers are awaited one at a time, not in parallel
- **`once()`** wraps the handler in a wrapper that calls `off()` before delegating

```typescript
// Simplified once() implementation
once<T>(type: T, handler: EventHandler<T>): () => void {
  const wrapper: EventHandler<T> = async (event) => {
    this.off(type, wrapper);  // Remove before calling
    await handler(event);
  };
  return this.on(type, wrapper);
}
```

---

## Testing

### Isolated EventBus per Test

Always create a fresh EventBus in `beforeEach` to avoid handler leakage between tests:

```typescript
import { EventBus } from "../../../src/infrastructure/events/EventBus";

let eventBus: EventBus;

beforeEach(() => {
  eventBus = new EventBus();
});
```

### Asserting Event Emission

```typescript
it("should emit user.created with correct payload", async () => {
  const handler = vi.fn();
  eventBus.on("user.created", handler);

  await eventBus.emit("user.created", { user });

  expect(handler).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "user.created",
      payload: { user },
      timestamp: expect.any(String),
    }),
  );
});
```

### Asserting Execution Order

```typescript
it("should call type-specific before wildcard", async () => {
  const order: string[] = [];
  eventBus.on("user.created", () => { order.push("specific"); });
  eventBus.on("*", () => { order.push("wildcard"); });

  await eventBus.emit("user.created", { user });

  expect(order).toEqual(["specific", "wildcard"]);
});
```

### Testing Handler Cleanup

```typescript
it("should not call handler after unsubscribe", async () => {
  const handler = vi.fn();
  const unsubscribe = eventBus.on("user.created", handler);

  unsubscribe();
  await eventBus.emit("user.created", { user });

  expect(handler).not.toHaveBeenCalled();
});
```

---

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Sequential handler execution** | Guarantees ordering; prevents race conditions between handlers for the same event |
| **Wildcard fires after type-specific** | Type handlers process first; wildcard is for observation (logging, tracing) |
| **`on()` returns unsubscribe function** | Cleaner than requiring the caller to keep a handler reference for `off()` |
| **xstate v5 event format** | `{ type, payload, timestamp }` aligns with state machine conventions for future integration |
| **Per-domain EventMap extension** | Domains own their events; infrastructure composes them — no circular imports |
| **No error swallowing** | If a handler throws, the error propagates to the `emit()` caller — fail-fast |
