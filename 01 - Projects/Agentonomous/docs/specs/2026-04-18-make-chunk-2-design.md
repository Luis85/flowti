# Make — Chunk 2: Read pages design

**Date**: 2026-04-18
**Status**: Approved
**Supersedes**: Chunk 2 placeholder in `docs/plans/2026-04-18-make.md`
**Depends on**: Chunk 1 shipped (tag `make-slice-1`), `2026-04-18-make-design.md`

## Context

Chunk 1 delivered the Make feature's foundation and read-only backend: domain types, field-kinds, codec, schema validation, service skeleton (with `listTypes` and `loadType` live), module registration, and a set of Vue input components. `MakeService.listInstances` shipped as a `not-implemented` stub.

Chunk 2 adds the *presentation layer for read paths*. Users can open the Make view in Obsidian, see an overview, browse the types they've created, and drill into a type's schema and instance list. Everything is read-only — authoring comes in Chunks 3 and 4.

## Scope

**In scope:**
- Three Vue pages: `MakeHome`, `MakeTypes`, `MakeType` (with `Fields` and `Instances` tabs)
- Pinia store `make-store` caching types and instances, with a manual refresh
- Router entries for `/make`, `/make/types`, `/make/types/:typeId`
- Obsidian view wrapper `make-view.ts` (analogous to `homepage-view.ts`)
- Real implementation of `MakeService.listInstances` (+ a `VaultPort.stat()` method if absent)
- i18n strings for all new UI surfaces
- Storybook stories covering page states (loading, empty, error, populated)

**Out of scope** (deferred to later chunks):
- Any write path: creating/editing types, creating instances, toggling favorites, generating base files (Chunk 3–4)
- KPIs and recently-created list on MakeHome (Chunk 5)
- Live vault event subscription — Chunk 2 uses manual refresh (Chunk 3 adds live events alongside write paths)
- Surfacing corrupt type/instance files in the UI (Chunk 3 — paired with edit-to-fix affordance)
- "Open instance in Obsidian" action on MakeType's Instances tab (Chunk 4)

## Deviations from Chunk 1 plan's placeholder

Chunk 1's plan (`docs/plans/2026-04-18-make.md`, line 2592) described Chunk 2 as "routing, MakeHome, MakeTypes, view-only MakeTypeConfig, list-only MakeTypeIndex, make-view.ts, and the Pinia store." This spec collapses `MakeTypeConfig` + `MakeTypeIndex` into a single `MakeType` page with two tabs (see Section 3 rationale). The individual files therefore become `MakeType.vue` + `MakeTypeFields.vue` + `MakeTypeInstances.vue`.

## Approach

Tight read-only scope (the one aligned to the Q&A answers):

- Always open MakeHome on view open (Q1 — "a").
- Cache with explicit user-triggered refresh; no live events yet (Q2 — "d").
- MakeHome stays minimal: welcome + "Browse types" CTA + favorites chips only; KPIs/recent deferred (Q3 — "a").
- Corrupt type files: silent skip + `logger.warn`; no UI surface yet (Q4 — "d").
- One route per type with `Fields`/`Instances` tabs rather than two separate routes (Q5 — "b").
- MakeTypes rows show name + description + instance count + favorite star (Q6 — "c").

Rejected alternatives:
- Medium scope (add live vault events, URL hash for persistence, loading skeletons) — natural Chunk 3 companion to write paths. Avoids rebuilding the refresh story once.
- Expansive scope (borrow favorites-toggle from Chunk 3, KPIs from Chunk 5) — breaks chunk boundaries.

---

## 1. Routing & view wrapper

**Routes** (added to `src/ui/router/index.ts`):

| Path | Name | Component | Layout |
|---|---|---|---|
| `/make` | `make-home` | `MakeHome` | `main` |
| `/make/types` | `make-types` | `MakeTypes` | `main` |
| `/make/types/:typeId` | `make-type` | `MakeType` | `main` |

Tab state on `MakeType` rides in the URL hash (`/make/types/book#instances`) so reopening a leaf restores the last-viewed tab. Default tab when hash is absent: **Instances** (reasoning: users visit a type to look at content; fields is one click away).

**Unknown-type guard** — `make-type`'s `beforeEnter` resolves `:typeId` against the store's `types`; if missing, redirects to `/make/types` and emits an Obsidian notice ("Type not found"). Store must be loaded at guard time (guard calls `store.loadTypes()` and awaits if not yet loaded).

