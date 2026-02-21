---
type: TechDebt
severity: medium
category: correctness
layer: infrastructure
status: resolved
created: 2026-02-15
updated: 2026-02-21
effort: small
resolved_in: "Cycle 10 Inc 4"
description: "EventBridge frontmatter.update now captures merged frontmatter from the processFrontMatter callback instead of reading from metadataCache. Response data is always fresh."
source: "[[PRD Audit 2026-02-15]]"
tags:
  - prd-audit
---
# TD-67: frontmatter.update.response may return stale data

## Problem

`EventBridge` handles `frontmatter.update` by calling `processFrontMatter()` and then immediately reading back from `metadataCache` to populate the response event's `data` field. However, `processFrontMatter` is async and Obsidian's metadata cache indexing is deferred — the cache may not have been updated yet at the point the response is constructed.

This means the `frontmatter.update.response` event can contain pre-update values rather than the values just written.

## Impact

- Callers of `FileSystemClient.updateFrontmatter()` may receive pre-update (stale) values in the response payload.
- Any UI or service logic that relies on the response data to confirm the write will see incorrect state.
- The bug is timing-dependent: fast vaults or small files may not exhibit it, but large vaults with slow indexing will.

## Suggested Fix

Either:

1. **Omit `data` from the update response** — the caller already knows what they wrote, so the response only needs to confirm success.
2. **Add a brief delay or cache-check** before reading back from `metadataCache` — wait for the cache to reflect the update before constructing the response.

Option 1 is simpler and avoids the inherent race entirely.

## Affected Files

- `src/infrastructure/events/EventBridge.ts` (lines 348-349)
