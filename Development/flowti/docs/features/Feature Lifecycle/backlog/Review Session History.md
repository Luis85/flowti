---
type: UseCase
domain: Flowti
stage: draft
description: Review the chronological session history for a feature to understand how it evolved over time.
view: "[[Event Catalog View]]"
feature: "[[Feature Lifecycle PRD]]"
testplanRef: UC-106
tags:
  - use-case
  - feature-lifecycle
  - session
---

# Review Session History

## Summary

A user wants to understand the trajectory of a feature — when it was worked on, what changed, how it progressed through stages. They open the session log in the feature detail panel to see a chronological narrative of the feature's evolution.

## Preconditions

- The Features tab is open in the Event Catalog.
- A feature is selected with at least one past session recorded.

## Steps

1. **Select a feature** — The user clicks a feature in the pipeline view.
2. **Scroll to Session Log** — The detail panel shows the session log section below gate checks and scores.
3. **Review sessions** — Each session entry shows:
   - Date and duration (e.g., "Feb 12, 2026 — 1h 23m")
   - Stage at start and end (e.g., "draft → draft" or "draft → approved")
   - Files changed count (e.g., "Created 2 files, modified 3")
   - Note (if provided): "Filled out functional requirements and event impact"
4. **Expand a session** — Clicking a session expands it to show the full file list:
   - `+ Created: backlog/Import CSV as Notes.md`
   - `+ Created: backlog/Handle Incremental Imports.md`
   - `~ Modified: Data Exchange Hub PRD.md`
   - `~ Modified: backlog/PBI-001 CSV Import Pipeline.md`
5. **See the trajectory** — Reading sessions top to bottom, the user sees how the feature evolved:
   - Session 1 (Jan 28): Created PRD with problem statement — idea stage
   - Session 2 (Jan 30): Filled scope and requirements — still draft
   - Session 3 (Feb 5): Scored FRI (23), passed Design Gate — advanced to approved
   - Session 4 (Feb 8): Created first PBI and 4 use cases — started implementation
   - Session 5 (Feb 12): Completed implementation, ran Three Amigos — advanced to done

## Outcome

The session log tells the story of the feature's journey. The user can see the pace of work, the quality of each session (by files changed), and the stage progression. This is automatic documentation — the knowledge was built incrementally without extra effort.

## Variations

- **No sessions yet**: The log shows an empty state: "No sessions recorded. Start a session to begin tracking progress."
- **Session without file changes**: The user started and ended a session but only read files. The session shows "0 files changed" with just the note.
- **Multiple sessions same day**: Sessions are listed chronologically. Each is a distinct record.

## Related

- Feature: [[Feature Lifecycle PRD]]
- PBI: [[PBI-002 Session Tracking]]
