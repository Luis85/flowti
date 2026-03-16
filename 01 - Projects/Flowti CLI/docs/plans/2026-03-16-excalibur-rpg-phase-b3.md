# ExcaliburJS RPG Phase B3 — Agent Habits & Camera Follow — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make agents feel alive through personality-driven habits and give the player a camera to follow them.

**Architecture:** Extend the existing brain FSM with a habits data model (`computeHabits()` parallel to `computeParams()`), add personality-weighted idle target selection as a pure function, add two new pixel-art poses for idle cycling, add `on-break` as a new brain state, and create a camera system using ExcaliburJS built-in `LockCameraToActorStrategy`. All behavior logic is pure functions (testable without ExcaliburJS).

**Tech Stack:** TypeScript, ExcaliburJS v0.32, Vitest, Canvas2D

**Spec:** `docs/specs/2026-03-16-excalibur-rpg-phase-b3-design.md`

**All file paths are relative to:** `01 - Projects/Flowti CLI/agents/`

---

## Chunk 1: Habit Data Model & Computation (brain-types, agent-brain)

### Task 1: Add `AgentHabits` interface to brain-types.ts

**Files:**
- Modify: `src/brain/brain-types.ts:3` (add `on-break` to BrainState)
- Modify: `src/brain/brain-types.ts:28-35` (add AgentHabits after BrainParams)
- Test: `tests/brain/habits.test.ts` (new file)

- [ ] **Step 1: Write failing tests for `computeHabits()`**

Create `tests/brain/habits.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { computeHabits } from "../../src/brain/agent-brain.js";

describe("computeHabits", () => {
	it("low DEX (1-7) → deliberate movement", () => {
		const habits = computeHabits({ str: 10, int: 10, wis: 10, cha: 10, dex: 5, con: 10 }, "neutral", "engineering");
		expect(habits.movementStyle).toBe("deliberate");
	});

	it("mid DEX (8-13) → brisk movement", () => {
		const habits = computeHabits({ str: 10, int: 10, wis: 10, cha: 10, dex: 10, con: 10 }, "neutral", "engineering");
		expect(habits.movementStyle).toBe("brisk");
	});

	it("high DEX (14-20) → darting movement", () => {
		const habits = computeHabits({ str: 10, int: 10, wis: 10, cha: 10, dex: 18, con: 10 }, "neutral", "engineering");
		expect(habits.movementStyle).toBe("darting");
	});

	it("low CON → fidgety idle", () => {
		const habits = computeHabits({ str: 10, int: 10, wis: 10, cha: 10, dex: 10, con: 3 }, "neutral", "engineering");
		expect(habits.idleStyle).toBe("fidgety");
	});

	it("mid CON → restless idle", () => {
		const habits = computeHabits({ str: 10, int: 10, wis: 10, cha: 10, dex: 10, con: 10 }, "neutral", "engineering");
		expect(habits.idleStyle).toBe("restless");
	});

	it("high CON → calm idle", () => {
		const habits = computeHabits({ str: 10, int: 10, wis: 10, cha: 10, dex: 10, con: 18 }, "neutral", "engineering");
		expect(habits.idleStyle).toBe("calm");
	});

	it("CHA drives socialDrift (0-1 range)", () => {
		const low = computeHabits({ str: 10, int: 10, wis: 10, cha: 2, dex: 10, con: 10 }, "neutral", "engineering");
		const high = computeHabits({ str: 10, int: 10, wis: 10, cha: 20, dex: 10, con: 10 }, "neutral", "engineering");
		expect(low.socialDrift).toBeLessThan(0.2);
		expect(high.socialDrift).toBe(1.0);
	});

	it("INT drives focusDrift (0-1 range)", () => {
		const low = computeHabits({ str: 10, int: 2, wis: 10, cha: 10, dex: 10, con: 10 }, "neutral", "engineering");
		const high = computeHabits({ str: 10, int: 20, wis: 10, cha: 10, dex: 10, con: 10 }, "neutral", "engineering");
		expect(low.focusDrift).toBeLessThan(0.2);
		expect(high.focusDrift).toBe(1.0);
	});

	it("CON drives breakThreshold (12-50s)", () => {
		const low = computeHabits({ str: 10, int: 10, wis: 10, cha: 10, dex: 10, con: 1 }, "neutral", "engineering");
		const high = computeHabits({ str: 10, int: 10, wis: 10, cha: 10, dex: 10, con: 20 }, "neutral", "engineering");
		expect(low.breakThreshold).toBe(12);
		expect(high.breakThreshold).toBe(50);
	});

	it("WIS drives settlingPause (250-1200ms)", () => {
		const low = computeHabits({ str: 10, int: 10, wis: 1, cha: 10, dex: 10, con: 10 }, "neutral", "engineering");
		const high = computeHabits({ str: 10, int: 10, wis: 20, cha: 10, dex: 10, con: 10 }, "neutral", "engineering");
		expect(low.settlingPause).toBe(250);
		expect(high.settlingPause).toBe(1200);
	});

	it("preferredWorkstationId starts as null", () => {
		const habits = computeHabits({ str: 10, int: 10, wis: 10, cha: 10, dex: 10, con: 10 }, "neutral", "engineering");
		expect(habits.preferredWorkstationId).toBeNull();
	});

	it("domain maps to homeRoom via resolveSettingForDomain", () => {
		expect(computeHabits({}, "neutral", "engineering").homeRoom).toBe("office");
		expect(computeHabits({}, "neutral", "design").homeRoom).toBe("village");
		expect(computeHabits({}, "neutral", "management").homeRoom).toBe("station");
	});
});

describe("computeHabits — mood multipliers", () => {
	const baseAttrs = { str: 10, int: 10, wis: 10, cha: 10, dex: 10, con: 10 };

	it("happy mood increases idleResistanceMult by 20%", () => {
		const happy = computeHabits(baseAttrs, "happy", "engineering");
		expect(happy.idleResistanceMult).toBeCloseTo(1.2, 2);
	});

	it("frustrated mood decreases idleResistanceMult by 30%", () => {
		const frustrated = computeHabits(baseAttrs, "frustrated", "engineering");
		expect(frustrated.idleResistanceMult).toBeCloseTo(0.7, 2);
	});

	it("frustrated mood increases speedMult by 15%", () => {
		const frustrated = computeHabits(baseAttrs, "frustrated", "engineering");
		expect(frustrated.speedMult).toBeCloseTo(1.15, 2);
	});

	it("focused mood decreases socialDrift by 50%", () => {
		const neutral = computeHabits(baseAttrs, "neutral", "engineering");
		const focused = computeHabits(baseAttrs, "focused", "engineering");
		expect(focused.socialDrift).toBeCloseTo(neutral.socialDrift * 0.5, 2);
	});

	it("focused mood increases breakThreshold by 40%", () => {
		const neutral = computeHabits(baseAttrs, "neutral", "engineering");
		const focused = computeHabits(baseAttrs, "focused", "engineering");
		expect(focused.breakThreshold).toBeCloseTo(neutral.breakThreshold * 1.4, 1);
	});

	it("neutral mood has baseline multipliers", () => {
		const neutral = computeHabits(baseAttrs, "neutral", "engineering");
		expect(neutral.idleResistanceMult).toBe(1.0);
		expect(neutral.speedMult).toBe(1.0);
	});
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run agents/tests/brain/habits.test.ts --config configs/vitest.config.ts`
Expected: FAIL — `computeHabits` is not exported from `agent-brain.js`

