---
type: DecisionNote
adr: ADR-010
title: No External State Libraries
status: Accepted
date: 2026-01-15
domain: ui
category: Design Pattern
drivers:
  - Simplicity
  - Bundle Size
  - Obsidian Compatibility
tags:
  - decision
  - frontend
  - state-management
---

# ADR-010: No External State Libraries

## Status

**Accepted** — deliberate choice, not a gap.

## Context

Modern web applications typically use state management libraries (Redux, Zustand, MobX, Jotai) for complex UI state. The Flowti IBDE plugin has 6 views with multi-tab navigation, filter state, selected items, and real-time event updates.

### Alternatives Considered

1. **Redux** — powerful but heavy, overkill for an Obsidian plugin
2. **Zustand** — lightweight but adds a dependency, requires React-like patterns
3. **MobX** — reactive but fights Obsidian's imperative DOM API
4. **Direct orchestrator state (chosen)** — orchestrators own state fields, components access via `getState()`/`setState()`

## Decision

State is managed directly by orchestrator views. No external state libraries are used.

### Pattern

1. **Orchestrator** declares private state fields (e.g., `selectedDomainName`, `importConfigs[]`)
2. **State interface** defines the shape (e.g., `CatalogState`, `HubState`)
3. **`getState()`** returns a snapshot for components to read
4. **`setState(partial)`** applies partial updates and triggers re-render
5. **EventBus listeners** in the orchestrator update state in response to domain events

### Re-rendering

`scheduleRender()` debounces at 16ms (~1 frame). State changes queue a re-render, preventing excessive DOM updates when multiple events fire in quick succession.

## Consequences

### Positive

- **Zero dependencies**: No state library to install, configure, or maintain
- **Obsidian-native**: Works with imperative DOM manipulation, no virtual DOM needed
- **Simple mental model**: State flows from orchestrator to components via `deps.getState()`
- **Small bundle**: No library overhead — the plugin's `main.js` stays lean

### Negative

- **No reactivity**: State changes require explicit `scheduleRender()` — easy to forget
- **Prop threading**: Deep component trees pass state and callbacks through `deps` objects
- **No time-travel debugging**: Can't inspect previous states or replay actions
- **No derived state caching**: Computed values recalculate on every render

## Related

- [[Frontend Architecture]] — State Management section
- [[ADR-006 Orchestrator-Component UI Pattern]]
