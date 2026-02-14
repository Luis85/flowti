---
severity: high
category: architecture
layer: ui
status: open
effort: large
description: The UI layer directly calls app.vault, app.metadataCache, and app.workspace in 30+ locations, bypassing the EventBridge boundary that the architecture mandates as the sole Obsidian API contact point.
---
# TD-06: UI layer bypasses EventBridge

## Problem

The architectural decision documented in the README states: "The EventBridge owns all Obsidian API to EventBus translation. Services never import from obsidian directly."

However, multiple UI files directly access the Obsidian API:

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

## Affected Files

- `src/ui/CsvActionView.ts`
- `src/ui/DataExchangeHubView.ts`
- `src/ui/ExportView.ts`
- `src/ui/EventLogView.ts`
- `src/ui/EventConfigModal.ts`
- `src/ui/FolderPickerModal.ts`
