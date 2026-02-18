---
type: UseCase
domain: Flowti
stage: planned
description: Validate gate criteria for a feature's current stage and advance it to the next stage when all checks pass.
view: "[[Event Catalog View]]"
feature: "[[Feature Lifecycle PRD]]"
testplanRef: UC-102
tags:
  - use-case
  - feature-lifecycle
  - gate
---

# Advance a Feature to the Next Stage

## Summary

A user has been working on a feature (e.g., filling out the PRD, creating backlog items, writing tests). They believe the feature is ready to move from its current stage to the next. They use the "Advance" action to validate the quality gate and transition the PRD.

## Preconditions

- The Features tab is open in the Event Catalog.
- A feature is selected in the detail panel.
- The feature is not yet at stage `done`.

## Steps

1. **Select the feature** — The user clicks the feature in the master panel. The detail panel shows the gate checklist for the current stage.
2. **Review gate checks** — The user reviews the automated gate checks. For example, at stage `draft`, the Design Gate checks: scope section filled, functional requirements listed (3+), event impact defined, FRI score >= 11.
3. **All checks pass** — The gate readiness indicator shows green: "Ready to advance to approved."
4. **Click Advance** — The user clicks the "Advance to approved" button.
5. **System validates** — The system runs all gate checks one more time (in case the state changed). All pass.
6. **Stage updated** — The PRD's `stage` frontmatter is updated from `draft` to `approved`. The `feature.stage.changed` event is emitted.
7. **View updates** — The feature moves from the "draft" group to the "approved" group in the master panel. The detail panel now shows the next gate checklist (Readiness Gate).

## Outcome

The feature has formally advanced to the next stage. The transition is documented via the `feature.stage.changed` event and reflected in all views. The user now sees the next set of gate criteria to work toward.

## Variations

- **Gate checks fail**: Some checks don't pass. The "Advance" button is disabled or shows "2 items remaining." Clicking it shows a dialog listing the blocking checks.
- **Override advance**: For advisory gates, the user can choose "Advance anyway" with a confirmation dialog. The stage is updated but the gate is recorded as `conditional_pass`.
- **Skip stages**: The system does not enforce sequential progression. A user could manually edit frontmatter to jump stages. This is intentional — the gates are guides, not hard blocks.
- **Last stage**: Advancing from `review` to `done` triggers the Release Gate and updates `maturity` to reflect the feature's actual maturity level.

## Related

- Feature: [[Feature Lifecycle PRD]]
- PBI: [[PBI-001 Feature Pipeline View]]
