# UC-01: Source-Only Sync (external → vault)

**Feature:** [Core Synchronization](../features/feature-01-core-sync.md)

> As a user, I want files from an external folder to be automatically imported into my vault so that I can work with them in Obsidian.

## Scenario 1.1: New file appears in source folder ⏭️

*Requires MappingWatcher + chokidar*

```gherkin
Given a mapping with syncDirection "source-only"
  And the source folder is "/external/notes"
  And the target folder is "vault/imported"
When a new file "report.md" is created in "/external/notes"
Then "vault/imported/report.md" should be created in the vault
  And the status bar should show 1 file processed
```

## Scenario 1.2: Existing file is modified in source folder ⏭️

*Requires MappingWatcher + chokidar*

```gherkin
Given a mapping with syncDirection "source-only"
  And "report.md" exists in both source and vault
When "report.md" is modified in the source folder
Then "vault/imported/report.md" should be updated with the new content
```

## Scenario 1.3: File in subfolder is synced ⏭️

*Requires MappingWatcher + chokidar*

```gherkin
Given a mapping with syncDirection "source-only" and watchSubfolders enabled
When a file "sub/deep/file.md" is created in the source folder
Then "vault/imported/sub/deep/file.md" should be created
  And all intermediate folders should be created automatically
```

## Scenario 1.4: Vault changes are NOT pushed back to source ✅

```gherkin
Given a mapping with syncDirection "source-only"
When a file is modified in the vault target folder
Then no changes should be written to the external source folder
  And the VaultWatcher should NOT be started for this mapping
```
