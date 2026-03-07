---
domain: Flowti
plugin: "[[Development/flowti/README|README]]"
type: ProductRequirementsDocument
stage: development_ready
version: 1
maturity: L1
created: 2026-03-07
updated: 2026-03-07
supplier_prd: "[[Developer Experience PRD]]"
related_events: []
maturity_score_strategy: 3
maturity_score_scope: 3
maturity_score_architecture: 3
maturity_score_event_integration: 1
maturity_score_data_model: 2
maturity_score_ui_consistency: 3
maturity_score_validation_testing: 2
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
---

# PRD: Flowti CLI

---

## 1. Problem Statement

Flowti's development workflow relies on 37 npm scripts, 14 report generators, and an esbuild pipeline with multiple flags. A new developer pulling the repository faces:

- **Discovery friction** — no single entry point to understand available commands, pipelines, and scaffolding tools.
- **Script sprawl** — dozens of npm scripts with overlapping names (`build`, `build:only`, `build:full`, `build:increment`, `build:release`, `build:distribution`) that are difficult to navigate without tribal knowledge.
- **No scaffolding** — creating a new Hub or Plugin requires copy-pasting from existing code and manually wiring domain events, tests, CSS layers, and documentation.
- **AI Agent gap** — LLM-based coding agents cannot explore interactive menus; they need deterministic, non-interactive commands with predictable output and exit codes.
- **Stale documentation** — CLI capabilities change with every cycle, but manual documentation drifts out of sync.

---

## 2. Outcome

After implementation, developers and AI agents will have:

- A single `npm run flowti` entry point with an interactive menu system and contextual help.
- Non-interactive commands for every action (`npm run flowti -- build`, `npm run flowti -- make:hub --name=X`), enabling scripted pipelines and AI agent tool use.
- Hub and Plugin scaffolding that generates production-ready boilerplate following Flowti's DDD, EventBus, and BaseHubView patterns.
- Auto-generated CLI reference documentation that stays in sync with the source — generated on every increment build.
- A gated publish pipeline that enforces build-then-test-then-release sequencing.
- Man-pages accessible via `?` in any interactive menu or `npm run flowti -- help [section]`.

---

## 3. Scope

### In Scope

- Interactive CLI menu system (7 top-level menus)
- Non-interactive command dispatch for all actions
- Hub scaffolding (9 files: view, types, events, service, provider, test, CSS, PRD, journey)
- Plugin scaffolding (6 files: manifest, package.json, tsconfig, esbuild, main.ts, .gitignore)
- Man-page system (8 help sections)
- Auto-generated CLI Reference vault note (`docs/reference/Flowti CLI Reference.md`)
- Gated publish pipeline with session-scoped state tracking
- Info command with live project diagnostics
- Developer onboarding journey (build from source, activate, explore)
- AI Agent compatibility (deterministic exit codes, structured output, `--` flag syntax)

### Out of Scope

- GUI-based CLI (electron/web)
- Remote CLI execution (SSH, CI/CD integration)
- Plugin marketplace publishing (BRAT/community plugins)
- Watching for CLI source changes (self-rebuilding CLI)
- Interactive prompts for AI agents (agents use non-interactive mode exclusively)

---

## 4. UX Entry Points

### Human Developer

| Entry Point | Command | Context |
|-------------|---------|---------|
| Interactive menu | `npm run flowti` | Full menu system with navigation, help, and status |
| Section help | `npm run flowti -- help build` | Contextual man-page for a specific section |
| Quick build | `npm run flowti -- build` | Fast build without reports (~2s) |
| Scaffold hub | `npm run flowti -- make:hub --name=Inventory` | Non-interactive hub generation |
| Project info | `npm run flowti -- info` | Live project stats, git status, config health |
| In-menu help | Press `?` in any menu | Contextual help for the current menu |

### AI Agent (Tool Use)

| Capability | Command | Expected Output |
|-----------|---------|----------------|
| Discover commands | `npm run flowti -- help` | Structured help text (parseable) |
| Build plugin | `npm run flowti -- build` | Exit 0 on success, non-zero on failure |
| Run tests | `npm run flowti -- test` | Exit 0 if all tests pass |
| Scaffold code | `npm run flowti -- make:hub --name=X --tabs=a,b` | File list output, exit 0 |
| Check project | `npm run flowti -- info` | Structured project metadata |
| Generate docs | `npm run flowti -- report:cli-ref` | Updated docs/reference/Flowti CLI Reference.md |

---

## 5. Functional Requirements

### FR-01: Interactive Menu System

