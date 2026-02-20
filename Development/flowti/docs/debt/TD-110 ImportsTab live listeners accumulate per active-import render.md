---
type: TechDebt
severity: high
category: resource-leak
layer: ui
status: open
created: 2026-02-20
effort: small
description: "ImportsTab.renderActiveImportProgress() appends 3 EventBus listeners per call to liveUnsubscribes. If the detail panel re-renders while an import is active, listeners accumulate because cleanup only runs at the start of renderDetail(), not per operation."
---

# TD-110: ImportsTab live listeners accumulate per active-import render

## Problem

In `ImportsTab.renderActiveImportProgress()` (lines 489-530), three EventBus listeners are pushed to `liveUnsubscribes` each time the method is called:

```typescript
this.liveUnsubscribes.push(
    this.deps.eventBus.on("dataExchange.import.progress", ...),  // line 490
);
this.liveUnsubscribes.push(
    this.deps.eventBus.on("dataExchange.import.completed", ...), // line 503
);
this.liveUnsubscribes.push(
    this.deps.eventBus.on("dataExchange.import.failed", ...),    // line 519
);
```

`cleanupLiveListeners()` (line 532) is only called at the top of `renderDetail()`. If the user clicks between import configs or if `renderDetail()` is called multiple times during an active import (e.g., from a tab switch or filter change), each call adds 3 new listeners without removing the previous set until the next `renderDetail()` invocation.

Additionally, if the hub view is closed while an import is active, `cleanupLiveListeners()` is never called because the `ImportsTab` class has no lifecycle hook — only the parent `DataExchangeHubView` calls `onHubClose()`.

## Impact

- During a long import with frequent detail panel re-renders, listener count grows linearly: `3 * N` listeners for `N` re-renders.
- Each listener runs its callback on every progress event, causing redundant DOM updates and degraded performance.
- If the view is closed without cleanup, listeners persist on the EventBus until the plugin is unloaded.

## Suggested Fix

1. Call `cleanupLiveListeners()` at the top of `renderActiveImportProgress()`, scoped per operation:

```typescript
private renderActiveImportProgress(container: HTMLElement, op: ActiveOperation): void {
    // Clean up any existing listeners for this operation
    this.cleanupLiveListeners();
    // ... register new listeners
}
```

2. Ensure the parent view (`DataExchangeHubView.onHubClose()`) calls `importsTab.cleanupLiveListeners()`.
3. Consider scoping listeners by `operationId` in a `Map<string, (() => void)[]>` for finer-grained cleanup.

## Affected Files

- `src/ui/hub/ImportsTab.ts` (lines 489-535)
