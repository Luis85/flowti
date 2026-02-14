---
severity: medium
category: architecture
layer: ui
status: open
created: 2026-02-14
effort: small
description: 4 UI locations perform write mutations (vault.create, vault.createFolder, vault.delete) directly against the Obsidian API, bypassing EventBridge write routing. Refinement of TD-06.
source: "[[Technical Review 2026-02-14]]"
---
# TD-31: Direct write mutations bypass EventBridge

## Problem

[[TD-06 UI layer bypasses EventBridge]] documents ~112 direct Obsidian API accesses in UI files, most of which are read-only queries (acceptable). However, 4 locations perform **write mutations** that bypass the EventBridge boundary:

| File | Line | Operation | Description |
|------|------|-----------|-------------|
| `CsvActionView.ts` | 632 | `app.vault.create(path, content)` | Creates `.base` file directly |
| `FolderPickerModal.ts` | 46 | `app.vault.createFolder(newPath)` | Creates folder from picker |
| `TypesTab.ts` | 164 | `app.vault.delete(file)` | Deletes type doc file |
| `ReportsTab.ts` | 194 | `app.vault.delete(file)` | Deletes report file |

## Why this matters (vs read-only access)

Write mutations should route through EventBridge or DocService because:
- **No event emission**: these writes don't trigger `doc.created` / `doc.deleted` events, so other views can't react
- **No error handling boundary**: the EventBridge wraps operations in `FlowtiError`; these catches are ad-hoc
- **Inconsistency**: other CRUD operations (domains, services, flows, systems, actors, products) all route through `doc.create` events

## Suggested Remediation

1. `CsvActionView.ts:632` → emit `doc.create` event with base file content
2. `FolderPickerModal.ts:46` → use `FileSystemClient.createFolder()` (already exists)
3. `TypesTab.ts:164` / `ReportsTab.ts:194` → emit `doc.delete` event or use `FileSystemClient.deleteFile()`

Effort: small — 4 targeted changes, each 1-3 lines.

## Affected Files

- `src/ui/CsvActionView.ts`
- `src/ui/FolderPickerModal.ts`
- `src/ui/hub/TypesTab.ts`
- `src/ui/hub/ReportsTab.ts`
