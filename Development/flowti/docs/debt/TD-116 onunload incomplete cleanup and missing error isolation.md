---
type: TechDebt
severity: medium
category: resource-leak
layer: infrastructure
status: resolved
resolved: 2026-02-21
resolved_in: "Cycle 10 Inc 1"
created: 2026-02-20
effort: small
description: "onunload() wraps all cleanup in a single try-catch. Individual service disposals are not error-isolated, so a throw from nudgeService.dispose() would skip all subsequent cleanup. Also, hubRegistry is never disposed."
---

# TD-116: onunload() incomplete cleanup and missing error isolation

## Problem

In `main.ts` (lines 252-283), the `onunload()` method has two issues:

### 1. No error isolation between cleanup steps

All cleanup is wrapped in a single try-catch:

```typescript
async onunload() {
    try {
        void this.eventBus?.emit("plugin.unloading", { ... });
        this.nudgeService?.dispose();          // If this throws...
        this.uiCommandService?.dispose();      // ...this is skipped
        this.ingestionStatusBar?.dispose();     // ...this is skipped
        this.eventBridge?.dispose();            // ...this is skipped
        await this.services?.disposeAll();      // ...this is skipped
        this.commands?.clear();                 // ...this is skipped
        this.views?.clear();                    // ...this is skipped
        // ...
    } catch (error) {
        console.error("[Flowti] Plugin unload error:", error);
    }
}
```

If `nudgeService.dispose()` throws, all subsequent cleanup (eventBridge, services, commands, views, EventBus) is skipped, leaving resources leaked.

### 2. hubRegistry never cleaned up

The `hubRegistry` is created during `onload()` but never disposed or cleared in `onunload()`. While the registry itself has no listeners to clean up, its `providers` map holds references to hub dashboard providers that may themselves hold state.

## Impact

- A single disposal failure causes cascading cleanup failures, leaving EventBus listeners, timers, and Obsidian workspace event handlers active after plugin unload.
- On plugin disable/re-enable cycles, accumulated leaked resources degrade performance.

## Suggested Fix

Wrap each cleanup step individually:

```typescript
async onunload() {
    const safeDispose = (name: string, fn: () => void) => {
        try { fn(); } catch (err) {
            console.error(`[Flowti] Failed to dispose ${name}:`, err);
        }
    };

    void this.eventBus?.emit("plugin.unloading", { ... });
    safeDispose("nudgeService", () => this.nudgeService?.dispose());
    safeDispose("uiCommandService", () => this.uiCommandService?.dispose());
    safeDispose("ingestionStatusBar", () => this.ingestionStatusBar?.dispose());
    safeDispose("eventBridge", () => this.eventBridge?.dispose());
    // ...
}
```

## Affected Files

- `src/main.ts` (lines 252-283)
