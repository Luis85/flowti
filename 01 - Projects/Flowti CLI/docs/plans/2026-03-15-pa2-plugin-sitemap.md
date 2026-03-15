# PA2: Plugin Sitemap — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Plugin's imperative view/command/ribbon registration with a declarative `plugin-sitemap.json` system — structure in JSON, behavior in handlers.

**Architecture:** A `plugin-sitemap.json` file declares all Plugin UI surface (views, commands, ribbon). A `PluginHandlerRegistry` maps handler IDs to typed functions. A `ConditionEvaluator` resolves boolean expressions over registered condition handlers. A `SitemapBootstrap` reads the sitemap and wires declarations to Obsidian APIs. Existing Hub views use `legacy: true` for zero behavior change.

**Tech Stack:** TypeScript (strict), Vitest, Obsidian API (mocked via alias)

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-15-plugin-sitemap-design.md`

**All paths relative to:** `Development/flowti/`

**Test command:** `npx vitest run <path>` (from `Development/flowti/`)

**Full suite:** `npm test` (from `Development/flowti/`)

---

## File Structure

### Source Files

| File | Responsibility |
|------|---------------|
| `src/domain/sitemap/plugin-sitemap-types.ts` | All sitemap type definitions (interfaces only) |
| `src/domain/sitemap/plugin-sitemap-validator.ts` | Pure validation function — no I/O |
| `src/infrastructure/handlers/plugin-handler-registry.ts` | Typed handler maps: tab, action, condition, data source |
| `src/infrastructure/handlers/condition-evaluator.ts` | Boolean expression parser over registered condition handlers |
| `src/infrastructure/sitemap/sitemap-bootstrap.ts` | Reads sitemap, wires to Obsidian APIs (registerView, addCommand, addRibbonIcon) |
| `src/ui/views/sitemap-hub-view.ts` | Generic hub view from ViewDef — extends BaseHubView |
| `plugin-sitemap.json` | Declarative UI surface: 8 legacy views, commands, ribbon |

### Test Files

| File | What It Tests |
|------|--------------|
| `tests/infrastructure/handlers/plugin-handler-registry.test.ts` | Register/get/clear for all 4 handler types, hasHandler, introspection |
| `tests/infrastructure/handlers/condition-evaluator.test.ts` | Handler resolution, &&, \|\|, !, parentheses, unknown handlers |
| `tests/domain/sitemap/plugin-sitemap-validator.test.ts` | Valid passes, invalid rejects, edge cases, all validation rules |
| `tests/ui/views/sitemap-hub-view.test.ts` | ViewDef mapping, tab rendering dispatch, component path |
| `tests/infrastructure/sitemap/sitemap-bootstrap.test.ts` | registerView/addCommand/addRibbonIcon calls, legacy factories, conditions |
| `tests/infrastructure/sitemap/sitemap-integration.test.ts` | Full boot: load JSON → validate → register → bootstrap → assert |

---

## Chunk 1: Sitemap Types + Handler Registry

### Task 1: Create sitemap type definitions

**Files:**
- Create: `src/domain/sitemap/plugin-sitemap-types.ts`

No tests needed — this file contains only TypeScript interfaces.

- [ ] **Step 1: Create the types file**

Create `src/domain/sitemap/plugin-sitemap-types.ts`:

```typescript
export interface PluginSitemap {
	version: 2;
	views: Record<string, ViewDef>;
	commands: CommandDef[];
	ribbon: RibbonDef[];
	modals?: Record<string, ModalDef>;
}

export interface ViewDef {
	kind: "hub" | "panel" | "leaf";
	label: string;
	icon: string;
	type: string;
	tabs?: SitemapTabDef[];
	dataSources?: DataSourceRef[];
	conditions?: ConditionSet;
	legacy?: boolean;
}

export interface SitemapTabDef {
	id: string;
	label: string;
	icon: string;
	handler?: string;
	component?: string;
	dataSource?: string;
	searchPlaceholder?: string;
}

export interface CommandDef {
	id: string;
	name: string;
	description?: string;
	domain?: string;
	category?: string;
	handler: string;
	hotkey?: string;
	icon?: string;
	conditions?: ConditionSet;
}

export interface RibbonDef {
	icon: string;
	label: string;
	action: string;
	conditions?: ConditionSet;
}

export interface ModalDef {
	kind: "form" | "confirm" | "display";
	label: string;
	fields?: FieldDef[];
	submit?: string;
	conditions?: ConditionSet;
}

export interface FieldDef {
	id: string;
	type: "text" | "textarea" | "select" | "tags" | "toggle" | "number";
	label?: string;
	placeholder?: string;
	options?: string[];
	required?: boolean;
	default?: string;
}

export interface DataSourceRef {
	id: string;
	slot?: string;
	params?: Record<string, string>;
}

export interface ConditionSet {
	hidden?: string;
	disabled?: string;
}
```

Note: Named `SitemapTabDef` to avoid collision with BaseHubView's `TabDef` (which has `searchPlaceholder` as required).

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd "Development/flowti" && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/src/domain/sitemap/plugin-sitemap-types.ts" && git commit -m "feat(plugin): add plugin-sitemap type definitions"
```

---

### Task 2: Create PluginHandlerRegistry (TDD)

**Files:**
- Create: `tests/infrastructure/handlers/plugin-handler-registry.test.ts`
- Create: `src/infrastructure/handlers/plugin-handler-registry.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/infrastructure/handlers/plugin-handler-registry.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import type { TabHandler, ActionHandler, ConditionHandler, DataSourceHandler } from "../../../src/infrastructure/handlers/plugin-handler-registry";

describe("PluginHandlerRegistry", () => {
	function createRegistry(): PluginHandlerRegistry {
		return new PluginHandlerRegistry();
	}

	describe("tab handlers", () => {
		it("registers and retrieves a tab handler", () => {
			const registry = createRegistry();
			const handler: TabHandler = vi.fn();
			registry.registerTabHandler("analytics:dashboard", handler);
			expect(registry.getTabHandler("analytics:dashboard")).toBe(handler);
		});

		it("returns undefined for unregistered tab handler", () => {
			const registry = createRegistry();
			expect(registry.getTabHandler("nonexistent")).toBeUndefined();
		});

		it("overwrites on duplicate registration", () => {
			const registry = createRegistry();
			const first: TabHandler = vi.fn();
			const second: TabHandler = vi.fn();
			registry.registerTabHandler("tab:x", first);
			registry.registerTabHandler("tab:x", second);
			expect(registry.getTabHandler("tab:x")).toBe(second);
		});
	});

	describe("action handlers", () => {
		it("registers and retrieves an action handler", () => {
			const registry = createRegistry();
			const handler: ActionHandler = vi.fn();
			registry.registerAction("capture:idea", handler);
			expect(registry.getAction("capture:idea")).toBe(handler);
		});

		it("returns undefined for unregistered action", () => {
			const registry = createRegistry();
			expect(registry.getAction("nope")).toBeUndefined();
		});
	});

	describe("condition handlers", () => {
		it("registers and retrieves a condition handler", () => {
			const registry = createRegistry();
			const handler: ConditionHandler = vi.fn(() => true);
			registry.registerCondition("no-active-train", handler);
			expect(registry.getCondition("no-active-train")).toBe(handler);
		});

		it("returns undefined for unregistered condition", () => {
			const registry = createRegistry();
			expect(registry.getCondition("nope")).toBeUndefined();
		});
	});

	describe("data source handlers", () => {
		it("registers and retrieves a data source handler", () => {
			const registry = createRegistry();
			const handler: DataSourceHandler = vi.fn(() => []);
			registry.registerDataSource("analytics:measurements", handler);
			expect(registry.getDataSource("analytics:measurements")).toBe(handler);
		});

		it("returns undefined for unregistered data source", () => {
			const registry = createRegistry();
			expect(registry.getDataSource("nope")).toBeUndefined();
		});
	});

	describe("introspection", () => {
		it("hasHandler returns true for any registered handler type", () => {
			const registry = createRegistry();
			registry.registerAction("action:x", vi.fn());
			registry.registerCondition("cond:y", vi.fn(() => false));
			expect(registry.hasHandler("action:x")).toBe(true);
			expect(registry.hasHandler("cond:y")).toBe(true);
			expect(registry.hasHandler("unknown")).toBe(false);
		});

		it("getRegisteredIds returns all handler IDs across types", () => {
			const registry = createRegistry();
			registry.registerTabHandler("tab:a", vi.fn());
			registry.registerAction("action:b", vi.fn());
			registry.registerCondition("cond:c", vi.fn(() => false));
			registry.registerDataSource("ds:d", vi.fn(() => null));
			const ids = registry.getRegisteredIds();
			expect(ids).toContain("tab:a");
			expect(ids).toContain("action:b");
			expect(ids).toContain("cond:c");
			expect(ids).toContain("ds:d");
			expect(ids).toHaveLength(4);
		});

		it("clear removes all handlers", () => {
			const registry = createRegistry();
			registry.registerTabHandler("tab:a", vi.fn());
			registry.registerAction("action:b", vi.fn());
			registry.registerCondition("cond:c", vi.fn(() => false));
			registry.registerDataSource("ds:d", vi.fn(() => null));
			registry.clear();
			expect(registry.getRegisteredIds()).toHaveLength(0);
			expect(registry.hasHandler("tab:a")).toBe(false);
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "Development/flowti" && npx vitest run tests/infrastructure/handlers/plugin-handler-registry.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement PluginHandlerRegistry**

Create `src/infrastructure/handlers/plugin-handler-registry.ts`:

```typescript
import type { IEventBus } from "../events/types";
import type { ILogger } from "../logger/types";

