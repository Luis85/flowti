# Sidebar & Slide-Panel Redesign — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Unify 7 separate modal/overlay UI components into a sidebar rail + generic slide panel system with Faceset portraits and camera offset.

**Architecture:** A sidebar rail (80px, fixed left, full height) contains 5 council slots and 3 action buttons. A generic slide panel (60% width, slides from right) hosts all content modes (agent-detail, bob, roster, merchant, briefing). `DashboardStore.activePanel` drives which mode is visible. A custom `OffsetFollowStrategy` shifts the camera when the panel opens.

**Tech Stack:** Lit 3 (web components), ExcaliburJS (camera), TypeScript, Vitest

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-23-sidebar-panel-redesign-design.md`

---

## File Structure

### New Files (create)

| File | Responsibility |
|------|---------------|
| `src/game/ui/slide-panel.ts` | Generic slide panel shell (header, body, backdrop, Escape, animation) |
| `src/game/ui/sidebar.ts` | Sidebar rail (council slots, action buttons, panel content orchestration) |
| `src/game/ui/roster-panel.ts` | Merged council management + full agent list with scene navigation |
| `src/game/ui/portrait.ts` | Shared portrait helper (Faceset `<img>` with fallback to text letter) |
| `tests/game/ui/slide-panel.test.ts` | Tests for slide panel |
| `tests/game/ui/sidebar.test.ts` | Tests for sidebar |
| `tests/game/ui/roster-panel.test.ts` | Tests for roster panel |
| `tests/game/ui/portrait.test.ts` | Tests for portrait helper |
| `tests/game/systems/camera-offset.test.ts` | Tests for OffsetFollowStrategy + setPanelOffset |

### Modified Files

| File | Changes |
|------|---------|
| `src/game/store/dashboard-store.ts` | Add `activePanel`, `briefingData`, `setActivePanel()`, modify `selectAgent()`/`deselectAgent()` |
| `src/game/systems/camera-system.ts` | Add `OffsetFollowStrategy`, `setPanelOffset()`, offset-aware `startFollow()` + `onSceneActivate()` |
| `src/game/engine.ts` | Replace 7 component creations with single sidebar; wire `panel-changed` → camera offset |
| `src/game/engine-lifecycle.ts` | Briefing uses `store.briefingData` + `store.setActivePanel('briefing')` |
| `src/game/engine-events.ts` | Merchant stall click routes through `store.setActivePanel('merchant')` instead of DOM-creating panel |
| `src/game/ui/agent-detail-modal.ts` | Extract content rendering into exportable function; remove shell/backdrop/Escape |
| `src/game/ui/ask-bob.ts` | Extract content rendering; remove launcher button and shell |
| `src/game/ui/merchant-panel.ts` | Extract content rendering; remove overlay/backdrop |
| `src/game/ui/briefing-panel.ts` | Extract content rendering; remove overlay/backdrop; dismiss calls `store.setActivePanel(null)` |

### Retired Files (delete after migration)

| File | Replaced by |
|------|------------|
| `src/game/ui/council-sidebar.ts` | `sidebar.ts` |
| `src/game/ui/council-picker.ts` | `roster-panel.ts` |
| `src/game/ui/roster-bar.ts` | `roster-panel.ts` |
| `tests/game/ui/council-sidebar.test.ts` | `sidebar.test.ts` |
| `tests/game/ui/council-picker.test.ts` | `roster-panel.test.ts` |
| `tests/game/ui/roster-bar.test.ts` | (covered by `roster-panel.test.ts`) |

---

## Chunk 1: Store + Camera Foundation

### Task 1: Add `activePanel` and `setActivePanel()` to DashboardStore

**Files:**
- Modify: `src/game/store/dashboard-store.ts:76-100` (properties), `:345-370` (selectAgent/deselectAgent)
- Test: `tests/game/store/dashboard-store.test.ts`

- [ ] **Step 1: Write failing tests for `setActivePanel()`**

In `tests/game/store/dashboard-store.test.ts`, add a new `describe("activePanel")` block:

```typescript
describe("activePanel", () => {
	it("defaults to null", () => {
		expect(store.activePanel).toBeNull();
	});

	it("setActivePanel sets the mode and emits state-changed", () => {
		const spy = vi.fn();
		store.addEventListener("state-changed", spy);
		store.setActivePanel("bob");
		expect(store.activePanel).toBe("bob");
		expect(spy).toHaveBeenCalledOnce();
	});

	it("emits panel-changed on open (null → non-null)", () => {
		const spy = vi.fn();
		store.addEventListener("panel-changed", spy);
		store.setActivePanel("bob");
		expect(spy).toHaveBeenCalledOnce();
		expect(spy.mock.calls[0][0].detail).toEqual({ activePanel: "bob" });
	});

	it("emits panel-changed on close (non-null → null)", () => {
		store.setActivePanel("bob");
		const spy = vi.fn();
		store.addEventListener("panel-changed", spy);
		store.setActivePanel(null);
		expect(spy).toHaveBeenCalledOnce();
	});

	it("does NOT emit panel-changed on swap (non-null → non-null)", () => {
		store.setActivePanel("bob");
		const spy = vi.fn();
		store.addEventListener("panel-changed", spy);
		store.setActivePanel("merchant");
		expect(spy).not.toHaveBeenCalled();
		expect(store.activePanel).toBe("merchant");
	});

	it("panel-changed fires before state-changed", () => {
		const order: string[] = [];
		store.addEventListener("panel-changed", () => order.push("panel"));
		store.addEventListener("state-changed", () => order.push("state"));
		store.setActivePanel("bob");
		expect(order).toEqual(["panel", "state"]);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/store/dashboard-store.test.ts`
Expected: FAIL — `activePanel` and `setActivePanel` do not exist

- [ ] **Step 3: Implement `activePanel` + `setActivePanel()` in dashboard-store.ts**

Add the `PanelMode` type near the top of the file (after existing type imports):

```typescript
export type PanelMode = "agent-detail" | "bob" | "roster" | "merchant" | "briefing";
```

Add the `OfflineResults` import near the top of the file:

```typescript
import type { OfflineResults } from "../systems/offline-progress.js";
```

Add properties to the class (near line 84, after `selectedTab`):

```typescript
activePanel: PanelMode | null = null;
briefingData: { results: OfflineResults; narrativeText: string } | null = null;
```

Add method (after `selectTab()` around line 390):

```typescript
setActivePanel(mode: PanelMode | null): void {
	const wasOpen = this.activePanel !== null;
	const isOpen = mode !== null;
	this.activePanel = mode;
	if (wasOpen !== isOpen) {
		this.dispatchEvent(new CustomEvent("panel-changed", { detail: { activePanel: mode } }));
	}
	this.notify();
}
```

Note: `notify()` dispatches `"state-changed"` — this preserves the event ordering (panel-changed before state-changed).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/store/dashboard-store.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts" "01 - Projects/Flowti Plugin/tests/game/store/dashboard-store.test.ts"
git commit -m "feat(store): add activePanel state and setActivePanel method"
```

---

### Task 2: Modify `selectAgent()` and `deselectAgent()` to drive `activePanel`

**Files:**
- Modify: `src/game/store/dashboard-store.ts:345-370`
- Test: `tests/game/store/dashboard-store.test.ts`

- [ ] **Step 1: Write failing tests**

Add to the `describe("activePanel")` block:

```typescript
it("selectAgent sets activePanel to agent-detail", () => {
	store.selectAgent("Alice");
	expect(store.activePanel).toBe("agent-detail");
});

it("selectAgent(null) clears activePanel when showing agent-detail", () => {
	store.selectAgent("Alice");
	expect(store.activePanel).toBe("agent-detail");
	store.selectAgent(null);
	expect(store.activePanel).toBeNull();
});

it("selectAgent(null) does NOT clear activePanel when showing bob", () => {
	store.setActivePanel("bob");
	store.selectAgent(null);
	expect(store.activePanel).toBe("bob");
});

it("deselectAgent clears activePanel when showing agent-detail", () => {
	store.selectAgent("Alice");
	store.deselectAgent("Alice");
	expect(store.activePanel).toBeNull();
});
```

- [ ] **Step 2: Run tests — expect fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/store/dashboard-store.test.ts -t "activePanel"`
Expected: FAIL — selectAgent does not set activePanel

- [ ] **Step 3: Modify `selectAgent()` and `deselectAgent()`**

In `selectAgent()` (around line 345), add **before** the existing `this.notify()` call, and guard the existing `this.notify()` to avoid double-emit:

```typescript
// Before the existing this.notify():
const panelChanged = name
	? this.activePanel !== "agent-detail"
	: this.activePanel === "agent-detail";

if (name) {
	this.activePanel = "agent-detail";
} else if (this.activePanel === "agent-detail") {
	this.activePanel = null;
}

// Emit panel-changed if open/close transition occurred
if (panelChanged) {
	const wasOpen = !name && this.activePanel === null;  // closing
	const isOpen = !!name;  // opening
	if (wasOpen !== isOpen) {
		this.dispatchEvent(new CustomEvent("panel-changed", { detail: { activePanel: this.activePanel } }));
	}
}
// Keep the EXISTING this.notify() — it fires state-changed once, after panel-changed
```

**Do NOT call `this.setActivePanel()` from inside `selectAgent()`** — that would double-fire `state-changed` (once from `setActivePanel.notify()`, once from `selectAgent.notify()`). Instead, mutate `activePanel` directly and emit `panel-changed` manually, then let the existing `this.notify()` handle `state-changed`.

In `deselectAgent()` (around line 361), add **before** the existing `this.notify()`:

```typescript
if (this.activePanel === "agent-detail") {
	this.activePanel = null;
	this.dispatchEvent(new CustomEvent("panel-changed", { detail: { activePanel: null } }));
}
// Keep existing this.notify() — fires state-changed once
```

Same pattern: mutate + emit `panel-changed` directly, don't call `setActivePanel()`.

- [ ] **Step 4: Run tests — expect pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/store/dashboard-store.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts" "01 - Projects/Flowti Plugin/tests/game/store/dashboard-store.test.ts"
git commit -m "feat(store): selectAgent and deselectAgent drive activePanel state"
```

---

### Task 3: Add `OffsetFollowStrategy` and `setPanelOffset()` to camera-system

**Files:**
- Modify: `src/game/systems/camera-system.ts:18-30` (interface), `:49-55` (startFollow)
- Create: `tests/game/systems/camera-offset.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/game/systems/camera-offset.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

// Mock excalibur
vi.mock("excalibur", () => {
	class Vector { constructor(public x: number, public y: number) {} }
	class Actor { center = new Vector(100, 200); pos = new Vector(100, 200); }
	class Camera {
		strategies: unknown[] = [];
		clearAllStrategies() { this.strategies = []; }
		addStrategy(s: unknown) { this.strategies.push(s); }
		pos = new Vector(0, 0);
	}
	class LockCameraToActorStrategy {
		constructor(public target: unknown) {}
	}
	return { Vector, Actor, Camera, LockCameraToActorStrategy };
});

import { createCameraSystem } from "../../../src/game/systems/camera-system.js";

describe("camera panel offset", () => {
	it("setPanelOffset stores the offset value", () => {
		const sys = createCameraSystem(/* mock camera/engine args */);
		sys.setPanelOffset(200);
		// Verify via startFollow — the strategy should use the offset
	});

	it("startFollow uses OffsetFollowStrategy when panelOffset > 0", () => {
		const sys = createCameraSystem(/* mock */);
		sys.setPanelOffset(200);
		const actor = { center: { x: 100, y: 200 }, pos: { x: 100, y: 200 } };
		sys.startFollow(actor as never);
		expect(sys.isFollowing()).toBe(true);
		// The followed position should be offset
	});

	it("startFollow uses LockCameraToActorStrategy when panelOffset is 0", () => {
		const sys = createCameraSystem(/* mock */);
		sys.setPanelOffset(0);
		const actor = { center: { x: 100, y: 200 }, pos: { x: 100, y: 200 } };
		sys.startFollow(actor as never);
		expect(sys.isFollowing()).toBe(true);
	});

	it("setPanelOffset re-applies strategy on currently followed actor", () => {
		const sys = createCameraSystem(/* mock */);
		const actor = { center: { x: 100, y: 200 }, pos: { x: 100, y: 200 } };
		sys.startFollow(actor as never);
		sys.setPanelOffset(200);
		// Strategy should have been swapped
		expect(sys.isFollowing()).toBe(true);
	});
});
```

Note: The exact mock setup depends on `createCameraSystem`'s constructor args. Read the factory function signature and adapt. The tests above show the intent — the implementor must match the actual API.

- [ ] **Step 2: Run tests — expect fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/camera-offset.test.ts`
Expected: FAIL — `setPanelOffset` does not exist

- [ ] **Step 3: Implement OffsetFollowStrategy and setPanelOffset**

In `camera-system.ts`, add the strategy class before `createCameraSystem`:

```typescript
class OffsetFollowStrategy implements ex.CameraStrategy<ex.Actor> {
	constructor(public target: ex.Actor, public offset: number) {}
	action = (target: ex.Actor, _cam: ex.Camera, _eng: ex.Engine, _elapsed: number): ex.Vector => {
		const center = target.center;
		return new ex.Vector(center.x - this.offset, center.y);
	};
}
```

Add to the `CameraSystem` interface:

```typescript
setPanelOffset(offset: number): void;
```

Inside `createCameraSystem()`, add closure state:

```typescript
let panelOffset = 0;
let followedActor: AgentActor | null = null;
```

Add the method:

```typescript
function setPanelOffset(offset: number): void {
	panelOffset = offset;
	if (followedActor) {
		// Re-apply strategy with new offset
		camera.clearAllStrategies();
		if (offset > 0) {
			camera.addStrategy(new OffsetFollowStrategy(followedActor, offset));
		} else {
			camera.addStrategy(new ex.LockCameraToActorStrategy(followedActor));
		}
	}
}
```

Modify `startFollow(actor)` to be offset-aware:

```typescript
function startFollow(actor: AgentActor): void {
	followedActor = actor;
	camera.clearAllStrategies();
	if (panelOffset > 0) {
		camera.addStrategy(new OffsetFollowStrategy(actor, panelOffset));
	} else {
		camera.addStrategy(new ex.LockCameraToActorStrategy(actor));
	}
}
```

Modify `stopFollow()` to clear `followedActor`:

```typescript
function stopFollow(): void {
	followedActor = null;
	camera.clearAllStrategies();
	resetToCenter();
}
```

Modify `onSceneActivate(findActor, sceneCamera)` (around line 70) to be offset-aware — when it re-follows an actor after a scene change, it must use `OffsetFollowStrategy` if `panelOffset > 0`:

```typescript
function onSceneActivate(findActor: ..., sceneCamera: ex.Camera): void {
	camera = sceneCamera;
	if (followedName) {
		const actor = findActor(followedName);
		if (actor) {
			startFollow(actor);  // startFollow is already offset-aware
		}
	}
}
```

The key insight: `onSceneActivate` should delegate to `startFollow()` which already handles the offset, rather than directly calling `camera.addStrategy(new ex.LockCameraToActorStrategy(...))`.

Return `setPanelOffset` from the factory.

- [ ] **Step 4: Run tests — expect pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/camera-offset.test.ts`
Expected: PASS

- [ ] **Step 5: Run full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: ALL PASS (no regressions in existing camera tests)

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/camera-system.ts" "01 - Projects/Flowti Plugin/tests/game/systems/camera-offset.test.ts"
git commit -m "feat(camera): add OffsetFollowStrategy and setPanelOffset for panel-aware follow"
```

---

## Chunk 2: Generic Slide Panel + Portrait Helper

### Task 4: Create portrait helper

**Files:**
- Create: `src/game/ui/portrait.ts`
- Create: `tests/game/ui/portrait.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/game/ui/portrait.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { portraitSrc, fallbackInitial } from "../../../src/game/ui/portrait.js";

describe("portraitSrc", () => {
	it("returns Faceset path for a known character", () => {
		const src = portraitSrc("NinjaBlue");
		expect(src).toBe("assets/Actor/Characters/NinjaBlue/Faceset.png");
	});
});

describe("fallbackInitial", () => {
	it("returns first character of name uppercased", () => {
		expect(fallbackInitial("alice")).toBe("A");
		expect(fallbackInitial("Bob")).toBe("B");
	});
});
```

- [ ] **Step 2: Run test — expect fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/portrait.test.ts`
Expected: FAIL — module does not exist

- [ ] **Step 3: Implement portrait.ts**

Create `src/game/ui/portrait.ts`:

```typescript
import { html, nothing } from "lit";
import { resolveCharacter } from "../sprites/character-pool.js";
import { TRUST_TIER_COLORS } from "./game-ui-constants.js";

export function portraitSrc(characterName: string): string {
	return `assets/Actor/Characters/${characterName}/Faceset.png`;
}

export function fallbackInitial(name: string): string {
	return (name ?? "?").charAt(0).toUpperCase();
}

/**
 * Renders a portrait <img> with text-letter fallback.
 * @param agentName - agent name for character resolution
 * @param domain - agent domain for character pool lookup
 * @param size - pixel size (rendered as circle)
 * @param trustTier - optional trust tier for border color
 */
export function renderPortrait(
	agentName: string,
	domain: string,
	size: number,
	trustTier?: string,
) {
	const character = resolveCharacter(agentName, domain);
	const src = portraitSrc(character);
	const borderColor = trustTier
		? TRUST_TIER_COLORS[trustTier as keyof typeof TRUST_TIER_COLORS] ?? "var(--border)"
		: "var(--border)";

	const imgStyle = `
		width: ${size}px; height: ${size}px;
		border-radius: 50%; object-fit: cover;
		border: 2px solid ${borderColor};
		image-rendering: pixelated;
	`;
	const fallbackStyle = `
		display: none; width: ${size}px; height: ${size}px;
		border-radius: 50%; border: 2px solid ${borderColor};
		background: var(--bg-tertiary);
		color: var(--text-primary); font-size: ${Math.round(size * 0.45)}px;
		line-height: ${size}px; text-align: center;
	`;

	return html`
		<img
			class="portrait-img"
			src=${src}
			alt=${agentName}
			style=${imgStyle}
			@error=${(e: Event) => {
				const img = e.target as HTMLImageElement;
				img.style.display = "none";
				const fallback = img.nextElementSibling as HTMLElement;
				if (fallback) fallback.style.display = "block";
			}}
		/>
		<div class="portrait-fallback" style=${fallbackStyle}>
			${fallbackInitial(agentName)}
		</div>
	`;
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/portrait.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/ui/portrait.ts" "01 - Projects/Flowti Plugin/tests/game/ui/portrait.test.ts"
git commit -m "feat(ui): add portrait helper with Faceset image and text fallback"
```

---

### Task 5: Create `ft-game-slide-panel` component

**Files:**
- Create: `src/game/ui/slide-panel.ts`
- Create: `tests/game/ui/slide-panel.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/game/ui/slide-panel.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("lit", async () => {
	const actual = await vi.importActual<typeof import("lit")>("lit");
	return actual;
});

describe("SlidePanel", () => {
	it("is not visible when open is false", () => {
		// Verify :host(:not([open])) hides the panel
	});

	it("renders header with title and close button", () => {
		// Verify .panel-title text content matches title prop
	});

	it("dispatches panel-close event on close button click", () => {
		// Verify CustomEvent "panel-close" is dispatched
	});

	it("dispatches panel-close on backdrop click", () => {
		// Verify clicking .panel-backdrop fires "panel-close"
	});

	it("dispatches panel-close on Escape key", () => {
		// Verify keydown Escape fires "panel-close"
	});

	it("renders slotted content in .panel-body", () => {
		// Verify <slot> exists inside .panel-body
	});
});
```

Note: Exact test implementation depends on how the test harness mocks Lit/custom elements. The implementor should follow existing patterns from `tests/game/ui/council-sidebar.test.ts` for mocking Lit components.

- [ ] **Step 2: Run test — expect fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/slide-panel.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement slide-panel.ts**

Create `src/game/ui/slide-panel.ts`:

**Important:** All new components must extend `FlowtiElement` (not `LitElement`) and use the guard registration pattern (not `@customElement` decorator) to avoid duplicate-registration errors during Obsidian plugin reloads. Use the static `properties` object pattern (not `@property` decorators) to match existing codebase conventions.

```typescript
import { html, css, nothing } from "lit";
import { FlowtiElement } from "../../components/flowti-element.js";
import { resetStyles, colorStyles, fontStyles, buttonStyles } from "./game-styles.js";

export class SlidePanel extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		open: { type: Boolean, reflect: true },
		title: { type: String },
	};

	static styles = [
		...FlowtiElement.styles,
		resetStyles, colorStyles, fontStyles, buttonStyles,
		css`
			:host {
				display: none;
				position: fixed;
				inset: 0;
				z-index: 140;
			}
			:host([open]) {
				display: block;
			}
			.panel-backdrop {
				position: absolute;
				inset: 0;
				background: rgba(0, 0, 0, 0.4);
				z-index: 140;
			}
			.panel {
				position: absolute;
				top: 0;
				right: 0;
				bottom: 0;
				width: 60%;
				z-index: 150;
				background: var(--bg-panel);
				box-shadow: var(--panel-shadow);
				display: flex;
				flex-direction: column;
				animation: slide-in 200ms ease-out;
			}
			@keyframes slide-in {
				from { transform: translateX(100%); }
				to { transform: translateX(0); }
			}
			.panel-header {
				display: flex;
				align-items: center;
				justify-content: space-between;
				padding: 12px 16px;
				border-bottom: 1px solid var(--border);
				flex-shrink: 0;
			}
			.panel-title {
				font-size: 14px;
				font-weight: 600;
				color: var(--text-primary);
				letter-spacing: 0.04em;
			}
			.close-btn {
				background: none;
				border: none;
				color: var(--text-secondary);
				font-size: 18px;
				cursor: pointer;
				padding: 4px 8px;
				border-radius: 4px;
			}
			.close-btn:hover {
				color: var(--text-primary);
				background: var(--bg-tertiary);
			}
			.panel-body {
				flex: 1;
				overflow-y: auto;
				scrollbar-width: thin;
				scrollbar-color: var(--accent-gold) transparent;
			}
		`,
	];

	open = false;
	title = "";

	private keyHandler = (e: KeyboardEvent) => {
		if (e.key === "Escape" && this.open) {
			this.dispatchEvent(new Event("panel-close", { bubbles: true, composed: true }));
		}
	};

	connectedCallback(): void {
		super.connectedCallback();
		document.addEventListener("keydown", this.keyHandler);
	}

	disconnectedCallback(): void {
		super.disconnectedCallback();
		document.removeEventListener("keydown", this.keyHandler);
	}

	private handleClose(): void {
		this.dispatchEvent(new Event("panel-close", { bubbles: true, composed: true }));
	}

	private handleBackdropClick(): void {
		this.dispatchEvent(new Event("panel-close", { bubbles: true, composed: true }));
	}

	render() {
		if (!this.open) return nothing;
		return html`
			<div class="panel-backdrop" @click=${this.handleBackdropClick}></div>
			<div class="panel">
				<div class="panel-header">
					<span class="panel-title">${this.title}</span>
					<button class="close-btn" @click=${this.handleClose}>\u00d7</button>
				</div>
				<div class="panel-body">
					<slot></slot>
				</div>
			</div>
		`;
	}
}

// Guard registration for Obsidian plugin reload safety
if (!customElements.get("ft-game-slide-panel")) {
	customElements.define("ft-game-slide-panel", SlidePanel);
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/slide-panel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/ui/slide-panel.ts" "01 - Projects/Flowti Plugin/tests/game/ui/slide-panel.test.ts"
git commit -m "feat(ui): add generic ft-game-slide-panel component"
```

---

## Chunk 3: Roster Panel + Content Extraction

### Task 6: Create `ft-game-roster-panel` component

> **Moved before sidebar** because the sidebar renders `<ft-game-roster-panel>` as one of its content modes.

**Files:**
- Create: `src/game/ui/roster-panel.ts`
- Create: `tests/game/ui/roster-panel.test.ts`

- [ ] **Step 1: Write failing tests**

Test in `tests/game/ui/roster-panel.test.ts`:
- Council zone renders 5 slots (filled/empty)
- Drag-reorder between council slots calls `store.reorderCouncil()`
- "All Agents" section groups agents by domain
- Click agent row calls `store.changeScene()` + `store.selectAgent()`
- Add-to-council button on agent row calls `store.addToCouncil()`
- Remove button on council slot calls `store.removeFromCouncil()`
- Search/filter input filters agent list
- Faceset portraits render via `renderPortrait()`

- [ ] **Step 2: Run test — expect fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/roster-panel.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement roster-panel.ts**

Create `src/game/ui/roster-panel.ts`. Merges logic from:
- `council-picker.ts` — council zone with drag-reorder (lines 280-308, 406-425)
- `roster-bar.ts` — agent list grouped by domain with `resolveSettingForDomain()` + `changeScene()` (lines 125-149)

Key differences from the originals:
- Layout is **vertical** (council zone on top, agent list below), not a centered card
- Agent list uses `renderPortrait()` for Faceset images
- Click agent row → `store.changeScene(resolveSettingForDomain(agent.domain))` + `store.selectAgent(name)` (scene switch + detail panel)
- Search input filters by agent name or domain
- Uses `StoreController` for reactive updates

Use the same patterns as SlidePanel: extend `FlowtiElement`, static `properties`, guard registration.

```typescript
export class RosterPanel extends FlowtiElement {
	static properties = {
		...FlowtiElement.properties,
		store: { attribute: false },
		searchQuery: { state: true },
		dragSourceIndex: { state: true },
	};

	store!: DashboardStore;
	private searchQuery = "";
	private dragSourceIndex = -1;
	private storeCtrl = new StoreController(this, () => this.store);

	// ... council zone rendering (from council-picker.ts)
	// ... agent list rendering grouped by domain
	// ... drag handlers (from council-picker.ts)
	// ... search filter logic
}

if (!customElements.get("ft-game-roster-panel")) {
	customElements.define("ft-game-roster-panel", RosterPanel);
}
```

- [ ] **Step 4: Run test — expect pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/roster-panel.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/ui/roster-panel.ts" "01 - Projects/Flowti Plugin/tests/game/ui/roster-panel.test.ts"
git commit -m "feat(ui): add ft-game-roster-panel with council management and agent list"
```

---

### Task 7: Extract content renderers from existing components

**Files:**
- Modify: `src/game/ui/agent-detail-modal.ts` — export `renderAgentDetailContent(store, agent)` function
- Modify: `src/game/ui/ask-bob.ts` — export `renderBobContent(store, eventBus?, getPerfDashboard?)` function
- Modify: `src/game/ui/merchant-panel.ts` — export `renderMerchantContent(store)` function
- Modify: `src/game/ui/briefing-panel.ts` — export `renderBriefingContent(store)` function

- [ ] **Step 1: Extract agent-detail content renderer**

In `agent-detail-modal.ts`, the `renderContent()` method (line ~627) contains the full modal shell (backdrop + panel + header + tabs + content). Extract the **inner content** (everything inside `.modal-panel`) into an exported function:

```typescript
export function renderAgentDetailContent(
	store: DashboardStore,
	agent: DashboardAgent,
): TemplateResult {
	// Contains: .modal-header (portrait, name, badges, trust)
	//           .tab-bar (6 tabs)
	//           .tab-content (switch on selectedTab)
	// Does NOT contain: backdrop, .modal-panel positioning, Escape handler, slide animation
}
```

The existing `AgentDetailModal` class stays for now (removed in Task 11). The exported function is what the sidebar uses.

**Important:** The current `handleClose()` in `agent-detail-modal.ts` (line ~489) calls `store.stopFollow()` before `store.selectAgent(null)`. In the new architecture, closing the panel happens via the slide panel's close/backdrop/Escape → `store.setActivePanel(null)`. The sidebar's `panel-close` handler must also call `store.stopFollow()` when closing the agent-detail panel to preserve the camera-unfollow behavior.

- [ ] **Step 2: Extract Bob content renderer**

In `ask-bob.ts`, extract the chat panel content (everything inside `.chat-overlay`) into an exported function:

```typescript
export function renderBobContent(
	store: DashboardStore,
	eventBus?: IEventBus,
	getPerfDashboard?: () => IAgentWorldPerfDashboard | undefined,
): TemplateResult {
	// Contains: .tab-row (Overview, Chat, Agent, Systems, Debug)
	//           tab content rendering
	//           conversation display + input
	// Does NOT contain: .bob-btn launcher, .chat-overlay positioning, z-index
}
```

- [ ] **Step 3: Extract merchant content renderer**

In `merchant-panel.ts`, extract content (everything inside `.merchant-panel`) into an exported function:

```typescript
export function renderMerchantContent(store: DashboardStore): TemplateResult {
	// Contains: agent-selector, category-tabs, item-list, footer
	// Does NOT contain: .overlay backdrop, fixed positioning
}
```

- [ ] **Step 4: Extract briefing content renderer**

In `briefing-panel.ts`, extract content (everything inside `.card`) into an exported function. The auto-dismiss timer logic moves into the function or a companion Lit directive:

```typescript
export function renderBriefingContent(store: DashboardStore): TemplateResult {
	// Contains: header, headlines, stats, commentary, rest-notice, narrative, dismiss button
	// Dismiss button calls store.setActivePanel(null) + store.briefingData = null
	// Auto-dismiss timer is managed by the sidebar (or a reactive controller)
}
```

- [ ] **Step 5: Run full test suite to ensure no regressions**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: ALL PASS — existing components still work, new exports are additive

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/ui/agent-detail-modal.ts" \
  "01 - Projects/Flowti Plugin/src/game/ui/ask-bob.ts" \
  "01 - Projects/Flowti Plugin/src/game/ui/merchant-panel.ts" \
  "01 - Projects/Flowti Plugin/src/game/ui/briefing-panel.ts"
git commit -m "refactor(ui): extract content renderers from modal/overlay components"
```

---

## Chunk 4: Sidebar + Engine Wiring

### Task 8: Create `ft-game-sidebar` component

**Files:**
- Create: `src/game/ui/sidebar.ts`
- Create: `tests/game/ui/sidebar.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/game/ui/sidebar.test.ts`. Test:
- Council slots render 5 slots (filled with portrait or empty with "+")
- Bob/Roster/Merchant buttons render
- Click council slot calls `store.selectAgent(name)`
- Click Bob button calls `store.setActivePanel("bob")`
- Click active Bob button calls `store.setActivePanel(null)` (toggle)
- Active button has highlight bar styling
- Panel content swaps based on `store.activePanel`
- Panel-close handler calls `store.setActivePanel(null)` and `store.stopFollow()` when closing agent-detail

Follow existing test patterns from `tests/game/ui/council-sidebar.test.ts`.

- [ ] **Step 2: Run test — expect fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/sidebar.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement sidebar.ts**

Create `src/game/ui/sidebar.ts`. The component:

1. **Extends FlowtiElement** (from `src/components/flowti-element.ts`), guard registration pattern
2. **Uses StoreController** for reactive store subscription
3. **Properties** (static `properties` object): `store: DashboardStore`, `eventBus?: IEventBus`, `getPerfDashboard?: () => IAgentWorldPerfDashboard | undefined`
4. **Renders** council slots (top) + spacer + 3 action buttons (bottom)
5. **Uses `renderPortrait()`** from `portrait.ts` for council slot images
6. **Internally renders `ft-game-slide-panel`** with the appropriate content based on `store.activePanel`
7. **Content rendering** uses a switch on `store.activePanel`:
   - `"agent-detail"` → renders agent detail content (extracted from `agent-detail-modal.ts`)
   - `"bob"` → renders Bob content (extracted from `ask-bob.ts`), passes `eventBus`/`getPerfDashboard`
   - `"roster"` → renders `<ft-game-roster-panel>` (from Task 6)
   - `"merchant"` → renders merchant content (extracted from `merchant-panel.ts`)
   - `"briefing"` → renders briefing content (extracted from `briefing-panel.ts`)

Key CSS:
```css
:host {
	position: fixed;
	left: 0; top: 0; bottom: 0;
	width: 80px;
	z-index: 90;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 12px 0;
	background: var(--bg-primary);
	border-right: 1px solid var(--border);
}
.spacer { flex: 1; }
.action-btn {
	width: 48px; height: 48px;
	border-radius: 8px; cursor: pointer;
	margin-bottom: 8px;
}
.action-btn[data-active] {
	border-left: 3px solid var(--accent-gold);
}
```

The `panel-close` event handler:
- If `store.activePanel === "agent-detail"`, call `store.stopFollow()` first (preserves camera-unfollow behavior from old `handleClose`)
- Then call `store.setActivePanel(null)`

- [ ] **Step 4: Run test — expect pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ui/sidebar.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/ui/sidebar.ts" "01 - Projects/Flowti Plugin/tests/game/ui/sidebar.test.ts"
git commit -m "feat(ui): add ft-game-sidebar with council slots, action buttons, and panel orchestration"
```

---

### Task 9: Wire engine — sidebar replaces all components, camera offset

**Files:**
- Modify: `src/game/engine.ts:155-191` (component creation)
- Modify: `src/game/engine-lifecycle.ts:309-349` (briefing)
- Modify: `src/game/engine-events.ts:571-613` (merchant stall click)

- [ ] **Step 1: Update engine.ts component wiring**

Replace lines 155-191 (the for-loop creating overlays/roster-bar/camera-hud/ask-bob, plus council-sidebar, detail-modal, and picker event handlers) with:

```typescript
// Import sidebar (side-effect registers ft-game-sidebar, ft-game-slide-panel, ft-game-roster-panel)
import "./ui/sidebar.js";

// Create sidebar — single component replaces all 7 UI components
const sidebar = document.createElement("ft-game-sidebar") as HTMLElement & {
	store: DashboardStore;
	eventBus?: IEventBus;
	getPerfDashboard?: () => IAgentWorldPerfDashboard | undefined;
};
sidebar.store = store;
if (deps.eventBus) sidebar.eventBus = deps.eventBus;
if (deps.getPerfDashboard) sidebar.getPerfDashboard = deps.getPerfDashboard;
container.appendChild(sidebar);
```

Keep `ft-game-overlays` and `ft-game-camera-hud` — those are not part of this redesign.

Remove the `ft-game-roster-bar` from the component loop.

Remove the council-picker `open-picker`/`close-picker` event listeners.

Remove the `ft-game-agent-detail-modal` creation.

- [ ] **Step 2: Wire camera offset**

In `engine.ts`, after creating the sidebar, subscribe to `panel-changed`:

```typescript
store.addEventListener("panel-changed", () => {
	const panelOpen = store.activePanel !== null;
	const offset = panelOpen ? ENGINE_WIDTH / 2 * 0.5 : 0;  // ENGINE_WIDTH from engine-config.ts (800)
	cameraSystem.setPanelOffset(offset);
});
```

- [ ] **Step 3: Update engine-lifecycle.ts briefing**

In `engine-lifecycle.ts`, replace lines 326-336 (dynamic import + DOM creation of `ft-game-briefing`) with:

```typescript
store.briefingData = { results, narrativeText };
store.setActivePanel("briefing");
```

Remove the `await import("./ui/briefing-panel.js")` side-effect import.
Remove the `briefing-dismissed` event listener (dismiss is now handled by the content renderer calling `store.setActivePanel(null)`).

- [ ] **Step 4: Update engine-events.ts merchant wiring**

In `engine-events.ts`, the `wireMerchantStallClick` function (around line 571-613) dynamically creates `ft-game-merchant-panel` and appends it to the container. Replace this with routing through the store:

```typescript
// Before: creates DOM element directly
// After:
store.setActivePanel("merchant");
```

Remove the `merchant-close` event listener (line ~592) — close is now handled by the slide panel.
Remove the `import "./ui/merchant-panel.js"` side-effect import if present.

- [ ] **Step 5: Remove old side-effect imports from engine.ts**

Remove these imports (lines 96-104 in engine.ts):
```typescript
// Remove:
import "./ui/ask-bob.js";
import "./ui/roster-bar.js";
import "./ui/council-sidebar.js";
import "./ui/council-picker.js";
import "./ui/agent-detail-modal.js";
import "./ui/merchant-panel.js";
import "./ui/briefing-panel.js";
```

Add:
```typescript
import "./ui/sidebar.js";
```

- [ ] **Step 6: Verify wireCouncilAutoWake compatibility**

Check `engine-events.ts` `wireCouncilAutoWake` (around line 617) — it subscribes to `state-changed` and checks `store.selectedAgent`. Verify it still works correctly with the new `activePanel` flow. The agent-detail panel now opens via `activePanel` state, and `selectedAgent` is still set by `selectAgent()`, so the wake handler should work unchanged. Add a note if it needs adjustment.

- [ ] **Step 7: Run full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine.ts" "01 - Projects/Flowti Plugin/src/game/engine-lifecycle.ts" "01 - Projects/Flowti Plugin/src/game/engine-events.ts"
git commit -m "feat(engine): wire sidebar as single UI entry point, add camera panel offset"
```

---

## Chunk 5: Retire Old Components + Final Tests

### Task 10: Delete retired components and their tests

**Files:**
- Delete: `src/game/ui/council-sidebar.ts`
- Delete: `src/game/ui/council-picker.ts`
- Delete: `src/game/ui/roster-bar.ts`
- Delete: `tests/game/ui/council-sidebar.test.ts`
- Delete: `tests/game/ui/council-picker.test.ts`
- Delete: `tests/game/ui/roster-bar.test.ts`

Note: `agent-detail-modal.ts`, `ask-bob.ts`, `merchant-panel.ts`, and `briefing-panel.ts` are NOT deleted — they still contain the content renderer exports. Their old custom element registrations (`@customElement(...)`) should be removed since those tags are no longer used. The files become pure render-function libraries.

- [ ] **Step 1: Remove `@customElement` decorators from extracted components**

In each file, remove the `@customElement("ft-game-...")` decorator and the class export (keep only the exported render function). Or alternatively, keep the class but remove the `@customElement` so the tag is not registered.

- [ ] **Step 2: Delete retired files**

```bash
cd "01 - Projects/Flowti Plugin"
rm src/game/ui/council-sidebar.ts
rm src/game/ui/council-picker.ts
rm src/game/ui/roster-bar.ts
rm tests/game/ui/council-sidebar.test.ts
rm tests/game/ui/council-picker.test.ts
rm tests/game/ui/roster-bar.test.ts
```

- [ ] **Step 3: Run full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: ALL PASS — no imports of deleted files remain

If any test imports the deleted files, update those imports to point to the new components.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/ui/" "01 - Projects/Flowti Plugin/tests/game/ui/"
git commit -m "refactor(ui): retire council-sidebar, council-picker, roster-bar — replaced by sidebar + roster-panel"
```

---

### Task 11: Final verification and cleanup

- [ ] **Step 1: Run full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: ALL PASS

- [ ] **Step 2: Run type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Run lint**

Run: `cd "01 - Projects/Flowti Plugin" && npx eslint src/ --config configs/eslint.config.mjs`
Expected: No errors

- [ ] **Step 4: Build**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`
Expected: Build succeeds

- [ ] **Step 5: Review for any remaining references to old component tags**

Search for `ft-game-council-sidebar`, `ft-game-council-picker`, `ft-game-roster-bar`, `ft-game-agent-detail-modal`, `ft-game-merchant-panel`, `ft-game-ask-bob`, `ft-game-briefing` in all source files. Remove any stale references.

- [ ] **Step 6: Final commit if any cleanup was needed**

```bash
git add "01 - Projects/Flowti Plugin/src/game/ui/" "01 - Projects/Flowti Plugin/tests/game/ui/"
git commit -m "chore(ui): final cleanup — remove stale references to retired components"
```
