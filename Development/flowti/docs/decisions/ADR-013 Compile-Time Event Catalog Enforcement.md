---
type: DecisionNote
adr: ADR-013
title: Compile-Time Event Catalog Enforcement
status: Accepted
date: 2026-01-15
domain: infrastructure
category: Type Safety
drivers:
  - Completeness
  - Type Safety
  - Self-Documentation
tags:
  - decision
  - architecture
  - type-safety
---

# ADR-013: Compile-Time Event Catalog Enforcement

## Status

**Accepted** — in effect since catalog was first created.

## Context

The plugin defines 136 events across 11 domains. Each event needs catalog metadata (description, category, domain, tags) for the Event Catalog view. If a developer adds a new event to `FlowtiEventMap` but forgets to add its catalog entry, users see an undocumented event with no context.

### Alternatives Considered

1. **Manual documentation** — error-prone, gets stale
2. **Runtime validation** — catches at startup but not at development time
3. **`satisfies` enforcement (chosen)** — TypeScript compiler error if catalog is incomplete

## Decision

The `CATALOG_DATA` object uses TypeScript's `satisfies` operator:

```typescript
const CATALOG_DATA = {
  "user.created": { description: "...", category: "User", ... },
  // ...
} satisfies Record<keyof FlowtiEventMap, EventCatalogMeta>;
```

This means:
- Adding a new event to `FlowtiEventMap` without a `CATALOG_DATA` entry → **compile error**
- Adding a `CATALOG_DATA` entry for a non-existent event → **compile error**
- The catalog is always complete and always matches the event map

### Per-Domain Event Maps

Each domain exports its own `EventMap` interface, composed into `FlowtiEventMap` via `extends`:

```typescript
interface FlowtiEventMap extends
  SettingsEventMap,
  UserEventMap,
  InstallerEventMap,
  // ... all 11 domains
  UiCommandEventMap {}
```

This is a compile-time-only dependency — no runtime import from `domain/` to `infrastructure/`.

## Consequences

### Positive

- **Guaranteed completeness**: Every event has catalog metadata — impossible to forget
- **Self-documenting**: Developers see the required metadata shape when adding events
- **Type-safe payloads**: Each event's payload type is enforced at `emit()` and `on()` call sites

### Negative

- **Catalog file grows**: 136 entries in one file (catalog.ts) — but it's data, not logic
- **Boilerplate per event**: Each new event requires 4-5 metadata fields — small cost for guaranteed documentation

## Related

- [[Event Catalog]] — Runtime catalog reference
- [[ADR-001 EventBus as Communication Backbone]]
- [[ADR-002 Domain-Driven Design with Bounded Contexts]]
