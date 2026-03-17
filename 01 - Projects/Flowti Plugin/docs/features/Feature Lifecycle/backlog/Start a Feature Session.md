---
type: UseCase
domain: Flowti
stage: planned
description: Start a focused session on a PRD to automatically track what files are created and modified, building a documented trail of progress.
view: "[[Event Catalog View]]"
feature: "[[Feature Lifecycle PRD]]"
testplanRef: UC-103
tags:
  - use-case
  - feature-lifecycle
  - session
---

# Start a Feature Session

## Summary

A user sits down to work on a specific feature. They start a session in the Features tab, then go about their work — creating documentation files, updating the PRD, adding backlog items. When they're done, they end the session and see a summary of everything that changed, automatically linked to the feature.

## Preconditions

- The Features tab is open in the Event Catalog.
- A feature is selected in the detail panel.
- No other session is currently active (or the user is willing to end the current one).

## Steps

1. **Select a feature** — The user clicks "Data Exchange Hub" in the Features tab.
2. **Start session** — The user clicks "Start Session" in the detail panel. The system records the start time and the feature's current stage. A pulsing session indicator appears on the feature in the master panel.
3. **Work on the feature** — The user works normally in Obsidian:
   - Creates a new use case doc in the feature's backlog folder
   - Updates the PRD with new acceptance criteria
   - Modifies a related domain doc
4. **Automatic tracking** — The system listens to `file.created` and `file.modified` events. Files under the feature's folder (`docs/features/Data Exchange Hub/`) are automatically logged. Other files that reference the feature in frontmatter are also captured.
5. **End session** — After their work session, the user clicks "End Session." They can optionally add a note: "Added export conflict resolution use case and updated acceptance criteria."
6. **Session summary** — The detail panel shows the session record: start/end time, duration (47 minutes), 3 files created, 2 files modified, the note, and whether the stage changed during the session.
7. **Persisted** — The session record is saved to storage. It appears in the session history next time the user views this feature.

## Outcome

The user has a documented record of their work session without any manual bookkeeping. Over time, the session log becomes a narrative of how the feature evolved — from initial idea to production.

## Variations

- **Session across plugin reloads**: If the user reloads Obsidian while a session is active, the session is restored from storage. No data is lost.
- **Work on unrelated files**: Files not under the feature's folder and not referencing the feature in frontmatter are ignored. The session only tracks relevant work.
- **Forget to end session**: Sessions have no automatic timeout. The user can end it the next time they open the Features tab. A gentle reminder shows: "Active session running for 3 hours."
- **Stage change during session**: If the user advances the feature's stage during the session, the session record captures `stageAtStart` and `stageAtEnd`.

## Related

- Feature: [[Feature Lifecycle PRD]]
- PBI: [[PBI-002 Session Tracking]]
