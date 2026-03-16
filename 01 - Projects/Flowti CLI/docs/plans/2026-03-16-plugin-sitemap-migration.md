# Plugin Sitemap Migration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate all 15 remaining legacy Plugin views to sitemap-driven SitemapHubView/SitemapLeafView + Lit components, centralizing registration through SitemapBootstrap.

**Architecture:** SitemapBootstrap becomes the sole registrar (views, commands, ribbon). Handlers bridge services → Lit components. Components are pure renderers (props in, CustomEvents out). Each chunk leaves tests green.

**Tech Stack:** TypeScript, Lit 3.x, Obsidian Plugin API, Vitest, EventBus

**Spec:** `docs/specs/2026-03-16-plugin-sitemap-migration-design.md`

**All file paths are relative to:** `Development/flowti/`

**Test command:** `npx vitest run` (must pass after every chunk — 7,744+ tests, 0 failures)

**Type check:** `npx tsc --noEmit` (0 source errors; zod v4 locale errors in node_modules are expected)

---

## Chunk 0: Foundation — SitemapBootstrap Takeover

### Task 0.1: Extend design tokens

**Files:**
- Modify: `src/components/tokens.ts`
- Test: `tests/components/tokens.test.ts` (new file)

- [ ] **Step 1: Write failing test for new tokens**

Create `tests/components/tokens.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { tokens, utilities } from "../../src/components/tokens";

describe("tokens", () => {
	it("exports a CSSResult with --flowti- custom properties", () => {
		const css = tokens.cssText;
		expect(css).toContain("--flowti-font");
		expect(css).toContain("--flowti-text");
	});

	it("includes spacing tokens", () => {
		const css = tokens.cssText;
		expect(css).toContain("--flowti-space-xs");
		expect(css).toContain("--flowti-space-sm");
		expect(css).toContain("--flowti-space-md");
		expect(css).toContain("--flowti-space-lg");
		expect(css).toContain("--flowti-space-xl");
	});

	it("includes color tokens", () => {
		const css = tokens.cssText;
		expect(css).toContain("--flowti-color-success");
		expect(css).toContain("--flowti-color-warning");
		expect(css).toContain("--flowti-color-error");
		expect(css).toContain("--flowti-color-muted");
		expect(css).toContain("--flowti-color-info");
	});

	it("includes layout tokens", () => {
		const css = tokens.cssText;
		expect(css).toContain("--flowti-radius");
		expect(css).toContain("--flowti-border");
		expect(css).toContain("--flowti-grid-gap");
	});
});

describe("utilities", () => {
	it("includes sr-only class", () => {
		expect(utilities.cssText).toContain(".sr-only");
	});

	it("includes truncate class", () => {
		expect(utilities.cssText).toContain(".truncate");
	});
});
```

- [ ] **Step 2: Run test — expect partial failure (missing new tokens)**

Run: `npx vitest run tests/components/tokens.test.ts`
Expected: FAIL on spacing/color/layout token assertions

- [ ] **Step 3: Add spacing, color, and layout tokens to tokens.ts**

Update `src/components/tokens.ts` — extend the `:host` block in `tokens` with new custom properties:

```typescript
import { css } from 'lit';

export const tokens = css`
	:host {
		font-family: var(--flowti-font);
		color: var(--flowti-text);

		/* Spacing */
		--flowti-space-xs: 4px;
		--flowti-space-sm: 8px;
		--flowti-space-md: 16px;
		--flowti-space-lg: 24px;
		--flowti-space-xl: 32px;

		/* Colors — inherit from Obsidian theme via CSS custom properties */
		--flowti-color-success: var(--color-green);
		--flowti-color-warning: var(--color-yellow);
		--flowti-color-error: var(--color-red);
		--flowti-color-muted: var(--text-muted);
		--flowti-color-info: var(--color-blue);

		/* Typography */
		--flowti-font-sm: 0.85em;
		--flowti-font-mono: var(--font-monospace);

		/* Layout */
		--flowti-radius: var(--radius-s);
		--flowti-border: var(--background-modifier-border);
		--flowti-shadow: var(--shadow-s);
		--flowti-grid-gap: 12px;
	}
