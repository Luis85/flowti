---
type: Backlog
domain: CLI
title: Flowti CLI — Product Backlog
version: 1
created: 2026-03-10
updated: 2026-03-10
status: active
source: "[[Flowti CLI PRD]]"
roadmap: "[[Development Roadmap]]"
tech_debt: "[[Tech Debt]]"
---

# Flowti CLI — Product Backlog

> Extracted from PRD v10. Contains all functional requirements, acceptance criteria, improvements, and feature maturity assessments. The [[Flowti CLI PRD]] holds the product vision, capabilities, and design principles.

---

## 1. Functional Requirements

### FR-01: Interactive Menu System

- [x] FR-01.1: Adaptive start menu — lists projects when they exist; shows "Create Your First Project" when empty
- [x] FR-01.2: Project creation from bundled scaffold definitions or git submodule from remote URL
- [x] FR-01.3: Project detail menu with tools (Make, Build, Review, Publish, Reports, Npm Scripts, etc.)
- [x] FR-01.4: Sub-menus with numbered options and separator support
- [x] FR-01.5: ANSI color output (cyan options, green success, red errors, dim hints)
- [x] FR-01.6: Quit with `q` from any menu, return to start menu with `b`
- [x] FR-01.7: Help with `?` in any menu showing contextual man-page
- [x] FR-01.8: Command execution with timing display
- [x] FR-01.9: Persistent state — selected project remembered across sessions via `.flowti/var/state.json`
- [ ] FR-01.10: Import existing folder as managed project (detect new folders, ask type, generate config)

### FR-02: Non-Interactive Commands

- [x] FR-02.1: All interactive actions available as `flowti <command>` with `--flag=value` syntax
- [x] FR-02.2: Deterministic exit codes (0=success, non-zero=failure)
- [x] FR-02.3: Build commands: `build`, `build:full`, `build:increment`, `build:watch`, `build:distribute`
- [x] FR-02.4: Test commands: `test`, `test:increment`, `test:e2e`
- [x] FR-02.5: Publish commands: `publish`, `publish:all`
- [x] FR-02.6: Report commands: `reports`, `report:{id}`, `reports:audit`
- [x] FR-02.7: Dev tool commands: `dev:reload`, `dev:console`, `dev:errors`, `dev:check`, `dev:lint`, `dev:fix-frontmatter`, `dev:testdata`
- [x] FR-02.8: Make commands: `make:component`, `make:layout`, `make:page`, `make:ui-component`, `make:system`, `make:container`, `make:c4-component`, `make:person`, `make:app`
- [x] FR-02.9: Info and help: `info`, `help [section]`
- [x] FR-02.10: Event Catalog commands: `events:list`, `events:add --name=X --domain=Y`
- [x] FR-02.11: Capture commands: `capture:idea --text="..."`, `capture:note --type=X --title="..."`
- [x] FR-02.12: Project commands: `project:deps`
- [x] FR-02.13: Scaffold marketplace commands: `scaffold:marketplace`, `scaffold:import --file=<path>`
- [x] FR-02.14: Event contract/version commands: `events:contracts`, `events:version`, `events:codegen`

### FR-03: Component System (C4 Architecture + UI Building Blocks)

- [x] FR-03.1: Eight component types: Generic Component, Layout, Page, UI Component, C4 System, C4 Container, C4 Component, C4 Person
- [x] FR-03.2: Declarative JSON definitions bundled into binary
- [x] FR-03.3: Template registry mapping templateId → render function
- [x] FR-03.4: Pure plan builder: `buildComponentPlan(vars, definition, registry) → FileEntry[]`
- [x] FR-03.5: Each component generates documentation, test file, and definition JSON
- [x] FR-03.6: C4 entities include c4Level, technology, containedBy, and kind-specific sections
- [x] FR-03.7: Component discovery via `docs/components/*.md` frontmatter scanning
- [x] FR-03.8: Interactive component browser with kind labels and status display
- [x] FR-03.9: Non-interactive make commands for all 8 types
- [x] FR-03.10: Variable interpolation in definition file paths
- [x] FR-03.11: Configurable per-project via `make.templates` in config
- [x] FR-03.12: ECS-compatible component properties with defaults and descriptions
- [x] FR-03.13: Properties rendered in documentation, definitions, and Storybook argTypes
- [x] FR-03.14: Storybook v10 story file generation with self-contained render functions
- [x] FR-03.15: Extended component data model — icon, heroImage, images, domain fields

