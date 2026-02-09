# UC-37: Polling Mode

**Feature:** [Settings & Configuration](../features/feature-08-settings.md)

> As a user syncing from a NAS or network drive, I want an alternative to inotify-based file watching.

## Scenario 37.1: Polling detects file changes ⏭️

*Requires MappingWatcher + chokidar polling mode*

```gherkin
Given a mapping with usePolling enabled and pollingInterval 500ms
When a file is created in the source folder
Then the change should be detected within one polling interval
  And the file should be synced to the vault
```

## Scenario 37.2: Polling interval is respected ⏭️

*Requires MappingWatcher chokidar config verification*

```gherkin
Given pollingInterval is set to 1000ms
When the watcher is started
Then chokidar should be configured with usePolling: true and interval: 1000
```
