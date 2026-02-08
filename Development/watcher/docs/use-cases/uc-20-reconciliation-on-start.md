# UC-20: Reconciliation on Start

**Feature:** [Reconciliation](../features/feature-05-reconciliation.md)

> As a user, I want the plugin to catch up on any changes I missed while Obsidian was closed.

## Scenario 20.1: New source files are synced on startup ✅

```gherkin
Given syncOnStart is enabled
  And mapping.reconcileOnStart is true
  And new files were added to the source folder while Obsidian was closed
When the plugin loads
Then all new source files should be synced to the vault
```

## Scenario 20.2: Reconcile is skipped for disabled mappings ✅

```gherkin
Given syncOnStart is enabled
  And a mapping is disabled (enabled: false)
When the plugin loads
Then that mapping should NOT be reconciled
```

## Scenario 20.3: Reconcile is skipped when reconcileOnStart is false ✅

```gherkin
Given syncOnStart is enabled
  And a mapping has reconcileOnStart: false
When the plugin loads
Then that mapping should NOT be reconciled
```

## Scenario 20.4: Reconcile blocks watchers during execution ⏭️

*Requires WatcherManager + AsyncMutex integration*

```gherkin
Given reconciliation is in progress for a mapping
When a file change event occurs in that mapping's source folder
Then the event should be queued (operation lock prevents concurrent processing)
  And the watcher should resume processing after reconciliation completes
```