### FR-04: Man-Page System

- [x] FR-04.1: 10 help sections (main, make, build, review, publish, reports, devtools, capture, knowledgebase, info)
- [x] FR-04.2: `flowti help [section]`
- [x] FR-04.3: `?` in interactive menu context
- [x] FR-04.4: Each section documents options, commands, flags, and typical usage

### FR-05: Gated Publish Pipeline

- [x] FR-05.1: Three-stage pipeline: Build → Test → Publish
- [x] FR-05.2: Session-scoped state (build pass unlocks test, test pass unlocks publish)
- [x] FR-05.3: "Run all" sequential execution with fail-fast
- [x] FR-05.4: Visual pipeline state indicator
- [x] FR-05.5: Dry-run mode (`publish --dry-run`)

### FR-06: Auto-Generated CLI Documentation

- [x] FR-06.1: Generator script that parses CLI source
- [x] FR-06.2: Strips ANSI codes, extracts HELP sections, maps commands
- [x] FR-06.3: Outputs vault note with YAML frontmatter
- [x] FR-06.4: Tables: non-interactive commands, npm scripts, report generators, make config
- [x] FR-06.5: Runs as part of report generation
- [x] FR-06.6: Registered in config as report `cli-ref`

### FR-07: Info Command

- [x] FR-07.1: Project metadata (name, version)
- [x] FR-07.2: Source statistics (TS files, test files, CSS layers, scripts)
- [x] FR-07.3: Dependency counts
- [x] FR-07.4: Git status (branch, commit, clean/dirty)
- [x] FR-07.5: Config health (report count, endpoints file, config file)

### FR-08: Per-Project Configuration

- [x] FR-08.1: Each project configured via `configs/flowti.config.json`
- [x] FR-08.2: Auto-scaffolding from `package.json` on first project selection
- [x] FR-08.3: Mappable tools enable/disable menu items per project
- [x] FR-08.4: Publish config (build, test, outDir, artifacts, endpoints)
- [x] FR-08.5: Review config (journeysDir, runner, build, test)
- [x] FR-08.6: CLI kernel config in `.flowti/config.json`
- [x] FR-08.7: Make template config
- [ ] FR-08.8: `type` field on ProjectConfig: `"project" | "typescript" | "typescript-cli" | "obsidian-plugin"`
- [ ] FR-08.9: `build.commands` map for named build modes
- [ ] FR-08.10: `test.commands` map for named test presets
- [ ] FR-08.11: `devtools.commands` map for project-specific developer tools
- [ ] FR-08.12: `paths` section for non-standard project layouts

### FR-09: Scaffold Definitions (Project Creation)

- [x] FR-09.1: JSON scaffold definitions bundled into binary
- [x] FR-09.2: Definition validation on load
- [x] FR-09.3: Variable interpolation in prompts and file paths
- [x] FR-09.4: Interactive prompts from definition
- [x] FR-09.5: "Load Git Project from Remote" option (git submodule)
- [x] FR-09.6: Post-create next steps
- [ ] FR-09.7: `flowti-bare` scaffold definition (bare markdown project)
- [ ] FR-09.8: `flowti-cli` scaffold definition (TypeScript CLI)
- [ ] FR-09.9: `flowti-obsidian-plugin` scaffold definition (Obsidian plugin)

### FR-10: Resilient Report Generation

- [x] FR-10.1: "Run All Reports" runs each generator independently — never stops on failure
- [x] FR-10.2: Pass/fail/duration per generator
- [x] FR-10.3: Run summary after all generators complete
- [x] FR-10.4: Failed reports are signals, not blockers
- [x] FR-10.5: Only publish pipelines enforce strict gating
- [x] FR-10.6: Individual report generators (`report:{id}`) run standalone
- [x] FR-10.7: Prerequisites with deduplication
- [x] FR-10.8: Warnings for non-fatal issues
- [x] FR-10.9: Three-state summary icons (✓, ⚠, ✗)
- [x] FR-10.10: Summary surfaces individual lint and TypeDoc issues

### FR-11: Event Catalog