`;

export const utilities = css`
	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		border: 0;
	}

	.truncate {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
`;
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run tests/components/tokens.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/tokens.ts tests/components/tokens.test.ts
git commit -m "feat(plugin): extend design tokens — spacing, color, typography, layout"
```

---

### Task 0.2: Create shared-styles.ts

**Files:**
- Create: `src/components/shared-styles.ts`
- Test: `tests/components/shared-styles.test.ts` (new file)

- [ ] **Step 1: Write failing test for shared styles**

Create `tests/components/shared-styles.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
	masterDetailLayout,
	statusBadge,
	statCardGrid,
	emptyState,
	searchBar,
} from "../../src/components/shared-styles";

describe("shared-styles", () => {
	it("exports masterDetailLayout as CSSResult", () => {
		expect(masterDetailLayout.cssText).toContain(".master-detail");
		expect(masterDetailLayout.cssText).toContain(".master-list");
		expect(masterDetailLayout.cssText).toContain(".detail-panel");
	});

	it("exports statusBadge with variant classes", () => {
		const css = statusBadge.cssText;
		expect(css).toContain(".status-badge");
		expect(css).toContain(".status-badge--success");
		expect(css).toContain(".status-badge--warning");
		expect(css).toContain(".status-badge--error");
		expect(css).toContain(".status-badge--muted");
		expect(css).toContain(".status-badge--info");
	});

	it("exports statCardGrid", () => {
		expect(statCardGrid.cssText).toContain(".stat-grid");
		expect(statCardGrid.cssText).toContain(".stat-card");
	});

	it("exports emptyState", () => {
		expect(emptyState.cssText).toContain(".empty-state");
	});

	it("exports searchBar", () => {
		expect(searchBar.cssText).toContain(".search-bar");
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run tests/components/shared-styles.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create shared-styles.ts**

Create `src/components/shared-styles.ts`:

```typescript
import { css } from "lit";

export const masterDetailLayout = css`
	.master-detail {
		display: flex;
		height: 100%;
		gap: var(--flowti-space-md);
	}
	.master-list {
		flex: 0 0 280px;
		overflow-y: auto;
		border-right: 1px solid var(--flowti-border);
		padding-right: var(--flowti-space-md);
	}
	.detail-panel {
		flex: 1;
		overflow-y: auto;
	}
	.list-item {
		padding: var(--flowti-space-sm) var(--flowti-space-md);
		border-radius: var(--flowti-radius);
		cursor: pointer;
	}
	.list-item:hover {
		background: var(--background-modifier-hover);
	}
	.list-item--selected {
		background: var(--background-modifier-active-hover);
	}
`;

export const statusBadge = css`
	.status-badge {
		display: inline-flex;
		align-items: center;
		padding: 2px var(--flowti-space-sm);
		border-radius: var(--flowti-radius);
		font-size: var(--flowti-font-sm);
		font-weight: 500;
	}
	.status-badge--success {
		color: var(--flowti-color-success);
		background: rgba(var(--color-green-rgb), 0.15);
	}
	.status-badge--warning {
		color: var(--flowti-color-warning);
		background: rgba(var(--color-yellow-rgb), 0.15);
	}
	.status-badge--error {
		color: var(--flowti-color-error);
		background: rgba(var(--color-red-rgb), 0.15);
	}
	.status-badge--muted {
		color: var(--flowti-color-muted);
		background: var(--background-secondary);
	}
	.status-badge--info {
		color: var(--flowti-color-info);
		background: rgba(var(--color-blue-rgb), 0.15);
	}
`;

export const statCardGrid = css`
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
		gap: var(--flowti-grid-gap);
	}
	.stat-card {
		padding: var(--flowti-space-md);
		background: var(--background-secondary);
		border-radius: var(--flowti-radius);
		text-align: center;
	}
	.stat-card__value {
		font-size: 1.5em;
		font-weight: 700;
	}
	.stat-card__label {
		font-size: var(--flowti-font-sm);
		color: var(--flowti-color-muted);
	}
`;

export const emptyState = css`
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		padding: var(--flowti-space-xl);
		color: var(--flowti-color-muted);
		text-align: center;
		gap: var(--flowti-space-sm);
	}
	.empty-state__icon {
		font-size: 2em;
		opacity: 0.5;
	}
	.empty-state__message {
		font-size: var(--flowti-font-sm);
	}
`;

export const searchBar = css`
	.search-bar {
		display: flex;
		align-items: center;
		gap: var(--flowti-space-sm);
		padding: var(--flowti-space-sm) var(--flowti-space-md);
		margin-bottom: var(--flowti-space-md);
	}
	.search-bar input {
		flex: 1;
		padding: var(--flowti-space-xs) var(--flowti-space-sm);
		border: 1px solid var(--flowti-border);
		border-radius: var(--flowti-radius);
		background: var(--background-primary);
		color: var(--text-normal);
	}
`;
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run tests/components/shared-styles.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/shared-styles.ts tests/components/shared-styles.test.ts
git commit -m "feat(plugin): add shared Lit component styles — layout, badges, cards, empty, search"
```

---

### Task 0.2b: Extract shared handler utility (setProps)

**Files:**
- Create: `src/infrastructure/handlers/handler-utils.ts`
- Test: `tests/infrastructure/handlers/handler-utils.test.ts` (new file)

The `setProps` helper is currently duplicated in `test-management-handlers.ts` and will be needed by every handler file (Chunks 1-6). Extract it once.

- [ ] **Step 1: Write failing test**

Create `tests/infrastructure/handlers/handler-utils.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { setProps } from "../../../src/infrastructure/handlers/handler-utils";

describe("setProps", () => {
	it("sets properties on an element", () => {
		const el = {} as Record<string, unknown>;
		setProps(el as HTMLElement, { foo: "bar", count: 42 });
		expect(el.foo).toBe("bar");
		expect(el.count).toBe(42);
	});

	it("handles empty props", () => {
		const el = {} as Record<string, unknown>;
		setProps(el as HTMLElement, {});
		expect(Object.keys(el)).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Create handler-utils.ts**

```typescript
type Props = Record<string, unknown>;

/** Set properties on an HTMLElement (typically a Lit component). */
export function setProps(el: HTMLElement, props: Props): void {
	for (const [key, value] of Object.entries(props)) {
		(el as unknown as Props)[key] = value;
	}
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Update test-management-handlers.ts to import from handler-utils**

Replace the local `setProps` function in `src/infrastructure/handlers/test-management-handlers.ts` with `import { setProps } from "./handler-utils";`.

- [ ] **Step 6: Run full test suite — confirm nothing breaks**

- [ ] **Step 7: Commit**

```bash
git add src/infrastructure/handlers/handler-utils.ts tests/infrastructure/handlers/handler-utils.test.ts src/infrastructure/handlers/test-management-handlers.ts
git commit -m "refactor(plugin): extract shared setProps utility from handler files"
```

---

### Task 0.3: Create condition handlers

**Files:**
- Create: `src/infrastructure/handlers/condition-handlers.ts`
- Test: `tests/infrastructure/handlers/condition-handlers.test.ts` (new file)

- [ ] **Step 1: Write failing tests for all 6 conditions**

Create `tests/infrastructure/handlers/condition-handlers.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import { registerConditionHandlers, type ConditionHandlerDeps } from "../../../src/infrastructure/handlers/condition-handlers";

describe("registerConditionHandlers", () => {
	let registry: PluginHandlerRegistry;
	let deps: ConditionHandlerDeps;

	beforeEach(() => {
		registry = new PluginHandlerRegistry();
		deps = {
			trainService: {
				getActiveTrain: () => null,
			},
			sessionService: {
				getActiveSession: () => null,
			},
			installerService: {
				isInstalled: () => false,
			},
		};
	});

	it("registers all 6 condition handlers", () => {
		registerConditionHandlers(registry, deps);
		expect(registry.getCondition("no-active-train")).toBeDefined();
		expect(registry.getCondition("train-not-paused")).toBeDefined();
		expect(registry.getCondition("train-not-running")).toBeDefined();
		expect(registry.getCondition("no-active-session")).toBeDefined();
		expect(registry.getCondition("session-not-paused")).toBeDefined();
		expect(registry.getCondition("is-installed")).toBeDefined();
	});

	describe("no-active-train", () => {
		it("returns true when no active train", () => {
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("no-active-train")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(true);
		});

		it("returns false when active train exists", () => {
			deps.trainService.getActiveTrain = () => ({ id: "t1", status: "running" });
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("no-active-train")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(false);
		});
	});

	describe("train-not-paused", () => {
		it("returns true when train is running (not paused)", () => {
			deps.trainService.getActiveTrain = () => ({ id: "t1", status: "running" });
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("train-not-paused")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(true);
		});

		it("returns false when train is paused", () => {
			deps.trainService.getActiveTrain = () => ({ id: "t1", status: "paused" });
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("train-not-paused")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(false);
		});

		it("returns true when no active train", () => {
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("train-not-paused")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(true);
		});
	});

	describe("train-not-running", () => {
		it("returns true when train is paused", () => {
			deps.trainService.getActiveTrain = () => ({ id: "t1", status: "paused" });
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("train-not-running")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(true);
		});

		it("returns false when train is running", () => {
			deps.trainService.getActiveTrain = () => ({ id: "t1", status: "running" });
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("train-not-running")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(false);
		});
	});

	describe("no-active-session", () => {
		it("returns true when no active session", () => {
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("no-active-session")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(true);
		});

		it("returns false when active session exists", () => {
			deps.sessionService.getActiveSession = () => ({ id: "s1", status: "running" });
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("no-active-session")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(false);
		});
	});

	describe("session-not-paused", () => {
		it("returns true when session is running", () => {
			deps.sessionService.getActiveSession = () => ({ id: "s1", status: "running" });
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("session-not-paused")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(true);
		});

		it("returns false when session is paused", () => {
			deps.sessionService.getActiveSession = () => ({ id: "s1", status: "paused" });
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("session-not-paused")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(false);
		});
	});

	describe("is-installed", () => {
		it("returns true when installed", () => {
			deps.installerService.isInstalled = () => true;
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("is-installed")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(true);
		});

		it("returns false when not installed", () => {
			registerConditionHandlers(registry, deps);
			const handler = registry.getCondition("is-installed")!;
			expect(handler({ app: {}, eventBus: {} as never })).toBe(false);
		});
	});
});
```

- [ ] **Step 2: Run test — expect FAIL (module not found)**

Run: `npx vitest run tests/infrastructure/handlers/condition-handlers.test.ts`

- [ ] **Step 3: Implement condition-handlers.ts**

Create `src/infrastructure/handlers/condition-handlers.ts`:

```typescript
import type { PluginHandlerRegistry } from "./plugin-handler-registry";

export interface ConditionHandlerDeps {
	trainService: {
		getActiveTrain: () => { id: string; status: string } | null;
	};
	sessionService: {
		getActiveSession: () => { id: string; status: string } | null;
	};
	installerService: {
		isInstalled: () => boolean;
	};
}

export function registerConditionHandlers(
	registry: PluginHandlerRegistry,
	deps: ConditionHandlerDeps,
): void {
	registry.registerCondition("no-active-train", () => {
		return deps.trainService.getActiveTrain() === null;
	});

	registry.registerCondition("train-not-paused", () => {
		const train = deps.trainService.getActiveTrain();
		return !train || train.status !== "paused";
	});

	registry.registerCondition("train-not-running", () => {
		const train = deps.trainService.getActiveTrain();
		return !train || train.status !== "running";
	});

	registry.registerCondition("no-active-session", () => {
		return deps.sessionService.getActiveSession() === null;
	});

	registry.registerCondition("session-not-paused", () => {
		const session = deps.sessionService.getActiveSession();
		return !session || session.status !== "paused";
	});

	registry.registerCondition("is-installed", () => {
		return deps.installerService.isInstalled();
	});
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run tests/infrastructure/handlers/condition-handlers.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/handlers/condition-handlers.ts tests/infrastructure/handlers/condition-handlers.test.ts
git commit -m "feat(plugin): add condition handlers — 6 conditions for train, session, installer"
```

---

### Task 0.4: Create action handlers

**Files:**
- Create: `src/infrastructure/handlers/action-handlers.ts`
- Test: `tests/infrastructure/handlers/action-handlers.test.ts` (new file)

The ~37 commands in `plugin-sitemap.json` each need an action handler. These are thin wrappers that emit EventBus events — matching what the current `CommandRegistry` + `UiCommandService` do. Group by domain for readability.

- [ ] **Step 1: Write failing tests for action handler registration**

Create `tests/infrastructure/handlers/action-handlers.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import { registerActionHandlers, type ActionHandlerDeps } from "../../../src/infrastructure/handlers/action-handlers";

describe("registerActionHandlers", () => {
	let registry: PluginHandlerRegistry;
	let mockEventBus: { emit: ReturnType<typeof vi.fn> };
	let mockApp: Record<string, unknown>;
	let mockLogger: { debug: ReturnType<typeof vi.fn> };
	let deps: ActionHandlerDeps;

	beforeEach(() => {
		registry = new PluginHandlerRegistry();
		mockEventBus = { emit: vi.fn().mockResolvedValue(undefined) };
		mockApp = { workspace: { getLeaf: vi.fn() } };
		mockLogger = { debug: vi.fn() };
		deps = {
			trainService: { getActiveTrain: () => null },
		};
		registerActionHandlers(registry, deps);
	});

	it("registers all expected action handlers", () => {
		const expectedActions = [
			"view:open-event-catalog",
			"hub:open-user", "view:open-subscription-manager",
			"capture:open", "capture:idea", "capture:feedback", "capture:note",
			"capture:task", "capture:question", "capture:bug", "capture:risk",
			"capture:assumption", "capture:issue", "capture:decision", "capture:learning",
			"hub:open-train", "hub:open-analytics", "hub:open-test-management",
			"hub:open-data-exchange",
			"journey:run", "train:start", "train:resume", "train:complete",
			"train:open-canvas", "train:open-timeline", "train:open-view",
			"train:toggle-or-start",
			"canvas:start-session", "view:open-journey-builder",
			"installer:open",
			"data-exchange:import-csv", "data-exchange:export-csv",
			"data-exchange:export-tab", "data-exchange:signal-sync",
			"data-exchange:import-canvas",
			"session:open-workspace", "session:open-workspace-sidebar",
			"session:create", "session:resume",
		];
		for (const id of expectedActions) {
			expect(registry.getAction(id), `Missing action handler: ${id}`).toBeDefined();
		}
	});

	it("hub:open-user emits ui.openUserHub event", async () => {
		const handler = registry.getAction("hub:open-user")!;
		await handler({ eventBus: mockEventBus as never, app: mockApp, logger: mockLogger as never });
		expect(mockEventBus.emit).toHaveBeenCalledWith("ui.openUserHub", {});
	});

	it("capture:idea emits ui.openQuickCapture with type 'idea'", async () => {
		const handler = registry.getAction("capture:idea")!;
		await handler({ eventBus: mockEventBus as never, app: mockApp, logger: mockLogger as never });
		expect(mockEventBus.emit).toHaveBeenCalledWith("ui.openQuickCapture", { type: "idea" });
	});

	it("train:start emits ui.startTrain event", async () => {
		const handler = registry.getAction("train:start")!;
		await handler({ eventBus: mockEventBus as never, app: mockApp, logger: mockLogger as never });
		expect(mockEventBus.emit).toHaveBeenCalledWith("ui.startTrain", {});
	});

	describe("train:toggle-or-start", () => {
		it("emits ui.startTrain when no active train", async () => {
			const handler = registry.getAction("train:toggle-or-start")!;
			await handler({ eventBus: mockEventBus as never, app: mockApp, logger: mockLogger as never });
			expect(mockEventBus.emit).toHaveBeenCalledWith("ui.startTrain", {});
		});

		it("emits ui.openTrainView when active train exists", async () => {
			deps.trainService.getActiveTrain = () => ({ id: "t1", status: "running" });
			registry = new PluginHandlerRegistry();
			registerActionHandlers(registry, deps);
			const handler = registry.getAction("train:toggle-or-start")!;
			await handler({ eventBus: mockEventBus as never, app: mockApp, logger: mockLogger as never });
			expect(mockEventBus.emit).toHaveBeenCalledWith("ui.openTrainView", { trainId: "t1" });
		});
	});
});
```

- [ ] **Step 2: Run test — expect FAIL**

Run: `npx vitest run tests/infrastructure/handlers/action-handlers.test.ts`

- [ ] **Step 3: Implement action-handlers.ts**

Create `src/infrastructure/handlers/action-handlers.ts`. Map each `handler` string from `plugin-sitemap.json` commands to an EventBus emit. Reference `src/infrastructure/commands/registry.ts` and `main.ts` ribbon callbacks for the exact event names and payloads:

```typescript
import type { PluginHandlerRegistry, ActionContext } from "./plugin-handler-registry";

export interface ActionHandlerDeps {
	trainService: {
		getActiveTrain: () => { id: string; status: string } | null;
	};
}

/**
 * Registers all command action handlers referenced by plugin-sitemap.json.
 * Each handler emits the same EventBus event as the current manual
 * command/ribbon registration in main.ts.
 *
 * Note: ribbon entries with "view:" prefix (e.g., "view:flowti-user-hub") are
 * handled directly by SitemapBootstrap.registerRibbon() which opens the view
 * without going through action handlers. Only non-view ribbon actions (like
 * "train:toggle-or-start", "canvas:start-session", "capture:*") need handlers.
 */
export function registerActionHandlers(registry: PluginHandlerRegistry, deps: ActionHandlerDeps): void {
	// ── View-open actions ──────────────────────────────────
	// Note: component-showcase and event-log are dropped in Task 0.5.
	// Their action handlers are omitted — the sitemap commands referencing
	// them will also be removed. Only register handlers for views that exist.
	registry.registerAction("view:open-event-catalog", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openEventCatalog" as never, {} as never);
	});
	registry.registerAction("view:open-subscription-manager", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openSubscriptionManager" as never, {} as never);
	});
	registry.registerAction("view:open-journey-builder", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openJourneyBuilder" as never, {} as never);
	});

	// ── Hub-open actions ───────────────────────────────────
	registry.registerAction("hub:open-user", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openUserHub" as never, {} as never);
	});
	registry.registerAction("hub:open-train", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openTrainHub" as never, {} as never);
	});
	registry.registerAction("hub:open-analytics", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openAnalyticsHub" as never, {} as never);
	});
	registry.registerAction("hub:open-test-management", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openTestManagementHub" as never, {} as never);
	});
	registry.registerAction("hub:open-data-exchange", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openDataExchangeHub" as never, {} as never);
	});

	// ── Capture actions ────────────────────────────────────
	const captureTypes = [
		"open", "idea", "feedback", "note", "task",
		"question", "bug", "risk", "assumption", "issue",
		"decision", "learning",
	] as const;
	for (const type of captureTypes) {
		const actionId = type === "open" ? "capture:open" : `capture:${type}`;
		const payload = type === "open" ? {} : { type };
		registry.registerAction(actionId, (ctx: ActionContext) => {
			void ctx.eventBus.emit("ui.openQuickCapture" as never, payload as never);
		});
	}

	// ── Train actions ──────────────────────────────────────
	registry.registerAction("train:start", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.startTrain" as never, {} as never);
	});
	registry.registerAction("train:resume", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.resumeTrain" as never, {} as never);
	});
	registry.registerAction("train:complete", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.completeTrain" as never, {} as never);
	});
	registry.registerAction("train:open-canvas", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openTrainCanvas" as never, {} as never);
	});
	registry.registerAction("train:open-timeline", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openTrainTimeline" as never, {} as never);
	});
	registry.registerAction("train:open-view", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openTrainView" as never, {} as never);
	});
	// Ribbon toggle: open active train view if exists, else start new train
	registry.registerAction("train:toggle-or-start", (ctx: ActionContext) => {
		const activeTrain = deps.trainService.getActiveTrain();
		if (activeTrain) {
			void ctx.eventBus.emit("ui.openTrainView" as never, { trainId: activeTrain.id } as never);
			return;
		}
		void ctx.eventBus.emit("ui.startTrain" as never, {} as never);
	});

	// ── Session actions ────────────────────────────────────
	registry.registerAction("session:open-workspace", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openSessionWorkspace" as never, {} as never);
	});
	registry.registerAction("session:open-workspace-sidebar", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openSessionWorkspaceSidebar" as never, {} as never);
	});
	registry.registerAction("session:create", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.createSession" as never, {} as never);
	});
	registry.registerAction("session:resume", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.resumeSession" as never, {} as never);
	});

	// ── Journey actions ────────────────────────────────────
	registry.registerAction("journey:run", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.runJourney" as never, {} as never);
	});

	// ── Canvas actions ─────────────────────────────────────
	registry.registerAction("canvas:start-session", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.startCanvasSession" as never, {} as never);
	});

	// ── Installer actions ──────────────────────────────────
	registry.registerAction("installer:open", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.openInstaller" as never, {} as never);
	});

	// ── Data Exchange actions ──────────────────────────────
	registry.registerAction("data-exchange:import-csv", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.importCsv" as never, {} as never);
	});
	registry.registerAction("data-exchange:export-csv", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.exportCsv" as never, {} as never);
	});
	registry.registerAction("data-exchange:export-tab", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.exportTab" as never, {} as never);
	});
	registry.registerAction("data-exchange:signal-sync", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.signalSync" as never, {} as never);
	});
	registry.registerAction("data-exchange:import-canvas", (ctx: ActionContext) => {
		void ctx.eventBus.emit("ui.importCanvas" as never, {} as never);
	});
}
```

- [ ] **Step 4: Run test — expect PASS**

Run: `npx vitest run tests/infrastructure/handlers/action-handlers.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/handlers/action-handlers.ts tests/infrastructure/handlers/action-handlers.test.ts
git commit -m "feat(plugin): add action handlers — ~40 command actions for sitemap bootstrap"
```

---

### Task 0.5: Drop deprecated views

**Files:**
- Modify: `plugin-sitemap.json` (remove component-showcase and event-log entries)
- Modify: `src/infrastructure/views/registry.ts` (remove imports and definitions)
- Delete: `src/ui/components/ComponentShowcaseView.ts`
- Delete: `src/ui/catalog/EventLogView.ts`

- [ ] **Step 1: Remove component-showcase and event-log from plugin-sitemap.json**

Remove from `views` section:
- `"component-showcase"` entry
- `"event-log"` entry

Remove from `commands` section:
- `"flowti:open-component-showcase"` entry
- `"flowti:open-event-log"` entry

Remove from `ribbon` section:
- Entry with `"action": "view:flowti-component-showcase"` (if present)
- Entry with `"action": "view:flowti-event-log"` (if present)

- [ ] **Step 2: Remove from views/registry.ts**

Remove imports of `ComponentShowcaseView`, `VIEW_TYPE_COMPONENT_SHOWCASE`, `EventLogView`, `VIEW_TYPE_EVENT_LOG`. Remove the corresponding entries from `createViewDefinitions()`.

- [ ] **Step 3: Remove from commands/registry.ts**

Remove the `flowti:open-component-showcase` and `flowti:open-event-log` command definitions.

- [ ] **Step 4: Delete source files**

Delete `src/ui/components/ComponentShowcaseView.ts` and `src/ui/catalog/EventLogView.ts`.

- [ ] **Step 5: Delete associated test files**

Find and delete any test files for ComponentShowcaseView and EventLogView.

- [ ] **Step 6: Run full test suite — expect PASS**

Run: `npx vitest run`
Expected: All tests pass (some tests for deleted views will be gone, net count may decrease slightly)

- [ ] **Step 7: Run type check**

Run: `npx tsc --noEmit 2>&1 | grep -v node_modules`
Expected: 0 errors

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(plugin): drop deprecated component-showcase and event-log views"
```

