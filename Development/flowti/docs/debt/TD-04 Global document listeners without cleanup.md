---
severity: critical
category: memory-leak
layer: ui
status: open
effort: small
description: ExportView and CsvActionView attach global document click listeners for dropdown menus using setTimeout without storing cleanup references. If the component unmounts before the handler fires, the listener persists permanently.
---
# TD-04: Global document listeners without cleanup

## Problem

Both `ExportView.ts` and `CsvActionView.ts` use this pattern for dropdown menus:

```typescript
setTimeout(() => document.addEventListener("click", closeHandler), 0);
```

The `closeHandler` removes itself when it fires, but if the view is closed before the user clicks outside the dropdown, the listener remains attached to `document` indefinitely.

## Impact

- Orphaned event listeners on `document` accumulate across view open/close cycles
- Each leaked listener holds a closure reference to the view instance, preventing garbage collection
- Performance degradation over long sessions

## Suggested Remediation

1. Store the cleanup function in the view instance: `this.dropdownCleanup = () => document.removeEventListener("click", closeHandler)`
2. Call it in `onClose()` / `onunload()`
3. Alternative: use Obsidian's `Menu` component which handles its own lifecycle, or a backdrop overlay element that captures clicks

## Affected Files

- `src/ui/ExportView.ts` (line ~424)
- `src/ui/CsvActionView.ts` (line ~392)
