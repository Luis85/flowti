---
type: TechDebt
severity: medium
category: type-safety
layer: infrastructure
status: resolved
resolved: 2026-02-21
resolved_in: "Cycle 10 Inc 1"
created: 2026-02-20
effort: small
description: "saveSettings() casts loadData() result to object without validation. If the stored data is a non-object (null after corruption, or a primitive), the spread will silently produce unexpected results."
---

# TD-115: saveSettings() unsafe cast of loadData() result

## Problem

In `main.ts` (lines 310-316), `saveSettings()` casts the return value of `loadData()` directly to `object`:

```typescript
async saveSettings(): Promise<void> {
    const existingData = ((await this.loadData()) as object) || {};
    await this.saveData({
        ...existingData,
        ...this.settings,
    });
```

`loadData()` returns `Promise<any>`. If the stored data has been corrupted (e.g., stored as a string, number, or array instead of a plain object), the `as object` cast bypasses validation. Spreading a non-plain-object (e.g., an array or string) produces unexpected keys (`0`, `1`, `2`, ...) in the saved data.

## Impact

- Data corruption in Obsidian's `data.json` could cascade: a corrupted read produces a corrupted save, which produces further corrupted reads.
- The `|| {}` fallback only handles `null`/`undefined`, not other non-object types.
- Since `loadSettings()` uses Zod validation (`FlowtiSettingsSchema.safeParse`), but `saveSettings()` does not, the save path is less protected than the load path.

## Suggested Fix

Validate that `existingData` is a plain object before spreading:

```typescript
async saveSettings(): Promise<void> {
    const raw = await this.loadData();
    const existingData = (raw && typeof raw === "object" && !Array.isArray(raw))
        ? raw as Record<string, unknown>
        : {};
    await this.saveData({ ...existingData, ...this.settings });
}
```

## Affected Files

- `src/main.ts` (lines 310-316)