- [ ] **Step 3: Add `on-break` to `BrainState` and `AgentHabits` interface in brain-types.ts**

In `src/brain/brain-types.ts`, change line 3:
```typescript
export type BrainState = "idle" | "wandering" | "walking-to" | "working" | "talking" | "waiting" | "on-break";
```

After line 35 (after `BrainParams`), add:
```typescript
/** Personality-derived habits for movement and behavior patterns. */
export interface AgentHabits {
	preferredWorkstationId: string | null;
	readonly homeRoom: string;
	readonly movementStyle: "deliberate" | "brisk" | "darting";
	readonly idleStyle: "fidgety" | "calm" | "restless";
	socialDrift: number;
	readonly focusDrift: number;
	breakThreshold: number;
	readonly settlingPause: number;
	/** Mood multiplier for idle resistance (1.0 = neutral). */
	readonly idleResistanceMult: number;
	/** Mood multiplier for movement speed (1.0 = neutral). */
	readonly speedMult: number;
}
```

Note: `preferredWorkstationId`, `socialDrift`, and `breakThreshold` are mutable — updated at runtime (workstation memory, mood changes).

- [ ] **Step 4: Implement `computeHabits()` in agent-brain.ts**

Add import at top of `src/brain/agent-brain.ts`:
```typescript
import type { BrainState, BrainEvent, BrainResult, BrainParams, MovementTarget, AgentHabits } from "./brain-types.js";
import type { AgentAttributes } from "../data/types.js";
import { resolveSettingForDomain } from "../config/domain-map.js";
```

After the `computeParams()` function (after line 51), add:

```typescript
/** Derive personality habits from attributes, mood, and domain. */
export function computeHabits(attrs: AgentAttributes, mood: string, domain: string): AgentHabits {
	const dex = attrs.dex ?? DEFAULT_ATTR;
	const cha = attrs.cha ?? DEFAULT_ATTR;
	const int = attrs.int ?? DEFAULT_ATTR;
	const con = attrs.con ?? DEFAULT_ATTR;
	const wis = attrs.wis ?? DEFAULT_ATTR;

	const movementStyle: AgentHabits["movementStyle"] =
		dex <= 7 ? "deliberate" : dex <= 13 ? "brisk" : "darting";

	const idleStyle: AgentHabits["idleStyle"] =
		con <= 7 ? "fidgety" : con <= 13 ? "restless" : "calm";

	let socialDrift = cha / 20;
	let breakThreshold = 10 + con * 2;
	const settlingPause = 200 + wis * 50;

	// Mood multipliers (per spec A6)
	let idleResistanceMult = 1.0;
	let speedMult = 1.0;

	if (mood === "happy") {
		idleResistanceMult = 1.2;          // +20% idle duration
	} else if (mood === "frustrated") {
		idleResistanceMult = 0.7;          // -30% idle duration
		speedMult = 1.15;                  // +15% movement speed
	} else if (mood === "focused") {
		breakThreshold *= 1.4;             // +40% work duration before break
		socialDrift *= 0.5;                // -50% social drift
	}

	return {
		preferredWorkstationId: null,
		homeRoom: resolveSettingForDomain(domain),
		movementStyle,
		idleStyle,
		socialDrift,
		focusDrift: int / 20,
		breakThreshold,
		settlingPause,
		idleResistanceMult,
		speedMult,
	};
}
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run agents/tests/brain/habits.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS

- [ ] **Step 6: Run full test suite to check for regressions**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: All existing tests still pass (adding `on-break` to BrainState union is additive, existing switch statements have `default` cases)

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/brain/brain-types.ts" \
       "01 - Projects/Flowti CLI/agents/src/brain/agent-brain.ts" \
       "01 - Projects/Flowti CLI/agents/tests/brain/habits.test.ts"
git commit -m "feat(phase-b3): add AgentHabits interface, computeHabits(), on-break state"
```

---

## Chunk 2: Personality-Driven Idle Target Selection (movement.ts)

### Task 2: Add `resolveIdleTarget()` pure function

**Files:**
- Modify: `src/brain/movement.ts:15-17` (add `id` to Workstation)
- Modify: `src/brain/movement.ts` (add `resolveIdleTarget` + `preferredWorkstation`)
- Test: `tests/brain/habits.test.ts` (extend with idle target tests)

- [ ] **Step 1: Write failing tests for `resolveIdleTarget()`**

Append to `tests/brain/habits.test.ts`:

