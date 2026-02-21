---
type: TechDebt
severity: medium
category: documentation
layer: cross-cutting
status: open
effort: small
resolved: 2026-02-13
reopened: 2026-02-21
description: "AGENTS.md stats have drifted again. Claims 110 files / 31K LOC / 41 tests — actual is 230 files / 44K LOC / 111 test files / 2,887 tests. Missing 4 bounded contexts (hub, inbox, nudge, session). Service count says 11, actual 14."
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

## Reopened (2026-02-21)

Stats have drifted significantly since the February 13 update. The codebase has grown through Cycles 7-9 (session domain, activity intelligence, handler extraction) and AGENTS.md was not updated in sync.

| Metric | AGENTS.md | Actual | Drift |
|--------|-----------|--------|-------|
| Source files | 110 | 230 | +120 |
| Source LOC | ~31,000 | 44,346 | +13,346 |
| `main.ts` LOC | 482 | 643 | +161 |
| Bounded contexts | 11 | 15 | +4 |
| Services | 11 | 14 | +3 |
| Test files | 41 | 111 | +70 |
| Tests | 811 (4 skip) | 2,887 (32 skip) | +2,076 |

Missing domains in AGENTS.md: `hub/`, `inbox/`, `nudge/`, `session/`.
Missing from test structure: 70 additional test files across all layers.

See also [[TD-119 Documentation stats drift across README AGENTS CHANGELOG]] for the broader documentation accuracy issue.
