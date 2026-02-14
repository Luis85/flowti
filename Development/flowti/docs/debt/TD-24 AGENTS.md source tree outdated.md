---
severity: low
category: documentation
layer: cross-cutting
status: resolved
effort: small
resolved: 2026-02-13
description: The source tree diagram in AGENTS.md reflects the pre-February 2026 structure. It is missing 8 domain modules (installer, eventDefinition, eventFilter, eventNotify, subscription, discovery, ingestion, dataExchange), the catalog UI, and several infrastructure files.
---
# TD-24: AGENTS.md source tree is outdated

## Problem

The `AGENTS.md` source tree section shows only:
- `domain/settings/` and `domain/user/`
- `ui/ComponentShowcaseView.ts`

The actual codebase now has 10 domain modules and 13+ UI view files.

The test structure section also lists only 11 test files and 172 tests, while the current count is 35 test files and 654 tests.

## Suggested Remediation

1. Update the source tree to match the current file structure
2. Update the test count
3. Add the new domains to the "Adding new features" examples

## Affected Files

- `AGENTS.md`

## Resolution (2026-02-13)

AGENTS.md was comprehensively updated to reflect the current codebase: 11 domain modules, 141 source files, 41 test files, 811 tests. Source tree, test counts, and extension guide examples all updated.
