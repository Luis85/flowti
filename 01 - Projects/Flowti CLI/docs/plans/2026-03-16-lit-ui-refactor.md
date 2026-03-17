# Lit UI Refactor + Direction Arrow Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all vanilla DOM UI in the ExcaliburJS agent dashboard with Lit web components, add a reactive store, and add per-agent direction arrow overlays.

**Architecture:** Three-layer separation: ExcaliburJS engine (canvas only) → Dashboard Store (reactive EventTarget) → Lit components (Shadow DOM overlays). Components never import ExcaliburJS. The store mediates all state and actions.

**Tech Stack:** Lit 3.x, ExcaliburJS 0.32, TypeScript ES2022 (with `experimentalDecorators: true`), esbuild, vitest + jsdom

**Important notes:**
- Lit 3.x decorators (`@customElement`, `@property`) require `experimentalDecorators: true` in tsconfig. esbuild also requires this to handle decorator syntax. Added in Task 1.
- All component tests must include `afterEach(() => el.remove())` to clean up DOM between tests.
- Task ordering: Tasks 13-14 (brain entries + camera simplification) come before Task 12 (main.ts rewire).

**Spec:** `docs/specs/2026-03-16-lit-ui-refactor-design.md`

---

## File Map

### New Files (13)

| File | Responsibility |
|------|---------------|
| `src/store/dashboard-store.ts` | Reactive store (EventTarget), holds all UI state, exposes action methods |
| `src/data/message-utils.ts` | `extractAgentMessage()` utility extracted from talk-tab |
| `src/ui/shared-styles.ts` | Common Lit `css` templates (reset, colors, fonts, buttons) |
| `src/ui/dashboard-overlays.ts` | `<dashboard-overlays>` — direction arrows for all agents |
| `src/ui/roster-bar.ts` | `<roster-bar>` — bottom bar with domain agent cards |
| `src/ui/camera-hud.ts` | `<camera-hud>` — follow indicator |
| `src/ui/agent-panel.ts` | `<agent-panel>` — panel shell with tab switching |
| `src/ui/panel-info.ts` | `<panel-info>` — Info tab |
| `src/ui/panel-talk.ts` | `<panel-talk>` — Chat tab with thinking indicator |
| `src/ui/panel-tasks.ts` | `<panel-tasks>` — Tasks tab with confirmation dialog |
| `src/ui/panel-permissions.ts` | `<panel-permissions>` — Permissions tab |
| `src/ui/panel-history.ts` | `<panel-history>` — History tab |

### Deleted Files (8)

```
src/ui/panel-manager.ts
src/ui/panel-styles.ts
src/ui/agent-panel.ts      (replaced by Lit version)
src/ui/talk-tab.ts          (replaced by panel-talk + message-utils)
src/ui/tasks-tab.ts
src/ui/permissions-tab.ts
src/ui/history-tab.ts
src/ui/roster-bar.ts        (replaced by Lit version)
```

### Modified Files

| File | Changes |
|------|---------|
| `src/main.ts` | Remove all DOM creation/callbacks. Add store, sync→store bridge, frame adapter, mount Lit components. |
| `package.json` | Add `lit` dependency |

---

## Chunk 1: Foundation

### Task 1: Add Lit dependency and verify build

**Files:**
- Modify: `agents/package.json`

- [ ] **Step 1: Install lit and configure tsconfig**

```bash
cd "01 - Projects/Flowti CLI/agents" && npm install lit
```

