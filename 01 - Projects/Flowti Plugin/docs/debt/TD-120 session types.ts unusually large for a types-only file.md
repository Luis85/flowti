---
type: TechDebt
severity: low
category: architecture
layer: domain
status: open
created: 2026-02-21
effort: small
description: "session/types.ts is 496 LOC, unusually large for a types-only file. It likely contains Zod schemas, default builders, and constants alongside type definitions."
domain: session
parent: "[[Session Workspaces PRD]]"
---

# TD-120: session/types.ts unusually large for a types-only file

## Problem

`src/domain/session/types.ts` is **496 LOC**. While other domain `types.ts` files range from 70-275 LOC (with `dataExchange/types.ts` at 531 as another outlier), 496 LOC for a types-only file suggests it contains more than pure type definitions — likely Zod schemas, default value builders, constants, and validation logic that could be separated.

For comparison:

| Domain | types.ts LOC |
|--------|-------------|
| session | 496 |
| dataExchange | 531 |
| ingestion | 73 |
| installer | 96 |
| subscription | 32 |
| user | 35 |

## Impact

- Types files should be lightweight and quick to scan
- Mixed Zod schemas + types can cause circular import issues
- Constants and default builders are testable logic that belongs in dedicated modules

## Suggested Fix

1. Extract Zod schemas to `session/schemas.ts`
2. Extract default builders and constants to `session/defaults.ts`
3. Keep `types.ts` as pure TypeScript interfaces and type aliases

## Related

- [[TD-118 session helpers.ts exceeds 600 LOC with mixed concerns]] — same domain, same growth pattern

## Affected Files

- `src/domain/session/types.ts` (496 LOC)
