---
type: DecisionNote
adr: ADR-024
title: BaseHubView Shell Extraction
status: Accepted
date: 2026-02-15
domain: ui
category: Architecture
drivers:
  - DRY (Don't Repeat Yourself)
  - Hub Unification
  - Extensibility
tags:
  - decision
  - architecture
  - ui
  - hubs
---

# ADR-024: BaseHubView Shell Extraction

## Status

**Accepted** — applied to EventCatalogView and DataExchangeHubView.

## Context

The Hubs PRD (approved 2026-02-15, FRI 24/35) identified that EventCatalogView (864 LOC) and DataExchangeHubView (556 LOC) share identical shell lifecycle patterns but implement them independently:

- **Shell construction**: `onOpen()` → `container.empty()` → wrapper → top bar → split layout
- **Navigation**: `navigateTo(page)` → toggle dashboard/split visibility → update title → re-render
- **Render scheduling**: `scheduleRender()` → 16ms debounce → dispatch to active tab
- **Cleanup**: `onClose()` → clear timer → run all unsubscribes

This duplication means every new Hub view would need to reimplement ~220 LOC of boilerplate shell logic. The Hubs PRD envisions 5+ Hub views (User Hub, Product Hub, Project Hub, plus existing System Hubs), making this duplication unsustainable.

### The Question: Extract a Base Class or Use Composition?

Two approaches were considered:

1. **Inheritance (BaseHubView)**: Abstract class that owns the shell lifecycle. Subclasses implement domain-specific rendering via abstract methods.

2. **Composition (HubShell helper)**: A factory function that builds the shell DOM and returns a controller object. Views compose with the controller instead of extending a base class.

## Decision

**Use inheritance via `BaseHubView<TPage extends string>`.**

### Why Inheritance Over Composition

The shell lifecycle is tightly coupled to the Obsidian `ItemView` lifecycle (`onOpen`, `onClose`). A composition approach would require the view to:
1. Call the shell builder in `onOpen()`
2. Forward `onClose()` to the controller
3. Manually wire navigation and render scheduling

This amounts to the same boilerplate with extra indirection. Inheritance eliminates this by owning the `ItemView` overrides directly.

The generic type parameter `<TPage>` provides type-safe tab IDs per hub (e.g., `CatalogTab`, `DXTab`) while keeping the base class reusable.

### What the Base Class Owns

- Wrapper + top bar + tab bar + split layout DOM construction
- `navigateTo(page)` with visibility toggling, title update, search placeholder, hub event emission
- `scheduleRender()` with 16ms debounce dispatching to `onDashboardRender()` or `onTabRender()`
- `renderTabBar()` from `getTabDefinitions()`
- `onClose()` timer cleanup + unsubscribe management
- Hub lifecycle event emission (`hub.opened`, `hub.closed`, `hub.tab.changed`)

### What Subclasses Own

- `getViewType()` — Obsidian view type (intentionally NOT in base; see below)
- `getHubId()`, `getHubType()` — hub identity for events
- `getTabDefinitions()` — tab bar items
- `onHubOpen()` — component creation + event subscriptions
- `onHubClose()` — subclass-specific cleanup
- `onDashboardRender()`, `onTabRender(tabId)` — domain-specific rendering
- `onTabChanged()` — virtual hook for tab-specific DOM toggling
- All domain state, scanning logic, and component instances

### Key Design Decision: getViewType() NOT in Base Class

The Obsidian view type (e.g., `"flowti-event-catalog"`) differs from the hub ID (e.g., `"event-catalog"`). The base class cannot derive one from the other, so `getViewType()` remains abstract and must be overridden by each subclass.

### What Was Deferred

- **HubAdapter interface** (TD-54/55): Premature for 2 System Hubs that own data directly. Will introduce when first Domain Hub is built.
- **Component Registry** (TD-51): Hardcoded component instantiation works at current scale.
- **Declarative Tab Definitions** (TD-52): JSON tab configs with validation — unnecessary overhead for 2 hubs.
- **UI Primitive Library** (TD-53): Inline styles adequate; separate concern from shell extraction.

## Consequences

### Positive

- **~220 LOC of duplicated shell logic eliminated** from the two existing views
- **New Hub views require ~10 abstract method implementations** — no shell/layout code
- **DataExchangeHubView gains a tab bar** via inheritance (UX improvement: consistent navigation)
- **Hub lifecycle events** (`hub.opened/closed/tab.changed`) fire automatically for all hubs
- **Zero test regression**: 1,662 tests pass unchanged after migration
- **Build pipeline green**: vitest + typedoc + tsc + eslint + esbuild all pass

### Negative

- **Inheritance coupling**: Subclasses depend on BaseHubView's protected API. Changes to the base class affect all hubs. Mitigated by keeping the protected surface minimal and stable.
- **Type parameter complexity**: `BaseHubView<TPage>` requires subclasses to define a tab type alias. Minor ergonomic cost.

### Neutral

- **LOC impact**: +278 (base class) + 11 (hub events) - 477 (removed from views) = net -188 LOC reduction. New file count: +2 (BaseHubView.ts, hub/events.ts).

## Files

| File | Change |
|------|--------|
| `src/ui/BaseHubView.ts` | NEW — 278 LOC abstract base class |
| `src/domain/hub/events.ts` | NEW — 11 LOC HubEventMap |
| `src/ui/EventCatalogView.ts` | MODIFIED — extends BaseHubView<CatalogTab>, 864→723 LOC |
| `src/ui/DataExchangeHubView.ts` | MODIFIED — extends BaseHubView<DXTab>, 556→477 LOC |
| `src/infrastructure/events/events.ts` | MODIFIED — FlowtiEventMap extends HubEventMap |
| `src/infrastructure/events/catalog.ts` | MODIFIED — 3 hub events + "Hub" category |
| `src/domain/settings/settings.ts` | MODIFIED — "Hub" in DEFAULT_CATALOG_CATEGORIES |

## Related

- PRD: [[Hubs PRD]] (Phase 1: Foundation, Phase 2: System Hub Migration)
- Technical Review: [[Technical Review 2026-02-15]]
- Three Amigos: [[Three Amigos Review 2026-02-15]]
- Future: TD-51 (Component Registry), TD-52 (Declarative Tab Definitions), PBI-001 (User Hub)
