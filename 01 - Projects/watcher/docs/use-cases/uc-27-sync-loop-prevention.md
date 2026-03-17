# UC-27: Sync Loop Prevention

**Feature:** [Reliability & Performance](../features/feature-06-reliability.md)

> As a user with bidirectional sync, I expect that a single file edit does not bounce back and forth endlessly.

## Scenario 27.1: Forward sync blocks immediate reverse ✅

```gherkin
Given a bidirectional mapping
When a source file change is synced to the vault
Then the resulting vault event should be blocked by the loop detector
  And no reverse sync should occur for that file within 5 seconds (COOLDOWN_MS)
```

## Scenario 27.2: Reverse sync blocks immediate forward

*(covered by 27.1 — symmetric behavior)*

```gherkin
Given a bidirectional mapping
When a vault file change is synced to the source
Then the resulting source event should be blocked by the loop detector
```

## Scenario 27.3: After cooldown expires, sync resumes ✅

```gherkin
Given a file was synced 6 seconds ago
When the same file is modified again
Then the sync should proceed normally (cooldown expired)
```

## Scenario 27.4: Path normalization ensures consistent matching ✅

```gherkin
Given forward sync records "C:\Users\Name\File.MD"
When reverse sync checks "c:/users/name/file.md"
Then the loop detector should match (case-insensitive, separator-normalized via toLowerCase + replace)
```

## Scenario 27.5: Stale entries are cleaned up periodically ✅

```gherkin
Given loop detector entries older than 10 seconds exist (2x COOLDOWN_MS)
When the cleanup interval fires (every 60 seconds)
Then those stale entries should be removed from memory
```
