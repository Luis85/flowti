---
plugin: "[[Development/watcher/README|README]]"
domain: Folder Watcher
type: Persona
roles:
  - user
---
# Persona: The Collaborator

> Used in: [Journey 4 — Share Drafts and Collect Feedback](../journeys/journey-4-share-and-collect-feedback.md)

## Profile

| | |
|---|---|
| **Name** | Chris |
| **Role** | Team lead / content creator |
| **Tech level** | Intermediate — uses Obsidian daily, shares files via network or cloud folders |
| **Platform** | Windows 11 |

## Context

Chris works on documentation, proposals, and reports together with colleagues. Shared files live in a team folder (network share or OneDrive). Chris writes drafts in Obsidian, pushes them to the shared folder for review, and pulls back feedback and contributions from teammates who edit the same files in Word, VS Code, or other tools.

## Goals

- Share drafts with colleagues by syncing vault files to a shared team folder
- Receive feedback and contributions back into the vault automatically
- Preserve both versions when a colleague edits while Chris is also editing
- Know which files changed since the last review cycle

## Pain Points

- Overwriting a colleague's edits (or having own edits overwritten)
- Not noticing that a teammate updated a shared file
- Merge conflicts when both sides change the same file simultaneously
- Temp files and lock files from colleagues' Office apps polluting the vault
- Orphaned vault copies when files are reorganized in the shared folder

## Jobs to be Done

See [collaborator JTBD](../jtbd/collaborator.md)

## User Stories

See [collaborator user stories](../user-stories/collaborator.md) (7 stories: US-C1 – US-C7)

## Primary Features

| Feature | Why it matters |
|---------|---------------|
| [Core Sync](../features/feature-01-core-sync.md) (bidirectional) | Two-way sync between vault and shared team folder |
| [Conflict Resolution](../features/feature-02-conflict-resolution.md) | `rename` strategy preserves both versions on conflict |
| [Deletion & Move](../features/feature-03-deletion-move.md) | Detect renames, clean up orphans after reorganization |
| [File Filtering](../features/feature-04-file-filtering.md) | Ignore Office lock files (`~$*.docx`), temp files |
| [Reconciliation](../features/feature-05-reconciliation.md) | Catch up on all colleague changes after being away |
| [Reliability](../features/feature-06-reliability.md) | Retry on locked files (colleagues have them open) |
