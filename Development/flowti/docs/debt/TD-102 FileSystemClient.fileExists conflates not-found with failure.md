---
type: TechDebt
severity: medium
category: error-handling
layer: infrastructure
status: open
created: 2026-02-20
effort: small
description: "FileSystemClient.fileExists() catches all readFile errors and returns false, making timeouts, permission errors, and actual absence indistinguishable."
---

# TD-102: FileSystemClient.fileExists() conflates "not found" with "operation failed"

## Problem

`fileExists()` in `FileSystemClient.ts` (lines 67-73) calls `readFile()` and returns `false` on any exception:

```typescript
async fileExists(path: string, options?: FileOperationOptions): Promise<boolean> {
    try {
        await this.readFile(path, options);
        return true;
    } catch {
        return false;
    }
}
```

A timeout (default 5000ms), a permission error, or a transient EventBus failure all produce the same result: `false`.

## Impact

- Services calling `fileExists()` may attempt to create a file that already exists, because the read timed out.
- `createFile` after a false-negative `fileExists()` could silently overwrite data or trigger a conflict error from the EventBridge.
- Debugging is difficult because the caller has no way to distinguish "file truly absent" from "infrastructure failure".

## Suggested Fix

Return a discriminated result type or catch only the expected `FILE_NOT_FOUND` error code:

```typescript
async fileExists(path: string, options?: FileOperationOptions): Promise<boolean> {
    try {
        await this.readFile(path, options);
        return true;
    } catch (err) {
        if (err instanceof Error && err.message.includes("FILE_NOT_FOUND")) {
            return false;
        }
        throw err; // propagate unexpected failures
    }
}
```

Alternatively, introduce a dedicated `file.exists.request`/`file.exists.response` event pair in the EventBridge that checks `app.vault.getAbstractFileByPath()` without reading the full file content.

## Affected Files

- `src/infrastructure/filesystem/FileSystemClient.ts` (lines 67-74)
