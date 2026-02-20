---
type: TechDebt
severity: medium
category: error-handling
layer: domain
status: open
created: 2026-02-20
effort: small
description: "HubRegistry.openHub() calls four Obsidian workspace API methods without try-catch. A workspace error during leaf creation or reveal propagates unhandled to the caller."
---

# TD-106: HubRegistry.openHub() missing error handling for Obsidian workspace API

## Problem

`HubRegistry.openHub()` (lines 46-64) calls several Obsidian API methods without error handling:

```typescript
async openHub(hubId: string, tabId?: string, entityId?: string): Promise<void> {
    const provider = this.providers.get(hubId);
    if (!provider) return;

    const viewType = provider.getViewType();
    let leaf = this.app.workspace.getLeavesOfType(viewType)[0];
    if (!leaf) {
        leaf = this.app.workspace.getLeaf("tab");       // can throw
        await leaf.setViewState({ type: viewType, active: true }); // can throw
    }
    this.app.workspace.revealLeaf(leaf);                 // can throw

    if (tabId) {
        void this.eventBus.emit("hub.navigate", { hubId, tabId, entityId });
    }
}
```

Any of `getLeaf()`, `setViewState()`, or `revealLeaf()` can throw if the workspace is in an unexpected state (e.g., during layout restoration, or if the view type is not registered).

## Impact

- An unhandled error during hub navigation crashes the current operation and may leave the workspace in a partially updated state.
- Callers (e.g., dashboard card clicks, cross-hub navigation) have no way to recover gracefully.
- No user-facing feedback when hub opening fails.

## Suggested Fix

Wrap the Obsidian API calls in a try-catch and emit an error event or show a Notice:

```typescript
try {
    let leaf = this.app.workspace.getLeavesOfType(viewType)[0];
    if (!leaf) {
        leaf = this.app.workspace.getLeaf("tab");
        await leaf.setViewState({ type: viewType, active: true });
    }
    this.app.workspace.revealLeaf(leaf);
} catch (err) {
    await this.eventBus.emit("hub.error", { hubId, error: String(err) });
    return;
}
```

## Affected Files

- `src/domain/hub/HubRegistry.ts` (lines 46-64)
