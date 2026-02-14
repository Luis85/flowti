---
severity: medium
category: duplication
layer: cross-cutting
status: open
effort: small
description: The pattern for extracting path/eventName from wildcard event payloads is repeated 5+ times across services. Should be a shared utility function.
---
# TD-18: Path extraction pattern duplicated 5+ times

## Problem

Multiple services extract fields from untyped wildcard event payloads:

```typescript
const payload = event.payload as Record<string, unknown>;
const path = typeof payload.path === "string" ? payload.path : undefined;
const eventName = typeof payload.eventName === "string" ? payload.eventName : undefined;
```

This appears in: EventDefinitionService, SubscriptionService, IngestionService, EventNotificationService.

## Suggested Remediation

1. Create a utility in `utils/helpers.ts`:
   ```typescript
   export function extractStringField(payload: unknown, field: string): string | undefined
   ```
2. Or better: define a `WildcardPayloadExtractor` that returns typed fields

## Affected Files

- `src/domain/eventDefinition/EventDefinitionService.ts`
- `src/domain/subscription/SubscriptionService.ts`
- `src/domain/ingestion/IngestionService.ts`
- `src/domain/eventNotify/EventNotificationService.ts`
