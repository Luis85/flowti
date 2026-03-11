# Flowti CLI — Refactoring Roadmap

> Single binary. Clean architecture. Human and AI-agent ready.

## Goal

Refactor the Flowti CLI into a fully conformant MVC+DDD application with dependency injection, where every command flows through `main.ts -> dispatch -> controller -> domain -> CliResponse -> renderer`. The binary must serve two audiences from the same codebase:

- **Human mode** (default): Interactive menus, ANSI colors, progress indicators
- **Agent mode** (`--format=json`): Structured JSON output, no interactivity, machine-parseable

---

## Current State

| Metric | Value |
|--------|-------|
| Controllers | 15 (12 using adapt() pattern, 3 legacy) |
| Domain files importing UI | 20+ |
| Domain files importing logger | 2 |
| Infrastructure singletons | 9 (disk, shell, paths, clock, proc, log, input, ui, config) |
| Tests | 3,481 passing (209 suites) |
| Generators registered | 15 (9 reports + 6 references) |

---

## Architecture Principles

1. **Domain is pure** — No imports from `ui/`, `logger.js`, or `console`. Domain functions receive deps, return data.
2. **Controllers orchestrate** — Parse request, call domain, return `CliResponse<T>` with data + renderer.
3. **UI is passive** — Renderers are functions `(data: T) => void` passed via `CliResponse`. Never called from domain.
4. **DI everywhere** — Infrastructure singletons injected via `Deps` objects. No module-level `import { disk }` in domain.
5. **Dual output** — Every command returns typed data. `--format=json` serializes it. Default calls the renderer.

---

## Phase 0: DI Foundation

**Goal**: Create the dependency injection infrastructure that all subsequent phases build on.

### 0.1 — Define `CliDeps` interface

```
src/infrastructure/deps.ts (~40 LOC)
```

```typescript
export interface CliDeps {
  readonly disk: IFileSystem;
  readonly shell: IShell;
  readonly paths: IPaths;
  readonly clock: IClock;
  readonly proc: IProcess;
  readonly log: (msg: string) => void;
  readonly warn: (msg: string) => void;
  readonly input: IInput;
}

export function createDefaultDeps(): CliDeps { ... }
```

- Extract interfaces from existing singletons (`IFileSystem` from `filesystem.ts`, `IShell` from `shell.ts`, etc.)
- `createDefaultDeps()` returns the real singletons — used in `main.ts`
- Tests call `createTestDeps()` with mocks
- Domain functions receive `deps: CliDeps` or a domain-specific subset

### 0.2 — Define domain-specific dep subsets

Each domain gets a minimal deps interface (ISP):

```typescript
// E2E domain needs shell + disk + clock + log
export interface E2EDeps extends Pick<CliDeps, "disk" | "shell" | "clock" | "log"> {
  render?: E2ERenderer;
}

// Report domain needs disk + clock + log
export interface ReportDeps extends Pick<CliDeps, "disk" | "clock" | "log"> {}

// Make domain needs disk + input + log
export interface MakeDeps extends Pick<CliDeps, "disk" | "input" | "log"> {}
```

### 0.3 — Thread deps through PipelineContext

`PipelineContext` already has `log()`. Extend it:

```typescript
interface PipelineContext {
  deps: CliDeps;
  log(msg: string): void;
  // ... existing fields
}
```

### Files changed
- New: `src/infrastructure/deps.ts`
- New: `src/infrastructure/interfaces.ts` (extract IFileSystem, IShell, IClock, IProcess, IPaths, IInput)
- Modified: `src/infrastructure/pipeline/pipeline-types.ts` (add deps to context)
- Modified: `src/infrastructure/pipeline/pipeline-runner.ts` (pass deps)

### Verification
- `npx vitest run` — all existing tests pass (additive change)
- `node configs/esbuild.config.mjs && node .flowti/bin` — binary starts

---

## Phase 1: E2E Domain Purification

**Goal**: Remove all UI imports from the E2E domain (largest violator: 7 files).

### 1.1 — Extract E2E renderer interface

```
src/domain/e2e/e2e-renderer.ts (~20 LOC)
```

```typescript
export interface E2ERenderer {
  executionBanner(config: SessionConfig, names: string[]): void;
  journeyTable(journeys: JourneyEntry[]): void;
  stepTable(steps: StepEntry[]): void;
  prerequisites(results: PrerequisiteResults, e2e: E2EConfig): void;
  sessionSummary(name: string, journeys: string[], startTime: number, stats: Stats): void;
  incrementSummary(result: BuildResult): void;
  publishSummary(result: PublishResult): void;
}
```

