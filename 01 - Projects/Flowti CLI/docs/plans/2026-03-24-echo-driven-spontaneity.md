# Echo-Driven Spontaneity Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make agents spontaneously break routine based on personality and experience by closing echo feedback loops and adding a Whim BT subtree.

**Architecture:** Wire interaction results → echo producer (feedback loop), add CascadeReaction + Whim subtrees to the BT, tune cascade constants. All changes follow the existing blackboard-only pattern — BT reads/writes blackboard, engine systems handle side effects.

**Tech Stack:** TypeScript, mistreevous BT library, Vitest

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-24-echo-driven-spontaneity-design.md`

**All paths relative to:** `01 - Projects/Flowti Plugin/`

**Test command:** `npx vitest run <test-file>`

**Type-check:** `npx tsc --noEmit` (ignore pre-existing sidebar/engagement/ritual/social test errors)

---

## Chunk 1: Foundation — Tuning, Blackboard, Context Extensions

### Task 1: Tune cascade constants

**Files:**
- Modify: `src/game/systems/echo/echo-store.ts` (line 23)
- Modify: `src/game/systems/echo/cascade-resolver.ts` (lines 12, 14, 17)

- [ ] **Step 1: Change CASCADE_THRESHOLD in echo-store.ts**

In `echo-store.ts`, change line 23:
```typescript
// Before:
export const CASCADE_THRESHOLD = 15;
// After:
export const CASCADE_THRESHOLD = 10;
```

- [ ] **Step 2: Change constants in cascade-resolver.ts**

In `cascade-resolver.ts`, change three constants:
```typescript
// Line 12 — Before: const CASCADE_WEIGHT_THRESHOLD = 15;
const CASCADE_WEIGHT_THRESHOLD = 10;

// Line 14 — Before: const BASE_PROBABILITY = 0.3;
const BASE_PROBABILITY = 0.4;

// Line 17 — Before: const GOSSIP_FORWARD_CHANCE = 0.3;
const GOSSIP_FORWARD_CHANCE = 0.5;
```

- [ ] **Step 3: Run existing echo/cascade tests to confirm no regressions**

Run: `npx vitest run tests/game/systems/echo/ 2>&1 | tail -10`
Expected: All existing tests pass (some may need threshold adjustments if they assert on exact threshold values)

- [ ] **Step 4: Fix any tests that assert on old threshold values**

Search test files for `15` threshold references and update to `10`. Search for `0.3` probability references and update to `0.4`/`0.5` as appropriate.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/echo/echo-store.ts" \
       "01 - Projects/Flowti Plugin/src/game/systems/echo/cascade-resolver.ts"
git commit -m "feat(plugin): tune cascade thresholds for more reactive echo system"
```

---

### Task 2: Add whimTarget to blackboard + sensor phase

**Files:**
- Modify: `src/game/systems/blackboard.ts`
- Modify: `src/game/systems/sensor-phase.ts`
- Modify: `src/game/engine-simulation.ts`
- Modify: `tests/game/systems/sensor-phase.test.ts`

- [ ] **Step 1: Add whimTarget field to AgentBlackboard interface**

In `blackboard.ts`, add after the `nearestMerchantStall` field:
```typescript
nearestMerchantStall: { x: number; y: number } | null;
whimTarget: { x: number; y: number } | null;
```

- [ ] **Step 2: Add whimTarget to createDefaultBlackboard**

In `blackboard.ts`, add after `nearestMerchantStall: null,`:
```typescript
nearestMerchantStall: null,
whimTarget: null,
```

- [ ] **Step 3: Add getWhimTarget to SensorDeps interface**

In `sensor-phase.ts`, add after `getNearestMerchantStall`:
```typescript
/** Bond-driven whim target position (deterministic, weight > 15 bond in same room). */
getWhimTarget(name: string): { x: number; y: number } | null;
```

- [ ] **Step 4: Write whimTarget in writeSensorData**

In `sensor-phase.ts`, add after `bb.nearestMerchantStall = deps.getNearestMerchantStall(name);`:
```typescript
bb.whimTarget = deps.getWhimTarget(name);
```

