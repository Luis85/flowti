# UC-34: Source Folder Validation

**Feature:** [Safety & Validation](../features/feature-07-safety.md)

> As a user, I want the plugin to notify me when a configured source folder does not exist rather than silently failing.

## Scenario 34.1: Missing source folder prevents watcher start ⏭️

*Requires MappingWatcher with fs.existsSync mocking*

```gherkin
Given a mapping with sourceFolder "/nonexistent/path"
When the watcher tries to start
Then the watcher should NOT start
  And an error notice should be shown: 'Mapping "...": source folder missing'
  And the error count should increment
```

## Scenario 34.2: Empty source folder prevents watcher start ⏭️

*Requires MappingWatcher integration*

```gherkin
Given a mapping with sourceFolder ""
When the watcher tries to start
Then the watcher should NOT start (same as missing)
```
