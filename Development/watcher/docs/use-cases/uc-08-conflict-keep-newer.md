# UC-08: Conflict Resolution — Keep Newer

**Feature:** [Conflict Resolution](../features/feature-02-conflict-resolution.md)

> As a user, I want the most recently modified version to win.

## Scenario 8.1: Source is newer — overwrites vault ✅

```gherkin
Given a mapping with conflictResolution "keepNewer"
  And source "file.md" has mtime 2024-01-15 14:00:00
  And vault "file.md" has mtime 2024-01-15 12:00:00
When the source file triggers a sync
Then the vault file should be overwritten (source is newer)
```

## Scenario 8.2: Vault is newer — source is skipped ✅

```gherkin
Given a mapping with conflictResolution "keepNewer"
  And source "file.md" has mtime 2024-01-15 10:00:00
  And vault "file.md" has mtime 2024-01-15 14:00:00
When the source file triggers a sync
Then the vault file should NOT be modified (target is newer)
  And the file should be counted as skipped
```

## Scenario 8.3: Target does not exist — always syncs ✅

```gherkin
Given a mapping with conflictResolution "keepNewer"
  And "file.md" does NOT exist in the vault
When the source file triggers a sync
Then the vault file should be created
```