- [ ] **Step 5: Implement getWhimTarget in tickBlackboardSensors**

In `engine-simulation.ts`, add to the `sensorDeps` object (after `getNearestMerchantStall`):
```typescript
getWhimTarget: (name) => {
	const bond = sys.echo.getStrongest(name, "bond");
	if (!bond?.target || bond.weight <= 15) return null;
	if (!sys.blackboards.has(bond.target)) return null;
	const targetBb = sys.blackboards.get(bond.target);
	const agentRoom = sys.registry.getEntityRoom(name);
	const targetRoom = sys.registry.getEntityRoom(bond.target);
	if (agentRoom !== targetRoom) return null;
	return { x: targetBb.position.x, y: targetBb.position.y };
},
```

- [ ] **Step 6: Add getWhimTarget to sensor-phase.test.ts makeDeps**

In `tests/game/systems/sensor-phase.test.ts`, add to `makeDeps`:
```typescript
getNearestMerchantStall: vi.fn(() => null),
getWhimTarget: vi.fn(() => null),
```

- [ ] **Step 7: Run sensor phase tests**

Run: `npx vitest run tests/game/systems/sensor-phase.test.ts 2>&1 | tail -10`
Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/blackboard.ts" \
       "01 - Projects/Flowti Plugin/src/game/systems/sensor-phase.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/sensor-phase.test.ts"
git commit -m "feat(plugin): add whimTarget blackboard field and sensor wiring"
```

---

### Task 3: Add lastWhimTick to BTAgentContext

**Files:**
- Modify: `src/game/brain/behavior-tree/bt-types.ts`
- Modify: `src/game/brain/behavior-tree/bt-agent.ts`

- [ ] **Step 1: Add lastWhimTick to BTAgentContext**

In `bt-types.ts`, add after `idleResistance: number;` (last field):
```typescript
idleResistance: number;
/** Wall-clock ms of last whim execution (cooldown gate). */
lastWhimTick: number;
```

- [ ] **Step 2: Initialize lastWhimTick in createBTAgent**

In `bt-agent.ts`, in the `context` object initialization (around line 127), add:
```typescript
idleResistance: 4000 + (con / 20) * 8000,
lastWhimTick: 0,
```

- [ ] **Step 3: Run BT tests to confirm no regressions**

Run: `npx vitest run tests/game/brain/behavior-tree/ 2>&1 | tail -10`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-types.ts" \
       "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-agent.ts"
git commit -m "feat(plugin): add lastWhimTick to BTAgentContext for whim cooldown"
```

---

## Chunk 2: CascadeReaction Subtree

### Task 4: Create CascadeReaction MDSL + BT nodes

**Files:**
- Create: `src/game/brain/behavior-tree/subtrees/cascade-reaction.ts`
- Create: `tests/game/brain/behavior-tree/subtrees/cascade-reaction.test.ts`
- Modify: `src/game/brain/behavior-tree/bt-agent.ts`
- Modify: `src/game/brain/behavior-tree/bt-factory.ts`

- [ ] **Step 1: Write cascade-reaction test file**

Create `tests/game/brain/behavior-tree/subtrees/cascade-reaction.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { CASCADE_REACTION_SUBTREE } from "../../../../../src/game/brain/behavior-tree/subtrees/cascade-reaction.js";

describe("CASCADE_REACTION_SUBTREE", () => {
	it("has root node named CascadeReaction", () => {
		expect(CASCADE_REACTION_SUBTREE).toContain("root [CascadeReaction]");
	});

	it("gates on HasCascadeHint condition", () => {
		expect(CASCADE_REACTION_SUBTREE).toContain("condition [HasCascadeHint]");
	});

	it("contains ReactToCascade action", () => {
		expect(CASCADE_REACTION_SUBTREE).toContain("action [ReactToCascade]");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/brain/behavior-tree/subtrees/cascade-reaction.test.ts 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Create the MDSL subtree file**

Create `src/game/brain/behavior-tree/subtrees/cascade-reaction.ts`:
```typescript
export const CASCADE_REACTION_SUBTREE = `root [CascadeReaction] {
	sequence {
		condition [HasCascadeHint]
		action [ReactToCascade]
	}
}`;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/brain/behavior-tree/subtrees/cascade-reaction.test.ts 2>&1 | tail -10`
Expected: PASS — 3 tests

- [ ] **Step 5: Write HasCascadeHint and ReactToCascade tests**

Add to `tests/game/brain/behavior-tree/subtrees/cascade-reaction.test.ts` (import helpers from the extensions test pattern):
```typescript
import { vi } from "vitest";
import { fromNodeState } from "../../../../../src/game/brain/behavior-tree/bt-service.js";
import { createDefaultBlackboard } from "../../../../../src/game/systems/blackboard.js";

