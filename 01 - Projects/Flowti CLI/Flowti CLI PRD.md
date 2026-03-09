---
domain: Flowti
type: ProductRequirementsDocument
stage: complete
version: 10
maturity: L2
created: 2026-03-07
updated: 2026-03-09
related_events: []
maturity_score_strategy: 4
maturity_score_scope: 5
maturity_score_architecture: 4
maturity_score_event_integration: 3
maturity_score_data_model: 4
maturity_score_ui_consistency: 3
maturity_score_validation_testing: 5
business_value: 4
implementation_cost: 2
maintenance_cost: 2
discovery_cost: 1
design_cost: 2
test_cost: 2
priority: 1
tags:
  - cli
  - developer-experience
  - onboarding
  - automation
  - ai-agent
  - definition-driven
  - event-catalog
  - storybook
  - ecs
  - core
plugin: "[[01 - Projects/Flowti CLI/README|README]]"
---

# PRD: Flowti CLI

---

## 1. Problem Statement

Managing development projects requires:

- **Discovery friction** — no single entry point to understand available commands, pipelines, and scaffolding tools across projects.
- **Script sprawl** — each project has its own npm scripts with overlapping names that are difficult to navigate without tribal knowledge.
- **No scaffolding** — creating a new Hub, Component, or C4 entity requires copy-pasting from existing code and manually wiring documentation, tests, and definitions.
- **Per-project configuration** — each project has different build commands, test runners, publish endpoints, and review workflows, but no unified way to manage them.
- **AI Agent gap** — LLM-based coding agents cannot explore interactive menus; they need deterministic, non-interactive commands with predictable output and exit codes.
- **Stale documentation** — CLI capabilities change with every cycle, but manual documentation drifts out of sync.
- **Runtime dependency on source** — tools that require the source tree to be present break in distribution scenarios.

---

## 2. Outcome

After implementation, developers and AI agents will have:

- A **self-contained binary** (`node .flowti/bin`) with no source tree dependency.
- A **definition-driven** scaffolding system where JSON definitions are the single source of truth.
- An **adaptive two-stage interactive menu**: project selection (open/create/plugins/ai-tools) → project detail. Start menu adapts when no projects exist ("Create Your First Project").
- Per-project configuration via `configs/flowti.config.json` with auto-scaffolding from `package.json`.
- **Base feature set**: Project Management, Components, Events, Make, Build, Tests, Reports, Review, Publish, Plugins, AI Tools, Health, Dependencies.
- **Component system** with 8 types: C4 architecture (System, Container, Component, Person) plus UI building blocks (Layout, Page, UI Component) and a generic Component.
- **Event Catalog** for per-project domain event documentation with auto-discovered wikilinks.
- Component and Journey scaffolding from declarative JSON definitions with optional Storybook story generation.
- A gated publish pipeline that enforces build → test → distribute sequencing per project.
- E2E review with test vault isolation (created outside the git repository, with fresh CLI build on every ensure/refresh).
- **Standalone mode** — binary runs without source tree present; bootstrap detects mode automatically.
- **Git submodule projects** — load remote git repositories as submodules instead of clones.
- Non-interactive commands for AI agent tool use with deterministic exit codes.
- Auto-generated reports (test, coverage, codebase, complexity, status, summary) per project with prerequisite chaining and warning surfacing.
- **Plugin system** — vault-level plugins in `.flowti/plugins/<name>/manifest.json` with shell-command-based commands, interactive management menu, and auto-generated reference documentation.
- **AI Tools** — vault-level AI agent tool definitions in `.flowti/ai-tools/<name>.json` with typed parameters, tags, interactive management menu, and auto-generated reference documentation. Currently a **definition and discovery system** — stores metadata for AI agents to consume, but does not execute tools directly (execution planned as IMP-24).
- **Health dashboard** for aggregated project health metrics (tests, coverage, lint, git, components) from report frontmatter.
- **Cross-project dependencies** with DFS cycle detection and Mermaid diagram visualization.
- **Scaffold marketplace** for local definition discovery and import across projects.
- **Event contracts** — parse and validate event payload schemas from Event Catalog documentation.
- **Event versioning** — version bumping with migration notes for backward compatibility tracking.
- **Obsidian opt-in** — vault features (knowledgebase, capture) are optional, not required.
- **Progressive opt-in** — start small, expand into more features and workflows as needed. All restrictions, tests, and quality gates are opt-in features that improve the final product, not mandatory barriers.
- **Resilient report generation** — report runs never stop on failure; broken reports are signals to collect, not blockers. Generators declare prerequisites, surface warnings (lint, TypeDoc, coverage, complexity), and the run summary displays comprehensive issue lists.
- **Component properties** — ECS-compatible key-value pairs (typed, with defaults and descriptions) on component definitions, rendered in documentation, definitions, and Storybook stories.

---

## 2.1 Design Philosophy: Progressive Opt-In

All features, restrictions, and quality gates exist to improve the quality of the final product. None of them are mandatory — every project starts minimal and opts into more sophistication as needed.

| Principle | Description |
|-----------|-------------|
| **Start small** | A new project needs nothing but a name. Configuration is auto-scaffolded with sensible defaults. |
| **Opt-in features** | Tests, linting, coverage thresholds, complexity analysis, E2E review, publish pipelines — all are configured per-project and only active when the project defines them. |
| **Opt-in restrictions** | ESLint rules, coverage minimums, complexity limits, TypeDoc warnings — these are quality gates that projects adopt when ready, not upfront requirements. |
| **Runtime opt-in** | During project runtime, tools like Build, Reports, Review, and Publish are only enabled when the project's `flowti.config.json` maps them. Unmapped tools appear disabled with guidance on how to enable them. |
| **Signals, not blockers** | Report generation runs all generators resiliently. A failed report is a signal (captured in the summary), not a reason to abort the entire run. Only publish pipelines enforce strict gating. |
| **Obsidian is optional** | Knowledgebase, vault capture, and other Obsidian-specific features are available but never required. |

---

## 3. Scope

### In Scope

- Self-contained binary (`node .flowti/bin`) with all definitions bundled
- Two-stage interactive menu (project selection → project detail)
- Project discovery from configured projects directory (`01 - Projects/`)
- Project creation from bundled scaffold definitions
- Per-project configuration via `configs/flowti.config.json` with auto-scaffolding
- Component system with 8 types (5 C4 + 3 UI building blocks) and ECS-compatible properties
- Storybook story file generation for UI components (layout, page, ui-component)
- Event Catalog per project (interactive + non-interactive) with wikilink auto-discovery
- Component and Journey scaffolding from declarative definitions
- Gated publish pipeline with per-project endpoints
- E2E review with test vault isolation (outside git repository)
- Resilient report generation (test, coverage, codebase, complexity, status, summary) — never stops on failure, with prerequisite chaining and warning surfacing
- Man-page system with contextual help (10 sections)
- Info command with live project diagnostics
- Health dashboard for aggregated project metrics
- Cross-project dependency detection with cycle analysis and Mermaid visualization
- Scaffold marketplace for local definition discovery and import
- Event contracts — payload schema parsing, validation, and JSON export
- Event versioning — version bumping with migration notes
- Non-interactive command dispatch for AI agent tool use
- Persistent state (selected project) via `.flowti/var/state.json`
- Standalone CLI mode — run from compiled binary without source tree
- Git submodule project loading from remote URLs

