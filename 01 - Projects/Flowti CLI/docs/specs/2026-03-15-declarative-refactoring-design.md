# Declarative Refactoring Design Spec

**Date:** 2026-03-15
**Status:** Draft
**Scope:** Flowti CLI — controllers, domain stores, test infrastructure, dead code removal

## Problem Statement

The Flowti CLI has strong architecture (layered DI, sitemap-driven UI, pipeline engine) but accumulated boilerplate across:

- **28 controllers** (~3,500 lines) repeating flag parsing, project guards, type coercion, error responses, and renderer wiring
- **9+ markdown stores** (~1,800 lines) repeating frontmatter parsing, CRUD operations, directory resolution, and field mapping
- **350+ test files** repeating vi.mock() blocks, initializeDeps() calls, mockProject construction, and display output assertions
- **Dead code and legacy patterns** — `adapt()` boilerplate, duplicated helpers (`flagStr`, `noProjectResponse`), incomplete mock stubs, stale type casts

This refactor eliminates the boilerplate, removes legacy code, and replaces it with declarative engines that enforce patterns via TypeScript, ESLint, and conformance tests.

## Goals

1. Eliminate mechanical boilerplate from controllers, stores, and tests
2. Make adding a new command or store a matter of writing a descriptor
3. Improve testability by testing engines once and descriptors cheaply
4. Remove all dead code, legacy patterns, and backwards-compatibility shims
5. Enforce patterns by typecheck, lint, and test — deviations fail CI
6. Maintain zero runtime dependencies
7. Handle 100% of existing edge cases — no partial migration

## Non-Goals

- Changing the CLI's public API (commands, flags, output)
- Modifying the sitemap/UI layer
- Refactoring the pipeline engine
- Moving to config files (YAML/JSON) for controller or test definitions
- Refactoring infrastructure singletons (world-state-manager, worker-manager, agent-shell, agent-process-runner — these are new and stable)

## Design

### 1. Command Schema Engine

A `defineCommand()` function that accepts a command descriptor and returns a fully wired `CommandHandler`. A generic engine handles flag parsing, validation, project guards, and renderer wiring. The handler function contains only domain logic.

#### Command Descriptor

```typescript
interface CommandDescriptor<TFlags = Record<string, unknown>, TModel = unknown> {
  requires?: "project";
  flags?: Record<string, FlagSpec>;
  rawArgs?: boolean;
  wildcardPrefix?: string;                     // e.g. "report:" — engine strips prefix, sets ctx.wildcard
  handler: (ctx: CommandContext<TFlags>) => TModel | Promise<TModel>;
  renderer: RendererFn<TModel>;
  exitCode?: number | ((model: TModel) => number | undefined);
}

// RendererFn receives the model and log function.
// The engine calls renderer(model, ctx.deps.log) automatically.
type RendererFn<TModel> = (data: TModel, log: LogFn) => void;

interface FlagSpec {
  type: "string" | "boolean" | "number" | "list";
  required?: boolean;
  default?: unknown;
  choices?: string[];
  coerce?: "int" | "float";
  hint?: string;
  parse?: (raw: string) => unknown;
}

interface CommandContext<TFlags> {
  command: string;                             // full command string (e.g. "report:coverage")
  flags: TFlags;
  rawArgs?: string[];
  project?: ProjectContext;
  deps: CliDeps;
  wildcard?: string;                           // suffix after wildcardPrefix (e.g. "coverage")
}

// Batch registration for dynamically generated commands (e.g. make:*)
function defineCommands(
  descriptors: Array<{ name: string } & CommandDescriptor>
): void;

// Example: make.controller.ts dynamic registration
defineCommands(
  COMPONENT_DEFINITION_IDS.map(id => {
    const shortName = id === "c4-component" ? "c4-component" : id.replace("c4-", "");
    return {
      name: `make:${shortName}`,
      requires: "project" as const,
      flags: { name: { type: "string" as const } },
      handler: (ctx) => makeComponent(id, ctx.flags.name, ctx.project!, ctx.deps),
      renderer: renderMakeResult,
    };
  })
);
```

