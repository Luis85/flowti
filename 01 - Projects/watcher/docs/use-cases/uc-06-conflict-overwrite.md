# UC-06: Conflict Resolution — Overwrite

**Feature:** [Conflict Resolution](../features/feature-02-conflict-resolution.md)

> As a user who always wants the latest written version, I want conflicts to be resolved by overwriting the target.

## Scenario 6.1: Source overwrites vault file ✅

```gherkin
Given a mapping with conflictResolution "overwrite"
  And "file.md" exists in both source and vault with different content
When the source file triggers a sync
Then the vault file should be overwritten with source content
```

## Scenario 6.2: Vault overwrites source file (reverse) ⏭️

*Requires vault.adapter.stat + fsp.stat mocking*

```gherkin
Given a bidirectional mapping with conflictResolution "overwrite"
  And "file.md" exists in both vault and source with different content
When the vault file triggers a reverse sync
Then the source file should be overwritten with vault content
```