---

### Task 0.6: Wire SitemapBootstrap into main.ts

**Files:**
- Modify: `src/main.ts` (major restructuring)
- Test: existing flow tests validate behavior parity

This is the highest-risk task. The goal is to replace all manual `addRibbonIcon()`, `bindCommands()`, `bindViews()`, and `registerAllViews()` calls with a single `SitemapBootstrap.registerAll()`.

- [ ] **Step 1: Build legacyViewFactories Map in main.ts**

In the `onload()` method, after all services are created but before UI binding, create the legacy factories Map. Each entry preserves the closure deps the view constructor needs:

```typescript
// In main.ts onload(), after services are initialized:
import { SitemapBootstrap, type SitemapBootstrapDeps } from "./infrastructure/sitemap/sitemap-bootstrap";
import { PluginHandlerRegistry } from "./infrastructure/handlers/plugin-handler-registry";
import { ConditionEvaluator } from "./infrastructure/handlers/condition-evaluator";
import { registerConditionHandlers } from "./infrastructure/handlers/condition-handlers";
import { registerActionHandlers } from "./infrastructure/handlers/action-handlers";
import { registerTestManagementHandlers } from "./infrastructure/handlers/test-management-handlers";
import pluginSitemap from "../plugin-sitemap.json";

// Build legacy view factory map
const legacyViewFactories = new Map<string, (leaf: WorkspaceLeaf) => unknown>();
// Add each legacy view factory — preserving the service closure deps
// Example for event-catalog:
legacyViewFactories.set(VIEW_TYPE_EVENT_CATALOG, (leaf) =>
    new EventCatalogView(leaf, this.eventBus, viewState, this.onboardingService!));
// ... (repeat for each remaining legacy view)

// Create handler registry and register all handlers
const handlerRegistry = new PluginHandlerRegistry();
registerConditionHandlers(handlerRegistry, {
    trainService: this.trainService!,
    sessionService: this.sessionService!,
    installerService: installerService,
});
registerActionHandlers(handlerRegistry);
registerTestManagementHandlers(handlerRegistry, { /* existing deps */ });

const conditionEvaluator = new ConditionEvaluator(handlerRegistry);

// Create and run bootstrap
const bootstrap = new SitemapBootstrap(pluginSitemap, {
    plugin: this,
    eventBus: this.eventBus,
    logger: this.logger!,
    handlerRegistry,
    conditionEvaluator,
    legacyViewFactories,
});
bootstrap.registerAll();
```

