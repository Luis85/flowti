---
type: Learning
id: L-13
source: "[[Development Lifecycle]]"
source_pbi: "[[PBI-002 Documentation Sessions]]"
source_increment: 6
domain: architecture
tags:
  - learning
  - architecture
  - increments
---

# L-13: Domain-only increments build confidence

Inc 6 (Goals & Notes) touched zero UI code — types, events, service, helpers, catalog, and tests only. This made the increment small, focused, and easy to review. When UI is built later (Inc 7-8), the domain contract is already stable and tested.

## Pattern

- Deliver domain changes (types, events, service methods, pure helpers) as standalone increments
- These increments are small, focused, and have near-100% test coverage
- The UI increment that follows consumes a stable, tested contract

## When to Apply

- When adding new capabilities that touch both domain and UI
- Especially valuable when the domain contract is complex or has many edge cases
