---
severity: medium
category: usability
layer: ui
status: open
created: 2026-02-15
effort: small
description: "HealthTab's navigateToItem handles entity types: domain, service, flow, system, actor, product, event. But healthChecks produces items with entityType 'subscription' and 'definition' which are NOT in NAVIGABLE_ENTITY_TYPES."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-77: Health tab subscription/definition entities not navigable

## Problem

`HealthTab.navigateToItem()` handles navigation for entity types: domain, service, flow, system, actor, product, and event. These are listed in `NAVIGABLE_ENTITY_TYPES`. However, health checks (specifically the Subscription Health check) produce result items with `entityType: 'subscription'` and `entityType: 'definition'`, which are **not** in the navigable types list.

As a result, affected items from subscription and definition health checks render as plain text rather than clickable links. Users cannot navigate to the relevant subscription or definition to investigate or fix the issue.

## Impact

- Health check items for subscriptions and definitions have no click-to-navigate action.
- Users must manually find the relevant subscription or event definition -- defeating the purpose of the health check's actionable results.
- Inconsistent UX: some health check items are clickable, others are not.

## Suggested Fix

Add `'subscription'` and `'definition'` to `NAVIGABLE_ENTITY_TYPES` and implement navigation handlers:

1. **Subscription**: Open `EventConfigModal` for the subscription's source event type, or switch to the Events tab with that event selected.
2. **Definition**: Open `EventConfigModal` for the definition's source event type, showing the definitions page.

```typescript
const NAVIGABLE_ENTITY_TYPES = [
    "domain", "service", "flow", "system", "actor", "product", "event",
    "subscription", "definition",  // add these
];
```

Then add cases to `navigateToItem()`:

```typescript
case "subscription":
case "definition":
    // Open EventConfigModal or navigate to Events tab
    break;
```

## Affected Files

- `src/ui/catalog/HealthTab.ts` (lines 48-56, 58-86)
- `src/ui/catalog/healthChecks.ts`
