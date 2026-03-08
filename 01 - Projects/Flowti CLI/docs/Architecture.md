---
type: Architecture
domain: CLI
title: Flowti CLI — Project-Centric Architecture
version: 3
created: 2026-03-07
updated: 2026-03-08
---

# Flowti CLI — Project-Centric Architecture

## Mental Model

The Flowti CLI is a **project-centric orchestrator** that manages multiple development projects within an Obsidian vault. Each project gets its own configuration, tools, and workflows.

```
┌─────────────────────────────────────────────────────────────┐
│                      Obsidian Vault                          │
│                   (c:\Projects\flowti\)                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌────────────────── CLI Core ──────────────────────────┐   │
│  │  01 - Projects/Flowti CLI/                           │   │
│  │                                                       │   │
│  │  Infrastructure: menu, shell, state, document, UI     │   │
│  │  Domain: make, publish, review, reports, info, help   │   │
│  └──────────┬────────────────────────┬──────────────────┘   │
│             │                        │                      │
│    ┌────────▼────────┐     ┌─────────▼─────────┐           │
│    │  01 - Projects/  │     │  Development/      │           │
│    │                  │     │                    │           │
│    │  Flowti CLI      │     │  flowti (plugin)   │           │
│    │  Project B       │     │  Project C         │           │
│    │  Project C       │     │  ...               │           │
│    │  ...             │     │                    │           │
│    └──────────────────┘     └────────────────────┘           │
│                                                             │
│    Each project has:                                        │
│    ├── configs/flowti.config.json  (tools, publish, review) │
│    ├── package.json                (scripts, dependencies)  │
│    └── src/                        (source code)            │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Two-Loop Architecture

The CLI runs two nested loops:

```
Start Menu Loop
  │
  ├── List projects (from PROJECTS_DIR or DEVELOPMENT_DIR)
  ├── User selects a project → persisted in .flowti/var/state.json
  │
  └── Project Detail Loop
        │
        ├── initializeProject() → reads package.json, flowti.config.json
        ├── buildProjectDetailMenu() → 7 tools + utilities
        ├── User selects a tool → action runs in project directory
        │
        ├── "b" → Back → clears selected project → returns to Start Menu
        └── "q" → Quit
```

## Per-Project Configuration

Each project is configured via `configs/flowti.config.json`:

```json
{
  "name": "project-name",
  "tools": {
    "build": "npm run build",
    "reports": "npm run reports",
    "devtools": "npm run dev"
  },
  "publish": { ... },
  "review": { ... }
}
```

**Auto-scaffolding**: When a project is selected for the first time and has a `package.json` but no `flowti.config.json`, the CLI auto-creates one by mapping well-known script names to Flowti tool keys.

## Tool Categories

### Always Available (project-independent logic)

| Key | Tool | Description |
|-----|------|-------------|
| 1 | Make | Scaffold hub, plugin, component, or journey files |
| 3 | Review | E2E journey scanning, test vault management, gated pipeline |
| 4 | Publish | Build → Test → Distribute to configured endpoints |

### Mappable (project-configured commands)

| Key | Tool | Config Key | Description |
|-----|------|-----------|-------------|
| 2 | Build | `tools.build` | Run the project's build command |
| 5 | Reports | `tools.reports` | Run the project's report generation |
| 6 | Dev Tools | `tools.devtools` | Run the project's dev/watch command |

### Submenu

| Key | Tool | Description |
|-----|------|-------------|
| 7 | Npm Scripts | List and run any script from `package.json` |

## Path Resolution

```
CLI_PROJECT      = 01 - Projects/Flowti CLI/
VAULT_ROOT       = ../../                          → c:\Projects\flowti\
PROJECTS_DIR     = VAULT_ROOT + projectsFolder     → 01 - Projects/
DEVELOPMENT_DIR  = VAULT_ROOT + Development/
```

Project paths are resolved dynamically based on the selected project's source:
- `"projects"` → `PROJECTS_DIR/<name>`
- `"development"` → `DEVELOPMENT_DIR/<name>`

## Invocation Chain

```
flowti.cmd → node .flowti/bin → .flowti/bin/index.js (bootstrap) → .flowti/bin/main.js (CLI)
```

1. **`flowti.cmd`** — Windows launcher: `node "%~dp0.flowti\bin" %*`
2. **`node .flowti/bin`** — Node resolves to `index.js` via `package.json` `{"type":"module"}`
3. **`index.js`** (bootstrap) — derives vault root, reads `.flowti/config.json`, installs deps if missing, builds if missing, then runs `main.js`
4. **`main.js`** (CLI) — esbuild bundle, two-loop interactive menu or non-interactive dispatch

Source: `src/boot/bootstrap.mjs` → deployed as `.flowti/bin/index.js` during build.

## Test Vault Isolation

The Review tool creates test vaults **outside the git repository** to prevent test artifacts from polluting the vault. When scaffolding a test vault, the current CLI build is copied into `.flowti/bin/` so `node .flowti/bin` works in the test vault.

```
c:\Projects\
├── flowti\                    ← Obsidian vault (git repo)
│   ├── .flowti/bin/           ← CLI build (index.js, main.js, package.json)
│   └── 01 - Projects\
│       └── Flowti CLI\        ← project source
├── Flowti CLI-e2e\            ← test vault (auto-created, outside git)
│   └── .flowti/bin/           ← copied CLI build
└── flowti-e2e\                ← test vault for plugin project
```

## Infrastructure Layer

| Module | Purpose |
|--------|---------|
| `config.ts` | Path resolution, CLI config loading, JSON helpers |
| `dispatch.ts` | Pure command dispatch logic (non-interactive → command handler) |
| `menu.ts` | Generic data-driven menu loop with disabled items, separators, beforeMenu hooks |
| `shell.ts` | `run()`, `runIn()`, `runSilent()` — shell execution with timing and status |
| `state.ts` | Persistent state (`selectedProject`, `projectSource`) via `.flowti/var/state.json` |
| `document.ts` | Fluent markdown builder (YAML frontmatter, tables, callouts, code blocks) |
| `ui.ts` | ANSI color constants, `printHeader()`, `printMenu()` |
| `input.ts` | `createRL()`, `ask()` — interactive input |
| `fs.ts` | `parseFrontmatter()`, `writeFileAt()`, `countFiles()` |
| `filesystem.ts` | `IFileSystem` abstraction for testability |
| `paths.ts` | Path utilities (resolve, join, dirname, basename) |
| `proc.ts` | Process abstraction (exit, argv, cwd, env) |
| `clock.ts` | Clock abstraction (ISO timestamps) |
| `logger.ts` | Logging abstraction |
| `test-vault.ts` | Test vault scaffold/teardown (outside git, copies CLI build via `sourceBinDir`) |
| `types.ts` | Infrastructure type definitions |

## Design Principles

1. **Project-Centric** — Every tool operates on the selected project's directory, not a hardcoded path.
2. **Config-Driven** — Tool availability and behavior determined by per-project `flowti.config.json`.
3. **Auto-Scaffolding** — Projects get a working config on first selection, inferred from `package.json`.
4. **Gated Pipelines** — Publish and Review enforce build → test → action sequencing with visual state.
5. **Test Vault Isolation** — E2E test vaults are created outside the git repository, with CLI build copied in.
6. **TypeScript + Vitest** — Strict TypeScript, Vitest for testing, tsx for development.
7. **Testable Infrastructure** — All I/O behind abstractions (`IFileSystem`, `paths`, `proc`, `clock`) for unit testing.
