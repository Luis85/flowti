# Make — Chunk 3: Type authoring

**Date**: 2026-04-18
**Status**: Approved
**Supersedes**: Chunk 3 placeholder in `docs/plans/2026-04-18-make.md` (line 2594)
**Depends on**: Chunk 2 shipped (tag `make-slice-2`), parent design `docs/specs/2026-04-18-make-design.md`

## Context

Chunk 2 shipped the read-only presentation layer: three pages (`MakeHome`, `MakeTypes`, `MakeType` with Fields/Instances tabs), a Pinia store, an Obsidian view wrapper, and the real `listInstances` implementation. Users can browse hand-crafted types but cannot create, edit, or delete them.

Chunk 3 adds the type-authoring surface: service write methods (`createType`, `updateType`, `deleteType`, `regenerateBaseFile`, `toggleFavorite`), an editable Fields tab with Save/Cancel flow, a `DeleteTypeDialog`, a base-file staleness banner with protected regenerate, and a toggleable favorite star.

Chunk 3 deliberately defers operational-hardening work to a dedicated **Chunk 3.5** (see §12 outbox): optimistic concurrency across leaves/devices, save-time notices for field-kind changes, persistent post-save orphan banners, and related safety nets. Chunk 3's scope is "users can author types through the UI"; Chunk 3.5's scope is "concurrent and adversarial editing is safe".

Instance CRUD (Chunk 4), corrupt-type UI (Chunk 4), KPIs and settings page (Chunk 5), and drag-and-drop reorder (rejected) remain deferred as originally planned.

## Decisions captured (9 explicit Qs + mid-section clarifications + review follow-ups)

| Ref | Decision |
|---|---|
| Q1 | New route `/make/types/new` reusing `MakeType` in new-mode. |
| Q2 | Always-editable Fields tab with explicit Save/Cancel footer. |
| Q3 | All editable content inside Fields tab — Schema-details collapsible panel + field list + footer. |
| Q4 | Tab switch preserves draft state; only router navigation triggers the unsaved-changes dialog. |
| Q5 | DeleteTypeDialog shows instance count as read-only info; no cascade checkbox (Chunk 4). |
| Q6 | Base-file missing/stale banner below page header, above tab strip. |
| Q7 | Corrupt type file UI deferred to Chunk 4. |
| Q8 | Favorite toggle clickable on MakeTypes + MakeType only. |
| Q9 | Up/down arrow field reorder — no drag-and-drop. |
| Mid-S2 | `instancesFolder` editable; inline chip when orphan risk. |
| Mid-S8 | Wire `t()` live for all new Chunk 3 copy + backfill Chunk 2 dead keys. |
| **R1** | **Favorite toggle uses optimistic flip with rollback** (review follow-up: supersedes mid-S7 pending-opacity-only decision now that `toggleFavorite` returns `Result`). |
| **R2** | **Event bus uses 5 distinct `make:*` channels** declared in `EventMap`; `subscribeMakeEvents(handlers)` composes subscriptions and returns a composite unsubscribe. |
| **R3** | **Event handler is the sole cache mutator** — actions return Result but do not mutate `types.value`; only the event subscriptions update cache. Eliminates double-update drift. |
| **R4** | **Shared `ConfirmDialog` component** for both DeleteTypeDialog body and unsaved-changes confirm. |

## 1. Scope & Deviations

**In scope (Chunk 3 = Slice 3):**
- `MakeService` write methods: `createType`, `updateType`, `deleteType` (type-only — cascade returns `not-implemented`), `regenerateBaseFile(typeId, options?)`, `toggleFavorite(typeId)` returning `Result<boolean, MakeError>`.
- Editable Fields tab with Schema-details panel, field rows (add/remove/reorder via ▲▼), and explicit Save/Cancel footer.
- `DeleteTypeDialog` with plain-language orphan-consequence copy, optional base-file delete.
- Base-file missing/stale banner with user-edit-protected regenerate flow.
- Favorite star clickable on `MakeTypes` rows and `MakeType` page header — optimistic flip with rollback.
- New route `/make/types/new` mounting `MakeType` in new-mode.
- `<RouterView :key="route.fullPath">` in `AppRoot.vue` to force remount on type change (architectural fix).
- i18n: wire `t()` live for all new Chunk 3 copy + backfill Chunk 2's dead keys in the same pass.
- Full keyboard + screen-reader accessibility for all new UI surfaces and Chunk 2's tab pattern.
- Storybook stories per new component; `.po.ts` updates per touched page.

**Out of scope (deferred explicitly):**
- Instance cascade delete → Chunk 4.
- Corrupt type file UI surface → Chunk 4.
- Instance CRUD, "Open in Obsidian", create-instance form → Chunk 4.
- Optimistic concurrency across leaves/devices (`stat.mtime` compare) → Chunk 3.5.
- Save-time notices for field `kind` changes and title-field renames → Chunk 3.5.
- Persistent post-save orphan banner after `instancesFolder` rename → Chunk 3.5.
- Relative `baseFile.path` storage → Chunk 3.5.
- `make-create-type` command-palette entry → Chunk 5.
- KPIs, recently-created list, `MakeSettings.vue` → Chunk 5.
- Per-field `default` value editing (preserved on save but not UI-exposed).
- Drag-and-drop field reorder (rejected — up/down arrows only).

**Deviations from parent spec `2026-04-18-make-design.md`:**
1. **Routes**: parent §6.1 had separate `.../config` and `.../` routes; Chunk 2 consolidated into `/make/types/:typeId` with tabs. Chunk 3 adds `/make/types/new` declared before `/make/types/:typeId`.
2. **`MakeTypeConfig.vue` does not exist** — its role is played by `MakeTypeFieldsEditor.vue` inside the Fields tab.
3. **`MakeTypeIndex.vue` does not exist** — Chunk 2 shipped this as `MakeTypeInstances.vue` (read-only).
4. **DeleteTypeDialog** ships with one checkbox (base file) + read-only instance count. Chunk 4 reinstates the cascade checkbox.
5. **`make-create-type`** command-palette entry deferred to Chunk 5.
6. **`toggleFavorite` signature** — parent spec §5.3 declares `Promise<void>`. Chunk 3 tightens to `Promise<Result<boolean, MakeError>>` (ok value = new favorited state). Rationale: fire-and-forget is not compatible with optimistic-flip-with-rollback UX. Accepted documented deviation.
7. **New `SchemaError` sub-variant** — `{ kind: 'field-rename-warning', affectedCount, oldName, newName }` used by `updateType` to implement the two-phase rename confirm (§3). Not a new `MakeError` kind — it's carried inside existing `invalid-schema` variant.
8. **`regenerateBaseFile` accepts an options parameter** — `(typeId, options?: { force?: boolean })`. Parent §7.3 ("overwrite unconditionally") remains the final behavior when `force === true`; Chunk 3 adds the first-call user-edit check.

## 2. Routing

One route added. Declaration order matters — `/make/types/new` must precede `/make/types/:typeId`.

```ts
{ path: '/make/types/new', name: 'make-type-new', component: MakeType, meta: { layout: 'main' } },
{ path: '/make/types/:typeId', name: 'make-type', component: MakeType, meta: { layout: 'main' },
  beforeEnter: async (to) => { /* unchanged from Chunk 2 */ } },
```

`MakeType.vue` reads `route.name === 'make-type-new'` to enter new-mode.

### Component remount on route param change

Vue reuses the `MakeType` component instance when navigating `/make/types/a` → `/make/types/b` (same component, different param). This would cause draft state to bleed between types. Fix: in `src/ui/AppRoot.vue`, add a `:key` to `<router-view>`:

```vue
<router-view :key="$route.fullPath" />
```

Forces a fresh component instance on every route change including param-only changes. Simple, well-supported, no additional lifecycle hooks needed. Applies to all routes — confirmed with other pages (Home, About, Dashboard, MakeTypes, MakeType) that this doesn't cause regressions (each page's `onMounted` is idempotent).

### Unsaved-changes navigation guard

`MakeType.vue` registers `onBeforeRouteLeave(to, from)`. When `isDirty.value === true`, opens a confirm dialog (shared `ConfirmDialog` component — §6):

- **Save** → invoke save handler; if success `return true`; if failure keep user on page.
- **Discard** → `return true`.
- **Cancel** → `return false`.

