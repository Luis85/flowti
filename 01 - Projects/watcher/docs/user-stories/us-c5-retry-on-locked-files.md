---
parent: "[[Development/watcher/docs/personas/Collaborator|Collaborator]]"
domain: Folder Watcher
id: US-C5
title: Retry on locked files
persona: Collaborator (Chris)
jtbd: Retry on locked files
journey: "[[Development/watcher/docs/journeys/journey-4-share-and-collect-feedback|Journey 4]]"
use-cases:
  - UC-26
---
# US-C5: Retry on locked files

> JTBD: Retry on locked files | Persona: [The Collaborator](Development/watcher/docs/personas/Collaborator.md) | Journey: [Journey 4](../journeys/journey-4-share-and-collect-feedback.md)

**As a** collaborator,
**I want** the plugin to retry automatically when a file is locked (EBUSY),
**so that** I don't have to re-trigger the sync manually.

## Acceptance Criteria

- [ ] `isRetryableError()` returns `true` for EBUSY, EAGAIN, EMFILE, ENFILE
- [ ] `withRetry()` retries up to `maxRetries` (default 3) with exponential backoff
- [ ] Non-retryable errors (ENOENT, EACCES) are thrown immediately
