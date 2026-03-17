---
type: Learning
id: L-22
source: "[[Development Lifecycle]]"
source_pbi: Documentation Audit 2026-02-18
domain: architecture
tags:
  - learning
  - architecture
  - flows
  - events
---

# L-22: Every major event domain needs a flow doc

The audit found that Session Workspaces (18+ events) and Inbox (4 events) have no flow documentation, while all other major domains (Import, Export, Subscription, Ingestion, Event Definition) do. The flow docs are the primary way developers understand event sequences — without them, the only way to trace a session lifecycle is reading source code.

## Pattern

- If a domain emits 3+ events in a sequence, it needs a flow doc
- Flow docs serve as the "integration test specification" — they document the expected event chain
- Flow docs should be created alongside the domain implementation, not deferred
- Each flow doc should have a matching integration test in `tests/flows/`

## When to Apply

- When adding a new domain with events: create the flow doc in the same increment
- When adding events to an existing domain: update the flow doc
- During PRD refinement: check if the feature introduces a new event flow that needs documentation
- When a new contributor asks "how does X work?" — if the answer is "read the code", a flow doc is missing

## Checklist

1. Does the domain emit events in a sequence? → Flow doc needed
2. Does the flow doc exist in `docs/flows/`? → If not, create it (TD-94/95)
3. Does a matching integration test exist in `tests/flows/`? → If not, create it
4. Do the event names in the flow doc match the catalog? → Verify (TD-97)

## Related

- TD-94: Missing Session Management flow doc
- TD-95: Missing Inbox Management flow doc
- TD-97: Stale event reference in Export flow
- [[Development Lifecycle]] (Phase 9: Documentation)
