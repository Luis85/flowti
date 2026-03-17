# Plugin as CLI-Managed Project — Design Spec

**Date:** 2026-03-17
**Status:** Approved
**Scope:** Align the Flowti Plugin with every CLI management capability so it can be moved to `01 - Projects/Flowti Plugin/` and managed identically to the CLI project itself.

---

## 1. Problem

The Flowti Plugin at `Development/flowti/` has a working `flowti.config.json` with build/test/devtools/health sections, but lacks the management domain infrastructure the CLI provides: iterations, resources, timelog, deliverables, RAID, CAPA, requirements (in store format), agent roster integration, report pipeline with DAG dependencies, review gates, publish pipeline, reference documentation, health snapshots, and templates. The Plugin also lives outside `01 - Projects/` so the CLI can't discover it.

The ecosystem-alignment work (merged 2026-03-17) fixed domain purity violations and created CLI-compatible test/coverage report generators. This spec completes the remaining 12 gaps.

## 2. Design Decisions

| Decision | Choice |
|----------|--------|
| Project location | Copy to `01 - Projects/Flowti Plugin/` (last step) |
| Config approach | Extend existing `configs/flowti.config.json` in-place |
| Management dirs | Create under Plugin root, matching CLI conventions |
| Report pipeline | Upgrade to CLI's `{id, prerequisites, dependencies}` DAG format |
| Report output | Vault-wide `03 - Resources/Reports/` via `outputDir` |
| Reference docs | Vault-wide `03 - Resources/Reference/` via `referenceDir` |
| Iteration orchestration | Mirror CLI pattern: PO for `new`, Architect for `planned` |
| Agent roster | Reference vault-wide agents from `03 - Resources/Agents/` |
| Requirements migration | Add CLI store frontmatter to existing files, auto-generate IDs |
| Review gates | Target `obsidian-plugin`, wire existing `tests/e2e/` journeys |
| Publish endpoint | `.obsidian/plugins/flowti-ibde/` (existing output location) |

## 3. What Already Works

From the ecosystem-alignment merge:
- `build.commands` — fast, full, watch, distribute
- `test.commands` — unit, flows, e2e
- `devtools.commands` — lint, check, reload
- `devtools.thresholds` — maxComplexity: 15, maxLines: 400
- `health.thresholds` — coverage min 75/target 85, lint 0 errors/10 warnings, tests 7000 min
- `make.templates` — hub, plugin, app
- `reports.dir` — docs/reports
- Domain purity — IYamlParser + IHttpClient injected
- CLI-compatible test + coverage report frontmatter (`generate-cli-reports.mjs`)

## 4. Changes Required

### 4.1 Management Config + Directory Bootstrap

Add `management` section to `configs/flowti.config.json`:

```json
"management": {
  "resources": { "dir": "docs/resources" },
  "timelog": { "dir": "docs/timelog" },
  "deliverables": { "dir": "docs/deliverables" },
  "raid": { "dir": "docs/raid" },
  "requirements": { "dir": "docs/requirements" },
  "capa": { "dir": "docs/capa" },
  "lifecycle": { "featuresDir": "docs/features" },
  "iterations": {
    "dir": "iterations",
    "durationDays": 14,
    "orchestration": {
      "phases": {
        "new": { "agent": "Product Owner", "role": "refiner", "instruction": "Refine goal and identify initial scope items" },
        "planned": { "agent": "Software Architect", "role": "planner", "instruction": "Break scope into actionable technical tasks" }
      }
    }
  },
  "agents": {
    "roster": ["Product Owner", "Software Architect", "Software Developer", "Tester", "UI Designer", "UX Designer"]
  }
}
```

Create directories: `iterations/`, `docs/resources/`, `docs/timelog/`, `docs/deliverables/`, `docs/raid/`, `docs/capa/`

### 4.2 Report Pipeline Alignment

Upgrade `reports` section from `{label, command}` to `{id, label, prerequisites, dependencies}`:

```json
"reports": {
  "dir": "docs/reports",
  "outputDir": "../../03 - Resources/Reports",
  "generators": [
    { "id": "test", "label": "Test Report", "command": "node scripts/generate-test-report.mjs", "prerequisites": ["npx vitest run --reporter=json --outputFile=docs/reports/tests/testreport.json --coverage --coverage.reportsDirectory=docs/reports/coverage --coverage.reporter=json"] },
    { "id": "coverage", "label": "Coverage Report", "command": "node scripts/generate-coverage-report.mjs", "dependencies": ["test"] },
    { "id": "build", "label": "Build Report", "command": "node scripts/generate-build-report.mjs" },
    { "id": "codebase", "label": "Codebase Report", "command": "node scripts/generate-codebase-report.mjs" },
    { "id": "complexity", "label": "Complexity Report", "command": "node scripts/generate-complexity-report.mjs" },
    { "id": "cycle", "label": "Cycle Report", "command": "node scripts/generate-cycle-report.mjs" },
    { "id": "performance", "label": "Performance Report", "command": "node scripts/generate-performance-report.mjs" },
    { "id": "trace", "label": "Trace Report", "command": "node scripts/generate-trace-report.mjs" },
    { "id": "e2e", "label": "E2E Report", "command": "node scripts/generate-e2e-report.mjs" },
    { "id": "status", "label": "Status Report", "dependencies": ["test", "coverage", "codebase", "complexity"] },
    { "id": "summary", "label": "Summary Report", "dependencies": ["test", "coverage", "codebase", "complexity", "status"] }
  ],
  "thresholds": {
    "coverageLines": 80,
    "coverageBranches": 70,
    "maxComplexity": 15,
    "maxFileDecisionPoints": 90,
    "complexityAboveThresholdPct": 5,
    "startupMs": 5000,
    "eslintWarnings": 0
  }
}
```

