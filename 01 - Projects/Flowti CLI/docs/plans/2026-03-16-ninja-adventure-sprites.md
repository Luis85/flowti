# Ninja Adventure Sprite Integration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace programmatic pixel-art sprites with Ninja Adventure asset pack spritesheets to give agents real animated characters.

**Architecture:** New `src/sprites/` module handles character-to-domain mapping and async PNG loading via ExcaliburJS `ImageSource` + `SpriteSheet`. The refactored `AgentActor` receives pre-loaded `AgentSprites` (idle + 4-directional walk animations) instead of drawing shapes programmatically. Build script copies asset PNGs to output directory.

**Tech Stack:** ExcaliburJS 0.32.x (SpriteSheet, Animation, ImageSource, ImageFiltering.Pixel), esbuild, Vitest + jsdom

**Spec:** `docs/specs/2026-03-16-ninja-adventure-sprite-integration-design.md`

**Working directory:** `01 - Projects/Flowti CLI/agents/`

**Test command:** `npx vitest run`

**Build command:** `npm run build` (runs `node build.mjs`)

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/sprites/character-pool.ts` | Domain → character name mapping with deterministic hash |
| Create | `src/sprites/sprite-loader.ts` | Async PNG loading, SpriteSheet slicing, Animation creation |
| Create | `tests/sprites/character-pool.test.ts` | Pool assignment, hash determinism, fallback |
| Create | `tests/sprites/sprite-loader.test.ts` | Mock ImageSource loading, animation frame counts |
| Modify | `src/actors/agent-actor.ts` | Accept AgentSprites, use real animations, draw label overlay |
| Modify | `src/main.ts` | pixelArt engine config, sprite registry, preload phase |
| Modify | `src/scenes/hub-scene.ts` | Pass sprite registry, remove 1.5x scale |
| Modify | `src/scenes/room-scene.ts` | Accept and pass sprite registry to spawnAgent |
| — | `src/systems/sync-system.ts` | No changes needed — calls `spawnAgent(agent)` which handles sprites internally |
| Modify | `build.mjs` | Copy character PNGs to output directory |
| Modify | `tests/actors/agent-actor.test.ts` | Mock AgentSprites instead of pixel drawing |
| Delete | `src/actors/pixel-sprites.ts` | Replaced by sprite-loader |
| Delete | `tests/actors/pixel-sprites.test.ts` | Source file deleted |

---

## Chunk 1: Character Pool (pure logic, no ExcaliburJS dependency)

### Task 1: Create character-pool with tests (TDD)

**Files:**
- Create: `src/sprites/character-pool.ts`
- Create: `tests/sprites/character-pool.test.ts`

- [ ] **Step 1: Write failing tests for character pool**

Create `tests/sprites/character-pool.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveCharacter, DOMAIN_POOLS } from "../../src/sprites/character-pool.js";

