---
type: DecisionNote
adr: ADR-001
title: EventBus as Communication Backbone
status: Accepted
date: 2026-01-15
domain: infrastructure
category: Architecture
drivers:
  - Decoupling
  - Observability
  - Testability
tags:
  - decision
  - architecture
  - event-system
---

# ADR-001: EventBus as Communication Backbone

## Status

**Accepted** — foundational decision, in effect since initial architecture.

## Context

The Flowti IBDE plugin orchestrates 11 domain services, 6 views, and multiple modals within the Obsidian platform. Services need to communicate without creating tight coupling. We need a mechanism that:

- Allows services to react to changes without importing each other
- Makes all system activity observable for debugging and logging
- Supports type-safe event contracts at compile time
- Enables testing services in isolation

### Alternatives Considered

1. **Direct method calls between services** — simple but creates tight coupling and makes the dependency graph brittle
2. **Dependency injection with interfaces** — reduces coupling but still requires services to know about each other's interfaces
3. **External message broker (e.g., RxJS, Redux)** — adds third-party dependency, over-engineered for an Obsidian plugin
4. **Custom EventBus (chosen)** — typed pub/sub with wildcard support, zero dependencies

## Decision

All inter-service communication flows through a typed `EventBus` implementing `IEventBus`. Services emit events — never import other services. The EventBus supports:

- **Type-specific handlers**: `on("user.created", handler)`
- **Wildcard handlers**: `on("*", handler)` for cross-cutting concerns (logging, activity feed)
- **Once handlers**: `once("event", handler)` for one-shot listeners
- **Typed event map**: `FlowtiEventMap` ensures compile-time type safety via `satisfies`

### Communication Rules

1. Services emit events on the EventBus — never import other services
2. Domain commands use `domain.action` naming (e.g., `subscription.create`)
3. Domain facts use `domain.fact` naming (e.g., `subscription.created`)
4. All events follow the xstate v5 convention: `{ type, payload, timestamp }`

## Consequences

### Positive

- **Full decoupling**: Services can be developed, tested, and evolved independently
- **Observability**: Every system action is an observable event — the Event Log view shows all activity in real-time
- **Testability**: Tests use real `EventBus` instances, verifying actual pub/sub behavior without mocks
- **Extensibility**: New services can subscribe to existing events without modifying producers

### Negative

- **Indirection**: Following event flow requires searching for emitters and listeners across the codebase
- **No guaranteed delivery**: If no listener is registered, events are silently dropped
- **Wildcard performance**: Every wildcard listener fires on every event — mitigated by `INTERNAL_EVENT_PREFIXES` filtering (see [[ADR-014 Wildcard Listener Filtering]])

### Risks

- Event naming collisions between domains — mitigated by domain-prefix convention
- Memory leaks from orphaned listeners — mitigated by `IDisposable` pattern and `dispose()` on all services

## Related

- [[Backend Architecture]] — Communication Rules section
- [[Event Catalog]] — Full event reference
- [[ADR-002 Domain-Driven Design with Bounded Contexts]]
- [[ADR-014 Wildcard Listener Filtering]]
- [[ADR-018 xstate v5 Event Convention]]
