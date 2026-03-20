# Agent Monitor Tab — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the "history" tab with a real-time "monitor" tab showing brain state, process health, LLM status, event stream, and nearby agents.

**Architecture:** New `panel-monitor.ts` Lit component replaces `panel-history.ts`. DashboardStore gains `agentEventLog`, `taskLockedAgents`, `isProcessAlive()`, and `pushEventLog()`. Engine wires `taskLockedAgents` updates into existing task lifecycle listeners.

**Tech Stack:** TypeScript, Lit, Vitest

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-20-agent-monitor-tab-design.md`

---

## File Structure

| File | Responsibility |
|------|---------------|
| `Plugin: src/game/store/dashboard-store.ts` | Add `agentEventLog`, `taskLockedAgents`, `isProcessAlive()`, `pushEventLog()`, update `TabName` |
| `Plugin: src/game/ui/panel-monitor.ts` | New Lit component: status grid + event stream + nearby agents |
| `Plugin: src/game/ui/agent-panel.ts` | Swap history → monitor in tabs, imports, CSS |
| `Plugin: src/game/engine.ts` | Wire `taskLockedAgents` in task lifecycle listeners |
| `Plugin: src/game/ui/panel-history.ts` | Delete |

---

## Task 1: DashboardStore — event log, process status, task locked

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts:16,66,261-309,357`
- Test: `01 - Projects/Flowti Plugin/tests/game/store/dashboard-store.test.ts`

- [ ] **Step 1: Write failing tests**

Add to `dashboard-store.test.ts`:

```typescript
describe("agentEventLog", () => {
	it("starts empty", () => {
		const store = new DashboardStore();
		expect(store.agentEventLog.size).toBe(0);
	});

	it("pushEventLog adds entries", () => {
		const store = new DashboardStore();
		(store as unknown as { pushEventLog(a: string, t: string, s: string): void }).pushEventLog("atlas", "response", "Hello");
		const log = store.agentEventLog.get("atlas");
		expect(log).toHaveLength(1);
		expect(log![0]).toEqual(expect.objectContaining({ type: "response", summary: "Hello" }));
	});

	it("caps at 50 entries", () => {
		const store = new DashboardStore();
		for (let i = 0; i < 60; i++) {
			(store as unknown as { pushEventLog(a: string, t: string, s: string): void }).pushEventLog("atlas", "response", `msg${i}`);
		}
		expect(store.agentEventLog.get("atlas")).toHaveLength(50);
	});
});

describe("taskLockedAgents", () => {
	it("starts empty", () => {
		const store = new DashboardStore();
		expect(store.taskLockedAgents.size).toBe(0);
	});
});

describe("isProcessAlive", () => {
	it("returns false when no process exists", () => {
		const store = new DashboardStore();
		expect(store.isProcessAlive("atlas")).toBe(false);
	});
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/store/dashboard-store.test.ts`

Expected: FAIL — `agentEventLog`, `taskLockedAgents`, `isProcessAlive`, `pushEventLog` don't exist.

- [ ] **Step 3: Update TabName**

In `dashboard-store.ts` line 16, change:

```typescript
export type TabName = "info" | "talk" | "tasks" | "permissions" | "monitor";
```

- [ ] **Step 4: Add new fields and methods**

After `assignedTasks` (line 46), add:

```typescript
agentEventLog: Map<string, { timestamp: number; type: string; summary: string }[]> = new Map();
taskLockedAgents: Set<string> = new Set();
```

After `selectTab` method, add:

```typescript
isProcessAlive(agentName: string): boolean {
	return this.agentProcesses.get(agentName)?.running ?? false;
}
```

Add private helper (before `handleCliEvent`):

```typescript
private pushEventLog(agentName: string, type: string, summary: string): void {
	const log = this.agentEventLog.get(agentName) ?? [];
	log.push({ timestamp: Date.now(), type, summary: summary.slice(0, 80) });
	if (log.length > 50) log.shift();
	this.agentEventLog.set(agentName, log);
}
```

- [ ] **Step 5: Populate event log in handleCliEvent**

