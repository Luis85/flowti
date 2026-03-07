---
type: Architecture
domain: CLI
title: Flowti CLI — Project-Centric Architecture
version: 2
created: 2026-03-07
updated: 2026-03-07
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
  ├── User selects a project → persisted in .flowti-state.json
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

## Test Vault Isolation

The Review tool creates test vaults **outside the git repository** to prevent test artifacts from polluting the vault:

```
c:\Projects\
├── flowti\                    ← Obsidian vault (git repo)
│   └── 01 - Projects\
│       └── Flowti CLI\        ← project
├── Flowti CLI-e2e\            ← test vault (auto-created, outside git)
└── flowti-e2e\                ← test vault for plugin project
```

## Infrastructure Layer

| Module | Purpose |
|--------|---------|
| `config.ts` | Path resolution, CLI config loading, JSON helpers |
| `menu.ts` | Generic data-driven menu loop with disabled items, separators, beforeMenu hooks |
| `shell.ts` | `run()`, `runIn()`, `runSilent()` — shell execution with timing and status |
| `state.ts` | Persistent state (`selectedProject`, `projectSource`) via `.flowti-state.json` |
| `document.ts` | Fluent markdown builder (YAML frontmatter, tables, callouts, code blocks) |
| `ui.ts` | ANSI color constants, `printHeader()`, `printMenu()` |
| `readline.ts` | `createRL()`, `ask()` — interactive input |
| `fs.ts` | `parseFrontmatter()`, `writeFileAt()`, `countFiles()` |

## Design Principles

1. **Project-Centric** — Every tool operates on the selected project's directory, not a hardcoded path.
2. **Config-Driven** — Tool availability and behavior determined by per-project `flowti.config.json`.
3. **Auto-Scaffolding** — Projects get a working config on first selection, inferred from `package.json`.
4. **Gated Pipelines** — Publish and Review enforce build → test → action sequencing with visual state.
5. **Test Vault Isolation** — E2E test vaults are created outside the git repository.
6. **TypeScript + Vitest** — Strict TypeScript, Vitest for testing, tsx for development.
