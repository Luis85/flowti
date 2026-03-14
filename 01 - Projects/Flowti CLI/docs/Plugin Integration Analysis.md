---
type: Analysis
domain: CLI
title: Plugin Integration Analysis
version: 1
created: 2026-03-10
updated: 2026-03-14
status: active
source: "[[Development Roadmap]]"
tech_debt: "[[Tech Debt]]"
---

# Plugin Integration Analysis

> What needs to happen — on both sides — to make the Flowti Plugin a managed Flowti CLI project.
>
> **Core principle**: The Plugin is concerned with what happens INSIDE the vault in Obsidian. The CLI manages everything AROUND it — building, testing, reporting, E2E, devtools. All external tooling infrastructure migrates from the Plugin to the CLI.

---

## 1. Current State Comparison

| Dimension | Flowti CLI | Flowti Plugin | Gap |
|-----------|-----------|---------------|-----|
| **Source files** | 377 | 480 | Similar scale |
| **Tests** | 5,920 (317 suites) | 7,697 (331 suites) | Comparable test coverage |
| **Events** | ~20 (event catalog) | 406+ (FlowtiEventMap) | Entirely different event systems |
| **Build tool** | esbuild (single file) | esbuild + CSS concatenation + distribution | Plugin has multi-step build |
| **Dependencies** | 0 runtime | 3 runtime (Obsidian, Zod, PapaParse) | Plugin needs bundler |
| **Config schema** | `ProjectConfig` (types.ts) — extended with type, commands maps | Flat JSON (flowti.config.json) | Schema extended (TD-01 resolved) |
| **Report generators** | 8 (6 internal + 2 reference) | 14 (all script-based) | Different execution model |
| **E2E testing** | Journey executor + 5 providers | ObsidianCli + 9 journeys + helpers | Plugin needs running Obsidian |
| **Domain services** | None (stateless commands) | 20 (with DI container) | Fundamentally different |
| **UI framework** | Terminal menus (inquirer-style) | Obsidian Views (DOM-based) | No overlap |

---

## 2. Config Schema Gap Analysis

### CLI's ProjectConfig (current)

```typescript
interface ProjectConfig {
  name: string;
  tools?: { build?: string; reports?: string; devtools?: string };
  make?: { templates?: ("journey" | "component")[] };
  components?: { storybook?: boolean; storybookDir?: string };
  reports?: {
    dir?: string;
    generators?: { id?: string; label: string; command?: string; prerequisites?: string[]; dependencies?: string[] }[];
    thresholds?: SummaryThresholds;
  };
  docs?: {
    generators?: { label: string; command: string }[];
    referenceDir?: string;
  };
  publish?: { build?: string; test?: string; outDir?: string; artifacts?: string[]; endpoints?: PublishEndpoint[] };
  review?: { journeysDir?: string; testVault?: string; pluginId?: string; build?: string; test?: string };
  health?: HealthConfig;
}
```

### Plugin's flowti.config.json (current)

```json
{
  "paths": {
    "pluginRoot": "Development/flowti",
    "pluginOutput": ".obsidian/plugins/flowti-ibde",
    "reports": "docs/reports",
    "e2eVault": "../flowti-e2e",
    "endpointsFile": "build-endpoints.json"
  },
  "build": {
    "entry": "src/main.ts",
    "commands": { "fast": "...", "increment": "...", "full": "...", "watch": "...", "distribute": "..." }
  },
  "test": {
    "commands": { "unit": "...", "increment": "...", "e2e": "..." }
  },
  "devtools": {
    "commands": { "reload": "...", "console": "...", "errors": "...", "fixFrontmatter": "...", "testdata": "...", "check": "...", "lint": "..." }
  },
  "review": {
    "commands": { "e2e": "...", "increment": "...", "release": "...", "teardown": "...", "rebuild": "..." }
  },
  "publish": {
    "commands": { "increment": "...", "e2e": "...", "release": "..." }
  },
  "make": {
    "hub": { "src": "...", "ui": "...", "domain": "...", ... },
    "plugin": { "output": "..." }
  },
  "reports": {
    "dir": "docs/reports",
    "scripts": [
      { "id": "test", "label": "Test Report", "script": "generate-test-report.mjs" },
      ...14 entries
    ],
    "categories": [...],
    "stableReports": [...]
  }
}
```