- [ ] **Step 2: Remove old registration calls**

Remove from `onload()`:
- The `this.registerAllViews()` call
- The `this.bindViews()` call
- The `this.bindCommands()` call
- All 16 `this.addRibbonIcon()` calls (lines ~243-295)
- The `registerAllViews()` method
- The `bindViews()` method
- The `bindCommands()` method

Keep `safeRegisterView()` for now — still used by `wireDataExchange()` and `setupHubRegistry()` for views registered in `onLayoutReady()` (these will be migrated in later chunks).

- [ ] **Step 3: Update SitemapBootstrap to use safeRegisterView**

Modify `SitemapBootstrap.registerViews()` to handle duplicate registration gracefully (hot-reload scenario), matching `safeRegisterView()` behavior:

```typescript
// In sitemap-bootstrap.ts, registerViews():
try {
    this.deps.plugin.registerView(viewDef.type, (leaf) => /* ... */);
} catch (err) {
    if (err instanceof Error && err.message.includes("existing view type")) {
        this.deps.logger.debug(`View "${viewDef.type}" already registered (hot-reload)`);
    } else {
        throw err;
    }
}
```

- [ ] **Step 4: Add startup validation logging**

At the end of `SitemapBootstrap.registerAll()`, add:

```typescript
validate(): void {
    const missing: string[] = [];
    for (const cmdDef of this.sitemap.commands) {
        if (!this.deps.handlerRegistry.getAction(cmdDef.handler)) {
            missing.push(`command "${cmdDef.id}" → handler "${cmdDef.handler}"`);
        }
    }
    if (missing.length > 0) {
        this.deps.logger.warn(`SitemapBootstrap: ${missing.length} unregistered handler(s):\n${missing.join("\n")}`);
    }
}
```

- [ ] **Step 5: Run full test suite**

Run: `npx vitest run`
Expected: 7,700+ tests pass. Some flow tests may need adjustment if they assert on command registration internals.

- [ ] **Step 6: Run type check**

Run: `npx tsc --noEmit 2>&1 | grep -v node_modules`
Expected: 0 source errors

- [ ] **Step 7: Verify parity — side-by-side comparison**

Manually verify that:
- All 14 view types are registered (13 legacy + 1 SitemapHubView — check via test or startup log)
- The 2 dropped views (component-showcase, event-log) are NOT registered (negative assertion)
- All commands appear in Obsidian command palette (manual test or flow test)
- All ribbon icons appear in the expected order
- Conditional commands (train, session, installer) appear/hide correctly

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(plugin): wire SitemapBootstrap into main.ts — single-path registration takeover"
```

- [ ] **Step 9: Run full test suite one more time**

Run: `npx vitest run`
Expected: All green — this validates the foundation is solid before hub migrations begin.

---

## Chunk 1: TrainHub Migration

### Task 1.1: Create flowti-train-dashboard Lit component

**Files:**
- Create: `src/components/train/flowti-train-dashboard.ts`
- Test: `tests/components/train/flowti-train-dashboard.test.ts` (new file)

- [ ] **Step 1: Write failing tests for train dashboard component**

Create `tests/components/train/flowti-train-dashboard.test.ts`. Test that:
- Component renders stat cards (total trains, active, completed, total thoughts)
- Component renders "Currently Running" callout when `activeTrain` prop is set
- Component renders "Paused" callout when `pausedTrain` prop is set
- Component renders empty state when no trains exist
- Component dispatches `start-train` CustomEvent when "Start a Ride" button is clicked

Pattern: Use Lit's `fixture()` helper or create the element directly with `document.createElement()`, set props, trigger `updateComplete`, then query shadow DOM.

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement flowti-train-dashboard.ts**

Extends `FlowtiElement`. Reactive properties: `trains` (array), `activeTrain` (object | null), `pausedTrain` (object | null). Uses `tokens`, `statCardGrid`, `statusBadge`, `emptyState` from shared-styles. Scoped CSS — zero inline styles.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/components/train/flowti-train-dashboard.ts tests/components/train/flowti-train-dashboard.test.ts
git commit -m "feat(plugin): add flowti-train-dashboard Lit component"
```

