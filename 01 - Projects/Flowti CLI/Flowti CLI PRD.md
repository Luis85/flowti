---
domain: Flowti
type: ProductRequirementsDocument
stage: active
version: 15
maturity: L2
created: 2026-03-07
updated: 2026-03-13
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

# Flowti CLI — Product Presentation

> **One binary. Zero dependencies. Every project under control.**

---

## The Problem

Development teams juggle fragmented tooling across every project they manage:

| Problem | Impact |
|---------|--------|
| **No single entry point** | Developers waste time remembering which commands exist in which project. AI agents can't discover or execute them. |
| **Script sprawl** | Every project has its own npm scripts with overlapping names. Onboarding a new contributor means teaching tribal knowledge. |
| **No scaffolding** | Creating a new project, component, or test journey means copy-pasting boilerplate and manually wiring files. |
| **Divergent workflows** | Each project has different build commands, test runners, publish targets, and review processes — with no unified way to manage them. |
| **Stale documentation** | Capabilities change every cycle, but manual documentation drifts out of sync. Reports are either missing or outdated. |
| **No quality visibility** | Test coverage, lint health, security vulnerabilities, and technical debt are scattered across separate tools with no single dashboard. |
| **AI agents are blind** | LLM-based coding agents cannot navigate interactive menus. They need deterministic commands, structured output, and exit codes. |

**The core insight**: These are not separate problems. They are symptoms of having no unified project orchestration layer.

---

## The Solution

Flowti CLI is a **definition-driven project orchestrator** that ships as a self-contained Node.js binary. It provides a unified command center for scaffolding, building, testing, reviewing, publishing, reporting, and managing any number of projects — from a single interactive menu or via non-interactive commands for AI agents.

```
node .flowti/bin
```

That's it. One command. Zero installation. The binary bootstraps itself, installs dependencies if needed, builds if needed, and runs.

### Key Properties

| Property | What It Means |
|----------|---------------|
| **Zero dependencies** | Runtime uses Node.js built-ins exclusively. No `npm install`, no lock file conflicts. The built binary is fully self-contained. |
| **Definition-driven** | JSON definitions are the single source of truth for scaffolding, components, and project configuration. Auditable, diffable, version-controllable. |
| **Deterministic** | Same inputs produce the same outputs. Enables reproducible builds and AI agent integration. |
| **Progressive opt-in** | A new project needs nothing but a name. Tests, linting, coverage thresholds, quality gates — all activate only when configured. |
| **Agent-native** | Every interactive action has a non-interactive equivalent with deterministic exit codes and `--format=json` output. AI agents are first-class citizens. |
| **Vault-native** | Reports, events, components, and documentation are Obsidian notes — queryable, linkable, searchable. Obsidian features are opt-in, never required. |

---

## Capabilities

### 1. Project Scaffolding & Management

**Problem solved**: No more copy-pasting project skeletons or manually wiring boilerplate.

- **4 project types**: TypeScript project, TypeScript CLI, Obsidian plugin, minimal library — each with a complete scaffold definition
- **Component system**: 8 component kinds (4 C4 architecture entities + 4 UI building blocks), each generating documentation, tests, definitions, and optionally Storybook stories
- **Auto-scaffolding**: Select a project for the first time and the CLI generates its `flowti.config.json` from `package.json` scripts
- **ECS properties**: Typed key-value pairs with defaults and descriptions on every component
- **Storybook integration**: Opt-in Storybook v10 per project — install, scaffold stories, dev/build from the Components menu

### 2. Build, Test & Review

**Problem solved**: Fragmented build/test/review workflows become unified, named commands.

- **Named build modes**: `fast`, `increment`, `full`, `watch`, `distribute` — all configured per-project in `build.commands`
- **Named test presets**: `unit`, `flows`, `e2e`, `increment` — configured in `test.commands`
- **E2E journey review**: Test vault isolation (created outside git), fresh CLI build on every ensure/refresh, 5 environment providers (CLI, TypeScript, Obsidian vault, Obsidian plugin, webapp)
- **Gated publish pipeline**: build → test → distribute. Quality gates block publish when thresholds aren't met. Supports `--dry-run`.

### 3. Reports & Documentation

**Problem solved**: Reports are either missing, stale, or scattered. Documentation drifts from reality.

- **6 built-in report generators**: test, coverage, codebase, complexity, status, summary
- **2 built-in reference generators**: CLI Reference, Entity Reference
- **Resilient pipeline**: Report generation never stops on failure — a failed report is a signal, not a blocker
- **Self-documenting**: CLI Reference and Entity Reference are generated from the codebase itself
- **Archive & export**: Timestamped archives, HTML export, diff mode, audit snapshots
- **External generators**: Script-based generators via config for project-specific reports

### 4. Health & Quality Gates

**Problem solved**: No single dashboard for project quality. Teams discover problems too late.