```typescript
import { resolveIdleTarget, preferredWorkstation } from "../../src/brain/movement.js";
import type { AgentHabits } from "../../src/brain/brain-types.js";

const defaultHabits: AgentHabits = {
	preferredWorkstationId: null,
	homeRoom: "office",
	movementStyle: "brisk",
	idleStyle: "restless",
	socialDrift: 0.5,
	focusDrift: 0.5,
	breakThreshold: 30,
	settlingPause: 500,
};

const bounds = { minX: 0, maxX: 400, minY: 0, maxY: 300 };

describe("resolveIdleTarget", () => {
	it("high socialDrift + nearby agent → targets near that agent", () => {
		const habits = { ...defaultHabits, socialDrift: 1.0, focusDrift: 0 };
		const nearby = [{ x: 200, y: 150 }];
		// rng returns 0 so socialDrift check always hits (0 < 1.0)
		const result = resolveIdleTarget(habits, nearby, bounds, () => 0);
		expect(result).not.toBeNull();
		// Should be near the other agent but offset by 30px
		expect(Math.abs(result!.x - 200)).toBeLessThanOrEqual(30);
		expect(Math.abs(result!.y - 150)).toBeLessThanOrEqual(30);
	});

	it("socialDrift miss + high focusDrift → targets far corner", () => {
		const habits = { ...defaultHabits, socialDrift: 0, focusDrift: 1.0 };
		const nearby = [{ x: 200, y: 150 }];
		// rng returns 0 so focusDrift check hits
		const result = resolveIdleTarget(habits, nearby, bounds, () => 0);
		expect(result).not.toBeNull();
		// Should be in a corner far from the agents
		const distFromAgent = Math.sqrt((result!.x - 200) ** 2 + (result!.y - 150) ** 2);
		expect(distFromAgent).toBeGreaterThan(100);
	});

	it("both miss → falls back to random wander", () => {
		const habits = { ...defaultHabits, socialDrift: 0, focusDrift: 0 };
		const result = resolveIdleTarget(habits, [], bounds, () => 0.5);
		expect(result).not.toBeNull();
		expect(result!.x).toBeGreaterThanOrEqual(0);
		expect(result!.x).toBeLessThanOrEqual(400);
	});

	it("no nearby agents + socialDrift hit → falls through to focus or wander", () => {
		const habits = { ...defaultHabits, socialDrift: 1.0, focusDrift: 0 };
		const result = resolveIdleTarget(habits, [], bounds, () => 0.5);
		expect(result).not.toBeNull(); // fallback wander
	});

	it("returns null when bounds are zero-size", () => {
		const zeroBounds = { minX: 100, maxX: 100, minY: 100, maxY: 100 };
		const result = resolveIdleTarget(defaultHabits, [], zeroBounds, () => 0.5);
		expect(result).toEqual({ x: 100, y: 100 });
	});
});

describe("preferredWorkstation", () => {
	it("returns preferred if available and not occupied", () => {
		const workstations = [
			{ id: "office-0", x: 100, y: 100, occupied: false },
			{ id: "office-1", x: 200, y: 100, occupied: false },
		];
		const result = preferredWorkstation({ x: 300, y: 300 }, workstations, "office-1");
		expect(result).toEqual({ x: 200, y: 100 });
	});

	it("falls back to nearest if preferred is occupied", () => {
		const workstations = [
			{ id: "office-0", x: 100, y: 100, occupied: false },
			{ id: "office-1", x: 200, y: 100, occupied: true },
		];
		const result = preferredWorkstation({ x: 150, y: 100 }, workstations, "office-1");
		expect(result).toEqual({ x: 100, y: 100 });
	});

	it("falls back to nearest when no preferred set", () => {
		const workstations = [
			{ id: "office-0", x: 100, y: 100, occupied: false },
			{ id: "office-1", x: 50, y: 50, occupied: false },
		];
		const result = preferredWorkstation({ x: 40, y: 40 }, workstations, null);
		expect(result).toEqual({ x: 50, y: 50 });
	});

	it("returns null when all occupied", () => {
		const workstations = [
			{ id: "office-0", x: 100, y: 100, occupied: true },
		];
		const result = preferredWorkstation({ x: 0, y: 0 }, workstations, null);
		expect(result).toBeNull();
	});
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run agents/tests/brain/habits.test.ts --config configs/vitest.config.ts`
Expected: FAIL — `resolveIdleTarget` and `preferredWorkstation` not exported

- [ ] **Step 3: Add `id` to Workstation interface and implement functions**

In `src/brain/movement.ts`, update the `Workstation` interface (line 15):
```typescript
export interface Workstation extends Position {
	readonly id: string;
	readonly occupied: boolean;
}
```

Add imports at the top:
```typescript
import type { AgentHabits } from "../brain/brain-types.js";
```

After `resolveAgentTarget()` (after line 70), add:

```typescript
/** Resolve an idle target based on personality habits. Priority: social → focus → wander. */
export function resolveIdleTarget(
	habits: AgentHabits,
	nearbyAgents: readonly Position[],
	bounds: Bounds,
	rng: () => number,
): Position | null {
	// Social drift: gravitate toward nearest agent
	if (nearbyAgents.length > 0 && rng() < habits.socialDrift) {
		const target = nearbyAgents[0];
		const offsetAngle = rng() * Math.PI * 2;
		return {
			x: Math.max(bounds.minX, Math.min(bounds.maxX, target.x + Math.cos(offsetAngle) * 30)),
			y: Math.max(bounds.minY, Math.min(bounds.maxY, target.y + Math.sin(offsetAngle) * 30)),
		};
	}

	// Focus drift: seek furthest corner from all agents
	if (nearbyAgents.length > 0 && rng() < habits.focusDrift) {
		const corners: Position[] = [
			{ x: bounds.minX, y: bounds.minY },
			{ x: bounds.maxX, y: bounds.minY },
			{ x: bounds.minX, y: bounds.maxY },
			{ x: bounds.maxX, y: bounds.maxY },
		];
		let bestCorner = corners[0];
		let bestMinDist = -1;
		for (const corner of corners) {
			let minDist = Infinity;
			for (const agent of nearbyAgents) {
				const dx = corner.x - agent.x;
				const dy = corner.y - agent.y;
				minDist = Math.min(minDist, dx * dx + dy * dy);
			}
			if (minDist > bestMinDist) {
				bestMinDist = minDist;
				bestCorner = corner;
			}
		}
		return bestCorner;
	}

	// Fallback: random wander
	return randomWanderPoint(bounds, rng);
}

/** Find preferred workstation if available, otherwise nearest unoccupied. */
export function preferredWorkstation(
	position: Position,
	workstations: readonly Workstation[],
	preferredId: string | null,
): Position | null {
	if (preferredId) {
		const pref = workstations.find((ws) => ws.id === preferredId && !ws.occupied);
		if (pref) return { x: pref.x, y: pref.y };
	}
	return nearestUnoccupied(position, workstations);
}
```

- [ ] **Step 4: Run tests to confirm they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run agents/tests/brain/habits.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS

- [ ] **Step 5: Update existing `nearestUnoccupied` tests to include `id` field**

In `tests/brain/movement.test.ts`, the `Workstation` interface now requires `id`. Update all workstation test data:

Line 33-35 (picks closest):
```typescript
const workstations = [
	{ id: "ws-0", x: 100, y: 100, occupied: false },
	{ id: "ws-1", x: 15, y: 15, occupied: false },
	{ id: "ws-2", x: 50, y: 50, occupied: true },
];
```

Line 43-45 (all occupied):
```typescript
const workstations = [
	{ id: "ws-0", x: 15, y: 15, occupied: true },
	{ id: "ws-1", x: 50, y: 50, occupied: true },
];
```

Also verify: search the codebase for any other files that construct `Workstation` objects (e.g., `BrainSystem` tests) and add `id` fields there too.

- [ ] **Step 6: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/brain/movement.ts" \
       "01 - Projects/Flowti CLI/agents/tests/brain/habits.test.ts" \
       "01 - Projects/Flowti CLI/agents/tests/brain/movement.test.ts"
git commit -m "feat(phase-b3): add resolveIdleTarget(), preferredWorkstation(), Workstation.id"
```

---

## Chunk 3: Idle Pose Variations (pixel-sprites, agent-actor)

### Task 3: Add look-around and stretch pixel-art poses

**Files:**
- Modify: `src/actors/pixel-sprites.ts` (add 2 new pose functions)
- Modify: `src/actors/agent-actor.ts` (add `setIdlePose()`, build new pose graphics)
- Test: `tests/actors/idle-poses.test.ts` (new file)

- [ ] **Step 1: Write failing tests for new poses**

Create `tests/actors/idle-poses.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from "vitest";
import { drawLookAroundPose, drawStretchPose } from "../../src/actors/pixel-sprites.js";
import type { SpritePalette } from "../../src/actors/pixel-sprites.js";

