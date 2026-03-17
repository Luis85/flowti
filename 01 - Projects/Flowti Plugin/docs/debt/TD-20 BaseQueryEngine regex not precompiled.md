---
type: TechDebt
severity: medium
category: performance
layer: domain
status: resolved
effort: small
description: BaseQueryEngine creates new RegExp objects on each filter evaluation call. For repeated queries against large datasets, pre-compiling regex patterns during parse would reduce GC pressure.
resolved: 2026-02-14
---
# TD-20: BaseQueryEngine regex patterns not pre-compiled

## Status: **Resolved** (false positive)

## Problem (original)

`BaseQueryEngine.ts` creates regex patterns inline during filter evaluation (lines ~253-303). For operations like exporting hundreds of notes with complex filter expressions, this creates unnecessary garbage collection pressure.

## Resolution (2026-02-14)

Source-code audit reveals all 5 regex patterns are **already pre-compiled** at module level (`BaseQueryEngine.ts:34-38`):

```typescript
const INFOLDER_RE = /^file\.inFolder\("(.+)"\)$/;
const CONTAINS_RE = /^file\.folderContains\("(.+)"\)$/;
const EXT_RE = /^file\.ext\s*==\s*"(.+)"$/;
const NAME_RE = /^file\.nameContains\("(.+)"\)$/;
const PROP_RE = /^(\w[\w.]*)\s*==\s*"(.+)"$/;
```

Zero `new RegExp()` calls exist in any method body. The original assessment was a **false positive**.

## Affected Files

- `src/domain/dataExchange/BaseQueryEngine.ts`
