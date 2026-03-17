# Agent World MVP Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the ExcaliburJS agent world into a joyful, interactive MVP with game feel (particles, emotes, glow), emotional expressiveness (proximity conversations), and live CLI integration (data export, reconciliation, task wiring).

**Architecture:** Four new systems (particle, emote, social, glow) follow the existing pattern: pure logic + thin engine integration in `main.ts`. Data export gap closed by adding 5 fields to game-side `DashboardAgent`. World state reconciliation implemented in the existing `onStateDiff` stub. All new systems get dedicated test files.

**Tech Stack:** ExcaliburJS v0.32.0, Lit (web components), TypeScript, Vitest, esbuild

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-17-agent-world-mvp-design.md`

**Working directory:** `01 - Projects/Flowti CLI/agents/`

**Test command:** `npx vitest run`

**Build command:** `npm run build`

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/systems/particle-system.ts` | Particle lifecycle: spawn trails, dust puffs, pool management |
| Create | `src/systems/emote-system.ts` | Per-agent mood emote timer, sprite loading, float animation |
| Create | `src/systems/social-system.ts` | Proximity conversation detection and orchestration |
| Create | `tests/systems/particle-system.test.ts` | Particle spawn, fade, pool limits, arrival burst |
| Create | `tests/systems/emote-system.test.ts` | Mood mapping, timer, idle-only constraint |
| Create | `tests/systems/social-system.test.ts` | Proximity trigger, cooldown, conversation lifecycle |
| Create | `tests/systems/brain-system.test.ts` | State transitions, targetBounds, freeze, applyEvent |
| Modify | `src/data/types.ts` | Add goals, behaviors, project, iteration, phase to DashboardAgent |
| Modify | `src/ui/panel-info.ts` | Render project/iteration/phase, goals, behaviors |
| Modify | `src/actors/workstation-actor.ts` | Add glow rendering when occupied |
| Modify | `src/systems/brain-system.ts` | Expose movement distance for particle spawning |
| Modify | `src/main.ts` | Wire particle, emote, social systems; implement onStateDiff |

---

## Chunk 1: Particle System — Footsteps & Dust Puffs

### Task 1: Create particle-system.ts with pool and spawn logic

**Files:**
- Create: `src/systems/particle-system.ts`
- Create: `tests/systems/particle-system.test.ts`

- [ ] **Step 1: Write failing tests for particle pool**

Create `tests/systems/particle-system.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { ParticlePool } from "../../src/systems/particle-system.js";

describe("ParticlePool", () => {
	it("spawns a particle with position, color, and lifetime", () => {
		const pool = new ParticlePool(200);
		pool.spawn({ x: 100, y: 200, color: "#3b82f6", lifetime: 2000, opacity: 0.5, radius: 1 });
		expect(pool.active).toBe(1);
	});

	it("fades particles over time and removes expired", () => {
		const pool = new ParticlePool(200);
		pool.spawn({ x: 0, y: 0, color: "#fff", lifetime: 1000, opacity: 1, radius: 1 });
		pool.update(500);
		const particles = pool.getAll();
		expect(particles[0].opacity).toBeCloseTo(0.5, 1);
		pool.update(600);
		expect(pool.active).toBe(0);
	});

	it("enforces max pool size by killing oldest", () => {
		const pool = new ParticlePool(3);
		pool.spawn({ x: 0, y: 0, color: "#fff", lifetime: 5000, opacity: 1, radius: 1 });
		pool.spawn({ x: 1, y: 0, color: "#fff", lifetime: 5000, opacity: 1, radius: 1 });
		pool.spawn({ x: 2, y: 0, color: "#fff", lifetime: 5000, opacity: 1, radius: 1 });
		pool.spawn({ x: 3, y: 0, color: "#fff", lifetime: 5000, opacity: 1, radius: 1 });
		expect(pool.active).toBe(3);
	});

	it("spawns dust burst with multiple particles", () => {
		const pool = new ParticlePool(200);
		pool.spawnDustBurst(100, 200, "#3b82f6");
		expect(pool.active).toBeGreaterThanOrEqual(4);
		expect(pool.active).toBeLessThanOrEqual(6);
	});

	it("spawns trail particle with domain color and opacity", () => {
		const pool = new ParticlePool(200);
		pool.spawnTrail(50, 60, "#a855f7", false);
		const p = pool.getAll()[0];
		expect(p.color).toBe("#a855f7");
		expect(p.opacity).toBe(0.3);
	});

	it("walking-to trail has higher opacity than wandering trail", () => {
		const pool = new ParticlePool(200);
		pool.spawnTrail(0, 0, "#fff", true);
		const p = pool.getAll()[0];
		expect(p.opacity).toBe(0.6);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/systems/particle-system.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ParticlePool**

Create `src/systems/particle-system.ts`:

```typescript
/**
 * particle-system.ts — Lightweight particle pool for footstep trails and dust puffs.
 * Pure logic — no ExcaliburJS imports. Render adapter in main.ts.
 */

