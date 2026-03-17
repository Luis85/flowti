---
type: TechDebt
severity: medium
category: testing
layer: cross-cutting
status: open
created: 2026-02-15
effort: medium
description: "TD-54/55 plan to migrate Event Catalog and Data Exchange Hub with 'zero feature regression' but no test strategy for verifying this beyond existing tests."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-57: Migration test strategy for Hub conversion

## Problem

Hub migration (TD-54 and TD-55) could introduce subtle regressions across 8+7 tabs. Existing tests cover domain logic but not UI orchestration. The acceptance criteria say "all tabs render identically" and "zero regression" but there is no defined test strategy to verify these claims.

## Impact

Regressions in tab rendering, navigation, state management during migration. Without a structured smoke test plan, regressions may go undetected until users encounter them.

## Suggested Fix

Define a smoke test suite for each tab before starting migration. Each tab test should verify:

- Tab renders without errors
- Item selection works (master-detail navigation)
- CRUD operations complete (create, read, update, delete)
- Cross-references resolve correctly (related flows, systems, actors)

Additionally, consider snapshot tests for rendered tab DOM structure to detect unintended layout changes.

## Affected Files

- All files under `src/ui/catalog/`
- All files under `src/ui/hub/`
