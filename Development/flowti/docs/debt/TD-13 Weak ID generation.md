---
severity: high
category: bug-risk
layer: domain
status: open
effort: small
description: Multiple services generate IDs using Date.now() + Math.random() which has a non-trivial collision probability, especially during rapid operations like bulk CSV import.
---
# TD-13: Weak ID generation (collision risk)

## Problem

ID generation patterns in the codebase:

| Location | Pattern | Collision Risk |
|----------|---------|---------------|
| `DataExchangeService.ts` | `Date.now().toString(36) + Math.random().toString(36).slice(2, 7)` | ~1 in 60M per ms |
| `IngestionService.ts` | Timestamp + random | Similar |
| `helpers.ts` | `crypto.randomUUID()` | Negligible |

The `helpers.ts` utility uses the proper `crypto.randomUUID()`, but some services roll their own weaker version.

## Impact

- During bulk CSV import (hundreds of files in rapid succession), `Date.now()` returns the same value for operations within the same millisecond
- ID collision would silently overwrite existing configuration entries
- The stronger `generateUUID()` from helpers.ts already exists but is not used consistently

## Suggested Remediation

1. Replace all custom ID generation with `generateUUID()` from `utils/helpers.ts`
2. Enforce via lint rule or code review convention

## Affected Files

- `src/domain/dataExchange/DataExchangeService.ts`
- `src/domain/ingestion/IngestionService.ts`
