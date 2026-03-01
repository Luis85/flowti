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
npm install              # Install dependencies
npm test                 # Verification: eslint → tsc → vitest (the default check command)
npm run build:only       # esbuild only (fast iteration, no checks)
npm run build            # Flow tests → esbuild --production
npm run build:dev        # Watch mode: esbuild --watch with hot-reload
npm run build:increment  # Full increment: check → build → test → e2e → docs → distribute
npm run build:release    # Full release: check → build → coverage → docs → esbuild --publish
npm run build:distribution # Full distribution: check → build → coverage → docs → distribute
npm run check            # Type-check + lint only: eslint → tsc -noEmit -skipLibCheck
npm run docs             # Generate TypeDoc documentation
npm run test:e2e         # Full E2E suite (all journeys)
npm run test:e2e:quick   # Installer + Getting Started only
```

**Notes:**
- `npm test` is the standard verification command — always use it to validate changes.
- `npm run build:increment` is the day-to-day development lifecycle command.
- Distribution copies artifacts to configured vault endpoints (`build-endpoints.json`).

## Architecture

> Full architecture details: see `README.md` (Arc42 structure) and `docs/Backend Architecture.md` (C4 diagrams).

### Key rules

- **EventBus** is the backbone — all cross-module communication via events (343+ event types)
- **EventBridge** is the sole Obsidian API contact point for mutations; UI reads directly from `app.vault`/`app.metadataCache` for synchronous queries
- **Per-domain events** — Each domain folder has its own `events.ts` exporting an EventMap interface; composed via `extends` in `infrastructure/events/events.ts`
- **FlowtiEventMap** imports `type` from domain (compile-time only cross-layer dependency)
- **DocService** centralizes all doc file creation — callers emit `doc.create` instead of calling `fileSystemClient.createFile()` directly

### Source layout

```
src/
├── main.ts                  # Plugin lifecycle orchestrator
├── infrastructure/          # Generic plumbing: EventBus, EventBridge, FileSystemClient,
│                            # LoggerService, ErrorService, ServiceContainer (20 services),
│                            # CommandRegistry (24 commands), ViewRegistry
├── domain/                  # 21 bounded contexts (each has events.ts + types.ts + service)
└── ui/                      # Presentation: 5 Hub views, modals, session, analytics, train
```

### How to extend

**New command** — add to `src/infrastructure/commands/registry.ts`:
```typescript
{
  id: "flowti:my-command",
  name: "My Command",
  icon: "icon-name",
  handler: async (ctx) => { /* ctx.app, ctx.eventBus, ctx.logger */ },
}
```

**New service** — add to `src/infrastructure/services/registry.ts`:
```typescript
{
  id: "myService",
  factory: (container: IServiceContainer) =>
    new MyService({ storage, eventBus: container.getEventBus() }),
},
```

**New domain events** — add to the domain's `events.ts`:
```typescript
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

**New doc type** — emit `doc.create` event via EventBus:
```typescript
eventBus.emit("doc.create", {
  docType: "MyDoc",
  name: "Document Name",
  entityType: "myEntities",
  source: "MyTab",
});
```

## File & folder conventions

- Source lives in `src/` organized by DDD layers (`infrastructure/`, `domain/`, `ui/`, `utils/`).
- Keep `main.ts` minimal — lifecycle orchestration only, no business logic.
- **Do not commit build artifacts:** Never commit `node_modules/`, `main.js`, or generated files.
- Keep the plugin small. Avoid large dependencies. Prefer browser-compatible packages.
- Release artifacts go to the plugin root: `main.js`, `manifest.json`, `styles.css`.

## Coding conventions

- TypeScript with strict null checks and no implicit any.
- **Split large files:** If any file exceeds ~600 LOC, consider extracting focused modules.
- **Single responsibility per file.**
- Bundle everything into `main.js` (no unbundled runtime deps).
- Prefer `async/await` over promise chains.
- Avoid `any` — use proper interfaces and type guards.
- Avoid mixing helpers into service files — keep pure functions in `utils/`.
- Avoid barrel exports (except for component sub-directories like `catalog/`, `hub/`, `csv/`, `export/`).
- Use TSDoc for public APIs.
- All services must implement `dispose()` to clean up event listeners.

## Agent do/don't

**Do:**
- Leverage the event-driven architecture — communicate via EventBus, not direct calls
- Follow separation of concerns — infrastructure vs domain vs UI
- Provide defaults and validation in settings (Zod schemas)
- Write idempotent code paths — reload/unload must not leak listeners or intervals
- Use `this.register*` helpers for everything needing cleanup
- Implement services as testable units with injected dependencies
- Implement `dispose()` on every service that registers event listeners
- Use `doc.create` events via DocService instead of direct file creation
- Keep the README and architecture docs up to date
- Every feature must have corresponding tests

**Don't:**
- Introduce network calls without an obvious user-facing reason and documentation
- Ship features requiring cloud services without explicit opt-in and disclosure
- Store or transmit vault contents unless essential and consented
- Put business logic in `main.ts` or infrastructure modules
- Import concrete implementations across layer boundaries (use `type` imports for events)
- Call `fileSystemClient.createFile()` for documentation files — use `doc.create` events instead

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