export interface TabContext {
	tabId: string;
	viewId: string;
	eventBus: IEventBus;
	searchText?: string;
}

export interface ActionContext {
	eventBus: IEventBus;
	app: unknown;
	logger: ILogger;
	params?: Record<string, string>;
}

export interface ConditionContext {
	app: unknown;
	eventBus: IEventBus;
}

export interface DataSourceContext {
	eventBus: IEventBus;
	params?: Record<string, string>;
}

export type TabHandler = (container: HTMLElement, ctx: TabContext) => void | Promise<void>;
export type ActionHandler = (ctx: ActionContext) => void | Promise<void>;
export type ConditionHandler = (ctx: ConditionContext) => boolean;
export type DataSourceHandler = (ctx: DataSourceContext) => unknown | Promise<unknown>;

export class PluginHandlerRegistry {
	private tabs = new Map<string, TabHandler>();
	private actions = new Map<string, ActionHandler>();
	private conditions = new Map<string, ConditionHandler>();
	private dataSources = new Map<string, DataSourceHandler>();

	registerTabHandler(id: string, handler: TabHandler): void {
		this.tabs.set(id, handler);
	}

	getTabHandler(id: string): TabHandler | undefined {
		return this.tabs.get(id);
	}

	registerAction(id: string, handler: ActionHandler): void {
		this.actions.set(id, handler);
	}

	getAction(id: string): ActionHandler | undefined {
		return this.actions.get(id);
	}

	registerCondition(id: string, handler: ConditionHandler): void {
		this.conditions.set(id, handler);
	}

	getCondition(id: string): ConditionHandler | undefined {
		return this.conditions.get(id);
	}

	registerDataSource(id: string, handler: DataSourceHandler): void {
		this.dataSources.set(id, handler);
	}

	getDataSource(id: string): DataSourceHandler | undefined {
		return this.dataSources.get(id);
	}

	hasHandler(id: string): boolean {
		return this.tabs.has(id) || this.actions.has(id) || this.conditions.has(id) || this.dataSources.has(id);
	}

	getRegisteredIds(): string[] {
		return [
			...this.tabs.keys(),
			...this.actions.keys(),
			...this.conditions.keys(),
			...this.dataSources.keys(),
		];
	}