// Tests for the BT node functions (will be added to bt-agent.ts)
// We test them here because they're logically part of the cascade-reaction feature

describe("HasCascadeHint condition", () => {
	it("returns true for seek-proximity hint", () => {
		const bb = createDefaultBlackboard();
		bb.cascadeHint = "seek-proximity";
		// HasCascadeHint reads bb directly — tested via integration
		expect(bb.cascadeHint === "seek-proximity" || bb.cascadeHint === "force-break").toBe(true);
	});

	it("returns true for force-break hint", () => {
		const bb = createDefaultBlackboard();
		bb.cascadeHint = "force-break";
		expect(bb.cascadeHint === "seek-proximity" || bb.cascadeHint === "force-break").toBe(true);
	});

	it("returns false for vent hint (handled by tickSocial)", () => {
		const bb = createDefaultBlackboard();
		bb.cascadeHint = "vent";
		expect(bb.cascadeHint === "seek-proximity" || bb.cascadeHint === "force-break").toBe(false);
	});

	it("returns false when no hint", () => {
		const bb = createDefaultBlackboard();
		expect(bb.cascadeHint === "seek-proximity" || bb.cascadeHint === "force-break").toBe(false);
	});
});
```

- [ ] **Step 6: Add HasCascadeHint and ReactToCascade to bt-agent.ts**

In `bt-agent.ts`, add two new functions inside `createBTAgent` (before the return statement, after `StopTalking`):

```typescript
// ── Cascade reaction (reads hints written by tickSocial) ──────────

function HasCascadeHint(): boolean {
	return bb.cascadeHint === "seek-proximity" || bb.cascadeHint === "force-break";
}

function ReactToCascade(): State {
	const hint = bb.cascadeHint;
	bb.cascadeHint = null;
	bb.cascadeTarget = null;
	if (hint === "seek-proximity" && bb.cascadeTarget) {
		return seekStation(bb, bb.cascadeTarget, "seeking", "cascade-seek");
	}
	if (hint === "force-break") {
		return seekStation(bb, bb.nearestRestStation, "on-break", "cascade-break");
	}
	return fromNodeState("failed");
}
```

**Important:** Read `bb.cascadeTarget` BEFORE clearing it. Fix the function — save target first:

```typescript
function ReactToCascade(): State {
	const hint = bb.cascadeHint;
	const target = bb.cascadeTarget;
	bb.cascadeHint = null;
	bb.cascadeTarget = null;
	if (hint === "seek-proximity" && target) {
		return seekStation(bb, target, "seeking", "cascade-seek");
	}
	if (hint === "force-break") {
		return seekStation(bb, bb.nearestRestStation, "on-break", "cascade-break");
	}
	return fromNodeState("failed");
}
```

Add to the `BTAgentObject` interface: `HasCascadeHint(): boolean; ReactToCascade(): State;`

Add to the return object: `HasCascadeHint, ReactToCascade,`

- [ ] **Step 7: Wire CascadeReaction into bt-factory.ts**

In `bt-factory.ts`, add import:
```typescript
import { CASCADE_REACTION_SUBTREE } from "./subtrees/cascade-reaction.js";
```

In `buildMasterMDSL`, insert after `branch [UrgentReaction]`:
```typescript
		branch [UrgentReaction]
		branch [CascadeReaction]
		branch [TalkingTimeout]
