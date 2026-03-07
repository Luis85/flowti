---
type: Architecture
domain: CLI
title: Flowti CLI — Kernel-Space Architecture
version: 1
created: 2026-03-07
---

# Flowti CLI — Kernel-Space Architecture

## Mental Model

The Flowti ecosystem follows a **kernel-space / user-space** architecture, inspired by operating system design:

```
┌─────────────────────────────────────────────────────────────┐
│                        HOST: Obsidian                       │
│  Provides runtime, vault access, CLI tools (sync, automate) │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────── KERNEL SPACE ─────────────────────┐ │
│  │                                                         │ │
│  │  ┌─────────────────────┐   ┌─────────────────────────┐ │ │
│  │  │   Flowti CLI        │   │  Plugin Development     │ │ │
│  │  │   (Orchestrator)    │──▶│  (Subsystem)            │ │ │
│  │  │                     │   │                         │ │ │
│  │  │  - Build pipeline   │   │  - src/ (TypeScript)    │ │ │
│  │  │  - Scaffolding      │   │  - tests/ (Vitest)      │ │ │
│  │  │  - Report generation│   │  - esbuild.config.mjs   │ │ │
│  │  │  - E2E orchestration│   │  - flowti.config.json   │ │ │
│  │  │  - Publishing       │   │  - package.json         │ │ │
│  │  └─────────────────────┘   └───────────┬─────────────┘ │ │
│  │                                         │ build         │ │
│  └─────────────────────────────────────────┼───────────────┘ │
│                                             ▼                │
│  ┌───────────────────── USER SPACE ───────────────────────┐  │
│  │                                                         │  │
│  │  .obsidian/plugins/flowti-ibde/                         │  │
│  │  ├── main.js          (bundled plugin)                  │  │
│  │  ├── manifest.json    (plugin metadata)                 │  │
│  │  └── styles.css       (plugin styles)                   │  │
│  │                                                         │  │
│  │  Restricted access: Obsidian API sandbox only           │  │
│  │  Communication: EventBus (internal), EventBridge (API)  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

## Privilege Levels

### Kernel Space (Privileged)

Components in kernel space have **full access** to the filesystem, process management, git, and external tools.

**Flowti CLI** — The orchestrator:
- Manages the entire development lifecycle
- Spawns child processes (esbuild, vitest, tsc, eslint)
- Reads/writes files anywhere in the vault
- Executes git operations
- Generates documentation and reports
- No external npm dependencies (Node.js built-ins only)

**Plugin Development** — The subsystem:
- TypeScript source code compiled by esbuild
- Test infrastructure (7,500+ Vitest tests)
- Build configuration and scripts
- Domain-driven architecture (DDD)

### User Space (Restricted)

The **built plugin** runs inside Obsidian's sandbox:
- Can only access vault files through Obsidian's API
- Cannot spawn processes or access the filesystem directly
- Communicates via EventBus (internal) and EventBridge (Obsidian API bridge)
- Has no knowledge of the kernel-space components

### Host Layer

**Obsidian** provides:
- Plugin runtime environment
- Vault filesystem abstraction
- CLI tools for sync, automation, and agent workflows
- Command palette, workspace, and UI framework

## Path Resolution

The CLI resolves paths through its kernel config (`configs/flowti-cli.config.json`):

```
CLI_DIR          = 01 - Projects/Flowti CLI/src/
VAULT_ROOT       = ../../                          → c:\Projects\flowti\
PLUGIN_ROOT      = VAULT_ROOT + subsystems.plugin.root  → Development/flowti/
CONFIG_PATH      = PLUGIN_ROOT + subsystems.plugin.config
MANIFEST_PATH    = PLUGIN_ROOT + subsystems.plugin.manifest
PKG_PATH         = PLUGIN_ROOT + subsystems.plugin.package
```

This allows the CLI to be invoked from **any location** while always resolving paths relative to the vault root.

## Entry Points

```
c:\Projects\flowti\
├── flowti.cmd              → node "01 - Projects/Flowti CLI/src/flowti-cli.mjs" %*
├── flowti.sh               → node "$DIR/01 - Projects/Flowti CLI/src/flowti-cli.mjs" "$@"
└── Development/flowti/
    ├── package.json        → "flowti": "node \"../../01 - Projects/Flowti CLI/src/flowti-cli.mjs\""
    └── scripts/
        └── flowti-cli.mjs  → redirect stub (backwards compatibility)
```

All entry points converge on the same CLI source at `01 - Projects/Flowti CLI/src/flowti-cli.mjs`.

## Subsystem Communication

```
CLI (kernel)                    Plugin Dev (subsystem)
    │                               │
    ├── reads ──────────────────────▶ flowti.config.json
    ├── reads ──────────────────────▶ manifest.json
    ├── reads ──────────────────────▶ package.json
    ├── spawns ─────────────────────▶ esbuild (build)
    ├── spawns ─────────────────────▶ vitest (test)
    ├── spawns ─────────────────────▶ tsc + eslint (check)
    ├── spawns ─────────────────────▶ scripts/*.mjs (reports)
    ├── writes ─────────────────────▶ docs/reference/*.md
    └── reads ──────────────────────▶ src/**/*.ts (info, make)
```

## Design Principles

1. **Zero Dependencies** — The CLI uses only Node.js built-ins. No `node_modules` required for the CLI itself.
2. **Config-Driven** — All paths and subsystem mappings come from `flowti-cli.config.json`, not hardcoded.
3. **Dual-Mode** — Every capability works both interactively (human developer) and non-interactively (AI agent / CI).
4. **Self-Documenting** — The CLI auto-generates its own reference documentation on every increment build.
5. **Backwards Compatible** — A redirect stub at the old location ensures `npm run flowti` works unchanged.
