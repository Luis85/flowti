---
status: open
severity: low
category: ux
layer: ui
created: 2026-02-15
effort: small
description: "Closing and reopening a view resets to defaults (dashboard, no selection). Active tab, selected item, and filter text are lost."
source: "[[Technical Review 2026-02-15]]"
---
# TD-45: UI view state not persisted across reload

## Problem

Closing and reopening a view resets all navigation state to defaults. Lost state:

| View | Lost State | Default |
|------|-----------|---------|
| EventCatalogView | Active tab, selected item, filter text, scroll position | Dashboard, no selection |
| DataExchangeHubView | Active tab, selected config, filter text | Dashboard, no selection |
| EventLogView | Pause state, filter settings | Running, no filters |

## Impact

UX friction — users navigate to the same spot repeatedly after:
- Obsidian restart
- View close/reopen
- Workspace layout switch

Low severity because views are fast to navigate. No data loss.

## Suggested Fix

Use Obsidian's `getState()` / `setState()` ViewState API:

```typescript
// In EventCatalogView
getState(): Record<string, unknown> {
  return {
    activeTab: this.activeTab,
    selectedItem: this.selectedDomainName ?? this.selectedFlowName ?? null,
  };
}

async setState(state: Record<string, unknown>): Promise<void> {
  if (state.activeTab) this.activeTab = state.activeTab as string;
  if (state.selectedItem) { /* restore selection */ }
  this.scheduleRender();
}
```

Obsidian automatically persists/restores this state via `workspace.json`.

### Scope

Persist only the most important state:
- Active tab name
- Selected detail item (name/id)

Do NOT persist:
- Filter text (transient)
- Scroll position (complex, low ROI)
- Sort state (transient)

## Affected Files

- `src/ui/EventCatalogView.ts` — `getState()` / `setState()` overrides
- `src/ui/DataExchangeHubView.ts` — same pattern
