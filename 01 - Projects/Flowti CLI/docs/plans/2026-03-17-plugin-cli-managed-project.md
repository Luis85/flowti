# Plugin as CLI-Managed Project — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Flowti Plugin a fully CLI-managed project using all management capabilities the CLI offers.

**Architecture:** The Plugin at `Development/flowti/` already has build/test/devtools/health/make configured. Report scripts are redirect stubs delegating to CLI generators (already CLI-compatible). This plan adds the missing management config sections, creates entity directories, upgrades report/review/docs/publish config format, and moves the Plugin to `01 - Projects/Flowti Plugin/`.

**Tech Stack:** JSON config files, markdown frontmatter, directory creation. No TypeScript changes.

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-17-plugin-cli-managed-project-design.md`

**All Plugin paths relative to:** `Development/flowti/`

**Key discovery:** Report scripts (`generate-build-report.mjs`, etc.) are redirect stubs via `_redirect.mjs` → CLI generators at `01 - Projects/Flowti CLI/src/domain/reports/generators/`. They already produce CLI-compatible frontmatter. The standalone `generate-cli-reports.mjs` (test + coverage) also has proper frontmatter. No script changes needed — only config format alignment.

**Another discovery:** `docs/templates/` already has 15 templates. `docs/requirements/` is empty. `docs/features/` has 40+ feature dirs.

---

## Chunk 1: Config Overhaul + Directory Bootstrap

Update `configs/flowti.config.json` with all missing CLI sections and create all management directories.

### Task 1.1: Create missing management directories

**Files:**
- Create: `Development/flowti/iterations/` (directory)
- Create: `Development/flowti/docs/resources/` (directory)
- Create: `Development/flowti/docs/timelog/` (directory)
- Create: `Development/flowti/docs/deliverables/` (directory)
- Create: `Development/flowti/docs/raid/` (directory)
- Create: `Development/flowti/docs/capa/` (directory)
- Create: `Development/flowti/docs/requirements/use-cases/` (directory)
- Create: `Development/flowti/docs/requirements/user-stories/` (directory)
- Create: `Development/flowti/docs/health/snapshots/` (directory)

- [ ] **Step 1: Create all directories**

```bash
cd "Development/flowti"
mkdir -p iterations
mkdir -p docs/resources
mkdir -p docs/timelog
mkdir -p docs/deliverables
mkdir -p docs/raid
mkdir -p docs/capa
mkdir -p docs/requirements/use-cases
mkdir -p docs/requirements/user-stories
mkdir -p docs/health/snapshots
```

- [ ] **Step 2: Add .gitkeep files to empty directories**

Git won't track empty directories. Add `.gitkeep` to each:

```bash
cd "Development/flowti"
for dir in iterations docs/resources docs/timelog docs/deliverables docs/raid docs/capa docs/requirements/use-cases docs/requirements/user-stories docs/health/snapshots; do
  touch "$dir/.gitkeep"