### Task 1.2: Create flowti-train-active Lit component

**Files:**
- Create: `src/components/train/flowti-train-active.ts`
- Test: `tests/components/train/flowti-train-active.test.ts` (new file)

- [ ] **Step 1: Write failing tests**

Test: renders list of active/paused trains, type filter dropdown, sort dropdown, detail panel on selection, dispatches `resume-train`, `pause-train`, `delete-train`, `open-train` CustomEvents.

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement flowti-train-active.ts**

Extends `FlowtiElement`. Props: `trains`, `searchText`, `selectedTrainId`. Internal state: `typeFilter`, `sortBy`. Uses `masterDetailLayout`, `statusBadge` from shared-styles.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/components/train/flowti-train-active.ts tests/components/train/flowti-train-active.test.ts
git commit -m "feat(plugin): add flowti-train-active Lit component"
```

### Task 1.3: Create flowti-train-history Lit component

**Files:**
- Create: `src/components/train/flowti-train-history.ts`
- Test: `tests/components/train/flowti-train-history.test.ts` (new file)

- [ ] **Step 1: Write failing tests**

Test: renders completed trains list, detail panel, dispatches `open-train`, `delete-train`.

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement flowti-train-history.ts**

Extends `FlowtiElement`. Props: `trains`, `searchText`, `selectedTrainId`. Uses `masterDetailLayout` from shared-styles.

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/components/train/flowti-train-history.ts tests/components/train/flowti-train-history.test.ts
git commit -m "feat(plugin): add flowti-train-history Lit component"
```

### Task 1.4: Create train tab handlers

**Files:**
- Create: `src/infrastructure/handlers/train-handlers.ts`
- Test: `tests/infrastructure/handlers/train-handlers.test.ts` (new file)

- [ ] **Step 1: Write failing tests**

Test: `registerTrainHandlers` registers `train:active`, `train:history`, `train:dashboard` tab handlers. Each handler creates the correct Lit element with props from TrainService. CustomEvents wire back to service/eventBus calls.

Follow the exact pattern from `test-management-handlers.ts` and its test file.

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Implement train-handlers.ts**

```typescript
import type { PluginHandlerRegistry, TabContext } from "./plugin-handler-registry";
import type { IEventBus } from "../events/types";
import { setProps } from "./handler-utils";

export interface TrainHandlerDeps {
	trainService: {
		getTrains: () => unknown[];
		getActiveTrain: () => unknown | null;
		getPausedTrain: () => unknown | null;
	};
	onboardingService: {
		shouldShowCallout: (id: string) => boolean;
	};
	eventBus: IEventBus;
	openTrainView: (trainId: string) => void;
}

export function registerTrainHandlers(
	registry: PluginHandlerRegistry,
	deps: TrainHandlerDeps,
): void {
	registry.registerTabHandler("train:dashboard", (container: HTMLElement) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-train-dashboard");
		const trains = deps.trainService.getTrains();
		setProps(el, {
			trains,
			activeTrain: deps.trainService.getActiveTrain(),
			pausedTrain: deps.trainService.getPausedTrain(),
		});
		el.addEventListener("start-train", () => {
			void deps.eventBus.emit("ui.startTrain" as never, {} as never);
		});
		container.appendChild(el);
	});

	registry.registerTabHandler("train:active", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-train-active");
		const allTrains = deps.trainService.getTrains() as { status: string }[];
		const activeTrains = allTrains.filter((t) => t.status === "running" || t.status === "paused");
		setProps(el, { trains: activeTrains });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });
		el.addEventListener("open-train", ((e: CustomEvent) => {
			deps.openTrainView((e.detail as { trainId: string }).trainId);
		}) as EventListener);
		el.addEventListener("resume-train", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.resumeTrain" as never, e.detail as never);
		}) as EventListener);
		el.addEventListener("pause-train", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.pauseTrain" as never, e.detail as never);
		}) as EventListener);
		el.addEventListener("delete-train", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.deleteTrain" as never, e.detail as never);
		}) as EventListener);
		container.appendChild(el);
	});

	registry.registerTabHandler("train:history", (container: HTMLElement, ctx: TabContext) => {
		container.innerHTML = "";
		const el = document.createElement("flowti-train-history");
		const allTrains = deps.trainService.getTrains() as { status: string }[];
		const completedTrains = allTrains.filter((t) => t.status === "completed");
		setProps(el, { trains: completedTrains });
		if (ctx.searchText) setProps(el, { searchText: ctx.searchText });
		el.addEventListener("open-train", ((e: CustomEvent) => {
			deps.openTrainView((e.detail as { trainId: string }).trainId);
		}) as EventListener);
		el.addEventListener("delete-train", ((e: CustomEvent) => {
			void deps.eventBus.emit("ui.deleteTrain" as never, e.detail as never);
		}) as EventListener);
		container.appendChild(el);
	});
}
```

- [ ] **Step 4: Run test — expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/handlers/train-handlers.ts tests/infrastructure/handlers/train-handlers.test.ts
git commit -m "feat(plugin): add train tab handlers — bridge TrainService → Lit components"
```

### Task 1.5: Update sitemap and wire into main.ts

**Files:**
- Modify: `plugin-sitemap.json` (update train-hub: remove `legacy`, add `tabs` + `refreshEvents`)
- Modify: `src/main.ts` (register train handlers, remove legacy TrainHubView factory)

- [ ] **Step 1: Update plugin-sitemap.json train-hub entry**

Replace the legacy train-hub entry with:
```json
"train-hub": {
    "kind": "hub",
    "label": "Train Hub",
    "icon": "train-front",
    "type": "flowti-train-hub",
    "tabs": [
        { "id": "active", "label": "Active", "icon": "play", "handler": "train:active", "searchPlaceholder": "Search active trains..." },
        { "id": "history", "label": "History", "icon": "history", "handler": "train:history", "searchPlaceholder": "Search completed trains..." }
    ],
    "refreshEvents": [
        "train.started", "train.paused", "train.resumed",
        "train.completed", "train.deleted", "train.renamed",
        "train.thought.added"
    ]
}
```

- [ ] **Step 2: Wire train handlers in main.ts**

Add `registerTrainHandlers(handlerRegistry, { ... })` call after the handler registry is created, with the TrainService deps.

- [ ] **Step 3: Remove legacy TrainHubView factory from legacyViewFactories Map**

Remove the `legacyViewFactories.set(VIEW_TYPE_TRAIN_HUB, ...)` entry. SitemapBootstrap will now create a SitemapHubView for it.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All green

- [ ] **Step 5: Run type check**

Run: `npx tsc --noEmit 2>&1 | grep -v node_modules`

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(plugin): migrate TrainHub — SitemapHubView + Lit components replace legacy BaseHubView"
```

### Task 1.6: Delete legacy TrainHubView

**Files:**
- Delete: `src/ui/train/TrainHubView.ts`
- Modify: `src/main.ts` (remove TrainHubView import)

- [ ] **Step 1: Delete TrainHubView.ts**

- [ ] **Step 2: Remove import from main.ts**

Remove: `import { TrainHubView, VIEW_TYPE_TRAIN_HUB } from "./ui/train/TrainHubView";`
Keep `VIEW_TYPE_TRAIN_HUB` if it's used elsewhere — if so, move the constant to a shared types file or inline it.

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`

- [ ] **Step 4: Run type check**

Run: `npx tsc --noEmit 2>&1 | grep -v node_modules`

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(plugin): delete legacy TrainHubView — fully replaced by SitemapHubView"
```

---

## Chunk 2: EventCatalog Migration

