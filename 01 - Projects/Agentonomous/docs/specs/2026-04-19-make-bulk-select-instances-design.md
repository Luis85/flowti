# Bulk-select on instances — design

**Status:** Draft
**Date:** 2026-04-19
**Polish item:** Polish P1 — Bulk-select on instances
**Module:** `make`

## Motivation

`MakeTypeInstances.vue` lists every instance of a given type. Today the only way to delete more than one is to confirm a per-row delete dialog once per file. For a Book type with twenty entries, that's twenty separate confirmations. We need a bulk path: select N rows, confirm once, delete them as a single user-visible operation.

This work is the final outstanding item in the current Polish chunk that has otherwise reshaped the move/delete/cascade flows (P0 #1–5, P1 #7–12). The design deliberately reuses the conventions established by that chunk — partial-result dialogs, single-flight per-`typeId` locks, structured `{successes, failures}` reports — instead of inventing new patterns.

## Decisions (locked in during brainstorming)

| # | Decision | Rationale |
|---|---|---|
| 1 | **Scope:** bulk delete only | YAGNI. Bulk open-in-tabs is a real convenience but not painful today (one click per row). Bulk move across types is semantically muddy because instance schemas differ between types. |
| 2 | **UX pattern:** "Select" mode toggle in the header | Always-visible checkboxes add permanent visual weight; modifier-key click has poor discoverability. A toggle keeps the default view clean and gives a clear home for the bulk toolbar. |
| 3 | **Failure semantics:** partial-result dialog with Retry | Reuses the dialog shape introduced in Polish P0 #3 for partial moves. Established convention for "partial success on a multi-item operation" in this module. |
| 4 | **Service shape:** new `service.deleteInstances(paths[])` + new `make:instances-deleted-batch` event | Single refresh per batch (vs. N refreshes if the store loops), structured `{deletedPaths, failures}` return mirrors `moveReport` from `updateType`, and slots cleanly next to the recently-split `instance-deleted` / `orphan-deleted` event pair from Polish P1 #10. |

## Architecture

```
MakeTypeInstances.vue (UI)
   ├─ select mode toggle ("Select" / "Done")
   ├─ checkbox column (only in select mode)
   ├─ selection toolbar (count, Delete selected, Done)
   └─ partial-result ConfirmDialog (reuse existing component)
        ↓ store.bulkDeleteInstances(typeId, paths[])
make-store.ts
   ├─ bulkDeleting: ref<Set<TypeId>>             (single-flight key set)
   └─ bulkDeleteInstances(typeId, paths[])
        ↓ ctx.service.deleteInstances(typeId, paths)
make-service-instances.ts
   ├─ deleteInstances(typeId, paths[])           → Result<BulkDeleteReport, MakeError>
   └─ emits make:instances-deleted-batch          { typeId, deletedPaths, failures }
       ↓
store subscription → loadInstances(typeId)        (single refresh, not N)
```

Selection state lives in the **page component**, not the store — selection is per-view-instance and survives only as long as the user is on that type's page. The store owns the `bulkDeleting` lock set and the bulk action method.

## Domain & service surface

### New types

```ts
// src/domain/make/types.ts (or alongside existing make types)
export type BulkDeleteReport = {
  deletedPaths: readonly string[];
  failures:     ReadonlyArray<{ path: string; error: string }>;
};
```

### New service method

In `src/modules/make/make-service-instances.ts`:

```ts
async function deleteInstances(
  typeId: TypeId,
  paths: readonly string[],
): Promise<Result<BulkDeleteReport, MakeError>>;
```

**Behavior:**
- Sequential iteration over `paths`, calling `ports.vault.delete(path)` for each. Sequential (not parallel) because Obsidian's vault adapter isn't documented as concurrency-safe and the existing single-item `deleteInstance` is already sequential.
- Collects per-path failures; never short-circuits on a single failure.
- Outer `Result.err` only on truly catastrophic conditions; normal partial failures return `Result.ok` with a populated `failures[]`. Same shape convention as Polish P0 #2 (move-report).
- Empty `paths` → returns `ok({deletedPaths:[], failures:[]})` and emits no event.
- Emits **one** `make:instances-deleted-batch` event with `{typeId, deletedPaths, failures}`. Does NOT emit per-path `make:instance-deleted` (otherwise the store would refresh once per item, defeating the point).
- The service trusts the caller's `typeId` and does NOT call `inferTypeId` per path. Orphan handling is out of scope — orphans aren't selectable from the page UI because the page only renders instances whose `typeId` matches.

### New event

```ts
// add to the make event map
'make:instances-deleted-batch': {
  typeId:       TypeId;
  deletedPaths: readonly string[];
  failures:     ReadonlyArray<{ path: string; error: string }>;
};
```

The single-item `make:instance-deleted` and `make:orphan-deleted` events stay as-is — single-delete paths are unchanged.

## Store changes

### New reactive state

```ts
const bulkDeleting = ref<Set<TypeId>>(new Set());
```

Mirrors the existing `savingType` and `regeneratingForId` per-`TypeId` set patterns.

### New action

```ts
async function bulkDeleteInstances(
  typeId: TypeId,
  paths: readonly string[],
): Promise<Result<BulkDeleteReport, MakeError>> {
  if (paths.length === 0) return ok({ deletedPaths: [], failures: [] });
  if (bulkDeleting.value.has(typeId) || savingType.value.has(typeId)) {
    return err({ kind: 'busy' });
  }
  const next = new Set(bulkDeleting.value); next.add(typeId); bulkDeleting.value = next;
  try {
    return await ctx.service.deleteInstances(typeId, paths);
  } finally {
    const done = new Set(bulkDeleting.value); done.delete(typeId); bulkDeleting.value = done;
  }
}
```

**Lock interaction:** bulk delete shares the per-`typeId` lock space with `updateType` (folder move) — moving the folder mid-bulk-delete would orphan paths. Same single-flight pattern as Polish P1 #9, just one more participant in the lock check.

### New event subscription

```ts
onInstancesDeletedBatch: ({ typeId }) => {
  safeRefresh('instances-deleted-batch', () => loadInstances(typeId));
},
```

Single refresh per batch, regardless of size.

### Export

Add `bulkDeleteInstances` and `bulkDeleting` to the store's return object alongside `deleteInstance`.

## UI: select mode, toolbar, keyboard

### Page-local state

In `MakeTypeInstances.vue`:

```ts
const selectMode    = ref(false);
const selectedPaths = ref<Set<string>>(new Set());
const pendingBulkDelete = ref(false);                 // drives the confirm dialog
const bulkResult    = ref<BulkDeleteReport | null>(null);   // drives the partial-result dialog
```

### Header

The header gets a "Select" toggle button next to the existing "+ New" button. When `selectMode` is true:
- Per-row Open/Delete buttons are hidden.
- A checkbox appears at the start of every row.
- The header layout switches to a **selection toolbar** that replaces the "+ New" button area.

### Selection toolbar (in select mode)

```
[ ☐/☑ select-all ]  N selected  [ Delete selected ]  [ Done ]
```

- **Select-all checkbox:** tristate (none / some / all). Click toggles all-or-none of the visible sorted instances.
- **Delete selected:** disabled when `selectedPaths.size === 0` or `bulkDeleting.has(typeId)`. Click opens a destructive ConfirmDialog (cascade-style):
  - Title: "Delete {count} selected instances?"
  - Body: "Files go to Obsidian trash and can be restored."
  - Confirm label: "Delete {count} files"
  - Destructive + uses the busy-spinner affordance from P0 #4 while the operation runs.
  - On confirm → calls `store.bulkDeleteInstances(typeId, [...selectedPaths])`.
- **Done:** exits select mode, clears `selectedPaths`. Disabled (or guarded with a busy toast) while `bulkDeleting.has(typeId)`.

### On result

- `failures.length === 0` → success notification ("Deleted {count} instances"), exit select mode, clear selection.
- `failures.length > 0` → open the partial-result ConfirmDialog (Polish P0 #3 shape):
  - Title: "Some files couldn't be deleted"
  - Body: "{ok} of {total} deleted. {fail} remain: {paths}" — paths truncated with "+N more" past the first three.
  - Confirm: "Retry failed files" — calls `bulkDeleteInstances(typeId, failures.map(f => f.path))`.
  - Cancel: "Dismiss" — leaves failed paths in `selectedPaths` so the user can choose another action.

### Keyboard a11y (extends the existing roving tabindex from P1 #8)

Default mode keys are unchanged. In select mode:

| Key | Action |
|-----|--------|
| `Space` | Toggle selection of focused row. |
| `Ctrl/Cmd+A` | Select all visible rows. |
| `Esc` | Exit select mode and clear selection. |
| `Enter` | Open focused row (unchanged). |
| `Delete` | Per-row delete confirm (unchanged — single delete still useful in select mode). |
| `Arrow / Home / End` | Roving navigation (unchanged). |

In select mode the list gets `aria-multiselectable="true"`; rows get `aria-selected="true|false"`.

### Selection hygiene

- After every list refresh, filter `selectedPaths` against the current `sorted` paths (drop any that no longer exist).
- Exiting select mode always clears `selectedPaths`.
- Mode toggle is blocked from off→on while a refresh is loading (prevents racey selection of stale rows). On→off is blocked while `bulkDeleting.has(typeId)`.

## Error handling

| Condition | Behavior |
|---|---|
| `bulkDeleteInstances` returns `Result.err({kind:'busy'})` | Toolbar's "Delete selected" stays disabled visually; if somehow triggered, surface a "Bulk delete already in progress" toast. |
| Per-path vault errors | Land in `failures[]` and feed the partial-result dialog. Never thrown. |
| Stale paths (file removed by another session mid-operation) | Land in `failures[]` with the vault's not-found error; user can dismiss safely. |
| Type folder moved mid-operation | Prevented by the shared per-`typeId` lock — `updateType` cannot start while `bulkDeleting.has(typeId)` and vice versa. |

## i18n keys (new)

All under `make.instances.bulk.*`:

| Key | English |
|---|---|
| `select-button` | "Select" |
| `done-button` | "Done" |
| `select-all-aria` | "Select all instances" |
| `count` | "{count} selected" |
| `delete-button` | "Delete selected" |
| `confirm.title` | "Delete {count} selected instances?" |
| `confirm.body` | "Files go to Obsidian trash and can be restored." |
| `confirm.confirm` | "Delete {count} files" |
| `confirm.cancel` | "Cancel" |
| `partial.title` | "Some files couldn't be deleted" |
| `partial.body` | "{ok} of {total} deleted. {fail} remain: {paths}" |
| `partial.confirm` | "Retry failed files" |
| `partial.cancel` | "Dismiss" |
| `notification.success` | "Deleted {count} instances" |
| `busy-toast` | "Bulk delete already in progress" |

## Testing strategy (TDD)

### Domain / service — `tests/modules/make/make-service-instances.test.ts`

- `deleteInstances` with all-success: returns `{deletedPaths: paths, failures: []}` and emits exactly one `make:instances-deleted-batch` event with the matching payload.
- Mixed success/failure: vault.delete fails for some paths → returns ok with a populated `failures[]` and emits one batch event with both arrays correctly populated.
- Empty `paths`: returns `ok({deletedPaths:[], failures:[]})` and emits no event.
- Sequential ordering: vault.delete called once per path, in the order provided.
- Does NOT emit per-path `make:instance-deleted` events.

### Store — `tests/ui/stores/make-store.test.ts`

- `bulkDeleteInstances(typeId, paths)` toggles `bulkDeleting` set around the call (added before service call, removed after).
- Concurrent call on same `typeId` returns `err({kind:'busy'})` without invoking the service.
- Concurrent call when `savingType.has(typeId)` (i.e., `updateType` mid-flight) also returns `busy`.
- Empty paths returns `ok` immediately without invoking the service.
- `make:instances-deleted-batch` subscription triggers exactly one `loadInstances(typeId)` call regardless of `deletedPaths.length`.

### Page — `tests/ui/pages/make/MakeTypeInstances.test.ts`

- Select toggle: clicking switches mode; per-row delete buttons hide; checkbox column appears.
- Select-all tristate: cycles none → all → none; reflects "some" state when partial.
- Selection hygiene: after a refresh that removes some paths, `selectedPaths` no longer contains them.
- Confirm dialog: opens with correct count in title and body; on confirm, calls `store.bulkDeleteInstances` with the selected paths.
- Success path: success notification fires, select mode exits, selection clears.
- Partial-failure path: partial dialog opens with correct counts and a truncated path list ("+N more" past three); Retry calls `bulkDeleteInstances` with only the failed paths; Dismiss leaves them selected.
- Keyboard: `Space` toggles selection of focused row; `Ctrl+A` selects all; `Esc` exits and clears.
- a11y: list has `aria-multiselectable="true"` in select mode; rows have `aria-selected` reflecting selection state.

### Storybook — `stories/components/make/ConfirmDialog.stories.ts`

- `BulkDeleteConfirm` — destructive, 3 selected, cascade-style copy.
- `BulkDeletePartial` — 5 of 10 deleted, +3 more failed paths, Retry/Dismiss labels.

## Out of scope (deferred)

- **Bulk move (across types)** — semantic muddle (instance schemas differ); no current pain point.
- **Bulk open in tabs** — single-click per row is acceptable today.
- **Cross-page selection persistence** — selection clears on navigation away from the type's page.
- **Undo affordance** — Obsidian's trash + per-file restore is the existing safety net; consistent with the single-delete UX.

## Files touched (preview)

| Layer | File | Change |
|---|---|---|
| domain | `src/domain/make/types.ts` (or sibling) | Add `BulkDeleteReport` type |
| domain | event map | Add `make:instances-deleted-batch` event type |
| service | `src/modules/make/make-service-instances.ts` | Add `deleteInstances` |
| service | service factory return | Export `deleteInstances` |
| store | `src/ui/stores/make-store.ts` | Add `bulkDeleting` state, `bulkDeleteInstances` action, batch event subscription |
| ui | `src/ui/pages/make/MakeTypeInstances.vue` | Select mode, toolbar, keyboard, dialogs |
| i18n | locale files | New `make.instances.bulk.*` keys |
| tests | service / store / page / storybook | Per the testing strategy section |