- [x] FR-01.1: Main menu with 7 options (Make, Build, Review, Publish, Reports, Dev Tools, Info)
- [x] FR-01.2: Sub-menus with numbered options and separator support
- [x] FR-01.3: ANSI color output (cyan options, green success, red errors, dim hints)
- [x] FR-01.4: Quit with `q` from any menu, return to main with `b`
- [x] FR-01.5: Help with `?` in any menu showing contextual man-page
- [x] FR-01.6: Command execution with timing display

### FR-02: Non-Interactive Commands

- [x] FR-02.1: All interactive actions available as `npm run flowti -- <command>` with `--flag=value` syntax
- [x] FR-02.2: Deterministic exit codes (0=success, non-zero=failure)
- [x] FR-02.3: Build commands: `build`, `build:full`, `build:increment`, `build:watch`, `build:distribute`
- [x] FR-02.4: Test commands: `test`, `test:increment`, `test:e2e`
- [x] FR-02.5: Publish commands: `publish`, `publish:all`
- [x] FR-02.6: Report commands: `reports`, `report:{id}`, `reports:audit`
- [x] FR-02.7: Dev tool commands: `dev:reload`, `dev:console`, `dev:errors`, `dev:check`, `dev:lint`, `dev:fix-frontmatter`, `dev:testdata`
- [x] FR-02.8: Make commands: `make:hub --name=X`, `make:plugin --name=X`
- [x] FR-02.9: Info and help: `info`, `help [section]`

### FR-03: Hub Scaffolding

- [x] FR-03.1: Prompt for hub name, icon, hub type (domain/utility/analytics), initial tabs
- [x] FR-03.2: Generate BaseHubView subclass with TabDef[], onTabRender, constructor
- [x] FR-03.3: Generate domain types (page union, tab definitions)
- [x] FR-03.4: Generate domain events (EventMap interface with hub lifecycle events)
- [x] FR-03.5: Generate domain service stub (EventBus constructor, dispose pattern)
- [x] FR-03.6: Generate HubDashboardProvider (cross-hub summary integration)
- [x] FR-03.7: Generate vitest test file (happy-dom, BaseHubView mock patterns)
- [x] FR-03.8: Generate CSS layer file (auto-numbered based on existing layers)
- [x] FR-03.9: Generate feature PRD stub document
- [x] FR-03.10: Generate E2E journey stub JSON
- [x] FR-03.11: Skip existing files without overwriting

### FR-04: Plugin Scaffolding

- [x] FR-04.1: Prompt for plugin name, plugin ID, author
- [x] FR-04.2: Generate DDD folder structure (infrastructure, domain, ui, utils)
- [x] FR-04.3: Generate manifest.json with Obsidian plugin metadata
- [x] FR-04.4: Generate package.json with npm scripts following Flowti patterns
- [x] FR-04.5: Generate tsconfig.json with strict TypeScript settings
- [x] FR-04.6: Generate esbuild.config.mjs with CSS pipeline
- [x] FR-04.7: Generate main.ts with EventBus backbone
- [x] FR-04.8: Generate .gitignore with standard exclusions
- [x] FR-04.9: Abort if output directory already exists

### FR-05: Man-Page System

- [x] FR-05.1: 8 help sections (main, make, build, review, publish, reports, devtools, info)
- [x] FR-05.2: Accessible via `npm run flowti -- help [section]`
- [x] FR-05.3: Accessible via `?` in interactive menu context
- [x] FR-05.4: Each section documents options, commands, flags, and typical usage

### FR-06: Gated Publish Pipeline

- [x] FR-06.1: Three-stage pipeline: Build -> Test -> Publish
- [x] FR-06.2: Session-scoped state (build pass unlocks test, test pass unlocks publish)
- [x] FR-06.3: "Run all" option that executes stages sequentially, stopping on failure
- [x] FR-06.4: Visual pipeline state indicator (checkmark/circle per stage)

### FR-07: Auto-Generated CLI Documentation

- [x] FR-07.1: Generator script (`generate-cli-reference.mjs`) that parses CLI source
- [x] FR-07.2: Strips ANSI codes, extracts HELP sections, maps command descriptions
- [x] FR-07.3: Outputs vault note with YAML frontmatter (`type: CLIReference`)
- [x] FR-07.4: Includes tables: non-interactive commands, npm scripts, report generators, make config
- [x] FR-07.5: Runs automatically as part of `npm run generate:reports` and increment builds
- [x] FR-07.6: Registered in `flowti.config.json` as report `cli-ref`

### FR-08: Info Command

- [x] FR-08.1: Display plugin metadata (name, version, ID, author)
- [x] FR-08.2: Display source statistics (TS files, test files, CSS layers, scripts)
- [x] FR-08.3: Display dependency counts (production, development, npm scripts)
- [x] FR-08.4: Display git status (branch, commit, clean/dirty)
- [x] FR-08.5: Display config health (report count, endpoints file, config file)

