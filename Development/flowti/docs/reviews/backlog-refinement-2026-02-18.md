---
type: BacklogRefinement
date: 2026-02-18
scope: All inboxes (00 - Connectivity + Development/flowti/docs)
items_reviewed: 65
items_updated: 28
---

# Backlog Refinement — 2026-02-18

## Inbox Health Summary

| Inbox | Items | Typed | Untyped | Delivered | Planned | Bugs | Discovery |
|-------|-------|-------|---------|-----------|---------|------|-----------|
| 00 - Connectivity | 32 | 32 | 0 (fixed) | 5 | 0 | 0 | 25 |
| Development/flowti/docs | 33 | 33 | 0 (fixed) | 5 | 0 | 3 | 23 |
| **Total** | **65** | **65** | **0** | **10** | **0** | **3** | **48** |

**Actions taken this session:**
- 28 items updated with normalized frontmatter (type, stage, domain, parent, description, priority)
- 4 items marked `delivered` with delivery references
- 3 items marked `planned` with Cycle 4 references
- 3 items marked `partially-delivered` with remaining work noted
- 5 duplicate pairs identified and cross-linked
- 2 bugs given `stage: open` and priority

---

## Duplicates Identified

| Canonical Item (keep) | Duplicate (cross-linked) | Resolution |
|-----------------------|--------------------------|------------|
| `00-Conn: I want to automatically start a Day Session` | `docs: I always want to have a daily-session` | Both linked to PBI-SW-007 |
| `00-Conn: I want a capture an idea section on my user-hub` | `docs: I want to quickly capture a note to my inbox` | Both linked to Hubs PRD |
| `00-Conn: How can Obsidian integrate with GitHub` | `docs: I want to manage my GitHub Git Repo from Obsidian` | Cross-linked via `related:` |
| `00-Conn: I need a frontmatter conformance script` | `00-Conn: How can I add conformance scripts to my data pipelines` | Cross-linked via `related:` |
| `00-Conn: I want to start the documented lifecycles as a Session` | `00-Conn: How can I use Flowti Sessions to execute the development lifecycle` | Cross-linked via `related:` |

---

## Domain Grouping

### 1. Session Domain (11 items) — ACTIVE DEVELOPMENT

| Item | Stage | Priority | PBI | Next Action |
|------|-------|----------|-----|-------------|
| Auto-start Day Session | **delivered** | high | SW-007 | Delivered Cycle 4+5 |
| Daily session duplicate | **delivered** | high | SW-007 | — (duplicate, delivered) |
| Activity log aggregation | **delivered** | high | — | Delivered Cycle 4 Inc 2 |
| Session nudges | **delivered** | medium | SW-007 | Delivered Cycle 5 |
| Folder filter (global) | **delivered** | medium | — | Delivered Cycle 4 (sessionActivityFilterGlobal) |
| Domain Design Session | discovery | medium | SW-009 | Next session PBI |
| Guided lifecycle tours | discovery | high | — | Evaluate as PBI-SW-010 |
| Dev lifecycle sessions | discovery | medium | — | Covered by session templates |
| Product dev session | partially-delivered | medium | — | Custom type template |
| Guided dev tour | partially-delivered | medium | — | Cycle Planning Template |
| Flow decomposition w/ story mapping | discovery | medium | SW-009 | Consider as SW-009 step |

**Session backlog priority order (updated post-Cycle 5):**
1. ~~PBI-SW-007~~ **DONE** (Cycles 4+5) — daily session, nudges, daily summary, all delivered
2. ~~Activity log aggregation~~ **DONE** (Cycle 4 Inc 2)
3. ~~Folder filter (global)~~ **DONE** (Cycle 4)
4. **PBI-SW-009** (Cycle 6+) — guided domain design workflow
5. **PBI-SW-010 candidate**: Guided session tours with per-step quality gates
6. **Session template JSON import/export** — high priority, low effort

### 2. Data Exchange Domain (8 items) — 2 OPEN BUGS

| Item | Stage | Priority | Next Action |
|------|-------|----------|-------------|
| ~~Exporter not evaluating formulas~~ | **fixed** | high | Fixed Cycle 4 Inc 1 |
| ~~Exporter shows all properties~~ | **fixed** | high | Fixed Cycle 4 Inc 1 |
| Property placeholders in import | discovery | medium | Future PBI |
| Well-documented data pipeline | discovery | medium | Future PBI |
| Conformance scripts in pipelines | discovery | low | Future PBI |
| Adjust output for environments | discovery | low | Future PBI |
| Azure DevOps Boards import | discovery | low | Stub — needs elaboration |
| Ingest test/coverage reports | discovery | medium | Stub — needs elaboration |

**Update (2026-02-18):** Both exporter bugs fixed in Cycle 4 Inc 1 via ResolvedColumn unified descriptor. 3 remaining open bugs are DX progress tracking issues (medium priority).

### 3. Automation Domain (6 items)

| Item | Stage | Priority | Next Action |
|------|-------|----------|-------------|
| Bulk frontmatter update/merge | discovery | medium | Future PBI — data quality |
| Frontmatter conformance audit | discovery | medium | Future PBI — data quality |
| Auto-route typed inbox files | discovery | medium | Future PBI — inbox workflow |
| Auto-type file on creation | discovery | medium | Future PBI — nudge-based |
| AI-assisted inbox→output pipeline | discovery | low | Vision — long-term |
| Meeting transcription | discovery | low | External dependency (audio API) |

### 4. Documentation/Lifecycle Domain (6 items)

