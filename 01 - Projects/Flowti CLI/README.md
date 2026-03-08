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
```

## Architecture

The CLI follows a **DDD layered architecture** with strict dependency rules:

```
Entry Point (main.ts)
  └── Domain Layer (15 modules)
        └── Infrastructure Layer (21 modules)
```

**Dependency rule**: Domain → Infrastructure. Never Infrastructure → Domain. Never Domain → Domain (cross-domain). `main.ts` is the sole composition root.

| Layer | Purpose |
|-------|---------|
| **Entry Point** | Two-loop menu system + command dispatch via `CommandRegistry` |
| **Domain** | Business logic — scaffold, make, build, publish, review, reports, events, capture, info, help, onboarding, knowledgebase, devtools, e2e |
| **Infrastructure** | I/O abstractions — filesystem, shell, input, state, config, document builder, frontmatter, errors, output, command-registry, menu, ui, clock, proc, paths, logger, args, test-vault, types |

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
│   └── bin/
│       ├── index.js         # Bootstrap (deployed from src/boot/bootstrap.mjs)
│       ├── main.js          # Compiled CLI (esbuild bundle, self-contained)
│       ├── main.js.map      # Source map
│       └── package.json     # { "type": "module" }
├── flowti.cmd               # Windows launcher
└── 01 - Projects/           # Projects directory
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
| **Info** | Project diagnostics with `--format=json` for AI agents |

## Project Structure

```
01 - Projects/Flowti CLI/
├── src/
│   ├── main.ts                     # Entry point (two-loop: start → project detail)
│   ├── boot/
│   │   └── bootstrap.mjs           # Frictionless launcher (deployed as .flowti/bin/index.js)
│   ├── domain/
│   │   ├── mainMenu.ts             # Project detail menu builder
│   │   ├── menu-builders.ts        # Pure submenu builders (Reports, Docs, Npm Scripts)
│   │   ├── scaffold/               # Project creation from JSON definitions
│   │   │   └── definitions/        # Bundled scaffold definitions (JSON)
│   │   ├── make/                   # In-project scaffolding (journey, component)
│   │   │   └── component/          # Component system (8 kinds, C4 entities)
│   │   │       └── definitions/    # Bundled component definitions (JSON)
│   │   ├── publish/                # Gated publish pipeline (build → test → distribute)
│   │   ├── review/                 # E2E journey review (test vault, runner)
│   │   ├── project/                # Project config detection and management
│   │   ├── info/                   # Project info and diagnostics (--format=json)
│   │   ├── help/                   # Man-page system (8 sections)
│   │   ├── capture/                # Idea and note capture
│   │   ├── knowledgebase/          # Obsidian vault browser and search (opt-in)
│   │   ├── events/                 # Event catalog, payload editor, versioning, flow
│   │   ├── e2e/                    # E2E test session management
│   │   ├── reports/                # Report pipeline (6 generators + 2 references)
│   │   ├── build/                  # Build command wrapper
│   │   ├── onboarding/             # Prerequisites checks (git, node)
│   │   └── devtools/               # Developer tools
│   └── infrastructure/
│       ├── types.ts                # Cross-cutting type definitions
│       ├── config.ts               # Path resolution and config loading
│       ├── dispatch.ts             # Pure command dispatch logic
│       ├── command-registry.ts     # Typed command registry with collision detection
│       ├── menu.ts                 # Data-driven menu engine
│       ├── input.ts                # Interactive input (ask, askYesNo)
│       ├── shell.ts                # Shell execution wrappers
│       ├── state.ts                # Persistent CLI state (.flowti/var/state.json)
│       ├── document.ts             # Markdown document builder (YAML FM, tables, callouts)
│       ├── frontmatter.ts          # YAML frontmatter parse + serialize
│       ├── errors.ts               # Structured errors (CliError, InternalError)
│       ├── output.ts               # Structured output (--format=json)
│       ├── ui.ts                   # ANSI color output and menu rendering
│       ├── filesystem.ts           # File system abstraction (IFileSystem)
│       ├── proc.ts                 # Process abstraction (exit, argv, cwd, env)
│       ├── clock.ts                # Clock abstraction (ISO timestamps)
│       ├── logger.ts               # Logging abstraction
│       ├── paths.ts                # Path utilities
│       ├── args.ts                 # CLI argument parser
│       ├── fs.ts                   # File helpers (countFiles, writeFile)
│       └── test-vault.ts           # Test vault scaffold/teardown
├── tests/                          # Vitest test suites (1,451 tests, 88 suites)
├── configs/
│   ├── flowti.config.json          # CLI's own project config (tools, publish, reports)
│   ├── esbuild.config.mjs          # Build: bundles to .flowti/bin/main.js + deploys bootstrap
│   ├── tsconfig.json               # TypeScript configuration
│   ├── vitest.config.ts            # Vitest configuration
│   ├── eslint.config.mjs           # ESLint configuration
│   └── typedoc.json                # TypeDoc configuration
├── docs/
│   └── reports/                    # Generated reports
├── reports/                        # Stable report outputs (Project Summary.md)
├── package.json                    # npm scripts and devDependencies
├── Flowti CLI PRD.md               # Product Requirements Document
├── Flowti CLI Architecture.md      # Architecture Document (v13)
└── README.md                       # This file
```

## Interactive Mode

Run without arguments for the two-stage interactive menu:

### Start Menu (Project Selection)

| Key | Description |
|-----|-------------|
| 1-N | Open an existing project |
| + | Create a new project (from scaffold definitions) |
| q | Quit |

### Project Detail Menu

| Key | Tool | Description |
|-----|------|-------------|
| 1 | Make | Scaffold new journey or component (C4 entities) |
| 2 | Build | Run the project's build command (generates Build Report) |
| 3 | Review | E2E journey review, test vault management |
| 4 | Publish | Gated pipeline: build → test → distribute to endpoints |
| c | Components | Browse project components with C4 hierarchy and properties |
| e | Events | Event catalog: list, add, versioning, flow visualization |
| — | — | — |
| 5 | Reports | Run all reports or individual generators |
| 6 | Npm Scripts | Run any npm script from the project's package.json |
| — | — | — |
| 7 | Capture Idea | Quick-capture an idea to vault inbox |
| 8 | Capture Note | Capture a typed note (Task, Bug, Note, Documentation, Idea) |
| — | — | — |
| d | Documentation | Generate reference docs (Update All, CLI/Entity Ref.) |
| k | Knowledgebase | Browse and search vault content (requires Obsidian CLI, opt-in) |
| i | Info | Project stats, version, config |
| — | — | — |
| b | Back | Return to Start Menu |
| ? | Help | Contextual man-page help |
| q | Quit | Exit the CLI |

Tools 2, 6 are **mappable** — enabled when the project's `flowti.config.json` maps them to a command. Tools 1, 3, 4 are **always available**.

## Component System

Components are the base building blocks of Flowti projects, supporting C4 architecture entities:

| Command | Type | C4 Level | Description |
|---------|------|----------|-------------|
| `make:component` | Generic | — | General-purpose component |
| `make:layout` | Layout | — | UI layout with direction, gap, padding properties |
| `make:page` | Page | — | Page with title, route, authenticated properties |
| `make:ui-component` | UI Component | — | UI component with variant, disabled, visible properties |
| `make:system` | C4 System | 1 | Top-level system boundary |
| `make:container` | C4 Container | 2 | Deployable unit within a system |
| `make:c4-component` | C4 Component | 3 | Code-level component within a container |
| `make:person` | C4 Person | 0 | Actor interacting with the system |

Each component generates:
- **Documentation** — Markdown with YAML frontmatter (type, status, C4 metadata, properties)
- **Test file** — Vitest skeleton
- **Definition** — JSON metadata file
- **Story** — Storybook story (layout, page, ui-component only)

Components support **ECS-compatible properties** (typed key-value pairs with defaults), **C4 hierarchy** (containedBy/contains relationships, ancestry paths, siblings), and **post-creation editing** via `edit:component`.

## Per-Project Configuration

Each project stores its config in `configs/flowti.config.json`:

```json
{
  "name": "my-project",
  "tools": {
    "build": "npm run build",
    "reports": "npm run reports",
    "devtools": "npm run dev"
  },
  "publish": {
    "build": "npm run build",
    "test": "npm test",
    "outDir": "dist",
    "artifacts": ["main.js", "styles.css"],
    "endpoints": [
      { "name": "Local", "path": "../output", "clean": true }
    ]
  },
  "review": {
    "journeysDir": "tests/e2e/journeys",
    "runner": "npm run test:e2e",
    "build": "npm run build",
    "test": "npm test"
  },
  "make": {
    "templates": ["journey", "component"]
  }
}
```

When a project is selected for the first time, the CLI auto-scaffolds this config from `package.json` scripts. Config is validated with helpful error messages via `config-schema.ts` (45 validation rules).

## npm Scripts

| Script | Description |
|--------|-------------|
| `dev` | Run CLI in development mode via tsx |
| `build` | Bundle to `.flowti/bin/main.js` + deploy bootstrap as `index.js` |
| `test` | Type-check + lint + vitest |
| `check` | Type-check only (tsc --noEmit) |
| `lint` | ESLint source |
| `analysis` | Run complexity analysis (coverage + decision points) |
| `reports` | Generate all reports (test, coverage, codebase, complexity, summary) |
| `docs` | Generate TypeDoc documentation |

## Dependencies

**Dev dependencies only.** The CLI has no production dependencies — the built binary is self-contained. Dev tooling: TypeScript, Vitest, Vite, tsx, ESLint, TypeDoc, `@pythonidaer/complexity-report`.

## Related Documents

- PRD: [Flowti CLI PRD.md](Flowti%20CLI%20PRD.md)
- Architecture: [Flowti CLI Architecture.md](Flowti%20CLI%20Architecture.md)
- CLI Reference: generated via `flowti docs` or interactive Documentation menu
