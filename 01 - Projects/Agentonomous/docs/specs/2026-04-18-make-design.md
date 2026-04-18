---
title: Agentonomous — Make (Document Types & CRUD)
date: 2026-04-18
status: approved-for-planning
author: Luis Mendez
project: Agentonomous
---

# Agentonomous — Make (Document Types & CRUD)

## 1. Purpose & Scope

Make is a core Agentonomous feature that turns the plugin into a miniature admin dashboard for user-defined Document Types. A Document Type is a reusable template for frontmatter-enriched markdown files: the user declares fields (text, list, number, checkbox, date, date + time), picks a target folder, and Make handles the authoring and CRUD surfaces on top of it.

The feature is positioned as the default starting point for turning a vault into a structured knowledge base — books, recipes, CRM contacts, research notes — without users needing to hand-write frontmatter or scripts.

**In scope**

- One `make` module under `src/modules/make/` with a read/write service (types + instances).
- Six Obsidian-aligned field kinds: `text`, `list`, `number`, `checkbox`, `date`, `datetime`.
- Five pages under `src/ui/pages/make/` (Home, Types, Type Config, Type Index, Settings) routed under `/make/*` in the existing app router.
- One generated `.base` file per type (generate-once; manual regenerate afterward).
- Per-type JSON schema files under a configurable folder (default `Make/Types/`).
- CRUD for instances (create, list, delete). Read and Update of instance content happen inside the Obsidian editor; Make handles the structured create-and-list surface.
- Extension of `VaultPort` with `writeText`, `delete`, `exists`, `list`.
- Homepage KPIs (types count, instances count, created this week, per-type count, recently-created list).
- Favorites (per-vault UI state, stored in module settings).
- Explicit delete-type dialog with opt-in checkboxes for cascading deletion of instances and the base file.
- Storybook-first authoring workflow for all pages and components.

**Out of scope**

- Relational list fields (list-of-references to other type instances). Deferred.
- Field-level validators beyond `required` and kind-intrinsic parsing (no `min`/`max`, `pattern`, `minLength`). The registry leaves room for them; v1 does not ship them.
- Schema migrations for existing instances when a type changes. Instances are rendered best-effort; missing fields show defaults.
- Import/export of type files between vaults. JSON files are already portable; no dedicated UI.
- Dataview integration or custom query language — the generated `.base` file is the query surface.
- Any feature flag or settings toggle for disabling Make per view — a single `enabled: true` switch in module settings is sufficient.

## 2. Architectural Approach

Make is a single bounded context that spans all four layers:

```
src/domain/make/                      pure TS — no I/O, no Obsidian, no Vue
src/modules/make/                     pure TS — orchestrator over domain + ports
src/ui/pages/make/                    Vue pages, routed under /make/*
src/ui/components/make/               Vue components, registry-aligned
src/ui/stores/make-store.ts           Pinia store, subscribes to events
src/infrastructure/obsidian/views/    make-view.ts + extended vault-adapter.ts
```

Routing is added to the existing `createAppRouter()`. Make pages share the single `AppRoot` Vue app that the Homepage view already mounts — no per-feature mini-router. A single Obsidian `ItemView` opens the Vue app at `/make`.

### 2.1 Why a single module

- A split into `make-types` (schema authoring) + `make-crud` (instance editing) was considered and rejected. Users perceive Make as one feature; splitting introduces coordination cost (shared events, shared favorites, shared store) without a real boundary payoff.
- A separate Make-only Vue router was also considered and rejected. The existing `createAppRouter` already hosts `/`, `/about`, `/dashboard`; `/make/*` fits naturally and keeps deep-linking unified.

### 2.2 Layer rules preserved

- Domain functions are pure and take no ports.
- The module calls domain functions and ports; it emits events but never imports Obsidian.
- The UI layer only imports the Pinia store; the store reaches into the module via a `getMakeService()` accessor that returns `null` pre-init (matches the existing event-inspector / file-detail pattern).
- The infrastructure layer owns `make-view.ts` and the extended `vault-adapter.ts`.

## 3. Domain Model

All domain types live in `src/domain/make/` and are pure TS.

### 3.1 Shared contracts and utilities

All shared helpers and error types used across Sections 3–5 are consolidated here so the planner has one anchor.

**Imported from existing domain shared utilities** (do not re-implement):

- `Result<T, E>` from `src/domain/shared/result.ts` — existing discriminated union (`{ ok: true; value: T } | { ok: false; error: E }` or equivalent). Used by every fallible function and service method.
- `tryAsync` / `isErr` from `src/domain/shared/try-async.js` — used when wrapping I/O in the service.
- `EventBus.emit('error', appError)` — existing `error` channel for `AppError`-shaped payloads surfaced by the `ErrorHandler` core.

**New shared types** (defined in `src/domain/make/errors.ts` and `src/domain/make/types.ts`):

