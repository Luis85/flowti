# Declarative Refactoring Design Spec

**Date:** 2026-03-15
**Status:** Draft
**Scope:** Flowti CLI — controllers, domain stores, test infrastructure

## Problem Statement

The Flowti CLI has strong architecture (layered DI, sitemap-driven UI, pipeline engine) but ~4,700 lines of reducible boilerplate across:

- **26 controllers** (~3,100 lines) repeating flag parsing, project guards, type coercion, error responses, and renderer wiring
- **8+ markdown stores** (~1,500 lines) repeating frontmatter parsing, CRUD operations, directory resolution, and field mapping
- **345 test files** (~84,500 lines) repeating vi.mock() blocks, initializeDeps() calls, mockProject construction, and display output assertions

This boilerplate slows feature development, increases maintenance cost, and creates inconsistency risk.

## Goals

1. Eliminate mechanical boilerplate from controllers, stores, and tests
2. Make adding a new command or store a matter of writing a descriptor, not copying a file
3. Improve testability by testing engines once and descriptors cheaply
4. Maintain zero runtime dependencies
5. Handle 100% of existing edge cases — no partial migration

## Non-Goals

- Changing the CLI's public API (commands, flags, output)
- Modifying the sitemap/UI layer
- Refactoring the pipeline engine
- Moving to config files (YAML/JSON) for controller or test definitions

## Design

### 1. Command Schema Engine

A `defineCommand()` function that accepts a command descriptor and returns a fully wired `CommandHandler`. A generic engine handles flag parsing, validation, project guards, and renderer wiring. The handler function contains only domain logic.

#### Command Descriptor

```typescript
interface CommandDescriptor<TFlags = Record<string, unknown>, TModel = unknown> {
  requires?: "project";
  flags?: Record<string, FlagSpec>;
  rawArgs?: boolean;
  handler: (ctx: CommandContext<TFlags>) => TModel | Promise<TModel>;
  renderer: RendererFn<TModel>;
  exitCode?: number | ((model: TModel) => number | undefined);
}

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
  flags: TFlags;
  rawArgs?: string[];
  project?: ProjectContext;
  deps: CliDeps;
  wildcard?: string;  // for wildcard commands like report:*
}
```

#### Engine Responsibilities

1. Parse `req.flags` against the flag spec — coerce types, apply defaults
2. Validate required flags — return error response with hint automatically
3. Validate choices — return error with allowed values automatically
4. Check `requires: "project"` — return `noProjectResponse` automatically
5. Call handler with typed, validated flags
6. Wrap return value in `dataResponse(model, renderer)`
7. Apply exitCode (static or computed from model)

#### Edge Cases Handled

| Pattern | Count | Mechanism |
|---------|-------|-----------|
| Async handlers | 8 | Engine detects Promise return, awaits |
| Multiple response types | 7 | Handler returns union, renderer handles variants |
| Dynamic actions (make:*) | 1 | `defineCommands()` batch registration |
| Wildcard routing (report:*) | 1 | `wildcard: true` — engine sets `ctx.wildcard` |
| rawArgs (help) | 1 | `rawArgs: true` — engine passes `ctx.rawArgs` |
| Fire-and-forget | 3 | Handler performs side effect, returns model |
| Multi-step execution | 4 | Domain function owns the steps |
| Manual exitCode | 4 | `exitCode: (model) => ...` callback |
| Type coercion | 8 | `coerce: "int" \| "float"` on FlagSpec |
| Enum validation | 10+ | `choices: [...]` on FlagSpec |
| Comma-separated lists | 2 | `type: "list"` splits on comma |
| Custom flag parser | 1 | `parse: (raw) => ...` on FlagSpec |

#### Example: Before and After

**Before (build.controller.ts — 162 lines, 12 actions):**

```typescript
const actions: Record<string, ControllerAction> = {
  "build:project": (req) => {
    if (!req.project) return noProjectResponse(req.deps.log, "build:project");
    const mode = typeof req.flags.mode === "string" ? req.flags.mode : "fast";
    const cmd = resolveBuildCommand(req.project, mode, ["build"], "npm run build");
    const { exitCode } = req.deps.shell.runCaptureStatus(cmd);
    const model: ShellCommandModel = { command: cmd, exitCode, label: "build" };
    return dataResponse(model, (d) => renderShellCommand(req.deps.log, d));
  },
  // ... 11 more actions
};
export const commands = Object.fromEntries(
  Object.entries(actions).map(([key, action]) => [key, adapt(action)])
);
```

**After:**

