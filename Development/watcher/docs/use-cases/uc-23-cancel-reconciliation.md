# UC-23: Cancel Reconciliation

**Feature:** [Reconciliation](../features/feature-05-reconciliation.md)

> As a user, I want to be able to stop a running reconciliation if it takes too long or I made a mistake.

## Scenario 23.1: User cancels from dashboard ✅

```gherkin
Given reconciliation is in progress
When the user clicks Cancel in the dashboard
Then the current file should finish processing (cooperative cancellation)
  And no further files should be processed
  And the reconcile phase should change to "cancelled"
```

## Scenario 23.2: Stats reflect partial completion

*(tested implicitly via 23.1)*

```gherkin
Given reconciliation was cancelled after processing 50 of 200 files
Then the stats should show 50 processed
  And the remaining 150 files should not be counted as skipped or errors
```
