---
type: DecisionNote
adr: ADR-002
title: Domain-Driven Design with Bounded Contexts
status: Accepted
date: 2026-01-15
domain: architecture
category: Architecture
drivers:
  - Separation of Concerns
  - Maintainability
  - Scalability
tags:
  - decision
  - architecture
  - ddd
---

# ADR-002: Domain-Driven Design with Bounded Contexts

## Status

**Accepted** — in effect since Feb 2026 restructuring.

## Context

The plugin grew from a simple event catalog into a multi-feature system with settings, user management, file processing, data exchange, subscriptions, and more. Without clear boundaries, code would mix concerns and become difficult to maintain.

### Alternatives Considered

1. **Feature-based folders** — group by feature (e.g., `import/`, `export/`) — blurs domain boundaries when features share concepts
2. **Layer-only architecture** — `models/`, `services/`, `views/` — works for small apps but doesn't scale
3. **DDD with bounded contexts (chosen)** — each domain owns its types, events, and service

## Decision

The codebase is structured into **11 bounded contexts**, each owning:

- **`types.ts`** — domain-specific type definitions
- **`events.ts`** — `EventMap` interface for domain events
- **`*Service.ts`** — domain service with injected `IEventBus` and `IStorageProvider`

```
src/domain/
├── dataExchange/    # CSV import/export, pipelines
├── docs/            # Documentation file CRUD
├── discovery/       # Vault scanning for custom events
├── eventDefinition/ # Source → domain event mapping
├── eventFilter/     # Event visibility toggles
├── eventNotify/     # Event notification popups
├── ingestion/       # File processing pipeline
├── installer/       # First-run setup wizard
├── settings/        # Plugin configuration
├── subscription/    # Event watcher CRUD
└── user/            # User profile management
```

### Cross-Domain Communication

Domains never import each other. All communication flows through the EventBus:

- Domain A emits `domainA.fact` → Domain B reacts to it
- The `FlowtiEventMap` type composes per-domain event maps via `extends` (compile-time only dependency)

## Consequences

### Positive

- **Clear ownership**: Each domain is self-contained — changes in one don't ripple to others
- **Independent testing**: Domain services are tested in isolation with mock storage and real EventBus
- **Discoverable structure**: New contributors can find all `subscription` code in `domain/subscription/`
- **Per-domain event files**: Event contracts are co-located with the domain that defines them

### Negative

- **More files**: Even simple domains (e.g., `eventFilter`) have 3+ files
- **Event map composition boilerplate**: `FlowtiEventMap extends SettingsEventMap & UserEventMap & ...`
- **Cross-cutting queries**: UI views that combine data from multiple domains must listen to events from each

## Related

- [[Backend Architecture]] — Domain Components section
- [[ADR-001 EventBus as Communication Backbone]]
- [[ADR-005 File-Driven Entity Model]]