### Extended ProjectConfig (single schema)

The CLI's `ProjectConfig` is the authoritative schema. It is extended with the fields needed for plugin projects. The Plugin must rewrite its `flowti.config.json` to conform. There is no dual-format support.

```typescript
type ProjectTarget = "project" | "typescript" | "typescript-cli" | "obsidian-plugin";

interface ProjectConfig {
  name: string;
  type?: ProjectTarget;

  // Named command maps for multi-mode operations
  build?: {
    commands?: Record<string, string>;  // fast, increment, full, watch, distribute
    entry?: string;                     // main entry point
    css?: { srcDir?: string; outFile?: string };  // CSS pipeline
  };
  test?: {
    commands?: Record<string, string>;  // unit, flows, increment, e2e, coverage
  };

  // Paths section for non-standard layouts
  paths?: {
    pluginRoot?: string;
    pluginOutput?: string;
    reports?: string;
    e2eVault?: string;
    endpointsFile?: string;
  };

  make?: MakeConfig;
  components?: ComponentsConfig;
  reports?: ReportsConfig & {
    scripts?: { id: string; label: string; script: string }[];
    categories?: { dir: string; label: string }[];
    stableReports?: { file: string; label: string }[];
  };
  docs?: DocsConfig;
  publish?: PublishConfig & {
    commands?: Record<string, string>;
  };
  review?: ReviewConfig & {
    commands?: Record<string, string>;
  };
  devtools?: {
    commands?: Record<string, string>;
  };
  health?: HealthConfig;
}
```

**No migration rules.** The `tools` field is replaced by `build.commands`, `test.commands`, etc. Projects using the old `tools.build` single-string format must update to the new schema.

---

## 3. What Needs to Change in the CLI

### 3.1 Config & Type System (Critical)

**Files**: `src/infrastructure/types.ts`, `src/domain/project/project-config.ts`, `src/domain/project/config-schema.ts`

- Add `ProjectTarget` type: `"project" | "typescript" | "typescript-cli" | "obsidian-plugin"`
- Add `type` field to `ProjectConfig`
- Extend `ProjectConfig` with new fields (`build.commands`, `test.commands`, `devtools.commands`, `paths`, `reports.scripts[]`)
- Type detection heuristics for import: `manifest.json` → obsidian-plugin, `bin` in package.json → typescript-cli, `package.json` → typescript, else → project
- Validate all config fields with clear error messages

### 3.1b Project Onboarding (Critical)

**Files**: `src/domain/project/project.ts`, `src/domain/scaffold/scaffold-service.ts`

The CLI supports two scenarios for getting a project under management:

**Scenario 1 — Create New**: User selects "Create Project" → picks a project type from 4 scaffold definitions → CLI creates folder + all files. This already works for the `flowti-project` definition. Three new definitions needed: `flowti-bare`, `flowti-cli`, `flowti-obsidian-plugin`.

**Scenario 2 — Import Existing**: User selects "Import Project" → CLI says *"Copy the folder into the projects directory and press Enter"* → CLI diffs the project list before/after to detect new folders → if multiple found, user picks one or imports all → CLI asks which project type → generates `configs/flowti.config.json` + any missing management files.

**4 scaffold definitions**:

| ID | Type | Creates |
|----|------|---------|
| `flowti-bare` | `project` | `README.md`, `docs/`, `configs/flowti.config.json` — no code |
| `flowti-project` | `typescript` | Existing. TS strict + Vitest + esbuild + ESLint |
| `flowti-cli` | `typescript-cli` | Like TS project + `#!/usr/bin/env node`, arg parser, `bin` in package.json |
| `flowti-obsidian-plugin` | `obsidian-plugin` | `manifest.json`, `styles.css`, esbuild with Obsidian externals, `main.ts extends Plugin` |

