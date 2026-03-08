---
domain: Flowti
type: ProductRequirementsDocument
stage: in-progress
version: 4
maturity: L2
created: 2026-03-07
updated: 2026-03-08
related_events: []
maturity_score_strategy: 3
maturity_score_scope: 5
maturity_score_architecture: 4
maturity_score_event_integration: 3
maturity_score_data_model: 4
maturity_score_ui_consistency: 3
maturity_score_validation_testing: 4
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
- A two-stage interactive menu: project selection (open/create) → project detail.
- Per-project configuration via `configs/flowti.config.json` with auto-scaffolding from `package.json`.
- **Base feature set**: Project Management, Components, Events, Make, Build, Tests, Reports, Review, Publish.
- **Component system** with 8 types: C4 architecture (System, Container, Component, Person) plus UI building blocks (Layout, Page, UI Component) and a generic Component.
- **Event Catalog** for per-project domain event documentation with auto-discovered wikilinks.
- Hub, Component, and Journey scaffolding from declarative JSON definitions with optional Storybook story generation.
- A gated publish pipeline that enforces build → test → distribute sequencing per project.
- E2E review with test vault isolation (created outside the git repository, with CLI build copied in).
- Non-interactive commands for AI agent tool use with deterministic exit codes.
- Auto-generated reports (test, coverage, codebase, complexity, status, summary) per project with prerequisite chaining and warning surfacing.
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
- Hub and Journey scaffolding from declarative definitions
- Gated publish pipeline with per-project endpoints
- E2E review with test vault isolation (outside git repository)
- Resilient report generation (test, coverage, codebase, complexity, status, summary) — never stops on failure, with prerequisite chaining and warning surfacing
- Man-page system with contextual help
- Info command with live project diagnostics
- Non-interactive command dispatch for AI agent tool use
- Persistent state (selected project) via `.flowti/var/state.json`

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
| Interactive menu | `./flowti.cmd` or `npm run dev` | Two-stage menu: select/create project → project tools |
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

---

## 5. Functional Requirements

### FR-01: Interactive Menu System

- [x] FR-01.1: Start menu listing projects from configured projects directory
- [x] FR-01.2: Project creation from bundled scaffold definitions
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
- [x] FR-03.14: Storybook story file generation (`.stories.ts`) with Meta/StoryObj, autodocs, and kind-aware folder organization

### FR-04: Man-Page System

- [x] FR-04.1: 8 help sections (main, make, build, review, publish, reports, devtools, info)
- [x] FR-04.2: Accessible via `flowti help [section]`
- [x] FR-04.3: Accessible via `?` in interactive menu context
- [x] FR-04.4: Each section documents options, commands, flags, and typical usage

### FR-05: Gated Publish Pipeline

- [x] FR-04.1: Three-stage pipeline: Build -> Test -> Publish
- [x] FR-04.2: Session-scoped state (build pass unlocks test, test pass unlocks publish)
- [x] FR-04.3: "Run all" option that executes stages sequentially, stopping on failure
- [x] FR-04.4: Visual pipeline state indicator (checkmark/circle per stage)

### FR-06: Auto-Generated CLI Documentation

- [x] FR-05.1: Generator script that parses CLI source
- [x] FR-05.2: Strips ANSI codes, extracts HELP sections, maps command descriptions
- [x] FR-05.3: Outputs vault note with YAML frontmatter (`type: CLIReference`)
- [x] FR-05.4: Includes tables: non-interactive commands, npm scripts, report generators, make config
- [x] FR-05.5: Runs automatically as part of `npm run generate:reports` and increment builds
- [x] FR-05.6: Registered in `flowti.config.json` as report `cli-ref`

### FR-07: Info Command

- [x] FR-06.1: Display project metadata (name, version)
- [x] FR-06.2: Display source statistics (TS files, test files, CSS layers, scripts)
- [x] FR-06.3: Display dependency counts (production, development, npm scripts)
- [x] FR-06.4: Display git status (branch, commit, clean/dirty)
- [x] FR-06.5: Display config health (report count, endpoints file, config file)

### FR-08: Per-Project Configuration

