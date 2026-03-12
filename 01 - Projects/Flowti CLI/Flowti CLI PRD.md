---
domain: Flowti
type: ProductRequirementsDocument
stage: active
version: 14
maturity: L2
created: 2026-03-07
updated: 2026-03-12
tags:
  - cli
  - developer-experience
  - onboarding
  - automation
  - ai-agent
  - definition-driven
  - core
plugin: "[[01 - Projects/Flowti CLI/README|README]]"
backlog: "[[Product Backlog]]"
roadmap: "[[Development Roadmap]]"
tech_debt: "[[Tech Debt]]"
plugin_integration: "[[Plugin Integration Analysis]]"
---

# Flowti CLI — Product Requirements Document

---

## 1. Vision

The Flowti CLI is a **definition-driven project orchestrator** that serves as the unified command center for all managed projects within an Obsidian vault. It ships as a zero-dependency, self-contained Node.js binary (`node .flowti/bin`) and provides scaffolding, building, testing, reporting, publishing, and health monitoring — for both human developers and AI agents.

The vault IS the memory. Reports, events, components, and documentation are Obsidian notes — queryable, linkable, searchable. The CLI is the runtime that keeps them honest.

---

## 2. Problem Statement

Managing development projects requires:

- **Discovery friction** — no single entry point to understand available commands, pipelines, and scaffolding tools across projects.
- **Script sprawl** — each project has its own npm scripts with overlapping names that are difficult to navigate without tribal knowledge.
- **No scaffolding** — creating a new project, component, or entity requires copy-pasting and manual wiring.
- **Per-project divergence** — each project has different build commands, test runners, publish endpoints, and review workflows, but no unified way to manage them.
- **AI agent gap** — LLM-based coding agents cannot explore interactive menus; they need deterministic, non-interactive commands with structured output and exit codes.
- **Stale documentation** — capabilities change with every cycle, but manual documentation drifts out of sync.

---

## 3. Design Principles

| Principle | Description |
|-----------|-------------|
| **Zero dependencies** | Runtime uses Node.js built-ins exclusively. Dev tooling is devDependencies only. The built binary is self-contained. |
| **Definition-driven** | JSON definitions are the single source of truth for scaffolding, components, and project configuration. Auditable, diffable, version-controllable. |
| **Deterministic** | Same inputs produce the same outputs. Enables reproducible builds and AI agent integration. |
| **Progressive opt-in** | A new project needs nothing but a name. Tests, linting, coverage thresholds, quality gates — all are configured per-project and only active when defined. |
| **Signals, not blockers** | Report generation runs resiliently. A failed report is a signal (visible in the summary), not a reason to abort. Only publish pipelines enforce strict gating. |
| **Vault-native** | The Obsidian vault is the natural home. Reports, docs, events, and components are vault notes. Obsidian features (knowledgebase, capture) are opt-in, never required. |
| **Agent-native** | Every interactive action has a non-interactive equivalent with deterministic exit codes and `--format=json` output. AI agents are first-class citizens. |
| **CLI dictates the schema** | `ProjectConfig` is the single source of truth for project configuration. Projects conform to it — there is no dual-format support. |

---

## 4. Project Types

The CLI manages four kinds of projects. Each has a dedicated scaffold definition and tailored configuration.

| Type | Scaffold ID | Description |
|------|-------------|-------------|
| **Library** | `flowti-bare` | Minimal TypeScript library — `src/index.ts`, `tests/`, `configs/`, tsc-only (no bundler). For utility packages and shared modules. |
| **TypeScript Project** | `flowti-project` | Ready-to-develop TypeScript project with strict mode, Vitest, esbuild, ESLint pre-configured. |
| **TypeScript CLI** | `flowti-cli` | TypeScript CLI tool with `#!/usr/bin/env node` banner, arg parser, `bin` field in package.json. |
| **Obsidian Plugin** | `flowti-obsidian-plugin` | Obsidian plugin skeleton with `manifest.json`, `styles.css`, esbuild with Obsidian externals, `main.ts extends Plugin`. |

**Onboarding**:
- **Create new**: Pick a project type → scaffold creates folder + all files.
- **Import existing**: Copy a folder into the projects directory → CLI detects it, asks for the project type, generates management files.

---

## 5. Capabilities

### 5.1 Project Management

- Project discovery from configured projects directory (`01 - Projects/`)
- Create new projects from 4 scaffold definitions (bare, typescript, cli, obsidian-plugin)
- Import existing folders as managed projects
- Load remote git repositories as submodules
- Per-project configuration via `configs/flowti.config.json` with auto-scaffolding
- Persistent state — selected project remembered across sessions

