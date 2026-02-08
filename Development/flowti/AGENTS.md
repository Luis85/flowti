# Flowti IBDE — Agent Instructions

You are working on **Flowti – IBDE** (Integrated Business Development Environment), an Obsidian plugin.

## Project overview

- **Codebase:** `Development/flowti/`
- **Target:** Obsidian Community Plugin (TypeScript → bundled JavaScript via esbuild)
- **Entry point:** `src/main.ts` → `main.js`
- **Release artifacts:** `main.js`, `manifest.json`, `styles.css`

### Purpose

Flowti – IBDE provides an integrated environment inside Obsidian to:
- Track and model business events
- Design, document, and evolve business processes
- Observe, control, and improve operational flows over time

It treats the Obsidian vault as a living business system, using Markdown as the primary source of truth and Git for state/history tracking.

### Sibling project

The **Foreign Folder Watcher** plugin lives at `Development/watcher/` with its own `AGENTS.md`. It is a separate npm project with independent build/test pipelines.

## Design principles

- **Event-driven architecture** — EventBus is the backbone; all inter-module communication via typed events
- **DDD layers** — Infrastructure (plumbing) → Domain (business logic) → UI (presentation)
- **Separation of concerns** — Each module has a single responsibility. Favor composition over inheritance.
- **Test-first development** — Start with requirements and happy-path tests. Not dogmatic, but the default.
- **Iterative development** — Make it work → make it better → make it pretty.
- **Markdown-first** — Human-readable, auditable artifacts. Git-native workflows.

## Environment & tooling

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | LTS (18+) | Runtime |
| npm | latest | Package manager |
| TypeScript | strict mode | Language |
| esbuild | latest | Bundler (config: `esbuild.config.mjs`) |
| Vitest | latest | Test runner |
| Zod | latest | Schema validation (settings, user types) |

### Commands

```bash
npm install        # Install dependencies
npm run dev        # Watch mode (esbuild --watch)
npm run build      # Full pipeline: vitest → typedoc → tsc → eslint → esbuild
npm test           # Run tests (npx vitest run)
```

**Note:** `tsc` has pre-existing errors in `node_modules/` (vite, vitest, zod types). Filter with `grep -v node_modules`.

## Architecture

### DDD layer structure (restructured Feb 2026)

```
src/
├── main.ts                              # Plugin orchestrator (lifecycle only)
├── infrastructure/                      # Generic plumbing (no business logic)
│   ├── events/
│   │   ├── EventBus.ts                  # Central pub/sub implementation
│   │   ├── EventBridge.ts              # Sole Obsidian API contact point
│   │   ├── events.ts                   # FlowtiEventMap (composed from domain events)
│   │   └── types.ts                    # IEventBus, EventHandler types
│   ├── errors/
│   │   ├── ErrorService.ts             # Centralized error handling
│   │   ├── FlowtiError.ts             # Typed error hierarchy
│   │   └── types.ts
│   ├── logger/
│   │   ├── LoggerService.ts            # Structured logging with event emission
│   │   └── types.ts
│   ├── services/
│   │   ├── ServiceContainer.ts         # DI container with lifecycle management
│   │   ├── registry.ts                 # Service registrations
│   │   └── types.ts
│   ├── commands/
│   │   ├── CommandRegistry.ts          # Command execution with middleware
│   │   ├── registry.ts                 # Command definitions
│   │   └── types.ts
│   ├── views/
│   │   ├── ViewRegistry.ts             # View registration for ItemViews
│   │   ├── registry.ts
│   │   └── types.ts
│   └── filesystem/
│       ├── FileSystemClient.ts         # Vault filesystem abstraction
│       ├── index.ts
│       └── types.ts
├── domain/                              # Business logic (owns its events)
│   ├── settings/
│   │   ├── settings.ts                 # Zod schema, types, defaults
│   │   ├── SettingsService.ts          # Settings management
│   │   ├── FlowtiSettingTab.ts         # Settings UI
│   │   ├── events.ts                   # Settings domain events
│   │   └── types.ts
│   └── user/
│       ├── UserService.ts              # User management with events
│       ├── UserSetupModal.ts           # First-run user setup
│       ├── events.ts                   # User domain events
│       └── types.ts                    # FlowtiUser, Zod schemas
├── ui/                                  # Presentation layer
│   └── ComponentShowcaseView.ts        # CSS component showcase
└── utils/
    ├── helpers.ts                       # Utility functions
    └── types.ts                         # Shared types (UUID, IStorageProvider)
```

### Key architecture rules

- **EventBus** is the backbone — all cross-module communication via events
- **EventBridge** is the sole Obsidian API contact point
- **Per-domain events** — Each domain folder has its own `events.ts` exporting an EventMap interface; composed via `extends` in `infrastructure/events/events.ts`
- **FlowtiEventMap** imports `type` from domain (compile-time only cross-layer dependency)

