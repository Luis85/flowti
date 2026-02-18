---
type: TechDebt
severity: low
category: performance
layer: ui
status: open
created: 2026-02-15
effort: small
description: "HealthTab's checkOrphanedFlows iterates every flow against every system's domains, every actor's events, and every product's events using Array.includes(). O(flows * systems * domains) per check."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-75: checkOrphanedFlows has quadratic complexity

## Problem

`checkOrphanedFlows()` in `healthChecks.ts` iterates over every flow and, for each flow, scans every system's domains array, every actor's events array, and every product's events array using `Array.includes()`. This creates O(flows * systems * domains) complexity per check, plus similar terms for actors and products.

With 100 flows and 100 systems (each with ~5 domains), each render of the Health tab performs ~50,000 array scan operations just for this one check.

## Impact

- Health tab render time degrades quadratically with entity count.
- For larger vaults with many documented entities, the Health tab becomes noticeably slow.
- The problem compounds with the other 5 health checks that follow similar patterns.

## Suggested Fix

Convert domain, event, and service lists to `Set` objects for O(1) membership tests before entering the comparison loops:

```typescript
const systemDomainSets = systems.map(s => ({
    name: s.name,
    domains: new Set(s.domains),
}));

for (const flow of flows) {
    const isReferenced = systemDomainSets.some(s =>
        flow.domains.some(d => s.domains.has(d))
    );
    // ...
}
```

This reduces the inner loop from O(n) to O(1) per membership check.

## Affected Files

- `src/ui/catalog/healthChecks.ts` (lines 245-285)
