---
type: TechDebt
severity: critical
category: error-handling
layer: domain
status: resolved
resolved: 2026-02-14
effort: small
description: JobQueue.ts catches and silently swallows all exceptions from the job processor. Failed jobs disappear without logging, event emission, or retry signalling.
---
# TD-03: JobQueue swallows exceptions silently

## Problem

In `JobQueue.ts`, the `processNext()` method wraps the processor call in a try-catch that silently discards the error:

```typescript
try {
    await this.processor(job);
} catch {
    // silently swallowed
}
```

## Impact

- Failed ingestion jobs are silently lost
- No visibility into processing failures
- Makes debugging production issues very difficult
- Contradicts the project's error handling architecture (ErrorService, typed FlowtiError hierarchy)

## Suggested Remediation

1. Add an `onError` callback to `JobQueue` constructor options
2. Log errors through the injected logger
3. Emit an event (e.g. `ingestion.job.failed`) for observability
4. Consider a dead-letter queue or retry mechanism at the queue level

## Affected Files

- `src/domain/ingestion/JobQueue.ts`

## Resolution

The `JobQueue` constructor now accepts an optional `onError` callback. When a job fails, the callback is invoked with the item and error instead of silently swallowing. Consumers like `IngestionService` pass error handlers for logging and event emission.
