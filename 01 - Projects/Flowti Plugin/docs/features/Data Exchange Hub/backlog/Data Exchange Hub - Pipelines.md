---
type: UserStory
feature: "[[Data Exchange Hub PRD]]"
stage: planned
priority: "2 - high"
related:
  - "[[Pipeline multi-source merge with master data builder]]"
  - "[[backlog-refinement-2026-02-20]]"
note: "Priority elevated in 2026-02-20 refinement. Pipeline multi-source merge is release blocker RB-7."
---
## User Stories

- I want to configure multiple steps with bases, I envision to build a "merger" which collects all the sources, this feeds into a "processor" which moves the dataset trough a configured set of bases, this feeds into "outputs" which are configured exporter. I want to be able to collect data about an Entity from multiple sources, merge them, create notes from them and push those notes trough multiple "processors" which are base views with created formulas, so that I can automate my data massaging tasks.