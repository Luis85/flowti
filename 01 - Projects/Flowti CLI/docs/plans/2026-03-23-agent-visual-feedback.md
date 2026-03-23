# Agent Visual Feedback System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a layered visual feedback system where agents telegraph intent, show consumption payoff, react to their surroundings, and face toward points of interest — driven by urgency levels and Ninja Adventure sprites.

**Architecture:** A pure-logic `VisualFeedbackSystem` reads blackboard state transitions each frame and emits typed visual commands via callbacks. A thin render adapter in engine-lifecycle translates those commands into ExcaliburJS actor operations. New fields on the blackboard (`facingDirection`, `urgencySpeedBoost`, `lastIntentTransition`) connect the system to existing locomotion and rendering pipelines.

**Tech Stack:** TypeScript, ExcaliburJS (rendering), Vitest (testing), Ninja Adventure asset pack (sprites)

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-23-agent-visual-feedback-design.md`

**Test command:** `cd "01 - Projects/Flowti Plugin" && npx vitest run <test-file>`

**All source paths are relative to:** `01 - Projects/Flowti Plugin/`

---

## Chunk 1: Foundation

### Task 1: Extend AgentBlackboard with Visual Feedback Fields

**Files:**
- Modify: `src/game/systems/blackboard.ts` (lines 38-72 interface, lines 76-101 defaults)
- Test: `tests/game/systems/blackboard.test.ts`

- [ ] **Step 1: Write the failing test**

In `tests/game/systems/blackboard.test.ts`, add a new describe block:

```typescript
describe("visual feedback blackboard fields", () => {
	it("createDefaultBlackboard includes visual feedback defaults", () => {
		const bb = createDefaultBlackboard();
		expect(bb.facingDirection).toBe("right");
		expect(bb.urgencySpeedBoost).toBe(1.0);
		expect(bb.lastIntentTransition).toBeNull();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/blackboard.test.ts -t "visual feedback"`
Expected: FAIL — `facingDirection` does not exist on type

- [ ] **Step 3: Add fields to AgentBlackboard interface**

In `src/game/systems/blackboard.ts`, add after `speechRequest` (line 71):

```typescript
	// ── Written by visual feedback system ────────────
	facingDirection: "left" | "right";
	urgencySpeedBoost: number;
	lastIntentTransition: {
		from: string;
		to: string;
		timestamp: number;
	} | null;
```

- [ ] **Step 4: Add defaults to createDefaultBlackboard()**

In `createDefaultBlackboard()`, add before the closing brace:

```typescript
		facingDirection: "right",
		urgencySpeedBoost: 1.0,
		lastIntentTransition: null,
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/game/systems/blackboard.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Run full game test suite to check nothing broke**

Run: `npx vitest run tests/game/systems/blackboard.test.ts`
Expected: ALL PASS (existing tests unaffected — additive change)

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/blackboard.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/blackboard.test.ts"
git commit -m "feat(plugin): add visual feedback fields to blackboard"
```

---

### Task 2: Create Visual Feedback Presets

**Files:**
- Create: `src/game/systems/visual-feedback-presets.ts`
- Test: `tests/game/systems/visual-feedback-presets.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/game/systems/visual-feedback-presets.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
	URGENCY_THRESHOLDS,
	TIMING,
	COOLDOWNS,
	INTENT_SPRITES,
	ITEM_POP_SPRITES,
	URGENCY_SPEED_MULTIPLIERS,
	resolveThreshold,
} from "../../../../src/game/systems/visual-feedback-presets.js";

describe("visual-feedback-presets", () => {
	it("URGENCY_THRESHOLDS defines hunger and thirst with base values", () => {
		expect(URGENCY_THRESHOLDS.hunger.base).toBe(35);
		expect(URGENCY_THRESHOLDS.thirst.base).toBe(30);
	});

	it("URGENCY_THRESHOLDS includes quirk overrides", () => {
		expect(URGENCY_THRESHOLDS.hunger.quirks?.snacker).toBe(50);
		expect(URGENCY_THRESHOLDS.thirst.quirks?.["coffee-addict"]).toBe(45);
	});

	it("resolveThreshold returns base when no matching quirk", () => {
		expect(resolveThreshold("hunger", [])).toBe(35);
		expect(resolveThreshold("hunger", ["coffee-addict"])).toBe(35);
	});

	it("resolveThreshold returns quirk override when matched", () => {
		expect(resolveThreshold("hunger", ["snacker"])).toBe(50);
		expect(resolveThreshold("thirst", ["coffee-addict"])).toBe(45);
	});

	it("TIMING defines telegraph durations", () => {
		expect(TIMING.thoughtBubbleDuration).toBe(1500);
		expect(TIMING.intentIconFadeMs).toBe(200);
		expect(TIMING.itemPopDurationMs).toBe(600);
		expect(TIMING.satisfactionEmoteDurationMs).toBe(1500);
		expect(TIMING.satisfactionDelayMs).toBe(400);
		expect(TIMING.sparkBurstDurationMs).toBe(500);
	});

	it("COOLDOWNS defines all cooldown values", () => {
		expect(COOLDOWNS.payoffCooldownMs).toBe(3000);
		expect(COOLDOWNS.ambientEmoteMinMs).toBe(8000);
		expect(COOLDOWNS.ambientEmoteMaxMs).toBe(15000);
		expect(COOLDOWNS.proximityPairCooldownMs).toBe(15000);
		expect(COOLDOWNS.longIdleCooldownMs).toBe(45000);
		expect(COOLDOWNS.longIdleThresholdMs).toBe(60000);
		expect(COOLDOWNS.roomEntryLookDurationMs).toBe(600);
		expect(COOLDOWNS.facingTransitionDelayMs).toBe(200);
	});

	it("INTENT_SPRITES maps intent details to sprite paths", () => {
		expect(INTENT_SPRITES["seek-food"]).toBe("assets/Items/Food/Onigiri.png");
		expect(INTENT_SPRITES["seek-drink"]).toBe("assets/Items/Potion/WaterPot.png");
		expect(INTENT_SPRITES["seek-merchant"]).toBe("assets/Items/Treasure/GoldCoin.png");
	});

	it("ITEM_POP_SPRITES provides arrays for random selection", () => {
		expect(ITEM_POP_SPRITES.hunger.length).toBeGreaterThanOrEqual(3);
		expect(ITEM_POP_SPRITES.thirst.length).toBeGreaterThanOrEqual(2);
	});

	it("URGENCY_SPEED_MULTIPLIERS defines low/medium/high", () => {
		expect(URGENCY_SPEED_MULTIPLIERS.low).toBe(1.0);
		expect(URGENCY_SPEED_MULTIPLIERS.medium).toBe(1.2);
		expect(URGENCY_SPEED_MULTIPLIERS.high).toBe(1.4);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/visual-feedback-presets.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create the presets file**

Create `src/game/systems/visual-feedback-presets.ts`:

```typescript
/**
 * visual-feedback-presets.ts — Constants for the visual feedback system.
 *
 * All urgency thresholds, timing values, sprite paths, and cooldown
 * durations live here. Tuning visual behavior means editing this file,
 * not the system logic.
 */

// ── Urgency Thresholds ───────────────────────────────────────────

export interface ThresholdEntry {
	readonly base: number;
	readonly quirks?: Readonly<Record<string, number>>;
}

export const URGENCY_THRESHOLDS: Readonly<Record<string, ThresholdEntry>> = {
	hunger: { base: 35, quirks: { snacker: 50 } },
	thirst: { base: 30, quirks: { "coffee-addict": 45 } },
	energy: { base: 30 },
	social: { base: 30 },
};

/** Resolve effective threshold for a need, checking agent quirks for overrides. */
export function resolveThreshold(need: string, quirks: readonly string[]): number {
	const entry = URGENCY_THRESHOLDS[need];
	if (!entry) return 50;
	if (entry.quirks) {
		for (const q of quirks) {
			if (entry.quirks[q] !== undefined) return entry.quirks[q];
		}
	}
	return entry.base;
}

/** Compute urgency 0..1 from a need value and its effective threshold. */
export function computeUrgency(needValue: number, threshold: number): number {
	return Math.max(0, Math.min(1, 1 - needValue / threshold));
}

/** Classify urgency into a tier. */
export type UrgencyTier = "low" | "medium" | "high";

export function classifyUrgency(urgency: number): UrgencyTier {
	if (urgency >= 0.6) return "high";
	if (urgency >= 0.3) return "medium";
	return "low";
}

// ── Timing ───────────────────────────────────────────────────────

export const TIMING = {
	thoughtBubbleDuration: 1500,
	intentIconFadeMs: 200,
	itemPopDurationMs: 600,
	satisfactionEmoteDurationMs: 1500,
	satisfactionDelayMs: 400,
	sparkBurstDurationMs: 500,
} as const;

// ── Cooldowns ────────────────────────────────────────────────────

export const COOLDOWNS = {
	payoffCooldownMs: 3000,
	ambientEmoteMinMs: 8000,
	ambientEmoteMaxMs: 15000,
	proximityPairCooldownMs: 15000,
	longIdleCooldownMs: 45000,
	longIdleThresholdMs: 60000,
	roomEntryLookDurationMs: 600,
	facingTransitionDelayMs: 200,
} as const;

// ── Sprite Paths ─────────────────────────────────────────────────

export const INTENT_SPRITES: Readonly<Record<string, string>> = {
	"seek-food": "assets/Items/Food/Onigiri.png",
	"seek-preferred-food": "assets/Items/Food/Onigiri.png",
	"seek-drink": "assets/Items/Potion/WaterPot.png",
	"seek-preferred-drink": "assets/Items/Potion/WaterPot.png",
	"seek-work": "assets/Items/Object/Book.png",
	"seek-merchant": "assets/Items/Treasure/GoldCoin.png",
};

export const ITEM_POP_SPRITES = {
	hunger: [
		"assets/Items/Food/Onigiri.png",
		"assets/Items/Food/Fish.png",
		"assets/Items/Food/Sushi.png",
	],
	thirst: [
		"assets/Items/Potion/WaterPot.png",
		"assets/Items/Potion/MilkPot.png",
	],
	merchant: [
		"assets/Items/Treasure/GoldCoin.png",
	],
} as const;

export const URGENCY_SPEED_MULTIPLIERS = {
	low: 1.0,
	medium: 1.2,
	high: 1.4,
} as const;

// ── Emote Indices (Ninja Adventure emote sprites) ────────────────

export const EMOTE_INDICES = {
	happy: [3, 5],
	concerned: [8, 7],
	distressed: [10, 12],
	sleep: 7,
	determined: [15, 20],
	alert: 12,
} as const;

// ── Idle Awareness Thresholds ────────────────────────────────────

export const IDLE_AWARENESS = {
	proximityTriggerPx: 40,
	facingInterestRadiusPx: 60,
	nearStationRadiusPx: 40,
	lowEnergyThreshold: 40,
	lowMoraleThreshold: 30,
	highSocialNeedThreshold: 30,
	highFocusThreshold: 80,
} as const;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/systems/visual-feedback-presets.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/visual-feedback-presets.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/visual-feedback-presets.test.ts"
git commit -m "feat(plugin): add visual feedback presets constants"
```

---

## Chunk 2: Existing System Extensions

### Task 3: Add triggerEmote() to EmoteSystem

**Files:**
- Modify: `src/game/systems/emote-system.ts` (add method after line 43)
- Test: `tests/game/systems/emote-system.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/game/systems/emote-system.test.ts`:

```typescript
describe("triggerEmote", () => {
	it("fires callback with specified emote index", () => {
		const system = new EmoteSystem();
		const fired: Array<{ name: string; index: number }> = [];
		system.onEmote((name, index) => fired.push({ name, index }));
		system.register("Atlas", "neutral", 10_000);

		system.triggerEmote("Atlas", 5);

		expect(fired).toEqual([{ name: "Atlas", index: 5 }]);
	});

	it("does nothing for unregistered agent", () => {
		const system = new EmoteSystem();
		const fired: Array<{ name: string; index: number }> = [];
		system.onEmote((name, index) => fired.push({ name, index }));

		system.triggerEmote("Unknown", 5);

		expect(fired).toHaveLength(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/emote-system.test.ts -t "triggerEmote"`
Expected: FAIL — triggerEmote is not a function

- [ ] **Step 3: Add triggerEmote() method**

In `src/game/systems/emote-system.ts`, add after `offEmote()` (after line 43):

```typescript
	/** Fire a specific emote index for an agent, bypassing mood mapping. */
	triggerEmote(agentName: string, emoteIndex: number): void {
		if (!this.entries.has(agentName)) return;
		this.callback?.(agentName, emoteIndex);
	}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/systems/emote-system.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/emote-system.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/emote-system.test.ts"
git commit -m "feat(plugin): add triggerEmote() to EmoteSystem"
```

---

### Task 4: Add Icon Mode to BubbleSystem

**Files:**
- Modify: `src/game/actors/bubble-actor.ts` (lines 26-33 config, lines 107-160 rendering)
- Modify: `src/game/systems/bubble-system.ts` (lines 63-110 showBubble signature)
- Test: `tests/game/actors/bubble-actor.test.ts`
- Test: `tests/game/systems/bubble-system.test.ts`

- [ ] **Step 1: Write the failing test for BubbleActorConfig icon field**

Add to `tests/game/actors/bubble-actor.test.ts`:

```typescript
describe("icon mode", () => {
	it("accepts optional iconPath in config", () => {
		const bubble = new BubbleActor({
			text: "food",
			kind: "thought",
			x: 0,
			y: 0,
			iconPath: "assets/Items/Food/Onigiri.png",
		});
		expect(bubble).toBeDefined();
	});

	it("renders without error when iconPath is set but text is empty", () => {
		const bubble = new BubbleActor({
			text: "",
			kind: "thought",
			x: 0,
			y: 0,
			iconPath: "assets/Items/Food/Onigiri.png",
		});
		expect(bubble).toBeDefined();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/actors/bubble-actor.test.ts -t "icon mode"`
Expected: FAIL — iconPath does not exist on BubbleActorConfig

- [ ] **Step 3: Add iconPath to BubbleActorConfig**

In `src/game/actors/bubble-actor.ts`, extend the config interface (line 26-33):

```typescript
export interface BubbleActorConfig {
	readonly text: string;
	readonly kind: BubbleKind;
	readonly x: number;
	readonly y: number;
	readonly duration?: number;
	readonly scale?: number;
	readonly iconPath?: string;
}
```

Store it in the constructor:

```typescript
private readonly iconPath: string | undefined;
```

And in the constructor body, add: `this.iconPath = config.iconPath;`

The canvas rendering in `buildGraphic()` does not need to load the sprite at construction time — the icon path is stored for future use by the render adapter. The actual sprite is drawn by the adapter that has access to pre-loaded textures. For now, the BubbleActor just needs to accept and store the field. (A follow-up in the wiring task will connect the pre-loaded sprite cache.)

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/actors/bubble-actor.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Add iconPath pass-through in BubbleSystem.showBubble()**

In `src/game/systems/bubble-system.ts`, extend `showBubble()` signature (line 63):

```typescript
showBubble(
	agentName: string,
	kind: BubbleKind,
	text: string,
	_scene: unknown,
	getActor: (name: string) => ex.Actor | undefined,
	duration: number = DEFAULT_DURATION,
	priority?: boolean,
	iconPath?: string,
): void
```

And pass it through to BubbleActor construction (around line 95):

```typescript
const bubble = new BubbleActor({
	text, kind, x: 0, y: localY,
	duration, scale: 1 / AGENT_SCALE,
	iconPath,
});
```

- [ ] **Step 6: Write test for showBubble with iconPath**

Add to `tests/game/systems/bubble-system.test.ts`:

```typescript
it("showBubble passes iconPath through to BubbleActor", () => {
	// showBubble should not throw when iconPath is provided
	const system = new BubbleSystem();
	const mockActor = { addChild: vi.fn() } as unknown as ex.Actor;
	system.register("Atlas", "neutral", 10_000);

	expect(() => {
		system.showBubble("Atlas", "thought", "food", null, () => mockActor, 1500, false, "assets/Items/Food/Onigiri.png");
	}).not.toThrow();
});
```

- [ ] **Step 7: Run all bubble tests**

Run: `npx vitest run tests/game/actors/bubble-actor.test.ts tests/game/systems/bubble-system.test.ts`
Expected: ALL PASS

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/actors/bubble-actor.ts" \
       "01 - Projects/Flowti Plugin/src/game/systems/bubble-system.ts" \
       "01 - Projects/Flowti Plugin/tests/game/actors/bubble-actor.test.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/bubble-system.test.ts"
git commit -m "feat(plugin): add icon mode to BubbleSystem"
```

---

### Task 5: Extend ParticlePool with Sprite Burst

**Files:**
- Modify: `src/game/systems/particle-system.ts` (add spriteBurst method + sprite presets)
- Test: `tests/game/systems/particle-system.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/game/systems/particle-system.test.ts`:

```typescript
describe("spriteBurst", () => {
	it("spawns sprite particles up to the sprite cap", () => {
		const pool = new ParticlePool();
		pool.spriteBurst({
			preset: "sprite-sparkle",
			x: 100,
			y: 200,
		});
		const spriteParticles = pool.getAll().filter((p) => p.sprite !== undefined);
		expect(spriteParticles.length).toBeGreaterThan(0);
		expect(spriteParticles.length).toBeLessThanOrEqual(8);
	});

	it("respects global sprite particle cap of 30", () => {
		const pool = new ParticlePool();
		for (let i = 0; i < 10; i++) {
			pool.spriteBurst({ preset: "sprite-sparkle", x: i * 10, y: 0 });
		}
		const spriteParticles = pool.getAll().filter((p) => p.sprite !== undefined);
		expect(spriteParticles.length).toBeLessThanOrEqual(30);
	});

	it("supports all sprite preset names", () => {
		const pool = new ParticlePool();
		const presets = ["sprite-sparkle", "sprite-smoke", "sprite-heart", "sprite-aura", "sprite-leaf"] as const;
		for (const preset of presets) {
			expect(() => pool.spriteBurst({ preset, x: 50, y: 50 })).not.toThrow();
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/particle-system.test.ts -t "spriteBurst"`
Expected: FAIL — spriteBurst is not a function

- [ ] **Step 3: Add sprite particle types and presets**

In `src/game/systems/particle-system.ts`, extend the Particle interface to include an optional `sprite` field:

```typescript
sprite?: string; // sprite asset path for sprite-based particles
```

Add the sprite preset type union (extend existing ParticlePreset):

```typescript
export type SpritePreset = "sprite-sparkle" | "sprite-smoke" | "sprite-heart" | "sprite-aura" | "sprite-leaf";
```

Add sprite preset configs:

```typescript
const SPRITE_PRESET_CONFIGS: Record<SpritePreset, {
	readonly count: number;
	readonly lifetime: number;
	readonly speed: number;
	readonly spread: number;
	readonly sprite: string;
}> = {
	"sprite-sparkle": { count: 6, lifetime: 500, speed: 30, spread: 15, sprite: "assets/FX/Magic/Spark/SpriteSheet.png" },
	"sprite-smoke": { count: 3, lifetime: 300, speed: 10, spread: 10, sprite: "assets/FX/Smoke/SpriteSheet.png" },
	"sprite-heart": { count: 2, lifetime: 600, speed: 15, spread: 12, sprite: "assets/Items/Potion/Heart.png" },
	"sprite-aura": { count: 1, lifetime: 800, speed: 0, spread: 0, sprite: "assets/FX/Magic/Aura/SpriteSheet.png" },
	"sprite-leaf": { count: 4, lifetime: 500, speed: 20, spread: 20, sprite: "assets/FX/Particle/Leaf.png" },
};

const MAX_SPRITE_PARTICLES = 30;
```

- [ ] **Step 4: Add spriteBurst() method to ParticlePool**

Add to the ParticlePool class:

```typescript
/** Sprite particle count (tracked separately from circle particles). */
private spriteParticleCount = 0;

/** Spawn a burst of sprite-based particles at a position. */
spriteBurst(opts: { preset: SpritePreset; x: number; y: number }): void {
	const config = SPRITE_PRESET_CONFIGS[opts.preset];
	if (!config) return;
	const toSpawn = Math.min(config.count, MAX_SPRITE_PARTICLES - this.spriteParticleCount);
	for (let i = 0; i < toSpawn; i++) {
		const angle = (Math.PI * 2 * i) / config.count;
		const ox = Math.cos(angle) * config.spread * Math.random();
		const oy = Math.sin(angle) * config.spread * Math.random();
		this.particles.push({
			x: opts.x + ox,
			y: opts.y + oy,
			vx: Math.cos(angle) * config.speed,
			vy: Math.sin(angle) * config.speed - 10,
			life: config.lifetime,
			maxLife: config.lifetime,
			color: "#ffffff",
			radius: 3,
			sprite: config.sprite,
		});
		this.spriteParticleCount++;
	}
}
```

Update `update()` to decrement `spriteParticleCount` when sprite particles expire:

```typescript
// In the particle removal loop, before splice:
if (p.sprite) this.spriteParticleCount--;
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/game/systems/particle-system.test.ts`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/particle-system.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/particle-system.test.ts"
git commit -m "feat(plugin): add sprite-based particle bursts to ParticlePool"
```

---

### Task 6: Add urgencySpeedBoost to Locomotion

**Files:**
- Modify: `src/game/systems/locomotion-system.ts` (line 118-122 speed calculation)
- Modify: `src/game/engine-simulation.ts` (tickLocomotion — pass boost from blackboard)
- Test: `tests/game/systems/locomotion-system.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/game/systems/locomotion-system.test.ts`:

```typescript
describe("urgencySpeedBoost", () => {
	it("multiplies movement speed by urgencySpeedBoost", () => {
		const system = new LocomotionSystem();
		const entry = createEntry({ x: 0, y: 0 }, "walk-to", { x: 100, y: 0 });
		entry.urgencySpeedBoost = 1.4;

		system.updateAgent(entry, 1000);

		// With boost 1.4, agent should have moved further than base speed
		expect(entry.position.x).toBeGreaterThan(0);
		// Compare: without boost at default speed 40, 1s = 40px
		// With boost 1.4: 40 * 1.4 = 56px
		expect(entry.position.x).toBeCloseTo(56, 0);
	});

	it("defaults to 1.0 when urgencySpeedBoost is undefined", () => {
		const system = new LocomotionSystem();
		const entry = createEntry({ x: 0, y: 0 }, "walk-to", { x: 100, y: 0 });
		// No urgencySpeedBoost set

		system.updateAgent(entry, 1000);

		expect(entry.position.x).toBeCloseTo(40, 0);
	});
});
```

Note: `createEntry` is a test helper that needs to include the `urgencySpeedBoost` field. Check if one already exists in the test file; if so, extend it. If not, create a minimal one.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/locomotion-system.test.ts -t "urgencySpeedBoost"`
Expected: FAIL — urgencySpeedBoost not on LocomotionEntry / movement distance wrong

- [ ] **Step 3: Add urgencySpeedBoost to LocomotionEntry**

In `src/game/systems/locomotion-system.ts`, add to the `LocomotionEntry` interface:

```typescript
urgencySpeedBoost?: number;
```

- [ ] **Step 4: Apply boost in speed calculation**

Modify the speed calculation (around line 118-119):

```typescript
const speedMult = SPEED_MAP[entry.movementStyle] ?? 1.0;
const urgencyBoost = entry.urgencySpeedBoost ?? 1.0;
const speed = entry.speed * speedMult * urgencyBoost * (deltaMs / 1000);
```

- [ ] **Step 5: Pass urgencySpeedBoost from blackboard in tickLocomotion**

In `src/game/engine-simulation.ts`, in the `tickLocomotion` function where the locomotion entry is built from blackboard data, add:

```typescript
entry.urgencySpeedBoost = bb.urgencySpeedBoost;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/game/systems/locomotion-system.test.ts tests/game/engine-simulation.test.ts`
Expected: ALL PASS

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/locomotion-system.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/locomotion-system.test.ts"
git commit -m "feat(plugin): apply urgencySpeedBoost in locomotion"
```

---

### Task 7: Add Directional Facing to AgentActor

**Files:**
- Modify: `src/game/actors/agent-actor.ts` (onPreUpdate + remove setWalkDirection stub)
- Test: `tests/game/actors/agent-actor.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/game/actors/agent-actor.test.ts`:

```typescript
describe("facingDirection", () => {
	it("flips sprite horizontally when facingDirection is left", () => {
		const actor = createTestAgentActor();
		actor.applyFacing("left");
		expect(actor.graphics.flipHorizontal).toBe(true);
	});

	it("does not flip sprite when facingDirection is right", () => {
		const actor = createTestAgentActor();
		actor.applyFacing("right");
		expect(actor.graphics.flipHorizontal).toBe(false);
	});
});
```

Note: check how tests currently create AgentActor instances — use the existing factory/helper. The `applyFacing()` method is a public method we're adding that's called from `onPreUpdate()`.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/actors/agent-actor.test.ts -t "facingDirection"`
Expected: FAIL — applyFacing is not a function

- [ ] **Step 3: Add applyFacing() method and remove setWalkDirection stub**

In `src/game/actors/agent-actor.ts`:

1. Remove the `setWalkDirection()` stub (lines 152-154).

2. Add the `applyFacing()` method:

```typescript
/** Apply directional facing from blackboard. */
applyFacing(direction: "left" | "right"): void {
	this.graphics.flipHorizontal = direction === "left";
}
```

3. In `onPreUpdate()`, add a call that reads from the blackboard (this will be connected in the wiring task — for now just add the method):

```typescript
// At the end of onPreUpdate, after existing visual updates:
// facingDirection is applied by the visual feedback render adapter
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/actors/agent-actor.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/actors/agent-actor.ts" \
       "01 - Projects/Flowti Plugin/tests/game/actors/agent-actor.test.ts"
git commit -m "feat(plugin): add directional facing to AgentActor"
```

---

## Chunk 3: New Actors

### Task 8: Create IntentIconActor

**Files:**
- Create: `src/game/actors/intent-icon-actor.ts`
- Test: `tests/game/actors/intent-icon-actor.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/game/actors/intent-icon-actor.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("excalibur", () => ({
	Actor: class MockActor {
		pos = { x: 0, y: 0 };
		z = 0;
		scale = { x: 1, y: 1 };
		graphics = { opacity: 1, use: vi.fn() };
		actions = { fade: vi.fn().mockReturnThis(), die: vi.fn().mockReturnThis() };
		kill = vi.fn();
		constructor(opts?: Record<string, unknown>) {
			if (opts) Object.assign(this.pos, { x: opts.x ?? 0, y: opts.y ?? 0 });
			if (opts?.z) this.z = opts.z as number;
		}
	},
	vec: (x: number, y: number) => ({ x, y }),
}));

import { IntentIconActor } from "../../../../src/game/actors/intent-icon-actor.js";

describe("IntentIconActor", () => {
	it("creates at the specified offset position", () => {
		const icon = new IntentIconActor("assets/Items/Food/Onigiri.png");
		expect(icon.pos.x).toBe(8);
		expect(icon.pos.y).toBe(-14);
	});

	it("starts with zero opacity for fade-in", () => {
		const icon = new IntentIconActor("assets/Items/Food/Onigiri.png");
		expect(icon.graphics.opacity).toBe(0);
	});

	it("stores the sprite path", () => {
		const icon = new IntentIconActor("assets/Items/Food/Onigiri.png");
		expect(icon.spritePath).toBe("assets/Items/Food/Onigiri.png");
	});

	it("updates bob offset over time", () => {
		const icon = new IntentIconActor("assets/Items/Food/Onigiri.png");
		const initialY = icon.pos.y;
		icon.tickBob(500);
		// Bob should modify y slightly (sine wave)
		// At 500ms into a 2000ms period, sin(pi/2) = 1, offset = 1px
		expect(icon.pos.y).not.toBe(initialY);
	});

	it("fadeIn sets opacity to 1", () => {
		const icon = new IntentIconActor("assets/Items/Food/Onigiri.png");
		icon.fadeIn();
		// After fadeIn, opacity target should be 1 (via actions)
		expect(icon.actions.fade).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/actors/intent-icon-actor.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create IntentIconActor**

Create `src/game/actors/intent-icon-actor.ts`:

```typescript
/**
 * intent-icon-actor.ts — Floating item sprite above an agent during seek intent.
 *
 * Added as a child of the agent actor. Fades in on intent start,
 * bobs gently, fades out on arrival or intent change.
 */

import * as ex from "excalibur";

const OFFSET_X = 8;
const OFFSET_Y = -14;
const BOB_AMPLITUDE = 1;
const BOB_PERIOD_MS = 2000;
const FADE_DURATION_MS = 200;
const ICON_Z = 35;

export class IntentIconActor extends ex.Actor {
	readonly spritePath: string;
	private bobPhase = 0;
	private readonly baseY: number;

	constructor(spritePath: string) {
		super({ x: OFFSET_X, y: OFFSET_Y, z: ICON_Z });
		this.spritePath = spritePath;
		this.baseY = OFFSET_Y;
		this.graphics.opacity = 0;
	}

	/** Apply a pre-loaded sprite to this actor. Called by render adapter. */
	applySprite(sprite: ex.Sprite): void {
		const scaled = sprite.clone();
		scaled.scale = ex.vec(0.5, 0.5);
		this.graphics.use(scaled);
	}

	/** Advance the bob animation. Called each frame by the render adapter. */
	tickBob(deltaMs: number): void {
		this.bobPhase += deltaMs;
		const t = (this.bobPhase % BOB_PERIOD_MS) / BOB_PERIOD_MS;
		this.pos.y = this.baseY + Math.sin(t * Math.PI * 2) * BOB_AMPLITUDE;
	}

	fadeIn(): void {
		this.actions.fade(1, FADE_DURATION_MS);
	}

	fadeOut(thenKill = true): void {
		const chain = this.actions.fade(0, FADE_DURATION_MS);
		if (thenKill) chain.die();
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/actors/intent-icon-actor.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/actors/intent-icon-actor.ts" \
       "01 - Projects/Flowti Plugin/tests/game/actors/intent-icon-actor.test.ts"
git commit -m "feat(plugin): add IntentIconActor for floating intent sprites"
```

---

### Task 9: Create ItemPopActor

**Files:**
- Create: `src/game/actors/item-pop-actor.ts`
- Test: `tests/game/actors/item-pop-actor.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/game/actors/item-pop-actor.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("excalibur", () => ({
	Actor: class MockActor {
		pos = { x: 0, y: 0 };
		z = 0;
		graphics = { opacity: 1, use: vi.fn() };
		actions = {
			moveBy: vi.fn().mockReturnThis(),
			fade: vi.fn().mockReturnThis(),
			die: vi.fn().mockReturnThis(),
			callMethod: vi.fn().mockReturnThis(),
		};
		kill = vi.fn();
		constructor(opts?: Record<string, unknown>) {
			if (opts) {
				this.pos.x = (opts.x as number) ?? 0;
				this.pos.y = (opts.y as number) ?? 0;
			}
		}
	},
	vec: (x: number, y: number) => ({ x, y }),
	EasingFunctions: { EaseOutCubic: (t: number) => t },
}));

import { ItemPopActor } from "../../../../src/game/actors/item-pop-actor.js";

describe("ItemPopActor", () => {
	it("creates at specified station position", () => {
		const pop = new ItemPopActor("assets/Items/Food/Onigiri.png", 100, 200);
		expect(pop.pos.x).toBe(100);
		expect(pop.pos.y).toBe(200);
	});

	it("stores the sprite path", () => {
		const pop = new ItemPopActor("assets/Items/Food/Fish.png", 0, 0);
		expect(pop.spritePath).toBe("assets/Items/Food/Fish.png");
	});

	it("starts the float-and-fade animation on play()", () => {
		const pop = new ItemPopActor("assets/Items/Food/Onigiri.png", 50, 50);
		pop.play();
		expect(pop.actions.moveBy).toHaveBeenCalled();
		expect(pop.actions.fade).toHaveBeenCalled();
	});

	it("self-destructs after animation", () => {
		const pop = new ItemPopActor("assets/Items/Food/Onigiri.png", 50, 50);
		pop.play();
		expect(pop.actions.die).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/actors/item-pop-actor.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create ItemPopActor**

Create `src/game/actors/item-pop-actor.ts`:

```typescript
/**
 * item-pop-actor.ts — Item sprite that floats up from a station on consumption.
 *
 * Spawned at station position, floats up 20px over 600ms with ease-out,
 * fades to transparent, then self-destructs.
 */

import * as ex from "excalibur";

const FLOAT_DISTANCE = -20;
const FLOAT_DURATION_MS = 600;
const ITEM_POP_Z = 40;

export class ItemPopActor extends ex.Actor {
	readonly spritePath: string;

	constructor(spritePath: string, x: number, y: number) {
		super({ x, y, z: ITEM_POP_Z });
		this.spritePath = spritePath;
	}

	/** Apply a pre-loaded sprite. Called by render adapter before play(). */
	applySprite(sprite: ex.Sprite): void {
		const scaled = sprite.clone();
		scaled.scale = ex.vec(0.5, 0.5);
		this.graphics.use(scaled);
	}

	/** Start the float-up-and-fade animation. Self-destructs on completion. */
	play(): void {
		this.actions
			.moveBy(ex.vec(0, FLOAT_DISTANCE), FLOAT_DURATION_MS)
			.fade(0, FLOAT_DURATION_MS)
			.die();
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/actors/item-pop-actor.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/actors/item-pop-actor.ts" \
       "01 - Projects/Flowti Plugin/tests/game/actors/item-pop-actor.test.ts"
git commit -m "feat(plugin): add ItemPopActor for consumption payoff"
```

---

## Chunk 4: Core System

### Task 10: Create VisualFeedbackSystem

This is the largest task. The system is pure logic — no ExcaliburJS imports. It reads blackboard state, detects transitions, computes urgency, and emits visual commands via callbacks.

**Files:**
- Create: `src/game/systems/visual-feedback-system.ts`
- Test: `tests/game/systems/visual-feedback-system.test.ts`

- [ ] **Step 1: Write tests for intent transition detection**

Create `tests/game/systems/visual-feedback-system.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { VisualFeedbackSystem } from "../../../../src/game/systems/visual-feedback-system.js";
import { createDefaultBlackboard, type AgentBlackboard } from "../../../../src/game/systems/blackboard.js";

function makeBB(overrides: Partial<AgentBlackboard> = {}): AgentBlackboard {
	return { ...createDefaultBlackboard(), ...overrides };
}

describe("VisualFeedbackSystem — intent transitions", () => {
	let system: VisualFeedbackSystem;
	let callbacks: {
		onShowIntentIcon: ReturnType<typeof vi.fn>;
		onHideIntentIcon: ReturnType<typeof vi.fn>;
		onThoughtBubble: ReturnType<typeof vi.fn>;
		onEmoteFlash: ReturnType<typeof vi.fn>;
		onFacingChange: ReturnType<typeof vi.fn>;
	};

	beforeEach(() => {
		callbacks = {
			onShowIntentIcon: vi.fn(),
			onHideIntentIcon: vi.fn(),
			onThoughtBubble: vi.fn(),
			onEmoteFlash: vi.fn(),
			onFacingChange: vi.fn(),
		};
		system = new VisualFeedbackSystem(callbacks);
	});

	it("detects idle-to-seeking transition", () => {
		const bb = makeBB({ intent: "idle", intentDetail: "" });
		system.register("Atlas", []);
		system.tick("Atlas", bb, 0, 16);

		// Now change to seeking
		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 25;
		bb.movementTarget = { x: 100, y: 50 };
		bb.position = { x: 0, y: 0 };
		system.tick("Atlas", bb, 16, 16);

		expect(bb.lastIntentTransition).toEqual({
			from: "idle:",
			to: "seeking:seek-food",
			timestamp: 16,
		});
	});

	it("emits onFacingChange toward target on intent start", () => {
		const bb = makeBB({ intent: "idle" });
		system.register("Atlas", []);
		system.tick("Atlas", bb, 0, 16);

		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 25;
		bb.movementTarget = { x: -50, y: 0 };
		bb.position = { x: 0, y: 0 };
		system.tick("Atlas", bb, 16, 16);

		expect(callbacks.onFacingChange).toHaveBeenCalledWith("Atlas", "left");
	});

	it("emits onFacingChange right when target is to the right", () => {
		const bb = makeBB({ intent: "idle" });
		system.register("Atlas", []);
		system.tick("Atlas", bb, 0, 16);

		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 25;
		bb.movementTarget = { x: 100, y: 0 };
		bb.position = { x: 0, y: 0 };
		system.tick("Atlas", bb, 16, 16);

		expect(callbacks.onFacingChange).toHaveBeenCalledWith("Atlas", "right");
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/game/systems/visual-feedback-system.test.ts -t "intent transitions"`
Expected: FAIL — module not found

- [ ] **Step 3: Create minimal VisualFeedbackSystem with transition detection**

Create `src/game/systems/visual-feedback-system.ts`:

```typescript
/**
 * visual-feedback-system.ts — Presentation director for agent visual feedback.
 *
 * Pure logic — no ExcaliburJS imports. Reads blackboard state each frame,
 * detects intent transitions, computes urgency, and emits typed visual
 * commands via callbacks. A thin render adapter translates these into
 * ExcaliburJS actor operations.
 */

import type { AgentBlackboard } from "./blackboard.js";
import {
	resolveThreshold,
	computeUrgency,
	classifyUrgency,
	INTENT_SPRITES,
	ITEM_POP_SPRITES,
	TIMING,
	COOLDOWNS,
	URGENCY_SPEED_MULTIPLIERS,
	EMOTE_INDICES,
	IDLE_AWARENESS,
	type UrgencyTier,
} from "./visual-feedback-presets.js";

// ── Callback types ───────────────────────────────────────────────

export interface VisualFeedbackCallbacks {
	onShowIntentIcon: (agentName: string, spritePath: string, position: { x: number; y: number }) => void;
	onHideIntentIcon: (agentName: string) => void;
	onItemPop: (agentName: string, spritePath: string, fromPos: { x: number; y: number }) => void;
	onParticleBurst: (preset: string, position: { x: number; y: number }) => void;
	onEmoteFlash: (agentName: string, emoteIndex: number) => void;
	onThoughtBubble: (agentName: string, text: string, iconPath?: string, duration?: number) => void;
	onFacingChange: (agentName: string, direction: "left" | "right") => void;
}

// ── Per-agent visual state ───────────────────────────────────────

interface AgentVisualState {
	quirks: readonly string[];
	lastIntent: string;
	lastIntentDetail: string;
	intentIconShowing: boolean;
	lastPayoffTimestamp: number;
	lastAmbientEmoteTimestamp: number;
	ambientEmoteCooldown: number;
	idleSinceTimestamp: number;
	longIdleFired: boolean;
	previousRoom: string;
	lastFacingDirection: "left" | "right";
	lastFacingChangeTimestamp: number;
	proximityCooldowns: Map<string, number>;
	activeVisualPriority: number; // 0=none, 1=ambient, 2=contextual, 3=intent
	activeVisualUntil: number;    // timestamp when active visual expires
}

function createAgentVisualState(quirks: readonly string[]): AgentVisualState {
	return {
		quirks,
		lastIntent: "idle",
		lastIntentDetail: "",
		intentIconShowing: false,
		lastPayoffTimestamp: -Infinity,
		lastAmbientEmoteTimestamp: -Infinity,
		ambientEmoteCooldown: randomCooldown(),
		idleSinceTimestamp: 0,
		longIdleFired: false,
		previousRoom: "",
		lastFacingDirection: "right",
		lastFacingChangeTimestamp: 0,
		proximityCooldowns: new Map(),
		activeVisualPriority: 0,
		activeVisualUntil: 0,
	};
}

function randomCooldown(): number {
	return COOLDOWNS.ambientEmoteMinMs + Math.random() * (COOLDOWNS.ambientEmoteMaxMs - COOLDOWNS.ambientEmoteMinMs);
}

// ── System ───────────────────────────────────────────────────────

export class VisualFeedbackSystem {
	private readonly agents = new Map<string, AgentVisualState>();
	private readonly cb: Partial<VisualFeedbackCallbacks>;

	constructor(callbacks: Partial<VisualFeedbackCallbacks>) {
		this.cb = callbacks;
	}

	register(agentName: string, quirks: readonly string[]): void {
		if (!this.agents.has(agentName)) {
			this.agents.set(agentName, createAgentVisualState(quirks));
		}
	}

	unregister(agentName: string): void {
		this.agents.delete(agentName);
	}

	/**
	 * Tick one agent's visual feedback. Called once per frame per agent.
	 * @param now - current simulation time in ms
	 * @param deltaMs - frame delta in ms
	 */
	tick(agentName: string, bb: AgentBlackboard, now: number, deltaMs: number): void {
		const state = this.agents.get(agentName);
		if (!state) return;

		const intentKey = `${bb.intent}:${bb.intentDetail}`;
		const prevIntentKey = `${state.lastIntent}:${state.lastIntentDetail}`;
		const transitioned = intentKey !== prevIntentKey;

		// ── Phase 1: Intent telegraph ────────────────────
		if (transitioned) {
			this.handleIntentTransition(agentName, bb, state, now);
		}

		// ── Phase 2: Arrival payoff ──────────────────────
		const isSeekDetail = bb.intentDetail.includes("food") || bb.intentDetail.includes("drink") || bb.intentDetail.includes("merchant");
		if (bb.arrived && isSeekDetail && bb.intent === "seeking") {
			this.handleArrivalPayoff(agentName, bb, state, now);
		}

		// ── Phase 3: Urgency speed boost ─────────────────
		this.updateUrgencySpeed(bb, state);

		// ── Phase 4: Idle micro-actions ──────────────────
		if (bb.intent === "idle" || bb.intent === "on-break" || bb.intent === "waiting") {
			this.handleIdleBehavior(agentName, bb, state, now, deltaMs);
		} else {
			state.idleSinceTimestamp = now;
			state.longIdleFired = false;
		}

		// ── Phase 5: Room transition ─────────────────────
		if (bb.currentRoom && bb.currentRoom !== state.previousRoom && state.previousRoom !== "") {
			this.handleRoomTransition(agentName, bb, state, now);
		}
		state.previousRoom = bb.currentRoom;

		// ── Bookkeeping ──────────────────────────────────
		state.lastIntent = bb.intent;
		state.lastIntentDetail = bb.intentDetail;

		// Record transition on blackboard
		if (transitioned) {
			bb.lastIntentTransition = {
				from: prevIntentKey,
				to: intentKey,
				timestamp: now,
			};
		}
	}

	// ── Intent telegraph ─────────────────────────────────────────

	private handleIntentTransition(
		agentName: string,
		bb: AgentBlackboard,
		state: AgentVisualState,
		now: number,
	): void {
		// Hide any existing intent icon
		if (state.intentIconShowing) {
			this.cb.onHideIntentIcon?.(agentName);
			state.intentIconShowing = false;
		}

		// Only telegraph seeking intents
		if (bb.intent !== "seeking") return;

		// Determine urgency from the need driving this seek
		const tier = this.resolveUrgencyTier(bb, state);

		// Face toward target
		if (bb.movementTarget) {
			const dir = bb.movementTarget.x < bb.position.x ? "left" : "right";
			this.cb.onFacingChange?.(agentName, dir);
			bb.facingDirection = dir;
			state.lastFacingDirection = dir;
			state.lastFacingChangeTimestamp = now;
		}

		// Resolve intent sprite
		const baseDetail = bb.intentDetail.split(":")[0];
		const spritePath = INTENT_SPRITES[baseDetail] ?? INTENT_SPRITES[bb.intentDetail];

		// Telegraph based on urgency tier
		if (tier === "low" && spritePath) {
			// Thought bubble with icon, then show intent icon
			this.cb.onThoughtBubble?.(agentName, "", spritePath, TIMING.thoughtBubbleDuration);
			if (spritePath) {
				this.cb.onShowIntentIcon?.(agentName, spritePath, bb.position);
				state.intentIconShowing = true;
			}
		} else if (tier === "medium" || tier === "high") {
			// Emote flash (concerned or distressed)
			const emotes = tier === "high" ? EMOTE_INDICES.distressed : EMOTE_INDICES.concerned;
			const idx = Array.isArray(emotes) ? emotes[Math.floor(Math.random() * emotes.length)] : emotes;
			this.cb.onEmoteFlash?.(agentName, idx);

			// Show intent icon
			if (spritePath) {
				this.cb.onShowIntentIcon?.(agentName, spritePath, bb.position);
				state.intentIconShowing = true;
			}

			// High urgency: smoke puff
			if (tier === "high") {
				this.cb.onParticleBurst?.("sprite-smoke", bb.position);
			}
		}

		state.activeVisualPriority = 3;
		state.activeVisualUntil = now + TIMING.thoughtBubbleDuration;
	}

	// ── Arrival payoff ───────────────────────────────────────────

	private handleArrivalPayoff(
		agentName: string,
		bb: AgentBlackboard,
		state: AgentVisualState,
		now: number,
	): void {
		// Cooldown check
		if (now - state.lastPayoffTimestamp < COOLDOWNS.payoffCooldownMs) return;

		// Hide intent icon
		this.cb.onHideIntentIcon?.(agentName);
		state.intentIconShowing = false;

		// Determine which item sprites to use
		const detail = bb.intentDetail;
		let pool: readonly string[] | undefined;
		if (detail.includes("food")) pool = ITEM_POP_SPRITES.hunger;
		else if (detail.includes("drink")) pool = ITEM_POP_SPRITES.thirst;
		else if (detail.includes("merchant")) pool = ITEM_POP_SPRITES.merchant;

		if (pool && pool.length > 0) {
			const sprite = pool[Math.floor(Math.random() * pool.length)];
			this.cb.onItemPop?.(agentName, sprite, bb.position);
		}

		// Satisfaction emote + sparkle (delayed by TIMING.satisfactionDelayMs)
		// The render adapter handles the delay; we emit both now with timing metadata
		const happyEmotes = EMOTE_INDICES.happy;
		const emoteIdx = happyEmotes[Math.floor(Math.random() * happyEmotes.length)];
		this.cb.onEmoteFlash?.(agentName, emoteIdx);
		this.cb.onParticleBurst?.("sprite-sparkle", bb.position);
		this.cb.onParticleBurst?.("sprite-heart", bb.position);

		state.lastPayoffTimestamp = now;
		state.activeVisualPriority = 3;
		state.activeVisualUntil = now + TIMING.satisfactionEmoteDurationMs + TIMING.satisfactionDelayMs;
	}

	// ── Urgency speed ────────────────────────────────────────────

	private updateUrgencySpeed(bb: AgentBlackboard, state: AgentVisualState): void {
		if (bb.intent !== "seeking") {
			bb.urgencySpeedBoost = 1.0;
			return;
		}
		const tier = this.resolveUrgencyTier(bb, state);
		bb.urgencySpeedBoost = URGENCY_SPEED_MULTIPLIERS[tier];
	}

	// ── Idle behavior ────────────────────────────────────────────

	private handleIdleBehavior(
		agentName: string,
		bb: AgentBlackboard,
		state: AgentVisualState,
		now: number,
		_deltaMs: number,
	): void {
		// Skip if higher-priority visual is still active (time-based expiry)
		if (state.activeVisualPriority >= 2 && now < state.activeVisualUntil) {
			return;
		}
		if (now >= state.activeVisualUntil) {
			state.activeVisualPriority = 0;
		}

		const idleDuration = now - state.idleSinceTimestamp;

		// Long idle (> 60s): sleep emote
		if (idleDuration > COOLDOWNS.longIdleThresholdMs && !state.longIdleFired) {
			this.cb.onEmoteFlash?.(agentName, EMOTE_INDICES.sleep);
			state.longIdleFired = true;
			state.lastAmbientEmoteTimestamp = now;
			return;
		}

		// Ambient emotes on cooldown
		if (now - state.lastAmbientEmoteTimestamp < state.ambientEmoteCooldown) return;

		// Context-driven ambient emotes
		if (bb.needs.energy < IDLE_AWARENESS.lowEnergyThreshold) {
			this.cb.onEmoteFlash?.(agentName, EMOTE_INDICES.sleep);
			this.cb.onThoughtBubble?.(agentName, "zzz", undefined, 1500);
		} else if (bb.needs.morale < IDLE_AWARENESS.lowMoraleThreshold) {
			const emotes = EMOTE_INDICES.distressed;
			this.cb.onEmoteFlash?.(agentName, emotes[Math.floor(Math.random() * emotes.length)]);
		} else if (bb.needs.social < IDLE_AWARENESS.highSocialNeedThreshold && bb.nearbyAgents.length > 0) {
			this.cb.onEmoteFlash?.(agentName, EMOTE_INDICES.alert);
			// Face toward nearest agent (approximation — face right if any nearby)
			this.cb.onFacingChange?.(agentName, "right");
		} else if (bb.needs.focus > IDLE_AWARENESS.highFocusThreshold) {
			const emotes = EMOTE_INDICES.determined;
			this.cb.onEmoteFlash?.(agentName, emotes[Math.floor(Math.random() * emotes.length)]);
		}

		state.lastAmbientEmoteTimestamp = now;
		state.ambientEmoteCooldown = randomCooldown();
		state.activeVisualPriority = 1;
	}

	// ── Room transition ──────────────────────────────────────────

	private handleRoomTransition(
		agentName: string,
		bb: AgentBlackboard,
		_state: AgentVisualState,
		_now: number,
	): void {
		this.cb.onParticleBurst?.("sprite-leaf", bb.position);
		// Face left then right (the render adapter handles the timing)
		this.cb.onFacingChange?.(agentName, "left");
	}

	// ── Helpers ──────────────────────────────────────────────────

	private resolveUrgencyTier(bb: AgentBlackboard, state: AgentVisualState): UrgencyTier {
		const detail = bb.intentDetail;
		let need: number;
		let needKey: string;

		if (detail.includes("food")) {
			need = bb.needs.hunger;
			needKey = "hunger";
		} else if (detail.includes("drink")) {
			need = bb.needs.thirst;
			needKey = "thirst";
		} else {
			return "low";
		}

		const threshold = resolveThreshold(needKey, state.quirks);
		const urgency = computeUrgency(need, threshold);
		return classifyUrgency(urgency);
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/game/systems/visual-feedback-system.test.ts`
Expected: ALL PASS

- [ ] **Step 5: Write tests for urgency calculation**

Add to `tests/game/systems/visual-feedback-system.test.ts`:

```typescript
describe("VisualFeedbackSystem — urgency", () => {
	let system: VisualFeedbackSystem;
	let callbacks: Record<string, ReturnType<typeof vi.fn>>;

	beforeEach(() => {
		callbacks = {
			onShowIntentIcon: vi.fn(),
			onHideIntentIcon: vi.fn(),
			onThoughtBubble: vi.fn(),
			onEmoteFlash: vi.fn(),
			onFacingChange: vi.fn(),
			onItemPop: vi.fn(),
			onParticleBurst: vi.fn(),
		};
		system = new VisualFeedbackSystem(callbacks);
	});

	it("low urgency (hunger 30) shows thought bubble", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "idle" });
		system.tick("Atlas", bb, 0, 16);

		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 30;
		bb.movementTarget = { x: 100, y: 0 };
		system.tick("Atlas", bb, 16, 16);

		expect(callbacks.onThoughtBubble).toHaveBeenCalled();
	});

	it("high urgency (hunger 5) shows distressed emote + smoke", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "idle" });
		system.tick("Atlas", bb, 0, 16);

		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 5;
		bb.movementTarget = { x: 100, y: 0 };
		system.tick("Atlas", bb, 16, 16);

		expect(callbacks.onEmoteFlash).toHaveBeenCalled();
		expect(callbacks.onParticleBurst).toHaveBeenCalledWith("sprite-smoke", expect.any(Object));
	});

	it("sets urgencySpeedBoost on blackboard based on urgency tier", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "seeking", intentDetail: "seek-food" });
		bb.needs.hunger = 5; // high urgency
		bb.movementTarget = { x: 100, y: 0 };
		system.tick("Atlas", bb, 0, 16);

		expect(bb.urgencySpeedBoost).toBe(1.4);
	});

	it("resets urgencySpeedBoost to 1.0 when not seeking", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "idle" });
		bb.urgencySpeedBoost = 1.4;
		system.tick("Atlas", bb, 0, 16);

		expect(bb.urgencySpeedBoost).toBe(1.0);
	});

	it("uses quirk-adjusted threshold for snacker agents", () => {
		system.register("Atlas", ["snacker"]);
		const bb = makeBB({ intent: "idle" });
		system.tick("Atlas", bb, 0, 16);

		// hunger 30 with snacker threshold 50: urgency = 1 - 30/50 = 0.4 → medium
		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 30;
		bb.movementTarget = { x: 100, y: 0 };
		system.tick("Atlas", bb, 16, 16);

		// Medium urgency: emote flash, no thought bubble
		expect(callbacks.onEmoteFlash).toHaveBeenCalled();
		expect(callbacks.onThoughtBubble).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 6: Run urgency tests**

Run: `npx vitest run tests/game/systems/visual-feedback-system.test.ts -t "urgency"`
Expected: ALL PASS

- [ ] **Step 7: Write tests for arrival payoff**

Add to the test file:

```typescript
describe("VisualFeedbackSystem — arrival payoff", () => {
	let system: VisualFeedbackSystem;
	let callbacks: Record<string, ReturnType<typeof vi.fn>>;

	beforeEach(() => {
		callbacks = {
			onShowIntentIcon: vi.fn(),
			onHideIntentIcon: vi.fn(),
			onThoughtBubble: vi.fn(),
			onEmoteFlash: vi.fn(),
			onFacingChange: vi.fn(),
			onItemPop: vi.fn(),
			onParticleBurst: vi.fn(),
		};
		system = new VisualFeedbackSystem(callbacks);
	});

	it("emits item pop and satisfaction emote on arrival at food station", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "idle" });
		system.tick("Atlas", bb, 0, 16);

		// Transition to seeking
		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 25;
		bb.movementTarget = { x: 100, y: 50 };
		system.tick("Atlas", bb, 16, 16);

		// Arrive
		bb.arrived = true;
		system.tick("Atlas", bb, 1000, 16);

		expect(callbacks.onHideIntentIcon).toHaveBeenCalledWith("Atlas");
		expect(callbacks.onItemPop).toHaveBeenCalled();
		expect(callbacks.onEmoteFlash).toHaveBeenCalled();
		expect(callbacks.onParticleBurst).toHaveBeenCalledWith("sprite-sparkle", expect.any(Object));
	});

	it("respects payoff cooldown (3s)", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "idle" });
		system.tick("Atlas", bb, 0, 16);

		// First arrival
		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 25;
		bb.movementTarget = { x: 100, y: 50 };
		system.tick("Atlas", bb, 16, 16);
		bb.arrived = true;
		system.tick("Atlas", bb, 1000, 16);
		callbacks.onItemPop.mockClear();

		// Second arrival too soon (< 3s)
		bb.arrived = false;
		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		system.tick("Atlas", bb, 1500, 16);
		bb.arrived = true;
		system.tick("Atlas", bb, 2000, 16);

		expect(callbacks.onItemPop).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 8: Run arrival payoff tests**

Run: `npx vitest run tests/game/systems/visual-feedback-system.test.ts -t "arrival payoff"`
Expected: ALL PASS

- [ ] **Step 9: Write tests for idle micro-actions**

Add to the test file:

```typescript
describe("VisualFeedbackSystem — idle behavior", () => {
	let system: VisualFeedbackSystem;
	let callbacks: Record<string, ReturnType<typeof vi.fn>>;

	beforeEach(() => {
		callbacks = {
			onShowIntentIcon: vi.fn(),
			onHideIntentIcon: vi.fn(),
			onThoughtBubble: vi.fn(),
			onEmoteFlash: vi.fn(),
			onFacingChange: vi.fn(),
			onItemPop: vi.fn(),
			onParticleBurst: vi.fn(),
		};
		system = new VisualFeedbackSystem(callbacks);
	});

	it("emits sleep emote when idle for > 60s", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "idle" });

		// First tick sets idle start
		system.tick("Atlas", bb, 0, 16);
		callbacks.onEmoteFlash.mockClear();

		// Tick at 61s
		system.tick("Atlas", bb, 61_000, 16);

		expect(callbacks.onEmoteFlash).toHaveBeenCalledWith("Atlas", 7); // sleep emote
	});

	it("emits low energy zzz when energy is low during idle", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "idle" });
		bb.needs.energy = 20;

		system.tick("Atlas", bb, 0, 16);
		// Wait past ambient cooldown (at least 15s)
		system.tick("Atlas", bb, 16_000, 16);

		expect(callbacks.onThoughtBubble).toHaveBeenCalledWith("Atlas", "zzz", undefined, 1500);
	});

	it("emits leaf particles on room transition", () => {
		system.register("Atlas", []);
		const bb = makeBB({ intent: "idle", currentRoom: "hub" });
		system.tick("Atlas", bb, 0, 16);

		bb.currentRoom = "village";
		system.tick("Atlas", bb, 16, 16);

		expect(callbacks.onParticleBurst).toHaveBeenCalledWith("sprite-leaf", expect.any(Object));
	});
});
```

- [ ] **Step 10: Run idle tests**

Run: `npx vitest run tests/game/systems/visual-feedback-system.test.ts -t "idle behavior"`
Expected: ALL PASS

- [ ] **Step 11: Run full test suite**

Run: `npx vitest run tests/game/systems/visual-feedback-system.test.ts`
Expected: ALL PASS

- [ ] **Step 12: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/visual-feedback-system.ts" \
       "01 - Projects/Flowti Plugin/tests/game/systems/visual-feedback-system.test.ts"
git commit -m "feat(plugin): add VisualFeedbackSystem core logic"
```

---

## Chunk 5: Wiring & Integration

### Task 11: Wire VisualFeedbackSystem into Engine

**Files:**
- Modify: `src/game/engine-simulation.ts` (tickVisuals phase)
- Modify: `src/game/engine-lifecycle.ts` (instantiation + render adapter)

- [ ] **Step 1: Add VisualFeedbackSystem to simulation context**

In `src/game/engine-simulation.ts`, import the system and add it to the simulation context type. Then in `tickVisuals()`, iterate all registered agents and call `system.tick()` per agent before the existing engagement/talk systems.

```typescript
// In tickVisuals, add before existing engagement/talk:
if (ctx.state.visualFeedback) {
	const bbManager = ctx.state.blackboards;
	for (const [name, bb] of bbManager.getAll()) {
		ctx.state.visualFeedback.tick(name, bb, ctx.clock.ms(), ctx.deltaMs);
	}
}
```

- [ ] **Step 2: Add render adapter in engine-lifecycle**

In `src/game/engine-lifecycle.ts`, during system initialization:

```typescript
import { VisualFeedbackSystem } from "./systems/visual-feedback-system.js";
import { IntentIconActor } from "./actors/intent-icon-actor.js";
import { ItemPopActor } from "./actors/item-pop-actor.js";

// Create system with render adapter callbacks
const visualFeedback = new VisualFeedbackSystem({
	onShowIntentIcon: (agentName, spritePath, _pos) => {
		const actor = getActor(agentName);
		if (!actor) return;
		const icon = new IntentIconActor(spritePath);
		const sprite = spriteCache.get(spritePath);
		if (sprite) icon.applySprite(sprite);
		actor.addChild(icon);
		icon.fadeIn();
	},
	onHideIntentIcon: (agentName) => {
		const actor = getActor(agentName);
		if (!actor) return;
		for (const child of actor.children) {
			if (child instanceof IntentIconActor) {
				(child as IntentIconActor).fadeOut(true);
			}
		}
	},
	onItemPop: (agentName, spritePath, fromPos) => {
		const pop = new ItemPopActor(spritePath, fromPos.x, fromPos.y);
		const sprite = spriteCache.get(spritePath);
		if (sprite) pop.applySprite(sprite);
		scene.add(pop);
		pop.play();
	},
	onParticleBurst: (preset, position) => {
		particlePool.spriteBurst({ preset, x: position.x, y: position.y });
	},
	onEmoteFlash: (agentName, emoteIndex) => {
		emoteSystem.triggerEmote(agentName, emoteIndex);
	},
	onThoughtBubble: (agentName, text, iconPath, duration) => {
		bubbleSystem.showBubble(agentName, "thought", text, scene, getActor, duration, false, iconPath);
	},
	onFacingChange: (agentName, direction) => {
		const bb = blackboards.tryGet(agentName);
		if (bb) bb.facingDirection = direction;
		const actor = getActor(agentName);
		if (actor && "applyFacing" in actor) {
			(actor as AgentActor).applyFacing(direction);
		}
	},
});

// Register all agents
for (const [name, _bb] of blackboards.getAll()) {
	const agentDef = getAgentDef(name);
	visualFeedback.register(name, agentDef?.quirks ?? []);
}
```

- [ ] **Step 3: Pre-load item/FX sprites at startup**

In `engine-lifecycle.ts`, during the asset loading phase:

```typescript
import { loadItemSprite } from "./sprites/sprite-loader.js";

// Pre-load visual feedback sprites
const PRELOAD_SPRITES = [
	"assets/Items/Food/Onigiri.png",
	"assets/Items/Food/Fish.png",
	"assets/Items/Food/Sushi.png",
	"assets/Items/Potion/WaterPot.png",
	"assets/Items/Potion/MilkPot.png",
	"assets/Items/Potion/Heart.png",
	"assets/Items/Object/Book.png",
	"assets/Items/Treasure/GoldCoin.png",
];

const spriteCache = new Map<string, ex.Sprite>();
for (const path of PRELOAD_SPRITES) {
	try {
		const sprite = await loadItemSprite(basePath, path);
		spriteCache.set(path, sprite);
	} catch {
		// Non-fatal: missing sprite just means no icon for that intent
	}
}
```

- [ ] **Step 4: Add facingDirection read in AgentActor.onPreUpdate()**

In `src/game/actors/agent-actor.ts`, at the end of `onPreUpdate()`:

```typescript
// Apply directional facing from blackboard
if (this.blackboard) {
	this.applyFacing(this.blackboard.facingDirection);
}
```

Note: check how AgentActor currently gets access to the blackboard — it may need a reference passed at construction or via a setter.

- [ ] **Step 5: Run full game test suite**

Run: `npx vitest run tests/game/`
Expected: ALL PASS (existing tests + new tests)

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts" \
       "01 - Projects/Flowti Plugin/src/game/engine-lifecycle.ts" \
       "01 - Projects/Flowti Plugin/src/game/actors/agent-actor.ts"
git commit -m "feat(plugin): wire VisualFeedbackSystem into engine"
```

---

### Task 12: Integration Test

**Files:**
- Create: `tests/game/systems/visual-feedback-integration.test.ts`

- [ ] **Step 1: Write integration test**

Create `tests/game/systems/visual-feedback-integration.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { VisualFeedbackSystem } from "../../../../src/game/systems/visual-feedback-system.js";
import { createDefaultBlackboard } from "../../../../src/game/systems/blackboard.js";

describe("VisualFeedbackSystem — integration", () => {
	it("full hunger cycle: idle → telegraph → walk → arrive → payoff", () => {
		const calls: string[] = [];
		const system = new VisualFeedbackSystem({
			onShowIntentIcon: () => calls.push("showIcon"),
			onHideIntentIcon: () => calls.push("hideIcon"),
			onItemPop: () => calls.push("itemPop"),
			onParticleBurst: (preset) => calls.push(`particles:${preset}`),
			onEmoteFlash: () => calls.push("emote"),
			onThoughtBubble: () => calls.push("thought"),
			onFacingChange: () => calls.push("facing"),
		});

		system.register("Atlas", []);
		const bb = createDefaultBlackboard();

		// Frame 1: idle (no visuals)
		system.tick("Atlas", bb, 0, 16);
		expect(calls).toEqual([]);

		// Frame 2: hunger drops, BT sets seeking
		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 25; // low urgency
		bb.movementTarget = { x: 200, y: 100 };
		system.tick("Atlas", bb, 16, 16);

		// Should see: facing + thought bubble + intent icon
		expect(calls).toContain("facing");
		expect(calls).toContain("thought");
		expect(calls).toContain("showIcon");

		// Frame 3-N: walking (no new visuals, speed boost active)
		calls.length = 0;
		system.tick("Atlas", bb, 500, 16);
		expect(bb.urgencySpeedBoost).toBe(1.0); // low urgency = no boost

		// Frame N+1: arrived
		bb.arrived = true;
		calls.length = 0;
		system.tick("Atlas", bb, 5000, 16);

		// Should see: hideIcon + itemPop + emote + sparkle + heart
		expect(calls).toContain("hideIcon");
		expect(calls).toContain("itemPop");
		expect(calls).toContain("emote");
		expect(calls).toContain("particles:sprite-sparkle");
		expect(calls).toContain("particles:sprite-heart");
	});

	it("high urgency cycle shows distressed emote + smoke + speed boost", () => {
		const calls: string[] = [];
		const system = new VisualFeedbackSystem({
			onShowIntentIcon: () => calls.push("showIcon"),
			onHideIntentIcon: () => calls.push("hideIcon"),
			onItemPop: () => calls.push("itemPop"),
			onParticleBurst: (preset) => calls.push(`particles:${preset}`),
			onEmoteFlash: () => calls.push("emote"),
			onThoughtBubble: () => calls.push("thought"),
			onFacingChange: () => calls.push("facing"),
		});

		system.register("Atlas", []);
		const bb = createDefaultBlackboard();
		system.tick("Atlas", bb, 0, 16);

		// Desperate hunger
		bb.intent = "seeking";
		bb.intentDetail = "seek-food";
		bb.needs.hunger = 5; // high urgency
		bb.movementTarget = { x: 200, y: 100 };
		system.tick("Atlas", bb, 16, 16);

		expect(calls).toContain("emote");
		expect(calls).toContain("particles:sprite-smoke");
		expect(calls).not.toContain("thought"); // no thought bubble at high urgency
		expect(bb.urgencySpeedBoost).toBe(1.4);
	});
});
```

- [ ] **Step 2: Run integration test**

Run: `npx vitest run tests/game/systems/visual-feedback-integration.test.ts`
Expected: ALL PASS

- [ ] **Step 3: Run full game test suite to verify nothing broke**

Run: `npx vitest run tests/game/`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/tests/game/systems/visual-feedback-integration.test.ts"
git commit -m "test(plugin): add visual feedback integration test"
```

- [ ] **Step 5: Build and verify**

Run: `cd "01 - Projects/Flowti Plugin" && npm run build`
Expected: Build succeeds with no errors

- [ ] **Step 6: Final commit (if build required changes)**

If the build revealed any issues, fix and commit.

---

## Implementation Notes & Corrections

These corrections address issues found during plan review. Apply them when implementing the corresponding tasks.

### Task 3 (EmoteSystem.triggerEmote)

- **Test file creation**: `tests/game/systems/emote-system.test.ts` does not exist yet. Create it with proper imports and a describe wrapper rather than "adding to" it.
- The `triggerEmote` implementation uses `this.entries`, not `this.agents` (already fixed in the plan above).

### Task 4 (BubbleSystem icon mode)

- **Test file creation**: `tests/game/actors/bubble-actor.test.ts` and `tests/game/systems/bubble-system.test.ts` do not exist. Create them.
- **BubbleSystem.register() signature**: The test uses `system.register("Atlas", "neutral", 10_000)` but `BubbleSystem.register()` takes `(name: string, personality: readonly string[], params: BrainParams)`. Use the correct signature with a `makeParams()` helper — check `bubble-system.ts` for the `BrainParams` shape.
- **showBubble() must be extended**: Task 4 Step 5 must add `iconPath?: string` as the 8th parameter to `showBubble()` in `bubble-system.ts` and pass it through to the `BubbleActor` constructor. This is critical for the Task 11 render adapter to work.

### Task 5 (ParticlePool sprite burst)

- **Test file creation**: `tests/game/systems/particle-system.test.ts` does not exist. Create it.
- **Particle interface field names**: The existing `Particle` interface uses `lifetime` and `age`, NOT `life` and `maxLife`. The `spriteBurst()` push call must use:
  ```typescript
  this.particles.push({
      x: opts.x + ox, y: opts.y + oy,
      vx: Math.cos(angle) * config.speed,
      vy: Math.sin(angle) * config.speed - 10,
      lifetime: config.lifetime,
      age: 0,
      opacity: 1,
      startOpacity: 1,
      color: "#ffffff",
      radius: 3,
      sprite: config.sprite,
  });
  ```
- **Extend Particle interface first**: Add `sprite?: string` to the `Particle` interface BEFORE writing the spriteBurst test, otherwise TypeScript will reject `p.sprite` in the filter.
- In `update()`, decrement sprite count when `p.sprite` particles expire: `if (p.sprite) this.spriteParticleCount--;`

### Task 6 (urgencySpeedBoost in locomotion)

- **LocomotionSystem constructor requires bounds**: Tests must pass bounds: `new LocomotionSystem({ minX: 0, maxX: 800, minY: 0, maxY: 600 })`.
- **Use existing test helper**: The test file uses `createLocomotionEntry()` (from source), not a custom `createEntry` helper. Use:
  ```typescript
  const entry = createLocomotionEntry({
      command: "walk-to",
      target: { x: 100, y: 0 },
      position: { x: 0, y: 0 },
  });
  entry.urgencySpeedBoost = 1.4;
  ```
- **Speed boost goes in TWO places**: (a) Add `urgencySpeedBoost?: number` to the `LocomotionEntry` interface in `locomotion-system.ts`, and multiply it into the speed calc there. (b) In `tickLocomotion()` in `engine-simulation.ts`, pass `bb.urgencySpeedBoost` when building the locomotion entry.

### Task 7 (AgentActor facing)

- **Agent actor test mock**: The existing test mock's `graphics` object lacks `flipHorizontal`. Add `flipHorizontal: false` to the mock.
- **Define `applyFacing()` method**: The method must be added to `AgentActor`:
  ```typescript
  applyFacing(direction: "left" | "right"): void {
      this.graphics.flipHorizontal = direction === "left";
  }
  ```
- **Remove `setWalkDirection()` stub** (line 152-154) — it's a no-op that will be replaced by blackboard-driven facing.

### Task 10 (VisualFeedbackSystem)

- **Arrival payoff trigger**: Changed from `bb.arrived && state.intentIconShowing` to `bb.arrived && isSeekDetail && bb.intent === "seeking"` (already fixed in the plan above).
- **Priority decay**: Changed from frame-count decrement to time-based expiry using `activeVisualUntil` timestamp (already fixed in the plan above).
- **Add `computeUrgency` and `classifyUrgency` unit tests** to the presets test file (Task 2) — these functions are tested indirectly through Task 10 but deserve direct coverage.

### Task 11 (Engine Wiring) — MAJOR CORRECTIONS

The wiring code must use the actual engine context shape:

1. **Context field names**: Use `ctx.systems.blackboards` (not `ctx.state.blackboards`), `ctx.state.deltaMs` (not `ctx.deltaMs`). There is no `ctx.clock` — use `ctx.state.elapsedMs` or track time manually.

2. **Add VisualFeedbackSystem to `EngineSystems`**: In `src/game/engine-types.ts`, add `visualFeedback?: VisualFeedbackSystem` to the systems interface. This is where the system reference lives, not on `state`.

3. **tickVisuals insertion**: The corrected tick code is:
   ```typescript
   if (ctx.systems.visualFeedback) {
       for (const [name, bb] of ctx.systems.blackboards.getAll()) {
           ctx.systems.visualFeedback.tick(name, bb, ctx.state.elapsedMs, ctx.state.deltaMs);
       }
   }
   ```

4. **Render adapter variable resolution**: The render adapter callbacks in `engine-lifecycle.ts` (or more likely `engine.ts` where systems are constructed) must capture these from the local scope:
   - `getActor` → use the local `findAgentActor` function or `ctx.lookups.findAgentActor`
   - `scene` → use `engine.currentScene`
   - `particlePool` → use the systems reference
   - `emoteSystem` / `bubbleSystem` → use the systems references
   - `blackboards` → use the blackboard manager reference
   - `spriteCache` → the Map created during preloading

5. **AgentActor blackboard access**: AgentActor does NOT currently have a `blackboard` property. Either:
   - (a) Add a `setBlackboard(bb: AgentBlackboard)` setter, called during agent registration, OR
   - (b) Skip the `onPreUpdate` auto-read and rely solely on the render adapter's `onFacingChange` callback (simpler — recommended). The facing is already applied in the callback.

6. **Task 11 needs tests**: Add at minimum a smoke test that verifies the VisualFeedbackSystem is ticked when present in `EngineSystems`:
   ```typescript
   it("tickVisuals calls visualFeedback.tick per agent", () => {
       const tickSpy = vi.fn();
       const ctx = makeEngineContext({
           systems: { visualFeedback: { tick: tickSpy } },
       });
       tickVisuals(ctx);
       expect(tickSpy).toHaveBeenCalled();
   });
   ```

### Test Import Paths

All test files under `tests/game/systems/` use relative imports to `src/game/systems/`. The correct depth is `../../../../src/game/systems/` (tests → game → systems → ... → src → game → systems). Verify this matches the directory structure before implementing — the existing test files in the same directory provide the canonical pattern.

### Presets Test Additions (Task 2)

Add these tests to `visual-feedback-presets.test.ts`:

```typescript
it("computeUrgency returns 0 when need equals threshold", () => {
    expect(computeUrgency(35, 35)).toBe(0);
});

it("computeUrgency returns 1 when need is 0", () => {
    expect(computeUrgency(0, 35)).toBe(1);
});

it("computeUrgency clamps to 0-1 range", () => {
    expect(computeUrgency(50, 35)).toBe(0); // clamped, not negative
});

it("classifyUrgency returns correct tiers", () => {
    expect(classifyUrgency(0.1)).toBe("low");
    expect(classifyUrgency(0.4)).toBe("medium");
    expect(classifyUrgency(0.8)).toBe("high");
});
```
