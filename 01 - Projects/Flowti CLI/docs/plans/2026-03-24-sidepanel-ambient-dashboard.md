# Sidepanel Ambient Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the Agent World left sidebar from a static 80px launcher rail into a collapsible ambient dashboard (56px collapsed / 200px expanded) with intent-colored portrait rings, pulsing critical-need dots, mini agent cards with SVG needs radars, and SVG action button icons.

**Architecture:** The sidebar component (`sidebar.ts`) is rewritten with two render modes (collapsed/expanded) driven by a private `expanded` boolean. A new `needs-radar.ts` helper renders 6-axis SVG polygons for at-a-glance needs visualization. The slide panel gets frosted backdrop and accent-colored top borders. No DashboardStore API changes.

**Tech Stack:** Lit (html/css), inline SVG, ExcaliburJS game UI overlay

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-24-sidepanel-ambient-dashboard-design.md`

**Test command:** `cd "01 - Projects/Flowti Plugin" && npx vitest run <test-file>`

**All source paths are relative to:** `01 - Projects/Flowti Plugin/`

---

## Chunk 1: Foundation (Constants + Radar Helper)

### Task 1: Add Threshold Constants to game-ui-constants.ts

**Files:**
- Modify: `src/game/ui/game-ui-constants.ts`

- [ ] **Step 1: Add constants**

Add at the end of the file, before the closing:

```typescript
export const NEED_WARN_THRESHOLD = 60;
export const NEED_CRITICAL_THRESHOLD = 25;
```

- [ ] **Step 2: Commit** `feat(plugin): add need threshold constants`

---

### Task 2: Create Needs Radar Helper — TDD

**Files:**
- Create: `src/game/ui/needs-radar.ts`
- Create: `tests/game/ui/needs-radar.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/game/ui/needs-radar.test.ts`:

```typescript
// @vitest-environment happy-dom
import { describe, it, expect, vi } from "vitest";

vi.mock("lit", () => ({
	html: (strings: TemplateStringsArray, ...values: unknown[]) => ({ strings, values }),
	css: () => ({}),
	nothing: Symbol("nothing"),
}));

vi.mock("../../../src/game/ui/game-styles.js", () => ({
	resetStyles: {}, colorStyles: {}, fontStyles: {}, buttonStyles: {}, scrollStyles: {},
}));

vi.mock("../../../src/game/ui/game-ui-constants.js", () => ({
	NEED_META: [
		{ label: "Energy", key: "energy", color: "#22c55e" },
		{ label: "Hunger", key: "hunger", color: "#f97316" },
		{ label: "Thirst", key: "thirst", color: "#06b6d4" },
		{ label: "Focus", key: "focus", color: "#a855f7" },
		{ label: "Social", key: "social", color: "#f59e0b" },
		{ label: "Morale", key: "morale", color: "#ec4899" },
	],
	NEED_WARN_THRESHOLD: 60,
	NEED_CRITICAL_THRESHOLD: 25,
}));

import { renderNeedsRadar, getRadarHealthColor } from "../../../src/game/ui/needs-radar.js";

describe("getRadarHealthColor", () => {
	it("returns green when all needs >= 60", () => {
		const needs = { energy: 80, hunger: 70, thirst: 90, focus: 60, social: 75, morale: 65 };
		expect(getRadarHealthColor(needs)).toBe("green");
	});

	it("returns amber when any need is 25-59", () => {
		const needs = { energy: 80, hunger: 40, thirst: 90, focus: 60, social: 75, morale: 65 };
		expect(getRadarHealthColor(needs)).toBe("amber");
	});

	it("returns red when any need < 25", () => {
		const needs = { energy: 80, hunger: 10, thirst: 90, focus: 60, social: 75, morale: 65 };
		expect(getRadarHealthColor(needs)).toBe("red");
	});

	it("returns red when need is exactly 0", () => {
		const needs = { energy: 0, hunger: 50, thirst: 50, focus: 50, social: 50, morale: 50 };
		expect(getRadarHealthColor(needs)).toBe("red");
	});

	it("returns green when all needs are exactly 60", () => {
		const needs = { energy: 60, hunger: 60, thirst: 60, focus: 60, social: 60, morale: 60 };
		expect(getRadarHealthColor(needs)).toBe("green");
	});

	it("returns amber when need is exactly 25", () => {
		const needs = { energy: 25, hunger: 80, thirst: 80, focus: 80, social: 80, morale: 80 };
		expect(getRadarHealthColor(needs)).toBe("amber");
	});
});