```typescript
defineCommand("build:project", {
  requires: "project",
  flags: {
    mode: { type: "string", default: "fast", choices: ["fast", "full", "incremental"] },
  },
  handler: (ctx) => {
    const cmd = resolveBuildCommand(ctx.project!, ctx.flags.mode, ["build"], "npm run build");
    const { exitCode } = ctx.deps.shell.runCaptureStatus(cmd);
    return { command: cmd, exitCode, label: "build" };
  },
  renderer: renderShellCommand,
});
```

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

  buildBody: (def: TDefinition) => string;
  parseBody?: (body: string, fm: Record<string, string>) => Partial<TSummary>;

  needsClock?: boolean;

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
  };
}
```

#### Store Inventory

| Store | Fields | Unique Concerns |
|-------|--------|-----------------|
| Agents | 16 fields | Companion JSON, skill/task parsers, system prompt files |
| CAPA | 10 fields | ID generation (CAPA-NNN) |
| Deliverables | 8 fields | completionPct integer parsing |
| Lifecycle | 7 fields | Nested dirs, transition history table, template-gated transitions |
| RAID | 9 fields | Four item types |
| Requirements | 13 fields (3 entity types) | Shared ID generation (REQ/UC/US-NNN), type filtering |
| Resources | 12 fields | Dual mode (budget vs quantity), computed fields |
| Timelog | 7 fields | Date+person filename, reverse sort, duplicate handling |
| Iterations | 12 fields | Plan+report files, gated transitions, scope checklists |

#### What Stays Domain-Specific

- `buildBody()` functions — every domain has unique document structure
- Custom field parsers (`parseSkill()`, `parseGurpsAttributes()`)
- Aggregation logic (`summarizeTimeLog()`, resource financials)
- Transition logic (lifecycle gated transitions, brief status machine)
- Brief generation (`generateBrief()` prompt assembly)
- Conversation store — pure JSON, excluded from MarkdownStore

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
import { capaCommands } from "../../src/controllers/capa.controller.js";

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
```

### 4. Migration Strategy

#### Phase Sequence

```
Phase 1: Engines (new code, nothing breaks)
  ├── src/infrastructure/command-engine.ts
  └── src/infrastructure/store-engine.ts

Phase 2: Test Infrastructure (new helpers, nothing breaks)
  ├── tests/helpers/project-factory.ts
  ├── tests/helpers/store-deps.ts
  ├── tests/helpers/capture-display.ts
  ├── tests/helpers/command-test-utils.ts
  ├── tests/infrastructure/command-engine.test.ts
  └── tests/infrastructure/store-engine.test.ts

Phase 3: Stores (migrate one at a time, tests pass after each)
  ├── Simplest: timelog, raid, capa, deliverables
  ├── Medium: requirements (3 entity types), resources (dual mode)
  └── Complex: agents (companion JSON), lifecycle (nested + transitions)

Phase 4: Controllers (migrate one at a time, tests pass after each)
  ├── Simplest: help, info, project, claude-sync (1-2 actions each)
  ├── Standard: capa, raid, deliverables, timelog, lifecycle, requirements
  ├── Domain-heavy: build, health, events, devtools, reports
  └── Edge cases: make (dynamic), serve (async), ai-tools (multi-response)

Phase 5: Test Migration (update tests to use new harness)
  ├── Controller tests → descriptor + handler tests
  ├── Store tests → use createStoreDeps
  └── Display tests → use captureDisplay

Phase 6: Cleanup
  ├── Remove old adapt() boilerplate
  ├── Remove duplicated helpers (flagStr, noProjectResponse)
  └── Remove unused mock-presets
```

#### Key Constraints

- Tests pass after every file migration
- Old and new formats coexist during transition (command registry accepts both)
- Stores keep their public API during migration (thin wrappers delegate to engine)
- No new runtime dependencies
- Engine supports `raw` escape hatch for any edge case discovered mid-migration

#### Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Engine can't handle an edge case | `raw` escape hatch — pass traditional ControllerAction |
| Store body builders harder to extract | CRUD moves first, buildBody last |
| Coverage dips during migration | Engine tests compensate — net coverage increases |
| Complex stores resist generalization | Extend engine with domain-specific methods |

### 5. Estimated Impact

| Phase | Files Changed | Lines Added | Lines Removed | Net |
|-------|--------------|-------------|---------------|-----|
| 1. Engines | 2 new | ~450 | 0 | +450 |
| 2. Test infra | 6 new | ~400 | 0 | +400 |
| 3. Stores | 8 rewritten | ~400 | ~1,200 | -800 |
| 4. Controllers | 26 rewritten | ~600 | ~2,500 | -1,900 |
| 5. Test migration | ~100 updated | ~500 | ~3,000 | -2,500 |
| 6. Cleanup | ~15 trimmed | 0 | ~300 | -300 |
| **Total** | ~157 files | ~2,350 | ~7,000 | **-4,650 lines** |

### 6. Definition of Done

- All 5,920+ existing tests pass
- Coverage at or above 80% statements / 80% lines
- ESLint passes (architecture rules enforced)
- TypeScript compiles with no errors
- No `any` types, no `@ts-ignore`
- Every controller uses `defineCommand()` (no legacy `adapt()`)
- Every markdown store uses `createStore()` (no legacy store functions)
- Controller tests use `ProjectFactory` + direct handler calls (no vi.mock for engine concerns)
- Store tests use `createStoreDeps()`
- Display tests use `captureDisplay()`

### 7. What This Does NOT Change

- CLI public API (all commands, flags, and output unchanged)
- Sitemap/UI layer (remains declarative, untouched)
- Pipeline engine (already well-designed)
- Infrastructure abstractions (IFileSystem, IShell, etc.)
- Domain purity rule (domain never imports infrastructure)
- Zero runtime dependencies constraint
