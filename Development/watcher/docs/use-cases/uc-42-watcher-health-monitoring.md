# UC-42: Watcher Health Monitoring

**Feature:** [User Interface](../features/feature-09-ui.md)

> As a user, I want to identify at a glance which watchers are healthy, idle, or experiencing issues.

## Scenario 42.1: Healthy watcher ⏭️

*Requires MappingWatcher + VaultWatcher integration*

```gherkin
Given a watcher is running
  And it received a file event within the last 5 minutes
Then its health should be "healthy"
```

## Scenario 42.2: Idle watcher ⏭️

*Requires MappingWatcher + VaultWatcher integration*

```gherkin
Given a watcher is running
  And it has NOT received any file event for more than 5 minutes (IDLE_THRESHOLD_MS)
Then its health should be "idle"
```

## Scenario 42.3: Warning state ⏭️

*Requires MappingWatcher + VaultWatcher integration*

```gherkin
Given a watcher is running
  And it has dropped jobs OR its queue is over 80% full
Then its health should be "warning"
```

## Scenario 42.4: Error state ⏭️

*Requires MappingWatcher + VaultWatcher integration*

```gherkin
Given a watcher failed to start
Then its health should be "error"
```