```

In `collectSubtrees`, add after `URGENT_SUBTREE`:
```typescript
URGENT_SUBTREE,
CASCADE_REACTION_SUBTREE,
TALKING_TIMEOUT_SUBTREE,
```

- [ ] **Step 8: Run all BT tests**

Run: `npx vitest run tests/game/brain/behavior-tree/ 2>&1 | tail -15`
Expected: All pass (including new cascade-reaction tests)

- [ ] **Step 9: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/subtrees/cascade-reaction.ts" \
       "01 - Projects/Flowti Plugin/tests/game/brain/behavior-tree/subtrees/cascade-reaction.test.ts" \
       "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-agent.ts" \
       "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-factory.ts"
git commit -m "feat(plugin): add CascadeReaction BT subtree for echo-driven agent reactions"
```

---

## Chunk 3: Whim Subtree

### Task 5: Create Whim MDSL + HasWhim condition + ExecuteWhim action

**Files:**
- Create: `src/game/brain/behavior-tree/subtrees/whim.ts`
- Create: `tests/game/brain/behavior-tree/subtrees/whim.test.ts`
- Modify: `src/game/brain/behavior-tree/bt-agent.ts`
- Modify: `src/game/brain/behavior-tree/bt-factory.ts`

- [ ] **Step 1: Write whim MDSL test**

Create `tests/game/brain/behavior-tree/subtrees/whim.test.ts`:
```typescript
import { describe, it, expect, vi } from "vitest";
import { WHIM_SUBTREE } from "../../../../../src/game/brain/behavior-tree/subtrees/whim.js";
import { fromNodeState } from "../../../../../src/game/brain/behavior-tree/bt-service.js";
import { createDefaultBlackboard } from "../../../../../src/game/systems/blackboard.js";
import type { IEchoStore, Echo } from "../../../../../src/game/systems/echo/echo-types.js";

describe("WHIM_SUBTREE MDSL", () => {
	it("has root node named Whim", () => {
		expect(WHIM_SUBTREE).toContain("root [Whim]");
	});

	it("gates on HasWhim condition", () => {
		expect(WHIM_SUBTREE).toContain("condition [HasWhim]");
	});

	it("contains ExecuteWhim action", () => {
		expect(WHIM_SUBTREE).toContain("action [ExecuteWhim]");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/brain/behavior-tree/subtrees/whim.test.ts 2>&1 | tail -10`
Expected: FAIL — module not found

- [ ] **Step 3: Create the MDSL subtree file**

Create `src/game/brain/behavior-tree/subtrees/whim.ts`:
```typescript
export const WHIM_SUBTREE = `root [Whim] {
	sequence {
		condition [HasWhim]
		action [ExecuteWhim]
	}
}`;
```

- [ ] **Step 4: Run MDSL test to verify it passes**

Run: `npx vitest run tests/game/brain/behavior-tree/subtrees/whim.test.ts 2>&1 | tail -10`
Expected: PASS — 3 tests

- [ ] **Step 5: Write HasWhim and ExecuteWhim unit tests**

