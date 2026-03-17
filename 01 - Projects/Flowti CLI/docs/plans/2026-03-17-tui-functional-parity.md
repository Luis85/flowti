# TUI Functional Parity — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore full interactive functionality to the sitemap-driven TUI — interactive lists, form input, iteration management, CRUD operations, agents chat as native feature.

**Architecture:** Content renderer registry in SitemapPage delegates content rendering to per-page React components. Default renderers use existing primitives (ListPage, FormPage). Inline forms via new `kind: "form"` TuiActionResult variant. CRUD factory generates handlers from store descriptors. Agents chat becomes a native content renderer.

**Tech Stack:** React 19, Ink 6, TypeScript (ESM, `.js` imports, tabs), Vitest, ink-testing-library 4

**Spec:** `docs/specs/2026-03-17-tui-functional-parity-design.md`

**Run all tests:** `npx vitest run --config configs/vitest.config.ts`
**Run TUI tests only:** `npx vitest run tests/tui/ --config configs/vitest.config.ts`
**Type check:** `npx tsc --noEmit --project configs/tsconfig.json`

---

## File Structure

### New Files

```
src/tui/sitemap/
  content-renderer-types.ts    — ContentRendererProps, ContentRenderer type, FormDef type
  content-renderers.ts         — registry map + custom renderer components
  default-list-renderer.tsx    — ListPage wrapper with per-page config
  default-form-renderer.tsx    — FormPage wrapper for inline forms
  list-configs.ts              — renderItem/renderDetail/onSelect per pageId
  crud-form-factory.ts         — generates form+submit handlers from StoreApi

src/tui/loaders/
  iteration-planning-loader.ts — reuses loadIterations for planning page
  agents-dashboard-loader.ts   — lists agents with status
  components-loader.ts         — lists components from config
  component-detail-loader.ts   — reads component by name
  docs-loader.ts               — lists markdown files in docs/
  workspaces-loader.ts         — lists git worktrees

src/tui/chat/
  (moved from src/infrastructure/chat/components/)
  header-bar.tsx
  message-area.tsx
  activity-bar.tsx
  input-area.tsx
  task-view.tsx
```

### Modified Files

```
src/tui/sitemap/sitemap-page.tsx        — extraParams state, formState, ContentZone delegation
src/tui/sitemap/loader-map.ts           — add missing loader mappings
src/tui/registry/tui-handler-types.ts   — add kind:"form" to TuiActionResult, FormDef type
src/tui/hooks/use-action-effect.ts      — onFormRequested callback
src/tui/hooks/use-action-dispatch.ts    — propagate form result
src/tui/registry/crud-effect-handlers.ts — remove stubs replaced by CRUD factory
src/tui/registry/register-tui-handlers.ts — register iteration handlers + CRUD factory
src/tui/tui-entry.ts                    — remove agents-chat-page import
configs/sitemap.json                    — agents-chat kind: component → page
```

### Deleted Files

```
src/tui/pages/agents-chat-page.tsx      — replaced by content renderer
```

---

## Chunk 1: Foundation — Types, Registry, SitemapPage Integration

### Task 1: Create ContentRendererProps type and registry

**Files:**
- Create: `src/tui/sitemap/content-renderer-types.ts`
- Create: `src/tui/sitemap/content-renderers.ts`
- Test: `tests/tui/sitemap/content-renderers.test.ts`

- [ ] **Step 1: Write failing test for content renderer registry**

```typescript
// tests/tui/sitemap/content-renderers.test.ts
vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { describe, it, expect, vi } from "vitest";
import { getContentRenderer } from "../../../src/tui/sitemap/content-renderers.js";

describe("content renderer registry", () => {
	it("returns undefined for unknown pageId", () => {
		expect(getContentRenderer("nonexistent")).toBeUndefined();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tui/sitemap/content-renderers.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create content-renderer-types.ts**

```typescript
// src/tui/sitemap/content-renderer-types.ts
import type React from "react";
import type { PageObject } from "../../domain/sitemap/unified-page.js";
import type { NavigationContextValue } from "./navigation-context.js";
import type { TuiHandlerRegistry } from "../registry/tui-handler-registry.js";
import type { TuiActionContext } from "../registry/tui-handler-types.js";
import type { FormFieldDef } from "../pages/form-page.js";

export interface FormDef {
	readonly title: string;
	readonly fields: readonly FormFieldDef[];
	readonly submitHandler: string;
}

export interface ContentRendererProps {
	readonly data: unknown;
	readonly page: PageObject;
	readonly params: Record<string, string>;
	readonly nav: NavigationContextValue;
	readonly registry: TuiHandlerRegistry;
	readonly actionCtx: TuiActionContext;
	readonly onExtraParams?: (extra: Record<string, string>) => void;
	readonly enabled?: boolean;
}

export type ContentRenderer = React.FC<ContentRendererProps>;
```

- [ ] **Step 4: Create content-renderers.ts with empty registry**

```typescript
// src/tui/sitemap/content-renderers.ts
import type { ContentRenderer } from "./content-renderer-types.js";

const contentRenderers: Record<string, ContentRenderer> = {};

