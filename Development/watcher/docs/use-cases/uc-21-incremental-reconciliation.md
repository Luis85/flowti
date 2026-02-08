# UC-21: Incremental Reconciliation

**Feature:** [Reconciliation](../features/feature-05-reconciliation.md)

> As a user, I want reconciliation to be fast by skipping files that haven't changed since the last run.

## Scenario 21.1: Unchanged files are skipped ✅

```gherkin
Given incremental mode is enabled
  And "file.md" was synced in the last reconciliation with mtime 1000 and size 500
  And "file.md" still has mtime 1000 and size 500
  And "vault/imported/file.md" exists
When reconciliation runs
Then "file.md" should be skipped (unchanged)
```

## Scenario 21.2: Modified file is re-synced ✅

*(also tests size change variant)*

```gherkin
Given incremental mode is enabled
  And "file.md" was synced with mtime 1000
  And "file.md" now has mtime 2000
When reconciliation runs
Then "file.md" should be synced again
```

## Scenario 21.3: Missing vault target triggers re-sync even if source unchanged ⏭️

*Requires FileSyncService + vault adapter integration*

```gherkin
Given incremental mode is enabled
  And "file.md" source is unchanged since last reconcile
  And "vault/imported/file.md" has been manually deleted
When reconciliation runs
Then "file.md" should be re-synced (target missing)
```

## Scenario 21.4: Sync state is persisted after reconciliation ⏭️

*Requires filesystem write verification*

```gherkin
Given incremental mode is enabled
When reconciliation completes successfully
Then updated mtime/size info for all processed files should be saved to disk
```