### 3.2 Build Domain (High)

**File**: `src/domain/build/build.ts`

Current: single `tools.build` command → `shell.run()`.
Needed:
- Support `build.commands` map with named modes
- `flowti build` runs `build.commands.fast` (or `tools.build` fallback)
- `flowti build:increment` runs `build.commands.increment`
- `flowti build:full` runs `build.commands.full`
- `flowti build:watch` runs `build.commands.watch`
- `flowti build:distribute` runs `build.commands.distribute`

### 3.3 Test Domain (Medium)

**File**: Currently in `build.ts` (test is a build step)

Needed:
- `flowti test` runs `test.commands.unit` (or `tools.test` fallback)
- `flowti test:increment` runs `test.commands.increment`
- `flowti test:e2e` runs `test.commands.e2e`

### 3.4 Report Pipeline (High)

**File**: `src/domain/reports/report-pipeline.ts`

Needed:
- `toScriptStep()` adapter: wraps `{ id, label, script }` entries as pipeline steps
- Script resolution: `node scripts/{script}` with project cwd
- Both `generators[]` and `scripts[]` feed into the same pipeline
- Support `categories[]` for archive folder organization
- Support `stableReports[]` for non-timestamped report tracking

### 3.5 Devtools Domain (Medium)

**File**: `src/domain/devtools/devtools.ts`

Needed:
- Read `devtools.commands` map from config
- Generate menu items dynamically from command map
- Support Obsidian-specific devtools (`reload`, `console`, `errors`)

### 3.6 Review Domain (Medium)

**File**: `src/domain/review/review.ts`

Needed:
- Read `review.commands` map from config
- Support `review.testVault` and `review.pluginId` for Obsidian plugin E2E
- Integrate with existing E2E journey providers (obsidian-plugin provider)

### 3.7 Menu System (Medium)

**File**: `src/ui/mainMenu.ts`

Needed:
- Show/hide menu items based on `project.type`
- `dev:reload` only for `obsidian-plugin` projects
- Build sub-menu shows available build modes from `build.commands`
- Test sub-menu shows available test presets from `test.commands`

---

## 4. What Needs to Change in the Plugin

### 4.1 Config Rewrite (Critical)

**File**: `Development/flowti/flowti.config.json`

The Plugin's config must be rewritten to conform to `ProjectConfig`. The CLI dictates the schema — the Plugin satisfies it.

**Mapping**:

| Plugin Field | ProjectConfig v2 Field |
|-------------|----------------------|
| `paths.pluginRoot` | `paths.pluginRoot` (passthrough) |
| `paths.pluginOutput` | `paths.pluginOutput` (passthrough) |
| `paths.reports` | `reports.dir` |
| `paths.e2eVault` | `paths.e2eVault` (passthrough) |
| `build.commands.*` | `build.commands.*` (passthrough) |
| `test.commands.*` | `test.commands.*` (passthrough) |
| `devtools.commands.*` | `devtools.commands.*` (passthrough) |
| `review.commands.*` | `review.commands.*` (passthrough) |
| `publish.commands.*` | `publish.commands.*` (new) |
| `reports.scripts[]` | `reports.scripts[]` (passthrough) |
| `reports.categories[]` | `reports.categories[]` (passthrough) |
| `make.hub.*` | `make.hub.*` (passthrough) |

**Added fields**:
```json
{
  "name": "flowti-ibde",
  "type": "obsidian-plugin"
}
```

### 4.2 Project Registration (High)

The Plugin project needs to be in the CLI's project list. Currently projects are discovered by scanning the `01 - Projects/` folder. The Plugin lives at `Development/flowti/` — outside that folder.

**Resolution**: The Plugin folder must be copied or symlinked into `01 - Projects/`. This is handled by the new import flow:

1. User selects "Import Project" in the Start Menu
2. Copies `Development/flowti/` into `01 - Projects/Flowti Plugin/` (or symlinks it)
3. CLI detects the new folder, asks for the project type → user selects "Obsidian Plugin"
4. CLI generates `configs/flowti.config.json` conforming to `ProjectConfig`