done
```

- [ ] **Step 3: Commit**

```bash
git add Development/flowti/iterations/.gitkeep Development/flowti/docs/resources/.gitkeep Development/flowti/docs/timelog/.gitkeep Development/flowti/docs/deliverables/.gitkeep Development/flowti/docs/raid/.gitkeep Development/flowti/docs/capa/.gitkeep Development/flowti/docs/requirements/use-cases/.gitkeep Development/flowti/docs/requirements/user-stories/.gitkeep Development/flowti/docs/health/snapshots/.gitkeep
git commit -m "chore(plugin): create management domain directories for CLI integration"
```

---

### Task 1.2: Overhaul flowti.config.json

**Files:**
- Modify: `Development/flowti/configs/flowti.config.json`

This is the core task — rewrite the config to include all CLI management sections while preserving existing working config.

- [ ] **Step 1: Write the complete updated config**

Replace the entire file with the following. Changes vs current:
- `reports` section: upgraded from `{label, command}` to `{id, label, command, prerequisites?, dependencies?}`, added `outputDir`, removed `allCommand`
- `review` section: restructured from `{commands}` to flat fields + `gates`
- `docs` section: added `referenceDir` and `references[]`
- `publish` section: new
- `management` section: new (all 9 domain dirs + orchestration + roster)
- `templates` section: new

```json
{
	"name": "Flowti Plugin",
	"type": "obsidian-plugin",
	"build": {
		"commands": {
			"fast": "node esbuild.config.mjs --production --no-reports",
			"full": "npm run build",
			"watch": "node esbuild.config.mjs --watch",
			"distribute": "node esbuild.config.mjs --production --no-reports --distribution"
		}
	},
	"test": {
		"commands": {
			"unit": "npx vitest run",
			"flows": "npx vitest run tests/flows/",
			"e2e": "npm run test:e2e"
		}
	},
	"devtools": {
		"commands": {
			"lint": "npx eslint src/",
			"check": "npx tsc --noEmit --skipLibCheck",
			"reload": "node scripts/cli-reload.mjs"
		},
		"thresholds": {
			"maxComplexity": 15,
			"maxLines": 400
		}
	},
	"reports": {
		"dir": "docs/reports",
		"outputDir": "../../03 - Resources/Reports",
		"generators": [
			{
				"id": "test",
				"label": "Test Report",
				"command": "node scripts/generate-test-report.mjs",
				"prerequisites": [
					"npx vitest run --reporter=json --outputFile=docs/reports/tests/testreport.json --coverage --coverage.reportsDirectory=docs/reports/coverage --coverage.reporter=json"
				]
			},
			{
				"id": "coverage",
				"label": "Coverage Report",
				"command": "node scripts/generate-coverage-report.mjs",
				"dependencies": ["test"]
			},
			{
				"id": "build",
				"label": "Build Report",
				"command": "node scripts/generate-build-report.mjs"
			},
			{
				"id": "codebase",
				"label": "Codebase Report",
				"command": "node scripts/generate-codebase-report.mjs"
			},
			{
				"id": "complexity",
				"label": "Complexity Report",
				"command": "node scripts/generate-complexity-report.mjs"
			},
			{
				"id": "cycle",
				"label": "Cycle Report",
				"command": "node scripts/generate-cycle-report.mjs"
			},
			{
				"id": "performance",
				"label": "Performance Report",
				"command": "node scripts/generate-performance-report.mjs"
			},
			{
				"id": "trace",
				"label": "Trace Report",
				"command": "node scripts/generate-trace-report.mjs"
			},
			{
				"id": "e2e",
				"label": "E2E Report",
				"command": "node scripts/generate-e2e-report.mjs"
			},
			{
				"id": "status",
				"label": "Status Report",
				"dependencies": ["test", "coverage", "codebase", "complexity"]
			},
			{
				"id": "summary",
				"label": "Summary Report",
				"dependencies": ["test", "coverage", "codebase", "complexity", "status"]
			}
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
	},
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
	},
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
	},
	"make": {
		"templates": ["hub", "plugin", "app"]
	},
	"publish": {
		"build": "npm run build",
		"test": "npm test",
		"outDir": "../..",
		"artifacts": ["main.js", "manifest.json", "styles.css"],
		"endpoints": [
			{ "name": "Obsidian Plugin", "path": "../../.obsidian/plugins/flowti-ibde", "clean": true }
		]
	},
	"health": {
		"thresholds": {
			"coverage": { "min": 75, "target": 85 },
			"lint": { "maxErrors": 0, "maxWarnings": 10 },
			"tests": { "minPassed": 7000 }
		}
	},
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
					"new": {
						"agent": "Product Owner",
						"role": "refiner",
						"instruction": "Refine goal and identify initial scope items"
					},
					"planned": {
						"agent": "Software Architect",
						"role": "planner",
						"instruction": "Break scope into actionable technical tasks"
					}
				}
			}
		},
		"agents": {
			"roster": [
				"Product Owner",
				"Software Architect",
				"Software Developer",
				"Tester",
				"UI Designer",
				"UX Designer"
			]
		}
	},
	"templates": {
		"dir": "docs/templates"
	}
}
```

- [ ] **Step 2: Validate JSON is well-formed**

```bash
cd "Development/flowti" && node -e "JSON.parse(require('fs').readFileSync('configs/flowti.config.json','utf8')); console.log('Valid JSON')"
```

Expected: `Valid JSON`

- [ ] **Step 3: Verify existing tests still pass**

The config is read at runtime by the CLI, not by the Plugin's test suite. But verify nothing breaks:

```bash
cd "Development/flowti" && npx tsc --noEmit --skipLibCheck
```

Expected: 0 errors.

- [ ] **Step 4: Commit**

```bash
git add Development/flowti/configs/flowti.config.json
git commit -m "feat(plugin): overhaul flowti.config.json — add all CLI management sections"
```

---

### Task 1.3: Seed first iteration plan

**Files:**
- Create: `Development/flowti/iterations/iteration-001-plan.md`

- [ ] **Step 1: Write the iteration plan**

```markdown
---
type: IterationPlan
name: CLI Integration
number: 1
status: new
startDate: 2026-03-17
endDate: 2026-03-31
goal: Complete CLI management integration and move Plugin to projects folder
agents:
  - Product Owner|product-owner.md
  - Software Architect|software-architect.md
  - Software Developer|software-developer.md
