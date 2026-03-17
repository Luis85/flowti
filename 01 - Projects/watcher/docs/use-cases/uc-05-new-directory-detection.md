# UC-05: New Directory Detection

**Feature:** [Core Synchronization](../features/feature-01-core-sync.md)

> As a user, I want new directories created in the source to be automatically scanned and synced.

## Scenario 5.1: New directory triggers incremental reconcile ⏭️

*Requires MappingWatcher + chokidar*

```gherkin
Given a mapping with watchSubfolders: true
When a new directory "new-folder" is created in the source
  And files are placed inside it
Then the files should be synced after a short debounce
```

## Scenario 5.2: Directory events are debounced ⏭️

*Requires MappingWatcher + chokidar*

```gherkin
Given a mapping with debounceDelay 500ms
When a directory "batch-folder" is created
Then processing should wait at least 250ms (minimum dir debounce)
  And all files in the directory should be synced in one batch
```

## Scenario 5.3: Directory queue has backpressure limit ⏭️

*Requires MappingWatcher + chokidar*

```gherkin
Given the pending directory queue has 100 entries (MAX_PENDING_DIRS)
When another new directory event arrives
Then the new event should be dropped
  And the dropped job count should increment
```
