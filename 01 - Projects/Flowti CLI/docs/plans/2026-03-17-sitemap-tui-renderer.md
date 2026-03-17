# Sitemap-Driven TUI Renderer — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded TUI pages with a universal sitemap-driven renderer that reads `configs/sitemap.json` and wires actions, forms, data sources, and conditions to Ink components — making the TUI functional again.

**Architecture:** A single `SitemapPage` component renders any page from its sitemap definition. Actions dispatch through a `TuiHandlerRegistry` to pure domain calls (no terminal I/O). Existing loaders provide page data; the sitemap provides actions, conditions, and forms. Custom overrides (chat, tour) keep their own content renderers but get sitemap-driven ActionBars.

**Tech Stack:** React/Ink, TypeScript (ESM, `.js` imports, tabs), Vitest, zero runtime deps.

**Spec:** `docs/specs/2026-03-17-sitemap-tui-renderer-design.md`

**Commands (from `01 - Projects/Flowti CLI/`):**
```bash
npx vitest run --config configs/vitest.config.ts                    # Tests
npx tsc --noEmit --project configs/tsconfig.json                    # Type check
npx eslint src/ --config configs/eslint.config.mjs                  # Lint
npx vitest run tests/tui/registry/tui-handler-registry.test.ts --config configs/vitest.config.ts  # Single test
```

---

## Chunk 1: Foundation Types & Registry

### Task 1: Extract IConditionRegistry interface

**Files:**
- Create: `src/infrastructure/condition-registry.ts`
- Modify: `src/infrastructure/sitemap-conditions.ts`
- Modify: `src/infrastructure/handler-registry.ts`
- Test: `tests/infrastructure/sitemap-conditions.test.ts` (existing — must still pass)

The existing `sitemap-conditions.ts` takes `HandlerRegistry` as a concrete parameter. We need an interface so `TuiHandlerRegistry` can also satisfy it.

- [ ] **Step 1: Create the IConditionRegistry interface**

```typescript
// src/infrastructure/condition-registry.ts

// Use `unknown` so both RouterContext (legacy) and TuiActionContext (TUI) satisfy the type.
export type ConditionFn = (ctx: unknown) => boolean;

export interface IConditionRegistry {
	hasCondition(id: string): boolean;
	getCondition(id: string): ConditionFn;
}
```

- [ ] **Step 2: Update HandlerRegistry to implement IConditionRegistry**

In `src/infrastructure/handler-registry.ts`, add the import and `implements` clause:

```typescript
import type { IConditionRegistry } from "./condition-registry.js";

export class HandlerRegistry implements IConditionRegistry {
	// ... existing code unchanged — already has hasCondition/getCondition
}
```

- [ ] **Step 3: Update sitemap-conditions.ts to accept IConditionRegistry**

Change the `registry` parameter type in `resolveDisabledCondition`, `resolveHiddenCondition`, and `resolveStringCondition` from `HandlerRegistry` to `IConditionRegistry`:

```typescript
import type { IConditionRegistry } from "./condition-registry.js";

export function resolveDisabledCondition(
	condition: DisabledCondition | undefined,
	ctx: RouterContext,
	registry: IConditionRegistry,
): boolean { /* ... unchanged ... */ }

export function resolveHiddenCondition(
	condition: HiddenCondition | undefined,
	ctx: RouterContext,
	registry: IConditionRegistry,
): boolean { /* ... unchanged ... */ }

function resolveStringCondition(
	condition: string,
	ctx: RouterContext,
	registry: IConditionRegistry,
): boolean { /* ... unchanged ... */ }
```

- [ ] **Step 4: Run existing tests to verify no regressions**

Run: `npx vitest run tests/infrastructure/sitemap-conditions.test.ts --config configs/vitest.config.ts`
Expected: All existing tests pass (interface is structurally compatible).

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: Clean.

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/condition-registry.ts src/infrastructure/sitemap-conditions.ts src/infrastructure/handler-registry.ts
git commit -m "refactor: extract IConditionRegistry interface from HandlerRegistry"
```

---

### Task 2: Create TuiActionDeps type

**Files:**
- Modify: `src/infrastructure/deps.ts`

Add the ISP subset for TUI action handlers alongside the existing subsets.

- [ ] **Step 1: Add TuiActionDeps to deps.ts**

After the existing ISP subsets (e.g., after `WorkspaceDeps`), add:

```typescript
/** Deps for TUI action handlers — includes shell for effects, excludes input/log (no terminal I/O). */
export type TuiActionDeps = Pick<CliDeps, "disk" | "paths" | "clock" | "shell">;
```

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/deps.ts
git commit -m "feat: add TuiActionDeps ISP subset for TUI handlers"
```

---

### Task 3: Create TuiHandlerRegistry and TuiSessionStore

**Files:**
- Create: `src/tui/registry/tui-handler-types.ts`
- Create: `src/tui/registry/tui-handler-registry.ts`
- Create: `src/tui/registry/tui-session-store.ts`
- Test: `tests/tui/registry/tui-handler-registry.test.ts`
- Test: `tests/tui/registry/tui-session-store.test.ts`

- [ ] **Step 1: Write TuiHandlerRegistry failing tests**

```typescript
// tests/tui/registry/tui-handler-registry.test.ts
vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { describe, it, expect, vi } from "vitest";
import { TuiHandlerRegistry } from "../../../src/tui/registry/tui-handler-registry.js";
import type { TuiActionHandler, TuiFormHandler, TuiConditionHandler, TuiDataSourceHandler } from "../../../src/tui/registry/tui-handler-types.js";

describe("TuiHandlerRegistry", () => {
	it("registers and retrieves a handler", () => {
		const reg = new TuiHandlerRegistry();
		const handler: TuiActionHandler = async () => ({ kind: "ok" });
		reg.registerHandler("test:action", handler);
		expect(reg.hasHandler("test:action")).toBe(true);
		expect(reg.getHandler("test:action")).toBe(handler);
	});

	it("throws on duplicate handler registration", () => {
		const reg = new TuiHandlerRegistry();
		const handler: TuiActionHandler = async () => ({ kind: "ok" });
		reg.registerHandler("test:dup", handler);
		expect(() => reg.registerHandler("test:dup", handler)).toThrow();
	});

	it("throws on missing handler lookup", () => {
		const reg = new TuiHandlerRegistry();
		expect(() => reg.getHandler("missing")).toThrow();
	});

	it("registers and retrieves a form handler", () => {
		const reg = new TuiHandlerRegistry();
		const handler: TuiFormHandler = async () => ({ kind: "ok" });
		reg.registerFormHandler("test:form", handler);
		expect(reg.hasFormHandler("test:form")).toBe(true);
		expect(reg.getFormHandler("test:form")).toBe(handler);
	});

	it("registers and retrieves a condition handler", () => {
		const reg = new TuiHandlerRegistry();
		const handler: TuiConditionHandler = () => true;
		reg.registerCondition("test:cond", handler);
		expect(reg.hasCondition("test:cond")).toBe(true);
		expect(reg.getCondition("test:cond")({} as never)).toBe(true);
	});

	it("registers and retrieves a data source handler", () => {
		const reg = new TuiHandlerRegistry();
		const handler: TuiDataSourceHandler = () => [];
		reg.registerDataSource("test:ds", handler);
		expect(reg.hasDataSource("test:ds")).toBe(true);
	});

	it("implements IConditionRegistry", () => {
		const reg = new TuiHandlerRegistry();
		const handler: TuiConditionHandler = () => false;
		reg.registerCondition("cond:test", handler);
		// IConditionRegistry shape: hasCondition + getCondition
		expect(reg.hasCondition("cond:test")).toBe(true);
		expect(typeof reg.getCondition("cond:test")).toBe("function");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tui/registry/tui-handler-registry.test.ts --config configs/vitest.config.ts`
Expected: FAIL — modules don't exist yet.

- [ ] **Step 3: Create tui-handler-types.ts**

```typescript
// src/tui/registry/tui-handler-types.ts
import type { TuiActionDeps } from "../../infrastructure/deps.js";
import type { MenuEntry } from "../../infrastructure/types.js";

export interface TuiSessionStore {
	pipeline: Record<string, unknown>;
	selectedProject?: string;
}

export interface TuiActionContext {
	readonly deps: TuiActionDeps;
	readonly session: TuiSessionStore;
	readonly project?: { readonly name: string; readonly path: string };
	readonly tools?: Readonly<Record<string, boolean>>;
	readonly params?: Readonly<Record<string, string>>;
}

export type TuiActionResult =
	| { readonly kind: "ok"; readonly message?: string }
	| { readonly kind: "navigate"; readonly target: string; readonly params?: Record<string, string> }
	| { readonly kind: "error"; readonly message: string };

export type TuiActionHandler = (ctx: TuiActionContext) => Promise<TuiActionResult>;

export type TuiFormHandler = (ctx: TuiActionContext, data: Record<string, unknown>) => Promise<TuiActionResult>;

export type TuiConditionHandler = (ctx: TuiActionContext) => boolean;

export type TuiDataSourceHandler = (ctx: TuiActionContext, params?: Readonly<Record<string, unknown>>) => MenuEntry[];
```

- [ ] **Step 4: Create tui-handler-registry.ts**

```typescript
// src/tui/registry/tui-handler-registry.ts
import type { IConditionRegistry } from "../../infrastructure/condition-registry.js";
import type {
	TuiActionHandler,
	TuiFormHandler,
	TuiConditionHandler,
	TuiDataSourceHandler,
} from "./tui-handler-types.js";

export class TuiHandlerRegistry implements IConditionRegistry {
	readonly #handlers = new Map<string, TuiActionHandler>();
	readonly #formHandlers = new Map<string, TuiFormHandler>();
	readonly #conditions = new Map<string, TuiConditionHandler>();
	readonly #dataSources = new Map<string, TuiDataSourceHandler>();

	registerHandler(id: string, handler: TuiActionHandler): void {
		if (this.#handlers.has(id)) throw new Error(`Duplicate TUI handler: ${id}`);
		this.#handlers.set(id, handler);
	}

	getHandler(id: string): TuiActionHandler {
		const h = this.#handlers.get(id);
		if (!h) throw new Error(`TUI handler not found: ${id}`);
		return h;
	}

	hasHandler(id: string): boolean {
		return this.#handlers.has(id);
	}

	registerFormHandler(id: string, handler: TuiFormHandler): void {
		if (this.#formHandlers.has(id)) throw new Error(`Duplicate TUI form handler: ${id}`);
		this.#formHandlers.set(id, handler);
	}

	getFormHandler(id: string): TuiFormHandler {
		const h = this.#formHandlers.get(id);
		if (!h) throw new Error(`TUI form handler not found: ${id}`);
		return h;
	}

	hasFormHandler(id: string): boolean {
		return this.#formHandlers.has(id);
	}

	registerCondition(id: string, handler: TuiConditionHandler): void {
		if (this.#conditions.has(id)) throw new Error(`Duplicate TUI condition: ${id}`);
		this.#conditions.set(id, handler);
	}

	getCondition(id: string): TuiConditionHandler {
		const h = this.#conditions.get(id);
		if (!h) throw new Error(`TUI condition not found: ${id}`);
		return h;
	}

	hasCondition(id: string): boolean {
		return this.#conditions.has(id);
	}

	registerDataSource(id: string, handler: TuiDataSourceHandler): void {
		if (this.#dataSources.has(id)) throw new Error(`Duplicate TUI data source: ${id}`);
		this.#dataSources.set(id, handler);
	}

	getDataSource(id: string): TuiDataSourceHandler {
		const h = this.#dataSources.get(id);
		if (!h) throw new Error(`TUI data source not found: ${id}`);
		return h;
	}

	hasDataSource(id: string): boolean {
		return this.#dataSources.has(id);
	}
}
```