- **Health dashboard**: Aggregates test, coverage, lint, git, security, and component metrics from report frontmatter
- **Numeric scoring**: 0–100 scale (A–F grades) with configurable thresholds per project
- **Health trends**: Snapshot persistence, delta indicators (▲/▼), regression alerts
- **Quality gates**: Configurable rules that block publish (min score, zero failures, lint limits)
- **npm audit integration**: Security vulnerability count as a health metric
- **Technical debt estimation**: Remediation time from lint, complexity, and security metrics

### 5. Events & Contracts

**Problem solved**: Event catalogs live in wikis that drift. Payload schemas are tribal knowledge.

- Per-project event catalog stored as Markdown files with YAML frontmatter
- Interactive and non-interactive CRUD with auto-discovered wikilinks
- Payload schema editor with versioning and migration notes
- Contract validation — parse and validate event payload schemas
- TypeScript codegen from event contracts
- Flow visualization — Mermaid diagrams showing producer/consumer relationships

### 6. Project Management

**Problem solved**: Project management data lives in spreadsheets disconnected from the codebase.

All management domains use the same pattern: pure functions with injected deps, markdown files with YAML frontmatter, configurable directories.

| Domain | What It Tracks |
|--------|---------------|
| **Resources** | Human, material, role, and budget management with pricing, consumption, and financial analysis |
| **Time-Log** | Per-person time tracking with date, hours, category, and task linking |
| **Deliverables** | Tracked project outputs with status, due date, assignee, priority, and completion % |
| **RAID Log** | Risks, assumptions, issues, dependencies, and decisions with severity and ownership |
| **CAPA** | Corrective and preventive actions through identification, root cause analysis, implementation, and verification |
| **Lifecycle** | State machine for projects (inception→archived), products (concept→sunset), features (ideation→deprecated) |

### 7. Ecosystem

**Problem solved**: Extending the CLI requires forking it. Sharing configurations requires manual copying.

- **Plugin system**: Vault-level plugins with shell commands, lifecycle hooks, collision detection
- **AI tool management**: Vault-level AI agent tool definitions with typed parameters, `--dry-run` mode
- **Shell completions**: bash, zsh, fish, PowerShell
- **Remote registry**: Fetch shared definitions, plugins, and AI tools from HTTP registries
- **Cross-project dependencies**: Dependency detection, DFS cycle detection, Mermaid visualization
- **Configurable lint thresholds**: ESLint complexity and file length limits per-project via config

### 8. AI Agent Integration

**Problem solved**: AI coding agents can't interact with interactive CLIs.

Every capability has a non-interactive equivalent:

| Capability | Command | Output |
|-----------|---------|--------|
| Discover commands | `flowti help` | Structured help text |
| Build project | `flowti build [--mode=fast]` | Exit 0/non-zero |
| Run tests | `flowti test [--mode=unit]` | Exit 0/non-zero |
| Add component | `flowti make:component --name=X` | File list, exit 0 |
| Project diagnostics | `flowti info --format=json` | Structured JSON |
| Health check | `flowti health --format=json` | Scored snapshot |
| Generate reports | `flowti reports --format=json` | Pipeline summary |
| Event catalog | `flowti events:list --format=json` | Event list |
| Lifecycle status | `flowti lifecycle:status` | State + transitions |

All query commands support `--format=json`. All operations return deterministic exit codes.

---

## Architecture

The CLI follows a **DDD + MVC layered architecture** with strict dependency rules:

```
Entry Point (main.ts)
  → Controller Layer (22 controllers)
    → UI / View Layer (74 display renderers + menus)
      → Domain Layer (25 modules — pure, no I/O, no presentation)
        → Infrastructure Layer (33 modules + pipeline + event-bus)
Scripts Layer (4 standalone entry points)
```

**Dependency rule**: Controller → Domain → Infrastructure. Controller → UI (renderers). Never Infrastructure → Domain. Never Domain → Domain (cross-domain). `main.ts` is the sole composition root.

| Layer | Purpose |
|-------|---------|
| **Entry Point** | Two-loop menu system + command dispatch via `CommandRegistry` |
| **Controller** | Thin handlers: parse flags, call domain services, return `CliResponse<T>` with typed data + renderer |
| **UI / View** | Display renderers: take typed data models, produce ANSI-formatted console output |
| **Domain** | Pure business logic — 25 modules covering scaffold, make, build, publish, review, reports, events, capture, info, onboarding, knowledgebase, devtools, e2e, plugins, ai-tools, health, lifecycle, resources, timelog, deliverables, raid, requirements, capa, templates |
| **Infrastructure** | I/O abstractions — filesystem, shell, input, state, config, document builder, frontmatter, errors, output, command-registry, menu, ui, clock, proc, paths, logger, args, pipeline, event-bus, deps, request-response, progress |

All I/O is behind typed abstractions (`disk`, `shell`, `paths`, `proc`, `log`). No domain code imports `node:fs`, `node:child_process`, or `node:path` directly.

See [Flowti CLI Architecture.md](Flowti%20CLI%20Architecture.md) for the full design document (46 architectural decisions, 20 implementation milestones).

---

