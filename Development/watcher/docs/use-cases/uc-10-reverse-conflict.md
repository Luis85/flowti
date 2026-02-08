# UC-10: Reverse Conflict Resolution

**Feature:** [Conflict Resolution](../features/feature-02-conflict-resolution.md)

> As a user, I want different conflict behavior for vault→source sync.

## Scenario 10.1: Reverse uses its own strategy ✅

```gherkin
Given a bidirectional mapping
  And conflictResolution is "overwrite"
  And reverseConflictResolution is "skip"
When the vault file triggers a reverse sync
  And the source file already exists
Then the source file should NOT be overwritten (reverse uses "skip")
```

## Scenario 10.2: Reverse falls back to forward strategy if unset ✅

```gherkin
Given a bidirectional mapping
  And conflictResolution is "keepNewer"
  And reverseConflictResolution is not set
When the vault file triggers a reverse sync
Then "keepNewer" should be used for the reverse direction
```
