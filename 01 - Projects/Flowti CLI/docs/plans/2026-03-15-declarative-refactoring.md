# Declarative Refactoring Implementation Plan

> **Status:** Complete (2026-03-16) — All 5 chunks, 20 tasks executed. 7,016 tests passing, 84% coverage.

**Goal:** Replace imperative controller/store boilerplate with declarative engines, remove dead code, enforce patterns via TypeScript + ESLint + conformance tests.

**Architecture:** Two new engine modules (`command-engine.ts`, `store-engine.ts`) provide `defineCommand()` and `createStore()` APIs that accept typed descriptors and return fully wired handlers/stores. All 27 controllers and 9 markdown stores are rewritten as descriptors. Legacy `adapt()`, `initializeDeps()`, and per-controller helpers are deleted. Patterns enforced by TypeScript types, ESLint rules, and conformance tests.

**Tech Stack:** TypeScript (strict, ESM, `.js` imports), Vitest, ESLint flat config, zero runtime deps.

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-15-declarative-refactoring-design.md`

---

## Chunk 1: Command Engine + Test Infrastructure

**Task execution order:** Task 3 (mock-deps rewrite) MUST run before Task 2 (engine implementation) because engine tests import `createTestDeps()` which needs the new stubs.

### Task 1: Command Engine Types

**Files:**
- Create: `src/infrastructure/command-engine.ts`

- [x] **Step 1: Create the types file with all interfaces**

```typescript
// src/infrastructure/command-engine.ts
import type { CliDeps } from "./deps.js";
import type { ProjectContext, CommandHandler } from "./types-config.js";
import { dataResponse, handleResponse, getSharedDeps } from "./request-response.js";
import { renderNoProject } from "../ui/renderers/common-renderers.js";
import type { NoProjectModel } from "../ui/renderers/common-renderers.js";

// ── Types ────────────────────────────────────────────────────────

export type LogFn = (msg?: string) => void;
export type RendererFn<T> = (data: T, log: LogFn) => void;

export interface FlagSpec {
	type: "string" | "boolean" | "number" | "list";
	required?: boolean;
	default?: unknown;
	choices?: string[];
	coerce?: "int" | "float";
	hint?: string;
	parse?: (raw: string) => unknown;
}

export interface CommandContext<TFlags = Record<string, unknown>> {
	command: string;
	flags: TFlags;
	rawArgs?: string[];
	project?: ProjectContext;
	deps: CliDeps;
	wildcard?: string;
}

export interface CommandDescriptor<TFlags = Record<string, unknown>, TModel = unknown> {
	requires?: "project";
	flags?: Record<string, FlagSpec>;
	rawArgs?: boolean;
	wildcardPrefix?: string;
	handler: (ctx: CommandContext<TFlags>) => TModel | Promise<TModel>;
	renderer: RendererFn<TModel>;
	exitCode?: number | ((model: TModel) => number | undefined);
}
```

- [x] **Step 2: Verify file compiles**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | head -20`
Expected: No errors related to command-engine.ts

### Task 2: Command Engine Implementation

**Files:**
- Modify: `src/infrastructure/command-engine.ts`

- [x] **Step 1: Write the failing test for flag parsing**

Create `tests/infrastructure/command-engine.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { parseFlags, validateFlags, adaptDescriptor } from "../../src/infrastructure/command-engine.js";
import type { FlagSpec } from "../../src/infrastructure/command-engine.js";

describe("parseFlags", () => {
	it("extracts string flags with defaults", () => {
		const spec: Record<string, FlagSpec> = {
			mode: { type: "string", default: "fast" },
		};
		const result = parseFlags({ mode: "full" }, spec);
		expect(result.mode).toBe("full");
	});

	it("applies default when flag is missing", () => {
		const spec: Record<string, FlagSpec> = {
			mode: { type: "string", default: "fast" },
		};
		const result = parseFlags({}, spec);
		expect(result.mode).toBe("fast");
	});

	it("coerces number flags with int", () => {
		const spec: Record<string, FlagSpec> = {
			count: { type: "number", coerce: "int", default: 0 },
		};
		const result = parseFlags({ count: "42" }, spec);
		expect(result.count).toBe(42);
	});

	it("coerces number flags with float", () => {
		const spec: Record<string, FlagSpec> = {
			hours: { type: "number", coerce: "float", default: 1 },
		};
		const result = parseFlags({ hours: "2.5" }, spec);
		expect(result.hours).toBe(2.5);
	});

	it("splits list flags by comma", () => {
		const spec: Record<string, FlagSpec> = {
			tags: { type: "list" },
		};
		const result = parseFlags({ tags: "a,b,c" }, spec);
		expect(result.tags).toEqual(["a", "b", "c"]);
	});

	it("handles boolean flags", () => {
		const spec: Record<string, FlagSpec> = {
			verbose: { type: "boolean", default: false },
		};
		expect(parseFlags({ verbose: true }, spec).verbose).toBe(true);
		expect(parseFlags({}, spec).verbose).toBe(false);
	});

	it("calls custom parse function", () => {
		const spec: Record<string, FlagSpec> = {
			payload: { type: "string", parse: (raw) => JSON.parse(raw) },
		};
		const result = parseFlags({ payload: '{"key":"val"}' }, spec);
		expect(result.payload).toEqual({ key: "val" });
	});
});

describe("validateFlags", () => {
	it("returns error for missing required flag", () => {
		const spec: Record<string, FlagSpec> = {
			name: { type: "string", required: true, hint: "--name=<value>" },
		};
		const result = validateFlags({}, spec);
		expect(result).not.toBeNull();
		expect(result!.error).toContain("--name");
		expect(result!.hint).toContain("--name=<value>");
	});

	it("returns null when required flag is present", () => {
		const spec: Record<string, FlagSpec> = {
			name: { type: "string", required: true },
		};
		const result = validateFlags({ name: "test" }, spec);
		expect(result).toBeNull();
	});

	it("returns error for invalid choice", () => {
		const spec: Record<string, FlagSpec> = {
			status: { type: "string", choices: ["open", "closed"] },
		};
		const result = validateFlags({ status: "invalid" }, spec);
		expect(result).not.toBeNull();
		expect(result!.error).toContain("invalid");
		expect(result!.error).toContain("open");
	});

	it("accepts valid choice", () => {
		const spec: Record<string, FlagSpec> = {
			status: { type: "string", choices: ["open", "closed"] },
		};
		const result = validateFlags({ status: "open" }, spec);
		expect(result).toBeNull();
	});
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/command-engine.test.ts --config configs/vitest.config.ts`
Expected: FAIL — `parseFlags` and `validateFlags` not exported

- [x] **Step 3: Implement parseFlags and validateFlags**

