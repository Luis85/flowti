---
type: TechDebt
severity: high
category: architecture
layer: ui
status: resolved
created: 2026-02-14
resolved: 2026-02-14
effort: medium
description: normalizeDocFrontmatter() performs vault writes via app.fileManager.processFrontMatter() as a side-effect of scanning during render. Violates render-should-be-side-effect-free principle and bypasses EventBridge.
source: "[[Technical Review 2026-02-14]]"
---
# TD-32: normalizeDocFrontmatter writes during render

## Problem

`normalizeDocFrontmatter()` in `src/ui/catalog/helpers.ts` (line 99) calls `app.fileManager.processFrontMatter()` directly — a **write operation** — and is invoked during scan, which runs on every render cycle.

### Call chain

```
render() → scan() → normalizeDocFrontmatter() → app.fileManager.processFrontMatter()
```

### Where it's called

| Caller | File | When |
|--------|------|------|
| DomainsTab.scanDomains() | `src/ui/catalog/DomainsTab.ts:90` | Every render |
| ServicesTab.scanServices() | `src/ui/catalog/ServicesTab.ts:88` | Every render |
| EventsTab.scanCategories() | `src/ui/catalog/EventsTab.ts:266` | Every render |
| scanEntityFolder() | `src/ui/catalog/entityScanner.ts:123` | Every render (Flows, Systems, Actors, Products) |

## Impact

1. **Side-effect in render path**: Opening a vault tab triggers writes to frontmatter files — unexpected and potentially destructive
2. **Bypasses EventBridge**: `app.fileManager.processFrontMatter()` is a direct Obsidian API write, not routed through EventBridge or DocService
3. **No event emission**: Other views cannot react to these silent frontmatter changes
4. **Performance**: Every render cycle checks and potentially writes frontmatter for every doc file in the scanned folder

## Suggested Remediation

1. **Separate scan from normalize**: Scan should be read-only; collect non-conforming files into a list
2. **Explicit normalize action**: Show an "X files need normalization" indicator; user clicks to normalize
3. **Route through EventBus**: Emit `doc.normalize` events handled by DocService, which can use `FileSystemClient.updateFrontmatter()`
4. **Cache normalization state**: Track already-normalized files to avoid re-checking on every render

## Affected Files

- `src/ui/catalog/helpers.ts` (normalizeDocFrontmatter function)
- `src/ui/catalog/entityScanner.ts` (calls during scan)
- `src/ui/catalog/DomainsTab.ts` (calls during scan)
- `src/ui/catalog/ServicesTab.ts` (calls during scan)
- `src/ui/catalog/EventsTab.ts` (calls during scan)

## Resolution

Resolved 2026-02-14:
- Scan is now read-only; no writes occur during render
- Non-conforming files collected during scan into a pending list
- Normalized once per session via `normalizeNonConformingFiles()` with session-level deduplication
- Double-scan also eliminated from all 6 entity tabs (Domains, Services, Categories, Flows, Systems, Actors)