```ts
// Names and slugs
export type TypeName = string;   // user-facing display name; uniqueness rules below
export type TypeId   = string;   // URL-safe slug derived at createType time, immutable thereafter

// ReadonlyRecord helper (if not already in shared)
export type ReadonlyRecord<K extends string, V> = { readonly [P in K]: V };

// Non-empty array helper (used by FieldError lists)
export type NonEmptyArray<T> = readonly [T, ...T[]];

// Schema-level errors — emitted by parseTypeSchema / validateField
export type SchemaError =
    | { kind: 'invalid-json';           reason: string }
    | { kind: 'missing-required-key';   key: string }
    | { kind: 'invalid-field-kind';     received: string }
    | { kind: 'duplicate-field-name';   name: string }
    | { kind: 'title-field-not-text';   titleFieldName: string }
    | { kind: 'title-field-missing';    titleFieldName: string }
    | { kind: 'invalid-field-default';  fieldName: string; reason: string }
    | { kind: 'invalid-name';           name: string; reason: 'empty' | 'too-long' | 'illegal-char' }
    | { kind: 'invalid-folder-path';    path: string };

// Per-value errors — emitted by validateValue / validateInstanceValues
export type FieldError =
    | { kind: 'required-missing';   fieldName: string }
    | { kind: 'invalid-text';       fieldName: string }
    | { kind: 'invalid-number';     fieldName: string }
    | { kind: 'invalid-boolean';    fieldName: string }
    | { kind: 'invalid-list';       fieldName: string }
    | { kind: 'invalid-date';       fieldName: string; expected: 'YYYY-MM-DD' }
    | { kind: 'invalid-datetime';   fieldName: string; expected: 'ISO-8601' }
    | { kind: 'unknown-field';      fieldName: string };

// Service-level data contracts
export type NewTypeDraft = {
    readonly name: string;
    readonly description?: string;
    readonly instancesFolder: string;
    readonly titleFieldName: string | null;
    readonly fields: readonly Field[];
};

export type TypeSchemaPatch = Partial<Pick<TypeSchema,
    'name' | 'description' | 'instancesFolder' | 'titleFieldName' | 'fields'
>>;

export type InstanceRef = {
    readonly typeId: TypeId;
    readonly path: string;
    readonly title: string;        // derived from filename stem
    readonly createdAt: string;    // file ctime, ISO
    readonly updatedAt: string;    // file mtime, ISO
};

export type KpiSnapshot = {
    readonly typesCount: number;
    readonly instancesCount: number;
    readonly createdThisWeek: number;
    readonly perType: ReadonlyRecord<TypeId, number>;
    readonly recentlyCreated: readonly InstanceRef[];   // most recent 5, newest first
};
```

**Naming rules applied to `TypeSchema.name` and `Field.name`:**

- Non-empty, trimmed, length ≤ 64 chars.
- `TypeSchema.name`: no filesystem-hostile characters — disallow `/ \ : * ? " < > |` and control chars. Case-insensitively unique across all types.
- `Field.name`: must be a valid YAML key — ASCII letters, digits, underscore, hyphen; must start with a letter. Unique within its type. Reserved names: `type`, `type-id` (stamped by Make into every instance).
- Violations of either rule produce a `SchemaError { kind: 'invalid-name' | 'duplicate-field-name' | 'invalid-field-kind' | … }`.

**`TypeId` generation rule** (applied once, at `createType`):

1. Kebab-slug the user-entered `name` (lowercase, ASCII only, non-alphanumeric → `-`, collapse repeats, trim).
2. If the slug collides with an existing type id, append `-2`, `-3`, … until unique.
3. Store as `TypeSchema.id`. Immutable thereafter — renames update `name` only.

### 3.2 Type schema

```ts
// type-schema.ts

export type FieldKind = 'text' | 'list' | 'number' | 'checkbox' | 'date' | 'datetime';

export type Field =
    | { readonly kind: 'text';     readonly name: string; readonly label?: string; readonly description?: string; readonly required: boolean; readonly default?: string }
    | { readonly kind: 'list';     readonly name: string; readonly label?: string; readonly description?: string; readonly required: boolean; readonly default?: readonly string[] }
    | { readonly kind: 'number';   readonly name: string; readonly label?: string; readonly description?: string; readonly required: boolean; readonly default?: number }
    | { readonly kind: 'checkbox'; readonly name: string; readonly label?: string; readonly description?: string; readonly required: boolean; readonly default?: boolean }
    | { readonly kind: 'date';     readonly name: string; readonly label?: string; readonly description?: string; readonly required: boolean; readonly default?: string /* YYYY-MM-DD */ }
    | { readonly kind: 'datetime'; readonly name: string; readonly label?: string; readonly description?: string; readonly required: boolean; readonly default?: string /* ISO 8601 */ };

export type FieldValue =
    | { readonly kind: 'text';     readonly value: string }
    | { readonly kind: 'list';     readonly value: readonly string[] }
    | { readonly kind: 'number';   readonly value: number }
    | { readonly kind: 'checkbox'; readonly value: boolean }
    | { readonly kind: 'date';     readonly value: Date }
    | { readonly kind: 'datetime'; readonly value: Date };

export type TypeSchema = {
    readonly id: string;                    // stable slug, immune to renames
    readonly name: string;                  // display name, user-editable, URL param
    readonly description?: string;
    readonly instancesFolder: string;       // target folder for instances
    readonly titleFieldName: string | null; // designated text field whose value becomes filename; null → prompt
    readonly fields: readonly Field[];
    readonly createdAt: string;             // ISO
    readonly updatedAt: string;             // ISO
    readonly baseFile?: {
        readonly path: string;
        readonly generatedAt: string;
    };
};
```

- `id` vs `name`: `id` is generated once per Section 3.1 rules, immutable, and stamped into each instance's frontmatter as `type-id: <id>`. The human-readable frontmatter key is still `type: <name>`. Renames update `name` only.
- `titleFieldName` must reference a field with `kind: 'text'`. If null, the create form shows an explicit "File name" input above the field list.
- `baseFile` being absent indicates either the type was created before the base file existed, or base-file generation failed on creation. The UI surfaces this as "base file missing — regenerate".
- Name uniqueness is enforced case-insensitively at `createType` and `updateType`; collisions surface as `MakeError { kind: 'duplicate-name' }` (see Section 5.3).

**Storage paths** (all derived from `id`, never from `name`):