describe("renderNeedsRadar", () => {
	it("returns a template result", () => {
		const needs = { energy: 80, hunger: 70, thirst: 90, focus: 60, social: 75, morale: 65 };
		const result = renderNeedsRadar(needs, 30);
		expect(result).toBeDefined();
		expect(result.strings).toBeDefined();
	});

	it("includes svg element in template", () => {
		const needs = { energy: 50, hunger: 50, thirst: 50, focus: 50, social: 50, morale: 50 };
		const result = renderNeedsRadar(needs, 30);
		const joined = result.strings.join("");
		expect(joined).toContain("<svg");
		expect(joined).toContain("polygon");
	});

	it("uses size parameter for viewBox", () => {
		const needs = { energy: 50, hunger: 50, thirst: 50, focus: 50, social: 50, morale: 50 };
		const result = renderNeedsRadar(needs, 40);
		const joined = result.strings.join("");
		expect(joined).toContain("40");
	});

	it("handles undefined needs gracefully", () => {
		const result = renderNeedsRadar(undefined as any, 30);
		expect(result).toBeDefined();
	});
});
```

- [ ] **Step 2: Run tests — expect FAIL (module not found)**

- [ ] **Step 3: Create the radar helper**

Create `src/game/ui/needs-radar.ts`:

```typescript
/**
 * needs-radar.ts — SVG hexagonal needs radar for agent cards.
 *
 * Renders a compact polygon-on-hexagon visualization of 6 agent needs.
 * The shape symmetry conveys health at a glance: symmetric = healthy,
 * lopsided = deficient. Color shifts green → amber → red.
 */

import { html, type TemplateResult } from "lit";
import { NEED_META, NEED_WARN_THRESHOLD, NEED_CRITICAL_THRESHOLD } from "./game-ui-constants.js";
import type { AgentNeeds } from "../systems/blackboard.js";

const FILL_OPACITY: Record<string, number> = { green: 0.35, amber: 0.35, red: 0.4 };
const STROKE_OPACITY: Record<string, number> = { green: 0.8, amber: 0.8, red: 0.9 };
const HEALTH_CSS: Record<string, string> = {
	green: "var(--accent-green, #4ed97a)",
	amber: "var(--accent-gold, #d9aa4e)",
	red: "var(--accent-red, #d94e4e)",
};

/** Determine radar color tier from the lowest need value. */
export function getRadarHealthColor(needs: AgentNeeds): "green" | "amber" | "red" {
	const values = NEED_META.map((m) => needs[m.key] ?? 0);
	const min = Math.min(...values);
	if (min < NEED_CRITICAL_THRESHOLD) return "red";
	if (min < NEED_WARN_THRESHOLD) return "amber";
	return "green";
}

/** Compute hexagon vertex at angle index (0-5) scaled to radius. */
function hexPoint(cx: number, cy: number, radius: number, index: number): string {
	const angle = (Math.PI / 3) * index - Math.PI / 2;
	const x = cx + radius * Math.cos(angle);
	const y = cy + radius * Math.sin(angle);
	return `${x.toFixed(1)},${y.toFixed(1)}`;
}

/** Build SVG polygon points string from 6 need values. */
function radarPoints(cx: number, cy: number, maxR: number, needs: AgentNeeds): string {
	return NEED_META.map((m, i) => {
		const value = Math.max(0, Math.min(100, needs[m.key] ?? 0));
		const r = (value / 100) * maxR;
		return hexPoint(cx, cy, r, i);
	}).join(" ");
}

