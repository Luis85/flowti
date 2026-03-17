---
type: ProductBacklogItem
feature: "[[Data Exchange Hub PRD]]"
priority: medium
stage: done
userStories: []
useCases:
  - "[[Build Data Dictionary]]"
  - "[[Document Data Types]]"
  - "[[Hub Dashboard Overview]]"
  - "[[Create Base File with Import]]"
---

## User Story

As a domain architect, I want a central hub dashboard with aggregate statistics, a data dictionary for frontmatter properties, and a type registry so that I can understand, document, and govern the data flowing through my vault's import and export workflows.

> **Cross-reference**: The "Review Enriched Context" use case in the [[Event System]] backlog also relates to this PBI, as enriched event context feeds into the data dictionary.

## Functional Requirements

- [x] Hub Dashboard tab as default landing page with stats grid (import configs, export configs, pipelines, CSV files)
- [x] Quick-action buttons on dashboard: New Import, New Export, Open CSV
- [x] Properties tab lists all vault frontmatter properties with documented/undocumented badges
- [x] Property detail panel shows usage count, sample values, and editable documentation fields
- [x] Types tab for registering and documenting note types with expected frontmatter schemas
- [x] Auto-discovery of `type` values from vault frontmatter as undocumented entries
- [x] "Create Base" toggle in Import wizard generates a `.base` file alongside imported notes
- [x] Generated `.base` file uses `inFolder` filter and columns derived from mapped frontmatter properties
- [x] Data dictionary and type registry persist via `DataExchangeService` storage

## Acceptance Criteria

- [x] Hub Dashboard shows accurate aggregate counts and functional quick-action buttons
- [x] Properties tab discovers all vault frontmatter properties and supports documentation CRUD
- [x] Types tab allows registering, documenting, and browsing note type schemas
- [x] "Create Base" toggle produces a valid `.base` file that renders imported notes in database view
- [x] Documented properties display badge distinction from undocumented ones
- [x] `npm run build` passes
