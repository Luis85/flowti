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

1. **Domain is pure.** No import of `obsidian`, `node:*`, `src/infrastructure/**`, or Vue. This includes no imports of `vue`, `pinia`, `vue-router`, or `@vue/reactivity` — the domain model is plain TypeScript objects with no framework reactivity.
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
7. **Vue SFCs are presentation-only.** No `fetch`, no direct domain imports, no business logic in `<script setup>`. Allowed: props in, events out, rendering, local-UI-only `ref`/`computed` (e.g. open/closed toggle state). Everything else comes from a store via `useXxxStore()` or is passed through props.

### 2.2.1 Data-model separation (Vue is the view layer, not the model layer)

Vue is strictly responsible for **presentation**. The data model is owned by the domain layer and never leaks Vue reactivity.

**Layer ownership of the data model:**

| Layer | Owns | Examples in skeleton | Framework dependencies |
|-------|------|----------------------|------------------------|
| `domain/` | Types, aggregates, value objects, use-cases, ports (interfaces) | `PluginSettings`, `Result<T,E>`, `SettingsPort`, `validateSettings()` | None (plain TS) |
| `infrastructure/` | Port implementations: persistence, Obsidian adapters, platform I/O | `ObsidianSettingsAdapter implements SettingsPort` | `obsidian`, `node:*` |
| `ui/stores/` | Reactive view state derived from domain, orchestration of use-case calls | `useAppStore`, `useSettingsStore` | `pinia`, `vue` (reactivity only) |
| `ui/pages/` + `ui/components/` | Rendering and user interaction | `Home.vue`, `About.vue`, `HelloCard.vue` | `vue`, `vue-router` |

**Rules that follow from this:**

- **Domain types flow outward unchanged.** `PluginSettings` is declared in `domain/settings/plugin-settings.ts` as a plain TS type. Infrastructure reads/writes it, stores hold it, components receive it through props or destructured store getters. No DTO duplication, no Vue-reactive variant of the same type.
- **Stores are the translation boundary.** A store wraps a plain-TS value from the domain in `ref()` / `reactive()` so Vue can observe changes. The store's `state` shape mirrors the domain type 1:1 for the skeleton; when richer UI needs arise later, stores may derive view-specific `computed` values, but the canonical shape remains the domain type.
- **Stores call the domain via ports only.** `useSettingsStore()` receives a `SettingsPort` (not the concrete adapter) via Vue's `inject()`. Stores never import from `src/infrastructure/**`.
- **Components receive data, not services.** Components get domain values through props (or `storeToRefs` on a store). Components never call a port, never import a store from a sibling tree, and never import from `src/domain/**` directly — they consume the store's exposed state and actions.
- **No business logic in SFCs.** Validation, orchestration, and state transitions live in domain use-cases or store actions. An SFC's `<script setup>` may hold only presentation-local state (a collapsed/expanded flag, a filter string bound to an input) — anything that would outlive the component's lifetime belongs in a store or the domain.
- **Events flow up, data flows down.** A component emits a typed event (`@save="onSave"`) and the parent page or a store action handles it. No `v-model` binding pointed at a domain type field mutating it in place; the store owns writes.
- **No Vue types in domain tests.** Domain unit tests import only from `src/domain/**`. Store tests are the first place Vue appears, using `createTestingPinia()` and `@vue/test-utils` for hydration.

This discipline keeps the domain testable without Vue, keeps stores swappable (a future CLI or headless test harness can drive the same domain without touching Pinia), and ensures no business rule ever migrates into an SFC.

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
  - `isDesktopOnly`: `true`
  - `authorUrl` is intentionally omitted for `0.0.1`; it is optional in Obsidian's manifest schema and will be added before marketplace submission (a later increment).
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

- `vite.config.ts` — `@vitejs/plugin-vue`, output to `dist/`, externals `obsidian` + Node built-ins, post-build hook invokes `deploy-to-test-vault.mjs`. Includes a small rollup/Vite plugin (`scripts/concat-styles.mjs`) that concatenates `styles/*.css` into `dist/styles.css` during build.
- `vitest.config.ts` — `jsdom` env, `@vitest/coverage-v8`, thresholds `{ statements: 80, branches: 70, functions: 80, lines: 80 }`.
- `tsconfig.json` — ES2022, NodeNext, strict, `types: ["vite/client", "vitest/globals"]`.
- `tsconfig.lint.json` — extends `tsconfig.json` and includes `tests/` for type-aware linting.
- `eslint.config.mjs` — ported from Meridian, using ESLint flat config, plus `eslint-plugin-vue` for SFCs (see §4.2.1 for the required parser configuration).
- `typedoc.json` — entry points `src/domain/**/*.ts` and `src/infrastructure/**/*.ts` (Vue SFCs excluded).
- `storybook/main.ts` — Storybook 10.3 with `@storybook/vue3-vite`; ESM-only config (Storybook 10 requires this); addons: `@storybook/addon-a11y`, `@storybook/addon-vitest`. No `addon-essentials` (removed/decomposed in 10), no `addon-interactions` (its responsibilities are taken over by `addon-vitest` for projects using Vite + Vitest — component interaction tests run through Vitest with stories attached via the `.test` story method introduced in 10).
- `storybook/preview.ts` — uses `setup()` from `@storybook/vue3-vite` to register Vue plugins if needed by stories; decorators + parameters for a11y and Vitest component testing.

