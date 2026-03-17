---
type: Learning
id: L-04
source: "[[Development Lifecycle]]"
source_pbi: "[[PBI-002 Documentation Sessions]]"
source_increment: 2
domain: architecture
tags:
  - learning
  - type-safety
  - boundaries
---

# L-04: Type safety at boundaries

The TSC error with `SessionType` cast at the modal → event boundary was a valid catch. Modal callbacks return `string` (generic dropdown), but domain events expect typed unions. The `as SessionType` cast is safe because the dropdown is populated from `SESSION_TYPES`, but this boundary deserves attention in any future modal → event wiring.

## Pattern

- UI components (modals, forms) produce generic types (`string`, `number`)
- Domain events expect typed unions (`SessionType`, `SessionStatus`)
- The cast at the boundary is safe ONLY if the UI is constrained to valid values (e.g., dropdown populated from the union's array)

## When to Apply

- Any modal-to-event or form-to-command wiring
- When a UI control produces a generic type that feeds into a typed domain event
