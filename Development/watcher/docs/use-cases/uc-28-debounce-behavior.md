# UC-28: Debounce Behavior

**Feature:** [Reliability & Performance](../features/feature-06-reliability.md)

> As a user, I want rapid file saves to be consolidated into a single sync operation.

## Scenario 28.1: Multiple rapid edits produce one sync ✅

```gherkin
Given a mapping with debounceDelay 800ms
When "file.md" is saved 5 times within 500ms
Then only 1 sync operation should be performed (after the debounce settles)
```

## Scenario 28.2: Reverse sync uses minimum 1500ms debounce ✅

```gherkin
Given a bidirectional mapping with debounceDelay 200ms
When a vault file is modified
Then the reverse sync should wait at least 1500ms before processing (MIN_REVERSE_DEBOUNCE_MS)
```
