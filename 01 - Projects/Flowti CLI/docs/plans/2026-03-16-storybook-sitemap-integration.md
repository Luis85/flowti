# Storybook Sitemap Integration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import all sitemap pages as Storybook stories rendered inside a terminal-view layout component, using the existing component library pipeline.

**Architecture:** A pure mapper function converts sitemap `PageObject` entries into instance JSONs with `type: "terminal-page"`. Two new blueprint definitions (`terminal-page`, `terminal-view`) reference custom `ComponentTemplateFn` functions that generate terminal-styled HTML factories. The existing library import pipeline scaffolds all files. A new sitemap action and data source wire the import into the CLI.

**Tech Stack:** TypeScript (ESM), Vitest, Storybook HTML/Vite, existing component system infrastructure.

**Spec:** `docs/specs/2026-03-16-storybook-sitemap-integration-design.md`

---

## Chunk 1: Foundation — Blueprint Definitions, Registry, and resolveBlueprint

## File Structure

| File | Responsibility |
|------|---------------|
| `src/domain/make/component/definitions/terminal-view.json` | Blueprint: terminal-view layout (kind `"layout"`, custom template IDs) |
| `src/domain/make/component/definitions/terminal-page.json` | Blueprint: terminal-styled page (kind `"page"`, custom template IDs) |
| `src/domain/make/component/component-registry.ts` | **Modify**: import + register new definitions and templates |
| `src/domain/make/component/component-commands.ts` | **Modify**: update `resolveBlueprint()` to match `d.id` first; update `buildVarsFromRecord()` to forward extra fields |
| `tests/domain/make/component/component-commands.test.ts` | **Modify**: add tests for id-first resolution + extra field forwarding |
| `tests/domain/make/component/component-registry.test.ts` | **Modify**: verify new definitions are loaded, update count from 8 to 10 |

---

### Task 1: Update `resolveBlueprint()` to match by `id` first

**Files:**
- Modify: `src/domain/make/component/component-commands.ts:64-66`
- Modify: `tests/domain/make/component/component-commands.test.ts`

- [ ] **Step 1: Write failing tests for id-based blueprint resolution**

Add to the existing `resolveBlueprint` describe block in `tests/domain/make/component/component-commands.test.ts`:

```typescript
it("resolves by id when id differs from kind", () => {
	// c4-system has id="c4-system" but kind="system"
	const result = resolveBlueprint("c4-system");
	expect(result).not.toBeNull();
	expect(result?.id).toBe("c4-system");
	expect(result?.kind).toBe("system");
});

it("still resolves by kind as fallback", () => {
	const result = resolveBlueprint("system");
	expect(result).not.toBeNull();
	expect(result?.kind).toBe("system");
});

it("prefers id match over kind match", () => {
	// "c4-component" is both an id and a kind — id match should win
	const result = resolveBlueprint("c4-component");
	expect(result).not.toBeNull();
	expect(result?.id).toBe("c4-component");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/component/component-commands.test.ts --config configs/vitest.config.ts`

Expected: First test FAILS — `resolveBlueprint("c4-system")` returns null because current code matches `d.kind === "c4-system"` and no definition has `kind: "c4-system"`.

- [ ] **Step 3: Update resolveBlueprint to match id first, then kind**

In `src/domain/make/component/component-commands.ts`, replace lines 64-66:

```typescript
export function resolveBlueprint(instanceType: string): ComponentDefinition | null {
	const defs = loadComponentDefinitions();
	return defs.find((d) => d.id === instanceType)
		?? defs.find((d) => d.kind === instanceType)
		?? null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/component/component-commands.test.ts --config configs/vitest.config.ts`

Expected: ALL tests pass (new and existing).

- [ ] **Step 5: Run full test suite to confirm no regressions**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`

Expected: All ~7000 tests pass.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/make/component/component-commands.ts" \
       "01 - Projects/Flowti CLI/tests/domain/make/component/component-commands.test.ts"
git commit -m "refactor: resolveBlueprint matches by id first, falls back to kind"
```

---

### Task 1b: Update `buildVarsFromRecord()` to forward extra instance JSON fields

**Files:**
- Modify: `src/domain/make/component/component-commands.ts:49-61`
- Modify: `tests/domain/make/component/component-commands.test.ts`

The existing `buildVarsFromRecord()` only forwards a hardcoded set of fields (`description`, `technology`, `containedBy`, `owner`, `domain`, `storybookFramework`). The `ComponentVariables` type has an index signature `[key: string]: string` that accepts arbitrary keys, but the function never populates them. Our mapper needs `pageActions`, `label`, `icon`, and `parent` to flow through to the templates.

- [ ] **Step 1: Write failing tests for extra field forwarding**

Add to the existing `buildVarsFromRecord` describe block in `tests/domain/make/component/component-commands.test.ts`:

```typescript
it("forwards arbitrary extra string fields via index signature", () => {
	const result = buildVarsFromRecord("Page", "page", {
		pageActions: '[{"name":"onOpen"}]',
		label: "Start Menu",
		icon: "home",
		parent: "project-detail",
	});
	expect(result.pageActions).toBe('[{"name":"onOpen"}]');
	expect(result.label).toBe("Start Menu");
	expect(result.icon).toBe("home");
	expect(result.parent).toBe("project-detail");
});

it("does not overwrite core fields with extra fields", () => {
	const result = buildVarsFromRecord("Test", "test", {
		name: "should-not-overwrite",
		kebab: "should-not-overwrite",
		pascal: "should-not-overwrite",
		description: "real description",
	});
	expect(result.name).toBe("Test");
	expect(result.kebab).toBe("test");
	expect(result.description).toBe("real description");
});
```

- [ ] **Step 2: Run tests to verify the first test fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/component/component-commands.test.ts --config configs/vitest.config.ts`

Expected: `"forwards arbitrary extra string fields"` FAILS — `result.pageActions` is `undefined`.

- [ ] **Step 3: Update buildVarsFromRecord to spread extra fields**

In `src/domain/make/component/component-commands.ts`, replace the `buildVarsFromRecord` function (lines 49-61):

```typescript
export function buildVarsFromRecord(name: string, kebab: string, fields: Record<string, unknown>): ComponentVariables {
	const extras: Record<string, string> = {};
	for (const [k, v] of Object.entries(fields)) {
		if (v !== undefined && v !== null) extras[k] = String(v);
	}
	return {
		...extras,
		name,
		kebab,
		pascal: toPascal(kebab),
		camel: toCamel(kebab),
		description: String(fields.description ?? ""),
		technology: String(fields.technology ?? ""),
		containedBy: String(fields.containedBy ?? ""),
		owner: String(fields.owner ?? ""),
		domain: String(fields.domain ?? ""),
		storybookFramework: String(fields.storybookFramework ?? ""),
	};
}
```

Note: `extras` is spread first, then core fields override — so `name`, `kebab`, `pascal`, `camel` and the explicit fields always win.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/component/component-commands.test.ts --config configs/vitest.config.ts`