export interface Particle {
	x: number;
	y: number;
	vx: number;
	vy: number;
	color: string;
	lifetime: number;
	age: number;
	opacity: number;
	startOpacity: number;
	radius: number;
}

export interface SpawnOpts {
	x: number;
	y: number;
	color: string;
	lifetime: number;
	opacity: number;
	radius: number;
	vx?: number;
	vy?: number;
}

const DUST_COUNT_MIN = 4;
const DUST_COUNT_MAX = 6;
const DUST_SPEED_MIN = 30;
const DUST_SPEED_MAX = 60;
const DUST_LIFETIME = 800;
const TRAIL_LIFETIME = 2000;
const TRAIL_OPACITY_WANDER = 0.3;
const TRAIL_OPACITY_WALK = 0.6;

export class ParticlePool {
	private readonly particles: Particle[] = [];
	private readonly maxSize: number;

	constructor(maxSize = 200) {
		this.maxSize = maxSize;
	}

	get active(): number {
		return this.particles.length;
	}

	spawn(opts: SpawnOpts): void {
		if (this.particles.length >= this.maxSize) {
			this.particles.shift();
		}
		this.particles.push({
			x: opts.x,
			y: opts.y,
			vx: opts.vx ?? 0,
			vy: opts.vy ?? 0,
			color: opts.color,
			lifetime: opts.lifetime,
			age: 0,
			opacity: opts.opacity,
			startOpacity: opts.opacity,
			radius: opts.radius,
		});
	}

	spawnTrail(x: number, y: number, color: string, isPurposeful: boolean): void {
		this.spawn({
			x, y, color,
			lifetime: TRAIL_LIFETIME,
			opacity: isPurposeful ? TRAIL_OPACITY_WALK : TRAIL_OPACITY_WANDER,
			radius: 1,
		});
	}

	spawnDustBurst(x: number, y: number, color: string): void {
		const count = DUST_COUNT_MIN + Math.floor(Math.random() * (DUST_COUNT_MAX - DUST_COUNT_MIN + 1));
		for (let i = 0; i < count; i++) {
			const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5;
			const speed = DUST_SPEED_MIN + Math.random() * (DUST_SPEED_MAX - DUST_SPEED_MIN);
			this.spawn({
				x, y, color,
				lifetime: DUST_LIFETIME,
				opacity: 0.6,
				radius: 1.5,
				vx: Math.cos(angle) * speed,
				vy: Math.sin(angle) * speed,
			});
		}
	}

	update(deltaMs: number): void {
		const deltaSec = deltaMs / 1000;
		for (let i = this.particles.length - 1; i >= 0; i--) {
			const p = this.particles[i];
			p.age += deltaMs;
			if (p.age >= p.lifetime) {
				this.particles.splice(i, 1);
				continue;
			}
			p.x += p.vx * deltaSec;
			p.y += p.vy * deltaSec;
			p.opacity = p.startOpacity * (1 - p.age / p.lifetime);
		}
	}

	getAll(): readonly Particle[] {
		return this.particles;
	}