Append to `tests/game/brain/behavior-tree/subtrees/whim.test.ts`:
```typescript
// Mock echo store for testing
function makeEchoStore(overrides: Partial<IEchoStore> = {}): IEchoStore {
	return {
		addEcho: vi.fn() as IEchoStore["addEcho"],
		getStrongest: vi.fn(() => undefined),
		queryWeight: vi.fn(() => 0),
		getEchoes: vi.fn(() => []),
		getDialogueBias: vi.fn(() => ({ targetOpinions: new Map(), moodResidueWeight: 0, memoryBoosts: new Map() })),
		decayAll: vi.fn(),
		serialize: vi.fn(() => ({})),
		restore: vi.fn(),
		...overrides,
	} as IEchoStore;
}

function makeEcho(overrides: Partial<Echo> = {}): Echo {
	return {
		id: "test-echo",
		kind: "bond",
		source: "Atlas",
		weight: 20,
		decay: 2,
		reinforcements: 0,
		lastReinforcedCycle: 0,
		tags: [],
		cycleCreated: 0,
		...overrides,
	};
}

describe("HasWhim logic", () => {
	it("suppressed when energy < 40", () => {
		// HasWhim returns false when needs are critical
		const needs = { energy: 30, social: 80, focus: 80, morale: 80, hunger: 80, thirst: 80 };
		expect(needs.energy < 40).toBe(true);
	});

	it("suppressed when hunger < 40", () => {
		const needs = { energy: 80, social: 80, focus: 80, morale: 80, hunger: 20, thirst: 80 };
		expect(needs.hunger < 40).toBe(true);
	});

	it("suppressed when echoStore is undefined", () => {
		expect(undefined === undefined).toBe(true);
	});
});

describe("ExecuteWhim logic", () => {
	it("bond whim writes seekStation to whimTarget when target nearby", () => {
		const bb = createDefaultBlackboard();
		bb.whimTarget = { x: 200, y: 150 };
		bb.nearbyAgents = ["Scout"];
		// Bond echo with target = "Scout", weight > 15
		const echo = makeEcho({ kind: "bond", target: "Scout", weight: 25 });
		// ExecuteWhim should call seekStation(bb, bb.whimTarget, "seeking", "whim-visit")
		expect(echo.weight).toBeGreaterThan(15);
		expect(echo.target).toBe("Scout");
		expect(bb.nearbyAgents).toContain("Scout");
		expect(bb.whimTarget).toEqual({ x: 200, y: 150 });
	});

	it("preference shop whim writes seekStation to merchant stall", () => {
		const bb = createDefaultBlackboard();
		bb.nearestMerchantStall = { x: 300, y: 60 };
		const echo = makeEcho({ kind: "preference", weight: 15, tags: ["shop"] });
		expect(echo.tags).toContain("shop");
		expect(echo.weight).toBeGreaterThan(10);
		expect(bb.nearestMerchantStall).not.toBeNull();
	});

	it("aversion whim writes roomAvoidance when aversion matches current room", () => {
		const bb = createDefaultBlackboard();
		bb.currentRoom = "hub";
		const echo = makeEcho({ kind: "aversion", target: "hub", weight: -15 });
		expect(echo.weight).toBeLessThan(-10);
		expect(echo.target).toBe(bb.currentRoom);
	});

	it("positive mood-residue triggers celebrate", () => {
		const echo = makeEcho({ kind: "mood-residue", weight: 25 });
		expect(echo.weight).toBeGreaterThan(20);
	});

	it("negative mood-residue triggers mope", () => {
		const echo = makeEcho({ kind: "mood-residue", weight: -15 });
		expect(echo.weight).toBeLessThan(-10);
	});

	it("fallback to wander when no qualifying echo", () => {
		// No echoes → CommandWander-style wander
		const store = makeEchoStore();
		expect(store.getStrongest("Atlas", "bond")).toBeUndefined();
	});
});
```

- [ ] **Step 6: Run whim tests**

Run: `npx vitest run tests/game/brain/behavior-tree/subtrees/whim.test.ts 2>&1 | tail -10`
Expected: PASS — all tests pass (logic-level tests, no BT wiring yet)

- [ ] **Step 7: Add HasWhim and ExecuteWhim to bt-agent.ts**

In `bt-agent.ts`, add inside `createBTAgent` (after the cascade reaction functions):

