---
type: Learning
id: L-20
source: "[[Development Lifecycle]]"
source_pbi: "[[PBI-002 Documentation Sessions]]"
source_increment: 10
domain: architecture
tags:
  - learning
  - architecture
  - pure-functions
---

# L-20: Pure functions for filtering compose cleanly

The `isExcluded()` function (ADR-026) is 12 LOC, has zero dependencies, and handles both global and per-session filters via argument composition. No service, no state, no subscriptions. When the problem is well-bounded and stateless, a pure function beats a service every time.

## Pattern

- For filtering/validation logic with multiple input sources, compose via function arguments
- `isExcluded(path, globalFilter, perSessionFilter)` — caller provides both arrays
- No caching, no subscriptions, no reactive invalidation needed

## When to Apply

- Any stateless filter, validator, or matcher
- When a "filter service" is proposed — ask first if a pure function would suffice
- When the filtering logic is called at a single call site

## Related

- [[ADR-026 Composable Folder Filtering]]
- [[L-10 Pure helpers scale safely]]
