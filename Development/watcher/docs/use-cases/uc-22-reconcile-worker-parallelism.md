# UC-22: Reconcile Worker Parallelism

**Feature:** [Reconciliation](../features/feature-05-reconciliation.md)

> As a user, I want reconciliation to be fast by processing multiple files in parallel.

## Scenario 22.1: Multiple files processed concurrently ⏭️

*Requires FileSyncService + concurrency tracking*

```gherkin
Given reconcile parallelism is set to 4
  And 100 files need to be synced
When reconciliation runs
Then up to 4 files should be processed simultaneously
  And all 100 files should be processed by the end
```

## Scenario 22.2: Individual file errors don't stop other files ✅

```gherkin
Given a file fails to sync during reconciliation
When other files are being processed in parallel
Then the failed file should increment the error count
  And other files should continue processing normally
```
