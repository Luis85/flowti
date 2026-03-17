# UC-44: SyncState Auto-Save

**Feature:** [Persistence & Error Recovery](../features/feature-10-persistence.md)

> As a user, I want sync state to be saved automatically to prevent data loss if Obsidian crashes.

## Scenario 44.1: Changes trigger debounced auto-save ✅

*(tests cancelPendingSave clears timer)*

```gherkin
Given a file has been synced and the state is marked dirty
When 5 seconds pass (AUTO_SAVE_DELAY_MS)
Then the sync state should be automatically saved to disk
```

## Scenario 44.2: Rapid changes are consolidated ⏭️

*Requires filesystem mocking to count disk writes*

```gherkin
Given 50 files are synced within 3 seconds
Then only 1 auto-save should occur (after the debounce settles)
  And not 50 separate disk writes
```