	clear(): void {
		this.tabs.clear();
		this.actions.clear();
		this.conditions.clear();
		this.dataSources.clear();
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "Development/flowti" && npx vitest run tests/infrastructure/handlers/plugin-handler-registry.test.ts
```

Expected: All 11 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/src/infrastructure/handlers/plugin-handler-registry.ts" "Development/flowti/tests/infrastructure/handlers/plugin-handler-registry.test.ts" && git commit -m "feat(plugin): add PluginHandlerRegistry with typed handler maps"
```

---

## Chunk 2: Condition Evaluator

### Task 3: Create ConditionEvaluator (TDD)

**Files:**
- Create: `tests/infrastructure/handlers/condition-evaluator.test.ts`
- Create: `src/infrastructure/handlers/condition-evaluator.ts`

The evaluator resolves condition expressions from plugin-sitemap.json. It looks up handler IDs in the registry and supports `&&`, `||`, `!`, and parentheses.

- [ ] **Step 1: Write failing tests**

Create `tests/infrastructure/handlers/condition-evaluator.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { ConditionEvaluator } from "../../../src/infrastructure/handlers/condition-evaluator";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import type { ConditionContext } from "../../../src/infrastructure/handlers/plugin-handler-registry";

describe("ConditionEvaluator", () => {
	function setup() {
		const registry = new PluginHandlerRegistry();
		const evaluator = new ConditionEvaluator(registry);
		const ctx: ConditionContext = { app: {}, eventBus: { emit: vi.fn(), on: vi.fn() } as unknown as ConditionContext["eventBus"] };
		return { registry, evaluator, ctx };
	}

	describe("single handler ID", () => {
		it("returns true when condition handler returns true", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("no-active-train", () => true);
			expect(evaluator.evaluate("no-active-train", ctx)).toBe(true);
		});

		it("returns false when condition handler returns false", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("no-active-train", () => false);
			expect(evaluator.evaluate("no-active-train", ctx)).toBe(false);
		});

		it("passes context to condition handler", () => {
			const { registry, evaluator, ctx } = setup();
			const handler = vi.fn(() => true);
			registry.registerCondition("check", handler);
			evaluator.evaluate("check", ctx);
			expect(handler).toHaveBeenCalledWith(ctx);
		});
	});

	describe("negation", () => {
		it("negates a handler result", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("active", () => true);
			expect(evaluator.evaluate("!active", ctx)).toBe(false);
		});

		it("double negation", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("active", () => true);
			expect(evaluator.evaluate("!!active", ctx)).toBe(true);
		});
	});

	describe("logical AND", () => {
		it("returns true when both sides are true", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("a", () => true);
			registry.registerCondition("b", () => true);
			expect(evaluator.evaluate("a && b", ctx)).toBe(true);
		});

		it("returns false when one side is false", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("a", () => true);
			registry.registerCondition("b", () => false);
			expect(evaluator.evaluate("a && b", ctx)).toBe(false);
		});
	});

	describe("logical OR", () => {
		it("returns true when one side is true", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("a", () => false);
			registry.registerCondition("b", () => true);
			expect(evaluator.evaluate("a || b", ctx)).toBe(true);
		});

		it("returns false when both are false", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("a", () => false);
			registry.registerCondition("b", () => false);
			expect(evaluator.evaluate("a || b", ctx)).toBe(false);
		});
	});

	describe("parentheses", () => {
		it("groups expressions", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("a", () => true);
			registry.registerCondition("b", () => false);
			registry.registerCondition("c", () => true);
			// Without parens: a || b && c → a || (b && c) → true
			// With parens: (a || b) && c → true && true → true
			expect(evaluator.evaluate("(a || b) && c", ctx)).toBe(true);
		});

		it("negation on grouped expression", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("a", () => true);
			registry.registerCondition("b", () => true);
			expect(evaluator.evaluate("!(a && b)", ctx)).toBe(false);
		});
	});

	describe("operator precedence", () => {
		it("AND binds tighter than OR", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("a", () => true);
			registry.registerCondition("b", () => false);
			registry.registerCondition("c", () => false);
			// a || b && c → a || (false && false) → true || false → true
			expect(evaluator.evaluate("a || b && c", ctx)).toBe(true);
		});
	});

	describe("compound with negation", () => {
		it("no-active-train && !session-active", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("no-active-train", () => true);
			registry.registerCondition("session-active", () => false);
			expect(evaluator.evaluate("no-active-train && !session-active", ctx)).toBe(true);
		});
	});

	describe("unknown handlers", () => {
		it("returns false for unknown handler ID (safe default)", () => {
			const { evaluator, ctx } = setup();
			expect(evaluator.evaluate("unknown-handler", ctx)).toBe(false);
		});

		it("returns false for unknown handler in compound", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("known", () => true);
			expect(evaluator.evaluate("known && unknown", ctx)).toBe(false);
		});
	});

	describe("whitespace handling", () => {
		it("handles extra whitespace", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("a", () => true);
			registry.registerCondition("b", () => true);
			expect(evaluator.evaluate("  a  &&  b  ", ctx)).toBe(true);
		});

		it("handles no whitespace around operators", () => {
			const { registry, evaluator, ctx } = setup();
			registry.registerCondition("a", () => true);
			registry.registerCondition("b", () => false);
			expect(evaluator.evaluate("a&&b", ctx)).toBe(false);
		});
	});

	describe("empty expression", () => {
		it("returns false for empty string", () => {
			const { evaluator, ctx } = setup();
			expect(evaluator.evaluate("", ctx)).toBe(false);
		});

		it("returns false for whitespace-only", () => {
			const { evaluator, ctx } = setup();
			expect(evaluator.evaluate("   ", ctx)).toBe(false);
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "Development/flowti" && npx vitest run tests/infrastructure/handlers/condition-evaluator.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement ConditionEvaluator**

Create `src/infrastructure/handlers/condition-evaluator.ts`:

```typescript
import type { PluginHandlerRegistry, ConditionContext } from "./plugin-handler-registry";

/**
 * Evaluates boolean condition expressions over registered condition handlers.
 *
 * Grammar:
 *   expression := or_expr
 *   or_expr    := and_expr ("||" and_expr)*
 *   and_expr   := unary ("&&" unary)*
 *   unary      := "!" unary | atom
 *   atom       := "(" expression ")" | handler_id
 *   handler_id := [a-zA-Z0-9_:-]+
 *
 * Unknown handler IDs evaluate to false (safe default — item stays visible).
 */
export class ConditionEvaluator {
	constructor(private registry: PluginHandlerRegistry) {}

	evaluate(expression: string, ctx: ConditionContext): boolean {
		const trimmed = expression.trim();
		if (!trimmed) return false;

		const tokens = this.tokenize(trimmed);
		if (tokens.length === 0) return false;

		const parser = new Parser(tokens, this.registry, ctx);
		return parser.parseOr();
	}

	private tokenize(input: string): string[] {
		const tokens: string[] = [];
		let i = 0;
		while (i < input.length) {
			if (input[i] === " " || input[i] === "\t") {
				i++;
				continue;
			}
			if (input[i] === "(" || input[i] === ")") {
				tokens.push(input[i]);
				i++;
				continue;
			}
			if (input[i] === "!") {
				tokens.push("!");
				i++;
				continue;
			}
			if (input[i] === "&" && input[i + 1] === "&") {
				tokens.push("&&");
				i += 2;
				continue;
			}
			if (input[i] === "|" && input[i + 1] === "|") {
				tokens.push("||");
				i += 2;
				continue;
			}
			// Handler ID: [a-zA-Z0-9_:-]
			let id = "";
			while (i < input.length && /[a-zA-Z0-9_:\-]/.test(input[i])) {
				id += input[i];
				i++;
			}
			if (id) tokens.push(id);
		}
		return tokens;
	}
}

class Parser {
	private pos = 0;

	constructor(
		private tokens: string[],
		private registry: PluginHandlerRegistry,
		private ctx: ConditionContext,
	) {}

	parseOr(): boolean {
		let left = this.parseAnd();
		while (this.peek() === "||") {
			this.consume();
			const right = this.parseAnd();
			left = left || right;
		}
		return left;
	}

	private parseAnd(): boolean {
		let left = this.parseUnary();
		while (this.peek() === "&&") {
			this.consume();
			const right = this.parseUnary();
			left = left && right;
		}
		return left;
	}

	private parseUnary(): boolean {
		if (this.peek() === "!") {
			this.consume();
			return !this.parseUnary();
		}
		return this.parseAtom();
	}

	private parseAtom(): boolean {
		if (this.peek() === "(") {
			this.consume(); // (
			const result = this.parseOr();
			this.consume(); // )
			return result;
		}
		// Handler ID
		const id = this.consume();
		if (!id) return false;
		const handler = this.registry.getCondition(id);
		if (!handler) return false;
		return handler(this.ctx);
	}

	private peek(): string | undefined {
		return this.tokens[this.pos];
	}

	private consume(): string | undefined {
		return this.tokens[this.pos++];
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "Development/flowti" && npx vitest run tests/infrastructure/handlers/condition-evaluator.test.ts
```

Expected: All 18 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/src/infrastructure/handlers/condition-evaluator.ts" "Development/flowti/tests/infrastructure/handlers/condition-evaluator.test.ts" && git commit -m "feat(plugin): add ConditionEvaluator with boolean expression parser"
```

---

## Chunk 3: Schema Validator

### Task 4: Create validatePluginSitemap (TDD)

**Files:**
- Create: `tests/domain/sitemap/plugin-sitemap-validator.test.ts`
- Create: `src/domain/sitemap/plugin-sitemap-validator.ts`

Pure domain function — no I/O, no mocks needed. Validates a parsed JSON object against the plugin-sitemap schema.

**Note:** The spec lists "View IDs unique" as an error-level rule, but `JSON.parse()` silently deduplicates object keys — the validator cannot detect this from a parsed object. This rule is dropped from the validator. Command/tab ID uniqueness IS checkable (they're arrays).

- [ ] **Step 1: Write failing tests**

Create `tests/domain/sitemap/plugin-sitemap-validator.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validatePluginSitemap } from "../../../src/domain/sitemap/plugin-sitemap-validator";
import type { PluginSitemap } from "../../../src/domain/sitemap/plugin-sitemap-types";

function validSitemap(overrides?: Partial<PluginSitemap>): PluginSitemap {
	return {
		version: 2,
		views: {
			"test-hub": {
				kind: "hub",
				label: "Test Hub",
				icon: "home",
				type: "flowti-test-hub",
				legacy: true,
			},
		},
		commands: [
			{ id: "flowti:test", name: "Test", handler: "test:action" },
		],
		ribbon: [
			{ icon: "home", label: "Test", action: "view:flowti-test-hub" },
		],
		...overrides,
	};
}

describe("validatePluginSitemap", () => {
	describe("valid sitemaps", () => {
		it("accepts a valid sitemap", () => {
			const result = validatePluginSitemap(validSitemap());
			expect(result.valid).toBe(true);
			expect(result.errors).toHaveLength(0);
		});

		it("accepts sitemap with tabs", () => {
			const sitemap = validSitemap({
				views: {
					"hub": {
						kind: "hub", label: "Hub", icon: "home", type: "flowti-hub",
						tabs: [
							{ id: "tab1", label: "Tab 1", icon: "star", handler: "hub:tab1" },
							{ id: "tab2", label: "Tab 2", icon: "zap", component: "flowti-widget" },
						],
					},
				},
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(true);
		});

		it("accepts sitemap with modals", () => {
			const sitemap = validSitemap({
				modals: {
					"capture": {
						kind: "form",
						label: "Capture",
						fields: [
							{ id: "title", type: "text", placeholder: "Title" },
							{ id: "kind", type: "select", options: ["idea", "task"] },
						],
						submit: "capture:create",
					},
				},
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(true);
		});

		it("accepts sitemap with conditions on commands", () => {
			const sitemap = validSitemap({
				commands: [
					{ id: "flowti:x", name: "X", handler: "x:run", conditions: { hidden: "no-train" } },
				],
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(true);
		});
	});

	describe("version", () => {
		it("rejects missing version", () => {
			const sitemap = { views: {}, commands: [], ribbon: [] };
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
			expect(result.errors).toContainEqual(expect.objectContaining({
				path: "version",
				severity: "error",
			}));
		});

		it("rejects wrong version", () => {
			const result = validatePluginSitemap({ ...validSitemap(), version: 1 as unknown as 2 });
			expect(result.valid).toBe(false);
		});
	});

	describe("views", () => {
		it("rejects view without type", () => {
			const sitemap = validSitemap({
				views: { "bad": { kind: "hub", label: "Bad", icon: "x", type: "" } },
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
			expect(result.errors[0].path).toContain("views.bad");
		});

		it("rejects view with invalid kind", () => {
			const sitemap = validSitemap({
				views: { "bad": { kind: "widget" as "hub", label: "Bad", icon: "x", type: "t" } },
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
		});

		it("rejects duplicate tab IDs within a view", () => {
			const sitemap = validSitemap({
				views: {
					"hub": {
						kind: "hub", label: "Hub", icon: "h", type: "t",
						tabs: [
							{ id: "dup", label: "A", icon: "a", handler: "a" },
							{ id: "dup", label: "B", icon: "b", handler: "b" },
						],
					},
				},
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
			expect(result.errors[0].message).toContain("duplicate");
		});

		it("warns when tab has neither handler nor component", () => {
			const sitemap = validSitemap({
				views: {
					"hub": {
						kind: "hub", label: "Hub", icon: "h", type: "t",
						tabs: [{ id: "empty", label: "Empty", icon: "e" }],
					},
				},
			});
			const result = validatePluginSitemap(sitemap);
			// Still valid (warning, not error)
			expect(result.valid).toBe(true);
			expect(result.errors).toContainEqual(expect.objectContaining({
				severity: "warning",
			}));
		});
	});

	describe("commands", () => {
		it("rejects command without handler", () => {
			const sitemap = validSitemap({
				commands: [{ id: "flowti:bad", name: "Bad", handler: "" }],
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
		});

		it("rejects duplicate command IDs", () => {
			const sitemap = validSitemap({
				commands: [
					{ id: "flowti:dup", name: "A", handler: "a" },
					{ id: "flowti:dup", name: "B", handler: "b" },
				],
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
		});
	});

	describe("ribbon", () => {
		it("rejects ribbon without action", () => {
			const sitemap = validSitemap({
				ribbon: [{ icon: "star", label: "Bad", action: "" }],
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
		});
	});

	describe("modals", () => {
		it("rejects modal with invalid kind", () => {
			const sitemap = validSitemap({
				modals: { "bad": { kind: "popup" as "form", label: "Bad" } },
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
		});

		it("rejects form field without id", () => {
			const sitemap = validSitemap({
				modals: {
					"form": {
						kind: "form", label: "Form",
						fields: [{ id: "", type: "text" }],
					},
				},
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
		});

		it("rejects field with invalid type", () => {
			const sitemap = validSitemap({
				modals: {
					"form": {
						kind: "form", label: "Form",
						fields: [{ id: "x", type: "color" as "text" }],
					},
				},
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(false);
		});

		it("warns when select field has no options", () => {
			const sitemap = validSitemap({
				modals: {
					"form": {
						kind: "form", label: "Form",
						fields: [{ id: "x", type: "select" }],
					},
				},
			});
			const result = validatePluginSitemap(sitemap);
			expect(result.valid).toBe(true);
			expect(result.errors).toContainEqual(expect.objectContaining({
				severity: "warning",
			}));
		});
	});

	describe("non-object input", () => {
		it("rejects null", () => {
			const result = validatePluginSitemap(null);
			expect(result.valid).toBe(false);
		});

		it("rejects string", () => {
			const result = validatePluginSitemap("not a sitemap");
			expect(result.valid).toBe(false);
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "Development/flowti" && npx vitest run tests/domain/sitemap/plugin-sitemap-validator.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement validatePluginSitemap**

Create `src/domain/sitemap/plugin-sitemap-validator.ts`:

```typescript
export interface ValidationResult {
	valid: boolean;
	errors: ValidationError[];
}

export interface ValidationError {
	path: string;
	message: string;
	severity: "error" | "warning";
}

const VALID_VIEW_KINDS = new Set(["hub", "panel", "leaf"]);
const VALID_MODAL_KINDS = new Set(["form", "confirm", "display"]);
const VALID_FIELD_TYPES = new Set(["text", "textarea", "select", "tags", "toggle", "number"]);

export function validatePluginSitemap(sitemap: unknown): ValidationResult {
	const errors: ValidationError[] = [];

	if (!sitemap || typeof sitemap !== "object") {
		errors.push({ path: "", message: "Sitemap must be a non-null object", severity: "error" });
		return { valid: false, errors };
	}

	const s = sitemap as Record<string, unknown>;

	// Version
	if (s.version !== 2) {
		errors.push({ path: "version", message: "Version must be 2", severity: "error" });
	}

	// Views
	if (s.views && typeof s.views === "object") {
		const views = s.views as Record<string, Record<string, unknown>>;
		for (const [viewId, view] of Object.entries(views)) {
			if (!view.type || (typeof view.type === "string" && !view.type.trim())) {
				errors.push({ path: `views.${viewId}.type`, message: "View type is required", severity: "error" });
			}
			if (view.kind && !VALID_VIEW_KINDS.has(view.kind as string)) {
				errors.push({ path: `views.${viewId}.kind`, message: `Invalid view kind: ${view.kind}`, severity: "error" });
			}
			// Tab validation
			if (Array.isArray(view.tabs)) {
				const tabIds = new Set<string>();
				for (let i = 0; i < view.tabs.length; i++) {
					const tab = view.tabs[i] as Record<string, unknown>;
					if (tabIds.has(tab.id as string)) {
						errors.push({ path: `views.${viewId}.tabs[${i}]`, message: `Duplicate tab id: ${tab.id}`, severity: "error" });
					}
					tabIds.add(tab.id as string);
					if (!tab.handler && !tab.component) {
						errors.push({ path: `views.${viewId}.tabs[${i}]`, message: "Tab has neither handler nor component", severity: "warning" });
					}
				}
			}
		}
	}

	// Commands
	if (Array.isArray(s.commands)) {
		const commandIds = new Set<string>();
		for (let i = 0; i < s.commands.length; i++) {
			const cmd = s.commands[i] as Record<string, unknown>;
			if (commandIds.has(cmd.id as string)) {
				errors.push({ path: `commands[${i}]`, message: `Duplicate command id: ${cmd.id}`, severity: "error" });
			}
			commandIds.add(cmd.id as string);
			if (!cmd.handler || (typeof cmd.handler === "string" && !cmd.handler.trim())) {
				errors.push({ path: `commands[${i}].handler`, message: "Command handler is required", severity: "error" });
			}
		}
	}

	// Ribbon
	if (Array.isArray(s.ribbon)) {
		for (let i = 0; i < s.ribbon.length; i++) {
			const r = s.ribbon[i] as Record<string, unknown>;
			if (!r.action || (typeof r.action === "string" && !r.action.trim())) {
				errors.push({ path: `ribbon[${i}].action`, message: "Ribbon action is required", severity: "error" });
			}
		}
	}

	// Modals
	if (s.modals && typeof s.modals === "object") {
		const modals = s.modals as Record<string, Record<string, unknown>>;
		for (const [modalId, modal] of Object.entries(modals)) {
			if (!VALID_MODAL_KINDS.has(modal.kind as string)) {
				errors.push({ path: `modals.${modalId}.kind`, message: `Invalid modal kind: ${modal.kind}`, severity: "error" });
			}
			if (Array.isArray(modal.fields)) {
				for (let i = 0; i < modal.fields.length; i++) {
					const field = modal.fields[i] as Record<string, unknown>;
					if (!field.id || (typeof field.id === "string" && !field.id.trim())) {
						errors.push({ path: `modals.${modalId}.fields[${i}].id`, message: "Field id is required", severity: "error" });
					}
					if (!VALID_FIELD_TYPES.has(field.type as string)) {
						errors.push({ path: `modals.${modalId}.fields[${i}].type`, message: `Invalid field type: ${field.type}`, severity: "error" });
					}
					if (field.type === "select" && !Array.isArray(field.options)) {
						errors.push({ path: `modals.${modalId}.fields[${i}]`, message: "Select field should have options", severity: "warning" });
					}
				}
			}
		}
	}

	const hasErrors = errors.some(e => e.severity === "error");
	return { valid: !hasErrors, errors };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "Development/flowti" && npx vitest run tests/domain/sitemap/plugin-sitemap-validator.test.ts
```

Expected: All 18 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/src/domain/sitemap/plugin-sitemap-validator.ts" "Development/flowti/tests/domain/sitemap/plugin-sitemap-validator.test.ts" && git commit -m "feat(plugin): add plugin-sitemap schema validator"
```

---

## Chunk 4: plugin-sitemap.json + SitemapHubView

### Task 5: Create plugin-sitemap.json

**Files:**
- Create: `plugin-sitemap.json`

This file declares all existing Plugin UI surface. All views are `legacy: true` — zero behavior change. Commands and ribbon entries reference handler IDs that will be registered in Phase 3.

**Important:** The full JSON includes all commands from `createCommandDefinitions()` and all ribbon icons from `main.ts`. The executing agent must read these source files to produce the complete lists:
- `src/infrastructure/commands/registry.ts` — search for all `createCommandDefinitions()` entries (id, name, domain, category, icon, handler event)
- `src/main.ts` — search for all `addRibbonIcon()` calls (icon, label, emitted event)
- `src/main.ts` — search for `trainPreconditions` map (command IDs with conditional visibility)

Each existing command handler emits a `ui.*` event — the sitemap handler ID should use the pattern `domain:action` matching the event (e.g., `ui.openUserHub` → handler `hub:open-user`).

**View count note:** The spec example shows 6 views, but `createViewDefinitions()` in `src/infrastructure/views/registry.ts` registers 3 additional views (component-showcase, event-catalog, event-log). The sitemap declares all 8 views discovered in the source. Other views (session, canvas, journey) are registered by their respective bootstrap setup classes (`SessionSetup`, `DataExchangeSetup`) — include those too if found.

- [ ] **Step 1: Create the initial sitemap file**

Create `plugin-sitemap.json` with all 6 views, all commands from `createCommandDefinitions()` + external meta, and all ribbon icons from `main.ts`:

Read these files first to extract the complete lists:
- `src/infrastructure/commands/registry.ts` — all `createCommandDefinitions()` entries (id, name, domain, category, icon)
- `src/main.ts` lines 243-296 — all `addRibbonIcon()` calls (icon, label, event)
- `src/main.ts` lines 475-482 — `trainPreconditions` map (command IDs with conditions)

The JSON structure:

```json
{
  "version": 2,
  "views": {
    "user-hub": { "kind": "hub", "label": "User Hub", "icon": "home", "type": "flowti-user-hub", "legacy": true },
    "analytics-hub": { "kind": "hub", "label": "Analytics", "icon": "bar-chart-2", "type": "flowti-analytics-hub", "legacy": true },
    "train-hub": { "kind": "hub", "label": "Train", "icon": "waypoints", "type": "flowti-train-hub", "legacy": true },
    "data-exchange-hub": { "kind": "hub", "label": "Data Exchange", "icon": "arrow-left-right", "type": "flowti-data-exchange-hub", "legacy": true },
    "test-management-hub": { "kind": "hub", "label": "Test Management", "icon": "shield-check", "type": "flowti-test-management-hub", "legacy": true },
    "event-catalog": { "kind": "leaf", "label": "Event Catalog", "icon": "list", "type": "flowti-event-catalog", "legacy": true },
    "component-showcase": { "kind": "leaf", "label": "Component Showcase", "icon": "palette", "type": "flowti-component-showcase", "legacy": true },
    "event-log": { "kind": "leaf", "label": "Event Log", "icon": "activity", "type": "flowti-event-log", "legacy": true }
  },
  "commands": [
    { "id": "flowti:open-user-hub", "name": "Open user hub", "domain": "hub", "category": "view", "icon": "home", "handler": "hub:open-user" },
    { "id": "flowti:open-analytics-hub", "name": "Open analytics hub", "domain": "hub", "category": "view", "icon": "bar-chart-2", "handler": "hub:open-analytics" },
    { "id": "flowti:capture-idea", "name": "Capture idea", "domain": "capture", "category": "capture", "icon": "lightbulb", "handler": "capture:idea" },
    { "id": "flowti:resume-train", "name": "Resume train", "domain": "train", "category": "action", "icon": "play", "handler": "train:resume", "conditions": { "hidden": "no-active-train || train-not-paused" } },
    { "id": "flowti:complete-train", "name": "Complete train", "domain": "train", "category": "action", "icon": "check", "handler": "train:complete", "conditions": { "hidden": "no-active-train || train-not-running" } },
    { "id": "flowti:view-train", "name": "View train", "domain": "train", "category": "view", "icon": "waypoints", "handler": "train:view", "conditions": { "hidden": "no-active-train" } },
    "... AGENT: extract remaining commands from createCommandDefinitions() following the pattern above ..."
  ],
  "ribbon": [
    { "icon": "home", "label": "User Hub", "action": "view:flowti-user-hub" },
    { "icon": "bar-chart-2", "label": "Analytics", "action": "view:flowti-analytics-hub" },
    { "icon": "list", "label": "Event Catalog", "action": "view:flowti-event-catalog" },
    { "icon": "lightbulb", "label": "Capture idea", "action": "capture:idea" },
    { "icon": "waypoints", "label": "Train", "action": "train:open-or-start" },
    { "icon": "shield-check", "label": "Test Management", "action": "view:flowti-test-management-hub" },
    "... AGENT: extract remaining ribbon icons from main.ts addRibbonIcon() calls ..."
  ]
}
```

The executing agent should produce the complete JSON by reading the source files. Every command from `createCommandDefinitions()` becomes a `CommandDef`. The 5 commands in `trainPreconditions` get `"conditions": { "hidden": "..." }` entries — map each precondition to a condition handler ID:

| Train Precondition | Condition Handler ID |
|-------------------|---------------------|
| `(t) => t.status === "paused"` | `train-not-paused` |
| `(t) => t.status === "running"` | `train-not-running` |
| `() => true` (needs active train) | `no-active-train` |

- [ ] **Step 2: Validate the JSON parses**

```bash
cd "Development/flowti" && node -e "JSON.parse(require('fs').readFileSync('plugin-sitemap.json','utf8'));console.log('OK')"
```

Expected: OK

- [ ] **Step 3: Validate against our validator**

Add a test to the existing validator test file:

```typescript
import { readFileSync } from "fs";
import { resolve } from "path";

it("validates the real plugin-sitemap.json", () => {
  const raw = readFileSync(resolve(__dirname, "../../../plugin-sitemap.json"), "utf8");
  const sitemap = JSON.parse(raw);
  const result = validatePluginSitemap(sitemap);
  const errors = result.errors.filter(e => e.severity === "error");
  expect(errors).toHaveLength(0);
  expect(result.valid).toBe(true);
});
```

Run:
```bash
cd "Development/flowti" && npx vitest run tests/domain/sitemap/plugin-sitemap-validator.test.ts
```

Expected: All tests pass including the real sitemap validation.

- [ ] **Step 4: Commit**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/plugin-sitemap.json" && git commit -m "feat(plugin): add plugin-sitemap.json with all views, commands, and ribbon"
```

---

### Task 6: Create SitemapHubView (TDD)

**Files:**
- Create: `tests/ui/views/sitemap-hub-view.test.ts`
- Create: `src/ui/views/sitemap-hub-view.ts`

SitemapHubView extends `BaseHubView<string>` and renders hub views from a `ViewDef`. It provides two rendering paths for tabs: handler-based (calls registry) and component-based (creates Lit element).

**Reference:** `src/ui/BaseHubView.ts` — abstract methods `getHubId()`, `getHubType()`, `getHubDisplayName()`, `getHubIcon()`, `getTabDefinitions()`, `renderTopBarActions()`, `onDashboardRender()`, `onTabRender()`, `onHubOpen()`, `onHubClose()`.

**Testing notes:**
- The `obsidian` import is aliased to `tests/mocks/obsidian-stub.ts` in vitest config — `WorkspaceLeaf` is constructible from the stub.
- The stub provides HTMLElement polyfills (`createDiv`, `createEl`, `empty`, etc.) so DOM operations work in tests.
- `BaseHubView` stores `eventBus` as a `protected` member (set in constructor) — SitemapHubView inherits it.
- `BaseHubView` provides `protected` properties `dashboardEl`, `splitEl`, `detailPanelEl` — set during `onOpen()` lifecycle. The `renderTab()` method is public for testability, bypassing the lifecycle.
- `getHubType()` returns `"domain"` as a hardcoded default. Future views could add a `hubType` field to `ViewDef` if needed.

- [ ] **Step 1: Write failing tests**

Create `tests/ui/views/sitemap-hub-view.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SitemapHubView } from "../../../src/ui/views/sitemap-hub-view";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import type { ViewDef } from "../../../src/domain/sitemap/plugin-sitemap-types";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { WorkspaceLeaf } from "obsidian";

function createMockEventBus(): IEventBus {
	return {
		emit: vi.fn().mockResolvedValue(undefined),
		emitCustom: vi.fn().mockResolvedValue(undefined),
		on: vi.fn(() => vi.fn()),
		once: vi.fn(),
		off: vi.fn(),
		clear: vi.fn(),
	} as unknown as IEventBus;
}

function createViewDef(overrides?: Partial<ViewDef>): ViewDef {
	return {
		kind: "hub",
		label: "Test Hub",
		icon: "home",
		type: "flowti-test-hub",
		tabs: [
			{ id: "tab1", label: "Tab One", icon: "star", handler: "test:tab1" },
			{ id: "tab2", label: "Tab Two", icon: "zap", component: "flowti-widget", dataSource: "test:data" },
		],
		...overrides,
	};
}

describe("SitemapHubView", () => {
	let leaf: WorkspaceLeaf;
	let eventBus: IEventBus;
	let registry: PluginHandlerRegistry;

	beforeEach(() => {
		leaf = new WorkspaceLeaf();
		eventBus = createMockEventBus();
		registry = new PluginHandlerRegistry();
	});

	describe("view metadata", () => {
		it("returns view type from ViewDef", () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef(), registry);
			expect(view.getViewType()).toBe("flowti-test-hub");
		});

		it("returns display text from ViewDef label", () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef({ label: "My Hub" }), registry);
			expect(view.getDisplayText()).toBe("My Hub");
		});

		it("returns icon from ViewDef", () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef({ icon: "star" }), registry);
			expect(view.getIcon()).toBe("star");
		});
	});

