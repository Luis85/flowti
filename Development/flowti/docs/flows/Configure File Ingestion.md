---
type: Flow
domain: Flowti
stage: done
description: "End-to-end journey from configuring watch folders and ingestion settings through file arrival, processing, event definition matching, and custom domain event emission"
domains:
  - Ingestion
  - Event Definition
  - Settings
services:
  - IngestionService
  - EventDefinitionService
  - SettingsService
events:
  - settings.changed
  - ingestion.job.started
  - ingestion.job.completed
  - eventDefinition.matched
tags:
  - flow
  - ingestion
---

# Configure File Ingestion

## Overview

Flowti's ingestion pipeline turns file system activity into structured domain events. This journey covers the full pipeline: configuring which folders to watch and which event types to react to, then following a file as it arrives, gets queued and processed by the IngestionService, matches against event definitions, and ultimately emits a custom domain event that downstream subscribers can act on.

## Trigger

User wants to automatically process files that arrive in specific vault folders and transform those file events into meaningful domain events.

## Steps

### 1. Open Settings

- **View/Service**: EventCatalogView (SettingsTab)
- **User Action**: User opens the Event Catalog and navigates to the Settings tab, or opens plugin settings directly
- **System Response**: Settings tab renders current configuration values including ingestion-related fields: watchFolders, ingestionWatchEventTypes, ingestionConcurrency, ingestionBatchWindowMs, ingestionMaxRetries
- **Events**: (none — UI render)

### 2. Configure Watch Folders

- **View/Service**: SettingsTab (Ingestion section)
- **User Action**: User adds one or more folder paths to the `watchFolders` array (e.g., `"Inbox/"`, `"03 - Resources/Imports/"`)
- **System Response**: SettingsService validates the folder paths and persists the updated settings. The ingestion pipeline is now aware of which folders to monitor
- **Events**: `settings.changed`

### 3. Configure Event Types and Tuning

- **View/Service**: SettingsTab (Ingestion section)
- **User Action**: User selects which file event types to watch (e.g., `create`, `modify`, `rename`), sets concurrency (default 3), batch window (default 200ms), and max retries (default 3)
- **System Response**: SettingsService persists all ingestion tuning parameters. IngestionService picks up the new configuration on next event cycle
- **Events**: `settings.changed`

### 4. File Arrives in Watched Folder

- **View/Service**: EventBridge (Obsidian vault events)
- **User Action**: User creates, moves, or modifies a file in one of the configured watch folders (e.g., drops a new `.md` file into `Inbox/`)
- **System Response**: EventBridge detects the vault file event and emits it through the EventBus. IngestionService's wildcard listener evaluates the event against the configured watch folders and event type whitelist
- **Events**: `file.created` / `file.modified` / `file.renamed`

### 5. Ingestion Job Queued and Processed

- **View/Service**: IngestionService, JobQueue
- **User Action**: (automatic — no user action)
- **System Response**: IngestionService creates an ingestion job for the matched file event. The job enters the time-windowed batch (configurable via `ingestionBatchWindowMs`). After the batch window closes, the JobQueue processes jobs with the configured concurrency limit. Each job generates a deterministic idempotency key (`eventType::path`) and checks the ledger to avoid reprocessing. The job executes and the ledger records the key
- **Events**: `ingestion.job.started`

### 6. Ingestion Job Completes

- **View/Service**: IngestionService
- **User Action**: (automatic — no user action)
- **System Response**: The job finishes processing. If it fails, the retry mechanism applies exponential backoff up to `ingestionMaxRetries`. On success, IngestionService emits a completion event containing the original event type, file path, and processing metadata. The ledger is updated; if it exceeds MAX_LEDGER_SIZE (10000), oldest entries are evicted
- **Events**: `ingestion.job.completed`

### 7. Event Definition Matching

- **View/Service**: EventDefinitionService
- **User Action**: (automatic — no user action)
- **System Response**: EventDefinitionService listens for `ingestion.job.completed` events. It evaluates the completed job against all registered event definitions, checking `sourceEventType` and `filePattern` matches. For each matching definition, it extracts payload fields using the configured PayloadMappings (source: path, metadata, or derived). Emission policy is checked: `"once"` consults the emittedKeys deduplication set, `"always"` emits every time
- **Events**: `eventDefinition.matched`

### 8. Custom Domain Event Emitted

- **View/Service**: EventDefinitionService → EventBus
- **User Action**: (automatic — no user action)
- **System Response**: EventDefinitionService calls `emitCustom()` with the definition's `domainEventName` and the extracted payload. The custom event flows through the EventBus where any subscriptions, log entries, or downstream services can react to it. The full pipeline from file arrival to domain event is complete
- **Events**: Custom domain event (e.g., `invoice.received`, `report.imported`)

## Decision Points

| Decision | Options | Default |
|----------|---------|---------|
| Watch folder paths | Any vault folder path(s) | Empty (no folders watched) |
| Event types to watch | create, modify, rename, delete | create, modify |
| Concurrency | 1-10 concurrent jobs | 3 |
| Batch window | 50ms-5000ms | 200ms |
| Max retries | 0-10 | 3 |
| Emission policy | once (deduplicated) / always | once |
| Payload source | path, metadata, derived | Varies per mapping |

## Events Sequence

```
settings.changed → file.created → ingestion.job.started → ingestion.job.completed → eventDefinition.matched → {custom.domain.event}
```

## Related Use Cases

- [[Configure Event Subscriptions]]
- [[Configure Event Definitions]]
