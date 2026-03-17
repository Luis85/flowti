---
type: ProductBacklogItem
feature: "[[Infrastructure PRD]]"
priority: medium
stage: done
userStories: []
useCases:
  - "[[Enable Debug Mode for Troubleshooting]]"
---

## User Story

As a vault maintainer troubleshooting unexpected behavior, I want to toggle debug mode and see structured event traces in the console so that I can understand what happened, when, and why — without reading source code.

## Functional Requirements

- [x] Four log levels: debug, info, warn, error
- [x] Debug logs only emitted when debug mode is enabled (controlled by Settings toggle)
- [x] Logger emits `log.entry` and `log.error` events for downstream consumers
- [x] Context prefixes identify the log source (e.g., `[UserService] User created`)
- [x] Event tracing: wildcard listener logs all non-log events to console when debug mode is active
- [x] Event trace skips `log.*` events to prevent infinite recursion
- [x] Logger integrates with `settings.changed` to toggle debug mode dynamically

## Acceptance Criteria

- [x] Toggling "Debug Mode" in Settings immediately activates event tracing in the browser console
- [x] Each traced event shows type, timestamp, and payload summary
- [x] Debug-level logs are suppressed when debug mode is off
- [x] No infinite recursion when tracing is active (log events are skipped)
- [x] `npm run build` passes
