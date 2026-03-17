---
type: TechDebt
severity: medium
category: fragility
layer: domain
status: resolved
created: 2026-02-15
updated: 2026-02-21
effort: small
resolved_in: "Cycle 10 Inc 4"
description: "FolderScaffoldStep now uses fileExists() check before createFile() instead of error string matching. Locale-independent and robust against Obsidian error message changes."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-71: FolderScaffoldStep idempotency relies on error string matching

## Problem

`FolderScaffoldStep` achieves idempotency by catching folder-creation errors and checking `error.message.includes('already exists')`. This pattern couples the step's correctness to the exact wording of Obsidian's internal error messages.

```typescript
try {
    await createFolder(folder);
} catch (error) {
    if (error.message.includes('already exists')) {
        // treat as success (idempotent)
    } else {
        throw error;
    }
}
```

## Impact

- If Obsidian changes error messages (e.g., localization, version update, or rephrasing), the step fails instead of being idempotent.
- Users with non-English Obsidian locales may see installer failures on folders that already exist.
- The pattern is brittle and will silently break without test coverage for the exact error string.

## Suggested Fix

Check folder existence before creating instead of relying on error messages:

```typescript
const existing = vault.getAbstractFileByPath(folder);
if (!existing) {
    await createFolder(folder);
}
```

This is a proactive existence check rather than a reactive error-message parse, and is locale-independent.

## Affected Files

- `src/domain/installer/steps/FolderScaffoldStep.ts` (lines 40-46)