export function getContentRenderer(pageId: string): ContentRenderer | undefined {
	return contentRenderers[pageId];
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/tui/sitemap/content-renderers.test.ts --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 6: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: Clean.

- [ ] **Step 7: Commit**

```bash
git add src/tui/sitemap/content-renderer-types.ts src/tui/sitemap/content-renderers.ts tests/tui/sitemap/content-renderers.test.ts
git commit -m "feat: add ContentRenderer type and registry skeleton"
```

---

### Task 2: Add `kind: "form"` to TuiActionResult

**Files:**
- Modify: `src/tui/registry/tui-handler-types.ts`
- Test: `tests/tui/registry/tui-handler-registry.test.ts` (verify existing tests still pass)

- [ ] **Step 1: Add FormDef import and form variant to TuiActionResult**

In `src/tui/registry/tui-handler-types.ts`, update the `TuiActionResult` type:

```typescript
// Add import at top:
import type { FormFieldDef } from "../pages/form-page.js";

// Replace the TuiActionResult type:
export type TuiActionResult =
	| { readonly kind: "ok"; readonly message?: string }
	| { readonly kind: "navigate"; readonly target: string; readonly params?: Record<string, string> }
	| { readonly kind: "error"; readonly message: string }
	| { readonly kind: "form"; readonly title: string; readonly fields: readonly FormFieldDef[]; readonly submitHandler: string };
```

- [ ] **Step 2: Run existing handler registry tests**

Run: `npx vitest run tests/tui/registry/ --config configs/vitest.config.ts`
Expected: All PASS (new variant doesn't break existing code).

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add src/tui/registry/tui-handler-types.ts
git commit -m "feat: add kind:form variant to TuiActionResult"
```

---

### Task 3: Add onFormRequested to useActionEffect

**Files:**
- Modify: `src/tui/hooks/use-action-effect.ts`
- Modify: `tests/tui/hooks/use-action-effect.test.ts`

- [ ] **Step 1: Write failing test for onFormRequested callback**

Add to `tests/tui/hooks/use-action-effect.test.ts`:

```typescript
it("calls onFormRequested when handler returns kind:form", async () => {
	const formResult = {
		kind: "form" as const,
		title: "Add Item",
		fields: [{ name: "name", label: "Name", type: "text" as const }],
		submitHandler: "item:create",
	};
	const onForm = vi.fn();
	const { result } = renderHook(() => useActionEffect());
	await act(async () => {
		await result.current.run(async () => formResult, "Add", onForm);
	});
	expect(onForm).toHaveBeenCalledWith(formResult);
	expect(result.current.state).toBe("idle");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tui/hooks/use-action-effect.test.ts --config configs/vitest.config.ts`
Expected: FAIL — `run` doesn't accept third argument.

- [ ] **Step 3: Update useActionEffect to accept onFormRequested**

In `src/tui/hooks/use-action-effect.ts`, update the `run` signature and add form handling:

Change the `run` callback signature to accept an optional `onFormRequested`:

```typescript
type OnFormRequested = (form: TuiActionResult & { kind: "form" }) => void;

interface UseActionEffectResult {
	readonly state: EffectState;
	readonly message: string;
	readonly run: (handler: EffectHandler, label: string, onFormRequested?: OnFormRequested) => Promise<void>;
	readonly dismiss: () => void;
}
```

In the `run` implementation, before the existing `if (result.kind === "error")` check, add:

```typescript
if (result.kind === "form") {
	if (onFormRequested) onFormRequested(result);
	setState("idle");
	setMessage("");
	return;
}
```

- [ ] **Step 4: Run tests to verify all pass**

Run: `npx vitest run tests/tui/hooks/use-action-effect.test.ts --config configs/vitest.config.ts`
Expected: All PASS.

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: Clean.

- [ ] **Step 6: Commit**

```bash
git add src/tui/hooks/use-action-effect.ts tests/tui/hooks/use-action-effect.test.ts
git commit -m "feat: add onFormRequested callback to useActionEffect"
```

---

### Task 4: Update dispatchAction to propagate form results

**Files:**
- Modify: `src/tui/hooks/use-action-dispatch.ts`
- Modify: `tests/tui/hooks/use-action-dispatch.test.ts`

- [ ] **Step 1: Write failing test for form result propagation**

Add to `tests/tui/hooks/use-action-dispatch.test.ts`:

```typescript
it("propagates kind:form result from handler through runEffect", async () => {
	const formResult = {
		kind: "form" as const,
		title: "Add Risk",
		fields: [{ name: "name", label: "Name", type: "text" as const }],
		submitHandler: "raid:create-risk",
	};
	const registry = new TuiHandlerRegistry();
	registry.registerHandler("raid:add-risk", async () => formResult);
	const mockNav = { navigate: vi.fn(), goBack: vi.fn(), refresh: vi.fn() };
	const runEffect = vi.fn();
	const action = { key: "2", label: "Add Risk", disabled: false, type: "handler" as const, target: "raid:add-risk" };
	await dispatchAction(action, mockNav, registry, { deps: {} as never, session: { pipeline: {} } }, runEffect);
	expect(runEffect).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it passes (handler type already dispatches to runEffect)**

Run: `npx vitest run tests/tui/hooks/use-action-dispatch.test.ts --config configs/vitest.config.ts`
Expected: PASS — the handler case already routes through `runEffect`.

- [ ] **Step 3: Update dispatchAction to NOT swallow form results as navigate**

In `src/tui/hooks/use-action-dispatch.ts`, update the handler case. Currently it intercepts `kind: "navigate"` and calls `nav.navigate()`, returning `{ kind: "ok" }`. The form result must pass through to `runEffect` untouched:

```typescript
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
```

The `kind: "form"` result already passes through here (the `if` only intercepts `navigate`). No code change needed in dispatchAction — `useActionEffect.run()` handles the form result via `onFormRequested`. Verify this is correct.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run tests/tui/hooks/ --config configs/vitest.config.ts`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add tests/tui/hooks/use-action-dispatch.test.ts
git commit -m "test: verify form result propagation through dispatchAction"
```

---

### Task 5: Wire extraParams and formState into SitemapPage

**Files:**
- Modify: `src/tui/sitemap/sitemap-page.tsx`
- Modify: `tests/tui/sitemap/sitemap-page.test.tsx`

- [ ] **Step 1: Add extraParams and formState to SitemapPage**

In `src/tui/sitemap/sitemap-page.tsx`, add these state variables inside the `SitemapPage` function:

```typescript
const [extraParams, setExtraParams] = useState<Record<string, string>>({});
const [formState, setFormState] = useState<FormDef | null>(null);
```

Add import for `FormDef`:

```typescript
import type { FormDef } from "./content-renderer-types.js";
```

Update `actionCtx` to merge `extraParams`:

```typescript
const actionCtx: TuiActionContext = {
	deps: { disk: tuiCtx.deps.disk, paths: tuiCtx.deps.paths, clock: tuiCtx.deps.clock, shell: tuiCtx.deps.shell },
	session: { pipeline: {}, selectedProject: tuiCtx.projectPath },
	project: tuiCtx.projectPath ? { name: "", path: tuiCtx.projectPath } : undefined,
	params: { ...params, ...extraParams },
};
```

Update `handleAction` to pass `onFormRequested`:

```typescript
const handleAction = useCallback((action: SitemapActionDef) => {
	if (registry) {
		dispatchAction(action, nav, registry, actionCtx, (handler, label) =>
			effect.run(handler, label, (form) => setFormState(form)),
		);
	}
}, [registry, nav, actionCtx, effect]);
```

- [ ] **Step 2: Add formState rendering in ContentZone**

In the `ContentZone` component, add a check at the top:

```typescript
// In SitemapPage's return, before ContentZone:
formState !== null
	? React.createElement(DefaultFormRenderer, {
		form: formState,
		registry: registry!,
		actionCtx,
		onComplete: () => { setFormState(null); nav.refresh(); },
		onCancel: () => setFormState(null),
		enabled,
	})
	: React.createElement(ContentZone, { page, pageId, params }),
```

Add placeholder import (will be created in Chunk 3):

```typescript
import { DefaultFormRenderer } from "./default-form-renderer.js";
```

- [ ] **Step 3: Add content renderer registry check in LoadedContentZone**

In `LoadedContentZone`, before the `switch (page.kind)` block, add:

```typescript
import { getContentRenderer } from "./content-renderers.js";

// Inside LoadedContentZone, after data is loaded:
const CustomRenderer = getContentRenderer(pageId);
if (CustomRenderer) {
	return React.createElement(CustomRenderer, {
		data, page, params, nav, registry: registry!, actionCtx,
		onExtraParams: setExtraParams, enabled,
	});
}
```

Note: `registry` and `actionCtx` need to be passed down from `SitemapPage` to `LoadedContentZone`. Add them to the component props.

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: May fail on missing `DefaultFormRenderer` — create a stub file.

- [ ] **Step 5: Create stub DefaultFormRenderer**

```typescript
// src/tui/sitemap/default-form-renderer.tsx
import React from "react";
import { Text } from "ink";
import type { FormDef } from "./content-renderer-types.js";
import type { TuiHandlerRegistry } from "../registry/tui-handler-registry.js";
import type { TuiActionContext } from "../registry/tui-handler-types.js";

interface DefaultFormRendererProps {
	readonly form: FormDef;
	readonly registry: TuiHandlerRegistry;
	readonly actionCtx: TuiActionContext;
	readonly onComplete: () => void;
	readonly onCancel: () => void;
	readonly enabled?: boolean;
}

export function DefaultFormRenderer({ form }: DefaultFormRendererProps): React.JSX.Element {
	return React.createElement(Text, { dimColor: true }, `Form: ${form.title} (not yet wired)`);
}
```

- [ ] **Step 6: Run type check and tests**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx vitest run tests/tui/sitemap/ --config configs/vitest.config.ts`
Expected: Clean. Existing sitemap tests should still pass.

- [ ] **Step 7: Commit**

```bash
git add src/tui/sitemap/sitemap-page.tsx src/tui/sitemap/default-form-renderer.tsx tests/tui/sitemap/sitemap-page.test.tsx
git commit -m "feat: wire extraParams, formState, and content renderer registry into SitemapPage"
```

---

## Chunk 2: Default List Renderer

### Task 6: Create list configs for all list-compatible pages

**Files:**
- Create: `src/tui/sitemap/list-configs.ts`
- Test: `tests/tui/sitemap/list-configs.test.ts`

- [ ] **Step 1: Write failing test for list config resolution**

```typescript
// tests/tui/sitemap/list-configs.test.ts
vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { describe, it, expect, vi } from "vitest";
import { getListConfig } from "../../../src/tui/sitemap/list-configs.js";

describe("list configs", () => {
	it("returns config for iterations page", () => {
		const config = getListConfig("iterations");
		expect(config).toBeDefined();
		expect(config!.getItems).toBeTypeOf("function");
		expect(config!.renderItem).toBeTypeOf("function");
	});

	it("returns config for projects-list page", () => {
		const config = getListConfig("projects-list");
		expect(config).toBeDefined();
	});

	it("returns undefined for unknown page", () => {
		expect(getListConfig("unknown")).toBeUndefined();
	});

	it("extracts items from CrudPageData shape", () => {
		const config = getListConfig("resources");
		expect(config).toBeDefined();
		const items = config!.getItems({ items: [{ name: "Dev", status: "open" }] });
		expect(items).toHaveLength(1);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tui/sitemap/list-configs.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create list-configs.ts**

```typescript
// src/tui/sitemap/list-configs.ts
import React from "react";
import { Text } from "ink";
import type { NavigationContextValue } from "./navigation-context.js";

export interface ListConfig<T = unknown> {
	readonly getItems: (data: unknown) => readonly T[];
	readonly renderItem: (item: T, index: number, selected: boolean) => React.ReactNode;
	readonly renderDetail?: (item: T) => React.ReactNode;
	readonly onSelect?: (item: T, nav: NavigationContextValue) => void;
}

function extractItems(data: unknown): readonly unknown[] {
	if (Array.isArray(data)) return data;
	if (typeof data === "object" && data !== null) {
		const record = data as Record<string, unknown>;
		if (Array.isArray(record["items"])) return record["items"];
		if (Array.isArray(record["iterations"])) return record["iterations"];
		for (const value of Object.values(record)) {
			if (Array.isArray(value)) return value;
		}
	}
	return [];
}

function formatField(value: unknown): string {
	if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return String(value);
	return "";
}

function renderGenericItem(item: unknown, _index: number, selected: boolean): React.ReactNode {
	const record = item as Record<string, unknown>;
	const name = record["name"] ?? record["label"] ?? record["title"] ?? record["id"] ?? "";
	const status = record["status"] ?? record["state"] ?? "";
	const label = status ? `${formatField(name)} (${formatField(status)})` : formatField(name);
	return React.createElement(Text, { bold: selected, wrap: "truncate" }, label);
}

function renderGenericDetail(item: unknown): React.ReactNode {
	const record = item as Record<string, unknown>;
	const entries = Object.entries(record).filter(([k]) => k !== "file");
	return React.createElement(React.Fragment, null,
		...entries.map(([key, val]) =>
			React.createElement(Text, { key, wrap: "truncate" },
				React.createElement(Text, { bold: true }, `${key}: `),
				formatField(val),
			),
		),
	);
}

const iterationsConfig: ListConfig = {
	getItems: (data) => {
		const record = data as Record<string, unknown>;
		return Array.isArray(record["iterations"]) ? record["iterations"] : extractItems(data);
	},
	renderItem: (item, _i, selected) => {
		const it = item as Record<string, unknown>;
		const num = it["number"] ?? "";
		const name = it["name"] ?? "";
		const status = it["status"] ?? "";
		const done = it["scopeDone"] ?? 0;
		const total = it["scopeTotal"] ?? 0;
		return React.createElement(Text, { bold: selected, wrap: "truncate" },
			`#${formatField(num)} ${formatField(name)} [${formatField(status)}] ${formatField(done)}/${formatField(total)}`,
		);
	},
	renderDetail: (item) => {
		const it = item as Record<string, unknown>;
		return React.createElement(React.Fragment, null,
			React.createElement(Text, { bold: true }, formatField(it["name"])),
			React.createElement(Text, null, `Status: ${formatField(it["status"])}`),
			React.createElement(Text, null, `Goal: ${formatField(it["goal"])}`),
			React.createElement(Text, null, `${formatField(it["startDate"])} \u2192 ${formatField(it["endDate"])}`),
			React.createElement(Text, null, `Scope: ${formatField(it["scopeDone"])}/${formatField(it["scopeTotal"])}`),
		);
	},
	onSelect: (item, nav) => {
		const it = item as Record<string, unknown>;
		nav.navigate("iteration-detail", { number: String(it["number"] ?? "") });
	},
};

const projectsListConfig: ListConfig = {
	getItems: extractItems,
	renderItem: (item, _i, selected) => {
		const p = item as Record<string, unknown>;
		return React.createElement(Text, { bold: selected, wrap: "truncate" },
			`${formatField(p["name"])} (${formatField(p["path"])})`,
		);
	},
	onSelect: (item, nav) => {
		const p = item as Record<string, unknown>;
		nav.navigate("project-detail", { name: String(p["name"] ?? "") });
	},
};

function createCrudListConfig(): ListConfig {
	return {
		getItems: extractItems,
		renderItem: renderGenericItem,
		renderDetail: renderGenericDetail,
	};
}

const crudConfig = createCrudListConfig();

const configs: Record<string, ListConfig> = {
	"iterations": iterationsConfig,
	"projects-list": projectsListConfig,
	"make": { getItems: extractItems, renderItem: renderGenericItem },
	"components": { getItems: extractItems, renderItem: renderGenericItem, renderDetail: renderGenericDetail },
	"resources": crudConfig,
	"requirements": crudConfig,
	"deliverables": crudConfig,
	"raid": crudConfig,
	"capa": crudConfig,
	"timelog": crudConfig,
	"event-catalog": crudConfig,
	"ai-tools": crudConfig,
	"plugins": crudConfig,
};

export function getListConfig(pageId: string): ListConfig | undefined {
	return configs[pageId];
}

export function hasListData(data: unknown): boolean {
	return extractItems(data).length > 0;
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/tui/sitemap/list-configs.test.ts --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tui/sitemap/list-configs.ts tests/tui/sitemap/list-configs.test.ts
git commit -m "feat: add per-page list configs with CRUD factory"
```

---

### Task 7: Create DefaultListRenderer

**Files:**
- Create: `src/tui/sitemap/default-list-renderer.tsx`
- Test: `tests/tui/sitemap/default-list-renderer.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// tests/tui/sitemap/default-list-renderer.test.tsx
vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { DefaultListRenderer } from "../../../src/tui/sitemap/default-list-renderer.js";
import { NavigationProvider } from "../../../src/tui/sitemap/navigation-context.js";

describe("DefaultListRenderer", () => {
	it("renders items from CrudPageData", () => {
		const data = { items: [{ name: "Alpha", status: "open" }, { name: "Beta", status: "closed" }] };
		const { lastFrame } = render(
			React.createElement(NavigationProvider, {
				navigate: vi.fn(), goBack: vi.fn(), refresh: vi.fn(),
			},
				React.createElement(DefaultListRenderer, {
					pageId: "resources",
					data,
					enabled: true,
				}),
			),
		);
		const frame = lastFrame() ?? "";
		expect(frame).toContain("Alpha");
		expect(frame).toContain("Beta");
	});

	it("shows 'No items' for empty data", () => {
		const { lastFrame } = render(
			React.createElement(NavigationProvider, {
				navigate: vi.fn(), goBack: vi.fn(), refresh: vi.fn(),
			},
				React.createElement(DefaultListRenderer, {
					pageId: "resources",
					data: { items: [] },
					enabled: true,
				}),
			),
		);
		expect(lastFrame()).toContain("No items");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tui/sitemap/default-list-renderer.test.tsx --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create DefaultListRenderer**

```typescript
// src/tui/sitemap/default-list-renderer.tsx
import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { ScrollableList } from "../primitives/scrollable-list.js";
import { MasterDetail } from "../primitives/master-detail.js";
import { getListConfig, hasListData } from "./list-configs.js";
import { useNavigationContext } from "./navigation-context.js";

interface DefaultListRendererProps {
	readonly pageId: string;
	readonly data: unknown;
	readonly enabled?: boolean;
	readonly onExtraParams?: (extra: Record<string, string>) => void;
}

export function DefaultListRenderer({ pageId, data, enabled = true, onExtraParams }: DefaultListRendererProps): React.JSX.Element {
	const nav = useNavigationContext();
	const config = getListConfig(pageId);
	const [selected, setSelected] = useState(0);

	const items = config ? config.getItems(data) : [];

	useInput((_input, key) => {
		if (!enabled) return;
		if (key.upArrow && selected > 0) setSelected((s) => s - 1);
		if (key.downArrow && selected < items.length - 1) setSelected((s) => s + 1);
		if (key.return && items[selected] && config?.onSelect) {
			config.onSelect(items[selected], nav);
		}
	}, { isActive: enabled });

	// Report selected item index to parent for handler dispatch
	React.useEffect(() => {
		if (onExtraParams) {
			onExtraParams({ selectedIndex: String(selected) });
		}
	}, [selected, onExtraParams]);

	if (items.length === 0) {
		return React.createElement(Box, { flexDirection: "column", flexGrow: 1, paddingX: 1 },
			React.createElement(Text, { dimColor: true }, "No items"),
		);
	}

	const list = React.createElement(ScrollableList, {
		items: items as unknown[],
		selected,
		renderItem: config?.renderItem ?? ((item: unknown, i: number, sel: boolean) =>
			React.createElement(Text, { bold: sel }, String(item))),
	});

	const detail = config?.renderDetail && items[selected]
		? React.createElement(Box, { flexDirection: "column", paddingX: 1 }, config.renderDetail(items[selected]))
		: undefined;

	if (detail) {
		return React.createElement(MasterDetail, { master: list, detail });
	}
	return React.createElement(Box, { flexDirection: "column", flexGrow: 1 }, list);
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/tui/sitemap/default-list-renderer.test.tsx --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tui/sitemap/default-list-renderer.tsx tests/tui/sitemap/default-list-renderer.test.tsx
git commit -m "feat: add DefaultListRenderer with ListPage + MasterDetail"
```

---

### Task 8: Wire DefaultListRenderer into SitemapPage ContentZone

**Files:**
- Modify: `src/tui/sitemap/sitemap-page.tsx`

- [ ] **Step 1: Update LoadedContentZone to use DefaultListRenderer**

In `LoadedContentZone`, replace the `case "list"` and add a heuristic check before the `default` case:

```typescript
import { DefaultListRenderer } from "./default-list-renderer.js";
import { getListConfig, hasListData } from "./list-configs.js";

// Inside the switch statement in LoadedContentZone:
case "list":
	return React.createElement(DefaultListRenderer, { pageId, data, enabled, onExtraParams: setExtraParams });

// Before the default case, after other cases:
// If page kind is "page" but data has items[] array, render as list
default: {
	if (hasListData(data) && getListConfig(pageId)) {
		return React.createElement(DefaultListRenderer, { pageId, data, enabled, onExtraParams: setExtraParams });
	}
	return renderDashboardContent(data);
}
```

Note: `enabled` and `setExtraParams` need to be threaded from SitemapPage → LoadedContentZone. Add them to the props interface.

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: Clean.

- [ ] **Step 3: Run all sitemap tests**

Run: `npx vitest run tests/tui/sitemap/ --config configs/vitest.config.ts`
Expected: All PASS.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All PASS.

- [ ] **Step 5: Commit**

```bash
git add src/tui/sitemap/sitemap-page.tsx
git commit -m "feat: wire DefaultListRenderer into SitemapPage ContentZone"
```

---

## Chunk 3: Default Form Renderer

### Task 9: Implement DefaultFormRenderer with FormPage

**Files:**
- Modify: `src/tui/sitemap/default-form-renderer.tsx` (replace stub from Task 5)
- Test: `tests/tui/sitemap/default-form-renderer.test.tsx`

- [ ] **Step 1: Write failing test**

```typescript
// tests/tui/sitemap/default-form-renderer.test.tsx
vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

vi.mock("../../../src/tui/shell/content-area.js", () => ({
	useClaimEscape: () => vi.fn(),
}));

import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render } from "ink-testing-library";
import { DefaultFormRenderer } from "../../../src/tui/sitemap/default-form-renderer.js";
import { TuiHandlerRegistry } from "../../../src/tui/registry/tui-handler-registry.js";

describe("DefaultFormRenderer", () => {
	it("renders form title and fields", () => {
		const form = {
			title: "Add Risk",
			fields: [
				{ name: "name", label: "Name", type: "text" as const },
				{ name: "severity", label: "Severity", type: "select" as const, options: ["high", "medium", "low"] },
			],
			submitHandler: "raid:create-risk",
		};
		const registry = new TuiHandlerRegistry();
		registry.registerFormHandler("raid:create-risk", async () => ({ kind: "ok", message: "Created" }));
		const { lastFrame } = render(
			React.createElement(DefaultFormRenderer, {
				form,
				registry,
				actionCtx: { deps: {} as never, session: { pipeline: {} } },
				onComplete: vi.fn(),
				onCancel: vi.fn(),
			}),
		);
		const frame = lastFrame() ?? "";
		expect(frame).toContain("Add Risk");
		expect(frame).toContain("Name");
		expect(frame).toContain("Severity");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tui/sitemap/default-form-renderer.test.tsx --config configs/vitest.config.ts`
Expected: FAIL — stub doesn't render fields.

- [ ] **Step 3: Implement DefaultFormRenderer**

Replace the stub in `src/tui/sitemap/default-form-renderer.tsx`:

```typescript
// src/tui/sitemap/default-form-renderer.tsx
import React, { useState, useCallback } from "react";
import { FormPage } from "../pages/form-page.js";
import type { FormDef } from "./content-renderer-types.js";
import type { TuiHandlerRegistry } from "../registry/tui-handler-registry.js";
import type { TuiActionContext } from "../registry/tui-handler-types.js";

interface DefaultFormRendererProps {
	readonly form: FormDef;
	readonly registry: TuiHandlerRegistry;
	readonly actionCtx: TuiActionContext;
	readonly onComplete: () => void;
	readonly onCancel: () => void;
	readonly enabled?: boolean;
}

export function DefaultFormRenderer({ form, registry, actionCtx, onComplete, onCancel, enabled }: DefaultFormRendererProps): React.JSX.Element {
	const [values, setValues] = useState<Record<string, string | boolean>>(() => {
		const initial: Record<string, string | boolean> = {};
		for (const field of form.fields) {
			if (field.type === "toggle") {
				initial[field.name] = false;
			} else if (field.type === "select" && field.options && field.options.length > 0) {
				initial[field.name] = field.options[0];
			} else {
				initial[field.name] = "";
			}
		}
		return initial;
	});

	const handleValueChange = useCallback((name: string, value: string | boolean) => {
		setValues((prev) => ({ ...prev, [name]: value }));
	}, []);

	const handleSubmit = useCallback(async () => {
		if (!registry.hasFormHandler(form.submitHandler)) {
			onCancel();
			return;
		}
		const handler = registry.getFormHandler(form.submitHandler);
		const result = await handler(actionCtx, values as Record<string, unknown>);
		if (result.kind === "error") {
			// Could show error — for now, just cancel
			onCancel();
		} else {
			onComplete();
		}
	}, [registry, form.submitHandler, actionCtx, values, onComplete, onCancel]);

	return React.createElement(FormPage, {
		title: form.title,
		fields: form.fields,
		values,
		onValueChange: handleValueChange,
		onSubmit: handleSubmit,
		onCancel,
		enabled,
	});
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/tui/sitemap/default-form-renderer.test.tsx --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Run type check + full test suite**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: All clean.

- [ ] **Step 6: Commit**

```bash
git add src/tui/sitemap/default-form-renderer.tsx tests/tui/sitemap/default-form-renderer.test.tsx
git commit -m "feat: implement DefaultFormRenderer with FormPage integration"
```

---

## Chunk 4: CRUD Form Factory

### Task 10: Create CRUD form factory and replace stubs

**Files:**
- Create: `src/tui/sitemap/crud-form-factory.ts`
- Modify: `src/tui/registry/crud-effect-handlers.ts` — remove stubs that the factory replaces
- Modify: `src/tui/registry/register-tui-handlers.ts` — call factory
- Test: `tests/tui/sitemap/crud-form-factory.test.ts`

- [ ] **Step 1: Write failing test for CRUD form factory**

```typescript
// tests/tui/sitemap/crud-form-factory.test.ts
vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { describe, it, expect, vi } from "vitest";
import { TuiHandlerRegistry } from "../../../src/tui/registry/tui-handler-registry.js";
import { registerCrudForms } from "../../../src/tui/sitemap/crud-form-factory.js";

describe("crud form factory", () => {
	it("registers action handler and form handler for each variant", () => {
		const registry = new TuiHandlerRegistry();
		const mockStore = {
			create: vi.fn(),
			__descriptor: { name: "test", fields: {} },
		};
		registerCrudForms(registry, mockStore as never, [
			{
				actionId: "test:add",
				submitId: "test:create",
				title: "Add Item",
				fields: [{ name: "name", label: "Name", type: "text" as const }],
				buildDef: (data: Record<string, string | boolean>) => ({ name: data["name"] }),
			},
		]);
		expect(registry.hasHandler("test:add")).toBe(true);
		expect(registry.hasFormHandler("test:create")).toBe(true);
	});

	it("action handler returns kind:form with correct fields", async () => {
		const registry = new TuiHandlerRegistry();
		registerCrudForms(registry, { create: vi.fn(), __descriptor: {} } as never, [
			{
				actionId: "test:add",
				submitId: "test:create",
				title: "Add Item",
				fields: [{ name: "name", label: "Name", type: "text" as const }],
				buildDef: (d: Record<string, string | boolean>) => ({ name: d["name"] }),
			},
		]);
		const handler = registry.getHandler("test:add");
		const result = await handler({ deps: {} as never, session: { pipeline: {} } });
		expect(result.kind).toBe("form");
		if (result.kind === "form") {
			expect(result.title).toBe("Add Item");
			expect(result.fields).toHaveLength(1);
			expect(result.submitHandler).toBe("test:create");
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tui/sitemap/crud-form-factory.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create crud-form-factory.ts**

```typescript
// src/tui/sitemap/crud-form-factory.ts
import type { TuiHandlerRegistry } from "../registry/tui-handler-registry.js";
import type { FormFieldDef } from "../pages/form-page.js";
import type { StoreApi } from "../../infrastructure/store-engine.js";

export interface CrudFormVariant {
	readonly actionId: string;
	readonly submitId: string;
	readonly title: string;
	readonly fields: readonly FormFieldDef[];
	readonly buildDef: (data: Record<string, string | boolean>) => unknown;
}

export function registerCrudForms(
	registry: TuiHandlerRegistry,
	store: StoreApi<unknown, unknown>,
	variants: readonly CrudFormVariant[],
): void {
	for (const variant of variants) {
		registry.registerHandler(variant.actionId, async () => ({
			kind: "form",
			title: variant.title,
			fields: variant.fields,
			submitHandler: variant.submitId,
		}));

		registry.registerFormHandler(variant.submitId, async (ctx, data) => {
			if (!ctx.project) return { kind: "error", message: "No project selected" };
			try {
				store.create(ctx.deps, ctx.project.path, variant.buildDef(data as Record<string, string | boolean>));
				return { kind: "ok", message: `${variant.title} — created` };
			} catch (err) {
				return { kind: "error", message: err instanceof Error ? err.message : "Failed to create" };
			}
		});
	}
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/tui/sitemap/crud-form-factory.test.ts --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Remove replaced stubs from crud-effect-handlers.ts**

In `src/tui/registry/crud-effect-handlers.ts`, remove the handler registrations for all CRUD add/create actions that the factory will now handle. Keep the handlers that are NOT form-based (navigation-only, status messages, pipeline handlers).

Specifically remove: `raid:add-*`, `capa:add-*`, `deliverables:add`, `resources:add-*`, `timelog:add`, `req:add-*`, `raid:update-status`, `capa:update-status`, `deliverables:update-status`, `req:update-status`, `capture:idea`, `capture:note`, `capture:bug`.

Keep: `raid:list`, `capa:list`, `deliverables:list`, `resources:list`, `resources:financials`, `timelog:list`, `timelog:summary`, `req:list`, and all non-CRUD handlers.

- [ ] **Step 6: Wire factory into register-tui-handlers.ts**

Add CRUD form registration calls to `src/tui/registry/register-tui-handlers.ts`. Import stores and call `registerCrudForms` for each domain. This is a large step — create variants for all 6 CRUD domains (raid, capa, deliverables, resources, requirements, timelog) plus capture.

- [ ] **Step 7: Run type check + full test suite**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: All pass. Some existing handler tests may need updating if they tested the removed stubs.

- [ ] **Step 8: Commit**

```bash
git add src/tui/sitemap/crud-form-factory.ts src/tui/registry/crud-effect-handlers.ts src/tui/registry/register-tui-handlers.ts tests/tui/sitemap/crud-form-factory.test.ts
git commit -m "feat: CRUD form factory — replace stub handlers with form-returning handlers for 6 domains"
```

---

## Chunk 5: Iteration Management

### Task 11: Register iteration form handlers (Group A)

**Files:**
- Create: `src/tui/registry/iteration-handlers.ts`
- Test: `tests/tui/registry/iteration-handlers.test.ts`

- [ ] **Step 1: Write failing test for iteration:create handler**

```typescript
// tests/tui/registry/iteration-handlers.test.ts
vi.mock("../../../src/infrastructure/filesystem.js", () => ({ disk: {} }));

import { describe, it, expect, vi } from "vitest";
import { TuiHandlerRegistry } from "../../../src/tui/registry/tui-handler-registry.js";
import { registerIterationHandlers } from "../../../src/tui/registry/iteration-handlers.js";

describe("iteration handlers", () => {
	it("registers iteration:create as a form handler", async () => {
		const registry = new TuiHandlerRegistry();
		registerIterationHandlers(registry);
		expect(registry.hasHandler("iteration:create")).toBe(true);
		const result = await registry.getHandler("iteration:create")({ deps: {} as never, session: { pipeline: {} } });
		expect(result.kind).toBe("form");
	});

	it("registers iteration:advance as an effect handler", async () => {
		const registry = new TuiHandlerRegistry();
		registerIterationHandlers(registry);
		expect(registry.hasHandler("iteration:advance")).toBe(true);
	});

	it("registers all 22 iteration handlers", () => {
		const registry = new TuiHandlerRegistry();
		registerIterationHandlers(registry);
		const expectedIds = [
			"iteration:create", "iteration:edit-name", "iteration:edit-goal",
			"iteration:edit-description", "iteration:edit-dates", "iteration:edit-scope",
			"iteration:add-scope", "iteration:add-agent", "iteration:add-resource",
			"iteration:add-estimation", "iteration:advance", "iteration:remove-scope",
			"iteration:execute-full", "iteration:roster-task", "iteration:list",
			"iteration:browse", "iteration:plan-ahead",
		];
		for (const id of expectedIds) {
			expect(registry.hasHandler(id), `missing handler: ${id}`).toBe(true);
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/tui/registry/iteration-handlers.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create iteration-handlers.ts**

Implement all 22 handlers: form-based (Group A), effect (Group B), and navigation (Group C). Form handlers return `kind: "form"` with appropriate fields. Effect handlers call iteration store functions. Navigation handlers return `kind: "navigate"`.

Register corresponding form handlers for each form-returning action.

- [ ] **Step 4: Remove iteration stubs from crud-effect-handlers.ts**

The existing stubs `iteration:create` (if registered there) need to be removed to avoid duplicate registration.

- [ ] **Step 5: Wire into register-tui-handlers.ts**

Add `registerIterationHandlers(registry)` call.

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/tui/registry/iteration-handlers.test.ts --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 7: Run type check + full suite**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: All pass.

- [ ] **Step 8: Commit**

```bash
git add src/tui/registry/iteration-handlers.ts src/tui/registry/register-tui-handlers.ts src/tui/registry/crud-effect-handlers.ts tests/tui/registry/iteration-handlers.test.ts
git commit -m "feat: register 22 iteration management handlers (form + effect + navigation)"
```

---

### Task 12: Create iteration-detail and iterations custom content renderers

**Files:**
- Modify: `src/tui/sitemap/content-renderers.ts`
- Test: `tests/tui/sitemap/content-renderers.test.ts` (extend)

- [ ] **Step 1: Write failing test for iteration-detail renderer**

```typescript
it("renders iteration-detail content with scope items", () => {
	const renderer = getContentRenderer("iteration-detail");
	expect(renderer).toBeDefined();
});
```

- [ ] **Step 2: Implement iteration-detail renderer**

Add `IterationDetailRenderer` to `content-renderers.ts`. It renders:
- StatGrid with name, status, dates, progress
- Goal section
- ScrollableList for scope items with `[x]`/`[ ]` checkboxes
- Uses `useInput` for Enter → toggle scope done
- Calls `onExtraParams({ scopeIndex: String(selected) })` on selection change
- Agents section

- [ ] **Step 3: Implement iterations list renderer**

Add `IterationsListRenderer` to `content-renderers.ts`. Uses `DefaultListRenderer` internally with the iterations config from `list-configs.ts`.

- [ ] **Step 4: Register both in the contentRenderers map**

- [ ] **Step 5: Run tests**

Run: `npx vitest run tests/tui/sitemap/ --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 6: Run type check + full suite**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add src/tui/sitemap/content-renderers.ts tests/tui/sitemap/content-renderers.test.ts
git commit -m "feat: add iteration-detail and iterations custom content renderers"
```

---

## Chunk 6: Missing Loaders and Remaining Handlers

### Task 13: Add missing loaders + register in loader-map

**Files:**
- Create: `src/tui/loaders/iteration-planning-loader.ts`
- Create: `src/tui/loaders/agents-dashboard-loader.ts`
- Create: `src/tui/loaders/components-loader.ts`
- Create: `src/tui/loaders/component-detail-loader.ts`
- Create: `src/tui/loaders/docs-loader.ts`
- Create: `src/tui/loaders/workspaces-loader.ts`
- Modify: `src/tui/sitemap/loader-map.ts`

- [ ] **Step 1: Create each missing loader**

Each loader follows the same pattern as existing loaders — takes `LoaderContext`, returns typed data. Implementations:

- `iteration-planning-loader.ts` — calls `loadIterations`, returns iteration list + current in-progress iteration
- `agents-dashboard-loader.ts` — lists agent files from agentsConfig, returns name + domain + status
- `components-loader.ts` — reads components from projectConfig
- `component-detail-loader.ts` — reads single component by params.name
- `docs-loader.ts` — lists `.md` files in `docs/` directory
- `workspaces-loader.ts` — calls `shell.runCapture("git worktree list")` and parses output

- [ ] **Step 2: Add missing mappings to loader-map.ts**

Add entries for: `iteration-planning`, `agents-dashboard`, `agent-edit` (reuse `loadAgentDetail`), `components`, `component-detail`, `docs`, `onboarding-checklist` (reuse `loadOnboarding`), `workspaces`.

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: Clean.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run --config configs/vitest.config.ts`
Expected: All pass.

- [ ] **Step 5: Commit**

```bash
git add src/tui/loaders/ src/tui/sitemap/loader-map.ts
git commit -m "feat: add 6 missing loaders + wire all 10 blank pages in loader-map"
```

---

### Task 14: Add remaining custom content renderers

**Files:**
- Modify: `src/tui/sitemap/content-renderers.ts`

- [ ] **Step 1: Add projects-list renderer**

Uses `DefaultListRenderer` with the projects-list config.

- [ ] **Step 2: Add project-detail renderer**

Uses the existing dashboard renderer pattern (StatGrid + sections). No special interactivity needed — the generic dashboard is fine here. This is a thin wrapper that ensures project-specific field ordering.

- [ ] **Step 3: Add management hub renderer**

Renders nothing in the content zone — the management page is an action-only navigation hub. Returns a centered text: "Use the action keys below to navigate."

- [ ] **Step 4: Register all in contentRenderers map**

- [ ] **Step 5: Run type check + full suite**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: All pass.

- [ ] **Step 6: Commit**

```bash
git add src/tui/sitemap/content-renderers.ts
git commit -m "feat: add projects-list, project-detail, and management custom renderers"
```

---

## Chunk 7: Agents Chat as Native Feature

### Task 15: Move chat display components to src/tui/chat/

**Files:**
- Move: `src/infrastructure/chat/components/*.ts` → `src/tui/chat/`
- Modify: all files that import from the old location

- [ ] **Step 1: Move component files**

```bash
mkdir -p "src/tui/chat"
git mv src/infrastructure/chat/components/header-bar.ts src/tui/chat/header-bar.ts
git mv src/infrastructure/chat/components/message-area.ts src/tui/chat/message-area.ts
git mv src/infrastructure/chat/components/activity-bar.ts src/tui/chat/activity-bar.ts
git mv src/infrastructure/chat/components/input-area.ts src/tui/chat/input-area.ts
git mv src/infrastructure/chat/components/task-view.ts src/tui/chat/task-view.ts
```

- [ ] **Step 2: Update imports in all consumers**

Find all files that import from `infrastructure/chat/components/` and update paths to `tui/chat/`.

- [ ] **Step 3: Run type check**

Run: `npx tsc --noEmit --project configs/tsconfig.json`
Expected: Clean.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move chat display components from infrastructure to src/tui/chat"
```

---

### Task 16: Create agents-chat content renderer

**Files:**
- Modify: `src/tui/sitemap/content-renderers.ts`
- Test: `tests/tui/sitemap/content-renderers.test.ts` (extend)

- [ ] **Step 1: Add AgentsChatRenderer to content-renderers.ts**

Port the rendering logic from `agents-chat-page.tsx` into a `ContentRenderer` component. It uses:
- `useChatSession()` hook for session management
- `useTuiContext()` for deps and config
- The chat display components from `src/tui/chat/`
- `useEffect` for ChatShell initialization (same pattern as the old page)

The key difference: it receives `data`, `page`, `params`, `nav` from `SitemapPage` via `ContentRendererProps`. Navigation (goBack on exit) uses `nav.goBack()` instead of the old `goBack` prop.

- [ ] **Step 2: Register in contentRenderers map**

```typescript
"agents-chat": AgentsChatRenderer,
```

- [ ] **Step 3: Update sitemap.json — change agents-chat kind from component to page**

In `configs/sitemap.json`, change the `agents-chat` page:

```json
"agents-chat": {
  "kind": "page",
  ...
}
```

- [ ] **Step 4: Delete agents-chat-page.tsx**

```bash
git rm src/tui/pages/agents-chat-page.tsx
```

- [ ] **Step 5: Remove import from tui-entry.ts**

Remove `import "./pages/agents-chat-page.js";` from `tui-entry.ts`.

- [ ] **Step 6: Run type check + full suite**

Run: `npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: All pass.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: migrate agents-chat to native sitemap content renderer"
```

---

## Chunk 8: Quality Gate

### Task 17: Full quality gate and verification

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

- [ ] **Step 5: Verify build runs**

Run: `cd ../.. && .\flowti.cmd`

Verify:
1. Start page renders with actions
2. Navigate to Iterations → interactive list with selection + detail panel
3. Select an iteration → iteration-detail with scope items, stats
4. Press action key for "Add Scope" → inline form appears
5. Fill in text → Enter submit → scope item created
6. Press Escape → form cancels, returns to content
7. Navigate to RAID → interactive list with detail panel
8. Press "Add Risk" → inline form with name, severity, owner fields
9. Navigate to Agent Chat → chat interface renders inline
10. Navigate to Management → action-only hub with navigation keys
11. All pages show content (no "No loader" messages)

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix: quality gate adjustments from verification"
```
