# PA3: Component Migration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate TestManagement hub from legacy vanilla DOM to Lit components via SitemapHubView, proving the full PA1+PA2 pipeline.

**Architecture:** Tab handlers fetch data from TestManagementService, create Lit components, set properties. Components render purely from `@property()` fields. User actions emit `CustomEvent`s caught by handlers. `refreshEvents` on ViewDef drives event-driven re-rendering via SitemapHubView.

**Tech Stack:** Lit 3.x, TypeScript (strict), Vitest + happy-dom, Obsidian API (mocked)

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-15-pa3-component-migration-design.md`

**All paths relative to:** `Development/flowti/`

**Test command:** `npx vitest run <path>` (from `Development/flowti/`)

**Full suite:** `npm test` (from `Development/flowti/`)

**Convention:** Plugin uses `moduleResolution: "node"` — NO `.js` extensions. Tabs for indentation.

---

## File Structure

### Source Files

| File | Responsibility |
|------|---------------|
| `src/components/test-management/flowti-tm-dashboard.ts` | Dashboard: KPI cards, mini pyramid, recent runs, attention items |
| `src/components/test-management/flowti-tm-pyramid.ts` | Pyramid: 3 layer cards + E2E/Flow/Unit drill-down |
| `src/components/test-management/flowti-tm-feature-quality.ts` | Feature quality: feature list + linked journey detail |
| `src/components/test-management/flowti-tm-coverage.ts` | Coverage: PRD list + domain bars + gaps |
| `src/components/test-management/flowti-tm-compliance.ts` | Compliance: standard cards + expandable characteristics + tag management |
| `src/components/test-management/flowti-tm-journeys.ts` | Journeys: filterable list + full detail (history, traceability, actions) |
| `src/infrastructure/handlers/test-management-handlers.ts` | Handler registration: 5 Lit tabs + dashboard + 3 catalog wrappers |

### Test Files

| File | What It Tests |
|------|--------------|
| `tests/components/test-management/flowti-tm-dashboard.test.ts` | Dashboard rendering, KPI cards, empty state, navigation events |
| `tests/components/test-management/flowti-tm-pyramid.test.ts` | Layer cards, drill-down, baseline, trends |
| `tests/components/test-management/flowti-tm-feature-quality.test.ts` | Feature list, pass rate badges, linked journeys |
| `tests/components/test-management/flowti-tm-coverage.test.ts` | PRD list, domain bars, gaps, status badges |
| `tests/components/test-management/flowti-tm-compliance.test.ts` | Standard cards, expandable rows, tag add/remove events |
| `tests/components/test-management/flowti-tm-journeys.test.ts` | Filters, master list, detail sections, action events |
| `tests/infrastructure/handlers/test-management-handlers.test.ts` | Handler creates correct element, sets properties, wires events |

### Modified Files

| File | Change |
|------|--------|
| `src/domain/sitemap/plugin-sitemap-types.ts` | Add `refreshEvents` to ViewDef |
| `src/ui/views/sitemap-hub-view.ts` | Implement refreshEvents in onHubOpen, enhance onDashboardRender |
| `src/domain/sitemap/plugin-sitemap-validator.ts` | Validate refreshEvents as string array |
| `plugin-sitemap.json` | Update test-management-hub: remove legacy, add tabs + refreshEvents |
| `src/main.ts` | Update view factory — stop creating legacy TestManagementHubView |
| `tests/ui/views/sitemap-hub-view.test.ts` | Add refreshEvents tests |

### Deleted Files (Phase 4 only)

| File | Replaced By |
|------|------------|
| `src/ui/testManagement/TestManagementHubView.ts` | SitemapHubView + handlers |
| `src/ui/testManagement/TestManagementDashboard.ts` | flowti-tm-dashboard |
| `src/ui/testManagement/JourneysTab.ts` | flowti-tm-journeys |
| `src/ui/testManagement/PyramidTab.ts` | flowti-tm-pyramid |
| `src/ui/testManagement/CoverageTab.ts` | flowti-tm-coverage |
| `src/ui/testManagement/ComplianceTab.ts` | flowti-tm-compliance |
| `src/ui/testManagement/FeatureQualityTab.ts` | flowti-tm-feature-quality |
| `css/19-test-management.css` | Scoped static styles in each component (or reduce to catalog-only styles) |
| `tests/ui/testManagement/TestManagementHubView.test.ts` | New component + handler tests |
| `tests/ui/testManagement/TestManagementDashboard.test.ts` | flowti-tm-dashboard.test.ts |
| `tests/ui/testManagement/JourneysTab.test.ts` | flowti-tm-journeys.test.ts |
| `tests/ui/testManagement/PyramidTab.test.ts` | flowti-tm-pyramid.test.ts |
| `tests/ui/testManagement/CoverageTab.test.ts` | flowti-tm-coverage.test.ts |
| `tests/ui/testManagement/ComplianceTab.test.ts` | flowti-tm-compliance.test.ts |

---

## Chunk 1: Infrastructure — refreshEvents

### Task 1: Add refreshEvents to ViewDef and SitemapHubView

**Files:**
- Modify: `src/domain/sitemap/plugin-sitemap-types.ts`
- Modify: `src/ui/views/sitemap-hub-view.ts`
- Modify: `src/domain/sitemap/plugin-sitemap-validator.ts`
- Modify: `tests/ui/views/sitemap-hub-view.test.ts`

This task also enhances SitemapHubView with:
- `refreshEvents` subscription in `onHubOpen()`
- `searchText` plumbing: `renderTab()` passes `this.filterText` as `ctx.searchText`
- `onDashboardRender()` enhancement: calls a registered `${hubId}:dashboard` handler if one exists, falls back to simple heading
- Optional `onNavigateToEntity` callback support

- [ ] **Step 1: Add refreshEvents to ViewDef**

In `src/domain/sitemap/plugin-sitemap-types.ts`, add to the `ViewDef` interface:

```typescript
refreshEvents?: string[];
```

- [ ] **Step 2: Add refreshEvents tests to SitemapHubView test**

Add to `tests/ui/views/sitemap-hub-view.test.ts` inside the `describe("SitemapHubView")` block:

```typescript
describe("refreshEvents", () => {
	it("subscribes to refreshEvents on hub open", async () => {
		const viewDef = createViewDef({
			refreshEvents: ["test-mgmt.journey.registered", "settings.changed"],
		});
		const view = new SitemapHubView(leaf, eventBus, viewDef, registry);
		await view.onOpen();
		// onOpen calls onHubOpen which subscribes
		expect(eventBus.on).toHaveBeenCalledWith(
			"test-mgmt.journey.registered",
			expect.any(Function),
		);
		expect(eventBus.on).toHaveBeenCalledWith(
			"settings.changed",
			expect.any(Function),
		);
	});

	it("does nothing when refreshEvents is undefined", async () => {
		const viewDef = createViewDef({ refreshEvents: undefined });
		const view = new SitemapHubView(leaf, eventBus, viewDef, registry);
		// Should not throw
		view.onHubOpen();
		// No extra subscriptions beyond what BaseHubView does
	});

	it("does nothing when refreshEvents is empty", () => {
		const viewDef = createViewDef({ refreshEvents: [] });
		const view = new SitemapHubView(leaf, eventBus, viewDef, registry);
		view.onHubOpen();
	});

	it("registered callback triggers scheduleRender", () => {
		const viewDef = createViewDef({ refreshEvents: ["test-event"] });
		const view = new SitemapHubView(leaf, eventBus, viewDef, registry);
		const scheduleSpy = vi.spyOn(view as unknown as { scheduleRender: () => void }, "scheduleRender");
		view.onHubOpen();
		// Capture the callback that was passed to eventBus.on
		const onCall = (eventBus.on as ReturnType<typeof vi.fn>).mock.calls.find(
			(c: unknown[]) => c[0] === "test-event"
		);
		expect(onCall).toBeDefined();
		// Invoke the callback
		(onCall![1] as () => void)();
		expect(scheduleSpy).toHaveBeenCalled();
	});

	it("unsubscribes on close", () => {
		const unsub = vi.fn();
		(eventBus.on as ReturnType<typeof vi.fn>).mockReturnValue(unsub);
		const viewDef = createViewDef({ refreshEvents: ["test-event"] });
		const view = new SitemapHubView(leaf, eventBus, viewDef, registry);
		view.onHubOpen();
		view.onHubClose();
		// BaseHubView.onClose() calls all unsubscribes — verify unsub was collected
		// (actual cleanup happens in BaseHubView lifecycle, but we can verify the unsub fn was stored)
	});
});
```

Note: If `onOpen()` lifecycle from BaseHubView requires DOM setup that the obsidian stub doesn't support, call `onHubOpen()` directly instead. The test should verify `eventBus.on` was called with the correct event names.

- [ ] **Step 3: Run tests to verify they fail**

```bash
cd "C:/Projects/flowti/Development/flowti" && npx vitest run tests/ui/views/sitemap-hub-view.test.ts
```

Expected: FAIL — refreshEvents not handled in onHubOpen.

- [ ] **Step 4: Implement refreshEvents in SitemapHubView**

In `src/ui/views/sitemap-hub-view.ts`, make these changes:

**1. Update `onHubOpen()` for refreshEvents:**
```typescript
onHubOpen(): void {
	if (this.viewDef.refreshEvents) {
		for (const event of this.viewDef.refreshEvents) {
			this.addUnsubscribe(
				this.eventBus.on(event as never, () => this.scheduleRender())
			);
		}
	}
}
```

**2. Update `renderTab()` to pass searchText:**
In the handler path, add `searchText: this.filterText` to the TabContext:
```typescript
const ctx: TabContext = {
	tabId,
	viewId: this.viewDef.type,
	eventBus: this.eventBus,
	searchText: this.filterText,
};
```

**3. Update `onDashboardRender()` to delegate to a handler:**
```typescript
onDashboardRender(): void {
	if (!this.dashboardEl) return;
	this.dashboardEl.empty();
	// Try to find a dashboard handler: "${hubId}:dashboard"
	const handlerId = `${this.viewDef.type.replace("flowti-", "").replace("-hub", "")}:dashboard`;
	const handler = this.handlerRegistry.getTabHandler(handlerId);
	if (handler) {
		void handler(this.dashboardEl, {
			tabId: "dashboard",
			viewId: this.viewDef.type,
			eventBus: this.eventBus,
		});
	} else {
		this.dashboardEl.createEl("h2", { text: this.viewDef.label });
	}
}
```

Note: The dashboard handler ID convention is derived from the view type: `flowti-test-management-hub` → `test-management:dashboard`. The implementing agent should verify this convention or use a simpler approach (e.g., a `dashboardHandler` field on ViewDef).

**4. Add `onNavigateToEntity` callback support:**
Add a private callback field and setter method:
```typescript
private navigateCallback?: (tabId: string, entityId: string) => void;

