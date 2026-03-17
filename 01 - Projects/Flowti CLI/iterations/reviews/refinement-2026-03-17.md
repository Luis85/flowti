---
type: RefinementSession
date: 2026-03-17
itemsReviewed: 15
itemsRefined: 12
---

# Backlog Refinement — 2026-03-17

## Summary

- Items reviewed: 15
- Items refined: 12
- Items merged: 2 (config section + directory bootstrap → single item)
- Items rejected: 0

## Goal

Make the Flowti Plugin a fully CLI-managed project, using **all** management capabilities the CLI provides. The Plugin will be moved from `Development/flowti/` to `01 - Projects/Flowti Plugin/` once all alignment work is complete.

## Gap Analysis

Compared CLI's full ProjectConfig schema (138 commands, 9 stores, 32 report generators, 6 health dimensions) against Plugin's current state. Found 15 gaps across config schema alignment, management domain bootstrapping, report integration, and project discovery.

### Already Done (from ecosystem-alignment merge)
- `build.commands` — configured
- `test.commands` — configured
- `devtools.commands` — configured
- `health.thresholds` — configured
- `make.templates` — configured
- Domain purity — IYamlParser + IHttpClient injected
- CLI-compatible test + coverage report generators created
- TrainService + AnalyticsEngine decomposed

## Refined Items

| # | Item | Estimate | Priority | Status |
|---|------|----------|----------|--------|
| 1 | Move Plugin to `01 - Projects/Flowti Plugin/` | M (2-4h) | must (last) | refined |
| 2 | Bootstrap all management domains | M (2-4h) | must | refined |
| 3 | Report pipeline alignment | L (4-8h) | must | refined |
| 4 | CLI-compatible report frontmatter | M (2-4h) | must | refined |
| 5 | Reference documentation setup | M (2-4h) | should | refined |
| 6 | Review system alignment | M (2-4h) | should | refined |
| 7 | Publish pipeline setup | S (<2h) | should | refined |
| 8 | Iteration management with orchestration | M (2-4h) | must | refined |
| 9 | Requirements store migration | L (4-8h) | should | refined |
| 10 | Health snapshot infrastructure | S (<2h) | must | refined |
| 11 | Templates directory | S (<2h) | could | refined |
| 12 | Agent roster integration | S (<2h) | should | refined |

## Item Details

### 1. Move Plugin to `01 - Projects/Flowti Plugin/`

**Priority:** must (execute last — after all other items)
**Estimate:** M (2-4h)

Copy `Development/flowti/` → `01 - Projects/Flowti Plugin/`. Update all path references:
- `.flowti/config.json` subsystem path
- esbuild output path (must still target `.obsidian/plugins/flowti-ibde/`)
- CLAUDE.md references (root + CLI project)
- Memory files referencing Plugin paths

**Acceptance Criteria:**
- [ ] `flowti info --project="Flowti Plugin"` returns valid diagnostics
- [ ] `flowti build --project="Flowti Plugin"` succeeds
- [ ] `flowti test --project="Flowti Plugin"` succeeds
- [ ] Build output still lands in `.obsidian/plugins/flowti-ibde/`
- [ ] All tests pass from new location
- [ ] `Development/flowti/` removed or archived

---

### 2. Bootstrap All Management Domains

**Priority:** must
**Estimate:** M (2-4h)

Add `management` section to Plugin's `configs/flowti.config.json` with all domain directories. Create missing directories and seed with first entities where useful.

**Config additions:**
```json
"management": {
  "resources": { "dir": "docs/resources" },
  "timelog": { "dir": "docs/timelog" },
  "deliverables": { "dir": "docs/deliverables" },
  "raid": { "dir": "docs/raid" },
  "requirements": { "dir": "docs/requirements" },
  "capa": { "dir": "docs/capa" },
  "features": { "dir": "docs/features" },
  "iterations": { "dir": "iterations", "durationDays": 14 },
  "agents": { "roster": ["Product Owner", "Software Architect", "Software Developer", "Tester", "UI Designer", "UX Designer"] }
}
```

**Directories to create:** `iterations/`, `docs/resources/`, `docs/timelog/`, `docs/deliverables/`, `docs/raid/`, `docs/capa/`

**Acceptance Criteria:**
- [ ] All 7 management directories exist
- [ ] Config `management` section has all domain dirs wired
- [ ] `flowti resources:list --project="Flowti Plugin"` returns empty (not error)
- [ ] `flowti raid:list --project="Flowti Plugin"` returns empty (not error)
- [ ] `flowti deliverables:list --project="Flowti Plugin"` returns empty (not error)

