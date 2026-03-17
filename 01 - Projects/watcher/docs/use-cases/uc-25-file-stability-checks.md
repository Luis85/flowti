# UC-25: File Stability Checks

**Feature:** [Reliability & Performance](../features/feature-06-reliability.md)

> As a user syncing from a OneDrive / Dropbox folder, I want the plugin to wait until files are fully downloaded before syncing.

## Scenario 25.1: Unstable file is delayed until stable ⏭️

*Requires FileSyncService.verifyStability with multi-stat mocking*

```gherkin
Given verifyFileStability is enabled
  And stabilityChecks is 3
  And stabilityCheckInterval is 500ms
When "file.md" is created and its mtime keeps changing (cloud sync in progress)
Then the sync should wait until 3 consecutive stat checks show the same mtime/size
```

## Scenario 25.2: File that never stabilizes is skipped ⏭️

*Requires FileSyncService.verifyStability*

```gherkin
Given verifyFileStability is enabled
When a file's mtime continues changing through all stability checks
Then the file should be skipped with reason "not_stable"
```

## Scenario 25.3: Stability checks disabled during reconciliation ⏭️

*Requires ReconcileService + FileSyncService integration*

```gherkin
Given disableStabilityCheckDuringReconcile is true (default)
When reconciliation processes files
Then stability checks should be skipped for faster processing
```
