# UC-07: Conflict Resolution — Skip

**Feature:** [Conflict Resolution](../features/feature-02-conflict-resolution.md)

> As a user, I never want existing files to be overwritten.

## Scenario 7.1: Existing vault file is not overwritten ✅

```gherkin
Given a mapping with conflictResolution "skip"
  And "file.md" already exists in the vault target folder
When the source file triggers a sync
Then the vault file should NOT be modified
  And the file should be counted as skipped
```
