---
type: TechDebt
severity: medium
category: performance
layer: infrastructure
status: open
created: 2026-02-15
effort: medium
description: "Every FileSystemClient operation registers then removes a wildcard listener. During bulk operations (CSV import creating hundreds of files), this creates rapid add/remove churn on the EventBus listener array."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-66: FileSystemClient wildcard listener churn during bulk ops

## Problem

Each `FileSystemClient` file operation (create, modify, delete) registers a `*` wildcard listener, waits for a matching response event, then unsubscribes. For bulk operations like a 1000-row CSV import, this means 2000+ rapid wildcard listener registrations and removals.

While each individual operation is correct, the aggregate effect during bulk operations is significant:

1. Each pending operation's wildcard handler processes every event on the bus
2. The listener array is constantly resized by add/remove operations
3. Multiple concurrent operations each have their own wildcard listener, all firing on every event

## Impact

Performance degradation during bulk operations. The O(n*m) overhead — where n is pending operations and m is events per operation — becomes noticeable during large CSV imports or folder scaffolding.

## Suggested Fix

Consider a persistent response-routing listener with a pending request map instead of per-request wildcard listeners:

```typescript
// Instead of per-request wildcard listeners:
// const off = eventBus.on("*", handler); ... off();

// Use a single persistent listener with a request map:
class ResponseRouter {
    private pending = new Map<string, (event) => void>();

    constructor(eventBus) {
        eventBus.on("*", (type, payload) => {
            const key = this.matchPending(type, payload);
            if (key) this.pending.get(key)?.(payload);
        });
    }

    waitFor(key, timeout): Promise<void> { ... }
}
```

This reduces wildcard listener count from O(n) to O(1) during bulk operations.

## Affected Files

- `src/infrastructure/filesystem/FileSystemClient.ts` (lines 220-262)