| Item | Stage | Priority | Next Action |
|------|-------|----------|-------------|
| Lifecycle descriptions in Flowti | discovery | medium | Future PBI — Event Catalog enhancement |
| Trace solution back to idea | discovery | high | Future PBI — traceability chain |
| Document all plugin commands | discovery | high | Auto-generate from registered commands |
| Auto-create docs from codebase | discovery | high | TypeDoc/Vite JSON ingestion |
| Feature Presentation Page | discovery | low | Auto-generated from backlog |
| Ship docs alongside plugin | discovery | low | Packaging concern |

### 5. User/Hubs Domain (4 items)

| Item | Stage | Priority | Next Action |
|------|-------|----------|-------------|
| Idea capture on User Hub | discovery | high | Future PBI — quick-create inbox notes |
| Inbox as main ingestion point | discovery | medium | Data quality pipeline design |
| Manage Flowti inside Flowti | discovery | high | Dogfooding — meta concern |
| Product Overview Page | discovery | low | Auto-generated page |

### 6. Infrastructure Domain (4 items)

| Item | Stage | Priority | Next Action |
|------|-------|----------|-------------|
| GitHub repo management | discovery | low | Duplicate pair — cross-linked |
| Attach git repos to domain | discovery | low | Future PBI |
| Attach multiple repos to folder | discovery | low | Future PBI |
| Vault on GitHub as source of truth | discovery | low | Infrastructure concern |

### 7. Other Domains (6 items)

| Item | Domain | Priority | Next Action |
|------|--------|----------|-------------|
| Visual file explorer markers | filesystem | low | Obsidian API exploration |
| Incremental folder index | filesystem | low | Context menu command |
| Right-click file share | collaboration | low | External folder copy |
| Canvas process triggers | canvas | low | Long-term vision |
| Markdown process triggers | markdown | low | Long-term vision |
| AI process simulation | ai | low | Long-term vision |

### 8. Prototype/Design Domain (4 items)

| Item | Domain | Priority | Next Action |
|------|--------|----------|-------------|
| Build frontend with JSON | prototype | low | Declarative UI — vision |
| Figma importer | prototype | low | Stub — needs elaboration |
| Flowti as reference implementation | meta | medium | Dogfooding — ongoing |
| Portfolio Management | lifecycle | low | Domain exploration |

### 9. Reference/Archived (1 item)

| Item | Stage | Note |
|------|-------|------|
| manual-test-strategy.md | archived | German-language manual test plan. Historical reference. |

---

## Recommended Priority Sequence

### Completed (Cycles 4+5) — 2026-02-18
1. ~~Activity log aggregation~~ — **DONE** (Cycle 4 Inc 2)
2. ~~PBI-SW-007 core~~ — **DONE** (Cycle 4: daily-tracking, concurrent sessions, auto-start, daily note)
3. ~~PBI-SW-007 nudges~~ — **DONE** (Cycle 5: nudge system, default configs, dashboard indicator)
4. ~~Fix 2 exporter bugs~~ — **DONE** (Cycle 4 Inc 1: ResolvedColumn descriptor)
5. ~~Global activity folder filter~~ — **DONE** (Cycle 4: sessionActivityFilterGlobal)

### Next (Cycle 6+)
6. **Sessions feature polish** — coherent UX from User Hub to Workspace (quick-start, commands, sidebar)
7. **Session template JSON import/export** — high priority, low effort
8. PBI-SW-009: Domain Design guided workflow
9. PBI-SW-010 candidate: Guided session tours with quality gates (high user demand)

### Near-term backlog (Cycles 7-8)
10. Idea capture on User Hub (high priority, small effort)
11. Auto-generate command reference docs (high priority, medium effort)
12. TypeDoc/Vite JSON → vault docs ingestion (high priority, large effort)
13. Traceability: solution → idea chain (high priority, large effort)

### Medium-term backlog
11. Bulk frontmatter update/merge + conformance audit (paired delivery)
12. Auto-route typed inbox files
13. Lifecycle descriptions in Event Catalog
14. Ingest test/coverage/git reports
15. Data pipeline builder

### Deferred (low priority, vision)
16-26. Infrastructure (git), filesystem (markers, index), collaboration (share), AI (simulation), prototyping (JSON/Figma), canvas/markdown triggers

---

## Backlog Metrics

| Metric | Value |
|--------|-------|
| Total inbox items | 65 |
| Delivered/fixed | 10 |
| Planned (active) | 0 |
| Open bugs | 3 (DX progress tracking) |
| High priority discovery | 6 |
| Medium priority discovery | 14 |
| Low priority discovery | 25 |
| Duplicates (cross-linked) | 5 pairs |
| Stubs needing elaboration | 4 |
| Domains represented | 13 |

---

## Action Items from This Refinement

- [x] Normalize all 28 untyped inbox items with frontmatter
- [x] Cross-link 5 duplicate pairs
- [x] Mark 4 delivered items with delivery references
- [x] Mark 3 planned items with Cycle 4 references
- [x] Triage 2 exporter bugs — **fixed in Cycle 4 Inc 1** (ResolvedColumn descriptor)
- [x] Mark 6 additional items delivered post-Cycle 4+5 (nudges, daily session, auto-start, folder filter, activity grouping, daily summary)
- [ ] Elaborate 4 stubs (Figma Importer, Azure DevOps, test/coverage ingest, flow decomposition)
- [ ] Evaluate "Guided session tours" as PBI-SW-010 candidate
- [ ] Review whether "I want to start the documented lifecycles as a Session" warrants its own PBI or folds into SW-009

---

## Related

- [[Cycle 4 - Auto-Session and Activity Polish]] — current cycle
- [[Session Workspaces PRD]] — active feature
- [[Data Exchange Hub PRD]] — 2 open bugs
- [[PBI-SW-007 Auto-Session and Session Nudges]] — planned
- [[PBI-SW-009 Domain Design Session]] — next session PBI