---

# #1 — CLI Integration

First Plugin iteration managed by the Flowti CLI. Validates that all management domains, report pipeline, review gates, publish pipeline, and iteration orchestration work correctly for the Plugin.

## Goal

Complete CLI management integration and move Plugin to projects folder

## Scope Items

- [ ] Verify all management commands work (resources, timelog, deliverables, RAID, CAPA, requirements)
- [ ] Verify report pipeline runs end-to-end
- [ ] Verify health scoring across all 6 dimensions
- [ ] Move Plugin to `01 - Projects/Flowti Plugin/`
- [ ] Update all path references post-move
- [ ] Run full test suite from new location

## Transition History

| Date | From | To | Reason |
|---|---|---|---|
| 2026-03-17 | — | new | Initial iteration created during CLI integration |
```

- [ ] **Step 2: Remove .gitkeep from iterations/ (real file now exists)**

```bash
rm -f Development/flowti/iterations/.gitkeep
```

- [ ] **Step 3: Commit**

```bash
git add Development/flowti/iterations/iteration-001-plan.md
git rm --cached Development/flowti/iterations/.gitkeep 2>/dev/null || true
git commit -m "feat(plugin): seed iteration-001 plan for CLI integration"
```

---

## Chunk 2: Update Vault Config + Verify Integration

### Task 2.1: Update vault-level config

**Files:**
- Modify: `.flowti/config.json`

The vault config's `subsystems.plugin.config` was updated during ecosystem-alignment to point at `configs/flowti.config.json`. Verify it's correct.

- [ ] **Step 1: Read and verify current vault config**

```bash
cat .flowti/config.json
```

Expected: `subsystems.plugin.config` = `"configs/flowti.config.json"` and `subsystems.plugin.root` = `"Development/flowti"`.

If already correct, skip to Task 2.2.

---

### Task 2.2: Verify CLI integration (smoke test)

Run CLI commands against the Plugin to verify the config is recognized.

- [ ] **Step 1: Build the CLI**

```bash
cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs
```

Expected: Build succeeds.

- [ ] **Step 2: Run info command**

```bash
cd "01 - Projects/Flowti CLI" && .flowti/bin/main.js info --project="Flowti Plugin" --format=json 2>&1 | head -20
```

Expected: JSON output showing Plugin project info, or an error indicating the CLI doesn't yet resolve subsystem projects. If the CLI doesn't support subsystem project discovery, this is expected — the move in Chunk 3 will make the Plugin discoverable via the standard projects folder.

- [ ] **Step 3: Commit (if any vault config changes were needed)**

```bash
git add .flowti/config.json
git commit -m "chore: verify vault config for Plugin CLI integration"
```

---

## Chunk 3: Move Plugin to Projects Folder

### Task 3.1: Copy Plugin to projects folder

**Files:**
- Create: `01 - Projects/Flowti Plugin/` (entire Plugin directory)
- Modify: `.flowti/config.json` (update subsystem path)
- Modify: `CLAUDE.md` (update path references)

- [ ] **Step 1: Copy the Plugin directory**

```bash
cp -r "Development/flowti" "01 - Projects/Flowti Plugin"
```

- [ ] **Step 2: Remove node_modules from copy (will reinstall)**

```bash
rm -rf "01 - Projects/Flowti Plugin/node_modules"
```

- [ ] **Step 3: Install dependencies in new location**

```bash
cd "01 - Projects/Flowti Plugin" && npm install
```

Expected: Dependencies install successfully.

- [ ] **Step 4: Verify type check from new location**

```bash
cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit --skipLibCheck
```

Expected: 0 errors.

- [ ] **Step 5: Verify tests from new location**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run 2>&1 | tail -10
```

Expected: 7,900+ tests pass.

---

### Task 3.2: Update esbuild output path

**Files:**
- Modify: `01 - Projects/Flowti Plugin/esbuild.config.mjs`

