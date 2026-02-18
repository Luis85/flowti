---
type: Learning
id: L-07
source: "[[Development Lifecycle]]"
source_pbi: "[[PBI-002 Documentation Sessions]]"
source_increment: 3
domain: architecture
tags:
  - learning
  - architecture
  - reuse
---

# L-07: Reuse existing pipelines for new features

Both `rerunSession()` and `createFromTemplate()` call `handleCreate()` internally. This reuses the existing creation pipeline (eviction, persistence, `session.created` event) with zero duplication.

## Pattern

- New creation variants (rerun, create-from-template) should delegate to the core creation handler
- The core handler owns: validation, eviction, persistence, event emission
- Variants only transform input before calling the core handler

## When to Apply

- When adding new ways to create the same entity (clone, import, duplicate, spawn)
- When the creation pipeline has side effects (eviction, events) that must fire consistently
