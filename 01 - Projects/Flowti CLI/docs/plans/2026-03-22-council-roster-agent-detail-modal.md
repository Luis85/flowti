# Council Roster & Agent Detail Modal Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the right-side agent panel with a Council sidebar (5-slot RPG party bar) + split-screen Agent Detail Modal, including a live BT tree renderer and roster picker.

**Architecture:** Progressive replacement — build 4 new components (`council-sidebar.ts`, `council-picker.ts`, `agent-detail-modal.ts`, `bt-tree-view.ts`) alongside the existing `agent-panel.ts`. Add Council state + BT tree snapshots to `DashboardStore`. Wire new components into the engine. Retire old panel last. Existing sub-components (`panel-vitals`, `panel-economy`, `panel-talk`, `panel-tasks`, `panel-permissions`, `panel-debug`) are reused inside the modal's tabs.

**Tech Stack:** Lit (web components), TypeScript, Vitest + happy-dom, ExcaliburJS (canvas), mistreevous (BT library)

**Spec:** `docs/specs/2026-03-22-council-roster-agent-detail-modal-design.md`

---

## File Map

### New Files

| File | Responsibility |
|------|----------------|
| `src/game/ui/council-sidebar.ts` | Left-edge 5-slot party bar with portraits, needs bars, status dots |
| `src/game/ui/council-picker.ts` | Full-screen overlay for composing the Council of 5 |
| `src/game/ui/agent-detail-modal.ts` | Split-screen right 60% modal with 6 tabs (Profile, Talk, Brain, Tasks, Permissions, Debug) |
| `src/game/ui/bt-tree-view.ts` | Collapsible BT node tree with live status colors |
| `tests/game/ui/council-sidebar.test.ts` | Council sidebar unit tests |
| `tests/game/ui/council-picker.test.ts` | Council picker unit tests |
| `tests/game/ui/agent-detail-modal.test.ts` | Agent detail modal unit tests |
| `tests/game/ui/bt-tree-view.test.ts` | BT tree view unit tests |
| `tests/game/store/council-store.test.ts` | Council store methods + persistence tests |

### Modified Files

| File | Changes |
|------|---------|
| `src/game/store/dashboard-store.ts` | Add `council: string[]`, `btTreeState`, Council methods, update `TabName`, persistence |
| `src/game/systems/bt-system.ts` | Emit `BTTreeSnapshot` on tick (throttled, dirty-check) |
| `src/game/ui/panel-brain.ts` | Import + render `bt-tree-view`, rename "Decision Log" to "Decision Narrative" |
| `src/game/engine.ts` | Mount `council-sidebar` + `agent-detail-modal` instead of `agent-panel`, wire picker events |
| `src/game/engine-events.ts` | Auto-start LLM on modal open; wire BT snapshot to store |
| `src/game/engine-lifecycle.ts` | Update `selectTab("info")` → `selectTab("profile")` |

### Retired (final task)

| File | Reason |
|------|--------|
| `src/game/ui/agent-panel.ts` | Replaced by `agent-detail-modal.ts` |
| `src/game/ui/panel-info.ts` | Content inlined into modal Profile tab |
| `src/game/ui/panel-monitor.ts` | Process metrics folded into Profile (collapsible) |

---

## Chunk 1: Store Foundation — Council + TabName + BT Types

### Task 1: Update TabName type and add Council state to DashboardStore

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts:36` (TabName), `:60-80` (properties), `:200-205` (constructor)
- Test: `01 - Projects/Flowti Plugin/tests/game/store/council-store.test.ts` (new)

- [ ] **Step 1: Write failing tests for Council store methods**

Create `tests/game/store/council-store.test.ts`. Note: DashboardStore has no Lit dependency, so use direct imports (matching existing `dashboard-store.test.ts` pattern):

```typescript
import { describe, it, expect, beforeEach, vi } from "vitest";
import { DashboardStore } from "../../../src/game/store/dashboard-store.js";

// Stub localStorage for persistence tests
const localStorageMock = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: vi.fn((key: string) => store[key] ?? null),
		setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
		removeItem: vi.fn((key: string) => { delete store[key]; }),
		clear: vi.fn(() => { store = {}; }),
	};
})();
vi.stubGlobal("localStorage", localStorageMock);

describe("DashboardStore — Council", () => {
	let store: DashboardStore;

	beforeEach(() => {
		localStorageMock.clear();
		store = new DashboardStore();
	});

	it("council defaults to empty array", () => {
		expect(store.council).toEqual([]);
	});

	it("addToCouncil appends an agent", () => {
		store.addToCouncil("Alice");
		expect(store.council).toEqual(["Alice"]);
	});

	it("addToCouncil enforces max 5", () => {
		for (const n of ["A", "B", "C", "D", "E"]) store.addToCouncil(n);
		store.addToCouncil("F");
		expect(store.council).toHaveLength(5);
		expect(store.council).not.toContain("F");
	});

	it("addToCouncil rejects duplicates", () => {
		store.addToCouncil("Alice");
		store.addToCouncil("Alice");
		expect(store.council).toEqual(["Alice"]);
	});

	it("removeFromCouncil removes by name", () => {
		store.addToCouncil("Alice");
		store.addToCouncil("Bob");
		store.removeFromCouncil("Alice");
		expect(store.council).toEqual(["Bob"]);
	});

	it("removeFromCouncil is no-op for unknown name", () => {
		store.addToCouncil("Alice");
		store.removeFromCouncil("Unknown");
		expect(store.council).toEqual(["Alice"]);
	});

	it("setCouncil replaces the full list", () => {
		store.setCouncil(["X", "Y", "Z"]);
		expect(store.council).toEqual(["X", "Y", "Z"]);
	});

	it("setCouncil truncates to 5", () => {
		store.setCouncil(["A", "B", "C", "D", "E", "F", "G"]);
		expect(store.council).toHaveLength(5);
	});

	it("reorderCouncil replaces order", () => {
		store.setCouncil(["A", "B", "C"]);
		store.reorderCouncil(["C", "A", "B"]);
		expect(store.council).toEqual(["C", "A", "B"]);
	});
});