## Per-Project Configuration

Each project stores its config in `configs/flowti.config.json`:

```json
{
  "name": "my-project",
  "type": "typescript",
  "build": { "commands": { "fast": "npm run build", "watch": "npm run build:watch" } },
  "test": { "commands": { "unit": "npm test" } },
  "devtools": { "thresholds": { "maxComplexity": 10, "maxLines": 350 } },
  "make": { "templates": ["journey", "component"] },
  "reports": {
    "generators": [
      { "id": "test", "label": "Test Report", "prerequisites": ["npx vitest run ..."] },
      { "id": "summary", "label": "Summary Report", "dependencies": ["test", "coverage"] }
    ]
  },
  "management": {
    "resources": { "dir": "docs/resources" },
    "timelog": { "dir": "docs/timelog" },
    "deliverables": { "dir": "docs/deliverables" },
    "raid": { "dir": "docs/raid" },
    "capa": { "dir": "docs/capa" }
  },
  "publish": {
    "build": "npm run build",
    "test": "npm test",
    "endpoints": [{ "name": "Local", "path": "../output", "clean": true }]
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

Config is validated with clear error messages via `config-schema.ts` (45+ rules) and `config-deep-validation.ts` (filesystem-aware deep validation). When a project is selected for the first time, the CLI auto-scaffolds this config from `package.json` scripts.

---

## Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| CLI startup time | < 100ms |
| Self-contained binary | `node .flowti/bin` requires no source tree |
| Fast build | < 3s |
| No production dependencies | Runtime uses Node.js built-ins exclusively |
| Cross-platform | Windows, macOS, Linux |
| AI agent compatibility | Deterministic exit codes, `--format=json`, no interactive prompts in non-interactive mode |
| Definition-driven | All scaffolding from declarative JSON definitions |
| Deterministic output | Same inputs → same outputs |
| Scaffolding safety | Never overwrite existing files; abort on name collision |
| Progressive opt-in | All features, restrictions, and quality gates are opt-in |
| Resilient reports | Report generation never stops on failure |
| Zero runtime footprint | CLI is build-time only; not bundled into projects |

---

## Competitive Position

Flowti CLI occupies a unique niche: **definition-driven project management CLI**. No existing tool combines project scaffolding, health scoring, report generation, AI tool integration, and project management in a single zero-dependency binary.

| Advantage | Why It Matters |
|-----------|---------------|
| **Zero dependencies** | No npm install, no lock file conflicts, self-contained binary |
| **Progressive opt-in** | Start with nothing, grow into quality gates — no upfront ceremony |
| **Agent-native** | Non-interactive commands with `--format=json` and deterministic exit codes |
| **Definition-driven** | JSON definitions are the single source of truth — auditable, diffable |
| **Multi-project** | Manages multiple projects of different types from one binary |
| **Vault-native** | Reports, docs, events, components are Obsidian notes — queryable, linkable (opt-in) |
| **Self-hosting** | The CLI manages its own development — it is both the tool and a managed project |

---

## Current State (2026-03-13)

| Metric | Value |
|--------|-------|
| Source files | 352 |
| Test files | 274 (267 suites) |
| Tests passing | 4,505 |
| Domain modules | 25 |
| Controllers | 22 |
| UI view files | 74 |
| Infrastructure modules | 33 |
| Runtime dependencies | 0 |
| Scaffold definitions | 4 (project, bare/library, cli, obsidian-plugin) |
| Component definitions | 8 (4 C4 + 4 UI building blocks) |
| Report generators | 8 (6 report + 2 reference) |
| E2E environment providers | 5 |
| Technical debt items | 30 (21 resolved) |
| Coverage | 80.53% statements, 81.67% lines |
| Build | Clean (0 errors) |
| TypeDoc | Clean (0 errors) |
| ESLint | Clean (0 warnings) |

---

## Risks

| Risk | Mitigation |
|------|------------|
| CLI binary grows beyond maintainability | Modular DDD structure (25 domain modules) keeps cognitive load low |
| Per-project config divergence | Auto-scaffolding from `package.json` ensures consistent defaults |
| Definition schema drift | Definitions validated on load; TypeScript types enforce schema |
| AI agents can't parse output | `--format=json` on all query commands; deterministic exit codes |
| Single scaffold definition limits adoption | 4 bundled definitions + marketplace for community templates |
| Plugin ecosystem has no lifecycle | 5 lifecycle hooks implemented (onInstall through onAfterCommand) |

---

## Related Documents

- **[[Product Backlog]]** — Feature requirements, acceptance criteria, and improvements
- **[[Development Roadmap]]** — Phased execution plan (Phases 5–9)
- **[[Tech Debt]]** — Technical debt register (30 items, 21 resolved)
- **[[Plugin Integration Analysis]]** — Gap analysis for Flowti Plugin integration
- **[[01 - Projects/Flowti CLI/README|README]]** — Quick start, architecture overview, project structure
- **[[Flowti CLI Architecture]]** — Architecture Document (v25)