### 1.2 — Create default renderer in UI layer

```
src/ui/e2e/e2e-renderer-impl.ts (~60 LOC)
```

Moves all `printXxx()` function implementations here, implements `E2ERenderer`.

### 1.3 — Refactor E2E domain to accept deps

Each domain function receives `deps: E2EDeps` instead of importing singletons:

| File | Change |
|------|--------|
| `e2e-service.ts` | Accept `deps` param, remove UI import |
| `e2e-runner.ts` | Accept `deps` with `render` callback |
| `e2e-session.ts` | Remove re-exports of UI functions |
| `steps/prerequisite-step.ts` | Use `deps.render.prerequisites()` |
| `steps/session-note-step.ts` | Use `deps.render.sessionSummary()` |
| `steps/build-step.ts` | Use `deps.render.incrementSummary()` |
| `e2e-prerequisites.ts` | Accept deps, remove UI import |

### 1.4 — Wire through review controller

`review.controller.ts` creates `E2EDeps` with the real renderer:

```typescript
"review:e2e": async (req) => {
  const deps = { ...defaultDeps, render: createE2ERenderer() };
  const result = await runE2ESuite(req.flags.journey, deps);
  return dataResponse(result, renderE2EResult);
},
```

### Files changed: ~12
### Tests to update: E2E test suites (inject mock deps instead of vi.mock)

---

## Phase 2: Make/Component Domain Purification

**Goal**: Convert Make commands from raw `CommandHandler` to `ControllerAction` pattern with DI.

### 2.1 — Extract pure command logic from component-commands.ts

Current (violating):
```typescript
// In domain/ — BAD
import { renderError, renderSuccess } from "../../ui/common-renderers.js";
export function handleMakeComponent(flags, args, cmd, project) {
  renderError({ error: "..." }); // direct UI call
  proc.exit(1);                  // direct process control
}
```

Target:
```typescript
// In domain/ — GOOD
export function makeComponent(name: string, opts: MakeOpts, deps: MakeDeps): MakeResult {
  if (!name) return { success: false, error: "--name is required" };
  // ... pure logic, returns data
  return { success: true, files: created, component: { name, type } };
}
```

### 2.2 — Create make renderers

```
src/ui/make-display.ts
```

```typescript
export function renderMakeResult(data: MakeResult): void { ... }
export function renderMakeError(data: MakeResult): void { ... }
```

### 2.3 — Update make.controller.ts

```typescript
const actions: Record<string, ControllerAction> = {
  "make:component": (req) => {
    const result = makeComponent(req.flags.name, opts, deps);
    return dataResponse(result, renderMakeResult);
  },
};
export const commands = Object.fromEntries(
  Object.entries(actions).map(([k, a]) => [k, adapt(a)])
);
```

### Files changed: ~8
- `component-commands.ts` — Extract pure logic, remove UI imports
- `component-edit.ts` — Same treatment
- `make.controller.ts` — Use adapt() + CliResponse
- `ui/make-display.ts` — New renderers (or extend existing)

---

## Phase 3: Remaining Domain UI Violations

**Goal**: Clean up all other domain files that import from `ui/`.

These follow the same pattern as Phases 1-2: extract rendering to an interface or callback, inject via deps.

| Domain | Files | Strategy |
|--------|-------|----------|
| `project/` | project.ts, project-publish.ts, project-review.ts | Return data from domain, render in controller |
| `scaffold/` | scaffold.ts | Return data, render in scaffold.controller.ts |
| `plugins/` | plugins.ts | Return data, render in plugins.controller.ts |
| `events/` | events.ts | Return data, render in events.controller.ts |
| `ai-tools/` | ai-tools.ts | Return data, render in ai-tools.controller.ts |
| `make/` | make.ts, storybook-service.ts | Return data, render in controller |

### Pattern for each

1. Read the domain file, identify UI imports
2. Replace `renderXxx()` call with returning typed data
3. Move rendering to controller via `dataResponse(data, renderer)`
4. Remove UI import from domain file

### Files changed: ~20
### Tests: Update mocks to inject deps instead of vi.mock("ui/...")

---

## Phase 4: Infrastructure DI Threading

**Goal**: Domain functions stop importing singletons (`disk`, `shell`, `clock`, `proc`) and receive them via `deps`.