#### Engine Responsibilities

1. Parse `req.flags` against the flag spec — coerce types, apply defaults
2. Validate required flags — return error response with hint automatically
3. Validate choices — return error with allowed values automatically
4. Check `requires: "project"` — return `noProjectResponse` using `renderNoProject` from `common-renderers.ts` (preserves existing output format)
5. Resolve wildcard: if `wildcardPrefix` is set and command matches, strip prefix into `ctx.wildcard`
6. Set `ctx.command` to the full command string
7. Call handler with typed, validated flags
8. Call `renderer(model, ctx.deps.log)` and wrap in `dataResponse()`
9. Apply exitCode (static or computed from model)

#### Dispatch Integration

`dispatch.ts` currently hardcodes `startsWith("report:")` for wildcard matching. This hardcoding is removed:

1. `CommandDescriptor` declares `wildcardPrefix: "report:"` on the descriptor
2. During registration, the engine stores the prefix string on the registry via a new `setWildcardPrefix(prefix: string)` method
3. `dispatch.ts`'s `resolveWildcard()` reads the prefix from the registry (`.wildcardPrefix` getter) instead of hardcoding `"report:"`
4. `resolveCommand()` signature is unchanged — it still receives `wildcardHandler` from the registry's `.wildcard` getter
5. Only one wildcard prefix is supported (single slot, like today) — this constraint is explicit

#### Renderer Signature Standardization

The codebase currently has mixed renderer conventions:

- **Log-first** (`(log, data)`): `common-renderers.ts` — `renderNoProject`, `renderError`, `renderSuccess`, etc.
- **Data-first** (`(data, log)`): `build-display.ts`, `reports-display.ts` — `renderFreshnessCheck`, `renderBuildAuto`, etc.

The engine standardizes on data-first `(data, log)`. All renderers are updated to data-first in a single pass. Identify which need swapping: `grep -rn "log: Log.*data:" src/ui/` vs `grep -rn "data:.*log:" src/ui/`.

#### Edge Cases Handled

| Pattern | Count | Mechanism |
|---------|-------|-----------|
| Async handlers | 8+ | Engine detects Promise return, awaits |
| Multiple response types | 7 | Handler returns union, renderer handles variants |
| Dynamic actions (make:*) | 1 | `defineCommands()` batch registration — maps array to descriptors with closures |
| Wildcard routing (report:*) | 1 | `wildcardPrefix: "report:"` — engine strips prefix, sets `ctx.wildcard` |
| rawArgs (help) | 1 | `rawArgs: true` — engine passes `ctx.rawArgs` |
| Fire-and-forget | 3 | Handler performs side effect, returns model |
| Multi-step execution | 4 | Domain function owns the steps |
| Manual exitCode | 4 | `exitCode: (model) => ...` callback |
| Type coercion | 8 | `coerce: "int" \| "float"` on FlagSpec |
| Enum validation | 10+ | `choices: [...]` on FlagSpec |
| Comma-separated lists | 2 | `type: "list"` splits on comma |
| Custom flag parser | 1 | `parse: (raw) => ...` on FlagSpec |
| Dynamic imports in handler | 1 | `serve` uses `await import()` — permitted in async handlers (controller layer) |
| World state access | 1 | `state` controller accesses `ctx.deps.worldState` — no special handling needed |

#### Controllers Inventory (28 total)