Alternatively, if the Plugin should stay at `Development/flowti/`, a future enhancement could support additional project discovery paths in `.flowti/config.json`. But for now: projects live in `01 - Projects/`.

### 4.3 Report Script Compatibility (Medium)

Plugin's 14 report generators are scripts at `Development/flowti/scripts/generate-*.mjs`. They:
- Import from the Plugin's source tree
- Write output to `docs/reports/`
- Use Plugin-specific data (EventMap, ServiceContainer, etc.)

These scripts remain external to the CLI. The CLI's report pipeline just needs to run them as shell commands: `node scripts/generate-{script}` with `cwd` set to the Plugin's project path.

No changes needed in the Plugin's scripts themselves.

### 4.4 E2E Infrastructure Migration (Critical)

The Plugin currently owns the entire E2E testing infrastructure (~8,000 LOC across 15 helpers). **All of this moves to the CLI.** The Plugin keeps only its journey definition files (JSON blueprints).

**What migrates from Plugin to CLI**:

| Component | LOC | Description |
|-----------|-----|-------------|
| `ObsidianCli.ts` + `types.ts` | ~440 | Typed wrapper around Obsidian 1.12+ CLI binary. 36 methods (file I/O, eval, plugin management, DOM, screenshots). |
| `journeyExecutor.ts` | 656 | Reads JSON journey definitions → generates vitest describe/it blocks. Step refs, skip-mode, gate flags. |
| `actionRunner.ts` | 1,362 | Dispatches 45+ declarative actions (command, click, input, highlight, assert, eval, screenshot, etc.). |
| `journey.ts` | 524 | JourneyRunner class: step execution, screenshot capture, result tracking. |
| `journeyTypes.ts` | 640 | Type definitions: 66 tool types, JourneyDefinition, StepDefinition, ActionDefinition. |
| `fixtures.ts` | 412 | Test fixture factory: vault scaffolding, plugin enable, event trace, cleanup. |
| `testVault.ts` | 134 | TestVault class: scaffold/reset/destroy isolated E2E vault. |
| `highlight.ts` | 341 | DOM highlighting CSS injection for screenshots. |
| `navigation.ts` | 180 | Hub tab navigation helpers. |
| `errorContext.ts` | 158 | Failure diagnostics: DOM state, EventBus events, plugin health. |
| `toolCatalog.ts` | 1,086 | Tool metadata registry with schemas and examples. |
| `seedRegistry.ts` | 175 | Test data fixtures: seed folders, sample files. |
| `sequencer.ts` | 60 | Alphabetical test file ordering. |
| `parallelGroup.ts` | 478 | Batch action execution. |
| `qc.ts` | 94 | Quality checkpoint helpers. |
| `globalSetup.ts` | 244 | Vault scaffolding, plugin artifact setup, test data generation. |
| `globalTeardown.ts` | ~200 | Results collection, report writing, event trace export. |

**What stays in the Plugin**:

| Component | Description |
|-----------|-------------|
| Journey definition files (`.journey` JSON) | 9 journey blueprints declaring steps, tools needed, lifecycle config |
| Flow tests (`tests/flows/`) | 45 integration tests — unit-style, no Obsidian process needed |
| `esbuild.config.mjs` | Build pipeline (TS compilation, CSS concat, distribution, watch mode) |

### 4.5 The Journey-as-Blueprint Model

A journey definition is a **contract** between the project and the CLI:

```json
{
  "journey": "component-library",
  "chapter": 4,
  "requires": {
    "target": "obsidian-plugin",
    "tools": ["command", "click", "eval", "screenshot", "create-file", "assert-text"]
  },
  "lifecycle": {
    "enablePlugin": true,
    "startTrace": true
  },
  "steps": [
    {
      "id": "open-component-hub",
      "title": "Open the Component Hub",
      "actions": [
        { "tool": "command", "payload": "flowti:open-component-library" },
        { "tool": "screenshot", "payload": "component-hub-opened" }
      ]
    }
  ]
}
```

