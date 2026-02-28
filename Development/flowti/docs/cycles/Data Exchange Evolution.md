---
type: DevelopmentCycle
feature: "[[Backlog Refinement - Post Cycle 48]]"
stage: deferred
cycle: 55
release_anchor:
  - "Theme 4: Feature Deepening — Competitive Moat"
pbis:
  - "RB-7: Pipeline multi-source merge"
  - "PBI-008: Import/export execution timing"
  - "PBI-DX-001: Pipeline step preview"
  - "TD-69: Import concurrency"
bugs: []
tech_debt:
  - TD-69
estimated_increments: 6
target_cycle: 55
---

# Cycle 55 — Data Exchange Evolution

## Release Anchor Theme

- **Theme 4: Feature Deepening — Competitive Moat** — Differentiation through data pipeline maturity.

## Cycle Overview

Cycle 53 deepens the Data Exchange domain — Flowti's most LOC-heavy domain (1,846 LOC across 4 services). The focus is on pipeline power: multi-source merge (RB-7), step preview, import concurrency, and execution timing. These features transform Data Exchange from a basic CSV importer into a genuine data pipeline builder.

This cycle resolves RB-7 (the last feature-oriented release blocker) and addresses the import performance NFR (TD-69: 1000 rows in 30 seconds).

## User Pains

1. **Pipelines support only single sources** — Users can import from one CSV but cannot merge data from multiple sources using a shared key (RB-7).
2. **No visibility into import/export duration** — Users have no feedback on how long operations take, making it impossible to plan for large datasets (PBI-008).
3. **No intermediate pipeline preview** — Multi-step pipelines execute blind; users can't inspect data between steps (PBI-DX-001).
4. **Import is sequential** — Each row requires 2+ EventBus round-trips processed one at a time. 1000-row imports are slow (TD-69).

## Cycle Goals

1. **Implement pipeline multi-source merge** — select N sources, define merge key, preview merged dataset
2. **Add execution timing** to all import, export, and pipeline operations
3. **Build pipeline step preview** — inspect intermediate data state between pipeline steps
4. **Implement import concurrency** — reuse JobQueue with configurable parallelism (5-10 rows)

## Scope

### In Scope
- RB-7: Pipeline multi-source merge (N sources, merge key, preview, export)
- PBI-008: Execution timing for import/export/pipeline operations
- PBI-DX-001: Pipeline step preview with intermediate Base views
- TD-69: Import concurrency via JobQueue (configurable: 5-10 concurrent rows)

### Out of Scope
- TD-48: CSV streaming parse (defer to future; current sync parse works for <10MB)
- Pipeline conformance scripts (inbox idea; deferred)
- EDI format support (inbox idea; deferred)
- Data quality scoring (inbox idea; deferred)

## Increments

### Inc 1: Execution Timing Infrastructure (PBI-008)
**Theme**: Feature Deepening
**Effort**: Small

Add timing instrumentation to all Data Exchange operations:
- Wrap ImportService.executeImport() with start/end timing
- Wrap ExportService.executeExport() with start/end timing
- Wrap PipelineExecutor.execute() with per-step and total timing
- Emit timing via existing events (add `duration_ms` to completion events)
- Display timing in Data Exchange Hub status area

**Acceptance Criteria**:
- [ ] Import completion event includes duration_ms
- [ ] Export completion event includes duration_ms
- [ ] Pipeline completion event includes total_duration_ms and per_step_duration_ms[]
- [ ] Timing displayed in DX Hub after operation completes
- [ ] Unit tests for timing capture
- [ ] `npm test` green

### Inc 2: Import Concurrency (TD-69)
**Theme**: Feature Deepening
**Effort**: Medium

Make ImportService process rows concurrently:
- Reuse existing JobQueue infrastructure (89 LOC, already supports concurrency)
- Configure ImportService to use JobQueue with concurrency limit (default: 5)
- Add `importConcurrency` setting (1–20, default 5)
- Preserve row ordering in output (parallel execution, ordered completion)
- Progress reporting: emit progress every N rows

**Acceptance Criteria**:
- [ ] ImportService uses JobQueue for concurrent row processing
- [ ] Configurable concurrency limit in settings
- [ ] Row ordering preserved in output
- [ ] Progress events emitted during import
- [ ] 1000 rows complete within 30 seconds (NFR target)
- [ ] Unit tests for concurrent import
- [ ] `npm test` green

### Inc 3: Pipeline Multi-Source Data Model (RB-7a)
**Theme**: Feature Deepening
**Effort**: Medium

