---
type: Learning
id: L-24
source: "[[Cycle 2 - Session Types and Decision Log]]"
source_pbi: "[[TD-01 UI files exceed size convention]]"
source_increment: 1
domain: architecture
tags:
  - learning
  - architecture
  - refactoring
  - components
---

# L-24: Component extraction before feature addition reduces merge pain

Extracting `SessionWorkspaceView.ts` (1,037 LOC) into 7 panel components in Inc 1 — before adding guiding questions (Inc 3) and decisions (Inc 4) — kept each subsequent increment focused and reviewable. New panels slotted into a clean orchestrator rather than being wedged into a monolith.

## Pattern

- When a file exceeds the size convention and new features will add more code to it, extract first
- The extraction increment is a pure refactor: no behavior changes, all existing tests pass
- Subsequent feature increments add new panel components following the established pattern
- Each panel follows `constructor(container, deps)` → `render()` → optional `refresh*()` methods

## When to Apply

- Before any cycle that adds UI panels to a large orchestrator
- When a file is approaching or exceeding the 500 LOC convention
- When multiple independent features will add to the same view

## Related

- [[TD-01 UI files exceed size convention]]
- [[ADR-024 BaseHubView Shell Extraction]]
- [[L-13 Domain-only increments build confidence]]
