# Persona: The Developer

> Used in: [Journey 2 — Edit from Both Sides](../journeys/journey-2-edit-from-both-sides.md)

## Profile

| | |
|---|---|
| **Name** | Sam |
| **Role** | Software developer |
| **Tech level** | Advanced — uses Obsidian, VS Code, and Git daily |
| **Platform** | Windows 11 |

## Context

Sam uses Obsidian for project documentation and VS Code for coding. Markdown files live in a shared folder that both editors access. They need bidirectional sync so edits in either tool are reflected in the other — without infinite sync loops or data conflicts.

## Goals

- Edit the same markdown files in Obsidian and VS Code seamlessly
- Rapid saves in VS Code shouldn't trigger dozens of sync operations
- A single edit must not bounce back and forth between editors
- When both sides change, the newer version should win

## Pain Points

- Sync loops — editing in VS Code triggers a vault event, which triggers a reverse sync, which triggers another event...
- Rapid typing creates many save events within milliseconds
- Conflicting edits when switching between editors quickly
- Long Windows paths can exceed MAX_PATH (260 chars)

## Primary Features

| Feature | Why it matters |
|---------|---------------|
| [Core Sync](../features/feature-01-core-sync.md) (bidirectional) | Two-way sync between vault and source |
| [Conflict Resolution](../features/feature-02-conflict-resolution.md) | `keepNewer` strategy for concurrent edits |
| [Reliability](../features/feature-06-reliability.md) | Loop prevention, debounce, backpressure |
| [Safety](../features/feature-07-safety.md) | Windows path length validation |
| [Deletion & Move](../features/feature-03-deletion-move.md) | Renames detected as moves, not delete+add |