- [x] FR-07.1: Each project configured via `configs/flowti.config.json`
- [x] FR-07.2: Auto-scaffolding — config created from `package.json` on first project selection
- [x] FR-07.3: Mappable tools (`tools.build`, `tools.reports`, `tools.devtools`) enable/disable menu items per project
- [x] FR-07.4: Publish config (`publish.build`, `publish.test`, `publish.outDir`, `publish.artifacts`, `publish.endpoints[]`)
- [x] FR-07.5: Review config (`review.journeysDir`, `review.runner`, `review.build`, `review.test`)
- [x] FR-07.6: CLI kernel config in `.flowti/config.json` — subsystem mappings, projects folder, capture directories
- [x] FR-07.7: Make template config (`make.templates`) to control available scaffolding options per project

### FR-09: Scaffold Definitions (Project Creation)

- [x] FR-08.1: JSON scaffold definitions bundled into binary via direct import
- [x] FR-08.2: Definition validation on load (required fields, file mappings)
- [x] FR-08.3: Variable interpolation in prompts and file paths
- [x] FR-08.4: Interactive prompts collected from definition
- [x] FR-08.5: "From GitHub" option for cloning external templates
- [x] FR-08.6: Post-create commands (npm install, git init)

### FR-10: Resilient Report Generation

- [x] FR-09.1: "Run All Reports" runs each generator independently — never stops on failure
- [x] FR-09.2: Collect pass/fail/duration per generator
- [x] FR-09.3: Always print a run summary after all generators complete
- [x] FR-09.4: Failed reports are signals (visible in summary), not blockers
- [x] FR-09.5: Only publish pipelines enforce strict gating; report generation is resilient
- [x] FR-09.6: Individual report generators (`report:{id}`) still run standalone
- [x] FR-09.7: Generators declare `prerequisites` (e.g. `npm run test:coverage`) that run before generation; shared prerequisites are deduplicated across generators
- [x] FR-09.8: Generators return `warnings[]` for non-fatal issues (coverage below threshold, lint warnings, TypeDoc warnings, high complexity)
- [x] FR-09.9: Run summary uses three-state icons: `✓` passed, `⚠` passed with warnings, `✗` failed
- [x] FR-09.10: Summary Report surfaces individual lint issues (file:line, message, rule) and TypeDoc issues in the run summary

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

- [ ] FR-12.1: E2E journey testing the full onboarding flow: install CLI → create project → build → explore
- [ ] FR-12.2: Verify CLI help output is accessible and correct
- [ ] FR-12.3: Verify non-interactive build completes successfully
- [ ] FR-12.4: Verify Info command returns valid project data

---

## 6. Data Model Impact

No runtime data model changes. The CLI operates at build-time only.

**Configuration files:**