### FR-09: Configuration

- [x] FR-09.1: `flowti.config.json` as single configuration source
- [x] FR-09.2: Configurable make paths (`make.hub.*`, `make.plugin.output`)
- [x] FR-09.3: Report script registry (`reports.scripts[]`)
- [x] FR-09.4: Path configuration (`paths.pluginRoot`, `paths.pluginOutput`, etc.)
- [x] FR-09.5: Build configuration (`build.entry`, `build.minify`, `build.sourcemap`)

### FR-10: Developer Onboarding Journey

- [ ] FR-10.1: E2E journey testing the full onboarding flow: clone -> install -> build -> activate -> explore
- [ ] FR-10.2: Verify CLI help output is accessible and correct
- [ ] FR-10.3: Verify non-interactive build completes successfully
- [ ] FR-10.4: Verify Info command returns valid project data
- [ ] FR-10.5: Verify plugin activates and shows installer wizard

---

## 6. Data Model Impact

No runtime data model changes. The CLI operates at build-time only.

**Configuration files:**

| File | Purpose |
|------|---------|
| `flowti.config.json` | CLI configuration: paths, build settings, make paths, report scripts |
| `build-endpoints.json` | Distribution endpoints for multi-vault deploy |
| `manifest.json` | Obsidian plugin metadata (consumed by info command) |
| `package.json` | npm scripts (consumed by info command and documentation generator) |

**Generated artifacts:**

| Artifact | Path | Trigger |
|----------|------|---------|
| CLI Reference | `docs/reference/Flowti CLI Reference.md` | Increment build, `report:cli-ref` |
| Hub boilerplate | `src/ui/<hub>/`, `src/domain/<hub>/`, `tests/ui/<hub>/` | `make:hub` command |
| Plugin boilerplate | `../<plugin-id>/` | `make:plugin` command |

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

No adapter changes. The CLI uses Node.js built-ins exclusively (readline, child_process, fs, path). No external dependencies.

---

## 10. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| CLI startup time | < 100ms |
| Fast build (`npm run flowti -- build`) | < 3s |
| No external dependencies | Node.js built-ins only (readline, fs, path, child_process) |
| Cross-platform | Windows, macOS, Linux |
| AI Agent compatibility | Deterministic exit codes, no interactive prompts in non-interactive mode |
| Generated docs accuracy | Auto-generated from source; always reflects current CLI state |
| Scaffolding safety | Never overwrite existing files; abort on name collision |
| Zero runtime footprint | CLI is build-time only; not bundled into the plugin |

---

## 11. Risks

| Risk | Mitigation |
|------|------------|
| CLI source grows beyond maintainability | Single-file design keeps cognitive load low; HELP object is declarative |
| Generated docs drift from CLI behavior | Generator parses CLI source directly; no manual sync required |
| Hub template drift from BaseHubView API | Templates reference stable patterns from ADR-024; test validates compilation |
| AI agent cannot parse CLI output | Non-interactive mode returns clean stdout; exit codes are deterministic |
| Scaffolded code doesn't compile | E2E journey validates build after scaffold |
| Node.js readline quirks on Windows | Tested on Windows; ANSI colors gracefully degrade |

---

## 12. Acceptance Criteria

- [x] `npm run flowti` starts interactive menu and quits cleanly with `q`
- [x] `npm run flowti -- build` completes a fast build with exit code 0
- [x] `npm run flowti -- help` displays all sections and commands
- [x] `npm run flowti -- info` shows accurate plugin metadata and git status
- [x] `npm run flowti -- make:hub --name=Test --tabs=overview,items` generates 9 files
- [x] `npm run flowti -- make:plugin --name="Test Plugin"` generates 6 files in correct directory
- [x] `npm run flowti -- report:cli-ref` generates up-to-date CLI Reference vault note
- [x] Generated CLI Reference includes non-interactive command table, npm scripts, and report generators
- [x] Pressing `?` in Build menu shows Build help section
- [x] `npm test` passes with all tests green (CLI is build-time, does not affect test suite)
- [ ] Developer onboarding E2E journey passes against live Obsidian instance
- [ ] AI agent can use non-interactive commands to build, test, and scaffold without human intervention

---

## 13. Definition of Done

- [x] All FR-01 through FR-09 implemented and manually verified
- [ ] FR-10 (E2E journey) implemented and passing
- [x] CLI Reference auto-generated on every increment build
- [x] Man-pages cover all 7 menus with accurate descriptions
- [x] Non-interactive commands tested for all 25 command variants
- [x] No external dependencies added to package.json
- [ ] README updated with CLI section and developer onboarding instructions
- [x] `flowti.config.json` documents all CLI configuration options
- [ ] Developer onboarding scenario tested end-to-end
