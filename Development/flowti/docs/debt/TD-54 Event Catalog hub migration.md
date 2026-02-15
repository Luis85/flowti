---
severity: high
category: architecture
layer: ui
status: open
created: 2026-02-15
effort: large
description: "EventCatalogView is a standalone 836 LOC orchestrator with manual DOM layout. Migrate to Hub framework using Shell + Layout + Adapter pattern."
source: "[[Hubs PRD]]"
feature: "[[Hubs PRD]]"
tags:
  - hubs
  - migration
---
# TD-54: Event Catalog → Hub migration

## Problem

EventCatalogView (836 LOC) is a standalone orchestrator that:
- Manually creates sidebar + content layout
- Implements its own tab switching logic
- Directly instantiates 13 component classes
- Manages state for 8 tabs in a single class
- Cannot be validated against layout/component manifests

This is the largest and most complex view in the plugin. Migrating it to the Hub framework proves the architecture works.

## Target State

EventCatalogView becomes a thin shell that:

1. Creates a `WorkspaceShell` (TD-50) with Event Catalog tab definitions
2. Provides an `EventCatalogAdapter` that implements `HubAdapter`
3. Tab definitions reference layouts (TD-49) and components (TD-51) by name
4. Existing 13 component classes are reused — they just receive regions from layouts instead of manual DOM elements

### Before

```
EventCatalogView (836 LOC orchestrator)
├── Manual sidebar + content DOM
├── 8 tab buttons with manual click handlers
├── Direct component instantiation
└── State: activeTab, selectedDomain, selectedService, selectedEvent, ...
```

### After

```
EventCatalogView (~150 LOC thin view)
├── WorkspaceShell (shared chrome)
├── EventCatalogAdapter (data methods)
├── Tab definitions (JSON config)
└── Existing 13 components (unchanged, receive regions from layout)
```

## Migration Strategy

### Step 1: Create EventCatalogAdapter

Extract data-fetching methods from EventCatalogView into `EventCatalogAdapter`:
- `getDashboardData()` — from current `renderDashboard()` aggregation logic
- `getEntities("domains")` — from `DomainsTab.scan()`
- `getEntities("services")` — from `ServicesTab.scan()`
- etc.

Adapter wraps: EventBus, metadataCache, settings, subscriptions, eventDefinitions.

### Step 2: Create tab definitions

Convert the 8 implicit tab definitions to explicit `TabDefinition[]`:

```typescript
const EVENT_CATALOG_TABS: TabDefinition[] = [
    { id: "dashboard", label: "Dashboard", icon: "layout-dashboard", layout_ref: "dashboard_grid", ... },
    { id: "domains", label: "Domains", icon: "boxes", layout_ref: "split_dock", ... },
    { id: "services", label: "Services", icon: "server", layout_ref: "split_dock", ... },
    { id: "events", label: "Events", icon: "zap", layout_ref: "split_dock", ... },
    // ...
];
```

### Step 3: Wire shell + layouts

Replace manual DOM construction in `onOpen()` with:
```typescript
this.shell = new WorkspaceShell({ tabs: EVENT_CATALOG_TABS, ... });
this.shell.mount(contentEl);
```

### Step 4: Verify zero regression

Run all 1,662+ tests. Manual verification of all 8 tabs. Event listeners and state management unchanged.

## Scope

### New files

- `src/ui/adapters/EventCatalogAdapter.ts` — HubAdapter implementation
- `src/ui/tabs/event-catalog-tabs.ts` — tab definitions

### Modified files

- `src/infrastructure/views/EventCatalogView.ts` — reduce from 836 → ~150 LOC
- `src/ui/catalog/*.ts` — 13 components receive regions from layouts (constructor signature may change from `(masterEl, detailEl, deps)` to `(regions, deps)`)

## Dependencies

- **TD-49** (Layout abstraction) — layouts for tab rendering
- **TD-50** (Workspace shell) — shared navigation chrome

## Priority

**High** — Proves the Hub framework works on the most complex existing view.

## Acceptance Criteria

- [ ] EventCatalogView uses WorkspaceShell for navigation
- [ ] EventCatalogAdapter provides all data for 8 tabs
- [ ] Tab definitions validate against layout + component manifests
- [ ] All 8 tabs render identically to before (no visual regression)
- [ ] All existing catalog tests pass
- [ ] EventCatalogView LOC reduced by >50%
