# MakeHome KPIs + command-palette entries — design

**Status:** Draft
**Date:** 2026-04-19
**Chunk:** Make Chunk 5 (first slice) — A1 + A3 from `2026-04-19-make-chunk-5-backlog.md`
**Module:** `make`

## Motivation

`MakeHome.vue` is the landing page of the Make module. Today it shows: a title, a blurb, two CTAs (Browse / Create), and a favorites chip strip. That's enough for a first-time visitor but gives users who actually use Make nothing to come back to — no sense of "what am I building", no shortcut to recent work.

Chunks 1–4 built the full CRUD surface (types, instances, cascade, folder-move). Polish P0/P1 fixed the rough edges. This slice — the first of Chunk 5 — finally makes MakeHome feel like a dashboard and surfaces the two most obvious entry points into Make via Obsidian's command palette.

The work is deliberately scoped to land in a single coherent slice: one UI page rewrite, one service method implementation, two command-palette additions. No new ports, no new events, no domain changes.

## Decisions (locked in during brainstorming)

| # | Decision | Rationale |
|---|---|---|
| 1 | **Dashboard scale:** full restructure (Q1 option B — "standard dashboard") | Adding KPIs on top of the current layout (option A) would make MakeHome a busy mix of numeric summary + CTAs + favorites. Restructuring into a clear top-to-bottom hierarchy (KPIs → recent activity → favorites) gives the page a distinct identity separate from `/make/types`. Full per-type card grid (option C) was rejected because it duplicates `/make/types`. |
| 2 | **Recently-created list:** top N across all types, N = 10 (Q2 option A) | Simplest query against existing data, and the "one type dominates" concern is self-correcting — if a user only uses one type, seeing its activity is useful, not a bug. Per-type interleaving (B), time-windowed (C), and hybrid (D) can be added later without breaking the data shape. |
| 3 | **Row shape:** title + type-name chip + relative date + click opens in Obsidian | Reuses `store.openInstance(path, 'tab')` — no new behavior. Relative date (`2h ago`, `3d ago`) via a small inline formatter; no new dependency. |
| 4 | **Command palette:** two new commands — `Make: create new type` and `Make: browse types` (Q3 option A) | Both are simple route navigations. No fuzzy type picker (option B) — that would require a new `WorkspacePort.pickFromList` port and bridge for one command, disproportionate for this slice. Per-type commands (option C) have discoverability appeal but command-registration churn on every type CRUD event is a footgun. |
| 5 | **Ribbon:** unchanged, one icon (Q5 option A) | Obsidian ribbon convention is 0–1 icons per plugin. Users wanting fast "create type" have the command palette. Configurable toggle (option C) adds settings surface for marginal benefit. |
| 6 | **Empty state (types = 0):** unchanged (Q4 scenario 1) | Current empty-state block (blurb + single CTA) works. KPIs + recent-list simply don't render in this branch. |
| 7 | **Empty state (types ≥ 1, instances = 0):** placeholder text, no CTA (Q4 scenario 2 option B) | Placeholder reads "No instances yet. Open a type to create your first one." The page-level "type list" CTA is already visible in the header; no need for a second deep-link that pushes users into another page's implicit UI state. |
| 8 | **KPI freshness model:** event-driven recompute | The Make module emits a comprehensive set of `make:*` events on every mutation. Re-running `getKpis()` on `type-created`, `type-deleted`, `instance-created`, `instance-deleted`, `instances-deleted-batch`, `instances-moved` eliminates stale-UI risk, reuses the store's existing `safeRefresh` wrapper, and avoids an extra caching abstraction (TTL). The tradeoff is extra work on bursty event sequences — acceptable here because `getKpis` is O(types × avg-instances) and bulk operations already emit one batch event, not N. |

## Architecture

```
MakeHome.vue (UI)
   ├─ header row: title + CTAs (Browse / Create)
   ├─ KPI row: 3× KpiCard (Types, Instances, This week)
   ├─ Recently created: ≤10× RecentInstanceRow (title · type · rel-date)
   └─ Favorites strip (existing, unchanged)
        ↓ reads
make-store.ts
   ├─ kpis:        shallowRef<KpiSnapshot | null>
   ├─ kpisLoading: Ref<boolean>
   ├─ loadKpis() action   (calls service.getKpis, sets kpis + loading)
   └─ event subscriptions: type-created, type-deleted,
                           instance-created, instance-deleted,
                           instances-deleted-batch, instances-moved
        → each triggers safeRefresh('kpis', () => loadKpis())
              ↓
make-service-maintenance.ts
   └─ getKpis(): Promise<KpiSnapshot>
         walks listTypes() → listInstances(typeId) per type
         reduces into { typesCount, instancesCount,
                        createdThisWeek, perType, recentlyCreated }

make-module.ts (commands)
   ├─ open-make           (existing)
   ├─ make-create-type    (new — navigates to /make/types/new)
   └─ make-browse-types   (new — navigates to /make/types)
```

### Data contracts (all existing; no changes)

