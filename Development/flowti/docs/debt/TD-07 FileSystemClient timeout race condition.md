---
severity: high
category: bug-risk
layer: infrastructure
status: resolved
resolved: 2026-02-14
effort: small
description: FileSystemClient has a race between the timeout timer and response arrival. If a response arrives during the timeout cleanup window, the promise may resolve/reject in an undefined order.
---
# TD-07: FileSystemClient timeout/response race condition

## Problem

`FileSystemClient.ts` implements a request/response pattern with a timeout. When a request is made:

1. A `once()` listener is registered for the response event
2. A `setTimeout` is set for the timeout (default 5s)
3. If the timeout fires first, it unsubscribes the listener and rejects

The race: if the response event fires and the timeout fires in close succession (within the same event loop tick), both may attempt to resolve/reject the promise.

## Impact

- Potential unhandled promise rejection in edge cases
- File operations could silently fail or double-resolve under load
- Hard to reproduce but could cause subtle corruption

## Suggested Remediation

1. Use a `settled` boolean guard: once either path fires, set `settled = true` and skip the other
2. Clear the timeout inside the response handler
3. Consider using `AbortController` pattern for cleaner cancellation

## Affected Files

- `src/infrastructure/filesystem/FileSystemClient.ts`

## Resolution

A `let settled = false` boolean guard was added to `FileSystemClient.ts`. Both the timeout handler and the response listener check the `settled` flag before resolving/rejecting the promise. The timeout is cleared inside the response handler, and both paths set `settled = true` to prevent the race condition.