- Type definition: `{typesFolder}/{id}.json`.
- Base file: `{basesFolder}/{id}.base` — always keyed on `id` so renames do not orphan the file. The base file's *internal content* (the `views[0].name` field, for example) uses `name` for display. Users looking at their file explorer will see `book.base`; users opening it in Obsidian will see "All Books" as the view name.

### 3.3 Field-kind registry (Symfony-inspired)

Each field kind is its own module under `src/domain/make/field-kinds/`:

```
field-kinds/
├── text.ts
├── list.ts
├── number.ts
├── checkbox.ts
├── date.ts
├── datetime.ts
└── index.ts
```

Each exports a `FieldKindSpec<K>`:

```ts
// field-kinds.ts

export type FieldKindSpec<K extends FieldKind> = {
    readonly kind: K;
    readonly defaultField: (name: string) => Extract<Field, { kind: K }>;
    readonly validateField: (field: Extract<Field, { kind: K }>) => readonly SchemaError[];
    readonly validateValue: (field: Extract<Field, { kind: K }>, raw: unknown) => Result<Extract<FieldValue, { kind: K }>, FieldError>;
    readonly toFrontmatter: (value: Extract<FieldValue, { kind: K }>) => unknown;
    readonly fromFrontmatter: (field: Extract<Field, { kind: K }>, raw: unknown) => Result<Extract<FieldValue, { kind: K }>, FieldError>;
};

export const FIELD_KINDS = {
    text: TEXT_FIELD_KIND,
    list: LIST_FIELD_KIND,
    number: NUMBER_FIELD_KIND,
    checkbox: CHECKBOX_FIELD_KIND,
    date: DATE_FIELD_KIND,
    datetime: DATETIME_FIELD_KIND,
} as const satisfies { [K in FieldKind]: FieldKindSpec<K> };
```

The registry is the single place where new field kinds are added. Domain consumers (`validateInstanceValues`, `renderInstanceContent`) and UI consumers (`SchemaForm.vue` dispatch, per-kind input components) look up specs by kind — no `switch` statements scatter across the codebase.

**Date / datetime semantics** (explicit to avoid timezone ambiguity):

- `Field.default` for `date` / `datetime` is stored in the JSON as a string in the canonical form (`YYYY-MM-DD` for date, full ISO 8601 with offset `Z` or `±HH:MM` for datetime).
- At form-load time, the default is parsed to a `Date` via the per-kind spec's `fromFrontmatter`.
    - `date`: the string `YYYY-MM-DD` is interpreted as **local midnight** of that calendar day. Consequence: the `Date` object's UTC instant may differ across machines, but the displayed day is always the one the user typed. Round-trip: `toFrontmatter` reads the local Y-M-D components and emits them again.
    - `datetime`: the full ISO string is parsed as an absolute instant (timezone-aware). `toFrontmatter` emits the instant in the user's local offset (not normalized to `Z`).
- Validation (`validateValue`) accepts `string | Date | number` (Obsidian may hand back any of these) and narrows via the per-kind spec. Invalid inputs produce `FieldError { kind: 'invalid-date' | 'invalid-datetime' }`.

- Dates are kept as `Date` in-memory. `toFrontmatter` for the `date` kind produces `YYYY-MM-DD`; for `datetime` it produces full ISO 8601. YAML's ambiguous date parsing is avoided by always emitting explicit strings.
- `fromFrontmatter` is tolerant: it accepts whatever Obsidian would hand back (string or Date), narrows, and returns a `FieldError` on failure.

### 3.4 Supporting domain functions

```ts
// type-schema-codec.ts
export function parseTypeSchema(raw: unknown): Result<TypeSchema, SchemaError>;
export function serializeTypeSchema(schema: TypeSchema): string;  // stable key order, 2-space indent

// instance-ops.ts
export function validateInstanceValues(
    schema: TypeSchema,
    raw: ReadonlyRecord<string, unknown>,
): Result<readonly FieldValue[], readonly FieldError[]>;

export function renderInstanceContent(
    schema: TypeSchema,
    values: readonly FieldValue[],
): { readonly frontmatter: string; readonly body: string; readonly fullMarkdown: string };

export function resolveInstancePath(
    schema: TypeSchema,
    values: readonly FieldValue[],
    explicitFilename: string | null,
): Result<string, 'no-title-field-and-no-filename' | 'invalid-filename'>;

// sanitize-filename.ts — shared helper used by resolveInstancePath
export function sanitizeFilenameStem(raw: string): string;

// base-file.ts
export function generateBaseYaml(schema: TypeSchema): string;

// yaml-quote.ts — internal helper used by generateBaseYaml and renderInstanceContent
export function yamlQuote(value: string): string;
```

**`sanitizeFilenameStem` rules** (consumed by `resolveInstancePath`):

1. Strip filesystem-hostile characters: `/ \ : * ? " < > |` and ASCII control characters.
2. Collapse consecutive whitespace to single spaces, trim leading/trailing whitespace.
3. Remove trailing dots (Windows quirk).
4. Cap length at 120 characters (leaves room for `.md` extension and collision suffix).
5. If the result is empty, return empty — caller returns `'invalid-filename'`.

`resolveInstancePath` flow:

- If `explicitFilename` is non-null, sanitize it. Empty result → `'invalid-filename'`.
- Else, look up the `titleFieldName` field in `values`, pull its text, sanitize. If no title field and no explicit name → `'no-title-field-and-no-filename'`.
- Target path: `{schema.instancesFolder}/{stem}.md`. Collision handling is the service's job (it calls `ports.vault.exists` and either returns `MakeError.instance-exists` or proceeds on overwrite — see Section 8.2).