Follows the same pattern as Chunk 1. Key differences noted below.

### Task 2.1: Create flowti-entity-scanner base component

**Files:**
- Create: `src/components/catalog/flowti-entity-scanner.ts`
- Test: `tests/components/catalog/flowti-entity-scanner.test.ts`

This is a shared base component used by 5 of the 6 EventCatalog tabs (Domains, Services, Flows, Systems, Actors). It renders a master/detail list of scanned entities with count badge.

- [ ] **Step 1: Write failing tests** — renders master list, detail panel, search filter, count badge, empty state
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement** — extends FlowtiElement, props: `entities`, `searchText`, `selectedId`, `entityType`. Emits `entity-selected` CustomEvent.
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

### Task 2.2: Create flowti-catalog-events component

**Files:**
- Create: `src/components/catalog/flowti-catalog-events.ts`
- Test: `tests/components/catalog/flowti-catalog-events.test.ts`

The Events tab is unique — hierarchical category tree with dot legend and settings panel.

- [ ] **Step 1: Write failing tests** — renders category tree, collapse/expand, dot legend, settings panel visibility toggle
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement** — extends FlowtiElement, props: `events`, `categories`, `excludedTypes`, `notifiedTypes`, `searchText`. Internal state: `collapsedCategories` (Set), `showSettings` (boolean). Emits `toggle-category`, `toggle-setting` CustomEvents.
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

### Task 2.3: Create catalog tab handlers

**Files:**
- Create: `src/infrastructure/handlers/catalog-handlers.ts`
- Test: `tests/infrastructure/handlers/catalog-handlers.test.ts`

- [ ] **Step 1: Write failing tests** — registers handlers for `catalog:events`, `catalog:domains`, `catalog:services`, `catalog:flows`, `catalog:systems`, `catalog:actors`
- [ ] **Step 2: Run test — expect FAIL**
- [ ] **Step 3: Implement** — `registerCatalogHandlers(registry, deps)` with ViewStateProvider deps
- [ ] **Step 4: Run test — expect PASS**
- [ ] **Step 5: Commit**

### Task 2.4: Update sitemap, wire handlers, delete legacy view

**Files:**
- Modify: `plugin-sitemap.json` — change `event-catalog` kind from `"panel"` to `"hub"`, remove `"legacy": true`, add `tabs` + `refreshEvents`
- Modify: `src/main.ts` — register catalog handlers, remove legacy factory
- Modify: `src/infrastructure/views/registry.ts` — remove EventCatalogView import and factory
- Delete: `src/ui/catalog/EventCatalogView.ts`

- [ ] **Step 1: Update plugin-sitemap.json event-catalog entry**

```json
"event-catalog": {
    "kind": "hub",
    "label": "Event Catalog",
    "icon": "list",
    "type": "flowti-event-catalog",
    "tabs": [
        { "id": "events", "label": "Events", "icon": "zap", "handler": "catalog:events", "searchPlaceholder": "Search events..." },
        { "id": "domains", "label": "Domains", "icon": "boxes", "handler": "catalog:domains", "searchPlaceholder": "Search domains..." },
        { "id": "services", "label": "Services", "icon": "server", "handler": "catalog:services", "searchPlaceholder": "Search services..." },
        { "id": "flows", "label": "Flows", "icon": "git-branch", "handler": "catalog:flows", "searchPlaceholder": "Search flows..." },
        { "id": "systems", "label": "Systems", "icon": "cpu", "handler": "catalog:systems", "searchPlaceholder": "Search systems..." },
        { "id": "actors", "label": "Actors", "icon": "users", "handler": "catalog:actors", "searchPlaceholder": "Search actors..." }
    ],
    "refreshEvents": [
        "discovery.loaded", "discovery.updated", "discovery.removed",
        "eventFilter.loaded", "eventFilter.changed",
        "eventNotify.loaded", "eventNotify.changed",
        "settings.loaded", "settings.changed",
        "subscription.loaded", "subscription.created", "subscription.updated", "subscription.deleted",
        "eventDefinition.loaded", "eventDefinition.created", "eventDefinition.updated", "eventDefinition.deleted",
        "doc.created", "doc.deleted"
    ]
}
```

- [ ] **Step 2: Wire catalog handlers in main.ts** — `registerCatalogHandlers(handlerRegistry, { ... })` with ViewStateProvider deps
- [ ] **Step 3: Remove legacy factory from legacyViewFactories Map and remove EventCatalogView from views/registry.ts**
- [ ] **Step 4: Delete `src/ui/catalog/EventCatalogView.ts`**
- [ ] **Step 5: Run full test suite** — `npx vitest run`
- [ ] **Step 6: Run type check** — `npx tsc --noEmit 2>&1 | grep -v node_modules`
- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(plugin): migrate EventCatalog — SitemapHubView + Lit components replace legacy"
```

---

## Chunk 3: DataExchangeHub Migration

Follows the same pattern. 8 tabs + dashboard = 9 Lit components. Highest tab count.

### Task 3.1–3.9: Create 9 Lit components (one per tab + dashboard)

For each component (`flowti-dx-dashboard`, `flowti-dx-imports`, `flowti-dx-exports`, `flowti-dx-pipelines`, `flowti-dx-types`, `flowti-dx-properties`, `flowti-dx-signals`, `flowti-dx-reports`, `flowti-dx-canvas`):
- [ ] Write failing tests
- [ ] Implement component (extends FlowtiElement, scoped CSS, CustomEvents)
- [ ] Run test — PASS
- [ ] Commit

**Special attention:**
- `flowti-dx-imports` and `flowti-dx-exports` — CRUD forms with validation. Use Lit's `@change` event binding for form fields. Modal triggers (file picker, folder picker) are CustomEvents dispatched to handler.
- `flowti-dx-pipelines` — operation progress bars. Props: `operations` array with `status`, `progress`, `message`. Handler sets up timer for 5s auto-cleanup.
- `flowti-dx-dashboard` — active operation status cards. Props: `activeOps` array.

### Task 3.10: Create data-exchange-handlers.ts

- [ ] Write failing tests
- [ ] Implement `registerDataExchangeHandlers(registry, deps)` — handler deps include DataExchangeService, SignalService, CanvasService, OperationTracker
- [ ] Run test — PASS
- [ ] Commit

### Task 3.11: Refactor DataExchangeSetup

**Files:**
- Modify: `src/bootstrap/dataExchangeSetup.ts`
- Modify: `src/main.ts`

`DataExchangeSetup` currently calls `registerViews()` which registers the DataExchangeHubView and leaf views (CSV, Canvas, Export) via `safeRegisterView()`. After migration, the hub is driven by SitemapBootstrap. The leaf views (csv-action, canvas-import, export) stay legacy until Chunk 6.

- [ ] **Step 1: Remove `registerViews()` from DataExchangeSetup** — stop registering the hub view. Keep registering csv/canvas/export leaf views (they're still legacy).
- [ ] **Step 2: Update `wireDataExchange()` in main.ts** — remove `dxSetup.registerViews()` call if all its views are now handled. If leaf views still need it, keep but narrow scope.
- [ ] **Step 3: Run full test suite**

### Task 3.12: Update sitemap, wire, delete legacy

- [ ] **Step 1: Update `plugin-sitemap.json` data-exchange-hub entry** — add 8 tabs with handler IDs (`dx:pipelines`, `dx:imports`, `dx:exports`, `dx:types`, `dx:properties`, `dx:signals`, `dx:reports`, `dx:canvas`), refreshEvents for all dataExchange/canvas/signal events, remove `"legacy": true`
- [ ] **Step 2: Wire data-exchange handlers in main.ts** — `registerDataExchangeHandlers(handlerRegistry, { ... })`
- [ ] **Step 3: Remove legacy factory from legacyViewFactories Map**
- [ ] **Step 4: Delete `src/ui/hub/DataExchangeHubView.ts` + associated tab files**
- [ ] **Step 5: Run full test suite** — `npx vitest run`
- [ ] **Step 6: Run type check**
- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(plugin): migrate DataExchangeHub — SitemapHubView + Lit components replace legacy"
```

---

## Chunk 4: UserHub Migration

5 tabs + dashboard = 6 Lit components. Most service dependencies (8).

### Task 4.1–4.6: Create 6 Lit components

