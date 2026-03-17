---
type: Learning
id: L-01
source: "[[Development Lifecycle]]"
source_pbi: "[[PBI-002 Documentation Sessions]]"
source_increment: 1
domain: architecture
tags:
  - learning
  - architecture
  - testing
---

# L-01: Domain-first, UI-second

Building the SessionService domain in increment 1 (with 60 tests) before any UI in increment 2 meant the UI layer was pure presentation — no business logic to debug. The service contract was stable by the time components consumed it.

## Pattern

1. Deliver domain types, events, and service with full test coverage in one increment
2. Deliver UI components that consume the service in the next increment
3. The UI layer becomes a thin rendering shell — no business logic to test or debug

## When to Apply

- Any new domain that will have a corresponding UI
- When the service contract is well-understood and unlikely to change during UI development

## Related

- ADR-023: Modal Business Logic Extraction (pure functions belong in domain, not UI)