---

### 3. Report Pipeline Alignment

**Priority:** must
**Estimate:** L (4-8h)

Upgrade Plugin's report generators from `{label, command}` format to CLI's pipeline format: `{id, label, prerequisites, dependencies}`. Add `outputDir` pointing to vault-wide reports folder. Add Status and Summary DAG-chained report generators.

**Current (wrong):**
```json
{ "label": "Test Report", "command": "node scripts/generate-test-report.mjs" }
```

**Target (CLI format):**
```json
{ "id": "test", "label": "Test Report", "prerequisites": ["npx vitest run --reporter=json --outputFile=docs/reports/tests/testreport.json --coverage"] }
```

**New generators to add:**
- `status` — depends on [test, coverage, codebase, complexity]
- `summary` — depends on [test, coverage, codebase, complexity, status]

**Acceptance Criteria:**
- [ ] All generators use `{id, label, prerequisites?, dependencies?}` format
- [ ] `reports.outputDir` set to `../../03 - Resources/Reports`
- [ ] `flowti reports --project="Flowti Plugin"` runs the full pipeline
- [ ] Status and Summary reports generated with correct dependencies
- [ ] Prerequisites run before report generation (vitest, tsc, etc.)

---

### 4. CLI-Compatible Report Frontmatter

**Priority:** must
**Estimate:** M (2-4h)

Ensure all 14 report scripts output markdown with CLI-parseable YAML frontmatter. Test and Coverage reports already done (ecosystem-alignment). Remaining: build, complexity, codebase, cycle, performance, trace, e2e.

**Required frontmatter format:**
```yaml
---
type: BuildReport
project: Flowti Plugin
date: 2026-03-17T10:00:00Z
success: true
durationMs: 4500
---
```

**Acceptance Criteria:**
- [ ] All report scripts produce markdown with YAML frontmatter
- [ ] `type` field matches CLI expectations (TestReport, CoverageReport, BuildReport, etc.)
- [ ] `project: Flowti Plugin` in all reports
- [ ] `flowti health --project="Flowti Plugin"` can parse all report frontmatter
- [ ] No report script crashes on missing input data (graceful warnings)

---

### 5. Reference Documentation Setup

**Priority:** should
**Estimate:** M (2-4h)

Add `docs.referenceDir` and `docs.references[]` to config. The Plugin already has 5 doc generators — wire them into the CLI reference system.

**Config additions:**
```json
"docs": {
  "referenceDir": "../../03 - Resources/Reference",
  "references": [
    { "id": "event-catalog", "label": "Event Catalog" },
    { "id": "data-dictionary", "label": "Data Dictionary" },
    { "id": "command-reference", "label": "Command Reference" },
    { "id": "tool-reference", "label": "Tool Reference" },
    { "id": "cli-reference", "label": "CLI Reference" }
  ]
}
```

**Acceptance Criteria:**
- [ ] `docs.referenceDir` and `docs.references` configured
- [ ] Reference docs generate to vault-wide `03 - Resources/Reference/`
- [ ] Each reference has a unique `id` matching an existing generator

---

### 6. Review System Alignment

**Priority:** should
**Estimate:** M (2-4h)

Restructure `review` config from `{commands}` to CLI format with journeys, target, and quality gates.

**Target format:**
```json
"review": {
  "journeysDir": "tests/e2e",
  "target": "obsidian-plugin",
  "build": "npm run build",
  "test": "npm test",
  "gates": {
    "coverage": { "statementCoverage": 75 },
    "security": { "required": false },
    "risk": { "criticalMustPass": true },
    "release": { "allGatesMustPass": true }
  }
}
```

**Acceptance Criteria:**
- [ ] `review` section follows CLI schema
- [ ] `flowti review --project="Flowti Plugin"` launches review pipeline
- [ ] Quality gates evaluate against configured thresholds
- [ ] E2E journeys in `tests/e2e/` are discoverable

---

### 7. Publish Pipeline Setup

**Priority:** should
**Estimate:** S (<2h)

Add `publish` section so `flowti publish` can build, test, and deploy the Plugin.

**Config:**
```json
"publish": {
  "build": "npm run build",
  "test": "npm test",
  "outDir": "../..",
  "artifacts": ["main.js", "manifest.json", "styles.css"],
  "endpoints": [
    { "name": "Obsidian Plugin", "path": "../../.obsidian/plugins/flowti-ibde", "clean": true }
  ]
}
```