### Out of Scope

- GUI-based CLI (electron/web)
- Remote CLI execution (SSH, CI/CD integration)
- Plugin marketplace publishing (BRAT/community plugins)
- Watching for CLI source changes (provided out-of-the-box by esbuild)
- Interactive prompts for AI agents (agents use non-interactive mode exclusively)
- Obsidian as a hard requirement

---

## 4. UX Entry Points

### Human Developer

| Entry Point | Command | Context |
|-------------|---------|---------|
| Interactive menu | `./flowti.cmd` or `npm run dev` | Two-stage menu: select/create project, manage plugins/AI tools → project tools |
| Quick build | Select project → key `2` | Run the project's configured build command |
| Scaffold | Select project → key `1` | Generate component or journey files |
| Components | Select project → key `c` | Browse project components with C4 metadata and properties |
| Events | Select project → key `e` | Event catalog: list, add, and browse domain events |
| Review | Select project → key `3` | E2E journey review with test vault management |
| Publish | Select project → key `4` | Gated pipeline: build → test → distribute |
| Reports | Select project → key `5` | Run all reports with prerequisites and warning summary |
| Npm scripts | Select project → key `6` | Browse and run any script from package.json |
| Capture | Select project → key `7`/`8` | Quick-capture ideas and typed notes |
| Documentation | Select project → key `d` | Generate reference docs (TypeDoc, CLI Reference) |
| In-menu help | Press `?` in any menu | Contextual help for the current menu |

### AI Agent (Tool Use)

| Capability | Command | Expected Output |
|-----------|---------|----------------|
| Discover commands | `flowti help` | Structured help text (parseable) |
| Build project | `flowti build` | Exit 0 on success, non-zero on failure |
| Run tests | `flowti test` | Exit 0 if all tests pass |
| Add component | `flowti make:component --name=X` | File list output, exit 0 |
| Add C4 system | `flowti make:system --name=X` | File list output, exit 0 |
| List events | `flowti events:list` | Event names with domain and version |
| Add event | `flowti events:add --name=X --domain=Y` | Created file path, exit 0 |
| Capture idea | `flowti capture:idea --text="..."` | Created file path, exit 0 |
| Check project | `flowti info` | Structured project metadata |
| Generate reports | `flowti reports` | Generated report files with warning summary |
| List plugins | `flowti plugin:list` | Installed plugins with validation status |
| Validate plugins | `flowti plugin:validate` | Plugin manifest validation results |
| Create plugin | `flowti plugin:new` | Scaffolded plugin directory, exit 0 |
| Plugin reference | `flowti plugin:reference` | Generated reference doc |
| List AI tools | `flowti ai:list` | AI tool definitions with validation status |
| Validate AI tools | `flowti ai:validate` | Tool definition validation results |
| Create AI tool | `flowti ai:new` | Scaffolded tool definition, exit 0 |
| AI tool reference | `flowti ai:reference` | Generated reference doc |
| Project dependencies | `flowti project:deps` | Dependency tree and Mermaid diagram |
| Marketplace | `flowti scaffold:marketplace` | Available scaffold definitions |
| Import definition | `flowti scaffold:import --file=X` | Imported definition, exit 0 |
| Event contracts | `flowti events:contracts` | Contract JSON export |
| Version event | `flowti events:version --name=X --version=Y` | Updated event file, exit 0 |
| Project health | `flowti health [--format=json]` | Health snapshot with scoring (0–100), grade (A–F) |
| Publish preview | `flowti publish --dry-run` | Pipeline preview without executing |
| Clean test vault | `flowti review:clean` | Remove stale test vault, exit 0 |
| Review pipeline | `flowti review:all` | Build → test → E2E with fail-fast gating |

---

## 5. Functional Requirements

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

### FR-02: Non-Interactive Commands

- [x] FR-02.1: All interactive actions available as `flowti <command>` with `--flag=value` syntax
- [x] FR-02.2: Deterministic exit codes (0=success, non-zero=failure)
- [x] FR-02.3: Build commands: `build`, `build:full`, `build:increment`, `build:watch`, `build:distribute`
- [x] FR-02.4: Test commands: `test`, `test:increment`, `test:e2e`
- [x] FR-02.5: Publish commands: `publish`, `publish:all`
- [x] FR-02.6: Report commands: `reports`, `report:{id}`, `reports:audit`
- [x] FR-02.7: Dev tool commands: `dev:reload`, `dev:console`, `dev:errors`, `dev:check`, `dev:lint`, `dev:fix-frontmatter`, `dev:testdata`
- [x] FR-02.8: Make commands: `make:component --name=X`, `make:layout --name=X`, `make:page --name=X`, `make:ui-component --name=X`, `make:system --name=X`, `make:container --name=X`, `make:c4-component --name=X`, `make:person --name=X`, `make:app --name=X`
- [x] FR-02.9: Info and help: `info`, `help [section]`
- [x] FR-02.10: Event Catalog commands: `events:list`, `events:add --name=X --domain=Y [--version] [--description] [--producers] [--consumers]`
- [x] FR-02.11: Capture commands: `capture:idea --text="..."`, `capture:note --type=X --title="..."`
- [x] FR-02.12: Project commands: `project:deps`
- [x] FR-02.13: Scaffold marketplace commands: `scaffold:marketplace`, `scaffold:import --file=<path>`
- [x] FR-02.14: Event contract/version commands: `events:contracts`, `events:version --name=X --version=Y --migration="..."`

### FR-03: Component System (C4 Architecture + UI Building Blocks)

- [x] FR-03.1: Eight component types: Generic Component, Layout, Page, UI Component, C4 System, C4 Container, C4 Component, C4 Person
- [x] FR-03.2: Declarative JSON definitions bundled into binary (not read from filesystem)
- [x] FR-03.3: Template registry mapping templateId → render function
- [x] FR-03.4: Pure plan builder: `buildComponentPlan(vars, definition, registry) → FileEntry[]`
- [x] FR-03.5: Each component generates documentation (Markdown + YAML frontmatter), test file, and definition JSON
- [x] FR-03.6: C4 entities include c4Level, technology, containedBy, and kind-specific documentation sections
- [x] FR-03.7: Component discovery via `docs/components/*.md` frontmatter scanning
- [x] FR-03.8: Interactive component browser with kind labels and status display
- [x] FR-03.9: Non-interactive commands: `make:component`, `make:layout`, `make:page`, `make:ui-component`, `make:system`, `make:container`, `make:c4-component`, `make:person`
- [x] FR-03.10: Variable interpolation in definition file paths (`{{kebab}}`, `{{pascal}}`, etc.)
- [x] FR-03.11: Configurable per-project via `make.templates` in `flowti.config.json`
- [x] FR-03.12: ECS-compatible component properties — typed key-value pairs (`string | number | boolean`) with defaults and descriptions
- [x] FR-03.13: Properties rendered in documentation tables, definition JSON defaults, and Storybook argTypes
- [x] FR-03.14: Storybook v10 story file generation (`.stories.ts`) with self-contained render functions, Meta/StoryObj, autodocs via tags, kind-aware folder organization, and `storybook/actions` integration
- [x] FR-03.15: Extended component data model — `icon`, `heroImage`, `images[]`, `domain` fields on `ComponentDefinition` for rich documentation and Storybook parameters