Extend pipeline configuration to support multiple sources:
- Add `sources: DataSource[]` to PipelineConfig (backward-compatible; existing `source` becomes `sources[0]`)
- `DataSource`: `{ id, type: 'csv' | 'vault', path, label }`
- Add `MergeStep`: `{ type: 'merge', sources: [sourceId, sourceId], mergeKey: string, strategy: 'inner' | 'left' | 'full' }`
- MergeStep joins two datasets on a shared key column
- Validate merge key exists in both sources before execution

**Acceptance Criteria**:
- [ ] PipelineConfig supports multiple sources
- [ ] MergeStep type defined with join strategies
- [ ] Backward-compatible with existing single-source pipelines
- [ ] Merge key validation before execution
- [ ] Unit tests for data model and validation
- [ ] `npm test` green

### Inc 4: Pipeline Multi-Source Execution (RB-7b)
**Theme**: Feature Deepening
**Effort**: Large

Implement merge execution in PipelineExecutor:
- Load all sources in parallel
- Execute MergeStep: join datasets on merge key using configured strategy
- Handle key collisions (configurable: first-wins, last-wins, concatenate)
- Emit progress events per source load and merge step
- Output merged dataset to next pipeline step

**Acceptance Criteria**:
- [ ] Multiple sources loaded in parallel
- [ ] Inner, left, and full join strategies implemented
- [ ] Key collision handling configurable
- [ ] Progress events emitted for source loading and merge
- [ ] Merged dataset passed to subsequent pipeline steps
- [ ] Unit tests for all join strategies and edge cases
- [ ] `npm test` green

### Inc 5: Pipeline Multi-Source UI (RB-7c)
**Theme**: Feature Deepening
**Effort**: Medium

Add multi-source configuration UI to Data Exchange Hub:
- Source picker: add/remove sources in pipeline config
- Merge key selector: dropdown of shared columns between selected sources
- Strategy selector: inner/left/full join
- Preview: show merged dataset sample (first 10 rows) before full execution
- Export merged result to CSV or vault notes

**Acceptance Criteria**:
- [ ] UI supports adding/removing pipeline sources
- [ ] Merge key selectable from shared columns
- [ ] Join strategy selectable
- [ ] Preview shows merged sample
- [ ] Full execution produces correct merged output
- [ ] UI tests for pipeline configuration
- [ ] `npm test` green

### Inc 6: Pipeline Step Preview (PBI-DX-001)
**Theme**: Feature Deepening
**Effort**: Medium

Enable intermediate data inspection between pipeline steps:
- After each pipeline step, store intermediate result in memory
- "Preview" button on each step shows intermediate dataset (table view)
- Paginated table (reuse analytics table renderer from DashboardTileRenderer)
- Step preview does not persist — in-memory only during pipeline editing
- Clear preview data on pipeline close

**Acceptance Criteria**:
- [ ] Intermediate results stored per step during pipeline execution
- [ ] Preview button shows table of intermediate data
- [ ] Table is paginated (reuse existing pagination)
- [ ] Preview clears on pipeline close (no memory leak)
- [ ] Unit tests for step result capture and display
- [ ] `npm test` green

## Dependency Graph

```
Inc 1 (Timing)        ──→ Independent (foundation for all operations)
Inc 2 (Concurrency)   ──→ Independent
Inc 3 (Merge Model)   ──→ Inc 4 (Merge Execution) ──→ Inc 5 (Merge UI)
Inc 6 (Step Preview)  ──→ Independent (but benefits from Inc 4 for multi-step pipelines)
```

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Multi-source merge is computationally expensive for large datasets | Medium | Limit preview to 10 rows; lazy-load full merge on execute |
| Concurrent import introduces race conditions | High | JobQueue already handles concurrency; add integration tests for ordering |
| Merge key type mismatches (string "1" vs number 1) | Medium | Coerce all merge keys to string for comparison |
| Step preview memory usage with large intermediate datasets | Medium | Cap intermediate storage at 10,000 rows; warn user above threshold |

## Success Metrics

| Metric | Target |
|--------|--------|
| New tests | ~90 |
| Post-cycle tests | ~5,775 |
| Import 1000 rows | < 30 seconds (NFR) |
| Join strategies | 3 (inner, left, full) |
| Release blockers resolved | RB-7 |
| Tech debt resolved | TD-69 |
| Increments | 6 |

## Deferred Items

- TD-48: CSV streaming parse → only needed for >10MB files; defer until perf data (C52) shows need
- TD-66: FileSystemClient wildcard churn → defer until perf data shows impact
- EDI format support → future cycle, inbox idea
- Data conformance scripts → future cycle, inbox idea
- Pipeline scheduling (auto-run) → future cycle