The esbuild config currently outputs to `../../.obsidian/plugins/flowti-ibde/` (relative to `Development/flowti/`). From `01 - Projects/Flowti Plugin/`, `../../` still resolves to `C:\Projects\flowti\`, so the path should work unchanged.

- [ ] **Step 1: Verify the output path resolves correctly**

```bash
cd "01 - Projects/Flowti Plugin" && node -e "const path = require('path'); console.log(path.resolve('../../.obsidian/plugins/flowti-ibde/'))"
```

Expected: `C:\Projects\flowti\.obsidian\plugins\flowti-ibde`

If correct, no esbuild changes needed. If incorrect, update the output path in `esbuild.config.mjs`.

- [ ] **Step 2: Verify build outputs to correct location**

```bash
cd "01 - Projects/Flowti Plugin" && node esbuild.config.mjs --production --no-reports 2>&1 | tail -5
```

Expected: Build succeeds, output in `.obsidian/plugins/flowti-ibde/`.

---

### Task 3.3: Update redirect scripts

**Files:**
- Modify: `01 - Projects/Flowti Plugin/scripts/_redirect.mjs`

The `_redirect.mjs` script resolves the CLI project path as `path.resolve(import.meta.dirname, "..", "..", "..")` + `01 - Projects/Flowti CLI`. From `Development/flowti/scripts/`, three levels up = vault root. From `01 - Projects/Flowti Plugin/scripts/`, three levels up = vault root. So the path should work unchanged.

- [ ] **Step 1: Verify redirect resolution**

```bash
cd "01 - Projects/Flowti Plugin" && node -e "const path = require('path'); console.log(path.resolve('scripts', '..', '..', '..'))"
```

Expected: `C:\Projects\flowti` (vault root).

If correct, no redirect changes needed.

---

### Task 3.4: Update vault config

**Files:**
- Modify: `.flowti/config.json`

- [ ] **Step 1: Update subsystem path**

Change `subsystems.plugin.root` from `"Development/flowti"` to `"01 - Projects/Flowti Plugin"`.

- [ ] **Step 2: Verify config**

```bash
node -e "const c = JSON.parse(require('fs').readFileSync('.flowti/config.json','utf8')); console.log(c.subsystems.plugin.root)"
```

Expected: `01 - Projects/Flowti Plugin`

---

### Task 3.5: Update CLAUDE.md references

**Files:**
- Modify: `CLAUDE.md` (root)

- [ ] **Step 1: Update Plugin path references**

Replace all `Development/flowti/` references with `01 - Projects/Flowti Plugin/`:
- Repository Layout table: path column
- Flowti Plugin Commands section: cd path
- Any other references

- [ ] **Step 2: Update the Plugin Commands section header paths**

The "All commands run from" path should change to `cd "01 - Projects/Flowti Plugin"`.

---

### Task 3.6: Final verification

- [ ] **Step 1: Run full Plugin test suite from new location**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run 2>&1 | tail -10
```

Expected: 7,900+ tests pass, 0 failures.

- [ ] **Step 2: Run type check**

```bash
cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit --skipLibCheck
```

Expected: 0 errors.

- [ ] **Step 3: Run build**

```bash
cd "01 - Projects/Flowti Plugin" && npm run build
```

Expected: Build succeeds, output in `.obsidian/plugins/flowti-ibde/`.

- [ ] **Step 4: Verify CLI discovers Plugin**

```bash
cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs && .flowti/bin/main.js info --project="Flowti Plugin" --format=json 2>&1 | head -20
```

Expected: JSON output showing Plugin project diagnostics.

- [ ] **Step 5: Commit everything**

```bash
git add "01 - Projects/Flowti Plugin" .flowti/config.json CLAUDE.md
git commit -m "feat: move Plugin to 01 - Projects/Flowti Plugin — fully CLI-managed"
```

- [ ] **Step 6: Remove old Plugin location**

After verifying everything works from the new location:

```bash
rm -rf "Development/flowti"
git add Development/flowti
git commit -m "chore: remove old Plugin location at Development/flowti"
```

---

## Final Validation

- [ ] **All management dirs exist** under `01 - Projects/Flowti Plugin/`:
  - `iterations/`, `docs/resources/`, `docs/timelog/`, `docs/deliverables/`, `docs/raid/`, `docs/capa/`, `docs/requirements/use-cases/`, `docs/requirements/user-stories/`, `docs/health/snapshots/`, `docs/templates/`

- [ ] **Config has all sections**: build, test, devtools, reports (with pipeline DAG), review (with gates), docs (with references), make, publish, health, management (all 9 domains + orchestration), templates

- [ ] **Tests pass** from `01 - Projects/Flowti Plugin/` (7,900+)

- [ ] **Build works** and outputs to `.obsidian/plugins/flowti-ibde/`

- [ ] **CLI discovers Plugin** via `flowti info --project="Flowti Plugin"`

- [ ] **Iteration-001 plan exists** with valid frontmatter
