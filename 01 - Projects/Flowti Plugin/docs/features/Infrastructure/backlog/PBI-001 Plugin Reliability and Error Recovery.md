---
type: ProductBacklogItem
feature: "[[Infrastructure PRD]]"
priority: high
stage: in-progress
userStories: []
useCases:
  - "[[Recover from a Render Error]]"
  - "[[Troubleshoot a Failed Operation]]"
---

## User Story

As a vault maintainer, I want the plugin to handle errors gracefully so that a single bad file or unexpected state never leaves me with a blank view and no way to recover.

## Functional Requirements

- [x] ErrorService catches all errors and classifies them by category and severity
- [x] Error toasts notify the user when an operation fails (via Obsidian Notice API)
- [x] `errorService.wrap()` allows services to execute operations with automatic error handling and fallback values
- [x] Errors emit `error.occurred` events with structured payload (code, message, category, severity, context)
- [x] Handler errors in the EventBus are caught and logged — one failing handler never breaks other handlers
- [ ] Error boundaries wrap view render paths — render failures show an error banner with retry button (TD-46)
- [ ] Storage corruption produces a user-visible notification instead of silently falling back to defaults (TD-56)

## Acceptance Criteria

- [x] A failing event handler does not crash the EventBus or prevent other handlers from executing
- [x] When a file operation fails, the user sees a toast notification with the error message
- [x] Error events carry category, severity, context, and timestamp for diagnostic purposes
- [ ] When a view render method throws, the user sees an error banner with "Retry" button instead of a blank panel
- [ ] When storage data is corrupted, the user sees a warning notification explaining that defaults were restored
- [x] `npm run build` passes