- [x] FR-11.1: Per-project event catalog in `docs/events/`
- [x] FR-11.2: Interactive menu (List, Add)
- [x] FR-11.3: Non-interactive commands
- [x] FR-11.4: Event definition: name, domain, version, description, producers, consumers, payload
- [x] FR-11.5: Generated Markdown with YAML frontmatter
- [x] FR-11.6: Auto-discovered wikilinks
- [x] FR-11.7: Duplicate detection
- [x] FR-11.8: Alphabetical sorting

### FR-12: E2E Review Pipeline

- [x] FR-12.1: E2E journey testing
- [x] FR-12.2: CLI help output verification
- [x] FR-12.3: Non-interactive build verification
- [x] FR-12.4: Info command verification

### FR-13: Plugin System

- [x] FR-13.1: Vault-level plugin directory at `.flowti/plugins/<name>/manifest.json`
- [x] FR-13.2: Plugin manifest schema
- [x] FR-13.3: Command validation
- [x] FR-13.4: Plugin discovery
- [x] FR-13.5: Namespaced commands registered in CommandRegistry
- [x] FR-13.6: Collision detection
- [x] FR-13.7: Interactive menu (List, Validate, Create, Reference)
- [x] FR-13.8: Non-interactive commands
- [x] FR-13.9: Plugin scaffolding
- [x] FR-13.10: Plugin Reference document generation

### FR-14: AI Tool Management

- [x] FR-14.1: Vault-level AI tool directory at `.flowti/ai-tools/<name>.json`
- [x] FR-14.2: Tool definition schema
- [x] FR-14.3: Typed parameters
- [x] FR-14.4: Tool validation
- [x] FR-14.5: Tool discovery
- [x] FR-14.6: Interactive menu (List, Validate, Create, Reference)
- [x] FR-14.7: Non-interactive commands
- [x] FR-14.8: Tool scaffolding
- [x] FR-14.9: AI Tool Reference document generation

### FR-15: Health Dashboard

- [x] FR-15.1: Aggregate metrics from report frontmatter (7 categories)
- [x] FR-15.2: `collectHealth(ctx)` returns typed `HealthSnapshot`
- [x] FR-15.3: Console summary with color-coded indicators
- [x] FR-15.4: Interactive menu key `h`
- [x] FR-15.5: Non-interactive `health` command
- [x] FR-15.6: Numeric scoring (0–100, A–F) with configurable thresholds
- [x] FR-15.7: Health trends — snapshot persistence, delta indicators

### FR-16: Cross-Project Dependencies

- [x] FR-16.1: Detect dependencies via package.json and config
- [x] FR-16.2: DFS-based cycle detection
- [x] FR-16.3: Mermaid diagram generation
- [x] FR-16.4: `project:deps` command
- [x] FR-16.5: Interactive dependency browser

### FR-17: Scaffold Marketplace

- [x] FR-17.1: Local definition discovery
- [x] FR-17.2: Validate and classify definitions
- [x] FR-17.3: Marketplace listing
- [x] FR-17.4: Import external definitions
- [x] FR-17.5: Non-interactive commands
- [x] FR-17.6: Export bundles for cross-vault sharing

### FR-18: Event Contracts

- [x] FR-18.1: Parse payload tables from Event Catalog
- [x] FR-18.2: Load and validate contracts
- [x] FR-18.3: Structural validation
- [x] FR-18.4: Export contracts as JSON
- [x] FR-18.5: `events:contracts` command
- [x] FR-18.6: Runtime payload validation
- [x] FR-18.7: TypeScript codegen from contracts

### FR-19: Event Versioning

- [x] FR-19.1: Version history rendering
- [x] FR-19.2: Version bumping with migration notes
- [x] FR-19.3: `events:version` command

### FR-20: Standalone CLI Mode

- [x] FR-20.1: Bootstrap two-mode design (dev/standalone)
- [x] FR-20.2: Run without source tree when binary exists
- [x] FR-20.3: Config fallback to vault root
- [x] FR-20.4: Clear error messaging
- [x] FR-20.5: Test vault provisioning with fresh binary

### FR-21: Agent-Native Interface

- [x] FR-21.1: `--format=json` output on query commands
- [x] FR-21.2: `--quiet` and `--verbose` global flags
- [x] FR-21.3: `--no-color` flag
- [x] FR-21.4: Post-command next-step suggestions
- [x] FR-21.5: Shell completion generation (bash, zsh, fish, PowerShell)
- [ ] FR-21.6: Progress indicators — spinners and progress bars

### FR-22: Quality Gates

