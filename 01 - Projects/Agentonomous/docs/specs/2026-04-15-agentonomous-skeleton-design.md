---
title: Agentonomous — Infrastructure Skeleton Design
date: 2026-04-15
status: approved-for-planning
author: Luis Mendez
project: Agentonomous
---

# Agentonomous — Infrastructure Skeleton Design

## 1. Purpose & Scope

Agentonomous is a new Obsidian plugin — an autonomous-agents sandbox — being started from scratch. This document specifies the **first increment**: the target architecture and complete tooling harness, with **no business logic**. The goal is a shippable, testable skeleton that opens a Homepage view and is ready to grow into.

**In scope**
- Project scaffolding under `01 - Projects/Agentonomous/`.
- Obsidian plugin boilerplate (manifest, versions, lifecycle, settings tab).
- Three-layer architecture (`domain`, `infrastructure`, `ui`) mirroring Project Meridian, enforced by ESLint.
- Vue 3 + Vue Router + Pinia mounted inside an Obsidian `ItemView`.
- Storybook for presentational components, TypeDoc for API docs, Vitest + `@vue/test-utils` for tests.
- View registry enabling future sidebar panels.
- Build + deploy pipeline to a dedicated test vault.
- Obsidian plugin-marketplace publishing readiness (artifacts only; submission is manual and out of scope).

**Out of scope (this increment)**
- Any agent / autonomous-behavior logic.
- Real sidebar panel views (the registry supports them; none shipped).
- Persistence beyond plugin settings.
- Community-plugins marketplace submission.
- CI pipeline (GitHub Actions wiring).
- Integration with the Flowti CLI as a managed project.

## 2. High-Level Architecture

### 2.1 Layered split (Meridian-style)

```
src/
├── main.ts                    # Plugin entry — extends Obsidian's Plugin class
├── plugin.ts                  # PluginContext DI bag + composition helpers
├── domain/                    # Pure TypeScript. No Vue. No Obsidian. No node:*.
│   ├── settings/              # PluginSettings type, defaults, validators
│   └── shared/                # Result type, value objects, kernel types
├── infrastructure/            # Adapters to Obsidian + platform
│   ├── obsidian/              # obsidian-settings-adapter.ts, view-registry.ts
│   ├── views/                 # homepage-view.ts (extends ItemView)
│   ├── settings/              # settings-tab.ts (extends PluginSettingTab)
│   └── ribbon/                # ribbon icon registration
└── ui/                        # Vue 3 + Pinia
    ├── app.ts                 # createVueApp() — installs Pinia + Router
    ├── router/                # createMemoryHistory router + routes
    ├── stores/                # useAppStore, useSettingsStore
    ├── pages/                 # Home.vue, About.vue
    └── components/            # HelloCard.vue
```

### 2.2 Dependency rules (ESLint-enforced)

1. **Domain is pure.** No import of `obsidian`, `node:*`, `src/infrastructure/**`, or Vue.
2. **UI never reaches into domain internals.** Stores are the only channel; stores call domain use-cases through ports.
3. **`obsidian` imports are on an allowlist.** Permitted files:
   - `src/main.ts`
   - `src/plugin.ts`
   - `src/infrastructure/obsidian/**`
   - `src/infrastructure/views/*-view.ts`
   - `src/infrastructure/settings/settings-tab.ts`
4. **No `try`/`catch` outside `src/infrastructure/**`.** Domain uses a `Result<T,E>` type.
5. **No `innerHTML` / `outerHTML` / `insertAdjacentHTML`** anywhere — DOM API only.
6. **No `any`, no `@ts-ignore`, no `TODO` / `FIXME`** in committed code.

### 2.3 Homepage view data flow

1. User clicks the ribbon icon **or** runs the command `Agentonomous: Open homepage`.
2. `main.ts` delegates to `view-registry.openView('agentonomous-homepage')`.
3. `homepage-view.ts` (extends `ItemView`) opens a leaf, creates a Vue app instance via `createVueApp(pluginContext)`, and mounts it into `this.contentEl`.
4. The Vue app installs Pinia + Router (memory history) and provides `PluginContext` via Vue's `app.provide()`.
5. Router resolves `/` → `Home.vue`. The page renders `<HelloCard>` and reads `useAppStore()` (greeting + version) and `useSettingsStore()` (reactive settings).
6. When the leaf closes, `onClose()` calls `app.unmount()` — Pinia + router + components are torn down deterministically.

### 2.4 View registry

`infrastructure/obsidian/view-registry.ts` owns view registration in one place. Each entry:

```ts
type ViewRegistration = {
  type: string;                                // VIEW_TYPE_HOMEPAGE etc.
  displayName: string;                         // sentence case (Obsidian rule)
  icon: string;                                // lucide icon id
  defaultLocation: 'main' | 'left' | 'right';  // main leaf or sidebar
  viewFactory: (leaf: WorkspaceLeaf, ctx: PluginContext) => ItemView;
};
```

`registerAll(plugin, context)` iterates entries and calls `plugin.registerView(type, (leaf) => factory(leaf, ctx))`. `openView(plugin, type)` finds or creates the appropriate leaf based on `defaultLocation`.

Skeleton ships exactly one registration (`homepage`, `main`). A commented example showing a `'left'` sidebar registration documents the extension path.

## 3. Obsidian Plugin Compliance

### 3.1 ESLint coverage

- `eslint-plugin-obsidianmd` enabled with `...recommended` — catches `app.vault.adapter` misuse, bad event registration patterns, platform-detection anti-patterns.
- `obsidianmd/ui/sentence-case` set to `warn` with `brands: ['Agentonomous']`.
- Ban list: `innerHTML`, `outerHTML`, `insertAdjacentHTML` → DOM API only.
- `no-restricted-imports` enforces the `obsidian` allowlist.
- `eslint-plugin-vue` recommended rules for SFC linting.

### 3.2 Runtime discipline (code review, not ESLint)

- Every timer / event / DOM handler routed through `this.registerInterval()`, `this.registerEvent()`, `this.registerDomEvent()`. `onunload()` is thereby automatic.
- `onunload()` additionally `unmount()`s any active Vue apps and detaches the settings adapter.
- App/vault/workspace passed through `PluginContext` constructor injection; direct `this.app` access limited to the plugin entry.
- Platform detection uses Obsidian's `Platform` class, never user-agent sniffing.
- `moment` accessed via `window.moment` if needed.
- CSS shipped only as `styles.css` (Vite concatenates `styles/*.css` into it).

### 3.3 Marketplace publishing readiness

- `manifest.json` at project root:
  - `id`: `agentonomous`
  - `name`: `Agentonomous`
  - `version`: `0.0.1`
  - `minAppVersion`: `1.12.7`
  - `description`: "Autonomous agents sandbox — Vue 3 + DDD infrastructure skeleton."
  - `author`: `Luis Mendez`
  - `authorUrl`: TBD (placeholder `https://github.com/luismendez` pending user input)
  - `isDesktopOnly`: `true`
- `versions.json`: `{ "0.0.1": "1.12.7" }`.
- `README.md` with what/why/install sections.
- `LICENSE` — MIT.
- `version-bump.mjs` script (ported from Meridian pattern) updates `manifest.json` and `versions.json`.
- `scripts/package-release.mjs` produces `dist/agentonomous-<version>.zip` with exactly `main.js`, `manifest.json`, `styles.css`.
- Submission to `obsidianmd/obsidian-releases` is **user-triggered**, not part of this increment.

## 4. Quality Harness & Tooling

### 4.1 npm scripts

```json
{
  "build":            "vite build --config configs/vite.config.ts",
  "build:dev":        "vite build --config configs/vite.config.ts --watch",
  "deploy":           "node scripts/deploy-to-test-vault.mjs",
  "test":             "npm run lint && npm run typecheck && npm run test:unit",
  "test:unit":        "vitest run --config configs/vitest.config.ts",
  "test:watch":       "vitest --config configs/vitest.config.ts",
  "typecheck":        "tsc --noEmit --project configs/tsconfig.json",
  "lint":             "eslint src/ --config configs/eslint.config.mjs",
  "storybook":        "storybook dev -p 6006 -c configs/storybook",
  "build-storybook":  "storybook build -c configs/storybook",
  "docs":             "typedoc --options configs/typedoc.json",
  "release":          "node scripts/package-release.mjs",
  "version":          "node version-bump.mjs && git add manifest.json versions.json"
}
```

### 4.2 Configs (all in `configs/`)

- `vite.config.ts` — `@vitejs/plugin-vue`, output to `dist/`, externals `obsidian` + Node built-ins, post-build hook invokes `deploy-to-test-vault.mjs`.
- `vitest.config.ts` — `jsdom` env, `@vitest/coverage-v8`, thresholds `{ statements: 80, branches: 70, functions: 80, lines: 80 }`.
- `tsconfig.json` — ES2022, NodeNext, strict, `types: ["vite/client", "vitest/globals"]`.
- `tsconfig.lint.json` — extends `tsconfig.json` and includes `tests/` for type-aware linting.
- `eslint.config.mjs` — ported from Meridian, plus `eslint-plugin-vue` for SFCs.
- `typedoc.json` — entry points `src/domain/**/*.ts` and `src/infrastructure/**/*.ts` (Vue SFCs excluded).
- `storybook/main.ts` — `@storybook/vue3-vite`, addons: `a11y`, `interactions`, `essentials`.

