---
type: ReleaseBlocker
feature: "[[Release Preparation PRD]]"
stage: deferred
priority: medium
tags:
  - release-blocker
  - RB-7
  - data-exchange
  - pipeline
decision: defer-v1.1
decision_date: 2026-02-27
decision_cycle: "[[Cycle 49 - Release Readiness and Dogfooding]]"
target_cycle: "[[Cycle 53 - Data Exchange Evolution]]"
---

## RB-7: Pipeline Multi-Source Merge

### Description

Enable pipelines to merge data from multiple CSV/Canvas sources using a configurable merge key and per-field conflict resolution strategies. Currently, the pipeline builder executes sources sequentially, creating notes per source with no merge capability.

### Decision

**Defer to v1.1 / Cycle 53.** Single-source CSV import and export is fully functional and sufficient for marketplace v1.0. Multi-source merge is a power-user feature.

### Rationale

1. **Single-source sufficient**: CSV import, export, and single-source pipelines cover the core data exchange use case for v1.
2. **Power-user feature**: Multi-source merge targets advanced users who manage data across multiple CSV sources — not the typical first-time user.
3. **Planned for Cycle 53**: The Data Exchange Evolution cycle (C53) is explicitly scoped for this feature, including import concurrency (TD-69) and CSV streaming.
4. **No marketplace blocker**: Obsidian community plugin guidelines do not require multi-source data merging.
5. **Foundation already exists**: PipelineExecutor, ImportService, and ExportService provide the building blocks. The merge capability is an additive feature on top of proven infrastructure.

### Current State

- PipelineExecutor: sequential multi-source execution (no merge)
- ImportService: single-source CSV → vault notes
- ExportService: vault → CSV/Tab pipeline
- Detailed PBI exists: [[PBI-006 Pipeline Multi-Source Merge]]

### Target

- **Cycle 53** — Data Exchange Evolution
- Includes: merge key configuration, per-field conflict strategies (first-wins, last-wins, concatenate, manual), merge preview, master data export

### Related

- [[PBI-006 Pipeline Multi-Source Merge]]
- [[Data Exchange Hub PRD]]
- [[Backlog Refinement - Post Cycle 48]]
- [[Cycle 49 - Release Readiness and Dogfooding]]
- [[Cycle 53 - Data Exchange Evolution]]