- `flowti-user-dashboard` — welcome callout, cross-hub stat cards, inbox preview, active session
- `flowti-user-sessions` — session master/detail with timer display, action buttons
- `flowti-user-inbox` — inbox master/detail, read/unread, actions
- `flowti-user-commands` — searchable command catalog
- `flowti-user-preferences` — 4 sub-panels (sources, session, train, nudge)
- `flowti-user-health` — health scanner dashboard (reuses `flowti-entity-scanner` from Chunk 2)

For each: write tests → implement → verify → commit.

**Special attention:**
- `flowti-user-sessions` — timer tick requires handler to subscribe to `session.timer.tick` and update a single prop on the component (not full re-render). Use a `ref` or direct property set from handler.
- `flowti-user-dashboard` — cross-hub stats come from HubRegistry. Handler collects stats, passes as props.

### Task 4.7: Create user-handlers.ts

- [ ] Write failing tests
- [ ] Implement `registerUserHandlers(registry, deps)` — deps include UserService, HubRegistry, InboxService, SessionService, NudgeService, OnboardingService, TrainService, CommandRegistry
- [ ] Timer tick handler: subscribes to `session.timer.tick`, finds the mounted component, updates `timerSeconds` prop directly
- [ ] Run test — PASS
- [ ] Commit

### Task 4.8: Refactor setupHubRegistry and SessionSetup

**Files:**
- Modify: `src/main.ts` — `setupHubRegistry()` method
- Modify: `src/bootstrap/sessionSetup.ts`

`setupHubRegistry()` currently creates the UserHubView factory and registers it via `safeRegisterView()`. After migration, SitemapBootstrap handles this. `SessionSetup` registers session views (session-workspace) — these stay legacy until Chunk 6.

- [ ] **Step 1: Remove UserHubView factory from `setupHubRegistry()`** — keep HubRegistry provider registrations (they provide dashboard stats, not view registration)
- [ ] **Step 2: Keep `SessionSetup.registerViews()`** — session-workspace is still legacy
- [ ] **Step 3: Run full test suite**

### Task 4.9: Update sitemap, wire, delete legacy

- [ ] **Step 1: Update `plugin-sitemap.json` user-hub entry** — add 5 tabs (`user:sessions`, `user:inbox`, `user:commands`, `user:preferences`, `user:health`), refreshEvents for inbox/session/settings/user events, remove `"legacy": true`
- [ ] **Step 2: Wire user handlers in main.ts** — `registerUserHandlers(handlerRegistry, { ... })` with all 8 service deps
- [ ] **Step 3: Remove legacy factory from legacyViewFactories Map**
- [ ] **Step 4: Delete `src/ui/userHub/UserHubView.ts` + sub-components**
- [ ] **Step 5: Run full test suite** — `npx vitest run`
- [ ] **Step 6: Run type check**
- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(plugin): migrate UserHub — SitemapHubView + Lit components replace legacy"
```

---

## Chunk 5: AnalyticsHub Migration

3 tabs + dashboard = 4 Lit components. Highest complexity (query builder, tile cache).

### Task 5.1: Create flowti-analytics-tile component

**Files:**
- Create: `src/components/analytics/flowti-analytics-tile.ts`
- Test: `tests/components/analytics/flowti-analytics-tile.test.ts`

Individual tile renderer — supports chart, table, and stat card variants. This is the atomic unit used by the dashboard.

- [ ] Write failing tests — renders chart/table/stat variants based on `tileType` prop
- [ ] Implement — extends FlowtiElement, props: `tileType`, `data`, `title`, `config`
- [ ] Run test — PASS
- [ ] Commit

### Task 5.2: Create flowti-analytics-dashboard component

- [ ] Write failing tests — renders tile grid, add/remove tiles, rename dashboard, breadcrumbs
- [ ] Implement — extends FlowtiElement, props: `dashboard`, `tiles`, `breadcrumbs`. Emits `add-tile`, `remove-tile`, `rename-dashboard`, `navigate-breadcrumb`.
- [ ] Run test — PASS
- [ ] Commit

### Task 5.3: Create flowti-analytics-queries component

Largest single component — query builder with source panel, columns, filters, sort, results preview.

- [ ] Write failing tests — renders source list, builds query, shows results, saves/loads
- [ ] Implement — extends FlowtiElement, props: `sources`, `savedQueries`, `activeQuery`, `results`. Emits `run-query`, `save-query`, `delete-query`. Internal state manages builder panels.
- [ ] Run test — PASS
- [ ] Commit

### Task 5.4: Create flowti-analytics-measurements component

- [ ] Write failing tests — renders measurement list, CRUD, detail panel
- [ ] Implement — extends FlowtiElement, master/detail pattern
- [ ] Run test — PASS
- [ ] Commit

### Task 5.5: Create analytics-handlers.ts

- [ ] Write failing tests — handlers for `analytics:dashboard`, `analytics:queries`, `analytics:measurements`
- [ ] Implement — deps include AnalyticsService, TileResultCache (retained from legacy code as handler dep), OnboardingService. File watcher subscription for CSV changes.
- [ ] Run test — PASS
- [ ] Commit

### Task 5.6: Update sitemap, wire, delete legacy

- [ ] **Step 1: Update `plugin-sitemap.json` analytics-hub entry**

```json
"analytics-hub": {
    "kind": "hub",
    "label": "Analytics Hub",
    "icon": "bar-chart-2",
    "type": "flowti-analytics-hub",
    "tabs": [
        { "id": "dashboards", "label": "Dashboards", "icon": "layout-grid", "handler": "analytics:dashboards", "searchPlaceholder": "Search dashboards..." },
        { "id": "queries", "label": "Queries", "icon": "search", "handler": "analytics:queries", "searchPlaceholder": "Search queries..." },
        { "id": "measurements", "label": "Measurements", "icon": "ruler", "handler": "analytics:measurements", "searchPlaceholder": "Search measurements..." }
    ],
    "refreshEvents": [
        "analytics.query.saved", "analytics.query.deleted",
        "analytics.query.renamed", "analytics.query.duplicated", "analytics.query.favorited",
        "analytics.dashboard.created", "analytics.dashboard.deleted", "analytics.dashboard.updated",
        "analytics.dashboard.tile.added", "analytics.dashboard.tile.removed", "analytics.dashboard.tile.reordered",
        "analytics.dashboard.favorited", "analytics.dashboard.defaultChanged",
        "analytics.measurement.created", "analytics.measurement.updated",
        "analytics.measurement.deleted", "analytics.measurement.favorited"
    ]
}
```

- [ ] **Step 2: Wire analytics handlers in main.ts** — `registerAnalyticsHandlers(handlerRegistry, { ... })` with AnalyticsService + OnboardingService deps
- [ ] **Step 3: Remove legacy factory from legacyViewFactories Map**
- [ ] **Step 4: Delete `src/ui/analytics/AnalyticsHubView.ts` + tab files (QueriesTab, DashboardsTab, MeasurementsTab).** Retain pure-logic files (TileResultCache, chart rendering utilities) as handler deps.
- [ ] **Step 5: Run full test suite** — `npx vitest run`
- [ ] **Step 6: Run type check**
- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(plugin): migrate AnalyticsHub — SitemapHubView + Lit components replace legacy"
```

---

## Chunk 6: Leaf/Panel Views

### Task 6.0: Extend ViewDef with component and handler fields

**Files:**
- Modify: `src/domain/sitemap/plugin-sitemap-types.ts`

This task must come first — SitemapLeafView and the bootstrap routing update both depend on these fields existing on `ViewDef`.

- [ ] **Step 1: Add `component` and `handler` fields to ViewDef**

In `src/domain/sitemap/plugin-sitemap-types.ts`, add optional fields to the `ViewDef` interface:

```typescript
export interface ViewDef {
	kind: "hub" | "panel" | "leaf";
	label: string;
	icon: string;
	type: string;
	tabs?: SitemapTabDef[];
	dataSources?: DataSourceRef[];
	conditions?: ConditionSet;
	legacy?: boolean;
	refreshEvents?: string[];
	/** Lit custom element tag name for leaf/panel views */
	component?: string;
	/** Handler ID for leaf/panel views (looked up in PluginHandlerRegistry) */
	handler?: string;
}
```

- [ ] **Step 2: Run type check** — `npx tsc --noEmit 2>&1 | grep -v node_modules` — 0 errors (adding optional fields is backward-compatible)
- [ ] **Step 3: Run test suite** — `npx vitest run`
- [ ] **Step 4: Commit**

```bash
git add src/domain/sitemap/plugin-sitemap-types.ts
git commit -m "feat(plugin): extend ViewDef with component and handler fields for leaf views"
```

---

### Task 6.1: Create SitemapLeafView

