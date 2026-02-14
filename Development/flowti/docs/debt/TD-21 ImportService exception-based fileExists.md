---
severity: medium
category: code-quality
layer: domain
status: resolved
resolved: 2026-02-14
effort: small
description: ImportService uses exception-based control flow for fileExists() check. This is a performance anti-pattern and makes debugging harder since exceptions are expected during normal operation.
---
# TD-21: ImportService uses exception-based fileExists()

## Problem

`ImportService.ts` checks file existence by catching exceptions:

```typescript
try {
    await this.fileClient.readFile(path);
    return true;
} catch {
    return false;
}
```

This is a known anti-pattern: exceptions should indicate unexpected conditions, not normal control flow.

## Suggested Remediation

1. Add a `fileExists(path: string): Promise<boolean>` method to `FileSystemClient` that uses the EventBridge to check without reading content
2. Or add a `file.exists.request` / `file.exists.response` event pair

## Affected Files

- `src/domain/dataExchange/ImportService.ts`
- `src/infrastructure/filesystem/FileSystemClient.ts`

## Resolution

ImportService now uses a clean `fileSystem.fileExists(notePath)` boolean API call instead of try/catch on `readFile()`. The `FileSystemClient.fileExists()` method encapsulates the existence check internally.
