---
type: TechDebt
severity: low
category: observability
layer: cross-cutting
status: open
created: 2026-02-15
effort: small
description: "Four deferred performance items (TD-12, TD-36, TD-44, TD-48) all say 'fine at current scale' with no defined threshold for re-evaluation."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-58: Performance baseline and monitoring thresholds

## Problem

No metrics define when "current scale" is exceeded. Four tech debt items have been deferred with justifications like "not a concern at current volumes" but no concrete thresholds exist for when to revisit them:

- **TD-12**: Wildcard listeners — "< 1000 events/minute is fine"
- **TD-36**: Folder scans instead of events — "fine for small vaults"
- **TD-44**: No list virtualization — "fine for current entity counts"
- **TD-48**: CSV parsing blocks UI thread — "fine for current file sizes"

Performance could degrade undetected as the vault grows.

## Impact

Gradual performance degradation as vault grows in size and complexity. Without defined thresholds, there is no trigger for re-evaluation.

## Suggested Fix

Define concrete thresholds for re-evaluation:

- **Wildcard concern**: max events/second before wildcard dispatch overhead matters (e.g., > 100 events/sec sustained)
- **Scan concern**: max entity count before folder scan latency is noticeable (e.g., > 500 entities)
- **Virtualization concern**: max list items before DOM rendering stutters (e.g., > 200 visible items)
- **CSV parse concern**: max CSV row count before UI thread blocking is perceptible (e.g., > 10,000 rows)

Document these thresholds in the respective TD files and add a periodic review checkpoint.

## Affected Files

- Cross-cutting concern (no specific file changes; documentation in TD-12, TD-36, TD-44, TD-48)
