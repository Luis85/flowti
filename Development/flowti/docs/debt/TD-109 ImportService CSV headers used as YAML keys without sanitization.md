---
type: TechDebt
severity: low
category: security
layer: domain
status: open
created: 2026-02-20
effort: small
description: "ImportService.buildNoteContent() escapes YAML values but uses CSV column headers directly as frontmatter keys without validating they are safe YAML field names."
---

# TD-109: ImportService CSV headers used as YAML keys without sanitization

## Problem

In `ImportService.buildNoteContent()` (lines 140-156), YAML frontmatter is constructed by iterating over key-value pairs. Values are properly escaped for special characters, but keys (derived from CSV column headers via column mappings) are used verbatim:

```typescript
buildNoteContent(frontmatter: Record<string, string>): string {
    const lines = ["---"];
    for (const [key, value] of Object.entries(frontmatter)) {
        // value is escaped...
        lines.push(`${key}: ${value}`);   // key is NOT validated
    }
    lines.push("---", "", "");
    return lines.join("\n");
}
```

A CSV column header containing YAML-significant characters (e.g., `key: injection`, `key\n  nested: value`) could produce malformed or unintended frontmatter structures.

## Impact

- Malformed YAML frontmatter could prevent Obsidian from parsing the note's metadata.
- While not a traditional security vulnerability (CSV files are user-provided data), it creates a data integrity risk when importing from untrusted CSV sources.
- Obsidian's `processFrontMatter` API would reject the malformed YAML, but manually constructed files bypass that validation.

## Suggested Fix

Sanitize keys to contain only alphanumeric characters, hyphens, and underscores:

```typescript
function sanitizeYamlKey(key: string): string {
    return key.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^[^a-zA-Z]/, "_$&");
}
```

Apply this sanitization in the column mapping step or in `buildNoteContent()`.

## Affected Files

- `src/domain/dataExchange/ImportService.ts` (lines 140-156)
