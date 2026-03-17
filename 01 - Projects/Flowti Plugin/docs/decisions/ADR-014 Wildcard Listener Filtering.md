---
type: DecisionNote
adr: ADR-014
title: Wildcard Listener Filtering via INTERNAL_EVENT_PREFIXES
status: Accepted
date: 2026-01-20
domain: infrastructure
category: Design Pattern
drivers:
  - Infinite Loop Prevention
  - Performance
  - Correctness
tags:
  - decision
  - architecture
  - pattern
---

# ADR-014: Wildcard Listener Filtering via INTERNAL_EVENT_PREFIXES

## Status

**Accepted** — required for correctness.

## Context

Several services use `eventBus.on("*", handler)` to react to all events:

- **LoggerService**: Traces every event in debug mode
- **EventNotificationService**: Checks if a fired event matches a notification rule
- **SubscriptionService**: Checks if a fired event matches a subscription filter
- **IngestionService**: Watches for configured event types
- **EventLogView**: Captures all events for the activity feed

Without filtering, wildcard listeners cause infinite loops: LoggerService logs an event → emits `log.entry` → LoggerService logs `log.entry` → emits `log.entry` → ...

### Alternatives Considered

1. **Per-listener ad-hoc filtering** — each service checks `if (type.startsWith("log.")) return` — scattered, easy to miss
2. **EventBus built-in exclusion** — EventBus skips certain prefixes for wildcards — couples EventBus to domain knowledge
3. **Shared prefix array (chosen)** — `INTERNAL_EVENT_PREFIXES` in catalog.ts, used by `isSkippedEvent()` helper

## Decision

A shared array `INTERNAL_EVENT_PREFIXES` defines event prefixes that wildcard listeners should skip:

```typescript
const INTERNAL_EVENT_PREFIXES = [
  "log.", "error.", "plugin.", "service.",
  "command.", "view.", "settings.", "ui."
];
```

Each wildcard listener calls `isSkippedEvent(eventType, additionalPrefixes)`:

```typescript
// In wildcard handler:
if (isSkippedEvent(event.type, ["myDomain."])) return;
```

Services add their own domain prefix to prevent self-triggering (e.g., SubscriptionService skips `subscription.*`).

## Consequences

### Positive

- **No infinite loops**: Logger can't retrigger itself, subscription matcher can't match its own events
- **Centralized**: One array, one helper function — all wildcard listeners use the same pattern
- **Extensible**: New prefixes (e.g., `ui.` added in Feb 2026) are added once

### Negative

- **Convention-based**: Developers must remember to use `isSkippedEvent()` — not enforced by the type system
- **Silent drops**: Events matching internal prefixes are invisible to wildcard listeners — by design, but can confuse debugging

## Related

- [[Event Catalog]] — Wildcard Listener Rules section
- [[ADR-001 EventBus as Communication Backbone]]
