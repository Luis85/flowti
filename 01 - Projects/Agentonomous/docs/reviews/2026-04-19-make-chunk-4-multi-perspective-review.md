---
type: Review
project: Agentonomous
module: Make
scope: Chunk 4 (slices A–J)
tag: make-slice-4
date: 2026-04-19
aligned: ship-ready-with-polish-backlog
---

# Make Chunk 4 — Multi-Perspective Review

Post-implementation review from Product Owner, Software Architect, Tester, and UX lenses. Complements the slice-level code-quality review already captured in issues I-1 / I-2 / I-3.

## Executive summary

- Chunk 4 is functionally ship-ready: create/update/delete/cascade/folder-move all land with confirm dialogs, toasts, and events. 908 tests + lint + typecheck + build clean. Tag `make-slice-4` placed.
- **Biggest risk** — semantic inconsistency under partial failure. `partial-move` writes the new schema JSON to disk **and** emits `make:type-updated`, but the service returns it as an `err`. Callers must treat "write committed + event fired" as an error — `use-create-instance-flow.ts:44` maps it to the wrong i18n key. This is **active bug surface**, not just theoretical.
- **Second-biggest risk** — folder-move preconditions. Service never verifies destination folder exists, never checks target collisions, has no concurrency lock, and processes moves sequentially with no progress indicator. Irreversible from the UI.
- Chunk 5 can land cleanly **only if** `update-type-ops.ts` extraction (I-2) happens first — `make-service-types.ts` is at 349/350 effective lines.

## Product Owner lens

### Findings

- **Full lifecycle is present** — create type → edit fields → move folder with confirm → delete with cascade. First chunk where a user authors end-to-end without dropping to Obsidian file explorer.
- **No bulk operations** — instances deleted one-at-a-time (`MakeTypeInstances.vue:152-159`). Does not scale past ~20 instances.
- **No undo anywhere** — only safety net is Obsidian trash. Destructive ops running on N files deserve at least a toast-level Undo.
- **No versioning / schema migration path** — field renames are acknowledged with a warning dialog (`use-make-type-save-flow.ts:66-78`), nothing rewrites existing instance frontmatter. Wording at `en.json:94` ("notes remain but the old field name won't appear in the type") is silent data divergence by policy.
- **Partial-move has no "retry failed" affordance** — warn toast lists up to 3 failed paths with no action button. Failed files are orphaned in the old folder.

### Recommendations

- **P0** Dedicated partial-move result dialog (not toast) with "Retry failed files" + "Open old folder" actions. The i18n key `make.move-report.partial.title` at `en.json:180` is authored but unused — implementation shrank to toast.
- **P0** Explicit schema-migration story on Chunk 5/6 backlog.
- **P1** Bulk-select on instances (checkbox column → bulk delete / bulk open).
- **P2** Toast-level Undo for type delete and folder-move.

## Software Architect lens

### Findings

- **Layering holds.** `make-service-types.ts` stays in `modules/`, only touches `ModulePorts`, emits through `eventBus`. Circular-dep (types-ops wants `listInstancesInFolder`) resolved cleanly via `peers` injection.
- **`UpdateTypeResult` is narrow-purpose and half-typed.** Won't reuse for Chunk 5 shapes. Consider `OperationOutcome<TSideEffect>` or add `warnings: readonly Warning[]` channel now.
- **`partial-move` as an `err` is the wrong lane.** Service wrote the JSON (`make-service-types.ts:271-276`) and emitted both events, yet callers must treat it as `err`. `use-create-instance-flow.ts:44` maps it to `make.error.vault` — active bug. Should be `ok({ schema, moveReport })` with `moveReport.failedMoves.length > 0` inspected by caller.
- **Event-payload widening to `TypeId | null`** (`make-events.ts:11`) is a workaround. Cleaner: make `deleteInstance` require typeId (caller has it), or split into `make:instance-deleted` + `make:orphan-deleted`. Today every subscriber handles the null case.
- **Concurrency model is missing.** `savingType` is a single boolean. Multi-pane Obsidian can race two `updateType` calls.
- **`make-service-types.ts` at 349 effective lines** (I-2). Extraction boundary obvious: `updateType` + `moveAllInstances` + `commitNoMove` + `commitWithMove` + `preflightUpdate` form a cohesive `update-type-ops.ts` of ~90 lines.
- **Double `loadType` in cascade**: `deleteType:337` loads, `cascadeInstances:304` calls `peers.listInstances` which also loads. Two disk reads for one op.

### Recommendations

- **P0** Reclassify `partial-move` from `err` to `ok({warnings})` or `Result.warn`.
- **P0** Extract `update-type-ops.ts` (reinforces I-2).
- **P1** Replace `TypeId | null` in `make:instance-deleted` with explicit events or pre-resolution at call site.
- **P1** Single-flight lock on `updateType`/`deleteType` at service level.
- **P2** Add `warnings: readonly MakeWarning[]` to `UpdateTypeResult` / `DeleteTypeReport`.

## Tester lens

### Findings

