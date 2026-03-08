# Flowti CLI

The Flowti CLI is a **project-centric development orchestrator** for the Flowti ecosystem. It manages multiple projects with per-project configuration, scaffolding, builds, testing, reporting, code analysis, and publishing — all from a single interactive command-line tool.

## Quick Start

From the vault root (`c:\Projects\flowti`):

```bash
# Windows — invokes node .flowti/bin (bootstrap → build → run)
.\flowti.cmd
```

Or from any project that has the flowti script configured:

```bash
npm run flowti
```

## Architecture

The CLI follows a **project-centric architecture** with two layers:

| Layer | Purpose |
|-------|---------|
| **CLI Core** | Menu system, shell execution, state management, document builder |
| **Per-Project** | Each project has its own `configs/flowti.config.json` with tool mappings, publish endpoints, and review settings |

Projects are discovered from two directories:
- **Projects** (`01 - Projects/`) — standalone projects (CLI, libraries, tools)
- **Development** (`Development/`) — plugin development projects

See [Architecture.md](docs/Architecture.md) for the full design document.

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
│       ├── main.js          # Compiled CLI (esbuild bundle)
│       ├── main.js.map      # Source map
│       └── package.json     # { "type": "module" }
├── flowti.cmd               # Windows launcher
├── 01 - Projects/           # Projects directory
└── Development/             # Development projects
```

## Project Structure

```
01 - Projects/Flowti CLI/
├── src/
│   ├── main.ts                     # Entry point (two-loop: start → project detail)
│   ├── boot/
│   │   └── bootstrap.mjs           # Frictionless launcher (deployed as .flowti/bin/index.js)
│   ├── domain/
│   │   ├── mainMenu.ts             # Project detail menu builder
│   │   ├── make/                   # Scaffolding (hub, plugin, app, journey)
│   │   ├── publish/                # Gated publish pipeline (build → test → distribute)
│   │   ├── review/                 # E2E journey review (test vault, runner)
│   │   ├── project/                # Project config detection and scaffolding
│   │   ├── info/                   # Project info and diagnostics
│   │   ├── help/                   # Man-page system (9 sections)
│   │   ├── capture/                # Idea and note capture
│   │   ├── knowledgebase/          # Obsidian vault browser and search
│   │   ├── e2e/                    # E2E test session management
│   │   ├── reports/                # Report pipeline (summary, build, cli-reference, ...)
│   │   ├── build/                  # Build command wrapper
│   │   ├── onboarding/             # Prerequisites checks (git, node)
│   │   └── devtools/               # Developer tools (reload, frontmatter fix, test data)
│   └── infrastructure/
│       ├── config.ts               # Path resolution and config loading
│       ├── dispatch.ts             # Pure command dispatch logic
│       ├── test-vault.ts           # Test vault lifecycle (scaffold, teardown)
│       ├── menu.ts                 # Data-driven menu engine
│       ├── shell.ts                # Shell execution wrappers
│       ├── state.ts                # Persistent CLI state (.flowti/var/state.json)
│       ├── document.ts             # Markdown document builder (YAML FM, tables, callouts)
│       ├── ui.ts                   # ANSI color output and menu rendering
│       ├── input.ts                # Interactive input
│       ├── proc.ts                 # Process abstraction (exit, argv, cwd, env)
│       ├── clock.ts                # Clock abstraction (ISO timestamps)
│       ├── logger.ts               # Logging abstraction
│       ├── filesystem.ts           # File system abstraction (IFileSystem)
│       ├── paths.ts                # Path utilities
│       ├── fs.ts                   # Frontmatter parser and file helpers
│       └── types.ts                # Infrastructure type definitions
├── tests/                          # Vitest test suites (1045 tests, 61 suites)
├── configs/
│   ├── flowti-cli.config.json      # CLI kernel config (subsystem mappings)
│   ├── flowti.config.json          # CLI's own project config (tools, publish, reports)
│   ├── esbuild.config.mjs          # Build: bundles to .flowti/bin/main.js + deploys bootstrap
│   ├── tsconfig.json               # TypeScript configuration
│   ├── vitest.config.ts            # Vitest configuration
│   ├── eslint.config.mjs           # ESLint configuration
│   └── typedoc.json                # TypeDoc configuration
├── docs/
│   ├── Architecture.md             # Architecture design document
│   └── reports/                    # Generated reports (summary, complexity, coverage, tests, codebase, builds)
├── reports/                        # Stable report outputs (Project Summary.md)
├── package.json                    # npm scripts and devDependencies
├── Flowti CLI PRD.md               # Product Requirements Document
└── README.md                       # This file
```

## Interactive Mode

Run without arguments for the two-stage interactive menu:

### Start Menu (Project Selection)

| Key | Description |
|-----|-------------|
| 1-N | Select a project from the projects directory |
| d | Switch to development projects |
| q | Quit |

### Project Detail Menu

| Key | Tool | Description |
|-----|------|-------------|
| 1 | Make | Scaffold new hub, plugin, or application |
| 2 | Build | Run the project's build command (generates Build Report) |
| 3 | Review | E2E journey review, test vault management |
| 4 | Publish | Gated pipeline: build → test → distribute to endpoints |
| 5 | Reports | Run all reports or individual generators |
| 6 | Npm Scripts | Run any npm script from the project's package.json |
| 7 | Capture Idea | Quick-capture an idea to vault inbox |
| 8 | Capture Note | Capture a typed note (Task, Bug, Note, Documentation, Idea) |
| d | Documentation | Generate reference docs (per-project generators) |
| k | Knowledgebase | Browse and search vault content (requires Obsidian CLI) |
| i | Info | Project stats, version, config |
| ? | Help | Contextual man-page help |

Tools 2, 6 are **mappable** — enabled when the project's `flowti.config.json` maps them to a command. Tools 1, 3, 4 are **always available**. Knowledgebase requires Obsidian CLI 1.12+.

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
  }
}
```

When a project is selected for the first time, the CLI auto-scaffolds this config from `package.json` scripts.

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
| `report:test` | Generate test report |
| `report:coverage` | Generate coverage report |
| `report:codebase` | Generate codebase report |
| `report:complexity` | Generate complexity report from analysis data |
| `report:status` | Generate project summary report |
| `docs` | Generate TypeDoc documentation |

## Dependencies

**Dev dependencies only.** The CLI has no production dependencies. Dev tooling: TypeScript, Vitest, Vite, tsx, ESLint, TypeDoc, `@pythonidaer/complexity-report`.

## Related Documents

- PRD: [Flowti CLI PRD.md](Flowti%20CLI%20PRD.md)
- Architecture: [docs/Architecture.md](docs/Architecture.md)
- CLI Reference: generated via `npx tsx src/domain/reports/generators/cli-reference.ts`
