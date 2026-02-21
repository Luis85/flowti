---
type: DevelopmentCycle
feature: "[[Release Preparation PRD]]"
stage: planned
cycle: 13
date_planned: 2026-02-21
date_completed:
pbis:
  - "[[PBI-RP-001 Repository Restructure]]"
  - "[[PBI-RP-002 Obsidian ESLint Compliance]]"
  - "[[PBI-RP-003 CI-CD Pipeline]]"
  - "[[PBI-CAN-001 Canvas Parser and Importer]]"
  - "[[PBI-002 Seed Starter Content]]"
  - "[[PBI-006 Pipeline Multi-Source Merge]]"
bugs: []
bugs_fixed_precycle: []
tech_debt: []
estimated_increments: 7
actual_increments:
estimated_tests: 110
actual_tests:
total_tests_after:
total_test_files_after:
---

# Cycle 13: Release Preparation

## Situation Assessment

### Pre-Cycle State (assumes Cycle 10 + Cycle 11 + Cycle 12 complete)

**Plugin health (projected):**
- ~3,060 tests passing, ~130 test suites
- Build status: green
- `npm run build` pipeline: vitest + tsc + eslint + esbuild
- Error handling foundation in place (Cycle 10 Inc 1)
- Resource leak patterns fixed (Cycle 10 Inc 2)
- EventBus resilience with error boundary (Cycle 10 Inc 3)
- Infrastructure correctness hardened (Cycle 10 Inc 4)

**Feature status across contributing PRDs:**

| PRD | Stage | FRI | Delivered So Far |
|-----|-------|-----|------------------|
| [[Release Preparation PRD]] | planned | 15/35 | No PBIs delivered yet — greenfield |
| [[Obsidian Canvas Integration PRD]] | discovery | 18/35 | No PBIs delivered — QuickAdd scripts exist as reference |
| [[Installer PRD]] | done | — | 4-page wizard, PARA scaffolding, idempotent execution |
| [[Data Exchange Hub PRD]] | done | — | 7-tab hub, CSV import/export, pipelines, saved configs |
| [[Quick Capture PRD]] | done | 19/35 | PBI-QC-001 delivered in Cycle 12 — ribbons, modal, command palette |
| [[Hubs PRD]] | in-progress | 33/35 | User Hub, inbox (7 sources incl. vault folder), session panel, domain hub |

**Release Blockers (from [[backlog-refinement-2026-02-20]]):**
- RB-1: Repository Restructure — **open** (this cycle)
- RB-2: Obsidian ESLint Compliance — **open** (this cycle)
- RB-3: Canvas importer as plugin feature — **open** (this cycle)
- RB-4: Seed starter content — **open** (this cycle)
- RB-5: External data ingestion — **targeted Cycle 11** (Azure DevOps)
- RB-6: Documentation stubs — **deferred** (medium-term)
- RB-7: Pipeline multi-source merge — **open** (this cycle)

**Signal domain (projected from Cycle 11):**
- SignalService operational with Azure DevOps adapter
- 10 signal events registered in Event Catalog
- Signals tab in Data Exchange Hub (8th tab)

**Capture workflow (delivered in Cycle 12):**
- PBI-QC-001 Quick Capture Ribbons — **delivered** (Cycle 12)
- PBI-005 Vault Folder Inbox — **delivered** (Cycle 12)

**What's next per release priority:**
1. PBI-RP-001 Repository Restructure — critical, no dependencies, unlocks CI/CD + marketplace
2. PBI-RP-002 Obsidian ESLint Compliance — critical, depends on RB-1
3. PBI-RP-003 CI/CD Pipeline — high, depends on RB-1
4. PBI-CAN-001 Canvas Parser and Importer — high, Data Exchange Hub dependency met
5. PBI-002 Seed Starter Content — high, Installer dependency met
6. PBI-006 Pipeline Multi-Source Merge — high, no dependencies

### Post-Cycle State (YYYY-MM-DD)
<!-- Filled post-delivery -->