| Controller | Actions | Requires Project | Notes |
|------------|---------|-----------------|-------|
| ai-tools | 5 | No | `ai:run` has 6 response types, `ai:new` is async |
| build | 12 | Mixed (7 optional, 5 required) | Shared `resolveBuildCommand()` helper |
| capa | 3 | Yes | ID generation |
| capture | 4 | No | `okResponse()` pattern |
| claude-sync | 1 | No | Simple |
| deliverables | 3 | Yes | Integer parsing |
| devtools | 11 | Optional | Retry logic in `dev:console` |
| events | 8 | Yes | Payload parser, comma-sep lists |
| health | 4 | Yes | Deps subset for trend |
| help | 1 | No | rawArgs usage |
| info | 1 | Yes | Simple |
| lifecycle | 5 | Yes | Subdir flag |
| make | 3 + dynamic | Yes | Dynamic `make:*` from COMPONENT_DEFINITION_IDS |
| **onboarding** | **4** | **No** | **New — status, start, skip, restart** |
| plugins | 4 | Mixed | `plugin:new` is async |
| project | 2 | Mixed | Simple |
| publish | 3 | Mixed | Gate evaluation, multi-step |
| raid | 3 | Yes | Enum validation |
| reports | 6 + wildcard | Mixed | Wildcard `report:*`, async |
| requirements | 7 | Yes | 3 entity types, ID generation |
| resources | 3 | Yes | Float parsing, dual mode |
| review | 10 | Mixed | Async E2E, pipeline |
| scaffold | 6 | Mixed | Dry-run, marketplace |
| serve | 3 | Optional | Async, dynamic import |
| sitemap | 3 | Optional | File stats |
| **state** | **1** | **No** | **New — world state query, --json, --agent flags** |
| timelog | 3 | Yes | Date defaults, float hours |

#### File Location

`src/infrastructure/command-engine.ts` (~200 lines)

### 2. Store Schema Registry

A `createStore()` function that accepts a store descriptor and returns a fully wired CRUD object. A generic engine handles directory resolution, file listing, frontmatter parsing, field mapping, and updates.

#### Store Descriptor

```typescript
interface StoreDescriptor<TSummary, TDefinition> {
  name: string;
  defaultDir: string;
  configPath?: string;
  fields: Record<string, FieldSpec>;
  typeTag: string;

  filename?: (def: TDefinition, deps: StoreDeps) => string;
  sort?: (a: TSummary, b: TSummary) => number;
  filter?: (fm: Record<string, string>) => boolean;

  // buildBody receives StoreDeps (which includes clock when needsClock is set)
  // so it can stamp creation dates, compute fields, etc.
  buildBody: (def: TDefinition, deps: StoreDeps) => string;
  parseBody?: (body: string, fm: Record<string, string>) => Partial<TSummary>;

  needsClock?: boolean;  // when true, StoreDeps includes "clock" (IClock)

  companion?: CompanionSpec;
  idGeneration?: { prefix: string; padding: number };
  nested?: boolean;
}

interface FieldSpec {
  type: "string" | "number" | "boolean" | "enum" | "array" | "date";
  default?: unknown;
  options?: string[];
  required?: boolean;
  from?: "frontmatter" | "filename" | "dirname";
  parse?: (raw: string) => unknown;
  serialize?: (value: unknown) => string;
}

interface CompanionSpec {
  extension: string;
  fields: string[];
}
```

#### Engine Returns

```typescript
function createStore<TSummary, TDefinition>(desc: StoreDescriptor<TSummary, TDefinition>) {
  return {
    list:        (deps, projectPath, config?) => TSummary[],
    read:        (deps, projectPath, name, config?) => TSummary | undefined,
    create:      (deps, projectPath, def, config?) => string,
    updateField: (deps, projectPath, name, field, value, config?) => void,
    remove:      (deps, projectPath, name, config?) => void,
    resolveDir:  (deps, projectPath, config?) => string,
    nextId:      (deps, projectPath, config?) => string,
    __descriptor: desc,                          // conformance test marker
  };
}
```

#### Store Inventory (9 markdown stores + 3 JSON stores)

**Markdown stores (use `createStore()`):**

