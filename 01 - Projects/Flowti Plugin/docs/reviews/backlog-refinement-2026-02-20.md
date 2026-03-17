---
type: BacklogRefinement
date: 2026-02-20
scope: Full backlog review — release blockers, integration gaps, adaptability, dogfooding, canvas strategy, DX pipeline improvements
items_reviewed: 78
items_updated: 14
new_items_created: 12
---

# Backlog Refinement — 2026-02-20

## Context

Observations and feedback from the current iteration show the project is heading in the right direction. However, several **major blockers** exist before considering a complete roll-out as a published release on GitHub. This refinement focuses on identifying those blockers, raising priority on integration and adaptability gaps, and establishing a clear path from "works for the author" to "works for anyone."

### Key Observations Driving This Refinement

1. **Build & Distribution** — Fixed: manual copy/paste replaced with refined build script + distribution endpoints. Resolved.
2. **Installer Rigidity** — Structures and schemas change rapidly as we move fast. The installer must be more flexible with versioned folder configs in JSON.
3. **Integration Gap** — Too much work happens outside the system. We need integrations to at least get data in so we can measure and understand problems.
4. **Knowledge Graph Growth** — Without living, breathing data the system provides no value. Dogfooding is the best food. Using the system auto-documents the knowledge graph.
5. **Process Ceremony** — Following the process ceremoniously helps to not forget crucial steps and lets the knowledge graph grow. Learning by doing.
6. **Canvas as Session Anchor** — Canvas files (JSON) have the potential to become the core anchor during a session. Integration is the next focus.
7. **Session Preparation** — Guided workflow helps bring structure and organization to produced artifacts.
8. **Data Exchange Hub Pipelines** — Multi-source master data building emerged as a specific need: select from multiple sources, build a master file, export to target. Functionality exists but needs improvement.

---

## Release Blocker Assessment

Before a v0.0.1 GitHub release, these areas must be addressed:

| # | Blocker | Current State | Required State | Priority |
|---|---------|--------------|----------------|----------|
| RB-1 | Installer only supports hardcoded PARA folders | FolderScaffoldStep creates 23 fixed folders | JSON-driven folder configs, versioned, user-independent | **critical** |
| RB-2 | No CI/CD — manual builds only | `npm run build:distribution` with endpoints JSON | At minimum: documented release checklist; ideally: GitHub Actions workflow | **high** |
| RB-3 | Canvas integration not in plugin | QuickAdd scripts in `var/scripts/`, not shipped | Canvas importer must be a first-class plugin feature | **high** |
| RB-4 | Knowledge graph is empty for new users | Installer creates folders but no seed content | First-run must seed minimal reference docs, templates, example domain | **high** |
| RB-5 | No external data ingestion | Only CSV import exists; all other data stays outside | At least one signal adapter (e.g., file watcher or webhook) | **medium** |
| RB-6 | Documentation stubs (TD-78..85) | 95% of JTBDs, domains, personas are empty | Core docs must have real content for shipped features | **medium** |
| RB-7 | Pipeline multi-source merge UX | Pipeline builder exists but source combination is limited | Source selector with merge-key config, preview per step | **medium** |

---

## Inbox Health Summary

| Inbox | Items | Typed | Delivered | Discovery | New (this session) |
|-------|-------|-------|-----------|-----------|---------------------|
| Development/flowti/docs/inbox | 66 | 66 | 8 | 46 | 12 |
| **Total** | **78** | **78** | **8** | **46** | **12** |

---

## New Backlog Items Created

The following 12 items were added to `Development/flowti/docs/inbox/` based on the observations above:

### Installer & Adaptability (3 items)

| # | Item | Priority | Domain | Rationale |
|---|------|----------|--------|-----------|
| 1 | Versioned JSON folder config for installer | critical | installer | RB-1: Folder structure must be externalized to JSON, versioned, and decoupled from code. Each version can ship different structures. |
| 2 | Installer seed content — templates and example domain | high | installer | RB-4: New users see empty folders. Seeding a starter domain with example events, flows, and session templates makes the system immediately useful. |
| 3 | Installer step registry — pluggable steps from config | medium | installer | InstallerService already supports `registerStep()`. Formalize this so community/custom steps can be loaded from a config. |

### Canvas Integration (3 items)