- **Move physics untested for destination preconditions.** `moveAllInstances` (`make-service-types.ts:220-235`) doesn't check whether `nextFolder` exists, whether `newPath` already exists, TOCTOU on `oldInstances`. Obsidian `vault.rename` `target-exists` err path exercised only via mocks.
- **Case-insensitive FS not exercised.** macOS/Windows are case-insensitive. `Books/Dune.md` → `books/Dune.md` is a no-op on macOS, real move on Linux. Combined with partial-move silent-write, real cross-platform bug vector.
- **Special-char type names not probed.** No test for Unicode, emoji, path-traversal (`../`), Windows reserved (`CON`, trailing dot). `validateTypeName` covers some; move-folder input allows any string through to `vault.rename`.
- **Large folder not exercised.** All move tests use 2 instance files. Sequential `await` loop — 500-instance move is 500 serial round-trips. No perf test, no cancellation.
- **No integration test through service+store+UI for move/cascade.** `use-make-type-save-flow.test.ts` mocks `store.updateType`; `make-service.test.ts` uses fake vault. Round-trip assertion missing.
- **Storybook gaps:** no move-confirm, partial-move toast, or cascade-confirm-at-scale stories.
- **PO index-based row lookup brittle** — `MakeTypeInstances.vue:76-79` reorders by `createdAt` on every refresh, so `row(0)` can point to different data across ticks.
- **Cascade notification severity not asserted in tests** (reinforces I-3).

### Recommendations

- **P0** Service-level tests for: destination-folder-missing, target-exists collision, TOCTOU.
- **P0** Promote cascade success/partial notifications from manual-only to automated (I-3 closure).
- **P1** One integration test with real in-memory vault adapter + store + service for move path, asserting final cache state after `partial-move`.
- **P1** Case-sensitivity + special-char + Unicode parameterized tests for `slugifyTypeName` + `instancesFolder`.
- **P2** `MoveConfirmDialog.stories.ts`, `CascadeConfirmDialog.stories.ts`, partial-move toast story.

## UX lens

### Findings

- **Row actions not keyboard-accessible.** `<li>` with child buttons, no `role=row`, no arrow-key navigation, no row-level activation (Enter/Delete). 20 instances = 40 Tab stops.
- **Destructive-confirm labelling inconsistency.** Move-confirm dialog at `MakeType.vue:268-275` does NOT pass `destructive`, even though it triggers N file renames. Cascade-delete does. Asymmetric.
- **Partial-move toast hierarchy too subtle.** Success = `success` toast; partial = `warn` toast; full failure = inline schema-errors. A user mass-moving 40 files with 38 success sees a single auto-dismiss yellow toast with no persistent action.
- **Move-confirm dialog lacks dry-run preview.** Body shows count + two paths; doesn't list filenames about to move. For irreversible bulk ops, showing first N names builds confidence.
- **Dialog stacking + no progress indicator during mass rename.** User confirms move → dialog closes at `use-make-type-save-flow.ts:145` **before** the rename loop completes. Plain form for N seconds, then warn toast.
- **Empty-state auto-opens the create panel** (`MakeTypeInstances.vue:40-46`). Pleasant default, but annoying if user just deleted the last instance.
- **Index-based testids** (`open-in-obsidian-${index}`) = unstable focus + brittle selectors. "Open in Obsidian" label verbose for row action — icon + `aria-label` preferable.

### Recommendations

- **P0** Apply `destructive` + spinner/aria-busy to move-instances confirm dialog.
- **P0** Replace partial-move warn toast with persistent dialog using the already-authored `make.move-report.partial.title` + Retry affordance.
- **P1** Keyboard a11y on instances list: `role=list` + `role=listitem`, arrow keys, Delete-key shortcut.
- **P1** Move-confirm dialog: preview first 3 filenames.
- **P2** Throttle empty-state auto-open (initial mount only).

## Cross-cutting themes

- **Partial-success is a first-class concept that isn't modeled.** Appears in three places — partial move (`err` but wrote JSON), cascade with per-instance failures (`ok` with `instanceFailures`), base-file deletion during `deleteType` (`warn` toast + `ok` result). Three encodings for the same semantic. Architect + Tester + UX converged independently.
- **Keyboard a11y + destructive-confirm mismatch** — Tester + UX both found bulk-destructive paths have weaker confirmation than single-file paths.
- **Index-based identifiers in UI** — UX (stable focus/shortcuts), Tester (brittle selectors), Architect (coupling UI to list order) all touched it.

## Polish-pass backlog (priority order)

1. **Extract `update-type-ops.ts`** (I-2) — precondition for everything below that touches updateType.
2. **Reclassify `partial-move` as `ok({warnings})` or `Result.warn`** — unblocks consistent partial-success across cascade/delete/future schema migration. Fixes active bug in `use-create-instance-flow.ts:44`.
3. **Replace partial-move warn toast with persistent dialog** using `make.move-report.partial.title` (unused today) + Retry affordance.
4. **Apply `destructive` + spinner/aria-busy to move-instances confirm dialog.**
5. **Promote notification assertions** in `MakeType.test.ts` cascade tests (I-3 closure).
6. **Storybook stories** for move-confirm and partial-move result dialog.
7. **Service-level tests for move preconditions**: missing destination folder, target collision, TOCTOU.
8. **Keyboard navigation + Delete-key on instances list** (role=listitem, arrow keys, aria-rowindex).
9. **Single-flight lock on updateType/deleteType** at service level.
10. **Replace `TypeId | null` payload** — split events or require typeId at call site.
11. **Bulk-select on instances** (prerequisite for Chunk 5 schema migration).
12. **Case-insensitive FS + special-char parameterized tests.**

## Cross-reference to slice-level review

- **I-1** Silent inconsistency (rename ok, JSON fails) — reinforced by Architect lens: no rollback, no UI signal; compounded by partial-move err-lane classification.
- **I-2** `make-service-types.ts` at 349/350 lines — promoted to **P0** (#1 in backlog) since every other change touches updateType.
- **I-3** Production notifications not asserted — promoted to **P0** (#5) with specific test targets: cascade success, cascade partial, partial-move warn.
- **Minor: orphan i18n key, Storybook gaps, partial-move typed as `err`, duplicate `loadType`** — all incorporated into items 2, 3, 6, and architect-lens findings.