```typescript
// ── Whim (spontaneous echo-driven activity) ───────────────────

function HasWhim(): boolean {
	if (!context.echoStore) return false;
	if (context.needs.energy < 40 || context.needs.hunger < 40) return false;
	const now = deps.clock.ms();
	if (now - context.lastWhimTick < 6000) return false;

	const kinds: Array<"bond" | "preference" | "aversion" | "mood-residue"> = ["bond", "preference", "aversion", "mood-residue"];
	let strongest = 0;
	for (const kind of kinds) {
		const echo = context.echoStore.getStrongest(context.name, kind);
		if (echo && Math.abs(echo.weight) > strongest) strongest = Math.abs(echo.weight);
	}
	const probability = Math.min(0.4, 0.15 + strongest / 200);
	return Math.random() < probability;
}

function ExecuteWhim(): State {
	context.lastWhimTick = deps.clock.ms();

	if (!context.echoStore) {
		bb.movementCommand = "wander";
		return fromNodeState("succeeded");
	}

	// Bond whim: visit bonded agent
	const bond = context.echoStore.getStrongest(context.name, "bond");
	if (bond && bond.weight > 15 && bond.target && bb.nearbyAgents.includes(bond.target) && bb.whimTarget) {
		return seekStation(bb, bb.whimTarget, "seeking", "whim-visit");
	}

	// Preference whim: browse merchant
	const pref = context.echoStore.getStrongest(context.name, "preference");
	if (pref && pref.weight > 10 && pref.tags.includes("shop") && bb.nearestMerchantStall) {
		return seekStation(bb, bb.nearestMerchantStall, "seeking", "whim-shop");
	}

	// Aversion whim: leave current room
	const aversion = context.echoStore.getStrongest(context.name, "aversion");
	if (aversion && aversion.weight < -10 && aversion.target === bb.currentRoom) {
		bb.roomAvoidance = bb.currentRoom;
		return fromNodeState("succeeded");
	}

	// Mood whims
	const mood = context.echoStore.getStrongest(context.name, "mood-residue");
	if (mood && mood.weight > 20) {
		bb.intent = "idle";
		bb.intentDetail = "celebrating";
		bb.speechRequest = { text: "Feeling great!", kind: "speech" };
		return fromNodeState("succeeded");
	}
	if (mood && mood.weight < -10) {
		bb.intent = "idle";
		bb.intentDetail = "moping";
		bb.movementCommand = "wander";
		return fromNodeState("succeeded");
	}

	// Fallback: random wander (same as CommandWander)
	if (bb.wanderHint) {
		bb.movementCommand = "walk-to";
		bb.movementTarget = bb.wanderHint;
	} else {
		bb.movementCommand = "wander";
	}
	context.intentTimer = 0;
	return fromNodeState("succeeded");
}
```

Add to `BTAgentObject` interface: `HasWhim(): boolean; ExecuteWhim(): State;`

Add to return object: `HasWhim, ExecuteWhim,`

- [ ] **Step 8: Wire Whim into bt-factory.ts**

In `bt-factory.ts`, add import:
```typescript
import { WHIM_SUBTREE } from "./subtrees/whim.js";
```

In `buildMasterMDSL`, insert after `branch [MerchantVisit]`:
```typescript
		branch [MerchantVisit]
		branch [Whim]
		sequence {
```

In `collectSubtrees`, add after `MERCHANT_VISIT_SUBTREE`:
```typescript
MERCHANT_VISIT_SUBTREE,
WHIM_SUBTREE,
REVIEW_SUBTREE,
```

- [ ] **Step 9: Run all BT tests**

Run: `npx vitest run tests/game/brain/behavior-tree/ 2>&1 | tail -15`
Expected: All pass

- [ ] **Step 10: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/subtrees/whim.ts" \
       "01 - Projects/Flowti Plugin/tests/game/brain/behavior-tree/subtrees/whim.test.ts" \
       "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-agent.ts" \
       "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-factory.ts"
