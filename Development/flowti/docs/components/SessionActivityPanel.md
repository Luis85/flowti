---
type: Component
domain: Flowti
stage: done
description: "File-grouped activity list with folder exclusion filter, action icons, and count badges"
source: "[[Development/flowti/src/ui/session/SessionActivityPanel.ts|SessionActivityPanel.ts]]"
parent: "[[SessionWorkspaceView]]"
tags:
  - session
  - component
---

# SessionActivityPanel

## Description

SessionActivityPanel renders the Activity section of the Session Workspace. File activity entries are grouped by path using `groupActivityByFile()`, showing the latest action and a count badge for repeated changes. Includes a folder exclusion filter with tag-style display and autocomplete input via `FolderSuggest`. Supports incremental refresh via `refreshList()`.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `SessionPanelDeps` | interface | Provides `getSession()`, `openFile()`, `app`, `updateActivityFilter()` |
| `SessionActivity` | type | Activity entry with `path`, `action`, `timestamp` |
| `attachFolderSuggest` | function | Wires folder autocomplete to the filter input |
| `setIcon` | obsidian | Renders action-specific icons (file-plus, file-edit, file-minus, file-symlink, file-search) |

## Exports

| Export | Purpose |
|--------|---------|
| `GroupedActivity` | Interface: `{ path, latestAction, latestTimestamp, count }` |
| `groupActivityByFile(entries)` | Pure function grouping activities by path, sorted newest-first |

## State

**Reads via `deps.getSession()`:**
- `activity` — array of `SessionActivity` entries
- `activityFilter` — array of excluded folder paths

## Renders

- Header row with "Activity" label and entry count
- Folder filter: tag chips for active filters (with remove), input for adding new exclusions
- Activity rows: action icon + filename link + action badge + count badge (when >1) + formatted time (HH:MM)
- Deleted files are not clickable
- Empty state: "No activity yet"

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| (none) | — | Uses `deps.updateActivityFilter()` for filter changes; `deps.openFile()` for navigation |

## API

| Method | Purpose |
|--------|---------|
| `render()` | Initial full render into container |
| `refreshList()` | Re-render activity list without full section rebuild |

## Related

- Parent: [[SessionWorkspaceView]]
- Siblings: [[SessionGoalsPanel]], [[SessionExecutionPanel]], [[SessionOutputPanel]]
- Subscription wiring: [[SessionWorkspaceSubscriptions]]
