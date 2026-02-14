---
severity: medium
category: type-safety
layer: domain
status: open
effort: small
description: ExportService casts event payloads to Record<string, unknown> without validation. If the event shape changes, the cast silently passes and produces incorrect output.
---
# TD-22: ExportService type-unsafe payload cast

## Problem

In `ExportService.ts`:

```typescript
const payload = event.payload as Record<string, unknown>;
```

This bypasses TypeScript's type checking. If the event payload structure changes, no compile-time error is raised.

## Suggested Remediation

1. Use Zod runtime validation or type guards for payload extraction
2. Or use the typed EventBus listener (non-wildcard) to get compile-time safety

## Affected Files

- `src/domain/dataExchange/ExportService.ts`
