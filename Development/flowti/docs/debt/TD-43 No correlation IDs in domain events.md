---
type: TechDebt
status: open
severity: low
category: architecture
layer: infrastructure
created: 2026-02-15
effort: medium
description: "Domain events lack correlation/causation IDs. Only file operations use RequestId. No way to trace command → response chains across domain events."
source: "[[Technical Review 2026-02-15]]"
---
# TD-43: No correlation/causation IDs in domain events

## Problem

Domain events (subscription, eventDefinition, dataExchange, ingestion) lack traceability metadata. There is no way to correlate a `subscription.created` response back to its triggering `subscription.create` command.

### Current state

**File operations** already use a `RequestId` pattern:
```typescript
export type RequestId = string & { readonly __brand: "RequestId" };

export interface FileRequestBase {
  requestId: RequestId;  // Correlates request with response
  path: string;
}
```

**Domain events** do NOT use any correlation:
```typescript
"subscription.create": {
  eventType: string;
  label?: string;
  filters: Subscription["filters"];
  // No commandId, no causationId
};

"subscription.created": {
  subscription: Subscription;
  // No reference to triggering command
};
```

## Impact

- Difficult to trace multi-step workflows (CSV import → file creation → base file creation) in the Activity Log
- No audit trail for "who triggered what"
- Debugging event chains requires manual timeline correlation
- At current scale (~136 events), this is manageable. Becomes painful as workflows grow more complex.

## Suggested Fix

Add optional traceability fields to a base command interface:

```typescript
interface CommandMeta {
  commandId?: string;    // Unique ID for this command invocation
  causationId?: string;  // ID of the event that caused this command
}
```

Gradually adopt across domain events:
1. Start with `dataExchange.*` events (most complex chains)
2. Extend to `subscription.*` and `eventDefinition.*`
3. Show correlation chain in Activity Log detail panel

## Affected Files

- `src/infrastructure/events/types.ts` (base interface)
- `src/domain/subscription/events.ts`
- `src/domain/eventDefinition/events.ts`
- `src/domain/dataExchange/events.ts`
- `src/domain/ingestion/events.ts`
- `src/ui/EventLogView.ts` (display chain)