- **`KpiSnapshot`** (`src/domain/make/types.ts`): already defined — `{ typesCount, instancesCount, createdThisWeek, perType: Record<TypeId, number>, recentlyCreated: readonly InstanceRef[] }`.
- **`MakeService.getKpis()`**: already declared in `src/modules/make/make-service.ts:29`. Currently stubbed to return zeros in `make-service-maintenance.ts:65`. This slice implements it for real.
- **`InstanceRef`**: existing. Rows consume `{ typeId, path, title, createdAt, updatedAt }`.

### Service implementation sketch

```ts
// make-service-maintenance.ts
async function getKpis(): Promise<KpiSnapshot> {
    const typesResult = await peers.listTypes();
    if (typesResult.kind === 'err') {
        return { typesCount: 0, instancesCount: 0, createdThisWeek: 0, perType: {}, recentlyCreated: [] };
    }
    const types = typesResult.value.types;
    const perType: Record<string, number> = {};
    const all: InstanceRef[] = [];
    for (const type of types) {
        const list = await peers.listInstances(type.id);
        const refs = list.kind === 'ok' ? list.value : [];
        perType[type.id] = refs.length;
        all.push(...refs);
    }
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const weekCutoff = Date.now() - sevenDaysMs;
    const createdThisWeek = all.filter((r) => Date.parse(r.createdAt) >= weekCutoff).length;
    const recentlyCreated = [...all]
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10);
    return {
        typesCount:     types.length,
        instancesCount: all.length,
        createdThisWeek,
        perType,
        recentlyCreated,
    };
}
```

**`MaintenanceOpsPeers`** already exposes `loadType`; add `listTypes` and `listInstances` as new peer methods (mirroring the pattern already used by `TypeOpsPeers` and `InstanceOpsPeers`). No new public surface.

### UI components

Three new files:

- **`src/ui/components/make/KpiCard.vue`** — reusable tile. Props: `{ label: string; value: number; testid?: string; loading?: boolean }`. Renders a themed card with a large numeric value over a muted label. Loading state shows a skeleton (e.g., `—`) so the page height doesn't jump.
- **`src/ui/components/make/RecentInstancesList.vue`** — the list block. Props: `{ instances: readonly InstanceRef[]; loading: boolean; emptyPlaceholder: string }`. Renders a heading + list; each row is keyboard-focusable and has `data-testid="recent-instance-row-${path}"`. Row click + Enter key both invoke an emitted `open` event with the path.
- **`stories/pages/make/MakeHome.stories.ts`** — storybook states: `Empty`, `TypesOnly`, `Populated`, `Loading`.

Modified: `MakeHome.vue` (restructure), `make-store.ts` (kpis state + action + subscriptions), `make-service-maintenance.ts` (real getKpis), `make-module.ts` (2 new commands), `src/modules/make/locales/en.json` (new KPI labels + empty-state strings + command names).

### Relative-date formatter

Small inline helper (no dependency). Accepts ISO-8601, returns `just now` / `Nm ago` / `Nh ago` / `Nd ago` / `Nw ago` / falls back to locale date string for >4 weeks. Lives in `src/ui/pages/make/format-relative-date.ts` (or similar colocation). Pure function, fully unit-testable with `vi.setSystemTime`.

### Command navigation

The existing `open-make` command uses `opensView: VIEW_TYPE_MAKE` declaratively (see `make-module.ts:85`). The new commands need to open the view AND navigate. Investigation during plan-writing will determine whether:

- (a) The command system already supports post-open callbacks that can call `router.push('/make/types/new')`, or
- (b) We need a route-post-open pattern (e.g., set a pending-route on the module state, consumed by `AppRoot.vue` on view open), or
- (c) Hash-manipulation (`location.hash = '#/make/types/new'`) works with the existing hash-history router.

This is the one known unknown. The plan will open with a small exploratory step that determines the pattern, then the remaining steps proceed deterministically.

> **Resolved (as shipped, 2026-04-19):** a **fourth** approach was chosen,
> simpler than (a)–(c): a module-scope navigation handler
> (`setMakeNavigateHandler` / `clearMakeNavigateHandler`) exported from
> `make-module.ts`. `src/ui/app.ts:createVueApp` registers a handler
> `(path) => void router.push(path)` after a successful `vue.mount`, and
> clears it on unmount. The two new commands carry BOTH `opensView:
> VIEW_TYPE_MAKE` AND a `callback: () => navigate(...)`; to make that
> pair work, `ObsidianCommandAdapter.register()` was changed to **chain**
> opensView and callback (previously opensView replaced callback). View
> opens first, then callback pushes the route. Post-ship polish also
> wraps each step in try/catch + logger so a failed openView no longer
> silently drops the navigation. See the plan's "As shipped" section
> and the `Chunk 5 Polish` row in `project_make_status.md` memory.

## Out of scope