/** Build the outer reference hexagon points at full radius. */
function hexagonPoints(cx: number, cy: number, radius: number): string {
	return Array.from({ length: 6 }, (_, i) => hexPoint(cx, cy, radius, i)).join(" ");
}

/**
 * Render a compact hexagonal needs radar as inline SVG.
 * Returns an html template — embed directly in Lit render output.
 */
export function renderNeedsRadar(needs: AgentNeeds | undefined, size: number): TemplateResult {
	const cx = size / 2;
	const cy = size / 2;
	const maxR = size * 0.43; // 13px at size=30

	const safeNeeds: AgentNeeds = needs ?? { energy: 0, social: 0, focus: 0, morale: 0, hunger: 0, thirst: 0 };
	const health = getRadarHealthColor(safeNeeds);
	const color = HEALTH_CSS[health];
	const fillOp = FILL_OPACITY[health];
	const strokeOp = STROKE_OPACITY[health];

	const outerPts = hexagonPoints(cx, cy, maxR);
	const dataPts = radarPoints(cx, cy, maxR, safeNeeds);

	return html`
		<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="display:block">
			<polygon points="${outerPts}" fill="none" stroke="var(--border, #1e2a42)" stroke-width="0.5" opacity="0.3"/>
			<polygon points="${dataPts}" fill="${color}" fill-opacity="${fillOp}" stroke="${color}" stroke-width="1" stroke-opacity="${strokeOp}"/>
		</svg>
	`;
}
```

- [ ] **Step 4: Run tests — expect PASS**
- [ ] **Step 5: Commit** `feat(plugin): add needs radar SVG helper`

---

## Chunk 2: Slide Panel Polish

### Task 3: Add Frosted Backdrop + Accent Top-Border to Slide Panel

**Files:**
- Modify: `src/game/ui/slide-panel.ts`
- Modify: `src/game/ui/sidebar.ts` (add `--panel-accent` per panel type)

- [ ] **Step 1: Add backdrop-filter and accent border to slide-panel.ts**

In `slide-panel.ts`, add a new property `accent`:

```typescript
static properties = {
	...FlowtiElement.properties,
	open: { type: Boolean, reflect: true },
	title: { type: String },
	accent: { type: String },
};
```

Add `accent = "";` to the class body.

In the `.panel-backdrop` CSS rule, add:
```css
backdrop-filter: blur(4px);
-webkit-backdrop-filter: blur(4px);
```

Add a new CSS rule for the accent border:
```css
.panel-accent-bar {
	height: 2px;
	flex-shrink: 0;
}
```

In the `renderContent()` template, add the accent bar as the first child of `.panel`:
```html
<div class="panel">
	<div class="panel-accent-bar" style="background:${this.accent || 'transparent'}"></div>
	<div class="panel-header">
	...
```

- [ ] **Step 2: Update sidebar.ts to pass accent colors**

In `sidebar.ts` `renderPanel()`, add accent to the slide-panel:

```typescript
private panelAccent(mode: PanelMode): string {
	switch (mode) {
		case "agent-detail": return "var(--text-primary)";
		case "bob": return "var(--accent-blue)";
		case "roster": return "var(--accent-green)";
		case "merchant": return "var(--accent-gold)";
		case "briefing": return "var(--accent-purple)";
	}
}
```

Update the `<ft-game-slide-panel>` in `renderPanel()`:
```html
<ft-game-slide-panel
	?open=${true}
	title=${title}
	accent=${this.panelAccent(mode)}
	@panel-close=${() => this.handlePanelClose()}
>
```

- [ ] **Step 3: Run existing sidebar + slide panel tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/sidebar.test.ts tests/game/ui/slide-panel.test.ts
```

- [ ] **Step 4: Commit** `feat(plugin): add frosted backdrop and accent border to slide panel`

---

## Chunk 3: Sidebar Rewrite

### Task 4: Add CSS Variables to game-styles.ts

**Files:**
- Modify: `src/game/ui/game-styles.ts`

- [ ] **Step 1: Add rail width variables**

