---
type: TechDebt
severity: high
category: initialization
layer: infrastructure
status: open
created: 2026-02-20
effort: small
description: "loadSettings() is called at line 139 before the logger is created at line 147 in onload(). The optional-chained this.logger?.warn() silently drops the settings validation warning on first plugin load."
---

# TD-114: loadSettings() warning lost because logger not yet initialized

## Problem

In `main.ts`, the plugin's `onload()` sequence calls `loadSettings()` (line 139) before `createInfrastructure()` (line 141) which initializes `this.logger` (line 147):

```typescript
async onload() {
    // Phase 1-2: Core infrastructure + Containers
    await this.loadSettings();             // line 139 — logger is undefined here

    const infra = createInfrastructure({   // line 141
        app: this.app,
        settings: this.settings,
        registerEvent: (ref) => this.registerEvent(ref),
    });
    this.logger = infra.logger;            // line 147 — logger becomes available here
```

Inside `loadSettings()` (line 295):

```typescript
if (!result.success) {
    this.logger?.warn("Invalid settings, using defaults", {
        errors: result.error.issues,
    });
}
```

Since `this.logger` is `undefined` at this point, the optional chaining `?.warn()` evaluates to `undefined` and the Zod validation errors are silently discarded.

## Impact

- On first plugin load (no saved data), or when settings are corrupted, the user gets no indication that settings validation failed and defaults were applied.
- Zod validation issues (e.g., from a plugin upgrade that changes the settings schema) are invisible, making migration debugging difficult.
- The settings are silently reset to defaults, which could change user-configured behavior without notice.

## Suggested Fix

Either:
1. Move `loadSettings()` after `createInfrastructure()` (requires that infrastructure creation doesn't depend on validated settings — it currently receives `this.settings` which is initialized from `DEFAULT_SETTINGS` by class field initializer).
2. Use `console.warn()` as a pre-logger fallback in `loadSettings()`.
3. Store the validation result and re-emit the warning after logger is available.

## Affected Files

- `src/main.ts` (lines 136-147, 290-302)
