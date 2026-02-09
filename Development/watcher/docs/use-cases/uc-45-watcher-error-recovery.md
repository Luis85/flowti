# UC-45: Watcher Error Recovery

**Feature:** [Persistence & Error Recovery](../features/feature-10-persistence.md)

> As a user, I want the plugin to handle filesystem watcher errors gracefully without crashing.

## Scenario 45.1: Chokidar error is logged and counted ⏭️

*Requires MappingWatcher with chokidar error emission*

```gherkin
Given a MappingWatcher is running
When chokidar emits an error event (e.g., EACCES on a subdirectory)
Then the error should be logged
  And the error count for that mapping should increment
  And an error notice should be shown to the user
  And the watcher should continue running (not crash)
```
