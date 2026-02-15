---
type: DecisionNote
adr: ADR-006
title: Orchestrator + Component UI Pattern
status: Accepted
date: 2026-02-01
domain: ui
category: Design Pattern
drivers:
  - Maintainability
  - Testability
  - File Size Control
tags:
  - decision
  - frontend
  - pattern
---

# ADR-006: Orchestrator + Component UI Pattern

## Status

**Accepted** — adopted through Phase 1-11 refactoring (Feb 2026).

## Context

Complex Obsidian views (Event Catalog at 3,714 LOC, DataExchangeHubView, CsvActionView) became monolithic. Single files handled lifecycle, state, scanning, navigation, and rendering — violating SRP and making the code difficult to navigate and test.

### Alternatives Considered

1. **Framework-based components** (React, Svelte, Lit) — adds bundle size and complexity, fights Obsidian's imperative DOM API
2. **Inheritance hierarchy** — `BaseView → CatalogView → EventsTab` — rigid, hard to compose
3. **Orchestrator + plain TypeScript components (chosen)** — thin orchestrator for lifecycle + injectable components for rendering

## Decision

Complex views are split into:

- **Orchestrator** (Obsidian `ItemView` subclass): owns lifecycle, state, scanning, navigation, EventBus subscriptions
- **Components** (plain TypeScript classes): receive `(masterEl, detailEl, deps)`, render to DOM elements, no Obsidian imports

### Pattern

```typescript
class SomeTab {
  constructor(
    private masterEl: HTMLElement,
    private detailEl: HTMLElement,
    private deps: ComponentDeps
  ) {}
  renderMaster(): void { /* list rendering */ }
  renderDetail(): void { /* detail panel rendering */ }
}
```

Components access state via `deps.getState()` and trigger updates via `deps.setState(partial)`. The orchestrator debounces re-renders with `scheduleRender()` (16ms).

### Results

| View | Before | After | Reduction | Components |
|------|--------|-------|-----------|------------|
| EventCatalogView | 3,714 LOC | 836 LOC | 78% | 15 components |
| DataExchangeHubView | — | 484 LOC | — | 21 components |
| CsvActionView | 2,190 LOC | 747 LOC | — | 10 components |
| ExportView | 1,355 LOC | 655 LOC | — | 7 components |

## Consequences

### Positive

- **Testable components**: Components can be tested with mock deps and DOM assertions (via obsidian-stub)
- **Navigable code**: Each component handles one concern — one tab, one page, one section
- **No framework dependency**: Plain TypeScript, no build-time transforms, no runtime overhead
- **Facade preservation**: Public API of the orchestrator never changes — internal extraction is invisible to consumers

### Negative

- **More files**: Each extraction creates 2-5 new files (component + types)
- **Callback threading**: Deep component trees pass callbacks through `deps` objects — can get verbose
- **No reactivity**: State changes require explicit `scheduleRender()` calls — no automatic re-rendering

## Related

- [[Frontend Architecture]] — Full refactoring history (Phase 1-11)
- [[ADR-010 No External State Libraries]]