describe("DashboardStore — TabName fallback", () => {
	let store: DashboardStore;

	beforeEach(() => {
		store = new DashboardStore();
	});

	it("selectTab accepts profile", () => {
		store.selectTab("profile");
		expect(store.selectedTab).toBe("profile");
	});

	it("selectTab accepts brain", () => {
		store.selectTab("brain");
		expect(store.selectedTab).toBe("brain");
	});
});

describe("DashboardStore — Council persistence", () => {
	let store: DashboardStore;

	beforeEach(() => {
		localStorageMock.clear();
		store = new DashboardStore();
	});

	it("persists council to localStorage on addToCouncil", () => {
		store.addToCouncil("Alice");
		expect(localStorageMock.setItem).toHaveBeenCalledWith("flowti-council", JSON.stringify(["Alice"]));
	});

	it("persists council to localStorage on removeFromCouncil", () => {
		store.addToCouncil("Alice");
		store.removeFromCouncil("Alice");
		expect(localStorageMock.setItem).toHaveBeenLastCalledWith("flowti-council", JSON.stringify([]));
	});

	it("persists council to localStorage on setCouncil", () => {
		store.setCouncil(["X", "Y"]);
		expect(localStorageMock.setItem).toHaveBeenCalledWith("flowti-council", JSON.stringify(["X", "Y"]));
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/store/council-store.test.ts`

Expected: FAIL — `council` property and methods don't exist yet.

- [ ] **Step 3: Update TabName and add Council state to DashboardStore**

In `src/game/store/dashboard-store.ts`:

**3a.** Replace `TabName` type (line 36):
```typescript
export type TabName = "profile" | "talk" | "tasks" | "permissions" | "brain" | "debug";
```

**3b.** Add Council properties after `selectedTab` (around line 65):
```typescript
council: string[] = [];
```

**3c.** Add `BTTreeSnapshot` and `BTNodeState` types (before the class, after imports):
```typescript
export type BTNodeType = "selector" | "sequence" | "condition" | "action";
export type BTNodeStatus = "running" | "success" | "failure" | "idle";

export interface BTNodeState {
	readonly id: string;
	readonly label: string;
	readonly type: BTNodeType;
	readonly status: BTNodeStatus;
	readonly children: BTNodeState[];
}

export interface BTTreeSnapshot {
	readonly root: BTNodeState;
	readonly tick: number;
}
```

**3d.** Add `btTreeState` map after `council`:
```typescript
btTreeState: Map<string, BTTreeSnapshot> = new Map();
```

**3e.** Add Council methods after existing methods (after `stopFollow`):
```typescript
addToCouncil(name: string): void {
	if (this.council.length >= 5 || this.council.includes(name)) return;
	this.council = [...this.council, name];
	this.persistCouncil();
	this.notify();
}

removeFromCouncil(name: string): void {
	const filtered = this.council.filter(n => n !== name);
	if (filtered.length === this.council.length) return;
	this.council = filtered;
	this.persistCouncil();
	this.notify();
}

setCouncil(names: string[]): void {
	this.council = names.slice(0, 5);
	this.persistCouncil();
	this.notify();
}

reorderCouncil(names: string[]): void {
	this.council = names.slice(0, 5);
	this.persistCouncil();
	this.notify();
}

private persistCouncil(): void {
	try { localStorage.setItem("flowti-council", JSON.stringify(this.council)); } catch { /* localStorage unavailable in tests/SSR */ }
}

updateBtTree(agentName: string, snapshot: BTTreeSnapshot): void {
	this.btTreeState.set(agentName, snapshot);
	this.notify();
}
```

**3f.** Fix all references to `"info"` tab — search for `selectTab("info")` in store and replace with `selectTab("profile")`. Update `selectedTab` default to `"profile"`.

**3g.** Fix `selectTab` to fall back unrecognised values:
```typescript
selectTab(tab: TabName): void {
	const valid: TabName[] = ["profile", "talk", "tasks", "permissions", "brain", "debug"];
	this.selectedTab = valid.includes(tab) ? tab : "profile";
	// ... existing unread logic
	this.notify();
}
```

- [ ] **Step 4: Fix TabName references in agent-panel.ts**

In `src/game/ui/agent-panel.ts`, update `TAB_LABELS` array: rename `"info"` to `"profile"` with label `"Profile"`, remove `"monitor"` entry. Update the `renderTabContent` switch to use `"profile"` instead of `"info"` and remove the `"monitor"` case.

- [ ] **Step 5: Fix TabName references across all panel consumers**

Search for `selectTab("info")` and `"info"` tab references across the Plugin source. Replace with `"profile"`. **Exhaustive** locations (grep for `"info"` in TypeScript files under `src/game/`):
- `engine-events.ts` — any `store.selectTab("info")` calls
- `engine-lifecycle.ts:383` — `store.selectTab("info")` in agent click handler
- `ask-bob.ts` — `this.store.selectTab("info")` call
- Tests referencing `"info"` or `"monitor"` tab (grep `tests/` for these strings)

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/store/council-store.test.ts`

Expected: PASS

- [ ] **Step 7: Run full test suite to check TabName migration**

Run: `cd "01 - Projects/Flowti Plugin" && npm test`

Expected: All pass (some test fixtures may need `"info"` → `"profile"` updates)

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts" \
       "01 - Projects/Flowti Plugin/src/game/ui/agent-panel.ts" \
       "01 - Projects/Flowti Plugin/tests/game/store/council-store.test.ts"
git commit -m "feat(store): add Council state, BTTreeSnapshot types, migrate TabName info→profile"
```

---

## Chunk 2: Council Sidebar Component

### Task 2: Build council-sidebar.ts

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/ui/council-sidebar.ts`
- Test: `01 - Projects/Flowti Plugin/tests/game/ui/council-sidebar.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/game/ui/council-sidebar.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("lit", () => {
	class LitElement extends HTMLElement {}
	return { LitElement, html: (...args: unknown[]) => args, css: (...args: unknown[]) => args, nothing: Symbol("nothing") };
});
vi.mock("../../../src/components/flowti-element.js", () => {
	class FlowtiElement extends HTMLElement {}
	if (!customElements.get("flowti-element")) customElements.define("flowti-element", FlowtiElement);
	return { FlowtiElement };
});
vi.mock("../../../src/game/ui/game-styles.js", () => ({
	resetStyles: {}, colorStyles: {}, fontStyles: {}, scrollStyles: {}, buttonStyles: {},
}));
vi.mock("../../../src/game/sprites/character-pool.js", () => ({
	resolveCharacter: vi.fn(() => "NinjaBlue"),
}));

const importModule = async () => import("../../../src/game/ui/council-sidebar.js");

describe("CouncilSidebar", () => {
	beforeEach(async () => {
		await importModule();
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("ft-game-council-sidebar")).toBeDefined();
	});

	it("can be constructed without error", () => {
		expect(() => document.createElement("ft-game-council-sidebar")).not.toThrow();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/council-sidebar.test.ts`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement council-sidebar.ts**

Create `src/game/ui/council-sidebar.ts`. Key structure:

```typescript
import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles } from "./game-styles.js";
import { resolveCharacter } from "../sprites/character-pool.js";
import type { DashboardStore } from "../store/dashboard-store.js";
import type { DashboardAgent, AgentNeeds } from "../data/types.js";

const MAX_COUNCIL = 5;

export class CouncilSidebar extends FlowtiElement {
	static styles = [
		resetStyles, colorStyles, fontStyles,
		css`
			:host {
				position: fixed;
				left: 0; top: 0; bottom: 52px;
				width: 80px;
				z-index: 90;
				display: flex;
				flex-direction: column;
				align-items: center;
				padding: 8px 0;
				gap: 8px;
				background: var(--bg-panel);
				border-right: 1px solid var(--border);
			}
			.slot { /* portrait circle, 56px, dashed border when empty */ }
			.slot-filled { /* gold/blue/gray border based on trust tier */ }
			.portrait { width: 48px; height: 48px; border-radius: 50%; object-fit: cover; }
			.status-dot { /* 8px absolute top-right corner */ }
			.agent-name { font-size: 9px; text-align: center; max-width: 72px; overflow: hidden; text-overflow: ellipsis; }
			.need-bar { /* 4px tall, 48px wide, colored fill */ }
			.empty-slot { /* dashed circle, "+" icon */ }
			.manage-btn { /* bottom button */ }
		`,
	];

	store!: DashboardStore;

	private onStoreChanged = () => this.requestUpdate();

	connectedCallback(): void {
		super.connectedCallback();
		this.store?.addEventListener("state-changed", this.onStoreChanged);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.store?.removeEventListener("state-changed", this.onStoreChanged);
	}

	protected renderContent() {
		const council = this.store?.council ?? [];
		const slots = Array.from({ length: MAX_COUNCIL }, (_, i) => council[i] ?? null);

		return html`
			${slots.map((name, i) => name
				? this.renderFilledSlot(name, i)
				: this.renderEmptySlot(i)
			)}
			<button class="manage-btn" @click=${this.openPicker}>Manage</button>
		`;
	}

	private renderFilledSlot(name: string, _index: number) {
		const agent = this.store.agents.find(a => a.name === name);
		if (!agent) return this.renderEmptySlot(_index);
		const needs = this.store.getAgentNeeds(name);
		const lowestNeed = this.getLowestNeed(needs);
		const tierColor = this.tierBorderColor(agent.trustTier);
		const statusColor = agent.status === "busy" ? "var(--accent-gold)" : agent.status === "idle" ? "var(--accent-green)" : "var(--text-muted)";
		const charName = resolveCharacter(name, agent.domain ?? "");

		return html`
			<div class="slot slot-filled" style="border-color:${tierColor}" @click=${() => this.store.selectAgent(name)}>
				<div class="portrait-wrap">
					<div class="portrait" title="${charName}"></div>
					<span class="status-dot" style="background:${statusColor}"></span>
				</div>
				<span class="agent-name">${name}</span>
				${lowestNeed !== undefined ? html`
					<div class="need-bar">
						<div class="need-fill" style="width:${lowestNeed}%;background:${lowestNeed > 60 ? 'var(--accent-green)' : lowestNeed > 35 ? 'var(--accent-gold)' : '#ef4444'}"></div>
					</div>
				` : nothing}
			</div>
		`;
	}

	private renderEmptySlot(_index: number) {
		return html`
			<div class="slot empty-slot" @click=${this.openPicker}>
				<span class="plus-icon">+</span>
			</div>
		`;
	}

	private getLowestNeed(needs?: AgentNeeds): number | undefined {
		if (!needs) return undefined;
		return Math.min(needs.energy, needs.hunger, needs.thirst, needs.focus, needs.social, needs.morale);
	}

	private tierBorderColor(tier?: string): string {
		if (tier === "autonomous") return "var(--accent-gold)";
		if (tier === "trusted") return "var(--accent-blue)";
		return "var(--text-muted)";
	}

	private openPicker(): void {
		this.dispatchEvent(new CustomEvent("open-picker", { bubbles: true, composed: true }));
	}
}

if (!customElements.get("ft-game-council-sidebar")) customElements.define("ft-game-council-sidebar", CouncilSidebar);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/council-sidebar.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/ui/council-sidebar.ts" \
       "01 - Projects/Flowti Plugin/tests/game/ui/council-sidebar.test.ts"
git commit -m "feat(ui): add Council sidebar component — 5-slot RPG party bar"
```

---

## Chunk 3: Council Picker Modal

### Task 3: Build council-picker.ts

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/ui/council-picker.ts`
- Test: `01 - Projects/Flowti Plugin/tests/game/ui/council-picker.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/game/ui/council-picker.test.ts` following the same mock pattern as council-sidebar tests. Test:
- Custom element registration (`ft-game-council-picker`)
- Construction without error

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/council-picker.test.ts`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement council-picker.ts**

Create `src/game/ui/council-picker.ts`. Key structure:

- Full-screen overlay (`position: fixed; inset: 0; z-index: 400`)
- Backdrop (`rgba(0,0,0,0.6)`) with click-to-close
- Centered card (`max-width: 600px; max-height: 500px`)
- Header: "Assemble Your Council" + close button (X)
- Top zone: 5 horizontal slots showing current Council members (portrait + name + remove X)
- Bottom zone: scrollable grid of all agents NOT in Council (portrait + name + domain + level)
- Click agent card → `store.addToCouncil(name)`
- Click remove X → `store.removeFromCouncil(name)`
- Escape key closes picker
- Reads `store.agents` for full roster, `store.council` for current picks
- Dispatches `"close-picker"` event on close

```typescript
import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles, buttonStyles } from "./game-styles.js";
import { resolveCharacter } from "../sprites/character-pool.js";
import type { DashboardStore } from "../store/dashboard-store.js";

export class CouncilPicker extends FlowtiElement {
	static styles = [
		resetStyles, colorStyles, fontStyles, buttonStyles,
		css`
			:host { position: fixed; inset: 0; z-index: 400; display: flex; align-items: center; justify-content: center; }
			.backdrop { position: absolute; inset: 0; background: rgba(0,0,0,0.6); }
			.card { position: relative; z-index: 1; width: min(600px, calc(100vw - 32px)); max-height: min(500px, calc(100vh - 32px)); background: var(--bg-panel); border: 1px solid var(--border); border-radius: 8px; display: flex; flex-direction: column; overflow: hidden; }
			.header { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--border); }
			.header h2 { margin: 0; font-size: 14px; color: var(--accent-gold); }
			.council-row { display: flex; gap: 8px; padding: 12px 16px; justify-content: center; border-bottom: 1px solid var(--border); }
			.council-slot { width: 64px; height: 80px; border: 2px dashed var(--border); border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative; }
			.council-slot.filled { border-style: solid; border-color: var(--accent-gold); cursor: grab; }
			.council-slot.drag-over { border-color: var(--accent-blue); background: rgba(78, 139, 217, 0.1); }
			.remove-btn { position: absolute; top: -4px; right: -4px; width: 16px; height: 16px; border-radius: 50%; background: #ef4444; color: white; font-size: 10px; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; }
			.agent-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(100px, 1fr)); gap: 8px; padding: 12px 16px; overflow-y: auto; flex: 1; }
			.agent-card { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 6px; padding: 8px; text-align: center; cursor: pointer; transition: border-color 0.15s; }
			.agent-card:hover { border-color: var(--accent-gold); }
			.agent-card .name { font-size: 11px; font-weight: 700; color: var(--text-primary); }
			.agent-card .domain { font-size: 9px; color: var(--text-secondary); text-transform: uppercase; }
			.full-notice { font-size: 10px; color: var(--text-muted); text-align: center; padding: 4px; }
		`,
	];

	store!: DashboardStore;

	private onStoreChanged = () => this.requestUpdate();
	private onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") this.close(); };

	connectedCallback(): void {
		super.connectedCallback();
		this.store?.addEventListener("state-changed", this.onStoreChanged);
		document.addEventListener("keydown", this.onKeyDown);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.store?.removeEventListener("state-changed", this.onStoreChanged);
		document.removeEventListener("keydown", this.onKeyDown);
	}

	protected renderContent() {
		const council = this.store?.council ?? [];
		const available = (this.store?.agents ?? []).filter(a => !council.includes(a.name));
		const isFull = council.length >= 5;

		return html`
			<div class="backdrop" @click=${this.close}></div>
			<div class="card">
				<div class="header">
					<h2>Assemble Your Council</h2>
					<button class="close-btn" @click=${this.close}>&times;</button>
				</div>
				<div class="council-row">
					${Array.from({ length: 5 }, (_, i) => {
						const name = council[i];
						return name
							? html`<div class="council-slot filled"
								draggable="true"
								@dragstart=${(e: DragEvent) => { e.dataTransfer?.setData("text/plain", String(i)); this.dragSourceIndex = i; }}
								@dragover=${(e: DragEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).classList.add("drag-over"); }}
								@dragleave=${(e: DragEvent) => { (e.currentTarget as HTMLElement).classList.remove("drag-over"); }}
								@drop=${(e: DragEvent) => { (e.currentTarget as HTMLElement).classList.remove("drag-over"); this.handleDrop(i); }}>
								<span class="slot-name">${name}</span>
								<button class="remove-btn" @click=${() => this.store.removeFromCouncil(name)}>&times;</button>
							</div>`
							: html`<div class="council-slot"><span class="plus">+</span></div>`;
					})}
				</div>
				${isFull ? html`<div class="full-notice">Council full (5/5) — remove a member to add another</div>` : nothing}
				<div class="agent-grid">
					${available.map(a => html`
						<div class="agent-card" @click=${() => !isFull && this.store.addToCouncil(a.name)}>
							<div class="name">${a.name}</div>
							<div class="domain">${a.domain ?? "—"}</div>
						</div>
					`)}
				</div>
			</div>
		`;
	}

	private dragSourceIndex = -1;

	private handleDrop(targetIndex: number): void {
		if (this.dragSourceIndex < 0 || this.dragSourceIndex === targetIndex) return;
		const council = [...(this.store?.council ?? [])];
		const [moved] = council.splice(this.dragSourceIndex, 1);
		council.splice(targetIndex, 0, moved);
		this.store.reorderCouncil(council);
		this.dragSourceIndex = -1;
	}

	private close(): void {
		this.dispatchEvent(new CustomEvent("close-picker", { bubbles: true, composed: true }));
	}
}

if (!customElements.get("ft-game-council-picker")) customElements.define("ft-game-council-picker", CouncilPicker);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/council-picker.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/ui/council-picker.ts" \
       "01 - Projects/Flowti Plugin/tests/game/ui/council-picker.test.ts"
git commit -m "feat(ui): add Council picker modal — team composition overlay"
```

---

## Chunk 4: BT Tree View Component

### Task 4: Build bt-tree-view.ts

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/ui/bt-tree-view.ts`
- Test: `01 - Projects/Flowti Plugin/tests/game/ui/bt-tree-view.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/game/ui/bt-tree-view.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("lit", () => {
	class LitElement extends HTMLElement {}
	return { LitElement, html: (...args: unknown[]) => args, css: (...args: unknown[]) => args, nothing: Symbol("nothing") };
});
vi.mock("../../../src/components/flowti-element.js", () => {
	class FlowtiElement extends HTMLElement {}
	if (!customElements.get("flowti-element")) customElements.define("flowti-element", FlowtiElement);
	return { FlowtiElement };
});
vi.mock("../../../src/game/ui/game-styles.js", () => ({
	resetStyles: {}, colorStyles: {}, fontStyles: {}, scrollStyles: {},
}));

const importModule = async () => import("../../../src/game/ui/bt-tree-view.js");

describe("BtTreeView", () => {
	beforeEach(async () => {
		await importModule();
	});

	it("is defined as a custom element", () => {
		expect(customElements.get("ft-game-bt-tree-view")).toBeDefined();
	});

	it("can be constructed without error", () => {
		expect(() => document.createElement("ft-game-bt-tree-view")).not.toThrow();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/bt-tree-view.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement bt-tree-view.ts**

Create `src/game/ui/bt-tree-view.ts`:

```typescript
import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles, scrollStyles } from "./game-styles.js";
import type { BTTreeSnapshot, BTNodeState, BTNodeType, BTNodeStatus } from "../store/dashboard-store.js";

const TYPE_ICONS: Record<BTNodeType, string> = {
	selector: "?",
	sequence: "\u2192",
	condition: "\u25C6",
	action: "\u25B6",
};

const STATUS_COLORS: Record<BTNodeStatus, string> = {
	running: "var(--accent-blue)",
	success: "var(--accent-green)",
	failure: "var(--text-muted)",
	idle: "transparent",
};

export class BtTreeView extends FlowtiElement {
	static styles = [
		resetStyles, colorStyles, fontStyles, scrollStyles,
		css`
			:host { display: block; overflow-y: auto; max-height: 300px; }
			.node { padding: 2px 0 2px calc(var(--depth, 0) * 16px); display: flex; align-items: center; gap: 4px; font-size: 11px; cursor: pointer; }
			.node:hover { background: rgba(255,255,255,0.03); }
			.icon { width: 14px; text-align: center; color: var(--text-secondary); font-size: 10px; }
			.label { color: var(--text-primary); flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
			.dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
			.toggle { width: 12px; text-align: center; color: var(--text-muted); font-size: 8px; cursor: pointer; }
			.children { overflow: hidden; }
			.collapsed .children { display: none; }
		`,
	];

	snapshot?: BTTreeSnapshot;
	private collapsed = new Set<string>();

	protected renderContent() {
		if (!this.snapshot) return html`<div style="color:var(--text-muted);font-size:11px;padding:8px">No BT data</div>`;
		return this.renderNode(this.snapshot.root, 0);
	}

	private renderNode(node: BTNodeState, depth: number): unknown {
		const hasChildren = node.children.length > 0;
		const isCollapsed = this.collapsed.has(node.id);
		const isOnActivePath = this.isOnActivePath(node);

		return html`
			<div class="node ${isCollapsed ? 'collapsed' : ''}" style="--depth:${depth}">
				${hasChildren
					? html`<span class="toggle" @click=${() => this.toggleNode(node.id)}>${isCollapsed ? "\u25B6" : "\u25BC"}</span>`
					: html`<span class="toggle"></span>`
				}
				<span class="icon">${TYPE_ICONS[node.type]}</span>
				<span class="label" title="${node.label}">${node.label}</span>
				${node.status !== "idle" ? html`<span class="dot" style="background:${STATUS_COLORS[node.status]}"></span>` : nothing}
			</div>
			${hasChildren && !isCollapsed ? html`
				<div class="children">
					${node.children.map(child => this.renderNode(child, depth + 1))}
				</div>
			` : nothing}
		`;
	}

	private isOnActivePath(node: BTNodeState): boolean {
		if (node.status === "running") return true;
		return node.children.some(c => this.isOnActivePath(c));
	}

	private toggleNode(id: string): void {
		if (this.collapsed.has(id)) this.collapsed.delete(id);
		else this.collapsed.add(id);
		this.requestUpdate();
	}
}

if (!customElements.get("ft-game-bt-tree-view")) customElements.define("ft-game-bt-tree-view", BtTreeView);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/bt-tree-view.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/ui/bt-tree-view.ts" \
       "01 - Projects/Flowti Plugin/tests/game/ui/bt-tree-view.test.ts"
git commit -m "feat(ui): add BT tree view — collapsible node tree with live status colors"
```

---

## Chunk 5: Agent Detail Modal

### Task 5: Build agent-detail-modal.ts

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/ui/agent-detail-modal.ts`
- Test: `01 - Projects/Flowti Plugin/tests/game/ui/agent-detail-modal.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/game/ui/agent-detail-modal.test.ts` with same mock pattern. Test:
- Custom element registration (`ft-game-agent-detail-modal`)
- Construction without error

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/agent-detail-modal.test.ts`

Expected: FAIL

- [ ] **Step 3: Implement agent-detail-modal.ts**

Create `src/game/ui/agent-detail-modal.ts`. This is the largest new component. Key structure:

```typescript
import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles, scrollStyles, buttonStyles } from "./game-styles.js";
import { resolveCharacter } from "../sprites/character-pool.js";
import type { DashboardStore, TabName } from "../store/dashboard-store.js";
import type { DashboardAgent } from "../data/types.js";
import type { IEventBus } from "../data/types.js";

// Sub-component imports (reused)
import "./panel-vitals.js";
import "./panel-economy.js";
import "./panel-talk.js";
import "./panel-tasks.js";
import "./panel-permissions.js";
import "./panel-brain.js";
import "./panel-debug.js";
import "./bt-tree-view.js";

const TAB_LABELS: ReadonlyArray<{ name: TabName; label: string }> = [
	{ name: "profile", label: "Profile" },
	{ name: "talk", label: "Talk" },
	{ name: "brain", label: "Brain" },
	{ name: "tasks", label: "Tasks" },
	{ name: "permissions", label: "Permissions" },
	{ name: "debug", label: "Debug" },
];

export class AgentDetailModal extends FlowtiElement {
	static styles = [
		resetStyles, colorStyles, fontStyles, scrollStyles, buttonStyles,
		css`
			:host { position: fixed; inset: 0; z-index: 150; display: flex; pointer-events: none; }
			.backdrop { position: absolute; left: 0; top: 0; bottom: 0; width: 40%; background: rgba(0,0,0,0.3); pointer-events: auto; }
			.modal { position: absolute; right: 0; top: 0; bottom: 0; width: 60%; background: var(--bg-panel); border-left: 1px solid var(--border-glow); display: flex; flex-direction: column; pointer-events: auto; animation: slide-in 200ms ease-out; }
			@keyframes slide-in { from { transform: translateX(100%); } to { transform: translateX(0); } }
			.header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; border-bottom: 1px solid var(--border); }
			.header-portrait { width: 64px; height: 64px; border-radius: 50%; border: 2px solid var(--accent-gold); background: var(--bg-secondary); }
			.header-info { flex: 1; }
			.header-name { font-size: 16px; font-weight: 700; color: var(--text-primary); }
			.header-persona { font-size: 11px; color: var(--text-secondary); font-style: italic; }
			.header-badges { display: flex; gap: 6px; margin-top: 4px; }
			.badge { font-size: 9px; padding: 2px 6px; border-radius: 3px; background: var(--bg-tertiary); color: var(--text-secondary); text-transform: uppercase; }
			.badge-trust { background: var(--accent-blue); color: white; }
			.badge-type { background: var(--bg-tertiary); }
			.llm-status { display: flex; align-items: center; gap: 4px; font-size: 10px; color: var(--text-secondary); }
			.llm-dot { width: 6px; height: 6px; border-radius: 50%; }
			.brain-state { font-size: 10px; color: var(--text-muted); margin-top: 2px; }
			.close-btn { background: none; border: none; color: var(--text-muted); font-size: 18px; cursor: pointer; padding: 4px 8px; }
			.close-btn:hover { color: var(--text-primary); }
			.tab-bar { display: flex; border-bottom: 1px solid var(--border); overflow-x: auto; }
			.tab { padding: 8px 14px; font-size: 11px; color: var(--text-secondary); cursor: pointer; border-bottom: 2px solid transparent; white-space: nowrap; }
			.tab.active { color: var(--accent-gold); border-bottom-color: var(--accent-gold); }
			.tab:hover { color: var(--text-primary); }
			.tab-content { flex: 1; overflow-y: auto; padding: 12px 16px; }
			/* Profile tab sections */
			.profile-section { margin-bottom: 16px; }
			.section-label { font-size: 10px; text-transform: uppercase; color: var(--text-muted); margin-bottom: 6px; letter-spacing: 0.5px; }
			.personality-traits { display: flex; flex-wrap: wrap; gap: 4px; }
			.trait { font-size: 10px; padding: 2px 8px; border-radius: 10px; background: var(--bg-secondary); color: var(--text-secondary); }
			.stat-grid { display: grid; grid-template-columns: repeat(6, 1fr); gap: 4px; }
			.stat-card { text-align: center; padding: 6px 4px; background: var(--bg-secondary); border-radius: 4px; }
			.stat-value { font-size: 14px; font-weight: 700; color: var(--text-primary); }
			.stat-label { font-size: 9px; text-transform: uppercase; color: var(--text-muted); }
			.stat-bar { height: 2px; margin-top: 2px; background: var(--bg-tertiary); border-radius: 1px; }
			.stat-fill { height: 100%; border-radius: 1px; background: var(--accent-gold); }
			.tags-row { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 8px; }
			.list-item { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; border-bottom: 1px solid rgba(255,255,255,0.03); }
		`,
	];

	store!: DashboardStore;
	eventBus?: IEventBus;

	private onStoreChanged = () => this.requestUpdate();
	private onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") this.handleClose(); };

	connectedCallback(): void {
		super.connectedCallback();
		this.store?.addEventListener("state-changed", this.onStoreChanged);
		document.addEventListener("keydown", this.onKeyDown);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		this.store?.removeEventListener("state-changed", this.onStoreChanged);
		document.removeEventListener("keydown", this.onKeyDown);
	}

	protected renderContent() {
		const agentName = this.store?.selectedAgent;
		if (!agentName) return nothing;
		const agent = this.store.agents.find(a => a.name === agentName);
		if (!agent) return nothing;

		return html`
			<div class="backdrop" @click=${this.handleClose}></div>
			<div class="modal">
				${this.renderHeader(agent)}
				${this.renderTabBar()}
				<div class="tab-content">
					${this.renderTabContent(agent)}
				</div>
			</div>
		`;
	}

	private renderHeader(agent: DashboardAgent) {
		const llm = this.store.llmStatus.get(agent.name);
		const brainState = this.store.agentStates.get(agent.name) ?? "idle";
		return html`
			<div class="header">
				<div class="header-portrait"></div>
				<div class="header-info">
					<div class="header-name">${agent.name}</div>
					${agent.persona ? html`<div class="header-persona">${agent.persona}</div>` : nothing}
					<div class="header-badges">
						<span class="badge badge-type">${agent.agentType}</span>
						${agent.trustTier ? html`<span class="badge badge-trust">${agent.trustTier}</span>` : nothing}
						${agent.level ? html`<span class="badge">Lv ${agent.level}</span>` : nothing}
					</div>
					<div class="brain-state">${brainState}</div>
				</div>
				<div class="llm-status">
					<span class="llm-dot" style="background:${llm?.state === 'thinking' ? 'var(--accent-gold)' : llm?.state === 'error' ? '#ef4444' : 'var(--accent-green)'}"></span>
					${llm?.state ?? "idle"}
				</div>
				<button class="close-btn" @click=${this.handleClose}>&times;</button>
			</div>
		`;
	}

	private renderTabBar() {
		return html`
			<div class="tab-bar">
				${TAB_LABELS.map(t => html`
					<div class="tab ${this.store.selectedTab === t.name ? 'active' : ''}" @click=${() => this.store.selectTab(t.name)}>
						${t.label}
					</div>
				`)}
			</div>
		`;
	}

	private renderTabContent(agent: DashboardAgent) {
		switch (this.store.selectedTab) {
			case "profile": return this.renderProfile(agent);
			case "talk": return html`<ft-game-panel-talk .store=${this.store} agentName=${agent.name}></ft-game-panel-talk>`;
			case "brain": return html`<ft-game-panel-brain .store=${this.store} .agent=${agent}></ft-game-panel-brain>`;
			case "tasks": return html`<ft-game-panel-tasks .store=${this.store} .agent=${agent}></ft-game-panel-tasks>`;
			case "permissions": return html`<ft-game-panel-permissions .store=${this.store} agentName=${agent.name}></ft-game-panel-permissions>`;
			case "debug": return html`<ft-game-panel-debug .store=${this.store} .agent=${agent}></ft-game-panel-debug>`;
			default: return this.renderProfile(agent);
		}
	}

	private renderProfile(agent: DashboardAgent) {
		const needs = this.store.getAgentNeeds(agent.name);
		const attrs = agent.attributes;
		// Inline the hero section, stats, personality, vitals, economy, skills, goals — migrated from panel-info.ts
		return html`
			<div class="profile-section">
				<div class="tags-row">
					${agent.domain ? html`<span class="badge">${agent.domain}</span>` : nothing}
					${agent.mood ? html`<span class="badge">${agent.mood}</span>` : nothing}
					<span class="badge">${agent.status}</span>
				</div>
				${agent.personality?.length ? html`
					<div class="personality-traits">
						${agent.personality.map(t => html`<span class="trait">${t}</span>`)}
					</div>
				` : nothing}
			</div>

			${attrs ? html`
				<div class="profile-section">
					<div class="section-label">Attributes</div>
					<div class="stat-grid">
						${(["str", "int", "wis", "cha", "dex", "con"] as const).map(key => html`
							<div class="stat-card">
								<div class="stat-value">${attrs[key]}</div>
								<div class="stat-label">${key}</div>
								<div class="stat-bar"><div class="stat-fill" style="width:${(attrs[key] / 20) * 100}%"></div></div>
							</div>
						`)}
					</div>
				</div>
			` : nothing}

			<ft-game-panel-vitals .needs=${needs}></ft-game-panel-vitals>
			<ft-game-panel-economy .agent=${agent}></ft-game-panel-economy>

			${agent.skills?.length ? html`
				<div class="profile-section">
					<div class="section-label">Skills</div>
					${agent.skills.map(s => html`<div class="list-item"><span>${s.name}</span><span>${s.level}</span></div>`)}
				</div>
			` : nothing}

			${agent.goals?.length ? html`
				<div class="profile-section">
					<div class="section-label">Goals</div>
					${agent.goals.map(g => html`<div class="list-item"><span>${g.text}</span><span>${g.priority}</span></div>`)}
				</div>
			` : nothing}

			${agent.relationships?.length ? html`
				<div class="profile-section">
					<div class="section-label">Connections</div>
					${agent.relationships.map(r => html`<div class="list-item"><span>${r.target}</span><span>${r.type}</span></div>`)}
				</div>
			` : nothing}
		`;
	}

	private handleClose(): void {
		this.store.stopFollow();
		this.store.selectAgent(null);
	}
}

if (!customElements.get("ft-game-agent-detail-modal")) customElements.define("ft-game-agent-detail-modal", AgentDetailModal);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/agent-detail-modal.test.ts`

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/ui/agent-detail-modal.ts" \
       "01 - Projects/Flowti Plugin/tests/game/ui/agent-detail-modal.test.ts"
git commit -m "feat(ui): add Agent Detail Modal — split-screen 60% character sheet with 6 tabs"
```

---

## Chunk 6: BT Snapshot Emission + Brain Tab Integration

### Task 6: Emit BTTreeSnapshot from BT system

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/systems/bt-system.ts:122-138`
- Modify: `01 - Projects/Flowti Plugin/src/game/ui/panel-brain.ts`

- [ ] **Step 1: Add snapshot builder to bt-system.ts**

After the `update()` method in `bt-system.ts`, add a method that walks the mistreevous tree and produces a `BTTreeSnapshot`.

**IMPORTANT:** The mistreevous library's node introspection API must be verified before implementation. The library wraps trees behind `BehaviourTree` class. Check the installed version's API:
- Look for `tree.getTreeNodeDetails()` (returns flat `NodeDetails[]` with `id`, `type`, `state`, `parentId`)
- Or check `tree.getFlattenedNodeDetails()` in newer versions
- If neither exists, read `node_modules/mistreevous/dist/` type definitions

The walker must use the **actual API** — do NOT assume `.getType()/.getName()/.getState()/.getChildren()` on nodes. Instead, use whatever flat/detail API mistreevous provides, then reconstruct the nested tree from parent→child relationships.

```typescript
import type { BTTreeSnapshot, BTNodeState, BTNodeType, BTNodeStatus } from "../store/dashboard-store.js";

// Skeleton — adapt to actual mistreevous API after investigation:
private buildSnapshot(entry: BtEntry): BTTreeSnapshot {
	// Use mistreevous introspection API (e.g. tree.getTreeNodeDetails())
	// to get flat node details, then reconstruct nested BTNodeState tree.
	// Map mistreevous node types → BTNodeType:
	//   Selector/Lotto/Priority → "selector"
	//   Sequence → "sequence"
	//   Condition/Wait/Guard → "condition"
	//   Action/Flip/Succeed/Fail → "action"
	// Map mistreevous state → BTNodeStatus:
	//   RUNNING → "running", SUCCEEDED → "success", FAILED → "failure", READY → "idle"
	const root: BTNodeState = { id: "root", label: "Root", type: "selector", status: "idle", children: [] };
	return { root, tick: this.tickCount };
}
```

- [ ] **Step 2: Emit snapshot after each BT tick (dirty-check)**

In the `update()` method, after `btTick()` call, build a snapshot and compare to previous. Only emit if status values changed (not just tick counter):

```typescript
// Inside the per-entry tick block, after btTick():
if (this.onSnapshot) {
	const snapshot = this.buildSnapshot(entry);
	const agentName = entry.bt.agent.context.name;
	const prev = this.lastSnapshots.get(agentName);
	if (!prev || !this.snapshotsEqual(prev.root, snapshot.root)) {
		this.lastSnapshots.set(agentName, snapshot);
		this.onSnapshot(agentName, snapshot);
	}
}
```

Add callback, cache, counter, and equality check to the class:
```typescript
onSnapshot?: (agentName: string, snapshot: BTTreeSnapshot) => void;
private lastSnapshots = new Map<string, BTTreeSnapshot>();
private tickCount = 0;

/** Compare two node trees by status only (ignores tick counter). */
private snapshotsEqual(a: BTNodeState, b: BTNodeState): boolean {
	if (a.status !== b.status) return false;
	if (a.children.length !== b.children.length) return false;
	return a.children.every((child, i) => this.snapshotsEqual(child, b.children[i]));
}
```

Increment `tickCount` at the start of `update()`.

- [ ] **Step 3: Wire snapshot callback in engine-startup.ts or engine-events.ts**

In `engine.ts` (where the BT system is created and the game loop runs), set the snapshot callback after BT system initialization:

```typescript
sys.bt.onSnapshot = (name, snapshot) => store.updateBtTree(name, snapshot);
```

- [ ] **Step 4: Update panel-brain.ts to render bt-tree-view**

In `panel-brain.ts`, import `bt-tree-view.ts` and add it above the decision log:

```typescript
import "./bt-tree-view.js";

// In renderContent(), add before the decision log section:
const btSnapshot = this.store.btTreeState.get(this.agent.name);
// ...
html`<ft-game-bt-tree-view .snapshot=${btSnapshot}></ft-game-bt-tree-view>`
```

Rename the "Decision Log" section heading to "Decision Narrative" for spec consistency.

- [ ] **Step 5: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npm test`

Expected: All pass

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/bt-system.ts" \
       "01 - Projects/Flowti Plugin/src/game/ui/panel-brain.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "feat(bt): emit BTTreeSnapshot on tick, integrate tree view into Brain tab"
```

---

## Chunk 7: Engine Wiring + LLM Auto-Start + Retirement

### Task 7: Wire new components into the engine

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-startup.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-events.ts`

- [ ] **Step 1: Import and render council-sidebar + agent-detail-modal in engine**

In `engine.ts` (the root component that mounts game UI), add:

```typescript
import "./ui/council-sidebar.js";
import "./ui/council-picker.js";
import "./ui/agent-detail-modal.js";
```

Render `<ft-game-council-sidebar>` and `<ft-game-agent-detail-modal>` in the game overlay DOM, passing `.store` and `.eventBus` properties.

Add a `showPicker` boolean state to toggle the council picker. Wire the `"open-picker"` and `"close-picker"` custom events.

- [ ] **Step 2: Auto-start LLM on modal open**

In `engine-events.ts` (or in the modal's `updated()` lifecycle), detect when `store.selectedAgent` changes from null to a name. When this happens, call `getOrStartProcess(agentName)` to spin up the LLM. This follows the existing pattern used in `panel-talk.ts` for sending messages.

- [ ] **Step 3: Council persistence — save/load from localStorage**

In `engine.ts` (or in `DashboardStore` constructor), on startup:

```typescript
const saved = localStorage.getItem("flowti-council");
if (saved) {
	const names = JSON.parse(saved) as string[];
	const valid = names.filter(n => store.agents.some(a => a.name === n));
	store.setCouncil(valid);
}
```

In `DashboardStore`, after any Council mutation (add/remove/set/reorder), persist:
```typescript
localStorage.setItem("flowti-council", JSON.stringify(this.council));
```

- [ ] **Step 4: Run full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npm test`

Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/"
git commit -m "feat(engine): wire Council sidebar + Detail modal, LLM auto-start, Council persistence"
```

---

### Task 8: Retire agent-panel.ts and panel-info.ts

**Files:**
- Delete: `01 - Projects/Flowti Plugin/src/game/ui/agent-panel.ts`
- Delete: `01 - Projects/Flowti Plugin/src/game/ui/panel-info.ts`
- Delete: `01 - Projects/Flowti Plugin/src/game/ui/panel-monitor.ts`
- Modify: any imports that reference these files

- [ ] **Step 1: Remove agent-panel imports from engine**

Search for `import "./agent-panel.js"` or `<ft-game-agent-panel>` references across the Plugin source. Remove them. The `agent-detail-modal` now serves this role.

- [ ] **Step 2: Remove panel-info.ts and panel-monitor.ts imports**

Search for `import "./panel-info.js"` and `import "./panel-monitor.js"`. Remove them. The Profile tab in the modal replaces panel-info. Monitor metrics (if needed) fold into Debug tab.

- [ ] **Step 3: Delete the files**

```bash
rm "01 - Projects/Flowti Plugin/src/game/ui/agent-panel.ts"
rm "01 - Projects/Flowti Plugin/src/game/ui/panel-info.ts"
rm "01 - Projects/Flowti Plugin/src/game/ui/panel-monitor.ts"
```

- [ ] **Step 4: Update or remove tests that reference retired components**

Search `tests/` for `agent-panel`, `panel-info`, `panel-monitor` test files. Delete the test files for retired components. Update any integration tests that referenced them.

- [ ] **Step 5: Run full test suite + type check + build**

```bash
cd "01 - Projects/Flowti Plugin" && npm test
cd "01 - Projects/Flowti Plugin" && npm run build
```

Expected: All pass, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A "01 - Projects/Flowti Plugin/"
git commit -m "refactor(ui): retire agent-panel, panel-info, panel-monitor — replaced by Agent Detail Modal"
```

---

## Chunk 8: Final Verification

### Task 9: End-to-end verification

- [ ] **Step 1: Run full Plugin test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npm test`

Expected: All tests pass

- [ ] **Step 2: Build Plugin**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`

Expected: Build succeeds

- [ ] **Step 3: Run CLI tests (ensure no cross-project breakage)**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts 2>&1 | tail -10`

Expected: All pass

- [ ] **Step 4: Manual smoke test checklist**

- [ ] Council sidebar renders on left edge with 5 slots
- [ ] Empty slots show "+" and open picker
- [ ] Picker shows all agents, allows add/remove
- [ ] Council persists across page reload
- [ ] Clicking Council member opens detail modal (right 60%)
- [ ] Clicking agent in world also opens detail modal
- [ ] Profile tab shows stats, personality, vitals, economy
- [ ] Talk tab allows LLM conversation
- [ ] Brain tab shows BT tree + needs radar + decision narrative
- [ ] Escape closes modal
- [ ] Game world stays visible and interactive behind modal
