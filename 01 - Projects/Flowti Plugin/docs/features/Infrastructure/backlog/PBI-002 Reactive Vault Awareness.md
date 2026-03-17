---
type: ProductBacklogItem
feature: "[[Infrastructure PRD]]"
priority: high
stage: done
userStories: []
useCases:
  - "[[See Views Update After File Change]]"
---

## User Story

As a vault user, I want all Flowti views to update automatically when I create, rename, or delete files so that I never have to manually refresh or reopen a view to see current data.

## Functional Requirements

- [x] EventBridge translates Obsidian vault events (create, modify, delete, rename) into typed EventBus events
- [x] File notifications (`file.created`, `file.modified`, `file.deleted`, `file.renamed`) propagate to all subscribed services and views
- [x] Folder notifications (`folder.created`, `folder.deleted`, `folder.renamed`) propagate similarly
- [x] Workspace events (`workspace.leaf-changed`, `workspace.file-opened`, `workspace.layout-changed`) bridge to the event bus
- [x] Event-file detection: files with `type: "Event"` frontmatter trigger `event.file.triggered` on vault actions
- [x] Duplicate create suppression prevents double-firing during file creation flows

## Acceptance Criteria

- [x] Creating a new domain/flow/system doc file causes the corresponding tab to show the new entry on next render
- [x] Renaming a file updates all views that reference it
- [x] Deleting a file removes it from all views
- [x] Opening a file emits `workspace.file-opened` for downstream consumers
- [x] No duplicate events for a single file creation
- [x] `npm run build` passes
