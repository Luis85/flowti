---
type: TechDebt
severity: low
category: duplication
layer: ui
status: open
created: 2026-02-15
effort: medium
description: "After BaseEntityTab extraction (TD-34), DomainsTab (565 LOC) and ServicesTab (509 LOC) remain standalone with significant structural overlap in their hybrid scan approach."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-59: DomainsTab and ServicesTab not on BaseEntityTab

## Problem

Bug fixes or improvements to the shared scanner pattern do not automatically apply to Domains and Services tabs. Both tabs implement their own hybrid scan logic (file-based + catalog-derived) with significant structural overlap, but neither extends `BaseEntityTab`.

DomainsTab (565 LOC) and ServicesTab (509 LOC) each implement:
- File scanning with frontmatter parsing
- Catalog-derived entry merging
- Master-detail rendering
- CRUD operations
- Cross-reference resolution

## Impact

Ongoing maintenance burden; divergent behavior between tabs. Changes to the shared patterns in BaseEntityTab must be manually replicated in DomainsTab and ServicesTab.

## Suggested Fix

Evaluate if the hybrid scan approach can be generalized into BaseEntityTab or a shared scanner mixin. Options include:

1. Extend BaseEntityTab with a configurable scan strategy
2. Extract a `HybridScannerMixin` that both tabs can use
3. Create a generic `HybridEntityTab` subclass of BaseEntityTab

## Affected Files

- `src/ui/catalog/DomainsTab.ts`
- `src/ui/catalog/ServicesTab.ts`