| # | Item | Priority | Domain | Rationale |
|---|------|----------|--------|-----------|
| 4 | Canvas importer as first-class plugin feature | high | data-exchange | RB-3: Move `var/scripts/canvas-importer/` logic into `src/domain/dataExchange/`. Register as import source type alongside CSV. |
| 5 | Canvas session workspace — open canvas as session anchor | high | session | Canvas files become the core anchor during a session. Start a session that opens canvas in main + sidebar monitor. Preconfigured canvas templates per session type. |
| 6 | Canvas template library for session types | medium | session | Domain Design, Sprint Planning, Retrospective, etc. each get a preconfigured canvas template with ready-made groups. |

### Data Exchange Hub — Pipeline Improvements (2 items)

| # | Item | Priority | Domain | Rationale |
|---|------|----------|--------|-----------|
| 7 | Pipeline multi-source merge with master data builder | high | data-exchange | RB-7: Select N sources, define merge key, preview merged dataset, then export. The building blocks exist (PipelineExecutor, multi-source import) but the UX and merge logic need refinement. |
| 8 | Pipeline step preview with intermediate Base views | medium | data-exchange | Between every pipeline step, show the current data state in a Base view. Users can inspect, massage, then continue to next step. |

### Integration & Dogfooding (3 items)

| # | Item | Priority | Domain | Rationale |
|---|------|----------|--------|-----------|
| 9 | Quick capture — idea and feedback action ribbons | high | inbox | Two ribbon actions: "Add Idea" and "Add Feedback." Modal with just title, note created in configured target folder. Reduces friction to feed the knowledge graph. |
| 10 | Session auto-documentation — artifact linking on file events | medium | session | When a file is created/modified during a session, auto-link it as a session artifact. Builds the knowledge graph through usage without manual effort. |
| 11 | Ingest build reports, test reports, and coverage as vault notes | medium | ingestion | Build reports already land in `docs/reports/builds/`. Extend to auto-ingest Vitest JSON reports, coverage summaries, and git log as typed notes for analysis. |

### Process & Ceremony (1 item)

| # | Item | Priority | Domain | Rationale |
|---|------|----------|--------|-----------|
| 12 | Session preparation checklist — guided pre-session workflow | medium | session | Before a session starts, a checklist ensures goals are set, context is loaded, and canvas/artifacts are prepared. Prevents forgetting crucial steps. |

---

## Domain Grouping — Updated

### 1. Installer Domain (5 items) — 0 DELIVERED, 3 NEW

| Item | Stage | Priority | Blocker? | Next Action |
|------|-------|----------|----------|-------------|
| **Versioned JSON folder config** | **new** | **critical** | RB-1 | **Cycle 11 — Inc 1** |
| **Installer seed content** | **new** | **high** | RB-4 | Cycle 11 — Inc 2 |
| **Pluggable step registry from config** | **new** | **medium** | — | Cycle 12+ |
| Installer state persisted per step (TD-70) | open | medium | — | Cycle 10 Inc 6 (stretch) |
| FolderScaffoldStep idempotency fix (TD-71) | open | medium | — | Cycle 10 Inc 4 |

### 2. Canvas Domain (4 items) — 0 DELIVERED, 3 NEW

| Item | Stage | Priority | Blocker? | Next Action |
|------|-------|----------|----------|-------------|
| **Canvas importer in plugin** | **new** | **high** | RB-3 | **Cycle 11 — Inc 3** |
| **Canvas session workspace** | **new** | **high** | — | Cycle 12 (depends on canvas importer) |
| **Canvas template library** | **new** | **medium** | — | Cycle 12+ |
| Canvas process triggers | discovery | low | — | Deferred |

### 3. Data Exchange Domain (12 items) — 5 DELIVERED/FIXED, 2 NEW

| Item | Stage | Priority | Next Action |
|------|-------|----------|-------------|
| ~~Exporter bugs (2)~~ | **fixed** | — | — |
| ~~DX progress bugs (3)~~ | **fixed** | — | — |
| **Pipeline multi-source merge** | **new** | **high** | **Cycle 11 — Inc 4** |
| **Pipeline step preview** | **new** | **medium** | Cycle 12 |
| Well-documented data pipeline | discovery | medium | Folds into pipeline merge work |
| Property placeholders in import | discovery | medium | Cycle 12+ |
| Adjust output for environments | discovery | low | Deferred |
| Azure DevOps Boards import | discovery | low | Deferred (see Signals feature) |
| Ingest test/coverage reports | discovery | medium | See item #11 above |

### 4. Session Domain (20 items) — 8 DELIVERED, 2 NEW

