# UC-04: Subfolder Watching

**Feature:** [Core Synchronization](../features/feature-01-core-sync.md)

> As a user, I want the option to watch only the top-level folder or include all subfolders.

## Scenario 4.1: Subfolders included when enabled ⏭️

*Requires MappingWatcher + chokidar*

```gherkin
Given a mapping with watchSubfolders: true
When a file "sub/deep/file.md" is created in the source
Then it should be synced to "vault/imported/sub/deep/file.md"
```

## Scenario 4.2: Subfolders excluded when disabled ⏭️

*Requires MappingWatcher + chokidar depth config*

```gherkin
Given a mapping with watchSubfolders: false
When a file "subfolder/file.md" is created in the source
Then it should NOT be synced (only root-level files are watched)
  And chokidar should be configured with depth: 0
```