In the `colorStyles` css block, inside the `:host` rule, add:

```css
--rail-width-collapsed: 56px;
--rail-width-expanded: 200px;
```

- [ ] **Step 2: Commit** `feat(plugin): add rail width CSS variables`

---

### Task 5: Rewrite Sidebar — Collapsed Rail

This task rewrites `sidebar.ts` to render the collapsed state with intent-colored portrait rings, critical-need pulsing dots, SVG icon buttons, and the expand chevron.

**Files:**
- Modify: `src/game/ui/sidebar.ts`

- [ ] **Step 1: Add private state properties and imports**

Add the needs-radar import and new private state:

```typescript
import "./needs-radar.js";
import { renderNeedsRadar } from "./needs-radar.js";
import { STATE_COLORS, NEED_CRITICAL_THRESHOLD, NEED_META } from "./game-ui-constants.js";
import type { AgentIntent, AgentNeeds } from "../systems/blackboard.js";
```

Add private properties to the class body:

```typescript
private expanded = false;
private expandedBeforePanel: boolean | null = null;
private previousActivePanel: string | null = null;
```

- [ ] **Step 2: Add auto-collapse logic**

Add a method that checks for panel transitions in `renderContent()`:

```typescript
private checkAutoCollapse(): void {
	const current = this.store?.activePanel ?? null;
	const prev = this.previousActivePanel;
	if (prev === null && current !== null) {
		// Panel opened — save and collapse
		this.expandedBeforePanel = this.expanded;
		this.expanded = false;
	} else if (prev !== null && current === null) {
		// Panel closed — restore
		this.expanded = this.expandedBeforePanel ?? false;
		this.expandedBeforePanel = null;
	}
	this.previousActivePanel = current;
}

private toggleExpand(): void {
	this.expanded = !this.expanded;
	this.requestUpdate();
}
```

- [ ] **Step 3: Add helper methods for agent data**

```typescript
private getAgentIntent(name: string): AgentIntent {
	return this.store?.agentIntents?.get(name) ?? "idle";
}

private getIntentColor(name: string): string {
	const intent = this.getAgentIntent(name);
	return STATE_COLORS[intent] ?? "#6b7280";
}

private hasLowNeed(name: string): boolean {
	const needs = this.store?.getAgentNeeds(name);
	if (!needs) return false;
	return NEED_META.some((m) => (needs[m.key] ?? 100) < NEED_CRITICAL_THRESHOLD);
}
```

- [ ] **Step 4: Replace the CSS with the new collapsible rail styles**

Replace the entire `static styles` block with the new styles. Key additions:
- `:host` uses `width: var(--rail-width-collapsed)` with `transition: width 200ms ease-out`
- `:host([expanded])` uses `width: var(--rail-width-expanded)`
- `.council-slot` wrapper with `position: relative` for the pulsing dot
- `.critical-dot` — 4px absolute-positioned red pulsing circle
- `.chevron` — toggle button with opacity transitions
- `.action-btn` with inline SVG sizing
- `.agent-card` — expanded state mini card layout
- `.agent-card-info` — name + intent row
- `@keyframes pulse` for the critical dot

- [ ] **Step 5: Rewrite renderContent() for collapsed state**

The render function calls `checkAutoCollapse()` first, then conditionally renders collapsed or expanded:

```typescript
protected renderContent() {
	this.checkAutoCollapse();
	const slots = this.councilAgents;
	const active = this.store?.activePanel;

	return html`
		${this.expanded ? this.renderExpanded(slots, active) : this.renderCollapsed(slots, active)}
		${this.renderPanel()}
	`;
}
```

The `renderCollapsed` method renders portrait circles with intent-ring + pulsing dot + tooltip:

```typescript
private renderCollapsed(slots: (DashboardAgent | null)[], active: string | null) {
	return html`
		<div class="council-slots">
			${slots.map((agent) => agent
				? this.renderCollapsedSlot(agent)
				: html`<div class="council-slot empty-slot"></div>`
			)}
		</div>
		<button class="chevron" @click=${() => this.toggleExpand()} title="Expand sidebar">&#x203A;</button>
		<div class="spacer"></div>
		${this.renderActionButtons(active)}
	`;
}
```