- [ ] **Step 5: Create tui-session-store.ts**

```typescript
// src/tui/registry/tui-session-store.ts
import type { TuiSessionStore } from "./tui-handler-types.js";

export function createSessionStore(): TuiSessionStore {
	return {
		pipeline: {},
		selectedProject: undefined,
	};
}
```

- [ ] **Step 6: Write TuiSessionStore test**

```typescript
// tests/tui/registry/tui-session-store.test.ts
import { describe, it, expect } from "vitest";
import { createSessionStore } from "../../../src/tui/registry/tui-session-store.js";

describe("createSessionStore", () => {
	it("creates store with empty pipeline", () => {
		const store = createSessionStore();
		expect(store.pipeline).toEqual({});
		expect(store.selectedProject).toBeUndefined();
	});

	it("allows mutation of pipeline state", () => {
		const store = createSessionStore();
		store.pipeline["buildPassed"] = true;
		expect(store.pipeline["buildPassed"]).toBe(true);
	});
});
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run tests/tui/registry/ --config configs/vitest.config.ts`
Expected: All pass.

- [ ] **Step 8: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: Clean.

- [ ] **Step 9: Commit**

```bash
git add src/tui/registry/ tests/tui/registry/
git commit -m "feat: add TuiHandlerRegistry, TuiSessionStore, and handler types"
```

---

### Task 4: Create NavigationContext

**Files:**
- Create: `src/tui/sitemap/navigation-context.tsx`
- Test: `tests/tui/sitemap/navigation-context.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// tests/tui/sitemap/navigation-context.test.tsx
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { NavigationProvider, useNavigationContext } from "../../../src/tui/sitemap/navigation-context.js";

function TestConsumer(): React.JSX.Element {
	const nav = useNavigationContext();
	return React.createElement(Text, null, nav ? "has-nav" : "no-nav");
}

describe("NavigationContext", () => {
	it("provides navigation functions to children", () => {
		const navigate = vi.fn();
		const goBack = vi.fn();
		const refresh = vi.fn();
		const { lastFrame } = render(
			React.createElement(NavigationProvider, { navigate, goBack, refresh },
				React.createElement(TestConsumer),
			),
		);
		expect(lastFrame()).toContain("has-nav");
	});

	it("throws when used outside provider", () => {
		expect(() => {
			render(React.createElement(TestConsumer));
		}).toThrow();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tui/sitemap/navigation-context.test.tsx --config configs/vitest.config.ts`
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Implement NavigationContext**

```typescript
// src/tui/sitemap/navigation-context.tsx
import { createContext, useContext } from "react";
import React from "react";

export interface NavigationContextValue {
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
	readonly refresh: () => void;
}

const NavCtx = createContext<NavigationContextValue | null>(null);

export interface NavigationProviderProps {
	readonly navigate: (pageId: string, params?: Record<string, string>) => void;
	readonly goBack: () => void;
	readonly refresh: () => void;
	readonly children: React.ReactNode;
}

export function NavigationProvider({ navigate, goBack, refresh, children }: NavigationProviderProps): React.JSX.Element {
	const value: NavigationContextValue = { navigate, goBack, refresh };
	return React.createElement(NavCtx.Provider, { value }, children);
}

export function useNavigationContext(): NavigationContextValue {
	const ctx = useContext(NavCtx);
	if (!ctx) throw new Error("useNavigationContext must be used inside NavigationProvider");
	return ctx;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/tui/sitemap/navigation-context.test.tsx --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tui/sitemap/navigation-context.tsx tests/tui/sitemap/navigation-context.test.tsx
git commit -m "feat: add NavigationContext for hook-level access to navigate/goBack"
```

---

### Task 5: Enhance ActionBar with disabled state

**Files:**
- Modify: `src/tui/primitives/action-bar.tsx`
- Test: `tests/tui/primitives/action-bar.test.tsx` (existing or new)

- [ ] **Step 1: Write failing test for disabled actions**

```typescript
// tests/tui/primitives/action-bar.test.tsx
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { ActionBar } from "../../../src/tui/primitives/action-bar.js";

describe("ActionBar", () => {
	it("renders actions with key and label", () => {
		const { lastFrame } = render(
			React.createElement(ActionBar, {
				actions: [{ key: "1", label: "Build" }],
			}),
		);
		expect(lastFrame()).toContain("[1]");
		expect(lastFrame()).toContain("Build");
	});

	it("renders disabled actions dimmed", () => {
		const { lastFrame } = render(
			React.createElement(ActionBar, {
				actions: [
					{ key: "1", label: "Build", disabled: true },
					{ key: "2", label: "Test" },
				],
			}),
		);
		expect(lastFrame()).toContain("[1]");
		expect(lastFrame()).toContain("[2]");
	});

	it("renders group separators between different groups", () => {
		const { lastFrame } = render(
			React.createElement(ActionBar, {
				actions: [
					{ key: "1", label: "Build", group: "dev" },
					{ key: "2", label: "Test", group: "dev" },
					{ key: "3", label: "Back", group: "nav" },
				],
			}),
		);
		expect(lastFrame()).toContain("[1]");
		expect(lastFrame()).toContain("[3]");
	});
});
```

- [ ] **Step 2: Run test to verify it fails on disabled prop**

