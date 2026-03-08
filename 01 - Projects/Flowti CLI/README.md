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
│   ├── types.ts                    # Shared type definitions
│   ├── domain/
│   │   ├── mainMenu.ts             # Project detail menu builder
│   │   ├── make/                   # Scaffolding (hub, plugin, app)
│   │   │   ├── make.ts             # Interactive + non-interactive scaffold commands
│   │   │   ├── template-service.ts # Centralized template generation (manifest, package, tsconfig, ...)
│   │   │   ├── templates.ts        # Plugin-specific templates (main.ts, CSS)
│   │   │   ├── appTemplates.ts     # App-specific templates (main.ts, CSS, EventBus)
│   │   │   └── naming.ts           # Naming conventions (kebab, pascal, camel)
│   │   ├── publish/                # Gated publish pipeline (build → test → distribute)
│   │   ├── review/                 # E2E journey review (test vault, runner)
│   │   ├── project/                # Project config detection and scaffolding
│   │   ├── info/                   # Project info and diagnostics
│   │   ├── help/                   # Man-page system (9 sections)
│   │   ├── capture/                # Idea and note capture
│   │   ├── knowledgebase/          # Obsidian vault browser and search
│   │   ├── reports/                # Report pipeline (summary, build, cli-reference, ...)
│   │   │   ├── cli/                # Summary report (analyzers, renderers, loaders, formatters)
│   │   │   └── generators/         # Individual generators (codebase, complexity, data-dictionary, ...)
│   │   ├── build/                  # Build command wrapper
│   │   └── devtools/               # Developer tools (reload, frontmatter fix, test data)
│   └── infrastructure/
│       ├── config.ts               # Path resolution and config loading
│       ├── menu.ts                 # Data-driven menu engine
│       ├── shell.ts                # Shell execution wrappers
│       ├── state.ts                # Persistent CLI state
│       ├── document.ts             # Markdown document builder (YAML FM, tables, callouts)
│       ├── ui.ts                   # ANSI color output and menu rendering
│       ├── input.ts                # Interactive input
│       ├── clock.ts                # Clock abstraction (ISO timestamps)
│       ├── logger.ts               # Logging abstraction
│       ├── filesystem.ts           # File system abstraction (disk)
│       ├── paths.ts                # Path utilities
│       ├── fs.ts                   # Frontmatter parser and file helpers
│       └── types.ts                # Infrastructure type definitions
├── tests/                          # Vitest test suites (758 tests, 235 suites)
├── configs/
│   ├── flowti-cli.config.json      # CLI kernel config (subsystem mappings)
│   ├── flowti.config.json          # CLI's own project config
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
| 6 | Dev Tools | Plugin reload, console, frontmatter fix, test data |
| 7 | Npm Scripts | Run any npm script from the project's package.json |
| 8 | Capture Idea | Quick-capture an idea to vault inbox |
| 9 | Capture Note | Capture a typed note (Task, Bug, Note, Documentation, Idea) |
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
| `build` | Compile TypeScript to `bin/` |
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
