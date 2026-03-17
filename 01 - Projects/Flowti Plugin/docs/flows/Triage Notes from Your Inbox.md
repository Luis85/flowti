---
type: Flow
domain: Flowti
stage: planned
description: End-to-end journey from vault folder watching through inbox surfacing to inline triage with type/description editing and note routing
domains:
  - Inbox
  - Capture
services:
  - InboxService
  - FileSystemClient
events:
  - inbox.vaultFolder.noteDetected
  - inbox.vaultFolder.noteTriaged
  - inbox.itemAdded
  - inbox.itemsChanged
tags:
  - inbox
  - capture
  - triage
  - planned
---

# Triage Notes from Your Inbox

> **Status: PLANNED** — This flow will be delivered in Cycle 12 Inc 2 (Folder Watcher Core) and Inc 3 (Triage & Routing). The steps below describe the intended behavior.

## Overview

When notes are created in watched vault folders (via Quick Capture, manual creation, or external tools), the inbox automatically surfaces any note that lacks a typed frontmatter `type` field. Users triage these notes inline from the User Hub Inbox — setting the type and description via a detail panel — then mark as read, which applies frontmatter and optionally routes the note to a target folder. This completes the capture-to-organization pipeline: from fleeting thought to typed, structured, routed note.

## Trigger

A note is created or modified in a configured watched vault folder with empty or missing `type` frontmatter.

## Steps

### 1. Configure Watched Folders

- **View/Service**: Settings UI (InboxFolderSettings)
- **User Action**: Opens Settings → Inbox section. Adds one or more vault folder paths to the watched folders list. Optionally enables recursive watching per folder. Configures a target folder for the primary inbox folder routing.
- **System Response**: Folder paths, recursive flags, and target folder saved to settings. InboxService registers `file.created` and `file.modified` listeners filtered by the configured paths.
- **Events**: `settings.changed`

### 2. Note Appears in Watched Folder

- **View/Service**: EventBridge → InboxService
- **User Action**: User captures a note (via Quick Capture, manual file creation, or external tool) in a watched folder
- **System Response**: EventBridge emits `file.created` or `file.modified`. InboxService listener checks if the file path is within a watched folder. If the note has empty or missing `type` frontmatter, the `mapVaultFolderNote` mapper creates an InboxItem with source type `vaultFolder` and a "Vault Folder" source badge. Notes with an existing `type` field are excluded.
- **Events**: `file.created` / `file.modified` → `inbox.vaultFolder.noteDetected` → `inbox.itemAdded`

### 3. Item Surfaces in Inbox

- **View/Service**: UserHubView (Inbox tab)
- **User Action**: (none — automatic)
- **System Response**: The new inbox item appears in the User Hub Inbox with the note title, "Vault Folder" source badge, and unread state. The inbox unread count badge updates.
- **Events**: `inbox.itemAdded`

### 4. Triage the Note

- **View/Service**: UserHubView → VaultFolderTriagePanel
- **User Action**: Clicks the inbox item. The detail panel shows a triage interface specific to vault folder items: type dropdown and description text field. User selects a type (e.g., "idea", "feedback", "bug") and enters a one-line description.
- **System Response**: Triage panel renders with the note's current metadata. Type dropdown populated from available note types.
- **Events**: (none — UI interaction)

### 5. Mark as Read

- **View/Service**: VaultFolderTriagePanel → InboxService → FileSystemClient
- **User Action**: Clicks "Mark as Read"
- **System Response**: InboxService applies the configured note template frontmatter to the file:
  - Sets `type` to the selected value
  - Sets `description` if provided
  - Preserves existing content

  **Routing behavior depends on folder source:**
  - **Primary inbox folder**: Note is moved to the configured target folder via `FileSystemClient.moveFile()`
  - **Secondary watched folder**: Frontmatter is applied in-place; note stays in its original location

  The inbox item is removed from the list.
- **Events**: `inbox.vaultFolder.noteTriaged` → `inbox.itemsChanged`

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Watched folders | Any vault folder paths | `00 - Connectivity/inbox` |
| Recursive watching | Per-folder toggle | Off |
| Target folder routing | Primary inbox items routed; secondary items stay in place | Depends on folder designation |
| Type selection | Available note types in dropdown | User-selected |

## Events Sequence

```
[Note created in watched folder]
    → file.created
    → InboxService filter by watched paths
    → mapVaultFolderNote (if no type)
    → inbox.vaultFolder.noteDetected
    → inbox.itemAdded → [Inbox re-renders]

[User triages and marks as read]
    → InboxService.triageVaultFolderItem()
    → FileSystemClient.updateFrontmatter()
    → FileSystemClient.moveFile() (primary inbox only)
    → inbox.vaultFolder.noteTriaged
    → inbox.itemsChanged → [Item removed from inbox]
```

## Gherkin Scenarios

```gherkin
Scenario: New note in watched folder appears in inbox
  Given the inbox is configured to watch "00 - Connectivity/inbox/"
  And a new note "Quick thought.md" is created with no frontmatter
  When InboxService processes the file.created event
  Then a new inbox item appears with title "Quick thought" and source "Vault Folder"

Scenario: Mark as read routes to target folder
  Given an inbox item from the primary watched folder with type set to "idea"
  When the user clicks "Mark as Read"
  Then the note receives frontmatter with type "Idea"
  And the note is moved to the configured target folder
  And the inbox item is removed

Scenario: Secondary folder triages in-place
  Given the inbox watches a secondary folder "01 - Now/notes/"
  When the user marks a note as read
  Then frontmatter is applied in-place
  And the note remains in its original folder
```

## Related Use Cases

- [[Capture Ideas and Feedback]] (Quick Capture creates notes that folder watching surfaces)
- [[Manage Inbox Notifications]] (inbox item lifecycle and persistence)
- [[Configure Your Profile and Preferences]] (inbox source toggles include vault folder watching)