| Store | Fields | Unique Concerns |
|-------|--------|-----------------|
| Agents | 16 fields | Companion JSON (.json), system prompt (.prompt.md), skill/task parsers, GURPS attributes |
| CAPA | 10 fields | ID generation (CAPA-NNN) |
| Deliverables | 8 fields | completionPct integer parsing |
| Lifecycle | 7 fields | Nested dirs, transition history table, template-gated transitions |
| RAID | 9 fields | Four item types |
| Requirements | 13 fields (3 entity types) | Shared ID generation (REQ/UC/US-NNN), type filtering |
| Resources | 12 fields | Dual mode (budget vs quantity), computed fields |
| Timelog | 7 fields | Date+person filename, reverse sort, duplicate handling |
| Iterations | 12 fields | Plan+report files, gated transitions, scope checklists, agent/resource arrays |

**JSON stores (excluded from `createStore()` — different persistence model):**

| Store | Location | Why Excluded |
|-------|----------|-------------|
| Agent state | `.flowti/var/data-{name}.json` | Runtime state, not frontmatter CRUD |
| Agent conversations | `.flowti/var/conversations/{name}.json` | Thread-based, functional updates |
| Onboarding progress | `.flowti/var/onboarding-progress.json` | Single-file JSON, not a collection |

JSON stores are small, purpose-built, and don't share the markdown frontmatter pattern. Forcing them into `createStore()` would add complexity for no benefit.

#### Agent Store — Special Treatment

The agent store is the most complex markdown store. It manages a **7-file aggregate** per agent:

1. `docs/agents/{name}.md` — frontmatter + body (skills, tools, roles)
2. `docs/agents/{name}.json` — companion (components, goals, ai, relationships, inventory)
3. `docs/agents/{name}.prompt.md` — system prompt
4. `.flowti/var/data-{name}.json` — runtime state (tasks, briefs, pending questions)
5. `.flowti/var/conversations/{name}.json` — conversation threads
6. `.flowti/var/iterations/NNN/sessions/session-*.md` + `.json` — session logs
7. `.flowti/var/iterations/NNN/briefs/iteration-NNN-{name}--{phase}.md` — briefings

`createStore()` handles files 1-2 (markdown + companion JSON). Files 3-7 remain as domain-specific functions because they have distinct persistence patterns (single-file read/write, thread-based append, session lifecycle, brief generation from context).

#### What Stays Domain-Specific

- `buildBody()` functions — every domain has unique document structure
- Custom field parsers (`parseSkill()`, `parseGurpsAttributes()`, `parseSuggestedTask()`)
- Aggregation logic (`summarizeTimeLog()`, resource financials)
- Transition logic (lifecycle gated transitions, brief status machine, iteration gated transitions)
- Brief generation (`generateBrief()` prompt assembly)
- Prompt building (`buildConversationPrompt()`, `buildTaskPrompt()`)
- Stream parsing (`parseStreamLine()`, `updateStreamState()`)
- Decision engine (`evaluateDecision()`, `getRulesForAgent()`)

#### File Location

`src/infrastructure/store-engine.ts` (~250 lines)

### 3. Declarative Test Harness

#### Rationale

With engines handling flag parsing, project guards, renderer wiring, and store CRUD, the test landscape changes:

- **Engine tests** cover shared mechanics once (~300 lines)
- **Controller tests** shrink to descriptor validation + handler unit tests
- **Store tests** shrink to field schema validation + body builder tests
- **Display tests** use a capture helper

#### Test Helpers

**ProjectFactory** (`tests/helpers/project-factory.ts`, ~40 lines):

```typescript
export const ProjectFactory = {
  default: (overrides?: Partial<ProjectContext>): ProjectContext => ({
    name: "test-project",
    path: "/project",
    config: { name: "test-project", reports: { generators: [] } },
    scripts: {},
    pkg: { name: "test-project", version: "1.0.0" },
    ...overrides,
  }),
  withConfig: (config: Partial<ProjectConfig>): ProjectContext =>
    ProjectFactory.default({ config: { name: "test", ...config } }),
  withScripts: (scripts: Record<string, string>): ProjectContext =>
    ProjectFactory.default({ scripts, pkg: { name: "test", version: "1.0.0", scripts } }),
};
```

