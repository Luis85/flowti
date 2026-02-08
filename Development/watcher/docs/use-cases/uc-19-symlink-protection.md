# UC-19: Symlink Protection

**Feature:** [File Filtering](../features/feature-04-file-filtering.md)

> As a user, I expect symlinks to be safely skipped to prevent loops and unexpected behavior.

## Scenario 19.1: Symlinked file is skipped during sync ⏭️

*Requires real filesystem symlink*

```gherkin
Given a file "link.md" in the source folder is a symbolic link
When the watcher detects a change to "link.md"
Then the file should be skipped
  And a debug log should note it was a symlink
  And the skipped count should increment
```

## Scenario 19.2: Symlinked directory is skipped during walk ⏭️

*Requires real filesystem symlink*

```gherkin
Given a directory "linked-dir" in the source is a symbolic link
When a new directory event fires for "linked-dir"
Then "linked-dir" and its contents should be skipped entirely
```

## Scenario 19.3: Symlink check is skipped for deleted files ✅

```gherkin
Given a file "removed.md" has been deleted from the source
When the delete event is processed
Then no symlink check should occur (the file no longer exists on disk)
```
