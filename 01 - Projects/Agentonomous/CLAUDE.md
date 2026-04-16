# Agentonomous — CLAUDE.md

Agentonomous is an autonomous agents sandbox Obsidian plugin. It lets you run, observe, and interact with AI agents directly inside your Obsidian vault using Vue 3, Pinia, and a clean DDD architecture.

## Layer Rules

```
Infrastructure → Domain ← UI
```

| Layer | Path | Rules |
|-------|------|-------|
| **domain** | `src/domain/` | Pure TypeScript — no Obsidian imports, no Vue imports. All external dependencies injected via ports. |
| **infrastructure** | `src/infrastructure/` | Obsidian adapters that implement domain ports. May import from `obsidian` SDK. |
| **ui** | `src/ui/` | Vue 3 presentation layer. Pinia stores, Vue components, router. No Obsidian SDK imports. |
| **core** | `src/core/` _(coming)_ | Platform-agnostic agent engine. Pure TypeScript. No Obsidian, no Vue. |

Domain is the stable center — infrastructure and UI both depend on it, never the reverse.

## Port Inventory

| Port | Location | Purpose |
|------|----------|---------|
| `SettingsPort` | `src/domain/settings/settings-port.ts` | Load, save, and subscribe to plugin settings |
| `ViewRegistryPort` | `src/domain/views/view-registry-port.ts` | Register and deregister Obsidian leaf views |
| `CommandPort` | _(coming)_ | Register and deregister Obsidian commands |
| `LoggerPort` | _(coming)_ | Structured logging (levels: debug, info, warn, error) |
| `NotificationPort` | _(coming)_ | Display Obsidian Notice toasts |
| `EventBus` | _(coming)_ | Typed pub/sub for cross-domain events |

## Scripts

All commands run from `cd "01 - Projects/Agentonomous"`:

| Script | Command | Purpose |
|--------|---------|---------|
| `test` | `npm test` | Full check: lint + typecheck + unit tests |
| `lint` | `npm run lint` | ESLint (`src/`, `tests/`, `stories/`) |
| `typecheck` | `npm run typecheck` | TypeScript type check (no emit) |
| `test:unit` | `npm run test:unit` | Vitest unit tests only |
| `test:watch` | `npm run test:watch` | Vitest in watch mode |
| `build` | `npm run build` | Production build → `dist/` |
| `build:dev` | `npm run build:dev` | Watch build with hot-reload |
| `build:deploy` | `npm run build:deploy` | Build + copy to test vault |
| `deploy` | `npm run deploy` | Copy built dist to test vault |
| `storybook` | `npm run storybook` | Storybook dev server on port 6006 |
| `docs` | `npm run docs` | Generate TypeDoc API docs |
| `release` | `npm run release` | Package a GitHub release zip |

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `AGENTONOMOUS_TEST_VAULT` | `C:\Projects\Agentonomous` | Path to test Obsidian vault used by `deploy` and `build:deploy` scripts |

Set this in your shell profile or `.env.local` to point at your test vault:

```bash
export AGENTONOMOUS_TEST_VAULT="C:/path/to/your/test-vault"
```

## Conventions

- **Indentation**: tabs (4-wide)
- **Imports**: always use `.js` extension in import paths (ESM NodeNext resolution)
- **No `any` types** — use `unknown` with narrowing or proper generics
- **No `@ts-ignore`** or `@ts-expect-error` without a comment explaining why
- **No `TODO`/`FIXME`** comments — open a GitHub issue instead
- **TDD** — write the failing test first, then the implementation
- **File naming**: kebab-case (`my-feature.ts`, `my-feature.test.ts`)
- **Test location**: mirrors source — `src/domain/foo/bar.ts` → `tests/domain/foo/bar.test.ts`

## Key Config Files

| File | Purpose |
|------|---------|
| `configs/tsconfig.json` | TypeScript config (ES2022, NodeNext, strict, exactOptionalPropertyTypes) |
| `configs/vitest.config.ts` | Vitest config |
| `configs/eslint.config.mjs` | ESLint config (architecture rules) |
| `configs/vite.config.ts` | Vite build config |
| `configs/storybook/` | Storybook config directory |
| `configs/typedoc.json` | TypeDoc config |
| `manifest.json` | Obsidian plugin manifest |