	describe("hub metadata", () => {
		it("getHubId returns view type", () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef(), registry);
			expect(view.getHubId()).toBe("flowti-test-hub");
		});

		it("getHubType returns domain", () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef(), registry);
			expect(view.getHubType()).toBe("domain");
		});

		it("getHubDisplayName returns label", () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef({ label: "Analytics" }), registry);
			expect(view.getHubDisplayName()).toBe("Analytics");
		});

		it("getHubIcon returns icon", () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef({ icon: "bar-chart-2" }), registry);
			expect(view.getHubIcon()).toBe("bar-chart-2");
		});
	});

	describe("tab definitions", () => {
		it("maps ViewDef tabs to TabDef format", () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef(), registry);
			const tabs = view.getTabDefinitions();
			expect(tabs).toHaveLength(2);
			expect(tabs[0]).toEqual({
				id: "tab1",
				label: "Tab One",
				icon: "star",
				searchPlaceholder: "Search tab one...",
			});
		});

		it("uses custom searchPlaceholder when provided", () => {
			const viewDef = createViewDef({
				tabs: [{ id: "t", label: "T", icon: "x", handler: "h", searchPlaceholder: "Find items..." }],
			});
			const view = new SitemapHubView(leaf, eventBus, viewDef, registry);
			expect(view.getTabDefinitions()[0].searchPlaceholder).toBe("Find items...");
		});

		it("returns empty array when no tabs defined", () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef({ tabs: undefined }), registry);
			expect(view.getTabDefinitions()).toEqual([]);
		});
	});

	describe("tab rendering — handler path", () => {
		it("calls registered tab handler with container and context", async () => {
			const handler = vi.fn();
			registry.registerTabHandler("test:tab1", handler);
			const view = new SitemapHubView(leaf, eventBus, createViewDef(), registry);

			// Simulate the container that BaseHubView would create
			const container = document.createElement("div");
			await view.renderTab("tab1", container);

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(container, expect.objectContaining({
				tabId: "tab1",
				viewId: "flowti-test-hub",
			}));
		});

		it("does nothing when handler not registered", async () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef(), registry);
			const container = document.createElement("div");
			// Should not throw
			await view.renderTab("tab1", container);
			expect(container.children).toHaveLength(0);
		});
	});

	describe("tab rendering — component path", () => {
		it("creates Lit element when tab has component field", async () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef(), registry);
			const container = document.createElement("div");
			await view.renderTab("tab2", container);
			const el = container.querySelector("flowti-widget");
			expect(el).not.toBeNull();
		});

		it("binds data source to component properties", async () => {
			registry.registerDataSource("test:data", () => ({ items: [1, 2, 3], title: "Hello" }));
			const view = new SitemapHubView(leaf, eventBus, createViewDef(), registry);
			const container = document.createElement("div");
			await view.renderTab("tab2", container);
			const el = container.querySelector("flowti-widget") as HTMLElement & Record<string, unknown>;
			expect(el).not.toBeNull();
			expect((el as Record<string, unknown>).items).toEqual([1, 2, 3]);
			expect((el as Record<string, unknown>).title).toBe("Hello");
		});
	});

	describe("tab rendering — unknown tab", () => {
		it("does nothing for unknown tab ID", async () => {
			const view = new SitemapHubView(leaf, eventBus, createViewDef(), registry);
			const container = document.createElement("div");
			await view.renderTab("nonexistent", container);
			expect(container.children).toHaveLength(0);
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "Development/flowti" && npx vitest run tests/ui/views/sitemap-hub-view.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement SitemapHubView**

Create `src/ui/views/sitemap-hub-view.ts`:

```typescript
import type { WorkspaceLeaf } from "obsidian";
import { BaseHubView } from "../BaseHubView";
import type { TabDef } from "../BaseHubView";
import type { IEventBus } from "../../infrastructure/events/types";
import type { ViewDef, SitemapTabDef } from "../../domain/sitemap/plugin-sitemap-types";
import type { PluginHandlerRegistry } from "../../infrastructure/handlers/plugin-handler-registry";
import type { TabContext } from "../../infrastructure/handlers/plugin-handler-registry";

/**
 * Generic Hub view rendered from a plugin-sitemap ViewDef.
 * Extends BaseHubView, delegating tab rendering to registered handlers
 * or mounting Lit components with data source binding.
 */
export class SitemapHubView extends BaseHubView<string> {
	private viewDef: ViewDef;
	private handlerRegistry: PluginHandlerRegistry;

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		viewDef: ViewDef,
		handlerRegistry: PluginHandlerRegistry,
	) {
		super(leaf, eventBus);
		this.viewDef = viewDef;
		this.handlerRegistry = handlerRegistry;
	}

	getViewType(): string {
		return this.viewDef.type;
	}

	getDisplayText(): string {
		return this.viewDef.label;
	}

	getIcon(): string {
		return this.viewDef.icon;
	}

	getHubId(): string {
		return this.viewDef.type;
	}

	getHubType(): "system" | "domain" | "user" {
		return "domain";
	}

	getHubDisplayName(): string {
		return this.viewDef.label;
	}

	getHubIcon(): string {
		return this.viewDef.icon;
	}

	getTabDefinitions(): TabDef[] {
		return (this.viewDef.tabs ?? []).map((tab) => ({
			id: tab.id,
			label: tab.label,
			icon: tab.icon,
			searchPlaceholder: tab.searchPlaceholder ?? `Search ${tab.label.toLowerCase()}...`,
		}));
	}

	renderTopBarActions(_bar: HTMLElement): void {
		// No custom top bar actions for sitemap-driven views by default
	}

	onDashboardRender(): void {
		if (this.dashboardEl) {
			this.dashboardEl.empty();
			this.dashboardEl.createEl("h2", { text: this.viewDef.label });
		}
	}

	onTabRender(tabId: string): void {
		const container = this.detailPanelEl ?? this.splitEl;
		if (container) {
			void this.renderTab(tabId, container);
		}
	}

	/**
	 * Render a tab's content into the given container.
	 * Public for testability — called by onTabRender() at runtime.
	 */
	async renderTab(tabId: string, container: HTMLElement): Promise<void> {
		const tabDef = this.viewDef.tabs?.find((t) => t.id === tabId);
		if (!tabDef) return;

		// Path 1: Handler-based rendering
		if (tabDef.handler) {
			const handler = this.handlerRegistry.getTabHandler(tabDef.handler);
			if (handler) {
				const ctx: TabContext = {
					tabId,
					viewId: this.viewDef.type,
					eventBus: this.eventBus,
				};
				await handler(container, ctx);
			}
			return;
		}

		// Path 2: Component-based rendering
		if (tabDef.component) {
			const el = document.createElement(tabDef.component);

			if (tabDef.dataSource) {
				const dsHandler = this.handlerRegistry.getDataSource(tabDef.dataSource);
				if (dsHandler) {
					const data = await dsHandler({ eventBus: this.eventBus });
					if (data && typeof data === "object") {
						for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
							(el as unknown as Record<string, unknown>)[key] = value;
						}
					}
				}
			}

			container.appendChild(el);
		}
	}

	onHubOpen(): void {
		// No additional setup needed for sitemap-driven views
	}

	onHubClose(): void {
		// No additional cleanup needed for sitemap-driven views
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "Development/flowti" && npx vitest run tests/ui/views/sitemap-hub-view.test.ts
```

Expected: All 13 tests pass. If BaseHubView's constructor or properties cause issues with the obsidian stub, adjust the test to mock the parent class behavior.

- [ ] **Step 5: Run full test suite to verify no regressions**

```bash
cd "Development/flowti" && npx vitest run 2>&1 | tail -5
```

Expected: All 7,697+ tests pass.

- [ ] **Step 6: Commit**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/src/ui/views/sitemap-hub-view.ts" "Development/flowti/tests/ui/views/sitemap-hub-view.test.ts" && git commit -m "feat(plugin): add SitemapHubView — generic hub from ViewDef"
```

---

## Chunk 5: SitemapBootstrap + Integration

### Task 7: Create SitemapBootstrap (TDD)

**Files:**
- Create: `tests/infrastructure/sitemap/sitemap-bootstrap.test.ts`
- Create: `src/infrastructure/sitemap/sitemap-bootstrap.ts`

SitemapBootstrap reads the validated sitemap and wires declarations to Obsidian APIs. It replaces the imperative `bindViews()`, `bindCommands()`, and ribbon registration in `main.ts`.

- [ ] **Step 1: Write failing tests**

Create `tests/infrastructure/sitemap/sitemap-bootstrap.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SitemapBootstrap } from "../../../src/infrastructure/sitemap/sitemap-bootstrap";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import { ConditionEvaluator } from "../../../src/infrastructure/handlers/condition-evaluator";
import type { PluginSitemap, ViewDef } from "../../../src/domain/sitemap/plugin-sitemap-types";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { ILogger } from "../../../src/infrastructure/logger/types";

function createMockPlugin() {
	return {
		app: {
			workspace: {
				getLeaf: vi.fn(() => ({
					setViewState: vi.fn(),
				})),
			},
		},
		registerView: vi.fn(),
		addCommand: vi.fn(),
		addRibbonIcon: vi.fn(),
	};
}

function createMockEventBus(): IEventBus {
	return {
		emit: vi.fn().mockResolvedValue(undefined),
		emitCustom: vi.fn().mockResolvedValue(undefined),
		on: vi.fn(() => vi.fn()),
		once: vi.fn(),
		off: vi.fn(),
		clear: vi.fn(),
	} as unknown as IEventBus;
}

function createMockLogger(): ILogger {
	return {
		debug: vi.fn(),
		info: vi.fn(),
		warn: vi.fn(),
		error: vi.fn(),
		setContext: vi.fn().mockReturnThis(),
		setDebugMode: vi.fn(),
	};
}

function minimalSitemap(overrides?: Partial<PluginSitemap>): PluginSitemap {
	return {
		version: 2,
		views: {},
		commands: [],
		ribbon: [],
		...overrides,
	};
}

describe("SitemapBootstrap", () => {
	let plugin: ReturnType<typeof createMockPlugin>;
	let eventBus: IEventBus;
	let logger: ILogger;
	let registry: PluginHandlerRegistry;
	let evaluator: ConditionEvaluator;

	beforeEach(() => {
		plugin = createMockPlugin();
		eventBus = createMockEventBus();
		logger = createMockLogger();
		registry = new PluginHandlerRegistry();
		evaluator = new ConditionEvaluator(registry);
	});

	function createBootstrap(sitemap: PluginSitemap) {
		return new SitemapBootstrap(sitemap, {
			plugin: plugin as never,
			eventBus,
			logger,
			handlerRegistry: registry,
			conditionEvaluator: evaluator,
			legacyViewFactories: new Map(),
		});
	}

	describe("registerViews", () => {
		it("registers legacy view using factory from legacyViewFactories map", () => {
			const factory = vi.fn();
			const sitemap = minimalSitemap({
				views: {
					"test": { kind: "hub", label: "Test", icon: "x", type: "flowti-test", legacy: true },
				},
			});
			const bootstrap = new SitemapBootstrap(sitemap, {
				plugin: plugin as never,
				eventBus,
				logger,
				handlerRegistry: registry,
				conditionEvaluator: evaluator,
				legacyViewFactories: new Map([["flowti-test", factory]]),
			});
			bootstrap.registerAll();
			expect(plugin.registerView).toHaveBeenCalledWith("flowti-test", expect.any(Function));
		});

		it("skips legacy view when factory not found", () => {
			const sitemap = minimalSitemap({
				views: {
					"test": { kind: "hub", label: "Test", icon: "x", type: "flowti-test", legacy: true },
				},
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			expect(plugin.registerView).not.toHaveBeenCalled();
			expect(logger.warn).toHaveBeenCalled();
		});

		it("registers non-legacy view as SitemapHubView", () => {
			const sitemap = minimalSitemap({
				views: {
					"new-hub": { kind: "hub", label: "New", icon: "star", type: "flowti-new-hub" },
				},
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			expect(plugin.registerView).toHaveBeenCalledWith("flowti-new-hub", expect.any(Function));
		});
	});

	describe("registerCommands", () => {
		it("registers unconditional command with callback", () => {
			const handler = vi.fn();
			registry.registerAction("test:action", handler);
			const sitemap = minimalSitemap({
				commands: [{ id: "flowti:test", name: "Test", handler: "test:action" }],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			expect(plugin.addCommand).toHaveBeenCalledWith(expect.objectContaining({
				id: "flowti:test",
				name: "Test",
				callback: expect.any(Function),
			}));
		});

		it("registers conditional command with checkCallback", () => {
			registry.registerAction("train:resume", vi.fn());
			registry.registerCondition("no-active-train", () => true);
			const sitemap = minimalSitemap({
				commands: [{
					id: "flowti:resume", name: "Resume", handler: "train:resume",
					conditions: { hidden: "no-active-train" },
				}],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			expect(plugin.addCommand).toHaveBeenCalledWith(expect.objectContaining({
				id: "flowti:resume",
				checkCallback: expect.any(Function),
			}));
		});

		it("checkCallback returns false when condition is true (hidden)", () => {
			registry.registerAction("train:resume", vi.fn());
			registry.registerCondition("no-active-train", () => true);
			const sitemap = minimalSitemap({
				commands: [{
					id: "flowti:resume", name: "Resume", handler: "train:resume",
					conditions: { hidden: "no-active-train" },
				}],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			const cmd = plugin.addCommand.mock.calls[0][0];
			expect(cmd.checkCallback(true)).toBe(false);
		});

		it("checkCallback returns true and executes when condition is false", () => {
			const handler = vi.fn();
			registry.registerAction("train:resume", handler);
			registry.registerCondition("no-active-train", () => false);
			const sitemap = minimalSitemap({
				commands: [{
					id: "flowti:resume", name: "Resume", handler: "train:resume",
					conditions: { hidden: "no-active-train" },
				}],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			const cmd = plugin.addCommand.mock.calls[0][0];
			expect(cmd.checkCallback(false)).toBe(true);
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it("skips command when handler not registered", () => {
			const sitemap = minimalSitemap({
				commands: [{ id: "flowti:missing", name: "Missing", handler: "nope" }],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			expect(plugin.addCommand).not.toHaveBeenCalled();
			expect(logger.warn).toHaveBeenCalled();
		});
	});

	describe("registerRibbon", () => {
		it("registers ribbon icon with handler", () => {
			const handler = vi.fn();
			registry.registerAction("capture:idea", handler);
			const sitemap = minimalSitemap({
				ribbon: [{ icon: "lightbulb", label: "Idea", action: "capture:idea" }],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			expect(plugin.addRibbonIcon).toHaveBeenCalledWith("lightbulb", "Idea", expect.any(Function));
		});

		it("ribbon click calls handler", () => {
			const handler = vi.fn();
			registry.registerAction("capture:idea", handler);
			const sitemap = minimalSitemap({
				ribbon: [{ icon: "lightbulb", label: "Idea", action: "capture:idea" }],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			// Simulate click
			const clickHandler = plugin.addRibbonIcon.mock.calls[0][2];
			clickHandler();
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it("ribbon with view: prefix opens view", () => {
			const sitemap = minimalSitemap({
				ribbon: [{ icon: "home", label: "Hub", action: "view:flowti-user-hub" }],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			const clickHandler = plugin.addRibbonIcon.mock.calls[0][2];
			clickHandler();
			expect(plugin.app.workspace.getLeaf).toHaveBeenCalled();
		});

		it("ribbon with condition skips when hidden", () => {
			const handler = vi.fn();
			registry.registerAction("train:open", handler);
			registry.registerCondition("no-train", () => true);
			const sitemap = minimalSitemap({
				ribbon: [{ icon: "train", label: "Train", action: "train:open", conditions: { hidden: "no-train" } }],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			const clickHandler = plugin.addRibbonIcon.mock.calls[0][2];
			clickHandler();
			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("unregisterAll", () => {
		it("resets internal tracking arrays", () => {
			registry.registerAction("test:action", vi.fn());
			const sitemap = minimalSitemap({
				views: { "v": { kind: "hub", label: "V", icon: "x", type: "flowti-v" } },
				commands: [{ id: "flowti:test", name: "Test", handler: "test:action" }],
			});
			const bootstrap = createBootstrap(sitemap);
			bootstrap.registerAll();
			bootstrap.unregisterAll();
			// No explicit assertion — just verify it doesn't throw
			// and that the bootstrap can be re-used
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "Development/flowti" && npx vitest run tests/infrastructure/sitemap/sitemap-bootstrap.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement SitemapBootstrap**

Create `src/infrastructure/sitemap/sitemap-bootstrap.ts`:

```typescript
import type { WorkspaceLeaf, ViewCreator } from "obsidian";
import type { PluginSitemap, ViewDef, CommandDef, RibbonDef } from "../../domain/sitemap/plugin-sitemap-types";
import type { PluginHandlerRegistry, ActionContext, ConditionContext } from "../handlers/plugin-handler-registry";
import type { ConditionEvaluator } from "../handlers/condition-evaluator";
import type { IEventBus } from "../events/types";
import type { ILogger } from "../logger/types";
import { SitemapHubView } from "../../ui/views/sitemap-hub-view";

export interface SitemapBootstrapDeps {
	plugin: {
		app: { workspace: { getLeaf(newLeaf: boolean): { setViewState(state: { type: string }): void } } };
		registerView(type: string, creator: ViewCreator): void;
		addCommand(command: { id: string; name: string; icon?: string; callback?: () => void; checkCallback?: (checking: boolean) => boolean }): void;
		addRibbonIcon(icon: string, label: string, callback: () => void): void;
	};
	eventBus: IEventBus;
	logger: ILogger;
	handlerRegistry: PluginHandlerRegistry;
	conditionEvaluator: ConditionEvaluator;
	legacyViewFactories: Map<string, (leaf: WorkspaceLeaf) => unknown>;
}

export class SitemapBootstrap {
	private sitemap: PluginSitemap;
	private deps: SitemapBootstrapDeps;
	private registeredViewTypes: string[] = [];
	private commandIds: string[] = [];

	constructor(sitemap: PluginSitemap, deps: SitemapBootstrapDeps) {
		this.sitemap = sitemap;
		this.deps = deps;
	}

	registerAll(): void {
		this.registerViews();
		this.registerCommands();
		this.registerRibbon();
	}

	private registerViews(): void {
		for (const [viewId, viewDef] of Object.entries(this.sitemap.views)) {
			if (viewDef.legacy) {
				const factory = this.deps.legacyViewFactories.get(viewDef.type);
				if (!factory) {
					this.deps.logger.warn(`Legacy view factory not found for "${viewDef.type}" (${viewId})`);
					continue;
				}
				this.deps.plugin.registerView(viewDef.type, (leaf) => factory(leaf) as never);
				this.registeredViewTypes.push(viewDef.type);
				continue;
			}

			this.deps.plugin.registerView(viewDef.type, (leaf) =>
				new SitemapHubView(leaf, this.deps.eventBus, viewDef, this.deps.handlerRegistry) as never,
			);
			this.registeredViewTypes.push(viewDef.type);
		}
	}

	private registerCommands(): void {
		for (const cmdDef of this.sitemap.commands) {
			const handler = this.deps.handlerRegistry.getAction(cmdDef.handler);
			if (!handler) {
				this.deps.logger.warn(`Action handler not found for command "${cmdDef.id}": ${cmdDef.handler}`);
				continue;
			}

			const buildActionCtx = (): ActionContext => ({
				eventBus: this.deps.eventBus,
				app: this.deps.plugin.app,
				logger: this.deps.logger,
			});

			if (cmdDef.conditions) {
				this.deps.plugin.addCommand({
					id: cmdDef.id,
					name: cmdDef.name,
					icon: cmdDef.icon,
					checkCallback: (checking) => {
						const condCtx: ConditionContext = {
							app: this.deps.plugin.app,
							eventBus: this.deps.eventBus,
						};
						if (cmdDef.conditions!.hidden) {
							if (this.deps.conditionEvaluator.evaluate(cmdDef.conditions!.hidden, condCtx)) {
								return false;
							}
						}
						if (cmdDef.conditions!.disabled) {
							if (this.deps.conditionEvaluator.evaluate(cmdDef.conditions!.disabled, condCtx)) {
								return false;
							}
						}
						if (!checking) {
							void handler(buildActionCtx());
						}
						return true;
					},
				});
			} else {
				this.deps.plugin.addCommand({
					id: cmdDef.id,
					name: cmdDef.name,
					icon: cmdDef.icon,
					callback: () => {
						void handler(buildActionCtx());
					},
				});
			}

			this.commandIds.push(cmdDef.id);
		}
	}

	private registerRibbon(): void {
		for (const ribbonDef of this.sitemap.ribbon) {
			this.deps.plugin.addRibbonIcon(ribbonDef.icon, ribbonDef.label, () => {
				// Check conditions at click time
				if (ribbonDef.conditions?.hidden) {
					const condCtx: ConditionContext = {
						app: this.deps.plugin.app,
						eventBus: this.deps.eventBus,
					};
					if (this.deps.conditionEvaluator.evaluate(ribbonDef.conditions.hidden, condCtx)) {
						return;
					}
				}

				// Resolve action
				if (ribbonDef.action.startsWith("view:")) {
					const viewType = ribbonDef.action.slice(5);
					this.deps.plugin.app.workspace.getLeaf(true).setViewState({ type: viewType });
					return;
				}

				const handler = this.deps.handlerRegistry.getAction(ribbonDef.action);
				if (handler) {
					void handler({
						eventBus: this.deps.eventBus,
						app: this.deps.plugin.app,
						logger: this.deps.logger,
					});
				}
			});
		}
	}

	unregisterAll(): void {
		this.registeredViewTypes = [];
		this.commandIds = [];
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "Development/flowti" && npx vitest run tests/infrastructure/sitemap/sitemap-bootstrap.test.ts
```

Expected: All 12 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/src/infrastructure/sitemap/sitemap-bootstrap.ts" "Development/flowti/tests/infrastructure/sitemap/sitemap-bootstrap.test.ts" && git commit -m "feat(plugin): add SitemapBootstrap — declarative view/command/ribbon binding"
```

---

### Task 8: Integration test

**Files:**
- Create: `tests/infrastructure/sitemap/sitemap-integration.test.ts`

End-to-end wiring test: load real `plugin-sitemap.json` → validate → create registry → register handlers → bootstrap → assert all registrations.

- [ ] **Step 1: Write integration test**

Create `tests/infrastructure/sitemap/sitemap-integration.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";
import { validatePluginSitemap } from "../../../src/domain/sitemap/plugin-sitemap-validator";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import { ConditionEvaluator } from "../../../src/infrastructure/handlers/condition-evaluator";
import { SitemapBootstrap } from "../../../src/infrastructure/sitemap/sitemap-bootstrap";
import type { PluginSitemap } from "../../../src/domain/sitemap/plugin-sitemap-types";

function loadSitemap(): PluginSitemap {
	const raw = readFileSync(resolve(__dirname, "../../../plugin-sitemap.json"), "utf8");
	return JSON.parse(raw) as PluginSitemap;
}

describe("plugin-sitemap integration", () => {
	it("plugin-sitemap.json passes validation", () => {
		const sitemap = loadSitemap();
		const result = validatePluginSitemap(sitemap);
		const errors = result.errors.filter((e) => e.severity === "error");
		expect(errors).toHaveLength(0);
		expect(result.valid).toBe(true);
	});

	it("all command handler IDs can be registered and resolved", () => {
		const sitemap = loadSitemap();
		const registry = new PluginHandlerRegistry();

		// Register a stub handler for every unique handler ID referenced in commands
		const handlerIds = new Set(sitemap.commands.map((c) => c.handler));
		for (const id of handlerIds) {
			registry.registerAction(id, vi.fn());
		}

		// Register stub condition handlers for all conditions
		const conditionIds = new Set<string>();
		for (const cmd of sitemap.commands) {
			if (cmd.conditions?.hidden) conditionIds.add(cmd.conditions.hidden);
			if (cmd.conditions?.disabled) conditionIds.add(cmd.conditions.disabled);
		}
		for (const id of conditionIds) {
			// Register simple conditions (compound expressions may have multiple IDs)
			if (!id.includes("&&") && !id.includes("||") && !id.startsWith("!") && !id.includes("(")) {
				registry.registerCondition(id, () => false);
			}
		}

		// Register stub for ribbon handler IDs
		const ribbonActionIds = sitemap.ribbon
			.filter((r) => !r.action.startsWith("view:"))
			.map((r) => r.action);
		for (const id of ribbonActionIds) {
			if (!registry.hasHandler(id)) {
				registry.registerAction(id, vi.fn());
			}
		}

		// Bootstrap should not throw
		const mockPlugin = {
			app: { workspace: { getLeaf: vi.fn(() => ({ setViewState: vi.fn() })) } },
			registerView: vi.fn(),
			addCommand: vi.fn(),
			addRibbonIcon: vi.fn(),
		};

		const evaluator = new ConditionEvaluator(registry);
		const bootstrap = new SitemapBootstrap(sitemap, {
			plugin: mockPlugin as never,
			eventBus: { emit: vi.fn(), on: vi.fn(() => vi.fn()) } as never,
			logger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), setContext: vi.fn(), setDebugMode: vi.fn() } as never,
			handlerRegistry: registry,
			conditionEvaluator: evaluator,
			legacyViewFactories: new Map(),
		});

		bootstrap.registerAll();

		// All commands should have been registered
		expect(mockPlugin.addCommand).toHaveBeenCalledTimes(sitemap.commands.length);

		// All ribbon icons should have been registered
		expect(mockPlugin.addRibbonIcon).toHaveBeenCalledTimes(sitemap.ribbon.length);
	});

	it("all view types in sitemap are declared", () => {
		const sitemap = loadSitemap();
		const viewTypes = Object.values(sitemap.views).map((v) => v.type);
		// Each view type should be unique
		expect(new Set(viewTypes).size).toBe(viewTypes.length);
		// Each should have a non-empty type
		for (const t of viewTypes) {
			expect(t.length).toBeGreaterThan(0);
		}
	});
});
```

- [ ] **Step 2: Run integration tests**

```bash
cd "Development/flowti" && npx vitest run tests/infrastructure/sitemap/sitemap-integration.test.ts
```

Expected: All 3 tests pass.

- [ ] **Step 3: Run full test suite**

```bash
cd "Development/flowti" && npm test
```

Expected: All 7,697+ existing tests pass, plus all new PA2 tests.

- [ ] **Step 4: Commit**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/tests/infrastructure/sitemap/sitemap-integration.test.ts" && git commit -m "test(plugin): add plugin-sitemap integration test"
```

---

### Task 9: Final verification

- [ ] **Step 1: Run full test suite**

```bash
cd "Development/flowti" && npm test
```

Expected: All tests pass (tsc + eslint + vitest).

- [ ] **Step 2: Count new tests**

```bash
cd "Development/flowti" && npx vitest run tests/infrastructure/handlers/ tests/domain/sitemap/ tests/ui/views/sitemap-hub-view.test.ts tests/infrastructure/sitemap/ --reporter=verbose 2>&1 | tail -10
```

Expected: 70-90+ new tests across 6 files.

---

## Deliverables Checklist

After all tasks complete, verify:

- [ ] `src/domain/sitemap/plugin-sitemap-types.ts` — All sitemap interfaces
- [ ] `src/domain/sitemap/plugin-sitemap-validator.ts` — Pure validation function
- [ ] `src/infrastructure/handlers/plugin-handler-registry.ts` — 4 typed handler maps
- [ ] `src/infrastructure/handlers/condition-evaluator.ts` — Boolean expression parser
- [ ] `src/infrastructure/sitemap/sitemap-bootstrap.ts` — Declarative Obsidian binding
- [ ] `src/ui/views/sitemap-hub-view.ts` — Generic hub from ViewDef
- [ ] `plugin-sitemap.json` — All views (legacy), commands, ribbon
- [ ] 6 test files with 70-90+ tests total
- [ ] All existing 7,697+ tests still pass
- [ ] `npm test` passes (tsc + eslint + vitest)
- [ ] No changes to EventBus, ServiceContainer, or domain services

**Scope note:** The spec's Definition of Done item "SitemapBootstrap replaces imperative view/command/ribbon binding" requires main.ts wiring + `registerPluginHandlers()`. These are explicitly deferred to the next plan (see below). This plan delivers the **infrastructure and tests** for the declarative system; the **switchover** is a separate plan. The spec estimates 100-120 total tests across 7 files — the remaining ~30 tests come from `register-plugin-handlers.test.ts` in the next plan.

## What's Next (NOT in this plan)

- **main.ts integration** — Wire SitemapBootstrap into Phase 5, replacing `bindViews()`, `bindCommands()`, and ribbon registration. This requires creating `registerPluginHandlers()` (~200 lines) to extract handler logic from inline callbacks into named handlers. Also includes `tests/infrastructure/handlers/register-plugin-handlers.test.ts` (~5-10 cross-reference tests). Separate plan.
- **PA3: Component Migration** — Migrate existing Hub views from `legacy: true` to SitemapHubView with Lit components.