**Plugin health:**
- X tests passing (Y skipped), Z test files (+N tests, +M files)

**Feature status:**
- PBI-RP-001: — brief summary
- PBI-RP-002: — brief summary
- PBI-RP-003: — brief summary
- PBI-CAN-001: — brief summary
- PBI-002: — brief summary
- PBI-006: — brief summary

---

## Cycle Goals

1. **Achieve Obsidian marketplace infrastructure readiness** — Repository restructured to root, Obsidian ESLint compliance enforced, CI/CD pipeline operational with automated builds and releases (PBI-RP-001, PBI-RP-002, PBI-RP-003)
2. **Complete core features for first public release** — Canvas import as first-class Data Exchange source, seed starter content for first-run experience, pipeline multi-source merge for data management workflows (PBI-CAN-001, PBI-002, PBI-006)

---

## Tech Debt Bundled

**None bundled this cycle.** Cycle 13 is a cross-feature release preparation cycle focused exclusively on resolving release blockers and delivering feature completeness. Remaining Cycle 10 tech debt (Inc 5–6: UI Performance Quick Wins, Component Extraction) is explicitly deferred to post-release cycles to maintain scope focus.

---

## Increment Plan

### Inc 1: Repository Restructure (PBI-RP-001)

**Goal:** Move meta-files and source code to the repository root so that GitHub, npm, and the Obsidian marketplace can detect, build, and publish the plugin.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `package.json` (move to root) | Enable `npm install` from repo root | ~10 (path updates) |
| 2 | `manifest.json`, `tsconfig.json`, `esbuild.config.mjs`, `eslint.config.mjs`, `vitest.config.ts` | Move all build config to root | ~30 (path updates) |
| 3 | `src/` (move to root) | Plugin source at standard location | ~0 (move only) |
| 4 | `tests/` (move to root) | Tests at standard location | ~0 (move only) |
| 5 | All `import` statements | Update relative paths across codebase | ~100 (bulk update) |
| 6 | `tests/structure/pathVerification.test.ts` | Verify key paths resolve correctly from new structure | ~30 |

**Est. total:** ~170 LOC changes, ~5 new tests

**Test intent:** Verify all 3,000+ existing tests pass from the new structure. Add path verification tests to guard against future regressions. Level: integration (full build + test suite).

**Documentation intent:** Update `AGENTS.md` with new directory structure. Update `README.md` with root-level setup instructions.

**Architecture seams:** Build configuration files (esbuild, vitest, tsconfig paths). Import path boundaries across `src/` and `tests/`. Plugin manifest location referenced by Obsidian loader.

**Acceptance criteria:**
- [ ] `package.json` at repository root
- [ ] `npm install` works from root
- [ ] `npm test` passes all existing tests
- [ ] `npm run build` produces `main.js`, `manifest.json`, `styles.css`
- [ ] No broken imports or paths
- [ ] `npm run build` passes

---

### Inc 2: Obsidian ESLint Compliance (PBI-RP-002)

**Goal:** Configure Obsidian-specific ESLint rules and fix all violations so the plugin passes Obsidian community review.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `eslint.config.mjs` | Add Obsidian ESLint plugin and rules | ~30 |
| 2 | `src/**/*.ts` | Fix forbidden API usage (innerHTML, deprecated APIs) | ~80 (scattered fixes) |
| 3 | `tests/lint/obsidianCompliance.test.ts` | Verify no forbidden patterns remain | ~20 |

**Est. total:** ~130 LOC changes, ~5 new tests

**Test intent:** Verify all Obsidian ESLint rules pass. Regression tests for forbidden API patterns. Level: static analysis + unit tests.

**Documentation intent:** Document Obsidian-specific code patterns in `AGENTS.md` so future development follows compliant patterns.

**Architecture seams:** ESLint configuration pipeline (`eslint.config.mjs` → `npm run check`). DOM manipulation patterns in UI layer (`src/ui/`). innerHTML usage sites across views.