Tab switches use `router.replace({ hash })` which does not trigger `beforeRouteLeave` — draft state survives. When user is on Instances tab with `isDirty`, the Fields tab label shows a `● Unsaved` marker so the pending state is visible regardless of which tab is active.

Escape key on a dirty `MakeType.vue` is a no-op (does not discard, does not save). Pressing Escape inside an input field blurs the field; pressing it on the page routes to nothing.

### Entry points for Create

- **`MakeHome.vue`** empty state: replace Chunk 2's "Type authoring comes in a later update" text with a "Create type" button.
- **`MakeHome.vue`** types-exist state: new secondary "Create type" button beside "Browse types" CTA.
- **`MakeTypes.vue`** header: new primary "Create type" button beside Refresh.

### Rename semantics

`id` is immutable post-create (parent spec §3.1). Renaming updates `name` only — URL, JSON path, base-file path, `instancesFolder` unchanged. The H1 on `MakeType.vue` is bound to `draft.name ?? committedType.name ?? t('make.type.create.title')`, so it updates live as the user types.

### `instancesFolder` edit (mid-S2 decision i)

When the user changes `instancesFolder` and `listInstances(typeId).length > 0`, inline warning chip under the input: `make.type.schema.folderOrphansWarning` ("Moving this folder means existing notes won't be linked to this type. They'll stay in their current folder but won't appear in the Instances list. Coming in a later update: automatic move."). User can still save.

Chunk 3.5 scope: after save, a persistent info banner surfaces on the page until acknowledged or Chunk 4 ships the move affordance. Chunk 3 ships the pre-save chip only.

## 3. Service write methods

Five new methods in `src/modules/make/make-service.ts`. All return `Result<T, MakeError>`; none throw. All emit corresponding `make:*` events.

### `createType(draft: NewTypeDraft): Promise<Result<TypeSchema, MakeError>>`

