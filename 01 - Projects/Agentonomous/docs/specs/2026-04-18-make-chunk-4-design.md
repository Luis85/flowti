# Make — Chunk 4: Instance authoring

**Date**: 2026-04-19
**Status**: approved-for-planning
**Supersedes**: Chunk 4 placeholder in `docs/plans/2026-04-18-make.md`
**Depends on**: Chunk 3.5 shipped (`815cc3af`), parent design `docs/specs/2026-04-18-make-design.md`
**Plan**: `docs/plans/2026-04-18-make-chunk-4.md` (to be written by planner)
**Test baseline (Chunk 3.5)**: 754 passing, 92 files, 0 lint errors, typecheck clean
**Target**: ≥ 850 tests after Chunk 4

## Context

Chunks 1–3.5 shipped the read paths, read pages, type authoring, and hardening refactor (`MakeContextKey` per-module injection). Users can create, edit, rename, favorite, and delete types, with base-file regeneration and rename-warning flows. They **cannot** yet create or delete instances through the UI; the only way to populate a Make type today is to hand-craft markdown files with the right frontmatter.

Chunk 4 closes that gap. It adds the instance authoring surface end-to-end:

- Service writes for instances (`createInstance`, `deleteInstance`).
- The cascade checkbox in `DeleteTypeDialog` becomes real (today it returns `not-implemented`).
- A new `SchemaForm.vue` component dispatches to the six per-kind inputs shipped in Chunk 1, hosted inline on `MakeTypeInstances`.
- Per-row actions on the instance table: **Open in Obsidian** (new tab) and **Delete** (confirm → trash).
- `listTypes` widens its `ok` shape so corrupt JSON files under the types folder surface as a banner on `MakeTypes`, with repair actions.
- `updateType` gains folder-move physics when `instancesFolder` changes — a pre-save confirm enumerates existing instances and moves them via a new `VaultPort.rename` method, producing a `{ movedCount, failedMoves }` report.
- A new lightweight `WorkspacePort` routes the "Open in Obsidian" action without widening `VaultPort`'s content-focused contract.

Hardening items deferred from Chunk 3.5 §12 outbox (optimistic concurrency, relative `baseFile.path`, persistent orphan banners) remain deferred; they land in a post-Chunk-4 pass or in Chunk 5.

## Decisions captured