- [ ] **Step 6: Add SVG icon buttons**

Replace the "B", "R", "M" text with inline SVG paths:

```typescript
private renderActionButtons(active: string | null) {
	return html`
		<button class="action-btn" ?data-active=${active === "bob"} @click=${() => this.togglePanel("bob")} title="Ask Bob">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<rect x="2" y="4" width="20" height="14" rx="3"/>
				<path d="M8 18 l-2 3 l4 -1"/>
			</svg>
		</button>
		<button class="action-btn" ?data-active=${active === "roster"} @click=${() => this.togglePanel("roster")} title="Council & Roster">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<circle cx="9" cy="8" r="4"/><path d="M1 20 c0,-5 4,-8 8,-8 c4,0 8,3 8,8"/>
				<circle cx="17" cy="7" r="3"/><path d="M19 20 c3,-1 5,-3 5,-6 c-1,-2 -3,-3 -5,-3"/>
			</svg>
		</button>
		<button class="action-btn" ?data-active=${active === "merchant"} @click=${() => this.togglePanel("merchant")} title="Merchant">
			<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
				<path d="M3 9 l1,-5 h16 l1,5"/><path d="M3 9 v12 h18 v-12"/><rect x="9" y="14" width="6" height="7"/>
				<path d="M3 9 c0,2 2,3 3,3 c2,0 3,-1 3,-3 c0,2 2,3 3,3 c2,0 3,-1 3,-3 c0,2 2,3 3,3 c2,0 3,-1 3,-3"/>
			</svg>
		</button>
	`;
}
```

- [ ] **Step 7: Run tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/sidebar.test.ts
```

- [ ] **Step 8: Commit** `feat(plugin): rewrite sidebar with collapsible rail and SVG icons`

---

### Task 6: Sidebar Expanded State with Mini Cards + Radar

**Files:**
- Modify: `src/game/ui/sidebar.ts`

- [ ] **Step 1: Add the expanded render method**

```typescript
private renderExpanded(slots: (DashboardAgent | null)[], active: string | null) {
	return html`
		<div class="expanded-header">
			<button class="chevron collapse" @click=${() => this.toggleExpand()} title="Collapse sidebar">&#x2039;</button>
		</div>
		<div class="council-slots expanded">
			${slots.map((agent) => agent
				? this.renderAgentCard(agent)
				: html`<div class="agent-card empty-card"></div>`
			)}
		</div>
		<div class="spacer"></div>
		${this.renderActionButtons(active)}
	`;
}
```

- [ ] **Step 2: Add the agent card renderer**

```typescript
private renderAgentCard(agent: DashboardAgent) {
	const intentColor = this.getIntentColor(agent.name);
	const intent = this.getAgentIntent(agent.name);
	const needs = this.store?.getAgentNeeds(agent.name);
	const low = this.hasLowNeed(agent.name);

	return html`
		<div class="agent-card" @click=${() => this.handleCouncilClick(agent)}>
			<div class="agent-card-top">
				<div class="portrait-wrap">
					${renderPortrait(agent.name, agent.domain ?? "fallback", 32, agent.trustTier, this.store?.spriteBasePath)}
					${low ? html`<span class="critical-dot"></span>` : nothing}
				</div>
				<div class="agent-card-info">
					<span class="card-name">${agent.name}</span>
					<span class="card-intent">
						<span class="intent-dot" style="background:${intentColor}"></span>
						${intent}
					</span>
				</div>
			</div>
			<div class="agent-card-radar">
				${renderNeedsRadar(needs, 30)}
			</div>
		</div>
	`;
}
```

- [ ] **Step 3: Add expanded-state CSS rules**

Add to the styles block:

```css
:host([expanded]) {
	width: var(--rail-width-expanded);
}

.expanded-header {
	display: flex;
	justify-content: flex-end;
	padding: 0 8px;
	margin-bottom: 4px;
}