Add `"experimentalDecorators": true` to `agents/tsconfig.json` (create if needed, or add to the root tsconfig's `compilerOptions`). This is required for Lit 3.x decorators and esbuild compatibility.

- [ ] **Step 2: Verify esbuild can bundle Lit**

Create a quick smoke test — add a temporary import in main.ts and build:

```bash
cd "01 - Projects/Flowti CLI/agents" && node -e "
import('esbuild').then(({build}) => build({
  stdin: { contents: 'import {LitElement} from \"lit\"; console.log(LitElement);', loader: 'ts' },
  bundle: true, write: false, format: 'esm', platform: 'browser'
}).then(r => console.log('OK:', r.outputFiles[0].text.length, 'bytes')))"
```

Expected: `OK: <number> bytes` — confirms Lit bundles with esbuild.

- [ ] **Step 3: Commit**

```bash
git add agents/package.json agents/package-lock.json
git commit -m "feat(dashboard): add lit dependency"
```

---

### Task 2: Extract message-utils

**Files:**
- Create: `src/data/message-utils.ts`
- Test: `tests/data/message-utils.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// tests/data/message-utils.test.ts
import { describe, it, expect } from "vitest";
import { extractAgentMessage } from "../src/data/message-utils.js";

describe("extractAgentMessage", () => {
	it("extracts message from JSON object", () => {
		const raw = '{"message": "Hello!", "status": "message"}';
		expect(extractAgentMessage(raw)).toBe("Hello!");
	});

	it("strips markdown code fences", () => {
		const raw = '```json\n{"message": "Hi", "status": "message"}\n```';
		expect(extractAgentMessage(raw)).toBe("Hi");
	});

	it("returns raw text if not JSON", () => {
		expect(extractAgentMessage("Just plain text")).toBe("Just plain text");
	});

	it("returns cleaned text if fences but invalid JSON", () => {
		const raw = "```\nnot json\n```";
		expect(extractAgentMessage(raw)).toBe("not json");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run tests/data/message-utils.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement message-utils**

```typescript
// src/data/message-utils.ts
/** Strip markdown code fences and extract message from JSON agent responses. */
export function extractAgentMessage(raw: string): string {
	let cleaned = raw.replace(/```(?:json)?\s*/gi, "").replace(/```/g, "").trim();

	try {
		const parsed: unknown = JSON.parse(cleaned);
		if (parsed && typeof parsed === "object" && "message" in parsed) {
			const msg = (parsed as { message: unknown }).message;
			if (typeof msg === "string") return msg;
		}
	} catch {
		// Not JSON — use as-is
	}

	if (raw !== cleaned) return cleaned;
	return raw;
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run tests/data/message-utils.test.ts
```

Expected: PASS — all 4 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/data/message-utils.ts tests/data/message-utils.test.ts
git commit -m "feat(dashboard): extract message-utils from talk-tab"
```

---

### Task 3: Create dashboard store

**Files:**
- Create: `src/store/dashboard-store.ts`
- Test: `tests/store/dashboard-store.test.ts`

- [ ] **Step 1: Write store tests**

```typescript
// tests/store/dashboard-store.test.ts
import { describe, it, expect, vi } from "vitest";
import { DashboardStore } from "../src/store/dashboard-store.js";

describe("DashboardStore", () => {
	it("dispatches state-changed on agent update", () => {
		const store = new DashboardStore();
		const listener = vi.fn();
		store.addEventListener("state-changed", listener);

		store.setAgents([{ name: "Bob", agentType: "ai", status: "idle" } as any]);

		expect(listener).toHaveBeenCalledTimes(1);
		expect(store.agents).toHaveLength(1);
		expect(store.agents[0].name).toBe("Bob");
	});

	it("tracks selected agent", () => {
		const store = new DashboardStore();
		expect(store.selectedAgent).toBeNull();

		store.selectAgent("Bob");
		expect(store.selectedAgent).toBe("Bob");

		store.selectAgent(null);
		expect(store.selectedAgent).toBeNull();
	});

	it("manages conversations", () => {
		const store = new DashboardStore();

		store.pushUserMessage("Bob", "Hello");
		expect(store.getConversation("Bob")).toEqual([
			{ role: "user", text: "Hello" },
		]);
		expect(store.isThinking("Bob")).toBe(true);

		store.pushAgentResponse("Bob", "Hi there!");
		expect(store.getConversation("Bob")).toHaveLength(2);
		expect(store.isThinking("Bob")).toBe(false);
	});

	it("tracks agent positions", () => {
		const store = new DashboardStore();

		store.updatePositions(
			new Map([["Bob", { x: 100, y: 200 }]]),
			new Map([["Bob", { x: 300, y: 400 }]]),
			new Map([["Bob", "wandering" as any]]),
		);

		expect(store.agentPositions.get("Bob")).toEqual({ x: 100, y: 200 });
		expect(store.agentTargets.get("Bob")).toEqual({ x: 300, y: 400 });
	});

	it("tracks LLM status", () => {
		const store = new DashboardStore();
		store.setLlmStatus("Bob", "waking");
		expect(store.llmStatus.get("Bob")).toBe("waking");
	});

	it("tracks followed agent", () => {
		const store = new DashboardStore();
		store.startFollow("Bob");
		expect(store.followedAgent).toBe("Bob");
		store.stopFollow();
		expect(store.followedAgent).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run tests/store/dashboard-store.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement the store**

```typescript
// src/store/dashboard-store.ts
/**
 * dashboard-store.ts — Reactive state store for the dashboard UI.
 *
 * Single source of truth between ExcaliburJS engine and Lit components.
 * Extends EventTarget — dispatches "state-changed" on every mutation.
 * Lit components subscribe and call requestUpdate().
 */

import type {
	DashboardAgent,
	ActivityEntry,
	PermissionEntry,
	AgentActionType,
} from "../data/types.js";
import type { BrainState } from "../brain/brain-types.js";
import {
	sendMessage as apiSendMessage,
	assignTask as apiAssignTask,
	grantPermission as apiGrantPermission,
	wakeAgent as apiWakeAgent,
} from "../data/api-client.js";

// ── Types ────────────────────────────────────────────────────────────

export type LlmStatus = "dormant" | "waking" | "active" | "none";
export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";
export type TabName = "Info" | "Talk" | "Tasks" | "Permissions" | "History";

export interface ConversationTurn {
	readonly role: "user" | "agent";
	readonly text: string;
}

export interface Point {
	readonly x: number;
	readonly y: number;
}

// ── Store ────────────────────────────────────────────────────────────

export class DashboardStore extends EventTarget {
	// ── Agent roster ─────────────────────────────────────
	agents: readonly DashboardAgent[] = [];

	// ── Per-frame position data (from engine) ────────────
	agentPositions = new Map<string, Point>();
	agentTargets = new Map<string, Point | null>();
	agentStates = new Map<string, BrainState>();

	// ── UI state ─────────────────────────────────────────
	selectedAgent: string | null = null;
	selectedTab: TabName = "Info";
	followedAgent: string | null = null;
	connectionStatus: ConnectionStatus = "reconnecting";

	// ── Data ─────────────────────────────────────────────
	activityLog: readonly ActivityEntry[] = [];
	permissions = new Map<string, readonly PermissionEntry[]>();
	llmStatus = new Map<string, LlmStatus>();

	// ── Conversations ────────────────────────────────────
	private conversations = new Map<string, ConversationTurn[]>();
	private thinkingAgents = new Set<string>();

	// ── Base URL for API calls ───────────────────────────
	readonly baseUrl: string;

	constructor(baseUrl = "") {
		super();
		this.baseUrl = baseUrl;
	}

	// ── Notify ───────────────────────────────────────────

	private notify(): void {
		this.dispatchEvent(new Event("state-changed"));
	}

	// ── Roster ───────────────────────────────────────────

	setAgents(agents: readonly DashboardAgent[]): void {
		this.agents = agents;
		// Initialize LLM status for new agents
		for (const agent of agents) {
			if (!this.llmStatus.has(agent.name)) {
				this.llmStatus.set(agent.name, agent.agentType === "ai" ? "dormant" : "none");
			}
		}
		this.notify();
	}

	// ── Positions (called per frame from engine adapter) ─

	updatePositions(
		positions: Map<string, Point>,
		targets: Map<string, Point | null>,
		states: Map<string, BrainState>,
	): void {
		this.agentPositions = positions;
		this.agentTargets = targets;
		this.agentStates = states;
		this.notify();
	}

	// ── Selection ────────────────────────────────────────

	selectAgent(name: string | null): void {
		this.selectedAgent = name;
		this.selectedTab = "Info";
		this.notify();
	}

	selectTab(tab: TabName): void {
		this.selectedTab = tab;
		this.notify();
	}

	// ── Camera follow ────────────────────────────────────

	startFollow(name: string): void {
		this.followedAgent = name;
		this.notify();
	}

	stopFollow(): void {
		this.followedAgent = null;
		this.notify();
	}

	// ── Connection ───────────────────────────────────────

	setConnectionStatus(status: ConnectionStatus): void {
		this.connectionStatus = status;
		this.notify();
	}

	// ── Activity & permissions ───────────────────────────

	setActivityLog(log: readonly ActivityEntry[]): void {
		this.activityLog = log;
		this.notify();
	}

	setPermissions(agentName: string, entries: readonly PermissionEntry[]): void {
		this.permissions.set(agentName, entries);
		this.notify();
	}

	// ── LLM status ───────────────────────────────────────

	setLlmStatus(name: string, status: LlmStatus): void {
		this.llmStatus.set(name, status);
		this.notify();
	}

	// ── Conversations ────────────────────────────────────

	getConversation(name: string): readonly ConversationTurn[] {
		return this.conversations.get(name) ?? [];
	}

	isThinking(name: string): boolean {
		return this.thinkingAgents.has(name);
	}

	pushUserMessage(name: string, text: string): void {
		const turns = this.conversations.get(name) ?? [];
		turns.push({ role: "user", text });
		this.conversations.set(name, turns);
		this.thinkingAgents.add(name);
		this.notify();
	}

	pushAgentResponse(name: string, text: string): void {
		const turns = this.conversations.get(name) ?? [];
		turns.push({ role: "agent", text });
		this.conversations.set(name, turns);
		this.thinkingAgents.delete(name);
		this.notify();
	}

	// ── Actions (API calls) ──────────────────────────────

	async sendMessage(name: string, text: string): Promise<void> {
		this.pushUserMessage(name, text);
		this.dispatchEvent(new CustomEvent("agent-message-sent", { detail: { agentName: name } }));
		await apiSendMessage(this.baseUrl, name, text);
	}

	async assignTask(name: string, task: string): Promise<void> {
		await apiAssignTask(this.baseUrl, name, task);
		this.dispatchEvent(new CustomEvent("task-assigned", { detail: { agentName: name, task } }));
	}

	async grantPermission(name: string, tool: string, decision: string): Promise<void> {
		await apiGrantPermission(this.baseUrl, name, tool, decision);
	}

	async wakeAgent(name: string): Promise<void> {
		if (this.llmStatus.get(name) === "none") return;
		this.setLlmStatus(name, "waking");
		await apiWakeAgent(this.baseUrl, name);
	}

	// ── Scene change (engine listens) ────────────────────

	changeScene(target: string): void {
		this.dispatchEvent(new CustomEvent("scene-change", { detail: { target } }));
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run tests/store/dashboard-store.test.ts
```

Expected: PASS — all 6 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/store/dashboard-store.ts tests/store/dashboard-store.test.ts
git commit -m "feat(dashboard): add reactive dashboard store"
```

---

### Task 4: Create shared styles

**Files:**
- Create: `src/ui/shared-styles.ts`

- [ ] **Step 1: Create shared-styles**

```typescript
// src/ui/shared-styles.ts
/**
 * shared-styles.ts — Common Lit CSS templates for the dashboard.
 *
 * Every shadow DOM component imports `resetStyles` to normalize rendering.
 * Color and font tokens imported as needed.
 */

import { css } from "lit";

/** CSS reset for shadow DOM — must be included in every component. */
export const resetStyles = css`
	:host { box-sizing: border-box; }
	*, *::before, *::after { box-sizing: inherit; margin: 0; padding: 0; }
`;

/** Dark theme color palette. */
export const colorStyles = css`
	:host {
		--bg-primary: #0f172a;
		--bg-secondary: #1e293b;
		--bg-tertiary: #334155;
		--border: #334155;
		--text-primary: #e2e8f0;
		--text-secondary: #94a3b8;
		--text-muted: #64748b;
		--text-dim: #475569;
		--accent-blue: #38bdf8;
		--accent-green: #22c55e;
		--accent-amber: #f59e0b;
		--accent-red: #ef4444;
		--accent-purple: #8b5cf6;
		--btn-primary: #2563eb;
		--btn-primary-hover: #3b82f6;
		--status-busy: #22c55e;
		--status-idle: #3b82f6;
		--status-unassigned: #6b7280;
	}
`;

/** Common font stack. */
export const fontStyles = css`
	:host {
		font-family: 'Segoe UI', system-ui, sans-serif;
		font-size: 13px;
		color: var(--text-primary);
	}
`;

/** Shared button styles. */
export const buttonStyles = css`
	button {
		font-family: inherit;
		cursor: pointer;
		border: none;
		border-radius: 4px;
		font-size: 12px;
		padding: 6px 14px;
		transition: background 0.15s;
	}
	button.primary {
		background: var(--btn-primary);
		color: var(--text-primary);
	}
	button.primary:hover {
		background: var(--btn-primary-hover);
	}
`;

/** Scrollable content area. */
export const scrollStyles = css`
	.scrollable {
		overflow-y: auto;
		scrollbar-width: thin;
		scrollbar-color: var(--bg-tertiary) transparent;
	}
`;
```

- [ ] **Step 2: Commit**

```bash
git add src/ui/shared-styles.ts
git commit -m "feat(dashboard): add shared Lit CSS styles"
```

---

## Chunk 2: Lit Components — Overlays & Simple

### Task 5: Create dashboard-overlays (direction arrows)

**Files:**
- Create: `src/ui/dashboard-overlays.ts`
- Test: `tests/ui/dashboard-overlays.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// tests/ui/dashboard-overlays.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { DashboardStore } from "../src/store/dashboard-store.js";
import "../src/ui/dashboard-overlays.js";

describe("dashboard-overlays", () => {
	let store: DashboardStore;
	let el: HTMLElement;

	beforeEach(async () => {
		store = new DashboardStore();
		el = document.createElement("dashboard-overlays");
		(el as any).store = store;
		document.body.appendChild(el);
		await (el as any).updateComplete;
	});

	afterEach(() => { el.remove(); });

	it("renders no arrows when no agents are walking", () => {
		const arrows = el.shadowRoot!.querySelectorAll(".arrow");
		expect(arrows.length).toBe(0);
	});

	it("renders an arrow for a walking agent", async () => {
		store.updatePositions(
			new Map([["Bob", { x: 100, y: 200 }]]),
			new Map([["Bob", { x: 300, y: 200 }]]),
			new Map([["Bob", "wandering" as any]]),
		);
		await (el as any).updateComplete;
		const arrows = el.shadowRoot!.querySelectorAll(".arrow");
		expect(arrows.length).toBe(1);
	});

	it("hides arrow when agent becomes idle", async () => {
		store.updatePositions(
			new Map([["Bob", { x: 100, y: 200 }]]),
			new Map([["Bob", null]]),
			new Map([["Bob", "idle" as any]]),
		);
		await (el as any).updateComplete;
		const arrows = el.shadowRoot!.querySelectorAll(".arrow");
		expect(arrows.length).toBe(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run tests/ui/dashboard-overlays.test.ts
```

- [ ] **Step 3: Implement dashboard-overlays**

```typescript
// src/ui/dashboard-overlays.ts
/**
 * <dashboard-overlays> — Renders direction arrows for all walking agents.
 *
 * Positioned absolutely over the canvas. Arrows track agent screen positions
 * and point toward their movement target. Fade in/out with CSS transitions.
 */

import { LitElement, html, css } from "lit";
import { customElement, property } from "lit/decorators.js";
import { resetStyles } from "./shared-styles.js";
import type { DashboardStore, Point } from "../store/dashboard-store.js";

@customElement("dashboard-overlays")
export class DashboardOverlays extends LitElement {
	static styles = [
		resetStyles,
		css`
			:host {
				position: absolute;
				inset: 0;
				pointer-events: none;
				z-index: 10;
				overflow: hidden;
			}
			.arrow {
				position: absolute;
				width: 0;
				height: 0;
				border-left: 4px solid transparent;
				border-right: 4px solid transparent;
				border-bottom: 8px solid rgba(255, 255, 255, 0.6);
				transform-origin: center center;
				transition: opacity 0.3s;
			}
		`,
	];

	@property({ attribute: false }) store!: DashboardStore;

	private unsubscribe: (() => void) | null = null;

	connectedCallback(): void {
		super.connectedCallback();
		const handler = () => this.requestUpdate();
		this.store?.addEventListener("state-changed", handler);
		this.unsubscribe = () => this.store?.removeEventListener("state-changed", handler);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.unsubscribe?.();
	}

	render() {
		const arrows: { name: string; x: number; y: number; angle: number }[] = [];

		for (const [name, target] of this.store.agentTargets) {
			if (!target) continue;
			const pos = this.store.agentPositions.get(name);
			if (!pos) continue;

			const dx = target.x - pos.x;
			const dy = target.y - pos.y;
			if (Math.abs(dx) < 2 && Math.abs(dy) < 2) continue;

			const angle = Math.atan2(dy, dx) * (180 / Math.PI) + 90;
			arrows.push({ name, x: pos.x, y: pos.y + 20, angle });
		}

		return html`${arrows.map(
			(a) => html`
				<div
					class="arrow"
					style="left:${a.x}px;top:${a.y}px;transform:translate(-50%,-50%) rotate(${a.angle}deg)"
				></div>
			`,
		)}`;
	}
}
```

- [ ] **Step 4: Run tests**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run tests/ui/dashboard-overlays.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/ui/dashboard-overlays.ts tests/ui/dashboard-overlays.test.ts
git commit -m "feat(dashboard): add direction arrow overlays component"
```

---

### Task 6: Create roster-bar

**Files:**
- Create: `src/ui/roster-bar.ts`
- Test: `tests/ui/roster-bar.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// tests/ui/roster-bar.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardStore } from "../src/store/dashboard-store.js";
import "../src/ui/roster-bar.js";

describe("roster-bar", () => {
	let store: DashboardStore;
	let el: HTMLElement;

	beforeEach(async () => {
		store = new DashboardStore();
		el = document.createElement("roster-bar");
		(el as any).store = store;
		document.body.appendChild(el);
		await (el as any).updateComplete;
	});

	it("renders cards for domain-assigned agents only", async () => {
		store.setAgents([
			{ name: "Dev", agentType: "ai", status: "idle", domain: "engineering" } as any,
			{ name: "Hub", agentType: "ai", status: "idle" } as any,
		]);
		await (el as any).updateComplete;
		const cards = el.shadowRoot!.querySelectorAll(".card");
		// "Dev" has domain=engineering → office scene, "Hub" has no domain → hub scene (not shown)
		expect(cards.length).toBe(1);
	});

	it("dispatches scene-change on card click", async () => {
		store.setAgents([
			{ name: "Dev", agentType: "ai", status: "idle", domain: "engineering" } as any,
		]);
		const spy = vi.fn();
		store.addEventListener("scene-change", spy);
		await (el as any).updateComplete;
		const card = el.shadowRoot!.querySelector(".card") as HTMLElement;
		card.click();
		expect(spy).toHaveBeenCalledTimes(1);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement roster-bar**

The component subscribes to `store.agents`, filters to non-hub agents, renders cards with status dots. Click calls `store.changeScene(setting)`. Uses shadow DOM styles matching the existing dark theme.

Port the rendering logic from the current `createRosterBar()` in `src/ui/roster-bar.ts` (lines 57-98) into a Lit `render()` method. Use `resolveSettingForDomain` and `SCENE_THEMES` for domain→scene mapping.

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git add src/ui/roster-bar.ts tests/ui/roster-bar.test.ts
git commit -m "feat(dashboard): add Lit roster-bar component"
```

---

### Task 7: Create camera-hud

**Files:**
- Create: `src/ui/camera-hud.ts`
- Test: `tests/ui/camera-hud.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// tests/ui/camera-hud.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardStore } from "../src/store/dashboard-store.js";
import "../src/ui/camera-hud.js";

describe("camera-hud", () => {
	let store: DashboardStore;
	let el: HTMLElement;

	beforeEach(async () => {
		store = new DashboardStore();
		el = document.createElement("camera-hud");
		(el as any).store = store;
		document.body.appendChild(el);
		await (el as any).updateComplete;
	});

	it("is hidden when not following", () => {
		const badge = el.shadowRoot!.querySelector(".hud");
		expect(badge).toBeNull();
	});

	it("shows agent name when following", async () => {
		store.startFollow("Bob");
		await (el as any).updateComplete;
		const badge = el.shadowRoot!.querySelector(".hud");
		expect(badge).not.toBeNull();
		expect(badge!.textContent).toContain("Bob");
	});

	it("calls stopFollow on close click", async () => {
		store.startFollow("Bob");
		await (el as any).updateComplete;
		const btn = el.shadowRoot!.querySelector("button") as HTMLElement;
		btn.click();
		expect(store.followedAgent).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement camera-hud**

Small Lit component: if `store.followedAgent` is set, render a positioned badge with the agent name and a close button. Close button calls `store.stopFollow()`. Style matches the current HUD in camera-system.ts.

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git add src/ui/camera-hud.ts tests/ui/camera-hud.test.ts
git commit -m "feat(dashboard): add Lit camera-hud component"
```

---

## Chunk 3: Agent Panel + Tabs

### Task 8: Create panel-info

**Files:**
- Create: `src/ui/panel-info.ts`

- [ ] **Step 1: Implement panel-info**

Port `renderInfoContent()` from existing `agent-panel.ts` (lines 208-255). Renders:
- Attribute grid (STR/INT/WIS/CHA/DEX/CON) in 3-column layout
- Mood, experience, status meta row
- Skills list (name: level)
- Relationships list (target (type))
- Empty state message when no data

Receives agent data as a `@property()`. No store subscription needed — parent passes data down.

- [ ] **Step 2: Commit**

```bash
git add src/ui/panel-info.ts
git commit -m "feat(dashboard): add Lit panel-info tab"
```

---

### Task 9: Create panel-talk

**Files:**
- Create: `src/ui/panel-talk.ts`
- Test: `tests/ui/panel-talk.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// tests/ui/panel-talk.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { DashboardStore } from "../src/store/dashboard-store.js";
import "../src/ui/panel-talk.js";

describe("panel-talk", () => {
	let store: DashboardStore;
	let el: HTMLElement;

	beforeEach(async () => {
		store = new DashboardStore();
		el = document.createElement("panel-talk");
		(el as any).store = store;
		(el as any).agentName = "Bob";
		document.body.appendChild(el);
		await (el as any).updateComplete;
	});

	it("renders empty thread initially", () => {
		const turns = el.shadowRoot!.querySelectorAll(".turn");
		expect(turns.length).toBe(0);
	});

	it("renders conversation turns from store", async () => {
		store.pushUserMessage("Bob", "Hello");
		store.pushAgentResponse("Bob", "Hi!");
		await (el as any).updateComplete;
		const turns = el.shadowRoot!.querySelectorAll(".turn");
		expect(turns.length).toBe(2);
	});

	it("shows thinking indicator when agent is thinking", async () => {
		store.pushUserMessage("Bob", "Hello");
		await (el as any).updateComplete;
		const thinking = el.shadowRoot!.querySelector(".thinking");
		expect(thinking).not.toBeNull();
	});

	it("shows LLM status badge", async () => {
		store.setLlmStatus("Bob", "active");
		await (el as any).updateComplete;
		const badge = el.shadowRoot!.querySelector(".llm-badge");
		expect(badge).not.toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement panel-talk**

Port chat logic from existing `talk-tab.ts`. Key differences:
- Conversation thread reads from `store.getConversation(agentName)` — reactive, no DOM manipulation
- Send button calls `store.sendMessage(agentName, text)`
- Thinking state reads `store.isThinking(agentName)` — cycling filler phrases via `setInterval`
- LLM badge reads `store.llmStatus.get(agentName)`: green dot (active), amber (waking), gray (dormant), hidden (none)
- Auto-scroll via `this.updateComplete.then(() => thread.scrollTop = thread.scrollHeight)`

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git add src/ui/panel-talk.ts tests/ui/panel-talk.test.ts
git commit -m "feat(dashboard): add Lit panel-talk tab"
```

---

### Task 10: Create panel-tasks, panel-permissions, panel-history

**Files:**
- Create: `src/ui/panel-tasks.ts`
- Create: `src/ui/panel-permissions.ts`
- Create: `src/ui/panel-history.ts`

- [ ] **Step 1: Implement panel-tasks**

Port from `tasks-tab.ts`. Renders task list with status badges, suggested tasks with assign buttons, confirmation dialog for AI agents. Calls `store.assignTask()`. Dispatches `task-assigned` event detail for brain integration.

- [ ] **Step 2: Implement panel-permissions**

Port from `permissions-tab.ts`. Renders pending permissions with allow/deny buttons, grant history. Calls `store.grantPermission()`.

- [ ] **Step 3: Implement panel-history**

Port from `history-tab.ts`. Reads `store.activityLog`, filters by agent name, renders timestamped entries.

- [ ] **Step 4: Commit**

```bash
git add src/ui/panel-tasks.ts src/ui/panel-permissions.ts src/ui/panel-history.ts
git commit -m "feat(dashboard): add Lit tasks, permissions, history tabs"
```

---

### Task 11: Create agent-panel shell

**Files:**
- Create: `src/ui/agent-panel.ts`
- Test: `tests/ui/agent-panel.test.ts`

- [ ] **Step 1: Write the test**

```typescript
// tests/ui/agent-panel.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { DashboardStore } from "../src/store/dashboard-store.js";
import "../src/ui/agent-panel.js";

describe("agent-panel", () => {
	let store: DashboardStore;
	let el: HTMLElement;

	beforeEach(async () => {
		store = new DashboardStore();
		store.setAgents([
			{ name: "Bob", agentType: "ai", status: "idle", attributes: { str: 10 } } as any,
		]);
		el = document.createElement("agent-panel");
		(el as any).store = store;
		document.body.appendChild(el);
		await (el as any).updateComplete;
	});

	it("is hidden when no agent selected", () => {
		const panel = el.shadowRoot!.querySelector(".panel");
		expect(panel).toBeNull();
	});

	it("renders panel when agent selected", async () => {
		store.selectAgent("Bob");
		await (el as any).updateComplete;
		const panel = el.shadowRoot!.querySelector(".panel");
		expect(panel).not.toBeNull();
		const header = el.shadowRoot!.querySelector(".header-name");
		expect(header!.textContent).toContain("Bob");
	});

	it("renders 5 tab buttons", async () => {
		store.selectAgent("Bob");
		await (el as any).updateComplete;
		const tabs = el.shadowRoot!.querySelectorAll(".tab-btn");
		expect(tabs.length).toBe(5);
	});

	it("switches tab when store.selectedTab changes", async () => {
		store.selectAgent("Bob");
		store.selectTab("Talk");
		await (el as any).updateComplete;
		const activeTab = el.shadowRoot!.querySelector(".tab-btn[data-active='true']");
		expect(activeTab!.textContent).toContain("Talk");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

- [ ] **Step 3: Implement agent-panel**

Panel shell that:
- Subscribes to `store.selectedAgent` — renders nothing if null
- Shows header (name, agentType, close button)
- Shows attribute grid + meta (from `<panel-info>`)
- 5 tab buttons driven by `store.selectedTab`
- Content area renders the active tab sub-component
- Close button calls `store.selectAgent(null)`
- Positioned via CSS (right side of viewport, or passed coordinates)

```typescript
@customElement("agent-panel")
export class AgentPanel extends LitElement {
	@property({ attribute: false }) store!: DashboardStore;

	render() {
		if (!this.store.selectedAgent) return html``;
		const agent = this.store.agents.find(a => a.name === this.store.selectedAgent);
		if (!agent) return html``;

		return html`
			<div class="panel">
				<div class="header">...</div>
				<div class="tabs">...</div>
				<div class="content">${this.renderTab(agent)}</div>
			</div>
		`;
	}

	private renderTab(agent: DashboardAgent) {
		switch (this.store.selectedTab) {
			case "Info": return html`<panel-info .agent=${agent}></panel-info>`;
			case "Talk": return html`<panel-talk .store=${this.store} .agentName=${agent.name}></panel-talk>`;
			case "Tasks": return html`<panel-tasks .store=${this.store} .agent=${agent}></panel-tasks>`;
			case "Permissions": return html`<panel-permissions .store=${this.store} .agentName=${agent.name}></panel-permissions>`;
			case "History": return html`<panel-history .store=${this.store} .agentName=${agent.name}></panel-history>`;
		}
	}
}
```

- [ ] **Step 4: Run tests**

- [ ] **Step 5: Commit**

```bash
git add src/ui/agent-panel.ts tests/ui/agent-panel.test.ts
git commit -m "feat(dashboard): add Lit agent-panel shell with tab switching"
```

---

## Chunk 4: Integration

### Task 12: Expose brain entries for frame adapter

**Files:**
- Modify: `src/systems/brain-system.ts`

- [ ] **Step 1: Add getAllEntries accessor**

```typescript
/** Read-only access to all brain entries for the frame adapter. */
getAllEntries(): ReadonlyMap<string, Readonly<AgentBrainEntry>> {
	return this.entries;
}
```

Export `AgentBrainEntry` type (or create a read-only projected interface).

- [ ] **Step 2: Commit**

```bash
git add src/systems/brain-system.ts
git commit -m "feat(dashboard): expose brain entries for store adapter"
```

---

### Task 13: Simplify camera-system (remove DOM HUD)

**Files:**
- Modify: `src/systems/camera-system.ts`

- [ ] **Step 1: Strip HUD DOM code**

Remove `showHud()`, `hideHud()`, `hudEl`, `hudContainer` parameter. Keep only:
- `startFollow(actor)` / `stopFollow()` — manage ExcaliburJS camera strategies
- `handleZoom()` / `applyZoom()` — zoom control
- `handleKeyDown()` / `handleKeyUp()` / `updatePan()` — keyboard pan
- `onSceneActivate()` — restore follow on scene change
- `checkDespawn()` — stop follow if actor killed
- `resetToCenter()` — smooth camera reset

`stopFollow()` no longer calls `hideHud()` — the `<camera-hud>` Lit component reacts to `store.followedAgent` instead.

- [ ] **Step 2: Commit**

```bash
git add src/systems/camera-system.ts
git commit -m "refactor(dashboard): remove DOM HUD from camera-system"
```

---

### Task 14: Rewire main.ts

**Files:**
- Modify: `src/main.ts`

This is the largest task. Replace all vanilla DOM wiring with store + Lit component mounting.

- [ ] **Step 1: Add imports**

Replace old UI imports:
```typescript
// Remove these:
import { createPanelManager } from "./ui/panel-manager.js";
import { renderAgentPanel, switchToTab } from "./ui/agent-panel.js";
import { appendAgentResponse, extractAgentMessage, showThinkingIndicator, removeThinkingIndicator } from "./ui/talk-tab.js";
import { createRosterBar } from "./ui/roster-bar.js";

// Add these:
import { DashboardStore } from "./store/dashboard-store.js";
import { extractAgentMessage } from "./data/message-utils.js";
import "./ui/dashboard-overlays.js";
import "./ui/roster-bar.js";
import "./ui/camera-hud.js";
import "./ui/agent-panel.js";
```

- [ ] **Step 2: Create store and mount Lit components**

After engine creation, before scene setup:
```typescript
const store = new DashboardStore(BASE_URL);

// Mount Lit components as DOM overlays on the canvas parent
const overlays = document.createElement("dashboard-overlays");
(overlays as any).store = store;
canvasParent.appendChild(overlays);

const rosterBar = document.createElement("roster-bar");
(rosterBar as any).store = store;
canvasParent.appendChild(rosterBar);

const cameraHud = document.createElement("camera-hud");
(cameraHud as any).store = store;
canvasParent.appendChild(cameraHud);

const agentPanel = document.createElement("agent-panel");
(agentPanel as any).store = store;
canvasParent.appendChild(agentPanel);
```

- [ ] **Step 3: Replace panelManager with store-driven selection**

Replace `handleAgentSelect()`:
```typescript
function handleAgentSelect(agentName: string): void {
	const actor = findAgentActor(agentName);
	if (store.selectedAgent === agentName) {
		store.selectAgent(null);
		if (actor && cameraSystem) cameraSystem.startFollow(actor);
	} else {
		if (cameraSystem?.isFollowing()) cameraSystem.stopFollow();
		if (actor) {
			actor.focus();
			void engine.currentScene.camera.move(actor.pos, 300, ex.EasingFunctions.EaseInOutCubic);
		}
		store.selectAgent(agentName);
		void store.wakeAgent(agentName);
	}
}
```

- [ ] **Step 4: Replace SyncSystem callbacks with store writes**

```typescript
const syncSystem = new SyncSystem(BASE_URL, {
	onAgentAction: (action) => {
		brainSystem.applyEvent(action.agentName, action.type);
		if (action.type === "speaking" || action.type === "asking") {
			talkEngine.silence(action.agentName);
			const rawText = typeof action.data["text"] === "string" ? action.data["text"] : "...";
			const text = extractAgentMessage(rawText);
			bubbleSystem.showBubble(action.agentName, action.type === "asking" ? "question" : "speech", text, engine.currentScene, findAgentActor);
			store.pushAgentResponse(action.agentName, text);
			store.setLlmStatus(action.agentName, "active");
		} else if (action.type === "thinking") {
			const rawText = typeof action.data["text"] === "string" ? action.data["text"] : "...";
			const text = extractAgentMessage(rawText);
			bubbleSystem.showBubble(action.agentName, "thought", text, engine.currentScene, findAgentActor);
		} else if (action.type === "requesting-permission") {
			bubbleSystem.showBubble(action.agentName, "question", "?", engine.currentScene, findAgentActor);
			if (store.selectedAgent === action.agentName || /* agent visible in current scene */) {
				store.selectAgent(action.agentName);
				store.selectTab("Permissions");
			}
		}
	},
	onAgentsUpdated: (agents) => {
		hubScene.updateAgents(agents);
		store.setAgents(agents);
		for (const agent of agents) {
			brainSystem.register(agent.name, agent.attributes ?? {}, agent.mood, agent.domain);
			bubbleSystem.register(agent.name, agent.personality ?? [], brainSystem.getState(agent.name)!.params);
			talkEngine.register(agent.name, agent.domain ?? "general", agent.personality ?? [], agent.attributes?.cha ?? 10);
		}
	},
	onActivityLog: (log) => { activityLog = log; store.setActivityLog(log); },
	onConnectionStatus: (status) => {
		hubScene.updateConnectionStatus(status);
		store.setConnectionStatus(status);
	},
	onStateDiff: () => {},
});
```

- [ ] **Step 5: Add frame adapter for positions**

In the `preframe` handler, push agent positions to store:
```typescript
engine.on("postframe", () => {
	const positions = new Map<string, { x: number; y: number }>();
	const targets = new Map<string, { x: number; y: number } | null>();
	const states = new Map<string, BrainState>();

	for (const [name, entry] of brainSystem.getAllEntries()) {
		const actor = findAgentActor(name);
		if (!actor) continue;
		const screenPos = engine.worldToScreenCoordinates(actor.pos);
		positions.set(name, { x: screenPos.x, y: screenPos.y });
		targets.set(name, entry.targetPos
			? { x: engine.worldToScreenCoordinates(ex.vec(entry.targetPos.x, entry.targetPos.y)).x,
			    y: engine.worldToScreenCoordinates(ex.vec(entry.targetPos.x, entry.targetPos.y)).y }
			: null);
		states.set(name, entry.state);
	}

	store.updatePositions(positions, targets, states);
});
```

Note: `brainSystem.getAllEntries()` must be exposed — add a public accessor to BrainSystem that returns the entries map (read-only). This is a small modification to `brain-system.ts`.

- [ ] **Step 6: Listen to store events for engine-side effects**

```typescript
store.addEventListener("scene-change", ((e: CustomEvent) => {
	sceneConfig.onSceneChange(e.detail.target);
}) as EventListener);

store.addEventListener("agent-message-sent", ((e: CustomEvent) => {
	const { agentName } = e.detail;
	const filler = FILLER_PHRASES[Math.floor(Math.random() * FILLER_PHRASES.length)];
	bubbleSystem.showBubble(agentName, "thought", filler, engine.currentScene, findAgentActor, 4000);
	talkEngine.silence(agentName);
}) as EventListener);

store.addEventListener("task-assigned", ((e: CustomEvent) => {
	const { agentName, task } = e.detail;
	brainSystem.applyEvent(agentName, "task-started");
	bubbleSystem.showBubble(agentName, "thought", `Starting: ${task}`, engine.currentScene, findAgentActor);
}) as EventListener);
```

- [ ] **Step 7: Replace camera HUD with store-driven follow**

Remove manual HUD creation from `camera-system.ts` — the `<camera-hud>` Lit component handles display. Camera system still manages the actual ExcaliburJS camera strategies, but the HUD DOM is gone. Modify `createCameraSystem()` to drop the `hudContainer` parameter and `showHud`/`hideHud` functions. Keep only the camera control logic. Wire store follow events:

```typescript
// Watch store for follow changes
let prevFollowed: string | null = null;
store.addEventListener("state-changed", () => {
	if (store.followedAgent !== prevFollowed) {
		prevFollowed = store.followedAgent;
		if (store.followedAgent) {
			const actor = findAgentActor(store.followedAgent);
			if (actor) cameraSystem!.startFollow(actor);
		} else {
			cameraSystem!.stopFollow();
		}
	}
});
```

- [ ] **Step 8: Remove old DOM code from main.ts**

Delete:
- `panelManager` creation and all references
- `openPanelForAgent()` function
- `renderContent` callback
- `rosterBar` (old vanilla version) creation
- `awakeDormantTimers` map (dormant logic moves to store)
- All `canvasParent.querySelector(".agent-panel")` patterns
Replace `isTyping()` with Shadow DOM-aware version:
```typescript
function isTyping(): boolean {
	const el = document.activeElement;
	if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return true;
	const inner = el?.shadowRoot?.activeElement;
	return inner instanceof HTMLInputElement || inner instanceof HTMLTextAreaElement;
}
```

- [ ] **Step 9: Build and verify**

```bash
cd "01 - Projects/Flowti CLI/agents" && npm run build 2>&1 | tail -5
```

Expected: builds without errors.

- [ ] **Step 10: Commit**

```bash
git add src/main.ts
git commit -m "feat(dashboard): rewire main.ts to use store + Lit components"
```

### Task 15: Delete old UI files and tests

**Files:**
- Delete: `src/ui/panel-manager.ts`
- Delete: `src/ui/panel-styles.ts`
- Delete: `src/ui/agent-panel.ts` (old vanilla version — replaced by Lit version)
- Delete: `src/ui/talk-tab.ts`
- Delete: `src/ui/tasks-tab.ts`
- Delete: `src/ui/permissions-tab.ts`
- Delete: `src/ui/history-tab.ts`
- Delete: `src/ui/roster-bar.ts` (old vanilla version — replaced by Lit version)

Note: The new Lit files live at the same paths as some old files (`agent-panel.ts`, `roster-bar.ts`). These were already replaced in earlier tasks. The remaining files to delete are: `panel-manager.ts`, `panel-styles.ts`, `talk-tab.ts`, `tasks-tab.ts`, `permissions-tab.ts`, `history-tab.ts`.

- [ ] **Step 1: Delete old files**

```bash
cd "01 - Projects/Flowti CLI/agents"
rm -f src/ui/panel-manager.ts src/ui/panel-styles.ts src/ui/talk-tab.ts src/ui/tasks-tab.ts src/ui/permissions-tab.ts src/ui/history-tab.ts
```

- [ ] **Step 2: Delete old tests that reference deleted modules**

```bash
# Check which existing tests import deleted modules, remove those test files
grep -rl "panel-manager\|panel-styles\|talk-tab\|tasks-tab\|permissions-tab\|history-tab" tests/ && rm -f those files
```

- [ ] **Step 3: Verify build**

```bash
cd "01 - Projects/Flowti CLI/agents" && npm run build 2>&1 | tail -5
```

- [ ] **Step 4: Verify tests**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run 2>&1 | tail -10
```

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "chore(dashboard): delete legacy vanilla DOM UI files"
```

---

### Task 16: Final build + smoke test

- [ ] **Step 1: Full build (dashboard + CLI)**

```bash
cd "01 - Projects/Flowti CLI/agents" && npm run build
cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs
```

- [ ] **Step 2: Run all tests**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run
```

- [ ] **Step 3: Manual smoke test**

Start `flowti serve`, open browser, verify:
- [ ] Direction arrows appear when agents walk, fade when idle
- [ ] Bottom roster bar shows domain-assigned agent cards
- [ ] Click agent → panel opens with correct tabs
- [ ] Talk tab shows conversation, thinking indicator cycles
- [ ] Click agent again → panel closes, camera follows
- [ ] WASD/arrow keys pan camera
- [ ] ESC/Home resets camera
- [ ] Camera HUD shows when following
- [ ] Scene doorways navigate with hover effect

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "feat(dashboard): complete Lit UI migration with direction arrows"
```