**Acceptance Criteria:**
- [ ] `flowti publish --project="Flowti Plugin"` builds, tests, copies artifacts
- [ ] Artifacts land in `.obsidian/plugins/flowti-ibde/`
- [ ] Build/test gates run before publish

---

### 8. Iteration Management with Orchestration

**Priority:** must
**Estimate:** M (2-4h)

Create `iterations/` directory, seed first iteration plan, configure orchestration phases binding agents to iteration lifecycle states.

**Config additions (within management.iterations):**
```json
"iterations": {
  "dir": "iterations",
  "durationDays": 14,
  "orchestration": {
    "phases": {
      "new": { "agent": "Product Owner", "role": "refiner", "instruction": "Refine goal and identify initial scope items" },
      "planned": { "agent": "Software Architect", "role": "planner", "instruction": "Break scope into actionable technical tasks" }
    }
  }
}
```

**Acceptance Criteria:**
- [ ] `iterations/` directory exists
- [ ] `iteration-001-plan.md` created with valid frontmatter
- [ ] Orchestration phases configured with agent bindings
- [ ] `flowti lifecycle:list --project="Flowti Plugin"` shows iteration

---

### 9. Requirements Store Migration

**Priority:** should
**Estimate:** L (4-8h)

Migrate existing `docs/requirements/` files to CLI store format. Each requirement needs frontmatter with `type: Requirement`, auto-generated `id: REQ-001`, `status`, `priority`. May also need to create `use-cases/` and `user-stories/` subdirectories.

**Acceptance Criteria:**
- [ ] All requirement files have valid CLI store frontmatter
- [ ] IDs auto-generated (REQ-001, REQ-002, ...)
- [ ] `flowti requirements:list --project="Flowti Plugin"` returns all items
- [ ] `use-cases/` and `user-stories/` subdirs created if applicable
- [ ] No data loss during migration

---

### 10. Health Snapshot Infrastructure

**Priority:** must
**Estimate:** S (<2h)

Create `docs/health/snapshots/` directory. Verify health thresholds cover all 6 CLI dimensions (tests, coverage, build, lint, security, git).

**Acceptance Criteria:**
- [ ] `docs/health/snapshots/` exists
- [ ] `flowti health --project="Flowti Plugin"` scores all 6 dimensions
- [ ] `flowti health:snapshot --project="Flowti Plugin"` saves JSON snapshot
- [ ] Thresholds reasonable for Plugin scale (7,900+ tests, 75%+ coverage)

---

### 11. Templates Directory

**Priority:** could
**Estimate:** S (<2h)

Add `templates.dir` to config, create `docs/templates/` with Plugin-relevant entity templates.

**Acceptance Criteria:**
- [ ] `templates.dir` configured in flowti.config.json
- [ ] `docs/templates/` created with at least 1 template
- [ ] `flowti scaffold:list --project="Flowti Plugin"` shows available templates

---

### 12. Agent Roster Integration

**Priority:** should
**Estimate:** S (<2h)

Add `management.agents` section referencing the vault-wide agent roster. Enable agent dashboard if desired.

**Acceptance Criteria:**
- [ ] `management.agents.roster` lists agents relevant to Plugin
- [ ] `flowti ai:list --project="Flowti Plugin"` returns roster
- [ ] Agents bindable to iteration phases

---

## Execution Order

**Must-do first (foundation):**
1. Item 2 — Bootstrap management domains (config + dirs)
2. Item 3 — Report pipeline alignment (enables health + reports commands)
3. Item 4 — CLI-compatible report frontmatter (enables health scoring)
4. Item 10 — Health snapshot infrastructure
5. Item 8 — Iteration management with orchestration

**Should-do next (full integration):**
6. Item 5 — Reference documentation
7. Item 6 — Review system alignment
8. Item 7 — Publish pipeline
9. Item 9 — Requirements store migration
10. Item 12 — Agent roster integration

**Could-do (nice to have):**
11. Item 11 — Templates directory

**Must-do last:**
12. Item 1 — Move Plugin to projects folder

## Decisions

- Plugin will be **copied** (not symlinked) to `01 - Projects/Flowti Plugin/` as the final step
- Management domain bootstrap and config section merged into a single item for efficiency
- Requirements migration estimated as L due to potential volume (40+ feature dirs to audit)
- Orchestration phases will mirror CLI's own config pattern (PO for new, Architect for planned)
- Report pipeline alignment is the highest-effort item (L) because it touches all 14 generator scripts

## Carry-Over

- None — all 15 original candidates refined into 12 items (2 merged)