**createStoreDeps** (`tests/helpers/store-deps.ts`, ~20 lines):

```typescript
export function createStoreDeps(opts?: { files?: Record<string, string>; iso?: string }) {
  const disk = createMockFs(opts?.files);
  const paths = createMockPaths();
  const clock = createMockClock(opts?.iso);
  return { disk, paths, clock };
}
```

**captureDisplay** (`tests/helpers/capture-display.ts`, ~15 lines):

```typescript
export function captureDisplay(fn: (log: LogFn) => void): string {
  const log = vi.fn();
  fn(log);
  return log.mock.calls.flat().join("\n");
}
```

#### Controller Test Pattern (After)

```typescript
import { capaCommands } from "../../src/controller/capa.controller.js";

describe("capa controller descriptors", () => {
  it("capa:list requires project", () => {
    expect(capaCommands["capa:list"].requires).toBe("project");
  });

  it("capa:add validates required flags", () => {
    const flags = capaCommands["capa:add"].flags!;
    expect(flags.name.required).toBe(true);
  });

  it("capa:add handler calls createCAPAItem", () => {
    const deps = createTestDeps();
    const project = ProjectFactory.default();
    const result = capaCommands["capa:add"].handler({
      command: "capa:add",
      flags: { name: "Fix leak", "capa-type": "corrective" },
      project,
      deps,
    });
    expect(result.relPath).toContain("fix-leak.md");
  });
});
```

#### Engine Tests (New)

```
tests/infrastructure/command-engine.test.ts (~150 lines)
  - Flag parsing: all types, coercion, defaults, choices
  - Required flag validation: error messages, hints
  - Project guard: auto noProjectResponse
  - Wildcard matching
  - Async handlers
  - exitCode overrides
  - Renderer wiring

tests/infrastructure/store-engine.test.ts (~150 lines)
  - list: reads directory, parses frontmatter, applies field specs
  - create: builds frontmatter from definition, calls buildBody
  - updateField: regex replace in frontmatter
  - read: single item lookup
  - remove: file deletion
  - nextId: auto-increment with prefix and padding
  - Companion files: creates/reads JSON sidecars
  - Nested mode: directory-per-item
```

#### New Test Files

```
tests/helpers/
├── project-factory.ts      (~40 lines)
├── store-deps.ts            (~20 lines)
├── capture-display.ts       (~15 lines)
└── command-test-utils.ts    (~30 lines)

tests/infrastructure/
├── command-engine.test.ts   (~150 lines)
└── store-engine.test.ts     (~150 lines)

tests/conformance/
├── controller-conformance.test.ts  (~50 lines)
└── store-conformance.test.ts       (~30 lines)
```

### 4. Dead Code Removal

This refactor is a clean cut — no backwards-compatibility, no coexistence period, no escape hatches. Legacy code is deleted, not deprecated.

#### What Gets Deleted

| Target | Location | Why It's Dead After Refactor |
|--------|----------|------------------------------|
| `adapt()` function | `src/infrastructure/request-response.ts` | Replaced by `defineCommand()` engine |
| `ControllerAction` type | `src/infrastructure/request-response.ts` | Replaced by `CommandDescriptor` |
| `initializeDeps()` singleton | `src/infrastructure/deps.ts` | Controllers receive deps via `CommandContext`, not globals |
| Per-controller `flagStr()` helpers | 8+ controller files | Engine handles flag parsing |
| Per-controller `noProjectResponse()` | 15+ controller files | Engine handles project guard |
| Per-controller `resolveBuildCommand()` / `resolveTestCommand()` duplication | `build.controller.ts`, `devtools.controller.ts` | Extracted to shared domain function, called from handler |
| `Object.fromEntries(Object.entries(actions).map(...))` pattern | All 28 controllers | Replaced by `defineCommand()` registration |
| Incomplete `createTestDeps()` | `tests/mocks/mock-deps.ts` | Rewritten to stub all 13 `CliDeps` fields |
| Stale mock-presets | `tests/mocks/mock-presets.ts` | Replaced by engine test patterns |
| Manual `vi.mock()` blocks for engine concerns | 100+ test files | Engine tests cover these; controller tests call handlers directly |