	clear(): void {
		this.particles.length = 0;
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/systems/particle-system.test.ts`
Expected: PASS — all 6 tests green

- [ ] **Step 5: Commit**

```bash
git add src/systems/particle-system.ts tests/systems/particle-system.test.ts
git commit -m "feat(agents): add particle pool for footstep trails and dust puffs"
```

### Task 2: Wire particle system into engine

**Files:**
- Modify: `src/systems/brain-system.ts` — expose movement distance accumulator
- Modify: `src/main.ts` — create pool, spawn trails in preframe, render particles in postframe

- [ ] **Step 1: Add distance accumulator to BrainEntry**

In `src/systems/brain-system.ts`, add `distanceSinceTrail: number` to `AgentBrainEntry` interface (after `socialHoldTimer`), initialize to 0 in `register()`, and accumulate in `updateMoving()`.

In `updateMoving()`, after `actor.pos.x += moveX` and `actor.pos.y += moveY`, add:

```typescript
entry.distanceSinceTrail += Math.sqrt(moveX * moveX + moveY * moveY);
```

Reset `distanceSinceTrail = 0` on arrival (inside the `if (dist < ARRIVAL_THRESHOLD)` block).

- [ ] **Step 2: Instantiate ParticlePool in main.ts and wire to preframe**

In `src/main.ts`, import `ParticlePool`, create instance before the `preframe` hook. In the `preframe` handler, after `brainSystem.update()`:

For each brain entry, if `distanceSinceTrail >= 8` and entry is walking:
- Get actor position from `findAgentActor(name)`
- Get domain color from store agent data
- Call `particlePool.spawnTrail(actor.pos.x, actor.pos.y + 28, color, entry.state === "walking-to")`
- Reset `entry.distanceSinceTrail = 0`

If entry just arrived (state changed from walking to idle in this frame):
- Call `particlePool.spawnDustBurst(actor.pos.x, actor.pos.y + 28, color)`

Call `particlePool.update(deltaMs)`.

- [ ] **Step 3: Render particles as lightweight actors or canvas overlay**

In the `preframe` handler, after pool update, iterate `particlePool.getAll()` and for each particle, draw a filled circle at (p.x, p.y) with radius p.radius, color p.color, and globalAlpha p.opacity onto the scene's canvas via an `ex.Canvas` actor or by using the scene `onPostDraw` hook.

Simplest approach: add a single `ex.Canvas` actor to each scene (z-index below agents) that draws all particles from the pool in its draw callback.

- [ ] **Step 4: Run full test suite and build**

Run: `npx vitest run && npm run build`
Expected: All tests pass, build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/systems/brain-system.ts src/main.ts
git commit -m "feat(agents): wire particle trails and dust puffs to engine"
```

---

## Chunk 2: Emote System — Mood Floaters

### Task 3: Create emote-system.ts with mood mapping and timer logic

**Files:**
- Create: `src/systems/emote-system.ts`
- Create: `tests/systems/emote-system.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/systems/emote-system.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { EmoteSystem, MOOD_EMOTE_MAP } from "../../src/systems/emote-system.js";

describe("EmoteSystem", () => {
	it("maps known moods to emote indices", () => {
		expect(MOOD_EMOTE_MAP["happy"]).toContain(3);
		expect(MOOD_EMOTE_MAP["frustrated"]).toContain(10);
	});

	it("falls back to ellipsis for unknown moods", () => {
		expect(MOOD_EMOTE_MAP["nonexistent"]).toBeUndefined();
	});

	it("registers an agent and triggers emote after cooldown", () => {
		const system = new EmoteSystem();
		const triggered: Array<{ name: string; emoteIndex: number }> = [];
		system.onEmote((name, idx) => triggered.push({ name, emoteIndex: idx }));

		system.register("Bot", "happy", 15000);
		system.update(16000, (name) => name === "Bot" ? "idle" : "wandering");

		expect(triggered.length).toBe(1);
		expect(triggered[0].name).toBe("Bot");
		expect(MOOD_EMOTE_MAP["happy"]).toContain(triggered[0].emoteIndex);
	});

	it("does not trigger emote during movement states", () => {
		const system = new EmoteSystem();
		const triggered: string[] = [];
		system.onEmote((name) => triggered.push(name));

		system.register("Bot", "happy", 15000);
		system.update(16000, () => "wandering");

		expect(triggered.length).toBe(0);
	});

	it("respects per-agent cooldown", () => {
		const system = new EmoteSystem();
		const triggered: string[] = [];
		system.onEmote((name) => triggered.push(name));

		system.register("Bot", "happy", 10000);
		system.update(11000, () => "idle");
		system.update(5000, () => "idle");

		expect(triggered.length).toBe(1);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/systems/emote-system.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement EmoteSystem**

Create `src/systems/emote-system.ts`:

```typescript
/**
 * emote-system.ts — Periodic mood emotes floating above agents.
 * Pure logic — no ExcaliburJS imports. Render adapter in main.ts.
 */

import type { BrainState } from "../brain/brain-types.js";

export const MOOD_EMOTE_MAP: Record<string, number[]> = {
	happy: [3, 5],
	enthusiastic: [3, 5],
	neutral: [7, 8],
	frustrated: [10, 12],
	angry: [10, 12],
	focused: [15, 20],
	empathetic: [3, 22],
	inspired: [20, 5],
	aesthetic: [22, 8],
	playful: [5, 25],
};

const FALLBACK_EMOTES = [7];
const IDLE_STATES: readonly BrainState[] = ["idle", "on-break", "waiting"];

interface AgentEmoteEntry {
	mood: string;
	cooldown: number;
	timer: number;
}

type EmoteCallback = (agentName: string, emoteIndex: number) => void;

export class EmoteSystem {
	private readonly entries = new Map<string, AgentEmoteEntry>();
	private callback: EmoteCallback | null = null;

	onEmote(cb: EmoteCallback): void {
		this.callback = cb;
	}

	register(name: string, mood: string, quoteFrequency: number): void {
		this.entries.set(name, {
			mood,
			cooldown: quoteFrequency,
			timer: Math.random() * quoteFrequency * 0.5,
		});
	}

	unregister(name: string): void {
		this.entries.delete(name);
	}

	updateMood(name: string, mood: string): void {
		const entry = this.entries.get(name);
		if (entry) entry.mood = mood;
	}

	update(deltaMs: number, getState: (name: string) => BrainState): void {
		for (const [name, entry] of this.entries) {
			entry.timer += deltaMs;
			if (entry.timer < entry.cooldown) continue;

			const state = getState(name);
			if (!IDLE_STATES.includes(state)) continue;

			entry.timer = 0;
			const candidates = MOOD_EMOTE_MAP[entry.mood] ?? FALLBACK_EMOTES;
			const idx = candidates[Math.floor(Math.random() * candidates.length)];
			this.callback?.(name, idx);
		}
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/systems/emote-system.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/systems/emote-system.ts tests/systems/emote-system.test.ts
git commit -m "feat(agents): add emote system with mood-to-sprite mapping"
```

### Task 4: Wire emote system to engine with sprite loading

**Files:**
- Modify: `src/main.ts` — load emote sprites, wire system callback to spawn float actors

- [ ] **Step 1: Load emote PNGs during sprite preload phase**

In `main.ts`, after the character sprite preload, load emote sprites:

```typescript
const emoteSprites = new Map<number, ex.ImageSource>();
for (let i = 1; i <= 30; i++) {
	const src = new ex.ImageSource(`assets/Ui/Emote/emote${i}.png`, false, ex.ImageFiltering.Pixel);
	emoteSprites.set(i, src);
}
await Promise.all([...emoteSprites.values()].map(s => s.load()));
```

- [ ] **Step 2: Create EmoteSystem and register agents**

Instantiate `EmoteSystem` alongside other systems. In `onAgentsUpdated`, register each agent:

```typescript
emoteSystem.register(agent.name, agent.mood ?? "neutral", brainSystem.getState(agent.name)!.params.quoteFrequency);
```

- [ ] **Step 3: Wire callback to spawn float-up actor**

```typescript
emoteSystem.onEmote((name, emoteIndex) => {
	const actor = findAgentActor(name);
	if (!actor) return;
	const imgSrc = emoteSprites.get(emoteIndex);
	if (!imgSrc) return;
	const sprite = imgSrc.toSprite();
	const emoteActor = new ex.Actor({
		pos: ex.vec(actor.pos.x, actor.pos.y - 40),
		z: 1000,
	});
	emoteActor.graphics.use(sprite);
	emoteActor.scale = ex.vec(2, 2);
	emoteActor.actions.moveBy(0, -20, 10).fade(0, 2000).die();
	engine.currentScene.add(emoteActor);
});
```

- [ ] **Step 4: Call `emoteSystem.update()` in preframe**

```typescript
emoteSystem.update(deltaMs, (name) => brainSystem.getState(name)?.state ?? "idle");
```

- [ ] **Step 5: Run full test suite and build**

Run: `npx vitest run && npm run build`
Expected: All tests pass, build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat(agents): wire mood emotes with Ninja Adventure sprites"
```

---

## Chunk 3: Workstation Glow + Activity Sparks

### Task 5: Add glow rendering to WorkstationActor

**Files:**
- Modify: `src/actors/workstation-actor.ts`

- [ ] **Step 1: Add radial gradient glow when occupied**

In `workstation-actor.ts`, inside the `buildGraphic()` method's draw callback, before the occupancy dot, add a glow effect when `occupied` is true:

```typescript
if (occupied) {
	// Radial glow behind monitor area
	const glowGrad = ctx.createRadialGradient(cx, deskY - 2, 2, cx, deskY - 2, 20);
	glowGrad.addColorStop(0, color + "44");
	glowGrad.addColorStop(1, color + "00");
	ctx.fillStyle = glowGrad;
	ctx.beginPath();
	ctx.arc(cx, deskY - 2, 20, 0, Math.PI * 2);
	ctx.fill();
}
```

- [ ] **Step 2: Add `glowPhase` property for sine-wave pulsing**

Add a `glowPhase` property to the class. In a new `updateGlow(deltaMs: number)` method, increment phase and rebuild graphic only when occupied:

```typescript
private glowPhase = 0;

updateGlow(deltaMs: number): void {
	if (!this.occupied) return;
	this.glowPhase += deltaMs * 0.003;
	this.buildGraphic();
}
```

Use `glowPhase` to modulate glow opacity: `const glowAlpha = 0.3 + 0.5 * ((Math.sin(this.glowPhase) + 1) / 2)`.

- [ ] **Step 3: Wire glow updates from preframe and spark particles from brain system**

In `main.ts`, in the preframe hook, iterate all workstations in the current scene and call `ws.updateGlow(deltaMs)`.

For spark particles: when a brain entry has state "working" and is near a workstation, spawn 1-2 upward-floating particles every 2-3s (use a timer per workstation). On `using-tool` SSE event, spawn a burst of 8 sparks.

- [ ] **Step 4: Run full test suite and build**

Run: `npx vitest run && npm run build`
Expected: All tests pass, build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/actors/workstation-actor.ts src/main.ts
git commit -m "feat(agents): add workstation glow and activity spark particles"
```

---

## Chunk 4: Social System — Proximity Conversations

### Task 6: Create social-system.ts with proximity detection

**Files:**
- Create: `src/systems/social-system.ts`
- Create: `tests/systems/social-system.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/systems/social-system.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { SocialSystem } from "../../src/systems/social-system.js";

describe("SocialSystem", () => {
	it("triggers conversation when related agents are within range for threshold", () => {
		const system = new SocialSystem();
		const convos: Array<{ a: string; b: string }> = [];
		system.onConversation((a, b, lineA, lineB) => convos.push({ a, b }));

		system.register("Alice", { socialRadius: 100, personality: ["analytical"], relationships: [{ target: "Bob", type: "peer" }] });
		system.register("Bob", { socialRadius: 100, personality: ["friendly"], relationships: [{ target: "Alice", type: "peer" }] });

		// Place within range
		system.update(5000, (name) => ({ x: name === "Alice" ? 50 : 100, y: 100 }), () => "idle");

		expect(convos.length).toBe(1);
		expect(convos[0].a).toBe("Alice");
		expect(convos[0].b).toBe("Bob");
	});

	it("does not trigger if agents are too far apart", () => {
		const system = new SocialSystem();
		const convos: string[] = [];
		system.onConversation((a) => convos.push(a));

		system.register("Alice", { socialRadius: 50, personality: [], relationships: [{ target: "Bob", type: "peer" }] });
		system.register("Bob", { socialRadius: 50, personality: [], relationships: [{ target: "Alice", type: "peer" }] });

		system.update(5000, (name) => ({ x: name === "Alice" ? 0 : 200, y: 100 }), () => "idle");

		expect(convos.length).toBe(0);
	});

	it("respects pair cooldown", () => {
		const system = new SocialSystem();
		let count = 0;
		system.onConversation(() => count++);

		system.register("Alice", { socialRadius: 100, personality: [], relationships: [{ target: "Bob", type: "peer" }] });
		system.register("Bob", { socialRadius: 100, personality: [], relationships: [{ target: "Alice", type: "peer" }] });

		system.update(5000, () => ({ x: 50, y: 50 }), () => "idle");
		expect(count).toBe(1);

		// Before cooldown expires
		system.update(30000, () => ({ x: 50, y: 50 }), () => "idle");
		expect(count).toBe(1);
	});

	it("does not trigger during non-idle states", () => {
		const system = new SocialSystem();
		let count = 0;
		system.onConversation(() => count++);

		system.register("Alice", { socialRadius: 100, personality: [], relationships: [{ target: "Bob", type: "peer" }] });
		system.register("Bob", { socialRadius: 100, personality: [], relationships: [{ target: "Alice", type: "peer" }] });

		system.update(5000, () => ({ x: 50, y: 50 }), () => "working");
		expect(count).toBe(0);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/systems/social-system.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement SocialSystem**

Create `src/systems/social-system.ts`:

```typescript
/**
 * social-system.ts — Proximity conversation detection between related agents.
 * Pure logic — no ExcaliburJS imports.
 */

import type { BrainState } from "../brain/brain-types.js";

export interface SocialAgent {
	readonly socialRadius: number;
	readonly personality: readonly string[];
	readonly relationships: readonly { target: string; type: string }[];
}

interface SocialEntry extends SocialAgent {
	proximityTimers: Map<string, number>;
}

const PROXIMITY_THRESHOLD_MS = 4000;
const PAIR_COOLDOWN_MS = 60000;
const IDLE_STATES: readonly BrainState[] = ["idle", "on-break", "waiting"];

type ConversationCallback = (agentA: string, agentB: string, lineA: string, lineB: string) => void;

const CONVERSATION_LINES: Record<string, string[]> = {
	engineering: ["The build looks good today.", "Have you seen the latest test results?", "This architecture is clean."],
	design: ["The flow feels intuitive now.", "I love how this looks.", "Users will appreciate this."],
	product: ["The roadmap is shaping up.", "Good progress on the scope.", "Let's review the backlog."],
	general: ["How's it going?", "Good to see you.", "Making progress!"],
};

export class SocialSystem {
	private readonly entries = new Map<string, SocialEntry>();
	private readonly pairCooldowns = new Map<string, number>();
	private callback: ConversationCallback | null = null;

	onConversation(cb: ConversationCallback): void {
		this.callback = cb;
	}

	register(name: string, agent: SocialAgent): void {
		this.entries.set(name, { ...agent, proximityTimers: new Map() });
	}

	unregister(name: string): void {
		this.entries.delete(name);
	}

	update(
		deltaMs: number,
		getPosition: (name: string) => { x: number; y: number },
		getState: (name: string) => BrainState,
	): void {
		// Decrement pair cooldowns
		for (const [key, remaining] of this.pairCooldowns) {
			const updated = remaining - deltaMs;
			if (updated <= 0) this.pairCooldowns.delete(key);
			else this.pairCooldowns.set(key, updated);
		}

		for (const [nameA, entryA] of this.entries) {
			if (!IDLE_STATES.includes(getState(nameA))) continue;
			const posA = getPosition(nameA);

			for (const rel of entryA.relationships) {
				const entryB = this.entries.get(rel.target);
				if (!entryB) continue;
				if (!IDLE_STATES.includes(getState(rel.target))) continue;

				const pairKey = [nameA, rel.target].sort().join("|");
				if (this.pairCooldowns.has(pairKey)) continue;

				const posB = getPosition(rel.target);
				const dx = posA.x - posB.x;
				const dy = posA.y - posB.y;
				const dist = Math.sqrt(dx * dx + dy * dy);
				const maxRadius = Math.max(entryA.socialRadius, entryB.socialRadius);

				if (dist > maxRadius) {
					entryA.proximityTimers.delete(rel.target);
					continue;
				}

				const timer = (entryA.proximityTimers.get(rel.target) ?? 0) + deltaMs;
				entryA.proximityTimers.set(rel.target, timer);

				if (timer >= PROXIMITY_THRESHOLD_MS) {
					entryA.proximityTimers.delete(rel.target);
					this.pairCooldowns.set(pairKey, PAIR_COOLDOWN_MS);

					const lineA = this.pickLine(entryA.personality);
					const lineB = this.pickLine(entryB.personality);
					this.callback?.(nameA, rel.target, lineA, lineB);
				}
			}
		}
	}

	private pickLine(personality: readonly string[]): string {
		const pool = CONVERSATION_LINES["general"];
		return pool[Math.floor(Math.random() * pool.length)];
	}
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/systems/social-system.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/systems/social-system.ts tests/systems/social-system.test.ts
git commit -m "feat(agents): add social system for proximity conversations"
```

### Task 7: Wire social system to engine

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Instantiate SocialSystem and register agents**

In `main.ts`, create `SocialSystem`, register agents in `onAgentsUpdated` with their `socialRadius` (from habits), `personality`, and `relationships`.

- [ ] **Step 2: Wire conversation callback**

```typescript
socialSystem.onConversation((nameA, nameB, lineA, lineB) => {
	brainSystem.applyEvent(nameA, "speaking");
	brainSystem.applyEvent(nameB, "speaking");
	bubbleSystem.showBubble(nameA, "speech", lineA, engine.currentScene, findAgentActor, 4000);
	setTimeout(() => {
		bubbleSystem.showBubble(nameB, "speech", lineB, engine.currentScene, findAgentActor, 4000);
	}, 800);
	setTimeout(() => {
		brainSystem.applyEvent(nameA, "idle");
		brainSystem.applyEvent(nameB, "idle");
	}, 5000);
});
```

- [ ] **Step 3: Call `socialSystem.update()` in preframe**

After brain update, call:

```typescript
socialSystem.update(
	deltaMs,
	(name) => brainSystem.getPosition(name) ?? { x: 0, y: 0 },
	(name) => brainSystem.getState(name)?.state ?? "idle",
);
```

- [ ] **Step 4: Run full test suite and build**

Run: `npx vitest run && npm run build`
Expected: All tests pass, build succeeds

- [ ] **Step 5: Commit**

```bash
git add src/main.ts
git commit -m "feat(agents): wire proximity conversations to engine"
```

---

## Chunk 5: Data Export Gap + Panel Info

### Task 8: Add missing fields to game-side DashboardAgent

**Files:**
- Modify: `src/data/types.ts`
- Modify: `src/ui/panel-info.ts`

- [ ] **Step 1: Add 5 fields to DashboardAgent interface**

In `src/data/types.ts`, add after `suggestedTasks`:

```typescript
readonly goals?: readonly { text: string; priority: string }[];
readonly behaviors?: readonly string[];
readonly project?: string;
readonly iteration?: string;
readonly phase?: string;
```

- [ ] **Step 2: Add project/iteration/phase to panel-info hero section**

In `src/ui/panel-info.ts`, in the `render()` method, after the tags div, add:

```typescript
${this.agent.project ? html`
	<div class="context-row">
		<span class="context-label">Project</span>
		<span class="context-value">${this.agent.project}</span>
	</div>
` : nothing}
${this.agent.iteration ? html`
	<div class="context-row">
		<span class="context-label">Iteration</span>
		<span class="context-value">${this.agent.iteration}</span>
	</div>
` : nothing}
```

- [ ] **Step 3: Add goals section below skills**

```typescript
${this.agent.goals && this.agent.goals.length > 0 ? html`
	<div class="section">
		<div class="section-label">Goals</div>
		${this.agent.goals.map((g) => html`
			<div class="skill">
				<span class="skill-name">${g.text}</span>
				<span class="skill-level">${g.priority}</span>
			</div>
		`)}
	</div>
` : nothing}
```

- [ ] **Step 4: Add CSS for context rows**

Add to the static styles:

```css
.context-row {
	display: flex;
	justify-content: space-between;
	padding: 2px 0;
	font-size: 11px;
}
.context-label { color: var(--text-dim); }
.context-value { color: var(--text-secondary); }
```

- [ ] **Step 5: Run full test suite and build**

Run: `npx vitest run && npm run build`
Expected: All tests pass, build succeeds

- [ ] **Step 6: Commit**

```bash
git add src/data/types.ts src/ui/panel-info.ts
git commit -m "feat(agents): add goals, behaviors, project, iteration, phase to DashboardAgent"
```

---

## Chunk 6: World State Reconciliation

### Task 9: Implement onStateDiff handler

**Files:**
- Modify: `src/main.ts` — replace stub with spawn/despawn/update logic

- [ ] **Step 1: Replace onStateDiff stub**

In `main.ts`, replace `onStateDiff: (_diff) => { /* Entity-level sync integration pending */ }` with:

```typescript
onStateDiff: (diff) => {
	// Spawn new agents
	for (const entityId of diff.added) {
		const entity = syncSystem.getStateStore().getEntity(entityId);
		if (!entity || entity.type !== "agent") continue;
		const existing = store.agents.find(a => a.name === entityId);
		if (existing) continue;

		const agentData: DashboardAgent = {
			name: entityId,
			agentType: "ai",
			status: (entity.components["status"] as string ?? "idle") as DashboardAgent["status"],
			domain: entity.components["domain"] as string | undefined,
		};
		const setting = resolveSettingForDomain(agentData.domain);
		if (setting !== "hub" && roomScenes[setting]) {
			roomScenes[setting].spawnAgent(agentData);
		}
		hubScene.updateAgents([...store.agents, agentData]);
		store.setAgents([...store.agents, agentData]);
		brainSystem.register(agentData.name, {}, undefined, agentData.domain);
		bubbleSystem.showBubble(entityId, "speech", "Hello, I just arrived!", engine.currentScene, findAgentActor, 3000);
	}

	// Despawn removed agents
	for (const entityId of diff.removed) {
		brainSystem.unregister(entityId);
		emoteSystem.unregister(entityId);
		socialSystem.unregister(entityId);
		talkEngine.silence(entityId);
		const updated = store.agents.filter(a => a.name !== entityId);
		store.setAgents(updated);
		hubScene.updateAgents(updated);
	}

	// Update changed agents
	for (const entityId of diff.changed) {
		const entity = syncSystem.getStateStore().getEntity(entityId);
		if (!entity || entity.type !== "agent") continue;
		const status = entity.components["status"];
		if (typeof status === "string") {
			brainSystem.applyEvent(entityId, status as AgentActionType);
			bubbleSystem.showBubble(entityId, "speech", `I'm now ${status}!`, engine.currentScene, findAgentActor, 3000);
		}
	}
},
```

- [ ] **Step 2: Run full test suite and build**

Run: `npx vitest run && npm run build`
Expected: All tests pass, build succeeds

- [ ] **Step 3: Commit**

```bash
git add src/main.ts
git commit -m "feat(agents): implement world state reconciliation — spawn, despawn, update"
```

---

## Chunk 7: Brain System Tests

### Task 10: Create brain-system.test.ts

**Files:**
- Create: `tests/systems/brain-system.test.ts`

- [ ] **Step 1: Write comprehensive tests**

Create `tests/systems/brain-system.test.ts` testing:
- Agent registration and initial state
- Idle → wandering transition after `idleResistance` threshold
- Wandering → idle on arrival
- `freeze()` resets to idle
- `applyEvent()` transitions state
- `targetBounds` are narrower than raw bounds by `SPRITE_MARGIN`
- `clampToBounds()` keeps actors within margin
- Distance accumulator tracks movement for particles

- [ ] **Step 2: Run test to verify it passes**

Run: `npx vitest run tests/systems/brain-system.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/systems/brain-system.test.ts
git commit -m "test(agents): add brain-system test suite"
```

---

## Chunk 8: Polish Loop

### Task 11: Review, refine, and polish

This task is the iterative polish loop. After all previous chunks are implemented:

- [ ] **Step 1: Full quality check**

Run: `npx vitest run && npm run build`
Verify: All tests pass, build succeeds, no TypeScript errors.

- [ ] **Step 2: Visual review**

Start the dashboard and observe for 60 seconds:
- Are particle trails visible and not too noisy?
- Do emotes float up at a pleasant frequency?
- Does workstation glow pulse smoothly?
- Do proximity conversations trigger naturally?
- Are dust puffs visible on arrival?

- [ ] **Step 3: Tune parameters**

Based on visual review, adjust:
- Particle trail spawn distance (currently 8px — increase if too many)
- Emote frequency (currently WIS-derived 15-30s — decrease if too infrequent)
- Glow pulse speed (currently 0.003 — adjust for taste)
- Conversation proximity threshold (currently 4s — shorter for more action)
- Dust puff particle count (currently 4-6 — increase for more impact)

- [ ] **Step 4: Backlog new ideas discovered during polish**

Do NOT implement new features. Instead, append to `iterations/refinement-2026-03-17-agent-world.md` under a "## Polish Backlog" section with items found during review.

- [ ] **Step 5: Final test + build + commit**

```bash
npx vitest run && npm run build
git add -A
git commit -m "polish(agents): tune particle, emote, glow, and conversation parameters"
```

- [ ] **Step 6: Repeat steps 2-5 until satisfied**

Each loop should focus on one aspect: particles → emotes → glow → conversations → overall feel.