const palette: SpritePalette = { body: "#22c55e", limb: "#16a34a", hair: "#a855f7" };

function createCanvas(): { ctx: CanvasRenderingContext2D; ops: string[] } {
	const ops: string[] = [];
	const ctx = {
		fillStyle: "",
		strokeStyle: "",
		lineWidth: 0,
		save: () => ops.push("save"),
		restore: () => ops.push("restore"),
		translate: (x: number, y: number) => ops.push(`translate(${x},${y})`),
		scale: (x: number, y: number) => ops.push(`scale(${x},${y})`),
		fillRect: (x: number, y: number, w: number, h: number) => ops.push(`fillRect(${x},${y},${w},${h})`),
		beginPath: () => ops.push("beginPath"),
		arc: (x: number, y: number, r: number) => ops.push(`arc(${x},${y},${r})`),
		fill: () => ops.push("fill"),
		moveTo: () => {},
		lineTo: () => {},
		stroke: () => ops.push("stroke"),
	} as unknown as CanvasRenderingContext2D;
	return { ctx, ops };
}

describe("drawLookAroundPose", () => {
	it("draws without error", () => {
		const { ctx } = createCanvas();
		expect(() => drawLookAroundPose(ctx, palette, "neutral", false)).not.toThrow();
	});

	it("renders a head (includes arc call)", () => {
		const { ctx, ops } = createCanvas();
		drawLookAroundPose(ctx, palette, "neutral", false);
		expect(ops.some((op) => op.startsWith("arc"))).toBe(true);
	});
});