Expected: ALL pass (new and existing).

- [ ] **Step 5: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/make/component/component-commands.ts" \
       "01 - Projects/Flowti CLI/tests/domain/make/component/component-commands.test.ts"
git commit -m "refactor: buildVarsFromRecord forwards extra instance JSON fields to template vars"
```

---

### Task 2: Create terminal-view blueprint definition

**Files:**
- Create: `src/domain/make/component/definitions/terminal-view.json`

- [ ] **Step 1: Create the terminal-view definition JSON**

Create `src/domain/make/component/definitions/terminal-view.json`:

```json
{
	"id": "terminal-view",
	"kind": "layout",
	"label": "Terminal View",
	"description": "A terminal window layout — dark background, title bar, monospace content area.",
	"icon": "terminal",
	"images": [],
	"prompts": [],
	"files": [
		{ "path": "components/{{kebab}}/{{kebab}}.md", "templateId": "component-doc" },
		{ "path": "components/{{kebab}}/{{kebab}}.test.ts", "templateId": "component-test" },
		{ "path": "components/{{kebab}}/{{kebab}}.json", "templateId": "component-definition" },
		{ "path": "components/{{kebab}}/{{kebab}}.ts", "templateId": "terminal-view-component" },
		{ "path": "components/{{kebab}}/{{kebab}}.stories.ts", "templateId": "component-story" },
		{ "path": "components/{{kebab}}/{{kebab}}.css", "templateId": "terminal-view-css" }
	],
	"metadata": {
		"type": "terminal-view",
		"status": "draft"
	},
	"properties": [
		{ "key": "title", "type": "string", "default": "Terminal", "description": "Window title shown in the title bar" },
		{ "key": "width", "type": "number", "default": 80, "description": "Terminal width in characters" },
		{ "key": "showTitleBar", "type": "boolean", "default": true, "description": "Whether to show the title bar" }
	],
	"actions": [],
	"variants": [
		{ "name": "narrow", "label": "Narrow (60ch)", "props": { "width": 60, "title": "Terminal" } },
		{ "name": "wide", "label": "Wide (120ch)", "props": { "width": 120, "title": "Terminal" } },
		{ "name": "noTitleBar", "label": "No Title Bar", "props": { "showTitleBar": false, "title": "Terminal" } }
	],
	"states": [],
	"nextSteps": [
		"Import terminal-view.css in Storybook preview.ts",
		"Use createTerminalView() to wrap page content"
	]
}
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/make/component/definitions/terminal-view.json"
git commit -m "feat: add terminal-view blueprint definition"
```

---

### Task 3: Create terminal-page blueprint definition

**Files:**
- Create: `src/domain/make/component/definitions/terminal-page.json`

- [ ] **Step 1: Create the terminal-page definition JSON**

Create `src/domain/make/component/definitions/terminal-page.json`:

```json
{
	"id": "terminal-page",
	"kind": "page",
	"label": "Terminal Page",
	"description": "A CLI page rendered inside a terminal-view layout — shows actions with keys and group separators.",
	"icon": "file-text",
	"images": [],
	"prompts": [],
	"files": [
		{ "path": "components/{{kebab}}/{{kebab}}.md", "templateId": "component-doc" },
		{ "path": "components/{{kebab}}/{{kebab}}.test.ts", "templateId": "component-test" },
		{ "path": "components/{{kebab}}/{{kebab}}.json", "templateId": "component-definition" },
		{ "path": "components/{{kebab}}/{{kebab}}.ts", "templateId": "terminal-page-component" },
		{ "path": "components/{{kebab}}/{{kebab}}.stories.ts", "templateId": "component-story" }
	],
	"metadata": {
		"type": "terminal-page",
		"status": "draft"
	},
	"properties": [
		{ "key": "title", "type": "string", "default": "", "description": "Page title" },
		{ "key": "description", "type": "string", "default": "", "description": "Page description" }
	],
	"actions": [
		{ "name": "onNavigate", "description": "Fired when the page is navigated to" }
	],
	"variants": [],
	"states": [
		{ "name": "empty", "label": "Empty", "description": "Page with no actions", "props": { "title": "Empty Page" } }
	],
	"nextSteps": [
		"Actions are auto-generated from sitemap data during import"
	]
}
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/make/component/definitions/terminal-page.json"
git commit -m "feat: add terminal-page blueprint definition"
```

---

### Task 4: Register new definitions and placeholder templates in the registry

**Files:**
- Modify: `src/domain/make/component/component-registry.ts`
- Modify: `tests/domain/make/component/component-registry.test.ts`

- [ ] **Step 1: Write failing test for new definitions**

Add to `tests/domain/make/component/component-registry.test.ts`.

First, update the existing count assertion on line 8 from `toHaveLength(8)` to `toHaveLength(10)`:

```typescript
it("loads all 10 bundled definitions", () => {
	expect(definitions).toHaveLength(10);
});
```

Then add new tests:

```typescript
it("includes terminal-view definition", () => {
	const defs = loadComponentDefinitions();
	const tvDef = defs.find((d) => d.id === "terminal-view");
	expect(tvDef).toBeDefined();
	expect(tvDef?.kind).toBe("layout");
});

it("includes terminal-page definition", () => {
	const defs = loadComponentDefinitions();
	const tpDef = defs.find((d) => d.id === "terminal-page");
	expect(tpDef).toBeDefined();
	expect(tpDef?.kind).toBe("page");
});

it("registers terminal-view-component template", () => {
	const reg = createComponentTemplateRegistry();
	expect(reg.has("terminal-view-component")).toBe(true);
});

it("registers terminal-page-component template", () => {
	const reg = createComponentTemplateRegistry();
	expect(reg.has("terminal-page-component")).toBe(true);
});

