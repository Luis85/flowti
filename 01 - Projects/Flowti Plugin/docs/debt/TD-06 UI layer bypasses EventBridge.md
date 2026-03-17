---
type: TechDebt
severity: medium
category: architecture
layer: ui
status: open
updated: 2026-02-16
effort: large
description: The UI layer directly calls app.vault, app.metadataCache, and app.workspace in 112 locations across 32 UI files, bypassing the EventBridge boundary that the architecture mandates as the sole Obsidian API contact point.
---
# TD-06: UI layer bypasses EventBridge

## Problem

The architectural decision documented in the README states: "The EventBridge owns all Obsidian API to EventBus translation. Services never import from obsidian directly."

However, 112 direct API calls across 32 UI files directly access the Obsidian API:

| File | Direct API Calls | Operations |
|------|-----------------|------------|
| `CsvActionView.ts` | 27+ | `vault.getAbstractFileByPath`, `vault.getFiles`, `metadataCache.getFileCache`, `workspace.openLinkText` |
| `DataExchangeHubView.ts` | 8+ | `vault.getMarkdownFiles`, `vault.getAbstractFileByPath`, `metadataCache.getFileCache` |
| `ExportView.ts` | 5+ | `require("electron")`, `remote.dialog.showSaveDialog`, `workspace.openLinkText` |
| `EventLogView.ts` | 4+ | `vault.getAbstractFileByPath`, `workspace.getLeaf`, `leaf.openFile` |
| `EventConfigModal.ts` | 3+ | `vault.getAbstractFileByPath`, `workspace.getLeaf` |
| `FolderPickerModal.ts` | 1 | `vault.createFolder` |

## Impact

- Services are testable via mock EventBus; UI views are not (they require a real Obsidian `App`)
- Changes to Obsidian's API require updates in multiple locations instead of just EventBridge
- Contradicts the architecture decision and erodes team trust in conventions

## Suggested Remediation

1. **Read-only queries** (vault listing, metadata cache) — add query events to EventBridge or provide a `VaultQueryService` in the service container
2. **File operations** (create folder, open file) — route through existing EventBridge request/response pattern
3. **Electron dialog** — wrap in a `DialogService` that can be mocked in tests
4. **Workspace navigation** — add `workspace.navigate` event to EventBridge

## Current Assessment (2026-02-16)

Many of these calls are unavoidable in Obsidian plugin development — metadataCache reads for frontmatter scanning, workspace navigation, and file-picker modals all require direct Obsidian API access. The EventBridge boundary is most critical for write operations and event-producing operations. Read-only queries in UI components are acceptable for now.

**Key insight**: All write operations now route through events (DocService centralization in Phase 8 eliminated 16+ scattered `fileSystemClient.createFile()` calls). The 112 remaining direct API calls are exclusively read-only queries — `metadataCache.getFileCache()`, `vault.getAbstractFileByPath()`, `vault.getFiles()`, `workspace.getLeaf()`, etc. The one write exception (`FolderPickerModal.createFolder`) is a UI utility. This is an acceptable architectural trade-off and should not be treated as blocking.

## Affected Files

- `src/ui/CsvActionView.ts`
- `src/ui/DataExchangeHubView.ts`
- `src/ui/ExportView.ts`
- `src/ui/EventLogView.ts`
- `src/ui/EventConfigModal.ts`
- `src/ui/FolderPickerModal.ts`
