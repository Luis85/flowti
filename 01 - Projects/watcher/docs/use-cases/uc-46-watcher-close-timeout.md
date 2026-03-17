# UC-46: Watcher Close Timeout

**Feature:** [Persistence & Error Recovery](../features/feature-10-persistence.md)

> As a user, I want the plugin to handle unresponsive filesystems when stopping watchers.

## Scenario 46.1: Slow close is timed out ⏭️

*Requires MappingWatcher.stop() with hanging chokidar.close()*

```gherkin
Given a MappingWatcher is stopping
  And the underlying chokidar.close() hangs (unresponsive NAS)
When 5 seconds pass (CLOSE_TIMEOUT_MS)
Then the stop operation should complete with a timeout warning
  And Obsidian should not freeze
```