### Core infrastructure

| Module | Responsibility |
|--------|---------------|
| **EventBus** | Central pub/sub for decoupled communication |
| **EventBridge** | Bridges Obsidian workspace/vault events into EventBus |
| **LoggerService** | Structured logging with event emission |
| **ErrorService** | Centralized error handling with typed FlowtiError hierarchy |
| **ServiceContainer** | DI container with lifecycle management (init/destroy) |
| **CommandRegistry** | Command registration with middleware (logging, error handling) |
| **ViewRegistry** | View registration for custom ItemViews |

### Initialization order (main.ts)

```
Phase 1: Core infrastructure
  loadSettings → initializeEventBus → initializeLogger → initializeErrorService → setupEventListeners

Phase 2: Containers
  initializeServiceContainer → initializeCommandRegistry → initializeViewRegistry

Phase 3: Registration
  registerAllServices → registerAllCommands → registerAllViews

Phase 4: Service initialization
  services.initializeAll()

Phase 5: UI setup
  addSettingTab → bindViews → bindCommands

Phase 6: Post-load
  onLayoutReady → UserSetupModal.showIfNeeded()
```

### Test structure

```
tests/
├── commands/CommandRegistry.test.ts
├── errors/ErrorService.test.ts
├── errors/FlowtiError.test.ts
├── events/EventBus.test.ts
├── logger/LoggerService.test.ts
├── services/ServiceContainer.test.ts
├── settings/settings.test.ts
├── settings/SettingsService.test.ts
├── user/UserService.test.ts
└── utils/helpers.test.ts
```

172 tests across 11 test files.

### Adding new features

**New command** — add to `src/infrastructure/commands/registry.ts`:
```typescript
{
  id: "flowti:my-command",
  name: "My Command",
  icon: "icon-name",
  handler: async (ctx) => {
    ctx.logger.debug("Executing command");
  },
}
```

**New service** — add to `src/infrastructure/services/registry.ts`:
```typescript
container.register({
  id: "myService",
  factory: async ({ eventBus, logger }) => new MyService({ eventBus, logger }),
  dependencies: [],
});
```

**New domain events** — add to the domain's `events.ts`:
```typescript
// src/domain/mydomain/events.ts
export interface MyDomainEventMap {
  "mydomain.created": { id: string };
  "mydomain.updated": { id: string; changes: Record<string, unknown> };
}
```
Then extend `FlowtiEventMap` in `src/infrastructure/events/events.ts`.

**New view** — add to `src/infrastructure/views/registry.ts`:
```typescript
{
  type: "flowti-my-view",
  displayName: "My View",
  icon: "icon-name",
  factory: (leaf) => new MyView(leaf),
}
```

## File & folder conventions

- Source lives in `src/` organized by DDD layers (`infrastructure/`, `domain/`, `ui/`, `utils/`).
- Keep `main.ts` minimal — lifecycle orchestration only, no business logic.
- **Do not commit build artifacts:** Never commit `node_modules/`, `main.js`, or generated files.
- Keep the plugin small. Avoid large dependencies. Prefer browser-compatible packages.
- Release artifacts go to the plugin root: `main.js`, `manifest.json`, `styles.css`.

## Coding conventions

- TypeScript with `strict: true`.
- **Split large files:** If any file exceeds ~200-300 lines, extract focused modules.
- **Single responsibility per file.**
- Bundle everything into `main.js` (no unbundled runtime deps).
- Prefer `async/await` over promise chains.
- Avoid `any` — use proper interfaces and type guards.
- Avoid mixing helpers into service files — keep pure functions in `utils/`.
- Avoid barrel exports.
- Use TSDoc for public APIs.

## Agent do/don't

**Do:**
- Leverage the event-driven architecture — communicate via EventBus, not direct calls
- Follow separation of concerns — infrastructure vs domain vs UI
- Provide defaults and validation in settings (Zod schemas)
- Write idempotent code paths — reload/unload must not leak listeners or intervals
- Use `this.register*` helpers for everything needing cleanup
- Implement services as testable units with injected dependencies
- Keep the README up to date
- Every feature must have corresponding tests

**Don't:**
- Introduce network calls without an obvious user-facing reason and documentation
- Ship features requiring cloud services without explicit opt-in and disclosure
- Store or transmit vault contents unless essential and consented
- Put business logic in `main.ts` or infrastructure modules
- Import concrete implementations across layer boundaries (use `type` imports for events)

## Security & privacy

- Default to local/offline operation
- No hidden telemetry — require explicit opt-in for any external services
- Never execute remote code or auto-update outside normal releases
- Minimize scope: read/write only what's necessary
- Register and clean up all DOM, app, and interval listeners

## References

- Obsidian API: https://docs.obsidian.md
- Developer policies: https://docs.obsidian.md/Developer+policies
- Plugin guidelines: https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines
- Style guide: https://help.obsidian.md/style-guide
