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
npx eslint src/ --config configs/eslint.config.mjs
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
├── domain/                  # 26 modules — pure business logic, NO I/O
│   └── (scaffold, make, build, publish, review, reports, e2e, events,
│       health, lifecycle, resources, timelog, deliverables, raid,
│       requirements, capa, capture, plugins, ai-tools, info,
│       onboarding, knowledgebase, devtools, templates, sitemap, shared)
└── infrastructure/          # 41 modules — I/O abstractions + pipeline + sitemap engine
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

## Sitemap-Driven UI

All interactive menus are declared in `configs/sitemap.json`:

- **22 views** — each with title, icon, domain, capabilities, items
- **Static views**: items array with handler/navigate/signal actions
- **Dynamic views**: `type: "dynamic"` with registered view handler
- **Hybrid views**: dynamic handler + items array → handler receives `sitemapSlots`
- **Handler types**: ViewHandler, ActionHandler, ConditionHandler, BeforeRenderHandler, ListProviderHandler
- **Registration**: `src/ui/handlers/register-handlers.ts` is the single registration point

### Adding a New Menu Item

1. Add item to `configs/sitemap.json` with `"handler": "my:action"`
2. Register handler in appropriate file under `src/ui/handlers/`
3. Call `registry.registerAction("my:action", async (ctx) => { ... })`

### Adding a New View

1. Add view to `configs/sitemap.json`
2. For static: just add items with handlers
3. For dynamic: add `"type": "dynamic", "handler": "my-view"` and register a ViewHandler

## Controller Pattern

```typescript
// src/controller/example.controller.ts
const actions: Record<string, ControllerAction> = {
  "example:list": (req) => {
    const data = listThings(req.deps);
    return dataResponse(data, renderThingList);
  },
};
export const commands = Object.fromEntries(
  Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
```

## Test Pattern

```typescript
// tests/domain/example/example.test.ts
vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));
// ... mock all infrastructure

import { myFunction } from "../../../src/domain/example/example.js";

describe("myFunction", () => {
  it("does the thing", () => {
    const mockDeps = { disk: createMockFs(), paths: createMockPaths() };
    const result = myFunction(mockDeps);
    expect(result).toBe(expected);
  });
});
```

## Key Types

- `IFileSystem` — file I/O abstraction (`readFileSync`, `writeFileSync`, `existsSync`, etc.)
- `IShell` — command execution (`run`, `runSilent`, `runCapture`, `spawnBackground`, etc.)
- `IPaths` — path operations (`join`, `resolve`, `dirname`, `basename`, `relative`, etc.)
- `IClock` — time (`now`, `ms`, `iso`, `safeIso`)
- `MenuEntry` — menu item (`key`, `label`, `action`, `disabled`, `hidden`, `separator`)
- `MenuResult` — menu return type (`"main"`, `"quit"`, `"navigate:viewId"`, `undefined`)
- `CliResponse<T>` — controller response (typed data model + renderer function)

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