describe("drawStretchPose", () => {
	it("draws without error", () => {
		const { ctx } = createCanvas();
		expect(() => drawStretchPose(ctx, palette, "neutral", false)).not.toThrow();
	});

	it("renders a head (includes arc call)", () => {
		const { ctx, ops } = createCanvas();
		drawStretchPose(ctx, palette, "neutral", false);
		expect(ops.some((op) => op.startsWith("arc"))).toBe(true);
	});
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run agents/tests/actors/idle-poses.test.ts --config configs/vitest.config.ts`
Expected: FAIL — functions not exported

- [ ] **Step 3: Implement `drawLookAroundPose` and `drawStretchPose` in pixel-sprites.ts**

Add after the existing `drawWaitingPose()` function in `src/actors/pixel-sprites.ts`:

```typescript
/** Look-around pose: head offset 2px right, body same as idle.
 * Uses same coordinate system as drawIdlePose (head y=2, body y=7, legs y=15).
 * Uses existing drawStandingBody, drawStandingLegs, drawHead helpers.
 */
export function drawLookAroundPose(
	ctx: CanvasRenderingContext2D,
	palette: SpritePalette,
	mood: string,
	flip: boolean,
): void {
	applyFlip(ctx, flip, 24, () => {
		// Head offset 2px right for "looking around" effect
		drawHead(ctx, 12, 2, palette, mood);
		drawStandingBody(ctx, palette);
		drawStandingLegs(ctx, palette);
	});
}

/** Stretch pose: arms raised above head, body same as idle.
 * Uses same coordinate system as drawIdlePose (head y=2, body y=7, legs y=15).
 */
export function drawStretchPose(
	ctx: CanvasRenderingContext2D,
	palette: SpritePalette,
	mood: string,
	flip: boolean,
): void {
	applyFlip(ctx, flip, 24, () => {
		drawHead(ctx, 10, 2, palette, mood);

		// Body (same as idle)
		ctx.fillStyle = palette.body;
		ctx.fillRect(9, 7, 6, 8);

		// Arms raised (above head, reaching up from y=1 to y=8)
		ctx.fillStyle = palette.limb;
		ctx.fillRect(7, 1, 2, 7);
		ctx.fillRect(15, 1, 2, 7);

		drawStandingLegs(ctx, palette);
	});
}
```

- [ ] **Step 4: Add `setIdlePose()` method and idle pose graphics to AgentActor**

In `src/actors/agent-actor.ts`, add imports for the new poses:
```typescript
import {
	hashColor, statusPalette,
	drawIdlePose, drawWalkFrame, drawWorkingPose, drawTalkingPose, drawWaitingPose,
	drawLookAroundPose, drawStretchPose,
} from "./pixel-sprites.js";
```

Add pose name constants (after line 40):
```typescript
const POSE_LOOK_AROUND = "look-around";
const POSE_STRETCH = "stretch";
const POSE_ON_BREAK = "on-break";
```

Add `setIdlePose()` method to the `AgentActor` class (after `updateVisualStatus`):
```typescript
/** Switch to a specific idle sub-pose (used by brain system for idle cycling). */
setIdlePose(poseName: string): void {
	if (this.brainState !== "idle" && this.brainState !== "on-break") return;
	const validPoses = [POSE_IDLE, POSE_LOOK_AROUND, POSE_STRETCH];
	if (!validPoses.includes(poseName)) return;
	this.currentPoseName = poseName;
	this.graphics.use(poseName);
}
```

In `brainStateToPose()`, add the `on-break` case:
```typescript
case "on-break": return POSE_IDLE;  // Uses idle pose during break
```

In `buildAllPoses()`, add the new pose graphics after the existing static poses:
```typescript
this.graphics.add(POSE_LOOK_AROUND, this.makePoseCanvas(
	(ctx) => drawLookAroundPose(ctx, pal, mood, flip),
	name, isAi, pal,
));

this.graphics.add(POSE_STRETCH, this.makePoseCanvas(
	(ctx) => drawStretchPose(ctx, pal, mood, flip),
	name, isAi, pal,
));
```

- [ ] **Step 5: Run tests to confirm they pass**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run agents/tests/actors/idle-poses.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS

- [ ] **Step 6: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/actors/pixel-sprites.ts" \
       "01 - Projects/Flowti CLI/agents/src/actors/agent-actor.ts" \
       "01 - Projects/Flowti CLI/agents/tests/actors/idle-poses.test.ts"
git commit -m "feat(phase-b3): add look-around and stretch poses, idle pose cycling on AgentActor"
```

---

## Chunk 4: Brain System — Habits Integration, Break Routine, Social Facing

### Task 4: Extend BrainSystem with habits, idle target resolution, break state, social facing

This is the largest task — it wires the habit data model into the brain system's frame-by-frame update loop.

**Files:**
- Modify: `src/systems/brain-system.ts` (AgentBrainEntry gains habits, idle pose timer, break logic, social facing)
- Modify: `src/actors/workstation-actor.ts` (add `workstationId` property)
- Modify: `src/scenes/room-scene.ts` (pass workstationId when creating WorkstationActor)

- [ ] **Step 1: Add `workstationId` to WorkstationActor**

In `src/actors/workstation-actor.ts`, add to the config interface (line 10):
```typescript
export interface WorkstationActorConfig {
	readonly x: number;
	readonly y: number;
	readonly workstationColor: string;
	readonly style?: "desk" | "workbench" | "console";
	readonly workstationId?: string;
}
```

Add property to the class (after line 22):
```typescript
public readonly workstationId: string;
```

Set it in the constructor (after line 32):
```typescript
this.workstationId = config.workstationId ?? `ws-${config.x}-${config.y}`;
```

- [ ] **Step 2: Pass `workstationId` in room-scene.ts**

In `src/scenes/room-scene.ts`, update the workstation grid creation loop (line 119):
```typescript
const ws = new WorkstationActor({
	x,
	y,
	workstationColor: this.theme.workstationColor,
	style: this.roomConfig.workstationStyle,
	workstationId: `${this.setting}-${row * WORKSTATION_COLS + col}`,
});
```

- [ ] **Step 3: Extend `AgentBrainEntry` and `BrainSystem`**

In `src/systems/brain-system.ts`, update imports:
```typescript
import { computeParams, transition, computeHabits } from "../brain/agent-brain.js";
import { randomWanderPoint, resolveIdleTarget, preferredWorkstation, type Bounds, type Position, type Workstation } from "../brain/movement.js";
import type { BrainState, BrainParams, MovementTarget, AgentHabits } from "../brain/brain-types.js";
```

Extend `AgentBrainEntry` (line 16):
```typescript
interface AgentBrainEntry {
	state: BrainState;
	params: BrainParams;
	habits: AgentHabits;
	target: MovementTarget;
	targetPos: Position | null;
	stateTimer: number;
	position: { x: number; y: number };
	// Idle pose cycling
	idlePoseTimer: number;
	idlePoseIndex: number;
	// Break routine
	breakPhase: "none" | "moving" | "resting";
	breakTimer: number;
	breakRestTarget: number;
	// Social facing
	socialHoldTimer: number;
}
```

Add idle pose cycle definitions after the constants:
```typescript
const IDLE_CYCLES: Record<AgentHabits["idleStyle"], readonly string[]> = {
	fidgety: ["idle", "look-around", "stretch", "idle"],
	calm: ["idle", "idle", "look-around", "idle"],
	restless: ["idle", "look-around", "idle", "look-around", "stretch"],
};

const IDLE_TIMERS: Record<AgentHabits["idleStyle"], { min: number; max: number }> = {
	fidgety: { min: 3000, max: 6000 },
	calm: { min: 8000, max: 15000 },
	restless: { min: 5000, max: 10000 },
};

const SOCIAL_PROXIMITY_THRESHOLD = 70;
const SOCIAL_HOLD_DURATION = 4000; // 3-5s, use 4s
const MOVEMENT_SPEED_MAP: Record<AgentHabits["movementStyle"], number> = {
	deliberate: 0.7,
	brisk: 1.0,
	darting: 1.4,
};
```

Update `register()` to compute habits:
```typescript
register(name: string, attributes: AgentAttributes, mood?: string, domain?: string): void {
	if (this.entries.has(name)) return;
	this.entries.set(name, {
		state: "idle",
		params: computeParams(attributes),
		habits: computeHabits(attributes, mood ?? "neutral", domain ?? "general"),
		target: { kind: "none" },
		targetPos: null,
		stateTimer: 0,
		position: { x: 0, y: 0 },
		idlePoseTimer: 0,
		idlePoseIndex: 0,
		breakPhase: "none",
		breakTimer: 0,
		breakRestTarget: 0,
		socialHoldTimer: 0,
	});
}
```

Add `updateMood()` method:
```typescript
/** Recompute habit multipliers when mood changes at runtime. */
updateMood(name: string, mood: string): void {
	const entry = this.entries.get(name);
	if (!entry) return;
	// Recompute habits with new mood — need original attributes
	// Since we don't store raw attributes, recompute from params (approximate)
	// Better approach: store the raw attributes
}
```

Actually, we need to store attributes on the entry. Add `attributes: AgentAttributes` and `domain: string` to `AgentBrainEntry`:
```typescript
interface AgentBrainEntry {
	state: BrainState;
	params: BrainParams;
	habits: AgentHabits;
	attributes: AgentAttributes;
	domain: string;
	target: MovementTarget;
	targetPos: Position | null;
	stateTimer: number;
	position: { x: number; y: number };
	idlePoseTimer: number;
	idlePoseIndex: number;
	breakPhase: "none" | "moving" | "resting";
	breakTimer: number;
	socialHoldTimer: number;
}
```

Then `updateMood()`:
```typescript
updateMood(name: string, mood: string): void {
	const entry = this.entries.get(name);
	if (!entry) return;
	entry.habits = computeHabits(entry.attributes, mood, entry.domain);
}
```

- [ ] **Step 4: Replace `updateIdle()` with habit-driven idle behavior**

Replace the `updateIdle()` method:
```typescript
private updateIdle(entry: AgentBrainEntry, name: string, getActor: (name: string) => AgentActor | undefined): void {
	const adjustedIdleResistance = entry.params.idleResistance * entry.habits.idleResistanceMult;
	if (entry.stateTimer >= adjustedIdleResistance) {
		// Start wandering with personality-driven target
		entry.state = "wandering";
		entry.stateTimer = 0;
		const nearbyAgents = this.getNearbyAgentPositions(name);
		const dest = resolveIdleTarget(entry.habits, nearbyAgents, this.bounds, Math.random);
		if (dest) {
			entry.targetPos = dest;
			entry.target = { kind: "wander", x: dest.x, y: dest.y };
		} else {
			entry.state = "idle";
		}
	}
}
```

Add helper to get nearby agent positions:
```typescript
private getNearbyAgentPositions(excludeName: string): Position[] {
	const positions: Position[] = [];
	for (const [name, entry] of this.entries) {
		if (name === excludeName) continue;
		positions.push(entry.position);
	}
	return positions;
}
```

- [ ] **Step 5: Update the main `update()` loop to handle idle pose cycling, break state, and social facing**

Replace the `update()` method:
```typescript
update(deltaMs: number, getActor: (name: string) => AgentActor | undefined): void {
	for (const [name, entry] of this.entries) {
		entry.stateTimer += deltaMs;
		const actor = getActor(name);
		if (!actor) continue;

		switch (entry.state) {
			case "idle":
				this.updateIdlePoseCycle(entry, deltaMs, actor);
				this.updateIdle(entry, name, getActor);
				break;
			case "wandering":
				this.updateMoving(entry, actor, deltaMs, name);
				break;
			case "walking-to":
				this.updateMoving(entry, actor, deltaMs, name);
				break;
			case "working":
				this.updateWorking(entry, name);
				break;
			case "on-break":
				this.updateOnBreak(entry, actor, deltaMs, name);
				this.updateIdlePoseCycle(entry, deltaMs, actor);
				break;
			case "talking":
				break;
			case "waiting":
				break;
		}

		actor.updateFromBrain(entry.state, entry.target);
		entry.position = { x: actor.pos.x, y: actor.pos.y };
	}

	// Social facing pass (after all positions updated)
	this.updateSocialFacing(deltaMs, getActor);
}
```

Add idle pose cycling method:
```typescript
private updateIdlePoseCycle(entry: AgentBrainEntry, deltaMs: number, actor: AgentActor): void {
	entry.idlePoseTimer += deltaMs;
	const timing = IDLE_TIMERS[entry.habits.idleStyle];
	const threshold = timing.min + Math.random() * (timing.max - timing.min);
	if (entry.idlePoseTimer >= threshold) {
		entry.idlePoseTimer = 0;
		const cycle = IDLE_CYCLES[entry.habits.idleStyle];
		entry.idlePoseIndex = (entry.idlePoseIndex + 1) % cycle.length;
		actor.setIdlePose(cycle[entry.idlePoseIndex]);
	}
}
```

Update `updateWorking()` to trigger breaks:
```typescript
private updateWorking(entry: AgentBrainEntry, name: string): void {
	const breakThresholdMs = entry.habits.breakThreshold * 1000;
	if (entry.stateTimer >= breakThresholdMs && breakThresholdMs < entry.params.focusDuration) {
		// Break time
		entry.state = "on-break";
		entry.breakPhase = "moving";
		entry.stateTimer = 0;
		entry.breakTimer = 0;
		this.config.onWorkstationChange?.(name, "vacate", entry.position);
		const dest = randomWanderPoint(this.bounds, Math.random);
		entry.targetPos = dest;
		entry.target = { kind: "wander", x: dest.x, y: dest.y };
		return;
	}
	if (entry.stateTimer >= entry.params.focusDuration) {
		entry.state = "wandering";
		entry.stateTimer = 0;
		const dest = randomWanderPoint(this.bounds, Math.random);
		entry.targetPos = dest;
		entry.target = { kind: "wander", x: dest.x, y: dest.y };
	}
}
```

Add on-break update:
```typescript
private updateOnBreak(entry: AgentBrainEntry, actor: AgentActor, deltaMs: number, name: string): void {
	if (entry.breakPhase === "moving") {
		// Walk to break point (reuse movement logic)
		if (!entry.targetPos) {
			entry.breakPhase = "resting";
			entry.breakTimer = 0;
			entry.breakRestTarget = 5000 + Math.random() * 5000; // Lock in rest duration
			return;
		}
		const dx = entry.targetPos.x - actor.pos.x;
		const dy = entry.targetPos.y - actor.pos.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < ARRIVAL_THRESHOLD) {
			entry.breakPhase = "resting";
			entry.breakTimer = 0;
			entry.breakRestTarget = 5000 + Math.random() * 5000; // Lock in rest duration
			entry.targetPos = null;
			return;
		}
		const speedMult = MOVEMENT_SPEED_MAP[entry.habits.movementStyle];
		const speed = BASE_SPEED * speedMult * (deltaMs / 1000);
		actor.pos.x += (dx / dist) * Math.min(speed, dist);
		actor.pos.y += (dy / dist) * Math.min(speed, dist);
		actor.facingLeft = dx < 0;
	} else if (entry.breakPhase === "resting") {
		entry.breakTimer += deltaMs;
		if (entry.breakTimer >= entry.breakRestTarget) {
			// Return to preferred workstation — resolve position via callback
			entry.state = "walking-to";
			entry.breakPhase = "none";
			entry.stateTimer = 0;
			entry.target = { kind: "workstation" };
			// Resolve workstation target via the onWorkstationResolve callback
			const wsPos = this.config.onWorkstationResolve?.(name, entry.habits.preferredWorkstationId);
			entry.targetPos = wsPos ?? null;
		}
	}
}
```

Add social facing:
```typescript
private updateSocialFacing(deltaMs: number, getActor: (name: string) => AgentActor | undefined): void {
	const idleEntries: Array<[string, AgentBrainEntry]> = [];
	for (const [name, entry] of this.entries) {
		if (entry.state === "idle" && entry.socialHoldTimer <= 0) {
			idleEntries.push([name, entry]);
		}
	}

	for (let i = 0; i < idleEntries.length; i++) {
		for (let j = i + 1; j < idleEntries.length; j++) {
			const [nameA, entryA] = idleEntries[i];
			const [nameB, entryB] = idleEntries[j];
			const dx = entryA.position.x - entryB.position.x;
			const dy = entryA.position.y - entryB.position.y;
			const dist = Math.sqrt(dx * dx + dy * dy);
			if (dist < SOCIAL_PROXIMITY_THRESHOLD && dist > 0) {
				const actorA = getActor(nameA);
				const actorB = getActor(nameB);
				if (actorA && actorB) {
					actorA.facingLeft = entryA.position.x > entryB.position.x;
					actorB.facingLeft = entryB.position.x > entryA.position.x;
					entryA.socialHoldTimer = SOCIAL_HOLD_DURATION;
					entryB.socialHoldTimer = SOCIAL_HOLD_DURATION;
				}
			}
		}
	}

	// Decrement social hold timers (called with deltaMs from update())
	for (const [_, entry] of this.entries) {
		if (entry.socialHoldTimer > 0) {
			entry.socialHoldTimer -= deltaMs;
		}
	}
}
```

- [ ] **Step 6: Update `updateMoving()` to use habit-based speed**

In the `updateMoving()` method, replace line 173:
```typescript
const speedMult = MOVEMENT_SPEED_MAP[entry.habits.movementStyle] * entry.habits.speedMult;
const speed = BASE_SPEED * speedMult * (deltaMs / 1000);
```

Add `onWorkstationResolve` to `BrainSystemConfig` (after the existing `onWorkstationChange`):
```typescript
readonly onWorkstationResolve?: (agentName: string, preferredId: string | null) => { x: number; y: number } | null;
```

Wire it in `main.ts` when creating the BrainSystem (in the config object alongside `onWorkstationChange`):
```typescript
onWorkstationResolve: (agentName, preferredId) => {
	for (const room of Object.values(roomScenes)) {
		const actor = room.getAgentActor(agentName);
		if (!actor) continue;
		const workstations = room.getWorkstations().map((ws) => ({
			id: ws.workstationId, x: ws.pos.x, y: ws.pos.y, occupied: ws.occupied,
		}));
		return preferredWorkstation({ x: actor.pos.x, y: actor.pos.y }, workstations, preferredId);
	}
	return null;
},
```

Also add settling pause when arriving at workstation (in the arrival block, after line 160):
```typescript
if (entry.target.kind === "workstation") {
	// Settling pause before working
	entry.state = "idle"; // Brief idle for settling
	entry.stateTimer = entry.params.idleResistance - entry.habits.settlingPause;
	// Will transition to working via the next applyEvent("task-started") or
	// the workstation occupy callback triggers working state
	this.config.onWorkstationChange?.(name, "occupy", { x: entry.position.x, y: entry.position.y });
```

- [ ] **Step 7: Update `register()` call in main.ts**

In `src/main.ts`, update the register call (line 255):
```typescript
brainSystem.register(agent.name, agent.attributes ?? {}, agent.mood, agent.domain);
```

- [ ] **Step 8: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: ALL PASS (brain-system.ts changes are internal — existing tests should still pass)

- [ ] **Step 9: Type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 10: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/systems/brain-system.ts" \
       "01 - Projects/Flowti CLI/agents/src/actors/workstation-actor.ts" \
       "01 - Projects/Flowti CLI/agents/src/scenes/room-scene.ts" \
       "01 - Projects/Flowti CLI/agents/src/main.ts"
git commit -m "feat(phase-b3): wire habits into brain system — idle targeting, break routine, social facing"
```

---

## Chunk 5: Camera System (new file + wiring)

### Task 5: Create camera-system.ts and wire into main.ts

**Files:**
- Create: `src/systems/camera-system.ts`
- Modify: `src/main.ts` (wire camera, wheel event, click branching)
- Modify: `src/actors/agent-actor.ts` (click handler change)
- Modify: `src/scenes/room-scene.ts` (scene activate hook)
- Modify: `src/scenes/hub-scene.ts` (scene activate hook)
- Test: `tests/systems/camera-system.test.ts` (new file)

- [ ] **Step 1: Write failing tests for camera system**

Create `tests/systems/camera-system.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createCameraSystem } from "../../src/systems/camera-system.js";

function mockActor(name: string, killed = false) {
	return {
		agentData: { name },
		isKilled: () => killed,
		pos: { x: 100, y: 100 },
	};
}

function mockCamera() {
	const strategies: unknown[] = [];
	return {
		addStrategy: vi.fn((s: unknown) => strategies.push(s)),
		clearAllStrategies: vi.fn(() => strategies.length = 0),
		zoom: 1,
		strategies,
	};
}

function mockContainer() {
	const children: HTMLElement[] = [];
	return {
		appendChild: vi.fn((el: HTMLElement) => children.push(el)),
		removeChild: vi.fn((el: HTMLElement) => {
			const idx = children.indexOf(el);
			if (idx >= 0) children.splice(idx, 1);
		}),
		querySelector: vi.fn(() => null),
		children,
	} as unknown as HTMLElement;
}

describe("createCameraSystem", () => {
	it("startFollow locks camera and shows HUD", () => {
		const camera = mockCamera();
		const container = mockContainer();
		const system = createCameraSystem(camera as any, container);
		const actor = mockActor("alice");

		system.startFollow(actor as any);
		expect(system.isFollowing()).toBe(true);
		expect(system.getFollowedName()).toBe("alice");
		expect(camera.addStrategy).toHaveBeenCalledOnce();
	});

	it("stopFollow releases camera and hides HUD", () => {
		const camera = mockCamera();
		const container = mockContainer();
		const system = createCameraSystem(camera as any, container);
		const actor = mockActor("alice");

		system.startFollow(actor as any);
		system.stopFollow();
		expect(system.isFollowing()).toBe(false);
		expect(system.getFollowedName()).toBeNull();
		expect(camera.clearAllStrategies).toHaveBeenCalledOnce();
	});

	it("checkDespawn stops follow when actor is killed", () => {
		const camera = mockCamera();
		const container = mockContainer();
		const system = createCameraSystem(camera as any, container);
		const actor = mockActor("alice", false);

		system.startFollow(actor as any);
		expect(system.isFollowing()).toBe(true);

		// Simulate despawn
		(actor as any).isKilled = () => true;
		system.checkDespawn();
		expect(system.isFollowing()).toBe(false);
	});

	it("onSceneActivate re-acquires agent in new scene", () => {
		const camera = mockCamera();
		const container = mockContainer();
		const system = createCameraSystem(camera as any, container);
		const actor = mockActor("alice");

		system.startFollow(actor as any);
		const newActor = mockActor("alice");
		const findActor = vi.fn(() => newActor as any);

		system.onSceneActivate(findActor);
		expect(system.isFollowing()).toBe(true);
		expect(findActor).toHaveBeenCalledWith("alice");
	});

	it("onSceneActivate stops follow when agent not in new scene", () => {
		const camera = mockCamera();
		const container = mockContainer();
		const system = createCameraSystem(camera as any, container);
		const actor = mockActor("alice");

		system.startFollow(actor as any);
		const findActor = vi.fn(() => undefined);

		system.onSceneActivate(findActor);
		expect(system.isFollowing()).toBe(false);
	});

	it("handleZoom clamps between 0.5 and 2.0", () => {
		const camera = mockCamera();
		const container = mockContainer();
		const system = createCameraSystem(camera as any, container);

		system.handleZoom(-100); // zoom out
		system.applyZoom(16);
		expect(camera.zoom).toBeGreaterThanOrEqual(0.5);

		camera.zoom = 1;
		system.handleZoom(100); // zoom in
		system.applyZoom(16);
		expect(camera.zoom).toBeLessThanOrEqual(2.0);
	});
});
```

- [ ] **Step 2: Run tests to confirm they fail**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run agents/tests/systems/camera-system.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `camera-system.ts`**

Create `src/systems/camera-system.ts`:

```typescript
/**
 * camera-system.ts — Follow mode, zoom, and HUD indicator.
 *
 * Uses ExcaliburJS LockCameraToActorStrategy for follow,
 * camera.zoom for scroll zoom, and HTML overlay for HUD.
 */

import * as ex from "excalibur";
import type { AgentActor } from "../actors/agent-actor.js";

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 2.0;
const ZOOM_STEP = 0.1;
const ZOOM_LERP_FACTOR = 0.05;

export interface CameraSystem {
	startFollow(actor: AgentActor): void;
	stopFollow(): void;
	isFollowing(): boolean;
	getFollowedName(): string | null;
	checkDespawn(): void;
	onSceneActivate(findActor: (name: string) => AgentActor | undefined): void;
	handleZoom(wheelDelta: number): void;
	applyZoom(deltaMs: number): void;
}

export function createCameraSystem(
	camera: ex.Camera,
	hudContainer: HTMLElement,
): CameraSystem {
	let followedActor: AgentActor | null = null;
	let followedName: string | null = null;
	let hudEl: HTMLElement | null = null;
	let targetZoom = camera.zoom;

	function showHud(name: string): void {
		hideHud();
		const el = document.createElement("div");
		el.className = "follow-hud";
		el.style.cssText = "position:absolute;top:8px;left:50%;transform:translateX(-50%);" +
			"background:#1e293b;color:#e2e8f0;padding:4px 12px;border-radius:6px;" +
			"font:12px system-ui,sans-serif;display:flex;align-items:center;gap:8px;z-index:100;";
		el.innerHTML = `<span>Following: ${name}</span>`;
		const closeBtn = document.createElement("button");
		closeBtn.textContent = "\u00d7";
		closeBtn.style.cssText = "background:none;border:none;color:#94a3b8;cursor:pointer;font-size:16px;padding:0 2px;";
		closeBtn.onclick = () => stopFollow();
		el.appendChild(closeBtn);
		hudContainer.appendChild(el);
		hudEl = el;
	}

	function hideHud(): void {
		if (hudEl && hudEl.parentElement) {
			hudEl.parentElement.removeChild(hudEl);
		}
		hudEl = null;
	}

	function startFollow(actor: AgentActor): void {
		stopFollow();
		followedActor = actor;
		followedName = actor.agentData.name;
		camera.clearAllStrategies();
		camera.addStrategy(new ex.LockCameraToActorStrategy(actor));
		showHud(followedName);
	}

	function stopFollow(): void {
		followedActor = null;
		followedName = null;
		camera.clearAllStrategies();
		hideHud();
	}

	function checkDespawn(): void {
		if (followedActor && followedActor.isKilled()) {
			stopFollow();
		}
	}

	function onSceneActivate(findActor: (name: string) => AgentActor | undefined): void {
		if (!followedName) return;
		const actor = findActor(followedName);
		if (actor) {
			followedActor = actor;
			camera.clearAllStrategies();
			camera.addStrategy(new ex.LockCameraToActorStrategy(actor));
		} else {
			stopFollow();
		}
	}

	function handleZoom(wheelDelta: number): void {
		const direction = wheelDelta > 0 ? -1 : 1;
		targetZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetZoom + direction * ZOOM_STEP));
	}

	function applyZoom(deltaMs: number): void {
		const factor = 1 - Math.pow(ZOOM_LERP_FACTOR, deltaMs / 1000);
		camera.zoom += (targetZoom - camera.zoom) * factor;
	}

	return {
		startFollow,
		stopFollow,
		isFollowing: () => followedActor !== null,
		getFollowedName: () => followedName,
		checkDespawn,
		onSceneActivate,
		handleZoom,
		applyZoom,
	};
}
```

- [ ] **Step 4: Run camera tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run agents/tests/systems/camera-system.test.ts --config configs/vitest.config.ts`
Expected: ALL PASS

