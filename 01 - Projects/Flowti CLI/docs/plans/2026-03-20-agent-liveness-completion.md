# Agent Liveness Completion — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining 30% of the agent liveness system — attribute-driven individuality, behavior thresholds, cursor spirit, context signals, cluster huddles, engagement context, task acknowledgment, and missing tests.

**Architecture:** Modify existing NeedsSystem and DirectorSystem to implement attribute modifiers, behavior thresholds, and cursor tracking. Add CursorSpirit actor for visual presence. Wire cluster callbacks to huddle conversations. Expand engagement template interpolation with workspace context. Wire task completion events.

**Tech Stack:** TypeScript, Lit, ExcaliburJS (ex.*), vitest

---

## File Structure

### Modified Files

| File | Changes |
|------|---------|
| `src/game/systems/needs-system.ts` | Attribute modifiers on decay rates, behavior threshold checks |
| `src/game/systems/director-system.ts` | Cursor world position tracking, proximity calculations, context signal types |
| `src/game/engine.ts` | Wire thresholds → brain, cluster → huddles, task → engagement, context signals, cursor spirit actor |
| `src/game/systems/engagement-system.ts` | Accept context vars in buildEvent, expand interpolation |

### New Files

| File | Purpose |
|------|---------|
| `src/game/actors/cursor-spirit.ts` | ExcaliburJS Actor — radial gradient glow following mouse |
| `tests/game/systems/needs-system.test.ts` | Tests for attribute modifiers, thresholds, mood derivation |
| `tests/game/systems/director-system.test.ts` | Tests for idle tracking, cursor position, interactions |

---

## Chunk 1: NeedsSystem — Attributes & Thresholds + Tests

### Task 1: NeedsSystem tests

**Files:**
- Create: `tests/game/systems/needs-system.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import { NeedsSystem } from "../../../src/game/systems/needs-system.js";

describe("NeedsSystem", () => {
	describe("register", () => {
		it("initializes agent with default needs", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			const needs = sys.getNeeds("Atlas");
			expect(needs.energy).toBe(80);
			expect(needs.social).toBe(60);
			expect(needs.focus).toBe(70);
			expect(needs.morale).toBe(75);
		});
	});

	describe("attribute modifiers", () => {
		it("high CON slows energy decay during work", () => {
			const base = new NeedsSystem();
			base.register("Base");
			const modded = new NeedsSystem();
			modded.register("Tank", { con: 20 });

			// Simulate 10s of working
			const getState = () => "working";
			const getNearby = () => [];
			base.update(10_000, getState, getNearby);
			modded.update(10_000, getState, getNearby);

			// High CON agent should have more energy remaining
			expect(modded.getNeeds("Tank").energy).toBeGreaterThan(base.getNeeds("Base").energy);
		});

		it("high CHA increases social decay rate", () => {
			const base = new NeedsSystem();
			base.register("Base");
			const social = new NeedsSystem();
			social.register("Charmer", { cha: 20 });

			const getState = () => "idle";
			const getNearby = () => [];
			base.update(10_000, getState, getNearby);
			social.update(10_000, getState, getNearby);

			// High CHA agent needs people more — social drains faster
			expect(social.getNeeds("Charmer").social).toBeLessThan(base.getNeeds("Base").social);
		});

		it("high INT slows focus decay", () => {
			const base = new NeedsSystem();
			base.register("Base");
			const smart = new NeedsSystem();
			smart.register("Brain", { int: 20 });

			const getState = () => "working";
			const getNearby = () => [];
			base.update(10_000, getState, getNearby);
			smart.update(10_000, getState, getNearby);

			expect(smart.getNeeds("Brain").focus).toBeGreaterThan(base.getNeeds("Base").focus);
		});
	});

	describe("behavior thresholds", () => {
		it("returns force-break when energy < 30", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			sys.applyEffect("Atlas", { energy: -60 }); // 80 - 60 = 20
			const actions = sys.checkThresholds("Atlas");
			expect(actions).toContainEqual({ type: "force-break" });
		});

		it("returns seek-agent when social < 25", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			sys.applyEffect("Atlas", { social: -40 }); // 60 - 40 = 20
			const actions = sys.checkThresholds("Atlas");
			expect(actions).toContainEqual({ type: "seek-agent" });
		});

		it("returns seek-quiet when focus < 20", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			sys.applyEffect("Atlas", { focus: -55 }); // 70 - 55 = 15
			const actions = sys.checkThresholds("Atlas");
			expect(actions).toContainEqual({ type: "seek-quiet" });
		});

		it("returns demoralized when morale < 10", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			sys.applyEffect("Atlas", { morale: -70 }); // 75 - 70 = 5
			const actions = sys.checkThresholds("Atlas");
			expect(actions).toContainEqual({ type: "demoralized" });
		});

		it("returns empty array when all needs healthy", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			expect(sys.checkThresholds("Atlas")).toEqual([]);
		});
	});

	describe("mood derivation", () => {
		it("returns tired when energy low", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			sys.applyEffect("Atlas", { energy: -60 });
			expect(sys.getMood("Atlas")).toBe("tired");
		});

		it("returns excited when morale high", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			sys.applyEffect("Atlas", { morale: 10 });
			expect(sys.getMood("Atlas")).toBe("excited");
		});

		it("returns neutral for unknown agent", () => {
			const sys = new NeedsSystem();
			expect(sys.getMood("nobody")).toBe("neutral");
		});
	});

	describe("applyEffect", () => {
		it("clamps values to 0-100", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			sys.applyEffect("Atlas", { energy: 200 });
			expect(sys.getNeeds("Atlas").energy).toBe(100);
			sys.applyEffect("Atlas", { energy: -300 });
			expect(sys.getNeeds("Atlas").energy).toBe(0);
		});
	});

	describe("update", () => {
		it("restores energy during on-break", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			sys.applyEffect("Atlas", { energy: -40 }); // 40
			sys.update(5000, () => "on-break", () => []);
			expect(sys.getNeeds("Atlas").energy).toBeGreaterThan(40);
		});

		it("applies social bonus for nearby agents", () => {
			const sys = new NeedsSystem();
			sys.register("Atlas");
			const before = sys.getNeeds("Atlas").social;
			sys.update(5000, () => "idle", () => ["Rex", "Sage"]);
			expect(sys.getNeeds("Atlas").social).toBeGreaterThan(before);
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/needs-system.test.ts`
Expected: FAIL — `checkThresholds` not found, attribute tests fail

