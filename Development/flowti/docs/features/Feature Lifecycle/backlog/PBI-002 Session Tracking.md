---
type: ProductBacklogItem
feature: "[[Feature Lifecycle PRD]]"
priority: high
stage: planned
userStories:
  - "[[As User, I want to start a session on a PRD so that my progress is tracked automatically]]"
useCases:
  - "[[Start a Feature Session]]"
  - "[[Review Session History]]"
---

## User Story

As a knowledge worker, I want to start a focused session on a specific PRD so that every file I create or modify during the session is automatically linked to that feature, building a documented trail of progress without manual bookkeeping.

## Functional Requirements

- [ ] "Start Session" button on feature detail panel creates a session record: `{ featureName, startTime, stageAtStart }`
- [ ] While session is active, listen to `file.created` and `file.modified` events — log files that are under the feature's folder or reference the feature in frontmatter
- [ ] Active session indicator: pulsing dot on the feature in the master panel; session timer shown in detail panel
- [ ] "End Session" button finalizes the record with: `endTime`, `duration`, `filesCreated[]`, `filesModified[]`, optional `notes`
- [ ] Session records persisted under storage key `featureLifecycle`
- [ ] Only one active session at a time (starting a new session ends the current one)
- [ ] Active session survives plugin reload (restored from storage on `load()`)
- [ ] Session log displayed in feature detail panel as chronological list with: date, duration, files changed count, stage at start/end
- [ ] Clicking a session expands to show the full file list

## Acceptance Criteria

- [ ] Starting a session shows active indicator on the feature
- [ ] Creating a file in the feature's backlog folder during a session logs it automatically
- [ ] Ending a session persists the record and clears the active indicator
- [ ] Session history shows all past sessions for a feature with duration and file counts
- [ ] Active session survives plugin reload
- [ ] `npm run build` passes
