---
stage: done
domain: Flowti/System
plugin: "[[Development/flowti/README|README]]"
---

# Event System

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

59 events across 14 categories. See the [[Development/flowti/docs/Service Design Blueprint|Service Design Blueprint]] for the full catalog with payloads.

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