**Acceptance criteria:**
- [ ] Obsidian ESLint plugin configured in `eslint.config.mjs`
- [ ] All developer policy rules pass
- [ ] No forbidden API usage (unsanitized `innerHTML`, deprecated APIs)
- [ ] `npm run check` includes Obsidian ESLint rules
- [ ] `npm run build` passes

---

### Inc 3: CI/CD Pipeline (PBI-RP-003)

**Goal:** Establish GitHub Actions workflows for automated build validation on push and automated release artifact generation.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `.github/workflows/ci.yml` | Build + test on push and PR | ~60 |
| 2 | `.github/workflows/release.yml` | Version bump → build → GitHub release → artifacts | ~80 |
| 3 | `version-bump.mjs` | Script to update version in manifest.json and package.json | ~40 |
| 4 | `versions.json` | Obsidian compatibility version mapping | ~5 |

**Est. total:** ~185 LOC, ~0 new vitest tests (CI validates itself)

**Test intent:** CI workflow validates by running the full test suite on push. Release workflow validated by creating a test release. No new vitest tests — the workflows ARE the test infrastructure. Level: pipeline validation.

**Documentation intent:** Add contributing guide section describing CI/CD expectations. Document release process in README.

**Architecture seams:** GitHub Actions workflow trigger points (push, PR, tag). Build artifact output (`main.js`, `manifest.json`, `styles.css`). Version management (`manifest.json` ↔ `package.json` ↔ `versions.json`).

**Acceptance criteria:**
- [ ] CI workflow runs on push to main and on PRs
- [ ] Release workflow creates GitHub release with correct artifacts (`main.js`, `manifest.json`, `styles.css`)
- [ ] Failed CI blocks merge (branch protection configured)
- [ ] `versions.json` created for Obsidian compatibility tracking
- [ ] `npm run build` passes

---

### Inc 4: Canvas Parser & Importer (PBI-CAN-001)

**Goal:** Migrate existing QuickAdd canvas import scripts into the plugin as a first-class Data Exchange Hub import source with wizard UI and progress events.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/dataExchange/canvas/types.ts` | `CanvasDocument`, `CanvasNode`, `CanvasEdge`, `CanvasGroup`, `ColorMapping` types | ~60 |
| 2 | `src/domain/dataExchange/canvas/canvasParser.ts` | Pure function: parse `.canvas` JSON → `CanvasDocument` | ~80 |
| 3 | `src/domain/dataExchange/canvas/canvasImportService.ts` | Convert parsed nodes to typed vault notes with frontmatter | ~120 |
| 4 | `src/domain/dataExchange/canvas/events.ts` | `canvasImport.execute/progress/completed/failed` events | ~30 |
| 5 | `src/ui/hub/dataExchange/CanvasImportWizard.ts` | 3-page wizard: Select → Preview/Map → Execute | ~100 |
| 6 | `tests/domain/dataExchange/canvasParser.test.ts` | Parser unit tests: nodes, edges, groups, colors | ~80 |
| 7 | `tests/domain/dataExchange/canvasImportService.test.ts` | Import service tests: mapping, frontmatter, conflicts | ~60 |

**Est. total:** ~390 LOC source, ~140 LOC tests, ~40 new tests

**Test intent:** Unit tests for canvas parser (node types, edge directions, group nesting, color mapping, Legend group override). Integration tests for import service (note creation, frontmatter correctness, conflict strategies). Wizard rendering tests. Level: unit + integration.

**Documentation intent:** Update Data Exchange Hub component doc with Canvas import source. Create canvas import flow documentation. Update Event Catalog with canvas import events.

**Architecture seams:** New bounded context `src/domain/dataExchange/canvas/`. CanvasParser as pure function (no side effects). CanvasImportService uses `fileSystemClient` via event-driven file creation. Data Exchange Hub tab registration for canvas source type. Context menu registration for `.canvas` files.

**Acceptance criteria:**
- [ ] Canvas import available from Data Exchange Hub
- [ ] Right-click `.canvas` file shows "Import Canvas" context menu
- [ ] Nodes create typed notes with frontmatter (type, parent, relationships)
- [ ] Legend group overrides default color mapping
- [ ] Groups create container structure via `parent` frontmatter
- [ ] Edges translate to relationship frontmatter (`up`/`down`/`prev`/`next`)
- [ ] Progress events fire per-node during import
- [ ] All existing QuickAdd canvas-importer test scenarios ported and passing
- [ ] `npm run build` passes

---

### Inc 5: Seed Starter Content (PBI-002)

**Goal:** Populate first-run vaults with example content so new users see a living system immediately and understand how to use Flowti.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/installer/steps/SeedContentStep.ts` | `IInstallerStep` implementation (order 30) | ~80 |
| 2 | `var/config/installer/v1/seed/*.json` | Seed content templates (domain, events, flow, sessions, welcome) | ~60 |
| 3 | `tests/domain/installer/seedContentStep.test.ts` | Step execution, idempotency, content verification | ~80 |