.council-slots.expanded {
	align-items: stretch;
	padding: 0 8px;
}

.agent-card {
	background: var(--bg-secondary);
	border: 1px solid var(--border);
	border-radius: 4px;
	padding: 8px;
	cursor: pointer;
	transition: border-color 0.15s;
}

.agent-card:hover {
	border-color: rgba(217, 170, 78, 0.4);
}

.empty-card {
	border-style: dashed;
	opacity: 0.3;
	min-height: 48px;
}

.agent-card-top {
	display: flex;
	align-items: center;
	gap: 8px;
}

.portrait-wrap {
	position: relative;
	flex-shrink: 0;
}

.agent-card-info {
	display: flex;
	flex-direction: column;
	min-width: 0;
	gap: 2px;
}

.card-name {
	font-size: 12px;
	color: var(--text-primary);
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.card-intent {
	font-size: 10px;
	color: var(--text-secondary);
	display: flex;
	align-items: center;
	gap: 4px;
}

.intent-dot {
	width: 6px;
	height: 6px;
	border-radius: 50%;
	flex-shrink: 0;
}

.agent-card-radar {
	display: flex;
	justify-content: center;
	margin-top: 4px;
}
```

- [ ] **Step 4: Wire up the `expanded` attribute reflection**

In the class, reflect the expanded state to the host attribute for CSS:

```typescript
updated(changedProperties: Map<string, unknown>): void {
	super.updated(changedProperties);
	if (this.expanded) {
		this.setAttribute("expanded", "");
	} else {
		this.removeAttribute("expanded");
	}
}
```

- [ ] **Step 5: Run tests**
- [ ] **Step 6: Commit** `feat(plugin): add expanded sidebar state with agent cards and radar`

---

### Task 7: Update Sidebar Tests

**Files:**
- Modify: `tests/game/ui/sidebar.test.ts`

- [ ] **Step 1: Update mock to include new exports**

Update the `game-ui-constants.js` mock:

```typescript
vi.mock("../../../src/game/ui/game-ui-constants.js", () => ({
	TRUST_TIER_COLORS: { supervised: "#f59e0b", trusted: "#22c55e", autonomous: "#8b5cf6" },
	STATUS_DOT_COLORS: { busy: "#22c55e", idle: "#3b82f6", unassigned: "#6b7280" },
	COUNCIL_SLOT_COUNT: 5,
	NEED_META: [
		{ label: "Energy", key: "energy", color: "#22c55e" },
		{ label: "Hunger", key: "hunger", color: "#f97316" },
		{ label: "Thirst", key: "thirst", color: "#06b6d4" },
		{ label: "Focus", key: "focus", color: "#a855f7" },
		{ label: "Social", key: "social", color: "#f59e0b" },
		{ label: "Morale", key: "morale", color: "#ec4899" },
	],
	STATE_COLORS: { idle: "#3b82f6", working: "#22c55e", "on-break": "#a855f7", talking: "#06b6d4", seeking: "#6b7280", waiting: "#f59e0b" },
	NEED_WARN_THRESHOLD: 60,
	NEED_CRITICAL_THRESHOLD: 25,
	getCouncilSlots: (names: string[], agents: { name: string }[]) => {
		const slots: ({ name: string } | null)[] = [];
		for (let i = 0; i < 5; i++) {
			const name = names[i];
			slots.push(name ? (agents.find(a => a.name === name) ?? null) : null);
		}
		return slots;
	},
	relativeTime: () => "0s",
}));
```

Add needs-radar mock:
```typescript
vi.mock("../../../src/game/ui/needs-radar.js", () => ({
	renderNeedsRadar: vi.fn(() => ({ strings: ["<radar-mock>"], values: [] })),
}));
```

Update `createMockStore` to include `agentIntents` and fix needs to 0-100 scale:

```typescript
agentIntents: new Map([["Alice", "working"], ["Bob", "idle"]]),
getAgentNeeds: vi.fn((name: string) => name === "Alice"
	? { energy: 80, hunger: 70, thirst: 90, focus: 60, social: 75, morale: 65 }
	: { energy: 20, hunger: 50, thirst: 50, focus: 50, social: 50, morale: 50 }),
```

- [ ] **Step 2: Add tests for new behavior**

```typescript
it("starts collapsed by default", () => {
	const el = document.createElement("ft-game-sidebar") as unknown as SidebarInternal;
	expect(el.expanded).toBe(false);
});

it("toggleExpand flips expanded state", () => {
	const el = document.createElement("ft-game-sidebar") as unknown as SidebarInternal;
	const store = createMockStore();
	el.store = store;
	el.toggleExpand();
	expect(el.expanded).toBe(true);
	el.toggleExpand();
	expect(el.expanded).toBe(false);
});

it("auto-collapses when panel opens", () => {
	const el = document.createElement("ft-game-sidebar") as unknown as SidebarInternal;
	const store = createMockStore();
	el.store = store;
	el.expanded = true;
	el.previousActivePanel = null;
	store.activePanel = "bob";
	el.checkAutoCollapse();
	expect(el.expanded).toBe(false);
	expect(el.expandedBeforePanel).toBe(true);
});

it("restores expanded state when panel closes", () => {
	const el = document.createElement("ft-game-sidebar") as unknown as SidebarInternal;
	const store = createMockStore();
	el.store = store;
	el.expanded = false;
	el.expandedBeforePanel = true;
	el.previousActivePanel = "bob";
	store.activePanel = null;
	el.checkAutoCollapse();
	expect(el.expanded).toBe(true);
	expect(el.expandedBeforePanel).toBeNull();
});

it("hasLowNeed detects critical needs", () => {
	const el = document.createElement("ft-game-sidebar") as unknown as SidebarInternal;
	const store = createMockStore();
	el.store = store;
	// Bob has energy: 20 which is < 25
	expect(el.hasLowNeed("Bob")).toBe(true);
	// Alice has all needs >= 60
	expect(el.hasLowNeed("Alice")).toBe(false);
});

it("panelAccent returns correct color per mode", () => {
	const el = document.createElement("ft-game-sidebar") as unknown as SidebarInternal;
	expect(el.panelAccent("bob")).toBe("var(--accent-blue)");
	expect(el.panelAccent("roster")).toBe("var(--accent-green)");
	expect(el.panelAccent("merchant")).toBe("var(--accent-gold)");
	expect(el.panelAccent("briefing")).toBe("var(--accent-purple)");
	expect(el.panelAccent("agent-detail")).toBe("var(--text-primary)");
});
```

- [ ] **Step 3: Update SidebarInternal type to include new methods/properties**

```typescript
type SidebarInternal = GameSidebar & {
	expanded: boolean;
	expandedBeforePanel: boolean | null;
	previousActivePanel: string | null;
	handleCouncilClick(agent: { name: string }): void;
	togglePanel(mode: string): void;
	toggleExpand(): void;
	handlePanelClose(): void;
	panelTitle(mode: string): string;
	panelAccent(mode: string): string;
	renderPanel(): unknown;
	renderPanelContent(mode: string): unknown;
	checkAutoCollapse(): void;
	hasLowNeed(name: string): boolean;
	getIntentColor(name: string): string;
	getAgentIntent(name: string): string;
	councilAgents: ({ name: string } | null)[];
};
```

- [ ] **Step 4: Run all tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/sidebar.test.ts tests/game/ui/needs-radar.test.ts
```

- [ ] **Step 5: Commit** `test(plugin): update sidebar tests for ambient dashboard`

---

## Chunk 4: Verification

### Task 8: Full Test Suite + Build Verification

- [ ] **Step 1: Run full game test suite**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/
```
Expected: ALL PASS

- [ ] **Step 2: Run full test suite**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run
```
Expected: ALL PASS

- [ ] **Step 3: Build**

```bash
cd "01 - Projects/Flowti Plugin" && npm run build
```
Expected: Build succeeds

- [ ] **Step 4: Final commit if any build fixes needed**