In each case of `handleCliEvent` (lines 261-309), add `pushEventLog` calls:

In `case "response"` (after `pushAgentResponse`):
```typescript
this.pushEventLog(agentName, "response", text.slice(0, 80));
```

In `case "thinking"`:
```typescript
this.pushEventLog(agentName, "thinking", "Thinking...");
```

In `case "permission-request"`:
```typescript
this.pushEventLog(agentName, "permission-request", `${event.tool ?? "unknown"} — permission requested`);
```

In `case "error"`:
```typescript
this.pushEventLog(agentName, "error", event.text ?? "Unknown error");
```

Replace the no-op `using-tool` / `tool-complete` cases (lines 302-308):
```typescript
case "using-tool":
	this.pushEventLog(agentName, "using-tool", event.tool ?? "tool");
	break;
case "tool-complete":
	this.pushEventLog(agentName, "tool-complete", `${event.tool ?? "tool"} done`);
	break;
case "task-started":
case "task-completed":
	break;
```

In `executeTask` (after dispatching `task-assigned` event):
```typescript
this.pushEventLog(agentName, "task-started", task.name);
```

In the task completion block inside `handleCliEvent`'s response case (after `markTaskStatus`):
```typescript
this.pushEventLog(agentName, "task-completed", `${activeTask.name} completed`);
```

- [ ] **Step 6: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/store/dashboard-store.test.ts`

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
cd "C:\Projects\flowti" && git add "01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts" "01 - Projects/Flowti Plugin/tests/game/store/dashboard-store.test.ts"
git commit -m "feat(store): agentEventLog, taskLockedAgents, isProcessAlive for monitor tab"
```

---

## Task 2: Engine — wire taskLockedAgents

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine.ts:645-662`

- [ ] **Step 1: Add taskLockedAgents tracking**

In the `task-assigned` listener (line 645), add after `brainSystem.assignWork(agentName)`:
```typescript
store.taskLockedAgents.add(agentName);
```

In the `task-completed` listener (line 656), add after `brainSystem.releaseWork(agentName)`:
```typescript
store.taskLockedAgents.delete(agentName);
```

- [ ] **Step 2: Run engine tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/engine.test.ts`

Expected: All pass.

- [ ] **Step 3: Commit**

```bash
cd "C:\Projects\flowti" && git add "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "feat(engine): wire taskLockedAgents on task lifecycle events"
```

---

## Task 3: panel-monitor.ts — new Lit component

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/ui/panel-monitor.ts`
- Create: `01 - Projects/Flowti Plugin/tests/game/ui/panel-monitor.test.ts`

- [ ] **Step 1: Create panel-monitor.ts**

```typescript
/**
 * Monitor tab — real-time agent internals: brain state, process health,
 * LLM status, event stream, and nearby agents.
 */

import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles, scrollStyles } from "./game-styles.js";
import type { DashboardStore } from "../store/dashboard-store.js";

const STATE_COLORS: Record<string, string> = {
	idle: "#3b82f6",
	wandering: "#6b7280",
	working: "#22c55e",
	"walking-to": "#f59e0b",
	"on-break": "#a855f7",
	talking: "#06b6d4",
	waiting: "#f59e0b",
};

const EVENT_COLORS: Record<string, string> = {
	response: "#22c55e",
	thinking: "#f59e0b",
	"using-tool": "#a855f7",
	"tool-complete": "#a855f7",
	error: "#ef4444",
	"task-started": "#3b82f6",
	"task-completed": "#3b82f6",
	"permission-request": "#f59e0b",
};

