# UC-30: File Size Limit

**Feature:** [Safety & Validation](../features/feature-07-safety.md)

> As a user, I do not want the plugin to crash by trying to load a multi-gigabyte file into memory.

## Scenario 30.1: File over 100MB is skipped (forward sync) ⏭️

*Requires FileSyncService.syncFileInternal with fsp.stat mocking*

```gherkin
Given a source file "huge.bin" is 150 MB
When the watcher tries to sync it to the vault
Then the file should be skipped with reason "file_too_large"
  And a warning should be logged with the file size and the 100MB limit (MAX_FILE_SIZE_BYTES)
```

## Scenario 30.2: File over 100MB is skipped (reverse sync) ⏭️

*Requires FileSyncService.syncFileReverse with vault binary read*

```gherkin
Given a vault file "huge.bin" is 150 MB
When the reverse sync tries to export it to the source
Then the file should be skipped with reason "file_too_large"
```

## Scenario 30.3: File under 100MB is synced normally ⏭️

*Requires FileSyncService integration*

```gherkin
Given a source file "normal.md" is 50 KB
When the watcher syncs it
Then the file should be synced successfully
```
