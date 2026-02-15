---
severity: high
category: architecture
layer: ui
status: open
created: 2026-02-15
effort: large
description: "No shared workspace chrome. Each view creates its own navigation structure. Need unified shell with ribbon, tab bar, content area."
source: "[[Hubs PRD]]"
feature: "[[Hubs PRD]]"
tags:
  - hubs
  - foundation
---
# TD-50: Workspace shell layout

## Problem

Each view (EventCatalogView, DataExchangeHubView) creates its own navigation structure:

- EventCatalogView: sidebar with tab list + content area
- DataExchangeHubView: sidebar with tab list + content area
- Both implement their own tab switching logic, active tab highlighting, and content mounting

This means:
- Tab management code is duplicated across views (~80 LOC each)
- Visual consistency depends on both views using the same CSS classes
- Adding a new hub requires reimplementing navigation from scratch
- No shared status bar or workspace-level actions

### Current pattern

```typescript
// EventCatalogView — onOpen()
const container = contentEl.createDiv({ cls: "ft-catalog-container" });
const sidebar = container.createDiv({ cls: "ft-catalog-sidebar" });
// Manually creates 8 tab buttons...
this.tabEls.forEach(([id, el]) => {
    el.onclick = () => this.switchToTab(id);
});
```

DataExchangeHubView repeats a similar pattern with 7 tabs.

## Target State

A shared `WorkspaceShell` class that:

1. **Renders chrome**: workspace ribbon (hub icon + name + actions), tab bar, content area, optional status bar
2. **Manages tabs**: accepts `TabDefinition[]`, renders tab buttons, handles switching, mounts layouts per tab
3. **Provides lifecycle**: `mount(contentEl)`, `switchTab(tabId)`, `getActiveLayout()`, `dispose()`
4. **Is hub-agnostic**: receives configuration, not domain knowledge

### Target pattern

```typescript
// In any HubView.onOpen()
this.shell = new WorkspaceShell({
    hubName: "Event Catalog",
    hubIcon: "activity",
    tabs: adapter.getTabDefinitions(),
    layoutRegistry: this.layoutRegistry,
    onTabChange: (tabId) => this.eventBus.emit("hub.tab.changed", { hubId, tabId }),
});
this.shell.mount(contentEl);
```

## Scope

### New files

- `src/ui/shell/WorkspaceShell.ts` — shell class with ribbon + tab bar + content
- `src/ui/shell/types.ts` — `ShellConfig`, `ShellTab` interfaces
- `src/ui/shell/index.ts` — barrel export

### Modified files (Phase 2 — TD-54, TD-55)

- `src/infrastructure/views/EventCatalogView.ts` — replace manual navigation with shell
- `src/infrastructure/views/DataExchangeHubView.ts` — replace manual navigation with shell
- `src/ui/catalog/` components — receive regions from layout instead of manual DOM elements
- `src/ui/hub/` components — same

## Dependencies

- **TD-49** (Layout abstraction) — shell mounts layouts per tab

## Priority

**Critical** — Second foundation piece after layouts. All hub views will use this shell.

## Acceptance Criteria

- [ ] Shell renders workspace ribbon with hub icon, name, and action buttons
- [ ] Tab bar renders from `TabDefinition[]` with correct icons and labels
- [ ] Tab switching mounts the correct layout and triggers callback
- [ ] Only active tab's layout is mounted (lazy rendering)
- [ ] `dispose()` cleans up all DOM elements and listeners
- [ ] Unit tests for shell lifecycle and tab switching