Add to `src/infrastructure/command-engine.ts`:

```typescript
// ── Flag Parsing ─────────────────────────────────────────────────

export function parseFlags(
	raw: Record<string, string | boolean>,
	spec: Record<string, FlagSpec>,
): Record<string, unknown> {
	const result: Record<string, unknown> = {};
	for (const [key, fs] of Object.entries(spec)) {
		const val = raw[key];
		if (val === undefined || val === false) {
			result[key] = fs.default;
			continue;
		}
		if (fs.parse && typeof val === "string") {
			result[key] = fs.parse(val);
			continue;
		}
		switch (fs.type) {
			case "boolean":
				result[key] = val === true || val === "true";
				break;
			case "number":
				result[key] = fs.coerce === "int"
					? parseInt(String(val), 10)
					: parseFloat(String(val));
				break;
			case "list":
				result[key] = typeof val === "string" ? val.split(",").map(s => s.trim()) : [];
				break;
			default:
				result[key] = typeof val === "string" ? val : String(val);
		}
	}
	return result;
}

export interface FlagValidationError {
	error: string;
	hint?: string;
}

export function validateFlags(
	parsed: Record<string, unknown>,
	spec: Record<string, FlagSpec>,
): FlagValidationError | null {
	for (const [key, fs] of Object.entries(spec)) {
		if (fs.required && (parsed[key] === undefined || parsed[key] === "")) {
			return {
				error: `Missing required flag --${key}.`,
				hint: fs.hint ?? `Usage: --${key}=<value>`,
			};
		}
		if (fs.choices && parsed[key] !== undefined && parsed[key] !== "") {
			if (!fs.choices.includes(String(parsed[key]))) {
				return {
					error: `Invalid value "${parsed[key]}" for --${key}. Valid: ${fs.choices.join(", ")}`,
				};
			}
		}
	}
	return null;
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/command-engine.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [x] **Step 5: Write failing test for adaptDescriptor (the main engine function)**

Add to `tests/infrastructure/command-engine.test.ts`:

```typescript
import { createTestDeps } from "../mocks/mock-deps.js";

describe("adaptDescriptor", () => {
	const mockLog = vi.fn();
	const deps = { ...createTestDeps(), log: mockLog };

	it("returns project error when requires:project and no project", () => {
		const handler = adaptDescriptor({
			requires: "project",
			handler: () => ({ ok: true }),
			renderer: vi.fn(),
		});
		const result = handler({}, [], "test:cmd", undefined);
		expect(result).toBeDefined();
		expect(result?.data).toHaveProperty("command");
	});

	it("calls handler with parsed flags", () => {
		const handlerFn = vi.fn(() => ({ value: 42 }));
		const handler = adaptDescriptor({
			flags: { mode: { type: "string", default: "fast" } },
			handler: handlerFn,
			renderer: vi.fn(),
		});
		handler({ mode: "full" }, [], "test:cmd", undefined);
		expect(handlerFn).toHaveBeenCalledWith(
			expect.objectContaining({
				command: "test:cmd",
				flags: { mode: "full" },
			}),
		);
	});

	it("returns validation error for missing required flag", () => {
		const handler = adaptDescriptor({
			flags: { name: { type: "string", required: true, hint: "--name=<val>" } },
			handler: vi.fn(),
			renderer: vi.fn(),
		});
		const result = handler({ format: "json" }, [], "test:cmd", undefined);
		expect(result?.data).toHaveProperty("error");
	});

	it("handles async handlers", async () => {
		const handlerFn = vi.fn(async () => ({ async: true }));
		const renderer = vi.fn();
		const handler = adaptDescriptor({
			handler: handlerFn,
			renderer,
		});
		const result = handler({}, [], "test:cmd", undefined);
		expect(result).toBeInstanceOf(Promise);
		const resolved = await result;
		expect(resolved?.data).toEqual({ async: true });
	});

	it("applies exitCode from callback", () => {
		const handler = adaptDescriptor({
			handler: () => ({ errors: ["bad"] }),
			renderer: vi.fn(),
			exitCode: (m: { errors: string[] }) => m.errors.length > 0 ? 1 : undefined,
		});
		const result = handler({}, [], "test:cmd", undefined);
		expect(result?.exitCode).toBe(1);
	});

	it("resolves wildcard from prefix", () => {
		const handlerFn = vi.fn(() => ({ report: "coverage" }));
		const handler = adaptDescriptor({
			wildcardPrefix: "report:",
			handler: handlerFn,
			renderer: vi.fn(),
		});
		handler({}, [], "report:coverage", undefined);
		expect(handlerFn).toHaveBeenCalledWith(
			expect.objectContaining({
				command: "report:coverage",
				wildcard: "coverage",
			}),
		);
	});

	it("passes rawArgs when rawArgs: true", () => {
		const handlerFn = vi.fn(() => ({}));
		const handler = adaptDescriptor({
			rawArgs: true,
			handler: handlerFn,
			renderer: vi.fn(),
		});
		handler({}, ["help", "build"], "help", undefined);
		expect(handlerFn).toHaveBeenCalledWith(
			expect.objectContaining({
				rawArgs: ["help", "build"],
			}),
		);
	});

	it("stamps __descriptor on returned handler", () => {
		const desc = { handler: () => ({}), renderer: vi.fn() };
		const handler = adaptDescriptor(desc);
		expect((handler as any).__descriptor).toBe(desc);
	});
});
```

- [x] **Step 6: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/command-engine.test.ts --config configs/vitest.config.ts`
Expected: FAIL — `adaptDescriptor` not exported

- [x] **Step 7: Implement adaptDescriptor**

Add to `src/infrastructure/command-engine.ts`.

**Critical design note:** `CommandHandler` returns `void | Promise<void>`. The engine must call `handleResponse()` internally (like `adapt()` does) — it does NOT return `CliResponse`. This means `handleResponse` and `getSharedDeps` must be exported from `request-response.ts` first.

**Prerequisite:** Export `getSharedDeps` and `handleResponse` from `request-response.ts`:

```typescript
// In request-response.ts, change:
//   function getSharedDeps(): CliDeps {
// To:
export function getSharedDeps(): CliDeps {
```

`handleResponse` is already used internally but needs to be exported:
```typescript
// Change: function handleResponse<T>(...)
// To: export function handleResponse<T>(...)
```

Then implement the engine:

```typescript
// ── Engine ───────────────────────────────────────────────────────

export function adaptDescriptor<TFlags = Record<string, unknown>, TModel = unknown>(
	desc: CommandDescriptor<TFlags, TModel>,
): CommandHandler & { __descriptor: CommandDescriptor<TFlags, TModel> } {
	const handler: CommandHandler = (
		flags: Record<string, string | boolean>,
		rawArgs: string[],
		command?: string,
		project?: ProjectContext,
	): void | Promise<void> => {
		const cmd = command ?? "";
		const format = typeof flags.format === "string" ? flags.format : undefined;
		const deps = getSharedDeps();

		// Project guard
		if (desc.requires === "project" && !project) {
			const response = dataResponse<NoProjectModel>(
				{ command: "help" },
				(d: NoProjectModel) => renderNoProject(deps.log, d),
			);
			handleResponse(response, format);
			return;
		}

		// Parse and validate flags
		const parsed = desc.flags ? parseFlags(flags, desc.flags as Record<string, FlagSpec>) : {};
		if (desc.flags) {
			const error = validateFlags(parsed, desc.flags as Record<string, FlagSpec>);
			if (error) {
				handleResponse(dataResponse(error, () => {}), format);
				return;
			}
		}

		// Build context
		const ctx: CommandContext<TFlags> = {
			command: cmd,
			flags: parsed as TFlags,
			project,
			deps,
			...(desc.rawArgs ? { rawArgs } : {}),
			...(desc.wildcardPrefix && cmd.startsWith(desc.wildcardPrefix)
				? { wildcard: cmd.substring(desc.wildcardPrefix.length) }
				: {}),
		};

		// Call handler
		const result = desc.handler(ctx);

		// Handle async
		if (result instanceof Promise) {
			return result.then((model) => {
				handleResponse(wrapResponse(model, desc, deps), format);
			});
		}

		handleResponse(wrapResponse(result, desc, deps), format);
	};

	(handler as any).__descriptor = desc;
	return handler as CommandHandler & { __descriptor: CommandDescriptor<TFlags, TModel> };
}

function wrapResponse<TModel>(
	model: TModel,
	desc: CommandDescriptor<unknown, TModel>,
	deps: CliDeps,
): CliResponse<TModel> {
	const exitCode = typeof desc.exitCode === "function"
		? desc.exitCode(model)
		: desc.exitCode;

	return {
		data: model,
		render: (d: TModel) => desc.renderer(d, deps.log),
		...(exitCode !== undefined ? { exitCode } : {}),
	};
}
```

**Note on `renderNoProject` call:** In Phase 1, `renderNoProject` is still log-first `(log, data)`. The engine calls it with `(deps.log, d)` matching the current signature. In Phase 2, when renderers are swapped to data-first, this call will be updated to `(d, deps.log)`.

**Registration:** Controllers export their commands via `adaptDescriptor()` directly and register through `CommandRegistry.registerDomain()` as they do today. No parallel `commandMap` — the existing registry is the single source of truth.

```typescript
// ── Registration Helper ──────────────────────────────────────────

export function defineCommands<TFlags = Record<string, unknown>, TModel = unknown>(
	descriptors: Array<{ name: string; descriptor: CommandDescriptor<TFlags, TModel> }>,
): Record<string, CommandHandler> {
	const result: Record<string, CommandHandler> = {};
	for (const { name, descriptor } of descriptors) {
		result[name] = adaptDescriptor(descriptor);
	}
	return result;
}
```

Usage in controllers:
```typescript
// Controller exports commands record, registered via CommandRegistry.registerDomain() in main.ts
export const commands: Record<string, CommandHandler> = {
	"capa:list": adaptDescriptor({ requires: "project", handler: ..., renderer: ... }),
	"capa:add": adaptDescriptor({ flags: { name: { ... } }, handler: ..., renderer: ... }),
};
```

- [x] **Step 8: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/command-engine.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [x] **Step 9: Run full test suite to verify nothing breaks**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: All existing tests pass

- [x] **Step 10: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/command-engine.ts" \
       "01 - Projects/Flowti CLI/tests/infrastructure/command-engine.test.ts"
git commit -m "feat: add command schema engine with defineCommand API"
```

### Task 3: Rewrite mock-deps.ts

**Files:**
- Modify: `tests/mocks/mock-deps.ts`

- [x] **Step 1: Add missing stubs to createTestDeps**

Add `worldState`, `workerManager`, `processRunner` stubs and `askAbortable` to `createMockInput()`:

```typescript
// Add to createMockInput():
askAbortable: vi.fn(() => ({ promise: Promise.resolve(""), abort: vi.fn() })),

// Add imports at top of mock-deps.ts:
import type { IWorldStateManager } from "../../src/domain/agents/world-state-types.js";
import type { IWorkerManager, IAgentProcessRunner } from "../../src/domain/agents/worker-types.js";

// Add factory functions:
function createMockWorldState(): IWorldStateManager {
	return {
		emitAction: vi.fn(),
		updateEntity: vi.fn(),
		getState: vi.fn(() => ({ version: 1 as const, updatedAt: "", entities: {}, permissions: {}, activityLog: [] })),
		getEntity: vi.fn(() => null),
		flush: vi.fn(),
		setActionCallback: vi.fn(),
	};
}

function createMockWorkerManager(): IWorkerManager {
	return {
		spawn: vi.fn(() => null),
		spawnAll: vi.fn(),
		stop: vi.fn(),
		stopAll: vi.fn(),
		getWorker: vi.fn(() => null),
		listWorkers: vi.fn(() => []),
		send: vi.fn(),
		dispatchWorldEvent: vi.fn(),
	};
}

function createMockProcessRunner(): IAgentProcessRunner {
	return {
		spawn: vi.fn(() => ({
			onEvent: vi.fn(),
			result: Promise.resolve({ text: "", thinking: "", exitCode: 0 }),
			kill: vi.fn(),
		})),
	};
}

// Add to createTestDeps() return object:
worldState: createMockWorldState(),
workerManager: createMockWorkerManager(),
processRunner: createMockProcessRunner(),
```

- [x] **Step 2: Verify TypeScript compiles**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | head -20`
Expected: No new errors

- [x] **Step 3: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: All tests pass

- [x] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/mocks/mock-deps.ts"
git commit -m "fix: add missing CliDeps stubs to createTestDeps"
```

### Task 4: Test Helpers

**Files:**
- Create: `tests/helpers/project-factory.ts`
- Create: `tests/helpers/store-deps.ts`
- Create: `tests/helpers/capture-display.ts`

- [x] **Step 1: Create ProjectFactory**

```typescript
// tests/helpers/project-factory.ts
import type { ProjectContext } from "../../src/infrastructure/types.js";
import type { ProjectConfig } from "../../src/infrastructure/types-config.js";

