---
type: Architecture
domain: CLI
title: Flowti CLI — Definition-Driven Architecture
version: 4
created: 2026-03-07
updated: 2026-03-08
---

# Flowti CLI — Definition-Driven Architecture

## Mental Model

The Flowti CLI is a **definition-driven project orchestrator** that ships as a self-contained Node.js binary. It processes declarative JSON definitions to scaffold projects, create components, and manage workflows. The source tree is never required at runtime.

```
┌─────────────────────────────────────────────────────────────┐
│                      Vault Root                               │
│                   (c:\Projects\flowti\)                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌────────────────── CLI Binary ──────────────────────────┐   │
│  │  .flowti/bin/main.js (self-contained esbuild bundle)   │   │
│  │                                                         │   │
│  │  Bundled:  Scaffold definitions (JSON)                  │   │
│  │            Component definitions (JSON)                 │   │
│  │            Template functions                           │   │
│  │            All infrastructure                           │   │
│  └──────────┬──────────────────────────────────────────────┘   │
│             │                                                  │
│    ┌────────▼────────────────────────────────────────┐         │
│    │  01 - Projects/                                  │         │
│    │                                                  │         │
│    │  Flowti CLI  ← CLI's own source (dev only)       │         │
│    │  Project A   ← user project                      │         │
│    │  Project B   ← user project                      │         │
│    │  ...                                             │         │
│    └──────────────────────────────────────────────────┘         │
│                                                               │
│    Each project has:                                          │
│    ├── configs/flowti.config.json  (tools, publish, review)   │
│    ├── package.json                (scripts, dependencies)    │
│    ├── docs/components/            (component documentation)  │
│    └── src/                        (source code)              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

## Core Principles

1. **Self-Contained Binary** — `node .flowti/bin` is the sole runtime. All definitions, templates, and logic are bundled by esbuild. No filesystem reads to source-adjacent files at runtime.
2. **Definition-Driven** — JSON definitions are the single source of truth for scaffolding and components. The CLI is a processor/orchestrator of definitions, not a code generator with magic numbers.
3. **Deterministic** — Same inputs produce the same outputs. No hidden state, no environment-dependent behavior.
4. **Type-Safe Config** — `flowti.config.json` per project, `.flowti/` at vault level. All configuration is typed and validated.
5. **Obsidian Opt-In** — The CLI works standalone. Knowledgebase and vault-specific features are optional.
6. **Testable Infrastructure** — All I/O behind abstractions (`IFileSystem`, `paths`, `proc`, `clock`) for unit testing.

## Two-Loop Architecture

The CLI runs two nested loops:

```
Start Menu Loop
  │
  ├── List projects (from configured projects directory)
  ├── Create new project (from bundled scaffold definitions)
  ├── User selects a project → persisted in .flowti/var/state.json
  │
  └── Project Detail Loop
        │
        ├── initializeProject() → reads package.json, flowti.config.json
        ├── buildProjectDetailMenu() → tools + utilities
        ├── User selects a tool → action runs in project directory
        │
        ├── "b" → Back → clears selected project → returns to Start Menu
        └── "q" → Quit
```

## Definition-Driven Architecture

The CLI avoids hardcoded scaffolding logic. Instead, it uses a layered definition system:

### Scaffold Definitions (Project Creation)

```
ScaffoldDefinition (JSON, bundled)
  ├── id, name, description
  ├── prompts[]           ← user inputs to collect
  ├── files[]             ← file mappings with {{variable}} interpolation
  └── postCreate[]        ← commands to run after creation
```

Definitions are imported directly in TypeScript (`import def from "./definitions/x.json"`) so esbuild inlines them into the binary. No filesystem reads at runtime.

### Component Definitions (C4 Entities)

```
ComponentDefinition (JSON, bundled)
  ├── id, label, description
  ├── kind: ComponentKind         ← component | system | container | c4-component | person
  ├── c4Level?: number            ← 0=person, 1=system, 2=container, 3=component
  ├── prompts[]                   ← user inputs (name, description, technology, etc.)
  ├── files[]                     ← templateId + path with {{variable}} interpolation
  └── nextSteps[]                 ← guidance after creation
