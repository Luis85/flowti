---
type: DecisionNote
adr: ADR-015
title: Composition over Inheritance for Service Decomposition
status: Accepted
date: 2026-02-08
domain: domain
category: Design Pattern
drivers:
  - Maintainability
  - Testability
  - Facade Preservation
tags:
  - decision
  - architecture
  - pattern
---

# ADR-015: Composition over Inheritance for Service Decomposition

## Status

**Accepted** — applied in Phase 6 (DataExchangeService) and Phase 11 (BaseEntityTab).

## Context

As domain services grow (DataExchangeService reached 1,802 LOC), they need to be decomposed. The question is how: should sub-modules inherit from a base class, or should the parent compose them as internal collaborators?

### Alternatives Considered

1. **Inheritance** — `ConfigDocService extends DataExchangeService` — brittle, exposes internals
2. **Standalone services** — each sub-module registered independently in ServiceContainer — breaks the facade, changes public API
3. **Composition with facade (chosen)** — parent service creates and delegates to sub-modules internally, public API unchanged

## Decision

Large services decompose via composition:

- **Parent (facade)**: Remains the public API — all consumers see the same interface
- **Sub-modules**: Receive typed dependency interfaces (e.g., `ConfigDocServiceDeps`), not parent references
- **State access**: Via `ConfigStateAccessor` interface — read-only access to parent's state
- **Zero consumer changes**: Tests and UI code don't change at all

### DataExchangeService Example (1,802 → 579 LOC)

| Sub-module | LOC | Responsibility |
|------------|-----|----------------|
| ConfigDocService | 435 | Path resolution, doc CRUD |
| configDocContent | 579 | Content builders (pure functions) |
| PipelineExecutor | 223 | Multi-source execution |
| ConfigPathTracker | 127 | File/folder rename tracking |
| DataDictionaryBuilder | 125 | Property usage aggregation |

### BaseEntityTab Example (entity tab deduplication)

4 tabs (Flows, Systems, Actors, Products) shared ~80% identical code. Extracted into `BaseEntityTab<T>` abstract class with `EntityTabConfig<T>` — each tab is a thin subclass (~115 LOC).

## Consequences

### Positive

- **No breaking changes**: Public API surface is preserved — existing tests pass unchanged
- **Focused files**: Each sub-module handles one concern, under 500 LOC
- **Testable modules**: Sub-modules with typed deps can be tested independently
- **Incremental**: One module extracted at a time, build verified between each step

### Negative

- **Wiring overhead**: Parent must instantiate and delegate to sub-modules
- **State sharing**: `ConfigStateAccessor` interface adds a layer between sub-modules and parent state
- **Discovery**: Developers must understand the facade to find where logic actually lives

## Related

- [[Frontend Architecture]] — Phase 6 and Phase 11 refactoring sections
- [[ADR-006 Orchestrator-Component UI Pattern]]
