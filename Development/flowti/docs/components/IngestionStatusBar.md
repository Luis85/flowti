---
type: Component
domain: Flowti
stage: done
description: "Status bar item displaying ingestion pipeline state and processing statistics"
source: "[[Development/flowti/src/ui/IngestionStatusBar.ts|IngestionStatusBar.ts]]"
parent: "[[Flowti Plugin]]"
tags:
  - standalone
  - component
---

# IngestionStatusBar

## Description

IngestionStatusBar is a standalone status bar component that displays the current state of the ingestion pipeline in the Obsidian status bar. It shows one of three states -- idle, processing, or scanning -- along with job counts, processed counts, and failed counts. It registers event listeners on construction and cleans them up via `dispose()`.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IEventBus` | interface | Listens for ingestion and catch-up lifecycle events |
| `HTMLElement` | DOM | The status bar element where text content is rendered |

## State

The component manages its own internal state (not shared via deps):

- `state: StatusBarState` -- one of `"idle"`, `"processing"`, or `"scanning"`
- `jobCount: number` -- number of files being processed in the current batch
- `processedCount: number` -- cumulative count of successfully processed files
- `failedCount: number` -- cumulative count of failed file processings

## Renders

- **Processing state**: `"Flowti: processing {N} files..."`
- **Scanning state**: `"Flowti: scanning folders..."`
- **Idle state (with stats)**: `"Flowti: idle ({N} processed, {N} failed)"`
- **Idle state (no stats)**: `"Flowti: idle"`

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `ingestion.batch.started` | Listens | Transitions to processing state, captures jobCount |
| `ingestion.batch.completed` | Listens | Transitions to idle state, updates processedCount and failedCount |
| `ingestion.stats` | Listens | Updates processedCount and failedCount from stats payload |
| `catchup.started` | Listens | Transitions to scanning state |
| `catchup.completed` | Listens | Transitions to idle state |

## Related

- Parent: Flowti Plugin (registered in `main.ts`)
- Siblings: none (standalone status bar item)
- Children: none
