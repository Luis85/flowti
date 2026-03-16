# Flowti CLI — AI Agent Instructions

## Quick Commands

```bash
# Test (always run after changes)
npx vitest run --config configs/vitest.config.ts

# Type check (always run after changes)
npx tsc --noEmit --project configs/tsconfig.json

# Lint (thresholds: maxComplexity=10, maxLines=350)
npx eslint src/ --config configs/eslint.config.mjs

# Build (always run after changes)
node configs/esbuild.config.mjs
```

## Architecture

```
src/
├── main.ts                  # Entry point (SitemapRouter + CommandRegistry)
├── controller/              # 23 thin handlers: parse flags → domain → CliResponse<T>
├── ui/
│   ├── handlers/            # Sitemap action/view/condition/beforeRender handlers
│   ├── menus/               # Interactive menu implementations (hybrid views)
│   └── *-display.ts         # Pure renderers: typed model → ANSI output
├── domain/                  # 27 modules — pure business logic, NO I/O
│   └── (scaffold, make, build, publish, review, reports, e2e, events,
│       health, lifecycle, resources, timelog, deliverables, raid,
│       requirements, capa, capture, plugins, ai-tools, info,
│       onboarding, knowledgebase, devtools, templates, sitemap, shared)
└── infrastructure/          # 44 modules — I/O abstractions + pipeline + sitemap engine
```

### Dependency Rules (STRICT)

- **Controller** → Domain, Infrastructure, UI renderers
- **Domain** → NOTHING (receives deps via injection)
- **UI** → Infrastructure singletons (disk, paths, shell, etc.)
- **Infrastructure** → Node.js built-ins only
- **NEVER**: Domain → Infrastructure, Domain → UI, Infrastructure → Domain

### Dependency Injection Pattern

Domain functions receive deps as typed objects:

```typescript
// Good — domain function with injected deps
export function listProjects(projectsDir: string, deps: { disk: IFileSystem }): string[] {
  return deps.disk.readdirSync(projectsDir, { withFileTypes: true })...
}

// Bad — domain function importing infrastructure singleton
import { PROJECTS_DIR } from "../../infrastructure/config.js"; // VIOLATION!
```

ISP subsets in `src/infrastructure/deps.ts`:
- `CliDeps` — full container
- `ReportDeps` — `Pick<CliDeps, "disk" | "paths" | "clock" | "shell" | "log">`
- `E2EDeps` — `Pick<CliDeps, "disk" | "shell" | "paths" | "clock" | "log" | "warn">`
- `MakeDeps` — `Pick<CliDeps, "disk" | "paths" | "input" | "log">`

## Sitemap-Driven UI (v2 — PageObject Architecture)

All interactive menus are declared in `configs/sitemap.json` (v2 format):

- **28 pages** — each a `PageObject` with kind, label, description, actions, dataSources
- **Page kinds**: `page`, `form`, `list`, `layout`, `dialog`, `component`, `ui-component`, `system`, `container`, `c4-component`, `person`
- **Actions**: `{ name: "onFoo", label, type, target, key?, group? }` — types: `navigate`, `handler`, `command`, `signal`, `form`
- **Auto-key assignment**: Actions without explicit `key` get auto-assigned (1-9, a-z)
- **Group separators**: Actions with different `group` values get visual separators between them
- **Data sources**: `dataSources: [{ id, slot?, params? }]` — inject dynamic entries via `registerDataSource()`
- **Form pages**: `kind: "form"` with `fields[]` — driven by the generic form engine
- **Dynamic views**: Determined by `registry.hasView(pageId)` — handler receives `dataSourceEntries`
- **Handler types**: ViewHandler, ActionHandler, ConditionHandler, BeforeRenderHandler, DataSourceHandler, FormHandler
- **Registration**: `src/ui/handlers/register-handlers.ts` is the single registration point

### Adding a New Action

1. Add action to `configs/sitemap.json`: `{ "name": "onFoo", "label": "Foo", "type": "handler", "target": "my:action" }`
2. Register handler in appropriate file under `src/ui/handlers/`
3. Call `registry.registerAction("my:action", async (ctx) => { ... })`

### Adding a New Page

1. Add page to `configs/sitemap.json` with `kind`, `label`, `description`, `actions`
2. For static pages: actions array with handler/navigate/signal types
3. For dynamic pages: register a ViewHandler with `registry.registerView("my-page", handler)`

## Controller Pattern (Declarative)

Controllers use `adaptDescriptor()` from the command engine. The handler returns a data model, not a CliResponse. The engine handles flag parsing, project guards, and renderer wiring.

