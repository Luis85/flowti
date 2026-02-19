---
type: Component
domain: Flowti
stage: done
description: "Abstract base class providing shared Hub shell lifecycle: wrapper, top bar, tab bar, split layout, render scheduling"
source: "[[Development/flowti/src/ui/BaseHubView.ts|BaseHubView.ts]]"
parent: "[[EventCatalogView]], [[DataExchangeHubView]]"
tags:
  - hub
  - component
  - infrastructure
---

# BaseHubView

## Description

BaseHubView is the abstract base class for all Hub views (ADR-024). It extends Obsidian's `ItemView` and provides the shared shell lifecycle: wrapper container, top bar with breadcrumb and action buttons, tab bar with tab switching, dashboard/split layout with master-detail panels, debounced render scheduling (16ms), and event cleanup via `addUnsubscribe()`.

Subclasses implement ~10 abstract methods to provide domain-specific rendering, state, and subscriptions.

## Abstract Contract (subclass provides)

| Method | Purpose |
|--------|---------|
| `getViewType()` | Obsidian view type identifier |
| `getHubId()` | Unique hub identifier |
| `getHubType()` | Hub type: `"system"`, `"domain"`, or `"user"` |
| `getHubDisplayName()` | Display name in top bar breadcrumb |
| `getHubIcon()` | Icon identifier |
| `getTabDefinitions()` | Tab definitions for the tab bar |
| `renderTopBarActions(bar)` | Extra buttons in top bar |
| `onDashboardRender()` | Dashboard tab content |
| `onTabRender(tabId)` | Non-dashboard tab content |
| `onHubOpen()` | Called when hub opens |
| `onHubClose()` | Called when hub closes |

## Protected Helpers

| Helper | Purpose |
|--------|---------|
| `addUnsubscribe(fn)` | Register cleanup for event listeners |
| `scheduleRender()` | Debounced re-render (16ms) |
| `navigateTo(page)` | Switch to a tab page |
| `getActivePage()` | Current active tab |
| `onTabChanged(tabId)` | Virtual hook for tab switch side effects |

## Protected DOM References

`eventBus`, `activePage`, `topBarEl`, `countBadge`, `dashboardEl`, `splitEl`, `masterTreeEl`, `detailPanelEl`, `searchInput`, `searchHeaderEl`, `masterEl`, `tabBarEl`, `filterText`

## Exported Types

| Type | Purpose |
|------|---------|
| `TabDef` | `{ id, label, icon, searchPlaceholder }` — tab definition |

## Hub Lifecycle Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `hub.opened` | Emitted | When hub view opens |
| `hub.closed` | Emitted | When hub view closes |
| `hub.tab.changed` | Emitted | When active tab changes |

## Subclasses

- [[EventCatalogView]] (723 LOC)
- [[DataExchangeHubView]] (477 LOC)

## Related

- ADR: [[ADR-024 BaseHubView Shell Extraction]]
- Layout helper: `buildSplitLayout()` in `src/ui/catalog/helpers.ts`
