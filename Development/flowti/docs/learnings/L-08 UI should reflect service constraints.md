---
type: Learning
id: L-08
source: "[[Development Lifecycle]]"
source_pbi: "[[PBI-002 Documentation Sessions]]"
source_increment: 3
domain: ui
tags:
  - learning
  - ui
  - ux
---

# L-08: UI should reflect service constraints

The service already rejected starting a session when another is active, but the UI still showed the Start button — misleading. UI must mirror domain constraints to prevent confusion.

## Pattern

- If the service rejects an action, the UI should hide or disable the control for that action
- Don't rely on error messages to communicate constraints — prevent the action in the UI
- Service-side guards are a safety net, not the primary UX mechanism

## When to Apply

- Any UI action that can fail due to domain rules (mutually exclusive states, caps, preconditions)
- When the service has validation logic that the UI should reflect proactively
