---
type: TechDebt
severity: medium
category: documentation
layer: cross-cutting
status: open
created: 2026-02-21
effort: small
description: "README.md, AGENTS.md, and CHANGELOG.md contain outdated statistics that have drifted significantly from reality. Source file counts, LOC, test counts, service counts, and documentation counts are all stale."
---

# TD-119: Documentation stats drift across README, AGENTS.md, CHANGELOG

## Problem

All three primary documentation files contain hardcoded statistics that are significantly out of date. This creates confusion for anyone onboarding or reviewing the project.

### README.md discrepancies

| Claim | README Value | Actual Value | Drift |
|-------|-------------|--------------|-------|
| Source files | 216 | 230 | +14 |
| Source LOC | ~42,493 | 44,346 | +1,853 |
| `main.ts` LOC | 846 | 643 | -203 |
| `dataExchangeSetup.ts` LOC | 368 | 359 | -9 |
| UI files | 106 | 111 | +5 |
| Services registered | 11 | 14 | +3 |
| `docs/components/` | 62 | 91 | +29 |
| `docs/flows/` | 13 | 15 | +2 |
| `docs/features/` | 224 | 263 | +39 |
| `docs/decisions/` | 30 | 33 | +3 |
| `docs/cycles/` | 4 | 11 | +7 |
| `docs/debt/` | 102 | 119 | +17 |

### AGENTS.md discrepancies

| Claim | AGENTS Value | Actual Value | Drift |
|-------|-------------|--------------|-------|
| Source files | 110 | 230 | +120 |
| Source LOC | ~31,000 | 44,346 | +13,346 |
| `main.ts` LOC | 482 | 643 | +161 |
| Bounded contexts | 11 | 15 | +4 |
| Services | 11 | 14 | +3 |
| Test files | 41 | 111 | +70 |
| Tests | 811 (4 skip) | 2,887 (32 skip) | +2,076 |

### CHANGELOG.md discrepancies

| Claim | CHANGELOG Value | Actual Value |
|-------|----------------|--------------|
| Test files | 68 | 111 |
| Tests | 1,547 (32 skip) | 2,887 (32 skip) |
| Flow integration suites | 10 (87 pass, 28 skip) | 15 suites |

## Root Cause

Stats are manually maintained inline text. There is no automated mechanism to keep them synchronized with the codebase.

## Suggested Fix

1. **Immediate**: Update all three files with current accurate statistics
2. **Preventive**: Consider adding a `scripts/stats.sh` that generates current metrics, or include stat verification in the build report

## Related

- [[TD-24 AGENTS.md source tree outdated]] — previously resolved, but has drifted again
- [[TD-86 Architecture docs lack type and updated fields]]

## Affected Files

- `README.md`
- `AGENTS.md`
- `CHANGELOG.md`
