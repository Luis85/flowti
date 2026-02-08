# UC-13: Move Detection

**Feature:** [Deletion & Move Handling](../features/feature-03-deletion-move.md)

> As a user, I want file renames/moves to be detected as a single operation rather than a delete followed by an add.

## Scenario 13.1: File renamed in source is detected as move ⏭️

*Requires MappingWatcher + chokidar*

```gherkin
Given a mapping with deletionHandling "trash" and detectMoves enabled
  And "old-name.md" (size 1024 bytes) was previously synced
When "old-name.md" is deleted
  And "new-name.md" (size 1024 bytes, same extension) is created within 2 seconds
Then a single "move" operation should be performed
  And "vault/imported/old-name.md" should be renamed to "vault/imported/new-name.md"
```

## Scenario 13.2: Files with same size but different extension are NOT matched ⏭️

*Requires MappingWatcher + chokidar*

```gherkin
Given a mapping with detectMoves enabled
  And "report.md" (size 500 bytes) is deleted
  And "image.png" (size 500 bytes) is created within 2 seconds
Then they should NOT be matched as a move
  And separate delete and add operations should be performed
```

## Scenario 13.3: Move window expires ⏭️

*Requires MappingWatcher + chokidar*

```gherkin
Given a mapping with detectMoves enabled
  And "file.md" is deleted
When more than 2 seconds pass without a matching add
Then the delete should be processed as a regular deletion
```

## Scenario 13.4: Move detection without size info falls back to delete ⏭️

*Requires MappingWatcher + chokidar*

```gherkin
Given a mapping with detectMoves enabled
  And no prior sync state exists for "file.md" (size = 0)
When "file.md" is deleted
Then the delete should be processed immediately via normal debounce (no buffering for move match)
```

## Scenario 13.5: Vault-side rename detected as move ✅

```gherkin
Given a bidirectional mapping with deletionHandling "trash"
When "vault/imported/old.md" is renamed to "vault/imported/new.md" within the vault
Then the source file should be renamed from "old.md" to "new.md" via syncMoveReverse
```

## Scenario 13.6: File moved out of vault target folder ✅

```gherkin
Given a bidirectional mapping with deletionHandling "trash"
When "vault/imported/file.md" is moved to "vault/other/file.md"
Then the original source file should be deleted (treated as removal from scope)
```

## Scenario 13.7: File moved into vault target folder ✅

```gherkin
Given a bidirectional mapping
When "vault/other/file.md" is moved to "vault/imported/file.md"
Then the file should be synced to the source folder (treated as new addition)
```
