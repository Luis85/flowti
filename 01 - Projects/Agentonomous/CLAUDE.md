# Agentonomous — CLAUDE.md

Agentonomous is an autonomous agents sandbox Obsidian plugin. It lets you run, observe, and interact with AI agents directly inside your Obsidian vault using Vue 3, Pinia, and a clean DDD architecture.

## Layer Rules

```
      domain  ← stable center
   ↑    ↑    ↑
   |    |    |
 infra modules  ui
        (pure TS)  (all Vue)
```

| Layer | Path | Rules |
|-------|------|-------|
| **domain** | `src/domain/` | Pure TypeScript — no Obsidian, no Vue, no Pinia. Ports, types, pure logic. |
| **core** | `src/core/` | Plugin bootstrap (PluginCore, Logger, ErrorHandler). Pure TypeScript. May use `console`. |
| **modules** | `src/modules/` | Bounded-context **backend** — pure TypeScript. Module definition, settings, events, handlers, locales. **No Vue, no Obsidian.** Declares view *intents* (data only); the infrastructure resolves them to Obsidian views. |
| **ui** | `src/ui/` | The **presentation layer** — ALL Vue lives here. `AppRoot.vue`, router, `pages/`, `layouts/`, `components/`, `panels/` (sidebar panels), `stores/` (Pinia reactive boundary). No Obsidian SDK imports. |
| **infrastructure** | `src/infrastructure/` | Adapters that wire the above into Obsidian. Includes `infrastructure/obsidian/views/` — Obsidian `ItemView` wrappers that mount Vue panels from `src/ui/` into Obsidian leaves. May import from `obsidian`, `ui/`, `domain/`, `modules/` (it's the glue). |

**One Vue, one place.** Every `.vue` file and every Pinia `*-store.ts` lives under `src/ui/`. Modules express what they need as `ViewIntent` data; infrastructure resolves each intent to a concrete `ViewRegistration` (intent + factory) via `src/infrastructure/obsidian/views/index.ts`.

## Port Inventory

| Port | Location | Purpose |
|------|----------|---------|
| `SettingsPort` | `src/domain/settings/settings-port.ts` | Load, save, and subscribe to plugin settings |
| `ViewRegistryPort` | `src/domain/views/view-registry-port.ts` | Register and deregister Obsidian leaf views |
| `CommandPort` | `src/domain/commands/command-port.ts` | Register and deregister Obsidian commands |
| `LoggerPort` | `src/domain/shared/logger-port.ts` | Structured logging (levels: debug, info, warn, error) |
| `NotificationPort` | `src/domain/shared/notification-port.ts` | Display Obsidian Notice toasts |
| `EventBus` | `src/domain/shared/event-bus.ts` | Typed pub/sub for cross-domain events |
| `TranslationPort` | `src/domain/shared/translation-port.ts` | i18n message lookup (t.t(key)) |
| `PlatformPort` | `src/domain/shared/platform-port.ts` | Platform capability detection (OS, mobile, etc.) |
| `VaultPort` | `src/domain/shared/vault-port.ts` | Read vault files by path — returns typed Result |
| `FileExtensionPort` | `src/domain/shared/file-extension-port.ts` | Resolve file extension associations |

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
- **PageObject convention**: co-locate `.po.ts` files with their test counterpart (`Home.po.ts` beside `Home.test.ts`). Query elements via `data-testid` attributes exclusively; never couple to CSS classes.
- **Layout system**: three layouts (`MainLayout`, `DashboardLayout`, `PanelLayout`). The active layout is resolved from `route.meta.layout` in `AppRoot.vue`. Sidebar module views use `PanelLayout` directly (no router involved).
- **Module state singletons**: modules that hold runtime state (`event-inspector`, `health-monitor`, etc.) use a module-scope `let state: ModuleState | null = null` pattern. This is intentional — there is exactly one instance per module per plugin load. `init()` must be idempotent: if `state !== null`, call `this.destroy()` first. PluginCore's listener-leak tripwire depends on this shape; don't replace with per-instance state unless you're refactoring the whole module contract.
- **UI-callback bridges** (second module-scope singleton, beside `state`): when a `CommandEntry.callback` needs access to Vue/router internals — which aren't available at module-definition time — declare a separate module-scope `let handler: Fn | null = null` with `set*Handler` / `clear*Handler` exports. Wire it in `createVueApp` **after** a successful `vue.mount(el)` and clear it in the returned unmount. Unlike `state`, this handler is intentionally decoupled from `init/destroy` so it survives settings-driven module re-inits. Example: `make-module.ts:setMakeNavigateHandler` for the `/make/types/new` + `/make/types` command-palette entries.

## Key Config Files

| File | Purpose |
|------|---------|
| `tsconfig.json` | TypeScript config (ES2022, NodeNext, strict) — **build only, excludes tests** |
| `tsconfig.lint.json` | TypeScript config used by ESLint — **includes tests and stories** |
| `vitest.config.ts` | Vitest config (unit + storybook projects) |
| `eslint.config.mjs` | ESLint config (architecture rules) |
| `vite.config.ts` | Vite build config |
| `.storybook/` | Storybook config (Storybook convention) |
| `configs/deploy-targets.json` | Deploy target vault paths |
| `configs/typedoc.json` | TypeDoc config |
| `manifest.json` | Obsidian plugin manifest |
