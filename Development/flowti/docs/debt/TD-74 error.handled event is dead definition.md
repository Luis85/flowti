---
severity: medium
category: dead-code
layer: infrastructure
status: open
created: 2026-02-15
effort: tiny
description: "FlowtiEventMap defines 'error.handled' with type and catalog entry, but ErrorService never emits it. The event has a type definition and catalog metadata but no code path."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-74: error.handled event is dead definition

## Problem

`FlowtiEventMap` defines an `error.handled` event with a full type definition and corresponding catalog metadata entry. However, `ErrorService` never emits this event -- there is no code path that produces it.

The event exists in the type system and catalog as if it were a real event, but it is inert. Developers may subscribe to it expecting notifications that will never arrive.

## Impact

- Misleading API surface: the event appears functional but is never emitted.
- Wasted catalog entry creates noise in the Event Catalog view.
- Developers who subscribe to `error.handled` will have dead listener code that never fires.

## Suggested Fix

Either:

1. **Implement it** -- emit `error.handled` from `ErrorService.wrap()` when `rethrow` is `false` (i.e., when an error is caught and handled without re-throwing). This would make the event useful for error monitoring dashboards.
2. **Remove it** -- delete the type definition from `FlowtiEventMap` and the catalog metadata entry. Clean up any references.

Option 1 is preferred if error observability is valued; option 2 if minimalism is the goal.

## Affected Files

- `src/infrastructure/events/events.ts` (line 158)
- `src/infrastructure/errors/ErrorService.ts`