| File | Location | Purpose |
|------|----------|---------|
| `.flowti/config.json` | `<vault-root>/.flowti/` | Kernel config: projects folder, subsystem mappings, capture dirs |
| `.flowti/var/state.json` | `<vault-root>/.flowti/var/` | Persistent state: selected project |
| `.flowti/config.json` | `<vault-root>/.flowti/` | Vault-level config: CLI source project path |
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
| Hub boilerplate | `<project>/src/ui/<hub>/`, `src/domain/<hub>/` | `make:hub` command |
| Component docs | `<project>/docs/components/<name>.md` | `make:component` / `make:layout` / `make:system` / etc. |
| Component tests | `<project>/tests/components/<name>.test.ts` | `make:component` / `make:layout` / etc. |
| Component defs | `<project>/src/components/<name>/<name>.json` | `make:component` / `make:layout` / etc. |
| Storybook stories | `<project>/src/components/<name>/<name>.stories.ts` | `make:layout` / `make:page` / `make:ui-component` |
| Event catalog | `<project>/docs/events/<name>.md` | `events:add` command |
| Reports | `<cli>/reports/{tests,coverage,codebase,complexity,summary}/` | `npm run reports` or interactive Reports menu |
| Stable reports | `<cli>/reports/{Test,Coverage,Codebase,Complexity,Project Status,Project Summary} Report.md` | Latest report per type |
| Test vault | `C:\Projects\<project>-e2e\` | Review → Create test vault |

---

## 7. Event Impact

**Produced**: None (build-time tooling, not runtime plugin code)

**Consumed**: None

**Note**: The CLI documentation generator reads the event catalog source to count events. The generated hub boilerplate includes domain event stubs that integrate with the EventBus at runtime.

---

## 8. UI Layout Impact

None. The CLI is a terminal application. Generated hub boilerplate produces BaseHubView subclasses that follow the existing Hub Shell pattern (ADR-024).

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
- [x] `npm test` passes with all 1187 tests green (73 suites)
- [x] Pressing `?` in any menu shows contextual help
- [x] Report generation runs resiliently — failed reports don't stop the run; warnings surfaced in summary
- [x] Event Catalog creates, lists, and auto-links domain events per project
- [x] Report prerequisites run before generation; shared prerequisites deduplicated
- [ ] Developer onboarding E2E journey passes
- [ ] AI agent can use non-interactive commands to build, test, and scaffold without human intervention

---

## 13. Definition of Done

- [x] All FR-01 through FR-11 implemented and verified
- [ ] FR-12 (E2E onboarding journey) implemented and passing
- [x] Two-stage menu (start → project detail) working
- [x] Project creation from bundled scaffold definitions
- [x] Component system with 8 types (5 C4 + 3 UI), properties, and Storybook stories
- [x] Event Catalog with interactive and non-interactive commands
- [x] Resilient report generation with prerequisites, warnings, and comprehensive run summary
- [x] Per-project auto-scaffolding generates valid `flowti.config.json`
- [x] Man-pages cover all tool menus with accurate descriptions
- [x] TypeScript strict mode with Vitest test suite (1187 tests, 73 suites)
- [x] No production dependencies — dev tooling only, binary is self-contained
- [x] README, Architecture, and PRD updated to reflect definition-driven architecture
- [ ] Developer onboarding scenario tested end-to-end

---

## 14. Improvements

Planned improvements to evolve the CLI beyond its current state:

### Completed

| ID | Improvement | Status |
|----|-------------|--------|
| ~~IMP-02~~ | **Journey scaffolding** | Done — Make tool generates E2E journey test files, config JSON, and canvas stubs |
| ~~IMP-08~~ | **Capture integration** | Done — `capture:idea` and `capture:note` commands with interactive and non-interactive modes |

### Short-Term

| ID | Improvement | Description |
|----|-------------|-------------|
| IMP-01 | **Non-interactive project selection** | Add `--project=<name>` flag to all commands so AI agents and scripts can target a specific project without interactive selection |
| IMP-03 | **Report archive navigation** | Reports menu should list past reports from `reports/` subdirectories with timestamps |
| IMP-04 | **Component relationships** | Visualize containedBy/contains relationships between C4 entities in the component browser |
| IMP-14 | **Event Catalog enrichment** | Add payload field editor to interactive flow; support event versioning (v1 → v2 migration notes) |
| IMP-15 | **Component property editor** | Interactive prompt for adding/editing properties when scaffolding components |

### Medium-Term

| ID | Improvement | Description |
|----|-------------|-------------|
| IMP-05 | **Project health dashboard** | Aggregate project stats (test count, coverage, build status, last activity) into a summary view |
| IMP-06 | **Config validation** | Validate `flowti.config.json` against a schema with helpful error messages for misconfigured projects |
| IMP-07 | **Review pipeline gating** | Add build → test gating to Review (like Publish) before running E2E journeys |
| IMP-09 | **Definition marketplace** | Allow projects to register custom definitions that extend the CLI's scaffolding capabilities |
| IMP-16 | **Event flow visualization** | Generate producer → event → consumer diagrams from Event Catalog data |
| IMP-17 | **Storybook integration** | Auto-detect Storybook in project and add `storybook:dev` / `storybook:build` to dev tools menu |

### Long-Term

| ID | Improvement | Description |
|----|-------------|-------------|
| IMP-10 | **Cross-project dependencies** | Detect and visualize dependencies between projects |
| IMP-11 | **CI/CD integration** | Generate GitHub Actions workflows from project config for automated build/test/publish |
| IMP-12 | **Self-update mechanism** | CLI checks for updates and can rebuild itself when source changes are detected |
| IMP-13 | **Plugin system** | Allow projects to register CLI plugins that add custom commands and tools |
| IMP-18 | **Event contract testing** | Validate event payloads against Event Catalog definitions at test time |
