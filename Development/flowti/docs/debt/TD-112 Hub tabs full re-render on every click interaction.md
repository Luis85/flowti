---
type: TechDebt
severity: medium
category: performance
layer: ui
status: open
created: 2026-02-20
effort: medium
description: "Hub tab click handlers call renderMaster() + renderDetail() synchronously, causing full DOM teardown and rebuild on every selection change. No incremental update or diffing mechanism exists."
---

# TD-112: Hub tabs full re-render on every click interaction

## Problem

In `ImportsTab.renderImportItem()` (lines 88-92) and throughout other hub tabs:

```typescript
item.addEventListener("click", () => {
    this.deps.setState({ selectedImportId: cfg.id, editingImportId: null });
    this.renderMaster();   // Tears down and rebuilds entire master list
    this.renderDetail();   // Tears down and rebuilds entire detail panel
});
```

Every click on a master list item:
1. Calls `container.empty()` on both panels
2. Reconstructs all DOM elements from scratch
3. Re-attaches all event listeners
4. Re-queries state for every item

The same pattern appears in `ExportsTab`, `PipelinesTab`, and `UserHubSessions`.

## Impact

- With 50+ import/export configs, each click rebuilds 50+ DOM elements in the master list, even though only the selection highlight changed.
- Event listeners are re-created on every render, contributing to the listener accumulation pattern (see [[TD-110 ImportsTab live listeners accumulate per active-import render]]).
- Detail panel DOM churn is especially costly because it includes Setting components, tables, and nested card layouts.
- User-perceived lag increases with entity count.

## Suggested Fix

1. **Short-term**: In the click handler, only update the selection class on the master list (toggle `ft-master-event-selected`) and call `renderDetail()` alone:

```typescript
item.addEventListener("click", () => {
    this.deps.setState({ selectedImportId: cfg.id });
    // Toggle selection class instead of full re-render
    this.masterEl.querySelectorAll(".ft-master-event-selected")
        .forEach(el => el.classList.remove("ft-master-event-selected"));
    item.classList.add("ft-master-event-selected");
    this.renderDetail();
});
```

2. **Long-term**: Adopt a lightweight virtual DOM or state-driven rendering approach where only changed elements are updated.

## Affected Files

- `src/ui/hub/ImportsTab.ts` (lines 88-92)
- `src/ui/hub/ExportsTab.ts` (similar pattern)
- `src/ui/hub/PipelinesTab.ts` (similar pattern)
- `src/ui/userHub/UserHubSessions.ts` (similar pattern)