The project says: *"Here's how you test me. I need these tools. Please provide them."*

The CLI fulfills the contract:
1. Reads `requires.target` → selects the `obsidian-plugin` environment provider
2. Reads `requires.tools` → validates all requested tools are available
3. Merges the provider's tool implementations with the journey's tool registry
4. Runs the journey: setup → steps → teardown → results

**This is already partially designed** in the CLI's journey executor (`src/domain/e2e/journey/`). The CLI has environment providers for 5 targets. What's missing is the ObsidianCli-backed tool implementations — those come from the migration.

### 4.6 Build System

The Plugin's `esbuild.config.mjs` (551 LOC) stays in the Plugin. It handles TypeScript compilation, CSS concatenation, distribution, watch mode, and hot-reload. The CLI invokes it via `build.commands.*` entries.

The CLI does NOT need to understand the esbuild internals — it just runs the configured shell commands.

---

## 5. Boundary Definition: Plugin vs CLI

The migration creates a clean separation of concerns:

### Plugin Owns (Inside Obsidian)

| Domain | What |
|--------|------|
| **Runtime** | All domain services, EventBus, UI views, settings, storage |
| **Build** | `esbuild.config.mjs`, `css/` source files, `manifest.json` |
| **Flow tests** | `tests/flows/` — 45 integration tests, unit-style, no Obsidian process |
| **Journey blueprints** | `.journey` JSON files declaring "test me like this" |
| **Domain events** | 406+ events in FlowtiEventMap |
| **UI components** | ComponentRegistry, Hub views, modals, sidebars |

### CLI Owns (Around Obsidian)

| Domain | What |
|--------|------|
| **Project management** | Create, import, configure, select projects |
| **Build orchestration** | Named build modes (`fast`, `increment`, `full`, `watch`, `distribute`) |
| **Test orchestration** | Named test presets (`unit`, `flows`, `e2e`, `increment`) |
| **Report pipeline** | 8 built-in generators + script-based generators, caching, parallel phases |
| **Doc pipeline** | Reference generators, doc pipeline engine |
| **E2E infrastructure** | ObsidianCli, journey executor, action runner, fixtures, testVault, all helpers |
| **Devtools** | `dev:reload`, `dev:console`, `dev:errors`, `fix-frontmatter`, `testdata` |
| **Health & quality** | Scoring, trends, security, tech debt, quality gates |
| **Publishing** | Gated pipeline, distribution to endpoints |

### The Contract

Projects communicate their testing needs through journey definitions with a `requires` section. The CLI resolves the requirements and provides the tool implementations.

```
Project:  "I need tools: command, click, eval, screenshot"
          "My target is: obsidian-plugin"
          "Here are my steps: [...]"

CLI:      "I have an obsidian-plugin provider with ObsidianCli"
          "I can provide: command, click, eval, screenshot (+ 40 more)"
          "Running your journey now..."
```

### 5.1 Event Catalog (Future — Phase 9)

The CLI has a simple event catalog with contracts and codegen. The Plugin has 406+ events in a typed EventMap. A shared contract format would enable cross-project event validation.

### 5.2 Component System (Future — Phase 9)

Both systems have component registries. Unification is complex and low-priority. Both work independently.

---

## 6. Migration Sequence

### Sprint 1: Config Foundation & Project Types (TD-01, TD-02, TD-16)

1. Add `ProjectTarget` type: `"project" | "typescript" | "typescript-cli" | "obsidian-plugin"`
2. Add `type` field to `ProjectConfig`
3. Extend `ProjectConfig` with new fields (`build.commands`, `test.commands`, `devtools.commands`, `paths`, `reports.scripts[]`)
4. Create 3 new scaffold definitions (`flowti-bare`, `flowti-cli`, `flowti-obsidian-plugin`)
5. Implement project import flow (detect new folders, ask type, generate config)
6. Update config parser to validate the extended schema
7. Import the Plugin into `01 - Projects/` and rewrite its `flowti.config.json`
8. Fix `FLOWTI_TOOLS` constant

