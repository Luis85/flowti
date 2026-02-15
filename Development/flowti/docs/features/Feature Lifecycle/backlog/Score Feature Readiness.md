---
type: UseCase
domain: Flowti
stage: draft
description: Score a feature's readiness using the 7-dimension FRI model and persist the scores to the PRD frontmatter.
view: "[[Event Catalog View]]"
feature: "[[Feature Lifecycle PRD]]"
testplanRef: UC-104
tags:
  - use-case
  - feature-lifecycle
  - scoring
---

# Score Feature Readiness

## Summary

A user wants to objectively assess how ready a feature is for the next phase. They use the FRI scoring form to evaluate the feature across 7 dimensions, producing a score that informs gate readiness and tracks progress over time.

## Preconditions

- The Features tab is open in the Event Catalog.
- A feature is selected in the detail panel.
- The user has enough context to evaluate the 7 dimensions (typically has reviewed the PRD).

## Steps

1. **Select a feature** — The user clicks a feature in the pipeline (e.g., "Hubs" at stage `draft`).
2. **Open FRI scoring** — The user clicks "Score FRI" in the actions section of the detail panel. A scoring form appears (inline or modal).
3. **Score each dimension** — The form shows 7 dimensions with sliders (0-5):
   - **Strategy** (5/5): Clear problem, linked to vision
   - **Scope** (4/5): In/out defined, minor edge cases
   - **Architecture** (5/5): Layout + adapter + events defined
   - **Event Integration** (4/5): Events produced/consumed listed
   - **Data Model** (4/5): Entities and relationships clear
   - **UI Consistency** (5/5): Layout from library, no duplication
   - **Validation & Testing** (4/5): Test approach defined
4. **Review total** — The form computes: 31/35 → "Production Ready"
5. **Save** — The user clicks "Save." The system updates the PRD frontmatter:
   ```yaml
   maturity_score_strategy: 5
   maturity_score_scope: 4
   ...
   maturity_score_total: 31
   maturity_score_status: production_ready
   ```
6. **Event emitted** — `feature.scored` fires with the full breakdown. The feature detail panel updates to show the new score.
7. **Gate impact** — The Design Gate (requires FRI >= 11) and Readiness Gate (requires FRI >= 19) now reflect the updated score.

## Outcome

The feature has an objective readiness score that persists in its PRD frontmatter and influences gate checks. Over time, repeated scoring shows the feature's maturation trajectory.

## Variations

- **First-time scoring**: All dimensions default to 0. The user fills in what they can assess.
- **Re-scoring**: Previous scores are pre-filled in the form. The user adjusts dimensions that have changed.
- **Partial assessment**: The user scores only the dimensions they can evaluate. Unscored dimensions stay at 0, which is transparent in the total.

## Related

- Feature: [[Feature Lifecycle PRD]]
- PBI: [[PBI-003 Scoring and Reviews]]
- Template: [[PRD Template]] (defines FRI dimensions)
