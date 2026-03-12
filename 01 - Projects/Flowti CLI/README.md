# Flowti CLI

The Flowti CLI is a **definition-driven project orchestrator** that provides the complete runtime for managing Flowti projects. It ships as a self-contained Node.js binary (`node .flowti/bin`).

## Principles

1. **`node .flowti/bin` is the sole runtime** — the binary is self-contained; the source tree is never a dependency.
2. **Definition-driven** — JSON definitions are the single source of truth for scaffolding, components, and project configuration.
3. **Deterministic** — same inputs produce the same outputs, enabling reproducible builds and AI agent integration.
4. **Type-safe config per project** — `flowti.config.json` per project, `.flowti/` at vault level.
5. **Obsidian is opt-in** — the CLI works standalone; Obsidian vault features are optional.
6. **Testability first** — all I/O behind typed abstractions; ESLint, Vitest, automated documentation and reporting.
7. **Zero dependencies** — runtime uses Node.js built-ins exclusively; dev tooling is devDependencies only.

## Quick Start

From the vault root:

```bash
# Windows — invokes node .flowti/bin (bootstrap → build → run)
.\flowti.cmd
```

Non-interactive commands:

```bash
flowti help
flowti build --project="Flowti CLI"
flowti info --project="Flowti Plugin" --format=json
flowti events:list --project="Flowti Plugin"
flowti lifecycle:status --project="Flowti CLI"
flowti requirements:list --project="Flowti CLI"
```

## Architecture

The CLI follows a **DDD + MVC layered architecture** with strict dependency rules:

```
Entry Point (main.ts)
  → Controller Layer (22 controllers)
    → UI / View Layer (71 display renderers + menus)
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
| **Domain** | Pure business logic — scaffold, make, build, publish, review, reports, events, capture, info, onboarding, knowledgebase, devtools, e2e, plugins, ai-tools, health, lifecycle, resources, timelog, deliverables, raid, requirements, capa, templates |
| **Infrastructure** | I/O abstractions — filesystem, shell, input, state, config, document builder, frontmatter, errors, output, command-registry, menu, ui, clock, proc, paths, logger, args, pipeline, event-bus, deps, request-response, progress |

See [Flowti CLI Architecture.md](Flowti%20CLI%20Architecture.md) for the full design document.

### Invocation Chain

```
flowti.cmd → node .flowti/bin → .flowti/bin/index.js (bootstrap) → .flowti/bin/main.js (CLI)
```

The bootstrap (`src/boot/bootstrap.mjs`, deployed as `.flowti/bin/index.js`) handles the full lifecycle:
1. Derives vault root from its own location (`.flowti/bin/` → `../../`)
2. Reads `.flowti/config.json` to locate the CLI source project
3. Installs dependencies (`npm ci`) if `node_modules` is missing
4. Builds the CLI (`npm run build`) if `.flowti/bin/main.js` is missing
5. Runs the compiled CLI, forwarding all arguments

### Vault Layout

```
<vault-root>/
├── .flowti/
│   ├── config.json          # Vault-level config (source project path)
│   ├── var/state.json       # Persistent state (selected project)
│   ├── plugins/             # Vault-level plugin manifests (<name>/manifest.json)
│   ├── ai-tools/            # Vault-level AI tool definitions (<name>.json)
│   └── bin/
│       ├── index.js         # Bootstrap (deployed from src/boot/bootstrap.mjs)
│       ├── main.js          # Compiled CLI (esbuild bundle, self-contained)
│       ├── main.js.map      # Source map
│       └── package.json     # { "type": "module" }
├── flowti.cmd               # Windows launcher
├── 01 - Projects/           # Projects directory
├── 02 - Products/           # Standalone product folders (lifecycle-managed)
└── 03 - Features/           # Standalone feature folders (lifecycle-managed)
```

## Base Feature Set

| Feature | Description |
|---------|-------------|
| **Project Management** | Create, open, and configure projects |
| **Components** | C4 architecture entities (System, Container, Component, Person) + UI building blocks with ECS properties |
| **Events** | Per-project event catalog with payload editor, versioning, and flow visualization |
| **Make** | Scaffold journeys and components from declarative JSON definitions |
| **Build** | Run the project's configured build command |
| **Tests** | Run test suites via project configuration |
| **Reports** | Generate test, coverage, codebase, complexity, status, and summary reports |
| **Documentation** | Generate reference docs (CLI Reference, Entity Reference, TypeDoc) |
| **Review** | E2E journey review with test vault isolation |
| **Publish** | Gated pipeline: build → test → distribute to endpoints |
| **Capture** | Quick-capture ideas and typed notes to vault inbox |
| **Plugins** | Vault-level CLI plugins — list, validate, create, reference |
| **AI Tools** | Vault-level AI agent tool definitions — list, validate, create, reference |
| **Health** | Project health dashboard — tests, coverage, lint, git metrics |
| **Info** | Project diagnostics with `--format=json` for AI agents |
| **Resources** | Human, material, role, and budget management with financial analysis |
| **Time-Log** | Per-person time tracking with category and task linking |
| **Deliverables** | Tracked project outputs with status, assignee, and progress |
| **RAID Log** | Risks, assumptions, issues, dependencies, and decisions |
| **Requirements** | IREB-compliant requirements with use cases and user stories |
| **CAPA** | Corrective and preventive action tracking |
| **Lifecycle** | State machine for projects, products, and features |

## Project Structure

```
01 - Projects/Flowti CLI/
├── src/
│   ├── main.ts                     # Entry point (two-loop: start → project detail)
│   ├── boot/
│   │   └── bootstrap.mjs           # Frictionless launcher (deployed as .flowti/bin/index.js)
│   ├── controller/                  # 22 controllers (thin: parse flags → domain → CliResponse)
│   ├── ui/                          # 71 display renderers + menus (ANSI output)
│   ├── scripts/                     # 4 standalone entry points (analysis, fix-frontmatter, etc.)
│   ├── domain/
│   │   ├── scaffold/               # Project creation from 4 JSON definitions
│   │   ├── make/                   # In-project scaffolding (journey, component)
│   │   │   └── component/          # Component system (8 kinds, C4 entities)
│   │   ├── build/                  # Build freshness detection
│   │   ├── publish/                # Gated publish pipeline
│   │   ├── review/                 # E2E journey review
│   │   ├── project/                # Project config detection and management
│   │   ├── reports/                # Report pipeline (14 generators, export, archive)
│   │   ├── e2e/                    # E2E test session management (35 files)
│   │   ├── events/                 # Event catalog, contracts, versioning
│   │   ├── health/                 # Quality gate dashboard
│   │   ├── lifecycle/              # State machine engine (project/product/feature)
│   │   ├── resources/              # Resource and budget management
│   │   ├── timelog/                # Time tracking
│   │   ├── deliverables/           # Deliverable tracking
│   │   ├── raid/                   # RAID log
│   │   ├── requirements/           # IREB requirements + use cases + user stories
│   │   ├── capa/                   # Corrective/preventive actions
│   │   ├── templates/              # User-defined entity templates
│   │   ├── capture/                # Idea and note capture
│   │   ├── plugins/                # Vault-level plugin system
│   │   ├── ai-tools/               # Vault-level AI tool management
│   │   ├── info/                   # Project info and diagnostics
│   │   ├── onboarding/             # Prerequisites checks (git, node)
│   │   ├── knowledgebase/          # Obsidian vault browser (opt-in)
│   │   └── devtools/               # Developer tools
│   └── infrastructure/
│       ├── types.ts                # Cross-cutting type definitions
│       ├── deps.ts                 # DI container (CliDeps + ISP subsets)
│       ├── request-response.ts     # MVC: CliRequest, CliResponse, adapt()
│       ├── config.ts               # Path resolution and config loading
│       ├── dispatch.ts             # Pure command dispatch logic
│       ├── command-registry.ts     # Typed command registry with collision detection
│       ├── pipeline/               # Generic DAG execution engine
│       ├── event-bus.ts            # Lightweight synchronous EventBus
│       └── ...                     # 25 more infrastructure modules
├── tests/                          # Vitest test suites (3,742 tests, 232 suites)
├── configs/
│   ├── flowti.config.json          # CLI's own project config
│   ├── esbuild.config.mjs          # Build: bundles to .flowti/bin/main.js
│   ├── tsconfig.json               # TypeScript configuration
│   ├── vitest.config.ts            # Vitest configuration
│   ├── eslint.config.mjs           # ESLint (configurable thresholds from flowti.config.json)
│   └── typedoc.json                # TypeDoc configuration
├── docs/
│   ├── reference/                  # Generated references (CLI, Entity, Plugin, AI Tool)
│   └── reports/                    # Generated reports
├── reports/                        # Stable report outputs (Project Summary.md)
├── package.json                    # npm scripts and devDependencies
├── Flowti CLI PRD.md               # Product Requirements Document (v14)
├── Flowti CLI Architecture.md      # Architecture Document (v22)
└── README.md                       # This file
```

## Interactive Mode

Run without arguments for the two-stage interactive menu:

### Start Menu (Project Selection)

| Key | Description |
|-----|-------------|
| 1 | Open an existing project |
| 2 | Create a new project (from scaffold definitions) |
| p | Plugins — list, validate, create, generate reference |
| a | AI Tools — list, validate, create, generate reference |
| q | Quit |

### Project Detail Menu

| Key | Tool | Description |
|-----|------|-------------|
| 1 | Make | Scaffold new journey or component (C4 entities) |
| 2 | Build | Run the project's build command (generates Build Report) |
| 3 | Review | E2E journey review, test vault management |
| 4 | Publish | Gated pipeline: build → test → distribute to endpoints |
| c | Components | Browse project components with C4 hierarchy and properties |
| e | Events / Requirements | Event catalog + Requirements Management |
| — | — | — |
| 5 | Reports | Run all reports or individual generators |
| 6 | Npm Scripts | Run any npm script from the project's package.json |
| — | — | — |
| 7 | Capture Idea | Quick-capture an idea to vault inbox |
| 8 | Capture Note | Capture a typed note (Task, Bug, Note, Documentation, Idea) |
| — | — | — |
| d | Documentation | Generate reference docs (Update All, CLI/Entity Ref.) |
| m | Project Management | Resources, Time-Log, Deliverables, RAID, Requirements, CAPA, Lifecycle, Health |
| k | Knowledgebase | Browse and search vault content (requires Obsidian CLI, opt-in) |
| i | Info | Project stats, version, config |
| — | — | — |
| b | Back | Return to Start Menu |
| ? | Help | Contextual man-page help |
| q | Quit | Exit the CLI |

## Per-Project Configuration

Each project stores its config in `configs/flowti.config.json`:

```json
{
  "name": "my-project",
  "build": { "commands": { "fast": "npm run build", "watch": "npm run build:watch" } },
  "test": { "commands": { "unit": "npm test" } },
  "devtools": {
    "commands": { "check": "npm run check", "lint": "npm run lint" },
    "thresholds": { "maxComplexity": 10, "maxLines": 350 }
  },
  "make": { "templates": ["journey", "component"] },
  "reports": {
    "generators": [
      { "id": "test", "label": "Test Report", "prerequisites": ["npx vitest run ..."] },
      { "id": "summary", "label": "Summary Report", "dependencies": ["test", "coverage"] }
    ],
    "thresholds": { "coverageLines": 80, "maxComplexity": 15 }
  },
  "management": {
    "resources": { "dir": "docs/resources" },
    "timelog": { "dir": "docs/timelog" },
    "deliverables": { "dir": "docs/deliverables" },
    "raid": { "dir": "docs/raid" },
    "requirements": { "dir": "docs/requirements" },
    "capa": { "dir": "docs/capa" }
  },
  "publish": {
    "build": "npm run build",
    "test": "npm test",
    "endpoints": [{ "name": "Local", "path": "../output", "clean": true }]
  }
}
```

When a project is selected for the first time, the CLI auto-scaffolds this config from `package.json` scripts. Config is validated with helpful error messages via `config-schema.ts`.

## npm Scripts

| Script | Description |
|--------|-------------|
| `build` | Bundle to `.flowti/bin/main.js` + deploy bootstrap as `index.js` |
| `build:watch` | Rebuild on file changes |
| `test` | Type-check + lint + vitest |
| `lint` | ESLint source (thresholds from flowti.config.json) |
| `check` | lint + tsc --noEmit |
| `typedoc` | Generate TypeDoc documentation |

## Dependencies

**Dev dependencies only.** The CLI has no production dependencies — the built binary is self-contained. Dev tooling: TypeScript, Vitest, Vite, tsx, ESLint, TypeDoc, `@pythonidaer/complexity-report`.

## Related Documents

- PRD: [Flowti CLI PRD.md](Flowti%20CLI%20PRD.md) — Vision, capabilities, design principles
- Backlog: [Product Backlog.md](docs/Product%20Backlog.md) — Feature requirements, acceptance criteria, improvements
- Roadmap: [Development Roadmap.md](docs/Development%20Roadmap.md) — Phased execution plan
- Tech Debt: [Tech Debt.md](docs/Tech%20Debt.md) — Technical debt register
- Plugin Integration: [Plugin Integration Analysis.md](docs/Plugin%20Integration%20Analysis.md) — Gap analysis for Flowti Plugin
- Architecture: [Flowti CLI Architecture.md](Flowti%20CLI%20Architecture.md) — v22
- CLI Reference: generated via `flowti docs` or interactive Documentation menu