### Task 2: NeedsSystem attribute modifiers + thresholds

**Files:**
- Modify: `src/game/systems/needs-system.ts`

- [ ] **Step 1: Store attributes and apply modifiers**

Replace the `register` method to store attributes. Add a private `getModifiers` method. Update `update()` to apply attribute-based rate modifiers.

Key changes:
- `NeedsEntry` gains an `attributes` field
- `register(name, attributes?)` stores attributes
- `update()` multiplies decay rates by attribute modifiers:
  - Energy: `×(1 - con/40)` — CON reduces energy drain
  - Social: `×(1 + cha/20)` — CHA increases social need (needs people more)
  - Focus: `×(1 - int/40)` — INT reduces focus drain
  - Morale: `×(1 - wis/40)` — WIS reduces morale drain
- Only apply modifiers to negative rates (drains), not positive rates (restores)

- [ ] **Step 2: Add checkThresholds method**

```typescript
export interface ThresholdAction {
	readonly type: "force-break" | "seek-agent" | "seek-quiet" | "demoralized";
}

checkThresholds(name: string): ThresholdAction[] {
	const entry = this.agents.get(name);
	if (!entry) return [];
	const actions: ThresholdAction[] = [];
	if (entry.energy < 30) actions.push({ type: "force-break" });
	if (entry.social < 25) actions.push({ type: "seek-agent" });
	if (entry.focus < 20) actions.push({ type: "seek-quiet" });
	if (entry.morale < 10) actions.push({ type: "demoralized" });
	return actions;
}
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/needs-system.test.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/needs-system.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/needs-system.test.ts"
git commit -m "feat(needs): attribute modifiers and behavior thresholds"
```

---

## Chunk 2: DirectorSystem — Cursor Position & Context Signals + Tests

### Task 3: DirectorSystem tests

