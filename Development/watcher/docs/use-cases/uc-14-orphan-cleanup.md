# UC-14: Orphan Cleanup

**Feature:** [Deletion & Move Handling](../features/feature-03-deletion-move.md)

> As a user, I want vault files that no longer have a source counterpart to be cleaned up during reconciliation.

## Scenario 14.1: Orphaned vault file is trashed ⏭️

*Requires FileSyncService + vault integration*

```gherkin
Given a mapping with deletionHandling "trash"
  And "vault/imported/orphan.md" exists in the vault
  And "orphan.md" does NOT exist in the source folder
When reconciliation runs
Then "vault/imported/orphan.md" should be trashed
```

## Scenario 14.2: Files matching source are kept ⏭️

*Requires FileSyncService + vault integration*

```gherkin
Given a mapping with deletionHandling "trash"
  And "vault/imported/keep.md" exists in both vault and source
When reconciliation runs
Then "vault/imported/keep.md" should NOT be trashed
```

## Scenario 14.3: Extension filter is respected during cleanup ⏭️

*Requires FileSyncService + vault integration*

```gherkin
Given a mapping with deletionHandling "trash" and fileExtensions [".md"]
  And "vault/imported/data.csv" exists in the vault but not in source
When reconciliation runs
Then "vault/imported/data.csv" should NOT be trashed (not in filter scope)
```

## Scenario 14.4: Exclude patterns respected during cleanup ⏭️

*Requires FileSyncService + vault integration*

```gherkin
Given a mapping with deletionHandling "trash" and excludePatterns ["*.log"]
  And "vault/imported/debug.log" exists in vault but not in source
When reconciliation runs
Then "vault/imported/debug.log" should NOT be trashed (matches exclude pattern)
```

## Scenario 14.5: Trash failure is handled gracefully ⏭️

*Requires FileSyncService + vault integration*

```gherkin
Given a mapping with deletionHandling "trash"
  And trash fails for "vault/imported/locked.md"
When reconciliation runs
Then the error count should increment
  And processing of other files should continue
```