### 5.2 Scaffolding & Components

- **Project scaffolding** from declarative JSON definitions bundled into the binary
- **Component system** with 8 types: 4 C4 architecture entities (System, Container, Component, Person) + 4 UI building blocks (Generic, Layout, Page, UI Component)
- Each component generates: documentation (Markdown + YAML frontmatter), test file, definition JSON, and optionally a Storybook v10 story
- ECS-compatible properties — typed key-value pairs with defaults and descriptions
- Post-creation editing via `edit:component`

### 5.3 Build, Test & Review

- **Build**: Run project's configured build commands. Supports named build modes (`fast`, `increment`, `full`, `watch`, `distribute`) via `build.commands` config.
- **Test**: Run test suites via `test.commands` config. Supports named presets (`unit`, `flows`, `e2e`, `increment`).
- **Review**: E2E journey review with test vault isolation (created outside git repository, fresh CLI build on every ensure/refresh).
- **Publish**: Gated pipeline enforcing build → test → distribute sequencing. Quality gates block publish when thresholds aren't met. Supports `--dry-run`.

### 5.4 Reports & Documentation

- **6 built-in report generators**: test, coverage, codebase, complexity, status, summary
- **2 built-in reference generators**: CLI Reference, Entity Reference
- **External generators**: Script-based generators via `reports.scripts[]` config (used by the Plugin's 14 generators)
- **Report pipeline**: Resilient execution — never stops on failure. Prerequisites, caching, phased parallel generation, diff mode, HTML export.
- **Documentation pipeline**: External doc generators + built-in reference generators, unified through the same pipeline engine.
- **Audit mode**: `reports:audit` snapshots all reports to a timestamped archive.

### 5.5 Events & Contracts

- Per-project event catalog stored as Markdown files in `docs/events/`
- Interactive and non-interactive CRUD with auto-discovered wikilinks
- Payload schema editor with versioning and migration notes
- Contract validation — parse and validate event payload schemas
- TypeScript codegen from event contracts

### 5.6 Health & Quality

- **Health dashboard**: Aggregates test, coverage, lint, git, security, and component metrics from report frontmatter. Numeric scoring (0–100, A–F) with configurable thresholds.
- **Health trends**: Snapshot persistence, delta indicators (▲/▼), regression alerts.
- **Quality gates**: Configurable rules that block publish (min score, zero failures, lint limits). `publish:check` previews gate status.
- **npm audit integration**: Security vulnerability count as a health metric.
- **Technical debt estimation**: Remediation time from lint, complexity, and security metrics.

### 5.7 Ecosystem

- **Plugin system**: Vault-level plugins in `.flowti/plugins/` with shell commands, lifecycle hooks (`onInstall`, `onEnable`, `onBeforeCommand`, `onAfterCommand`), collision detection.
- **AI tool management**: Vault-level AI agent tool definitions with typed parameters, execution via `ai:run --tool=X`, `--dry-run` mode.
- **Shell completions**: bash, zsh, fish, PowerShell.
- **Remote registry**: Fetch and install shared definitions, plugins, and AI tools from HTTP registries.
- **Marketplace**: Export bundles of tools, plugins, and scaffold definitions for cross-vault sharing.
- **Cross-project dependencies**: Dependency detection (npm, config, publish edges), DFS cycle detection, Mermaid visualization.

### 5.8 Project Management & Lifecycle

- **Resources**: Human, material, role, and budget management with pricing, consumption tracking, and financial analysis (cost, FTE, remaining).
- **Time-Log**: Per-person time tracking with date, hours, category, and task linking. Summary aggregation.
- **Deliverables**: Tracked project outputs with status, due date, assignee, priority, and completion percentage.
- **RAID Log**: Risks, assumptions, issues, dependencies, and decisions with severity, ownership, and resolution status.
- **Requirements Management**: IREB-compliant requirements (functional, non-functional, constraint) with MoSCoW priority, traceability links. Use cases with actors and flows. User stories with role-goal-benefit pattern and story points.
- **CAPA**: Corrective and preventive action tracking through identification, root cause analysis, action planning, implementation, verification, and closure. Severity levels and source categorization.
- **Lifecycle Engine**: Generic state machine for projects (inception→archived), products (concept→sunset), and features (ideation→deprecated). Validated transitions, transition history, terminal state detection. Standalone entities at vault level (02 - Products/, 03 - Features/) or nested inside projects.
- **Configurable lint thresholds**: ESLint complexity and file length limits configurable per-project via `devtools.thresholds` in `flowti.config.json`.

All management domains follow the store pattern: pure functions with injected deps, markdown files with YAML frontmatter. Each domain has its own configurable directory under `management.*` in the project config.

### 5.9 Developer Experience

- **Two-stage interactive menu**: Project selection (open/create/import/plugins/ai-tools) → Project detail.
- **Man-page system**: 10 help sections accessible via `?` in any menu or `flowti help [section]`.
- **Capture**: Quick-capture ideas and notes with tags, search, and batch import.
- **Knowledgebase**: Browse and search vault content (requires Obsidian CLI, opt-in).
- **Post-command suggestions**: Contextual next-step hints after operations.
- **Template versioning**: Detect drift between scaffolded projects and updated templates, with conflict resolution.
- **Build freshness**: Hash-based detection of whether a rebuild is needed.

---

## 6. UX Entry Points

### Human Developer

| Entry Point | How |
|-------------|-----|
| Interactive menu | `./flowti.cmd` or `npm run dev` → two-stage menu |
| Any command | `flowti <command> --project="X" [--flag=value]` |
| Help | `flowti help [section]` or `?` in any menu |

### AI Agent

| Capability | Command | Output |
|-----------|---------|--------|
| Discover commands | `flowti help` | Structured help text |
| Build project | `flowti build [--mode=fast]` | Exit 0/non-zero |
| Run tests | `flowti test [--mode=unit]` | Exit 0/non-zero |
| Add component | `flowti make:component --name=X` | File list, exit 0 |
| Project info | `flowti info --format=json` | Structured JSON |
| Health check | `flowti health --format=json` | Scored snapshot |
| Generate reports | `flowti reports --format=json` | Pipeline summary |
| Event catalog | `flowti events:list --format=json` | Event list |

All query commands support `--format=json`. All operations return deterministic exit codes.

---

## 7. Architecture

The CLI follows a **DDD + MVC layered architecture** with strict dependency rules:

```
Entry Point (main.ts)
  → Controller Layer (22 controllers)
    → UI / View Layer (74 display renderers + menus)
      → Domain Layer (24 modules — pure, no I/O, no presentation)
        → Infrastructure Layer (33 modules + pipeline + event-bus)
Bootstrap Layer (bootstrap.mjs)
```

**Dependency rule**: Controller → Domain → Infrastructure. Controller → UI (renderers). Never Infrastructure → Domain. Never Domain → Domain (cross-domain). `main.ts` is the sole composition root.

| Layer | Purpose |
|-------|---------|
| **Entry Point** | Two-loop menu system + command dispatch via `CommandRegistry` |
| **Controller** | Thin handlers: parse flags, call domain services, return `CliResponse<T>` with typed data + renderer |
| **UI / View** | Display renderers: take typed data models, produce ANSI-formatted console output |
| **Domain** | Pure business logic — scaffold, make, build, publish, review, reports, events, capture, info, onboarding, knowledgebase, devtools, e2e, plugins, ai-tools, health, lifecycle, resources, timelog, deliverables, raid, requirements, capa, templates |
| **Infrastructure** | I/O abstractions — filesystem, shell, input, state, config, document builder, frontmatter, errors, output, command-registry, menu, ui, clock, proc, paths, logger, args, pipeline, event-bus |
| **Scripts** | Standalone CLI entry points (`main()` functions) that wire infrastructure to domain services |

All I/O is behind typed abstractions (`disk`, `shell`, `paths`, `proc`, `log`). No domain code imports `node:fs`, `node:child_process`, or `node:path` directly. Domain files never import `logger.js` or `ui.js` — progress is communicated via injectable `log` callbacks or the EventBus.

### Invocation Chain

```
flowti.cmd → node .flowti/bin → .flowti/bin/index.js (bootstrap) → .flowti/bin/main.js (CLI)
```

The bootstrap handles: vault root derivation → dependency install → CLI build → forward arguments.

### Vault Layout

```
<vault-root>/
├── .flowti/
│   ├── config.json          # Vault-level config
│   ├── var/state.json       # Persistent state (selected project)
│   ├── plugins/             # Vault-level plugin manifests
│   ├── ai-tools/            # Vault-level AI tool definitions
│   └── bin/                 # Compiled CLI binary
├── flowti.cmd               # Windows launcher
└── 01 - Projects/           # Projects directory
    ├── Flowti CLI/          # The CLI itself (self-hosting)
    └── My Project/          # Any managed project
```

---

## 8. Per-Project Configuration

Each project stores its config in `configs/flowti.config.json`. The `ProjectConfig` type is the single authoritative schema.

```json
{
  "name": "my-project",
  "type": "typescript",
  "build": {
    "commands": {
      "fast": "node esbuild.config.mjs --production",
      "watch": "node esbuild.config.mjs --watch"
    }
  },
  "test": {
    "commands": {
      "unit": "npm run check && vitest run",
      "e2e": "npm run test:e2e"
    }
  },
  "reports": {
    "generators": [
      { "id": "test", "label": "Test Report" },
      { "id": "coverage", "label": "Coverage Report" }
    ]
  },
  "publish": {
    "build": "npm run build",
    "test": "npm test",
    "outDir": "dist",
    "endpoints": [{ "name": "Local", "path": "../output" }]
  },
  "health": {
    "thresholds": { "coverageLines": 80, "maxComplexity": 15 },
    "qualityGates": {
      "enabled": true,
      "minScore": 60,
      "rules": [{ "metric": "tests.failing", "operator": "==", "value": 0 }]
    }
  }
}
```

When a project is selected for the first time, the CLI auto-scaffolds this config from `package.json` scripts. Config is validated with clear error messages via `config-schema.ts` (45+ rules) and `config-deep-validation.ts` (filesystem-aware deep validation).

---

## 9. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| CLI startup time | < 100ms |
| Self-contained binary | `node .flowti/bin` requires no source tree |
| Fast build | < 3s |
| No production dependencies | Dev tooling only; runtime uses Node.js built-ins |
| Cross-platform | Windows, macOS, Linux |
| AI agent compatibility | Deterministic exit codes, `--format=json`, no interactive prompts in non-interactive mode |
| Definition-driven | All scaffolding from declarative JSON definitions |
| Deterministic output | Same inputs → same outputs |
| Scaffolding safety | Never overwrite existing files; abort on name collision |
| Progressive opt-in | All features, restrictions, and quality gates are opt-in |
| Resilient reports | Report generation never stops on failure |
| Zero runtime footprint | CLI is build-time only; not bundled into projects |

---

## 10. Risks

| Risk | Mitigation |
|------|------------|
| CLI binary grows beyond maintainability | Modular DDD structure (24 domain modules) keeps cognitive load low |
| Per-project config divergence | Auto-scaffolding from package.json ensures consistent defaults |
| Definition schema drift | Definitions validated on load; TypeScript types enforce schema |
| AI agents can't parse output | `--format=json` on all query commands; deterministic exit codes |
| Single scaffold definition limits adoption | 4 bundled definitions + marketplace for community templates |
| Plugin ecosystem has no lifecycle | 5 lifecycle hooks implemented (onInstall through onAfterCommand) |

---

## 11. Competitive Position

Flowti CLI occupies a unique niche: **vault-native project management CLI**. No existing tool combines knowledge management (Obsidian vault), project scaffolding, health scoring, report generation, and AI tool configs in a single CLI binary.

### Defensible Advantages

| Advantage | Why It Matters |
|-----------|---------------|
| **Vault-native** | Reports, docs, events, components are Obsidian notes — queryable, linkable, searchable |
| **Zero dependencies** | No npm install, no lock file conflicts, self-contained binary |
| **Progressive opt-in** | Start with nothing, grow into quality gates — no upfront ceremony |
| **Agent-native** | Non-interactive commands with `--format=json` and deterministic exit codes |
| **Definition-driven** | JSON definitions are the single source of truth |
| **Multi-project** | Manages multiple projects of different types from one binary |

---

## 12. Current State (2026-03-12)

| Metric | Value |
|--------|-------|
| Source files | 343 |
| Test files | 245 (239 suites) |
| Tests passing | 3,899 |
| Domain modules | 24 |
| Controllers | 22 |
| UI view files | 74 |
| Infrastructure modules | 33 |
| Runtime dependencies | 0 |
| Scaffold definitions | 4 (project, bare/library, cli, obsidian-plugin) |
| Component definitions | 8 (4 C4 + 4 UI building blocks) |
| Report generators | 8 (6 report + 2 reference) |
| E2E environment providers | 5 |
| Technical debt items | 28 (16 resolved) |
| Build | Clean (0 errors) |
| TypeDoc | Clean (0 errors) |
| ESLint | Clean (0 warnings) |

---

## 13. Related Documents

- **[[Product Backlog]]** — Feature requirements, acceptance criteria, and improvements
- **[[Development Roadmap]]** — Phased execution plan (Phases 5–9)
- **[[Tech Debt]]** — Technical debt register (28 items, 13 resolved)
- **[[Plugin Integration Analysis]]** — Gap analysis for Flowti Plugin integration
- **[[01 - Projects/Flowti CLI/README|README]]** — Quick start, architecture overview, project structure
