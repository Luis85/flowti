# UC-09: Conflict Resolution — Rename

**Feature:** [Conflict Resolution](../features/feature-02-conflict-resolution.md)

> As a user, I want both versions preserved when a conflict occurs.

## Scenario 9.1: Conflict generates timestamped copy ✅

```gherkin
Given a mapping with conflictResolution "rename"
  And "file.md" already exists in the vault
When the source file triggers a sync
Then a new file "file (conflict 2024-01-15 14-30-00).md" should be created
  And the original vault file should remain untouched
```

## Scenario 9.2: Multiple rename collisions increment counter inside parentheses ✅

```gherkin
Given a mapping with conflictResolution "rename"
  And "file.md" and "file (conflict 2024-01-15 14-30-00).md" both exist
When the source file triggers a sync
Then a new file "file (conflict 2024-01-15 14-30-00 2).md" should be created
  And the counter increments inside the parentheses up to 1000 attempts
```