```

The component pipeline: `ComponentDefinition + ComponentVariables → buildComponentPlan() → FileEntry[]`

This is a pure function — no I/O. The plan is then written by `createFileWriter()`.

### Template Registry

Template functions are registered in a `ComponentTemplateRegistry`:

```typescript
Record<templateId, (vars: ComponentVariables, def: ComponentDefinition) => string>
```

This separates the "what to create" (definitions) from the "how to render" (templates).

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
  "review": { ... },
  "make": {
    "templates": ["hub", "journey", "component"]
  }
}
```

**Auto-scaffolding**: When a project is selected for the first time and has a `package.json` but no `flowti.config.json`, the CLI auto-creates one by mapping well-known script names to Flowti tool keys.

## Tool Categories

### Always Available (project-independent logic)

| Key | Tool | Description |
|-----|------|-------------|
| 1 | Make | Scaffold hub, journey, or component (C4 entities) |
| 3 | Review | E2E journey scanning, test vault management, gated pipeline |
| 4 | Publish | Build → Test → Distribute to configured endpoints |
| c | Components | Browse project components with metadata |

### Mappable (project-configured commands)

| Key | Tool | Config Key | Description |
|-----|------|-----------|-------------|
| 2 | Build | `tools.build` | Run the project's build command |
| 5 | Reports | `tools.reports` | Run the project's report generation |
| 6 | Npm Scripts | — | List and run any script from `package.json` |

## Path Resolution

```
CLI_PROJECT      = 01 - Projects/Flowti CLI/
VAULT_ROOT       = ../../                          → c:\Projects\flowti\
PROJECTS_DIR     = VAULT_ROOT + projectsFolder     → 01 - Projects/
```

All project paths are resolved relative to `PROJECTS_DIR`.

## Invocation Chain

```
flowti.cmd → node .flowti/bin → .flowti/bin/index.js (bootstrap) → .flowti/bin/main.js (CLI)
```

1. **`flowti.cmd`** — Windows launcher: `node "%~dp0.flowti\bin" %*`
2. **`node .flowti/bin`** — Node resolves to `index.js` via `package.json` `{"type":"module"}`
3. **`index.js`** (bootstrap) — derives vault root, reads `.flowti/config.json`, installs deps if missing, builds if missing, then runs `main.js`
4. **`main.js`** (CLI) — esbuild bundle with all definitions inlined, two-loop interactive menu or non-interactive dispatch

Source: `src/boot/bootstrap.mjs` → deployed as `.flowti/bin/index.js` during build.

## Bundling Constraint

The CLI is bundled by esbuild into a single `main.js`. This means:

- **`import.meta.dirname`** resolves to `.flowti/bin/`, not the source tree — cannot be used to locate source-adjacent files.
- **JSON definitions must be imported directly** (`import def from "./definitions/x.json"`) so esbuild inlines them.
- **No runtime filesystem reads for definitions** — everything the CLI needs is in the bundle.
- **Scripts that run as separate processes** (reports, analysis) are invoked via `shell.run()` in the project directory, not from the bundle.

## Test Vault Isolation

The Review tool creates test vaults **outside the git repository** to prevent test artifacts from polluting the vault. When scaffolding a test vault, the current CLI build is copied into `.flowti/bin/` so `node .flowti/bin` works in the test vault.

```
c:\Projects\
├── flowti\                    ← Vault (git repo)
│   ├── .flowti/bin/           ← CLI build (index.js, main.js, package.json)
│   └── 01 - Projects\
│       └── Flowti CLI\        ← CLI source (dev only)
├── Flowti CLI-e2e\            ← test vault (auto-created, outside git)
│   └── .flowti/bin/           ← copied CLI build
```

## Infrastructure Layer

| Module | Purpose |
|--------|---------|
| `config.ts` | Path resolution, CLI config loading, JSON helpers |
| `dispatch.ts` | Pure command dispatch logic (non-interactive → command handler) |
| `menu.ts` | Generic data-driven menu loop with disabled items, separators, beforeMenu hooks |
| `shell.ts` | `run()`, `runIn()`, `runSilent()` — shell execution with timing and status |
| `state.ts` | Persistent state (`selectedProject`) via `.flowti/var/state.json` |
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
