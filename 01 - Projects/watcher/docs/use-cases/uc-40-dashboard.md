# UC-40: Dashboard

**Feature:** [User Interface](../features/feature-09-ui.md)

> As a user, I want a detailed view for managing watchers, viewing logs, and controlling reconciliation.

## Scenario 40.1: Overview tab shows global stats ⏭️

*Requires Obsidian Modal + DOM*

```gherkin
Given the dashboard is open on the Overview tab
Then it should display: active watchers, watched files, processed/skipped/errors
  And controls: Start/Stop All, Reconcile All, Cancel
  And recent activity log (last 5 entries)
```

## Scenario 40.2: Watchers tab shows per-mapping status ⏭️

*Requires Obsidian Modal + DOM*

```gherkin
Given the dashboard is open on the Watchers tab
Then each mapping should show: description, source/target folders, health indicator
  And per-watcher controls: Start/Stop, Reconcile, Edit
  And queue stats: pending files, pending dirs, dropped jobs
```

## Scenario 40.3: Logs tab shows filtered log entries ⏭️

*Requires Obsidian Modal + DOM*

```gherkin
Given the dashboard is open on the Logs tab
Then it should display the last 100 log entries
  And provide level filters (debug, info, warn, error) and a search input
  And a Clear All button
```
