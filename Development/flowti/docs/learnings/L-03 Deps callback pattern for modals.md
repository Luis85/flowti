---
type: Learning
id: L-03
source: "[[Development Lifecycle]]"
source_pbi: "[[PBI-002 Documentation Sessions]]"
source_increment: 2
domain: ui
tags:
  - learning
  - testing
  - ui
  - modals
---

# L-03: Deps callback pattern for modals

Rather than having components import modal classes directly, the `openNewSessionModal()` callback in `UserHubComponentDeps` keeps components testable — tests mock it as `vi.fn()` with zero modal dependencies.

## Pattern

- Define modal openers as callback functions in the component's `Deps` interface
- Wire the callback in the parent view that has access to the Obsidian `App` instance
- Tests mock the callback as `vi.fn()` — no modal class needed in test context

## When to Apply

- Any component that needs to open a modal or dialog
- When testing components that trigger user interactions requiring Obsidian APIs
