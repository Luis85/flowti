---
type: UseCase
domain: Flowti
stage: planned
description: Create and conduct a Three Amigos review session for a feature, capturing TASM scores that feed into quality gate checks.
view: "[[Event Catalog View]]"
feature: "[[Feature Lifecycle PRD]]"
testplanRef: UC-105
tags:
  - use-case
  - feature-lifecycle
  - review
---

# Run a Three Amigos Review

## Summary

A user (or team) wants to conduct a structured quality review of a feature. They create a Three Amigos review session from the Features tab, walk through the evaluation dimensions, capture scores, and have the results automatically linked to the feature's quality gate.

## Preconditions

- The Features tab is open in the Event Catalog.
- A feature is selected (typically at stage `in-progress` or `review`).
- The Three Amigos Session Template exists in `docs/templates/`.

## Steps

1. **Select a feature** — The user clicks a feature at stage `review` (e.g., "Event System").
2. **Create review** — The user clicks "New Review" in the actions section. The system creates a Three Amigos session doc from the template in the feature's backlog folder, pre-filled with:
   - Feature name in `related_features`
   - Today's date
   - Empty score fields ready for input
3. **Open the review doc** — The newly created doc opens in Obsidian's editor. The user conducts the review session, filling in:
   - Product Perspective findings
   - Engineering Perspective findings (architecture, events, performance)
   - UX/QA Perspective findings
   - Improvement backlog items
4. **Score the dimensions** — The user fills in the 7 TASM score fields in the frontmatter:
   ```yaml
   scores_product_value: 4
   scores_architectural_integrity: 5
   scores_event_discipline: 4
   scores_data_model_integrity: 4
   scores_ux_quality: 3
   scores_performance_scalability: 4
   scores_documentation_discipline: 3
   scores_total: 27
   scores_health_level: strong
   ```
5. **Save the doc** — On save, Flowti detects the updated frontmatter (via `file.modified` event) and extracts the TASM scores.
6. **Scores reflected** — Back in the Features tab, the feature detail panel now shows: "Latest Review: 27/35 — Strong." The `review.session.scored` event is emitted.
7. **Quality Gate impact** — The Quality Gate (review → done) checks for TASM score >= 19 (Stable). With 27, this check passes.

## Outcome

The feature has a documented quality review with structured scores. The review is linked to the feature as a vault artifact, and the TASM score informs the quality gate. Over time, review history shows quality trends.

## Variations

- **Solo review**: A single developer fills all three perspectives. The structure still provides thorough coverage.
- **Team review**: Multiple participants fill sections. One person consolidates scores. The doc format supports this workflow naturally.
- **Drift detected**: The review identifies architectural drift. The user sets `drift_detected: true` and `refactor_required: true` in frontmatter. This could feed into future Health tab integration.
- **Low score**: TASM score <= 18 blocks the Quality Gate. The feature stays at `review` stage until issues are addressed and a new review scores higher.

## Related

- Feature: [[Feature Lifecycle PRD]]
- PBI: [[PBI-003 Scoring and Reviews]]
- Template: [[Three Amigos Session Template]] (defines TASM dimensions)