| Item | Stage | Priority | Next Action |
|------|-------|----------|-------------|
| ~~Auto-start, nudges, daily summary, UX (8)~~ | **delivered** | — | — |
| **Session auto-documentation** | **new** | **medium** | Cycle 12 |
| **Session preparation checklist** | **new** | **medium** | Cycle 12 |
| Session template JSON import/export | discovery | high | Cycle 11 stretch |
| Domain Design Session (SW-009) | discovery | medium | Depends on canvas workspace |
| Guided session tours (SW-010 candidate) | discovery | high | Cycle 12+ |
| Log-book command for daily note | discovery | medium | Deferred |
| Sort session goals | discovery | low | UI enhancement |
| Capture tasks during sessions | discovery | low | Deferred |
| Track entity lead/cycle time | discovery | medium | Deferred |
| Disable daily file tracking option | partially-delivered | medium | 30s dedup exists |
| Activity intelligence (SW-015) | planned | medium | Cycle 9 |

### 5. Inbox / Quick Capture Domain (3 items) — 0 DELIVERED, 1 NEW

| Item | Stage | Priority | Next Action |
|------|-------|----------|-------------|
| **Quick capture ribbons** | **new** | **high** | **Cycle 11 — Inc 5** |
| Idea capture on User Hub | discovery | high | Folds into quick capture |
| Inbox as main ingestion point | discovery | medium | Deferred |

### 6. Ingestion & Integration Domain (3 items) — 0 DELIVERED, 1 NEW

| Item | Stage | Priority | Next Action |
|------|-------|----------|-------------|
| **Ingest build/test/coverage reports** | **new** | **medium** | Cycle 12 |
| Azure DevOps Signals | discovery | low | Deferred (large effort) |
| Meeting transcription | discovery | low | External dependency |

### 7. Documentation & Lifecycle Domain (6 items) — 0 DELIVERED

Unchanged from previous refinement. Documentation stubs (TD-78..85) remain medium-term.

### 8. Infrastructure & DevOps Domain (5 items) — 0 DELIVERED

| Item | Stage | Priority | Next Action |
|------|-------|----------|-------------|
| CI/CD pipeline (TD-37) | open | high | RB-2: At minimum a release checklist for Cycle 11 |
| GitHub repo management | discovery | low | Deferred |
| Vault on GitHub as source of truth | discovery | low | Deferred |
| Attach git repos to domain | discovery | low | Deferred |
| Attach multiple repos to folder | discovery | low | Deferred |

---

## Recommended Priority Sequence — Updated

### In Progress (Cycles 9-10)

| Priority | Item | Cycle |
|----------|------|-------|
| 1 | TD-101: SessionService handler extraction | Cycle 9 |
| 2 | TD-100: Session performance investigation | Cycle 9 |
| 3 | PBI-SW-015: Activity Intelligence | Cycle 9 |
| 4 | 28 tech debt items (error handling, leaks, resilience) | Cycle 10 |

### Next — Cycle 11: Release Preparation

**Theme: Make it installable, make it useful out of the box, integrate canvas.**

| Inc | Item | Priority | Effort |
|-----|------|----------|--------|
| 1 | **RB-1: Versioned JSON folder config for installer** | critical | medium |
| 2 | **RB-4: Installer seed content — templates + example domain** | high | medium |
| 3 | **RB-3: Canvas importer as plugin feature** | high | large |
| 4 | **RB-7: Pipeline multi-source merge UX** | high | medium |
| 5 | **Quick capture ribbons (idea + feedback)** | high | small |
| 6 | **Release checklist + BRAT distribution** | high | small |
| stretch | Session template JSON import/export | high | small |

### Near-term — Cycle 12: Canvas Sessions & Dogfooding

| Item | Priority | Effort |
|------|----------|--------|
| Canvas session workspace (canvas as session anchor) | high | large |
| Canvas template library | medium | medium |
| Session auto-documentation (artifact linking) | medium | medium |
| Session preparation checklist | medium | small |
| Pipeline step preview with Base views | medium | medium |
| Ingest build/test/coverage reports | medium | medium |

### Medium-term — Cycles 13-14

| Item | Priority |
|------|----------|
| Guided session tours (SW-010) | high |
| Domain Design Session (SW-009) | medium |
| Auto-generate command reference docs | high |
| TypeDoc/Vite JSON vault ingestion | high |
| Traceability: solution to idea chain | high |
| Bulk frontmatter update/merge | medium |
| Lifecycle descriptions in Event Catalog | medium |