### FR-04: Man-Page System

- [x] FR-04.1: 10 help sections (main, make, build, review, publish, reports, devtools, capture, knowledgebase, info)
- [x] FR-04.2: Accessible via `flowti help [section]`
- [x] FR-04.3: Accessible via `?` in interactive menu context
- [x] FR-04.4: Each section documents options, commands, flags, and typical usage

### FR-05: Gated Publish Pipeline

- [x] FR-05.1: Three-stage pipeline: Build -> Test -> Publish
- [x] FR-05.2: Session-scoped state (build pass unlocks test, test pass unlocks publish)
- [x] FR-05.3: "Run all" option that executes stages sequentially, stopping on failure
- [x] FR-05.4: Visual pipeline state indicator (checkmark/circle per stage)
- [x] FR-05.5: Dry-run mode (`publish --dry-run`) previews pipeline without executing

### FR-06: Auto-Generated CLI Documentation

- [x] FR-06.1: Generator script that parses CLI source
- [x] FR-06.2: Strips ANSI codes, extracts HELP sections, maps command descriptions
- [x] FR-06.3: Outputs vault note with YAML frontmatter (`type: CLIReference`)
- [x] FR-06.4: Includes tables: non-interactive commands, npm scripts, report generators, make config
- [x] FR-06.5: Runs automatically as part of `npm run generate:reports` and increment builds
- [x] FR-06.6: Registered in `flowti.config.json` as report `cli-ref`

### FR-07: Info Command

- [x] FR-07.1: Display project metadata (name, version)
- [x] FR-07.2: Display source statistics (TS files, test files, CSS layers, scripts)
- [x] FR-07.3: Display dependency counts (production, development, npm scripts)
- [x] FR-07.4: Display git status (branch, commit, clean/dirty)
- [x] FR-07.5: Display config health (report count, endpoints file, config file)

### FR-08: Per-Project Configuration

- [x] FR-08.1: Each project configured via `configs/flowti.config.json`
- [x] FR-08.2: Auto-scaffolding — config created from `package.json` on first project selection
- [x] FR-08.3: Mappable tools (`tools.build`, `tools.reports`, `tools.devtools`) enable/disable menu items per project
- [x] FR-08.4: Publish config (`publish.build`, `publish.test`, `publish.outDir`, `publish.artifacts`, `publish.endpoints[]`)
- [x] FR-08.5: Review config (`review.journeysDir`, `review.runner`, `review.build`, `review.test`)
- [x] FR-08.6: CLI kernel config in `.flowti/config.json` — subsystem mappings, projects folder, capture directories
- [x] FR-08.7: Make template config (`make.templates`) to control available scaffolding options per project

### FR-09: Scaffold Definitions (Project Creation)

- [x] FR-09.1: JSON scaffold definitions bundled into binary via direct import
- [x] FR-09.2: Definition validation on load (required fields, file mappings)
- [x] FR-09.3: Variable interpolation in prompts and file paths
- [x] FR-09.4: Interactive prompts collected from definition
- [x] FR-09.5: "Load Git Project from Remote" option — adds remote repository as a git submodule
- [x] FR-09.6: Post-create commands (npm install, git init)

### FR-10: Resilient Report Generation

- [x] FR-10.1: "Run All Reports" runs each generator independently — never stops on failure
- [x] FR-10.2: Collect pass/fail/duration per generator
- [x] FR-10.3: Always print a run summary after all generators complete
- [x] FR-10.4: Failed reports are signals (visible in summary), not blockers
- [x] FR-10.5: Only publish pipelines enforce strict gating; report generation is resilient
- [x] FR-10.6: Individual report generators (`report:{id}`) still run standalone
- [x] FR-10.7: Generators declare `prerequisites` (e.g. `npm run test:coverage`) that run before generation; shared prerequisites are deduplicated across generators
- [x] FR-10.8: Generators return `warnings[]` for non-fatal issues (coverage below threshold, lint warnings, TypeDoc warnings, high complexity)
- [x] FR-10.9: Run summary uses three-state icons: `✓` passed, `⚠` passed with warnings, `✗` failed
- [x] FR-10.10: Summary Report surfaces individual lint issues (file:line, message, rule) and TypeDoc issues (both native `[warning]`/`[error]` and TS compilation errors) in the run summary

### FR-11: Event Catalog

- [x] FR-11.1: Per-project event catalog stored in `docs/events/` as Markdown files
- [x] FR-11.2: Interactive event catalog menu (List Events, Add Event) accessible via key `e`
- [x] FR-11.3: Non-interactive commands: `events:list`, `events:add --name=X --domain=Y`
- [x] FR-11.4: Event definition includes name, domain, version, description, producers, consumers, payload schema
- [x] FR-11.5: Generated Markdown includes YAML frontmatter, producers/consumers lists, payload table
- [x] FR-11.6: Auto-discovered wikilinks to sibling files (tests, sources, configs, definitions, components, journeys)
- [x] FR-11.7: Duplicate detection — refuses to overwrite existing event files
- [x] FR-11.8: Events sorted alphabetically in list view

### FR-12: Developer Onboarding Journey

- [x] FR-12.1: E2E journey testing the full onboarding flow: install CLI → create project → build → explore
- [x] FR-12.2: Verify CLI help output is accessible and correct
- [x] FR-12.3: Verify non-interactive build completes successfully
- [x] FR-12.4: Verify Info command returns valid project data

### FR-13: Plugin System

- [x] FR-13.1: Vault-level plugin directory at `.flowti/plugins/<name>/manifest.json`
- [x] FR-13.2: Plugin manifest schema with name, version, description, and commands
- [x] FR-13.3: Command validation — required fields (run), optional fields (description, projectFree)
- [x] FR-13.4: Plugin discovery — scan subdirectories for `manifest.json` files
- [x] FR-13.5: Plugin commands namespaced as `plugin:<pluginName>:<commandName>` and registered in CommandRegistry
- [x] FR-13.6: Plugin collision detection — detects command key conflicts across plugins and built-in commands
- [x] FR-13.7: Interactive Plugins menu (Start Menu → `p`): List, Validate, Create, Generate Reference
- [x] FR-13.8: Non-interactive commands: `plugin:list`, `plugin:validate`, `plugin:new`, `plugin:reference`
- [x] FR-13.9: Plugin scaffolding — `scaffoldPlugin()` creates directory with starter `manifest.json`
- [x] FR-13.10: Plugin Reference document generated via Document service to `docs/reference/Plugin Reference.md`

### FR-14: AI Tool Management