### 4.3 Build → deploy pipeline

1. `vite build` produces `dist/main.js`, `dist/manifest.json`, `dist/styles.css`.
2. Post-build hook runs `scripts/deploy-to-test-vault.mjs`:
   - Reads `process.env.AGENTONOMOUS_TEST_VAULT` (default `C:\Projects\Agentonomous`).
   - Creates `<vault>/.obsidian/plugins/agentonomous/` if missing.
   - Copies the three files into that folder.
   - Logs destination path and file sizes.
3. `build:dev` re-runs the deploy on every Vite rebuild; Obsidian's hot-reload plugin (if installed) picks up changes.

### 4.4 Quality gates (must all pass for `npm test`)

1. ESLint clean, including `eslint-plugin-obsidianmd` recommended rules.
2. `tsc --noEmit` zero errors.
3. Vitest passes with coverage ≥ thresholds above.

## 5. File Inventory

### 5.1 Root

- `manifest.json`, `versions.json`, `package.json`, `README.md`, `LICENSE`, `.gitignore`, `version-bump.mjs`.

### 5.2 `configs/`

All seven config files from §4.2.

### 5.3 `scripts/`

- `deploy-to-test-vault.mjs` — copy artifacts into the test vault.
- `package-release.mjs` — produce release zip.

### 5.4 `src/main.ts`

Extends `Plugin`. In `onload()`:
- Loads settings through `ObsidianSettingsAdapter`.
- Builds `PluginContext` via `createPluginContext(this)`.
- Calls `ViewRegistry.registerAll(this, context)`.
- Adds ribbon icon (`addRibbonIcon('bot', 'Open Agentonomous', () => openView(this, 'agentonomous-homepage'))`) gated on `settings.showRibbonIcon`.
- Adds command `id: 'open-homepage'`, `name: 'Open Agentonomous homepage'`.
- Adds `SettingsTab`.

`onunload()` performs only work Obsidian doesn't auto-clean (Vue app unmounting is handled by `ItemView.onClose()`).

### 5.5 `src/plugin.ts`

Defines `PluginContext` type and `createPluginContext(plugin)` factory.

### 5.6 `src/domain/`

- `domain/settings/plugin-settings.ts` — `PluginSettings` type, `DEFAULT_SETTINGS`, `validateSettings(raw: unknown): Result<PluginSettings, string>`.
- `domain/shared/result.ts` — `Result<T, E>` type + `ok()`, `err()`, `isOk()`, `isErr()` helpers.

### 5.7 `src/infrastructure/`

- `infrastructure/obsidian/obsidian-settings-adapter.ts` — wraps `plugin.loadData()` / `saveData()`, validates via the domain validator, emits typed reads/writes, notifies subscribers.
- `infrastructure/obsidian/view-registry.ts` — registry pattern + `registerAll(plugin, ctx)` + `openView(plugin, type)`.
- `infrastructure/views/homepage-view.ts` — extends `ItemView`. `VIEW_TYPE_HOMEPAGE = 'agentonomous-homepage'`. `onOpen()` mounts a Vue app; `onClose()` unmounts.
- `infrastructure/settings/settings-tab.ts` — extends `PluginSettingTab`. Two controls: `Show ribbon icon` toggle, `Default view` dropdown.
- `infrastructure/ribbon/ribbon.ts` — helper for conditional ribbon registration.

### 5.8 `src/ui/`

- `ui/app.ts` — `createVueApp(context: PluginContext): { app, mount, unmount }`.
- `ui/router/index.ts` — `createMemoryHistory()` router with routes `/` → `Home.vue`, `/about` → `About.vue`.
- `ui/stores/app-store.ts` — `useAppStore()` with `pluginVersion` + `greeting`.
- `ui/stores/settings-store.ts` — `useSettingsStore()` wrapping the settings adapter.
- `ui/pages/Home.vue` — renders `<HelloCard>` + version, router link to `/about`.
- `ui/pages/About.vue` — plugin name/version/minAppVersion + router link to `/`.
- `ui/components/HelloCard.vue` — presentational component, `title` + `message` props.

### 5.9 `styles/`

- `styles/base.css`, `styles/homepage.css` → Vite concatenates into `dist/styles.css`.

