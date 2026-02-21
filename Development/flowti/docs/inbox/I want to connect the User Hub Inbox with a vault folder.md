---
type: idea
stage: discovery
origin: inbox
domain: inbox
parent: "[[Hubs PRD]]"
description: "Extend the User Hub Inbox from a passive notification center to an active vault folder triage workspace — watch configured folders, surface untyped notes, and let users enrich frontmatter inline to start the data quality journey."
tags:
  - inbox
  - capture
  - data-quality
priority: 2 - high
rank:
related:
  - "[[Quick capture ribbons for ideas and feedback]]"
  - "[[I want my files in the inbox routed to the correct folder once they are typed]]"
  - "[[I want to capture feedback and input as fast as possible]]"
  - "[[Whenever a File gets created, I want to document its type if not yet done]]"
  - "[[Quick Capture PRD]]"
---
## User Story

As a knowledge worker using Flowti, I want the User Hub Inbox to watch configured vault folders and surface untyped notes so that I can triage incoming captures inline — setting type and description — and start every note's data quality journey from a single workspace.

## Original Idea

I want to use the User Hub Inbox also to watch Vault Folders. I need to be able to configure multiple folders to watch. The can also watch recursively but this can be configured.

The Idea is, to connect folders to the inbox for ingestion and one main target folder where new notes get captured. We want to embrace the "Inbox Zero" idea, the only task with the inbox is to set a note as "read". At most the user can edit type and description. Once a note is typed, it will disappear from the inbox.

The flow is as follows:

- a new note gets created in the vault folder "inbox"
- this note does only have a title
- the note appears in the user hub inbox
- the user can click read, this will give the note the frontmatter props from the note template
- or:
	- the user changes the type in the inbox editor and clicks on read afterwards
- or:
	- the user enters a description or updates both
- the closing action will be always to mark a note without frontmatter as read to start the data quality journey and set the first frontmatter properties

The Inbox can also listen to other folders to capture empty notes and display them in the inbox, this will update the note.

New notes from the inbox will always go into exactly one target folder.

The Inbox actions can potentially be combined with data-massage or template supported by Obsidian Bases config files.

## User Pains

- Notes captured quickly (via Quick Capture, manual creation, or external tools) land in vault folders but are invisible to the inbox — they have no frontmatter, no type, no connection to the knowledge graph
- The current inbox only shows event-driven notifications (subscription matches, import/export results). There is no way to see "raw" unprocessed notes that need attention
- Discovering untyped notes requires manually browsing folder trees or running searches — breaks flow and adds cognitive overhead
- Without a triage interface, notes accumulate in inbox folders indefinitely, becoming a graveyard instead of a processing queue
- The gap between "capture" ([[Quick capture ribbons for ideas and feedback]]) and "organization" (typed, routed notes) has no bridge — users must context-switch to manually open each note and add frontmatter

## User Needs

- **Folder watching**: Configure one or more vault folders (with optional recursive mode) that the inbox monitors for new or untyped notes
- **Automatic surfacing**: When a note appears in a watched folder without frontmatter (or with empty type), it shows up as an inbox item
- **Inline triage**: Edit type and description directly in the inbox detail panel — no need to navigate to the file
- **Mark as read**: Single action that applies a note template's frontmatter properties, completing the initial data quality step
- **Target folder**: All notes processed through the primary inbox folder go to exactly one configured target folder
- **Inbox Zero**: Once a note is typed and marked as read, it disappears from the inbox — the inbox is a processing queue, not a permanent view
- **Source configuration**: Enable/disable folder watching per folder, consistent with existing inbox source toggles in Settings

## Use Cases

### UC-1: Triage a quick-captured note
1. User clicks "Add Idea" ribbon → note created in `00 - Inbox/inbox/` with title only
2. InboxService detects new file in watched folder via `file.created` event
3. Note appears in User Hub Inbox as unread item with title and "Vault Folder" source badge
4. User clicks the item → detail panel shows title, type dropdown, description field
5. User sets type to "idea", enters a one-line description
6. User clicks "Mark as Read" → frontmatter template applied, note moved to target folder
7. Item disappears from inbox

