---
type: TechDebt
status: open
severity: low
category: performance
layer: domain
created: 2026-02-15
effort: medium
description: "CsvParser.parse() uses papaparse synchronously on the main thread. Files >10MB would freeze the UI during parsing."
source: "[[Technical Review 2026-02-15]]"
---
# TD-48: CSV parsing blocks UI thread for large files

## Problem

`CsvParser.parse()` calls papaparse's `Papa.parse()` synchronously on the main thread. The entire CSV file content is parsed in a single blocking operation.

```typescript
// src/domain/dataExchange/CsvParser.ts
parse(content: string): ParsedCsv {
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
  });
  return { headers: result.meta.fields ?? [], rows: result.data };
}
```

## Impact

At current usage (typical CSV files <1MB), parsing completes in <100ms — no user impact.

For files >10MB (10,000+ rows with many columns), parsing could take 500ms-2s, causing a noticeable UI freeze. Obsidian may show a "not responding" dialog.

## Suggested Fix

### Option A: Streaming parse with progress

Use papaparse's streaming API for files above a threshold:

```typescript
parse(content: string): Promise<ParsedCsv> {
  if (content.length < 1_000_000) {
    return this.parseSync(content);  // Fast path
  }
  return this.parseStreaming(content);  // Chunked with progress events
}
```

### Option B: Web Worker

Offload parsing to a Web Worker. More complex but keeps UI thread completely free.

### Recommendation

Option A is simpler and sufficient. Implement only when a user reports performance issues with large files.

## Affected Files

- `src/domain/dataExchange/CsvParser.ts`
- `src/domain/dataExchange/ImportService.ts` (async signature change)