export const ProjectFactory = {
	default: (overrides?: Partial<ProjectContext>): ProjectContext => ({
		path: "/project",
		config: { name: "test-project", reports: { generators: [] } } as ProjectConfig,
		scripts: {},
		pkg: { name: "test-project", version: "1.0.0" },
		...overrides,
	}),
	withConfig: (config: Partial<ProjectConfig>): ProjectContext =>
		ProjectFactory.default({ config: { name: "test", ...config } as ProjectConfig }),
	withScripts: (scripts: Record<string, string>): ProjectContext =>
		ProjectFactory.default({ scripts, pkg: { name: "test", version: "1.0.0", scripts } }),
};
```

- [x] **Step 2: Create createStoreDeps**

```typescript
// tests/helpers/store-deps.ts
import { createMockFs } from "../mocks/mock-fs.js";
import { createMockClock } from "../mocks/mock-clock.js";
import type { IPaths } from "../../src/infrastructure/types.js";

function createMockPaths(): IPaths {
	return {
		join: (...segments: string[]) => segments.join("/"),
		resolve: (...segments: string[]) => segments.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/") || "/",
		basename: (p: string, ext?: string) => {
			const b = p.split("/").pop() ?? p;
			return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b;
		},
		relative: (_from: string, to: string) => to,
		extname: (p: string) => { const m = p.match(/\.[^.]+$/); return m ? m[0] : ""; },
		isAbsolute: (p: string) => p.startsWith("/"),
		sep: "/",
	};
}

export function createStoreDeps(opts?: { files?: Record<string, string>; iso?: string }) {
	return {
		disk: createMockFs(opts?.files),
		paths: createMockPaths(),
		clock: createMockClock(opts?.iso),
	};
}
```

- [x] **Step 3: Create captureDisplay**

```typescript
// tests/helpers/capture-display.ts
import { vi } from "vitest";

export function captureDisplay(fn: (log: (msg?: string) => void) => void): string {
	const log = vi.fn();
	fn(log);
	return log.mock.calls.flat().join("\n");
}

export function captureDisplayLines(fn: (log: (msg?: string) => void) => void): string[] {
	const log = vi.fn();
	fn(log);
	return log.mock.calls.flat() as string[];
}
```

- [x] **Step 4: Verify all compile**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [x] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/helpers/"
git commit -m "feat: add test helpers — ProjectFactory, createStoreDeps, captureDisplay"
```

### Task 5: Store Engine

**Files:**
- Create: `src/infrastructure/store-engine.ts`
- Create: `tests/infrastructure/store-engine.test.ts`

- [x] **Step 1: Write failing tests for store engine**

```typescript
// tests/infrastructure/store-engine.test.ts
import { describe, it, expect, vi } from "vitest";
import { createStore } from "../../src/infrastructure/store-engine.js";
import type { StoreDescriptor, FieldSpec } from "../../src/infrastructure/store-engine.js";
import { createStoreDeps } from "../helpers/store-deps.js";

interface TestSummary {
	name: string;
	status: string;
	count: number;
}

interface TestDefinition {
	name: string;
	status?: string;
	count?: number;
	description: string;
}

const testDescriptor: StoreDescriptor<TestSummary, TestDefinition> = {
	name: "test-items",
	defaultDir: "docs/test",
	typeTag: "TestItem",
	fields: {
		name: { type: "string", from: "frontmatter", required: true },
		status: { type: "enum", options: ["open", "closed"], default: "open" },
		count: { type: "number", default: 0 },
	},
	buildBody: (def) => `# ${def.name}\n\n${def.description}`,
	sort: (a, b) => a.name.localeCompare(b.name),
};

