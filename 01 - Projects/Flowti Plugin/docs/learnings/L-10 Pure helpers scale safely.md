---
type: Learning
id: L-10
source: "[[Development Lifecycle]]"
source_pbi: "[[PBI-002 Documentation Sessions]]"
source_increment: 5
domain: architecture
tags:
  - learning
  - architecture
  - pure-functions
---

# L-10: Pure helpers scale safely

Adding 6 pure functions (Inc 5) with 20 tests required zero changes to existing code. Pure functions are the cheapest code to add — no mocking, no state, no side effects. When a domain grows, reach for pure helpers first.

## Pattern

- Pure functions have the lowest cost of any code addition: no mocks, no setup, no state
- They can be added without modifying any existing code
- They are trivially testable: input → output, no context needed

## When to Apply

- Any deterministic data transform (formatting, computation, filtering, mapping)
- Before reaching for a service method, ask: can this be a pure function?
- ADR-023 and ADR-026 both use this pattern

## Related

- [[ADR-023 Modal Business Logic Extraction]]
- [[ADR-026 Composable Folder Filtering]]