- [x] FR-22.1: Configurable quality gates that block publish
- [x] FR-22.2: npm audit integration in health scoring
- [x] FR-22.3: Technical debt estimation
- [x] FR-22.4: Report diff mode

---

## 2. Acceptance Criteria

- [x] `node .flowti/bin` runs without source tree present
- [x] `npm run dev` starts interactive menu with project selection and quits cleanly with `q`
- [x] Start menu allows opening existing projects and creating new ones from scaffold definitions
- [x] Selecting a project shows detail menu with tools
- [x] Projects without `flowti.config.json` get auto-scaffolded config
- [x] Mappable tools disabled when not configured
- [x] Component system creates docs, tests, definitions, and stories for all 8 types
- [x] Review creates test vault outside git repository
- [x] Publish pipeline enforces build → test → distribute gating
- [x] `npm run build` compiles and bundles without errors
- [x] `npm test` passes with all tests green
- [x] `?` shows contextual help in any menu
- [x] Report generation runs resiliently — failures don't stop the run
- [x] Event Catalog creates, lists, and auto-links events per project
- [x] Plugin system discovers, validates, and scaffolds plugins
- [x] AI Tools system discovers, validates, and scaffolds tool definitions
- [x] Reference documents generated to `docs/reference/`
- [x] AI agent can build, test, and scaffold via non-interactive commands
- [x] Health dashboard aggregates metrics and renders scoring
- [x] Cross-project dependency detection with cycle analysis
- [x] Event contracts parse payload tables and export JSON
- [x] Standalone mode works without source tree
- [ ] Start menu includes "Import Project" option
- [ ] 4 scaffold definitions available (bare, typescript, cli, obsidian-plugin)
- [ ] Import flow detects new folders and generates management config
- [ ] `config.type` field drives project-type-specific behavior

---

## 3. Improvements

### Completed (Phases 1–7)

| ID | Improvement | Phase |
|----|-------------|-------|
| IMP-01 | Non-interactive project selection (`--project=<name>`) | 1 |
| IMP-02 | Journey scaffolding | 1 |
| IMP-03 | Report archive navigation | 1 |
| IMP-04 | Component relationships (C4 hierarchy) | 2 |
| IMP-05 | Project health dashboard | 3 |
| IMP-06 | Config validation (45 rules) | 1 |
| IMP-07 | Review pipeline gating | 3 |
| IMP-08 | Capture integration | 2 |
| IMP-09 | Definition marketplace (local) | 3 |
| IMP-10 | Cross-project dependencies | 3 |
| IMP-12 | Self-update (build freshness) | 7 |
| IMP-13 | Plugin system | 3 |
| IMP-14 | Event Catalog enrichment | 2 |
| IMP-15 | Component property editor | 2 |
| IMP-16 | Event flow visualization | 2 |
| IMP-17 | Storybook v10 integration | 3 |
| IMP-18 | Event contract validation + TypeScript codegen | 6 |
| IMP-19 | AI Tool management | 3 |
| IMP-20 | Health CLI command + scoring | 4 |
| IMP-21 | Plugin exit code propagation | 4 |
| IMP-22 | Capture enrichment (tags, search, import) | 6 |
| IMP-23 | Config deep validation | 4 |
| IMP-24 | AI Tool execution | 6 |
| IMP-25 | Marketplace export + remote registry | 6, 7 |
| IMP-26 | Health trends | 6 |
| IMP-27 | Interactive dependency browser | 7 |
| IMP-28 | `--format=json` output | 5 |
| IMP-29 | Quality gates | 5 |
| IMP-30 | Scaffold `--dry-run` | 5 |
| IMP-32 | Report diff mode | 5 |
| IMP-33 | Post-command suggestions | 5 |
| IMP-34 | Global output flags (--quiet, --verbose, --no-color) | 5 |
| IMP-35 | Shell completions | 7 |
| IMP-36 | Change-based selective review | 7 |
| IMP-37 | Plugin lifecycle hooks | 7 |
| IMP-40 | Template versioning | 7 |
| IMP-41 | npm audit integration | 6 |
| IMP-42 | Technical debt estimation | 6 |
| IMP-43 | Report caching | 7 |
| IMP-44 | HTML report export | 7 |
| IMP-45 | Parallel report generation | 7 |

### Planned (Phase 8+)