**Files:**
- Create: `src/ui/views/sitemap-leaf-view.ts`
- Test: `tests/ui/views/sitemap-leaf-view.test.ts` (new file)

- [ ] **Step 1: Write failing tests**

Test: creates view from ViewDef, mounts Lit component from `component` field, delegates to handler from `handler` field, subscribes to refreshEvents, cleans up on close.

- [ ] **Step 2: Implement sitemap-leaf-view.ts**

```typescript
import { ItemView, type WorkspaceLeaf } from "obsidian";
import type { ViewDef } from "../../domain/sitemap/plugin-sitemap-types";
import type { PluginHandlerRegistry } from "../../infrastructure/handlers/plugin-handler-registry";
import type { IEventBus } from "../../infrastructure/events/types";

export class SitemapLeafView extends ItemView {
	private viewDef: ViewDef;
	private handlerRegistry: PluginHandlerRegistry;
	private eventBus: IEventBus;
	private unsubscribes: (() => void)[] = [];

	constructor(
		leaf: WorkspaceLeaf,
		eventBus: IEventBus,
		viewDef: ViewDef,
		handlerRegistry: PluginHandlerRegistry,
	) {
		super(leaf);
		this.viewDef = viewDef;
		this.eventBus = eventBus;
		this.handlerRegistry = handlerRegistry;
	}

	getViewType(): string { return this.viewDef.type; }
	getDisplayText(): string { return this.viewDef.label; }
	getIcon(): string { return this.viewDef.icon; }

	async onOpen(): Promise<void> {
		const container = this.contentEl;
		container.empty();

		// Subscribe to refresh events
		if (this.viewDef.refreshEvents) {
			for (const event of this.viewDef.refreshEvents) {
				this.unsubscribes.push(
					this.eventBus.on(event as never, () => this.refresh())
				);
			}
		}

		await this.render(container);
	}

	async onClose(): Promise<void> {
		for (const unsub of this.unsubscribes) unsub();
		this.unsubscribes = [];
	}

	private async render(container: HTMLElement): Promise<void> {
		container.empty();

		// Path 1: handler-based rendering
		if (this.viewDef.handler) {
			const handler = this.handlerRegistry.getTabHandler(this.viewDef.handler);
			if (handler) {
				await handler(container, {
					tabId: "main",
					viewId: this.viewDef.type,
					eventBus: this.eventBus,
				});
			}
			return;
		}

		// Path 2: component-based rendering
		if (this.viewDef.component) {
			const el = document.createElement(this.viewDef.component);
			container.appendChild(el);
		}
	}

	private refresh(): void {
		void this.render(this.contentEl);
	}
}
```

- [ ] **Step 3: Run test — expect PASS**
- [ ] **Step 4: Commit**

### Task 6.2: Update SitemapBootstrap to route leaf views

**Files:**
- Modify: `src/infrastructure/sitemap/sitemap-bootstrap.ts`

- [ ] **Step 1: Update registerViews() routing logic**

```typescript
private registerViews(): void {
    for (const [viewId, viewDef] of Object.entries(this.sitemap.views)) {
        if (viewDef.legacy) {
            // Legacy passthrough (unchanged)
            const factory = this.deps.legacyViewFactories.get(viewDef.type);
            if (!factory) { /* warn */ continue; }
            this.deps.plugin.registerView(viewDef.type, (leaf) => factory(leaf) as never);
        } else if (viewDef.tabs) {
            // Hub view — tabs + handlers
            this.deps.plugin.registerView(viewDef.type, (leaf) =>
                new SitemapHubView(leaf, this.deps.eventBus, viewDef, this.deps.handlerRegistry) as never);
        } else if (viewDef.component || viewDef.handler) {
            // Leaf view — component or handler
            this.deps.plugin.registerView(viewDef.type, (leaf) =>
                new SitemapLeafView(leaf, this.deps.eventBus, viewDef, this.deps.handlerRegistry) as never);
        }
        this.registeredViewTypes.push(viewDef.type);
    }
}
```

- [ ] **Step 2: Run full test suite**
- [ ] **Step 3: Commit**

### Task 6.3–6.10: Migrate each leaf/panel view (case-by-case)

For each of the 8 leaf views, assessed individually:

**journey-file (156 LOC) — full Lit component:**
- [ ] Create `src/components/journey/flowti-journey-file-view.ts` + tests
- [ ] Update sitemap: add `component` field, remove `legacy`
- [ ] Delete `JourneyFileView.ts`
- [ ] Commit

**train-timeline (554 LOC) — assessed at implementation time:**
- [ ] Read `TrainTimelineSidebar.ts`, determine approach
- [ ] Create Lit component(s) or view shell + Lit panels + handler
- [ ] Update sitemap, delete legacy
- [ ] Commit

**canvas-import (540 LOC) — assessed at implementation time:**
- [ ] Read `CanvasActionView.ts`, determine approach
- [ ] Create component(s) + handler
- [ ] Update sitemap, delete legacy
- [ ] Commit

**session-workspace (625 LOC) — view shell + Lit panels:**
- [ ] Create panel Lit components (timer, goals, notes, activity, etc.)
- [ ] Create handler to orchestrate panels
- [ ] Update sitemap, refactor view shell
- [ ] Commit

**export (689 LOC) — assessed at implementation time:**
- [ ] Read `ExportView.ts`, determine approach
- [ ] Create component(s) + handler
- [ ] Update sitemap, delete legacy
- [ ] Commit

**csv-action (782 LOC) — view shell + Lit panels:**
- [ ] Create mapping builder + results Lit components
- [ ] Create handler
- [ ] Update sitemap, refactor view shell
- [ ] Commit

**train-main (843 LOC) — view shell + Lit panels:**
- [ ] Create graph nav, breadcrumbs, closure overlay Lit components
- [ ] Create handler
- [ ] Update sitemap, refactor view shell
- [ ] Commit

**journey-builder (1,047 LOC) — view shell + Lit panels:**
- [ ] Create step editor, tool schema, canvas preview Lit components
- [ ] Create handler
- [ ] Update sitemap, refactor view shell
- [ ] Commit

After each leaf migration: run `npx vitest run` + `npx tsc --noEmit`.

---

## Chunk 7: Cleanup

### Task 7.1: Remove BaseHubView if fully unused

- [ ] **Step 1: Check for remaining BaseHubView subclasses**

Run: `grep -r "extends BaseHubView" src/`
Expected: Only `SitemapHubView extends BaseHubView` remains.

If `SitemapHubView` is the only subclass, BaseHubView stays (it's the parent). If it can be inlined into SitemapHubView, do so. Otherwise keep as-is.

- [ ] **Step 2: Commit if changes made**

### Task 7.2: Remove legacy infrastructure from SitemapBootstrap

- [ ] **Step 1: Remove legacyViewFactories from SitemapBootstrapDeps**

Since no views are `legacy: true` anymore, remove the `legacyViewFactories` Map from deps and the legacy branch from `registerViews()`.

- [ ] **Step 2: Remove "legacy" field handling from type definitions**

Update `ViewDef` in `plugin-sitemap-types.ts` — remove the optional `legacy` field.

- [ ] **Step 3: Run test suite**
- [ ] **Step 4: Commit**

### Task 7.3: CSS audit

- [ ] **Step 1: Count remaining inline styles in components**

Run: `grep -r 'style=' src/components/ | wc -l`
Expected: 0

- [ ] **Step 2: Count total inline styles in codebase**

Run: `grep -r 'style=' src/ | wc -l`
This gives the new count for TD-129 update.

- [ ] **Step 3: Update TD-129** in `docs/debt/` with the new count.

- [ ] **Step 4: Commit**

### Task 7.4: Update architecture docs

- [ ] **Step 1: Update Frontend Architecture.md** — document SitemapHubView, SitemapLeafView, SitemapBootstrap, Lit component patterns, handler pattern
- [ ] **Step 2: Update Backend Architecture.md** — note SitemapBootstrap as the single registration path
- [ ] **Step 3: Commit**

### Task 7.5: Final validation

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: 7,700+ tests, 0 failures

- [ ] **Step 2: Run type check**

Run: `npx tsc --noEmit 2>&1 | grep -v node_modules`
Expected: 0 source errors

- [ ] **Step 3: Run build**

Run: `npm run build`
Expected: Successful build

- [ ] **Step 4: Final commit**

```bash
git commit -m "feat(plugin): complete sitemap migration — all views driven by SitemapBootstrap + Lit"
```
