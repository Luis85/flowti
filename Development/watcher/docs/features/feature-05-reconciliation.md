# Feature 5: Reconciliation

Covers bulk catchup sync operations that scan entire folders, including startup reconciliation, incremental mode, parallelism, and cancellation.

> **Test file:** `tests/acceptance/feature5-reconciliation.test.ts` — 8 passing, 6 skipped

## Use Cases

| # | Use Case | User Story | Status |
|---|----------|------------|--------|
| UC-20 | Reconciliation on Start | Catching up after Obsidian was closed | ✅ 3/4 |
| UC-21 | Incremental Reconciliation | Skipping unchanged files for speed | ✅ 2/4 |
| UC-22 | Reconcile Worker Parallelism | Processing multiple files concurrently | ✅ 1/2 |
| UC-23 | Cancel Reconciliation | Stopping a running reconciliation | ✅ 1/1 |
| UC-24 | Concurrent Reconcile Guard | Preventing overlapping reconciliations | ✅ 1/1 |