setNavigateToEntityCallback(cb: (tabId: string, entityId: string) => void): void {
	this.navigateCallback = cb;
}

// Override from BaseHubView (if it has this method):
protected onNavigateToEntity(tabId: string, entityId: string): void {
	if (this.navigateCallback) {
		this.navigateCallback(tabId, entityId);
	}
}
```

Note: Check if BaseHubView has `onNavigateToEntity` as a virtual/overridable method. If not, the handler registration can subscribe to `hub.navigate` events directly.

- [ ] **Step 5: Update validator to accept refreshEvents**

In `src/domain/sitemap/plugin-sitemap-validator.ts`, inside the views validation loop (after the tabs validation), add:

```typescript
if (view.refreshEvents !== undefined) {
	if (!Array.isArray(view.refreshEvents) || !view.refreshEvents.every((e: unknown) => typeof e === "string" && e.length > 0)) {
		errors.push({
			path: `views.${viewId}.refreshEvents`,
			message: "refreshEvents must be an array of non-empty strings",
			severity: "error",
		});
	}
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
cd "C:/Projects/flowti/Development/flowti" && npx vitest run tests/ui/views/sitemap-hub-view.test.ts tests/domain/sitemap/
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/src/domain/sitemap/plugin-sitemap-types.ts" "Development/flowti/src/ui/views/sitemap-hub-view.ts" "Development/flowti/src/domain/sitemap/plugin-sitemap-validator.ts" "Development/flowti/tests/ui/views/sitemap-hub-view.test.ts" && git commit -m "feat(plugin): add refreshEvents support to SitemapHubView"
```

---

## Chunk 2: Lit Components — Dashboard, Pyramid, FeatureQuality

These are the 3 simpler components. Each follows the same pattern:
1. Extend `FlowtiElement`
2. Declare `@property()` for data, `@state()` for internal selection
3. Override `renderContent()` with Lit `html` templates
4. Port CSS from `css/19-test-management.css` into `static styles`

**Porting guide for all components:**
- `container.createEl("div", { cls: "ft-tm-foo" })` → `html\`<div class="foo">...\``
- `container.createDiv({ text: "..." })` → `html\`<div>...</div>\``
- `el.addEventListener("click", fn)` → `@click=\${fn}`
- `setIcon(el, "name")` → `<span class="icon">icon-name</span>` (text placeholder — Obsidian icons not available in Lit; use text labels or SVG)
- `bar.style.width = \`\${pct}%\`` → `style=\${styleMap({ width: \`\${pct}%\` })}`
- Drop the `ft-tm-` prefix in Lit (Shadow DOM scopes styles) — use shorter class names

### Task 2: flowti-tm-dashboard (TDD)

**Files:**
- Create: `tests/components/test-management/flowti-tm-dashboard.test.ts`
- Create: `src/components/test-management/flowti-tm-dashboard.ts`

**Reference:** Read `src/ui/testManagement/TestManagementDashboard.ts` for the exact rendering structure to port.

- [ ] **Step 1: Write failing tests**

Create `tests/components/test-management/flowti-tm-dashboard.test.ts`:

```typescript
// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from "vitest";
import { fixture, cleanup, shadowQuery, shadowQueryAll, shadowText } from "../../components/test-utils";

import "../../../src/components/test-management/flowti-tm-dashboard";

function makePyramid() {
	return {
		e2e: { count: 5, passRate: 80, trend: "up" as const },
		flow: { count: 12, passRate: 95, trend: "stable" as const },
		unit: { count: 45, passRate: 99, trend: "stable" as const },
	};
}

function makeJourneys() {
	return [
		{ name: "Login Flow", type: "functional", lastRunResult: { date: "2026-03-15", totalSteps: 10, passed: 10, failed: 0, skipped: 0, durationMs: 1200 }, runHistory: [] },
		{ name: "Checkout", type: "regression", lastRunResult: { date: "2026-03-14", totalSteps: 8, passed: 6, failed: 2, skipped: 0, durationMs: 800 }, runHistory: [] },
	];
}

describe("flowti-tm-dashboard", () => {
	afterEach(() => cleanup());

	it("is registered as a custom element", () => {
		expect(customElements.get("flowti-tm-dashboard")).toBeDefined();
	});

	it("renders KPI stat cards when journeys provided", async () => {
		const el = await fixture("flowti-tm-dashboard", {
			journeys: makeJourneys(),
			pyramid: makePyramid(),
		});
		const cards = shadowQueryAll(el, ".kpi-card");
		expect(cards.length).toBeGreaterThanOrEqual(3);
	});

	it("renders mini pyramid with 3 rows", async () => {
		const el = await fixture("flowti-tm-dashboard", {
			journeys: makeJourneys(),
			pyramid: makePyramid(),
		});
		const rows = shadowQueryAll(el, ".pyramid-row");
		expect(rows).toHaveLength(3);
	});

	it("renders recent runs section", async () => {
		const el = await fixture("flowti-tm-dashboard", {
			journeys: makeJourneys(),
			pyramid: makePyramid(),
			recentRuns: makeJourneys(),
		});
		const items = shadowQueryAll(el, ".run-item");
		expect(items).toHaveLength(2);
	});

	it("renders empty state when no journeys", async () => {
		const el = await fixture("flowti-tm-dashboard", {
			journeys: [],
			pyramid: makePyramid(),
		});
		const text = shadowText(el);
		expect(text).toContain("No journeys");
	});

	it("emits navigate-to-tab when KPI card clicked", async () => {
		const handler = vi.fn();
		const el = await fixture("flowti-tm-dashboard", {
			journeys: makeJourneys(),
			pyramid: makePyramid(),
		});
		el.addEventListener("navigate-to-tab", handler);
		const card = shadowQuery(el, ".kpi-card");
		card?.click();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("shows onboarding callout when onboardingVisible is true", async () => {
		const el = await fixture("flowti-tm-dashboard", {
			journeys: [],
			pyramid: makePyramid(),
			onboardingVisible: true,
		});
		const callout = shadowQuery(el, ".onboarding-callout");
		expect(callout).not.toBeNull();
	});

	it("hides onboarding callout when onboardingVisible is false", async () => {
		const el = await fixture("flowti-tm-dashboard", {
			journeys: [],
			pyramid: makePyramid(),
			onboardingVisible: false,
		});
		const callout = shadowQuery(el, ".onboarding-callout");
		expect(callout).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:/Projects/flowti/Development/flowti" && npx vitest run tests/components/test-management/flowti-tm-dashboard.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement flowti-tm-dashboard**

Create `src/components/test-management/flowti-tm-dashboard.ts`.

**Read** `src/ui/testManagement/TestManagementDashboard.ts` to port the exact rendering. The component must:

1. Extend `FlowtiElement`
2. Properties: `journeys` (array), `pyramid` (object), `recentRuns` (array), `onboardingVisible` (boolean)
3. `renderContent()` — port the Dashboard's `render()` method:
   - If no journeys → render empty state (icon + heading + hint text)
   - Else render: KPI stat grid (4 cards) → mini pyramid (3 rows with bars) → recent runs → needs attention
4. KPI cards: each `@click` dispatches `new CustomEvent("navigate-to-tab", { detail: { tabId }, bubbles: true, composed: true })`
5. Port relevant CSS from `css/19-test-management.css` into `static styles`:
   - `.kpi-card`, `.kpi-grid`, `.pyramid-row`, `.pyramid-bar`, `.run-item`, `.attention-item`, etc.
   - Use design tokens: `var(--flowti-text)`, `var(--flowti-bg-secondary)`, `var(--flowti-space-*)`, etc.
   - Where legacy uses Obsidian vars directly (`var(--color-green)`), map through tokens or keep as-is
6. Register: `customElements.define("flowti-tm-dashboard", FlowtiTmDashboard)`

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "C:/Projects/flowti/Development/flowti" && npx vitest run tests/components/test-management/flowti-tm-dashboard.test.ts
```

Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/src/components/test-management/flowti-tm-dashboard.ts" "Development/flowti/tests/components/test-management/flowti-tm-dashboard.test.ts" && git commit -m "feat(plugin): add flowti-tm-dashboard Lit component"
```

---

### Task 3: flowti-tm-pyramid (TDD)

**Files:**
- Create: `tests/components/test-management/flowti-tm-pyramid.test.ts`
- Create: `src/components/test-management/flowti-tm-pyramid.ts`

**Reference:** Read `src/ui/testManagement/PyramidTab.ts` for the exact rendering to port.

- [ ] **Step 1: Write failing tests**

Create `tests/components/test-management/flowti-tm-pyramid.test.ts`:

```typescript
// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from "vitest";
import { fixture, cleanup, shadowQuery, shadowQueryAll, shadowText } from "../../components/test-utils";

import "../../../src/components/test-management/flowti-tm-pyramid";
import type { TestPyramidState, JourneyRegistryEntry } from "../../../src/domain/testManagement/types";

function makePyramid(): TestPyramidState {
	return {
		e2e: { count: 5, passRate: 80, trend: "up" },
		flow: { count: 12, passRate: 95, trend: "stable" },
		unit: { count: 45, passRate: 99, trend: "down" },
	};
}

function makeJourneys(): JourneyRegistryEntry[] {
	return [
		{ name: "Login", type: "functional", stepCount: 10, actors: [], services: [], tools: [], complianceTags: [], jsonPath: "", runHistory: [], lastRunResult: { date: "2026-03-15", totalSteps: 10, passed: 10, failed: 0, skipped: 0, durationMs: 500 } },
		{ name: "Checkout", type: "regression", stepCount: 8, actors: [], services: [], tools: [], complianceTags: [], jsonPath: "", runHistory: [], lastRunResult: { date: "2026-03-14", totalSteps: 8, passed: 6, failed: 2, skipped: 0, durationMs: 800 } },
	];
}

describe("flowti-tm-pyramid", () => {
	afterEach(() => cleanup());

	it("is registered as a custom element", () => {
		expect(customElements.get("flowti-tm-pyramid")).toBeDefined();
	});

	it("renders 3 layer cards", async () => {
		const el = await fixture("flowti-tm-pyramid", { pyramid: makePyramid(), journeys: makeJourneys() });
		const cards = shadowQueryAll(el, ".layer-card");
		expect(cards).toHaveLength(3);
	});

	it("marks first card as active by default", async () => {
		const el = await fixture("flowti-tm-pyramid", { pyramid: makePyramid(), journeys: makeJourneys() });
		const active = shadowQuery(el, ".layer-card.active");
		expect(active).not.toBeNull();
	});

	it("shows trend indicator when baseline exists", async () => {
		const el = await fixture("flowti-tm-pyramid", { pyramid: makePyramid(), journeys: makeJourneys(), hasBaseline: true });
		const trends = shadowQueryAll(el, ".trend");
		expect(trends.length).toBeGreaterThan(0);
	});

	it("clicking a layer card selects it and shows drill-down", async () => {
		const el = await fixture("flowti-tm-pyramid", { pyramid: makePyramid(), journeys: makeJourneys() });
		const cards = shadowQueryAll(el, ".layer-card");
		cards[1]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const active = shadowQuery(el, ".layer-card.active");
		expect(active?.textContent).toContain("Flow");
	});

	it("E2E drill-down shows journey list", async () => {
		const el = await fixture("flowti-tm-pyramid", { pyramid: makePyramid(), journeys: makeJourneys() });
		const rows = shadowQueryAll(el, ".drilldown-row");
		expect(rows.length).toBeGreaterThan(0);
	});

	it("renders progress bars with correct widths", async () => {
		const el = await fixture("flowti-tm-pyramid", { pyramid: makePyramid(), journeys: makeJourneys() });
		const bar = shadowQuery<HTMLElement>(el, ".pyramid-bar");
		expect(bar?.style.width).toBe("80%");
	});

	it("emits set-baseline event on button click", async () => {
		const handler = vi.fn();
		const el = await fixture("flowti-tm-pyramid", { pyramid: makePyramid(), journeys: makeJourneys() });
		el.addEventListener("set-baseline", handler);
		const btn = shadowQuery<HTMLButtonElement>(el, ".baseline-btn");
		btn?.click();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("shows dimmed style when layer count is 0", async () => {
		const pyramid = { ...makePyramid(), flow: { count: 0, passRate: 0, trend: "stable" as const } };
		const el = await fixture("flowti-tm-pyramid", { pyramid, journeys: makeJourneys() });
		const dimmed = shadowQuery(el, ".layer-card.dimmed");
		expect(dimmed).not.toBeNull();
	});

	it("renders empty state when no journeys", async () => {
		const el = await fixture("flowti-tm-pyramid", { pyramid: makePyramid(), journeys: [] });
		const text = shadowText(el);
		expect(text).toContain("No journeys");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:/Projects/flowti/Development/flowti" && npx vitest run tests/components/test-management/flowti-tm-pyramid.test.ts
```

- [ ] **Step 3: Implement flowti-tm-pyramid**

Create `src/components/test-management/flowti-tm-pyramid.ts`.

**Read** `src/ui/testManagement/PyramidTab.ts` to port the rendering. The component must:

1. Extend `FlowtiElement`
2. Properties: `pyramid: TestPyramidState`, `journeys: JourneyRegistryEntry[]`, `hasBaseline: boolean`
3. Internal state: `@state() selectedLayer: "e2e" | "flow" | "unit" = "e2e"`
4. Render layout: left side = 3 layer cards (clickable), right side = drill-down detail
5. E2E drill-down: list of journeys with status badges, names, types, pass/fail stats
6. Flow/Unit drill-down: summary card with pass rate + guidance text
7. Footer: "Set baseline" button → `new CustomEvent("set-baseline", { bubbles: true, composed: true })`
8. Port CSS classes from PyramidTab: `.layer-card`, `.active`, `.dimmed`, `.pyramid-bar`, `.drilldown-row`, etc.
9. Register: `customElements.define("flowti-tm-pyramid", FlowtiTmPyramid)`

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "C:/Projects/flowti/Development/flowti" && npx vitest run tests/components/test-management/flowti-tm-pyramid.test.ts
```

Expected: All 10 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/src/components/test-management/flowti-tm-pyramid.ts" "Development/flowti/tests/components/test-management/flowti-tm-pyramid.test.ts" && git commit -m "feat(plugin): add flowti-tm-pyramid Lit component"
```

---

### Task 4: flowti-tm-feature-quality (TDD)

**Files:**
- Create: `tests/components/test-management/flowti-tm-feature-quality.test.ts`
- Create: `src/components/test-management/flowti-tm-feature-quality.ts`

**Reference:** Read `src/ui/testManagement/FeatureQualityTab.ts` to port the rendering.

- [ ] **Step 1: Write failing tests**

Create `tests/components/test-management/flowti-tm-feature-quality.test.ts`:

```typescript
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { fixture, cleanup, shadowQuery, shadowQueryAll, shadowText } from "../../components/test-utils";

import "../../../src/components/test-management/flowti-tm-feature-quality";

function makeFeatures() {
	return [
		{ featureName: "Authentication", journeyCount: 3, journeyNames: ["Login", "Signup", "OAuth"], totalSteps: 25, passedSteps: 22, failedSteps: 3, passRate: 88, trend: "improving" as const },
		{ featureName: "Checkout", journeyCount: 1, journeyNames: ["Cart Flow"], totalSteps: 10, passedSteps: 5, failedSteps: 5, passRate: 50, trend: "degrading" as const },
	];
}

function makeJourneys() {
	return [
		{ name: "Login", lastRunResult: { passed: 10, totalSteps: 10 }, runHistory: [] },
		{ name: "Signup", lastRunResult: { passed: 8, totalSteps: 10 }, runHistory: [] },
		{ name: "Cart Flow", lastRunResult: null, runHistory: [] },
	];
}

describe("flowti-tm-feature-quality", () => {
	afterEach(() => cleanup());

	it("is registered as a custom element", () => {
		expect(customElements.get("flowti-tm-feature-quality")).toBeDefined();
	});

	it("renders feature list in master panel", async () => {
		const el = await fixture("flowti-tm-feature-quality", { features: makeFeatures(), journeys: makeJourneys() });
		const items = shadowQueryAll(el, ".feature-item");
		expect(items).toHaveLength(2);
	});

	it("shows pass rate badge with correct color", async () => {
		const el = await fixture("flowti-tm-feature-quality", { features: makeFeatures(), journeys: makeJourneys() });
		const badge = shadowQuery(el, ".pass-rate-badge");
		expect(badge).not.toBeNull();
	});

	it("clicking feature shows detail panel", async () => {
		const el = await fixture("flowti-tm-feature-quality", { features: makeFeatures(), journeys: makeJourneys() });
		const items = shadowQueryAll(el, ".feature-item");
		items[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const detail = shadowQuery(el, ".detail-panel");
		expect(detail?.textContent).toContain("Authentication");
	});

	it("detail panel shows linked journeys", async () => {
		const el = await fixture("flowti-tm-feature-quality", { features: makeFeatures(), journeys: makeJourneys() });
		const items = shadowQueryAll(el, ".feature-item");
		items[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const journeyRows = shadowQueryAll(el, ".journey-row");
		expect(journeyRows.length).toBeGreaterThanOrEqual(1);
	});

	it("renders empty state when no features", async () => {
		const el = await fixture("flowti-tm-feature-quality", { features: [], journeys: [] });
		const text = shadowText(el);
		expect(text).toContain("No feature");
	});

	it("shows trend indicator", async () => {
		const el = await fixture("flowti-tm-feature-quality", { features: makeFeatures(), journeys: makeJourneys() });
		const items = shadowQueryAll(el, ".feature-item");
		items[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const trend = shadowQuery(el, ".trend");
		expect(trend).not.toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:/Projects/flowti/Development/flowti" && npx vitest run tests/components/test-management/flowti-tm-feature-quality.test.ts
```

- [ ] **Step 3: Implement flowti-tm-feature-quality**

Create `src/components/test-management/flowti-tm-feature-quality.ts`.

**Read** `src/ui/testManagement/FeatureQualityTab.ts` to port rendering. Key:

1. Properties: `features: FeatureQuality[]`, `journeys: JourneyRegistryEntry[]`
2. Internal state: `@state() selectedFeature: string | null = null`
3. Master panel: feature list with name + pass rate badge (green ≥70, yellow ≥40, red <40) + journey count
4. Detail panel: header with badges (pass rate, count, steps, trend) + linked journeys list with status
5. Empty state: "No feature quality data"
6. Register: `customElements.define("flowti-tm-feature-quality", FlowtiTmFeatureQuality)`

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "C:/Projects/flowti/Development/flowti" && npx vitest run tests/components/test-management/flowti-tm-feature-quality.test.ts
```

Expected: All 7 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/src/components/test-management/flowti-tm-feature-quality.ts" "Development/flowti/tests/components/test-management/flowti-tm-feature-quality.test.ts" && git commit -m "feat(plugin): add flowti-tm-feature-quality Lit component"
```

---

## Chunk 3: Lit Components — Coverage, Compliance, Journeys

### Task 5: flowti-tm-coverage (TDD)

**Files:**
- Create: `tests/components/test-management/flowti-tm-coverage.test.ts`
- Create: `src/components/test-management/flowti-tm-coverage.ts`

**Reference:** Read `src/ui/testManagement/CoverageTab.ts` + `src/domain/testManagement/coverageCalculator.ts` (for `computeDomainCoverage` and `findGaps`).

- [ ] **Step 1: Write failing tests**

Create `tests/components/test-management/flowti-tm-coverage.test.ts`:

```typescript
// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from "vitest";
import { fixture, cleanup, shadowQuery, shadowQueryAll, shadowText } from "../../components/test-utils";

import "../../../src/components/test-management/flowti-tm-coverage";

function makeCoverageEntries() {
	return [
		{ prdName: "User Auth", prdStage: "active", domain: "security", journeyCount: 3, journeyNames: ["Login", "Signup", "OAuth"], status: "covered" as const },
		{ prdName: "Payments", prdStage: "draft", domain: "billing", journeyCount: 1, journeyNames: ["Checkout"], status: "partial" as const },
		{ prdName: "Reports", prdStage: "active", domain: "analytics", journeyCount: 0, journeyNames: [], status: "uncovered" as const },
	];
}

describe("flowti-tm-coverage", () => {
	afterEach(() => cleanup());

	it("is registered as a custom element", () => {
		expect(customElements.get("flowti-tm-coverage")).toBeDefined();
	});

	it("renders PRD list in master panel", async () => {
		const el = await fixture("flowti-tm-coverage", { coverageEntries: makeCoverageEntries() });
		const rows = shadowQueryAll(el, ".prd-row");
		expect(rows).toHaveLength(3);
	});

	it("shows coverage status badges (covered/partial/uncovered)", async () => {
		const el = await fixture("flowti-tm-coverage", { coverageEntries: makeCoverageEntries() });
		const badges = shadowQueryAll(el, ".coverage-badge");
		expect(badges).toHaveLength(3);
	});

	it("clicking PRD shows detail panel", async () => {
		const el = await fixture("flowti-tm-coverage", { coverageEntries: makeCoverageEntries() });
		const rows = shadowQueryAll(el, ".prd-row");
		rows[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const detail = shadowQuery(el, ".detail-panel");
		expect(detail?.textContent).toContain("User Auth");
	});

	it("detail panel shows linked journeys", async () => {
		const el = await fixture("flowti-tm-coverage", { coverageEntries: makeCoverageEntries() });
		const rows = shadowQueryAll(el, ".prd-row");
		rows[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const text = shadowText(el);
		expect(text).toContain("Login");
	});

	it("detail panel shows domain coverage bars", async () => {
		const el = await fixture("flowti-tm-coverage", { coverageEntries: makeCoverageEntries() });
		const rows = shadowQueryAll(el, ".prd-row");
		rows[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const domainRows = shadowQueryAll(el, ".domain-row");
		expect(domainRows.length).toBeGreaterThanOrEqual(1);
	});

	it("renders coverage gaps section", async () => {
		const el = await fixture("flowti-tm-coverage", { coverageEntries: makeCoverageEntries() });
		const rows = shadowQueryAll(el, ".prd-row");
		rows[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const gaps = shadowQuery(el, ".gaps-section");
		expect(gaps).not.toBeNull();
	});

	it("renders empty state when no entries", async () => {
		const el = await fixture("flowti-tm-coverage", { coverageEntries: [] });
		const text = shadowText(el);
		expect(text).toContain("No PRD");
	});
});
```

- [ ] **Step 2–5: Red → Green → Commit** (same pattern as previous tasks)

**Read** `src/ui/testManagement/CoverageTab.ts` to port. Key: the component can import `computeDomainCoverage` and `findGaps` from `../../domain/testManagement/coverageCalculator` as pure functions — this doesn't break portability since they're pure data transforms, not service calls.

Properties: `coverageEntries: CoverageEntry[]`
Internal state: `@state() selectedPrdName: string | null = null`

Commit message: `"feat(plugin): add flowti-tm-coverage Lit component"`

---

### Task 6: flowti-tm-compliance (TDD)

**Files:**
- Create: `tests/components/test-management/flowti-tm-compliance.test.ts`
- Create: `src/components/test-management/flowti-tm-compliance.ts`

**Reference:** Read `src/ui/testManagement/ComplianceTab.ts` — this is the most complex component (~450 lines).

- [ ] **Step 1: Write failing tests**

Create `tests/components/test-management/flowti-tm-compliance.test.ts`:

```typescript
// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from "vitest";
import { fixture, cleanup, shadowQuery, shadowQueryAll, shadowText } from "../../components/test-utils";

import "../../../src/components/test-management/flowti-tm-compliance";

function makeScores() {
	return [
		{ standard: "iso-9001", total: 6, covered: 4, percentage: 67, gaps: ["gap1", "gap2"] },
		{ standard: "iso-27001", total: 5, covered: 5, percentage: 100, gaps: [] },
		{ standard: "iso-25010", total: 8, covered: 2, percentage: 25, gaps: ["g1", "g2", "g3", "g4", "g5", "g6"] },
	];
}

function makeCharacteristics() {
	return {
		"iso-9001": [
			{ id: "qms-1", standard: "iso-9001", name: "Customer Focus", description: "Desc", guidance: "Guide" },
			{ id: "qms-2", standard: "iso-9001", name: "Process Approach", description: "Desc", guidance: "Guide" },
		],
		"iso-27001": [
			{ id: "isms-1", standard: "iso-27001", name: "Risk Assessment", description: "Desc", guidance: "Guide" },
		],
		"iso-25010": [],
	};
}

function makeJourneys() {
	return [
		{ name: "Login", complianceTags: ["qms-1"], runHistory: [] },
		{ name: "Checkout", complianceTags: [], runHistory: [] },
	];
}

describe("flowti-tm-compliance", () => {
	afterEach(() => cleanup());

	it("is registered as a custom element", () => {
		expect(customElements.get("flowti-tm-compliance")).toBeDefined();
	});

	it("renders 3 standard cards", async () => {
		const el = await fixture("flowti-tm-compliance", {
			scores: makeScores(),
			characteristicsByStandard: makeCharacteristics(),
			journeys: makeJourneys(),
		});
		const cards = shadowQueryAll(el, ".standard-card");
		expect(cards).toHaveLength(3);
	});

	it("shows coverage percentage on each card", async () => {
		const el = await fixture("flowti-tm-compliance", {
			scores: makeScores(),
			characteristicsByStandard: makeCharacteristics(),
			journeys: makeJourneys(),
		});
		const text = shadowText(el);
		expect(text).toContain("67%");
		expect(text).toContain("100%");
	});

	it("clicking standard card shows characteristics detail", async () => {
		const el = await fixture("flowti-tm-compliance", {
			scores: makeScores(),
			characteristicsByStandard: makeCharacteristics(),
			journeys: makeJourneys(),
		});
		const cards = shadowQueryAll(el, ".standard-card");
		cards[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const chars = shadowQueryAll(el, ".characteristic-row");
		expect(chars).toHaveLength(2);
	});

	it("expanding characteristic shows description and guidance", async () => {
		const el = await fixture("flowti-tm-compliance", {
			scores: makeScores(),
			characteristicsByStandard: makeCharacteristics(),
			journeys: makeJourneys(),
		});
		const cards = shadowQueryAll(el, ".standard-card");
		cards[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const rows = shadowQueryAll(el, ".characteristic-row");
		rows[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const text = shadowText(el);
		expect(text).toContain("Guide");
	});

	it("shows tagged journeys for covered characteristics", async () => {
		const el = await fixture("flowti-tm-compliance", {
			scores: makeScores(),
			characteristicsByStandard: makeCharacteristics(),
			journeys: makeJourneys(),
		});
		const cards = shadowQueryAll(el, ".standard-card");
		cards[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const rows = shadowQueryAll(el, ".characteristic-row");
		rows[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const tags = shadowQueryAll(el, ".compliance-tag");
		expect(tags.length).toBeGreaterThan(0);
	});

	it("emits remove-tag event when tag remove clicked", async () => {
		const handler = vi.fn();
		const el = await fixture("flowti-tm-compliance", {
			scores: makeScores(),
			characteristicsByStandard: makeCharacteristics(),
			journeys: makeJourneys(),
		});
		el.addEventListener("remove-tag", handler);
		// Navigate to characteristic with tags
		shadowQueryAll(el, ".standard-card")[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		shadowQueryAll(el, ".characteristic-row")[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const removeBtn = shadowQuery(el, ".tag-remove");
		removeBtn?.click();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("emits add-tag event when journey tagged", async () => {
		const handler = vi.fn();
		const el = await fixture("flowti-tm-compliance", {
			scores: makeScores(),
			characteristicsByStandard: makeCharacteristics(),
			journeys: makeJourneys(),
		});
		el.addEventListener("add-tag", handler);
		// Navigate to uncovered characteristic, click "Tag journey" and select
		shadowQueryAll(el, ".standard-card")[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		shadowQueryAll(el, ".characteristic-row")[1]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const tagBtn = shadowQuery(el, ".tag-journey-btn");
		if (tagBtn) {
			tagBtn.click();
			await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
			const option = shadowQuery(el, ".journey-option");
			option?.click();
			expect(handler).toHaveBeenCalledTimes(1);
		}
	});
});
```

- [ ] **Step 2–5: Red → Green → Commit**

**Read** `src/ui/testManagement/ComplianceTab.ts` to port. Key:

Properties: `scores: ComplianceScore[]`, `characteristicsByStandard: Record<IsoStandard, ComplianceCharacteristic[]>`, `journeys: JourneyRegistryEntry[]`
Internal state: `@state() selectedStandard: IsoStandard = "iso-9001"`, `@state() expandedCharacteristic: string | null = null`, `@state() showJourneyListFor: string | null = null`

The tag management UI (add/remove compliance tags) emits events:
- `remove-tag`: `{ detail: { journeyName, tagId } }`
- `add-tag`: `{ detail: { journeyName, tagId } }`

Commit message: `"feat(plugin): add flowti-tm-compliance Lit component"`

---

### Task 7: flowti-tm-journeys (TDD)

**Files:**
- Create: `tests/components/test-management/flowti-tm-journeys.test.ts`
- Create: `src/components/test-management/flowti-tm-journeys.ts`

**Reference:** Read `src/ui/testManagement/JourneysTab.ts` — most complex component.

- [ ] **Step 1: Write failing tests**

Create `tests/components/test-management/flowti-tm-journeys.test.ts`:

```typescript
// @vitest-environment happy-dom
import { describe, it, expect, afterEach, vi } from "vitest";
import { fixture, cleanup, shadowQuery, shadowQueryAll, shadowText } from "../../components/test-utils";

import "../../../src/components/test-management/flowti-tm-journeys";

function makeJourneys() {
	return [
		{
			name: "Login Flow", type: "functional", category: "auth", domain: "security",
			chapter: 1, stepCount: 10, actors: ["user"], services: ["auth-svc"], tools: ["click", "type"],
			jsonPath: "/journeys/login.json", canvasPath: "/journeys/login.canvas",
			complianceTags: ["qms-1"], runHistory: [
				{ date: "2026-03-15", totalSteps: 10, passed: 10, failed: 0, skipped: 0, durationMs: 1200 },
				{ date: "2026-03-14", totalSteps: 10, passed: 9, failed: 1, skipped: 0, durationMs: 1500 },
			],
			lastRunResult: { date: "2026-03-15", totalSteps: 10, passed: 10, failed: 0, skipped: 0, durationMs: 1200 },
		},
		{
			name: "Checkout", type: "regression", domain: "billing", stepCount: 8,
			actors: [], services: [], tools: [], complianceTags: [], jsonPath: "/j/checkout.json",
			runHistory: [], lastRunResult: null,
		},
	];
}

describe("flowti-tm-journeys", () => {
	afterEach(() => cleanup());

	it("is registered as a custom element", () => {
		expect(customElements.get("flowti-tm-journeys")).toBeDefined();
	});

	it("renders journey list", async () => {
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		const rows = shadowQueryAll(el, ".journey-row");
		expect(rows).toHaveLength(2);
	});

	it("shows status badge per journey", async () => {
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		const badges = shadowQueryAll(el, ".status-badge");
		expect(badges.length).toBeGreaterThanOrEqual(2);
	});

	it("clicking journey shows detail panel", async () => {
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		const rows = shadowQueryAll(el, ".journey-row");
		rows[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const detail = shadowQuery(el, ".detail-panel");
		expect(detail?.textContent).toContain("Login Flow");
	});

	it("detail panel shows run history", async () => {
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		shadowQueryAll(el, ".journey-row")[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const historyRows = shadowQueryAll(el, ".run-history-row");
		expect(historyRows).toHaveLength(2);
	});

	it("detail panel shows traceability (actors, services, tools)", async () => {
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		shadowQueryAll(el, ".journey-row")[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const text = shadowText(el);
		expect(text).toContain("user");
		expect(text).toContain("auth-svc");
	});

	it("renders filter controls (type + status)", async () => {
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		const selects = shadowQueryAll(el, "select");
		expect(selects.length).toBeGreaterThanOrEqual(2);
	});

	it("type filter narrows list", async () => {
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		const typeSelect = shadowQueryAll<HTMLSelectElement>(el, "select")[0];
		if (typeSelect) {
			typeSelect.value = "functional";
			typeSelect.dispatchEvent(new Event("change"));
			await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
			const rows = shadowQueryAll(el, ".journey-row");
			expect(rows).toHaveLength(1);
		}
	});

	it("searchText property filters by name", async () => {
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys(), searchText: "Login" });
		const rows = shadowQueryAll(el, ".journey-row");
		expect(rows).toHaveLength(1);
	});

	it("emits run-journey event", async () => {
		const handler = vi.fn();
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		el.addEventListener("run-journey", handler);
		shadowQueryAll(el, ".journey-row")[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const btn = shadowQuery(el, ".run-btn");
		btn?.click();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("emits request-review event", async () => {
		const handler = vi.fn();
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		el.addEventListener("request-review", handler);
		shadowQueryAll(el, ".journey-row")[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const btn = shadowQuery(el, ".review-btn");
		btn?.click();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("emits open-builder event", async () => {
		const handler = vi.fn();
		const el = await fixture("flowti-tm-journeys", { journeys: makeJourneys() });
		el.addEventListener("open-builder", handler);
		shadowQueryAll(el, ".journey-row")[0]?.click();
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const btn = shadowQuery(el, ".builder-btn");
		btn?.click();
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("renders empty state when no journeys", async () => {
		const el = await fixture("flowti-tm-journeys", { journeys: [] });
		const text = shadowText(el);
		expect(text).toContain("No journeys");
	});
});
```

- [ ] **Step 2–5: Red → Green → Commit**

**Read** `src/ui/testManagement/JourneysTab.ts` to port. Key:

Properties: `journeys: JourneyRegistryEntry[]`, `searchText: string`
Internal state: `@state() selectedJourney: string | null`, `@state() typeFilter: string = "all"`, `@state() statusFilter: string = "all"`

Filters render INSIDE the component (above the list), not in the top bar.

Detail sections: header → actions (3 buttons) → run history → traceability → files
Actions emit: `run-journey`, `request-review`, `open-builder` — each with `{ detail: { name: journeyName } }`

Commit message: `"feat(plugin): add flowti-tm-journeys Lit component"`

---

## Chunk 4: Handler Wiring + Switchover

### Task 8: Create test-management-handlers (TDD)

**Files:**
- Create: `tests/infrastructure/handlers/test-management-handlers.test.ts`
- Create: `src/infrastructure/handlers/test-management-handlers.ts`

**Reference:** Read `src/ui/testManagement/TestManagementHubView.ts` for the event wiring and catalog tab construction patterns.

- [ ] **Step 1: Write failing tests**

Create `tests/infrastructure/handlers/test-management-handlers.test.ts`:

```typescript
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { registerTestManagementHandlers } from "../../../src/infrastructure/handlers/test-management-handlers";
import { PluginHandlerRegistry } from "../../../src/infrastructure/handlers/plugin-handler-registry";
import type { IEventBus } from "../../../src/infrastructure/events/types";

// Import components to register custom elements
import "../../../src/components/test-management/flowti-tm-dashboard";
import "../../../src/components/test-management/flowti-tm-pyramid";
import "../../../src/components/test-management/flowti-tm-coverage";
import "../../../src/components/test-management/flowti-tm-compliance";
import "../../../src/components/test-management/flowti-tm-feature-quality";
import "../../../src/components/test-management/flowti-tm-journeys";

function createMockService() {
	return {
		getJourneys: vi.fn(() => []),
		getPyramidWithTrends: vi.fn(() => ({ e2e: { count: 0, passRate: 0, trend: "stable" }, flow: { count: 0, passRate: 0, trend: "stable" }, unit: { count: 0, passRate: 0, trend: "stable" } })),
		getBaseline: vi.fn(() => null),
		getPrds: vi.fn(() => []),
		getCoverage: vi.fn(() => []),
		getCompliance: vi.fn(() => []),
		setBaseline: vi.fn(),
		addComplianceTag: vi.fn(),
		removeComplianceTag: vi.fn(),
		requestReview: vi.fn(),
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

describe("registerTestManagementHandlers", () => {
	let registry: PluginHandlerRegistry;
	let service: ReturnType<typeof createMockService>;
	let eventBus: IEventBus;

	beforeEach(() => {
		registry = new PluginHandlerRegistry();
		service = createMockService();
		eventBus = createMockEventBus();
		registerTestManagementHandlers(registry, {
			service: service as never,
			onboardingService: { shouldShowCallout: vi.fn(() => false) } as never,
			getSettings: () => ({ docsRootPath: "docs" }) as never,
			eventBus,
		});
	});

	it("registers all 8 tab handlers", () => {
		expect(registry.getTabHandler("test-mgmt:journeys")).toBeDefined();
		expect(registry.getTabHandler("test-mgmt:pyramid")).toBeDefined();
		expect(registry.getTabHandler("test-mgmt:coverage")).toBeDefined();
		expect(registry.getTabHandler("test-mgmt:compliance")).toBeDefined();
		expect(registry.getTabHandler("test-mgmt:feature-quality")).toBeDefined();
		expect(registry.getTabHandler("test-mgmt:features")).toBeDefined();
		expect(registry.getTabHandler("test-mgmt:processes")).toBeDefined();
		expect(registry.getTabHandler("test-mgmt:products")).toBeDefined();
	});

	describe("journeys handler", () => {
		it("creates flowti-tm-journeys element", () => {
			const container = document.createElement("div");
			const handler = registry.getTabHandler("test-mgmt:journeys")!;
			handler(container, { tabId: "journeys", viewId: "test", eventBus, searchText: "login" });
			const el = container.querySelector("flowti-tm-journeys");
			expect(el).not.toBeNull();
		});

		it("sets journeys property from service", () => {
			service.getJourneys.mockReturnValue([{ name: "Test" }]);
			const container = document.createElement("div");
			registry.getTabHandler("test-mgmt:journeys")!(container, { tabId: "journeys", viewId: "test", eventBus });
			const el = container.querySelector("flowti-tm-journeys") as unknown as { journeys: unknown[] };
			expect(el.journeys).toHaveLength(1);
		});

		it("passes searchText from context", () => {
			const container = document.createElement("div");
			registry.getTabHandler("test-mgmt:journeys")!(container, { tabId: "journeys", viewId: "test", eventBus, searchText: "login" });
			const el = container.querySelector("flowti-tm-journeys") as unknown as { searchText: string };
			expect(el.searchText).toBe("login");
		});
	});

	describe("pyramid handler", () => {
		it("creates flowti-tm-pyramid element with data", () => {
			const container = document.createElement("div");
			registry.getTabHandler("test-mgmt:pyramid")!(container, { tabId: "pyramid", viewId: "test", eventBus });
			const el = container.querySelector("flowti-tm-pyramid");
			expect(el).not.toBeNull();
			expect(service.getPyramidWithTrends).toHaveBeenCalled();
		});
	});

	describe("coverage handler", () => {
		it("creates flowti-tm-coverage element with pre-computed entries", () => {
			const container = document.createElement("div");
			registry.getTabHandler("test-mgmt:coverage")!(container, { tabId: "coverage", viewId: "test", eventBus });
			const el = container.querySelector("flowti-tm-coverage");
			expect(el).not.toBeNull();
			expect(service.getPrds).toHaveBeenCalled();
			expect(service.getCoverage).toHaveBeenCalled();
		});
	});

	describe("compliance handler", () => {
		it("creates flowti-tm-compliance element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("test-mgmt:compliance")!(container, { tabId: "compliance", viewId: "test", eventBus });
			const el = container.querySelector("flowti-tm-compliance");
			expect(el).not.toBeNull();
		});
	});

	describe("feature-quality handler", () => {
		it("creates flowti-tm-feature-quality element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("test-mgmt:feature-quality")!(container, { tabId: "feature-quality", viewId: "test", eventBus });
			const el = container.querySelector("flowti-tm-feature-quality");
			expect(el).not.toBeNull();
		});
	});

	describe("dashboard handler", () => {
		it("registers a test-management:dashboard handler", () => {
			expect(registry.getTabHandler("test-management:dashboard")).toBeDefined();
		});

		it("dashboard handler creates flowti-tm-dashboard element", () => {
			const container = document.createElement("div");
			registry.getTabHandler("test-management:dashboard")!(container, { tabId: "dashboard", viewId: "test", eventBus });
			expect(container.querySelector("flowti-tm-dashboard")).not.toBeNull();
		});
	});

	describe("event wiring", () => {
		it("journeys handler wires open-builder with dual eventBus emit", () => {
			const container = document.createElement("div");
			registry.getTabHandler("test-mgmt:journeys")!(container, { tabId: "journeys", viewId: "test", eventBus });
			const el = container.querySelector("flowti-tm-journeys")!;
			el.dispatchEvent(new CustomEvent("open-builder", { detail: { name: "Login" }, bubbles: true }));
			expect(eventBus.emit).toHaveBeenCalledWith("ui.openJourneyBuilder", expect.objectContaining({ name: "Login" }));
		});

		it("pyramid handler wires set-baseline to service", () => {
			const container = document.createElement("div");
			registry.getTabHandler("test-mgmt:pyramid")!(container, { tabId: "pyramid", viewId: "test", eventBus });
			const el = container.querySelector("flowti-tm-pyramid")!;
			el.dispatchEvent(new CustomEvent("set-baseline", { bubbles: true }));
			expect(service.setBaseline).toHaveBeenCalled();
		});

		it("compliance handler wires add-tag to service", () => {
			const container = document.createElement("div");
			registry.getTabHandler("test-mgmt:compliance")!(container, { tabId: "compliance", viewId: "test", eventBus });
			const el = container.querySelector("flowti-tm-compliance")!;
			el.dispatchEvent(new CustomEvent("add-tag", { detail: { journeyName: "Login", tagId: "qms-1" }, bubbles: true }));
			expect(service.addComplianceTag).toHaveBeenCalledWith("Login", "qms-1");
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "C:/Projects/flowti/Development/flowti" && npx vitest run tests/infrastructure/handlers/test-management-handlers.test.ts
```

- [ ] **Step 3: Implement test-management-handlers.ts**

Create `src/infrastructure/handlers/test-management-handlers.ts`.

**Read** `src/ui/testManagement/TestManagementHubView.ts` to understand:
- What data each tab handler should fetch from the service
- What events each tab handler should wire (CustomEvent → service method / eventBus emit)
- How catalog deps are constructed (reference `buildCatalogDeps()` method)

Key implementation:
1. Define `TestManagementHandlerDeps` interface (service, onboardingService, getSettings, catalogDeps, eventBus)
2. Register a handler for each of the 8 tabs + 1 dashboard handler (ID: `test-management:dashboard`)
3. Each Lit tab handler: clear container → create element → set properties from service → wire CustomEvent listeners → appendChild
4. Each catalog tab handler: delegate to existing tab class `render()` if catalogDeps available
5. Dashboard handler: create `flowti-tm-dashboard` with journeys, pyramid, recentRuns, onboardingVisible

**Data sources for each handler:**
- **journeys**: `deps.service.getJourneys()`
- **pyramid**: `deps.service.getPyramidWithTrends()`
- **coverage**: `deps.service.getCoverage(deps.service.getPrds())` — pre-computed
- **compliance**: `deps.service.getCompliance()` for scores; import `getCharacteristicsByStandard` from `../../domain/testManagement/complianceDefinitions` (pure function, groups characteristics by standard); `deps.service.getJourneys()` for journey list
- **feature-quality**: import `computeFeatureQuality` from `../../domain/testManagement/featureQualityCalculator` (pure function); call with `deps.service.getJourneys()` and feature names (from `deps.getFeatureNames?.() ?? []`)
- **dashboard**: same as journeys + pyramid + recent runs (slice last 5 with results, sorted by date)

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "C:/Projects/flowti/Development/flowti" && npx vitest run tests/infrastructure/handlers/test-management-handlers.test.ts
```

Expected: All ~12 tests pass.

- [ ] **Step 5: Commit**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/src/infrastructure/handlers/test-management-handlers.ts" "Development/flowti/tests/infrastructure/handlers/test-management-handlers.test.ts" && git commit -m "feat(plugin): add TestManagement tab handler registration"
```

---

### Task 9: Switchover — sitemap update + legacy deletion

**Files:**
- Modify: `plugin-sitemap.json`
- Modify: `src/main.ts` (update view factory registration)
- Delete: 7 legacy files + CSS
- Modify: `tests/infrastructure/sitemap/sitemap-integration.test.ts`

- [ ] **Step 1: Update plugin-sitemap.json**

Replace the `test-management-hub` entry — remove `legacy: true`, add `tabs` and `refreshEvents` as specified in the design spec Section 3.

- [ ] **Step 2: Update integration test**

Add to `tests/infrastructure/sitemap/sitemap-integration.test.ts`:

```typescript
it("test-management-hub is no longer legacy and has tabs", () => {
	const sitemap = loadSitemap();
	const view = sitemap.views["test-management-hub"];
	expect(view.legacy).toBeUndefined();
	expect(view.tabs).toBeDefined();
	expect(view.tabs!.length).toBeGreaterThanOrEqual(8);
	expect(view.refreshEvents).toBeDefined();
	expect(view.refreshEvents!.length).toBeGreaterThan(0);
});
```

- [ ] **Step 3: Run integration tests**

```bash
cd "C:/Projects/flowti/Development/flowti" && npx vitest run tests/infrastructure/sitemap/
```

Expected: All tests pass including the new assertion.

- [ ] **Step 4: Update main.ts view factory registration**

In `src/main.ts`, find where `TestManagementHubView` is constructed (search for `VIEW_TYPE_TEST_MANAGEMENT` or `TestManagementHubView`). The legacy view factory creates it with many deps. Remove this registration — SitemapBootstrap will handle it via the sitemap declaration.

Also call `registerTestManagementHandlers(handlerRegistry, deps)` during Phase 3 registration, before the bootstrap runs.

**Important:** Read `src/main.ts` carefully before modifying. The change should be minimal — just:
1. Remove the legacy view factory for test-management-hub
2. Add handler registration call

- [ ] **Step 5: Delete legacy files**

Delete source files AND their corresponding test files:

```bash
cd "C:/Projects/flowti" && git rm \
  "Development/flowti/src/ui/testManagement/TestManagementHubView.ts" \
  "Development/flowti/src/ui/testManagement/TestManagementDashboard.ts" \
  "Development/flowti/src/ui/testManagement/JourneysTab.ts" \
  "Development/flowti/src/ui/testManagement/PyramidTab.ts" \
  "Development/flowti/src/ui/testManagement/CoverageTab.ts" \
  "Development/flowti/src/ui/testManagement/ComplianceTab.ts" \
  "Development/flowti/src/ui/testManagement/FeatureQualityTab.ts" \
  "Development/flowti/tests/ui/testManagement/TestManagementHubView.test.ts" \
  "Development/flowti/tests/ui/testManagement/TestManagementDashboard.test.ts" \
  "Development/flowti/tests/ui/testManagement/JourneysTab.test.ts" \
  "Development/flowti/tests/ui/testManagement/PyramidTab.test.ts" \
  "Development/flowti/tests/ui/testManagement/CoverageTab.test.ts" \
  "Development/flowti/tests/ui/testManagement/ComplianceTab.test.ts"
```

For CSS: check if catalog tabs use styles from `19-test-management.css`. If yes, keep the file with only catalog-relevant styles. If no, delete it too:
```bash
cd "C:/Projects/flowti" && git rm "Development/flowti/css/19-test-management.css"
```

Note: Keep `src/ui/testManagement/types.ts` if it exists — domain types live in `src/domain/testManagement/types.ts` and are NOT deleted. If `src/ui/testManagement/` becomes empty, remove the directory.

- [ ] **Step 6: Fix any broken imports**

After deletion, check for any remaining imports of the deleted files:
```bash
cd "C:/Projects/flowti/Development/flowti" && npx tsc --noEmit 2>&1 | head -30
```

Fix any broken imports — typically test files that imported the old tab classes.

- [ ] **Step 7: Commit switchover**

```bash
cd "C:/Projects/flowti" && git add "Development/flowti/plugin-sitemap.json" "Development/flowti/src/main.ts" && git commit -m "feat(plugin): switch TestManagement hub from legacy to SitemapHubView + Lit components"
```

Note: The `git rm` commands in Step 5 auto-stage deletions. This commit stages the sitemap update + main.ts change on top.

---

### Task 10: Final verification

- [ ] **Step 1: Run full test suite**

```bash
cd "C:/Projects/flowti/Development/flowti" && npm test
```

Expected: All tests pass (tsc + eslint + vitest). Some existing TestManagement view tests may need updating if they imported deleted files — fix these.

- [ ] **Step 2: Count new PA3 tests**

```bash
cd "C:/Projects/flowti/Development/flowti" && npx vitest run tests/components/test-management/ tests/infrastructure/handlers/test-management-handlers.test.ts --reporter=verbose 2>&1 | tail -10
```

Expected: 80-120+ new tests across 7 files.

- [ ] **Step 3: Verify no legacy references remain**

```bash
cd "C:/Projects/flowti/Development/flowti" && grep -r "TestManagementHubView" src/ --include="*.ts" | grep -v node_modules
```

Expected: No results (or only type imports that are still valid).

---

## Deliverables Checklist

After all tasks complete, verify:

- [ ] `src/components/test-management/` — 6 Lit components
- [ ] `src/infrastructure/handlers/test-management-handlers.ts` — 8 tab handlers + 1 dashboard
- [ ] `plugin-sitemap.json` — test-management-hub has tabs + refreshEvents, no legacy flag
- [ ] `src/ui/views/sitemap-hub-view.ts` — refreshEvents support in onHubOpen
- [ ] Legacy files deleted (7 view/tab files + CSS)
- [ ] 90-120+ new tests across 7 test files (plan specifies ~75 explicitly; implementers add more during TDD)
- [ ] All existing tests pass
- [ ] `npm test` passes (tsc + eslint + vitest)
