# Flowti CLI

The Flowti CLI is a **project-centric development orchestrator** for the Flowti ecosystem. It manages multiple projects with per-project configuration, scaffolding, builds, testing, reporting, code analysis, and publishing — all from a single interactive command-line tool.

## Quick Start

From the vault root (`c:\Projects\flowti`):

```bash
# Windows
./flowti.cmd
```

Or from the CLI project directly:

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

## Project Structure

```
01 - Projects/Flowti CLI/
├── src/
│   ├── main.ts                     # Entry point (two-loop: start → project detail)
│   ├── mainMenu.ts                 # Project detail menu builder
│   ├── types.ts                    # Shared type definitions
│   ├── domain/
│   │   ├── make/                   # Scaffolding (hub, plugin, component, journey)
│   │   ├── publish/                # Gated publish pipeline (build → test → distribute)
│   │   ├── review/                 # E2E journey review (test vault, runner)
│   │   ├── project/                # Project config detection and scaffolding
│   │   ├── info/                   # Project info and diagnostics
│   │   ├── help/                   # Man-page system
│   │   ├── capture/                # Idea and note capture
│   │   ├── knowledgebase/          # Obsidian knowledgebase integration
│   │   ├── reports/                # Report generators (test, coverage, codebase, complexity, status)
│   │   └── devtools/               # Developer tools (reload, frontmatter fix)
│   └── infrastructure/
│       ├── config.ts               # Path resolution and config loading
│       ├── menu.ts                 # Data-driven menu engine
│       ├── shell.ts                # Shell execution wrappers
│       ├── state.ts                # Persistent CLI state
│       ├── document.ts             # Markdown document builder (YAML FM, tables, callouts)
│       ├── ui.ts                   # ANSI color output and menu rendering
│       ├── readline.ts             # Interactive input
│       └── fs.ts                   # File system helpers
├── tests/                          # Vitest test suites (51 tests)
├── configs/
│   ├── flowti-cli.config.json      # CLI kernel config (subsystem mappings)
│   ├── flowti.config.json          # CLI's own project config
│   ├── tsconfig.json               # TypeScript configuration
│   ├── vitest.config.ts            # Vitest configuration
│   ├── eslint.config.mjs           # ESLint configuration
│   └── typedoc.json                # TypeDoc configuration
├── docs/
│   ├── Architecture.md             # Architecture design document
│   ├── Flowti CLI Reference.md     # Auto-generated CLI reference
│   └── reports/                    # Generated reports (complexity, coverage, tests, codebase)
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
| 1 | Make | Scaffold new hub, plugin, component, or journey |
| 2 | Build | Run the project's build command (mapped tool) |
| 3 | Review | E2E journey review, test vault management |
| 4 | Publish | Gated pipeline: build → test → distribute to endpoints |
| 5 | Reports | Run the project's reports command (mapped tool) |
| 6 | Dev Tools | Run the project's dev command (mapped tool) |
| 7 | Npm Scripts | Run any npm script from the project's package.json |

Tools 2, 5, 6 are **mappable** — enabled when the project's `flowti.config.json` maps them to a command. Tools 1, 3, 4 are **always available**.

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
| `build` | Compile TypeScript to `bin/` |
| `test` | Type-check + run vitest |
| `check` | Type-check only (tsc --noEmit) |
| `lint` | ESLint source |
| `analysis` | Run complexity-analysis (coverage + decision points) |
| `reports` | Generate all reports (test, coverage, codebase, complexity) |
| `report:complexity` | Generate complexity report from analysis data |
| `report:status` | Generate project status report |

## Dependencies

**Dev dependencies only.** The CLI has no production dependencies. Dev tooling: TypeScript, Vitest, Vite, tsx, ESLint, TypeDoc, `@pythonidaer/complexity-report`.

## Related Documents

- PRD: [Flowti CLI PRD.md](Flowti%20CLI%20PRD.md)
- Architecture: [docs/Architecture.md](docs/Architecture.md)
- CLI Reference: generated via `npx tsx src/domain/reports/generators/cli-reference.ts`