- [x] FR-14.1: Vault-level AI tool directory at `.flowti/ai-tools/<name>.json`
- [x] FR-14.2: Tool definition schema with name, description, version, run command, optional cwd, params, and tags
- [x] FR-14.3: Typed parameters — name, type (`string | number | boolean | array | object`), required flag, description
- [x] FR-14.4: Tool validation with warnings for missing optional fields
- [x] FR-14.5: Tool discovery — scan directory for `.json` files
- [x] FR-14.6: Interactive AI Tools menu (Start Menu → `a`): List, Validate, Create, Generate Reference
- [x] FR-14.7: Non-interactive commands: `ai:list`, `ai:validate`, `ai:new`, `ai:reference`
- [x] FR-14.8: Tool scaffolding — `scaffoldAiTool()` creates starter JSON definition
- [x] FR-14.9: AI Tool Reference document generated via Document service to `docs/reference/AI Tool Reference.md`

### FR-15: Health Dashboard

- [x] FR-15.1: Aggregate project health from report frontmatter — 7 metric categories: source, tests, coverage, build, lint, git, components
- [x] FR-15.2: `collectHealth(ctx)` returns typed `HealthSnapshot` with per-category metrics
- [x] FR-15.3: `displayHealth()` renders console summary with color-coded indicators
- [x] FR-15.4: Accessible via interactive menu key `h` in Project Detail menu
- [x] FR-15.5: Non-interactive command `health` for AI agent use
- [x] FR-15.6: Health scoring — numeric grade per category with configurable thresholds
- [ ] FR-15.7: Health trends — track snapshots over time, display delta indicators

### FR-16: Cross-Project Dependencies

- [x] FR-16.1: Detect dependencies between managed projects via `package.json` (npm deps/devDeps) and `flowti.config.json` (publish endpoints, subsystem references)
- [x] FR-16.2: DFS-based cycle detection across the project graph
- [x] FR-16.3: Mermaid diagram generation for dependency visualization
- [x] FR-16.4: Non-interactive command `project:deps` with text tree and diagram output
- [ ] FR-16.5: Interactive dependency browser in Project Detail menu

### FR-17: Scaffold Marketplace

- [x] FR-17.1: Local definition discovery — scan project `definitions/` directories for scaffold JSON files
- [x] FR-17.2: Validate and classify discovered definitions (scaffold, component, journey)
- [x] FR-17.3: Display marketplace listing with definition metadata and status
- [x] FR-17.4: Import external definitions into a project's definition directory
- [x] FR-17.5: Non-interactive commands: `scaffold:marketplace`, `scaffold:import --file=<path>`
- [ ] FR-17.6: Export/publish definitions for sharing across vaults

### FR-18: Event Contracts

- [x] FR-18.1: Parse payload tables from Event Catalog Markdown files into structured `PayloadField[]`
- [x] FR-18.2: Load and validate event contracts from `docs/events/` directory
- [x] FR-18.3: Structural validation — detect missing required fields, type mismatches
- [x] FR-18.4: Export contracts as JSON via `generateContractsJson()`
- [x] FR-18.5: Non-interactive command `events:contracts` for contract export
- [ ] FR-18.6: Runtime payload validation against contract definitions at test time
- [ ] FR-18.7: TypeScript type generation from event contracts

### FR-19: Event Versioning

- [x] FR-19.1: Version history rendering in event documentation via `renderVersionHistory()`
- [x] FR-19.2: `versionEvent()` bumps event version with migration notes appended to document
- [x] FR-19.3: Non-interactive command `events:version --name=X --version=Y --migration="..."` for AI agent use
- [ ] FR-19.4: Breaking change detection — flag payload removals or type changes between versions

### FR-20: Standalone CLI Mode

- [x] FR-20.1: Bootstrap two-mode design — dev mode (source tree present) vs standalone mode (binary only)
- [x] FR-20.2: When source tree is absent but `.flowti/bin/main.js` exists, run directly without npm ci / build / rebuild
- [x] FR-20.3: `CLI_PROJECT` fallback — `config.ts` resolves to vault root when source directory doesn't exist
- [x] FR-20.4: Clear error messaging when neither source tree nor compiled binary exist
- [x] FR-20.5: Test vault provisioning — Review menu builds CLI fresh and copies binary into test vault on every ensure/refresh

### FR-21: Agent-Native Interface

- [ ] FR-21.1: `--json` output flag on all commands for machine-readable structured output
- [ ] FR-21.2: `--yes` flag for non-interactive/CI mode — skip all confirmation prompts
- [ ] FR-21.3: `--quiet` and `--verbose` global flags for output control
- [ ] FR-21.4: `--no-color` flag for CI environments (disable ANSI codes)
- [ ] FR-21.5: Post-command next-step suggestions — after every operation, suggest what to do next
- [ ] FR-21.6: Shell completion generation — `flowti completions bash|zsh|fish|powershell`
- [ ] FR-21.7: Progress indicators — spinners for < 3s operations, progress bars for > 3s

### FR-22: Quality Gates

- [ ] FR-22.1: Configurable quality gates in `flowti.config.json` — pass/fail thresholds that block publish
- [ ] FR-22.2: `npm audit` integration in health scoring
- [ ] FR-22.3: Technical debt estimation — remediation time from lint and complexity metrics
- [ ] FR-22.4: Report diff mode — compare current report against previous, highlight changes

---

## 6. Data Model Impact

No runtime data model changes. The CLI operates at build-time only.

**Configuration files:**

| File | Location | Purpose |
|------|----------|---------|
| `.flowti/config.json` | `<vault-root>/.flowti/` | Kernel config: projects folder, subsystem mappings, capture dirs, CLI source project path |
| `.flowti/var/state.json` | `<vault-root>/.flowti/var/` | Persistent state: selected project |
| `.flowti/plugins/<name>/manifest.json` | `<vault-root>/.flowti/plugins/` | Plugin manifests (vault-level) |
| `.flowti/ai-tools/<name>.json` | `<vault-root>/.flowti/ai-tools/` | AI tool definitions (vault-level) |
| `flowti.config.json` | `<project>/configs/` | Per-project config: tool mappings, publish, review, make settings |
| `package.json` | `<project>/` | npm scripts (consumed by auto-scaffolding, info, npm scripts menu) |

**Bundled definitions (inlined by esbuild):**

| Definition | Source | Purpose |
|------------|--------|---------|
| `flowti-project.json` | `src/domain/scaffold/definitions/` | Scaffold definition for new Flowti projects |
| `component.json` | `src/domain/make/component/definitions/` | Generic component definition |
| `layout.json` | `src/domain/make/component/definitions/` | Layout component (direction, gap, padding properties) |
| `page.json` | `src/domain/make/component/definitions/` | Page component (title, route, authenticated properties) |
| `ui-component.json` | `src/domain/make/component/definitions/` | UI component (variant, disabled, visible properties) |
| `c4-system.json` | `src/domain/make/component/definitions/` | C4 System definition (level 1) |
| `c4-container.json` | `src/domain/make/component/definitions/` | C4 Container definition (level 2) |
| `c4-component.json` | `src/domain/make/component/definitions/` | C4 Component definition (level 3) |
| `c4-person.json` | `src/domain/make/component/definitions/` | C4 Person definition (level 0) |

