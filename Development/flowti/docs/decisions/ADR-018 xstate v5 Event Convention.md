---
type: DecisionNote
adr: ADR-018
title: xstate v5 Event Convention
status: Accepted
date: 2026-01-15
domain: infrastructure
category: Design Pattern
drivers:
  - Consistency
  - Debuggability
  - Standards Alignment
tags:
  - decision
  - architecture
  - convention
---

# ADR-018: xstate v5 Event Convention

## Status

**Accepted** — applied to all 136 events.

## Context

Events need a consistent shape across the entire system. Without a convention, each service would define events differently — some with flat payloads, some with nested objects, some with different timestamp formats.

### Alternatives Considered

1. **Custom format** — `{ eventName, data, time }` — works but non-standard
2. **CloudEvents spec** — standard but too heavy for an in-process bus
3. **xstate v5 convention (chosen)** — `{ type, payload, timestamp }` — lightweight, well-known, aligns with state machine patterns

## Decision

Every event follows this structure:

```typescript
interface FlowtiEvent<T> {
  type: string;       // e.g., "user.created"
  payload: T;         // typed per event via FlowtiEventMap
  timestamp: number;  // Date.now()
}
```

### Naming Conventions

| Pattern | Meaning | Example |
|---------|---------|---------|
| `domain.action` | Command — request to do something | `subscription.create` |
| `domain.fact` | Fact — something that happened | `subscription.created` |
| `domain.loaded` | Lifecycle — state loaded from storage | `settings.loaded` |
| `domain.changed` | State change — settings/filters updated | `settings.changed` |
| `domain.*.request` | I/O request — correlated by RequestId | `file.create.request` |
| `domain.*.response` | I/O response — correlated by RequestId | `file.create.response` |
| `domain.*.execute` | Trigger — start an operation | `dataExchange.import.execute` |
| `domain.*.completed` | Result — operation finished | `dataExchange.import.completed` |
| `domain.*.failed` | Error — operation failed | `dataExchange.import.failed` |

### Why xstate v5

The xstate v5 convention was chosen for future compatibility — if the plugin ever adopts state machines for complex workflows (e.g., installer wizard, import pipeline), events are already in the right format.

## Consequences

### Positive

- **Consistency**: Every handler receives the same shape — no guessing
- **Debuggable**: Activity log shows `type`, `payload`, and `timestamp` uniformly
- **Standards-aligned**: Familiar to developers who know xstate or similar patterns

### Negative

- **Verbosity**: `event.payload.filePath` instead of `event.filePath` — one extra property access
- **No state machines yet**: The xstate alignment is aspirational — no actual state machines are in use

## Related

- [[Event Catalog]] — Event Naming Conventions section
- [[ADR-001 EventBus as Communication Backbone]]
