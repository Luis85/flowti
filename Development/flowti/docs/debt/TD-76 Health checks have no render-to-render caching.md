---
type: TechDebt
severity: low
category: performance
layer: ui
status: open
created: 2026-02-15
effort: small
description: "Health checks re-run on every tab activation with no caching. Navigating away and back re-runs all checks. For large vaults, this causes noticeable lag."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-76: Health checks have no render-to-render caching

## Problem

All 6 health checks re-run from scratch on every Health tab activation. There is no caching, dirty-checking, or staleness tracking. Navigating away from the Health tab and back immediately re-runs all entity scans and comparison logic, even if nothing has changed.

## Impact

- Perceptible delay when switching to the Health tab in larger vaults.
- Redundant computation when the underlying data has not changed between tab visits.
- The lag compounds with TD-75's quadratic complexity in individual checks.

## Suggested Fix

Cache health results with a staleness flag:

1. Store the last computed `HealthCheckResult[]` in the HealthTab instance.
2. Track a `stale: boolean` flag, defaulting to `true`.
3. Subscribe to entity change events (`file.created`, `file.modified`, `file.deleted`) and set `stale = true` when relevant changes occur.
4. On render, only re-run checks if `stale === true`. Otherwise, re-render from cached results.

```typescript
private cachedResults: HealthCheckResult[] | null = null;
private stale = true;

private onEntityChange(): void {
    this.stale = true;
}

renderHealth(): void {
    if (this.stale || !this.cachedResults) {
        this.cachedResults = this.runAllChecks();
        this.stale = false;
    }
    this.renderResults(this.cachedResults);
}
```

## Affected Files

- `src/ui/catalog/HealthTab.ts`