### 5.10 `stories/`

- `stories/HelloCard.stories.ts` — 2 stories (default + long message), interactions demo.

### 5.11 `tests/` (mirrors `src/`)

- `tests/domain/settings/plugin-settings.test.ts`
- `tests/domain/shared/result.test.ts`
- `tests/infrastructure/obsidian/view-registry.test.ts`
- `tests/infrastructure/obsidian/obsidian-settings-adapter.test.ts`
- `tests/ui/stores/app-store.test.ts`
- `tests/ui/stores/settings-store.test.ts`
- `tests/ui/components/HelloCard.test.ts`
- `tests/ui/pages/Home.test.ts`

### 5.12 devDependencies (locked in)

`vue`, `vue-router`, `pinia`, `vite`, `@vitejs/plugin-vue`, `vitest`, `@vitest/coverage-v8`, `@vue/test-utils`, `jsdom`, `typescript`, `typedoc`, `eslint`, `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `eslint-plugin-obsidianmd`, `eslint-plugin-vue`, `obsidian`, `storybook`, `@storybook/vue3-vite`, `@storybook/addon-a11y`, `@storybook/addon-interactions`, `@storybook/addon-essentials`.

## 6. Acceptance Criteria

### 6.1 Functional (observable in Obsidian)

1. After `npm install && npm run build`, Obsidian loaded against the test vault shows **Agentonomous** in *Settings → Community plugins → Installed*.
2. Enabling the plugin adds a ribbon icon (bot icon). Clicking it opens a workspace leaf titled **"Agentonomous homepage"**.
3. The command palette lists **"Agentonomous: Open homepage"**; invoking it opens the same view (or focuses it if already open).
4. The Homepage shows a `HelloCard` with the greeting + plugin version, plus a link to `/about` that navigates in-place without closing the leaf. The About page links back to `/`.
5. *Settings → Agentonomous* shows a settings tab with two controls: `Show ribbon icon` (toggle), `Default view` (dropdown, value `home`). Toggling the ribbon hides/shows the icon immediately. Settings survive Obsidian restart.
6. Disabling the plugin removes the ribbon icon and closes the leaf with no errors in Obsidian's console.

### 6.2 Quality harness (local CI-equivalent)

7. `npm test` is green: ESLint clean (incl. `eslint-plugin-obsidianmd`), `tsc --noEmit` zero errors, Vitest passes with coverage ≥ thresholds.
8. `npm run storybook` starts Storybook on `:6006` and renders `HelloCard` stories with a11y + interactions panels active.
9. `npm run docs` generates TypeDoc output into `docs/api/` without warnings about missing documentation on exported symbols.
10. `npm run build` produces `dist/main.js`, `dist/manifest.json`, `dist/styles.css`, and auto-deploys them into `%AGENTONOMOUS_TEST_VAULT%\.obsidian\plugins\agentonomous\` (default `C:\Projects\Agentonomous`).
11. `npm run release` produces `dist/agentonomous-0.0.1.zip` containing exactly the three required files.

### 6.3 Architectural invariants (ESLint-enforced)

12. No file under `src/domain/**` imports from `obsidian`, `node:*`, or `src/infrastructure/**`.
13. No file under `src/ui/**` imports `src/domain/**` internals directly — stores mediate.
14. `obsidian` imports appear only in the §2.2 allowlist.
15. No `innerHTML` / `outerHTML` / `insertAdjacentHTML` anywhere.
16. No `try`/`catch` outside `src/infrastructure/**`.
17. No `any`, no `@ts-ignore`, no `TODO` / `FIXME` comments in committed code.

## 7. Risks & Open Items

- **`authorUrl`** — currently a placeholder (`https://github.com/luismendez`). User should confirm the correct URL before marketplace submission (a later increment).
- **Hot-reload plugin dependency** — iteration speed during development assumes the user has Obsidian's `hot-reload` plugin installed in the test vault. Not a blocker — manual reload also works.
- **TypeDoc on Vue SFCs** — TypeDoc has limited SFC support; design chooses to skip SFCs entirely in API docs. If we later want component API docs, add `vue-docgen` or Storybook autodocs.
- **Storybook bundle weight** — Storybook adds ~200MB of devDeps; acceptable for a richly-UI-oriented plugin.
- **`eslint-plugin-vue` + flat config** — check current compatibility; fall back to `.eslintrc`-style config for the Vue layer only if flat-config support is incomplete at implementation time.

## 8. Next Step

After this spec is approved, the `writing-plans` skill produces a detailed implementation plan broken into small verifiable steps, followed by implementation per that plan.
