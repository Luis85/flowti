# UC-02: Vault-Only Sync (vault → external)

**Feature:** [Core Synchronization](../features/feature-01-core-sync.md)

> As a user, I want files in a vault folder to be automatically exported to an external folder so that I can share them with other tools.

## Scenario 2.1: File modified in vault is exported ✅

```gherkin
Given a mapping with syncDirection "vault-only"
  And the target folder is "vault/export"
  And the source folder is "/external/output"
When "notes.md" is modified inside "vault/export"
Then "/external/output/notes.md" should be updated
```

## Scenario 2.2: New file created in vault is exported ✅

```gherkin
Given a mapping with syncDirection "vault-only"
When a new file "new.md" is created inside the vault target folder
Then the file should be written to the external source folder
```

## Scenario 2.3: External changes are NOT pulled into vault ⏭️

*Requires WatcherManager integration*

```gherkin
Given a mapping with syncDirection "vault-only"
When a file is created in the external source folder
Then no changes should appear in the vault target folder
  And the MappingWatcher should NOT be started for this mapping
```
