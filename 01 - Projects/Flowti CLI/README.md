# Flowti CLI

The Flowti CLI is the **kernel-space orchestrator** for the Flowti IBDE (Integrated Business Development Environment). It manages plugin development workflows, scaffolding, builds, testing, reporting, and publishing — all from a single command-line tool.

## Quick Start

From the vault root (`c:\Projects\flowti`):

```bash
# Windows
flowti.cmd

# Unix / Git Bash
./flowti.sh
```

On first run, the CLI automatically:
1. **Checks prerequisites** — verifies Git and Node.js v16+ are installed (exits with download links if missing)
2. **Installs dependencies** — detects missing `node_modules` and runs `npm install`
3. **Guides you** — if the plugin hasn't been built yet, prompts you to select Build
4. **Post-build guidance** — after a successful build, shows next steps to activate the plugin in Obsidian

## Architecture

The CLI follows a **kernel-space architecture**:

| Layer | Component | Access |
|-------|-----------|--------|
| **Kernel** | Flowti CLI | Privileged — full filesystem, process, git access |
| **Kernel Subsystem** | Plugin Development (`Development/flowti/`) | Privileged — source code, tests, build pipeline |
| **User Space** | Built Plugin (`.obsidian/plugins/flowti-ibde/`) | Restricted — Obsidian sandbox, EventBus only |
| **Host** | Obsidian | Provides runtime, CLI tools for sync and automation |

See [Architecture.md](docs/Architecture.md) for the full design document.

## Onboarding Flow

```
flowti.cmd
  → checkPrerequisites()     Git, Node.js v16+ — exits with install links if missing
  → ensureDependencies()     Auto-runs npm install if node_modules is missing
  → checkFirstRun()          Hints "select Build" if plugin not yet built
  → Main Menu
    → Build → showPostBuildGuidance()   Guides user to open Obsidian + activate plugin
```

**Exit codes:** `0` = success, `1` = failure, `2` = missing prerequisites.

## Project Structure

```
01 - Projects/Flowti CLI/
├── src/
│   └── flowti-cli.mjs          # CLI source (~2000 LOC, zero dependencies)
├── configs/
│   └── flowti-cli.config.json  # Kernel config — maps to managed subsystems
├── README.md                   # This file
└── docs/
    └── Architecture.md         # Kernel-space design document

Vault Root (c:\Projects\flowti\)
├── flowti.cmd                  # Windows entry point
├── flowti.sh                   # Unix entry point
└── Development/flowti/
    └── scripts/flowti-cli.mjs  # Redirect stub (backwards compatibility)
```

## Interactive Mode

Run without arguments for the interactive menu:

```
flowti.cmd
```

**Main Menu:**

| Key | Section | Description |
|-----|---------|-------------|
| 1 | Make | Scaffold new hub or plugin from templates |
| 2 | Build | Fast build, full build, watch, distribute |
| 3 | Review | E2E test sessions, teardown, rebuild |
| 4 | Publish | Build, test, publish pipeline |
| 5 | Reports | Generate vault reports (14 generators) |
| 6 | Dev Tools | Plugin reload, console, errors, frontmatter, test data |
| 7 | Info | Project stats, version, config overview |
| ? | Help | Contextual man-pages |
| q | Quit | Exit CLI |

## Non-Interactive Mode (AI Agent / CI)

Every CLI capability is available as a deterministic, non-interactive command with structured exit codes:

```bash
# Build
flowti.cmd build              # Fast build (esbuild, production)
flowti.cmd build:full         # Full build (lint + type-check + test + build)
flowti.cmd build:watch        # Watch mode (esbuild, incremental)

# Information
flowti.cmd info               # Project metadata and stats
flowti.cmd help               # Full man-page
flowti.cmd help build         # Section-specific help

# Reports
flowti.cmd reports:all        # Generate all 14 reports
flowti.cmd reports:cli-ref    # Generate CLI Reference only

# Development
flowti.cmd dev:check          # Lint + type-check (no tests)
flowti.cmd dev:reload         # Hot-reload plugin in Obsidian
flowti.cmd dev:testdata       # Generate test fixtures

# Testing
flowti.cmd test:unit          # Run unit tests
flowti.cmd test:coverage      # Run tests with coverage
flowti.cmd test:e2e           # Run E2E journey tests

# Publishing
flowti.cmd publish:increment  # Increment build pipeline
flowti.cmd publish:dist       # Distribution build
flowti.cmd publish:release    # Full release build
```

**Exit codes:** `0` = success, `1` = failure, `2` = config error.

## Configuration

The CLI reads its subsystem mapping from `configs/flowti-cli.config.json`:

```json
{
  "subsystems": {
    "plugin": {
      "root": "Development/flowti",
      "config": "flowti.config.json",
      "manifest": "manifest.json",
      "package": "package.json",
      "scripts": "scripts"
    }
  }
}
```

The plugin project's own configuration lives at `Development/flowti/flowti.config.json`.

## Auto-Generated Documentation

On every increment build, the CLI generates a **Flowti CLI Reference** vault note at `Development/flowti/docs/reference/Flowti CLI Reference.md`. This note contains:

- All non-interactive commands with descriptions
- All npm scripts with their command chains
- Report generator inventory
- Make configuration and templates
- Configuration file reference

## Dependencies

**Zero external dependencies.** The CLI uses only Node.js built-ins: `child_process`, `fs`, `path`, `readline`.

## Related Documents

- PRD: `Development/flowti/docs/features/Flowti CLI/Flowti CLI PRD.md`
- Auto-generated reference: `Development/flowti/docs/reference/Flowti CLI Reference.md`
- Architecture: `docs/Architecture.md` (this project)
