---
type: ProductBacklogItem
feature: "[[Data Exchange Hub PRD]]"
stage: discovery
priority: medium
dependencies:
  - "[[PBI-006 Pipeline Multi-Source Merge]]"
tags:
  - data-exchange
  - pipeline
user_story: "[[Pipeline step preview with intermediate Base views]]"
---

## User Story - Problemspace

As a data manager, I want to inspect intermediate data state between pipeline steps so that I can verify data quality before it flows to the next step.

### User Pains

- Pipeline execution is opaque — no visibility into intermediate state between steps
- Data quality issues discovered only after the full pipeline completes
- No way to pause, inspect, and resume a pipeline

### User Needs

- Step-level Base view inspection between pipeline steps
- Pause and inspect mode for manual review
- Formula steps for Base-level transformations
- Resume flow after inspection

## Solutionstatement

### Functional Requirements

- [ ] Step-level Base view: Each pipeline step references or auto-generates a `.base` file
- [ ] Pause and inspect: Pipeline can pause between steps for manual review
- [ ] Formula steps: Apply Base formulas (aggregations, transformations) as pipeline steps
- [ ] Resume: "Continue" button advances to next pipeline step

## Acceptance Criteria

- [ ] Intermediate Base view visible between pipeline steps
- [ ] Pipeline can be paused for manual inspection
- [ ] Resume continues pipeline from paused step
- [ ] npm run build passes

## Related

- PRD: [[Data Exchange Hub PRD]]
- Inbox: [[Pipeline step preview with intermediate Base views]]
- Depends: [[PBI-006 Pipeline Multi-Source Merge]]
