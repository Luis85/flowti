---
type: TechDebt
severity: low
category: bug-risk
layer: domain
status: resolved
updated: 2026-02-15
effort: small
description: Multiple services generate IDs using Date.now() + Math.random() which has a non-trivial collision probability, especially during rapid operations like bulk CSV import.
resolved: 2026-02-15
---
# TD-13: Weak ID generation (collision risk)

## Status: **Resolved**

## Problem (original)

ID generation patterns in the codebase:

| Location | Pattern | Collision Risk |
|----------|---------|---------------|
| `DataExchangeService.ts` | `Date.now().toString(36) + Math.random().toString(36).slice(2, 7)` | ~1 in 60M per ms |
| `IngestionService.ts` | Timestamp + random | Similar |
| `helpers.ts` | `crypto.randomUUID()` | Negligible |

## Resolution (2026-02-15)

- `IngestionService.generateEventKey()`: replaced `Date.now()` fallback with `generateUUID()` (already imported from `utils/helpers.ts`)
- All primary ID generation now routes through `crypto.randomUUID()` via `generateUUID()`
- The `Math.random()` fallback in `generateUUID()` is only used when crypto API is unavailable (rare in modern Electron)

## Affected Files

- `src/domain/ingestion/IngestionService.ts`
- `src/utils/helpers.ts`