**`yamlQuote` rules**:

- Always emit double-quoted strings.
- Escape `\` → `\\` and `"` → `\"`. Control characters are rejected upstream by `invalid-name` / `sanitizeFilenameStem`, so no other escaping is needed.
- Used in `generateBaseYaml` for the `type == "<name>"` filter expression and for any `displayName` value.

All deterministic. Snapshot-testable. Error unions are exhaustive.

## 4. `VaultPort` Extension

`VaultPort` gains four methods:

```ts
// src/domain/shared/vault-port.ts

export type VaultPort = {
    // Existing
    read(path: string): Promise<Result<string, VaultError>>;

    // New
    writeText(path: string, content: string, options?: { createFolders?: boolean }): Promise<Result<void, VaultError>>;
    delete(path: string): Promise<Result<void, VaultError>>;
    exists(path: string): Promise<boolean>;
    list(folderPath: string, options?: { extension?: string }): Promise<Result<readonly string[], VaultError>>;
};

export type VaultError =
    | { kind: 'not-found';       path: string }
    | { kind: 'already-exists';  path: string }
    | { kind: 'not-a-folder';    path: string }
    | { kind: 'io-error';        path: string; reason: string };
```

### 4.1 Behaviour contract

- `writeText` with `createFolders: true` creates missing ancestor folders. Overwrites existing files unconditionally — callers that want create-only semantics call `exists` first.
- `delete` goes through Obsidian's system trash (`vault.trash(file, true)`), not a hard delete, so Make's explicit delete dialog pairs with a filesystem-level safety net. Returns `not-found` if the path is missing (not silently-success).
- `exists` never errors. Returns `false` for missing paths or anything that isn't a file.
- `list` is non-recursive. Returns the relative paths of immediate children of the folder filtered by extension. If the folder does not exist, returns an empty array (so "no types yet" does not require a pre-flight `exists`). Returns `not-a-folder` only if the path exists but is a file.

### 4.2 Adapter and fake

- `src/infrastructure/obsidian/vault-adapter.ts` implements the new methods on top of `app.vault.create|modify|trash|getAbstractFileByPath|getFiles`.
- `tests/__fakes__/fake-vault.ts` mirrors the API using a `Map<string, string>` store. Domain and module tests alike consume this fake.

### 4.3 Rejected alternatives

- A separate `VaultWritePort` was considered to keep reads separate from writes. Rejected: the existing `VaultPort` surface is already slim and the "one port per responsibility" split is a purity trade-off without runtime benefit. Callers can still avoid mutations by typing against a `Readonly<Pick<VaultPort, 'read' | 'exists' | 'list'>>` subset where needed.
- A `hard?: boolean` flag on `delete` to skip the trash. Rejected for v1; trash is always the correct behavior given Make's explicit delete confirmation is already the "are you sure" step.

## 5. The `make` Module

### 5.1 Settings

```ts
// make-settings.ts

export type MakeSettings = {
    readonly enabled: boolean;
    readonly typesFolder: string;          // default 'Make/Types'
    readonly basesFolder: string;          // default 'Make/Bases'
    readonly defaultInstancesRoot: string; // default 'Make/Instances'
    readonly favorites: readonly string[]; // type ids
};
```

Favorites live here (per-vault UI state) rather than in the type JSON file — sharing a type should not share personal UI preferences.

### 5.2 Events

```ts
// make-events.ts

declare module '../../domain/shared/event-bus.js' {
    interface EventMap {
        'make:type-created':       { typeId: string; name: string };
        'make:type-updated':       { typeId: string; name: string };
        'make:type-deleted':       { typeId: string; name: string };
        'make:instance-created':   { typeId: string; path: string };
        'make:instance-deleted':   { typeId: string; path: string };
        'make:base-regenerated':   { typeId: string; basePath: string };
        'make:favorite-toggled':   { typeId: string; isFavorite: boolean };
    }
}
```

Other modules can subscribe without coupling to Make's internals. Make also emits the existing shared `error` bus event (via `ports.eventBus.emit('error', appError)`) with `AppError { source: 'make', code: MakeError['kind'], … }` whenever a write fails, so the `ErrorHandler` core surface picks it up for logging.

**Out of scope — observation of external vault mutations.** Make does not subscribe to `vault` bus events in v1. If a user adds a markdown file with matching frontmatter via Obsidian's file explorer or an external editor, it will appear in KPIs and instance tables on the next refresh (pages re-query the vault on mount and on `make:*` events). Live-syncing external edits is a future enhancement.

### 5.3 Service

```ts
// make-service.ts

export type MakeService = {
    listTypes():                                             Promise<Result<readonly TypeSchema[], MakeError>>;
    loadType(typeId: string):                                Promise<Result<TypeSchema, MakeError>>;
    createType(draft: NewTypeDraft):                         Promise<Result<TypeSchema, MakeError>>;
    updateType(typeId: string, changes: TypeSchemaPatch):    Promise<Result<TypeSchema, MakeError>>;
    deleteType(typeId: string, options: DeleteTypeOptions):  Promise<Result<DeleteTypeReport, MakeError>>;
    listInstances(typeId: string):                           Promise<Result<readonly InstanceRef[], MakeError>>;
    createInstance(typeId: string, raw: ReadonlyRecord<string, unknown>, explicitFilename: string | null):
                                                             Promise<Result<InstanceRef, MakeError>>;
    deleteInstance(path: string):                            Promise<Result<void, MakeError>>;
    regenerateBaseFile(typeId: string):                      Promise<Result<string /* basePath */, MakeError>>;
    toggleFavorite(typeId: string):                          Promise<void>;
    getKpis():                                               Promise<KpiSnapshot>;
};

export type DeleteTypeOptions = {
    readonly alsoDeleteInstances: boolean;
    readonly alsoDeleteBaseFile: boolean;
};

export type DeleteTypeReport = {
    readonly instancesDeleted: number;
    readonly baseFileDeleted: boolean;
};

export type MakeError =
    | { kind: 'vault-error';         cause: VaultError }
    | { kind: 'invalid-schema';      issues: NonEmptyArray<SchemaError> }
    | { kind: 'invalid-values';      issues: NonEmptyArray<FieldError> }
    | { kind: 'type-not-found';      typeId: TypeId }
    | { kind: 'duplicate-name';      name: string }
    | { kind: 'instance-exists';     path: string }
    | { kind: 'no-title-field' }
    | { kind: 'base-generation-failed'; cause: VaultError }
    | { kind: 'not-implemented' };   // used only by Slice 1 scaffold
```

