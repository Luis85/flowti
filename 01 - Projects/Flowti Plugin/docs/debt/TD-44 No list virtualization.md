---
type: TechDebt
status: open
severity: low
category: performance
layer: ui
created: 2026-02-15
effort: medium
description: "All list views render every item into the DOM. No virtual scrolling or pagination. Performance acceptable at current scale (~136 events, <100 configs)."
source: "[[Technical Review 2026-02-15]]"
---
# TD-44: No list virtualization for large datasets

## Problem

All list views render every item into the DOM without virtualization or pagination:

| View | Max Items | Rendering |
|------|-----------|-----------|
| EventsTab (catalog) | ~136 events | Full DOM, grouped by category |
| EventLogView | 500 entries (MAX_ENTRIES) | Full DOM, prepend new |
| ImportsTab (hub) | All saved configs | Full DOM |
| ExportsTab (hub) | All saved configs | Full DOM |
| PipelinesTab (hub) | All pipelines | Full DOM |

## Impact

At current scale, performance is fine:
- Event catalog has ~136 events — renders in <50ms
- Hub lists typically have <50 configs
- Event Log caps at 500 entries

Would degrade with:
- 500+ registered events (custom + discovered)
- 200+ import/export configs
- Long-running Event Log sessions without clearing

## Suggested Fix

### Priority 1: EventLogView

Most likely to grow. Implement virtual scrolling:
- Only render visible rows + buffer (e.g., 50 visible + 20 buffer)
- Reuse DOM elements on scroll
- Keep 500-entry max buffer unchanged

### Priority 2: Deferred

Catalog and Hub lists are fine at current scale. Revisit if:
- User registers 500+ custom events via Discovery
- Hub accumulates 200+ configs

## Affected Files

- `src/ui/EventLogView.ts` (582 LOC) — primary candidate
- `src/ui/catalog/EventsTab.ts` — secondary
- `src/ui/hub/ImportsTab.ts`, `ExportsTab.ts` — tertiary