#### What Gets Rewritten

| Target | Current State | New State |
|--------|--------------|-----------|
| `createTestDeps()` | Missing agentShell, worldState, workerManager, processRunner, askAbortable | Complete stubs for all 13 `CliDeps` fields |
| All 28 controller files | `adapt()` + manual flag parsing + project guards | `defineCommand()` descriptors |
| All 9 markdown store files | Manual CRUD + frontmatter parsing | `createStore()` descriptors + `buildBody()` |
| All renderer signatures | Mixed log-first and data-first | Standardized data-first `(data, log)` |
| `dispatch.ts` wildcard | Hardcoded `"report:"` prefix | Reads prefix from registry |

### 5. Migration Strategy

No coexistence. Each phase is a clean cut — old code is deleted as new code lands.

#### Prerequisites

**`createTestDeps()` rewrite** — before any controller migration. Current `tests/mocks/mock-deps.ts` returns 9 of 13 required `CliDeps` fields. Rewrite to stub all fields:

- `agentShell` — `{ talk: vi.fn(), dispatch: vi.fn(), getActiveDispatch: vi.fn(), reconcileStaleAgents: vi.fn(() => ({ recovered: [] })), pendingQuestions: vi.fn(() => []), answerAgent: vi.fn() }`
- `worldState` — `{ emitAction: vi.fn(), updateEntity: vi.fn(), getState: vi.fn(() => ({ version: "v1", entities: {}, permissions: [], activity: [] })), getEntity: vi.fn(), flush: vi.fn(), setActionCallback: vi.fn() }`
- `workerManager` — `{ spawn: vi.fn(), spawnAll: vi.fn(), stop: vi.fn(), stopAll: vi.fn(), getWorker: vi.fn(), listWorkers: vi.fn(() => []), send: vi.fn(), dispatchWorldEvent: vi.fn() }`
- `processRunner` — `{ spawn: vi.fn(() => ({ onEvent: vi.fn(), result: Promise.resolve({ text: "", thinking: "", exitCode: 0 }), kill: vi.fn() })) }`
- `input.askAbortable` — `vi.fn(() => ({ promise: Promise.resolve(""), abort: vi.fn() }))`

**Renderer audit** — classify all renderers as log-first or data-first before Phase 3. Swap all to data-first in Phase 3.

#### Phase Sequence

```
Phase 1: Build Engines + Test Infrastructure
  ├── src/infrastructure/command-engine.ts (new)
  ├── src/infrastructure/store-engine.ts (new)
  ├── tests/helpers/project-factory.ts (new)
  ├── tests/helpers/store-deps.ts (new)
  ├── tests/helpers/capture-display.ts (new)
  ├── tests/helpers/command-test-utils.ts (new)
  ├── tests/infrastructure/command-engine.test.ts (new)
  ├── tests/infrastructure/store-engine.test.ts (new)
  ├── tests/conformance/controller-conformance.test.ts (new, initially skip())
  ├── tests/conformance/store-conformance.test.ts (new, initially skip())
  └── tests/mocks/mock-deps.ts (rewritten — all 13 CliDeps fields)

Phase 2: Standardize Renderers
  └── All renderer files — swap log-first to data-first (single pass)

Phase 3: Migrate Stores (all at once, tests updated inline)
  ├── Simplest: timelog, raid, capa, deliverables
  ├── Medium: requirements (3 entity types), resources (dual mode)
  ├── Complex: agents (companion JSON), lifecycle (nested + transitions), iterations
  └── Delete: old store function exports, shared markdown-store helpers that are now engine-internal

Phase 4: Migrate Controllers (all at once, tests updated inline)
  ├── All 28 controllers rewritten as defineCommand() descriptors
  ├── dispatch.ts — remove hardcoded wildcard prefix
  ├── command-registry.ts — add wildcardPrefix support
  ├── Delete: adapt(), ControllerAction type, initializeDeps()
  ├── Delete: all per-controller flagStr(), noProjectResponse() helpers
  └── Controller tests rewritten to descriptor + handler pattern

Phase 5: Enforce + Clean
  ├── Un-skip conformance tests
  ├── Add ESLint rules (no-direct-adapt, no-raw-flag-parsing, etc.)
  ├── Delete unused mock-presets
  ├── Delete any remaining dead imports/exports
  └── Verify: tsc, eslint, vitest all green
```

