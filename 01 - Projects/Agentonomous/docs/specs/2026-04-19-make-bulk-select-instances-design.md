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
| 4 | **Service shape:** new `service.deleteInstances(typeId, paths[])` + new `make:instances-deleted-batch` event | Single refresh per batch (vs. N refreshes if the store loops), structured `{deletedPaths, failures}` return mirrors `moveReport` from `updateType`, and slots cleanly next to the recently-split `instance-deleted` / `orphan-deleted` event pair from Polish P1 #10. |
| 5 | **Real serialization with `updateType` happens at the service layer** via a per-`typeId` promise queue extracted from `update-type-ops.ts` into a shared util used by both `updateType`/`retryFailedMoves` and the new `deleteInstances`. The store-level `bulkDeleting` set is an optimistic UI guard only. | Polish P1 #9 already serializes `updateType`/`retryFailedMoves` with a service-level `chains: Map<string, Promise>`. Adding the new bulk-delete to that same chain (rather than reimplementing in the store) is the only way to actually prevent a folder-move + bulk-delete race. The store-level set is kept for cheap UI affordances (disable buttons, hide spinners). |

## Architecture

```
MakeTypeInstances.vue (UI)
   ├─ select mode toggle ("Select" / "Done")
   ├─ checkbox column (only in select mode)
   ├─ selection toolbar (count, Delete selected, Done)
   └─ partial-result ConfirmDialog (reuse existing component)
        ↓ store.bulkDeleteInstances(typeId, paths[])
make-store.ts
   ├─ bulkDeleting: shallowRef<ReadonlySet<TypeId>>  (UI optimistic guard only)
   └─ bulkDeleteInstances(typeId, paths[])
        ↓ ctx.service.deleteInstances(typeId, paths)
make-service-instances.ts
   ├─ deleteInstances(typeId, paths[])               → Result<BulkDeleteReport, MakeError>
   │     enqueued through the shared per-typeId queue
   └─ emits make:instances-deleted-batch              { typeId, deletedPaths, failures }
       ↓
store subscription → loadInstances(typeId)           (single refresh, not N)

per-type-queue.ts (new shared util)
   ├─ chains: Map<TypeId, Promise<unknown>>          (was private to update-type-ops.ts)
   └─ enqueue(typeId, work)                          (FIFO per typeId; cross-action serialization)
       ↑                                              ↑
       updateType / retryFailedMoves                  deleteInstances
       (currently uses chains; refactored to share)
```

Selection state lives in the **page component**, not the store — selection is per-view-instance and survives only as long as the user is on that type's page. The store owns the `bulkDeleting` set and the bulk action method.

**Real cross-action serialization** (preventing a folder move + bulk delete from racing) lives in the service-layer per-`typeId` queue. The store-level `bulkDeleting` set is an optimistic UI guard for disabling buttons and hiding the spinner — it does NOT serialize across pages or sessions, only the service queue does.

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
- The implementation runs **inside the per-`typeId` queue** (extracted util, see "Per-type queue" below). This means a `deleteInstances` call FIFO-queues behind any in-flight `updateType` / `retryFailedMoves` for the same `typeId`, and vice versa.
- Once dequeued, sequential iteration over `paths`, calling `ports.vault.delete(path)` for each. Sequential (not parallel) because Obsidian's vault adapter isn't documented as concurrency-safe and the existing single-item `deleteInstance` is already sequential.
- Collects per-path failures; never short-circuits on a single failure.
- Outer `Result.err` only on truly catastrophic conditions; normal partial failures return `Result.ok` with a populated `failures[]`. Same shape convention as Polish P0 #2 (move-report).
- Empty `paths` → returns `ok({deletedPaths:[], failures:[]})` immediately (no queue entry, no event).
- Emits **one** `make:instances-deleted-batch` event with `{typeId, deletedPaths, failures}`. Does NOT emit per-path `make:instance-deleted` or `make:orphan-deleted` (the store would refresh once per item, defeating the point).
- **Trusts the caller's `typeId`** — does NOT call `inferTypeId` per path. The page UI guarantees every selectable path belongs to the loaded type. **Edge case:** if a path has drifted folders between list-render and confirm-click, the vault delete will likely fail (path not found) and land in `failures[]`; if it somehow succeeds, the batch event still carries the original `typeId` and no orphan event fires for that path. Acceptable — the worst case is a missed orphan-cleanup hook, recoverable by the user and rare in practice.