describe("createStore", () => {
	it("returns object with CRUD methods and __descriptor", () => {
		const store = createStore(testDescriptor);
		expect(store).toHaveProperty("list");
		expect(store).toHaveProperty("read");
		expect(store).toHaveProperty("create");
		expect(store).toHaveProperty("updateField");
		expect(store).toHaveProperty("remove");
		expect(store).toHaveProperty("resolveDir");
		expect(store.__descriptor).toBe(testDescriptor);
	});

	describe("list", () => {
		it("returns parsed items from directory", () => {
			const deps = createStoreDeps({
				files: {
					"/project/docs/test/item-a.md": "---\nname: Item A\nstatus: open\ncount: 5\n---\n# Item A\nBody",
					"/project/docs/test/item-b.md": "---\nname: Item B\nstatus: closed\ncount: 3\n---\n# Item B\nBody",
				},
			});
			const store = createStore(testDescriptor);
			const items = store.list(deps, "/project");
			expect(items).toHaveLength(2);
			expect(items[0].name).toBe("Item A");
			expect(items[0].status).toBe("open");
			expect(items[0].count).toBe(5);
		});

		it("applies defaults for missing fields", () => {
			const deps = createStoreDeps({
				files: {
					"/project/docs/test/minimal.md": "---\nname: Minimal\n---\nBody",
				},
			});
			const store = createStore(testDescriptor);
			const items = store.list(deps, "/project");
			expect(items[0].status).toBe("open");
			expect(items[0].count).toBe(0);
		});

		it("returns empty array when directory missing", () => {
			const deps = createStoreDeps();
			const store = createStore(testDescriptor);
			const items = store.list(deps, "/project");
			expect(items).toEqual([]);
		});
	});

	describe("create", () => {
		it("writes markdown file with frontmatter and body", () => {
			const deps = createStoreDeps();
			const store = createStore(testDescriptor);
			const path = store.create(deps, "/project", {
				name: "New Item",
				status: "open",
				description: "A test item",
			});
			expect(path).toContain("new-item.md");
			const written = deps.disk.files.get("/project/docs/test/new-item.md");
			expect(written).toBeDefined();
			expect(written).toContain("name: New Item");
			expect(written).toContain("type: TestItem");
			expect(written).toContain("# New Item");
		});
	});

	describe("resolveDir", () => {
		it("uses defaultDir when no config", () => {
			const deps = createStoreDeps();
			const store = createStore(testDescriptor);
			expect(store.resolveDir(deps, "/project")).toBe("/project/docs/test");
		});
	});
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/store-engine.test.ts --config configs/vitest.config.ts`
Expected: FAIL — `createStore` not found

- [x] **Step 3: Implement store engine**

**Prerequisite:** Move shared markdown utilities from domain to infrastructure. Create `src/infrastructure/markdown-utils.ts` by extracting `listMdFiles`, `resolveDir`, `toMdFilename`, `updateField` from `src/domain/shared/markdown-store.ts`. Update `markdown-store.ts` to re-export from the new location for backwards compatibility during migration. This avoids the architecture violation of infrastructure importing from domain.

Create `src/infrastructure/store-engine.ts`:

```typescript
import type { CliDeps } from "./deps.js";
import type { IClock } from "./types.js";
import { parseFrontmatterStrings } from "./frontmatter.js";
import { listMdFiles, resolveDir, toMdFilename, updateField } from "./markdown-utils.js";

// ── Types ────────────────────────────────────────────────────────

export type StoreDeps = Pick<CliDeps, "disk" | "paths"> & { clock?: IClock };

export interface FieldSpec {
	type: "string" | "number" | "boolean" | "enum" | "array" | "date";
	default?: unknown;
	options?: string[];
	required?: boolean;
	from?: "frontmatter" | "filename" | "dirname";
	parse?: (raw: string) => unknown;
	serialize?: (value: unknown) => string;
}

export interface CompanionSpec {
	extension: string;
	fields: string[];
}

export interface StoreDescriptor<TSummary, TDefinition> {
	name: string;
	defaultDir: string;
	configPath?: string;
	fields: Record<string, FieldSpec>;
	typeTag: string;
	filename?: (def: TDefinition, deps: StoreDeps) => string;
	sort?: (a: TSummary, b: TSummary) => number;
	filter?: (fm: Record<string, string>) => boolean;
	buildBody: (def: TDefinition, deps: StoreDeps) => string;
	parseBody?: (body: string, fm: Record<string, string>) => Partial<TSummary>;
	needsClock?: boolean;
	companion?: CompanionSpec;
	idGeneration?: { prefix: string; padding: number };
	nested?: boolean;
}

export interface StoreApi<TSummary, TDefinition> {
	list: (deps: StoreDeps, projectPath: string, config?: Record<string, unknown>) => TSummary[];
	read: (deps: StoreDeps, projectPath: string, name: string, config?: Record<string, unknown>) => TSummary | undefined;
	create: (deps: StoreDeps, projectPath: string, def: TDefinition, config?: Record<string, unknown>) => string;
	updateField: (deps: StoreDeps, projectPath: string, name: string, field: string, value: string, config?: Record<string, unknown>) => boolean;
	remove: (deps: StoreDeps, projectPath: string, name: string, config?: Record<string, unknown>) => void;
	resolveDir: (deps: StoreDeps, projectPath: string, config?: Record<string, unknown>) => string;
	nextId?: (deps: StoreDeps, projectPath: string, config?: Record<string, unknown>) => string;
	__descriptor: StoreDescriptor<TSummary, TDefinition>;
}

// ── Engine ───────────────────────────────────────────────────────

function parseFieldValue(raw: string | undefined, spec: FieldSpec): unknown {
	if (raw === undefined) return spec.default;
	if (spec.parse) return spec.parse(raw);
	switch (spec.type) {
		case "number": return parseFloat(raw) || (spec.default ?? 0);
		case "boolean": return raw === "true";
		case "enum": return spec.options?.includes(raw) ? raw : (spec.default ?? raw);
		case "array": return raw.split(",").map(s => s.trim()).filter(Boolean);
		default: return raw;
	}
}

function serializeFieldValue(value: unknown, spec: FieldSpec): string {
	if (spec.serialize) return spec.serialize(value);
	if (Array.isArray(value)) return value.join(", ");
	return String(value ?? "");
}

export function createStore<TSummary, TDefinition>(
	desc: StoreDescriptor<TSummary, TDefinition>,
): StoreApi<TSummary, TDefinition> {
	function getDir(deps: StoreDeps, projectPath: string, config?: Record<string, unknown>): string {
		const configDir = config && desc.configPath ? (config as any)[desc.configPath] : undefined;
		return resolveDir(deps, projectPath, configDir, desc.defaultDir);
	}

	function parseSummary(fm: Record<string, string>, file: string): TSummary {
		const obj: Record<string, unknown> = {};
		for (const [key, spec] of Object.entries(desc.fields)) {
			const source = spec.from === "filename" ? file.replace(/\.md$/, "") : fm[key];
			obj[key] = parseFieldValue(source, spec);
		}
		obj.file = file;
		return obj as TSummary;
	}

	const store: StoreApi<TSummary, TDefinition> = {
		list(deps, projectPath, config?) {
			const dir = getDir(deps, projectPath, config);
			const files = listMdFiles(deps, dir);
			const items: TSummary[] = [];
			for (const file of files) {
				const content = deps.disk.readFileSync(deps.paths.join(dir, file), "utf-8");
				const fm = parseFrontmatterStrings(content);
				if (desc.filter && !desc.filter(fm)) continue;
				const item = parseSummary(fm, file);
				if (desc.parseBody) {
					const bodyMatch = content.match(/^---[\s\S]*?---\s*([\s\S]*)/);
					if (bodyMatch) Object.assign(item as any, desc.parseBody(bodyMatch[1], fm));
				}
				items.push(item);
			}
			if (desc.sort) items.sort(desc.sort);
			return items;
		},

		read(deps, projectPath, name, config?) {
			const dir = getDir(deps, projectPath, config);
			const filename = toMdFilename(name);
			const filePath = deps.paths.join(dir, filename);
			if (!deps.disk.existsSync(filePath)) return undefined;
			const content = deps.disk.readFileSync(filePath, "utf-8");
			const fm = parseFrontmatterStrings(content);
			return parseSummary(fm, filename);
		},

		create(deps, projectPath, def, config?) {
			const dir = getDir(deps, projectPath, config);
			deps.disk.mkdirSync(dir, { recursive: true });
			const filename = desc.filename
				? desc.filename(def, deps)
				: toMdFilename((def as any).name ?? "untitled");
			const filePath = deps.paths.join(dir, filename);

			// Build frontmatter
			const fm: Record<string, string> = { type: desc.typeTag };
			for (const [key, spec] of Object.entries(desc.fields)) {
				const val = (def as any)[key];
				if (val !== undefined) {
					fm[key] = serializeFieldValue(val, spec);
				} else if (spec.default !== undefined) {
					fm[key] = serializeFieldValue(spec.default, spec);
				}
			}
			if (deps.clock) fm.date = deps.clock.iso();

			const yamlLines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`);
			const body = desc.buildBody(def, deps);
			const content = `---\n${yamlLines.join("\n")}\n---\n\n${body}`;

			deps.disk.writeFileSync(filePath, content, "utf-8");

			// Handle companion file
			if (desc.companion) {
				const companionData: Record<string, unknown> = {};
				for (const field of desc.companion.fields) {
					if ((def as any)[field] !== undefined) {
						companionData[field] = (def as any)[field];
					}
				}
				if (Object.keys(companionData).length > 0) {
					const companionPath = filePath.replace(/\.md$/, desc.companion.extension);
					deps.disk.writeFileSync(companionPath, JSON.stringify(companionData, null, "\t"), "utf-8");
				}
			}

			return filePath;
		},

		updateField(deps, projectPath, name, field, value, config?) {
			const dir = getDir(deps, projectPath, config);
			const filePath = deps.paths.join(dir, toMdFilename(name));
			return updateField(deps, filePath, field, value);
		},

		remove(deps, projectPath, name, config?) {
			const dir = getDir(deps, projectPath, config);
			const filePath = deps.paths.join(dir, toMdFilename(name));
			if (deps.disk.existsSync(filePath)) {
				deps.disk.unlinkSync(filePath);
			}
		},

		resolveDir: getDir,

		__descriptor: desc,
	};

	// Add ID generation if configured
	if (desc.idGeneration) {
		store.nextId = (deps, projectPath, config?) => {
			const items = store.list(deps, projectPath, config);
			const { prefix, padding } = desc.idGeneration!;
			const pattern = new RegExp(`^${prefix}-(\\d+)$`);
			let max = 0;
			for (const item of items) {
				const id = (item as any).id;
				if (typeof id === "string") {
					const m = id.match(pattern);
					if (m) max = Math.max(max, parseInt(m[1], 10));
				}
			}
			return `${prefix}-${String(max + 1).padStart(padding, "0")}`;
		};
	}

	return store;
}
```

- [x] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/store-engine.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [x] **Step 5: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: All tests pass

- [x] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/store-engine.ts" \
       "01 - Projects/Flowti CLI/tests/infrastructure/store-engine.test.ts"
git commit -m "feat: add store schema engine with createStore API"
```

### Task 6: Conformance Tests (skipped initially)

**Files:**
- Create: `tests/conformance/controller-conformance.test.ts`
- Create: `tests/conformance/store-conformance.test.ts`

- [x] **Step 1: Create skipped conformance tests**

```typescript
// tests/conformance/controller-conformance.test.ts
import { describe, it } from "vitest";

describe.skip("controller conformance", () => {
	it("all registered commands use defineCommand descriptors", () => {
		// Un-skip in Phase 5 after all controllers migrated
	});
});
```

```typescript
// tests/conformance/store-conformance.test.ts
import { describe, it } from "vitest";

describe.skip("store conformance", () => {
	it("all stores use createStore engine", () => {
		// Un-skip in Phase 5 after all stores migrated
	});
});
```

- [x] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/tests/conformance/"
git commit -m "feat: add skipped conformance tests for Phase 5 enforcement"
```

### Task 7: Phase 1 Verification

- [x] **Step 1: Run full check (lint + tsc + tests)**

Run: `cd "01 - Projects/Flowti CLI" && npm test`
Expected: All pass — lint, typecheck, tests

---

## Chunk 2: Renderer Standardization (Phase 2)

### Task 8: Audit and Swap Renderer Signatures

**Context:** The engine calls `renderer(data, log)` (data-first). 73 renderers in the codebase are log-first `(log, data)` and must be swapped. 99 renderers are already data-first.

**Log-first renderers that need swapping (73 total across these files):**
- `src/ui/renderers/common-renderers.ts` — `renderError`, `renderSuccess`, `renderNoProject`, `renderShellCommand`, `renderInteractiveOnly`
- `src/ui/renderers/storybook-renderers.ts` — 17 functions
- `src/ui/renderers/make-renderers.ts` — 1 function
- `src/ui/displays/info-display.ts` — `displayInfo`
- `src/ui/displays/deps-display.ts` — `displayDependencyGraph`
- `src/ui/help.ts` — `renderHelp`
- `src/ui/e2e/e2e-formatters.ts` — 11 functions
- `src/ui/menus/component-detail-menu.ts` — 7 functions

**Files:**
- Modify: All files listed above
- Modify: All controller files that call these renderers (update call sites)

- [x] **Step 1: Swap common-renderers.ts signatures**

For each function in `common-renderers.ts`, swap parameter order:

Before: `export function renderError(log: Log, data: ErrorModel): void`
After: `export function renderError(data: ErrorModel, log: Log): void`

Do this for all 5 functions: `renderError`, `renderSuccess`, `renderNoProject`, `renderShellCommand`, `renderInteractiveOnly`.

- [x] **Step 2: Update all call sites for common-renderers**

Search for all usages across controllers and update parameter order. Example:

Before: `(d) => renderError(req.deps.log, d)`
After: `(d) => renderError(d, req.deps.log)`

Use: `grep -rn "renderError(req\\.deps\\.log" src/controller/` to find all call sites.

Repeat for `renderSuccess`, `renderNoProject`, `renderShellCommand`, `renderInteractiveOnly`.

- [x] **Step 3: Swap remaining log-first renderers**

Repeat the pattern for all other log-first files:
- `storybook-renderers.ts` (17 functions)
- `make-renderers.ts` (1 function)
- `info-display.ts` (`displayInfo`)
- `deps-display.ts` (`displayDependencyGraph`)
- `help.ts` (`renderHelp`)
- `e2e-formatters.ts` (11 functions)
- `component-detail-menu.ts` (7 functions)

For each: swap parameters in definition, then update all call sites.

- [x] **Step 4: Run full check**

Run: `cd "01 - Projects/Flowti CLI" && npm test`
Expected: All pass — lint, typecheck, tests

- [x] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/"
git commit -m "refactor: standardize all renderers to data-first (data, log) signature"
```

---

## Chunk 3: Store Migration (Phase 3)

### Task 9: Migrate Simple Stores (timelog, raid, capa, deliverables)

**Pattern:** For each store, create a descriptor that replaces the manual CRUD functions. The store's `buildBody()` function extracts the document-building logic. Tests are updated to use the new store API.

**Example — CAPA store migration:**

**Files:**
- Modify: `src/domain/capa/capa-store.ts`
- Modify: `tests/domain/capa/capa-store.test.ts`
- Modify: `src/controller/capa.controller.ts` (update imports)

- [x] **Step 1: Rewrite capa-store.ts as descriptor**

```typescript
// src/domain/capa/capa-store.ts
import { createStore } from "../../infrastructure/store-engine.js";
import type { StoreDescriptor } from "../../infrastructure/store-engine.js";
import { Document } from "../../infrastructure/document.js";
import type { CAPASummary, CAPADefinition } from "./capa-types.js";

export const capaStore = createStore<CAPASummary, CAPADefinition & { id: string }>({
	name: "capa",
	defaultDir: "docs/capa",
	typeTag: "CAPAItem",
	idGeneration: { prefix: "CAPA", padding: 3 },
	needsClock: true,
	fields: {
		name: { type: "string", from: "frontmatter", required: true },
		id: { type: "string", default: "" },
		capaType: { type: "enum", options: ["corrective", "preventive"], default: "corrective" },
		status: { type: "enum", options: ["open", "investigating", "action-planned", "implementing", "verification", "closed", "rejected"], default: "open" },
		severity: { type: "enum", options: ["critical", "high", "medium", "low"], default: "medium" },
		source: { type: "enum", options: ["audit", "complaint", "incident", "observation", "review", "other"], default: "observation" },
		owner: { type: "string", default: "" },
		dueDate: { type: "date" },
	},
	sort: (a, b) => a.name.localeCompare(b.name),
	buildBody: (def) => {
		const doc = Document.create(def.name).addBlank()
			.heading(1, `${def.id} — ${def.name}`).addBlank();
		if (def.description) doc.text(def.description).addBlank();
		doc.heading(2, "Root Cause Analysis").addBlank();
		if (def.rootCause) doc.text(def.rootCause).addBlank();
		else doc.text("<!-- Describe the root cause here. -->").addBlank();
		const label = def.capaType === "corrective" ? "Corrective Actions" : "Preventive Actions";
		doc.heading(2, label).addBlank();
		doc.text("<!-- List actions to address the root cause. -->").addBlank();
		doc.heading(2, "Verification").addBlank();
		doc.text("<!-- Define how effectiveness will be verified. -->");
		return doc.toString();
	},
});

// Re-export for backward compat during migration (deleted in Phase 4 cleanup)
export const { list: listCAPAItems, create: createCAPAItem, updateField: updateCAPAStatus, nextId: nextCapaId } = capaStore;
```

- [x] **Step 2: Update tests**

Rewrite `tests/domain/capa/capa-store.test.ts` to test the descriptor and engine-provided CRUD:

```typescript
import { describe, it, expect } from "vitest";
import { capaStore } from "../../../src/domain/capa/capa-store.js";
import { createStoreDeps } from "../../helpers/store-deps.js";

describe("capaStore", () => {
	it("has __descriptor marker", () => {
		expect(capaStore.__descriptor).toBeDefined();
		expect(capaStore.__descriptor.name).toBe("capa");
	});

	it("lists items from directory", () => {
		const deps = createStoreDeps({
			files: {
				"/project/docs/capa/fix-leak.md": "---\nname: Fix Leak\ncapaType: corrective\nstatus: open\n---\n# CAPA-001",
			},
		});
		const items = capaStore.list(deps, "/project");
		expect(items).toHaveLength(1);
		expect(items[0].name).toBe("Fix Leak");
	});

	it("generates next ID", () => {
		const deps = createStoreDeps({
			files: {
				"/project/docs/capa/item.md": "---\nname: Item\nid: CAPA-001\n---\nBody",
			},
		});
		const id = capaStore.nextId!(deps, "/project");
		expect(id).toBe("CAPA-002");
	});
});
```

- [x] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/capa/ --config configs/vitest.config.ts`
Expected: PASS

- [x] **Step 4: Repeat for timelog, raid, deliverables stores**

Follow the same pattern for each store. Key differences:
- **timelog**: custom `filename` function (date+person), reverse sort, `parseBody` for description
- **raid**: four item types via `itemType` enum
- **deliverables**: `completionPct` integer field

- [x] **Step 5: Run full test suite after all simple stores**

Run: `cd "01 - Projects/Flowti CLI" && npm test`
Expected: All pass

- [x] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/capa/" \
       "01 - Projects/Flowti CLI/src/domain/timelog/" \
       "01 - Projects/Flowti CLI/src/domain/raid/" \
       "01 - Projects/Flowti CLI/src/domain/deliverables/" \
       "01 - Projects/Flowti CLI/tests/"
git commit -m "refactor: migrate capa, timelog, raid, deliverables stores to createStore engine"
```

### Task 10: Migrate Medium Stores (requirements, resources)

Follow the same pattern. Key differences:
- **requirements**: 3 entity types (requirements, use-cases, user-stories) — create 3 separate store instances with `filter` to separate by `type` field
- **resources**: dual mode (budget vs quantity) — `buildBody` handles both modes, computed fields stay in domain

- [x] **Step 1-4: Implement, test, verify for each**
- [x] **Step 5: Commit**

### Task 11: Migrate Complex Stores (agents, lifecycle, iterations)

- **agents**: Uses companion JSON spec. `buildBody` extracts agent body builder. Files 3-7 (prompt, state, conversations, sessions, briefs) stay as domain-specific functions.
- **lifecycle**: Uses `nested: true`. Custom `parseBody` for transition history table. Transition logic stays domain-specific.
- **iterations**: Uses custom filename (number-based). Plan+report dual files. Scope checklist and transition logic stay domain-specific.

- [x] **Step 1-4: Implement, test, verify for each**
- [x] **Step 5: Run full check**

Run: `cd "01 - Projects/Flowti CLI" && npm test`
Expected: All pass

- [x] **Step 6: Commit**

```bash
git commit -m "refactor: migrate agents, lifecycle, iterations stores to createStore engine"
```

---

## Chunk 4: Controller Migration (Phase 4)

### Task 12: Migrate Simple Controllers (help, info, project, claude-sync, state, onboarding)

**Pattern:** Replace `adapt()` + `ControllerAction` + `Object.fromEntries(...)` with `defineCommand()`.

**Example — help.controller.ts:**

Before (26 lines):
```typescript
import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
// ...
const actions: Record<string, ControllerAction> = {
	help: (req) => {
		const section = (Object.keys(req.flags)[0] ?? req.rawArgs?.[1] ?? "main").toLowerCase();
		// ...
		return dataResponse(model, (d) => renderHelp(d, log));
	},
};
export const commands = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
```

After (~15 lines):
```typescript
import { defineCommand, getDefinedCommands } from "../infrastructure/command-engine.js";
// ...
defineCommand("help", {
	rawArgs: true,
	handler: (ctx) => {
		const section = (Object.keys(ctx.flags)[0] ?? ctx.rawArgs?.[1] ?? "main").toLowerCase();
		const { disk, paths, log } = ctx.deps;
		const content = getHelp(section, { disk, paths });
		return { section, content, availableSections: getHelpSections({ disk, paths }) };
	},
	renderer: renderHelp,
});
export const commands = getDefinedCommands();
```

- [x] **Step 1: Migrate help, info, project, claude-sync controllers**
- [x] **Step 2: Migrate state, onboarding controllers**
- [x] **Step 3: Run tests after each batch**
- [x] **Step 4: Commit**

### Task 13: Migrate Standard CRUD Controllers (capa, raid, deliverables, timelog, lifecycle, requirements, resources)

These controllers have the most boilerplate. The engine eliminates flag parsing, project guards, and renderer wiring.

- [x] **Step 1: Migrate each controller following the defineCommand pattern**
- [x] **Step 2: Delete per-controller `flagStr()` and `noProjectResponse()` helpers**
- [x] **Step 3: Run tests**
- [x] **Step 4: Commit**

### Task 14: Migrate Domain-Heavy Controllers (build, health, events, devtools, reports, review)

These have complex handler logic that stays in the handler function. The engine only removes the boilerplate wrapping.

- [x] **Step 1: Migrate each controller**
- [x] **Step 2: For reports controller — use `wildcardPrefix: "report:"`**
- [x] **Step 3: Run tests**
- [x] **Step 4: Commit**

### Task 15: Migrate Edge Case Controllers (make, serve, ai-tools, scaffold, publish, plugins, capture, sitemap)

- **make**: Use `defineCommands()` batch registration with `COMPONENT_DEFINITION_IDS`
- **serve**: Async handler with `await import()`
- **ai-tools**: `ai:run` has 6 response types — handler returns union, renderer handles variants

- [x] **Step 1: Migrate each controller**
- [x] **Step 2: Run tests**
- [x] **Step 3: Commit**

### Task 16: Update dispatch.ts and command-registry.ts

**Files:**
- Modify: `src/infrastructure/dispatch.ts`
- Modify: `src/infrastructure/command-registry.ts`
- Modify: `src/main.ts`

- [x] **Step 1: Add `setWildcardPrefix` to CommandRegistry**

```typescript
// Add to CommandRegistry class:
private _wildcardPrefix: string | undefined;

setWildcardPrefix(prefix: string): void {
	this._wildcardPrefix = prefix;
}

get wildcardPrefix(): string | undefined {
	return this._wildcardPrefix;
}
```

- [x] **Step 2: Update `resolveWildcard` in dispatch.ts**

Before: `if (!command.startsWith("report:") || !wildcardHandler) return null;`
After: Read prefix from registry parameter.

- [x] **Step 3: Update main.ts — migrate inline completions command, update wildcard registration**

- [x] **Step 4: Run full check**

Run: `cd "01 - Projects/Flowti CLI" && npm test`
Expected: All pass

- [x] **Step 5: Commit**

```bash
git commit -m "refactor: update dispatch and registry for engine-driven wildcard routing"
```

### Task 17: Delete Legacy Code

**Files:**
- Modify: `src/infrastructure/request-response.ts` — delete `adapt()`, `createRequest()`, `handleResponse()`, `_sharedDeps`, `getSharedDeps()`, `ControllerAction` type
- Modify: `src/infrastructure/deps.ts` — delete `initializeDeps()`

- [x] **Step 1: Delete adapt and related dead code from request-response.ts**

Keep `dataResponse()`, `exitResponse()`, `okResponse()`, `CliRequest`, `CliResponse` — these are still used. Delete everything else.

- [x] **Step 2: Delete initializeDeps from deps.ts**

- [x] **Step 3: Update controller tests — remove vi.mock blocks for engine concerns, use direct handler calls**

- [x] **Step 4: Run full check**

Run: `cd "01 - Projects/Flowti CLI" && npm test`
Expected: All pass

- [x] **Step 5: Commit**

```bash
git commit -m "refactor: delete adapt(), initializeDeps(), and legacy request-response code"
```

---

## Chunk 5: Enforcement + Cleanup (Phase 5)

### Task 18: Un-skip Conformance Tests

**Files:**
- Modify: `tests/conformance/controller-conformance.test.ts`
- Modify: `tests/conformance/store-conformance.test.ts`

- [x] **Step 1: Implement controller conformance test**

```typescript
import { describe, it, expect } from "vitest";
import { commandRegistry } from "../../src/infrastructure/command-registry.js";

describe("controller conformance", () => {
	it("all registered commands use defineCommand descriptors", () => {
		for (const name of commandRegistry.keys()) {
			const meta = commandRegistry.get(name);
			expect(
				(meta?.handler as any).__descriptor,
				`${name} must use defineCommand()`,
			).toBeDefined();
		}
	});
});
```

- [x] **Step 2: Implement store conformance test**

```typescript
import { describe, it, expect } from "vitest";
import { capaStore } from "../../src/domain/capa/capa-store.js";
import { raidStore } from "../../src/domain/raid/raid-store.js";
// ... import all stores

describe("store conformance", () => {
	it("all stores use createStore engine", () => {
		const stores = [capaStore, raidStore /* ... */];
		for (const store of stores) {
			expect(store.__descriptor, "store must use createStore()").toBeDefined();
		}
	});
});
```

- [x] **Step 3: Run conformance tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/conformance/ --config configs/vitest.config.ts`
Expected: PASS

- [x] **Step 4: Commit**

```bash
git commit -m "feat: enable conformance tests for controller and store engines"
```

### Task 19: Add ESLint Enforcement Rules

**Files:**
- Modify: `configs/eslint.config.mjs`

- [x] **Step 1: Add no-legacy-request-response rule**

```javascript
// Add to eslint.config.mjs, scoped to src/controller/:
{
	files: ["src/controller/**/*.ts"],
	rules: {
		"no-restricted-imports": ["error", {
			paths: [{
				name: "../infrastructure/request-response.js",
				importNames: ["adapt", "createRequest", "ControllerAction"],
				message: "Use defineCommand() from command-engine.js instead.",
			}],
		}],
		"no-restricted-syntax": ["error",
			{ selector: "FunctionDeclaration[id.name='noProjectResponse']", message: "Use requires: 'project' in defineCommand() instead." },
			{ selector: "FunctionDeclaration[id.name='flagStr']", message: "Use flags spec in defineCommand() instead." },
		],
	},
},
```

- [x] **Step 2: Run lint**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/ --config configs/eslint.config.mjs`
Expected: No errors

- [x] **Step 3: Commit**

```bash
git commit -m "feat: add ESLint rules to enforce declarative controller patterns"
```

### Task 20: Final Cleanup

- [x] **Step 1: Delete unused mock-presets entries**
- [x] **Step 2: Remove any remaining dead imports**
- [x] **Step 3: Run full check**

Run: `cd "01 - Projects/Flowti CLI" && npm test`
Expected: All pass — lint, typecheck, tests, coverage ≥ 80%

- [x] **Step 4: Final commit**

```bash
git commit -m "chore: remove unused mock presets and dead imports"
```

---

## Definition of Done Checklist

- [x] All existing tests pass
- [x] Coverage ≥ 80% statements / 80% lines
- [x] ESLint passes with enforcement rules
- [x] TypeScript compiles with no errors
- [x] `adapt()` deleted — zero references
- [x] `ControllerAction` deleted — zero references
- [x] `initializeDeps()` deleted — zero references
- [x] Every controller uses `defineCommand()`
- [x] Every markdown store uses `createStore()`
- [x] All renderers use data-first `(data, log)` signature
- [x] `createTestDeps()` stubs all 11 `CliDeps` fields
- [x] No `flagStr()` or `noProjectResponse()` in controller files
- [x] Conformance tests pass