1. **Validate draft** — run `validateField` from each `FIELD_KINDS[kind]` spec + `validateTypeName(draft.name)` + `validateInstancesFolder(draft.instancesFolder)`. Collect any `SchemaError[]`; if non-empty, return `err({ kind: 'invalid-schema', issues })`.
2. **Name uniqueness (soft check)** — call `listTypes()`; if any existing schema's `name` matches case-insensitively, return `err({ kind: 'duplicate-name', name })`. This check is a usability shortcut — the authoritative check is step 4's filesystem probe.
3. **Generate id** — `slugifyTypeName(draft.name)` from `src/domain/make/type-id.ts`. Loop appending `-2`, `-3`, etc. until a candidate `id` satisfies both:
   - `ports.vault.exists('{typesFolder}/{id}.json') === false`, AND
   - `ports.vault.exists('{basesFolder}/{id}.base') === false`.
   This disk-truth check covers orphan `.base` files from prior deleted types, stale cache states, and cross-session races. Hard cap at 100 attempts (returns `err({ kind: 'vault-error', cause: 'slug-exhaustion' })` — shouldn't happen in practice).
4. **Stamp timestamps** — `createdAt = updatedAt = new Date().toISOString()`.
5. **Write type JSON** — `ports.vault.create('{typesFolder}/{id}.json', serializeTypeSchema(schema))`. Vault err → `err({ kind: 'vault-error', cause })`. The Obsidian adapter's `create` is backed by `app.vault.create`, which is atomic — partial writes are not possible; see §3 footnote.
6. **Generate + write base YAML** — `generateBaseYaml(schema)` → `ports.vault.create('{basesFolder}/{id}.base', yaml)`. On err: `ports.notifications.warn(t('make.notify.baseFailed'))`, leave `schema.baseFile` undefined, skip step 7, emit `make:type-created { schema }` with `baseFile: undefined`, return `ok(schema)` (partial success — type is usable).
7. **Re-write JSON with stamp** — `schema.baseFile = { path, generatedAt: createdAt }`; `ports.vault.update('{typesFolder}/{id}.json', serializeTypeSchema(next))`. If this fails (extremely rare since step 5 already wrote to the same path), `ports.notifications.warn(t('make.error.baseStampFailed'))`, emit `make:type-created { schema }` with the pre-stamp schema, return `ok(pre-stamp schema)`. The next `loadType` call applies the orphan-base reconciliation (below).
8. **Emit** `make:type-created { schema }`.

**Orphan-base reconciliation** — applied in `loadType`: if a loaded schema has `baseFile === undefined` but `ports.vault.exists('{basesFolder}/{id}.base') === true`, stamp `schema.baseFile = { path, generatedAt: (fileStat.mtime as ISO) }` in memory (no disk write). Consequence: the banner shows "stale" (`updatedAt > generatedAt`) instead of "missing" for recovered types, and user regenerate overwrites the orphan cleanly. Documented behavior, covered by a dedicated test.

### `updateType(typeId, changes: TypeSchemaPatch, options?: { acknowledgeRenames?: boolean }): Promise<Result<TypeSchema, MakeError>>`

1. **Load current schema** — `loadType(typeId)`; if err, propagate.
2. **Merge draft** — `next = { ...current, ...changes, updatedAt: new Date().toISOString() }`. `id`, `createdAt`, `baseFile` not in `TypeSchemaPatch` — immutable.
3. **Detect field renames** — compute `renames: { oldName, newName, position }[]` by position-wise comparing `current.fields` and `next.fields`. A "rename" is a position where the field kind is unchanged but the name changed AND the old name doesn't appear anywhere in `next.fields`. If `renames.length > 0 && options.acknowledgeRenames !== true`:
   - For each rename, count affected instances: `(await listInstances(typeId)).length`. Spec choice: report a single aggregate count for simplicity in Chunk 3 (users typically rename one or two fields at a time; precise per-field count is Chunk 3.5 scope).
   - Return `err({ kind: 'invalid-schema', issues: [{ kind: 'field-rename-warning', renames, affectedCount }] })`.
4. **Validate merged schema** — same rules as `createType` step 1 over `next`.
5. **Name uniqueness (soft check + filesystem)** — only if `changes.name !== undefined && changes.name !== current.name`. Same dual-check as `createType` but the id does NOT change (rename-only); we're verifying no other schema has the new name.
6. **Write JSON** — `ports.vault.update('{typesFolder}/{id}.json', serializeTypeSchema(next))`. Vault err → propagate.
7. **Do NOT regenerate base file.** Banner appears on next render because `next.updatedAt > next.baseFile.generatedAt`.
8. **Emit** `make:type-updated { schema: next }`.

### `deleteType(typeId, options: DeleteTypeOptions): Promise<Result<DeleteTypeReport, MakeError>>`

- **`options.alsoDeleteInstances === true`** → return `err({ kind: 'not-implemented', feature: 'instance-cascade' })`. This is a **new `MakeError` variant** (shape: `{ kind: 'not-implemented', feature: string }`) accepted in Chunk 3 scope — §1 deviation note. Replaces the Chunk 3 draft's misleading `vault-error` with accurate semantics, and paves the way for Chunk 3.5's additional `stale-write` and Chunk 4's cascade implementation.

1. **Load schema** — `loadType(typeId)`; if err, propagate.
2. **Delete type JSON** — `ports.vault.delete('{typesFolder}/{id}.json')`. Vault err → propagate.
3. **Conditionally delete base file** — if `options.alsoDeleteBaseFile && schema.baseFile !== undefined`:
   - **Safety check**: if `schema.baseFile.path` does NOT start with `settings.basesFolder`, skip the delete and log a warning (`"base file at '{path}' lives outside configured basesFolder '{settings.basesFolder}' — not deleted"`). Surface via `ports.notifications.info(t('make.notify.baseLeftAlone'))`. Type delete succeeds; report reflects `baseFileDeleted: false`.
   - Otherwise: `ports.vault.delete(schema.baseFile.path)`. Failure logged + notified as `t('make.notify.baseDeleteFailed')` but does not fail the overall delete; `baseFileDeleted: false` in report.
4. **Emit** `make:type-deleted { typeId, name: schema.name }`.
5. **Return** `ok({ instancesDeleted: 0, baseFileDeleted })`.

### `regenerateBaseFile(typeId, options?: { force?: boolean }): Promise<Result<string, MakeError>>`

User-edit protection is the key addition vs. parent spec §7.3 (which said "overwrite unconditionally"). Chunk 3 adds a first-call check that returns an error if the existing file diverges from what Make would generate, forcing the user to confirm overwriting.

1. **Load schema** — `loadType(typeId)`.
2. **Generate YAML** — `generateBaseYaml(schema)`.
3. **Resolve path** — `'{basesFolder}/{id}.base'` (deterministic; ignores any stored `baseFile.path` to recover from `basesFolder` setting changes).
4. **User-edit check** — only when `options.force !== true`:
   - If `ports.vault.exists(path) === true`: read current contents. If the actual file does not match what `generateBaseYaml(current stored schema)` would produce (byte-compare), return `err({ kind: 'base-generation-failed', cause: 'user-edited' })`. Uses the existing `MakeError.base-generation-failed` variant (parent spec §5.3) — no new kind.
   - Rationale for byte-compare: base files are small (<1 KB typical). Hashing or structural comparison is overkill. Users who hand-edit will be flagged on any change; rare false positives (Obsidian normalizes line endings, for example) are acceptable — worst case is a confirm dialog that's easily dismissed.
5. **Write** — `ports.vault.exists(path) === true ? update(path, yaml) : create(path, yaml)`.
6. **Update schema** — stamp `schema.baseFile = { path, generatedAt: new Date().toISOString() }`; `ports.vault.update('{typesFolder}/{id}.json', serializeTypeSchema(next))`.
7. **Emit** `make:base-file-regenerated { typeId, path }`.
8. **Return** `ok(path)`.

### `toggleFavorite(typeId): Promise<Result<boolean, MakeError>>`

**Signature change** from parent spec §5.3 (`Promise<void>` → `Promise<Result<boolean, MakeError>>`). Ok value is the new favorited state.

1. Read current `settings.favorites`.
2. `nextFavorites = favorites.includes(typeId) ? favorites.filter(…) : [...favorites, typeId]`.
3. `result = await ports.settings.saveSection('make', { ...settings, favorites: nextFavorites })`.
4. On err: `ports.notifications.warn(t('make.error.favoriteFailed'))`, return `err({ kind: 'vault-error', cause: result.error })`.
5. On success: emit `make:favorite-toggled { typeId, favorited: nextFavorites.includes(typeId) }`. Return `ok(nextFavorites.includes(typeId))`.

### Domain helpers (explicit file homes)

Pure-TS helpers referenced across the service methods. Locations:

- **`src/domain/make/type-id.ts`** (exists) — add `export function slugifyTypeName(name: string): string`.
- **`src/domain/make/name-validation.ts`** (exists) — add `export function validateTypeName(name: string): readonly SchemaError[]`, `export function validateInstancesFolder(folder: string): readonly SchemaError[]`.
- **`src/domain/make/draft-equality.ts`** (NEW file) — `export function deepEqualDraft(a: Draft, b: Draft): boolean`. Pure, position-sensitive on `fields[]`, discriminates on Field union type. Covered by its own `.test.ts`.

### New `MakeError` variant (deviation from draft's "no new variants")

```ts
export type MakeError =
  | { kind: 'vault-error';         cause: string }
  | { kind: 'invalid-schema';      issues: NonEmptyArray<SchemaError> }
  | { kind: 'invalid-values';      issues: NonEmptyArray<FieldError> }
  | { kind: 'type-not-found';      typeId: TypeId }
  | { kind: 'duplicate-name';      name: string }
  | { kind: 'instance-exists';     path: string }
  | { kind: 'no-title-field' }
  | { kind: 'base-generation-failed'; cause: string }
  | { kind: 'not-implemented'; feature?: string }    // ← extended: optional feature slug
  ;
```

`not-implemented` already exists (Chunk 1 scaffold). Chunk 3 adds an optional `feature` discriminator so the UI can show feature-specific messaging (e.g., "Instance cascade delete is coming in a later update.") Strictly additive change; existing handlers that destructure `{ kind: 'not-implemented' }` without `feature` continue to work.

New `SchemaError` sub-variant (internal to the `invalid-schema` wrapper):

```ts
| { kind: 'field-rename-warning'; renames: readonly FieldRename[]; affectedCount: number }
```

where `FieldRename = { oldName: string; newName: string; position: number }`. Surfaces when `updateType` detects renames without `acknowledgeRenames: true`.

**Atomicity footnote**: the Obsidian `VaultPort` adapter delegates to `app.vault.create` / `app.vault.modify`, both of which are atomic on the underlying filesystem (write-to-tmp-then-rename on desktop; atomic on mobile too). `VaultPort` contract does not yet document this; Chunk 3.5 adds the guarantee to `src/domain/shared/vault-port.ts` formally. For Chunk 3 purposes: partial-write mid-step-6 is not a realistic failure mode.

## 4. `MakeType.vue` + `useMakeTypeDraft` composable

Draft state + dirty detection + save/cancel orchestration extract into `src/ui/pages/make/use-make-type-draft.ts` (new composable). Keeps `MakeType.vue` readable and under the 350-line ESLint cap.

### `useMakeTypeDraft(route, store)` composable

```ts
export function useMakeTypeDraft(
  route: RouteLocationNormalizedLoaded,
  store: ReturnType<typeof useMakeStore>,
): {
  isNewMode: ComputedRef<boolean>;
  typeId: ComputedRef<TypeId | null>;
  committedType: ComputedRef<TypeSchema | null>;
  draft: Ref<Draft>;
  isDirty: ComputedRef<boolean>;
  fieldErrors: Ref<Record<string, FieldError[]>>;
  resetDraft: () => void;
  applyResult: (schema: TypeSchema) => void;
}
```

- **Mode detection**: `isNewMode = computed(() => route.name === 'make-type-new')`.
- **Seed**: on first invocation, `draft.value = isNewMode.value ? emptyDraftForNewMode() : toDraft(committedType.value!)`. `emptyDraftForNewMode()` produces `{ name: '', description: '', instancesFolder: settings.defaultInstancesRoot, titleFieldName: 'title', fields: [FIELD_KINDS['text'].defaultField('title')] }` — one seeded text field matching parent spec §8.1.
- **Dirty detection**:
  - New-mode: `true` until the first successful save (distinguishes pristine-seed from post-submit fresh-seed). Tracked via an internal `firstSaveComplete: Ref<boolean>`.
  - Edit-mode: `!deepEqualDraft(draft.value, toDraft(committedType.value!))` via `src/domain/make/draft-equality.ts`.
- **`applyResult`**: called after successful save. Resets `draft` to `toDraft(savedSchema)`; sets `firstSaveComplete = true`.
- **`resetDraft`**: cancel handler. In edit-mode: resets to `committedType`. In new-mode: navigates away (caller handles).

### `MakeType.vue` structure

```ts
const route = useRoute();
const router = useRouter();
const store = useMakeStore();
const { isNewMode, typeId, committedType, draft, isDirty, fieldErrors, resetDraft, applyResult } = useMakeTypeDraft(route, store);

const { instancesByTypeId, instancesLoading, instancesError, typesLoading, savingType, saveError } = storeToRefs(store);

// Tab state drives aria-controls wiring (§5).
const activeTab = ref<'fields' | 'instances'>(route.hash === '#fields' ? 'fields' : 'instances');
watch(() => route.hash, (h) => { activeTab.value = h === '#fields' ? 'fields' : 'instances'; });
watch(activeTab, (t) => { if (route.hash !== `#${t}`) void router.replace({ hash: `#${t}` }); });
```

In new-mode the Instances tab is hidden and `activeTab` is locked to `'fields'`.

### Header (adjusted from Chunk 2)

- Title: `<h1 data-testid="make-type-title">{{ headerTitle }}</h1>` where `headerTitle = draft.name.trim() || committedType?.name || t('make.type.create.title')`.
- `● Unsaved changes` badge (`v-if="isDirty"`) — accessible implementation in §7.
- Favorite star (`v-if="!isNewMode && committedType"`) — clickable `<button>` with dynamic `aria-label` and `aria-pressed` (§5).
- Folder line (`v-if="committedType"`) — read-only label.
- Refresh button (`v-if="!isNewMode"`) — unchanged from Chunk 2.

### Base-file banner

Renders between header and tab strip. Visible only in edit-mode. Two states via `MakeTypeBaseBanner.vue` (§6).

### Tab strip (a11y-complete, Chunk 2 gaps fixed)

```vue
<div role="tablist" class="tabs" aria-label="Make type view">
  <button
    id="tab-fields"
    role="tab"
    data-testid="make-type-tab-fields"
    :aria-selected="activeTab === 'fields'"
    :tabindex="activeTab === 'fields' ? 0 : -1"
    aria-controls="panel-fields"
    @click="activeTab = 'fields'"
    @keydown="onTabKeydown"
  >
    Fields
    <span v-if="activeTab !== 'fields' && isDirty" aria-label="Unsaved changes">●</span>
  </button>
  <button v-if="!isNewMode" id="tab-instances" role="tab" ... aria-controls="panel-instances">
    Instances
  </button>
</div>

<section id="panel-fields" role="tabpanel" aria-labelledby="tab-fields" :hidden="activeTab !== 'fields'">
  <MakeTypeFieldsEditor ... />
</section>
<section id="panel-instances" role="tabpanel" aria-labelledby="tab-instances" v-if="!isNewMode" :hidden="activeTab !== 'instances'">
  <MakeTypeInstances ... />
</section>
```

`onTabKeydown` implements roving-tabindex arrow-key navigation per ARIA tabpanel pattern:
- `ArrowRight` / `ArrowLeft`: move focus between visible tabs, update `activeTab`.
- `Home` / `End`: jump to first / last tab.
- `Enter` / `Space`: activate the focused tab (already handled by `@click`).

The Fields-tab label shows `●` when `isDirty && activeTab !== 'fields'` — visible unsaved indicator while on Instances tab. Paired with `aria-label="Unsaved changes"` on the dot so screen readers announce it.

### Save flow

```ts
async function onSave(): Promise<void> {
  const preErrors = validateDraftLocally(draft.value);
  if (preErrors.size > 0) {
    fieldErrors.value = preErrors;
    focusFirstInvalid(fieldErrors.value);
    return;
  }
  const result = isNewMode.value
    ? await store.createType(draftToNewTypeDraft(draft.value))
    : await store.updateType(typeId.value!, draftToPatch(draft.value), { acknowledgeRenames: acknowledgedRenames.value });
  if (result.kind === 'err') {
    await handleServiceError(result.error);
    return;
  }
  applyResult(result.value);
  if (isNewMode.value) {
    ports.notifications.success(t('make.notify.typeCreated'));
    await router.replace(`/make/types/${result.value.id}`);
  } else {
    ports.notifications.success(t('make.notify.typeUpdated'));
  }
}

async function handleServiceError(error: MakeError): Promise<void> {
  // duplicate-name / invalid-schema with field-rename-warning / invalid-schema generic / vault-error / etc.
  // — surface appropriate UI, focus first invalid input on schema errors.
}
```

`handleServiceError` encapsulates error-specific logic:
- **`invalid-schema` with `field-rename-warning`** issue: open `ConfirmDialog` with text "Renaming {oldName} to {newName} will orphan frontmatter on {affectedCount} existing instances. Their notes remain but the old field name won't appear in the type. Continue?" On confirm: set `acknowledgedRenames.value = true`, re-call `onSave()`. On cancel: no-op, user stays on form.
- **`invalid-schema` with other issues**: populate `fieldErrors`, focus first invalid input.
- **`duplicate-name`**: populate the Name field's error, focus Name input.
- **`vault-error`**: set `saveError.value` (drives the banner above the footer); dirty flag retained.
- **`type-not-found`** (edit-mode stale cache): `ports.notifications.info(t('make.notify.typeNotFound'))`; `router.replace('/make/types')`.

### Cancel flow

- **New-mode**: `router.push('/make/types')`; `beforeRouteLeave` guard intercepts normally if dirty.
- **Edit-mode**: `resetDraft()`; `fieldErrors` cleared; no navigation.

### Unsaved-changes router guard

```ts
onBeforeRouteLeave(async (to, from) => {
  if (!isDirty.value) return true;
  const choice = await openConfirm({
    title: t('make.type.unsaved.title'),
    body: t('make.type.unsaved.body'),
    options: ['save', 'discard', 'cancel'],
  });
  if (choice === 'cancel') return false;
  if (choice === 'discard') return true;
  // save
  await onSave();
  return !isDirty.value; // only navigate if save succeeded (isDirty clears after applyResult)
});
```

`openConfirm` is a promise-returning helper backed by the shared `ConfirmDialog` component (§6).

## 5. Fields-tab components

Four new components under `src/ui/pages/make/`. All queryable by `data-testid`, no CSS class coupling.

### `MakeTypeSchemaDetails.vue` — collapsible schema-details panel

Props: `v-model:draft`, `fieldNames`, `errors: { name?: string; folder?: string }`, `hasExistingInstances: boolean`, `mode: 'new' | 'edit'`.

Inputs (each a labeled `<input>` or `<select>` with explicit `<label for>`):
- **Name** — `required` HTML attribute; `*` visible marker; `aria-required="true"`; `aria-invalid="true"` + `aria-describedby` when error present.
- **Description** — optional.
- **Instances folder** — `required`; with conditional warning chip below when `hasExistingInstances && draft.instancesFolder !== committedType.instancesFolder`.
- **Title field** — `<select>`: `null` option ("No title field — use explicit filename on create"), plus each `text`-kind field name. Disabled with a helpful message when `fieldNames` has no text fields.

Collapsed state: header shows compact summary. Click header to expand/collapse. Default collapsed in edit-mode; expanded in new-mode with `.focus()` called on the Name input via `nextTick` after mount (explicit programmatic focus, not HTML `autofocus` attribute — `autofocus` can fire before the Obsidian leaf is visible and scroll the wrong pane).

### `MakeTypeFieldRow.vue` — one row per field

Props: `field`, `index`, `isFirst`, `isLast`, `isOnly`, `isTitleField`, `errors: FieldError[]`.
Emits: `update`, `moveUp`, `moveDown`, `remove`.

Layout (desktop, single row):
```
[kind ▼] [name] [label] [□ required] [description] [▲ ▼ 🗑]
```

Layout (mobile, < 600px): stacks into a card:
```
┌────────────────────────┐
│ [kind ▼]        [▲▼ 🗑] │
│ [name]                 │
│ [label]                │
│ [□ required]           │
│ [description]          │
└────────────────────────┘
```

Driven by scoped `@container (max-width: 600px)` or a CSS media query on `min-width` of the containing panel. Acceptable for Chunk 3: a single conditional CSS block.

**A11y details:**
- Every input has an explicit `<label>` or `aria-label` like `"Field 2 name"` (constructed from `props.index + 1` + label name). Inputs without visible labels still get `aria-label`.
- Required checkbox has `aria-label="Field 2 required"`.
- Title-field badge: `<span aria-label="this is the title field">★</span>` beside the name input (visual + SR).
- Arrow buttons: `aria-label="Move field 2 up"` / "down". Disabled at extremes via HTML `disabled`.
- Trash button: `aria-label="Remove field 2"`. Disabled when `isOnly`.
- `aria-invalid="true"` + `aria-describedby` on any input with an error in `errors`.
- Minimum 44×44 CSS-px touch targets on all buttons (meets WCAG 2.5.5 AAA; spec pads icons and click area).

Changing kind wipes the `default` property (no cross-kind preservation). Per-kind defaults not UI-exposed in Chunk 3 — preserved from disk on edit, dropped on kind change.

### `MakeTypeFieldsEditor.vue` — container

Composes `MakeTypeSchemaDetails` + `<section>` of `MakeTypeFieldRow` + Add button + service-error banner + footer.

**Keys for `v-for`** on field rows: `` `${f.name}-${i}` `` composite — survives transient name collisions during edits without losing focus.

**Add field**: appends `FIELD_KINDS['text'].defaultField('field_N')` (where `N = draft.fields.length + 1`), focuses the new row's name input via `nextTick`.

**Remove field**:
1. Capture `focusTarget = index === 0 ? fields[1] : fields[index - 1]` (prev row, or next if removing first).
2. Splice the row out.
3. `nextTick(() => focusTarget.nameInputRef.focus())`.
4. If `isOnly`, remove is disabled (button has `disabled` attribute).

**Reorder**: `moveUp` / `moveDown` swap adjacent elements. Focus stays on the moved row's name input via `nextTick` (doesn't jump unexpectedly).

**Footer** (`<footer>` element):
- `[Cancel]` button — disabled during save.
- `[Save changes]` / `[Create {name}]` button — label is `Create {draft.name || 'type'}` in new-mode (live-updating), `Save changes` in edit-mode. Disabled when `!isDirty || savingType`. Shows `aria-busy="true"` and text changes to `Saving…` during save.
- In edit-mode, a right-aligned red `[Delete type]` button opens the `DeleteTypeDialog`.

**Service-error banner** (`saveError` non-null): `role="status"` region above the footer with retry button. `aria-live="polite"` so screen readers announce the error without interrupting.

### Validation

- **Inline on blur** for single-input rules (name shape, folder shape).
- **Client-side pre-check on save** (`validateDraftLocally`) — mirrors service rules for fast feedback. Service validation is authoritative.
- **First-invalid focus** — `focusFirstInvalid(errors)` walks the form in DOM order and calls `.focus()` on the first input with an error. Called immediately after `fieldErrors` is populated, whether from pre-check or service response.

## 6. Components: `DeleteTypeDialog`, `ConfirmDialog`, `MakeTypeBaseBanner`

New folder: `src/ui/components/make/` (Chunk 2 hasn't created it; parent spec §6.3 defines it).

### `ConfirmDialog.vue` — shared primitive

Used for unsaved-changes confirm, field-rename confirm, base-file-overwrite confirm, and any other Yes/No/Cancel modal. Not dedicated to the delete flow — that dialog is specialized (has a checkbox and instance-count logic).

Props:
```ts
{
  open: boolean;
  title: string;
  body: string;       // plain text; render-as-slot variant available via slot fallback
  options: readonly ('save' | 'discard' | 'cancel' | 'confirm' | 'reject')[];
  destructive?: boolean;  // styles confirm button red
  labels?: Partial<Record<'save' | 'discard' | 'cancel' | 'confirm' | 'reject', string>>;
}
```

Emits: `resolve(choice)`.

**A11y details:**
- `role="alertdialog"` (not `dialog` — we use this for confirmations, always with an action consequence).
- `aria-modal="true"`.
- `aria-labelledby` points at the title element's id.
- `aria-describedby` points at the body element's id.
- Focus trap inside dialog while open (Tab cycles among dialog's focusable elements).
- Open: focus lands on the LAST button (Cancel in the `[Cancel][Discard][Save]` case, or the non-destructive option when `destructive === true`).
- Close (any choice): return focus to the element that triggered the dialog (via a ref stored on open).
- Escape key resolves with `'cancel'` (or the first non-destructive option if `cancel` isn't in `options`).
- Backdrop click resolves with `'cancel'`.

**Usage helper** — `openConfirm({ title, body, options, labels }): Promise<Choice>` — wraps mount/emit/unmount into a promise. Implementation: mounts `ConfirmDialog` into a portal (teleport to `document.body`), returns a promise that resolves on `@resolve`, then unmounts.

Tested in isolation with a dedicated `.test.ts` and `.po.ts`.

### `DeleteTypeDialog.vue`

Wraps `ConfirmDialog` with dialog-specific body and adds the base-file checkbox + instance-count line.

Props: `open: boolean`, `type: TypeSchema`, `instanceCount: number | null`, `isDeleting: boolean`.
Emits: `confirm({ alsoDeleteBaseFile: boolean })`, `cancel`.

Body content:
- **Title**: `make.delete.title` → "Delete type \"{name}\"?"
- **Type-file path**: `make.delete.typeFile` → "The type definition file {path} will be deleted."
- **Instance line** (exactly one of):
  - `instanceCount === null` → `make.delete.checkingInstances` → "Checking instance count…" (wrapped in `aria-live="polite"` region so the transition to a real count is announced).
  - `instanceCount === 0` → `make.delete.noInstances` → "This type has no instances."
  - `instanceCount === 1` → `make.delete.hasInstancesOne` → "This type has 1 existing note in {folder}. The note will be kept and will still open in Obsidian as regular markdown, but it won't be linked to any type anymore."
  - `instanceCount > 1` → `make.delete.hasInstancesOther` → "This type has {count} existing notes in {folder}. The notes will be kept and will still open in Obsidian as regular markdown, but they won't be linked to any type anymore."
- **Base-file checkbox**: `make.delete.alsoDeleteBase` → "Also delete the generated base file" with path below. Disabled when `type.baseFile === undefined`.
- **Trash note**: `make.delete.trashNote` → "Deleted files move to Obsidian's configured trash — you can restore them there."
- **Buttons**: Cancel (secondary) + Delete type (red, `destructive`). Confirm button shows `aria-busy` + text `"Deleting…"` during `isDeleting`.

Focus / Escape / backdrop / return-focus all inherit from `ConfirmDialog` base.

Trigger from `MakeType.vue`: the "Delete type" button (Fields-tab footer in edit-mode) opens the dialog. `instanceCount` starts as `store.instancesByTypeId.get(typeId)?.length ?? null`; if null, `store.loadInstances(typeId)` is dispatched so the count resolves while the dialog is open.

On `confirm({ alsoDeleteBaseFile })`:
1. Keep dialog open; set `isDeleting = true`.
2. `result = await store.deleteType(typeId, { alsoDeleteInstances: false, alsoDeleteBaseFile })`.
3. ok: close dialog, success notification (detail includes whether base was deleted), `router.replace('/make/types')`.
4. err `not-implemented` (shouldn't happen — cascade is false): internal bug; log error + generic notification.
5. err `vault-error`: keep dialog open; show error banner inside the body; `isDeleting = false`; user retries.

### `MakeTypeBaseBanner.vue` — table-view banner

Copy renamed from "base file" to "table view" for user clarity (base files power Obsidian Bases table views; "base file" is implementation jargon).

Props: `state: 'missing' | 'stale'`, `generatedAt?: string`, `regenerateLoading: boolean`, `regenerateError: string | null`.
Emits: `regenerate`.

Two states, shared shell:
- **Missing** — `make.type.basefile.missing.title` → "Table view missing". Body: "The table view for this type hasn't been generated yet. Regenerate to create it."
- **Stale** — `make.type.basefile.stale.title` → "Table view out of date". Body: "The schema changed since the table view was generated on {date}. Regenerate to bring it up to date."

**A11y:**
- `role="status"` (not `alert` — informational, not urgent/interrupting).
- Regenerate button: `aria-label="Regenerate table view"`, `aria-busy="true"` + text `"Regenerating…"` during `regenerateLoading`.

### Regenerate flow

Click → `store.regenerateBaseFile(typeId)` (no force). Result handling:
- **ok**: banner disappears on next render; success notification `make.notify.baseRegenerated`.
- **err `base-generation-failed` with cause `'user-edited'`**: open `ConfirmDialog` — "The table view file has been hand-edited. Regenerating will overwrite those changes. Continue?" On confirm: `store.regenerateBaseFile(typeId, { force: true })`. On cancel: banner stays visible; no error state.
- **err `vault-error`**: banner stays visible; inline error text under banner; button re-enabled.

## 7. Pinia store additions

### New state refs

```ts
const savingType         = ref(false);
const saveError          = ref<string | null>(null);
const regeneratingForId  = shallowRef<ReadonlySet<TypeId>>(new Set());
const regenerationError  = shallowRef<ReadonlyMap<TypeId, string>>(new Map());
const favoriteToggling   = shallowRef<ReadonlySet<TypeId>>(new Set());
```

### New actions (return `Result` where the service does)

```ts
async function createType(draft: NewTypeDraft): Promise<Result<TypeSchema, MakeError>>
async function updateType(typeId, patch, opts?): Promise<Result<TypeSchema, MakeError>>
async function deleteType(typeId, options): Promise<Result<DeleteTypeReport, MakeError>>
async function regenerateBaseFile(typeId, opts?): Promise<Result<string, MakeError>>
async function toggleFavorite(typeId): Promise<Result<boolean, MakeError>>
```

**Cache mutation policy (R3)**: actions return the Result; they do NOT mutate `types.value`. All cache updates happen in the event subscription handler. This eliminates the double-update drift that the draft originally had.

Exception: `savingType` / `regeneratingForId` / `favoriteToggling` loading flags are managed by actions (start/end) since they're tied to call lifetime, not to event reception.

### Optimistic favorite flip (R1)

Replaces the draft's pending-opacity-only approach. Now possible because `toggleFavorite` returns `Result`.

```ts
async function toggleFavorite(typeId: TypeId): Promise<Result<boolean, MakeError>> {
  const svc = getMakeService();
  if (svc === null) return err({ kind: 'vault-error', cause: 'make module not ready' });
  const started = new Set(favoriteToggling.value); started.add(typeId); favoriteToggling.value = started;
  // Optimistic UI: the star flips immediately because isFavorite() reads from getMakeSettings(),
  // and we don't block the star's render on the toggle completing. If the service fails, the
  // make:favorite-toggled event doesn't fire, and on Result err we manually refresh settings
  // to recover the true state.
  const result = await svc.toggleFavorite(typeId);
  const done = new Set(favoriteToggling.value); done.delete(typeId); favoriteToggling.value = done;
  if (result.kind === 'err') {
    // Rollback: force a settings re-read so the store's favoriteTypes getter picks up
    // the true (unchanged) state on next render.
    // Implementation detail: getMakeSettings() currently reads module state directly, which
    // should already reflect truth. The rollback is essentially a no-op at the data layer;
    // the UI re-renders when favoriteToggling flag clears, at which point the star reflects
    // the unchanged settings.
  }
  return result;
}
```

Star's visual reasoning (from the page's perspective):
- `isFavorited = isFavorite(typeId)` — reads from `getMakeSettings().favorites`, always reflects truth post-save.
- `isPending = favoriteToggling.value.has(typeId)` — true during the call.
- `starClasses = { filled: isFavorited, pending: isPending }` — pending class adds `aria-busy` + opacity.

On optimistic flip with rollback: since `getMakeSettings()` only reflects what's been saved, the "optimistic" part is really just: allow the click through even while the service is in flight. On success, event propagates and settings update. On failure, settings never updated → no UI flip. User sees the star briefly appear pending, then resolve to its true state — which matches the expected flow for a toggle that might fail.

### Cross-domain event subscriptions (R2 — corrected from draft)

Event channel contract:

```ts
// src/modules/make/events.ts (NEW — explicit event definitions)
import type { TypeSchema } from '../../domain/make/type-schema.js';
import type { TypeId } from '../../domain/make/types.js';

export type MakeEventMap = {
  'make:type-created':         { schema: TypeSchema };
  'make:type-updated':         { schema: TypeSchema };
  'make:type-deleted':         { typeId: TypeId; name: string };
  'make:favorite-toggled':     { typeId: TypeId; favorited: boolean };
  'make:base-file-regenerated': { typeId: TypeId; path: string };
};
```

These channels are added to the global `EventMap` via TypeScript declaration merging (existing Agentonomous convention — check `src/domain/shared/event-bus.ts` for the extension point).

`make-module.ts` exports:

```ts
export function subscribeMakeEvents(handlers: {
  onTypeCreated?:     (event: MakeEventMap['make:type-created']) => void;
  onTypeUpdated?:     (event: MakeEventMap['make:type-updated']) => void;
  onTypeDeleted?:     (event: MakeEventMap['make:type-deleted']) => void;
  onFavoriteToggled?: (event: MakeEventMap['make:favorite-toggled']) => void;
  onBaseRegenerated?: (event: MakeEventMap['make:base-file-regenerated']) => void;
}): () => void {
  if (state === null) return () => {};
  const unsubscribers: (() => void)[] = [];
  if (handlers.onTypeCreated)     unsubscribers.push(state.ports.eventBus.on('make:type-created',     handlers.onTypeCreated));
  if (handlers.onTypeUpdated)     unsubscribers.push(state.ports.eventBus.on('make:type-updated',     handlers.onTypeUpdated));
  if (handlers.onTypeDeleted)     unsubscribers.push(state.ports.eventBus.on('make:type-deleted',     handlers.onTypeDeleted));
  if (handlers.onFavoriteToggled) unsubscribers.push(state.ports.eventBus.on('make:favorite-toggled', handlers.onFavoriteToggled));
  if (handlers.onBaseRegenerated) unsubscribers.push(state.ports.eventBus.on('make:base-file-regenerated', handlers.onBaseRegenerated));
  return () => { for (const u of unsubscribers) u(); };
}
```

Store subscription (single mutation point per R3):

```ts
const unsubscribeEvents = subscribeMakeEvents({
  onTypeCreated: ({ schema }) => {
    if (!types.value.some((t) => t.id === schema.id)) types.value = [...types.value, schema];
  },
  onTypeUpdated: ({ schema }) => {
    types.value = types.value.map((t) => t.id === schema.id ? schema : t);
  },
  onTypeDeleted: ({ typeId }) => {
    types.value = types.value.filter((t) => t.id !== typeId);
    // Clear related maps.
    const nextInstances = new Map(instancesByTypeId.value); nextInstances.delete(typeId); instancesByTypeId.value = nextInstances;
    const nextInstanceErr = new Map(instancesError.value); nextInstanceErr.delete(typeId); instancesError.value = nextInstanceErr;
    const nextRegenErr = new Map(regenerationError.value); nextRegenErr.delete(typeId); regenerationError.value = nextRegenErr;
  },
  onFavoriteToggled: () => {
    // No-op at the store level; favoriteTypes getter re-reads getMakeSettings() on next access.
    // Triggering reactivity via a noop write is unnecessary — the store's getters depend on
    // types.value AND getMakeSettings(), so any subsequent mutation re-evaluates. However,
    // to ensure immediate UI refresh after a toggle, we assign types.value = [...types.value]
    // to force dependent computeds to re-evaluate.
    types.value = [...types.value];
  },
  onBaseRegenerated: ({ typeId }) => {
    // Refetch the single type so committedType picks up the new baseFile.generatedAt.
    void loadTypes(); // simpler than surgically refreshing one type
  },
});
```

**Architectural tech-debt note**: the `subscribeMakeEvents` / `getMakeService` / `getMakeSettings` pattern is the UI reaching into module state — acceptable Chunk 2 expedient, but growing. Chunk 3.5 or Chunk 5 will refactor to pass these through the `PluginContext` provided to the Vue app at mount time, via Vue provide/inject. Documented intent.

### Store cleanup on dispose

Setup-syntax Pinia stores don't have explicit dispose hooks, but the Vue app is recreated per `createVueApp` call (Chunk 2's pattern). When the Obsidian leaf closes and `MakeView.onClose` unmounts the app, the event-bus listeners registered via `subscribeMakeEvents` are garbage-collected with the store instance.

Defensive measure: register the `unsubscribeEvents` callback in a module-scoped `WeakSet` that `PluginCore`'s existing listener-leak tripwire can audit. Already the pattern for `event-inspector` and `health-monitor` stores.

## 8. i18n wiring + new keys

### Runtime wiring (Chunk 2 backfill + Chunk 3)

Per mid-S8 (i), Chunk 3 wires `t()` live throughout all Make pages (including Chunk 2's pages that currently hardcode English). Plumbing:

- **TranslationPort injection**: `PluginContext` already exposes `t` via the Vue provide/inject pattern (`plugin-context-key.ts`). Pages use `const { t } = usePluginContext()` (existing helper) or `const t = inject(PluginContextKey)!.t`.
- **No `vue-i18n` integration** — Agentonomous uses the plugin's own `TranslationPort`. Spec stays on that path.
- **Each updated page's test** replaces any hardcoded-English assertion with the corresponding key lookup.
- **Dead-key backfill**: Chunk 2 shipped `make.home.title`, `make.types.title`, `make.types.empty`, `make.types.refresh`, `make.type.folderLabel`, `make.type.tabs.fields`, `make.type.tabs.instances`, `make.type.fields.empty`, `make.type.fields.titleBadge`, `make.type.fields.required`, `make.type.instances.empty`, `make.type.instances.createdLabel`, `make.home.blurb`, `make.home.browseTypesCta`, `make.home.empty`, `make.home.favoritesHeading`, `make.types.countOne`, `make.types.countOther`, `make.types.instancesCountOne`, `make.types.instancesCountOther`, `make.notify.typeNotFound`, `make.error.notReady`. All get wired in Task 3.5.

### New keys for Chunk 3 (~50)

```json
"make.notify.baseDeleteFailed": "Type deleted, but the base file could not be removed",
"make.notify.baseLeftAlone": "Base file is outside the current bases folder and was not deleted",
"make.notify.typeRenamed": "Type renamed",
"make.notify.baseRegenerated": "Table view regenerated",
"make.error.favoriteFailed": "Could not update favorites",
"make.error.duplicateName": "A type named \"{name}\" already exists",
"make.error.invalidName": "Invalid type name",
"make.error.invalidFolder": "Invalid instances folder",
"make.error.saveFailed": "Save failed: {cause}",
"make.error.deleteFailed": "Delete failed: {cause}",
"make.error.regenerateFailed": "Regenerate failed: {cause}",
"make.error.baseStampFailed": "Type saved but the base file reference could not be updated — regenerate to fix",
"make.type.create.title": "New type",
"make.type.create.cta": "Create type",
"make.type.edit.save": "Save changes",
"make.type.edit.cancel": "Cancel",
"make.type.edit.delete": "Delete type",
"make.type.edit.unsaved": "Unsaved changes",
"make.type.edit.unsavedIndicator": "●",
"make.type.edit.saving": "Saving…",
"make.type.edit.addField": "Add field",
"make.type.edit.removeField": "Remove field {index}",
"make.type.edit.moveUp": "Move field {index} up",
"make.type.edit.moveDown": "Move field {index} down",
"make.type.edit.createButtonLive": "Create {name}",
"make.type.schema.name": "Name",
"make.type.schema.nameRequired": "*",
"make.type.schema.description": "Description",
"make.type.schema.folder": "Instances folder",
"make.type.schema.folderRequired": "*",
"make.type.schema.titleField": "Title field",
"make.type.schema.noTitleField": "No title field — use explicit filename on create",
"make.type.schema.noTextFieldsAvailable": "Add a text field before choosing a title field",
"make.type.schema.folderOrphansWarning": "Moving this folder means existing notes won't be linked to this type. They'll stay in their current folder but won't appear in the Instances list. Coming in a later update: automatic move.",
"make.type.field.kind": "Kind",
"make.type.field.kindLabel": "Field {index} kind",
"make.type.field.nameLabel": "Field {index} name",
"make.type.field.labelLabel": "Field {index} label",
"make.type.field.requiredLabel": "Field {index} required",
"make.type.field.descriptionLabel": "Field {index} description",
"make.type.field.titleBadge": "title field",
"make.type.basefile.missing.title": "Table view missing",
"make.type.basefile.missing.body": "The table view for this type hasn't been generated yet. Regenerate to create it.",
"make.type.basefile.stale.title": "Table view out of date",
"make.type.basefile.stale.body": "The schema changed since the table view was generated on {date}. Regenerate to bring it up to date.",
"make.type.basefile.regenerateCta": "Regenerate table view",
"make.type.basefile.regenerating": "Regenerating…",
"make.type.basefile.overwriteWarning.title": "Table view has been hand-edited",
"make.type.basefile.overwriteWarning.body": "The table view file has changes that don't match what Make would generate. Regenerating will overwrite those changes. Continue?",
"make.type.basefile.overwriteWarning.confirm": "Overwrite",
"make.type.unsaved.title": "Unsaved changes",
"make.type.unsaved.body": "You have unsaved changes to this type. Save, discard, or cancel navigation?",
"make.type.unsaved.save": "Save",
"make.type.unsaved.discard": "Discard",
"make.type.unsaved.cancel": "Cancel",
"make.type.renameWarning.title": "Field rename will orphan frontmatter",
"make.type.renameWarning.body": "Renaming {oldName} to {newName} will orphan frontmatter on {count} existing instances. Their notes remain but the old field name won't appear in the type. Continue?",
"make.type.favoriteAdd": "Add {name} to favorites",
"make.type.favoriteRemove": "Remove {name} from favorites",
"make.delete.title": "Delete type \"{name}\"?",
"make.delete.typeFile": "The type definition file {path} will be deleted.",
"make.delete.hasInstancesOne": "This type has 1 existing note in {folder}. The note will be kept and will still open in Obsidian as regular markdown, but it won't be linked to any type anymore.",
"make.delete.hasInstancesOther": "This type has {count} existing notes in {folder}. The notes will be kept and will still open in Obsidian as regular markdown, but they won't be linked to any type anymore.",
"make.delete.noInstances": "This type has no instances.",
"make.delete.checkingInstances": "Checking instance count…",
"make.delete.alsoDeleteBase": "Also delete the generated table view file",
"make.delete.trashNote": "Deleted files move to Obsidian's configured trash — you can restore them there.",
"make.delete.confirm": "Delete type",
"make.delete.cancel": "Cancel",
"make.delete.deleting": "Deleting…"
```

**Obsidian Notice a11y note**: `ports.notifications.*` wraps Obsidian's `new Notice()`, which renders into a DOM region with `aria-live="polite"`. No additional plumbing required for success/info notifications — screen readers announce them automatically.

## 9. File inventory

**Modify** (10 files):
- `src/modules/make/make-service.ts` — 5 write methods, orphan-base reconciliation in loadType
- `src/modules/make/make-module.ts` — export `subscribeMakeEvents`, emit events from service actions
- `src/modules/make/events.ts` **(NEW)** — `MakeEventMap` + EventMap declaration merge
- `src/modules/make/locales/en.json` — ~50 new keys
- `src/ui/stores/make-store.ts` — 5 new actions + state + event subscription (cache-mutation in handlers)
- `src/ui/router/index.ts` — add `/make/types/new` route
- `src/ui/AppRoot.vue` — add `:key="$route.fullPath"` to `<router-view>`
- `src/ui/pages/make/MakeType.vue` — new-mode detection via composable, save/cancel flow, delete trigger, banner, unsaved guard, a11y-complete tab pattern
- `src/ui/pages/make/MakeTypes.vue` — "Create type" button, clickable favorite star, a11y-complete
- `src/ui/pages/make/MakeHome.vue` — "Create type" buttons (empty and populated states)

**Delete** (1 file):
- `src/ui/pages/make/MakeTypeFields.vue` — replaced by `MakeTypeFieldsEditor.vue`

**Create** (22 files):
- `src/domain/make/draft-equality.ts` + `.test.ts`
- `src/ui/pages/make/use-make-type-draft.ts` + `.test.ts`
- `src/ui/pages/make/MakeTypeFieldsEditor.vue` + `.test.ts` + `.stories.ts`
- `src/ui/pages/make/MakeTypeSchemaDetails.vue` + `.test.ts` + `.stories.ts`
- `src/ui/pages/make/MakeTypeFieldRow.vue` + `.test.ts` + `.stories.ts`
- `src/ui/pages/make/MakeTypeBaseBanner.vue` + `.test.ts` + `.stories.ts`
- `src/ui/components/make/ConfirmDialog.vue` + `.po.ts` + `.test.ts` + `.stories.ts`
- `src/ui/components/make/DeleteTypeDialog.vue` + `.po.ts` + `.test.ts` + `.stories.ts`

**PO updates** (3 files):
- `MakeType.po.ts` — delete-button, save-footer, base-banner, tab-unsaved-indicator, unsaved-dialog
- `MakeTypes.po.ts` — "Create type" button, favorite-star click
- `MakeHome.po.ts` — "Create type" buttons

**Test additions to existing files** (2 files):
- `make-module.test.ts` — `subscribeMakeEvents` helper tests
- `make-service.test.ts` — extensive write-method coverage + orphan-base reconciliation + user-edit protection + rename detection

Total: 10 modified + 1 deleted + 22 created = 33 file-touches, plus PO + existing-test extensions. Higher than Chunk 2's 27 file-touches, primarily due to the new composable, new domain helpers file, and `ConfirmDialog` + `DeleteTypeDialog` split.

## 10. Task sequencing (17 tasks)

TDD-ordered. Commits land on green tests.

| # | Task |
|---|---|
| 3.1 | `draft-equality.ts` + tests (pure domain) |
| 3.2 | `src/modules/make/events.ts` + `MakeEventMap` declaration merge; `subscribeMakeEvents` helper in module + tests |
| 3.3 | `MakeService.createType` (validation + disk slug probe + two-step write + partial-success path + event) + tests |
| 3.4 | `MakeService.updateType` (field-rename detection + acknowledgeRenames option + event) + tests |
| 3.5 | `MakeService.deleteType` (base-path safety + `not-implemented` cascade error + event) + `regenerateBaseFile` (user-edit check + force flag + event) + `toggleFavorite` (Result + event) + tests |
| 3.6 | `MakeError` variant extension (`not-implemented.feature`), `SchemaError.field-rename-warning` — typecheck pass |
| 3.7 | i18n — add Chunk 3 keys + backfill Chunk 2 dead keys + wire `t()` in `MakeHome` / `MakeTypes` / `MakeType` / `MakeTypeInstances` |
| 3.8 | Store — 5 new actions + state refs + event subscription (handlers are sole cache mutators); orphan-base reconciliation in `loadTypes` |
| 3.9 | Route `/make/types/new` + ordering test; `AppRoot.vue` `:key="$route.fullPath"`; navigation tests |
| 3.10 | `useMakeTypeDraft` composable + tests |
| 3.11 | `ConfirmDialog.vue` + PO + tests + stories (a11y-complete: role, focus trap, return focus, keyboard) |
| 3.12 | `MakeTypeBaseBanner.vue` + tests + story |
| 3.13 | `MakeTypeSchemaDetails.vue` + tests + story (a11y: required/aria-required/aria-describedby) |
| 3.14 | `MakeTypeFieldRow.vue` + tests + story (a11y: per-cell aria-label, arrow buttons, focus management on remove) |
| 3.15 | `MakeTypeFieldsEditor.vue` + tests + story; delete `MakeTypeFields.vue` |
| 3.16 | `DeleteTypeDialog.vue` + PO + tests + story (wraps ConfirmDialog) |
| 3.17 | Wire `MakeType.vue` — new-mode, draft composable, save/cancel, delete trigger, banner, router guard, tab a11y (`role="tabpanel"`, `aria-controls`, roving tabindex), mobile-responsive row layout |
| 3.18 | Wire `MakeTypes.vue` + `MakeHome.vue` — Create entry points + clickable favorite stars (as `<button>` with `aria-pressed`) |
| 3.19 | End-of-chunk verification: `npm test`, `npm run build`, Storybook smoke, manual Obsidian smoke (create, edit, delete, favorite toggle, regenerate, user-edit protection, rename warning, keyboard nav), tag `make-slice-3` |

19 tasks (original draft was 15; review added `draft-equality`, typed events module, explicit `MakeError` variant task, composable, `ConfirmDialog` split).

## 11. Success criteria

Chunk 3 is done when:
- All 19 tasks committed; tag `make-slice-3` placed.
- `npm test` passes (~620+ tests; Chunk 2 ended at 533; Chunk 3 adds service, store, composable, 6 component test files, and expanded page tests).
- `npm run build` produces `dist/main.js`; Storybook smoke exits clean.
- Lint clean (no new errors; pre-existing complexity warnings OK); typecheck clean.
- **Manual smoke test** in test vault:
  - From MakeHome empty state: click "Create type" → fill out a type → Save → land on `/make/types/<id>` with Fields tab showing the new schema.
  - Edit the type's name → Save → `● Unsaved` badge clears, notification; banner appears (base out of date).
  - Click "Regenerate table view" → banner disappears; new `.base` file on disk.
  - Toggle favorite star on MakeTypes row → star fills; chip appears on MakeHome.
  - Rename a field → confirm dialog appears with instance count → Continue → save succeeds.
  - Open delete dialog → see instance count → check "Also delete the generated table view file" → Delete → both files trashed; redirected to MakeTypes.
  - **Keyboard-only run-through**: tab to "Create type" → Enter → fill with keyboard → Tab to Save → Enter. All interactions reachable without a mouse.
- **Accessibility verification**: use Chrome DevTools "Accessibility" pane to verify (a) `role="alertdialog"` on dialogs, (b) `aria-controls` linking tabs to panels, (c) roving tabindex navigates tabs with arrow keys, (d) favorite button has dynamic `aria-label` + `aria-pressed`, (e) inputs with errors have `aria-invalid="true"` + `aria-describedby`.
- No new `any` / `@ts-ignore` / `TODO` / `FIXME`.
- `alsoDeleteInstances: true` guard returns `not-implemented` error kind (not `vault-error`) — exercised by a dedicated test.

## 12. Chunk 3.5 outbox (hardening backlog)

Items deferred from this review's Should-fix findings. Each is a focused piece of operational hardening that deserves its own spec + tests. Kept in this document to avoid loss.

1. **Optimistic concurrency across leaves/devices**: capture `stat.mtime` on `loadType`; re-check before `updateType` / `deleteType`; on mismatch return new `MakeError { kind: 'stale-write', currentMtime }`; UI surfaces "This type was changed elsewhere — reload to see the changes or overwrite?" dialog.
2. **Save-time notices for field `kind` changes and title-field renames**: detect in `updateType` + `deleteType`; emit `SchemaError` sub-variants similar to `field-rename-warning`; UI shows `ConfirmDialog` with affected-instance counts.
3. **Persistent post-save orphan banner** after `instancesFolder` rename: stays visible on the type page until user acknowledges or Chunk 4 ships the file-move affordance.
4. **Relative `baseFile.path` storage**: store `{ id: string; generatedAt: string }` instead of absolute path; resolve via settings at read time. Makes vault relocation + `basesFolder` setting changes safe.
5. **Granular per-field rename count** in `field-rename-warning` (Chunk 3 reports single aggregate).
6. **`PluginContext`-based refactor** of `getMakeService` / `getMakeSettings` / `subscribeMakeEvents` — move from module-state reach-in to Vue provide/inject. Documented tech debt.
7. **VaultPort atomic-write guarantee** formalized in `src/domain/shared/vault-port.ts` JSDoc.
8. **Precise base-file divergence check** (currently byte-compare; upgrade to canonical-form compare that ignores whitespace/line-ending differences).
9. **External-update-during-dirty-draft recovery** — leaf A has dirty draft; external `make:type-updated` fires → "This type changed elsewhere — reload or overwrite?" dialog.
10. **External-delete-during-edit recovery** — leaf A is editing; leaf B deletes → "Type was deleted — download draft as JSON?" recovery offer.
11. **Favorite drift backstop** — periodic re-read of settings after `toggleFavorite` resolve, as safety net for missed events.

## 13. Risks (Chunk 3 scope)

1. **New `MakeError.not-implemented.feature`** breaks consumers that exhaustively switch on `not-implemented` without reading the extension. Mitigation: the `feature` property is optional; existing handlers without `feature` still match structurally. Search for all `case 'not-implemented':` during Task 3.6 and ensure no-one will silently miss the new discriminator.
2. **Two-step `createType` partial state** — reconciliation in `loadType` handles it, but adds a code path only exercised under crash scenarios. Unit test with mocked vault-err on step 7 covers this.
3. **Slug collision against disk probe**: `vault.exists` is async — the 100-iteration loop adds latency. In practice <2ms per check; worst case (50+ types all colliding on slugification) is <200ms, still under user-perceivable threshold. Acceptable.
4. **Orphan-base reconciliation** silently adopts pre-existing `.base` files as belonging to the recovered schema. If a user manually dropped a `.base` file that happens to match the id, it's now "owned" by Make. Risk is low (users don't randomly create `.base` files) but noted.
5. **`ConfirmDialog` focus trap** is a known-tricky pattern — implementation will lean on a well-audited minimal focus-trap (no external dep; ~40 lines of Vue + keyboard event handling). Dedicated test coverage in Task 3.11.
6. **Mobile row layout** CSS untested in this spec — manual smoke in Obsidian mobile included in §11.
7. **Optimistic favorite flip can briefly show wrong state** if the service round-trip is slow; acceptable for a rare failure mode (settings write failing).
8. **i18n backfill scope** — touching every Chunk 2 Vue file carries merge-conflict risk if Chunk 2 follow-ups land concurrently. Mitigation: Chunk 3 runs in a single worktree; backfill task (3.7) is early enough that downstream tasks see the wired components.

## 14. Reminders for Chunk 4 planner

- Re-enable cascade checkbox in `DeleteTypeDialog`; implement `alsoDeleteInstances: true` branch.
- Corrupt type file UI surface (deferred from Chunks 2+3).
- Instance CRUD + "Open in Obsidian" row action on `MakeTypeInstances`.
- `instancesFolder` file-move physics on rename.
- Post-save orphan banner (from Chunk 3.5 if not already shipped).