```typescript
// src/controller/example.controller.ts
import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types-config.js";

export const commands: Record<string, CommandHandler> = {
	"example:list": adaptDescriptor({
		requires: "project",
		handler: (ctx) => listThings(ctx.deps, ctx.project!.path),
		renderer: renderThingList,
	}),
	"example:add": adaptDescriptor({
		requires: "project",
		flags: { name: { type: "string", required: true, hint: "--name=<value>" } },
		handler: (ctx) => addThing(ctx.deps, ctx.project!.path, ctx.flags.name),
		renderer: renderThingAdded,
	}),
};
```

### Command Descriptor Options

- `requires: "project"` — auto project guard (returns noProjectResponse)
- `flags: Record<string, FlagSpec>` — declarative flag parsing + validation
- `rawArgs: true` — pass raw CLI args to handler
- `wildcardPrefix: "report:"` — strip prefix into `ctx.wildcard`
- `exitCode: number | (model) => number` — custom exit codes
- `handler: (ctx) => TModel` — returns data model (sync or async)
- `renderer: (data, log) => void` — data-first signature

### Store Pattern (Declarative)

Domain stores use `createStore()` from the store engine:

```typescript
// src/domain/example/example-store.ts
import { createStore } from "../../infrastructure/store-engine.js";

export const exampleStore = createStore<ExampleSummary, ExampleDefinition>({
	name: "examples",
	defaultDir: "docs/examples",
	typeTag: "Example",
	fields: { name: { type: "string", required: true }, status: { type: "enum", options: ["open", "closed"], default: "open" } },
	sort: (a, b) => a.name.localeCompare(b.name),
	buildBody: (def) => `# ${def.name}\n\n${def.description}`,
});
// Use: exampleStore.list(deps, projectPath), exampleStore.create(deps, projectPath, def)
```

## Test Pattern

```typescript
// tests/domain/example/example.test.ts
vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { myFunction } from "../../../src/domain/example/example.js";

describe("myFunction", () => {
	it("does the thing", () => {
		const mockDeps = { disk: createMockFs(), paths: createMockPaths() };
		const result = myFunction(mockDeps);
		expect(result).toBe(expected);
	});
});
```

For controller handler tests, use `createProjectContext()` from `tests/helpers/command-test-utils.ts`:

```typescript
import { createProjectContext } from "../helpers/command-test-utils.js";

const ctx = createProjectContext({ command: "capa:list", flags: {} });
const result = descriptor.handler(ctx);
expect(result).toHaveLength(2);
```

## Key Types

- `IFileSystem` — file I/O abstraction (`readFileSync`, `writeFileSync`, `existsSync`, etc.)
- `IShell` — command execution (`run`, `runSilent`, `runCapture`, `spawnBackground`, etc.)
- `IPaths` — path operations (`join`, `resolve`, `dirname`, `basename`, `relative`, etc.)
- `IClock` — time (`now`, `ms`, `iso`, `safeIso`)
- `CommandDescriptor<TFlags, TModel>` — declarative command definition (flags, handler, renderer)
- `CommandContext<TFlags>` — typed context passed to command handlers
- `StoreDescriptor<TSummary, TDefinition>` — declarative store definition (fields, buildBody, sort)
- `StoreApi<TSummary, TDefinition>` — CRUD API returned by `createStore()`
- `MenuEntry` — menu item (`key`, `label`, `action`, `disabled`, `hidden`, `separator`)
- `MenuResult` — menu return type (`"main"`, `"quit"`, `"navigate:viewId"`, `undefined`)
- `CliResponse<T>` — response (typed data model + renderer function)

## Config Contract

Each managed project declares capabilities in `configs/flowti.config.json`:

```
build.commands     — named build modes (fast, full, watch, distribute)
test.commands      — named test presets (unit, flows, e2e)
devtools           — lint thresholds (maxComplexity, maxLines)
make.templates     — available scaffold templates (journey, component)
reports.generators — report pipeline configuration
docs.references    — reference doc generators
management.*       — CRUD domain directories (resources, timelog, deliverables, raid, capa, iterations)
management.iterations.durationDays — auto-complete end date on iteration creation
publish.endpoints  — distribution targets
health.thresholds  — quality gate configuration
components         — component system settings (framework, storybook)
```

## Conventions

- **File naming**: kebab-case throughout (`my-feature.ts`, `my-feature.test.ts`)
- **Imports**: `.js` extension in all imports (ESM)
- **Tabs** for indentation
- **No `any`** types, no `@ts-ignore`, no `TODO`/`FIXME` comments
- **Tests mirror source**: `src/domain/foo/bar.ts` → `tests/domain/foo/bar.test.ts`
- **E2E journey suites**: 5 suites are `describe.skip()` — this is intentional (journeys not yet built)
- **Coverage target**: 80% statements, 80% lines
