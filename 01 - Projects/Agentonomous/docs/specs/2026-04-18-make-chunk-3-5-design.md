# Make — Chunk 3.5: Hardening (bugs + architectural refactor)

**Date**: 2026-04-18
**Status**: 📝 Design approved, plan pending
**Supersedes**: §12 outbox items 1–11 of `docs/specs/2026-04-18-make-chunk-3-design.md` — subset redirected here (Groups A + B from the post-Chunk-3 review).
**Depends on**: Chunk 3 shipped (tag `make-slice-3` at `ba9ae360`, merged to master).
**Plan**: `docs/plans/2026-04-18-make-chunk-3-5.md` (to be written after this spec is approved).
**Test outcome target**: 740 baseline → ~780 passing (+~40 tests), 0 lint errors, typecheck clean, all existing Chunk 3 behavior preserved.

## Context

Chunk 3 shipped the type-authoring surface: service write methods, editable Fields tab, DeleteTypeDialog, base-file banner, favorite star, `/make/types/new` route, full i18n wiring, and a11y pass. 740 tests pass; no architectural regressions.

A post-Chunk-3 review (2026-04-18) catalogued flaws across four severities. Sev 1 flaws are genuine bugs in shipped code. Sev 2 flaws are architectural drift already flagged as tech debt in Chunk 3 §7 and §12. Chunks 4 and 5 will expand the UI→module coupling surface; leaving the drift unpaid makes that expansion harder.