**Generated artifacts:**

| Artifact | Path | Trigger |
|----------|------|---------|
| Component docs | `<project>/docs/components/<name>.md` | `make:component` / `make:layout` / `make:system` / etc. |
| Component tests | `<project>/tests/components/<name>.test.ts` | `make:component` / `make:layout` / etc. |
| Component defs | `<project>/src/components/<name>/<name>.json` | `make:component` / `make:layout` / etc. |
| Storybook stories | `<project>/src/components/<name>/<name>.stories.ts` | `make:layout` / `make:page` / `make:ui-component` |
| Event catalog | `<project>/docs/events/<name>.md` | `events:add` command |
| Reports | `<cli>/reports/{tests,coverage,codebase,complexity,summary}/` | `npm run reports` or interactive Reports menu |
| Stable reports | `<cli>/reports/{Test,Coverage,Codebase,Complexity,Project Status,Project Summary} Report.md` | Latest report per type |
| Plugin Reference | `<cli>/docs/reference/Plugin Reference.md` | `plugin:reference` command |
| AI Tool Reference | `<cli>/docs/reference/AI Tool Reference.md` | `ai:reference` command |
| Test vault | `C:\Projects\<project>-e2e\` | Review → Create test vault |

---

## 7. Event Impact

**Produced**: None (build-time tooling, not runtime plugin code)

**Consumed**: None

**Note**: The CLI documentation generator reads the event catalog source to count events.

---

## 8. UI Layout Impact

None. The CLI is a terminal application.

---

## 9. Adapter Impact

No adapter changes. The CLI uses Node.js built-ins exclusively (readline, child_process, fs, path). No external dependencies at runtime.

---

## 10. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| CLI startup time | < 100ms |
| Self-contained binary | `node .flowti/bin` requires no source tree |
| Fast build (`flowti build`) | < 3s |
| No production dependencies | Dev tooling only (TypeScript, Vitest, tsx, ESLint); runtime uses Node.js built-ins |
| Cross-platform | Windows, macOS, Linux |
| AI Agent compatibility | Deterministic exit codes, no interactive prompts in non-interactive mode |
| Definition-driven | All scaffolding from declarative JSON definitions |
| Deterministic output | Same inputs → same outputs |
| Generated docs accuracy | Auto-generated from source; always reflects current CLI state |
| Scaffolding safety | Never overwrite existing files; abort on name collision |
| Progressive opt-in | All features, restrictions, and quality gates are opt-in; projects start minimal |
| Resilient reports | Report generation never stops on failure; broken reports are signals, not blockers |
| Zero runtime footprint | CLI is build-time only; not bundled into projects |

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| CLI binary grows beyond maintainability | Modular domain structure (scaffold/, make/, publish/, review/, reports/) keeps cognitive load low |
| Per-project config divergence | Auto-scaffolding from package.json ensures consistent defaults |
| Definition schema drift | Definitions validated on load; TypeScript types enforce schema |
| Template drift from project patterns | Templates reference stable patterns; tests validate output |
| AI agent cannot parse CLI output | Non-interactive mode returns clean stdout; exit codes are deterministic |
| Scaffolded code doesn't compile | E2E journey validates build after scaffold |
| Test vault accumulation on disk | Test vaults outside git; user manages lifecycle via Review menu |
| esbuild bundling breaks runtime reads | All definitions imported directly (not read from fs); enforced by architecture |
| AI agents can't parse structured output | `--json` flag planned (IMP-28); currently text-only output |
| Single scaffold definition limits adoption | Marketplace and remote templates planned (IMP-25); community definitions via `scaffold:import` |
| No security in health scoring | `npm audit` integration planned (IMP-41); currently coverage/lint/test only |
| Plugin ecosystem has no lifecycle | Lifecycle hooks planned (IMP-37); current plugins are stateless shell commands |

---

## 11.1 Competitive Landscape (March 2026)

### Market Positioning

Flowti CLI occupies a unique niche: **vault-native project management CLI**. No existing tool combines knowledge management (Obsidian vault), project scaffolding, health scoring, report generation, and AI tool configs in a single CLI binary. The vault IS the memory — a genuine differentiator as AI agents demand persistent context.

### Competitive Gaps (Prioritized)

| Gap | Competitors | Impact | Addressed By |
|-----|-------------|--------|--------------|
| **No `--json` output** | GitHub CLI, Vercel CLI — all support structured output | Critical for CI and AI agent integration | IMP-28 (Phase 5.1) |
| **No quality gates** | SonarQube (Quality Gates), CodeClimate (pass/fail) | Publish pipeline has no automated quality enforcement | IMP-29 (Phase 5.2) |
| **No scaffold `--dry-run`** | Plop, Hygen, Cookiecutter — all support preview | Table-stakes for scaffolders | IMP-30 (Phase 5.3) |
| **No progress indicators** | Atlassian's #3 CLI UX principle | Users lack feedback on long operations | IMP-31 (Phase 5.5) |
| **No MCP server** | Fastest-adopted standard (Linux Foundation 2025) | AI agents can't consume CLI programmatically | IMP-38 (Phase 7.1) |
| **No template versioning** | Cookiecutter, Copier (re-apply updated templates) | Scaffolded projects drift from template updates | IMP-40 (Phase 7.9) |
| **No affected detection** | Nx, Turborepo (git-based change detection) | Review pipeline runs everything regardless of changes | IMP-36 (Phase 7.5) |
| **No health trends** | CodeClimate (maintainability trends) | Point-in-time snapshots less useful than trends | IMP-26 (Phase 6.3) |
| **1 scaffold definition** | Yeoman (10K+ generators), Cookiecutter (7K+ templates) | Limited out-of-box value for new users | IMP-25 (Phase 6.7) |

### Defensible Advantages

| Advantage              | Why It Matters                                                                              |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| **Vault-native**       | Reports, docs, events, components are Obsidian notes — queryable, linkable, searchable      |
| **Zero dependencies**  | No npm install, no lock file conflicts, self-contained binary                               |
| **Progressive opt-in** | Start with nothing, grow into quality gates — no upfront ceremony                           |
| **AI-agent aware**     | Non-interactive commands with deterministic exit codes                                      |
| **Definition-driven**  | JSON definitions are the single source of truth — auditable, diffable, version-controllable |

---

## 12. Acceptance Criteria

- [x] `node .flowti/bin` runs without source tree present
- [x] `npm run dev` starts interactive menu with project selection and quits cleanly with `q`
- [x] Start menu allows opening existing projects and creating new ones from scaffold definitions
- [x] Selecting a project shows detail menu with tools
- [x] Projects without `flowti.config.json` get auto-scaffolded config on first selection
- [x] Mappable tools (Build, Reports) disabled when not configured
- [x] Component system creates docs, tests, definitions, and Storybook stories for all 8 types
- [x] Review creates test vault outside git repository
- [x] Publish pipeline enforces build → test → distribute gating
- [x] `npm run build` compiles and bundles to `.flowti/bin/main.js` without errors
- [x] `npm test` passes with all 1,777 tests green (101 suites)
- [x] Pressing `?` in any menu shows contextual help
- [x] Report generation runs resiliently — failed reports don't stop the run; warnings surfaced in summary
- [x] Event Catalog creates, lists, and auto-links domain events per project
- [x] Report prerequisites run before generation; shared prerequisites deduplicated
- [x] Developer onboarding E2E journey passes (7 tests in `60-journey-developer-onboarding.test.ts`)
- [x] Plugin system discovers, validates, and scaffolds plugins from `.flowti/plugins/`
- [x] AI Tools system discovers, validates, and scaffolds tool definitions from `.flowti/ai-tools/`
- [x] Plugin and AI Tool Reference documents generated via Document service to `docs/reference/`
- [x] Start Menu includes Plugins (`p`) and AI Tools (`a`) entries
- [x] AI agent can use non-interactive commands to build, test, and scaffold without human intervention (`--project=<name>` flag, `--format=json` output)
- [x] Health dashboard aggregates metrics from report frontmatter and renders console summary
- [x] Cross-project dependency detection finds npm, config, and publish edges with cycle detection
- [x] Scaffold marketplace discovers local definitions and allows import via `scaffold:import`
- [x] Event contracts parse payload tables and export structured JSON
- [x] Event versioning bumps versions with migration notes via `events:version`
- [x] Standalone mode — `node .flowti/bin` runs without source tree; bootstrap auto-detects mode
- [x] Adaptive Start Menu — no projects shows "Create Your First Project"; projects exist shows "Open Project" + "Create Project"
- [x] Git submodule loading — "Load Git Project from Remote" adds repository as submodule
- [x] Test vault provisioning — Review menu builds CLI fresh and refreshes binary on every ensure

---

## 13. Definition of Done

- [x] All FR-01 through FR-22 implemented (FR-15 through FR-19 partial, FR-21/FR-22 planned — see Feature Maturity Assessment)
- [x] Two-stage menu (start → project detail) working
- [x] Project creation from bundled scaffold definitions
- [x] Component system with 8 types (5 C4 + 3 UI), properties, and Storybook stories
- [x] Event Catalog with interactive and non-interactive commands
- [x] Resilient report generation with prerequisites, warnings, and comprehensive run summary
- [x] Per-project auto-scaffolding generates valid `flowti.config.json`
- [x] Man-pages cover all tool menus with accurate descriptions
- [x] Plugin system with vault-level manifests, interactive menu, and reference generation
- [x] AI Tools system with vault-level definitions, interactive menu, and reference generation
- [x] TypeScript strict mode with Vitest test suite (1,777 tests, 101 suites)
- [x] No production dependencies — dev tooling only, binary is self-contained
- [x] README, Architecture, and PRD updated to reflect definition-driven architecture
- [x] Developer onboarding scenario tested end-to-end

---

## 14. Feature Maturity Assessment

Each domain is assessed on a 3-tier maturity scale:

- **Deep** — Feature-complete, well-tested, handles edge cases, has both interactive and non-interactive modes.
- **Functional** — Core use case works, but gaps remain (missing CLI commands, no error propagation, limited configurability).
- **Shallow** — Proof of concept, metadata-only, or import-only — needs significant work to deliver real value.

| Domain | Maturity | Gaps |
|--------|----------|------|
| **Component System** (FR-03) | Deep | Fully operational: 8 types, properties, Storybook, C4 hierarchy, editing, browser |
| **Interactive Menu** (FR-01) | Deep | Two-stage menu, state persistence, ANSI output, help system |
| **Report Generation** (FR-10) | Deep | Resilient runner, prerequisites, warnings, 6 generators + 4 references |
| **Non-Interactive Commands** (FR-02) | Deep | Comprehensive CLI surface for AI agent tool use |
| **Per-Project Config** (FR-08) | Deep | Auto-scaffolding, 45 validation rules, mappable tools |
| **Event Catalog** (FR-11) | Deep | CRUD, wikilinks, payload editor, versioning, flow visualization |
| **Gated Publish** (FR-05) | Deep | Pipeline works with dry-run mode (`publish --dry-run`); no rollback on distribute failure |
| **Plugin System** (FR-13) | Deep | Discovery, validation, scaffolding work; exit codes propagated via `process.exitCode`; no plugin lifecycle hooks |
| **Review Pipeline** (FR-12) | Deep | Test vault creation works; `review:clean` removes stale vaults; no diff comparison between runs |
| **Scaffold Definitions** (FR-09) | Functional | Project creation works; only 1 bundled definition (`flowti-project.json`); no community definitions |
| **Cross-Project Deps** (FR-16) | Functional | Detection and Mermaid diagrams work; no interactive browser; no impact analysis |
| **AI Tools** (FR-14) | Shallow | **Metadata-only** — stores tool definitions but has no execution capability, no parameter substitution, no output capture. Currently a documentation/discovery system, not a runtime |
| **Health Dashboard** (FR-15) | Functional | CLI command (`health --format=json`) and scoring (0–100, A–F) with configurable thresholds; no trends or snapshot persistence |
| **Marketplace** (FR-17) | Shallow | Import-only; no export/publish; no remote discovery; no versioning of shared definitions |
| **Event Contracts** (FR-18) | Shallow | Parses payload tables and exports JSON; no runtime validation; no TypeScript generation; no CI integration |
| **Capture** (FR-02.11) | Shallow | Single-line text only; no tags, no search/retrieve, no batch import, no structured capture |
| **Config Validation** (FR-08) | Deep | 45 schema rules + filesystem-aware deep validation (path existence checks for reports.dir, endpoints, journeysDir, testVault, referenceDir, storybookDir); warnings only — never blocks startup |
| **Standalone CLI** (FR-20) | Deep | Bootstrap two-mode (dev/standalone), config fallback, test vault fresh build + refresh |
| **Agent-Native Interface** (FR-21) | Shallow | Deterministic exit codes work; no `--json`, `--yes`, `--quiet`, `--verbose`, `--no-color`, shell completions, or progress indicators |
| **Quality Gates** (FR-22) | Not Started | Planned — configurable thresholds, npm audit, debt estimation, report diffs |

---

## 15. Improvements

Planned improvements to evolve the CLI beyond its current state:

### Completed

| ID | Improvement | Status |
|----|-------------|--------|
| ~~IMP-01~~ | **Non-interactive project selection** | Done — `--project=<name>` flag on all commands; `resolveProjectContext()` in `main.ts` (Phase 1.2) |
| ~~IMP-02~~ | **Journey scaffolding** | Done — Make tool generates E2E journey test files, config JSON, and canvas stubs |
| ~~IMP-03~~ | **Report archive navigation** | Done — Reports menu lists past reports from `reports/` subdirectories with timestamps (Phase 1.4) |
| ~~IMP-04~~ | **Component relationships** | Done — C4 hierarchy with containedBy/contains, ancestry paths, siblings in component browser (Phase 2.1) |
| ~~IMP-06~~ | **Config validation** | Done — 45 validation rules in `config-schema.ts` with helpful error messages (Phase 1.1) |
| ~~IMP-08~~ | **Capture integration** | Done — `capture:idea` and `capture:note` commands with interactive and non-interactive modes |
| ~~IMP-14~~ | **Event Catalog enrichment** | Done — Payload field editor (`event-payload.ts`) and versioning with migration notes (`event-versioning.ts`) (Phase 2.3–2.4) |
| ~~IMP-15~~ | **Component property editor** | Done — Interactive prompt for adding/editing properties via `collectPropertyValues()` and `component-edit.ts` (Phase 2.2) |
| ~~IMP-16~~ | **Event flow visualization** | Done — Producer → event → consumer diagrams from Event Catalog data (`event-flow.ts`) (Phase 2.5) |
| ~~IMP-17~~ | **Storybook v10 integration** | Done — Opt-in per project via Components menu. CLI installs Storybook v10 into `<project>/component-library/`, wraps npm scripts (dev/build) with dynamic disabled gating, Make generates self-contained `.stories.ts` with render functions, component data model expanded (icon, heroImage, images, domain, actions, variants, states) (Phase 3.3) |
| ~~IMP-05~~ | **Project health dashboard** | Done — `collectHealth()` aggregates test/coverage/lint/git metrics into `HealthSnapshot`; `displayHealth()` renders console summary (Phase 3.1) |
| ~~IMP-07~~ | **Review pipeline gating** | Done — `review:all` runs build → test → E2E with fail-fast gating; interactive Review menu uses `disabled` functions tied to `buildPassed`/`testPassed` state (Phase 3.2) |

### Recently Completed

| ID | Improvement | Status |
|----|-------------|--------|
| ~~IMP-09~~ | **Definition marketplace** | Done (partial) — local definition discovery, validation, classification, and import via `scaffold:marketplace` and `scaffold:import` commands. Export/publish not yet implemented (Phase 3.5) |
| ~~IMP-10~~ | **Cross-project dependencies** | Done — DFS-based dependency detection (npm, config, publish edges), cycle detection, Mermaid diagram generation, `project:deps` command (Phase 3.5) |
| ~~IMP-13~~ | **Plugin system** | Done — vault-level plugins in `.flowti/plugins/<name>/manifest.json` with shell-command-based commands, collision detection, interactive menu (list/validate/create/reference), and reference document generation via Document service (Phase 3.5) |
| ~~IMP-19~~ | **AI Tool management** | Done — vault-level AI tool definitions in `.flowti/ai-tools/<name>.json` with typed parameters, tags, interactive menu (list/validate/create/reference), and reference document generation via Document service (Phase 3.5) |
| ~~IMP-20~~ | **Health CLI command + scoring** | Done — non-interactive `health` command with `--format=json`; numeric scoring (0–100, A–F) per category with configurable thresholds in `flowti.config.json` (Phase 4.1, 4.4) |
| ~~IMP-21~~ | **Plugin exit code propagation** | Done — plugin command handlers set `process.exitCode` when `shell.run()` returns non-zero; failures surfaced to caller (Phase 4.2) |
| ~~IMP-23~~ | **Config deep validation** | Done — filesystem-aware validation checks path existence for reports.dir, publish endpoints, journeysDir, testVault, referenceDir, storybookDir; warnings only — never blocks startup (Phase 4.3) |

### Medium-Term

| ID | Improvement | Description |
|----|-------------|-------------|
| IMP-22 | **Capture enrichment** | Add tags, structured fields, search/retrieve, and batch import to capture commands |
| IMP-28 | **`--json` output flag** | Structured JSON output on all commands for CI pipelines and AI agent consumption. Table-stakes for modern CLIs |
| IMP-29 | **Quality Gates** | Configurable pass/fail thresholds in `flowti.config.json` that block `flowti publish` (coverage, lint score, test count). Inspired by SonarQube Quality Gates |
| IMP-30 | **Scaffold dry-run** | `--dry-run` flag for scaffold/make commands — preview generated files without writing to disk |
| IMP-31 | **Progress indicators** | Spinners for < 3s operations, progress bars for > 3s. Standard UX for long-running report generation and E2E runs |
| IMP-32 | **Report diff mode** | `reports --diff` compares current report against previous — shows new issues, resolved issues, score changes |
| IMP-33 | **Post-command suggestions** | After every operation, suggest the logical next step (e.g., after `make:component`, suggest `flowti build`) |
| IMP-34 | **Global output flags** | `--quiet`, `--verbose`, `--no-color`, `--yes` flags for CI environments and scripting |

### Long-Term

| ID | Improvement | Description |
|----|-------------|-------------|
| IMP-11 | **CI/CD integration** | Generate GitHub Actions workflows from project config for automated build/test/publish |
| IMP-12 | **Self-update mechanism** | CLI checks for updates and can rebuild itself when source changes are detected |
| IMP-18 | **Event contract testing** | Runtime payload validation against Event Catalog definitions; TypeScript type generation from contracts |
| IMP-24 | **AI Tool execution** | Execute AI tool definitions with parameter substitution and output capture |
| IMP-25 | **Marketplace export** | Publish scaffold definitions for sharing across vaults; remote definition discovery |
| IMP-26 | **Health trends** | Track health snapshots over time; display delta indicators and regression alerts |
| IMP-27 | **Interactive dependency browser** | Visual project graph explorer with impact analysis for changes |
| IMP-35 | **Shell completions** | `flowti completions bash\|zsh\|fish\|powershell` generates tab-completion scripts. Standard in GitHub CLI, Vercel CLI |
| IMP-36 | **Changed-based selective review** | Only re-run review stages for projects affected by changes (git diff analysis). Inspired by Nx/Turborepo affected detection |
| IMP-37 | **Plugin lifecycle hooks** | `onBeforeScaffold`, `onAfterReview`, `onBeforePublish` hooks in plugin manifests for ecosystem extensibility |
| IMP-38 | **MCP server mode** | `flowti serve --mcp` exposes CLI capabilities as an MCP server for AI agent consumption. MCP is the fastest-adopted developer standard (donated to Linux Foundation 2025) |
| IMP-39 | **AGENTS.md generation** | `flowti agents:generate` produces an `AGENTS.md` file describing all available commands, flags, and output formats for AI coding agents |
| IMP-40 | **Template versioning** | Re-apply updated scaffold definitions to existing projects with conflict resolution (inspired by Cookiecutter/Copier) |
| IMP-41 | **npm audit integration** | Include `npm audit` results in health scoring — security vulnerability count as a health metric |
| IMP-42 | **Technical debt estimation** | Express lint issues and complexity violations as estimated remediation time (hours/days), inspired by SonarQube |
| IMP-43 | **Report caching** | Hash-based invalidation — skip report generation when inputs haven't changed since last run |
| IMP-44 | **HTML report export** | Generate HTML reports for sharing outside Obsidian; useful for stakeholders without vault access |
| IMP-45 | **Parallel report generation** | Declare dependencies between generators; run independent generators in parallel for faster execution |

---

## 16. Feature Development Roadmap

This roadmap prioritizes **value at hand** — stabilizing what exists, hardening functional features, then expanding into new capabilities. Each phase targets specific maturity gaps identified in Section 14.

### Phase 4: Hardening — COMPLETE

**Goal**: Elevate all "Functional" features to "Deep" and fix correctness issues.

| # | Work Item | FR | IMP | Status |
|---|-----------|-----|-----|--------|
| 4.1 | **Health CLI command** — Non-interactive `health` with `--format=json` | FR-15.5 | IMP-20 | DONE |
| 4.2 | **Plugin exit code propagation** — `process.exitCode` on non-zero `shell.run()` | FR-13 | IMP-21 | DONE |
| 4.3 | **Config deep validation** — Filesystem-aware path existence checks | FR-08 | IMP-23 | DONE |
| 4.4 | **Health scoring** — Grades (0–100, A–F) with configurable thresholds | FR-15.6 | IMP-20 | DONE |
| 4.5 | **Publish dry-run** — `publish --dry-run` previews pipeline | FR-05 | — | DONE |
| 4.6 | **Review cleanup** — `review:clean` removes stale test vaults | FR-12 | — | DONE |

**Result**: All `Functional` features promoted to `Deep`. 53 new tests (1,724 → 1,777, 98 → 101 suites). Standalone CLI mode, adaptive Start Menu, git submodule projects, test vault fresh build.

### Phase 5: Agent-Native & DX (Medium-Term)

**Goal**: Make every command usable by both humans and AI agents. Close the DX gap with modern CLIs.

| # | Work Item | FR | IMP | Priority | Effort |
|---|-----------|-----|-----|----------|--------|
| 5.1 | **`--json` output flag** — Structured JSON output on all commands for CI and AI agent consumption | FR-21.1 | IMP-28 | Critical | L |
| 5.2 | **Quality Gates** — Configurable thresholds that block `flowti publish` (coverage, lint, tests, security) | FR-22.1 | IMP-29 | High | M |
| 5.3 | **Scaffold `--dry-run`** — Preview generated files without writing; table-stakes for scaffolders | FR-21 | IMP-30 | High | S |
| 5.4 | **Global output flags** — `--quiet`, `--verbose`, `--no-color`, `--yes` for CI environments | FR-21 | IMP-34 | High | M |
| 5.5 | **Progress indicators** — Spinners (< 3s) and progress bars (> 3s) for long-running operations | FR-21.7 | IMP-31 | Medium | M |
| 5.6 | **Post-command suggestions** — After operations, suggest the logical next step | FR-21.5 | IMP-33 | Medium | S |
| 5.7 | **Report diff mode** — Compare current vs previous; show new issues, resolved issues, score changes | FR-22.4 | IMP-32 | Medium | M |

**Exit criteria**: Every command supports `--json`. Publish is gated by quality thresholds. CI pipelines can run Flowti CLI headlessly. AI agents get structured output.

### Phase 6: Depth (Medium-Term)

**Goal**: Turn "Shallow" features into useful, reliable tools.

| # | Work Item | FR | IMP | Priority | Effort |
|---|-----------|-----|-----|----------|--------|
| 6.1 | **Capture enrichment** — Tags (`--tags=x,y`), structured fields, search/retrieve (`capture:search --tag=X`), batch import from file | FR-02.11 | IMP-22 | High | M |
| 6.2 | **Event contract validation** — Validate event payloads against Event Catalog definitions in Vitest; `events:contracts --validate` flag | FR-18.6 | IMP-18 | High | L |
| 6.3 | **Health trends** — Persist `HealthSnapshot` history; display delta indicators (improved/regressed/stable) per category; alert on regressions | FR-15.7 | IMP-26 | Medium | M |
| 6.4 | **AI Tool execution** — Execute tool definitions: `ai:run --tool=X --param1=val1`; parameter substitution in `run` command; capture stdout/stderr | FR-14 | IMP-24 | Medium | L |
| 6.5 | **npm audit integration** — Include security vulnerability count in health scoring | FR-22.2 | IMP-41 | Medium | S |
| 6.6 | **Technical debt estimation** — Express lint/complexity violations as remediation time (hours/days) | FR-22.3 | IMP-42 | Low | M |
| 6.7 | **Marketplace export** — `scaffold:export` packages a definition for sharing; `scaffold:import --url=X` imports from remote | FR-17.6 | IMP-25 | Low | M |
| 6.8 | **Event TypeScript codegen** — Generate TypeScript interfaces from event contracts: `events:codegen --out=types/events.ts` | FR-18.7 | IMP-18 | Low | M |

**Exit criteria**: Capture is a useful note system. Event contracts integrate into test pipelines. Health provides actionable trend data with security awareness.

### Phase 7: Ecosystem (Long-Term)

**Goal**: Make the CLI a force multiplier across projects, teams, and AI agents.

| # | Work Item | FR | IMP | Priority | Effort |
|---|-----------|-----|-----|----------|--------|
| 7.1 | **MCP server mode** — `flowti serve --mcp` exposes CLI as an MCP server for AI agents | FR-21 | IMP-38 | High | L |
| 7.2 | **AGENTS.md generation** — Auto-generate agent instructions describing all commands, flags, and output formats | — | IMP-39 | High | S |
| 7.3 | **CI/CD generation** — `flowti ci:generate` outputs GitHub Actions YAML from project config | — | IMP-11 | High | L |
| 7.4 | **Shell completions** — `flowti completions bash\|zsh\|fish\|powershell` | FR-21.6 | IMP-35 | Medium | M |
| 7.5 | **Changed-based selective review** — Only re-run affected stages (git diff analysis) | — | IMP-36 | Medium | L |
| 7.6 | **Report caching** — Hash-based invalidation; skip generation when inputs unchanged | — | IMP-43 | Medium | M |
| 7.7 | **Parallel report generation** — Declare generator dependencies; run independent generators concurrently | — | IMP-45 | Medium | M |
| 7.8 | **Interactive dependency browser** — Visual project graph with impact analysis | FR-16.5 | IMP-27 | Medium | L |
| 7.9 | **Template versioning** — Re-apply updated scaffold definitions to existing projects with diff resolution | — | IMP-40 | Medium | L |
| 7.10 | **HTML report export** — Generate shareable reports for stakeholders without vault access | — | IMP-44 | Low | M |
| 7.11 | **Self-update** — `flowti update` detects source changes and rebuilds binary | — | IMP-12 | Low | M |
| 7.12 | **Plugin lifecycle hooks** — `onBeforeScaffold`, `onAfterReview`, `onBeforePublish` hooks in manifests | FR-13 | IMP-37 | Low | L |
| 7.13 | **Cross-vault sharing** — Remote plugin/definition registry; `flowti install <plugin>` | FR-17, FR-13 | IMP-25 | Low | XL |

**Exit criteria**: AI agents can consume CLI via MCP or structured JSON. CI pipelines are auto-generated. Reports are cacheable and parallelizable. Plugin ecosystem supports lifecycle management.

### Effort Key

| Size | Estimate |
|------|----------|
| S | < 1 day |
| M | 1–3 days |
| L | 3–5 days |
| XL | 1–2 weeks |
| XL | > 5 days |