**Obsidian view wrapper** — `src/infrastructure/obsidian/views/make-view.ts` mirrors `homepage-view.ts`:

- Exports `VIEW_TYPE_MAKE` — relocated from `make-module.ts` to `src/domain/views/view-types.ts` to match the `VIEW_TYPE_HOMEPAGE` convention.
- `MakeView extends ItemView`; constructor takes `PluginContext`.
- `onOpen()` dynamically imports `createVueApp`, navigates router to `/make`, mounts into `this.contentEl`. Idempotent.
- Exports `MAKE_VIEW_REGISTRATION` to be added to `VIEW_REGISTRATIONS` in `src/infrastructure/obsidian/views/index.ts`.
- `onClose()` unmounts.

## 2. Pinia store

**File**: `src/ui/stores/make-store.ts`. One store per module (matches `file-detail-store`, `event-inspector-store`). Setup-syntax, module-owned.

**State**:
```ts
types:              readonly TypeSchema[]
typesLoaded:        boolean
typesLoading:       boolean
typesError:         string | null
instancesByTypeId:  ReadonlyMap<TypeId, readonly InstanceRef[]>
instancesLoading:   ReadonlySet<TypeId>
instancesError:     ReadonlyMap<TypeId, string>
```

`typesError` is a vault-class error only (folder unreadable). Parse errors on individual type files are log-only per Q4.

**Actions** (each calls `getMakeService()`; early-returns with `typesError = 'make not ready'` if service null):

| Action | Effect |
|---|---|
| `loadTypes()` | Fetch via `service.listTypes`. Re-entrant safe. Sets `typesLoaded` + `typesLoading`. |
| `loadInstances(typeId)` | Fetch via `service.listInstances(typeId)`. Adds/removes from `instancesLoading` set. |
| `loadInstancesForAll()` | Parallel-loads instances for every type in `types`. Used by MakeTypes for counts. |
| `refreshAll()` | Wipes cache. Re-fetches types + instances for currently-viewed typeId (resolved from `router.currentRoute`). |
| `getType(typeId)` | Pure getter. Returns `TypeSchema \| undefined`. Used by route guard. |

**Getters**:
- `typesSortedByName` — alphabetical by `name`.
- `instanceCountByTypeId: ReadonlyMap<TypeId, number | undefined>` — `undefined` ⇒ "not loaded yet" (renders as `—` in UI).
- `favoriteTypes` — filters `types` by `settings.favorites` (pulls from `getMakeSettings()`).

**Tests** at `tests/ui/stores/make-store.test.ts` — mock `getMakeService` with a fake service returning `ok(…)` / `err(…)`. Verify state transitions for each action + getters.

## 3. Pages

All three pages under `src/ui/pages/make/`. Each co-located with a `.po.ts` PageObject (project convention). Tests under `tests/ui/pages/make/*.test.ts`; stories under `stories/pages/make/*.stories.ts`.

All interactive elements carry `data-testid` attributes keyed per the PageObject. No CSS class coupling.

### 3.1 MakeHome — `/make`

Content:
- Title ("Make") + one-line blurb.
- Primary CTA button → `/make/types`. `data-testid="browse-types-cta"`.
- Favorites strip: chips rendered from `store.favoriteTypes`; each links to `/make/types/:typeId`. Hidden when empty.
- First-run empty state (`store.types.length === 0`): replaces CTA with "You haven't created any types yet. Types come in Chunk 3." (i18n).

Lifecycle: `onMounted(() => store.loadTypes())`. Spinner while `typesLoading`.

### 3.2 MakeTypes — `/make/types`

Content:
- Header: `<h1>Types</h1>` + count ("N types") + refresh button.
- List: one row per type sorted alphabetically by name. Per row:
  - `★` favorite badge (visual-only in Chunk 2)
  - `name`
  - `description` (second line, muted)
  - instance count right-aligned ("4 instances" or `—` while loading)
- Each row links to `/make/types/:typeId`. `data-testid="type-row-<typeId>"`.

Lifecycle: `onMounted(() => { store.loadTypes(); store.loadInstancesForAll(); })`.

States: loading spinner, empty ("no types yet"), error (red banner + retry button bound to refresh).

### 3.3 MakeType — `/make/types/:typeId`

Structure: shared header + tab strip + active tab panel.