function relativeTime(ms: number): string {
	const sec = Math.floor(ms / 1000);
	if (sec < 60) return `${sec}s`;
	const min = Math.floor(sec / 60);
	if (min < 60) return `${min}m`;
	return `${Math.floor(min / 60)}h`;
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

export class PanelMonitor extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		store: { attribute: false },
		agentName: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		resetStyles,
		colorStyles,
		fontStyles,
		scrollStyles,
		css`
			:host { display: block; }

			.status-grid {
				display: grid;
				grid-template-columns: auto 1fr;
				gap: 2px 10px;
				font-size: 11px;
				padding-bottom: 8px;
				border-bottom: 1px solid var(--border);
				margin-bottom: 8px;
			}

			.status-label {
				color: var(--text-secondary);
				text-transform: uppercase;
				font-size: 10px;
				font-weight: 600;
			}

			.status-value {
				color: var(--text-primary);
				display: flex;
				align-items: center;
				gap: 4px;
			}

			.state-badge {
				display: inline-block;
				padding: 1px 6px;
				border-radius: 3px;
				font-size: 10px;
				font-weight: 600;
				color: #fff;
			}

			.dot {
				width: 6px;
				height: 6px;
				border-radius: 50%;
				flex-shrink: 0;
			}

			.dot--alive { background: #22c55e; }
			.dot--dead { background: #ef4444; }

			.lock-icon { font-size: 10px; opacity: 0.7; }

			.section-title {
				font-size: 10px;
				color: var(--text-secondary);
				text-transform: uppercase;
				font-weight: 600;
				margin-bottom: 4px;
			}

			.event-stream {
				display: flex;
				flex-direction: column;
				gap: 2px;
				margin-bottom: 8px;
				max-height: 200px;
				overflow-y: auto;
				scrollbar-width: thin;
				scrollbar-color: var(--bg-tertiary) transparent;
			}

			.event-entry {
				display: flex;
				align-items: baseline;
				gap: 6px;
				font-size: 11px;
				padding: 2px 0;
			}

			.event-time {
				color: var(--text-muted);
				font-size: 10px;
				min-width: 24px;
				text-align: right;
			}

			.event-type {
				font-size: 9px;
				font-weight: 600;
				padding: 1px 4px;
				border-radius: 2px;
				color: #fff;
				white-space: nowrap;
			}

			.event-summary {
				color: var(--text-primary);
				overflow: hidden;
				text-overflow: ellipsis;
				white-space: nowrap;
				flex: 1;
			}

			.nearby-list {
				display: flex;
				flex-direction: column;
				gap: 2px;
			}

			.nearby-entry {
				display: flex;
				justify-content: space-between;
				font-size: 11px;
				color: var(--text-primary);
			}

			.nearby-dist {
				color: var(--text-muted);
				font-size: 10px;
			}

			.empty-msg {
				color: var(--text-muted);
				font-style: italic;
				font-size: 11px;
			}
		`,
	];

	store!: DashboardStore;
	agentName = "";

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

	protected renderContent() {
		if (!this.store || !this.agentName) return html``;

		return html`
			${this.renderStatusGrid()}
			<div class="section-title">Events</div>
			${this.renderEventStream()}
			<div class="section-title">Nearby</div>
			${this.renderNearby()}
		`;
	}

	private renderStatusGrid() {
		const brainState = this.store.agentStates.get(this.agentName) ?? "idle";
		const stateColor = STATE_COLORS[brainState] ?? STATE_COLORS["idle"];
		const processAlive = this.store.isProcessAlive(this.agentName);
		const llmStatus = this.store.llmStatus.get(this.agentName);
		const llmState = llmStatus?.state ?? "idle";
		const scene = capitalize(this.store.currentScene);
		const taskLocked = this.store.taskLockedAgents.has(this.agentName);
		const pos = this.store.agentPositions.get(this.agentName);

		return html`
			<div class="status-grid">
				<span class="status-label">Brain</span>
				<span class="status-value">
					<span class="state-badge" style="background:${stateColor}">${brainState}</span>
					${taskLocked ? html`<span class="lock-icon">&#x1F512;</span>` : nothing}
				</span>

				<span class="status-label">Process</span>
				<span class="status-value">
					<span class="dot ${processAlive ? "dot--alive" : "dot--dead"}"></span>
					${processAlive ? "alive" : "dead"}
				</span>

				<span class="status-label">LLM</span>
				<span class="status-value">${llmState}</span>

				<span class="status-label">Scene</span>
				<span class="status-value">${scene}</span>

				${pos ? html`
					<span class="status-label">Position</span>
					<span class="status-value">${Math.round(pos.x)}, ${Math.round(pos.y)}</span>
				` : nothing}
			</div>
		`;
	}

	private renderEventStream() {
		const log = this.store.agentEventLog.get(this.agentName) ?? [];
		if (log.length === 0) {
			return html`<div class="empty-msg">No events yet.</div>`;
		}

		const now = Date.now();
		const recent = [...log].reverse().slice(0, 20);

		return html`
			<div class="event-stream">
				${recent.map((entry) => {
					const color = EVENT_COLORS[entry.type] ?? "#6b7280";
					return html`
						<div class="event-entry">
							<span class="event-time">${relativeTime(now - entry.timestamp)}</span>
							<span class="event-type" style="background:${color}">${entry.type}</span>
							<span class="event-summary">${entry.summary}</span>
						</div>
					`;
				})}
			</div>
		`;
	}

	private renderNearby() {
		const myPos = this.store.agentPositions.get(this.agentName);
		if (!myPos) return html`<div class="empty-msg">Position unknown.</div>`;

		const nearby: { name: string; distance: number; state: string }[] = [];
		for (const [name, pos] of this.store.agentPositions) {
			if (name === this.agentName) continue;
			const dx = pos.x - myPos.x;
			const dy = pos.y - myPos.y;
			const dist = Math.round(Math.sqrt(dx * dx + dy * dy));
			if (dist <= 300) {
				const state = this.store.agentStates.get(name) ?? "idle";
				nearby.push({ name, distance: dist, state });
			}
		}
		nearby.sort((a, b) => a.distance - b.distance);

		if (nearby.length === 0) {
			return html`<div class="empty-msg">No agents nearby.</div>`;
		}

		return html`
			<div class="nearby-list">
				${nearby.map((n) => {
					const agent = this.store.agents.find((a) => a.name === n.name);
					const display = agent?.persona ?? n.name;
					return html`
						<div class="nearby-entry">
							<span>${display} <span class="nearby-dist">${n.state}</span></span>
							<span class="nearby-dist">${n.distance}px</span>
						</div>
					`;
				})}
			</div>
		`;
	}
}

if (!customElements.get("ft-game-panel-monitor")) customElements.define("ft-game-panel-monitor", PanelMonitor);
```

- [ ] **Step 2: Write tests**

Create `tests/game/ui/panel-monitor.test.ts`:

```typescript
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the game-styles module before importing the component
vi.mock("../../../src/game/ui/game-styles.js", () => ({
	resetStyles: [],
	colorStyles: [],
	fontStyles: [],
	scrollStyles: [],
	buttonStyles: [],
}));

import "../../../src/game/ui/panel-monitor.js";

function mockStore() {
	const store = new EventTarget() as EventTarget & Record<string, unknown>;
	store.agentStates = new Map([["atlas", "working"]]);
	store.llmStatus = new Map([["atlas", { state: "thinking", since: Date.now() }]]);
	store.agentPositions = new Map([["atlas", { x: 100, y: 200 }], ["bob", { x: 150, y: 220 }]]);
	store.agentEventLog = new Map([["atlas", [
		{ timestamp: Date.now() - 3000, type: "response", summary: "Hello there" },
		{ timestamp: Date.now() - 10000, type: "thinking", summary: "Thinking..." },
	]]]);
	store.taskLockedAgents = new Set();
	store.currentScene = "office";
	store.selectedTab = "monitor";
	store.agents = [{ name: "atlas", persona: "Atlas" }, { name: "bob", persona: "Bobby" }];
	store.isProcessAlive = vi.fn(() => true);
	return store;
}

describe("panel-monitor", () => {
	let el: HTMLElement & Record<string, unknown>;
	let container: HTMLElement;

	beforeEach(() => {
		container = document.createElement("div");
		document.body.appendChild(container);
		el = document.createElement("ft-game-panel-monitor") as HTMLElement & Record<string, unknown>;
	});

	afterEach(() => {
		el.remove();
		container.remove();
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("ft-game-panel-monitor")).toBeDefined();
	});

	it("renders status grid with brain state", async () => {
		const store = mockStore();
		el.store = store;
		el.agentName = "atlas";
		container.appendChild(el);
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		const shadow = el.shadowRoot!;
		expect(shadow.textContent).toContain("working");
	});

	it("renders process status", async () => {
		const store = mockStore();
		el.store = store;
		el.agentName = "atlas";
		container.appendChild(el);
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.textContent).toContain("alive");
	});

	it("renders event stream entries", async () => {
		const store = mockStore();
		el.store = store;
		el.agentName = "atlas";
		container.appendChild(el);
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Hello there");
		expect(el.shadowRoot!.textContent).toContain("response");
	});

	it("renders nearby agents", async () => {
		const store = mockStore();
		el.store = store;
		el.agentName = "atlas";
		container.appendChild(el);
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Bobby");
	});

	it("shows scene name capitalized", async () => {
		const store = mockStore();
		el.store = store;
		el.agentName = "atlas";
		container.appendChild(el);
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.textContent).toContain("Office");
	});

	it("shows empty message when no events", async () => {
		const store = mockStore();
		store.agentEventLog = new Map();
		el.store = store;
		el.agentName = "atlas";
		container.appendChild(el);
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		expect(el.shadowRoot!.textContent).toContain("No events yet");
	});

	it("shows lock icon when task locked", async () => {
		const store = mockStore();
		(store.taskLockedAgents as Set<string>).add("atlas");
		el.store = store;
		el.agentName = "atlas";
		container.appendChild(el);
		await (el as unknown as { updateComplete: Promise<boolean> }).updateComplete;
		// Lock emoji should be in shadow DOM
		const html = el.shadowRoot!.innerHTML;
		expect(html).toContain("lock-icon");
	});
});
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/panel-monitor.test.ts`

Expected: All pass.

- [ ] **Step 4: Commit**

```bash
cd "C:\Projects\flowti" && git add "01 - Projects/Flowti Plugin/src/game/ui/panel-monitor.ts" "01 - Projects/Flowti Plugin/tests/game/ui/panel-monitor.test.ts"
git commit -m "feat(monitor): panel-monitor component with status grid, event stream, nearby agents"
```

---

## Task 4: Swap history → monitor in agent-panel

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/ui/agent-panel.ts:17,19-25,220,232,290-307`
- Delete: `01 - Projects/Flowti Plugin/src/game/ui/panel-history.ts`

- [ ] **Step 1: Update import**

Line 17, change:
```typescript
import "./panel-monitor.js";
```

- [ ] **Step 2: Update TAB_LABELS**

Lines 19-25, change the last entry:
```typescript
{ name: "monitor", label: "Monitor" },
```

- [ ] **Step 3: Update renderTabContent switch**

Replace `case "history":` (around line 305) with:
```typescript
case "monitor":
	return html`<ft-game-panel-monitor .store="${this.store}" agentName="${agent.name}"></ft-game-panel-monitor>`;
```

- [ ] **Step 4: Update CSS selectors**

Replace `ft-game-panel-history` with `ft-game-panel-monitor` in both CSS selector blocks (lines 220 and 232).

- [ ] **Step 5: Delete panel-history.ts**

```bash
rm "01 - Projects/Flowti Plugin/src/game/ui/panel-history.ts"
```

- [ ] **Step 6: Run full Plugin test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`

Expected: All pass. No tests reference `panel-history` (no test file existed).

- [ ] **Step 7: Build Plugin**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`

Expected: Clean build.

- [ ] **Step 8: Commit**

```bash
cd "C:\Projects\flowti" && git add "01 - Projects/Flowti Plugin/src/game/ui/agent-panel.ts" && git rm "01 - Projects/Flowti Plugin/src/game/ui/panel-history.ts"
git commit -m "feat(panel): replace history tab with monitor tab"
```

---

## Verification

- [ ] **Full Plugin test suite**: `cd "01 - Projects/Flowti Plugin" && npx vitest run` — all pass
- [ ] **Plugin build**: `cd "01 - Projects/Flowti Plugin" && npm run build` — clean
- [ ] **CLI build**: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs` — clean