it("registers terminal-view-css template", () => {
	const reg = createComponentTemplateRegistry();
	expect(reg.has("terminal-view-css")).toBe(true);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/component/component-registry.test.ts --config configs/vitest.config.ts`

Expected: FAIL — definitions and templates not yet registered.

- [ ] **Step 3: Create placeholder template files**

Create three minimal template files that will be fully implemented in Chunk 2. Each must export a valid `ComponentTemplateFn`:

Create `src/domain/make/component/templates/terminal-view-component.ts`:

```typescript
/**
 * terminal-view-component.ts — HTML factory template for the terminal-view layout.
 *
 * Generates a createTerminalView() factory that renders a styled terminal window
 * with title bar, dot-trio, and content slot.
 */

import type {
	ComponentVariables,
	ComponentDefinition,
	ComponentTemplateDeps,
} from "../component-types.js";

export function terminalViewComponentTemplate(vars: ComponentVariables, _def: ComponentDefinition, _deps: ComponentTemplateDeps): string {
	return `export interface ${vars.pascal}Props {
\ttitle?: string;
\twidth?: number;
\tshowTitleBar?: boolean;
}

export function create${vars.pascal}(props: ${vars.pascal}Props = {}): HTMLElement {
\tconst el = document.createElement("div");
\tel.className = "terminal-view";
\tel.textContent = props.title ?? "Terminal";
\treturn el;
}
`;
}
```

Create `src/domain/make/component/templates/terminal-page-component.ts`:

```typescript
/**
 * terminal-page-component.ts — HTML factory template for terminal-styled CLI pages.
 *
 * Generates a page factory that renders sitemap actions inside a terminal-view wrapper
 * with keys, labels, and group separators.
 */

import type {
	ComponentVariables,
	ComponentDefinition,
	ComponentTemplateDeps,
} from "../component-types.js";

export function terminalPageComponentTemplate(vars: ComponentVariables, _def: ComponentDefinition, _deps: ComponentTemplateDeps): string {
	return `export interface ${vars.pascal}Props {
\ttitle?: string;
\tdescription?: string;
}

export function create${vars.pascal}(props: ${vars.pascal}Props = {}): HTMLElement {
\tconst el = document.createElement("div");
\tel.className = "terminal-page";
\tel.textContent = props.title ?? "${vars.pascal}";
\treturn el;
}
`;
}
```

Create `src/domain/make/component/templates/terminal-view-css.ts`:

```typescript
/**
 * terminal-view-css.ts — CSS template for the terminal-view layout.
 *
 * Generates terminal-view.css with dark terminal styling.
 */

import type {
	ComponentVariables,
	ComponentDefinition,
	ComponentTemplateDeps,
} from "../component-types.js";

export function terminalViewCssTemplate(_vars: ComponentVariables, _def: ComponentDefinition, _deps: ComponentTemplateDeps): string {
	return `/* Terminal View — placeholder CSS */
.terminal-view {
\tfont-family: monospace;
\tbackground: #1e1e2e;
\tcolor: #cdd6f4;
}
`;
}
```

- [ ] **Step 4: Register definitions and templates in component-registry.ts**

In `src/domain/make/component/component-registry.ts`, add imports and registrations:

Add imports after line 16:

```typescript
import { terminalViewComponentTemplate } from "./templates/terminal-view-component.js";
import { terminalPageComponentTemplate } from "./templates/terminal-page-component.js";
import { terminalViewCssTemplate } from "./templates/terminal-view-css.js";
```

Add JSON imports after line 27:

```typescript
import terminalViewDef from "./definitions/terminal-view.json" with { type: "json" };
import terminalPageDef from "./definitions/terminal-page.json" with { type: "json" };
```

Add to `BUNDLED_DEFINITIONS` array (after line 37):

```typescript
terminalViewDef as unknown as ComponentDefinition,
terminalPageDef as unknown as ComponentDefinition,
```

Add to `createComponentTemplateRegistry()` (after line 53):

```typescript
registry.set("terminal-view-component", terminalViewComponentTemplate);
registry.set("terminal-page-component", terminalPageComponentTemplate);
registry.set("terminal-view-css", terminalViewCssTemplate);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/component/component-registry.test.ts --config configs/vitest.config.ts`

Expected: ALL pass.

- [ ] **Step 6: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`

Expected: All tests pass, no regressions.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/make/component/component-registry.ts" \
       "01 - Projects/Flowti CLI/src/domain/make/component/templates/terminal-view-component.ts" \
       "01 - Projects/Flowti CLI/src/domain/make/component/templates/terminal-page-component.ts" \
       "01 - Projects/Flowti CLI/src/domain/make/component/templates/terminal-view-css.ts" \
       "01 - Projects/Flowti CLI/tests/domain/make/component/component-registry.test.ts"
git commit -m "feat: register terminal-view and terminal-page blueprints with placeholder templates"
```

---

## Chunk 2: Custom Templates — Terminal-Styled HTML Rendering

## File Structure

| File | Responsibility |
|------|---------------|
| `src/domain/make/component/templates/terminal-view-component.ts` | **Replace placeholder**: full terminal window HTML factory generator |
| `src/domain/make/component/templates/terminal-page-component.ts` | **Replace placeholder**: full CLI page factory generator with actions/groups |
| `src/domain/make/component/templates/terminal-view-css.ts` | **Replace placeholder**: full terminal CSS |
| `tests/domain/make/component/templates/terminal-view-component.test.ts` | Unit tests for layout template |
| `tests/domain/make/component/templates/terminal-page-component.test.ts` | Unit tests for page template |

---

### Task 5: Implement and test the terminal-view-component template

**Files:**
- Replace: `src/domain/make/component/templates/terminal-view-component.ts`
- Create: `tests/domain/make/component/templates/terminal-view-component.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/domain/make/component/templates/terminal-view-component.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { terminalViewComponentTemplate } from "../../../../../src/domain/make/component/templates/terminal-view-component.js";
import type { ComponentVariables, ComponentDefinition, ComponentTemplateDeps } from "../../../../../src/domain/make/component/component-types.js";

const mockDeps: ComponentTemplateDeps = {
	clock: { iso: () => "2026-01-01T00:00:00.000Z", ms: () => 0, now: () => new Date("2026-01-01"), safeIso: () => "2026-01-01T00-00-00" },
};

function vars(overrides: Partial<ComponentVariables> = {}): ComponentVariables {
	return { name: "Terminal View", kebab: "terminal-view", pascal: "TerminalView", camel: "terminalView", ...overrides };
}

function def(overrides: Partial<ComponentDefinition> = {}): ComponentDefinition {
	return {
		id: "terminal-view", kind: "layout", label: "Terminal View", description: "Terminal layout.",
		prompts: [], files: [], metadata: {},
		properties: [
			{ key: "title", type: "string", default: "Terminal", description: "Window title" },
			{ key: "width", type: "number", default: 80, description: "Width" },
			{ key: "showTitleBar", type: "boolean", default: true, description: "Show title bar" },
		],
		actions: [], variants: [], states: [], nextSteps: [],
		...overrides,
	};
}

describe("terminalViewComponentTemplate", () => {
	it("exports a TerminalViewProps interface", () => {
		const output = terminalViewComponentTemplate(vars(), def(), mockDeps);
		expect(output).toContain("export interface TerminalViewProps");
	});

	it("exports a createTerminalView factory function", () => {
		const output = terminalViewComponentTemplate(vars(), def(), mockDeps);
		expect(output).toContain("export function createTerminalView(");
	});

	it("creates a root element with terminal-view class", () => {
		const output = terminalViewComponentTemplate(vars(), def(), mockDeps);
		expect(output).toContain('"terminal-view"');
	});

	it("creates a title bar element with dot-trio", () => {
		const output = terminalViewComponentTemplate(vars(), def(), mockDeps);
		expect(output).toContain("terminal-view--title-bar");
		expect(output).toContain("terminal-view--dot");
	});

	it("creates a content slot element", () => {
		const output = terminalViewComponentTemplate(vars(), def(), mockDeps);
		expect(output).toContain("terminal-view--content");
	});

	it("respects showTitleBar property", () => {
		const output = terminalViewComponentTemplate(vars(), def(), mockDeps);
		expect(output).toContain("showTitleBar");
	});

	it("sets width from props", () => {
		const output = terminalViewComponentTemplate(vars(), def(), mockDeps);
		expect(output).toContain("width");
	});

	it("uses pascal-cased name for different component names", () => {
		const output = terminalViewComponentTemplate(vars({ pascal: "MyTerminal", camel: "myTerminal", kebab: "my-terminal" }), def(), mockDeps);
		expect(output).toContain("export interface MyTerminalProps");
		expect(output).toContain("export function createMyTerminal(");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/component/templates/terminal-view-component.test.ts --config configs/vitest.config.ts`

Expected: Most tests FAIL — placeholder only creates a basic div.

- [ ] **Step 3: Implement the full terminal-view-component template**

Replace the full content of `src/domain/make/component/templates/terminal-view-component.ts`:

```typescript
/**
 * terminal-view-component.ts — HTML factory template for the terminal-view layout.
 *
 * Generates a createTerminalView() factory that renders a styled terminal window
 * with title bar (dot-trio + title), and a content slot for page injection.
 */

import type {
	ComponentVariables,
	ComponentDefinition,
	ComponentTemplateDeps,
} from "../component-types.js";

export function terminalViewComponentTemplate(vars: ComponentVariables, _def: ComponentDefinition, _deps: ComponentTemplateDeps): string {
	return `export interface ${vars.pascal}Props {
\ttitle?: string;
\twidth?: number;
\tshowTitleBar?: boolean;
}

export function create${vars.pascal}(props: ${vars.pascal}Props = {}): HTMLElement {
\tconst title = props.title ?? "Terminal";
\tconst width = props.width ?? 80;
\tconst showTitleBar = props.showTitleBar ?? true;

\tconst el = document.createElement("div");
\tel.className = "terminal-view";
\tel.style.width = width + "ch";

\tif (showTitleBar) {
\t\tconst titleBar = document.createElement("div");
\t\ttitleBar.className = "terminal-view--title-bar";

\t\tconst dots = document.createElement("span");
\t\tdots.className = "terminal-view--dots";
\t\tfor (const color of ["#ff5f56", "#ffbd2e", "#27c93f"]) {
\t\t\tconst dot = document.createElement("span");
\t\t\tdot.className = "terminal-view--dot";
\t\t\tdot.style.backgroundColor = color;
\t\t\tdots.appendChild(dot);
\t\t}
\t\ttitleBar.appendChild(dots);

\t\tconst titleText = document.createElement("span");
\t\ttitleText.className = "terminal-view--title";
\t\ttitleText.textContent = title;
\t\ttitleBar.appendChild(titleText);

\t\tel.appendChild(titleBar);
\t}

\tconst content = document.createElement("div");
\tcontent.className = "terminal-view--content";
\tel.appendChild(content);

\treturn el;
}
`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/component/templates/terminal-view-component.test.ts --config configs/vitest.config.ts`

Expected: ALL pass.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/make/component/templates/terminal-view-component.ts" \
       "01 - Projects/Flowti CLI/tests/domain/make/component/templates/terminal-view-component.test.ts"
git commit -m "feat: implement terminal-view-component template with title bar and content slot"
```

---

### Task 6: Implement and test the terminal-page-component template

**Files:**
- Replace: `src/domain/make/component/templates/terminal-page-component.ts`
- Create: `tests/domain/make/component/templates/terminal-page-component.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/domain/make/component/templates/terminal-page-component.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { terminalPageComponentTemplate } from "../../../../../src/domain/make/component/templates/terminal-page-component.js";
import type { ComponentVariables, ComponentDefinition, ComponentTemplateDeps } from "../../../../../src/domain/make/component/component-types.js";

const mockDeps: ComponentTemplateDeps = {
	clock: { iso: () => "2026-01-01T00:00:00.000Z", ms: () => 0, now: () => new Date("2026-01-01"), safeIso: () => "2026-01-01T00-00-00" },
};

function vars(overrides: Partial<ComponentVariables> = {}): ComponentVariables {
	return {
		name: "Start", kebab: "start", pascal: "Start", camel: "start",
		label: "Start Menu", description: "Entry point.",
		pageActions: JSON.stringify([
			{ name: "onOpenProject", label: "Open Project", key: "1", group: "project", type: "handler" },
			{ name: "onQuit", label: "Quit", key: "q", group: "nav", type: "signal" },
		]),
		...overrides,
	};
}

function def(overrides: Partial<ComponentDefinition> = {}): ComponentDefinition {
	return {
		id: "terminal-page", kind: "page", label: "Terminal Page", description: "CLI page.",
		prompts: [], files: [], metadata: {},
		properties: [
			{ key: "title", type: "string", default: "", description: "Page title" },
		],
		actions: [{ name: "onNavigate", description: "Navigation" }],
		variants: [], states: [], nextSteps: [],
		...overrides,
	};
}

describe("terminalPageComponentTemplate", () => {
	it("exports a Props interface", () => {
		const output = terminalPageComponentTemplate(vars(), def(), mockDeps);
		expect(output).toContain("export interface StartProps");
	});

	it("exports a factory function", () => {
		const output = terminalPageComponentTemplate(vars(), def(), mockDeps);
		expect(output).toContain("export function createStart(");
	});

	it("imports createTerminalView from the terminal-view sibling", () => {
		const output = terminalPageComponentTemplate(vars(), def(), mockDeps);
		expect(output).toContain('import { createTerminalView } from "../terminal-view/terminal-view.js"');
	});

	it("renders the page label as header", () => {
		const output = terminalPageComponentTemplate(vars(), def(), mockDeps);
		expect(output).toContain("Start Menu");
	});

	it("renders action keys in brackets", () => {
		const output = terminalPageComponentTemplate(vars(), def(), mockDeps);
		expect(output).toContain("[1]");
		expect(output).toContain("[q]");
	});

	it("renders action labels", () => {
		const output = terminalPageComponentTemplate(vars(), def(), mockDeps);
		expect(output).toContain("Open Project");
		expect(output).toContain("Quit");
	});

	it("adds group separators between different groups", () => {
		const output = terminalPageComponentTemplate(vars(), def(), mockDeps);
		expect(output).toContain("separator");
	});

	it("handles empty pageActions gracefully", () => {
		const output = terminalPageComponentTemplate(vars({ pageActions: "[]" }), def(), mockDeps);
		expect(output).toContain("export function createStart(");
	});

	it("handles missing pageActions var", () => {
		const v = vars();
		delete (v as Record<string, unknown>).pageActions;
		const output = terminalPageComponentTemplate(v, def(), mockDeps);
		expect(output).toContain("export function createStart(");
	});

	it("uses pascal-cased name for custom components", () => {
		const output = terminalPageComponentTemplate(
			vars({ pascal: "ProjectDetail", camel: "projectDetail", kebab: "project-detail", label: "Project Detail", pageActions: "[]" }),
			def(), mockDeps,
		);
		expect(output).toContain("export interface ProjectDetailProps");
		expect(output).toContain("export function createProjectDetail(");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/component/templates/terminal-page-component.test.ts --config configs/vitest.config.ts`

Expected: Most FAIL — placeholder is a bare div.

- [ ] **Step 3: Implement the full terminal-page-component template**

Replace the full content of `src/domain/make/component/templates/terminal-page-component.ts`:

```typescript
/**
 * terminal-page-component.ts — HTML factory template for terminal-styled CLI pages.
 *
 * Generates a page factory that renders sitemap actions inside a terminal-view wrapper
 * with keys, labels, and group separators. Reads action data from the `pageActions`
 * template variable (JSON-serialized array of sitemap actions).
 */

import type {
	ComponentVariables,
	ComponentDefinition,
	ComponentTemplateDeps,
} from "../component-types.js";

interface TemplateAction {
	name: string;
	label: string;
	key?: string;
	group?: string;
	type?: string;
	hidden?: unknown;
	disabled?: unknown;
}

function parseActions(vars: ComponentVariables): TemplateAction[] {
	try {
		const raw = vars.pageActions;
		if (!raw) return [];
		return JSON.parse(raw) as TemplateAction[];
	} catch {
		return [];
	}
}

function buildActionLines(actions: TemplateAction[]): string {
	if (actions.length === 0) return "";

	const lines: string[] = [];
	let lastGroup: string | undefined;
	let separatorCount = 0;

	for (const action of actions) {
		if (lastGroup !== undefined && action.group !== lastGroup) {
			const sepName = `separator_${separatorCount++}`;
			lines.push(`\tconst ${sepName} = document.createElement("hr");`);
			lines.push(`\t${sepName}.className = "terminal-page--separator";`);
			lines.push(`\tcontent.appendChild(${sepName});`);
		}
		lastGroup = action.group;

		const varName = `action_${action.name}`;
		const keyDisplay = action.key ? `[${action.key}] ` : "";
		const cssClass = action.hidden ? "terminal-page--action terminal-page--action-hidden" :
			action.disabled ? "terminal-page--action terminal-page--action-disabled" :
				"terminal-page--action";

		lines.push(`\tconst ${varName} = document.createElement("div");`);
		lines.push(`\t${varName}.className = "${cssClass}";`);
		lines.push(`\t${varName}.innerHTML = '<span class="terminal-page--key">${keyDisplay}</span>${action.label}';`);
		lines.push(`\tcontent.appendChild(${varName});`);
	}

	return lines.join("\n");
}

export function terminalPageComponentTemplate(vars: ComponentVariables, _def: ComponentDefinition, _deps: ComponentTemplateDeps): string {
	const actions = parseActions(vars);
	const actionCode = buildActionLines(actions);
	const label = vars.label || vars.pascal;
	const description = vars.description || "";

	return `import { createTerminalView } from "../terminal-view/terminal-view.js";

export interface ${vars.pascal}Props {
\ttitle?: string;
\tdescription?: string;
}

export function create${vars.pascal}(props: ${vars.pascal}Props = {}): HTMLElement {
\tconst terminal = createTerminalView({ title: props.title ?? "${label}" });
\tconst content = terminal.querySelector(".terminal-view--content")!;

\tconst header = document.createElement("div");
\theader.className = "terminal-page--header";
\theader.innerHTML = '<h2>${label}</h2><p>${description}</p>';
\tcontent.appendChild(header);

${actionCode}

\treturn terminal;
}
`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/component/templates/terminal-page-component.test.ts --config configs/vitest.config.ts`

Expected: ALL pass.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/make/component/templates/terminal-page-component.ts" \
       "01 - Projects/Flowti CLI/tests/domain/make/component/templates/terminal-page-component.test.ts"
git commit -m "feat: implement terminal-page-component template with action rendering"
```

---

### Task 7: Implement and test the terminal-view-css template

**Files:**
- Replace: `src/domain/make/component/templates/terminal-view-css.ts`

- [ ] **Step 1: Write a test for the CSS template**

Add to `tests/domain/make/component/component-templates.test.ts` (the existing template test file):

```typescript
import { terminalViewCssTemplate } from "../../../../src/domain/make/component/templates/terminal-view-css.js";

describe("terminalViewCssTemplate", () => {
	it("generates CSS with terminal-view class", () => {
		const output = terminalViewCssTemplate(vars(), def(), mockDeps);
		expect(output).toContain(".terminal-view");
	});

	it("sets dark background color", () => {
		const output = terminalViewCssTemplate(vars(), def(), mockDeps);
		expect(output).toContain("#1e1e2e");
	});

	it("sets monospace font", () => {
		const output = terminalViewCssTemplate(vars(), def(), mockDeps);
		expect(output).toContain("monospace");
	});

	it("includes title bar styling", () => {
		const output = terminalViewCssTemplate(vars(), def(), mockDeps);
		expect(output).toContain(".terminal-view--title-bar");
	});

	it("includes dot styling", () => {
		const output = terminalViewCssTemplate(vars(), def(), mockDeps);
		expect(output).toContain(".terminal-view--dot");
	});

	it("includes content area styling", () => {
		const output = terminalViewCssTemplate(vars(), def(), mockDeps);
		expect(output).toContain(".terminal-view--content");
	});

	it("includes page action styling", () => {
		const output = terminalViewCssTemplate(vars(), def(), mockDeps);
		expect(output).toContain(".terminal-page--action");
	});

	it("includes key styling with dimmed appearance", () => {
		const output = terminalViewCssTemplate(vars(), def(), mockDeps);
		expect(output).toContain(".terminal-page--key");
	});

	it("includes separator styling", () => {
		const output = terminalViewCssTemplate(vars(), def(), mockDeps);
		expect(output).toContain(".terminal-page--separator");
	});

	it("includes hidden action styling", () => {
		const output = terminalViewCssTemplate(vars(), def(), mockDeps);
		expect(output).toContain(".terminal-page--action-hidden");
	});

	it("includes disabled action styling", () => {
		const output = terminalViewCssTemplate(vars(), def(), mockDeps);
		expect(output).toContain(".terminal-page--action-disabled");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/component/component-templates.test.ts --config configs/vitest.config.ts`

Expected: Most FAIL — placeholder CSS is minimal.

- [ ] **Step 3: Implement the full CSS template**

Replace the full content of `src/domain/make/component/templates/terminal-view-css.ts`:

```typescript
/**
 * terminal-view-css.ts — CSS template for the terminal-view layout.
 *
 * Generates terminal-view.css with dark terminal styling, title bar,
 * dot-trio, content area, and page action rendering classes.
 */

import type {
	ComponentVariables,
	ComponentDefinition,
	ComponentTemplateDeps,
} from "../component-types.js";

export function terminalViewCssTemplate(_vars: ComponentVariables, _def: ComponentDefinition, _deps: ComponentTemplateDeps): string {
	return `.terminal-view {
\tfont-family: "Cascadia Code", "Fira Code", "JetBrains Mono", monospace;
\tbackground: #1e1e2e;
\tcolor: #cdd6f4;
\tborder-radius: 8px;
\toverflow: hidden;
\tbox-shadow: 0 4px 24px rgba(0, 0, 0, 0.4);
}

.terminal-view--title-bar {
\tdisplay: flex;
\talign-items: center;
\tgap: 8px;
\tpadding: 8px 12px;
\tbackground: #181825;
\tborder-bottom: 1px solid #313244;
}

.terminal-view--dots {
\tdisplay: flex;
\tgap: 6px;
}

.terminal-view--dot {
\twidth: 12px;
\theight: 12px;
\tborder-radius: 50%;
\tdisplay: inline-block;
}

.terminal-view--title {
\tfont-size: 12px;
\tcolor: #a6adc8;
\tmargin-left: 8px;
}

.terminal-view--content {
\tpadding: 16px 20px;
\tline-height: 1.6;
}

.terminal-page--header h2 {
\tmargin: 0 0 4px 0;
\tfont-size: 16px;
\tcolor: #cdd6f4;
}

.terminal-page--header p {
\tmargin: 0 0 16px 0;
\tfont-size: 13px;
\tcolor: #a6adc8;
}

.terminal-page--action {
\tpadding: 2px 0;
\tfont-size: 14px;
}

.terminal-page--key {
\tcolor: #89b4fa;
\topacity: 0.7;
\tmargin-right: 4px;
}

.terminal-page--separator {
\tborder: none;
\tborder-top: 1px solid #313244;
\tmargin: 8px 0;
}

.terminal-page--action-hidden {
\topacity: 0.3;
}

.terminal-page--action-disabled {
\ttext-decoration: line-through;
\topacity: 0.5;
}
`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/component/component-templates.test.ts --config configs/vitest.config.ts`

Expected: ALL pass.

- [ ] **Step 5: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/make/component/templates/terminal-view-css.ts" \
       "01 - Projects/Flowti CLI/tests/domain/make/component/component-templates.test.ts"
git commit -m "feat: implement terminal-view CSS template with full terminal styling"
```

---

## Chunk 3: Sitemap Mapper — `sitemapToComponents()`

## File Structure

| File | Responsibility |
|------|---------------|
| `src/domain/make/component/sitemap-to-components.ts` | Pure mapper: `PageObject` entries -> `SitemapInstanceJson[]` |
| `tests/domain/make/component/sitemap-to-components.test.ts` | Unit tests for the mapper |

---

### Task 8: Implement and test `sitemapToComponents()`

**Files:**
- Create: `src/domain/make/component/sitemap-to-components.ts`
- Create: `tests/domain/make/component/sitemap-to-components.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/domain/make/component/sitemap-to-components.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { sitemapToComponents } from "../../../../src/domain/make/component/sitemap-to-components.js";
import type { PageObject } from "../../../../src/domain/sitemap/unified-page.js";

function page(overrides: Partial<PageObject> = {}): PageObject {
	return {
		kind: "page",
		label: "Test Page",
		description: "A test page.",
		actions: [],
		...overrides,
	} as PageObject;
}

describe("sitemapToComponents", () => {
	it("returns an instance JSON for each sitemap page", () => {
		const pages = {
			start: page({ label: "Start Menu", description: "Entry point." }),
			health: page({ label: "Health", description: "Health score." }),
		};
		const result = sitemapToComponents(pages, "cli");
		// N pages + 1 terminal-view layout
		expect(result).toHaveLength(3);
	});

	it("always includes a terminal-view layout instance", () => {
		const result = sitemapToComponents({ start: page() }, "cli");
		const tv = result.find((r) => r.name === "terminal-view");
		expect(tv).toBeDefined();
		expect(tv?.type).toBe("terminal-view");
	});

	it("uses terminal-page type for all page instances", () => {
		const pages = {
			start: page({ kind: "page" }),
			make: page({ kind: "list" }),
			detail: page({ kind: "component" }),
		};
		const result = sitemapToComponents(pages, "cli");
		const pageInstances = result.filter((r) => r.type === "terminal-page");
		expect(pageInstances).toHaveLength(3);
	});

	it("maps page key to name", () => {
		const result = sitemapToComponents({ "project-detail": page({ label: "Project Detail" }) }, "cli");
		const pd = result.find((r) => r.name === "project-detail");
		expect(pd).toBeDefined();
	});

	it("maps description with fallback to label", () => {
		const withDesc = sitemapToComponents({ a: page({ label: "A", description: "Desc A" }) }, "cli");
		expect(withDesc.find((r) => r.name === "a")?.description).toBe("Desc A");

		const noDesc = sitemapToComponents({ b: page({ label: "B", description: "" }) }, "cli");
		expect(noDesc.find((r) => r.name === "b")?.description).toBe("B");
	});

	it("preserves domain from page", () => {
		const result = sitemapToComponents({ start: page({ domain: "navigation" }) }, "cli");
		expect(result.find((r) => r.name === "start")?.domain).toBe("navigation");
	});

	it("preserves icon from page", () => {
		const result = sitemapToComponents({ start: page({ icon: "home" }) }, "cli");
		expect(result.find((r) => r.name === "start")?.icon).toBe("home");
	});

	it("preserves label from page", () => {
		const result = sitemapToComponents({ start: page({ label: "Start Menu" }) }, "cli");
		expect(result.find((r) => r.name === "start")?.label).toBe("Start Menu");
	});

	it("serializes actions as JSON string in pageActions field", () => {
		const actions = [
			{ name: "onOpen", label: "Open", type: "handler" as const, key: "1", group: "main" },
		];
		const result = sitemapToComponents({ start: page({ actions }) }, "cli");
		const inst = result.find((r) => r.name === "start");
		expect(inst?.pageActions).toBeDefined();
		const parsed = JSON.parse(inst!.pageActions!);
		expect(parsed).toHaveLength(1);
		expect(parsed[0].label).toBe("Open");
	});

	it("preserves parent from page", () => {
		const result = sitemapToComponents({ build: page({ parent: "project-detail" }) }, "cli");
		expect(result.find((r) => r.name === "build")?.parent).toBe("project-detail");
	});

	it("handles empty pages object", () => {
		const result = sitemapToComponents({}, "cli");
		// Just the terminal-view layout
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("terminal-view");
	});

	it("converts list kind pages without error", () => {
		const result = sitemapToComponents({ make: page({ kind: "list", label: "Make" }) }, "cli");
		const inst = result.find((r) => r.name === "make");
		expect(inst?.type).toBe("terminal-page");
	});

	it("converts form kind pages without error", () => {
		const result = sitemapToComponents({ form: page({ kind: "form", label: "Form" }) }, "cli");
		const inst = result.find((r) => r.name === "form");
		expect(inst?.type).toBe("terminal-page");
	});

	it("converts dialog kind pages without error", () => {
		const result = sitemapToComponents({ dlg: page({ kind: "dialog", label: "Dialog" }) }, "cli");
		const inst = result.find((r) => r.name === "dlg");
		expect(inst?.type).toBe("terminal-page");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/component/sitemap-to-components.test.ts --config configs/vitest.config.ts`

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the mapper**

Create `src/domain/make/component/sitemap-to-components.ts`:

```typescript
/**
 * sitemap-to-components.ts — Maps sitemap pages to component instance JSONs.
 *
 * Pure domain function. Reads the pages object from a parsed sitemap.json
 * and produces an array of lightweight instance JSON objects that the existing
 * library import pipeline (`importLibraryDefinition`) consumes.
 *
 * Every sitemap page becomes a `terminal-page` instance. A single
 * `terminal-view` layout instance is always included.
 */

import type { PageObject, PageAction } from "../../sitemap/unified-page.js";

export interface SitemapInstanceJson {
	type: string;
	name: string;
	description: string;
	domain?: string;
	label?: string;
	icon?: string;
	pageActions?: string;
	parent?: string;
}

function serializeActions(actions: readonly PageAction[]): string {
	return JSON.stringify(
		actions.map((a) => ({
			name: a.name,
			label: a.label,
			type: a.type,
			key: a.key,
			group: a.group,
			hidden: a.hidden,
			disabled: a.disabled,
		})),
	);
}

function makeTerminalViewInstance(): SitemapInstanceJson {
	return {
		type: "terminal-view",
		name: "terminal-view",
		description: "Terminal window layout — dark background, title bar, monospace content area.",
		label: "Terminal View",
	};
}

function mapPage(key: string, page: PageObject): SitemapInstanceJson {
	return {
		type: "terminal-page",
		name: key,
		description: page.description || page.label,
		domain: page.domain,
		label: page.label,
		icon: page.icon,
		pageActions: serializeActions(page.actions),
		parent: page.parent,
	};
}

export function sitemapToComponents(
	pages: Record<string, PageObject>,
	_projectKind: string,
): SitemapInstanceJson[] {
	const instances: SitemapInstanceJson[] = [makeTerminalViewInstance()];

	for (const [key, page] of Object.entries(pages)) {
		instances.push(mapPage(key, page));
	}

	return instances;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/make/component/sitemap-to-components.test.ts --config configs/vitest.config.ts`

Expected: ALL pass.

- [ ] **Step 5: Type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/make/component/sitemap-to-components.ts" \
       "01 - Projects/Flowti CLI/tests/domain/make/component/sitemap-to-components.test.ts"
git commit -m "feat: implement sitemapToComponents mapper — sitemap pages to instance JSONs"
```

---

## Chunk 4: Wiring — Action Handlers, Data Source, Sitemap, Config

## File Structure

| File | Responsibility |
|------|---------------|
| `src/ui/handlers/component-handlers.ts` | **Modify**: register `sitemap-ops` data source + `comp:sitemap-import` action |
| `configs/sitemap.json` | **Modify**: add `onImportSitemap` action to components page |
| `configs/flowti.config.json` | **Modify**: change framework to `"html"` |

---

### Task 9: Add the `onImportSitemap` action to sitemap.json

**Files:**
- Modify: `configs/sitemap.json`

- [ ] **Step 1: Add the import action to the components page**

In `configs/sitemap.json`, in the `"components"` page's `"actions"` array, add a new action after `"onRegenerateDirty"` (within the `"create"` group):

```json
{
	"name": "onImportSitemap",
	"label": "Import from Sitemap",
	"type": "handler",
	"target": "comp:sitemap-import",
	"key": "m",
	"group": "create"
}
```

- [ ] **Step 2: Validate sitemap**

Run: `cd "01 - Projects/Flowti CLI" && node -e "const s=JSON.parse(require('fs').readFileSync('configs/sitemap.json','utf-8')); console.log('pages:', Object.keys(s.pages).length); const c=s.pages.components; console.log('components actions:', c.actions.length); const imp=c.actions.find(a=>a.target==='comp:sitemap-import'); console.log('import action:', imp ? 'found' : 'MISSING');"`

Expected: `import action: found`

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/configs/sitemap.json"
git commit -m "feat: add Import from Sitemap action to components page"
```

---

### Task 10: Change framework to `"html"` in flowti.config.json

**Files:**
- Modify: `configs/flowti.config.json`

- [ ] **Step 1: Update the framework setting**

In `configs/flowti.config.json`, change line 37 from `"framework": "angular"` to `"framework": "html"`.

- [ ] **Step 2: Run full tests to verify no regressions**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`

Expected: All tests pass (the framework setting is read at runtime, not baked into test expectations).

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/configs/flowti.config.json"
git commit -m "chore: switch components framework from angular to html for vanilla Storybook"
```

---

### Task 11: Register `sitemap-ops` data source and `comp:sitemap-import` action handler

**Files:**
- Modify: `src/ui/handlers/component-handlers.ts`

- [ ] **Step 1: Add the `sitemap-ops` data source registration**

In `src/ui/handlers/component-handlers.ts`, inside `registerComponentHandlers()`, after the existing `comp:action-ref` handler (around line 138), add:

```typescript
registry.registerDataSource("sitemap-ops", async (ctx) => {
	if (!ctx.project) return [];
	const { disk, paths } = ctx.deps;
	const sitemapPath = paths.join(ctx.project.path, "configs", "sitemap.json");
	if (!disk.existsSync(sitemapPath)) return [];
	try {
		const raw = JSON.parse(disk.readFileSync(sitemapPath, "utf-8"));
		const pageCount = Object.keys(raw.pages ?? {}).length;
		return [{ key: "m", label: `Import from Sitemap (${pageCount} pages)`, action: "comp:sitemap-import" }];
	} catch {
		return [];
	}
});
```

- [ ] **Step 2: Add the `comp:sitemap-import` action handler**

Below the data source, add:

```typescript
registry.registerAction("comp:sitemap-import", async (ctx) => {
	if (!ctx.project) return undefined;
	const { disk, paths, clock, input, log } = ctx.deps;
	const { sitemapToComponents } = await import("../../domain/make/component/sitemap-to-components.js");
	const { importAllLibraryDefinitions } = await import("../../domain/make/component/component-library.js");
	const { getFramework } = await import("../../domain/make/component/storybook-settings.js");
	const { getFrameworkPackages } = await import("../../domain/make/component/storybook-service.js");

	const sitemapPath = paths.join(ctx.project.path, "configs", "sitemap.json");
	if (!disk.existsSync(sitemapPath)) {
		log(`\n  ${DIM}No sitemap.json found.${RESET}\n`);
		await input.waitForEnter();
		return undefined;
	}

	let sitemapData: { pages: Record<string, unknown> };
	try {
		sitemapData = JSON.parse(disk.readFileSync(sitemapPath, "utf-8"));
	} catch {
		log(`\n  ${DIM}Failed to parse sitemap.json.${RESET}\n`);
		await input.waitForEnter();
		return undefined;
	}

	const instances = sitemapToComponents(sitemapData.pages as never, "cli");
	log(`\n  ${BOLD}Importing ${instances.length} components from sitemap...${RESET}\n`);

	// Write instance JSONs to components/sitemap/
	const libraryDir = paths.join(ctx.project.path, "components", "sitemap");
	disk.mkdirSync(libraryDir, { recursive: true });
	for (const inst of instances) {
		const jsonPath = paths.join(libraryDir, `${inst.name}.json`);
		disk.writeFileSync(jsonPath, JSON.stringify(inst, null, "\t"), "utf-8");
	}

	// Import all definitions via the library pipeline
	const framework = getFramework(ctx.project.path, { disk, paths });
	const fw = getFrameworkPackages(framework);
	const result = importAllLibraryDefinitions(ctx.project.path, "sitemap", { disk, paths, clock }, fw.framework);

	log(`  ${GREEN}✓${RESET} Imported ${instances.length} definitions, ${result.total} files scaffolded.`);
	if (result.errors.length > 0) {
		for (const err of result.errors) log(`  ${YELLOW}!${RESET} ${err}`);
	}
	log("");
	await input.waitForEnter();
	return undefined;
});
```

- [ ] **Step 3: Write integration tests for the handler wiring**

Create `tests/ui/handlers/component-sitemap-import.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock",
	CLI_PROJECT: "/mock/cli",
	cliConfig: {},
}));

import { sitemapToComponents } from "../../../src/domain/make/component/sitemap-to-components.js";

beforeEach(() => { vi.clearAllMocks(); });

describe("sitemapToComponents integration with handler flow", () => {
	const sitemapJson = {
		version: 2,
		pages: {
			start: { kind: "page", label: "Start Menu", description: "Entry point.", actions: [
				{ name: "onOpen", label: "Open", type: "handler", key: "1", group: "main" },
			]},
			build: { kind: "page", label: "Build", description: "Build project.", actions: [], parent: "project-detail" },
		},
	};

	it("produces instance JSONs from parsed sitemap data", () => {
		const instances = sitemapToComponents(sitemapJson.pages as never, "cli");
		// 2 pages + 1 terminal-view
		expect(instances).toHaveLength(3);
	});

	it("all instances have a type field suitable for resolveBlueprint", () => {
		const instances = sitemapToComponents(sitemapJson.pages as never, "cli");
		for (const inst of instances) {
			expect(["terminal-page", "terminal-view"]).toContain(inst.type);
		}
	});

	it("instances can be serialized as JSON for writing to disk", () => {
		const instances = sitemapToComponents(sitemapJson.pages as never, "cli");
		for (const inst of instances) {
			const json = JSON.stringify(inst, null, "\t");
			expect(() => JSON.parse(json)).not.toThrow();
		}
	});

	it("page instance preserves action data in pageActions field", () => {
		const instances = sitemapToComponents(sitemapJson.pages as never, "cli");
		const start = instances.find((i) => i.name === "start");
		expect(start?.pageActions).toBeDefined();
		const actions = JSON.parse(start!.pageActions!);
		expect(actions[0].label).toBe("Open");
	});
});
```

- [ ] **Step 4: Run the integration tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/ui/handlers/component-sitemap-import.test.ts --config configs/vitest.config.ts`

Expected: ALL pass.

- [ ] **Step 5: Type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`

Expected: No errors.

- [ ] **Step 6: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/ui/handlers/component-handlers.ts" \
       "01 - Projects/Flowti CLI/tests/ui/handlers/component-sitemap-import.test.ts"
git commit -m "feat: wire sitemap-ops data source and comp:sitemap-import action handler"
```

---

### Task 12: Final verification

- [ ] **Step 1: Type check the entire project**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`

Expected: No errors.

- [ ] **Step 2: Lint the entire project**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint src/ --config configs/eslint.config.mjs`

Expected: No errors.

- [ ] **Step 3: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`

Expected: All tests pass, no regressions.

- [ ] **Step 4: Build**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`

Expected: Builds successfully.
