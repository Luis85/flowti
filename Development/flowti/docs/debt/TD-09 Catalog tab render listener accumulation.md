---
severity: high
category: memory-leak
layer: ui
status: open
effort: medium
description: Catalog tab components (EventsTab, DomainsTab, ServicesTab, etc.) call addEventListener on DOM elements during render() without removing listeners from the previous render. Each re-render doubles the attached handlers.
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

While `container.empty()` removes the DOM nodes (and their inline listeners), the pattern creates new closures each time. If elements are not fully garbage-collected (e.g. held in a parent reference), listeners accumulate.

More critically, detail panel elements that use `addEventListener` outside the main container's scope may not be cleaned up.

## Impact

- Memory growth over extended sessions with frequent tab switches
- Performance degradation as duplicate handlers fire for the same DOM events
- Particularly noticeable in `EventsTab` (1,040 LOC) with 31+ DOM event attachments per render

## Suggested Remediation

1. Use event delegation: attach a single listener on the container and use `event.target` to dispatch
2. Store handler references and explicitly `removeEventListener` before re-render
3. Consider a lightweight component model that manages its own lifecycle

## Affected Files

- `src/ui/catalog/EventsTab.ts`
- `src/ui/catalog/DomainsTab.ts`
- `src/ui/catalog/ServicesTab.ts`
- `src/ui/catalog/ActorsTab.ts`
- `src/ui/catalog/FlowsTab.ts`
- `src/ui/catalog/ProductsTab.ts`
- `src/ui/catalog/SystemsTab.ts`