**Est. total:** ~140 LOC source, ~80 LOC tests, ~20 new tests

**Test intent:** Unit tests for SeedContentStep (execution, skip-if-exists idempotency). Content verification tests (correct frontmatter, valid templates). Integration test with installer pipeline. Level: unit + integration.

**Documentation intent:** Update Installer component documentation with SeedContentStep. Document seed content structure for future extensibility.

**Architecture seams:** Installer pipeline step interface (`IInstallerStep`, order 30 after FolderScaffoldStep). Seed content stored in `var/config/installer/v1/seed/`. File creation via `fileSystemClient`. Skip logic checks existence of key sentinel files (welcome note, example domain).

**Acceptance criteria:**
- [ ] First-run creates populated example domain in Event Catalog
- [ ] At least 3 session templates available immediately after install
- [ ] Welcome note exists in inbox after install
- [ ] Seed content is idempotent (re-running installer skips existing seed files)
- [ ] SeedContentStep integrates into existing installer pipeline at order 30
- [ ] `npm run build` passes

---

### Inc 6: Pipeline Multi-Source Merge (PBI-006)

**Goal:** Enable multi-source pipeline execution with configurable merge keys and field-level conflict resolution strategies.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `src/domain/dataExchange/pipeline/mergeTypes.ts` | `MergeConfig`, `MergeStrategy`, `MergeKey`, `MergeResult` types | ~40 |
| 2 | `src/domain/dataExchange/pipeline/mergeEngine.ts` | Merge logic: key matching, strategy application, conflict detection | ~120 |
| 3 | `src/domain/dataExchange/pipeline/mergePreview.ts` | Generate preview dataset with conflict highlights | ~60 |
| 4 | `src/ui/hub/dataExchange/MergeConfigPanel.ts` | Source selector, merge key config, strategy picker, preview | ~80 |
| 5 | `tests/domain/dataExchange/pipeline/mergeEngine.test.ts` | Merge key matching, strategies, edge cases | ~100 |
| 6 | `tests/domain/dataExchange/pipeline/mergePreview.test.ts` | Preview generation, conflict highlighting | ~40 |

**Est. total:** ~300 LOC source, ~140 LOC tests, ~30 new tests

**Test intent:** Unit tests for merge engine (key matching, first-wins/last-wins/concatenate strategies, no-match handling, duplicate keys). Preview generation tests (conflict highlighting, merged output correctness). Level: unit + integration.

**Documentation intent:** Update Pipeline documentation with merge capability. Document merge strategies and configuration options.

**Architecture seams:** Pipeline builder extension point for multi-source selection. Merge strategy pattern (pluggable per-field resolution). Merge preview component in pipeline builder UI. Export adapter for merged output (CSV, Base view).