- [ ] **Step 5: Wire camera system into main.ts**

In `src/main.ts`, add import:
```typescript
import { createCameraSystem } from "./systems/camera-system.js";
```

After `await engine.start()` (after line 294, before `engine.goToScene("hub")`), add the camera system:
```typescript
const cameraSystem = createCameraSystem(engine.currentScene.camera, canvasParent);
```

Note: the camera system must be created AFTER `engine.start()` so that `engine.currentScene.camera` is properly initialized. If the camera reference changes between scenes, `createCameraSystem` should receive the engine instead and access `engine.currentScene.camera` dynamically.

Add wheel event listener (right after camera system creation):
```typescript
engine.canvas.addEventListener("wheel", (e) => {
	e.preventDefault();
	cameraSystem.handleZoom(e.deltaY);
}, { passive: false });
```

Add Escape key listener:
```typescript
document.addEventListener("keydown", (e) => {
	if (e.key === "Escape" && cameraSystem.isFollowing()) {
		cameraSystem.stopFollow();
	}
});
```

In the preframe handler (line 280), add after brain and bubble updates:
```typescript
cameraSystem.checkDespawn();
cameraSystem.applyZoom(deltaMs);
```

- [ ] **Step 6: Update `handleAgentSelect()` for click branching**

Replace the `handleAgentSelect` function in `src/main.ts`:
```typescript
function handleAgentSelect(agentName: string): void {
	if (panelManager.isOpen() && panelManager.getAgentName() === agentName) {
		// Same agent clicked while panel open → close panel, start follow
		panelManager.close();
		const actor = findAgentActor(agentName);
		if (actor) {
			cameraSystem.startFollow(actor);
		}
	} else {
		// Different agent or no panel → stop follow if active, open panel
		if (cameraSystem.isFollowing()) {
			cameraSystem.stopFollow();
		}
		const rect = engine.canvas.getBoundingClientRect();
		openPanelForAgent(agentName, rect.width * 0.6, rect.height * 0.15);
	}
}
```