Chunk 3.5 ships a **focused prerequisite** for Chunk 4: the three Sev 1 bug fixes plus the PluginContext-based refactor of module-state reach-in (Chunk 3 §12 item #6 plus two adjacent cleanups). Out of scope: safety nets (relative `baseFile.path`, optimistic concurrency, save-time notices, external-edit recovery, favorite multi-session sync, VaultPort JSDoc) — those remain in the Chunk 3 §12 outbox for a second hardening pass after Chunk 4.

Chunk 3.5 is deliberately small (~14 h, 10 commits). Every commit is green at its boundary; any prefix of the chunk ships meaningful value on its own.

## Decisions captured (4 clarifying Qs)

| Ref | Decision |
|---|---|
| Q1 | **Scope**: Groups A + B only. Groups C–E (safety nets, cross-leaf recovery, contract formalisation) deferred to a post-Chunk-4 hardening pass. Rationale: Chunk 4's instance CRUD will double the UI→module coupling surface; the PluginContext refactor (B1) is a force multiplier that must land first. |
| Q2 | **Refactor shape**: per-module `MakeContextKey: InjectionKey<MakeContext>` provided alongside the existing `PluginContextKey`. Rejected alternatives: (a) extending `PluginContext` with a `modules` namespace (core types bloat per module; circular-import risk); (c) Pinia plugin exposing `store.$ctx` (store/composable access asymmetry; harder test mocking). |
| Q3 | **Reactive settings**: module owns `settings$: Ref<MakeSettings>`; `onSettingsChange` is the sole mutator. Service closure reads `settings$.value`. UI binds reactively. No module-level re-emit event; Vue reactivity handles propagation. |
| Q4 | **Ordering + migration tactic**: (α) bug fixes first, then refactor + (ii) phased migration with shims. Each commit stays green. Rejected: (β) refactor first (would delay user-visible fixes); (γ) interleave (review load concentrates badly); (i) big-bang (unreviewable commit); (iii) parallel-run forever (defeats the purpose). |

## 1. Scope & Deviations

**In scope (Chunk 3.5 = Bugs + Refactor):**
- **A1** — `DeleteTypeDialog` reads `typesFolder` from settings (currently hardcoded `Make/Types/`).
- **A2** — `MakeModule.onSettingsChange` serialises destroy/init and surfaces init failure to `moduleStatus` (currently fire-and-forget with silent failure path).
- **A3** — `MakeService.listTypes` distinguishes folder-not-found (→ `ok([])`) from other vault errors (→ `err({ kind: 'vault-error' })`) instead of collapsing all failures to empty.
- **B1** — Introduce `MakeContextKey` + `MakeContext` (service, reactive `settings$`, `subscribe`). Phased migration: shim phase → per-consumer migration → legacy deletion. Replaces `getMakeService` / `getMakeSettings` / `subscribeMakeEvents` module-state reach-in. Store's `onFavoriteToggled` reactivity nudge (`types.value = [...types.value]`) deleted.
- **B2** — Extract `useFocusTrap` composable; consolidate `ConfirmDialog.vue` + `DeleteTypeDialog.vue` focus-trap implementations (currently divergent on `nextTick` vs `Promise.resolve()`).
- **B3** — Extract `validateSchema(next)` helper in `make-service.ts`; `createType` and `updateType` collapse their duplicated validation loops.

**Out of scope (deferred explicitly):**
- Chunk 3 §12 outbox items 1–5, 7–11 → post-Chunk-4 hardening pass.
- Instance CRUD, `instancesFolder` file-move, "Open in Obsidian", corrupt type file UI, cascade delete → Chunk 4.
- KPIs, recently-created list, `MakeSettings.vue`, `make-create-type` command → Chunk 5.
- Any change to `MakeService` interface shape (except service reading `settings$.value` internally — not an external change).

**Relationship to Chunk 3 §12 outbox:**
- §12.6 (`PluginContext`-based refactor) — **included** as B1.
- §12.11 (favorite multi-session sync) — **partially included**: the jank disappears because `settings$` is reactive, but explicit `SettingsPort.subscribe` cross-session listening remains deferred.
- §12.1–5, 7–10 — **remain deferred**.

**Relationship to Chunk 3 architectural tech-debt note (§7)**: Chunk 3.5 pays off the note verbatim. `MakeContext` is the design the note described.

## 2. Bug fixes (Group A)

### A1 — `DeleteTypeDialog` reads `typesFolder` from settings

**File**: `src/ui/components/make/DeleteTypeDialog.vue:45`.

**Current**:
```ts
const typeFilePath = computed(() => `Make/Types/${props.type.id}.json`);
```

**Target (pre-B1 state)**: add a `typesFolder: string` prop. `MakeType.vue` reads from `getMakeSettings()?.typesFolder ?? 'Make/Types'` and passes it down.

**Target (post-B1 state)**: prop still exists for isolation; `MakeType.vue` reads via a small helper `useMakeContext()` that throws on null (avoids the `!` non-null assertion, consistent with "no `@ts-ignore`" rule in CLAUDE.md):
```ts
// src/ui/composables/use-make-context.ts
export function useMakeContext(): MakeContext {
  const ctx = inject(MakeContextKey);
  if (ctx === undefined) throw new Error('MakeContextKey not provided — mount inside a Vue app that called provide(MakeContextKey, ...)');
  return ctx;
}
```
Then: `const typesFolder = useMakeContext().settings$.value.typesFolder;`. (Alternative: the dialog injects directly — rejected because it complicates Storybook stories. Prop-drilling is the right boundary here.)

**Behavior**: when `typesFolder = 'Custom/Schemas'`, the delete dialog displays `Custom/Schemas/my-type.json` instead of `Make/Types/my-type.json`.

**Tests**: extend `tests/ui/components/make/DeleteTypeDialog.test.ts` with one new case asserting the displayed path for a custom folder.

**Estimate**: 30 min.

### A2 — Serialise `onSettingsChange` destroy/init + surface init failure

**File**: `src/modules/make/make-module.ts:77-94`.

**Current**:
```ts
onSettingsChange(next) {
  // ...
  if (folderChanged) {
    void this.destroy();         // fire-and-forget
    void this.init(ports, next); // fire-and-forget
  } else {
    state.settings = next;
  }
}
```

Two failure modes: (a) an `init` rejection is silently dropped; (b) a service call during the microtask gap throws `Error('make-service called after destroy')` uncaught.

**Target**:
```ts
async onSettingsChange(next) {
  if (state === null) return;
  const ports = state.ports;
  const prev = state.settings$.value;
  const folderChanged = prev.typesFolder !== next.typesFolder
    || prev.basesFolder !== next.basesFolder
    || prev.defaultInstancesRoot !== next.defaultInstancesRoot;
  if (folderChanged) {
    await this.destroy();
    try {
      await this.init(ports, next);
    } catch (err) {
      ports.logger.error('make', `re-init after folder change failed: ${String(err)}`);
      throw err; // re-throw so PluginCore marks module degraded
    }
  } else {
    state.settings$.value = next;
  }
}
```

**PluginCore integration (verified during spec writing, `src/core/plugin-core.ts:289-306`)**:

Current `dispatchSettingsChanges` is:
```ts
try { m.onSettingsChange(settings); }          // sync try/catch
catch (error) { logger.error('core', ...); }   // logs but does NOT mark degraded
```
Two problems for the A2 target: (1) making `onSettingsChange` async makes the current sync try/catch useless — promise rejections escape as unhandled. (2) Errors only log; modules are never marked degraded for settings-change failures. `degradedModuleIds` is populated at init time only.

**A2 scope therefore includes a PluginCore change** (not deferred to B1.1). Specifically:
1. In `plugin-core.ts:289`, `dispatchSettingsChanges` becomes `async` — the for-loop `await`s each `onSettingsChange` call inside the try/catch, so both sync and async rejections funnel through the same handler.
2. On catch, the module is added to `degradedModuleIds` and a follow-up `core` event fires (`{ phase: 'settings-change-failure', moduleId, reason }`). Reuses the existing degraded-module plumbing.
3. `subscribe` callers (the `settings.subscribe((raw) => {...})` at `plugin-core.ts:115`) are already void-returning; the sync callback schedules an async dispatch — existing promise-chain hygiene suffices (add a `.catch(logger.error)` at the subscribe-callback boundary for safety).

This expands A2 by ~30 min but keeps the scope change contained to one file + one test. Alternative (keep logging only, don't mark degraded) was rejected because Success Criterion #6 specifically requires user-visible degraded status.

**Tests** (extend `tests/modules/make/make-module.test.ts`):
1. Folder rename succeeds → new service callable with new folder.
2. Folder rename's `init` rejects → module marked degraded; `getMakeContext()` returns `null`; no stale service reference remains.
3. Non-folder settings change (favorites flip) → service stays identical (identity-equal), `settings$.value.favorites` reflects the update.
4. A failing `m.onSettingsChange` (mocked to reject) results in the module appearing in `degradedModuleIds` and a `core` event with `phase: 'settings-change-failure'` firing.

**Estimate**: 2.5 h (includes PluginCore change + test for success criterion #6).

### A3 — Distinguish `not-found` from `vault-error` in `listTypes`

**File**: `src/modules/make/make-service.ts:31-54`.

**Current**: any `list` error collapses to `ok([])`.

**Target**:
```ts
async function listTypes(): Promise<Result<readonly TypeSchema[], MakeError>> {
  const settings = settings$.value;
  const folderExists = await ports.vault.exists(settings.typesFolder);
  if (!folderExists) return ok([]);
  const listResult = await ports.vault.list(settings.typesFolder);
  if (listResult.kind === 'err') return err({ kind: 'vault-error', cause: String(listResult.error) });
  // ... existing filtering + parsing
}
```

**Probe during spec writing**: verify `ports.vault.exists` is cheap (no `read` side effects); confirm `list` distinguishes transient vs missing errors, or use the exists-probe pattern above (which is the fallback path).

**Tests** (extend `tests/modules/make/make-service.test.ts`):
1. Folder absent → `ok([])`.
2. Folder exists, `list` errs → `err({ kind: 'vault-error', cause: ... })`.
3. Folder exists, `list` returns files, some fail to `read` → existing behavior (skip unreadable), still returns `ok(readableSchemas)`.

**UI impact**: none for cases 1 and 3. For case 2, the existing `typesError` banner on `MakeTypes.vue` lights up via the existing store path.

**Estimate**: 2 h (includes VaultPort probe).

## 3. Refactor (Group B)

### B1 — `MakeContext` + reactive `settings$` (3 sub-commits)

#### B1.1 — Shim phase (introduce without breaking)

**New file**: `src/modules/make/make-context.ts`.

```ts
import type { Ref } from 'vue';
import type { MakeService } from './make-service.js';
import type { MakeSettings } from './make-settings.js';
import type { MakeEventHandlers } from './make-module.js';

export type MakeContext = {
  readonly service:   MakeService;
  readonly settings$: Readonly<Ref<MakeSettings>>;
  readonly subscribe: (handlers: MakeEventHandlers) => () => void;
};
```

`Readonly<Ref<T>>` prevents `.value =` reassignment at the type layer — which is exactly the invariant we need ("writes flow through `onSettingsChange`"). The underlying `MakeSettings` fields are already all `readonly` in `make-settings.ts`, so mutations through `.value.favorites.push(...)` are already blocked structurally. `DeepReadonly<Ref<T>>` (Vue's deeper type) was considered but rejected: its conditional-type expansion surfaces awkwardly at call sites (e.g., `.value.favorites` infers as `DeepReadonly<readonly string[]>` which trips downstream inference). Current shape is simpler with equivalent runtime semantics given `MakeSettings` is already deep-readonly at the type level.

**New file**: `src/ui/make-context-key.ts`.

```ts
import type { InjectionKey } from 'vue';
import type { MakeContext } from '../modules/make/make-context.js';
export const MakeContextKey: InjectionKey<MakeContext> = Symbol('MakeContext');
```

**Changes to `src/modules/make/make-module.ts`**:

1. Add `import { ref, readonly, type Ref } from 'vue'`.
2. `ModuleState.settings: MakeSettings` → `ModuleState.settings$: Ref<MakeSettings>`.
3. `init()`:
   ```ts
   const settings$ = ref(settings);
   const service = createMakeService(ports, () => {
     if (state === null) throw new Error('make-service called after destroy');
     return state.settings$.value;
   });
   state = { ports, service, settings$ };
   ```
4. `onSettingsChange` (see A2) — folder-unchanged path becomes `state.settings$.value = next`.
5. Add:
   ```ts
   export function getMakeContext(): MakeContext | null {
     if (state === null) return null;
     return {
       service: state.service,
       settings$: readonly(state.settings$),
       subscribe: subscribeMakeEvents,
     };
   }
   ```
6. **Rewrite the bodies** of `getMakeService`, `getMakeSettings`, `subscribeMakeEvents` — their exported signatures stay stable (zero LOC change at call sites), but the bodies must change because `state.settings` is now `state.settings$: Ref<MakeSettings>`.
   - `getMakeService()` → unchanged (still returns `state?.service ?? null`).
   - `getMakeSettings()` → `return state?.settings$.value ?? null;` (reads `.value` off the ref).
   - `subscribeMakeEvents(handlers)` → keep its current implementation that iterates handlers and wires `bus.on(...)`. It is a real function, not a getter; the phrase "thin delegation" in earlier drafts was imprecise. The shim reality: bodies evolve to drive off `state.settings$`, signatures do not. This is what keeps call sites zero-change in B1.1 so B1.2 can migrate them one at a time.

**Vue wiring**: `src/ui/app.ts` already does `vue.provide(PluginContextKey, ctx)`. After module init settles, add:
```ts
const makeCtx = MakeModule.getMakeContext();
if (makeCtx !== null) vue.provide(MakeContextKey, makeCtx);
```

**Test fixture**: new `tests/__fixtures__/fake-make-context.ts`:
```ts
export function createFakeMakeContext(overrides?: Partial<MakeContext>): MakeContext {
  const settings$ = ref({ ...MAKE_DEFAULTS });
  return {
    service: fakeMakeService(),
    settings$: readonly(settings$),
    subscribe: () => () => {},
    ...overrides,
  };
}
```

**Test fixture extension (verified — does NOT accept today)**: `tests/__fixtures__/mount-with-i18n.ts` currently hardcodes `plugins = [i18n, options.router]` with no way to pass additional plugins or provides. B1.1 extends the options shape to accept:
```ts
options: {
  router?: Router;
  props?: Record<string, unknown>;
  attachTo?: Element;
  provide?: ReadonlyArray<readonly [symbol | string, unknown]>; // forwarded to global.provide
  plugins?: ReadonlyArray<unknown>;                               // appended after i18n + router
}
```
~10 LOC net. Every Chunk 3.5 consumer-migration test uses the new options; no breaking change to existing callers (all new keys optional).

**Tests for B1.1**: all 740 existing tests continue to pass unchanged. One new test confirms `getMakeContext()` returns a readonly `settings$` (attempting to mutate is a TS error — verified via a type-level test or a try/catch in dev mode).

**Estimate**: 3 h.

#### B1.2 — Migrate consumers (4 sub-commits)

Four consumers today reach into module state:
1. `src/ui/stores/make-store.ts` (7 call sites)
2. `src/ui/pages/make/use-make-type-draft.ts` (1 call site — `getMakeSettings()?.defaultInstancesRoot`)
3. `src/ui/pages/make/use-make-type-save-flow.ts` (0 today — but inherits `ctx` from caller)
4. (any additional site found by grep during migration)

Per-consumer commit pattern:
- Swap `import { getMakeService, getMakeSettings, subscribeMakeEvents } from '.../make-module.js'` → `import { MakeContextKey } from '../make-context-key.js'`.
- Inside the setup factory: `const ctx = inject(MakeContextKey); if (!ctx) throw new Error(...)`.
- Call sites: `ctx.service.xxx()`, `ctx.settings$.value.xxx`, `ctx.subscribe(...)`.
- Tests: delete the `vi.mock('.../make-module.js', ...)` block; install `createFakeMakeContext()` via `mountWithI18n`'s new `provide` option.

**`make-store.ts` specifics** (commit B1.2a):
- `useMakeStore` uses `inject(MakeContextKey)` inside the factory via the shared `useMakeContext()` helper (see A1 post-B1 section). Pinia allows `inject()` inside `defineStore` setup only when the store is instantiated within an active Vue app's setup context. **Invariant**: `useMakeStore()` must never be called at module top-level or from non-Vue consumers. Documented with a one-line comment at the top of `make-store.ts`; no runtime enforcement needed (Pinia's error message is clear enough).
- The `onFavoriteToggled` handler's `types.value = [...types.value]` nudge is deleted. `favoriteTypes` and `isFavoritedForUI` read `ctx.settings$.value.favorites` directly; Vue tracks the ref.
- `optimisticFavoriteOverrides` stays as-is for the in-flight flicker window.

**Store test refactor** (commit B1.2a, same commit):
- Test pattern: mount a minimal `<div>` setup component that calls `useMakeStore()` with `MakeContextKey` provided. Documented in a new test helper if the pattern repeats.
- Delete all `vi.mock('.../modules/make/make-module.js', ...)` in `make-store.test.ts`.

**Estimates**: B1.2a (store) 1 h; B1.2b (draft composable) 30 min; B1.2c (save-flow composable) 30 min; B1.2d (grep-confirmed residual) 0–30 min.

#### B1.3 — Delete legacy exports

**File**: `src/modules/make/make-module.ts`.

Delete `getMakeService`, `getMakeSettings`, `subscribeMakeEvents` exports. ESLint's `no-unused-exports` rule (if enabled) or a manual grep confirms no orphan references. The `MakeEventHandlers` type stays (referenced by `MakeContext`).

**Tests**: `grep -r 'getMakeService\|getMakeSettings\|subscribeMakeEvents' src/ tests/` returns 0 hits.

**Estimate**: 1 h (includes final test fixture cleanups).

### B2 — Extract `useFocusTrap` composable

**New file**: `src/ui/composables/use-focus-trap.ts`.

```ts
export function useFocusTrap(
  dialogRef: Ref<HTMLElement | null>,
  isOpen: Ref<boolean>,
  options?: { onEscape?: () => void; initialFocus?: 'first' | 'last' },
): void;
```

**Behavior**:
- On `isOpen → true`: remember `document.activeElement`, wait `nextTick()`, focus first or last focusable element per `options.initialFocus` (default `'last'` — matches `ConfirmDialog` Cancel-convention).
- On `isOpen → false`: restore focus to the remembered element.
- While open: Tab/Shift+Tab wrap within the dialog's focusable set.
- Escape key: `options.onEscape?.()`.

**Migration**:
- `ConfirmDialog.vue`: delete the inline `onKeyDown` + watch + focus-after-open logic; replace with `useFocusTrap(dialogRef, openRef, { onEscape: () => resolve(cancelChoice) })`. Component drops ~35 lines.
- `DeleteTypeDialog.vue`: same. Picks `initialFocus: 'first'` to preserve current cancel-button-focused behavior.

**Tests** (new `tests/ui/composables/use-focus-trap.test.ts`):
- Mount a fixture component with three focusable elements.
- Toggle `isOpen`, assert initial focus lands on first/last per option.
- Send Tab at last element → focus wraps to first. Shift+Tab at first → wraps to last.
- Send Escape → callback fires.
- Toggle `isOpen → false` → focus returns to element that had focus before open.

Existing dialog tests stay green (behavior unchanged).

**Estimate**: 2 h.

### B3 — Extract `validateSchema` helper

**File**: `src/modules/make/make-service.ts`.

**Current**: `createType` uses a `validateDraft(draft)` helper (fields + type name + folder). `updateType` duplicates the pattern inline (lines 242–249) on the merged `next: TypeSchema`.

**Target**: rename `validateDraft` → `validateSchema` accepting `TypeSchema | NewTypeDraft`. Both call sites collapse to one line.

```ts
function validateSchema(schema: { name: string; instancesFolder: string; fields: readonly Field[] }): SchemaError[] {
  const errors: SchemaError[] = [];
  for (const field of schema.fields) {
    const nameResult = validateFieldName(field.name);
    if (nameResult.kind === 'err') errors.push(nameResult.error);
    errors.push(...FIELD_KINDS[field.kind].validateField(field as never));
  }
  const nameResult = validateTypeName(schema.name);
  if (nameResult.kind === 'err') errors.push(nameResult.error);
  const folderResult = validateInstancesFolder(schema.instancesFolder);
  if (folderResult.kind === 'err') errors.push(folderResult.error);
  return errors;
}
```

No behavior change. Existing service tests catch any regression.

**Estimate**: 1 h.

## 4. Testing strategy

### Fixtures

- **New**: `tests/__fixtures__/fake-make-context.ts` — `createFakeMakeContext(overrides?): MakeContext` using `ref()` + `readonly()` + a stub event bus.
- **Extended**: `tests/__fixtures__/mount-with-i18n.ts` — accepts `provide` option forwarded to Vue Test Utils' `global.provide`.
- **Reused**: `tests/__fakes__/fake-make-service.ts` (unchanged surface — still matches `MakeService`).
- **Deleted pattern**: `vi.mock('.../modules/make/make-module.js', () => ({ getMakeService, getMakeSettings, subscribeMakeEvents }))` — gone from 5+ test files after B1.3.

### Store test pattern post-B1

```ts
import { mountWithI18n } from '../__fixtures__/mount-with-i18n.js';
import { createFakeMakeContext } from '../__fixtures__/fake-make-context.js';

it('deletes a type and clears instances cache', async () => {
  const ctx = createFakeMakeContext({ /* service overrides */ });
  let store: ReturnType<typeof useMakeStore>;
  mountWithI18n(defineComponent({ setup() { store = useMakeStore(); return () => h('div'); } }), {
    provide: [[MakeContextKey, ctx]],
    plugins: [createPinia()],
  });
  // Assertions on store...
});
```

### A2 destroy/init recovery test

```ts
it('marks module degraded when re-init fails after folder change', async () => {
  const ports = fakeModulePorts();
  await MakeModule.init(ports, MAKE_DEFAULTS);
  // Cause init to fail on next call
  vi.spyOn(ports.vault, 'list').mockRejectedValueOnce(new Error('boom'));
  await expect(MakeModule.onSettingsChange({ ...MAKE_DEFAULTS, typesFolder: 'New' })).rejects.toThrow('boom');
  expect(getMakeContext()).toBeNull();
});
```

### A3 `listTypes` error test

Two new cases in `make-service.test.ts`. See §2.A3 for specifics.

### `useFocusTrap` test

New file `tests/ui/composables/use-focus-trap.test.ts`. Six cases: initial focus first; initial focus last; Tab wrap; Shift+Tab wrap; Escape callback; return focus on close.

### Coverage targets

- 740 baseline → ~780 after Chunk 3.5.
- No coverage regression in any file.

### Out of scope for tests

- `onBeforeRouteLeave` integration remains uncovered (Chunk 3 appendix §14 gap). Not worsened, not addressed.
- End-to-end manual smoke per Chunk 3 recipe.

## 5. Commit sequence

10 commits, all green at every boundary. Total ~14 h.

| # | Commit message | Group | Est. |
|---|---|---|---|
| 1 | `fix(make): read typesFolder from settings in DeleteTypeDialog` | A1 | 30 min |
| 2 | `fix(core+make): async onSettingsChange + surface failure via degradedModules` | A2 | 2.5 h |
| 3 | `fix(make): distinguish not-found from vault-error in listTypes` | A3 | 2 h |
| 4 | `refactor(make): introduce MakeContext + reactive settings$ (shimmed)` | B1.1 | 3 h |
| 5 | `refactor(make): migrate make-store to MakeContext` | B1.2a | 1 h |
| 6 | `refactor(make): migrate use-make-type-draft to MakeContext` | B1.2b | 30 min |
| 7 | `refactor(make): migrate use-make-type-save-flow to MakeContext` | B1.2c | 30 min |
| 8 | `refactor(make): delete legacy getMakeService/getMakeSettings/subscribeMakeEvents` | B1.3 | 1 h |
| 9 | `refactor(ui): extract useFocusTrap composable` | B2 | 2 h |
| 10 | `refactor(make): extract validateSchema helper` | B3 | 1 h |

**Rollback**: commits 1–3 independently revertable; commit 4 shim can live indefinitely if 5–8 pause; 9 and 10 independent of Make refactor.

## 6. Success criteria

1. `npm test` passes at every commit (740 baseline → ~780 after).
2. `npm run lint` stays at 0 errors (warning count may drop as dialog duplication consolidates).
3. `npm run typecheck` stays clean.
4. `grep -r 'getMakeService\|getMakeSettings\|subscribeMakeEvents' src/ tests/` returns 0 hits after commit 8.
5. `DeleteTypeDialog` correctly displays custom `typesFolder` in Storybook + manual smoke.
6. A folder-rename settings change with a failing `init` marks the module degraded in `moduleStatus` (visible via health-monitor).
7. `make-store.ts` `onFavoriteToggled` handler contains no `types.value = [...types.value]` reactivity nudge.
8. No test file imports `vi.mock('.../make-module.js', ...)` after commit 8.
9. Chunk 3.5 does not touch instance CRUD, corrupt-type UI, `baseFile.path` relocation, or rename-warning semantics — those remain scoped to Chunk 4 / post-Chunk-4 hardening.
10. `git log --oneline` between the pre-chunk ref and final commit reads cleanly as 10 commits matching §5's table.

## 7. Risks

| Ref | Risk | Mitigation |
|---|---|---|
| R1 | `VaultPort.list` error shape may not distinguish not-found from other errors. | A3 uses `exists` probe as fallback pattern. Probe VaultPort contract during A3 implementation; if port needs extending, fold into commit 3. |
| R2 | Pinia store `inject()` inside setup factory may fail when store is instantiated outside an active Vue app (rare but possible in direct unit tests). | Store tests mount via fixture component. Verified in B1.2a. |
| R3 | `mountWithI18n` fixture may not accept `provide` overrides today. | Extending is ≤5 LOC; tracked as part of B1.1. |
| R4 | Chunk 4 branch diverges if started before Chunk 3.5 lands. | Land Chunk 3.5 entirely on `master` before opening Chunk 4 worktree. |
| ~~R5~~ | ~~`PluginCore` may not surface `onSettingsChange` rejections to `moduleStatus`.~~ | **Resolved inline in A2** — spec-time verification confirmed the gap; PluginCore change is now part of A2's committed scope. |
| R6 | `Readonly<Ref<T>>` may surface subtle inference differences at call sites vs plain `Ref<T>`. | Fallback: plain `Ref<MakeSettings>` with convention (writes flow through `onSettingsChange` enforced by code review). Decision documented inline in B1.1 implementation notes. |

## 8. Reminders for Chunk 4 planner

- Chunk 4 picks up a clean `MakeContextKey` pattern — use `inject(MakeContextKey)` for instance CRUD UI; do not re-introduce module-state reach-in.
- `useFocusTrap` exists — reuse for any new dialogs (e.g., "Discard instance draft?" if Chunk 4 adds one).
- `validateSchema` exists — reuse for any new write-path validation.
- `listTypes` now surfaces `vault-error`; ensure new flows (instance create/delete) handle the existing typed error variants consistently.
- `MakeModule.onSettingsChange` is now async — any Chunk 4 code path that triggers settings changes (e.g., `instancesFolder` rename) must await appropriately.
- The Chunk 3 §12 outbox still has 9 items deferred to post-Chunk-4 hardening. Do not let Chunk 4 accidentally close or re-scope them without an explicit decision.

## Appendix: Post-review revisions (2026-04-18)

Applied after spec-document-reviewer feedback on the initial draft:

1. **A2 scope expanded to include PluginCore change** — verified `src/core/plugin-core.ts:289-306` uses a sync try/catch that cannot catch async rejections and never marks modules degraded for settings-change failures. A2 now explicitly covers `dispatchSettingsChanges` becoming async + degraded-marking. Estimate bumped 2 h → 2.5 h.
2. **B1.1 shim rewording** — clarified that the three legacy exports' bodies change (to drive off `state.settings$`) while their signatures stay stable. Prior "thin delegation" wording was imprecise — `subscribeMakeEvents` is a real wiring function, not a getter.
3. **Fixture extension made explicit** — verified `tests/__fixtures__/mount-with-i18n.ts` currently accepts neither `provide` nor user `plugins`. B1.1 explicitly extends the options shape with both (~10 LOC net) rather than "≤5 LOC, tracked as part of B1.1".
4. **`useMakeContext()` helper added** — avoids `inject(MakeContextKey)!` non-null assertions throughout the migration (consistent with CLAUDE.md's no-`@ts-ignore` rule).
5. **`Readonly<Ref<T>>` replaces `DeepReadonly<Ref<T>>`** — simpler, equivalent runtime semantics given `MakeSettings` fields are already `readonly`. R6 updated.
6. **`useMakeStore()` invariant documented** — Pinia's `inject()` only resolves inside component setup; a one-line ADR comment in `make-store.ts` prevents future footgun.
