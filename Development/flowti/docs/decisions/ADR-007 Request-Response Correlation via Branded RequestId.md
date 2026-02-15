---
type: DecisionNote
adr: ADR-007
title: Request-Response Correlation via Branded RequestId
status: Accepted
date: 2026-01-15
domain: infrastructure
category: Design Pattern
drivers:
  - Async Safety
  - Type Safety
  - Concurrency
tags:
  - decision
  - architecture
  - pattern
---

# ADR-007: Request-Response Correlation via Branded RequestId

## Status

**Accepted** — in use for all file and frontmatter operations.

## Context

File operations in the plugin are asynchronous. The `FileSystemClient` emits a `file.create.request` event, and the `EventBridge` handles it by calling the Obsidian API, then emits a `file.create.response`. When multiple operations are in-flight simultaneously, we need a way to match each response to its originating request.

### Alternatives Considered

1. **Direct async return** — `await eventBridge.createFile(path)` — creates tight coupling, bypasses EventBus
2. **Global sequence counter** — simpler but not type-safe, collision risk with concurrent operations
3. **Branded `RequestId` type with UUID (chosen)** — `string & { __brand: "RequestId" }`, unique per request, type-safe

## Decision

Each file operation generates a unique `RequestId` (branded string type). The request payload includes this ID, and the response payload echoes it back. The `FileSystemClient` uses `once()` to listen for the matching response:

```typescript
const requestId = generateRequestId();
const responsePromise = new Promise((resolve) => {
  eventBus.once("file.create.response", (event) => {
    if (event.payload.requestId === requestId) resolve(event.payload);
  });
});
eventBus.emit("file.create.request", { requestId, path, content });
return responsePromise;
```

A timeout (default 5000ms) rejects the promise if no response arrives.

### Branded Type

```typescript
type RequestId = string & { __brand: "RequestId" };
```

This prevents accidentally passing a plain string where a `RequestId` is expected, catching misuse at compile time.

## Consequences

### Positive

- **Concurrency-safe**: Multiple in-flight operations never collide
- **Type-safe**: Branded type prevents accidental string substitution
- **Debuggable**: Each request has a traceable ID through the event log

### Negative

- **Timeout risk**: If EventBridge fails silently, the request hangs until timeout
- **Complexity**: Two events per operation (request + response) vs. one direct call
- **Listener cleanup**: `once()` handlers for non-matching responses accumulate until the matching one fires

## Related

- [[Backend Architecture]] — FileSystemClient component section
- [[ADR-003 EventBridge as Sole Obsidian API Contact Point]]
