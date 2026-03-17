# UC-03: Bidirectional Sync

**Feature:** [Core Synchronization](../features/feature-01-core-sync.md)

> As a user, I want changes in either direction to be synced so that I can edit files from both Obsidian and external editors.

## Scenario 3.1: Source change syncs to vault ⏭️

*Requires MappingWatcher + chokidar*

```gherkin
Given a mapping with syncDirection "bidirectional"
When a file is modified in the source folder
Then the change should appear in the vault target folder
```

## Scenario 3.2: Vault change syncs to source ✅

```gherkin
Given a mapping with syncDirection "bidirectional"
When a file is modified in the vault target folder
Then the change should appear in the external source folder
```

## Scenario 3.3: Changes do not ping-pong infinitely ✅

```gherkin
Given a mapping with syncDirection "bidirectional"
When a file is modified in the source folder
  And the change is synced to the vault
Then the vault-side event should NOT trigger a reverse sync back to source
  And the loop detector should block the reverse event within its 5-second cooldown
```