**Files:**
- Create: `tests/game/systems/director-system.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import { DirectorSystem } from "../../../src/game/systems/director-system.js";

describe("DirectorSystem", () => {
	describe("idle tracking", () => {
		it("increments idle time on update", () => {
			const sys = new DirectorSystem();
			sys.update(5000);
			expect(sys.getPresence().idleMs).toBe(5000);
		});

		it("resets idle on recordInteraction", () => {
			const sys = new DirectorSystem();
			sys.update(5000);
			sys.recordInteraction("click", { x: 100, y: 200 });
			expect(sys.getPresence().idleMs).toBe(0);
		});

		it("resets idle on mouse move", () => {
			const sys = new DirectorSystem();
			sys.update(5000);
			sys.onMouseMove(100, 200);
			expect(sys.getPresence().idleMs).toBe(0);
		});

		it("does not increment when not present", () => {
			const sys = new DirectorSystem();
			sys.setPresent(false);
			sys.update(5000);
			expect(sys.getPresence().idleMs).toBe(0);
		});
	});

	describe("cursor position", () => {
		it("tracks world position from mouse move", () => {
			const sys = new DirectorSystem();
			sys.onMouseMove(150, 250);
			expect(sys.getCursorPosition()).toEqual({ x: 150, y: 250 });
		});

		it("returns null position when mouse has not moved", () => {
			const sys = new DirectorSystem();
			expect(sys.getCursorPosition()).toBeNull();
		});

		it("clears position on mouse leave", () => {
			const sys = new DirectorSystem();
			sys.onMouseMove(100, 200);
			sys.onMouseLeave();
			expect(sys.getCursorPosition()).toBeNull();
		});
	});

	describe("context signals", () => {
		it("returns click signal effects", () => {
			const sys = new DirectorSystem();
			const signal = sys.recordInteraction("click", { x: 100, y: 200 });
			expect(signal.type).toBe("click");
		});

		it("returns message signal with morale boost", () => {
			const sys = new DirectorSystem();
			const signal = sys.recordInteraction("message", { x: 50, y: 50 });
			expect(signal.type).toBe("message");
			expect(signal.moraleEffect).toBe(2);
		});

		it("returns permission-grant signal", () => {
			const sys = new DirectorSystem();
			const signal = sys.recordInteraction("permission-grant");
			expect(signal.moraleEffect).toBe(5);
		});

		it("returns permission-deny signal", () => {
			const sys = new DirectorSystem();
			const signal = sys.recordInteraction("permission-deny");
			expect(signal.moraleEffect).toBe(-3);
		});

		it("returns task-praise signal", () => {
			const sys = new DirectorSystem();
			const signal = sys.recordInteraction("task-praise");
			expect(signal.moraleEffect).toBe(10);
		});
	});

	describe("proximity", () => {
		it("calculates distance to a point", () => {
			const sys = new DirectorSystem();
			sys.onMouseMove(100, 100);
			expect(sys.distanceTo(100, 200)).toBe(100);
		});

		it("returns Infinity when cursor position unknown", () => {
			const sys = new DirectorSystem();
			expect(sys.distanceTo(100, 100)).toBe(Infinity);
		});
	});
});
```

- [ ] **Step 2: Run tests to verify fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/director-system.test.ts`
Expected: FAIL — methods don't exist yet

### Task 4: DirectorSystem cursor position & context signals

**Files:**
- Modify: `src/game/systems/director-system.ts`

- [ ] **Step 1: Add cursor position tracking**

Add private `cursorX: number | null = null` and `cursorY: number | null = null`. Update `onMouseMove` to store position. Update `onMouseLeave` to clear. Add `getCursorPosition()` and `distanceTo(x, y)` methods.

- [ ] **Step 2: Add context signal return type and expand recordInteraction**

```typescript
export interface DirectorSignal {
	readonly type: string;
	readonly moraleEffect?: number;
	readonly position?: { x: number; y: number };
}

const SIGNAL_EFFECTS: Record<string, { moraleEffect?: number }> = {
	click: {},
	message: { moraleEffect: 2 },
	"permission-grant": { moraleEffect: 5 },
	"permission-deny": { moraleEffect: -3 },
	"task-praise": { moraleEffect: 10 },
};
```

Update `recordInteraction` to return `DirectorSignal` instead of void.

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/director-system.test.ts`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/director-system.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/director-system.test.ts"
git commit -m "feat(director): cursor position tracking and context signals"
```

---

## Chunk 3: Cursor Spirit Actor

### Task 5: CursorSpirit ExcaliburJS actor

**Files:**
- Create: `src/game/actors/cursor-spirit.ts`

- [ ] **Step 1: Implement CursorSpirit**

Create a minimal ExcaliburJS Actor with a radial gradient circle (12px radius, semi-transparent, team-color tinted). Fades in/out with 300ms transition. Follows the DirectorSystem's cursor position each frame.

```typescript
import * as ex from "excalibur";

export class CursorSpirit extends ex.Actor {
	private targetX = 0;
	private targetY = 0;
	private visible = false;
	private opacity = 0;