### Per-type queue (extracted util)

`src/modules/make/per-type-queue.ts` (new file). Lifts the `chains` map currently private to `update-type-ops.ts` (lines 181–187) into a shared util:

```ts
export type PerTypeQueue = {
  enqueue<T>(typeId: string, work: () => Promise<T>): Promise<T>;
};

export function createPerTypeQueue(): PerTypeQueue {
  const chains = new Map<string, Promise<unknown>>();
  return {
    enqueue(typeId, work) {
      const previous = chains.get(typeId) ?? Promise.resolve();
      const current  = previous.then(work);
      chains.set(typeId, current.catch(() => undefined));
      return current;
    },
  };
}
```

`make-service.ts` (where the service is composed) constructs **one** `PerTypeQueue` per `MakeService` instance and threads it into both `createUpdateTypeOps` and into the new bulk-delete code path in `make-service-instances.ts`. `update-type-ops.ts` is updated to consume the injected queue instead of constructing its own — behavior unchanged for existing `updateType`/`retryFailedMoves` callers, but the constructor signatures of both factories gain a `queue: PerTypeQueue` parameter.

**Queue lifetime = `MakeService` lifetime.** The `make` module re-initializes its service on folder-related settings changes (see `make-module.ts` re-init path), which discards the old queue and constructs a fresh one. In-flight operations on the old queue continue to settle on the old service's closures; no new operations enter that queue after re-init. This matches the existing isolation guarantees of the module init/destroy cycle.

### Cascade delete (`deleteType({cascade: true})`) — unchanged

The existing `deleteType` cascade path continues to emit per-path `make:instance-deleted` events (as it does today). It does NOT use the new batch event. Rationale: `deleteType` is already a single-flight operation with its own dialog flow, the cascade emits are downstream of an already-synchronous loop, and changing it would expand scope. If batched-cascade-emits become useful later, that's a separate item.

### New event

Add to `src/modules/make/make-events.ts` (or wherever the make event map lives):

```ts
'make:instances-deleted-batch': {
  typeId:       TypeId;
  deletedPaths: readonly string[];
  failures:     ReadonlyArray<{ path: string; error: string }>;
};
```

Add corresponding handler entry to `MakeEventHandlers` in `src/modules/make/make-module.ts`:

```ts
readonly onInstancesDeletedBatch?: (payload: EventMap['make:instances-deleted-batch']) => void;
```

…and a matching `if (handlers.onInstancesDeletedBatch) unsubs.push(...)` line in the `subscribe()` body (mirrors the existing 10 handler wires at lines 38–47).

The single-item `make:instance-deleted` and `make:orphan-deleted` events stay as-is — single-delete paths are unchanged.

## Store changes

### New reactive state

```ts
const bulkDeleting = shallowRef<ReadonlySet<TypeId>>(new Set());
```

Mirrors the existing `regeneratingForId` (line 101) and `favoriteToggling` (line 103) per-`TypeId` set patterns. (Note: `savingType` is a coarse boolean ref used for the active type form save; it is NOT a per-typeId set and is not reused here.)

### New action

```ts
async function bulkDeleteInstances(
  typeId: TypeId,
  paths: readonly string[],
): Promise<Result<BulkDeleteReport, MakeError>> {
  if (paths.length === 0) return ok({ deletedPaths: [], failures: [] });
  if (bulkDeleting.value.has(typeId)) return err({ kind: 'busy' });
  const next = new Set(bulkDeleting.value); next.add(typeId); bulkDeleting.value = next;
  try {
    return await ctx.service.deleteInstances(typeId, paths);
  } finally {
    const done = new Set(bulkDeleting.value); done.delete(typeId); bulkDeleting.value = done;
  }
}
```