**Acceptance criteria:**
- [ ] Pipeline supports 2+ sources with configurable merge key
- [ ] Merge preview shows combined dataset with conflict highlights
- [ ] At least 2 merge strategies available (first-wins, last-wins)
- [ ] Master data exportable to CSV or external target
- [ ] Existing pipeline tests pass unchanged (no regressions)
- [ ] New tests cover merge logic with conflicting data
- [ ] `npm run build` passes

---

### Inc 7: Polish & Submission

**Goal:** Final validation, version stamping, and Obsidian community plugin marketplace submission.

| Step | File | Purpose | Est. LOC |
|------|------|---------|----------|
| 1 | `manifest.json` | Update version to release version | ~5 |
| 2 | `versions.json` | Obsidian compatibility mapping | ~5 |
| 3 | Full regression suite | Run complete test suite, fix any regressions | ~0 |
| 4 | Obsidian community plugin PR | Submit to `obsidianmd/obsidian-releases` | ~0 |

**Est. total:** ~10 LOC changes, ~5 validation tests

**Test intent:** Full regression suite across all features. Manifest validation tests (version consistency across `manifest.json`, `package.json`, `versions.json`). Build artifact verification (main.js size, required files present). Level: regression + validation.

**Documentation intent:** Prepare release notes summarizing all features. Ensure README is marketplace-ready.

**Architecture seams:** Version management (`manifest.json` ↔ `package.json` ↔ `versions.json`). Build output validation. Obsidian community plugin submission requirements.

**Acceptance criteria:**
- [ ] All tests pass (full regression)
- [ ] `manifest.json` version matches `package.json` version
- [ ] `versions.json` correctly maps plugin version to minimum Obsidian version
- [ ] Build produces clean `main.js`, `manifest.json`, `styles.css`
- [ ] PR submitted to `obsidianmd/obsidian-releases`
- [ ] `npm run build` passes

---

## Dependency Graph

```
Inc 1: Repository Restructure — independent, must complete first
  ├── Inc 2: Obsidian ESLint Compliance (requires Inc 1 structure)
  └── Inc 3: CI/CD Pipeline (requires Inc 1 structure)
       └─────────────────────────────────────────────┐
                                                      │
Inc 4: Canvas Parser & Importer — independent          ├── Inc 7: Polish & Submission
Inc 5: Seed Starter Content — independent              │   (requires all prior)
Inc 6: Pipeline Multi-Source Merge — independent       │
       └─────────────────────────────────────────────┘
```

**Note:** PBI-QC-001 (Quick Capture Ribbons) and PBI-005 (Vault Folder Inbox) were moved to [[Cycle 12 - User Hub Inbox]] and are assumed complete before this cycle starts.

**Parallelism opportunities:**
- Inc 2 and Inc 3 can run in parallel after Inc 1 completes
- Inc 4–6 are all independent of each other and can run in parallel
- Inc 4–6 can start after Inc 1 (repo restructure) since they need the new structure
- Inc 7 requires all prior increments to be complete

