# UC-26: Retry on Transient Errors

**Feature:** [Reliability & Performance](../features/feature-06-reliability.md)

> As a user, I want the plugin to automatically retry when it encounters temporary filesystem errors.

## Scenario 26.1: File locked by another process is retried ✅

*(also tests EAGAIN, EMFILE, ENFILE, ENOTEMPTY + message patterns)*

```gherkin
Given a file read fails with error code EBUSY
When the retry logic kicks in
Then the operation should be retried up to 3 times (maxRetries default)
  And the delay between retries should increase exponentially (baseDelayMs=100, capped at maxDelayMs=2000)
  And delays should include ±25% jitter to prevent thundering herd
```

## Scenario 26.2: File-not-found is NOT retried ✅

*(also tests EACCES, EEXIST)*

```gherkin
Given a file read fails with error code ENOENT
When the error is evaluated
Then no retry should be attempted (permanent error)
  And EACCES, EEXIST are also treated as permanent
```

## Scenario 26.3: Retry succeeds on second attempt ✅

*(also tests maxRetries exhausted + onRetry callback)*

```gherkin
Given a file read fails once with EBUSY
  And succeeds on the second attempt
Then the file should be synced successfully
  And a debug log should record the retry
```