**Lock semantics — explicit:**
- The store-level `bulkDeleting.has(typeId)` check prevents same-page double-clicks (e.g., user mashing the Delete button before the spinner appears). This is an **optimistic UI guard**, not real serialization.
- **Real serialization** with `updateType`/`retryFailedMoves` happens at the service layer via the shared per-`typeId` queue (see "Per-type queue" in §Domain). A folder-move-in-progress on the same `typeId` will FIFO-queue the bulk delete behind it (and vice versa). This works across pages and Obsidian panes — the queue lives on the service singleton.
- The store-level `savingType` boolean is intentionally **not** consulted here; it's a UI loading flag for the active type form, not a typed lock.

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
const selectMode        = ref(false);
const selectedPaths     = shallowRef<ReadonlySet<string>>(new Set());
const pendingBulkDelete = ref(false);                              // drives the confirm dialog
const bulkResult        = ref<BulkDeleteReport | null>(null);      // drives the partial-result dialog
```

**`bulkResult` lifecycle (explicit):**
- **Set:** assigned the `Result.ok` value returned by `await store.bulkDeleteInstances(...)`. If the store returns `Result.err({kind:'busy'})`, `bulkResult` is NOT set; instead the busy toast fires.
- **Read:** the partial-result `ConfirmDialog` is rendered with `:open="bulkResult !== null && bulkResult.failures.length > 0"`. Zero-failures path doesn't open the dialog — it just fires the success notification and clears `bulkResult` to `null`.
- **Cleared:** the partial-result dialog's `@resolve` handler:
  - `confirm` (Retry) → clears `bulkResult` to `null`, then re-invokes `bulkDeleteInstances(typeId, failures.map(f => f.path))` — which sets a fresh `bulkResult`.
  - `cancel` (Dismiss) → clears `bulkResult` to `null`. Failed paths stay in `selectedPaths`.
  - This guarantees no stale report can re-open the dialog on re-render.

### Header

The header gets a "Select" toggle button next to the existing "+ New" button. When `selectMode` is true:
- Per-row Open/Delete buttons are hidden.
- A checkbox appears at the start of every row.
- The header layout switches to a **selection toolbar** that replaces the "+ New" button area.

### Selection toolbar (in select mode)

```
[ ☐/☑ select-all ]  N selected  [ Delete selected ]  [ Done ]
```

- **Select-all checkbox:** tristate (none / some / all). Click toggles all-or-none of the instances in the page's `sorted` list (which is the full type's instances, date-sorted; there is no list filtering today).
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
| `Delete` | **No-op in select mode.** The per-row delete dialog is unreachable both by mouse (button hidden) and by keyboard, for symmetry. To delete the focused row only, exit select mode (Esc or Done) and press Delete; to delete a single row via the bulk path, select it (Space) and confirm in the toolbar. |
| `Arrow / Home / End` | Roving navigation (unchanged). |

In select mode the list gets `aria-multiselectable="true"`; rows get `aria-selected="true|false"`.

### Selection hygiene

- After every list refresh, filter `selectedPaths` against the current `sorted` paths (drop any that no longer exist). Implementation: a `watch(() => sorted.value, (next) => { selectedPaths.value = new Set([...selectedPaths.value].filter(p => next.some(r => r.path === p))); })`.
- Exiting select mode always clears `selectedPaths`.
- Mode toggle is blocked from off→on while `props.loading === true` (prevents racey selection of stale rows). On→off is blocked while `store.bulkDeleting.value.has(typeId)` — the Done button is disabled in that window. (The user can still cancel the partial-result dialog after the operation finishes.)

## Error handling

| Condition | Behavior |
|---|---|
| `bulkDeleteInstances` returns `Result.err({kind:'busy'})` | Toolbar's "Delete selected" stays disabled visually; if somehow triggered, surface a "Bulk delete already in progress" toast. |
| Per-path vault errors | Land in `failures[]` and feed the partial-result dialog. Never thrown. |
| Stale paths (file removed by another session mid-operation) | Land in `failures[]` with the vault's not-found error; user can dismiss safely. |
| Type folder moved mid-operation | Prevented by the **service-layer per-`typeId` queue** (see "Per-type queue" in §Domain). `updateType`/`retryFailedMoves` and `deleteInstances` FIFO-queue against each other on the same `typeId`. The store-level `bulkDeleting` set is a UI guard only, not the source of serialization. |

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

**Pluralization:** "Deleted 1 instances" reads poorly. The locale layer's pluralization story is out of scope for this design spec — file an issue if singular/plural variants are needed; for now, the implementation can either accept the awkwardness or add `vue-i18n` plural rules as a separate small task.

## Testing strategy (TDD)

### Per-type queue — `tests/modules/make/per-type-queue.test.ts` (new)

- `enqueue(typeId, work)` runs `work` and returns its result.
- Two `enqueue(sameTypeId, ...)` calls run sequentially (second waits for first to settle) — assert via timestamps or shared counter.
- Two `enqueue(differentTypeIds, ...)` calls run concurrently — assert no waiting.
- A rejected `work` does not break the chain: the next `enqueue` for the same `typeId` still runs.

### Update-type-ops refactor — `tests/modules/make/update-type-ops.test.ts`

- Existing serialization tests pass after the refactor (sanity).
- Add: an `updateType` and a `deleteInstances` for the same `typeId` queue against each other (using a shared `PerTypeQueue` instance).

### Domain / service — `tests/modules/make/make-service-instances.test.ts`

- `deleteInstances` with all-success: returns `{deletedPaths: paths, failures: []}` and emits exactly one `make:instances-deleted-batch` event with the matching payload.
- Mixed success/failure: vault.delete fails for some paths → returns ok with a populated `failures[]` and emits one batch event with both arrays correctly populated.
- Empty `paths`: returns `ok({deletedPaths:[], failures:[]})` and emits no event.
- Sequential ordering: vault.delete called once per path, in the order provided.
- Does NOT emit per-path `make:instance-deleted` or `make:orphan-deleted` events.

### Store — `tests/ui/stores/make-store.test.ts`

- `bulkDeleteInstances(typeId, paths)` toggles `bulkDeleting` set around the call (added before service call, removed after).
- Concurrent call on same `typeId` returns `err({kind:'busy'})` without invoking the service.
- Empty paths returns `ok` immediately without invoking the service.
- `make:instances-deleted-batch` subscription triggers exactly one `loadInstances(typeId)` call regardless of `deletedPaths.length`.
- (Note: cross-action serialization with `updateType` is verified at the service layer via the per-type-queue tests above, not at the store layer.)

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
| service | `src/modules/make/per-type-queue.ts` | **New file** — extracted `chains` map + `enqueue` (was private to `update-type-ops.ts`) |
| service | `src/modules/make/update-type-ops.ts` | Refactor: consume injected `PerTypeQueue` instead of constructing its own (pure refactor — no behavior change) |
| service | `src/modules/make/make-service-instances.ts` | Add `deleteInstances` (consumes injected `PerTypeQueue`) |
| service | `src/modules/make/make-service.ts` (or wherever the service is composed) | Construct one `PerTypeQueue`, thread it into both `createUpdateTypeOps` and the instances service |
| service | service factory return | Export `deleteInstances` |
| events | `src/modules/make/make-events.ts` | Add `make:instances-deleted-batch` to `EventMap` |
| events | `src/modules/make/make-module.ts` | Add `onInstancesDeletedBatch` to `MakeEventHandlers` + matching `subscribe()` wire |
| store | `src/ui/stores/make-store.ts` | Add `bulkDeleting` state, `bulkDeleteInstances` action, `onInstancesDeletedBatch` subscription handler |
| ui | `src/ui/pages/make/MakeTypeInstances.vue` | Select mode, toolbar, keyboard, dialogs, selection-hygiene watcher |
| i18n | locale files (`src/modules/make/locales/en.json` etc.) | New `make.instances.bulk.*` keys |
| tests | service / store / page / storybook | Per the testing strategy section, plus a refactor-coverage test for `update-type-ops` continuing to serialize correctly with the injected queue |
