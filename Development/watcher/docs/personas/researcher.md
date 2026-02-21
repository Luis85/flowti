---
plugin: "[[Development/watcher/README|README]]"
domain: Folder Watcher
type: Persona
roles:
  - user
---
# Persona: The Researcher

> Used in: [Journey 1 — Import External Notes](../journeys/journey-1-import-external-notes.md)

## Profile

| | |
|---|---|
| **Name** | Alex |
| **Role** | Academic researcher |
| **Tech level** | Intermediate — comfortable with Obsidian, not a developer |
| **Platform** | macOS + Windows (lab PC) |

## Context

Alex keeps research notes, paper drafts, and reference material in a Dropbox-synced folder. They use Obsidian as their primary knowledge base and want external notes to appear in the vault automatically — without manual copy-paste.

## Goals

- Import external notes into Obsidian without manual effort
- Keep only relevant file types (`.md`, `.txt`) — no binaries or temp files
- Trust that the sync is safe (no overwrites, no data loss)
- Resume efficiently after being offline (incremental reconciliation)

## Pain Points

- Forgetting to manually copy new files into the vault
- Cloud sync (Dropbox) creates temp files and partial downloads that shouldn't be imported
- macOS and Windows use different Unicode forms — accented filenames must match correctly
- Large reference PDFs or datasets shouldn't crash the plugin

## Jobs to be Done

See [researcher JTBD](../jtbd/researcher.md)

## User Stories

See [researcher user stories](../user-stories/researcher.md) (6 stories: US-R1 – US-R6)

## Primary Features

| Feature | Why it matters |
|---------|---------------|
| [Core Sync](../features/feature-01-core-sync.md) (source-only) | One-way import from Dropbox to vault |
| [File Filtering](../features/feature-04-file-filtering.md) | Only `.md`/`.txt`, ignore temp files and dotfiles |
| [Reconciliation](../features/feature-05-reconciliation.md) | Catch up after offline periods |
| [Safety](../features/feature-07-safety.md) | Unicode normalization, file size limits |
| [Persistence](../features/feature-10-persistence.md) | Remember sync state across sessions |
