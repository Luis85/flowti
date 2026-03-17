# UC-29: Backpressure / Queue Limits

**Feature:** [Reliability & Performance](../features/feature-06-reliability.md)

> As a user with a very active folder, I do not want the plugin to consume unbounded memory.

## Scenario 29.1: Queue at capacity drops new jobs ✅

```gherkin
Given the pending queue has 1000 jobs (MAX_PENDING_JOBS)
When a new file event arrives
Then the new event should be dropped
  And the dropped job count should increment
  And a warning should be logged
  And the skipped count should increment
```

## Scenario 29.2: Existing job in queue is updated (not duplicated) ✅

```gherkin
Given "file.md" is already in the pending queue
When "file.md" is modified again before the debounce fires
Then the existing timer should be reset
  And the queue size should remain the same
```