**Header** (always visible):
- `<h1>{{ type.name }}</h1>` + favorite badge (visual-only)
- `<span>Folder: {{ type.instancesFolder }}</span>`
- Refresh button (reloads both tabs' data)

**Tabs**: `[Fields] [Instances]`. Default: **Instances** (unless `#fields` in URL). Tab change updates `route.hash` via `router.replace`.

**MakeTypeFields.vue** (tab panel):
Renders `type.fields` as a read-only table. Columns: `kind | name | label | required | description`. Row matching `type.titleFieldName` shows a `(title field)` badge. Empty state: "No fields defined on this type."

**MakeTypeInstances.vue** (tab panel):
Renders `store.instancesByTypeId.get(typeId)` as a list, sorted by `createdAt` descending (newest first). Per row: `title` (= filename stem) + short-format `createdAt` date. `data-testid="instance-row-<path>"`. Click is a no-op in Chunk 2 (Chunk 4 wires "open in Obsidian"). Empty state: `"No {{ type.name }} instances yet. Instance creation comes in Chunk 4."`

Lifecycle: `onMounted(() => { store.loadTypes(); store.loadInstances(typeId); })`. Splitting Fields/Instances into sub-components keeps each file under the 350-line ESLint cap.

## 4. Service impact & refresh model

### MakeService.listInstances — real implementation

Drops the `not-implemented` stub. Behavior:

1. `const type = await loadType(typeId)` — if `type-not-found`, propagate.
2. Resolve `type.instancesFolder` to an absolute vault path.
3. `vault.list(folder)` — if folder doesn't exist, return `ok([])` (matches `listTypes` convention).
4. Filter children to direct-child `.md` files (no recursion into subfolders; consistent with `listTypes`).
5. For each file, call `vault.stat(path)` for `createdAt` / `updatedAt`.
6. Build `InstanceRef { typeId, path, title: <filename stem>, createdAt, updatedAt }` per Chunk 1's committed shape.
7. Files that fail to stat or have non-.md extensions are skipped and logged at `warn` level.

**`VaultPort.stat()`** — if absent, Chunk 2 adds it:
- Port signature: `stat(path: string): Promise<Result<{ createdAt: string; updatedAt: string }, string>>` (ISO timestamps).
- `ObsidianVaultAdapter` implementation maps Obsidian's file `ctime`/`mtime` to ISO strings.
- `fakeVault` implementation records `createdAt`/`updatedAt` on `create()` and returns them.
- Task 2.1's first step is a verification check; if the port already exposes `stat`, skip the port/adapter additions and proceed to 2.2.

### Refresh model

Each page header (MakeTypes, MakeType) carries a refresh button. MakeHome does not (favorites come from settings, which are already reactive; no remote data to refresh).

- Click → `store.refreshAll()`. Wipes cache, re-fetches.
- Button disabled + shows spinner while `typesLoading || instancesLoading.size > 0` (debounces re-entry).
- No TTL. Cache lives as long as the Vue app does (until view close, plugin disable, or folder-path setting change — any of which re-creates the app).
- No keyboard shortcut in Chunk 2.

## 5. Error handling

| Layer | Error class | UI surface | Log |
|---|---|---|---|
| Vault read/list failure (types or instances) | store `typesError` / `instancesError[typeId]` | Red banner on affected page with retry button | `logger.warn('make', …)` |
| JSON parse / invalid schema on a type file | skipped from list | None (log-only per Q4) | `logger.warn('make', …)` |
| Stat or read failure on an instance file | skipped from the returned list | None | `logger.warn('make', …)` |
| Non-.md file in instances folder | silently skipped | None | debug-level only |
| Unknown `:typeId` on MakeType route | redirect to `/make/types` + Obsidian notice | Notice toast "Type not found" | `logger.info` |
| `MakeService` not ready (module destroyed/re-initing) | store actions early-return with `typesError = 'make not ready'` | Banner | `logger.warn` |
| Refresh click while another refresh in flight | no-op; button disabled | Spinner stays | — |

## 6. Testing strategy

**Service** — extends Chunk 1's `tests/modules/make/make-service.test.ts`:
- `listInstances` happy path
- `listInstances` folder missing → `ok([])`
- `listInstances` type-not-found propagation
- Non-.md files skipped + logged

**Store** — `tests/ui/stores/make-store.test.ts`:
- Each action's state transitions (loading → success/error)
- `refreshAll` cache-wipe behavior
- Service-not-ready handling
- All three getters

**Pages** — one test file per page under `tests/ui/pages/make/`, using PageObjects co-located at `src/ui/pages/make/<Page>.po.ts`. Asserts happen via `data-testid`:
- Happy path with seeded store
- Loading, empty, error states
- MakeType tab switching (hash-driven)

**Route guard** — `tests/ui/router/make-routes.test.ts`: unknown `:typeId` redirects to `/make/types`.

**View wrapper** — `tests/infrastructure/obsidian/views/make-view.test.ts`: `onOpen` mount + navigate + idempotence + `onClose` unmount.

**Stories** — `stories/pages/make/*.stories.ts` per page, covering `Default`, `Loading`, `Empty`, `Error`. `MakeType` adds `FieldsTab`, `InstancesTab`. Covered by Storybook smoke test.

## 7. Implementation sequencing — 10 tasks

TDD-ordered so each commit lands on green tests.

| # | Task |
|---|---|
| 2.1 | `VaultPort.stat()` — verify; add if absent (port + adapter + fake). |
| 2.2 | `MakeService.listInstances` real implementation + tests. |
| 2.3 | Relocate `VIEW_TYPE_MAKE` to `src/domain/views/view-types.ts`; add i18n keys. |
| 2.4 | `make-store.ts` + tests. |
| 2.5 | `make-view.ts` + registration + tests. |
| 2.6 | Router routes + stub page components + guard test. |
| 2.7 | MakeHome (component + PO + test + story). |
| 2.8 | MakeTypes (component + PO + test + story). |
| 2.9 | MakeType (component + 2 tab sub-components + PO + test + stories). |
| 2.10 | End-of-chunk verification: `npm test`, `npm run build`, `npm run storybook -- --smoke-test`, tag `make-slice-2`. |

## 8. File inventory

**Modify** (7 files):
- `src/domain/shared/vault-port.ts` + `src/infrastructure/obsidian/obsidian-vault-adapter.ts` + `tests/__fakes__/fake-ports.ts` — if `stat()` missing
- `src/modules/make/make-service.ts` + `tests/modules/make/make-service.test.ts`
- `src/modules/make/make-module.ts` (drop local `VIEW_TYPE_MAKE` export, import from domain)
- `src/modules/make/locales/en.json`
- `src/domain/views/view-types.ts` (add `VIEW_TYPE_MAKE`)
- `src/infrastructure/obsidian/views/index.ts` (register)
- `src/ui/router/index.ts`

**Create** (~21 files):
- `src/infrastructure/obsidian/views/make-view.ts` + test
- `src/ui/stores/make-store.ts` + test
- `tests/ui/router/make-routes.test.ts`
- Per page (MakeHome, MakeTypes, MakeType): `.vue` + `.po.ts` + `.test.ts` + `.stories.ts` = 12 files
- `src/ui/pages/make/MakeTypeFields.vue` + `MakeTypeInstances.vue` (tab sub-components)

## 9. Risks & open items

1. **`VaultPort.stat()` may already exist** — Task 2.1 first step is verification. If present, skip port/adapter changes and jump to test updates.
2. **N vault-list calls on MakeTypes** — for per-type instance counts. Bounded by type count (realistically <30 for a vault). If profiling shows latency, add a bulk `listInstanceCounts()` service method in a follow-up. Interface already abstracts this.
3. **Storybook store mocking** — pages depend on Pinia. Stories need `setActivePinia(createPinia())` + seed data per story. Pattern to be documented in the implementation plan per-story-file, not here.
4. **Tab hash sync edge cases** — Obsidian leaf restoration with hash state is under-tested terrain. Browser-history interaction inside a leaf needs verification; may need a specific test.

## 10. Success criteria

Chunk 2 is done when:
- All 10 tasks committed; tag `make-slice-2` placed.
- `npm test` passes with zero new lint errors on Make files (pre-existing complexity warnings from Chunk 1 may remain).
- `npm run build` produces `dist/main.js`.
- `npm run storybook -- --smoke-test` exits clean.
- Manual smoke test: open the Make view in Obsidian, verify MakeHome renders, navigate to MakeTypes, click a type, switch between Fields and Instances tabs, click refresh, verify empty states when no types exist.
- Service's write methods remain `not-implemented` stubs (unchanged from Chunk 1).
- No new `any`, `@ts-ignore`, `TODO`, or `FIXME` introduced.