### 4.1 — Report generators

Current:
```typescript
import { disk } from "../../../infrastructure/filesystem.js";
import { clock } from "../../../infrastructure/clock.js";

export function generateTestReport(projectPath: string, ctx?: PipelineContext): GeneratorOutput {
  if (!disk.existsSync(reportJson)) { ... }
```

Target:
```typescript
export function generateTestReport(projectPath: string, deps: ReportDeps, ctx?: PipelineContext): GeneratorOutput {
  if (!deps.disk.existsSync(reportJson)) { ... }
```

### 4.2 — Update GeneratorFn type

```typescript
export type GeneratorFn = (
  projectPath: string,
  deps: ReportDeps,
  ctx?: PipelineContext
) => GeneratorOutput;
```

### 4.3 — Update generator-registry.ts

Pass deps when calling generators:
```typescript
export function runGenerator(id: string, projectPath: string, deps: ReportDeps, ctx?: PipelineContext): GeneratorOutput | null {
  const entry = GENERATORS.get(id);
  if (!entry) return null;
  return entry.fn(projectPath, deps, ctx);
}
```

### 4.4 — Update ReportService

`ReportService` currently imports `disk`, `paths`, `clock`, `CLI_PROJECT` directly. Accept deps:

```typescript
export class ReportService {
  constructor(projectPath: string, deps: ReportDeps, opts?: ReportServiceOptions) { ... }
}
```

### Files changed: ~25 (all generators + registry + report-service + report-runner)
### Note: This is mechanical — same pattern applied to each file

---

## Phase 5: Script Purification

**Goal**: Convert remaining scripts with top-level execution into exported functions.

| Script | Current | Target |
|--------|---------|--------|
| `fix-frontmatter.ts` | 97 lines top-level code | Export `fixFrontmatter(opts: FrontmatterOpts, deps: CliDeps): FrontmatterResult` |
| `generate-test-data.ts` | 80 lines top-level code | Export `generateTestData(opts: TestDataOpts, deps: CliDeps): TestDataResult` |
| `run-analysis.ts` | Has module-level `const svc = new ReportService()` | Move svc creation inside `runAnalysisPipeline(deps)` |

### 5.1 — fix-frontmatter.ts

Extract the procedural logic into a pure function:
```typescript
export interface FrontmatterOpts { dryRun: boolean; docsRoot: string; }
export interface FrontmatterResult { fixed: number; skipped: number; errors: number; }
export function fixFrontmatter(opts: FrontmatterOpts, deps: Pick<CliDeps, "disk" | "paths" | "log">): FrontmatterResult { ... }
```

### 5.2 — generate-test-data.ts

Same pattern. Extract the procedural CSV generation into:
```typescript
export function generateTestData(opts: TestDataOpts, deps: Pick<CliDeps, "disk" | "paths" | "log">): TestDataResult { ... }
```

### 5.3 — run-analysis.ts

Move module-level constants inside the function. Accept deps:
```typescript
export function runAnalysisPipeline(deps: Pick<CliDeps, "disk" | "shell" | "paths" | "log">): void { ... }
```

**Note**: `run-analysis.ts` must remain callable via `npm run analysis` (tsx). Keep a thin entry point:
```typescript
// Bottom of file
if (process.argv[1]?.endsWith("run-analysis.ts")) {
  runAnalysisPipeline(createDefaultDeps());
}
```

### Files changed: 3

---

## Phase 6: Legacy Controller Lift

**Goal**: Convert remaining controllers to the adapt() + CliResponse pattern.

| Controller | Current | Change needed |
|------------|---------|---------------|
| `make.controller.ts` | Delegates to raw CommandHandlers | Wrap in adapt(), return CliResponse |
| `help.controller.ts` | Calls showHelp() directly | Return help data, render via response |
| `project.controller.ts` | Legacy pattern | Use adapt() + dataResponse |

### Files changed: 3

---

## Phase 7: Agent-Ready Output

**Goal**: Every command produces structured JSON when `--format=json` is passed.

### 7.1 — Audit all CliResponse types

Ensure every controller action returns `dataResponse(typedData, renderer)`. The `typedData` must be fully serializable (no functions, no circular refs).

### 7.2 — Define response schemas

```
src/infrastructure/schemas/
  build-response.ts
  report-response.ts
  health-response.ts
  ...
```

Each schema defines the JSON shape an AI agent receives. These double as TypeScript types for the response data.