	constructor() {
		super({ width: 24, height: 24, anchor: ex.vec(0.5, 0.5) });
		this.graphics.opacity = 0;
		this.z = 999; // Always on top

		const canvas = new ex.Canvas({
			width: 24,
			height: 24,
			draw: (ctx) => {
				const gradient = ctx.createRadialGradient(12, 12, 0, 12, 12, 12);
				gradient.addColorStop(0, "rgba(124, 58, 237, 0.3)");
				gradient.addColorStop(1, "rgba(124, 58, 237, 0)");
				ctx.fillStyle = gradient;
				ctx.beginPath();
				ctx.arc(12, 12, 12, 0, Math.PI * 2);
				ctx.fill();
			},
		});
		this.graphics.use(canvas);
	}

	show(x: number, y: number): void {
		this.targetX = x;
		this.targetY = y;
		this.visible = true;
	}

	hide(): void {
		this.visible = false;
	}

	moveTo(x: number, y: number): void {
		this.targetX = x;
		this.targetY = y;
	}

	onPreUpdate(_engine: ex.Engine, deltaMs: number): void {
		// Fade in/out (300ms)
		const fadeSpeed = deltaMs / 300;
		this.opacity = this.visible
			? Math.min(1, this.opacity + fadeSpeed)
			: Math.max(0, this.opacity - fadeSpeed);
		this.graphics.opacity = this.opacity;

		// Smooth follow cursor
		const lerp = Math.min(1, deltaMs / 50);
		this.pos.x += (this.targetX - this.pos.x) * lerp;
		this.pos.y += (this.targetY - this.pos.y) * lerp;
	}
}
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/actors/cursor-spirit.ts"
git commit -m "feat: CursorSpirit actor — radial gradient glow following mouse"
```

---

## Chunk 4: Engine Wiring — Thresholds, Signals, Huddles, Task Ack

### Task 6: Wire behavior thresholds in engine

**Files:**
- Modify: `src/game/engine.ts`

- [ ] **Step 1: Add threshold processing after mood propagation**

After the mood propagation loop (around line 662), add threshold checks:

```typescript
// 3b. Behavior thresholds — needs-driven state overrides
for (const agentName of needsSystem.getAgentNames()) {
	const actions = needsSystem.checkThresholds(agentName);
	for (const action of actions) {
		switch (action.type) {
			case "force-break":
				if (brainSystem.getState(agentName)?.state !== "on-break") {
					brainSystem.applyEvent(agentName, "break");
				}
				break;
			case "seek-agent": {
				const nearest = findNearestAgent(agentName);
				if (nearest) brainSystem.walkTo(agentName, nearest);
				break;
			}
			case "seek-quiet":
				brainSystem.applyEvent(agentName, "idle");
				break;
			case "demoralized":
				brainSystem.applyEvent(agentName, "idle");
				break;
		}
	}
}
```

Also add a `findNearestAgent` helper function that gets the position of the closest other agent from `brainSystem.getAllEntries()`.

- [ ] **Step 2: Run game tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "feat(engine): wire behavior thresholds from NeedsSystem to BrainSystem"
```

### Task 7: Wire context signals in engine

**Files:**
- Modify: `src/game/engine.ts`

- [ ] **Step 1: Apply morale effects from director signals**

Update the `recordInteraction` call sites in the engine to use the returned signal and apply morale effects:

At agent click (around line 230):
```typescript
const signal = directorSystem.recordInteraction("click", { x: actor.pos.x, y: actor.pos.y });
if (signal.moraleEffect) needsSystem.applyEffect(agentName, { morale: signal.moraleEffect });
```

At message send (around line 839):
```typescript
const signal = directorSystem.recordInteraction("message", { x: actor.pos.x, y: actor.pos.y });
if (signal.moraleEffect) needsSystem.applyEffect(agentName, { morale: signal.moraleEffect });
```

- [ ] **Step 2: Wire permission grant/deny signals**

Find where permissions are granted/denied in the engine and add:
```typescript
const signal = directorSystem.recordInteraction("permission-grant");
if (signal.moraleEffect) needsSystem.applyEffect(agentName, { morale: signal.moraleEffect });
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "feat(engine): apply context signal morale effects from Director interactions"
```

### Task 8: Wire cluster huddles

**Files:**
- Modify: `src/game/engine.ts`

- [ ] **Step 1: Add cluster callback that triggers huddle conversations**

After the `socialSystem.onConversation(...)` wiring, add:

```typescript
import { HUDDLE_TEMPLATES } from "./data/huddle-templates.js";

socialSystem.onCluster((members) => {
	// Round-robin huddle: each member says one line
	const lines = members.slice(0, 3).map(() => {
		const template = HUDDLE_TEMPLATES[Math.floor(Math.random() * HUDDLE_TEMPLATES.length)];
		return template.text;
	});

	members.slice(0, 3).forEach((name, i) => {
		const agent = store.getAgent(name);
		const domain = agent?.domain ?? "general";
		const mood = needsSystem.getMood(name);
		const moodAdj = mood === "neutral" ? "optimistic" : mood;
		const text = interpolateTemplate(lines[i], { domain, mood_adj: moodAdj });

		brainSystem.applyEvent(name, "speaking");
		setTimeout(() => {
			bubbleSystem.showBubble(name, "speech", text, engine.currentScene, findAgentActor, 4000);
		}, i * 1500);
	});

	// Return to idle after huddle
	setTimeout(() => {
		for (const name of members) brainSystem.applyEvent(name, "idle");
	}, members.length * 1500 + 3000);
});
```

- [ ] **Step 2: Run game tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "feat(engine): wire cluster detection to spontaneous huddle conversations"
```

### Task 9: Wire task completion acknowledgment

**Files:**
- Modify: `src/game/engine.ts`

- [ ] **Step 1: Wire task-completed event to engagement system**

Find where the store dispatches `task-completed` event (in the dashboard store's `handleCliEvent` for "done" type). In the engine, add a listener:

```typescript
store.addEventListener("task-completed", ((e: CustomEvent) => {
	const agentName = String(e.detail?.agentName ?? "");
	if (agentName) engagementSystem.markTaskCompleted(agentName);
}) as EventListener);
```

Also clear on agent select:
```typescript
// In handleAgentSelect, add:
engagementSystem.clearTaskCompleted(agentName);
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "feat(engine): wire task completion to engagement acknowledgment"
```

### Task 10: Wire cursor spirit actor

**Files:**
- Modify: `src/game/engine.ts`

- [ ] **Step 1: Add CursorSpirit to the engine**

Import and instantiate:
```typescript
import { CursorSpirit } from "./actors/cursor-spirit.js";
```

After scene creation, create and add the spirit:
```typescript
const cursorSpirit = new CursorSpirit();
hubScene.add(cursorSpirit);
```

In the mouse move handler, update the spirit:
```typescript
engine.input.pointers.primary.on("move", (evt) => {
	directorSystem.onMouseMove(evt.worldPos.x, evt.worldPos.y);
	cursorSpirit.show(evt.worldPos.x, evt.worldPos.y);
	cursorSpirit.moveTo(evt.worldPos.x, evt.worldPos.y);
});
```

In mouse leave:
```typescript
engine.canvas.addEventListener("mouseleave", () => {
	directorSystem.onMouseLeave();
	cursorSpirit.hide();
});
```

Add spirit to all scenes on scene change so it persists.

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "feat(engine): add cursor spirit actor following mouse with fade"
```

### Task 11: Expand engagement template context

**Files:**
- Modify: `src/game/systems/engagement-system.ts`
- Modify: `src/game/engine.ts`

- [ ] **Step 1: Add workspace context to engagement system**

Add a `setContext` method to EngagementSystem that accepts workspace metrics:

```typescript
private context: Record<string, string> = {};

setContext(ctx: Record<string, string>): void {
	this.context = ctx;
}
```

Update `buildEvent` to merge context into template vars:

```typescript
const text = interpolateTemplate(template.text, { domain, task: "current task", ...this.context });
```

- [ ] **Step 2: Feed context from engine**

In the engine's preframe loop or after data loads, periodically update context:

```typescript
// After health loads or on a timer
engagementSystem.setContext({
	healthScore: String(store.healthScore ?? "unknown"),
	agentCount: String(brainSystem.getAllEntries().size),
});
```

- [ ] **Step 3: Run all game tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/engagement-system.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine.ts"
git commit -m "feat(engagement): expand template interpolation with workspace context"
```

---

## Chunk 5: Final Verification

### Task 12: Full verification

- [ ] **Step 1: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep "^src/"`
Expected: No errors

- [ ] **Step 2: Lint**

Run: `cd "01 - Projects/Flowti Plugin" && npx eslint src/game/systems/ src/game/actors/ src/game/engine.ts 2>&1 | grep "error"`
Expected: No errors

- [ ] **Step 3: All game tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/`
Expected: All tests pass

- [ ] **Step 4: Full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: All tests pass (8400+)

- [ ] **Step 5: Build**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`
Expected: Build passes
