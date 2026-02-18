---
type: UseCase
domain: Flowti
stage: planned
description: Open the Features tab to see all PRDs positioned at their current lifecycle stage, identify blocked features, and decide what to work on next.
view: "[[Event Catalog View]]"
feature: "[[Feature Lifecycle PRD]]"
testplanRef: UC-101
tags:
  - use-case
  - feature-lifecycle
  - pipeline
---

# Review Feature Pipeline

## Summary

A user wants a quick overview of their feature portfolio. They open the Features tab in the Event Catalog to see every PRD positioned at its current stage — from initial ideas through to completed features. They identify which features are blocked at quality gates and decide which one to advance in their next session.

## Preconditions

- The Flowti IBDE plugin is installed and enabled.
- At least one PRD file exists in `docs/features/*/` with `type: ProductRequirementsDocument` frontmatter.
- The Event Catalog view is open.

## Steps

1. **Navigate to the Features tab** — The user clicks the "Features" tab in the Event Catalog tab bar. The system scans all feature folders and discovers PRD files.
2. **Review the pipeline** — The master panel shows PRDs grouped by stage: idea, draft, approved, in-progress, review, done. Each stage header shows a count badge. Each PRD row shows the feature name, a colored stage badge, maturity level, FRI score (if scored), and a gate readiness indicator (green dot = ready to advance, yellow = items remaining, red = blocked).
3. **Identify blocked features** — The user scans for red or yellow gate indicators. A feature with a yellow indicator has unmet gate criteria that need attention.
4. **Select a feature for detail** — The user clicks a feature (e.g., "Component Library" at stage `draft`). The detail panel shows the gate checklist for the current stage (Design Gate), with specific checks like "Scope section filled", "FRI score >= 11", "Event impact defined".
5. **Review what's needed** — The detail panel shows 2 of 4 gate checks passing. The user sees exactly what's missing: "Event impact section empty" and "FRI score not yet recorded."
6. **Decide next action** — The user can either start a session to work on the missing items, score the FRI, or move on to another feature.

## Outcome

The user has a clear picture of their entire feature portfolio. They know which features are progressing, which are stuck, and exactly what's needed to unblock them. This replaces manually opening PRD files and guessing at progress.

## Variations

- **Empty pipeline**: No PRDs found. The master panel shows an empty state with guidance: "Create your first PRD using the PRD Template."
- **All features done**: Every PRD at stage `done`. The pipeline shows a "clean board" state. The user considers new ideas.
- **Legacy stage values**: PRDs with non-standard stages (e.g., `open`, `new`) are auto-normalized on first scan. The user sees a toast: "Normalized 3 PRD stage values."

## Related

- Feature: [[Feature Lifecycle PRD]]
- PBI: [[PBI-001 Feature Pipeline View]]