describe("resolveCharacter", () => {
	it("returns a character from the engineering pool for engineering domain", () => {
		const char = resolveCharacter("Software Developer", "engineering");
		expect(DOMAIN_POOLS["engineering"]).toContain(char);
	});

	it("returns a character from the design pool for design domain", () => {
		const char = resolveCharacter("UI Designer", "design");
		expect(DOMAIN_POOLS["design"]).toContain(char);
	});

	it("returns a character from the management pool for management domain", () => {
		const char = resolveCharacter("Scrum Master", "management");
		expect(DOMAIN_POOLS["management"]).toContain(char);
	});

	it("is deterministic — same name+domain always returns same character", () => {
		const a = resolveCharacter("Alice", "engineering");
		const b = resolveCharacter("Alice", "engineering");
		expect(a).toBe(b);
	});

	it("different names in same domain can resolve to different characters", () => {
		const chars = new Set<string>();
		for (const name of ["Alpha", "Bravo", "Charlie", "Delta", "Echo", "Foxtrot"]) {
			chars.add(resolveCharacter(name, "engineering"));
		}
		expect(chars.size).toBeGreaterThan(1);
	});

	it("uses fallback pool for unknown domains", () => {
		const char = resolveCharacter("Unknown Agent", "mystery");
		expect(DOMAIN_POOLS["fallback"]).toContain(char);
	});

	it("uses fallback pool for undefined domain", () => {
		const char = resolveCharacter("Orphan", "");
		expect(DOMAIN_POOLS["fallback"]).toContain(char);
	});

	it("maps all known domain aliases to their pools", () => {
		const aliases: Record<string, string[]> = {
			engineering: ["engineering", "qa", "devops", "development", "testing"],
			design: ["design", "ux"],
			product: ["product"],
			management: ["management", "delivery", "coordination"],
			quality: ["quality"],
			analysis: ["analysis"],
			operations: ["operations"],
			marketing: ["marketing", "sales", "support"],
			orchestration: ["orchestration"],
		};
		for (const [poolKey, domains] of Object.entries(aliases)) {
			for (const domain of domains) {
				const char = resolveCharacter("TestAgent", domain);
				expect(DOMAIN_POOLS[poolKey]).toContain(char);
			}
		}
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/sprites/character-pool.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement character-pool**

Create `src/sprites/character-pool.ts`:

```typescript
/**
 * character-pool.ts — Domain-based character sprite assignment.
 *
 * Maps agent domains to pools of Ninja Adventure character folder names.
 * Uses a deterministic name hash so the same agent always gets the same sprite.
 */

export const DOMAIN_POOLS: Record<string, readonly string[]> = {
	engineering: ["NinjaBlue", "NinjaGreen", "NinjaDark", "NinjaRed", "NinjaGray", "NinjaMageBlack"],
	design: ["Princess", "Woman", "Villager", "Villager2", "EggGirl", "Cavegirl"],
	product: ["Noble", "Inspector", "Master", "Sultan"],
	management: ["Samurai", "SamuraiBlue", "Knight", "KnightGold", "SamuraiRed"],
	quality: ["Monk", "Monk2", "Shaman"],
	analysis: ["SorcererBlack", "SorcererOrange", "NinjaMageOrange"],
	operations: ["RobotGrey", "RobotGreen", "RobotCamouflage"],
	marketing: ["Villager3", "Villager4", "Villager5", "OldMan", "Boy"],
	orchestration: ["GoldStatue", "RedGladiator", "GladiatorBlue"],
	fallback: ["Child", "Eskimo", "Flam", "Hunter", "ManGreen"],
};

const DOMAIN_ALIASES: Record<string, string> = {
	engineering: "engineering", qa: "engineering", devops: "engineering",
	development: "engineering", testing: "engineering",
	design: "design", ux: "design",
	product: "product",
	management: "management", delivery: "management", coordination: "management",
	quality: "quality",
	analysis: "analysis",
	operations: "operations",
	marketing: "marketing", sales: "marketing", support: "marketing",
	orchestration: "orchestration",
};

function nameHash(name: string): number {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
	}
	return Math.abs(hash);
}

export function resolveCharacter(agentName: string, domain: string): string {
	const poolKey = DOMAIN_ALIASES[domain.toLowerCase()] ?? "fallback";
	const pool = DOMAIN_POOLS[poolKey] ?? DOMAIN_POOLS["fallback"];
	const index = nameHash(agentName) % pool.length;
	return pool[index];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/sprites/character-pool.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/sprites/character-pool.ts tests/sprites/character-pool.test.ts
git commit -m "feat(sprites): domain-based character pool with deterministic assignment"
```

---

## Chunk 2: Sprite Loader (ExcaliburJS integration)

### Task 2: Create sprite-loader with tests (TDD)

**Files:**
- Create: `src/sprites/sprite-loader.ts`
- Create: `tests/sprites/sprite-loader.test.ts`

- [ ] **Step 1: Write failing tests for sprite-loader**

Create `tests/sprites/sprite-loader.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";

vi.mock("excalibur", () => {
	const mockSprite = { clone: () => mockSprite, width: 16, height: 16 };
	const mockSpriteSheet = { getSprite: vi.fn(() => mockSprite) };
	return {
		ImageSource: class {
			constructor(public path: string, _opts?: unknown) {}
			load = vi.fn().mockResolvedValue(undefined);
			image = { width: 64, height: 64 };
		},
		SpriteSheet: {
			fromImageSource: vi.fn(() => mockSpriteSheet),
		},
		Animation: {
			fromSpriteSheet: vi.fn((_sheet: unknown, frames: number[], _duration: number) => ({
				strategy: null,
				frames,
			})),
		},
		AnimationStrategy: { Loop: 0 },
		ImageFiltering: { Pixel: 0 },
	};
});

import { loadAgentSprites, type AgentSprites } from "../../src/sprites/sprite-loader.js";
import * as ex from "excalibur";

describe("loadAgentSprites", () => {
	it("loads idle and walk images", async () => {
		const sprites = await loadAgentSprites("Boy", "assets/Actor/Characters/");
		expect(ex.SpriteSheet.fromImageSource).toHaveBeenCalledTimes(2);
	});

	it("returns all five animation slots", async () => {
		const sprites = await loadAgentSprites("Boy", "assets/Actor/Characters/");
		expect(sprites.idle).toBeDefined();
		expect(sprites.walkDown).toBeDefined();
		expect(sprites.walkLeft).toBeDefined();
		expect(sprites.walkRight).toBeDefined();
		expect(sprites.walkUp).toBeDefined();
	});

	it("creates idle spritesheet with 4 columns x 1 row", async () => {
		await loadAgentSprites("Boy", "assets/Actor/Characters/");
		const calls = (ex.SpriteSheet.fromImageSource as ReturnType<typeof vi.fn>).mock.calls;
		const idleCall = calls[0][0];
		expect(idleCall.grid.columns).toBe(4);
		expect(idleCall.grid.rows).toBe(1);
		expect(idleCall.grid.spriteWidth).toBe(16);
		expect(idleCall.grid.spriteHeight).toBe(16);
	});

	it("creates walk spritesheet with 4 columns x 4 rows", async () => {
		await loadAgentSprites("Boy", "assets/Actor/Characters/");
		const calls = (ex.SpriteSheet.fromImageSource as ReturnType<typeof vi.fn>).mock.calls;
		const walkCall = calls[1][0];
		expect(walkCall.grid.columns).toBe(4);
		expect(walkCall.grid.rows).toBe(4);
		expect(walkCall.grid.spriteWidth).toBe(16);
		expect(walkCall.grid.spriteHeight).toBe(16);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/sprites/sprite-loader.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement sprite-loader**

Create `src/sprites/sprite-loader.ts`:

```typescript
/**
 * sprite-loader.ts — Loads Ninja Adventure spritesheets into ExcaliburJS animations.
 *
 * Each character has Idle.png (4 frames, 1 row) and Walk.png (4 frames, 4 directions).
 * All sprites are 16x16 pixels, displayed at 4x scale via engine pixelArt mode.
 */

import * as ex from "excalibur";

export interface AgentSprites {
	readonly idle: ex.Animation;
	readonly walkDown: ex.Animation;
	readonly walkLeft: ex.Animation;
	readonly walkRight: ex.Animation;
	readonly walkUp: ex.Animation;
}

/** Frame durations in ms for each animation type. */
export const FRAME_DURATIONS = {
	idle: 300,
	walkSlow: 250,
	walkFast: 150,
	onBreak: 400,
} as const;

/**
 * Load a character's Idle and Walk spritesheets and return pre-built animations.
 * Must be called after images are loaded (e.g. via ex.Loader or manual .load()).
 */
export async function loadAgentSprites(
	characterName: string,
	basePath: string,
): Promise<AgentSprites> {
	const charPath = `${basePath}${characterName}/SeparateAnim`;

	const idleImage = new ex.ImageSource(`${charPath}/Idle.png`, {
		filtering: ex.ImageFiltering.Pixel,
	});
	const walkImage = new ex.ImageSource(`${charPath}/Walk.png`, {
		filtering: ex.ImageFiltering.Pixel,
	});

	await Promise.all([idleImage.load(), walkImage.load()]);

	const idleSheet = ex.SpriteSheet.fromImageSource({
		image: idleImage,
		grid: { columns: 4, rows: 1, spriteWidth: 16, spriteHeight: 16 },
	});

	const walkSheet = ex.SpriteSheet.fromImageSource({
		image: walkImage,
		grid: { columns: 4, rows: 4, spriteWidth: 16, spriteHeight: 16 },
	});

	// Idle: frames 0-3
	const idle = ex.Animation.fromSpriteSheet(idleSheet, [0, 1, 2, 3], FRAME_DURATIONS.idle);
	idle.strategy = ex.AnimationStrategy.Loop;

	// Walk rows: 0=down, 1=left, 2=right, 3=up (4 frames each)
	const walkDown = ex.Animation.fromSpriteSheet(walkSheet, [0, 1, 2, 3], FRAME_DURATIONS.walkSlow);
	walkDown.strategy = ex.AnimationStrategy.Loop;

	const walkLeft = ex.Animation.fromSpriteSheet(walkSheet, [4, 5, 6, 7], FRAME_DURATIONS.walkSlow);
	walkLeft.strategy = ex.AnimationStrategy.Loop;

	const walkRight = ex.Animation.fromSpriteSheet(walkSheet, [8, 9, 10, 11], FRAME_DURATIONS.walkSlow);
	walkRight.strategy = ex.AnimationStrategy.Loop;

	const walkUp = ex.Animation.fromSpriteSheet(walkSheet, [12, 13, 14, 15], FRAME_DURATIONS.walkSlow);
	walkUp.strategy = ex.AnimationStrategy.Loop;

	return { idle, walkDown, walkLeft, walkRight, walkUp };
}

/**
 * Preload sprites for a set of characters and return a registry keyed by character name.
 */
export async function preloadSpriteRegistry(
	characters: readonly string[],
	basePath: string,
): Promise<Map<string, AgentSprites>> {
	const registry = new Map<string, AgentSprites>();
	const unique = [...new Set(characters)];
	const results = await Promise.all(
		unique.map(async (name) => ({ name, sprites: await loadAgentSprites(name, basePath) })),
	);
	for (const { name, sprites } of results) {
		registry.set(name, sprites);
	}
	return registry;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/sprites/sprite-loader.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/sprites/sprite-loader.ts tests/sprites/sprite-loader.test.ts
git commit -m "feat(sprites): async sprite loader with SpriteSheet slicing and animation creation"
```

---

## Chunk 3: Refactor AgentActor to use real sprites

### Task 3: Rewrite agent-actor to accept AgentSprites

**Files:**
- Modify: `src/actors/agent-actor.ts`
- Modify: `tests/actors/agent-actor.test.ts`

**Context:** The current `AgentActor` imports 7 drawing functions from `pixel-sprites.ts` and creates `ex.Canvas` objects that draw shapes programmatically. Replace all of that with the pre-loaded `AgentSprites` animations. The name label, AI/H badge, and status dot are rendered as a child `ex.Actor` positioned below the sprite (avoids the graphics.use() single-graphic limitation).

**Key design decisions:**
- Actor scale is set to 4x so 16x16 sprites render at 64x64
- Label is a child actor (not GraphicsGroup) so it stays visible when switching sprite animations
- Direction is only resolved for walking states (not talking — idle has no directional variants)
- Walk animation speed is adjusted via `Animation.speed` property per brain state

- [ ] **Step 1: Write agent-actor tests**

Create `tests/actors/agent-actor.test.ts`:

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";

vi.mock("excalibur", () => {
	const mockGraphic = {
		strategy: null,
		clone: function() { return this; },
	};
	class MockActor {
		pos = { x: 0, y: 0 };
		scale = { x: 1, y: 1 };
		width = 0;
		height = 0;
		anchor = { x: 0, y: 0 };
		graphics = {
			add: vi.fn(),
			use: vi.fn(),
		};
		on = vi.fn();
		constructor(config: Record<string, unknown>) {
			Object.assign(this, config);
			if (config.pos) {
				this.pos = config.pos as { x: number; y: number };
			}
		}
		onInitialize = vi.fn();
		onPreUpdate = vi.fn();
		isKilled = () => false;
	}
	return {
		Actor: MockActor,
		vec: (x: number, y: number) => ({ x, y }),
		Canvas: class {
			constructor(public config: Record<string, unknown>) {}
		},
		AnimationStrategy: { Loop: 0 },
	};
});

import { AgentActor } from "../../src/actors/agent-actor.js";
import type { AgentSprites } from "../../src/sprites/sprite-loader.js";
import type { DashboardAgent } from "../../src/data/types.js";

function mockAgent(overrides: Partial<DashboardAgent> = {}): DashboardAgent {
	return {
		name: "Test Agent",
		agentType: "ai",
		status: "idle",
		domain: "engineering",
		mood: "neutral",
		persona: "Testy",
		personality: [],
		...overrides,
	} as DashboardAgent;
}

function mockSprites(): AgentSprites {
	const anim = { strategy: null, clone: function() { return this; } };
	return {
		idle: anim as never,
		walkDown: anim as never,
		walkLeft: anim as never,
		walkRight: anim as never,
		walkUp: anim as never,
	};
}

describe("AgentActor", () => {
	it("creates with idle pose", () => {
		const actor = new AgentActor({
			agent: mockAgent(),
			x: 100, y: 200,
			onSelect: vi.fn(),
			sprites: mockSprites(),
		});
		expect(actor.graphics.use).toHaveBeenCalledWith("idle");
	});

	it("registers all five animation slots", () => {
		const sprites = mockSprites();
		const actor = new AgentActor({
			agent: mockAgent(),
			x: 100, y: 200,
			onSelect: vi.fn(),
			sprites,
		});
		const addCalls = (actor.graphics.add as ReturnType<typeof vi.fn>).mock.calls;
		const names = addCalls.map((c: unknown[]) => c[0]);
		expect(names).toContain("idle");
		expect(names).toContain("walk-down");
		expect(names).toContain("walk-left");
		expect(names).toContain("walk-right");
		expect(names).toContain("walk-up");
		expect(names).toContain("label");
	});

	it("switches to walk-right when walking-to with positive dx", () => {
		const actor = new AgentActor({
			agent: mockAgent(),
			x: 100, y: 200,
			onSelect: vi.fn(),
			sprites: mockSprites(),
		});
		actor.updateFromBrain("walking-to", { kind: "workstation", x: 300, y: 200 });
		expect(actor.graphics.use).toHaveBeenCalledWith("walk-right");
	});

	it("switches to walk-down when walking-to with positive dy", () => {
		const actor = new AgentActor({
			agent: mockAgent(),
			x: 100, y: 200,
			onSelect: vi.fn(),
			sprites: mockSprites(),
		});
		actor.updateFromBrain("walking-to", { kind: "workstation", x: 100, y: 400 });
		expect(actor.graphics.use).toHaveBeenCalledWith("walk-down");
	});

	it("returns to idle when brain state is working", () => {
		const actor = new AgentActor({
			agent: mockAgent(),
			x: 100, y: 200,
			onSelect: vi.fn(),
			sprites: mockSprites(),
		});
		actor.updateFromBrain("walking-to", { kind: "workstation", x: 300, y: 200 });
		actor.updateFromBrain("working", { kind: "none" });
		expect(actor.graphics.use).toHaveBeenLastCalledWith("idle");
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/actors/agent-actor.test.ts`
Expected: FAIL — agent-actor module has old interface (no `sprites` in config)

- [ ] **Step 3: Rewrite agent-actor.ts**

Replace the full contents of `src/actors/agent-actor.ts`:

```typescript
/**
 * agent-actor.ts — Agent actor using Ninja Adventure sprite animations.
 *
 * Receives pre-loaded AgentSprites (idle + 4 directional walks) and switches
 * between them based on brain state. Name label is a child actor positioned
 * below the sprite so it stays visible during animation switches.
 */

import * as ex from "excalibur";
import type { DashboardAgent } from "../data/types.js";
import type { BrainState, MovementTarget } from "../brain/brain-types.js";
import type { AgentSprites } from "../sprites/sprite-loader.js";

// ── Dimensions ───────────────────────────────────────────────────────

const SCALE = 4;

// ── Direction ────────────────────────────────────────────────────────

type Direction = "down" | "left" | "right" | "up";

function resolveDirection(dx: number, dy: number): Direction {
	if (Math.abs(dx) > Math.abs(dy)) {
		return dx > 0 ? "right" : "left";
	}
	return dy > 0 ? "down" : "up";
}

// ── Pose names ───────────────────────────────────────────────────────

const POSE_IDLE = "idle";
const POSE_WALK_DOWN = "walk-down";
const POSE_WALK_LEFT = "walk-left";
const POSE_WALK_RIGHT = "walk-right";
const POSE_WALK_UP = "walk-up";

const WALK_POSES: Record<Direction, string> = {
	down: POSE_WALK_DOWN,
	left: POSE_WALK_LEFT,
	right: POSE_WALK_RIGHT,
	up: POSE_WALK_UP,
};

// ── Speed multipliers for walk animation by brain state ──────────────

const WALK_SPEED: Record<string, number> = {
	wandering: 1.0,       // 250ms base
	"walking-to": 1.67,   // 250/150 = faster
};

// ── AgentActor ───────────────────────────────────────────────────────

export interface AgentActorConfig {
	readonly agent: DashboardAgent;
	readonly x: number;
	readonly y: number;
	readonly onSelect: (agentName: string) => void;
	readonly sprites: AgentSprites;
}

export class AgentActor extends ex.Actor {
	public agentData: DashboardAgent;
	public brainState: BrainState = "idle";

	private readonly onSelect: (agentName: string) => void;
	private readonly sprites: AgentSprites;
	private currentPoseName: string = POSE_IDLE;
	private bobPhase = 0;
	private baseY: number;
	private direction: Direction = "down";

	constructor(config: AgentActorConfig) {
		super({
			pos: ex.vec(config.x, config.y),
			width: 16,
			height: 16,
			anchor: ex.vec(0.5, 0.5),
		});
		this.agentData = config.agent;
		this.onSelect = config.onSelect;
		this.baseY = config.y;
		this.sprites = config.sprites;
		this.scale = ex.vec(SCALE, SCALE);

		this.registerAnimations(config.sprites);
		this.buildLabelChild();
		this.graphics.use(POSE_IDLE);
	}

	onInitialize(_engine: ex.Engine): void {
		this.on("pointerdown", () => {
			this.onSelect(this.agentData.name);
		});
	}

	onPreUpdate(_engine: ex.Engine, delta: number): void {
		if (this.brainState === "idle" || this.brainState === "waiting" || this.brainState === "on-break") {
			this.bobPhase += delta * 0.003;
			this.pos.y = this.baseY + Math.sin(this.bobPhase) * 1;
		} else {
			this.pos.y = this.baseY;
		}
	}

	updateFromBrain(state: BrainState, target: MovementTarget): void {
		this.brainState = state;

		// Resolve direction only for walking states
		if (target.x !== undefined && target.y !== undefined &&
			(state === "walking-to" || state === "wandering")) {
			const dx = target.x - this.pos.x;
			const dy = target.y - this.pos.y;
			if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
				this.direction = resolveDirection(dx, dy);
			}
		}

		const poseName = this.brainStateToPose(state);
		if (poseName !== this.currentPoseName) {
			this.currentPoseName = poseName;
			this.graphics.use(poseName);
		}
	}

	/** No-op: real sprites handle idle animation internally. */
	setIdlePose(_poseName: string): void {
		// No-op
	}

	updateVisualStatus(_status: string): void {
		// Label child would need rebuilding for status color changes.
		// For now, status is set at creation time.
	}

	// ── Private ──────────────────────────────────────────────────────

	private registerAnimations(sprites: AgentSprites): void {
		this.graphics.add(POSE_IDLE, sprites.idle);
		this.graphics.add(POSE_WALK_DOWN, sprites.walkDown);
		this.graphics.add(POSE_WALK_LEFT, sprites.walkLeft);
		this.graphics.add(POSE_WALK_RIGHT, sprites.walkRight);
		this.graphics.add(POSE_WALK_UP, sprites.walkUp);
	}

	private brainStateToPose(state: BrainState): string {
		switch (state) {
			case "wandering":
			case "walking-to":
				return WALK_POSES[this.direction];
			case "idle":
			case "working":
			case "talking":
			case "waiting":
			case "on-break":
			default:
				return POSE_IDLE;
		}
	}

	private buildLabelChild(): void {
		const name = this.agentData.persona ?? this.agentData.name;
		const isAi = this.agentData.agentType === "ai";
		const status = this.agentData.status;

		const STATUS_COLORS: Record<string, string> = {
			busy: "#22c55e", idle: "#3b82f6", unassigned: "#6b7280",
		};

		const labelCanvas = new ex.Canvas({
			width: 48,
			height: 16,
			cache: true,
			draw: (ctx: CanvasRenderingContext2D) => {
				// Name label
				ctx.fillStyle = "#e2e8f0";
				ctx.font = "9px system-ui, sans-serif";
				ctx.textAlign = "center";
				ctx.textBaseline = "top";
				const truncName = name.length > 8 ? name.slice(0, 7) + "\u2026" : name;
				ctx.fillText(truncName, 24, 0);

				// Status dot
				ctx.fillStyle = STATUS_COLORS[status] ?? "#6b7280";
				ctx.beginPath();
				ctx.arc(24, 12, 2, 0, Math.PI * 2);
				ctx.fill();

				// AI/H badge
				const badgeX = 42;
				const badgeY = 4;
				const badgeText = isAi ? "AI" : "H";
				const badgeColor = isAi ? "#8b5cf6" : "#10b981";
				ctx.fillStyle = badgeColor;
				ctx.beginPath();
				ctx.arc(badgeX, badgeY, 5, 0, Math.PI * 2);
				ctx.fill();
				ctx.fillStyle = "#ffffff";
				ctx.font = "bold 5px system-ui, sans-serif";
				ctx.textAlign = "center";
				ctx.textBaseline = "middle";
				ctx.fillText(badgeText, badgeX, badgeY + 1);
			},
		});

		// Add as named graphic "label" for test verification
		this.graphics.add("label", labelCanvas);

		// Create child actor for the label so it renders independently
		const labelActor = new ex.Actor({
			pos: ex.vec(0, 12),
			anchor: ex.vec(0.5, 0),
			z: 1,
		});
		labelActor.graphics.use(labelCanvas);
		this.addChild(labelActor);
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/actors/agent-actor.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/actors/agent-actor.ts tests/actors/agent-actor.test.ts
git commit -m "refactor(actor): replace programmatic sprites with AgentSprites animations"
```

---

## Chunk 4: Wire sprites through scenes and engine

### Task 4: Update hub-scene to pass sprites

**Files:**
- Modify: `src/scenes/hub-scene.ts`

- [ ] **Step 1: Update hub-scene**

In `src/scenes/hub-scene.ts`:

1. Add a `spriteRegistry` field and setter:

```typescript
// At the top of the class, add after existing fields:
private spriteRegistry: Map<string, AgentSprites> = new Map();

// Add setter method after constructor:
setSpriteRegistry(registry: Map<string, AgentSprites>): void {
	this.spriteRegistry = registry;
}
```

2. Import `resolveCharacter` and `AgentSprites`:

```typescript
import { resolveCharacter } from "../sprites/character-pool.js";
import type { AgentSprites } from "../sprites/sprite-loader.js";
```

3. In `updateAgents()` where `new AgentActor(...)` is called, add `sprites`:

Change:
```typescript
const actor = new AgentActor({
	agent,
	x,
	y,
	onSelect: this.config.onAgentSelect,
});
actor.z = 10;
actor.scale = ex.vec(1.5, 1.5);
```

To:
```typescript
const charName = resolveCharacter(agent.name, agent.domain ?? "");
const sprites = this.spriteRegistry.get(charName);
if (!sprites) continue;
const actor = new AgentActor({
	agent,
	x,
	y,
	onSelect: this.config.onAgentSelect,
	sprites,
});
actor.z = 10;
```

(Remove the `actor.scale = ex.vec(1.5, 1.5)` line — 4x scale is applied inside AgentActor.)

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS (hub-scene tests don't directly test AgentActor creation)

- [ ] **Step 3: Commit**

```bash
git add src/scenes/hub-scene.ts
git commit -m "feat(hub): wire sprite registry into agent actor creation"
```

### Task 5: Update room-scene to pass sprites

**Files:**
- Modify: `src/scenes/room-scene.ts`

- [ ] **Step 1: Update room-scene**

In `src/scenes/room-scene.ts`:

1. Add imports:
```typescript
import { resolveCharacter } from "../sprites/character-pool.js";
import type { AgentSprites } from "../sprites/sprite-loader.js";
```

2. Add sprite registry field and setter to the class:
```typescript
private spriteRegistry: Map<string, AgentSprites> = new Map();

setSpriteRegistry(registry: Map<string, AgentSprites>): void {
	this.spriteRegistry = registry;
}
```

3. Update `spawnAgent()` to pass sprites:

Change:
```typescript
const actor = new AgentActor({
	agent,
	x,
	y,
	onSelect: this.roomConfig.onAgentSelect,
});
```

To:
```typescript
const charName = resolveCharacter(agent.name, agent.domain ?? "");
const sprites = this.spriteRegistry.get(charName);
if (!sprites) return;
const actor = new AgentActor({
	agent,
	x,
	y,
	onSelect: this.roomConfig.onAgentSelect,
	sprites,
});
```

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 3: Commit**

```bash
git add src/scenes/room-scene.ts
git commit -m "feat(room): wire sprite registry into room scene agent spawning"
```

### Task 6: Update main.ts with pixelArt config and sprite preloading

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Update engine config**

In `src/main.ts`, change the engine creation — use `antialiasing: false` for crisp nearest-neighbor rendering (do NOT combine with `pixelArt: true` as they send contradictory signals):

```typescript
const engine = new ex.Engine({
	width: ENGINE_WIDTH,
	height: ENGINE_HEIGHT,
	backgroundColor: ex.Color.fromHex("#0a0a0f"),
	displayMode: ex.DisplayMode.FitScreen,
	antialiasing: false,
	suppressPlayButton: true,
});
```

- [ ] **Step 2: Add sprite preloading**

Add imports at the top of `main.ts`:

```typescript
import { resolveCharacter } from "./sprites/character-pool.js";
import { preloadSpriteRegistry } from "./sprites/sprite-loader.js";
```

After scenes are created (around line 148), before `engine.start()`, add:

```typescript
// ── Preload sprites ─────────────────────────────────────
const ASSET_BASE = "assets/Actor/Characters/";
```

After `syncSystem.start()` returns the agent list, preload sprites for all agents. Move sprite loading to just before `engine.start()`:

Actually, sprites need to be loaded before agents can be created, but the agent list comes from `syncSystem.start()`. The solution: load sprites for ALL characters in the pool upfront (41 unique characters), then create agents after.

Replace the section near the end of `main()` that calls `engine.start()` and `syncSystem.start()`:

```typescript
// ── Preload all character sprites ───────────────────────
const ASSET_BASE = "assets/Actor/Characters/";
const allCharacters = [
	...new Set(Object.values(DOMAIN_POOLS).flat()),
];
const spriteRegistry = await preloadSpriteRegistry(allCharacters, ASSET_BASE);

// ── Pass sprite registry to scenes ──────────────────────
hubScene.setSpriteRegistry(spriteRegistry);
officeScene.setSpriteRegistry(spriteRegistry);
villageScene.setSpriteRegistry(spriteRegistry);
stationScene.setSpriteRegistry(spriteRegistry);

// ── Start ───────────────────────────────────────────────
await engine.start();
engine.goToScene("hub");
```

Also add the `DOMAIN_POOLS` import:

```typescript
import { DOMAIN_POOLS } from "./sprites/character-pool.js";
```

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add src/main.ts
git commit -m "feat(engine): pixelArt mode, sprite preloading, registry wiring"
```

---

## Chunk 5: Build pipeline, cleanup, and verification

### Task 7: Update build.mjs to copy sprite assets

**Files:**
- Modify: `build.mjs`

- [ ] **Step 1: Update build.mjs**

Add asset copying after the `copyFileSync` for index.html:

```javascript
import { build } from "esbuild";
import { copyFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outdirArg = process.argv.find((a) => a.startsWith("--outdir="));
const outDir = outdirArg
	? resolve(outdirArg.slice("--outdir=".length))
	: resolve(__dirname, "../.flowti/agents");

mkdirSync(outDir, { recursive: true });
mkdirSync(resolve(outDir, "data"), { recursive: true });

await build({
	entryPoints: [resolve(__dirname, "src/main.ts")],
	bundle: true,
	outfile: resolve(outDir, "dashboard.js"),
	format: "esm",
	platform: "browser",
	target: "es2022",
	sourcemap: true,
	minify: false,
	logLevel: "info",
});

copyFileSync(resolve(__dirname, "index.html"), resolve(outDir, "index.html"));

// ── Copy character sprite assets ────────────────────────────────────
const assetsDir = resolve(__dirname, "assets/Actor/Characters");
if (existsSync(assetsDir)) {
	const characters = readdirSync(assetsDir, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name);

	for (const char of characters) {
		const animDir = join(assetsDir, char, "SeparateAnim");
		if (!existsSync(animDir)) continue;

		const outAnimDir = resolve(outDir, "assets/Actor/Characters", char, "SeparateAnim");
		mkdirSync(outAnimDir, { recursive: true });

		for (const file of ["Idle.png", "Walk.png"]) {
			const src = join(animDir, file);
			if (existsSync(src)) {
				copyFileSync(src, join(outAnimDir, file));
			}
		}
	}
	console.log(`Copied sprite assets for ${characters.length} characters`);
}

console.log("Dashboard built → .flowti/agents/");
```

- [ ] **Step 2: Test build**

Run: `npm run build`
Expected: Build succeeds, prints "Copied sprite assets for N characters", output includes `assets/` subdirectory

- [ ] **Step 3: Commit**

```bash
git add build.mjs
git commit -m "build: copy Ninja Adventure sprite PNGs to output directory"
```

### Task 8: Delete pixel-sprites and its tests

**Files:**
- Delete: `src/actors/pixel-sprites.ts`
- Delete: `tests/actors/pixel-sprites.test.ts`

- [ ] **Step 1: Verify no remaining imports of pixel-sprites**

Run: `grep -r "pixel-sprites" src/ tests/`
Expected: No results (all imports were removed in Task 3)

- [ ] **Step 2: Delete the files**

```bash
rm src/actors/pixel-sprites.ts tests/actors/pixel-sprites.test.ts
```

- [ ] **Step 3: Run full test suite and build**

Run: `npx vitest run && npm run build`
Expected: All tests PASS, build succeeds

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "cleanup: remove programmatic pixel-sprites (replaced by Ninja Adventure spritesheets)"
```

### Task 9: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run build**

Run: `npm run build`
Expected: Clean build with sprite assets copied

- [ ] **Step 3: Verify asset output**

Run: `ls ../.flowti/agents/assets/Actor/Characters/ | head -10`
Expected: Character directories present

- [ ] **Step 4: Final commit (if any fixups needed)**

```bash
git add -A
git commit -m "chore: sprite integration final verification"
```
