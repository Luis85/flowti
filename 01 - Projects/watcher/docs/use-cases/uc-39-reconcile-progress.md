# UC-39: Reconcile Progress Reporting

**Feature:** [User Interface](../features/feature-09-ui.md)

> As a user, I want to see real-time progress during reconciliation.

## Scenario 39.1: Progress shown during reconciliation ⏭️

*Requires StatusBarService + DOM*

```gherkin
Given reconciliation is running for mapping 1 of 3
  And 120 of 860 files have been scanned
Then the status bar should display reconcile progress with mapping index, file counts, and stats
  And progress updates should be throttled by progressThrottleMs (default 250ms)
```

## Scenario 39.2: Progress clears after reconciliation completes ⏭️

*Requires StatusBarService + DOM*

```gherkin
Given reconciliation has completed
Then the status bar should return to normal mode display
```

## Scenario 39.3: Per-mapping done notice ⏭️

*Requires NoticeService + ReconcileService integration*

```gherkin
Given notifyOnMappingDone is enabled (default)
When reconciliation finishes processing a mapping
Then a notice should be shown with the mapping's sync stats
```