### 4.2.1 ESLint flat config — Vue SFC parser block

`eslint-plugin-vue` requires `vue-eslint-parser` for `.vue` files, with `@typescript-eslint/parser` nested inside `parserOptions.parser`. The flat config therefore has **three** file-scope blocks:

1. **`files: ['src/**/*.ts']`** — parser `@typescript-eslint/parser`, project `tsconfig.lint.json`, all Meridian rules (`sharedTsRules`, `no-restricted-imports` allowlists, `no-restricted-syntax` bans, `no-restricted-properties`).
2. **`files: ['tests/**/*.ts']`** — same parser, relaxed rules mirroring Meridian (no-console off, `no-unsafe-*` off, `no-unnecessary-condition` off).
3. **`files: ['**/*.vue']`** — parser `vue-eslint-parser`, `parserOptions: { parser: '@typescript-eslint/parser', project: './configs/tsconfig.lint.json', extraFileExtensions: ['.vue'] }`, plugin `vue` with `vue/recommended` rules plus the same `sharedTsRules`. This block is what unblocks Vue SFCs under Meridian's strict TS ruleset.

Meridian's inherited strict rules (`consistent-type-imports`, `strict-boolean-expressions`, `no-unsafe-*`) apply unchanged inside `<script setup>` — all Vue component code uses type-only imports for props/emits interfaces.

The Meridian override `src/infrastructure/**` still turns off `no-restricted-syntax` (allowing try/catch at infrastructure boundaries). The Vue mount call therefore lives inside `infrastructure/views/homepage-view.ts` wrapped in try/catch; `ui/app.ts` stays free of try/catch and only constructs and returns the Vue app object.

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

All eight config files from §4.2: `vite.config.ts`, `vitest.config.ts`, `tsconfig.json`, `tsconfig.lint.json`, `eslint.config.mjs`, `typedoc.json`, `storybook/main.ts`, `storybook/preview.ts`.

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
- `domain/settings/settings-port.ts` — `SettingsPort` interface: `load(): Promise<Result<PluginSettings, string>>`, `save(s: PluginSettings): Promise<Result<void, string>>`, `subscribe(cb: (s: PluginSettings) => void): Unsubscribe`. Implemented by `infrastructure/obsidian/obsidian-settings-adapter.ts`. Consumed by `ui/stores/settings-store.ts` — the store depends only on this port type, satisfying §2.2 rule 2 ("UI reaches domain only through ports/stores").
- `domain/shared/result.ts` — `Result<T, E>` type + `ok()`, `err()`, `isOk()`, `isErr()` helpers.
- `domain/shared/unsubscribe.ts` — `type Unsubscribe = () => void` alias used by `SettingsPort.subscribe()` and any future observer APIs.

### 5.7 `src/infrastructure/`

- `infrastructure/obsidian/obsidian-settings-adapter.ts` — implements the domain `SettingsPort` interface (see §5.6). Wraps `plugin.loadData()` / `saveData()`, validates via the domain validator, emits typed reads/writes, notifies subscribers.
- `infrastructure/obsidian/view-registry.ts` — registry pattern + `registerAll(plugin, ctx)` + `openView(plugin, type)`.
- `infrastructure/views/homepage-view.ts` — extends `ItemView`. `VIEW_TYPE_HOMEPAGE = 'agentonomous-homepage'`. `onOpen()` constructs a Vue app via `createVueApp(ctx)` and mounts it inside a try/catch (this is the sanctioned infrastructure boundary for error capture); `onClose()` unmounts.
- `infrastructure/settings/settings-tab.ts` — extends `PluginSettingTab`. Two controls: `Show ribbon icon` toggle, `Default view` dropdown.
- `infrastructure/ribbon/ribbon.ts` — helper for conditional ribbon registration.

### 5.8 `src/ui/`