- **`MakeSettings.vue`** (A2) — deferred to Chunk 5.5. Settings UI is a full component + path-picker UX and deserves its own slice.
- **Locale audit / second locale** (A4) — deferred to Chunk 5.5.
- **Per-type card grid** — rejected during brainstorming (Q1 option C). `/make/types` already serves this need.
- **Fuzzy type picker in command palette** (A3 option B) — deferred. Needs new `WorkspacePort` port method; not worth that cost for one command.
- **Second ribbon icon** (Q5 option B/C) — rejected for convention reasons.
- **KPI TTL cache** — rejected. Event-driven recompute is simpler and comprehensive.
- **Schema migration** (B in backlog) — separate chunk (Chunk 6 candidate).
- **Chunk 3.5 §12 outbox remnants** (C1–C11 in backlog) — independent shipments.

## Testing strategy

### Service layer
- `tests/modules/make/make-service-maintenance.test.ts` (new or extended)
  - `getKpis` with empty vault → all zeros
  - `getKpis` with one type, zero instances → `typesCount: 1`, rest zero
  - `getKpis` with N types + M instances → correct counts + `perType` map
  - `getKpis` `createdThisWeek` boundary: instance at exactly 7d-1ms ago is counted; 7d+1ms ago is not
  - `getKpis` `recentlyCreated` sorted descending by `createdAt`, capped at 10
  - `getKpis` handles per-type `listInstances` errors by treating that type as 0 instances (graceful degradation, not total failure)

### Store layer
- `tests/ui/stores/make-store.test.ts` — new describe block `make-store — kpis`:
  - `loadKpis` populates `store.kpis`, toggles `kpisLoading`
  - Each of the 6 subscribed events triggers a `loadKpis` call (one test per event)
  - Concurrent event bursts do NOT corrupt `store.kpis`: if 3 events fire during an in-flight `loadKpis`, the snapshot ultimately reflects a fully-settled recompute (no partial/interleaved state). Note: `safeRefresh` wraps `.catch()` — it does NOT coalesce or debounce; under a burst the service is called once per event. Test asserts this honestly rather than claiming coalescing we don't have.
  - `loadKpis` never throws — service rejection logged through `ctx.logger.warn` via `safeRefresh`
  - Per-type `listInstances` errors inside `getKpis` DO NOT propagate as a store-level error: the snapshot still loads, the problem type counts as 0 instances (service-layer graceful degradation)

### UI layer
- `tests/ui/pages/make/MakeHome.test.ts` — replace existing tests with new layout assertions:
  - Scenario 1 (0 types): existing empty-state renders; KPI row + recent list do NOT render
  - Scenario 2 (≥1 type, 0 instances): KPI row renders with zeros; recent list renders with placeholder text; favorites renders if populated
  - Scenario 3 (populated): KPI row shows correct numbers; recent list shows up to 10 rows with title + type chip + relative date
  - Row click emits open — verify `store.openInstance` spy called with correct path
  - Header row CTAs present; empty-state CTA only appears in scenario 1
- New: `tests/ui/pages/make/format-relative-date.test.ts` — unit test the formatter with `vi.setSystemTime` for each bucket boundary.

### Storybook
- `stories/pages/make/MakeHome.stories.ts` — 4 stories: Empty, TypesOnly (zero instances), Populated (realistic numbers), Loading. Uses the same `mountWithI18n`-style test-context setup the existing Make stories use.

### Commands
- `tests/modules/make/make-module.test.ts` — assert the two new commands are declared. Hard to test navigation in isolation (depends on the routing solution chosen during plan-writing); at minimum assert `commands[]` contains entries with the expected `id` + `name`.

### Coverage targets
- New code paths fully covered except the router-navigation bridge (tests may be thin there depending on what path the plan takes).
- Rough net test count: +20–25 across service/store/UI/util/storybook layers.

## Tech-stack alignment

- TypeScript, ES2022, NodeNext, strict. Tabs, kebab-case, `.js` imports.
- No `any`, no `@ts-ignore`, no `TODO`/`FIXME`.
- No new runtime dependencies.
- ESLint: respects `no-restricted-syntax` ban on `try/catch` in modules (use `.catch()` chains); KpiCard stays under the 350-line limit trivially.
- Follows the existing `MakeContext` per-module injection pattern — no reach-ins.

## Commit convention

Matches recent Polish work: `<type>(agentonomous): <subject> (Chunk 5 #N)` or `(Make Chunk 5 ...)`. Specific numbering decided at plan-writing time.

## Open questions deferred to plan-writing

1. **Command → route navigation mechanism.** One of (a) direct router access in command callback, (b) pending-route state on module, (c) hash manipulation. Plan opens with a small spike.
2. **Subscription management for KPI refresh.** Whether to register all 6 event handlers separately or loop over a list. Style question; plan can decide.
3. **Sub-linearity of `getKpis`.** Current sketch is O(types × avg-instances-per-type). For realistic vaults this is fine. If profiling shows it's slow on large vaults, a later optimization can cache per-type counts derived from existing store state rather than re-listing. Out of scope for this slice.

## Size estimate

- 3 new files (KpiCard, RecentInstancesList, format-relative-date + its test)
- 1 new storybook file
- 5 modified files (MakeHome, make-store, make-service-maintenance, make-module, en.json)
- ~20–25 new tests
- Estimated 1 plan document of 4–6 chunks