| Ref | Decision |
|---|---|
| Q1 | Scope: 8 deliverables (instance service writes, cascade re-enable, `SchemaForm`, row actions, corrupt-type UI, folder-move physics, overwrite dialog, `WorkspacePort`). |
| Q2 | `instancesFolder` rename → move files with pre-save confirm + `{ movedCount, failedMoves }` report. Not block, not orphan. |
| Q3 | Create-instance form placement → inline collapsible panel above the instance table (matches Chunk 3's `MakeTypeSchemaDetails` idiom). |
| Q4 | "Open in Obsidian" → new tab, routed through new `WorkspacePort` (`VaultPort` stays content-focused). |
| Q5 | Corrupt types → widen `listTypes` ok-shape to `{ types, issues }`; `MakeTypes` banner with `[Show details]` / `[Refresh]` / per-row `[Open]` + `[Delete file]`. |
| Mid-4 | Move physics use `VaultPort.rename` (new method, uses Obsidian `fileManager.renameFile` on the adapter side → backlinks update). Failures are per-file, not aborted. JSON writes regardless — schema truth wins. |
| Mid-4 | `listInstances` stays scoped to `instancesFolder` only — files left behind after a partial move are NOT in the table. They're surfaced via a one-time `partial-move` warning notification + logged via the `error` bus. Persistent orphan banner deferred. |
| Mid-5 | Corrupt banner refresh is manual (`[Refresh]` button). No `vault` bus subscription in v1 — consistent with parent §5.2. |
| Mid-3 | `useCreateInstanceFlow` composable keeps `MakeTypeInstances` under 350 lines (mirrors Chunk 3's `useMakeTypeSaveFlow`). |
| Mid-2 | New `MakeError` variants: `instances-move-required`, `partial-move`. New domain shape `IoError` under `src/domain/make/errors.ts`. |
| Mid-Sec-4 | `partial-move` is diagnostic, not recoverable — no "retry failed files" button; user re-triggers by re-opening the type and retrying the rename. |

## 1. Scope & Deviations

**In scope (Chunk 4 = Slice 4 of parent spec):**

- **Service writes**: `createInstance`, `deleteInstance`. Happy paths + error branches documented in §3.4.
- **Service read-shape widening**: `listTypes` returns `{ types, issues }` inside its `ok` branch. Store exposes both.
- **Service `updateType`** gains folder-move physics when `instancesFolder` changes: pre-move count, optional move, `{ movedCount, failedMoves }` report. New `options.moveInstances?: boolean` flag.
- **Service `deleteType`** honors `alsoDeleteInstances: true` — enumerates and deletes via `vault.delete` (trash).
- **Service `deleteCorruptFile(path)`** — new thin method wrapping `vault.delete` for known-bad JSON files under the types folder. No events emitted.
- **Port surface**: new `WorkspacePort` (`openFile(path, mode)`); new `VaultPort.rename(oldPath, newPath)` method.
- **New component**: `src/ui/components/make/SchemaForm.vue` — dispatches to the six per-kind inputs via `FIELD_KINDS` registry, handles per-field `FieldError` inline, handles `resolveInstancePath` signals (missing title, invalid filename).
- **`MakeTypeInstances` page** gains: `[+ New instance]` button + inline collapsible panel hosting `SchemaForm` + per-row `[Open in Obsidian]` and `[Delete]` actions + delete confirm.
- **`DeleteTypeDialog`** re-enables cascade checkbox; success notification quotes `DeleteTypeReport`.
- **`MakeTypes` page** gains a corrupt-files banner + expandable issue list + per-row actions + `[Refresh]`.
- **`instance-exists` collision** surfaces as overwrite/rename dialog per parent §8.2.
- **New `make:*` event channel**: `make:instances-moved` (carries `{ typeId, oldFolder, newFolder, movedCount, failedCount }`).
- **Full i18n live-wiring** for all new copy (~40 keys under `make.*`); a11y for the new dialogs and the form.
- **Storybook stories**: new for `SchemaForm`; extended for `DeleteTypeDialog`, `MakeTypes`, `MakeTypeInstances`.

**Explicitly out of scope (deferred):**

- KPIs / recently-created list / `MakeSettings.vue` / ribbon / `make-create-type` command → Chunk 5.
- Optimistic concurrency on instance writes (no `stat.mtime` check on create/delete/update) → Chunk 3.5 outbox.
- Relative `baseFile.path` storage → Chunk 3.5 outbox.
- Persistent post-save orphan banner after partial move → Chunk 3.5 outbox.
- Live `vault` bus subscription for external instance mutations → future (parent §5.2).
- Schema migration of existing instances when a type changes → parent §13 (not planned).
- Bulk instance operations (multi-select delete, export) → post-v1.
- Retry-failed-files button on `partial-move` warning → post-v1; user re-opens type and retries.

**Deviations from parent spec `2026-04-18-make-design.md`:**

1. **`listTypes` return shape** — parent §5.3 declares `Promise<Result<readonly TypeSchema[], MakeError>>`. Chunk 4 widens the `ok` inner value to `{ types: readonly TypeSchema[]; issues: readonly CorruptTypeRef[] }`. Accepted deviation: enables corrupt-file surfacing without a second method.
2. **New `WorkspacePort`** — parent spec has no workspace port. Added here because "Open in Obsidian" is a workspace concern, not a vault content concern.
3. **New `VaultPort.rename(oldPath, newPath)`** — parent §4 reconfirmed "no port change"; Chunk 4 reverses that one decision because the Obsidian `fileManager.renameFile` API is needed to preserve backlinks during folder moves. Create-before-delete was considered and rejected mid-section-4.
4. **`updateType` folder-move physics** — parent spec does not describe what happens to existing instance files when `instancesFolder` changes. Chunk 4 specifies pre-save confirm + `rename` + report.
5. **`updateType` options flag** — extends the Chunk 3 `acknowledgeRenames` pattern: `updateType(typeId, patch, options?: { acknowledgeRenames?: boolean; moveInstances?: boolean })`.
6. **`updateType` return shape** — parent §5.3 declares `Promise<Result<TypeSchema, MakeError>>`. Chunk 4 widens to `Promise<Result<UpdateTypeResult, MakeError>>` where `UpdateTypeResult = { schema: TypeSchema; moveReport?: MoveReport }`. Moves are the only case that adds a report; field renames don't generate one.
7. **`MakeTypeInstances` replaces parent spec's `MakeTypeIndex`** — already deviated in Chunk 2; Chunk 4 continues that naming.
8. **`DeleteTypeDialog` cascade copy** — already shipped in Chunk 3 with read-only count; Chunk 4 flips the checkbox to interactive and the service call from `not-implemented` to real.

**Dependencies & baseline:**

- Branch off master at `815cc3af`. Baseline: 754 tests green, 0 lint errors, typecheck clean.
- Reuses: `useMakeContext()`, `MakeContextKey`, `useFocusTrap`, `ConfirmDialog`, `mountWithI18n`, `createFakeMakeContext`, `FIELD_KINDS`, `validateInstanceValues`, `renderInstanceContent`, `resolveInstancePath`, `sanitizeFilenameStem`, `yamlQuote`.

## 2. Port Changes

### 2.1 New `WorkspacePort`

```ts
// src/domain/shared/workspace-port.ts
import type { Result } from './result.js';

export type OpenFileMode = 'current' | 'tab' | 'split';

export interface WorkspacePort {
    openFile(path: string, mode: OpenFileMode): Promise<Result<void, string>>;
}
```

**Obsidian adapter** (`src/infrastructure/obsidian/workspace-adapter.ts`):

```ts
const MODE_MAP: Record<OpenFileMode, PaneType | boolean> = {
    current: false,
    tab:     'tab',
    split:   'split',
};

class ObsidianWorkspaceAdapter implements WorkspacePort {
    constructor(private readonly app: App) {}

    async openFile(path, mode) {
        const tFile = this.app.vault.getAbstractFileByPath(path);
        if (!(tFile instanceof TFile)) return err(`not-found: ${path}`);
        await this.app.workspace.getLeaf(MODE_MAP[mode]).openFile(tFile);
        return ok(undefined);
    }
}
```

**Fake for tests** (`tests/__fakes__/fake-ports.ts`):

```ts
export function fakeWorkspace() {
    const calls: Array<{ path: string; mode: OpenFileMode }> = [];
    return {
        port: {
            async openFile(path, mode) {
                calls.push({ path, mode });
                return ok(undefined);
            },
        } satisfies WorkspacePort,
        calls,
    };
}
```

**Registration path**:

- `ModulePorts` in `src/domain/shared/module-ports.ts` gains `workspace: WorkspacePort`.
- `PluginCore` constructs and passes it (`src/core/plugin-core.ts`).
- `createMakeContext` (`src/ui/make-context-factory.ts`) exposes it on the `MakeContext` shape.
- `useMakeContext()` returns the workspace alongside the service, settings$, subscribe.
- `MakeContext` fake in `tests/__fixtures__/fake-make-context.ts` exposes a `workspace` field (defaulting to `fakeWorkspace().port`).

### 2.2 New `VaultPort.rename`

```ts
// src/domain/shared/vault-port.ts — add one method
export interface VaultPort {
    // ...existing methods...
    rename(oldPath: string, newPath: string): Promise<Result<void, string>>;
}
```

**Obsidian adapter** (`src/infrastructure/obsidian/vault-adapter.ts`): implements via `this.app.fileManager.renameFile(tFile, newPath)`. This is the Obsidian API that updates backlinks, embedded markdown references, and tag indexes atomically. Rejected alternative: `vault.rename` (the raw vault API) — does not update backlinks.

**Adapter error contract**:

- `err('not-found: <oldPath>')` if the source does not exist.
- `err('target-exists: <newPath>')` if the destination path already exists.
- `err('rename-failed: <message>')` for all other failures (passes through the Obsidian error message).

**Fake for tests**: `tests/__fakes__/fake-vault.ts` — implement by mutating the in-memory map (move content to new key). Return `target-exists` if the new key is present.

### 2.3 Impact on existing modules

`event-inspector`, `health-monitor`, `file-detail` do not call `workspace.openFile` or `vault.rename` — no breakage. Lint / typecheck will surface any accidental consumer.

## 3. Domain Changes

### 3.1 New error shape — `IoError`

```ts
// src/domain/make/errors.ts — additions
export type IoError = {
    readonly kind: 'io-error';
    readonly cause: string;   // raw VaultPort error message
};

export type CorruptTypeRef = {
    readonly path: string;           // full vault path
    readonly filename: string;       // basename for display
    readonly error: SchemaError | IoError;
};
```

`SchemaError` already exists; `IoError` is new and represents "we couldn't read the file" (distinct from "we read it but it didn't parse"). Both surface in the Make UI under the same corrupt-files banner via a single `t('make.corrupt.' + error.kind)` lookup.

### 3.2 No changes to pure domain functions

`parseTypeSchema`, `validateInstanceValues`, `resolveInstancePath`, `renderInstanceContent`, `generateBaseYaml`, `sanitizeFilenameStem`, `yamlQuote`, and all six `FIELD_KINDS` specs remain unchanged. Chunk 4 is almost entirely a service-and-UI chunk on top of already-shipped domain primitives.

## 4. Service Additions

### 4.1 Updated `MakeService` surface

```ts
export type MakeService = {
    listTypes():                                        Promise<Result<ListTypesResult, MakeError>>;
    loadType(typeId: TypeId):                           Promise<Result<TypeSchema, MakeError>>;
    createType(draft: NewTypeDraft):                    Promise<Result<TypeSchema, MakeError>>;
    updateType(
        typeId: TypeId,
        patch: TypeSchemaPatch,
        options?: UpdateTypeOptions,
    ):                                                  Promise<Result<UpdateTypeResult, MakeError>>;
    deleteType(
        typeId: TypeId,
        options: DeleteTypeOptions,
    ):                                                  Promise<Result<DeleteTypeReport, MakeError>>;
    deleteCorruptFile(path: string):                    Promise<Result<void, MakeError>>;
    listInstances(typeId: TypeId):                      Promise<Result<readonly InstanceRef[], MakeError>>;
    createInstance(
        typeId: TypeId,
        raw: ReadonlyRecord<string, unknown>,
        explicitFilename: string | null,
        options?: CreateInstanceOptions,
    ):                                                  Promise<Result<InstanceRef, MakeError>>;
    deleteInstance(path: string):                       Promise<Result<void, MakeError>>;
    regenerateBaseFile(
        typeId: TypeId,
        options?: { force?: boolean },
    ):                                                  Promise<Result<string, MakeError>>;
    toggleFavorite(typeId: TypeId):                     Promise<Result<boolean, MakeError>>;
    getKpis():                                          Promise<KpiSnapshot>;  // Chunk 5
};

export type ListTypesResult = {
    readonly types: readonly TypeSchema[];
    readonly issues: readonly CorruptTypeRef[];
};

export type UpdateTypeOptions = {
    readonly acknowledgeRenames?: boolean;     // Chunk 3
    readonly moveInstances?: boolean;          // Chunk 4
};

export type UpdateTypeResult = {
    readonly schema: TypeSchema;
    readonly moveReport?: MoveReport;
};

export type MoveReport = {
    readonly oldFolder: string;
    readonly newFolder: string;
    readonly movedCount: number;
    readonly failedMoves: readonly FailedMove[];
};

export type FailedMove = {
    readonly path: string;
    readonly cause: string;    // raw adapter message — e.g. 'not-found: <oldPath>', 'target-exists: <newPath>', 'rename-failed: <msg>'
};

export type CreateInstanceOptions = {
    readonly overwrite?: boolean;
};

export type DeleteTypeReport = {
    readonly instancesDeleted: number;
    readonly instanceFailures: readonly FailedDelete[];
    readonly baseFileDeleted: boolean;
};

export type FailedDelete = {
    readonly path: string;
    readonly cause: string;
};
```

### 4.2 Updated `MakeError` variants

```ts
export type MakeError =
    | { kind: 'vault-error';            cause: string }
    | { kind: 'invalid-schema';         issues: NonEmptyArray<SchemaError> }
    | { kind: 'invalid-values';         issues: NonEmptyArray<FieldError> }
    | { kind: 'type-not-found';         typeId: TypeId }
    | { kind: 'duplicate-name';         name: string }
    | { kind: 'instance-exists';        path: string }
    | { kind: 'no-title-field' }
    | { kind: 'base-generation-failed'; cause: string }
    | { kind: 'not-implemented';        feature?: string }
    // New in Chunk 4:
    | { kind: 'instances-move-required'; oldFolder: string; newFolder: string; count: number }
    | { kind: 'partial-move';            moveReport: MoveReport };
```

`instances-move-required` is returned from `updateType` when `instancesFolder` changed, the old folder contains ≥1 instance file, and `options.moveInstances` is not `true`. The UI catches this, shows the confirm dialog, re-calls with `moveInstances: true`.

`partial-move` is returned from `updateType` when the move ran but some files failed. Schema and JSON are still written successfully — the user can retry from a warning banner or move manually in Obsidian.

`instance-exists` already exists; `createInstance` returns it when the target path exists and `options.overwrite` is not `true`. UI shows overwrite/rename dialog and re-calls with `options: { overwrite: true }`.

### 4.3 `createInstance` flow

1. `loadType(typeId)` — propagate `type-not-found` or `vault-error`.
2. `validateInstanceValues(schema, raw)` — if `err`, return `MakeError { kind: 'invalid-values', issues }`. Surfaces inline per-field in the form.
3. `resolveInstancePath(schema, values, explicitFilename)`:
   - `'no-title-field-and-no-filename'` → `MakeError { kind: 'no-title-field' }` (form surfaces the explicit filename input if user hit this branch).
   - `'invalid-filename'` → `MakeError { kind: 'invalid-values', issues: [{ kind: 'invalid-text', fieldName: '__filename__' }] }` — surfaced inline against the filename input.
   - Success → concrete path.
4. `vault.exists(path)`. If `true` AND `options?.overwrite !== true` → return `MakeError { kind: 'instance-exists', path }`.
5. `renderInstanceContent(schema, values)` → `{ fullMarkdown }`.
6. Write:
   - First write (exists: false): `vault.create(path, fullMarkdown)`.
   - Overwrite (exists: true, overwrite: true): `vault.update(path, fullMarkdown)`.
   - Vault failure → `MakeError { kind: 'vault-error', cause: <msg> }`.
7. On success: emit `make:instance-created { typeId, path }`; return `InstanceRef { typeId, path, title, createdAt, updatedAt }` (ctime/mtime from the write round-trip — on overwrite, ctime is preserved from pre-existing file).

### 4.4 `deleteInstance` flow

1. `vault.delete(path)`. On failure → `vault-error`.
2. Emit `make:instance-deleted { typeId, path }` where `typeId` is inferred from the in-memory `types` cache by **exact parent-folder match** — i.e., `dirname(path) === schema.instancesFolder` (after trim). If two types have nested folders (e.g., `Books` and `Books/Classics`), the exact-parent rule picks the right one; naive prefix matching would be ambiguous. If no schema matches, emit with `typeId: null` (treat as advisory — UI refresh is still triggered).
3. Return `ok(undefined)`.

### 4.5 `deleteType` cascade flow (`alsoDeleteInstances: true`)

1. `listInstances(typeId)` to enumerate under `schema.instancesFolder`. If `vault.list` fails → `vault-error`.
2. For each instance: `vault.delete(path)`. Track `instancesDeleted` count; failures append to `instanceFailures` list. **Loop does not abort on failure.**
3. If `options.alsoDeleteBaseFile && schema.baseFile` → `vault.delete(schema.baseFile.path)`. Record `baseFileDeleted` as the success flag.
4. `vault.delete(typeJsonPath)`. Type JSON delete is last. If this fails, return `vault-error` — we did not cleanly delete the type. (Instances already gone; user has a partial state — documented limitation, same trade-off as cascade-move.)
5. Emit `make:type-deleted { typeId, name }` once at the end.
6. Return `ok({ instancesDeleted, instanceFailures, baseFileDeleted })`.

**Notification shape**:
- Happy: `"Deleted type 'Book' (47 instances moved to trash)"`.
- Partial instance failures: `"Deleted type 'Book'. 45 instances moved to trash; 2 failed (see console)."`. Failures emit via `error` bus event.
- Base-file failure isn't surfaced in the notification (baseFile is a secondary artifact); it's just a log line.

### 4.6 `updateType` folder-move flow

Fully authoritative:

1. Validate patch using existing Chunk 3 validation path. `invalid-schema`, `duplicate-name`, `field-rename-warning` (when applicable) follow existing semantics.
2. Apply patch in-memory to get `nextSchema`. Compare `prev.instancesFolder` to `nextSchema.instancesFolder` (after trim).
3. If unchanged: write JSON, emit `make:type-updated`, return `ok({ schema: nextSchema })`. **No `moveReport`.**
4. If changed AND `options?.moveInstances !== true`:
   - Enumerate instances under the OLD folder. **The OLD folder is `prev.instancesFolder` — the value from the schema *before* the patch is applied.** Do NOT call `listInstances(typeId)` on `nextSchema`; its `instancesFolder` already points at the new location and would return zero. Instead, use a helper that accepts the folder explicitly — e.g., `listInstancesInFolder(prev.instancesFolder)` — or inline the enumeration: `vault.list(prev.instancesFolder).filter(/* .md with type-id === typeId */)`.
   - If `count === 0`: write JSON, emit `make:type-updated`, return `ok({ schema: nextSchema })`. No move needed.
   - If `count >= 1`: return `MakeError { kind: 'instances-move-required', oldFolder, newFolder, count }`. **JSON NOT written.** UI catches and confirms.
5. If changed AND `options.moveInstances === true`:
   - Enumerate old-folder instances via the same explicit-folder helper as step 4 (using `prev.instancesFolder`).
   - For each `ref.path`:
     - `newPath = nextSchema.instancesFolder + '/' + basename(ref.path)`
     - `vault.rename(ref.path, newPath)`
     - On error: push `{ path: ref.path, cause: rename.error }` to `failedMoves` — use the adapter's structured message verbatim per §2.2/§6.5 (no re-prefixing). **Do not abort.**
     - On success: increment `movedCount`.
   - Write JSON (even if some moves failed — schema truth wins).
   - Emit `make:instances-moved { typeId, oldFolder, newFolder, movedCount, failedCount }` where `failedCount = failedMoves.length`.
   - Emit `make:type-updated`.
   - If `failedMoves.length > 0`: also return `MakeError { kind: 'partial-move', moveReport }` — the JSON was written but the move was partial. UI surfaces a warning.
   - If `failedMoves.length === 0`: return `ok({ schema: nextSchema, moveReport: { oldFolder, newFolder, movedCount, failedMoves: [] } })`.

**Why `partial-move` is an error kind even though JSON wrote**: the UI needs a single branch to surface the warning; overloading `ok` with a `warning` sub-field would require every consumer to remember to check it. An error kind forces the issue and plays nicely with existing `Result`-handling patterns. The `moveReport` field on `partial-move` carries all the detail.

### 4.7 `deleteCorruptFile` flow

1. `vault.delete(path)`. On failure → `vault-error`. On success → `ok(undefined)`.
2. No event emitted (there was no type to emit about).
3. No cache mutation — the next `listTypes` call will naturally drop the corrupt entry.

The method does **not** verify that `path` is actually a corrupt file. Callers are trusted (the UI only exposes this through the corrupt banner). A misuse would just delete a normal type file; recoverable via trash.

### 4.8 `listTypes` widened shape

```ts
async listTypes(): Promise<Result<ListTypesResult, MakeError>> {
    const list = await vault.list(settings.typesFolder);
    if (isErr(list)) return err({ kind: 'vault-error', cause: list.error });

    // Filter to immediate children only (exclude descendants): dirname(p) === settings.typesFolder.
    // The existing make-service.ts uses a startsWith(prefix) + no-additional-slash check — reuse that code path.
    const jsonPaths = list.value.filter(p => p.endsWith('.json') && isImmediateChild(p, settings.typesFolder));
    const results = await Promise.all(jsonPaths.map(async (path) => {
        const read = await vault.read(path);
        if (isErr(read)) return { kind: 'io' as const, path, filename: basename(path), cause: read.error };
        const parsed = parseTypeSchema(read.value.content);
        if (isErr(parsed)) return { kind: 'corrupt' as const, path, filename: basename(path), error: parsed.error };
        return { kind: 'valid' as const, schema: parsed.value };
    }));

    const types  = results.filter((r): r is { kind: 'valid'; schema: TypeSchema } => r.kind === 'valid')
                          .map(r => r.schema);
    const issues = results
        .filter((r): r is Exclude<typeof r, { kind: 'valid' }> => r.kind !== 'valid')
        .map(r => r.kind === 'io'
            ? { path: r.path, filename: r.filename, error: { kind: 'io-error' as const, cause: r.cause } }
            : { path: r.path, filename: r.filename, error: r.error });

    return ok({ types, issues });
}
```

Notes:
- `vault-error` (the list operation itself fails — folder unreadable) is distinct from per-file issues.
- Per-file issues include both JSON parse failures (`SchemaError`) and I/O failures (`IoError`). The `CorruptTypeRef.error` union handles both.
- `issues` is `readonly []` in the happy case — cheap.
- No event emitted — `issues` is state, not change.

### 4.9 Events (updated)

```ts
declare module '../../domain/shared/event-bus.js' {
    interface EventMap {
        'make:type-created':       { typeId: string; name: string; schema: TypeSchema };
        'make:type-updated':       { typeId: string; name: string; schema: TypeSchema };
        'make:type-deleted':       { typeId: string; name: string };
        'make:instance-created':   { typeId: string; path: string };
        'make:instance-deleted':   { typeId: string | null; path: string };   // typeId nullable per §4.4
        'make:base-regenerated':   { typeId: string; basePath: string };
        'make:favorite-toggled':   { typeId: string; isFavorite: boolean };
        'make:settings-changed':   MakeSettings;                                // Chunk 3.5
        // New in Chunk 4:
        'make:instances-moved':    { typeId: string; oldFolder: string; newFolder: string; movedCount: number; failedCount: number };
    }
}
```

## 5. UI Layer

### 5.1 New component — `SchemaForm.vue`

**Path**: `src/ui/components/make/SchemaForm.vue`
**Props**:

```ts
interface SchemaFormProps {
    schema: TypeSchema;
    initialValues?: ReadonlyRecord<string, unknown>;
    submitLabel?: string;        // default: t('make.form.submit')
    submitting?: boolean;
    serverErrors?: readonly FieldError[];   // errors surfaced from service (invalid-values)
}
```

**Emits**: `submit: { raw: ReadonlyRecord<string, unknown>; explicitFilename: string | null }`, `cancel`.

**Structure**:

```
<form @submit.prevent="onSubmit">
  <!-- Title/filename input: rendered first -->
  <section data-testid="form-title-section">
    <template v-if="schema.titleFieldName !== null">
      <label>{{ titleField.label ?? titleField.name }} <small>{{ t('make.form.title-suffix') }}</small></label>
      <TextInput v-model="values[schema.titleFieldName]" :error="titleError" data-testid="form-title-input" />
    </template>
    <template v-else>
      <label>{{ t('make.form.filename') }}</label>
      <small>{{ t('make.form.filename-help') }}</small>
      <TextInput v-model="explicitFilename" :error="filenameError" data-testid="form-filename-input" />
    </template>
  </section>

  <!-- Remaining fields in declared order (title field excluded if set) -->
  <section data-testid="form-fields">
    <div v-for="(field, index) in remainingFields" :key="field.name">
      <label>{{ field.label ?? field.name }}<span v-if="field.required">*</span></label>
      <small v-if="field.description">{{ field.description }}</small>
      <component :is="INPUT_COMPONENTS[field.kind]" v-model="values[field.name]" :field="field" :error="errorFor(field.name)" :data-testid="`form-field-${field.name}`" />
      <p v-if="errorFor(field.name)" class="make-field-error" :data-testid="`form-field-${field.name}-error`">{{ errorMessage(field.name) }}</p>
    </div>
  </section>

  <footer>
    <button type="button" @click="$emit('cancel')" data-testid="form-cancel">{{ t('make.form.cancel') }}</button>
    <button type="submit" :disabled="submitting" data-testid="form-submit">{{ submitLabel ?? t('make.form.submit') }}</button>
  </footer>
</form>
```

**Behavior**:
- Auto-focus first input on mount (title input or filename input depending on branch).
- `FIELD_KINDS[field.kind].inputComponent` is a *new* field on `FieldKindSpec<K>` — points to the Vue component registered in Chunk 1. Adding this field is a domain-adjacent addition (see §3.2 caveat below).
- `values` is a `reactive` object keyed by field name.
- Submit: validate client-side via `FIELD_KINDS[*].validateValue` (already pure); map failures into per-field errors, display inline. Only emit `submit` if all pass.
- `serverErrors` prop is merged with client errors so `invalid-values` from the service shows on the right field. The `__filename__` pseudo-field maps to the filename input's error slot.
- Estimated size: ~220 lines.

**3.2 caveat — registry shape update**: adding `inputComponent` to `FieldKindSpec<K>` adds a *component reference* to a domain interface. To keep the domain layer free of Vue imports, the registry stays `src/domain/make/field-kinds/*.ts` defining validators/codecs only. The component lookup lives **parallel** in `src/ui/components/make/inputs/registry.ts`:

```ts
// src/ui/components/make/inputs/registry.ts
export const INPUT_COMPONENTS = {
    text:     TextInput,
    list:     ListInput,
    number:   NumberInput,
    checkbox: CheckboxInput,
    date:     DateInput,
    datetime: DatetimeInput,
} as const satisfies { [K in FieldKind]: Component };
```

`SchemaForm` uses `INPUT_COMPONENTS[field.kind]`. No domain change. This preserves the "domain never imports Vue" invariant.

### 5.2 `MakeTypeInstances.vue` changes

**Current state** (Chunk 2): read-only table of instances with columns name/created/updated.

**Chunk 4 additions**:

- **Tab header**:
  - `[+ New instance]` button (`data-testid="new-instance-button"`). Visible always; disabled only during form submission.
- **Collapsible form panel** (above the table):
  - Closed by default; opens on `[+ New instance]` click.
  - Empty-state branch (`instances.length === 0`): panel opens automatically on mount.
  - Hosts `<SchemaForm>` with the current type's schema.
  - Header: `{{ t('make.form.panel-title') }}` with a collapse chevron.
- **Table actions column** (rightmost; new):
  - `[Open in Obsidian]` → `store.openInstance(path, 'tab')` → `ctx.workspace.openFile(path, 'tab')`. Icon button with `aria-label` including row title. `data-testid="open-in-obsidian-<index>"`.
  - `[Delete]` → opens `ConfirmDialog` with copy `t('make.instance-delete-confirm.body', { title, path })` → on confirm: `store.deleteInstance(path)`. `data-testid="delete-instance-<index>"`.
- **Dialogs hosted at page level**:
  - Overwrite dialog — on `instance-exists` from `createInstance`. Three actions: `[Cancel]` / `[Choose different name]` (focus returns to filename/title input) / `[Overwrite]` (re-call with `options: { overwrite: true }`).
  - Delete-instance confirm — standard `ConfirmDialog`.

**Composable extraction** — `src/ui/pages/make/use-create-instance-flow.ts`:

```ts
export function useCreateInstanceFlow(typeId: Ref<string>, schema: Ref<TypeSchema | null>) {
    const submitting = ref(false);
    const serverErrors = ref<readonly FieldError[]>([]);
    const overwriteDialog = ref<{ path: string; pendingRaw; pendingFilename } | null>(null);

    async function submit({ raw, explicitFilename }) { /* orchestration */ }
    async function confirmOverwrite() { /* re-call with overwrite: true */ }
    function cancelOverwrite() { /* clear dialog, focus filename */ }

    return { submitting, serverErrors, overwriteDialog, submit, confirmOverwrite, cancelOverwrite };
}
```

Keeps `MakeTypeInstances.vue` under 350 lines. Mirrors `useMakeTypeSaveFlow` from Chunk 3.

### 5.3 `DeleteTypeDialog.vue` changes

**Current state** (Chunk 3): one checkbox (delete base file) + read-only instance count.

**Chunk 4 changes**:
- Add second checkbox: `"Also delete {count} instances in {instancesFolder}/"`. Off by default. Disabled (and hidden) when `count === 0`.
- Submit button calls `store.deleteType(typeId, { alsoDeleteInstances, alsoDeleteBaseFile })`.
- Success notification uses `DeleteTypeReport` data:
  - `alsoDeleteInstances: false` → `"Deleted type '{name}'."`
  - `alsoDeleteInstances: true, no failures` → `"Deleted type '{name}' and {instancesDeleted} instances."`
  - `alsoDeleteInstances: true, failures > 0` → `"Deleted type '{name}'. {instancesDeleted} instances deleted, {instanceFailures.length} failed."` (plus `error` bus event for logging).
- Base file line stays unchanged from Chunk 3 (optional, independent toggle).

No layout change — the design reserved a slot for this in Chunk 3.

### 5.4 `MakeTypes.vue` — corrupt files banner

**New section above the types table** (renders only when `issues.length > 0`):

```
<aside v-if="issues.length > 0" class="make-corrupt-banner" role="status" data-testid="corrupt-banner">
  <div class="banner-summary">
    <span>⚠ {{ t('make.corrupt.banner', { count: issues.length }) }}</span>
    <button @click="expanded = !expanded" data-testid="corrupt-banner-toggle">
      {{ expanded ? t('make.corrupt.hide') : t('make.corrupt.show') }}
    </button>
    <button @click="store.loadTypes()" data-testid="corrupt-banner-refresh">{{ t('make.corrupt.refresh') }}</button>
  </div>
  <ul v-if="expanded" class="banner-details">
    <li v-for="(issue, i) in issues" :key="issue.path" :data-testid="`corrupt-row-${i}`">
      <span class="filename">{{ issue.filename }}</span>
      <span class="reason">{{ t('make.corrupt.' + issue.error.kind, { ...issue.error }) }}</span>
      <button @click="store.openInstance(issue.path, 'tab')" :data-testid="`corrupt-open-${i}`">{{ t('make.corrupt.open') }}</button>
      <button @click="confirmDelete(issue)" :data-testid="`corrupt-delete-${i}`">{{ t('make.corrupt.delete') }}</button>
    </li>
  </ul>
</aside>
```

- `[Refresh]` triggers `store.loadTypes()` — re-runs `listTypes`.
- `[Delete file]` → `ConfirmDialog` with copy `t('make.corrupt.delete-confirm.body', { filename })` → `store.deleteCorruptFile(path)` → auto-refresh.
- Banner unmounts when `issues.length === 0`.

### 5.5 `MakeType.vue` — move-instances confirm flow

**Existing Chunk 3 flow**: Save button runs `updateType(typeId, patch, { acknowledgeRenames })`. On `invalid-schema.field-rename-warning`, shows rename confirm.

**Chunk 4 additions**: after a successful (or acknowledged) rename-confirm, the service may also return `instances-move-required`. Flow:

1. Save submit → `updateType(typeId, patch)`.
2. On `invalid-schema.field-rename-warning` → existing rename confirm → re-call with `acknowledgeRenames: true`.
3. On `instances-move-required` → open move confirm dialog:
   ```
   Move {count} instances?

   Changing the instance folder from {oldFolder} to {newFolder} will move
   all {count} existing instance files. Obsidian backlinks will update
   automatically.

   [Cancel]  [Move files and save]
   ```
4. On confirm → re-call `updateType(typeId, patch, { acknowledgeRenames: true, moveInstances: true })`.
5. On `partial-move` (inside `MakeError.partial-move`) → success-style notification downgraded to warning:
   - `"Saved with warnings. {moved} files moved. {failed} files couldn't be moved — see console for details."`
   - Failures log via `error` bus event with `source: 'make', code: 'partial-move'`.
6. On `ok({ schema, moveReport })` with no failures → standard save success, plus info toast: `"Moved {movedCount} instances to {newFolder}."`.
7. On any other error → existing error routing.

**Save-flow composable update** — `useMakeTypeSaveFlow` from Chunk 3 gains a `moveInstancesDialog` ref and the re-call path. Keeps `MakeType.vue` under 350 lines.

### 5.6 Store additions

```ts
// src/ui/stores/make-store.ts
export const useMakeStore = defineStore('make', () => {
    // Existing Chunk 3 refs: types, loadingTypes, error, optimisticFavoriteOverrides.
    const issues = ref<readonly CorruptTypeRef[]>([]);

    // Existing Chunk 3 loadTypes() signature preserved; body updates to consume
    // the widened ListTypesResult. No new refreshTypes() method — callers keep
    // using store.loadTypes().
    async function loadTypes(): Promise<void> {
        typesLoading.value = true;
        typesError.value = null;
        const result = await ctx.service.listTypes();
        typesLoading.value = false;
        if (result.kind === 'err') { typesError.value = formatError(result.error); return; }
        types.value  = result.value.types;
        issues.value = result.value.issues;   // new
        typesLoaded.value = true;
    }

    async function createInstance(typeId, raw, explicitFilename, options) {
        return ctx.service.createInstance(typeId, raw, explicitFilename, options);
    }

    async function deleteInstance(path) {
        return ctx.service.deleteInstance(path);
    }

    async function deleteCorruptFile(path) {
        const result = await ctx.service.deleteCorruptFile(path);
        if (result.kind === 'ok') await loadTypes();
        return result;
    }

    async function openInstance(path, mode = 'tab') {
        return ctx.workspace.openFile(path, mode);
    }

    // Subscription additions: make:instance-created, make:instance-deleted,
    // make:instances-moved all trigger loadTypes() (cache is small; lazy is fine).
});
```

Event handler is the sole cache mutator (Chunk 3 R3 rule preserved). Actions return `Result` but do not mutate `types`/`issues` directly; `loadTypes` is the only mutator.

### 5.7 i18n keys (~40 new)

Under `make.*` in `src/modules/make/locales/en.json`:

**Form**:
- `make.form.submit`, `make.form.cancel`, `make.form.panel-title`, `make.form.filename`, `make.form.filename-help`, `make.form.title-suffix`.

(The visual required-marker is a hardcoded `*` asterisk — no i18n key; visual convention, not translatable text.)

**Instance actions**:
- `make.instance-actions.open-in-obsidian`, `.delete`.

**Instance-delete confirm**:
- `make.instance-delete-confirm.title`, `.body`, `.confirm`, `.cancel`.

**Overwrite dialog**:
- `make.overwrite-dialog.title`, `.body`, `.overwrite`, `.rename`, `.cancel`.

**Move-instances dialog**:
- `make.move-instances-dialog.title`, `.body`, `.confirm`, `.cancel`.

**Move report / cascade**:
- `make.move-report.info-toast` (success case: "Moved {movedCount} instances to {newFolder}").
- `make.move-report.partial.title`, `.body` (see §6.6 for placeholders).
- `make.cascade.deleted-success`, `.deleted-partial`.

**Corrupt banner**:
- `make.corrupt.banner` (pluralized), `.show`, `.hide`, `.refresh`, `.open`, `.delete`.
- `make.corrupt.delete-confirm.title`, `.body`, `.confirm`, `.cancel`.
- `make.corrupt.invalid-json`, `.missing-required-key`, `.invalid-field-kind`, `.duplicate-field-name`, `.title-field-not-text`, `.title-field-missing`, `.invalid-field-default`, `.invalid-name`, `.invalid-folder-path`, `.io-error`, `.unknown` (fallback when a reason-kind is emitted that doesn't match any of the above — e.g., forward-compat).

All keys wired at render via `useI18n().t(...)`.

### 5.8 Accessibility

- **`SchemaForm`** — semantic `<form>`; each input has its `<label>`; invalid inputs get `aria-invalid="true"` + `aria-describedby` linking to the error `<p>`. Required fields marked with `aria-required="true"`.
- **New dialogs** (instance-delete, overwrite, move-instances, delete-corrupt) — reuse `useFocusTrap` composable from Chunk 3.5. Escape cancels. Focus returns to the trigger.
- **Row action buttons** — `aria-label="Open in Obsidian — <instance title>"` / `aria-label="Delete instance — <instance title>"` so screen readers announce row context.
- **Corrupt banner** — `role="status"` on the summary (polite). The expanded list is a semantic `<ul>`.
- **Keyboard navigation** — table row actions are in tab order after the row's main link. Tab cycles: row → [Open] → [Delete] → next row.

## 6. Move Physics & Failure Handling

### 6.1 Detection rule

`updateType` compares `prev.instancesFolder` to `nextSchema.instancesFolder` after trim. Path strings differ after trim → change detected. No path normalization beyond trim — `Books/` and `Books` are treated as distinct (matches file system semantics).

### 6.2 Pre-move enumeration

- Source list is enumerated via an **explicit-folder** helper using `prev.instancesFolder` (not `schema.instancesFolder` on the in-memory patched schema — see §4.6 step 4 rationale). Implementation either (a) factors a new `listInstancesInFolder(folder: string)` helper out of the existing `listInstances(typeId)` code, or (b) inlines `vault.list(prev.instancesFolder)` + filter to `.md` files with matching `type-id` frontmatter. Both match the Chunk 2 code path.
- If the enumerator returns `[]`: no-op move. Skip to JSON write. No event. No report.
- If the enumerator returns `N ≥ 1` AND `options.moveInstances !== true` → return `instances-move-required`. **JSON NOT written.**

### 6.3 Move sequence (when approved)

```
For each InstanceRef ref in ordered list:
    newPath = newFolder + '/' + basename(ref.path)
    rename = vault.rename(ref.path, newPath)
    if (rename.err):
        // rename.error is already a structured message from the adapter
        // (e.g., 'not-found: <oldPath>', 'target-exists: <newPath>', 'rename-failed: <msg>'),
        // so the service uses it verbatim — no re-prefixing.
        failedMoves.push({ path: ref.path, cause: rename.error })
        continue
    movedCount++
```

Rationale:
- **`vault.rename`** (new method; Obsidian adapter uses `fileManager.renameFile`) updates backlinks, embeds, and tag references atomically. Avoids `create` + `delete` orphan risk.
- **Failure isolation** — one file failing does not abort the loop. User with 47 instances doesn't lose 46 successful renames because file #12 hit a collision.
- **Atomicity caveat** — each individual rename is atomic from Obsidian's perspective, but the sequence of N renames is not. Crash mid-move → some at new path, some at old. Accepted trade-off; trash is not involved so the blast radius is bounded.

### 6.4 JSON write ordering

JSON writes **after** the move loop completes, even if some renames failed. Rationale: schema truth wins. If the user confirmed the rename, the `instancesFolder` is the new folder; failed files become orphans that the user deals with. If JSON wrote first and the move loop then crashed, users would open Make and see zero instances (the new folder is empty, the old files don't match the type's folder anymore).

### 6.5 Failure reporting

- `MoveReport.failedMoves` includes `{ path, cause }` per failure. `cause` values are the raw adapter error strings (one of `'not-found: <oldPath>'`, `'target-exists: <newPath>'`, or `'rename-failed: <msg>'`). The service does NOT wrap or re-prefix these — see §2.2 for the adapter error contract.
- `partial-move` error kind fires when `failedMoves.length > 0` *after the move loop finished*. The JSON has been written; the UI surfaces a warning, not a rollback.
- Failures are also emitted individually via `ports.eventBus.emit('error', appError)` with `source: 'make', code: 'partial-move'` and the `failedMoves` list in the payload. `ErrorHandler` logs them.

### 6.6 User-facing `partial-move` copy

- Title: via i18n key `make.move-report.partial.title`.
- Body: via i18n key `make.move-report.partial.body` with placeholders `{moved}`, `{total}`, `{newFolder}`, `{failed}`, `{oldFolder}`, `{firstNames}`, `{hasMore}` — rendered by `vue-i18n`'s interpolation.
- Example English value of `make.move-report.partial.title`: `"Type saved — some files couldn't move"`.
- Example English value of `make.move-report.partial.body`: `"{moved} of {total} files moved to {newFolder}. {failed} files remain at {oldFolder}: {firstNames}{hasMore}"`.
- Dialog action: `[OK]` (no retry button — deferred). The user can re-open the type and change `instancesFolder` back then forward to retry.

### 6.7 `listInstances` scope

Stays scoped to `schema.instancesFolder` only. Orphaned files after a partial move (at the *old* folder, with frontmatter still pointing to the type) are NOT in the table. They're surfaced ONE time via the `partial-move` warning and logged.

**Rejected alternative** — `listInstances` scans both `instancesFolder` AND any file with matching `type-id` anywhere under the types folder's sibling tree. Rejected: O(vault) read cost per page mount, and orphan handling bleeds into every instance query. Much better to surface at the one point the problem happens (the move) and accept manual cleanup.

### 6.8 Concurrent-edit caveat (deferred to Chunk 3.5)

Chunk 4 does NOT check `stat.mtime` before renaming — if another leaf/device edits a file during the move, the rename proceeds. When Chunk 3.5 hardening ships, move physics should gain the same `stat.mtime` guard on each rename.

## 7. Corrupt-type Flow

### 7.1 Detection path

Already described in §4.8 — single pass through `vault.list(typesFolder)` with per-file `vault.read` + `parseTypeSchema` returning `{ types, issues }`.

### 7.2 Repair flow

1. User clicks `[Open in Obsidian]` in the banner row → `store.openInstance(path, 'tab')` → `ctx.workspace.openFile(path, 'tab')` → file opens in a new Obsidian tab.
2. User fixes the JSON in Obsidian editor, saves.
3. User flips back to Make. **The banner is stale until refresh** (no `vault` bus subscription in v1).
4. User clicks `[Refresh]` in the banner → `store.loadTypes()` → banner row drops if the file now parses.
5. If all issues resolve, banner unmounts.

### 7.3 Deletion flow

1. User clicks `[Delete file]` → `ConfirmDialog`: `"Delete {filename}? File goes to Obsidian trash and can be restored."`.
2. On confirm → `store.deleteCorruptFile(path)` → `ctx.service.deleteCorruptFile(path)` → `vault.delete(path)` → `store.loadTypes()`.
3. Banner row drops.

### 7.4 Reason i18n keys

One key per `SchemaError.kind` + one for `IoError`. Missing keys fall back to `t('make.corrupt.unknown', { kind })`. Keys listed in §5.7.

## 8. Testing Strategy

### 8.1 Domain tests (`tests/domain/make/`)

- **`errors.test.ts`** — `CorruptTypeRef` shape coverage, `IoError` shape coverage. New file or additions to existing.
- No other domain-level additions — all pure functions unchanged from Chunk 3.

### 8.2 Module tests (`tests/modules/make/make-service.test.ts`)

- **`createInstance` happy path** — writes file, emits event, returns `InstanceRef`.
- **`createInstance` validation failure** — returns `invalid-values` with `FieldError[]`.
- **`createInstance` title-missing** — `no-title-field` when schema has `titleFieldName: null` and no `explicitFilename`.
- **`createInstance` invalid filename** — returns `invalid-values` with `__filename__` pseudo-field.
- **`createInstance` collision (no overwrite)** — returns `instance-exists`.
- **`createInstance` collision (overwrite: true)** — calls `vault.update`, succeeds.
- **`createInstance` vault failure** — returns `vault-error`.
- **`deleteInstance` happy + vault failure**.
- **`deleteType` cascade** — enumerates instances, deletes each, accumulates failures, emits one `make:type-deleted`.
- **`deleteType` cascade partial failure** — one instance delete fails, report surfaces `instanceFailures`, type JSON still deletes.
- **`deleteType` cascade with base file** — deletes base file before type JSON.
- **`deleteType` type-JSON delete fails** — returns `vault-error` (this is the one non-isolated failure).
- **`deleteCorruptFile`** — calls `vault.delete`, no events, returns `ok` / `vault-error`.
- **`updateType` folder unchanged** — no move attempt, no event.
- **`updateType` folder changed, zero instances** — no-op move, no event, JSON writes.
- **`updateType` folder changed, N instances, no `moveInstances`** — returns `instances-move-required`; JSON NOT written.
- **`updateType` with `moveInstances: true`** — all files rename, `moveReport` populated, `make:instances-moved` emitted, JSON written.
- **`updateType` with `moveInstances: true`, one file's rename fails** — other files move, `failedMoves[0]` records the failure, JSON still written, returns `MakeError.partial-move`.
- **`updateType` with `moveInstances: true`, all renames fail** — JSON still written, `partial-move` with `movedCount: 0`.
- **`listTypes` no corrupt files** — `{ types: [...], issues: [] }`.
- **`listTypes` one malformed JSON** — `types` excludes it; `issues[0].error.kind === 'invalid-json'`.
- **`listTypes` one I/O failure** — `issues[0].error.kind === 'io-error'`.
- **`listTypes` mixed (valid + corrupt + io)** — all buckets populated.
- **`listTypes` vault-level failure** — returns outer `MakeError.vault-error`.

### 8.3 Port tests

- **`tests/infrastructure/obsidian/workspace-adapter.test.ts`** (new) — `openFile('tab')` / `'current'` / `'split'` call `getLeaf(mode).openFile(tFile)` with correct arg; missing file returns `err('not-found: <path>')`.
- **`tests/infrastructure/obsidian/vault-adapter.test.ts`** (extend) — add `rename(old, new)` covering success (uses `fileManager.renameFile`), not-found, target-exists.
- **`tests/__fakes__/fake-vault.test.ts`** (if present; otherwise integration via module tests) — `rename` in-memory behavior.

### 8.4 Store tests (`tests/ui/stores/make-store.test.ts`)

- **`createInstance` / `deleteInstance`** actions call service, propagate result.
- **`openInstance`** calls `ctx.workspace.openFile` with correct mode.
- **`issues` ref** mirrors `listTypes` return; refreshes on `loadTypes()`.
- **`deleteCorruptFile`** calls service, triggers refresh on success.
- **Event subscriptions** — `make:instance-created`, `make:instance-deleted`, `make:instances-moved` all trigger `loadTypes` (spy-assertable).

### 8.5 UI component tests

- **`tests/ui/components/make/SchemaForm.test.ts`** (new):
  - Renders per-kind inputs via `INPUT_COMPONENTS` lookup.
  - Title-field-first ordering when `schema.titleFieldName` set.
  - Explicit-filename branch when `titleFieldName` null.
  - Inline `FieldError` display per input.
  - Client-side validation on submit blocks emission when invalid.
  - `serverErrors` prop surfaces `invalid-values.issues` on the right field.
  - `__filename__` pseudo-field maps to filename input.
  - Submit emits `{ raw, explicitFilename }` with correct shape.
  - Cancel emits cleanly.
- **`tests/ui/components/make/DeleteTypeDialog.test.ts`** (extend):
  - Cascade checkbox enabled when `count > 0`, hidden when `count === 0`.
  - Submit sends `{ alsoDeleteInstances, alsoDeleteBaseFile }`.
  - Success notification uses `DeleteTypeReport` counts.

### 8.6 UI page tests

- **`tests/ui/pages/make/MakeTypeInstances.test.ts`** (extend):
  - `[+ New instance]` toggles panel.
  - Empty-state branch: panel auto-opens on mount.
  - Form submit → `store.createInstance` called → success branches reset form.
  - `instance-exists` → overwrite dialog renders; confirm re-calls with `overwrite: true`; cancel focuses filename.
  - Row `[Open in Obsidian]` calls `store.openInstance(path, 'tab')`.
  - Row `[Delete]` → confirm dialog → on confirm: `store.deleteInstance(path)`.
- **`tests/ui/pages/make/MakeTypes.test.ts`** (extend):
  - Banner renders when `issues.length > 0`.
  - Banner count plurals correctly.
  - `[Show details]` expands; `[Hide]` collapses.
  - `[Open in Obsidian]` per row calls `store.openInstance(path, 'tab')`.
  - `[Delete file]` per row triggers confirm → `store.deleteCorruptFile(path)`.
  - `[Refresh]` triggers `store.loadTypes()`.
- **`tests/ui/pages/make/MakeType.test.ts`** (extend):
  - Save with `instancesFolder` change + instances present → move confirm dialog appears.
  - Move confirm → re-call with `moveInstances: true`.
  - `partial-move` result → warning notification.
  - `moveReport` success → info toast with count.

### 8.7 Storybook stories

- **`stories/components/make/SchemaForm.stories.ts`** (new) — empty, title-field-set, explicit-filename, with-errors, submitting.
- **`stories/components/make/DeleteTypeDialog.stories.ts`** (extend) — add cascade-enabled and cascade-disabled variants.
- **`stories/pages/make/MakeTypes.stories.ts`** (extend) — add corrupt-banner variants (no-issues, 1-issue, 5-issues-expanded).
- **`stories/pages/make/MakeTypeInstances.stories.ts`** (extend) — create-form-open, with-table-and-actions, overwrite-dialog-open, empty-state.
- **`stories/pages/make/MakeType.stories.ts`** (extend) — move-confirm-dialog-open, partial-move-warning-shown.

### 8.8 Test fake updates

- **`tests/__fakes__/fake-ports.ts`** — add `fakeWorkspace()` returning `{ port, calls }`.
- **`tests/__fakes__/fake-vault.ts`** — implement `rename(old, new)` on the in-memory map. Return `target-exists` if new key present. Add tests for the fake behavior if not already covered transitively.
- **`tests/__fixtures__/fake-make-context.ts`** — add `workspace` field (default: `fakeWorkspace().port`). `createFakeMakeContext` accepts an override.

### 8.9 Baseline delta

- Chunk 3.5 baseline: 754 tests, 92 files.
- Estimated Chunk 4 additions: ~90–120 new tests across 10 slices (enumerated roughly: 22 service + 3 port adapter + 5 store + 8 SchemaForm + 3 DeleteTypeDialog + 6 MakeTypeInstances + 7 MakeTypes + 4 MakeType + domain/fake additions).
- **Expected final: ≥ 850 tests** (754 baseline + ≥ 96 net), 0 lint errors, typecheck clean. Slice B test-fixture migration must NOT reduce the baseline.

### 8.10 Lint / typecheck expectations

- `max-lines: 350` holds — `MakeTypeInstances` grows; `useCreateInstanceFlow` composable extraction keeps it under. If `MakeType` slips, extend `useMakeTypeSaveFlow` rather than adding a new composable.
- No new ESLint rule changes needed. `MODULE_NAMES` already includes `make`.
- Domain layer gains `IoError` only — no Vue imports, `try/catch` ban respected.
- Store remains the sole Vue-side service consumer.

## 9. Build Order — 10 Slices

Each slice merges to master when all tests pass. No slice depends on future slice UI.

### Slice A — Domain prep
- Add `IoError` type + `CorruptTypeRef` (with `SchemaError | IoError` union) in `src/domain/make/errors.ts`.
- Type-only changes; no behavior change.
- Tests: error shape coverage.
- **Exit:** typecheck + lint green.

### Slice B — `listTypes` widened shape
- Change service return type to `ListTypesResult`.
- Implement `{ types, issues }` split in service.
- Store exposes `issues` ref; existing `loadTypes()` widens to populate both `types` and `issues` from the new `ListTypesResult` shape.
- Module tests: all corrupt/io/mixed/vault-level cases.
- Store tests: `issues` propagation.
- **UI ignores `issues`** — no banner yet.
- **Test-fixture migration (mechanical)**: every existing test call site that builds `{ kind: 'ok', value: [BOOK] }` for `listTypes` needs to become `{ kind: 'ok', value: { types: [BOOK], issues: [] } }`. Known affected files (non-exhaustive — planner should grep `listTypes` across `tests/`):
    - `tests/ui/pages/make/MakeHome.test.ts`
    - `tests/ui/pages/make/MakeTypes.test.ts`
    - `tests/ui/pages/make/MakeType.test.ts`
    - `tests/ui/router/make-routes.test.ts`
    - `tests/ui/pages/make/use-make-type-save-flow.test.ts`
    - `tests/ui/stores/make-store.test.ts`
    - `tests/__fixtures__/fake-make-context.ts`
  This migration is "modified tests," not "new tests" — does not count toward the Slice delta estimate but MUST leave the baseline ≥ 754 net.
- **Exit:** tests green; existing pages unaffected.

### Slice C — `WorkspacePort`
- `src/domain/shared/workspace-port.ts` — interface.
- `src/infrastructure/obsidian/workspace-adapter.ts` — adapter + tests.
- `tests/__fakes__/fake-ports.ts` — `fakeWorkspace()`.
- Register in `ModulePorts`; `PluginCore` passes it.
- `createMakeContext` passes workspace through.
- `fake-make-context.ts` exposes workspace field.
- **Exit:** port usable, adapter tested, no caller yet. Sequenced before Slice D so the corrupt banner's `[Open in Obsidian]` action has a real port to call.

### Slice D — Corrupt-types banner UI
- `MakeTypes.vue` renders banner when `issues.length > 0`.
- `ConfirmDialog` reuse for `[Delete file]`.
- `[Show/Hide details]`, per-row `[Open]` + `[Delete file]`, `[Refresh]`.
- i18n keys + Storybook story variants.
- `deleteCorruptFile` service + store action.
- Uses `WorkspacePort` from Slice C.
- **Exit:** corrupt files visible and actionable.

### Slice E — `SchemaForm` component
- `src/ui/components/make/SchemaForm.vue` + Storybook stories.
- `src/ui/components/make/inputs/registry.ts` — `INPUT_COMPONENTS` map.
- Unit tests: rendering, per-kind dispatch, error surfacing, title/filename branches, submit/cancel emit.
- Not wired into any page yet — pure component.
- **Exit:** component exists, tests green, stories visible.

### Slice F — `VaultPort.rename` + fake support
- Add `rename` to `VaultPort` interface.
- Implement in Obsidian adapter via `fileManager.renameFile`.
- Implement in fake vault.
- Adapter + fake tests.
- No caller yet.
- **Exit:** port method available, tested.

### Slice G — `createInstance` service + store action
- `make-service.ts` — `createInstance` implementation (all error branches).
- Module tests (happy + all error paths).
- Store `createInstance` action + tests.
- **Exit:** service callable, no UI caller.

### Slice H — `MakeTypeInstances` form wiring
- Add `[+ New instance]` button + collapsible panel hosting `SchemaForm`.
- `useCreateInstanceFlow` composable.
- Overwrite dialog on `instance-exists`.
- Page tests + PageObject updates.
- Story updates.
- **Exit:** users can create instances end-to-end.

### Slice I — Instance row actions
- `deleteInstance` service + store.
- Row action column: `[Open in Obsidian]` + `[Delete]`.
- Delete confirm via `ConfirmDialog`.
- Tests + stories.
- **Exit:** full instance CRUD live.

### Slice J — Cascade re-enable + folder-move physics
- `DeleteTypeDialog` cascade checkbox becomes interactive.
- `deleteType` cascade implementation in service + `DeleteTypeReport` shape.
- `updateType` folder-move physics + `instances-move-required` + `partial-move` error flow.
- Move-confirm dialog in `MakeType` page via `useMakeTypeSaveFlow` extension.
- `partial-move` warning notification.
- Service tests (all move + cascade cases from §8.2).
- Page tests for both confirms.
- **Exit:** all Chunk 4 deliverables live. Tag as `make-slice-4`.

**Slices execute in letter order A → B → C → D → E → F → G → H → I → J.**

## 10. Risks & Open Questions

- **Move atomicity** — N rename operations, no transaction. Documented limitation. Individual renames are atomic from Obsidian's view; the sequence is not. Crash mid-move → partial state, reconciled on next open.
- **Cascade-delete partial state** — if instance deletes succeed but the final type-JSON delete fails, the user has a "type with no instances that still exists." Recoverable by retrying delete; trash safety net covers the instances. Same class of risk as move atomicity; same acceptance rationale.
- **Concurrent edits during move** — no `stat.mtime` check. Deferred to Chunk 3.5 hardening.
- **Two Make leaves during a move** — same limitation as Chunk 3; documented, not mitigated.
- **Workspace port scope** — v1 only exposes `openFile`. Future needs (`closeLeaf`, `focusLeaf`, `revealInSidebar`) expand the port surface; not anticipated for Chunk 4.
- **Orphaned files after partial move** — surfaced once via warning, not tracked persistently. If Chunk 3.5's orphan banner item ships before Chunk 5, wire it to this flow then.
- **`INPUT_COMPONENTS` registry location** — lives in `src/ui/` parallel to the domain's `FIELD_KINDS`. Adding a new field kind = two registry entries (one domain, one UI). Acceptable cost for keeping domain Vue-free.

## 11. Definition of Done

- All 10 slices merged to master in letter order.
- Tag `make-slice-4` at final slice merge.
- Test count ≥ 850, 0 lint errors, typecheck clean.
- Manual QA in test vault: create instance, delete instance, cascade delete, folder rename (move), corrupt JSON surfacing, "Open in Obsidian" opens new tab.
- Storybook visual smoke in both light/dark themes for all new/extended stories.
- Documentation: this spec, the plan, a short paragraph in `project_make_status.md` describing what shipped + tag.
- Outbox: any Chunk 4 findings that warrant Chunk 4.5 or Chunk 5 additions.