- `ui/app.ts` — `createVueApp(context: PluginContext): { app, mount, unmount }`.
- `ui/router/index.ts` — `createMemoryHistory()` router with routes `/` → `Home.vue`, `/about` → `About.vue`.
- `ui/stores/app-store.ts` — `useAppStore()` with `pluginVersion` + `greeting`.
- `ui/stores/settings-store.ts` — `useSettingsStore()` depending only on the domain `SettingsPort` (injected via Vue's `provide/inject`, bound at `createVueApp()` time to the `ObsidianSettingsAdapter` instance). Never imports from `infrastructure/**` directly.
- `ui/pages/Home.vue` — renders `<HelloCard>` + version, router link to `/about`.
- `ui/pages/About.vue` — plugin name/version/minAppVersion + router link to `/`.
- `ui/components/HelloCard.vue` — presentational component, `title` + `message` props.

### 5.9 `styles/`

- `styles/base.css`, `styles/homepage.css` → Vite concatenates into `dist/styles.css`.

### 5.10 `stories/`

- `stories/HelloCard.stories.ts` — 2 visual stories (default + long message) plus one `.test` interaction story demonstrating the Storybook 10 testing API. The `.test` block runs through `@storybook/addon-vitest` when `npm run test:unit` executes.

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

Frameworks & libraries:
- `vue` (^3.x), `vue-router` (^4.x), `pinia` (^2.x)
- `typescript` (^6.x) — matches Meridian
- `obsidian` (^1.12.x)

Build & test:
- `vite` (^8.x — Storybook 10 compatible), `@vitejs/plugin-vue`
- `vitest` (^4.x — Storybook 10 pairs with Vitest 4), `@vitest/coverage-v8`
- `@vue/test-utils`, `jsdom`

Storybook 10:
- `storybook` (^10.3.x)
- `@storybook/vue3-vite`
- `@storybook/addon-a11y`
- `@storybook/addon-vitest` — provides interaction testing via Vitest (replaces `addon-interactions` + `addon-essentials`)

Linting & typing:
- `eslint` (^10.x)
- `@typescript-eslint/eslint-plugin`, `@typescript-eslint/parser`, `typescript-eslint`
- `eslint-plugin-obsidianmd`
- `eslint-plugin-vue`, `vue-eslint-parser`

Docs:
- `typedoc` (^0.28.x — matches Meridian)

### 5.13 Node engines

`package.json` declares `"engines": { "node": ">=20.19.0" }` — Storybook 10's floor is Node **20.19+ or 22.12+**. Vite 8 and Vitest 4 are also satisfied by this range.

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
8. `npm run storybook` starts Storybook 10 on `:6006` and renders `HelloCard` stories with the a11y panel active. The `HelloCard.stories.ts` file includes at least one `.test` interaction story; running `npm run test:unit` picks it up via `@storybook/addon-vitest`'s Vitest integration and reports it alongside the rest of the Vitest suite.
9. `npm run docs` generates TypeDoc output into `docs/api/` with zero errors. (TypeDoc "missing documentation" warnings are not a gate for this increment; JSDoc coverage is a later polish item.)
10. `npm run build` produces `dist/main.js`, `dist/manifest.json`, `dist/styles.css`. `npm run build:deploy` additionally copies them into the folder resolved from the `AGENTONOMOUS_TEST_VAULT` environment variable (default `C:\Projects\Agentonomous`), target path `<vault>/.obsidian/plugins/agentonomous/`. `npm run build` alone is CI-safe and does not touch any vault.
11. `npm run release` produces `dist/agentonomous-0.0.1.zip` containing exactly the three required files.
12. `npm run deploy` is idempotent — running it twice in a row with the same `dist/` contents leaves the test vault folder in the identical state (overwrites, does not error).

### 6.3 Architectural invariants (ESLint-enforced)

12. No file under `src/domain/**` imports from `obsidian`, `node:*`, `src/infrastructure/**`, `vue`, `pinia`, `vue-router`, or `@vue/reactivity`.
13. No file under `src/ui/**` imports `src/domain/**` internals directly — stores mediate. Components do not import from `src/ui/stores/**` of sibling features unless the component is a page composed of those stores.
14. `obsidian` imports appear only in the §2.2 allowlist.
15. No `innerHTML` / `outerHTML` / `insertAdjacentHTML` anywhere.
16. No `try`/`catch` outside `src/infrastructure/**`.
17. No `any`, no `@ts-ignore`, no `TODO` / `FIXME` comments in committed code.
18. No file under `src/ui/components/**` or `src/ui/pages/**` imports from `src/infrastructure/**`. Components consume stores; stores consume ports.

## 7. Risks & Open Items

- **Hot-reload plugin dependency** — iteration speed during development assumes the user has Obsidian's `hot-reload` plugin installed in the test vault. Not a blocker — manual reload also works.
- **TypeDoc on Vue SFCs** — TypeDoc has limited SFC support; design chooses to skip SFCs entirely in API docs. If we later want component API docs, add `vue-docgen` or Storybook autodocs.
- **Storybook bundle weight** — Storybook 10 adds ~200MB of devDeps; acceptable for a richly-UI-oriented plugin.
- **Storybook 10 + Vitest coupling** — `@storybook/addon-vitest` projects stories into the Vitest test tree. The `vitest.config.ts` must not `exclude` `stories/**` or the Storybook-produced tests will be invisible. At implementation time, verify that the addon's Vite plugin is added to `vitest.config.ts` (per `@storybook/addon-vitest` docs) so `.test` stories are discovered alongside `tests/**/*.test.ts`.
- **Manifest `authorUrl`** — omitted for `0.0.1`. Must be populated before marketplace submission (out of scope for this increment).

## 8. Next Step

After this spec is approved, the `writing-plans` skill produces a detailed implementation plan broken into small verifiable steps, followed by implementation per that plan.