| ID | Improvement | Description | Phase |
|----|-------------|-------------|-------|
| IMP-11 | CI/CD generation | Generate GitHub Actions / Azure Pipelines from config | 9 |
| IMP-31 | Progress indicators | Spinners and progress bars for long operations | Deferred |
| IMP-38 | MCP server mode | Expose CLI as a Model Context Protocol server | 9 |
| IMP-39 | AGENTS.md generation | Auto-generate AI agent instruction files | 9 |

---

## 4. Feature Maturity Assessment

Each domain is assessed on a 3-tier scale:

- **Deep** — Feature-complete, well-tested, handles edge cases, interactive + non-interactive modes.
- **Functional** — Core use case works, but gaps remain.
- **Shallow** — Proof of concept or metadata-only — needs significant work.

| Domain | Maturity | Notes |
|--------|----------|-------|
| Component System (FR-03) | Deep | 8 types, properties, Storybook, C4 hierarchy, editing, browser |
| Interactive Menu (FR-01) | Deep | Two-stage menu, state persistence, ANSI output, help system |
| Report Generation (FR-10) | Deep | Resilient runner, prerequisites, warnings, caching, parallel phases, diff, HTML export |
| Non-Interactive Commands (FR-02) | Deep | 84 commands, `--format=json`, comprehensive AI agent surface |
| Per-Project Config (FR-08) | Deep | Auto-scaffolding, 45 validation rules, deep validation |
| Event Catalog (FR-11) | Deep | CRUD, wikilinks, payload editor, versioning, contracts, codegen |
| Gated Publish (FR-05) | Deep | Pipeline, dry-run, quality gates |
| Plugin System (FR-13) | Deep | Discovery, validation, scaffolding, lifecycle hooks, remote registry |
| Review Pipeline (FR-12) | Deep | Test vault isolation, fresh build, cleanup |
| Health Dashboard (FR-15) | Deep | Scoring, trends, security, tech debt estimation |
| AI Tools (FR-14) | Functional | Definitions, execution, dry-run. No output capture or chaining. |
| Scaffold Definitions (FR-09) | Functional | 1 bundled definition. 3 more planned (Phase 8.0). |
| Cross-Project Deps (FR-16) | Deep | Detection, cycles, Mermaid, interactive browser, filtering, stats |
| Marketplace (FR-17) | Deep | Export bundles, remote registry, install from URL |
| Event Contracts (FR-18) | Deep | Parsing, validation, JSON export, TypeScript codegen |
| Capture (FR-02.11) | Functional | Tags, search, batch import. No structured templates. |
| Standalone CLI (FR-20) | Deep | Bootstrap two-mode, config fallback, fresh build |
| Agent-Native (FR-21) | Deep | `--format=json`, `--quiet`, `--verbose`, `--no-color`, completions, suggestions |
| Quality Gates (FR-22) | Deep | Configurable rules, npm audit, debt estimation, report diffs |
| **Project Onboarding** | Functional | 1 scaffold def, no import flow. **Phase 8 target: 4 types + import.** |

---

## 5. Data Model

### Configuration Files

| File | Location | Purpose |
|------|----------|---------|
| `.flowti/config.json` | Vault root | Kernel config: projects folder, subsystem mappings |
| `.flowti/var/state.json` | Vault root | Persistent state: selected project |
| `.flowti/plugins/<name>/manifest.json` | Vault root | Plugin manifests |
| `.flowti/ai-tools/<name>.json` | Vault root | AI tool definitions |
| `configs/flowti.config.json` | Per-project | Project config (tools, publish, review, make, reports, health) |

### Bundled Definitions

| Definition | Source |
|------------|--------|
| `flowti-project.json` | `src/domain/scaffold/definitions/` |
| `component.json`, `layout.json`, `page.json`, `ui-component.json` | `src/domain/make/component/definitions/` |
| `c4-system.json`, `c4-container.json`, `c4-component.json`, `c4-person.json` | `src/domain/make/component/definitions/` |

### Generated Artifacts

| Artifact | Path | Trigger |
|----------|------|---------|
| Component docs/tests/defs/stories | `<project>/docs/components/`, `<project>/tests/`, `<project>/src/components/` | `make:*` commands |
| Event catalog | `<project>/docs/events/` | `events:add` |
| Reports | `<project>/reports/` | `reports` command |
| References | `<project>/docs/reference/` | `docs` command |