**Deliverable**: `flowti` CLI offers 4 project types for creation, supports importing existing folders, loads Plugin project, reads its config.

### Sprint 2: Build & Test Integration (8.1, 8.2)

1. Update `build.ts` to support `build.commands` map
2. Update test commands to support `test.commands` map
3. Wire named build/test modes into menu system
4. Test: `flowti build` and `flowti test` work against Plugin project

**Deliverable**: Plugin builds and tests are runnable from CLI.

### Sprint 3: Report & Doc Pipelines (8.3, 8.4)

1. Add `toScriptStep()` adapter for `reports.scripts[]`
2. Verify doc pipeline works with Plugin's doc generators
3. Support `reports.categories[]` and `stableReports[]`
4. Test: `flowti reports` generates all 14 Plugin reports through pipeline

**Deliverable**: Plugin reports run through CLI pipeline with structured summaries.

### Sprint 4: Devtools & Menu (8.6)

1. Dynamic devtools from `devtools.commands` config
2. Project-type-aware menu (show/hide items based on `config.type`)
3. Obsidian-specific devtools: `dev:reload`, `dev:console`, `dev:errors`

**Deliverable**: Full Plugin management experience through CLI.

### Sprint 5: E2E Infrastructure Migration (8.5, 8.8)

1. Migrate `ObsidianCli` + types to CLI's `src/infrastructure/cli/`
2. Migrate all E2E helpers to CLI's `src/domain/e2e/`: journey executor, action runner, fixtures, testVault, highlight, navigation, errorContext, toolCatalog, seedRegistry, sequencer, parallelGroup, qc
3. Migrate globalSetup/globalTeardown to CLI's E2E infrastructure
4. Enhance `obsidian-plugin` environment provider with ObsidianCli-backed tool implementations
5. Add `requires.tools` resolution to journey executor — validate requested tools against provider
6. Plugin's `.journey` files stay in Plugin, reference CLI's tool registry
7. Remove migrated infrastructure from Plugin (only journey JSON files + flow tests remain)
8. Integration test: run Plugin's 9 E2E journeys from CLI

**Deliverable**: CLI owns all E2E infrastructure. Projects declare journeys as blueprints; CLI fulfills tool requirements.

### Sprint 5: E2E Enhancement (8.5)

1. Enhance obsidian-plugin provider with ObsidianCli tools
2. Wire Plugin E2E presets through review domain
3. Support `review.testVault` and `review.pluginId`
4. Integration testing: run Plugin E2E suite from CLI

**Deliverable**: Plugin E2E journeys can be managed and executed through CLI.

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| CLI config update requires existing projects to update their configs | Medium | Low | Schema changes are additive; existing fields remain valid |
| Plugin scripts fail when run from different cwd | Low | Medium | Always set `cwd` to plugin project path |
| ObsidianCli dependency on running Obsidian | High | Medium | E2E tests remain optional; unit tests unaffected |
| Config schema divergence over time | Low | Medium | Single `ProjectConfig` type as source of truth; CLI dictates, projects conform |
| Report pipeline performance with 14 generators | Low | Low | Pipeline already supports phased execution |

---

## 8. Success Criteria

Phase 8 is complete when:

- [ ] `flowti` CLI loads the Plugin project from project list
- [ ] `flowti build` runs Plugin's fast build
- [ ] `flowti build:full` runs Plugin's full build (tests → build → reports)
- [ ] `flowti test` runs Plugin's unit tests
- [ ] `flowti test:e2e` runs Plugin's E2E suite
- [ ] `flowti reports` generates all 14 Plugin reports with pipeline summaries
- [ ] `flowti docs` generates Plugin reference documents
- [ ] `flowti health` shows Plugin health snapshot
- [ ] `flowti dev:reload` reloads Plugin in Obsidian
- [ ] Plugin's existing `npm` scripts continue to work independently
- [ ] Plugin's `flowti.config.json` conforms to CLI's `ProjectConfig` schema