**Recommended execution order:**
Phase A: Inc 1 → Inc 2 + Inc 3 (parallel)
Phase B: Inc 4 → Inc 5 → Inc 6 (sequential or parallel as capacity allows)
Phase C: Inc 7

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Repository restructure breaks import paths silently | High | Full test suite (3,000+ tests) validates all paths. Add explicit path verification tests. Incremental move with build check after each step. |
| Obsidian ESLint rules reveal extensive violations | Medium | Run audit first to scope the work. Automated fixable rules applied via `--fix` before manual fixes. Violations are likely concentrated in UI layer. |
| Canvas import complexity exceeds estimates | Medium | Existing QuickAdd scripts provide working reference implementation. Parser is a pure function — testable in isolation without Obsidian runtime. |
| Cross-feature cycle has wide scope (7 increments) | Medium | Phased delivery: Phase A (infrastructure) is independently valuable. Each Phase B increment is independent and can be deferred without blocking submission. Phase C only requires Phase A for a minimal viable submission. Scope reduced from 9 increments — Quick Capture and Vault Folder Inbox moved to Cycle 12. |
| CI/CD setup requires GitHub repository access | Low | GitHub Actions workflow files can be prepared and tested locally via `act`. Branch protection configured post-merge. |
| Canvas Integration PRD at "discovery" stage (FRI 18/35) | Medium | PBI-CAN-001 is scoped to migrating existing QuickAdd scripts (proven functionality), not designing new features. Canvas PRD discovery status does not block implementation of known, validated behavior. |
| Merge strategies for pipeline may need more design | Low | Start with two concrete strategies (first-wins, last-wins). Additional strategies (concatenate, manual) can be added in follow-up increments without breaking existing pipelines. |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Tests added | ~110 new |
| Tests total | ~3,170+ |
| PBIs closed | 6/6 (RP-001, RP-002, RP-003, CAN-001, 002, 006) |
| Release blockers resolved | RB-1, RB-2, RB-3, RB-4, RB-7 (5 of 7) |
| New events | ~10 (canvas import) |
| CI/CD operational | GitHub Actions CI + release workflows |
| Obsidian submission | PR to obsidianmd/obsidian-releases |
| Build green | `npm test` + `npm run build` pass from repository root |

---

## Deferred Items

| Item | Reason | Target |
|------|--------|--------|
| Remaining Cycle 10 tech debt (Inc 5–6) | UI performance and component extraction are valuable but not release-blocking | Post-release maintenance cycle |
| RB-6: Documentation stubs | Not a marketplace requirement; can be improved incrementally | Medium-term |
| Canvas sessions and workspace integration | Canvas PRD phases 2-3; requires canvas import (this cycle) as foundation | Cycle 14+ |
| Advanced merge strategies (concatenate, manual review) | Two strategies sufficient for v1; extensible by design | Post-release |
| BRAT (Beta Reviewer Auto-update Tester) integration | Not required for initial marketplace submission | Post-submission |
| Push/write-back to Azure DevOps | Cycle 11 delivers pull-only; write-back is v2 scope | Cycle 14+ |

---

## Readiness Assessment

> Explicit verification against [[Definition of Ready (Cycle)]].

### 1. Feature PRD Readiness

- [x] **PRD exists and is approved** — [[Release Preparation PRD]] exists (stage: planned, primary cycle driver)
- [x] **PRD stage is approved or in-progress** — Release Preparation: planned; Installer: done; Data Exchange Hub: done; Canvas Integration: discovery
- [x] **FRI scored** — All contributing PRDs have FRI scores recorded
- [x] **FRI meets threshold** — Release Preparation FRI 15/35 (>=11 continuation)
- [ ] **FRI gap noted** — Canvas Integration FRI 18/35 (below 19 new threshold). **Accepted risk**: PBI-CAN-001 migrates existing proven QuickAdd scripts, not new feature design. Canvas PRD stage "discovery" is a gap — PRD should advance to "planned" before or during this cycle.
- [ ] **Technical Review passed** — No formal technical review conducted yet for Release Preparation PRD. **Action**: Schedule technical review before cycle starts.

### 2. Backlog Readiness

- [x] **PBIs defined** — All 6 PBIs exist with problem statements, solution approaches, and acceptance criteria
- [x] **PBIs chunked into increments** — 7 increments across 3 phases, each delivering end-to-end value
- [x] **Dependencies mapped** — Increment dependency graph documented; RB-1 -> RB-2/CI-CD chain identified; cross-feature dependencies (Installer, Data Exchange Hub) resolved; Quick Capture and Vault Folder Inbox delivered in Cycle 12
- [x] **Priority ranked** — Critical (RB-1, RB-2) -> High (RB-3, RB-4, RB-7) -> Polish

### 3. Cycle Plan Document