`createMakeService(ports, settings)` is a factory returning the object above; methods close over the captured deps. KPIs are computed on demand, not cached.

**`createType` flow** (authoritative for planner):

1. Validate the draft: field-kind validators + name constraints (Section 3.1) + uniqueness check against current `listTypes()` → returns `invalid-schema` or `duplicate-name` on failure.
2. Generate `id` from `draft.name` (Section 3.1 slug rules); stamp `createdAt` = `updatedAt` = now.
3. Serialize with `serializeTypeSchema`; `ports.vault.writeText({typesFolder}/{id}.json, …, { createFolders: true })`. Vault failure → `vault-error`.
4. Generate base YAML; write to `{basesFolder}/{id}.base` with `createFolders: true`. If this fails, save the type JSON anyway (type is usable without a base), stamp `baseFile = undefined`, surface a notification, and return success with a warning surfaced via `notifications.warn`. The service returns `ok(schema)` in this case — partial-success is not an error because the type is still usable; the UI banner will tell the user to regenerate.
5. On full success, stamp `schema.baseFile = { path, generatedAt }`, re-serialize, re-write the JSON (two-step write is intentional — the base path must exist before it's recorded).
6. Emit `make:type-created`.

### 5.4 Module shape

```ts
// make-module.ts

export const VIEW_TYPE_MAKE = 'agentonomous-make';

type ModuleState = {
    readonly service: MakeService;
    settings: MakeSettings;
};

let state: ModuleState | null = null;

export function getMakeService(): MakeService | null { return state?.service ?? null; }

export const MakeModule = defineModule<MakeSettings>({
    id: 'make',
    name: 'Make',
    dependsOn: ['core'],
    settingsKey: 'make',
    settingsDefaults: MAKE_DEFAULTS,
    validateSettings: validateMakeSettings,
    settingsSchema: { /* four text fields + toggle */ },
    messages: { en: enMessages },
    views: [
        { type: VIEW_TYPE_MAKE, displayName: 'Make', icon: 'hammer', defaultLocation: 'tab' },
    ],
    commands: [
        { id: 'open-make',        name: 'Open Make',             opensView: VIEW_TYPE_MAKE,
          ribbon: { icon: 'hammer', title: 'Make', visibleByDefault: true } },
        { id: 'make-create-type', name: 'Make: create new type', /* routes to /make/types/new/config */ },
    ],
    init(ports, settings) {
        if (state !== null) void this.destroy();     // idempotent per module convention
        const service = createMakeService(ports, settings);
        state = { service, settings };
    },
    onSettingsChange(next) {
        // If folder paths changed, rebuild the service so its captured refs are consistent.
        // Favorites and enabled-flag changes do NOT require a rebuild — they're read through
        // getSettings() on each service call, not captured at factory time.
        const prev = state?.settings;
        if (prev === undefined) return;
        const folderChanged =
            prev.typesFolder !== next.typesFolder ||
            prev.basesFolder !== next.basesFolder ||
            prev.defaultInstancesRoot !== next.defaultInstancesRoot;
        if (folderChanged) {
            void this.destroy();
            void this.init(/* ports from closure */, next);
        } else {
            state!.settings = next;
        }
    },
    destroy() { state = null; },
});
```

- Matches the module singleton pattern already established by `event-inspector` and `health-monitor`.
- `init` is idempotent (self-guards by calling `destroy` first). `onSettingsChange` follows the same discipline for folder-path changes — no partial-state window.
- There is no protection against in-flight service calls during a folder-path rebuild. Folder-path changes are user-initiated in the settings UI and considered rare; any in-flight `Promise` resolves against the old service closure and then becomes stale state to the UI. The UI store listens for `onSettingsChange` via `SettingsPort` and refreshes on the next tick. Documented limitation; not worth a request cancellation framework in v1.

## 6. UI Layer

### 6.1 Routing

```ts
// src/ui/pages/make/routes.ts
export const makeRoutes: readonly RouteRecordRaw[] = [
    { path: '/make',                      name: 'make-home',        component: MakeHome,       meta: { layout: 'dashboard' } },
    { path: '/make/types',                name: 'make-types',       component: MakeTypes,      meta: { layout: 'dashboard' } },
    { path: '/make/types/new/config',     name: 'make-type-new',    component: MakeTypeConfig, meta: { layout: 'dashboard' } },
    { path: '/make/types/:typeId/config', name: 'make-type-config', component: MakeTypeConfig, meta: { layout: 'dashboard' }, props: true },
    { path: '/make/types/:typeId',        name: 'make-type-index',  component: MakeTypeIndex,  meta: { layout: 'dashboard' }, props: true },
    { path: '/make/settings',             name: 'make-settings',    component: MakeSettings,   meta: { layout: 'dashboard' } },
];
```

Spread into the main router config. **URL key is `:typeId` (the stable `TypeSchema.id`), not the user-editable `name`.** Rationale: a rename does not invalidate open tabs, bookmarks survive renames, and collisions are impossible (id is unique by construction). The UI shows `name` in breadcrumbs and page titles; the URL slug is visible but never user-typed.

The explicit `/make/types/new/config` route handles new-type mode (detected by route name, not by a `new` sentinel in the `:typeId` param — that avoided a reserved-value ambiguity).

If a user refreshes a tab after the underlying type was deleted, `MakeTypeConfig`/`MakeTypeIndex` load receives `type-not-found`, shows an empty state with a "Type no longer exists — back to types list" action.

### 6.2 Pages

- **`MakeHome.vue`** — dashboard: KPI strip + favorite-first type grid + recently-created list + "Create type" action.
- **`MakeTypes.vue`** — full list of types (table). Columns: name, instance count, base-file present, favorite, updated-at.
- **`MakeTypeConfig.vue`** — schema editor. Header fields (name, description, instances folder, title-field selector), list of `<FieldEditor />` rows, footer actions (save, delete via dialog, regenerate base file).
- **`MakeTypeIndex.vue`** — instance CRUD. Header with Create toggle, `<InstanceTable />`, collapsible `<SchemaForm />`.
- **`MakeSettings.vue`** — Make-wide settings, same fields as the Obsidian settings tab.

### 6.3 Components

```
src/ui/components/make/
├── KpiStrip.vue
├── TypeCard.vue
├── FieldEditor.vue
├── SchemaForm.vue
├── InstanceTable.vue
├── DeleteTypeDialog.vue
└── inputs/
    ├── TextInput.vue
    ├── ListInput.vue           chip input
    ├── NumberInput.vue
    ├── CheckboxInput.vue
    ├── DateInput.vue
    └── DatetimeInput.vue
```

The six input components mirror the six domain field-kind specs — one file per kind on both sides. `SchemaForm.vue` dispatches to the correct input via `FIELD_KINDS[field.kind]` lookup.

### 6.4 Store

```ts
// src/ui/stores/make-store.ts
export const useMakeStore = defineStore('make', () => {
    const types = ref<readonly TypeSchema[]>([]);
    const kpis = ref<KpiSnapshot | null>(null);
    const loadingTypes = ref(false);
    const error = ref<MakeError | null>(null);

    // …refresh, CRUD, favorite toggle actions wrap getMakeService()
    // …auto-refresh on make:* bus events via a composable used in page setup
});
```

The store is the only boundary the Vue layer crosses. Pages never import the module directly.

### 6.5 Obsidian view

`src/infrastructure/obsidian/views/make-view.ts`:

- `VIEW_TYPE_MAKE = 'agentonomous-make'`
- `ItemView` wrapper that mounts `AppRoot.vue` via `createModuleVueApp`, then `router.push('/make')` so the user always lands on Home.
- Added to `VIEW_REGISTRATIONS` in `src/infrastructure/obsidian/views/index.ts`.

### 6.6 Shared `AppRoot` trade-off

Make reuses the shared `AppRoot`/router rather than a Make-specific Vue entry. This matches how Homepage and Dashboard views behave today: they share one router instance. If two Make leaves are opened simultaneously, they display the same route. This is consistent with existing behavior and is documented as an expected limitation.

## 7. Obsidian Bases File Generation

### 7.1 Generated shape

For a type with `id: 'book'`, `name: 'Book'`, fields `title: text, author: text, pages: number, read: checkbox, published: date`:

```yaml
# Make/Bases/book.base
filters:
    and:
        - file.ext == "md"
        - type == "Book"

formulas: {}

properties:
    title:      { displayName: "Title" }
    author:     { displayName: "Author" }
    pages:      { displayName: "Pages" }
    read:       { displayName: "Read" }
    published:  { displayName: "Published" }

views:
    - type: table
      name: "All Books"
      order:
          - file.name
          - title
          - author
          - pages
          - read
          - published
```

### 7.2 Mapping rules

- Filter: `and` of `file.ext == "md"` and `type == "<schema.name>"`.
- `properties`: one entry per field; `displayName` is `field.label ?? field.name`.
- `views`: one default `table` view, column order = `file.name` first, then fields in declared order.
- `formulas`: empty — users add their own after generation.

### 7.3 Lifecycle

- On `createType`: generate YAML, `ports.vault.writeText` into `{basesFolder}/{schema.name}.base` with `createFolders: true`, stamp `schema.baseFile` into the JSON. If the write fails, save the type JSON anyway and surface a warning.
- On `updateType`: do **not** touch the base file. The Type Config page shows a "Schema changed since base generation" banner when `schema.updatedAt > schema.baseFile.generatedAt`, with a "Regenerate base file" action button.
- On `regenerateBaseFile`: overwrite unconditionally. User is always explicitly requesting this.
- On `deleteType({ alsoDeleteBaseFile: true })`: delete via `ports.vault.delete` (trash).

### 7.4 YAML emission

Hand-rolled serializer — the shape is fixed, deterministic, has no loops or anchors. Importing a YAML library for ~60 lines of output is not warranted. Domain tests snapshot-assert the exact output per schema variant.

**Escaping rules** (via `yamlQuote` from Section 3.4):

- Every user-supplied string (`type == "<name>"`, `displayName`, view `name`) is double-quoted and escaped: `\` → `\\`, `"` → `\"`.
- Name characters that would require more exotic YAML escaping (control chars, newlines) are rejected upstream by `SchemaError { kind: 'invalid-name' }` rules in Section 3.1, so the serializer never sees them.
- Field names (`Field.name`) are YAML-safe by construction (the name validator only allows `[A-Za-z][A-Za-z0-9_-]*`) so they are emitted bare.

**File path** is `{basesFolder}/{id}.base`. The id is always filesystem-safe (kebab slug from Section 3.1), so no sanitization is needed at write time.

### 7.5 Future compatibility

Obsidian Bases is an evolving feature. Generated files are seeds, not authoritative contracts — users can hand-edit freely. If a future Obsidian version changes the Bases YAML schema, the generator is updated and users hit "Regenerate base file" when ready.

## 8. UX Flows

### 8.1 Create type

1. User clicks **Create type** on Home or Types list → navigate to `/make/types/new/config`.
2. `MakeTypeConfig` detects the `new` sentinel and enters new-type mode with a pre-seeded single `text` field.
3. Save → `createType(draft)` → service creates the JSON file, generates the base file, emits `make:type-created` → store refreshes → `router.replace` to `/make/types/<newName>/config`.
4. Cancel → back to `/make/types` without saving.

### 8.2 Create instance

1. On `MakeTypeIndex`, the `<SchemaForm>` is visible in a collapsible panel (open by default).
2. If `titleFieldName` is set, that field is first and labeled "(this becomes the filename)". Otherwise an explicit "File name" input renders at the top.
3. Submit → values are validated via `FIELD_KINDS[...].validateValue`. If any value fails, the form surfaces per-field errors inline (`FieldError[]` driven) and does not submit.
4. On valid values, `resolveInstancePath` is called (Section 3.4):
    - **Title-field case** — the `text` value of the title field is run through `sanitizeFilenameStem`. Target is `{schema.instancesFolder}/{stem}.md`.
    - **Explicit-filename case** — the typed filename (minus any `.md` extension) is sanitized.
    - Empty sanitized result → `invalid-filename` surfaced as an inline form error on the title/filename input.
5. Service checks `ports.vault.exists(path)`:
    - If the file exists, return `MakeError { kind: 'instance-exists', path }`. The UI shows a modal: **Overwrite** or **Choose different name**. No silent auto-rename — users stay in control.
    - If the file does not exist, write via `ports.vault.writeText(path, renderInstanceContent(...).fullMarkdown)`.
6. On success, emit `make:instance-created`, form resets to defaults, instance table refreshes.

### 8.3 Delete type

`DeleteTypeDialog.vue`:

```
Delete type "Book"?

The type definition file Make/Types/book.json will be deleted.

[ ] Also delete 47 instances in Books/        (off by default)
[ ] Also delete the generated base file         (off by default)
    Make/Bases/book.base

Deleted files go to Obsidian trash and can be restored.

[Cancel]  [Delete type]
```

Both opt-in checkboxes default off. Instance count loaded lazily when the dialog opens. Success notification quotes the `DeleteTypeReport { instancesDeleted, baseFileDeleted }`.

### 8.4 Favorites

Star icon on `TypeCard` and in the `MakeTypes` table → `toggleFavorite(typeId)` → service flips the id in `MakeSettings.favorites`, writes via `SettingsPort.saveSection('make', next)`, and emits `make:favorite-toggled`. The store subscribes to `make:favorite-toggled` (not the generic settings change) to re-sort the homepage grid; that keeps the favorite flow decoupled from unrelated settings edits.

### 8.5 Settings surfaces

- Obsidian Settings tab: auto-rendered from `MakeModule.settingsSchema`.
- `MakeSettings.vue` at `/make/settings`: same four fields, surfaced inline for users who don't want to bounce to the settings screen.

Both write through the same `SettingsPort` section — not two sources of truth.

### 8.6 Empty states

- **No types yet** — `MakeHome` replaces the KPI strip and grid with a centered empty state + single "Create type" button.
- **No instances for a type** — `MakeTypeIndex` shows a "create your first one" prompt with the form already visible.

### 8.7 Error handling

- All service methods return `Result<T, MakeError>`; none throw.
- The store translates errors to user notifications via `ports.notifications.warn(t.t(errorKey))`. Messages live in `src/modules/make/locales/en.json`.
- Form-level validation errors (per-field) surface inline under each input — no notification noise.
- Write failures emit an `error` bus event so the `ErrorHandler` core surface picks them up for logging.

## 9. Testing Strategy

### 9.1 Layer-by-layer

- **Domain** (`tests/domain/make/`) — pure unit tests. Target: ~100% statement coverage.
    - `type-schema-codec.test.ts` — parse/serialize roundtrip, all `SchemaError` variants.
    - `field-kinds/*.test.ts` — per-kind file covering `defaultField`, `validateField`, `validateValue` (happy + rejected), `toFrontmatter`/`fromFrontmatter` roundtrip.
    - `instance-ops.test.ts` — `validateInstanceValues`, `renderInstanceContent` snapshot, `resolveInstancePath` for all path cases.
    - `base-file.test.ts` — snapshot test per schema shape.
- **Module** (`tests/modules/make/`) — `fakeModulePorts()` + `fakeVault()`.
    - `make-service.test.ts` — createType writes JSON + base + emits event; deleteType with/without cascade; regenerateBaseFile overwrites; instance CRUD including path resolution; error paths.
    - `make-module.test.ts` — init/destroy idempotency, onSettingsChange reconfigures, command registrations.
- **UI components** — Storybook stories double as visual regression checks (existing `@storybook/addon-vitest` pattern). Dedicated `.test.ts` only for components with non-trivial logic (`SchemaForm` validation, `FieldEditor` reorder).
- **UI stores** (`tests/ui/stores/`) — `make-store.test.ts` covers refresh / create / delete / favorite toggle / error propagation, with a fake service.
- **UI pages** — stories + PageObject-driven smoke tests asserting `data-testid` surfaces for each fixture state.

### 9.2 No plugin-level E2E in v1

Matches the rest of the codebase. Manual QA happens via `npm run build:deploy` into the test vault.

## 10. Build Order (Five Slices)

Each slice ships a green, usable product.

### Slice 1 — Foundation & Read Paths

- Extend `VaultPort` + adapter + fake (all four new methods). **Breaking change to the port interface** — all existing `fakeVault()` consumers must add the four new method stubs in the same slice; lint/tsc will surface every call site.
- Domain: `type-schema` (+ shared contracts from Section 3.1), `type-schema-codec`, `field-kinds/*`, `instance-ops`, `base-file`, `sanitize-filename`, `yaml-quote`.
- Module skeleton with `listTypes` + `loadType` fully implemented. All write methods (`createType`, `updateType`, `deleteType`, `createInstance`, `deleteInstance`, `regenerateBaseFile`) return `err({ kind: 'not-implemented' })` — consistent with the "service methods never throw" rule from Section 8.7.
- UI: per-kind input components + `SchemaForm` + `FieldEditor` + their Storybook stories. All new components use the Storybook theme toolbar pattern introduced in the recent commits (light/dark via decorator).
- No routes wired.

### Slice 2 — Read Pages

- Add Make routes to `createAppRouter`.
- Implement `MakeHome`, `MakeTypes`, `MakeTypeConfig` (view-only), `MakeTypeIndex` (list-only).
- Register `make-view.ts`.
- Outcome: Make is visible. Users with hand-crafted JSON type files can browse them.

### Slice 3 — Type Authoring

- Service: `createType`, `updateType`, `deleteType` (type-only, no instance cascade yet).
- `MakeTypeConfig` becomes editable; `DeleteTypeDialog` for type-only delete.
- Base-file generation hooked into `createType`; `regenerateBaseFile` action.
- Favorites.

### Slice 4 — Instance Authoring

- Service: `createInstance`, `deleteInstance`, `listInstances`.
- Submission form on `MakeTypeIndex`; table delete action.
- `DeleteTypeDialog` gains the cascade checkbox.
- "Open in Obsidian" row action.

### Slice 5 — Polish

- KPIs computed and wired to `MakeHome`.
- Recently-created list.
- `MakeSettings.vue`.
- Locale file finalized.
- Ribbon entry + command-palette entries.

## 11. Storybook-First Workflow

### 11.1 Fixtures

`stories/__fixtures__/make.ts` — single source of truth for `BOOK_SCHEMA`, `RECIPE_SCHEMA`, `EMPTY_SCHEMAS`, `LARGE_SCHEMAS` (50 types), `KPI_SAMPLE`, `INSTANCES_SAMPLE`. Reused across stories and `SchemaForm` unit tests.

### 11.2 Mocked store

A Storybook decorator `withMakeStore(seedFn)` provisions a fresh Pinia per story and hydrates the store via `seedFn(store)`. The seeding happens from the decorator — `useMakeStore` itself stays free of test-only helpers; the decorator just uses the public refs/actions to push fixture data in. This follows the fresh-Pinia-per-story pattern established in the recent story commits without polluting the production store API.

### 11.3 Visual conventions

All new Make components integrate with the Storybook theme toolbar introduced in recent commits (light/dark parity via the shared `withTheme` decorator). Each story exports are expected to render cleanly in both themes; per-kind input components' stories include explicit light and dark snapshots where visual differences matter.

### 11.4 Phased authoring

**Phase 1 (bottom-up):** per-kind inputs → `FieldEditor` → `SchemaForm` → presentational components (`KpiStrip`, `TypeCard`, `InstanceTable`, `DeleteTypeDialog`).

**Phase 2 (pages):** `MakeHome` → `MakeTypes` → `MakeTypeConfig` → `MakeTypeIndex` → `MakeSettings`, each with empty / typical / populated / error state stories.

**Phase 3 (plugin backend):** domain TDD → extended port/adapter → service + module → store wiring to real service → Obsidian view registration.

Phase 3 progresses independently of Phase 1/2 — Storybook doesn't require the plugin side.

## 12. Conventions & Rules Applied

- **DDD layers preserved** — domain is pure, module is thin, UI only touches the store, infrastructure adapts to Obsidian.
- **Module singleton pattern** — `let state: ModuleState | null = null` with idempotent `init`.
- **No `any`** — unions and narrowing, explicit `unknown` for external raw inputs, `Result<T, E>` for fallible operations.
- **File naming** — kebab-case for TS, PascalCase for Vue SFCs. Tests mirror source paths.
- **ESM `.js` import extension** everywhere.
- **`data-testid` on every assertable UI surface** — continues the PageObject convention.
- **Per-kind files on both domain and UI sides** — adding a future kind (e.g. `url`, `select`, `relation`) is one new file in `src/domain/make/field-kinds/` + one in `src/ui/components/make/inputs/` + one registry entry on each side.

## 13. Risks & Open Questions

- **Obsidian Bases schema drift.** Mitigated by generate-once + manual regenerate + documented "seed, not contract" stance.
- **Filename collisions.** Handled by explicit dialog offering overwrite vs. rename — never silent.
- **Two Make leaves sharing a router.** Documented limitation consistent with existing behavior.
- **Schema evolution for existing instances.** Not migrated. Instances render best-effort; missing fields show defaults. If usage shows pain, a future "migrate existing instances" action can be added per type.
- **Trash vs. hard delete.** v1 is trash-only. A `hard` option can be added without API breakage if needed.