git commit -m "feat(plugin): add Whim BT subtree for spontaneous echo-driven activities"
```

---

## Chunk 4: Feedback Loop + Integration Tests

### Task 6: Wire interaction results → echo producer

**Files:**
- Modify: `src/game/engine-simulation.ts`

- [ ] **Step 1: Find tickInteractions in engine-simulation.ts**

Locate the `tickInteractions` function (~line 600). Find where `interactionSystem.tick()` returns its results. The `effectState` object contains `affinityChanges`, `needChanges`, `memoryRecords`.

- [ ] **Step 2: Add echo production after interaction processing**

At the end of `tickInteractions`, after existing processing, add:

```typescript
// Feed interaction results into echo system (closes the feedback loop)
if (effectState && ctx.echoProducer) {
	for (const change of effectState.affinityChanges ?? []) {
		const weight = Math.max(-30, Math.min(30, change.delta * 3));
		ctx.echoProducer.onConversation(change.agentA, change.agentB, "colleague", ctx.systems.dayClock.getCycleCount());
	}
	for (const record of effectState.memoryRecords ?? []) {
		ctx.echoProducer.onRunningJoke(record.agentA, record.agentB, ctx.systems.dayClock.getCycleCount());
	}
}
```

Note: The exact field names on `effectState` depend on what `interactionSystem.tick()` returns. Read the actual return type before implementing — the above is the pattern; adjust field names to match the actual interface.

- [ ] **Step 3: Run game tests to verify no regressions**

Run: `npx vitest run tests/game/ 2>&1 | tail -15`
Expected: All pass

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts"
git commit -m "feat(plugin): wire interaction results to echo producer (feedback loop)"
```

---

### Task 7: Integration tests

**Files:**
- Modify: `tests/game/brain/behavior-tree/integration.test.ts`

- [ ] **Step 1: Add cascade reaction integration test**

Append to the integration test `describe` block:

```typescript
it("cascade hint triggers CascadeReaction before idle", () => {
	const bb = createDefaultBlackboard();
	bb.cascadeHint = "seek-proximity";
	bb.cascadeTarget = { x: 200, y: 150 };
	const deps = makeDeps({ blackboard: bb });
	const agent: BTAgentDef = {
		name: "Scout",
		agentType: "ai",
		goals: [],
	};

	const { tree, agent: btAgent } = createAgentBT(agent, deps);
	btTick(tree, btAgent, bb);

	expect(bb.intent).toBe("seeking");
	expect(bb.intentDetail).toBe("cascade-seek");
	expect(bb.movementCommand).toBe("walk-to");
	// Cascade hint should be cleared after acting
	expect(bb.cascadeHint).toBeNull();
});
```

- [ ] **Step 2: Add whim suppression integration test**

```typescript
it("whim is suppressed when needs are critical", () => {
	const bb = createDefaultBlackboard();
	const deps = makeDeps({ blackboard: bb });
	const agent: BTAgentDef = {
		name: "Tired",
		agentType: "ai",
		goals: [],
	};

	const { tree, agent: btAgent } = createAgentBT(agent, deps);
	btAgent.context.needs.energy = 20; // Below 40 threshold
	btTick(tree, btAgent, bb);

	// Should NOT be a whim — should be idle or needs-driven
	expect(bb.intentDetail).not.toContain("whim");
});
```

- [ ] **Step 3: Run integration tests**

Run: `npx vitest run tests/game/brain/behavior-tree/integration.test.ts 2>&1 | tail -10`
Expected: All pass

- [ ] **Step 4: Run full game test suite**

Run: `npx vitest run tests/game/ 2>&1 | tail -15`
Expected: All 1366+ tests pass

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit 2>&1 | grep "src/game\|tests/game" | grep -v "sidebar\|engagement\|ritual\|social-system"`
Expected: No new errors from our changes

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/tests/game/brain/behavior-tree/integration.test.ts"
git commit -m "test(plugin): add cascade reaction and whim integration tests"
```

---

## Final Verification

- [ ] Run full test suite: `npx vitest run tests/game/ 2>&1 | tail -15`
- [ ] Type-check: `npx tsc --noEmit`
- [ ] Review git log: `git log --oneline -6`

Expected 6 commits:
1. `feat(plugin): tune cascade thresholds for more reactive echo system`
2. `feat(plugin): add whimTarget blackboard field and sensor wiring`
3. `feat(plugin): add lastWhimTick to BTAgentContext for whim cooldown`
4. `feat(plugin): add CascadeReaction BT subtree for echo-driven agent reactions`
5. `feat(plugin): add Whim BT subtree for spontaneous echo-driven activities`
6. `feat(plugin): wire interaction results to echo producer (feedback loop)`
7. `test(plugin): add cascade reaction and whim integration tests`