#### Key Constraints

- Tests pass after each phase (not after each file)
- No coexistence — `adapt()` is deleted in Phase 4, not deprecated
- No backwards-compatibility wrappers — store consumers update to new API in Phase 3
- No escape hatches — if the engine can't handle a case, the engine is extended
- No new runtime dependencies

#### Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Engine can't handle a discovered edge case | Extend the engine — do not add escape hatches |
| Store body builders harder to extract than expected | Extract `buildBody()` last per store; CRUD moves first |
| Test count drops and coverage dips | Engine tests + conformance tests compensate |
| Complex stores resist generalization | Agent/lifecycle/iterations extend the engine with domain-specific methods beyond base CRUD |

### 6. Estimated Impact

| Phase | Files Changed | Lines Added | Lines Removed | Net |
|-------|--------------|-------------|---------------|-----|
| 1. Engines + test infra | 12 new | ~900 | ~60 (mock-deps rewrite) | +840 |
| 2. Renderers | ~30 updated | ~0 | ~0 | 0 (param swap only) |
| 3. Stores | 9 rewritten + tests | ~500 | ~1,500 | -1,000 |
| 4. Controllers + dispatch | 28 rewritten + tests + delete adapt/helpers | ~700 | ~3,500 | -2,800 |
| 5. Enforce + clean | ~20 updated | ~100 | ~500 | -400 |
| **Total** | ~100 files | ~2,200 | ~5,560 | **-3,360 lines** |

### 7. Definition of Done

- All existing tests pass (no regressions)
- Coverage at or above 80% statements / 80% lines
- ESLint passes with new enforcement rules
- TypeScript compiles with no errors
- No `any` types, no `@ts-ignore`
- `adapt()` function deleted — zero references remain
- `ControllerAction` type deleted — zero references remain
- `initializeDeps()` deleted — zero references remain
- Every controller uses `defineCommand()` — conformance test enforces
- Every markdown store uses `createStore()` — conformance test enforces
- All renderers use data-first `(data, log)` signature
- `createTestDeps()` stubs all 13 `CliDeps` fields
- No `flagStr()`, `noProjectResponse()`, or other duplicated helpers in controller files

### 8. Pattern Enforcement

A key goal is not just making patterns easy to follow, but making them enforceable via TypeScript, ESLint, and tests so deviations are caught automatically.

#### TypeScript Enforcement

**Command engine — type safety makes incorrect usage a compile error:**

```typescript
// Compile error: handler must return TModel, not CliResponse<TModel>
defineCommand<{ mode: string }, ShellCommandModel>("build", {
  flags: { mode: { type: "string" } },
  handler: (ctx) => dataResponse(model, renderer),  // ERROR: returns CliResponse, not ShellCommandModel
  renderer: renderShellCommand,
});

// Compile error: required flag accessed as optional
defineCommand<{ name: string }, CapaItem>("capa:add", {
  flags: { name: { type: "string", required: true } },
  handler: (ctx) => {
    ctx.flags.name.toLowerCase();  // OK — TFlags says name is string, not string | undefined
  },
  renderer: renderCapaItem,
});
```

**Store engine — field specs constrained by TSummary type:**

```typescript
// FieldSpec keys must match TSummary properties
// StoreDescriptor<CAPASummary, CAPADefinition> will error if fields has a key not in CAPASummary
```

**RendererFn — signature enforced:**

