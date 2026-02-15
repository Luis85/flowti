---
status: open
severity: medium
category: concurrency
layer: domain
created: 2026-02-15
effort: small
description: EventDefinitionService "once" emission policy has a race window — emittedKeys Set updates after async payload extraction, allowing duplicate emissions under concurrent load.
source: "[[Technical Review 2026-02-15]]"
---
# TD-41: EventDefinitionService dedup race condition

## Problem

`EventDefinitionService` supports an `emissionPolicy: "once"` option that prevents duplicate domain event emissions for the same (eventType, path) combination. The deduplication uses an `emittedKeys: Set<string>`.

The race condition:

```
Time →
  Event A arrives (file.created, "Reports/Q1.md")
  ├── Check emittedKeys → not found ✓
  ├── Start async extractPayload()          ← takes time
  │
  Event B arrives (file.created, "Reports/Q1.md")    ← concurrent
  ├── Check emittedKeys → not found ✓                ← race window!
  ├── Start async extractPayload()
  │
  Event A completes → add key to emittedKeys → emit domain event
  Event B completes → add key to emittedKeys → emit DUPLICATE domain event
```

The key is added to `emittedKeys` **after** the async `extractPayload()` completes, not at the point of checking.

## Impact

- Under rapid file ingestion, duplicate domain events can be emitted
- Violates the "once" emission policy contract
- Downstream listeners (subscriptions, custom handlers) may process the same file twice

## Suggested Fix

Add the key to `emittedKeys` **before** starting async operations (optimistic dedup):

```typescript
// Before:
const payload = await extractPayload(definition, event);
this.emittedKeys.add(key);

// After:
this.emittedKeys.add(key);  // Reserve immediately
try {
  const payload = await extractPayload(definition, event);
  // emit...
} catch {
  this.emittedKeys.delete(key);  // Release on failure
}
```

This is a standard "check-then-act" → "act-then-check" concurrency pattern fix.

## Affected Files

- `src/domain/eventDefinition/EventDefinitionService.ts`
