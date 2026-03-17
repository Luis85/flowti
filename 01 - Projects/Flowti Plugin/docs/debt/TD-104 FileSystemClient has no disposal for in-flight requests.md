---
type: TechDebt
severity: medium
category: resource-leak
layer: infrastructure
status: resolved
resolved: 2026-02-21
resolved_in: "Cycle 10 Inc 2"
created: 2026-02-20
effort: medium
description: "FileSystemClient has no dispose or cancel mechanism. In-flight requests register wildcard EventBus listeners that persist until timeout or response, leaking if the owning service is torn down first."
---

# TD-104: FileSystemClient has no disposal for in-flight requests

## Problem

`FileSystemClient` (lines 58-264) does not implement `IDisposable`. Each call to `request()` registers a wildcard listener on the EventBus (line 241) and a timeout (line 233). If the service owning the client is disposed while requests are pending:

- The wildcard listener remains registered until the response event or timeout fires.
- The timeout keeps a reference to the promise's `reject` callback, preventing garbage collection.
- No external API exists to cancel pending operations.

## Impact

- On plugin unload, pending file operations continue to hold EventBus listeners for up to 5 seconds (default timeout).
- In long-running sessions with many concurrent file operations, wildcard listener count grows and degrades EventBus dispatch performance.
- Services that create `FileSystemClient` instances (SessionService, ImportService, ExportService) cannot clean up their client's in-flight work during `dispose()`.

## Suggested Fix

1. Implement an `IDisposable`-compatible `dispose()` method that:
   - Rejects all pending promises with a `CancelledError`.
   - Calls `unsubscribe()` and `clearTimeout()` for each tracked request.
2. Track active requests in a `Map<RequestId, { unsubscribe, timeoutId }>`.
3. Add a `cancelAll()` or `abort()` public method for graceful shutdown.

## Affected Files

- `src/infrastructure/filesystem/FileSystemClient.ts`