```typescript
// Type error if renderer has wrong parameter order or wrong model type
type RendererFn<T> = (data: T, log: LogFn) => void;
```

#### ESLint Enforcement

**New ESLint rules (added in Phase 5):**

| Rule | What It Catches | Implementation |
|------|----------------|----------------|
| `no-direct-adapt` | Any import of `adapt` from `request-response.ts` | `no-restricted-imports` scoped to `src/controller/` |
| `no-raw-flag-parsing` | Manual `typeof req.flags.x` checks in controllers | `no-restricted-syntax` with AST selector `"MemberExpression[object.property.name='flags']"` scoped to `src/controller/` |
| `no-inline-noProjectResponse` | Local `noProjectResponse()` function definitions | `no-restricted-syntax` with AST selector `"FunctionDeclaration[id.name='noProjectResponse']"` scoped to `src/controller/` |
| `no-duplicate-flagStr` | Local `flagStr()` helper definitions | `no-restricted-syntax` with AST selector `"FunctionDeclaration[id.name='flagStr']"` scoped to `src/controller/` |

Implementation notes:
- `no-direct-adapt` uses `no-restricted-imports` (same mechanism as existing architecture rules)
- The other three require `no-restricted-syntax` with AST selectors — new for this project but well-supported by ESLint core (no plugin needed)
- All rules scoped to `src/controller/` via flat config's `files` array

#### Conformance Tests

```typescript
// tests/conformance/controller-conformance.test.ts
import { commandRegistry } from "../../src/infrastructure/command-registry.js";

describe("controller conformance", () => {
  it("all registered commands use defineCommand descriptors", () => {
    for (const name of commandRegistry.keys()) {
      const meta = commandRegistry.get(name);
      expect(meta?.handler.__descriptor, `${name} must use defineCommand()`).toBeDefined();
    }
  });

  it("all commands with requires:project have project guard", () => {
    for (const name of commandRegistry.keys()) {
      const meta = commandRegistry.get(name);
      if (meta?.handler.__descriptor?.requires === "project") {
        const result = meta.handler({ flags: {}, project: undefined, deps: minimalDeps });
        expect(result.data).toHaveProperty("command", expect.stringContaining("help"));
      }
    }
  });
});

// tests/conformance/store-conformance.test.ts
import { capaStore, raidStore, timelogStore, ... } from "...";

describe("store conformance", () => {
  it("all stores use createStore engine", () => {
    const stores = [capaStore, raidStore, timelogStore, deliverableStore,
      requirementStore, resourceStore, agentStore, lifecycleStore, iterationStore];
    for (const store of stores) {
      expect(store).toHaveProperty("list");
      expect(store).toHaveProperty("create");
      expect(store).toHaveProperty("read");
      expect(store.__descriptor, "store must use createStore()").toBeDefined();
    }
  });
});
```

**Engine stamps `__descriptor`** on returned handlers/stores so conformance tests verify all registrations go through the engine.

#### Summary: Three Layers of Enforcement

| Layer | What It Catches | When |
|-------|----------------|------|
| **TypeScript** | Wrong types, missing required fields, bad renderer signatures | At compile time |
| **ESLint** | Legacy patterns (`adapt()`, inline `flagStr()`, manual flag parsing) | At lint time |
| **Conformance tests** | Any command/store not using the engine, project guard bypasses | At test time |

### 9. What This Does NOT Change

- CLI public API (all commands, flags, and output unchanged)
- Sitemap/UI layer (remains declarative, untouched)
- Pipeline engine (already well-designed)
- Infrastructure abstractions (IFileSystem, IShell, IClock, IPaths, IInput)
- Infrastructure singletons (world-state-manager, worker-manager, agent-shell, agent-process-runner)
- Domain purity rule (domain never imports infrastructure)
- Zero runtime dependencies constraint
- Onboarding system (new, clean, no refactoring needed)
- Agent conversation/stream/decision engine (new, clean, no refactoring needed)
