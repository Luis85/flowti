---
type: Component
domain: JourneyBuilder
stage: done
description: "Domain service — handles journey export (3-file write), canvas sync (companion .canvas generation), and import (file read + event emit)"
source: "[[Development/flowti/src/domain/journeyBuilder/JourneyBuilderService.ts|JourneyBuilderService.ts]]"
tags:
  - journey-builder
  - service
  - component
---

# JourneyBuilderService

## Description

JourneyBuilderService is the domain service for the Journey Builder. It listens for export, canvas sync, and import events, and handles file I/O via IFileSystemClient. On export, it writes 3 files (journey JSON, test executor, companion canvas). On canvas sync, it generates and writes the companion canvas. On import, it reads a JSON file and emits the parsed content.

## Dependencies

| Dependency | Type | Purpose |
|------------|------|---------|
| `IFileSystemClient` | interface | File read/write/exists operations |
| `IEventBus` | interface | Event subscription and emission |
| `buildJourneyCanvas` | function | Canvas JSON generation from journey definition |

## State

**Internal:**
- `unsubExport` — Export event unsubscribe function
- `unsubCanvasSync` — Canvas sync event unsubscribe function
- `unsubImport` — Import event unsubscribe function

## Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `journey-builder.exported` | in | Trigger 3-file export |
| `journey-builder.canvas.sync-requested` | in | Trigger companion canvas write |
| `journey-builder.import-requested` | in | Trigger file read for open existing |
| `journey-builder.canvas.synced` | out | Canvas write completed |
| `journey-builder.imported` | out | File content read and ready |

## API

| Method | Purpose |
|--------|---------|
| `start()` | Subscribe to export, canvas sync, and import events |
| `stop()` | Unsubscribe all listeners |
| `buildDefinitionJSON(payload)` | Generate journey JSON string from export payload |
| `buildTestExecutor(name, jsonFile)` | Generate .test.ts executor boilerplate (8-line wrapper) |

## Related

- UI: [[JourneyBuilderSidebar]]
- Canvas: [[canvasSync]]
- Test: `tests/domain/journeyBuilder/JourneyBuilderService.test.ts` (42 tests)
- Source: `src/domain/journeyBuilder/JourneyBuilderService.ts` (176 LOC)