### 7.3 — Add `--format=json` to interactive mode

Currently interactive mode (menus) can't output JSON. Add a `--batch` flag:
```
flowti --batch build          # Non-interactive, text output
flowti --batch --format=json build  # Non-interactive, JSON output
```

### 7.4 — Error responses

Define a standard error shape:
```typescript
interface CliErrorResponse {
  success: false;
  error: string;
  code: string;      // Machine-readable error code
  hint?: string;     // Human-readable suggestion
  context?: Record<string, unknown>;
}
```

All controllers return this on error instead of calling `renderError()` + `proc.exit()`.

### Files changed: ~15

---

## Phase 8: Test Hardening

**Goal**: Update all tests to use DI instead of `vi.mock()` for infrastructure.

### Current pattern (fragile)
```typescript
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
  disk: { existsSync: vi.fn(() => false), ... }
}));
```

### Target pattern (robust)
```typescript
import { createTestDeps } from "../../mocks/test-deps.js";

const deps = createTestDeps({
  disk: { existsSync: () => false },
});

const result = generateTestReport("/project", deps);
```

### 8.1 — Create test helpers

```
tests/mocks/test-deps.ts
```

```typescript
export function createTestDeps(overrides?: Partial<CliDeps>): CliDeps {
  return {
    disk: createMockFileSystem(),
    shell: createMockShell(),
    clock: { now: () => new Date("2026-03-10"), ... },
    proc: createMockProc(),
    paths: { join: (...a) => a.join("/"), ... },
    log: vi.fn(),
    warn: vi.fn(),
    input: createMockInput(),
    ...overrides,
  };
}
```

### 8.2 — Migrate tests incrementally

Don't rewrite all tests at once. As each domain is refactored (Phases 1-5), update its tests to use `createTestDeps()`. Existing `vi.mock()` tests continue to work during migration.

---

## Implementation Order

| Phase | Risk | Files | Depends on | Deliverable |
|-------|------|-------|------------|-------------|
| **0** | Low | 4 new, 2 modified | — | DI interfaces + CliDeps |
| **1** | Medium | ~12 | Phase 0 | E2E domain pure |
| **2** | Medium | ~8 | Phase 0 | Make domain pure |
| **3** | Medium | ~20 | Phase 0 | All domain files pure |
| **4** | Low | ~25 | Phase 0 | Infrastructure injected |
| **5** | Low | 3 | Phase 0 | Scripts exportable |
| **6** | Low | 3 | Phase 0 | All controllers on adapt() |
| **7** | Medium | ~15 | Phases 1-6 | Agent-ready JSON output |
| **8** | Low | ~50 | Phases 1-6 | Tests use DI |

**Recommended execution**: 0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8

Phases 1-3 can be parallelized (independent domains). Phase 4 is mechanical. Phase 7 requires all previous phases complete. Phase 8 is incremental alongside each phase.

---

## Verification Checklist

After each phase:

```bash
# Tests pass
npx vitest run --config configs/vitest.config.ts

# Binary builds
node configs/esbuild.config.mjs

# Binary starts
node .flowti/bin

# No domain → UI imports remain
grep -rl "from.*ui/" src/domain/ | grep -v templates/

# No domain → logger imports remain
grep -rl "from.*infrastructure/logger" src/domain/

# No domain console.log (excluding templates)
grep -rl "console\.log" src/domain/ | grep -v templates/
```

After Phase 7:
```bash
# JSON output works for every command
node .flowti/bin --format=json info
node .flowti/bin --format=json health
node .flowti/bin --format=json report:test
```

---

## Non-Goals

- **No async EventBus** — CLI is single-threaded, synchronous DI is sufficient
- **No IoC container** — Simple constructor/function injection. No Inversify, no decorators.
- **No breaking changes to config** — `flowti.config.json` schema stays the same
- **No new CLI flags** beyond `--format` and `--batch`
- **Templates stay as-is** — `console.log` in template content strings is intentional (generated code)

---

## Success Criteria

1. `grep -rl "from.*ui/" src/domain/` returns **zero results** (excluding templates)
2. `grep -rl "from.*infrastructure/logger" src/domain/` returns **zero results**
3. Every controller uses `adapt()` + `dataResponse()`
4. Every domain function accepts a `deps` parameter
5. `--format=json` works on every command
6. 3,481+ tests passing
7. Binary builds and starts without errors
8. AI agent can invoke any command and parse the JSON response
