---
severity: low
category: memory-leak
layer: ui
status: open
effort: small
description: Catalog tab components call addEventListener on DOM elements during render(). The .empty() call on parent containers auto-garbage-collects child elements and their listeners. Only 2-3 listeners on persistent elements (gear button, search input) exist for the view lifetime.
---
# TD-09: Catalog tab render re-attaches DOM listeners without cleanup

## Problem

Catalog tab components follow this pattern:

```typescript
render() {
    container.empty(); // clears DOM
    // ... create new elements
    element.addEventListener("click", handler); // attached fresh
}
```

## Reassessment (2026-02-14)

Detailed audit reveals this is **not a memory leak**:

1. All render methods call `.empty()` on their container element **before** rebuilding the DOM tree (e.g., `masterTreeEl.empty()`, `detailEl.empty()`, `settingsPanel.empty()`).
2. When `.empty()` removes DOM nodes, all event listeners attached to those nodes are eligible for garbage collection -- the browser handles this automatically.
3. Listeners are only attached to **newly created child elements** within the emptied container, not to `document`, `window`, or persistent parent elements.
4. Only 2-3 listeners exist on persistent elements (gear button at `EventCatalogView:164`, search input) -- these live for the view's entire lifetime and are appropriately scoped.
5. The `EventCatalogView.onClose()` method properly clears the render timer and calls all EventBus unsubscribers.

**Downgraded from high to low.** No remediation needed for the current pattern. The `.empty()` + fresh child element approach is safe.

## Affected Files

- `src/ui/catalog/EventsTab.ts`
- `src/ui/catalog/DomainsTab.ts`
- `src/ui/catalog/ServicesTab.ts`
- `src/ui/catalog/ActorsTab.ts`
- `src/ui/catalog/FlowsTab.ts`
- `src/ui/catalog/ProductsTab.ts`
- `src/ui/catalog/SystemsTab.ts`
