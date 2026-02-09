---
plugin: "[[Development/watcher/README|README]]"
domain: Folder Watcher
---
# Persona: The Content Creator

> Used in: [Journey 5 — Sync Content Across Devices](../journeys/journey-5-sync-across-devices.md)

## Profile

| | |
|---|---|
| **Name** | Max |
| **Role** | Content creator / plugin developer |
| **Tech level** | Advanced — uses Obsidian on phone, tablet, and desktop; syncs via OneDrive |
| **Platform** | Windows 11 (desktop), iPadOS (tablet), Android (phone) |

## Context

Max uses Obsidian across three devices. On his phone he captures quick ideas, reads notes on the go, and makes small edits. On his tablet he fleshes out drafts, proof-reads, and reorganizes content in longer focused sessions. On his desktop he treats the vault as the authoritative documentation platform — writing plugin specs, architecture notes, and development plans. All devices sync through a shared OneDrive folder. The Folder Watcher plugin keeps the desktop vault in sync with that OneDrive folder, while Obsidian Sync or the mobile OneDrive client handles the phone and tablet side.

## Goals

- Capture an idea on the phone and find it in the desktop vault minutes later
- Proof-read and refine content on the tablet, then continue on the desktop seamlessly
- Use the vault as a single source of truth for plugin development documentation
- Never lose an edit, regardless of which device it was made on
- Handle OneDrive sync delays gracefully (file arrives partially, then completes)

## Pain Points

- OneDrive creates temp files (`.tmp`, `.partial`) and conflict copies (`file (1).md`) during sync
- Edits on the phone and desktop can overlap when OneDrive hasn't finished syncing
- Cloud sync latency means the same file may arrive in stages (partial write → final write)
- File stability is uncertain — a file that just appeared may still be mid-upload
- Accidental duplicates when OneDrive conflict resolution creates renamed copies alongside originals
- Different devices may use different Unicode normalization (NFC vs NFD)

## Jobs to be Done

See [content-creator JTBD](../jtbd/content-creator.md)

## User Stories

See [content-creator user stories](../user-stories/content-creator.md) (8 stories: US-X1 – US-X8)

## Primary Features

| Feature | Why it matters |
|---------|---------------|
| [Core Sync](../features/feature-01-core-sync.md) (bidirectional) | Two-way sync between OneDrive folder and vault |
| [Conflict Resolution](../features/feature-02-conflict-resolution.md) | `keepNewer` across devices; `rename` as fallback for simultaneous edits |
| [File Filtering](../features/feature-04-file-filtering.md) | Ignore OneDrive temp files (`.tmp`, `.partial`, `.crdownload`) |
| [Reliability](../features/feature-06-reliability.md) | Stability checks for files still uploading; retry on EBUSY |
| [Reconciliation](../features/feature-05-reconciliation.md) | Catch up on all changes accumulated while a device was offline |
| [Safety](../features/feature-07-safety.md) | Unicode normalization across platforms; file size limits |
| [Persistence](../features/feature-10-persistence.md) | Remember sync state so only genuine changes are processed |
