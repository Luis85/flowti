# UC-11: Deletion Handling — Ignore

**Feature:** [Deletion & Move Handling](../features/feature-03-deletion-move.md)

> As a user, I do not want deletions to propagate.

## Scenario 11.1: Deleted source file remains in vault ⏭️

*Requires MappingWatcher + chokidar*

```gherkin
Given a mapping with deletionHandling "ignore"
When "file.md" is deleted from the source folder
Then "vault/imported/file.md" should still exist in the vault
```

## Scenario 11.2: Deleted vault file remains in source ✅

```gherkin
Given a bidirectional mapping with deletionHandling "ignore"
When "file.md" is deleted from the vault target folder
Then "/external/file.md" should still exist in the source
```