- [x] **Cycle document exists** — Created with DevelopmentCycle frontmatter, all required fields populated
- [x] **Situation assessment written** — Pre-cycle state with plugin health, feature status, release blockers, projected metrics
- [x] **Cycle goals defined** — 2 goals, each with clear deliverables and PBI mapping
- [x] **Proposed increments specified** — 7 increments, each with goal, step table, estimated LOC, estimated tests
- [x] **Dependency graph drawn** — Phase A → B → C ordering with parallelism opportunities identified
- [x] **Risks identified** — 7 risks with impact ratings and mitigations
- [x] **Success metrics defined** — 8 measurable targets (tests, PBIs, release blockers, CI/CD, submission)
- [x] **Deferred items documented** — 6 items explicitly excluded with rationale and target timing

### 4. Increment Readiness

For each of the 7 increments:
- [x] **Scope statement defined** — Each increment has a goal and step table
- [x] **Acceptance criteria written** — Testable criteria with checkboxes per increment
- [x] **Test intent stated** — Behaviors to test and testing level specified per increment
- [x] **Documentation intent stated** — Docs to create/update specified per increment
- [x] **Architecture seams confirmed** — Domain boundaries, adapters, events, and UI integration points identified per increment
- [x] **Estimated size** — LOC and test count estimates provided per increment

### 5. Quality Baseline

- [x] **Build pipeline green** — `npm test` passes (2,889 tests, 32 skipped, 112 test files as of 2026-02-21). `npm run build` succeeds.
- [x] **No critical bugs open** — Critical technical debt items (TD-02, TD-03, TD-04, TD-05) resolved in prior cycles. No open critical bugs blocking this cycle.
- [ ] **Previous cycle closed** — Cycle 10 is in-progress (4/6 increments done); Cycle 11 and Cycle 12 are planned. **Gate**: Cycle 13 starts only after Cycles 10, 11, and 12 complete their retrospectives and stage histories are updated.

### 6. Pre-Cycle Completion

- [x] **Pre-cycle work documented** — Backlog refinement (2026-02-20) reviewed 78 items, identified release blockers. Cycle sequence review prioritized Azure DevOps to Cycle 11. Inbox review updated 11 items. All planning documented in review files.
- [x] **Inbox signals reviewed** — Relevant inbox items linked to cycle goals: [[We need to have the proper file and folder structure in place before publishing]] -> RB-1; [[We need to implement Obsidian ESLint rules for plugins in order to publish on the marketplace]] -> RB-2; [[Canvas importer must be a first-class plugin feature]] -> PBI-CAN-001; [[Installer should seed starter content on first run]] -> PBI-002.

### Open Actions Before Cycle Start

| Action | Owner | Status |
|--------|-------|--------|
| Complete Cycle 10 (remaining increments + retrospective) | Dev | Blocked on Cycle 10 delivery |
| Complete Cycle 11 (all increments + retrospective) | Dev | Blocked on Cycle 10 completion |
| Complete Cycle 12 - User Hub Inbox (all increments + retrospective) | Dev | Blocked on Cycle 11 completion |
| Technical review for Release Preparation PRD | Dev | Pending |
| Advance Canvas Integration PRD from "discovery" to "planned" | Dev | Pending |

---

## Related

- PRD: [[Release Preparation PRD]] (FRI 15/35), [[Obsidian Canvas Integration PRD]] (FRI 18/35), [[Installer PRD]] (done), [[Data Exchange Hub PRD]] (done)
- PBIs: [[PBI-RP-001 Repository Restructure]], [[PBI-RP-002 Obsidian ESLint Compliance]], [[PBI-RP-003 CI-CD Pipeline]], [[PBI-CAN-001 Canvas Parser and Importer]], [[PBI-002 Seed Starter Content]], [[PBI-006 Pipeline Multi-Source Merge]]
- Tech Debt: None bundled (Cycle 10 remaining debt deferred)
- Reviews: [[backlog-refinement-2026-02-20]], [[Cycle Sequence Review 2026-02-20 Azure DevOps Prioritization]], [[Inbox Review 2026-02-20 Azure DevOps Prioritization]]
- Previous Cycle: [[Cycle 12 - User Hub Inbox]]
