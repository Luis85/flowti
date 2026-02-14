---
severity: low
category: bug-risk
layer: domain
status: open
updated: 2026-02-14
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

## Current Assessment

The primary ID generation now uses `crypto.randomUUID()` from `src/utils/helpers.ts`. The `Math.random()` fallback is only used when the crypto API is unavailable (rare in modern environments). The `Date.now()` pattern in IngestionService is used for ledger keys (idempotency tracking), not primary entity IDs, so collision risk is acceptable.

## Affected Files

- `src/domain/dataExchange/DataExchangeService.ts`
- `src/domain/ingestion/IngestionService.ts`