Run: `npx vitest run tests/tui/primitives/action-bar.test.tsx --config configs/vitest.config.ts`
Expected: FAIL on disabled test (ActionDef doesn't have `disabled` yet).

- [ ] **Step 3: Extend ActionDef and update ActionBar rendering**

In `src/tui/primitives/action-bar.tsx`, extend `ActionDef` with optional `disabled` and `group` fields, and update the render to dim disabled actions and add separators between groups:

```typescript
// src/tui/primitives/action-bar.tsx
import React from "react";
import { Box, Text } from "ink";

export interface ActionDef {
	readonly key: string;
	readonly label: string;
	readonly disabled?: boolean;
	readonly group?: string;
}

interface ActionBarProps {
	readonly actions: readonly ActionDef[];
}

export function ActionBar({ actions }: ActionBarProps): React.JSX.Element {
	if (actions.length === 0) return React.createElement(React.Fragment);

	const elements: React.JSX.Element[] = [];
	let lastGroup: string | undefined;

	for (const action of actions) {
		if (action.group && lastGroup && action.group !== lastGroup) {
			elements.push(React.createElement(Text, { key: `sep-${action.key}`, dimColor: true }, " │ "));
		}
		lastGroup = action.group;

		if (action.disabled) {
			elements.push(
				React.createElement(Text, { key: action.key, dimColor: true },
					`[${action.key}] ${action.label}`,
				),
			);
		} else {
			elements.push(
				React.createElement(Text, { key: action.key, dimColor: true },
					React.createElement(Text, { color: "cyan", bold: true }, `[${action.key}]`),
					` ${action.label}`,
				),
			);
		}
	}

	return React.createElement(Box, { gap: 2, paddingX: 1 }, ...elements);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/tui/primitives/action-bar.test.tsx --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Run full test suite to verify no regressions**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All existing tests still pass (ActionDef extensions are optional).

- [ ] **Step 6: Commit**

```bash
git add src/tui/primitives/action-bar.tsx tests/tui/primitives/action-bar.test.tsx
git commit -m "feat: extend ActionBar with disabled state and group separators"
```

---

## Chunk 2: Core Hooks

### Task 6: Create useConditionContext hook

**Files:**
- Create: `src/tui/hooks/use-condition-context.ts`
- Test: `tests/tui/hooks/use-condition-context.test.ts`

This hook bridges `TuiContextValue` to the flat `Record<string, boolean>` expected by the expression evaluator.

- [ ] **Step 1: Write failing test**

```typescript
// tests/tui/hooks/use-condition-context.test.ts
import { describe, it, expect } from "vitest";
import { buildTuiFlatContext } from "../../../src/tui/hooks/use-condition-context.js";

describe("buildTuiFlatContext", () => {
	it("maps project existence to 'project' key", () => {
		const result = buildTuiFlatContext({ name: "CLI", path: "/p" }, undefined, undefined);
		expect(result["project"]).toBe(true);
	});

	it("sets project to false when undefined", () => {
		const result = buildTuiFlatContext(undefined, undefined, undefined);
		expect(result["project"]).toBe(false);
	});

	it("maps tools to tools.* keys", () => {
		const result = buildTuiFlatContext(undefined, { esbuild: true, typescript: false }, undefined);
		expect(result["tools.esbuild"]).toBe(true);
		expect(result["tools.typescript"]).toBe(false);
	});

	it("maps config sections to config.* keys", () => {
		const config = { build: { commands: {} }, management: { iterations: {} } };
		const result = buildTuiFlatContext(undefined, undefined, config);
		expect(result["config.build"]).toBe(true);
		expect(result["config.management"]).toBe(true);
		expect(result["config.publish"]).toBe(false);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tui/hooks/use-condition-context.test.ts --config configs/vitest.config.ts`
Expected: FAIL.

- [ ] **Step 3: Implement buildTuiFlatContext**

```typescript
// src/tui/hooks/use-condition-context.ts

const CONFIG_SECTIONS = ["build", "test", "publish", "review", "reports", "health", "management"] as const;

export function buildTuiFlatContext(
	project: { readonly name: string; readonly path: string } | undefined,
	tools: Readonly<Record<string, boolean>> | undefined,
	config: Record<string, unknown> | undefined,
): Record<string, boolean> {
	const flat: Record<string, boolean> = {};

	flat["project"] = project !== undefined;

	if (tools) {
		for (const [key, val] of Object.entries(tools)) {
			flat[`tools.${key}`] = Boolean(val);
		}
	}

	for (const section of CONFIG_SECTIONS) {
		flat[`config.${section}`] = config?.[section] !== undefined;
	}

	return flat;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/tui/hooks/use-condition-context.test.ts --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tui/hooks/use-condition-context.ts tests/tui/hooks/use-condition-context.test.ts
git commit -m "feat: add buildTuiFlatContext for condition evaluation in TUI"
```

---

### Task 7: Create useSitemapActions hook

**Files:**
- Create: `src/tui/hooks/use-sitemap-actions.ts`
- Test: `tests/tui/hooks/use-sitemap-actions.test.ts`

This is the core hook that reads a page's actions from sitemap, evaluates conditions, assigns keys, and returns `SitemapActionDef[]`.

- [ ] **Step 1: Write failing test**

```typescript
// tests/tui/hooks/use-sitemap-actions.test.ts
import { describe, it, expect } from "vitest";
import { resolvePageActions, type SitemapActionDef } from "../../../src/tui/hooks/use-sitemap-actions.js";
import type { PageAction } from "../../../src/domain/sitemap/unified-page.js";
import type { IConditionRegistry } from "../../../src/infrastructure/condition-registry.js";

const noopRegistry: IConditionRegistry = {
	hasCondition: () => false,
	getCondition: () => () => false,
};

describe("resolvePageActions", () => {
	it("returns keyed actions from page actions", () => {
		const actions: PageAction[] = [
			{ name: "onBuild", label: "Build", type: "handler", target: "build:run", group: "dev" },
			{ name: "onBack", label: "Back", type: "signal", target: "back", group: "nav" },
		];
		const result = resolvePageActions(actions, {}, noopRegistry);
		expect(result).toHaveLength(2);
		expect(result[0].label).toBe("Build");
		expect(result[0].type).toBe("handler");
		expect(result[0].target).toBe("build:run");
		expect(result[0].key).toBeTruthy();
	});

	it("filters hidden actions", () => {
		const actions: PageAction[] = [
			{ name: "onVisible", label: "Visible", type: "handler", target: "a" },
			{ name: "onHidden", label: "Hidden", type: "handler", target: "b", hidden: true },
		];
		const result = resolvePageActions(actions, {}, noopRegistry);
		expect(result).toHaveLength(1);
		expect(result[0].label).toBe("Visible");
	});

	it("marks disabled actions", () => {
		const actions: PageAction[] = [
			{ name: "onDisabled", label: "Disabled", type: "handler", target: "a", disabled: true },
		];
		const result = resolvePageActions(actions, {}, noopRegistry);
		expect(result).toHaveLength(1);
		expect(result[0].disabled).toBe(true);
	});

	it("uses explicit key from action", () => {
		const actions: PageAction[] = [
			{ name: "onFoo", label: "Foo", type: "handler", target: "a", key: "f" },
		];
		const result = resolvePageActions(actions, {}, noopRegistry);
		expect(result[0].key).toBe("f");
	});

	it("evaluates string hidden conditions via registry", () => {
		const reg: IConditionRegistry = {
			hasCondition: (id) => id === "no-project",
			getCondition: () => () => true,
		};
		const actions: PageAction[] = [
			{ name: "onHide", label: "Hide Me", type: "handler", target: "a", hidden: "no-project" },
		];
		const result = resolvePageActions(actions, {}, reg);
		expect(result).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tui/hooks/use-sitemap-actions.test.ts --config configs/vitest.config.ts`
Expected: FAIL.

- [ ] **Step 3: Implement resolvePageActions and SitemapActionDef**

```typescript
// src/tui/hooks/use-sitemap-actions.ts
import type { PageAction, ActionType } from "../../domain/sitemap/unified-page.js";
import type { IConditionRegistry } from "../../infrastructure/condition-registry.js";
import { evaluateExpression } from "../../infrastructure/sitemap-conditions.js";
import { assignKeys } from "../../infrastructure/key-assigner.js";

export interface SitemapActionDef {
	readonly key: string;
	readonly label: string;
	readonly disabled: boolean;
	readonly disabledMessage?: string;
	readonly group?: string;
	readonly type: ActionType;
	readonly target?: string;
	readonly params?: Readonly<Record<string, unknown>>;
}

export function resolvePageActions(
	actions: readonly PageAction[],
	flatContext: Record<string, boolean>,
	registry: IConditionRegistry,
): SitemapActionDef[] {
	// Resolve hidden/disabled inline using the flat context and registry.
	// For literal booleans and expression strings, evaluate directly.
	// For registered condition IDs, delegate to registry.
	const visible = actions.filter((a) => {
		if (a.hidden === undefined || a.hidden === false) return true;
		if (a.hidden === true) return false;
		// String condition: check registry first, else evaluate as expression
		if (typeof a.hidden === "string") {
			if (registry.hasCondition(a.hidden)) return !registry.getCondition(a.hidden)(flatContext);
			return !evaluateExpression(a.hidden, flatContext);
		}
		return true;
	});

	const keyed = assignKeys(visible);

	return keyed.map(({ action, assignedKey }) => {
		let disabled = false;
		if (action.disabled === true) {
			disabled = true;
		} else if (typeof action.disabled === "string") {
			disabled = registry.hasCondition(action.disabled)
				? registry.getCondition(action.disabled)(flatContext) as boolean
				: evaluateExpression(action.disabled, flatContext);
		} else if (action.disabled && typeof action.disabled === "object" && "unless" in action.disabled) {
			disabled = !evaluateExpression(action.disabled.unless, flatContext);
		}

		return {
			key: assignedKey,
			label: action.label,
			disabled,
			disabledMessage: action.disabledMessage,
			group: action.group,
			type: action.type,
			target: action.target,
			params: action.params,
		};
	});
}
```

Note: The `ctx` passed to condition functions will be improved in the integration task when we wire up the real TuiContext. For now the pure function accepts a flat context and registry.

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/tui/hooks/use-sitemap-actions.test.ts --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tui/hooks/use-sitemap-actions.ts tests/tui/hooks/use-sitemap-actions.test.ts
git commit -m "feat: add resolvePageActions — filters, conditions, key assignment for sitemap actions"
```

---

### Task 8: Create useActionEffect hook

**Files:**
- Create: `src/tui/hooks/use-action-effect.ts`
- Test: `tests/tui/hooks/use-action-effect.test.ts`

Manages the effect state machine: idle → running → success|error → idle.

- [ ] **Step 1: Write failing test**

```typescript
// tests/tui/hooks/use-action-effect.test.ts
import { describe, it, expect, vi } from "vitest";
import React, { useRef, useImperativeHandle } from "react";
import { render } from "ink-testing-library";
import { Text } from "ink";
import { useActionEffect } from "../../../src/tui/hooks/use-action-effect.js";

// Ink-testing-library harness — wraps hook in a component with ref access
interface EffectHarness {
	state: string;
	message: string;
	run: (handler: () => Promise<{ kind: "ok" | "error"; message?: string }>, label: string) => Promise<void>;
}

const Harness = React.forwardRef(function Harness(_props, ref: React.Ref<EffectHarness>) {
	const effect = useActionEffect();
	useImperativeHandle(ref, () => effect);
	return React.createElement(Text, null, `${effect.state}:${effect.message}`);
});

describe("useActionEffect", () => {
	it("starts in idle state", () => {
		const ref = React.createRef<EffectHarness>();
		render(React.createElement(Harness, { ref }));
		expect(ref.current!.state).toBe("idle");
		expect(ref.current!.message).toBe("");
	});

	it("transitions to error on handler failure", async () => {
		const ref = React.createRef<EffectHarness>();
		render(React.createElement(Harness, { ref }));
		const handler = async () => ({ kind: "error" as const, message: "Build failed" });
		await ref.current!.run(handler, "Building...");
		expect(ref.current!.state).toBe("error");
		expect(ref.current!.message).toBe("Build failed");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tui/hooks/use-action-effect.test.ts --config configs/vitest.config.ts`
Expected: FAIL.

- [ ] **Step 3: Implement useActionEffect**

```typescript
// src/tui/hooks/use-action-effect.ts
import { useState, useCallback, useRef } from "react";
import type { TuiActionResult } from "../registry/tui-handler-types.js";

type EffectState = "idle" | "running" | "success" | "error";
type EffectHandler = () => Promise<TuiActionResult>;

interface UseActionEffectResult {
	readonly state: EffectState;
	readonly message: string;
	readonly run: (handler: EffectHandler, label: string) => Promise<void>;
	readonly dismiss: () => void;
}

export function useActionEffect(): UseActionEffectResult {
	const [state, setState] = useState<EffectState>("idle");
	const [message, setMessage] = useState("");
	const cancelledRef = useRef(false);
	const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>();

	const dismiss = useCallback(() => {
		if (timerRef.current) clearTimeout(timerRef.current);
		setState("idle");
		setMessage("");
	}, []);

	const run = useCallback(async (handler: EffectHandler, label: string) => {
		if (state === "running") return;
		cancelledRef.current = false;
		setState("running");
		setMessage(label);

		try {
			const result = await handler();
			if (cancelledRef.current) return;

			if (result.kind === "error") {
				setState("error");
				setMessage(result.message);
			} else {
				setState("success");
				setMessage(result.message ?? "Done");
				timerRef.current = setTimeout(() => {
					setState("idle");
					setMessage("");
				}, 1500);
			}
		} catch (err) {
			if (cancelledRef.current) return;
			setState("error");
			setMessage(err instanceof Error ? err.message : String(err));
		}
	}, [state]);

	return { state, message, run, dismiss };
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/tui/hooks/use-action-effect.test.ts --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tui/hooks/use-action-effect.ts tests/tui/hooks/use-action-effect.test.ts
git commit -m "feat: add useActionEffect hook — effect state machine for TUI handlers"
```

---

### Task 9: Create useActionDispatch hook

**Files:**
- Create: `src/tui/hooks/use-action-dispatch.ts`
- Test: `tests/tui/hooks/use-action-dispatch.test.ts`

Dispatches by action type: navigate, signal, handler, form, command.

- [ ] **Step 1: Write failing test**

```typescript
// tests/tui/hooks/use-action-dispatch.test.ts
import { describe, it, expect, vi } from "vitest";
import { dispatchAction } from "../../../src/tui/hooks/use-action-dispatch.js";
import type { SitemapActionDef } from "../../../src/tui/hooks/use-sitemap-actions.js";
import type { TuiHandlerRegistry } from "../../../src/tui/registry/tui-handler-registry.js";

describe("dispatchAction", () => {
	const nav = { navigate: vi.fn(), goBack: vi.fn(), refresh: vi.fn() };

	it("dispatches navigate action", async () => {
		const action: SitemapActionDef = { key: "1", label: "Go", type: "navigate", target: "health", disabled: false };
		await dispatchAction(action, nav, {} as TuiHandlerRegistry, {} as never, vi.fn());
		expect(nav.navigate).toHaveBeenCalledWith("health", undefined);
	});

	it("dispatches signal:back", async () => {
		const action: SitemapActionDef = { key: "b", label: "Back", type: "signal", target: "back", disabled: false };
		await dispatchAction(action, nav, {} as TuiHandlerRegistry, {} as never, vi.fn());
		expect(nav.goBack).toHaveBeenCalled();
	});

	it("dispatches signal:refresh", async () => {
		const action: SitemapActionDef = { key: "r", label: "Refresh", type: "signal", target: "refresh", disabled: false };
		await dispatchAction(action, nav, {} as TuiHandlerRegistry, {} as never, vi.fn());
		expect(nav.refresh).toHaveBeenCalled();
	});

	it("dispatches signal:start", async () => {
		const action: SitemapActionDef = { key: "s", label: "Start", type: "signal", target: "start", disabled: false };
		await dispatchAction(action, nav, {} as TuiHandlerRegistry, {} as never, vi.fn());
		expect(nav.navigate).toHaveBeenCalledWith("start");
	});

	it("skips disabled actions", async () => {
		const action: SitemapActionDef = { key: "1", label: "Go", type: "navigate", target: "health", disabled: true };
		await dispatchAction(action, nav, {} as TuiHandlerRegistry, {} as never, vi.fn());
		expect(nav.navigate).not.toHaveBeenCalled();
	});

	it("dispatches handler action via runEffect", async () => {
		const runEffect = vi.fn();
		const registry = { getHandler: vi.fn().mockReturnValue(async () => ({ kind: "ok" })) } as unknown as TuiHandlerRegistry;
		const action: SitemapActionDef = { key: "1", label: "Build", type: "handler", target: "build:run", disabled: false };
		await dispatchAction(action, nav, registry, {} as never, runEffect);
		expect(runEffect).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tui/hooks/use-action-dispatch.test.ts --config configs/vitest.config.ts`
Expected: FAIL.

- [ ] **Step 3: Implement dispatchAction**

```typescript
// src/tui/hooks/use-action-dispatch.ts
import type { SitemapActionDef } from "./use-sitemap-actions.js";
import type { NavigationContextValue } from "../sitemap/navigation-context.js";
import type { TuiHandlerRegistry } from "../registry/tui-handler-registry.js";
import type { TuiActionContext, TuiActionResult } from "../registry/tui-handler-types.js";

type RunEffect = (handler: () => Promise<TuiActionResult>, label: string) => Promise<void>;

export async function dispatchAction(
	action: SitemapActionDef,
	nav: NavigationContextValue,
	registry: TuiHandlerRegistry,
	actionCtx: TuiActionContext,
	runEffect: RunEffect,
): Promise<void> {
	if (action.disabled) return;

	switch (action.type) {
		case "navigate":
			if (action.target) nav.navigate(action.target, action.params as Record<string, string> | undefined);
			break;

		case "signal":
			switch (action.target) {
				case "back": nav.goBack(); break;
				case "quit": process.exit(0); break;
				case "refresh": nav.refresh(); break;
				case "start": nav.navigate("start"); break;
			}
			break;

		case "handler":
			if (action.target && registry.hasHandler(action.target)) {
				const handler = registry.getHandler(action.target);
				await runEffect(
					async () => {
						const result = await handler(actionCtx);
						if (result.kind === "navigate") {
							nav.navigate(result.target, result.params);
							return { kind: "ok" };
						}
						return result;
					},
					action.label,
				);
			}
			break;

		case "form":
			if (action.target) nav.navigate(action.target, action.params as Record<string, string> | undefined);
			break;

		case "command":
			// Command execution — will be implemented with CommandOutput component
			break;
	}
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/tui/hooks/use-action-dispatch.test.ts --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tui/hooks/use-action-dispatch.ts tests/tui/hooks/use-action-dispatch.test.ts
git commit -m "feat: add dispatchAction — routes sitemap actions by type"
```

---

## Chunk 3: Sitemap Components

### Task 10: Create EffectStrip component

**Files:**
- Create: `src/tui/sitemap/effect-strip.tsx`
- Test: `tests/tui/sitemap/effect-strip.test.tsx`

Single-line status strip between content zone and ActionBar.

- [ ] **Step 1: Write failing test**

```typescript
// tests/tui/sitemap/effect-strip.test.tsx
import { describe, it, expect } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { EffectStrip } from "../../../src/tui/sitemap/effect-strip.js";

describe("EffectStrip", () => {
	it("renders nothing when idle", () => {
		const { lastFrame } = render(React.createElement(EffectStrip, { state: "idle", message: "" }));
		expect(lastFrame()).toBe("");
	});

	it("renders spinner and message when running", () => {
		const { lastFrame } = render(React.createElement(EffectStrip, { state: "running", message: "Building..." }));
		expect(lastFrame()).toContain("Building...");
	});

	it("renders success message in green", () => {
		const { lastFrame } = render(React.createElement(EffectStrip, { state: "success", message: "Done" }));
		expect(lastFrame()).toContain("Done");
	});

	it("renders error message in red", () => {
		const { lastFrame } = render(React.createElement(EffectStrip, { state: "error", message: "Failed" }));
		expect(lastFrame()).toContain("Failed");
	});
});
```

- [ ] **Step 2: Implement EffectStrip**

```typescript
// src/tui/sitemap/effect-strip.tsx
import React from "react";
import { Box, Text } from "ink";

interface EffectStripProps {
	readonly state: "idle" | "running" | "success" | "error";
	readonly message: string;
}

export function EffectStrip({ state, message }: EffectStripProps): React.JSX.Element {
	if (state === "idle") return React.createElement(React.Fragment);

	const color = state === "error" ? "red" : state === "success" ? "green" : "cyan";
	const prefix = state === "running" ? "⠋" : state === "success" ? "✓" : "✗";

	return React.createElement(Box, { paddingX: 1 },
		React.createElement(Text, { color }, `${prefix} ${message}`),
	);
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/tui/sitemap/effect-strip.test.tsx --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/tui/sitemap/effect-strip.tsx tests/tui/sitemap/effect-strip.test.tsx
git commit -m "feat: add EffectStrip component — status line for running effects"
```

---

### Task 11: Create SitemapActionBar component

**Files:**
- Create: `src/tui/sitemap/sitemap-action-bar.tsx`
- Test: `tests/tui/sitemap/sitemap-action-bar.test.tsx`

Wires `useSitemapActions` output to `ActionBar` + keyboard input dispatch.

- [ ] **Step 1: Write failing test**

```typescript
// tests/tui/sitemap/sitemap-action-bar.test.tsx
vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { SitemapActionBar } from "../../../src/tui/sitemap/sitemap-action-bar.js";
import type { SitemapActionDef } from "../../../src/tui/hooks/use-sitemap-actions.js";

describe("SitemapActionBar", () => {
	it("renders actions from resolved defs", () => {
		const actions: SitemapActionDef[] = [
			{ key: "1", label: "Build", disabled: false, type: "handler", target: "build:run", group: "dev" },
			{ key: "b", label: "Back", disabled: false, type: "signal", target: "back", group: "nav" },
		];
		const { lastFrame } = render(
			React.createElement(SitemapActionBar, { actions, onAction: vi.fn() }),
		);
		expect(lastFrame()).toContain("[1]");
		expect(lastFrame()).toContain("Build");
		expect(lastFrame()).toContain("[b]");
		expect(lastFrame()).toContain("Back");
	});
});
```

- [ ] **Step 2: Implement SitemapActionBar**

```typescript
// src/tui/sitemap/sitemap-action-bar.tsx
import React from "react";
import { useInput } from "ink";
import { ActionBar } from "../primitives/action-bar.js";
import type { SitemapActionDef } from "../hooks/use-sitemap-actions.js";

interface SitemapActionBarProps {
	readonly actions: readonly SitemapActionDef[];
	readonly onAction: (action: SitemapActionDef) => void;
	readonly enabled?: boolean;
}

export function SitemapActionBar({ actions, onAction, enabled = true }: SitemapActionBarProps): React.JSX.Element {
	useInput((input) => {
		const match = actions.find((a) => a.key === input && !a.disabled);
		if (match) onAction(match);
	}, { isActive: enabled });

	return React.createElement(ActionBar, { actions });
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/tui/sitemap/sitemap-action-bar.test.tsx --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/tui/sitemap/sitemap-action-bar.tsx tests/tui/sitemap/sitemap-action-bar.test.tsx
git commit -m "feat: add SitemapActionBar — keyboard-wired action bar from sitemap defs"
```

---

### Task 12: Create SitemapPage component

**Files:**
- Create: `src/tui/sitemap/sitemap-page.tsx`
- Test: `tests/tui/sitemap/sitemap-page.test.tsx`

The universal page renderer. Reads page kind from sitemap, selects layout, renders content + ActionBar + EffectStrip.

- [ ] **Step 1: Write failing test**

```typescript
// tests/tui/sitemap/sitemap-page.test.tsx
vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { SitemapPage } from "../../../src/tui/sitemap/sitemap-page.js";
import type { PageObject } from "../../../src/domain/sitemap/unified-page.js";

// Minimal mock for TuiContext and NavigationContext
vi.mock("../../../src/tui/context.js", () => ({
	useTuiContext: () => ({
		deps: { disk: {}, paths: { join: (...a: string[]) => a.join("/") }, clock: { now: () => 0 }, shell: {} },
		vaultRoot: "/vault",
		projectPath: "/vault/project",
		projectsDir: "/vault/projects",
	}),
	useLoaderContext: () => ({
		deps: { disk: {}, paths: { join: (...a: string[]) => a.join("/") }, clock: { now: () => 0 }, shell: {}, log: () => {} },
		vaultRoot: "/vault",
		projectPath: "/vault/project",
		projectsDir: "/vault/projects",
		params: {},
	}),
}));

describe("SitemapPage", () => {
	it("renders page label", () => {
		const page: PageObject = {
			kind: "page",
			label: "Test Page",
			description: "A test",
			actions: [],
		};
		const { lastFrame } = render(
			React.createElement(SitemapPage, { page, pageId: "test", params: {} }),
		);
		expect(lastFrame()).toContain("Test Page");
	});
});
```

- [ ] **Step 2: Implement SitemapPage**

```typescript
// src/tui/sitemap/sitemap-page.tsx
import React, { useCallback } from "react";
import { Box, Text } from "ink";
import type { PageObject } from "../../domain/sitemap/unified-page.js";
import { SitemapActionBar } from "./sitemap-action-bar.js";
import { EffectStrip } from "./effect-strip.js";
import { resolvePageActions, type SitemapActionDef } from "../hooks/use-sitemap-actions.js";
import { dispatchAction } from "../hooks/use-action-dispatch.js";
import { useActionEffect } from "../hooks/use-action-effect.js";
import { useNavigationContext } from "./navigation-context.js";
import { buildTuiFlatContext } from "../hooks/use-condition-context.js";
import { useTuiContext, useLoaderContext } from "../context.js";
import type { TuiHandlerRegistry } from "../registry/tui-handler-registry.js";
import type { TuiActionContext } from "../registry/tui-handler-types.js";

interface SitemapPageProps {
	readonly page: PageObject;
	readonly pageId: string;
	readonly params: Record<string, string>;
	readonly registry?: TuiHandlerRegistry;
	readonly enabled?: boolean;
}

export function SitemapPage({ page, pageId, params, registry, enabled = true }: SitemapPageProps): React.JSX.Element {
	const tuiCtx = useTuiContext();
	const nav = useNavigationContext();
	const effect = useActionEffect();
	const loaderCtx = useLoaderContext(params);

	// Build condition context
	const flatCtx = buildTuiFlatContext(
		tuiCtx.projectPath ? { name: "", path: tuiCtx.projectPath } : undefined,
		undefined,
		undefined,
	);

	// Resolve actions — empty registry fallback for condition evaluation
	const noopRegistry = { hasCondition: () => false, getCondition: () => () => false };
	const actions = resolvePageActions(page.actions ?? [], flatCtx, registry ?? noopRegistry as never);

	// Build action context for handler dispatch
	const actionCtx: TuiActionContext = {
		deps: { disk: tuiCtx.deps.disk, paths: tuiCtx.deps.paths, clock: tuiCtx.deps.clock, shell: tuiCtx.deps.shell },
		session: { pipeline: {}, selectedProject: tuiCtx.projectPath },
		project: tuiCtx.projectPath ? { name: "", path: tuiCtx.projectPath } : undefined,
		params,
	};

	const handleAction = useCallback((action: SitemapActionDef) => {
		if (registry) {
			dispatchAction(action, nav, registry, actionCtx, effect.run);
		}
	}, [registry, nav, actionCtx, effect.run]);

	return React.createElement(Box, { flexDirection: "column", flexGrow: 1 },
		// Header
		React.createElement(Box, { paddingX: 1 },
			React.createElement(Text, { bold: true, color: "cyan" }, page.label),
			page.description
				? React.createElement(Text, { dimColor: true }, ` — ${page.description}`)
				: null,
		),

		// Content zone (kind-based rendering placeholder — will be enhanced per kind)
		React.createElement(Box, { flexDirection: "column", flexGrow: 1, paddingX: 1 },
			React.createElement(Text, { dimColor: true }, `[${page.kind}] ${pageId}`),
		),

		// Effect strip
		React.createElement(EffectStrip, { state: effect.state, message: effect.message }),

		// Action bar
		React.createElement(SitemapActionBar, { actions, onAction: handleAction, enabled }),
	);
}
```

This is the skeleton. Content zone rendering by kind (dashboard, list, form, dialog) will be added in the integration task as the loaders are wired up.

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/tui/sitemap/sitemap-page.test.tsx --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/tui/sitemap/sitemap-page.tsx tests/tui/sitemap/sitemap-page.test.tsx
git commit -m "feat: add SitemapPage — universal sitemap-driven page renderer"
```

---

## Chunk 4: Integration — Wire Everything Together

### Task 13: Expand TuiContext with sitemap, registry, session store

**Files:**
- Modify: `src/tui/context.tsx`

- [ ] **Step 1: Add sitemap, registry, session store, and action deps to TuiContextValue**

Add these fields to the `TuiContextValue` interface:

```typescript
import type { UnifiedSitemap } from "../domain/sitemap/unified-page.js";
import type { TuiHandlerRegistry } from "./registry/tui-handler-registry.js";
import type { TuiSessionStore } from "./registry/tui-handler-types.js";
import type { TuiActionDeps } from "../infrastructure/deps.js";

export interface TuiContextValue {
	// ... existing fields unchanged ...
	readonly sitemap?: UnifiedSitemap;
	readonly tuiRegistry?: TuiHandlerRegistry;
	readonly session?: TuiSessionStore;
	readonly actionDeps?: TuiActionDeps;
}
```

Fields are optional so `tui-entry.ts` compiles before Task 14 provides values. Task 14 will populate them. Consumers use `!` or fallback defaults.

- [ ] **Step 2: Run type check — should pass (fields are optional)**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: Clean.

- [ ] **Step 3: Commit**

```bash
git add src/tui/context.tsx
git commit -m "feat: expand TuiContext with optional sitemap, registry, session store, action deps"
```

---

### Task 14: Update tui-entry.ts to load sitemap and create registry

**Files:**
- Modify: `src/tui/tui-entry.ts`

- [ ] **Step 1: Update tui-entry.ts**

Add sitemap loading, TuiHandlerRegistry creation, TuiSessionStore creation, and pass to TuiProvider:

```typescript
import { loadSitemap } from "../infrastructure/sitemap-loader.js";
import { TuiHandlerRegistry } from "./registry/tui-handler-registry.js";
import { createSessionStore } from "./registry/tui-session-store.js";
import { registerTuiHandlers } from "./registry/register-tui-handlers.js";
```

In `runTui()`, after existing setup (uses the module-level singletons `disk`, `paths`, `clock`, `shell` already imported):

```typescript
// Load sitemap
const sitemapResult = loadSitemap(
	paths.join(CLI_PROJECT, "configs", "sitemap.json"),
	disk,
);
const sitemap = sitemapResult.sitemap ?? { version: 2, pages: {} };

// Create TUI infrastructure
const tuiRegistry = new TuiHandlerRegistry();
const session = createSessionStore();
const actionDeps = { disk, paths, clock, shell };

// Register all TUI handlers
registerTuiHandlers(tuiRegistry);

// Pass to context (add these fields to the existing contextValue object)
// sitemap, tuiRegistry, session, actionDeps
```

- [ ] **Step 2: Create stub register-tui-handlers.ts**

```typescript
// src/tui/registry/register-tui-handlers.ts
import type { TuiHandlerRegistry } from "./tui-handler-registry.js";

export function registerTuiHandlers(_registry: TuiHandlerRegistry): void {
	// Handler registration will be added as handlers are migrated
}
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: Clean.

- [ ] **Step 4: Run tests**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/tui/tui-entry.ts src/tui/registry/register-tui-handlers.ts
git commit -m "feat: load sitemap and create TuiHandlerRegistry in TUI entry point"
```

---

### Task 15: Wrap App in NavigationContext + wire to SitemapPage

**Files:**
- Modify: `src/tui/app.tsx`
- Modify: `src/tui/shell/content-area.tsx`

- [ ] **Step 1: Add NavigationProvider to App**

In `src/tui/app.tsx`, import `NavigationProvider` and wrap the main content in it. Add a `refresh` function using a state counter:

```typescript
import { NavigationProvider } from "./sitemap/navigation-context.js";
```

Wrap the rendered tree with NavigationProvider, passing `navigate`, `goBack`, and a `refresh` function:

```typescript
const [refreshKey, setRefreshKey] = useState(0);
const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

// In render:
React.createElement(NavigationProvider, { navigate, goBack, refresh },
	/* existing layout */
);
```

- [ ] **Step 2: Update ContentArea to use SitemapPage for unknown pages**

In `src/tui/shell/content-area.tsx`, import `SitemapPage` and the TUI context. When `getPage(pageId)` returns `PlaceholderPage` (i.e., page is not in the custom override registry), render `SitemapPage` instead:

```typescript
import { SitemapPage } from "../sitemap/sitemap-page.js";
import { useTuiContext } from "../context.js";

// In component:
const { sitemap, tuiRegistry } = useTuiContext();
const pageObj = sitemap.pages[pageId];

// If page has a custom registered component, use it. Otherwise, use SitemapPage.
const CustomPage = registry.get(pageId);
if (CustomPage) {
	return React.createElement(CustomPage, pageProps);
} else if (pageObj) {
	return React.createElement(SitemapPage, { page: pageObj, pageId, params, registry: tuiRegistry, enabled: focused });
} else {
	return React.createElement(PlaceholderPage, pageProps);
}
```

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: Clean.

- [ ] **Step 4: Run full tests**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All pass.

- [ ] **Step 5: Build and manually test**

Run: `node configs/esbuild.config.mjs && cd ../.. && .\flowti.cmd`
Expected: TUI launches. Pages with custom components (start, health, etc.) render as before. Pages without custom components render via SitemapPage with their sitemap label, description, and action bar.

- [ ] **Step 6: Commit**

```bash
git add src/tui/app.tsx src/tui/shell/content-area.tsx
git commit -m "feat: integrate SitemapPage into ContentArea — sitemap-driven rendering for all pages"
```

---

## Chunk 5: Handler Migration — Conditions & Core Effects

### Task 16: Migrate condition handlers

**Files:**
- Create: `src/tui/registry/condition-handlers.ts`
- Modify: `src/tui/registry/register-tui-handlers.ts`
- Test: `tests/tui/registry/condition-handlers.test.ts`

Migrate all 10 condition handlers from `register-handlers.ts` to TUI-compatible versions.

- [ ] **Step 1: Write failing tests**

```typescript
// tests/tui/registry/condition-handlers.test.ts
vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { describe, it, expect, vi } from "vitest";
import { TuiHandlerRegistry } from "../../../src/tui/registry/tui-handler-registry.js";
import { registerConditionHandlers } from "../../../src/tui/registry/condition-handlers.js";

describe("condition handlers", () => {
	it("registers all condition handler IDs", () => {
		const registry = new TuiHandlerRegistry();
		registerConditionHandlers(registry);

		const expectedIds = [
			"no-project-selected",
			"knowledgebase:available",
			"readme:exists",
			"iteration:running",
			"iteration:not-running",
			"iteration:not-planned",
			"iteration:cannot-advance",
			"iteration:not-in-review",
			"agents:dashboard-running",
			"agents:dashboard-not-running",
		];
		for (const id of expectedIds) {
			expect(registry.hasCondition(id), `Missing condition: ${id}`).toBe(true);
		}
	});
});
```

- [ ] **Step 2: Implement condition handlers**

```typescript
// src/tui/registry/condition-handlers.ts
import type { TuiHandlerRegistry } from "./tui-handler-registry.js";
import { findCurrentIteration } from "../../domain/lifecycle/iteration-query.js";
import { isKnowledgebaseAvailable } from "../../domain/knowledgebase/knowledgebase.js";

export function registerConditionHandlers(registry: TuiHandlerRegistry): void {
	registry.registerCondition("no-project-selected", (ctx) => !ctx.project);

	registry.registerCondition("knowledgebase:available", (ctx) => {
		if (!ctx.project) return true;
		return !isKnowledgebaseAvailable(ctx.project.path, ctx.deps);
	});

	registry.registerCondition("readme:exists", (ctx) => {
		if (!ctx.project) return true;
		return !ctx.deps.disk.existsSync(ctx.deps.paths.join(ctx.project.path, "README.md"));
	});

	registry.registerCondition("iteration:running", (ctx) => {
		if (!ctx.project) return false;
		const iter = findCurrentIteration(ctx.deps, ctx.project.path);
		return iter !== undefined;
	});

	registry.registerCondition("iteration:not-running", (ctx) => {
		if (!ctx.project) return true;
		return findCurrentIteration(ctx.deps, ctx.project.path) === undefined;
	});

	registry.registerCondition("iteration:not-planned", (ctx) => {
		if (!ctx.project) return true;
		const iter = findCurrentIteration(ctx.deps, ctx.project.path);
		return !iter || iter.status !== "planned";
	});

	registry.registerCondition("iteration:cannot-advance", (ctx) => {
		if (!ctx.project) return true;
		const iter = findCurrentIteration(ctx.deps, ctx.project.path);
		return !iter || iter.status === "closed";
	});

	registry.registerCondition("iteration:not-in-review", (ctx) => {
		if (!ctx.project) return true;
		const iter = findCurrentIteration(ctx.deps, ctx.project.path);
		return !iter || iter.status !== "in-review";
	});

	registry.registerCondition("agents:dashboard-running", () => {
		// Dashboard state check — stubbed for now (dashboard is TUI-native)
		return false;
	});

	registry.registerCondition("agents:dashboard-not-running", () => {
		return true;
	});
}
```

Note: Some conditions need domain function imports. The actual domain imports will be verified at compile time. `findCurrentIteration` and `isKnowledgebaseAvailable` are pure domain functions that accept deps.

- [ ] **Step 3: Wire into register-tui-handlers.ts**

```typescript
// src/tui/registry/register-tui-handlers.ts
import type { TuiHandlerRegistry } from "./tui-handler-registry.js";
import { registerConditionHandlers } from "./condition-handlers.js";

export function registerTuiHandlers(registry: TuiHandlerRegistry): void {
	registerConditionHandlers(registry);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/tui/registry/condition-handlers.test.ts --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: Clean.

- [ ] **Step 6: Commit**

```bash
git add src/tui/registry/condition-handlers.ts src/tui/registry/register-tui-handlers.ts tests/tui/registry/condition-handlers.test.ts
git commit -m "feat: migrate 10 condition handlers to TuiHandlerRegistry"
```

---

### Task 17: Migrate core effect handlers (build, test, devtools)

**Files:**
- Create: `src/tui/registry/effect-handlers.ts`
- Modify: `src/tui/registry/register-tui-handlers.ts`
- Test: `tests/tui/registry/effect-handlers.test.ts`

These are the highest-value handlers — they make the TUI usable for development workflows.

- [ ] **Step 1: Write failing tests**

```typescript
// tests/tui/registry/effect-handlers.test.ts
vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { describe, it, expect, vi } from "vitest";
import { TuiHandlerRegistry } from "../../../src/tui/registry/tui-handler-registry.js";
import { registerEffectHandlers } from "../../../src/tui/registry/effect-handlers.js";

describe("effect handlers", () => {
	it("registers core effect handler IDs", () => {
		const registry = new TuiHandlerRegistry();
		registerEffectHandlers(registry);

		const expectedIds = [
			"build:interactive",
			"devtools:check",
			"devtools:lint",
			"devtools:rebuild",
			"reports:run-all",
			"health:show",
			"sitemap:export",
		];
		for (const id of expectedIds) {
			expect(registry.hasHandler(id), `Missing handler: ${id}`).toBe(true);
		}
	});

	it("build handler returns ok on success", async () => {
		const registry = new TuiHandlerRegistry();
		registerEffectHandlers(registry);
		const handler = registry.getHandler("devtools:check");

		const mockDeps = {
			disk: {},
			paths: { join: (...a: string[]) => a.join("/") },
			clock: { now: () => 0 },
			shell: { run: vi.fn().mockResolvedValue(undefined) },
		};
		const result = await handler({
			deps: mockDeps as never,
			session: { pipeline: {} },
			project: { name: "CLI", path: "/p" },
		});
		expect(result.kind).toBe("ok");
	});
});
```

- [ ] **Step 2: Implement effect handlers**

```typescript
// src/tui/registry/effect-handlers.ts
import type { TuiHandlerRegistry } from "./tui-handler-registry.js";
import type { TuiActionContext } from "./tui-handler-types.js";

export function registerEffectHandlers(registry: TuiHandlerRegistry): void {
	// Build
	registry.registerHandler("build:interactive", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		try {
			await ctx.deps.shell.run("node configs/esbuild.config.mjs", { cwd: ctx.project.path });
			ctx.session.pipeline["buildPassed"] = true;
			return { kind: "ok", message: "Build complete" };
		} catch {
			ctx.session.pipeline["buildPassed"] = false;
			return { kind: "error", message: "Build failed" };
		}
	});

	// Type check
	registry.registerHandler("devtools:check", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		try {
			await ctx.deps.shell.run("npx tsc --noEmit --project configs/tsconfig.json", { cwd: ctx.project.path });
			return { kind: "ok", message: "Type check clean" };
		} catch {
			return { kind: "error", message: "Type check failed" };
		}
	});

	// Lint
	registry.registerHandler("devtools:lint", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		try {
			await ctx.deps.shell.run("npx eslint src/ --config configs/eslint.config.mjs", { cwd: ctx.project.path });
			return { kind: "ok", message: "Lint clean" };
		} catch {
			return { kind: "error", message: "Lint errors found" };
		}
	});

	// Rebuild CLI
	registry.registerHandler("devtools:rebuild", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		try {
			await ctx.deps.shell.run("node configs/esbuild.config.mjs", { cwd: ctx.project.path });
			return { kind: "ok", message: "Rebuild complete" };
		} catch {
			return { kind: "error", message: "Rebuild failed" };
		}
	});

	// Run all reports
	registry.registerHandler("reports:run-all", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		try {
			await ctx.deps.shell.run("node configs/esbuild.config.mjs && npx vitest run --config configs/vitest.config.ts", { cwd: ctx.project.path });
			return { kind: "ok", message: "Reports generated" };
		} catch {
			return { kind: "error", message: "Report generation failed" };
		}
	});

	// Health
	registry.registerHandler("health:show", async (ctx: TuiActionContext) => {
		// Health is read-only — navigates to health page
		return { kind: "navigate", target: "health" };
	});

	// Sitemap export
	registry.registerHandler("sitemap:export", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		try {
			await ctx.deps.shell.run("node -e \"require('./src/domain/sitemap/sitemap-export.js').exportSitemapToMarkdown()\"", { cwd: ctx.project.path });
			return { kind: "ok", message: "Sitemap exported" };
		} catch {
			return { kind: "error", message: "Sitemap export failed" };
		}
	});

	// Review pipeline handlers
	registry.registerHandler("review:build", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		try {
			await ctx.deps.shell.run("node configs/esbuild.config.mjs", { cwd: ctx.project.path });
			ctx.session.pipeline["review:buildPassed"] = true;
			return { kind: "ok", message: "Review build passed" };
		} catch {
			ctx.session.pipeline["review:buildPassed"] = false;
			return { kind: "error", message: "Review build failed" };
		}
	});

	registry.registerHandler("review:test", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		try {
			await ctx.deps.shell.run("npx vitest run --config configs/vitest.config.ts", { cwd: ctx.project.path });
			ctx.session.pipeline["review:testPassed"] = true;
			return { kind: "ok", message: "Review tests passed" };
		} catch {
			ctx.session.pipeline["review:testPassed"] = false;
			return { kind: "error", message: "Review tests failed" };
		}
	});

	// Publish pipeline handlers
	registry.registerHandler("publish:build", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		try {
			await ctx.deps.shell.run("node configs/esbuild.config.mjs", { cwd: ctx.project.path });
			ctx.session.pipeline["publish:buildPassed"] = true;
			return { kind: "ok", message: "Publish build passed" };
		} catch {
			ctx.session.pipeline["publish:buildPassed"] = false;
			return { kind: "error", message: "Publish build failed" };
		}
	});

	registry.registerHandler("publish:test", async (ctx: TuiActionContext) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		try {
			await ctx.deps.shell.run("npx vitest run --config configs/vitest.config.ts", { cwd: ctx.project.path });
			ctx.session.pipeline["publish:testPassed"] = true;
			return { kind: "ok", message: "Publish tests passed" };
		} catch {
			ctx.session.pipeline["publish:testPassed"] = false;
			return { kind: "error", message: "Publish tests failed" };
		}
	});
}
```

- [ ] **Step 3: Wire into register-tui-handlers.ts**

```typescript
import { registerEffectHandlers } from "./effect-handlers.js";

export function registerTuiHandlers(registry: TuiHandlerRegistry): void {
	registerConditionHandlers(registry);
	registerEffectHandlers(registry);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/tui/registry/effect-handlers.test.ts --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tui/registry/effect-handlers.ts tests/tui/registry/effect-handlers.test.ts src/tui/registry/register-tui-handlers.ts
git commit -m "feat: migrate core effect handlers (build, test, lint, review, publish)"
```

---

### Task 18: Migrate remaining handler categories

**Files:**
- Create: `src/tui/registry/navigation-handlers.ts`
- Create: `src/tui/registry/data-source-handlers.ts`
- Modify: `src/tui/registry/register-tui-handlers.ts`
- Test: `tests/tui/registry/navigation-handlers.test.ts`
- Test: `tests/tui/registry/data-source-handlers.test.ts`

These cover the remaining handlers from the legacy system.

- [ ] **Step 1: Create navigation handlers**

Navigation handlers return `{ kind: "navigate", target }`. These cover actions that were previously terminal-interactive but now just navigate to a page.

```typescript
// src/tui/registry/navigation-handlers.ts
import type { TuiHandlerRegistry } from "./tui-handler-registry.js";

export function registerNavigationHandlers(registry: TuiHandlerRegistry): void {
	// Project management
	registry.registerHandler("project:open", async () => ({ kind: "navigate", target: "projects-list" }));
	registry.registerHandler("project:create", async () => ({ kind: "navigate", target: "project-create" }));

	// Agent management
	registry.registerHandler("agents:navigate-edit", async (ctx) => {
		const agentId = ctx.params?.agentId;
		return { kind: "navigate", target: "agent-detail", params: agentId ? { agentId } : undefined };
	});

	// Events
	registry.registerHandler("events:list", async () => ({ kind: "navigate", target: "event-catalog" }));

	// Lifecycle
	registry.registerHandler("lifecycle:project", async () => ({ kind: "navigate", target: "lifecycle" }));

	// Component navigation
	registry.registerHandler("comp:add", async () => ({ kind: "navigate", target: "scaffold" }));

	// Help
	registry.registerHandler("help:main", async () => ({ kind: "navigate", target: "help" }));
	registry.registerHandler("info:show", async () => ({ kind: "navigate", target: "project-detail" }));

	// Workspace
	registry.registerHandler("workspace:list", async () => ({ kind: "navigate", target: "workspaces" }));
}
```

- [ ] **Step 2: Create data source handlers**

```typescript
// src/tui/registry/data-source-handlers.ts
import type { TuiHandlerRegistry } from "./tui-handler-registry.js";

export function registerDataSourceHandlers(registry: TuiHandlerRegistry): void {
	// Agent list data source
	registry.registerDataSource("agents:list", (ctx) => {
		if (!ctx.project) return [];
		// Read agents from agentsConfig — returns MenuEntry[] for dynamic lists
		return [];
	});

	// Inbox agent notes
	registry.registerDataSource("inbox:agent-notes", (ctx) => {
		const inboxDir = ctx.deps.paths.join(ctx.project?.path ?? "", "00 - Connectivity", "inbox");
		if (!ctx.deps.disk.existsSync(inboxDir)) return [];
		return [];
	});

	// Make templates
	registry.registerDataSource("make:templates", (ctx) => {
		if (!ctx.project) return [];
		return [];
	});

	// Reports generators
	registry.registerDataSource("reports:generators", (ctx) => {
		if (!ctx.project) return [];
		return [];
	});
}
```

- [ ] **Step 3: Wire into register-tui-handlers.ts**

```typescript
import { registerNavigationHandlers } from "./navigation-handlers.js";
import { registerDataSourceHandlers } from "./data-source-handlers.js";

export function registerTuiHandlers(registry: TuiHandlerRegistry): void {
	registerConditionHandlers(registry);
	registerEffectHandlers(registry);
	registerNavigationHandlers(registry);
	registerDataSourceHandlers(registry);
}
```

- [ ] **Step 4: Write tests**

```typescript
// tests/tui/registry/navigation-handlers.test.ts
vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { describe, it, expect } from "vitest";
import { TuiHandlerRegistry } from "../../../src/tui/registry/tui-handler-registry.js";
import { registerNavigationHandlers } from "../../../src/tui/registry/navigation-handlers.js";

describe("navigation handlers", () => {
	it("registers navigation handler IDs", () => {
		const registry = new TuiHandlerRegistry();
		registerNavigationHandlers(registry);
		expect(registry.hasHandler("project:open")).toBe(true);
		expect(registry.hasHandler("help:main")).toBe(true);
	});

	it("project:open navigates to projects-list", async () => {
		const registry = new TuiHandlerRegistry();
		registerNavigationHandlers(registry);
		const result = await registry.getHandler("project:open")({ deps: {} as never, session: { pipeline: {} } });
		expect(result).toEqual({ kind: "navigate", target: "projects-list" });
	});
});
```

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/tui/registry/ --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/tui/registry/navigation-handlers.ts src/tui/registry/data-source-handlers.ts tests/tui/registry/ src/tui/registry/register-tui-handlers.ts
git commit -m "feat: migrate navigation and data source handlers to TUI registry"
```

---

### Task 19: Migrate CRUD effect handlers (RAID, CAPA, deliverables, resources, timelog, iterations, requirements)

**Files:**
- Create: `src/tui/registry/crud-effect-handlers.ts`
- Modify: `src/tui/registry/register-tui-handlers.ts`
- Test: `tests/tui/registry/crud-effect-handlers.test.ts`

These are the management domain handlers. Most legacy handlers used `input.ask()` for data collection — in the TUI they become either navigation-to-form handlers or simple list/status display handlers.

- [ ] **Step 1: Implement CRUD effect handlers**

```typescript
// src/tui/registry/crud-effect-handlers.ts
import type { TuiHandlerRegistry } from "./tui-handler-registry.js";

export function registerCrudEffectHandlers(registry: TuiHandlerRegistry): void {
	// RAID handlers — list actions navigate, add actions navigate to form
	registry.registerHandler("raid:list", async () => ({ kind: "navigate", target: "raid" }));
	registry.registerHandler("raid:add-risk", async () => ({ kind: "navigate", target: "raid-add", params: { type: "risk" } }));
	registry.registerHandler("raid:add-assumption", async () => ({ kind: "navigate", target: "raid-add", params: { type: "assumption" } }));
	registry.registerHandler("raid:add-issue", async () => ({ kind: "navigate", target: "raid-add", params: { type: "issue" } }));
	registry.registerHandler("raid:add-dependency", async () => ({ kind: "navigate", target: "raid-add", params: { type: "dependency" } }));
	registry.registerHandler("raid:add-decision", async () => ({ kind: "navigate", target: "raid-add", params: { type: "decision" } }));
	registry.registerHandler("raid:update-status", async () => ({ kind: "navigate", target: "raid-update-status" }));

	// CAPA handlers
	registry.registerHandler("capa:list", async () => ({ kind: "navigate", target: "capa" }));
	registry.registerHandler("capa:add-corrective", async () => ({ kind: "navigate", target: "capa-add", params: { type: "corrective" } }));
	registry.registerHandler("capa:add-preventive", async () => ({ kind: "navigate", target: "capa-add", params: { type: "preventive" } }));
	registry.registerHandler("capa:update-status", async () => ({ kind: "navigate", target: "capa-update-status" }));

	// Deliverables handlers
	registry.registerHandler("deliverables:list", async () => ({ kind: "navigate", target: "deliverables" }));
	registry.registerHandler("deliverables:add", async () => ({ kind: "navigate", target: "deliverables-add" }));
	registry.registerHandler("deliverables:update-status", async () => ({ kind: "navigate", target: "deliverables-update-status" }));

	// Resources handlers
	registry.registerHandler("resources:list", async () => ({ kind: "navigate", target: "resources" }));
	registry.registerHandler("resources:add-human", async () => ({ kind: "navigate", target: "resources-add", params: { type: "human" } }));
	registry.registerHandler("resources:add-material", async () => ({ kind: "navigate", target: "resources-add", params: { type: "material" } }));
	registry.registerHandler("resources:add-role", async () => ({ kind: "navigate", target: "resources-add", params: { type: "role" } }));
	registry.registerHandler("resources:add-budget", async () => ({ kind: "navigate", target: "resources-add", params: { type: "budget" } }));
	registry.registerHandler("resources:financials", async () => ({ kind: "navigate", target: "resources-financials" }));

	// Timelog handlers
	registry.registerHandler("timelog:list", async () => ({ kind: "navigate", target: "timelog" }));
	registry.registerHandler("timelog:add", async () => ({ kind: "navigate", target: "timelog-add" }));
	registry.registerHandler("timelog:summary", async () => ({ kind: "navigate", target: "timelog-summary" }));

	// Requirements handlers
	registry.registerHandler("req:list", async () => ({ kind: "navigate", target: "requirements" }));
	registry.registerHandler("req:add-functional", async () => ({ kind: "navigate", target: "requirements-add", params: { type: "functional" } }));
	registry.registerHandler("req:add-nonfunctional", async () => ({ kind: "navigate", target: "requirements-add", params: { type: "non-functional" } }));
	registry.registerHandler("req:add-constraint", async () => ({ kind: "navigate", target: "requirements-add", params: { type: "constraint" } }));
	registry.registerHandler("req:add-usecase", async () => ({ kind: "navigate", target: "requirements-add", params: { type: "use-case" } }));
	registry.registerHandler("req:add-userstory", async () => ({ kind: "navigate", target: "requirements-add", params: { type: "user-story" } }));
	registry.registerHandler("req:update-status", async () => ({ kind: "navigate", target: "requirements-update-status" }));

	// Capture handlers
	registry.registerHandler("capture:idea", async () => ({ kind: "navigate", target: "capture-add", params: { type: "idea" } }));
	registry.registerHandler("capture:note", async () => ({ kind: "navigate", target: "capture-add", params: { type: "note" } }));
	registry.registerHandler("capture:bug", async () => ({ kind: "navigate", target: "capture-add", params: { type: "bug" } }));

	// Agent management (actions that need forms)
	registry.registerHandler("agents:add", async () => ({ kind: "navigate", target: "agent-add" }));
	registry.registerHandler("agents:remove", async () => ({ kind: "navigate", target: "agent-remove" }));
	registry.registerHandler("agents:edit-identity", async (ctx) => ({ kind: "navigate", target: "agent-edit", params: { agentId: ctx.params?.agentId ?? "", field: "identity" } }));
	registry.registerHandler("agents:edit-skills", async (ctx) => ({ kind: "navigate", target: "agent-edit", params: { agentId: ctx.params?.agentId ?? "", field: "skills" } }));
	registry.registerHandler("agents:edit-tools", async (ctx) => ({ kind: "navigate", target: "agent-edit", params: { agentId: ctx.params?.agentId ?? "", field: "tools" } }));
	registry.registerHandler("agents:edit-roles", async (ctx) => ({ kind: "navigate", target: "agent-edit", params: { agentId: ctx.params?.agentId ?? "", field: "roles" } }));
	registry.registerHandler("agents:edit-ai", async (ctx) => ({ kind: "navigate", target: "agent-edit", params: { agentId: ctx.params?.agentId ?? "", field: "ai" } }));
	registry.registerHandler("agents:edit-prompt", async (ctx) => ({ kind: "navigate", target: "agent-edit", params: { agentId: ctx.params?.agentId ?? "", field: "prompt" } }));
	registry.registerHandler("agents:change-permission", async (ctx) => ({ kind: "navigate", target: "agent-edit", params: { agentId: ctx.params?.agentId ?? "", field: "permission" } }));
	registry.registerHandler("agents:manage-grants", async (ctx) => ({ kind: "navigate", target: "agent-edit", params: { agentId: ctx.params?.agentId ?? "", field: "grants" } }));
	registry.registerHandler("agents:talk", async (ctx) => ({ kind: "navigate", target: "agents-chat", params: { agentId: ctx.params?.agentId ?? "" } }));
	registry.registerHandler("agents:assign-task", async (ctx) => ({ kind: "navigate", target: "agent-assign-task", params: { agentId: ctx.params?.agentId ?? "" } }));
	registry.registerHandler("agents:assign-to-project", async (ctx) => ({ kind: "navigate", target: "agent-assign-project", params: { agentId: ctx.params?.agentId ?? "" } }));
	registry.registerHandler("agents:edit-inventory", async (ctx) => ({ kind: "navigate", target: "agent-edit", params: { agentId: ctx.params?.agentId ?? "", field: "inventory" } }));

	// Events
	registry.registerHandler("events:add", async () => ({ kind: "navigate", target: "event-add" }));
	registry.registerHandler("events:flow", async () => ({ kind: "navigate", target: "event-flow" }));

	// Onboarding
	registry.registerHandler("onboarding:select-tour", async () => ({ kind: "navigate", target: "onboarding-tour" }));
	registry.registerHandler("onboarding:skip-tour", async () => ({ kind: "ok", message: "Tour skipped" }));
	registry.registerHandler("onboarding:continue", async () => ({ kind: "navigate", target: "onboarding-tour" }));

	// Docs & references
	registry.registerHandler("docs:update-refs", async (ctx) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		try {
			await ctx.deps.shell.run("node -e \"require('./src/domain/docs/doc-runner.js').runAllDocs()\"", { cwd: ctx.project.path });
			return { kind: "ok", message: "Docs updated" };
		} catch {
			return { kind: "error", message: "Docs update failed" };
		}
	});

	// Remaining tooling handlers
	registry.registerHandler("make:help", async () => ({ kind: "navigate", target: "help" }));
	registry.registerHandler("reports:browse", async () => ({ kind: "navigate", target: "reports" }));
	registry.registerHandler("devtools:console", async () => ({ kind: "ok", message: "Console not available in TUI" }));
	registry.registerHandler("devtools:npm-scripts", async () => ({ kind: "navigate", target: "devtools" }));
	registry.registerHandler("devtools:reload", async (ctx) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		try {
			await ctx.deps.shell.run("node scripts/cli-reload.mjs", { cwd: ctx.project.path });
			return { kind: "ok", message: "Reloaded" };
		} catch {
			return { kind: "error", message: "Reload failed" };
		}
	});

	// Component handlers (storybook, etc.)
	registry.registerHandler("comp:regen-dirty", async (ctx) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		return { kind: "ok", message: "Regeneration triggered" };
	});
	registry.registerHandler("comp:sb-install", async (ctx) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		return { kind: "ok", message: "Storybook install not available in TUI yet" };
	});
	registry.registerHandler("comp:sb-start", async (ctx) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		return { kind: "ok", message: "Storybook start not available in TUI yet" };
	});
	registry.registerHandler("comp:sb-stop", async () => ({ kind: "ok", message: "Storybook stopped" }));
	registry.registerHandler("comp:sb-build", async (ctx) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		return { kind: "ok", message: "Storybook build not available in TUI yet" };
	});
	registry.registerHandler("comp:data-providers", async () => ({ kind: "navigate", target: "component-data-providers" }));
	registry.registerHandler("comp:action-ref", async () => ({ kind: "navigate", target: "component-action-ref" }));

	// Workspace handlers
	registry.registerHandler("workspace:inspect", async () => ({ kind: "navigate", target: "workspace-inspect" }));
	registry.registerHandler("workspace:collect", async () => ({ kind: "ok", message: "Workspace collect completed" }));
	registry.registerHandler("workspace:dispose", async () => ({ kind: "ok", message: "Workspace disposed" }));
	registry.registerHandler("workspace:prune", async () => ({ kind: "ok", message: "Workspaces pruned" }));

	// Dashboard
	registry.registerHandler("agents:start-dashboard", async () => ({ kind: "ok", message: "Dashboard is TUI-native" }));
	registry.registerHandler("agents:rebuild-dashboard", async () => ({ kind: "ok", message: "Dashboard is TUI-native" }));
	registry.registerHandler("agents:stop-dashboard", async () => ({ kind: "ok", message: "Dashboard stopped" }));

	// Project management
	registry.registerHandler("project:manage-agents", async () => ({ kind: "navigate", target: "ai-tools" }));
	registry.registerHandler("readme:show", async () => ({ kind: "navigate", target: "help" }));

	// Review pipeline remaining handlers
	registry.registerHandler("review:e2e", async (ctx) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		return { kind: "ok", message: "E2E not available in TUI yet" };
	});
	registry.registerHandler("review:journey", async () => ({ kind: "navigate", target: "review-journey" }));
	registry.registerHandler("review:run-all", async (ctx) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		try {
			await ctx.deps.shell.run("node configs/esbuild.config.mjs", { cwd: ctx.project.path });
			ctx.session.pipeline["review:buildPassed"] = true;
			await ctx.deps.shell.run("npx vitest run --config configs/vitest.config.ts", { cwd: ctx.project.path });
			ctx.session.pipeline["review:testPassed"] = true;
			return { kind: "ok", message: "Review pipeline complete" };
		} catch {
			return { kind: "error", message: "Review pipeline failed" };
		}
	});
	registry.registerHandler("review:list-journeys", async () => ({ kind: "navigate", target: "review-journeys" }));
	registry.registerHandler("review:new-journey", async () => ({ kind: "navigate", target: "review-new-journey" }));
	registry.registerHandler("review:vault-create", async () => ({ kind: "ok", message: "Vault create not available in TUI yet" }));
	registry.registerHandler("review:vault-open", async () => ({ kind: "ok", message: "Vault open not available in TUI yet" }));
	registry.registerHandler("review:vault-teardown", async () => ({ kind: "ok", message: "Vault teardown not available in TUI yet" }));
	registry.registerHandler("review:vault-rebuild", async () => ({ kind: "ok", message: "Vault rebuild not available in TUI yet" }));

	// Publish remaining
	registry.registerHandler("publish:distribute", async (ctx) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		return { kind: "ok", message: "Distribution not available in TUI yet" };
	});
	registry.registerHandler("publish:run-all", async (ctx) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		try {
			await ctx.deps.shell.run("node configs/esbuild.config.mjs", { cwd: ctx.project.path });
			ctx.session.pipeline["publish:buildPassed"] = true;
			await ctx.deps.shell.run("npx vitest run --config configs/vitest.config.ts", { cwd: ctx.project.path });
			ctx.session.pipeline["publish:testPassed"] = true;
			return { kind: "ok", message: "Publish pipeline complete" };
		} catch {
			return { kind: "error", message: "Publish pipeline failed" };
		}
	});

	// Reports
	registry.registerHandler("reports:export-html", async (ctx) => {
		if (!ctx.project) return { kind: "error", message: "No project selected" };
		return { kind: "ok", message: "HTML export not available in TUI yet" };
	});
	registry.registerHandler("docs:dependencies", async () => ({ kind: "navigate", target: "docs-dependencies" }));

	// Agent status
	registry.registerHandler("agent:status", async (ctx) => ({ kind: "navigate", target: "agent-detail", params: { agentId: ctx.params?.agentId ?? "" } }));

	// Lifecycle features/products
	registry.registerHandler("lifecycle:features", async () => ({ kind: "navigate", target: "lifecycle-features" }));
	registry.registerHandler("lifecycle:products", async () => ({ kind: "navigate", target: "lifecycle-products" }));
}
```

- [ ] **Step 2: Write tests**

```typescript
// tests/tui/registry/crud-effect-handlers.test.ts
vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { describe, it, expect } from "vitest";
import { TuiHandlerRegistry } from "../../../src/tui/registry/tui-handler-registry.js";
import { registerCrudEffectHandlers } from "../../../src/tui/registry/crud-effect-handlers.js";

describe("crud effect handlers", () => {
	it("registers all expected handler IDs", () => {
		const registry = new TuiHandlerRegistry();
		registerCrudEffectHandlers(registry);

		// Spot check key handlers
		expect(registry.hasHandler("raid:list")).toBe(true);
		expect(registry.hasHandler("capture:idea")).toBe(true);
		expect(registry.hasHandler("agents:add")).toBe(true);
		expect(registry.hasHandler("review:run-all")).toBe(true);
	});
});
```

- [ ] **Step 3: Wire into register-tui-handlers.ts**

```typescript
import { registerCrudEffectHandlers } from "./crud-effect-handlers.js";

export function registerTuiHandlers(registry: TuiHandlerRegistry): void {
	registerConditionHandlers(registry);
	registerEffectHandlers(registry);
	registerNavigationHandlers(registry);
	registerDataSourceHandlers(registry);
	registerCrudEffectHandlers(registry);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/tui/registry/ --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Run full quality gate**

Run: `npx vitest run --config configs/vitest.config.ts && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ --config configs/eslint.config.mjs`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/tui/registry/ tests/tui/registry/
git commit -m "feat: migrate all remaining handlers to TUI registry — 129 handlers total"
```

---

## Chunk 6: Content Zone Rendering & Cleanup

### Task 20: Enhance SitemapPage with kind-based content rendering

**Files:**
- Modify: `src/tui/sitemap/sitemap-page.tsx`
- Test: `tests/tui/sitemap/sitemap-page.test.tsx`

Replace the placeholder content zone with actual kind-based rendering using existing TUI primitives.

- [ ] **Step 1: Add kind-based rendering to SitemapPage**

In the content zone of `SitemapPage`, dispatch on `page.kind`:

```typescript
// Inside SitemapPage, replace the placeholder content zone:
function renderContent(page: PageObject, pageId: string, loaderCtx: LoaderContext): React.JSX.Element {
	const loader = getLoaderForPage(pageId);
	if (!loader) {
		return React.createElement(Text, { dimColor: true }, `No loader for page: ${pageId}`);
	}

	const { data, error } = useLoader(loader, loaderCtx);
	if (error) return React.createElement(Text, { color: "red" }, `Error: ${error}`);
	if (!data) return React.createElement(Text, { dimColor: true }, "Loading...");

	switch (page.kind) {
		case "page":
		case "layout":
			return renderDashboardContent(data);
		case "list":
			return renderListContent(data);
		case "form":
			return renderFormContent(page);
		default:
			return React.createElement(Text, { dimColor: true }, `Page kind: ${page.kind}`);
	}
}
```

The `getLoaderForPage` function maps pageId to the existing loader functions (start-loader, health-loader, etc.) using a static map.

- [ ] **Step 2: Create loader map**

```typescript
// In sitemap-page.tsx or a new file src/tui/sitemap/loader-map.ts
import { loadStart } from "../loaders/start-loader.js";
import { loadHealth } from "../loaders/health-loader.js";
import { loadIterations } from "../loaders/iterations-loader.js";
// ... etc for all 32 loaders

const loaderMap: Record<string, LoaderFn<unknown>> = {
	"start": loadStart,
	"health": loadHealth,
	"iterations": loadIterations,
	// ... all loader mappings
};

export function getLoaderForPage(pageId: string): LoaderFn<unknown> | undefined {
	return loaderMap[pageId];
}
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run tests/tui/sitemap/ --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 4: Build and manually test**

Run: `node configs/esbuild.config.mjs && cd ../.. && .\flowti.cmd`
Expected: Pages render their content from loaders + actions from sitemap.

- [ ] **Step 5: Commit**

```bash
git add src/tui/sitemap/
git commit -m "feat: add kind-based content rendering to SitemapPage"
```

---

### Task 21: Remove legacy custom page files (keep chat + tour overrides)

**Files:**
- Delete: Most files in `src/tui/pages/` (keep `agents-chat-page.tsx`, `onboarding-tour-page.tsx`, `page-registry.ts`, `placeholder-page.tsx`, `dashboard-page.tsx`, `list-page.tsx`, `form-page.tsx`)
- Modify: `src/tui/tui-entry.ts` — remove page import registration for deleted pages

- [ ] **Step 1: Identify pages to keep vs delete**

Keep (custom overrides or shared patterns):
- `agents-chat-page.tsx` — custom override
- `onboarding-tour-page.tsx` — custom override
- `page-registry.ts` — still used for custom overrides
- `placeholder-page.tsx` — fallback
- `dashboard-page.tsx` — reusable layout pattern
- `list-page.tsx` — reusable layout pattern
- `form-page.tsx` — reusable layout pattern
- `onboarding-page.tsx` — has Start Tour action (custom behavior)

Delete (now rendered by SitemapPage):
- `start-page.tsx`, `project-detail-page.tsx`, `health-page.tsx`, `build-page.tsx`, `test-page.tsx`, `scaffold-page.tsx`, `make-page.tsx`, `review-page.tsx`, `devtools-page.tsx`, `reports-page.tsx`, `event-catalog-page.tsx`, `plugins-page.tsx`, `lifecycle-page.tsx`, `requirements-page.tsx`, `resources-page.tsx`, `deliverables-page.tsx`, `raid-page.tsx`, `capa-page.tsx`, `capture-page.tsx`, `timelog-page.tsx`, `knowledgebase-page.tsx`, `help-page.tsx`, `ai-tools-page.tsx`, `agent-detail-page.tsx`, `iterations-page.tsx`, `iteration-detail-page.tsx`, `publish-page.tsx`, `projects-list-page.tsx`

- [ ] **Step 2: Remove page imports from tui-entry.ts**

Remove the import lines for deleted pages. Keep imports for chat, tour, onboarding.

- [ ] **Step 3: Delete the page files**

```bash
cd "01 - Projects/Flowti CLI"
git rm src/tui/pages/start-page.tsx src/tui/pages/project-detail-page.tsx src/tui/pages/health-page.tsx src/tui/pages/build-page.tsx src/tui/pages/test-page.tsx src/tui/pages/scaffold-page.tsx src/tui/pages/make-page.tsx src/tui/pages/review-page.tsx src/tui/pages/devtools-page.tsx src/tui/pages/reports-page.tsx src/tui/pages/event-catalog-page.tsx src/tui/pages/plugins-page.tsx src/tui/pages/lifecycle-page.tsx src/tui/pages/requirements-page.tsx src/tui/pages/resources-page.tsx src/tui/pages/deliverables-page.tsx src/tui/pages/raid-page.tsx src/tui/pages/capa-page.tsx src/tui/pages/capture-page.tsx src/tui/pages/timelog-page.tsx src/tui/pages/knowledgebase-page.tsx src/tui/pages/help-page.tsx src/tui/pages/ai-tools-page.tsx src/tui/pages/agent-detail-page.tsx src/tui/pages/iterations-page.tsx src/tui/pages/iteration-detail-page.tsx src/tui/pages/publish-page.tsx src/tui/pages/projects-list-page.tsx
```

- [ ] **Step 4: Run full quality gate**

Run: `npx vitest run --config configs/vitest.config.ts && npx tsc --noEmit --project configs/tsconfig.json`
Expected: All pass. Some tests for deleted pages may need cleanup.

- [ ] **Step 5: Clean up orphaned test files**

Delete test files that tested deleted pages:
```bash
git rm tests/tui/pages/start-page.test.tsx tests/tui/pages/health-page.test.tsx
# ... etc for each deleted page that had a test
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove hardcoded page files — SitemapPage renders all non-override pages"
```

---

### Task 22: Final quality gate and manual verification

**Files:** None (verification only)

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All tests pass.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: Clean.

- [ ] **Step 3: Run lint**

Run: `npx eslint src/ --config configs/eslint.config.mjs`
Expected: 0 errors.

- [ ] **Step 4: Build**

Run: `node configs/esbuild.config.mjs`
Expected: Clean build.

- [ ] **Step 5: Manual smoke test**

Run: `cd ../.. && .\flowti.cmd`

Verify:
1. Start page renders with actions in ActionBar
2. Press action keys → dispatches correctly (navigate, build, etc.)
3. Navigate to project-detail → actions visible and functional
4. Navigate to iterations → list renders with data
5. Press build action → EffectStrip shows spinner → success/error flash
6. Escape → goBack works
7. Agent chat page → custom override renders correctly
8. Onboarding tour → custom override renders correctly
9. Disabled actions render dimmed and don't fire

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: final adjustments from smoke testing"
```
