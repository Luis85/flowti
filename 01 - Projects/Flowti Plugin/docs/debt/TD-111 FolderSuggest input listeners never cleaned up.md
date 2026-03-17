---
type: TechDebt
severity: medium
category: resource-leak
layer: ui
status: resolved
resolved: 2026-02-21
resolved_in: "Cycle 10 Inc 2"
created: 2026-02-20
effort: small
description: "attachFolderSuggest() adds three event listeners (input, keydown, blur) to the input element with no mechanism to remove them when the parent component is destroyed."
---

# TD-111: FolderSuggest input listeners never cleaned up

## Problem

`attachFolderSuggest()` in `FolderSuggest.ts` (lines 88-123) registers three event listeners on the input element:

```typescript
input.addEventListener("input", () => { ... });     // line 88
input.addEventListener("keydown", (e) => { ... });  // line 101
input.addEventListener("blur", () => { ... });      // line 121
```

The function is a standalone utility with no return value and no cleanup mechanism. The listeners persist for the lifetime of the input element, which is typically until the parent view or modal re-renders.

Since views in the codebase re-render by calling `container.empty()` and rebuilding the DOM, old input elements are detached but their listeners may still hold references to the `app` object and the closure-captured `dropdown` variable.

## Impact

- Every re-render of a form that uses `attachFolderSuggest()` creates a new set of listeners without removing the old ones.
- The closure captures `app` (for vault access) and `dropdown` (a DOM element), preventing garbage collection of detached DOM trees.
- In practice, the impact is small because Obsidian's `empty()` removes elements from the DOM, allowing eventual GC. But the pattern is fragile and would leak if the input element is reused.

## Suggested Fix

Return an unsubscribe function from `attachFolderSuggest()`:

```typescript
export function attachFolderSuggest(input, app, onSelect): () => void {
    // ... existing setup ...

    const onInput = () => { ... };
    const onKeydown = (e) => { ... };
    const onBlur = () => { ... };

    input.addEventListener("input", onInput);
    input.addEventListener("keydown", onKeydown);
    input.addEventListener("blur", onBlur);

    return () => {
        input.removeEventListener("input", onInput);
        input.removeEventListener("keydown", onKeydown);
        input.removeEventListener("blur", onBlur);
        hide();
    };
}
```

Callers can then store the cleanup function and invoke it during component teardown.

## Affected Files

- `src/ui/FolderSuggest.ts` (lines 16-124)
