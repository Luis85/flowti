# UC-12: Deletion Handling — Trash

**Feature:** [Deletion & Move Handling](../features/feature-03-deletion-move.md)

> As a user, I want deletions to be synced by moving files to trash.

## Scenario 12.1: Deleted source file is trashed in vault ⏭️

*Requires MappingWatcher + chokidar*

```gherkin
Given a mapping with deletionHandling "trash"
When "file.md" is deleted from the source folder
Then "vault/imported/file.md" should be moved to Obsidian trash (via vault.trash)
```

## Scenario 12.2: Deleted vault file is trashed in source ✅

```gherkin
Given a bidirectional mapping with deletionHandling "trash"
When "file.md" is deleted from the vault target folder
Then the corresponding source file should be moved to the .sync-trash/ directory
  And a timestamp suffix should be appended if a file with the same name already exists in .sync-trash/
```