- [ ] **Step 7: Add scene activate hooks**

In `src/main.ts`, update `handleSceneChange()`:
```typescript
function handleSceneChange(engine: ex.Engine, targetScene: string, panelMgr: { close: () => void }): void {
	panelMgr.close();
	void engine.goToScene(targetScene, {
		destinationIn: new ex.FadeInOut({ duration: 300, direction: "in" }),
		sourceOut: new ex.FadeInOut({ duration: 300, direction: "out" }),
	}).then(() => {
		cameraSystem.onSceneActivate(findAgentActor);
	});
}
```

- [ ] **Step 8: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: ALL PASS

- [ ] **Step 9: Type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 10: Build**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`
Expected: Clean build

- [ ] **Step 11: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/systems/camera-system.ts" \
       "01 - Projects/Flowti CLI/agents/src/main.ts" \
       "01 - Projects/Flowti CLI/agents/tests/systems/camera-system.test.ts"
git commit -m "feat(phase-b3): camera follow mode with zoom, HUD, scene persistence, despawn detection"
```

---

## Chunk 6: Final Integration & Verification

### Task 6: Full verification pass

**Files:** None new — verification only

- [ ] **Step 1: Run full test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: ALL PASS — note total test count

- [ ] **Step 2: Type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: No errors

- [ ] **Step 3: Lint**

Run: `cd "01 - Projects/Flowti CLI" && npx eslint agents/src/ --config configs/eslint.config.mjs`
Expected: No errors (or only pre-existing warnings)

- [ ] **Step 4: Build**

Run: `cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs`
Expected: Clean build, note bundle size

- [ ] **Step 5: Review git log**

Run: `git log --oneline -10`
Expected: 5 clean commits for Phase B3

- [ ] **Step 6: Final commit if any fixups needed**

If any fixes were needed during verification, stage only the changed files explicitly:
```bash
git add <specific-changed-files>
git commit -m "fix(phase-b3): fixups from verification pass"
```