### Deferred (low priority, vision)

- Signals feature (Azure DevOps, RSS feeds, APIs)
- AI process simulation
- Figma importer
- Canvas/markdown process triggers
- Meeting transcription
- Portfolio Management

---

## Existing Items Updated

| Item | Change | Reason |
|------|--------|--------|
| `I want to provide a folder-structure as json to the installer` | priority: **critical**, stage: **planned** | RB-1: Release blocker |
| `Starting a Canvas Session` | priority: **high**, stage: **planned** | Canvas as session anchor is next strategic focus |
| `I want to capture feedback and input as fast as possible` | priority: **high**, stage: **planned** | Dogfooding enabler |
| `I want to build a well documented data-pipeline` | related: pipeline merge work | Folds into RB-7 |
| `How can Flowti be maintained inside Flowti` | priority: **high** | Dogfooding meta-concern drives several new items |
| `How can we measure performance and impact` | related: ingest build/test reports | Connected to new item #11 |
| `What to track and why after release` | related: session auto-documentation | Connected to new item #10 |
| `I want to combine multiple reports into one import` | priority: **high**, stage: **planned** | RB-7: Pipeline merge |
| Canvas process triggers | unchanged | Remains deferred |
| Markdown process triggers | unchanged | Remains deferred |
| `Data Exchange Hub - Pipelines` | priority: **high** | Elevating pipeline improvements |

---

## Learnings Captured

| # | Learning | Source |
|---|---------|--------|
| L-25 | Dogfooding reveals integration gaps faster than any spec. Work done outside the system is invisible to the knowledge graph. | This refinement |
| L-26 | Installer rigidity is a release blocker. When schemas change rapidly, hardcoded structures become stale on every iteration. Externalize to versioned config. | Build/install observation |
| L-27 | Canvas files are natural session anchors. Their JSON structure maps directly to domain entities (groups = domains, nodes = events/actors, edges = flows). | Canvas importer analysis |
| L-28 | Process ceremony is knowledge graph fuel. Each step followed = one more link documented. Skipping a step = a gap in traceability. | Retrospective observation |

---

## Backlog Metrics — Updated

| Metric | Previous (02-18) | Current (02-20) | Delta |
|--------|-------------------|-------------------|-------|
| Total inbox items | 70 | 78 | +8 (net: +12 new, -4 folded) |
| Delivered/fixed | 17 | 17 | 0 (no new deliveries between refinements) |
| Partially-delivered | 3 | 3 | 0 |
| Planned (active) | 0 | 6 | +6 (Cycle 11 targets) |
| Open bugs | 0 | 0 | 0 |
| Release blockers identified | — | 7 | new metric |
| High priority discovery | 6 | 9 | +3 |
| Critical priority items | 0 | 1 | +1 (installer JSON config) |
| Medium priority discovery | 16 | 19 | +3 |
| Low priority discovery | 25 | 25 | 0 |
| Domains represented | 13 | 15 | +2 (installer, canvas as distinct domains) |
| Tech debt items open | ~65 | ~65 | 0 (Cycle 10 not started yet) |
| Stubs needing elaboration | 4 | 2 | -2 (pipeline + canvas elaborated) |

---

## Action Items from This Refinement

- [x] Create 12 new inbox items with normalized frontmatter
- [x] Update 11 existing items with revised priority/stage
- [x] Capture 4 new learnings (L-25 through L-28)
- [x] Identify 7 release blockers with clear required-state definitions
- [x] Define Cycle 11 increment plan (6 increments + 1 stretch)
- [x] Define Cycle 12 roadmap (6 items)
- [ ] Elaborate PBI for versioned JSON folder config (RB-1)
- [ ] Elaborate PBI for canvas importer integration (RB-3)
- [ ] Elaborate PBI for pipeline multi-source merge (RB-7)
- [ ] Create Cycle 11 planning document
- [ ] Review Cycle 9 status — confirm prerequisites for Cycle 11

---

## Related

- [[backlog-refinement-2026-02-18]] — previous refinement
- [[Cycle 9 - Service Extraction and Intelligence]] — in progress
- [[Cycle 10 - Refactoring and Technical Debt Cleanup]] — planned
- [[Session Workspaces PRD]] — active feature
- [[Data Exchange Hub PRD]] — pipeline improvements
- [[Starting a Canvas Session]] — canvas integration inbox item
- [[I want to provide a folder-structure as json to the installer]] — installer flexibility inbox item