### UC-2: Catch empty notes from other folders
1. User has a second watched folder: `01 - Now/Project-X/notes/`
2. A collaborator creates `meeting-recap.md` with only a title
3. InboxService detects the note (empty frontmatter) and surfaces it in the inbox
4. User triages it by setting type to "meeting" and marking as read
5. Frontmatter properties are written to the file in-place (no move — only the primary inbox folder routes to a target)

### UC-3: Recursive folder watching
1. User configures `docs/inbox/` with recursive watching enabled
2. A note is created in `docs/inbox/signals/new-idea.md`
3. InboxService detects it via recursive watch and surfaces it in the inbox
4. User triages as normal

## Gherkin Scenarios

```gherkin
Scenario: New note in watched folder appears in inbox
  Given the inbox is configured to watch "00 - Inbox/inbox/"
  And a new note "Quick thought.md" is created in that folder with no frontmatter
  When InboxService processes the file.created event
  Then a new inbox item appears with title "Quick thought" and source "Vault Folder"
  And the inbox unread count increments by 1

Scenario: Mark as read applies template frontmatter and routes to target
  Given an inbox item from a watched folder with type set to "idea"
  When the user clicks "Mark as Read"
  Then the note receives frontmatter properties from the configured note template
  And the note is moved to the configured target folder
  And the inbox item is removed

Scenario: Typed note auto-dismissed from inbox
  Given a note in a watched folder already has a non-empty "type" frontmatter
  When InboxService scans the folder
  Then the note does not appear in the inbox

Scenario: Secondary watched folder triages in-place
  Given the inbox watches a secondary folder "01 - Now/notes/"
  And a new note appears with empty frontmatter
  When the user marks it as read from the inbox
  Then frontmatter is applied to the note in-place
  And the note remains in its original folder (no routing)
```

## Acceptance Criteria

- [ ] Settings UI: configure watched folders (add/remove paths, toggle recursive per folder)
- [ ] Settings UI: configure target folder for primary inbox routing
- [ ] InboxService registers a new source type: `vaultFolder`
- [ ] `INBOX_SOURCE_DEFINITIONS` extended with vault folder source entry
- [ ] Mapper function `mapVaultFolderNote` creates InboxItem from file metadata
- [ ] Inbox listens to `file.created` and `file.modified` events filtered by watched folder paths
- [ ] Notes with empty or missing `type` frontmatter in watched folders appear as inbox items
- [ ] Notes with existing `type` frontmatter are excluded
- [ ] Inbox detail panel shows type dropdown and description field for vault folder items
- [ ] "Mark as Read" applies configured note template frontmatter to the file
- [ ] "Mark as Read" on primary inbox folder items moves the note to the target folder
- [ ] "Mark as Read" on secondary watched folder items applies frontmatter in-place (no move)
- [ ] Inbox item removed after mark-as-read
- [ ] Source badge shows "Vault Folder" for folder-sourced items
- [ ] Per-source toggle for vault folder watching in Settings → Inbox
- [ ] `npm run build` passes

## Technical Feasibility

**Infrastructure ready:**
- `file.created` / `file.modified` events already emitted by File Events domain (L5, done)
- InboxService already supports source registration pattern (mapper + listener + source definition)
- Existing subscription system already filters events by path patterns — reusable for folder matching
- TypedStorage persistence for inbox state already handles `InboxItem[]`

**New components needed:**
- `mapVaultFolderNote`: Pure mapper function (file metadata → InboxItem)
- Folder watcher configuration in settings (paths + recursive flags + target folder)
- Inline type/description editor in inbox detail panel (extends current read-only detail)
- File move operation on mark-as-read (via existing `FileSystemClient`)
- Frontmatter template application (via existing `DocService`)

**Events (new):**
- `inbox.vaultFolder.noteDetected` — when untyped note found in watched folder
- `inbox.vaultFolder.noteTriaged` — when note marked as read with type/description
