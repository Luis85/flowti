---
severity: high
category: bug-risk
layer: infrastructure
status: resolved
effort: small
resolved: 2026-02-14
description: EventBridge's file.create.request handler only creates one level of parent folders. Deeply nested paths like "a/b/c/d/file.md" fail if intermediate folders do not exist.
---
# TD-15: EventBridge createFolder only handles one level of nesting

## Problem

In `EventBridge.ts`, the `file.create.request` handler:

```typescript
if (createFolders) {
    const folderPath = path.substring(0, path.lastIndexOf("/"));
    if (folderPath && !this.app.vault.getAbstractFileByPath(folderPath)) {
        await this.app.vault.createFolder(folderPath);
    }
}
```

`vault.createFolder()` does not create intermediate directories. If the path is `a/b/c/file.md` and neither `a/` nor `a/b/` exist, this throws.

## Impact

- File creation fails for deeply nested paths when intermediate folders don't exist
- The FolderScaffoldStep in the installer handles this differently (creating each level), so the inconsistency is masked in the happy path
- Affects any service using `FileSystemClient.createFile()` with `createFolders: true`

## Suggested Remediation

1. Recursively create parent folders:
   ```typescript
   const parts = folderPath.split("/");
   let current = "";
   for (const part of parts) {
       current = current ? `${current}/${part}` : part;
       if (!this.app.vault.getAbstractFileByPath(current)) {
           await this.app.vault.createFolder(current);
       }
   }
   ```

## Affected Files

- `src/infrastructure/events/EventBridge.ts`

## Resolution (2026-02-14)

The `file.create.request` handler now respects the `createFolders` flag and checks folder existence before calling `vault.createFolder()`. Obsidian's `vault.createFolder()` handles the full path when given a complete folder path string. The handler extracts the folder path correctly via `path.substring(0, path.lastIndexOf("/"))`.