### 4.3 CLI-Compatible Report Frontmatter

Each report script must output markdown with YAML frontmatter containing at minimum: `type`, `project`, `date`, plus report-specific metrics. Already done for Test Report and Coverage Report. Remaining 7 scripts need the same treatment.

Target frontmatter per report type:

| Report | Type Tag | Key Metrics |
|--------|----------|-------------|
| Build | BuildReport | success, durationMs, outputSize |
| Codebase | CodebaseReport | totalFiles, totalLines, domains, avgFileSize |
| Complexity | ComplexityReport | avgComplexity, maxComplexity, filesAboveThreshold, pct |
| Cycle | CycleReport | cycleNumber, duration, itemsCompleted |
| Performance | PerformanceReport | startupMs, buildMs, testMs |
| Trace | TraceReport | tracedPaths, coveragePct |
| E2E | E2EReport | journeys, passed, failed, skipped |

### 4.4 Reference Documentation

```json
"docs": {
  "referenceDir": "../../03 - Resources/Reference",
  "references": [
    { "id": "event-catalog", "label": "Event Catalog" },
    { "id": "data-dictionary", "label": "Data Dictionary" },
    { "id": "command-reference", "label": "Command Reference" },
    { "id": "tool-reference", "label": "Tool Reference" },
    { "id": "cli-reference", "label": "CLI Reference" }
  ],
  "generators": [
    { "label": "Event Catalog", "command": "node scripts/generate-event-catalog.mjs" },
    { "label": "Data Dictionary", "command": "node scripts/generate-data-dictionary.mjs" },
    { "label": "Command Reference", "command": "node scripts/generate-command-reference.mjs" },
    { "label": "Tool Reference", "command": "node scripts/generate-tool-reference.mjs" },
    { "label": "CLI Reference", "command": "node scripts/generate-cli-reference.mjs" }
  ]
}
```

### 4.5 Review System

```json
"review": {
  "journeysDir": "tests/e2e",
  "target": "obsidian-plugin",
  "build": "npm run build",
  "test": "npm test",
  "teardown": "node scripts/run-e2e.mjs --teardown",
  "rebuild": "node scripts/run-e2e.mjs --rebuild",
  "gates": {
    "coverage": { "statementCoverage": 75 },
    "security": { "required": false },
    "risk": { "criticalMustPass": true },
    "release": { "allGatesMustPass": true }
  }
}
```

### 4.6 Publish Pipeline

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

### 4.7 Health Snapshots

Create `docs/health/snapshots/` directory. Health thresholds already configured; need to verify all 6 CLI dimensions score correctly (tests, coverage, build, lint, security, git).

### 4.8 Templates

```json
"templates": { "dir": "docs/templates" }
```

### 4.9 Requirements Store Migration

Existing `docs/requirements/` files need CLI store frontmatter:
```yaml
---
type: Requirement
id: REQ-001
name: Requirement Name
requirementType: functional
status: draft
priority: should
---
```

Create `docs/requirements/use-cases/` and `docs/requirements/user-stories/` subdirectories if applicable.

### 4.10 Project Move

Final step: copy `Development/flowti/` → `01 - Projects/Flowti Plugin/`. Update:
- `.flowti/config.json` subsystem path
- esbuild output path (relative to new location)
- Root CLAUDE.md references
- Memory files

## 5. Execution Order

```
Phase 1 (Foundation):
  Item 2: Bootstrap management domains ──→ Item 8: Iteration orchestration
  Item 3: Report pipeline alignment ──→ Item 4: Report frontmatter
  Item 10: Health snapshots

Phase 2 (Full Integration):
  Item 5: Reference docs
  Item 6: Review system
  Item 7: Publish pipeline
  Item 9: Requirements migration
  Item 12: Agent roster

Phase 3 (Nice-to-have):
  Item 11: Templates

Phase 4 (Final):
  Item 1: Move to projects folder
```

## 6. Notes

- **`management.lifecycle.featuresDir`** is used instead of a top-level `management.features` because `ManagementConfig` does not include a `features` property — features live under `lifecycle`.
- **Report pipeline deduplication:** The `coverage` generator declares `dependencies: ["test"]` so the shared prerequisite (vitest run with coverage) executes once via the `test` generator. The coverage generator then reads the already-generated data.
- **`reports.allCommand`** is dropped — the CLI's pipeline engine replaces the all-command by resolving the generator DAG.
- **Reference-to-generator mapping:** `docs.references[].id` maps to `docs.generators[].label` by convention (slug match). The CLI resolves references by iterating generators and matching the id to the slugified label.
- **Publish endpoint paths** are resolved relative to the project root (not the config file). `../../.obsidian/plugins/flowti-ibde` resolves correctly from both `Development/flowti/` and `01 - Projects/Flowti Plugin/` because both are 2 levels deep from the vault root.
- **Requirements migration scope:** The Plugin's `docs/requirements/` may be empty or contain non-store-format docs. If empty, Item 9 reduces to creating directory structure + subdirs. Estimate adjusted accordingly during implementation.

## 7. Out of Scope

- CLI enhancements for subsystem discovery (not needed — Plugin moves to projects folder)
- New CLI commands specific to Plugin management
- Plugin build system changes (esbuild config stays as-is, only output path adjusts)
- Obsidian UI modal domain purity (InstallerWizardModal, FlowtiSettingTab — separate tech debt)
