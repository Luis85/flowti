# Excalibur RPG Phase B2 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the static agent hub into a living RPG world with pixel-art characters, populated rooms, end-to-end panel integration, and themed scene atmospheres.

**Architecture:** Pure Canvas2D sprite drawing in `pixel-sprites.ts` (no ExcaliburJS dependency, fully testable). `AgentActor` swaps cached `ex.Canvas` graphics per brain state. Room scenes spawn agents by domain via `resolveSettingForDomain()`. SyncSystem routes agents to rooms and implements entity diff reconciliation. Brain system runs on engine `preframe` for cross-scene updates. FadeInOut transitions between scenes.

**Tech Stack:** ExcaliburJS v0.32.0 (engine, `ex.Canvas`, `ex.Animation`, `ex.FadeInOut`), Canvas2D API (pixel-art drawing), vitest (tests)

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-16-excalibur-rpg-phase-b2-design.md`

---

## Chunk 1: Pixel-Art Sprite System

Pure Canvas2D drawing functions for agent poses. No ExcaliburJS dependency — fully unit testable.

### Task 1: Create pixel-sprites.ts with color utilities and idle pose

**Files:**
- Create: `01 - Projects/Flowti CLI/agents/src/actors/pixel-sprites.ts`
- Create: `01 - Projects/Flowti CLI/agents/tests/actors/pixel-sprites.test.ts`

- [ ] **Step 1: Write test for color utilities and idle pose**

```typescript
import { describe, it, expect } from "vitest";
import { hashColor, statusPalette, drawIdlePose } from "../../src/actors/pixel-sprites.js";

describe("hashColor", () => {
	it("returns a consistent hex color for a given name", () => {
		const c1 = hashColor("Bob");
		const c2 = hashColor("Bob");
		expect(c1).toBe(c2);
		expect(c1).toMatch(/^#[0-9a-f]{6}$/);
	});
	it("returns different colors for different names", () => {
		expect(hashColor("Bob")).not.toBe(hashColor("Alice"));
	});
});

describe("statusPalette", () => {
	it("returns body and limb colors for busy", () => {
		const p = statusPalette("busy");
		expect(p.body).toBe("#22c55e");
		expect(p.limb).toMatch(/^#[0-9a-f]{6}$/);
	});
	it("defaults to unassigned for unknown status", () => {
		const p = statusPalette("unknown");
		expect(p.body).toBe("#6b7280");
	});
});

describe("drawIdlePose", () => {
	it("draws onto a 24x32 canvas without errors", () => {
		const canvas = new OffscreenCanvas(24, 32);
		const ctx = canvas.getContext("2d")!;
		drawIdlePose(ctx, { body: "#3b82f6", limb: "#2563eb", hair: "#a855f7" }, "neutral", false);
		// Verify pixels were drawn (not all transparent)
		const data = ctx.getImageData(12, 4, 1, 1).data;
		expect(data[3]).toBeGreaterThan(0); // alpha > 0 at head position
	});
});
```

- [ ] **Step 2: Implement pixel-sprites.ts with color utilities and idle pose**

```typescript
/** pixel-sprites.ts — Pure Canvas2D pixel-art drawing for agent poses. */

export interface SpritePalette {
	readonly body: string;
	readonly limb: string;
	readonly hair: string;
}

const STATUS_BODIES: Record<string, string> = {
	busy: "#22c55e", idle: "#3b82f6", unassigned: "#6b7280", waiting: "#f59e0b",
};

const LIMB_DARKEN: Record<string, string> = {
	busy: "#16a34a", idle: "#2563eb", unassigned: "#4b5563", waiting: "#d97706",
};

export function hashColor(name: string): string {
	let hash = 0;
	for (let i = 0; i < name.length; i++) {
		hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
	}
	const hue = Math.abs(hash) % 360;
	return `hsl(${hue}, 60%, 50%)`;
}

export function statusPalette(status: string): { body: string; limb: string } {
	return {
		body: STATUS_BODIES[status] ?? STATUS_BODIES["unassigned"],
		limb: LIMB_DARKEN[status] ?? LIMB_DARKEN["unassigned"],
	};
}

type Mood = "happy" | "enthusiastic" | "neutral" | "frustrated" | "angry" | "focused" | string;

function drawHead(ctx: CanvasRenderingContext2D, cx: number, y: number, hairColor: string, bodyColor: string, mood: Mood): void {
	// Hair (top 2 rows of 4x4 head)
	ctx.fillStyle = hairColor;
	ctx.fillRect(cx - 2, y, 4, 2);
	// Face
	ctx.fillStyle = bodyColor;
	ctx.fillRect(cx - 2, y + 2, 4, 2);
	// Eyes (white dots)
	ctx.fillStyle = "#ffffff";
	ctx.fillRect(cx - 1, y + 2, 1, 1);
	ctx.fillRect(cx + 1, y + 2, 1, 1);
	// Mouth by mood
	ctx.fillStyle = "#ffffff";
	if (mood === "happy" || mood === "enthusiastic" || mood === "excited") {
		ctx.fillRect(cx - 1, y + 3, 1, 1);
		ctx.fillRect(cx + 1, y + 3, 1, 1);
	} else if (mood === "frustrated" || mood === "angry" || mood === "stressed") {
		ctx.fillRect(cx, y + 3, 1, 1);
	} else if (mood === "focused" || mood === "determined") {
		ctx.fillRect(cx - 1, y + 3, 2, 1);
	} else {
		ctx.fillRect(cx, y + 3, 1, 1);
	}
}

export function drawIdlePose(ctx: CanvasRenderingContext2D, palette: SpritePalette, mood: Mood, flip: boolean): void {
	if (flip) { ctx.save(); ctx.translate(24, 0); ctx.scale(-1, 1); }
	const cx = 12;
	// Head at y=2
	drawHead(ctx, cx, 2, palette.hair, palette.body, mood);
	// Body (6x8 rect starting at y=7)
	ctx.fillStyle = palette.body;
	ctx.fillRect(cx - 3, 7, 6, 8);
	// Arms at sides
	ctx.fillStyle = palette.limb;
	ctx.fillRect(cx - 5, 8, 2, 6); // left arm
	ctx.fillRect(cx + 3, 8, 2, 6); // right arm
	// Legs
	ctx.fillRect(cx - 3, 15, 2, 6); // left leg
	ctx.fillRect(cx + 1, 15, 2, 6); // right leg
	if (flip) { ctx.restore(); }
}
```

- [ ] **Step 3: Run tests**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run tests/actors/pixel-sprites.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/actors/pixel-sprites.ts" "01 - Projects/Flowti CLI/agents/tests/actors/pixel-sprites.test.ts"
git commit -m "feat: add pixel-sprites with color utilities and idle pose"
```

### Task 2: Add remaining poses (walking, working, talking, waiting)

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/actors/pixel-sprites.ts`
- Modify: `01 - Projects/Flowti CLI/agents/tests/actors/pixel-sprites.test.ts`

- [ ] **Step 1: Add tests for all remaining poses**

```typescript
describe("drawWalkFrame", () => {
	it("draws frame 0 without errors", () => {
		const canvas = new OffscreenCanvas(24, 32);
		const ctx = canvas.getContext("2d")!;
		drawWalkFrame(ctx, { body: "#3b82f6", limb: "#2563eb", hair: "#a855f7" }, "neutral", false, 0);
		expect(ctx.getImageData(12, 4, 1, 1).data[3]).toBeGreaterThan(0);
	});
	it("draws frame 1 differently from frame 0", () => {
		const c0 = new OffscreenCanvas(24, 32);
		const c1 = new OffscreenCanvas(24, 32);
		const pal = { body: "#3b82f6", limb: "#2563eb", hair: "#a855f7" };
		drawWalkFrame(c0.getContext("2d")!, pal, "neutral", false, 0);
		drawWalkFrame(c1.getContext("2d")!, pal, "neutral", false, 1);
		const d0 = c0.getContext("2d")!.getImageData(0, 15, 24, 8).data;
		const d1 = c1.getContext("2d")!.getImageData(0, 15, 24, 8).data;
		let diff = false;
		for (let i = 0; i < d0.length; i++) { if (d0[i] !== d1[i]) { diff = true; break; } }
		expect(diff).toBe(true);
	});
});

describe("drawWorkingPose", () => {
	it("draws without errors", () => {
		const canvas = new OffscreenCanvas(24, 32);
		const ctx = canvas.getContext("2d")!;
		drawWorkingPose(ctx, { body: "#22c55e", limb: "#16a34a", hair: "#a855f7" }, "focused", false);
		expect(ctx.getImageData(12, 4, 1, 1).data[3]).toBeGreaterThan(0);
	});
});

describe("drawTalkingPose", () => {
	it("draws without errors", () => {
		const canvas = new OffscreenCanvas(24, 32);
		const ctx = canvas.getContext("2d")!;
		drawTalkingPose(ctx, { body: "#3b82f6", limb: "#2563eb", hair: "#a855f7" }, "happy", false);
		expect(ctx.getImageData(12, 4, 1, 1).data[3]).toBeGreaterThan(0);
	});
});

describe("drawWaitingPose", () => {
	it("draws without errors", () => {
		const canvas = new OffscreenCanvas(24, 32);
		const ctx = canvas.getContext("2d")!;
		drawWaitingPose(ctx, { body: "#f59e0b", limb: "#d97706", hair: "#a855f7" }, "neutral", false);
		expect(ctx.getImageData(12, 4, 1, 1).data[3]).toBeGreaterThan(0);
	});
});
```

- [ ] **Step 2: Implement all remaining poses**

Add to `pixel-sprites.ts`:

- `drawWalkFrame(ctx, palette, mood, flip, frame: 0 | 1)` — same as idle but legs alternate position. Frame 0: left leg forward (shifted left 1px), right leg back. Frame 1: opposite.
- `drawWorkingPose(ctx, palette, mood, flip)` — body at y=10 (seated lower), arms forward (extend in front of body at y=9, reaching to cx±5).
- `drawTalkingPose(ctx, palette, mood, flip)` — one arm raised (right arm at angle, reaching up to y=6), mouth drawn as 2px wide open rectangle.
- `drawWaitingPose(ctx, palette, mood, flip)` — same as idle pose but with a "?" drawn above head at y=0 in amber (#f59e0b), 3px font.

- [ ] **Step 3: Run tests**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run tests/actors/pixel-sprites.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/actors/pixel-sprites.ts" "01 - Projects/Flowti CLI/agents/tests/actors/pixel-sprites.test.ts"
git commit -m "feat: add walking, working, talking, and waiting pixel-art poses"
```

### Task 3: Rewrite AgentActor to use pixel-art poses

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/actors/agent-actor.ts`

- [ ] **Step 1: Rewrite agent-actor.ts**

Replace the current circle-with-initials Canvas graphic with a pose-based system:

1. On construction, build pose graphics:
   - `idle` → `ex.Canvas` using `drawIdlePose`, `cache: true`
   - `working` → `ex.Canvas` using `drawWorkingPose`, `cache: true`
   - `talking` → `ex.Canvas` using `drawTalkingPose`, `cache: true`
   - `waiting` → `ex.Canvas` using `drawWaitingPose`, `cache: true`
   - `wandering` → `ex.Animation` with 2 frames: `drawWalkFrame(…, 0)` and `drawWalkFrame(…, 1)`, 300ms interval
   - `walking-to` → `ex.Animation` with 2 frames, 200ms interval

2. Store in `poseGraphics: Map<BrainState, ex.Graphic>`

3. On `updateFromBrain(state, target)`: call `this.graphics.use(poseGraphics.get(state))` if state changed. Update `facingLeft` and rebuild poses if flip direction changed.

4. `onPreUpdate`: add idle bob — oscillate `pos.y` by ±1px using `Math.sin(elapsed * 0.008)` when state is idle.

5. Keep: name label and AI/H badge dot below the sprite (drawn as part of the Canvas or as a child Label actor).

6. Keep: `onSelect` click handler via `pointerdown`.

- [ ] **Step 2: Build game to verify**

```bash
cd "01 - Projects/Flowti CLI/agents" && node build.mjs --outdir="$(cd ../../../.. && pwd)/.flowti/agents"
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/actors/agent-actor.ts"
git commit -m "feat: rewrite AgentActor with pixel-art pose system"
```

---

## Chunk 2: Scene Backgrounds & Workstation Styles

Themed floor backgrounds for each scene and styled workstations.

### Task 4: Create scene-backgrounds.ts

**Files:**
- Create: `01 - Projects/Flowti CLI/agents/src/actors/scene-backgrounds.ts`
- Create: `01 - Projects/Flowti CLI/agents/tests/actors/scene-backgrounds.test.ts`

- [ ] **Step 1: Write tests**

```typescript
import { describe, it, expect } from "vitest";
import { drawOfficeFloor, drawVillageFloor, drawStationFloor } from "../../src/actors/scene-backgrounds.js";

describe("scene backgrounds", () => {
	it("drawOfficeFloor runs without error", () => {
		const canvas = new OffscreenCanvas(1200, 700);
		const ctx = canvas.getContext("2d")!;
		expect(() => drawOfficeFloor(ctx, 1200, 700)).not.toThrow();
	});
	it("drawVillageFloor runs without error", () => {
		const canvas = new OffscreenCanvas(1200, 700);
		const ctx = canvas.getContext("2d")!;
		expect(() => drawVillageFloor(ctx, 1200, 700)).not.toThrow();
	});
	it("drawStationFloor runs without error", () => {
		const canvas = new OffscreenCanvas(1200, 700);
		const ctx = canvas.getContext("2d")!;
		expect(() => drawStationFloor(ctx, 1200, 700)).not.toThrow();
	});
});
```

- [ ] **Step 2: Implement scene-backgrounds.ts**

Three functions, each takes `(ctx, width, height)`:

- `drawOfficeFloor` — fill `#0c1524`, draw terminal-green grid lines (`#1a3a2a`, 40px spacing), add 3-4 monitor glow spots (small radial gradients at workstation positions, green-blue tint).
- `drawVillageFloor` — fill `#15120d`, draw cobblestone pattern (alternating 20x20 rectangles with slight shade variation `#1a150f` / `#12100b`), add warm lantern spots (small radial gradients, orange-yellow tint) at 3-4 positions.
- `drawStationFloor` — fill `#080d14`, draw hex grid pattern (staggered vertical lines with short horizontal connectors, cyan `#0e3d4a`), add console glow spots at workstation positions.

- [ ] **Step 3: Run tests**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run tests/actors/scene-backgrounds.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/actors/scene-backgrounds.ts" "01 - Projects/Flowti CLI/agents/tests/actors/scene-backgrounds.test.ts"
git commit -m "feat: add themed scene background drawing functions"
```

### Task 5: Add workstation style variants

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/actors/workstation-actor.ts`

- [ ] **Step 1: Add `style` property to WorkstationActorConfig**

```typescript
export interface WorkstationActorConfig {
	readonly x: number;
	readonly y: number;
	readonly workstationColor: string;
	readonly style?: "desk" | "workbench" | "console";
}
```

- [ ] **Step 2: Update buildGraphic to draw per style**

In `buildGraphic()`, switch on `this.style`:
- `"desk"` (default) — current desk drawing + small monitor rectangle (4x3 pixels) on top of desk surface, filled with `#3b82f6` glow.
- `"workbench"` — wider (56px instead of 48px), wood-toned surface (`#5c4033`), slightly rounded top edge.
- `"console"` — angular shape (trapezoidal top edge), cyan edge accent (`#06b6d4`), 2-3 small indicator dots on surface.

- [ ] **Step 3: Build to verify**

```bash
cd "01 - Projects/Flowti CLI/agents" && node build.mjs --outdir="$(cd ../../../.. && pwd)/.flowti/agents"
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/actors/workstation-actor.ts"
git commit -m "feat: add desk/workbench/console workstation styles"
```

### Task 6: Wire backgrounds into room scenes and pass workstation styles

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/scenes/room-scene.ts`
- Modify: `01 - Projects/Flowti CLI/agents/src/scenes/office-scene.ts`
- Modify: `01 - Projects/Flowti CLI/agents/src/scenes/village-scene.ts`
- Modify: `01 - Projects/Flowti CLI/agents/src/scenes/station-scene.ts`

- [ ] **Step 1: Add `style` and `drawBackground` to RoomScene constructor**

Update `RoomSceneConfig` to accept optional `workstationStyle` and `drawBackground`:

```typescript
export interface RoomSceneConfig {
	readonly onSceneChange: (targetScene: string) => void;
	readonly onAgentSelect: (agentName: string) => void;
	readonly workstationStyle?: "desk" | "workbench" | "console";
	readonly drawBackground?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
}
```

In `onInitialize`, if `drawBackground` is provided, create a floor actor with a Canvas using it. Pass `workstationStyle` to each `WorkstationActor` created in the grid.

- [ ] **Step 2: Update factory functions**

```typescript
// office-scene.ts
import { drawOfficeFloor } from "../actors/scene-backgrounds.js";
export function createOfficeScene(config: Omit<RoomSceneConfig, "workstationStyle" | "drawBackground">): RoomScene {
	return new RoomScene("office", { ...config, workstationStyle: "desk", drawBackground: drawOfficeFloor });
}
```

Same pattern for village (`drawVillageFloor`, `"workbench"`) and station (`drawStationFloor`, `"console"`).

- [ ] **Step 3: Build to verify**

```bash
cd "01 - Projects/Flowti CLI/agents" && node build.mjs --outdir="$(cd ../../../.. && pwd)/.flowti/agents"
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/scenes/room-scene.ts" "01 - Projects/Flowti CLI/agents/src/scenes/office-scene.ts" "01 - Projects/Flowti CLI/agents/src/scenes/village-scene.ts" "01 - Projects/Flowti CLI/agents/src/scenes/station-scene.ts"
git commit -m "feat: wire themed backgrounds and workstation styles into room scenes"
```

---

## Chunk 3: Room Distribution & Cross-Scene Brain

Route agents to rooms by domain and ensure the brain system works across scene switches.

### Task 7: Add agent-to-room routing in SyncSystem

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/systems/sync-system.ts`

- [ ] **Step 1: Add room scene references to SyncSystem**

Add a `roomScenes` parameter to the constructor or a `setRoomScenes` method:

```typescript
private roomScenes: Record<string, RoomScene> = {};

setRoomScenes(scenes: Record<string, RoomScene>): void {
	this.roomScenes = scenes;
}
```

- [ ] **Step 2: Route agents to rooms in onAgentsUpdated callback**

After `this.dashboardAgents = ...`, add routing logic. Import `resolveSettingForDomain` from `config/domain-map.js`. For each agent, resolve setting and call `roomScene.spawnAgent(agent)` if the setting has a scene. Track which agents are in which rooms to handle removals.

- [ ] **Step 3: Implement onStateDiff**

Replace the stub with real logic:

```typescript
onStateDiff: (diff) => {
	// Handle added entities — may need to spawn new agents
	// Handle removed entities — kill actors, unregister from brain/bubble
	// Handle changed entities — update visual status, trigger brain events
	for (const id of diff.changed) {
		const entity = syncSystem.getStateStore().getEntity(id);
		if (entity?.type === "agent") {
			const statusComp = entity.components.status as { state?: string } | undefined;
			if (statusComp?.state) {
				brainSystem.applyEvent(id, statusComp.state);
			}
		}
	}
}
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/systems/sync-system.ts"
git commit -m "feat: route agents to room scenes by domain, implement entity diff reconciliation"
```

### Task 8: Add position sync on scene activate

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/scenes/room-scene.ts`
- Modify: `01 - Projects/Flowti CLI/agents/src/systems/brain-system.ts`

- [ ] **Step 1: Add position storage to BrainSystem**

Add `position: { x: number; y: number }` to the `AgentBrainEntry` interface. Update `update()` to store the actor's current position after moving it. Add a getter:

```typescript
getPosition(name: string): { x: number; y: number } | undefined {
	const entry = this.agents.get(name);
	return entry ? { ...entry.position } : undefined;
}
```

- [ ] **Step 2: Add onActivate to RoomScene**

Override `onActivate` in RoomScene to sync actor positions from brain state:

```typescript
onActivate(_oldScene: ex.Scene, _newScene: ex.Scene): void {
	if (!this.brainSystem) return;
	for (const [name, actor] of this.agentActors) {
		const pos = this.brainSystem.getPosition(name);
		if (pos) {
			actor.pos.x = pos.x;
			actor.pos.y = pos.y;
		}
	}
}
```

Add a `setBrainSystem(brain: BrainSystem)` method so main.ts can wire it.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/scenes/room-scene.ts" "01 - Projects/Flowti CLI/agents/src/systems/brain-system.ts"
git commit -m "feat: sync agent positions from brain state on scene activate"
```

### Task 9: Wire workstation occupy/vacate in brain system

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/systems/brain-system.ts`

- [ ] **Step 1: Add workstation callback**

Add an `onWorkstationChange` callback to `BrainSystemConfig`:

```typescript
export interface BrainSystemConfig {
	readonly bounds: Bounds;
	readonly onWorkstationChange?: (agentName: string, action: "occupy" | "vacate", position: Position) => void;
}
```

- [ ] **Step 2: Call callback on state transitions**

In `updateMoving`, when an agent arrives at a workstation target (`entry.target.kind === "workstation"` and within `ARRIVAL_THRESHOLD`), call `onWorkstationChange(name, "occupy", targetPos)`.

In `applyEvent`, when transitioning FROM working to idle/wandering, call `onWorkstationChange(name, "vacate", currentPos)`.

- [ ] **Step 3: Wire in main.ts**

In main.ts, pass the callback when creating BrainSystem. The callback should find the appropriate room scene and call `workstation.occupy(name)` or `workstation.vacate()` on the nearest workstation.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/systems/brain-system.ts" "01 - Projects/Flowti CLI/agents/src/main.ts"
git commit -m "feat: wire workstation occupy/vacate on brain state transitions"
```

---

## Chunk 4: Scene Transitions & Hub Updates

FadeInOut transitions, connection indicator, hub indicator dots, ticker cleanup.

### Task 10: Add FadeInOut scene transitions

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/main.ts`

- [ ] **Step 1: Update handleSceneChange to use FadeInOut**

```typescript
import * as ex from "excalibur";

function handleSceneChange(engine: ex.Engine, targetScene: string): void {
	// Close panel if open
	panelManager.close();
	engine.goToScene(targetScene, {
		destinationIn: new ex.FadeInOut({ duration: 300, direction: "in" }),
		sourceOut: new ex.FadeInOut({ duration: 300, direction: "out" }),
	});
}
```

Note: Check ExcaliburJS v0.32 API — if `FadeInOut` constructor differs, adapt accordingly. The key is using the built-in transition instead of a manual overlay.

- [ ] **Step 2: Build and verify**

```bash
cd "01 - Projects/Flowti CLI/agents" && node build.mjs --outdir="$(cd ../../../.. && pwd)/.flowti/agents"
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/main.ts"
git commit -m "feat: add FadeInOut scene transitions"
```

### Task 11: Add connection status indicator to hub

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/scenes/hub-scene.ts`

- [ ] **Step 1: Add connection label**

In `onInitialize`, create a label at top-right:

```typescript
this.connectionLabel = new ex.Label({
	text: "POLLING",
	pos: ex.vec(engine.drawWidth - 12, 16),
	font: new ex.Font({
		family: "system-ui, sans-serif",
		size: 10,
		unit: ex.FontUnit.Px,
		color: ex.Color.fromHex("#f59e0b"),
		textAlign: ex.TextAlign.Right,
	}),
	anchor: ex.vec(1, 0.5),
	z: 20,
});
this.add(this.connectionLabel);
```

- [ ] **Step 2: Add updateConnectionStatus method**

```typescript
updateConnectionStatus(status: "connected" | "disconnected" | "reconnecting"): void {
	if (!this.connectionLabel) return;
	if (status === "connected") {
		this.connectionLabel.text = "LIVE";
		this.connectionLabel.font.color = ex.Color.fromHex("#22c55e");
	} else {
		this.connectionLabel.text = "POLLING";
		this.connectionLabel.font.color = ex.Color.fromHex("#f59e0b");
	}
}
```

- [ ] **Step 3: Wire in main.ts**

In the SyncSystem callbacks, wire `onConnectionStatus`:

```typescript
onConnectionStatus: (status) => {
	hubScene.updateConnectionStatus(status);
},
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/scenes/hub-scene.ts" "01 - Projects/Flowti CLI/agents/src/main.ts"
git commit -m "feat: add LIVE/POLLING connection status indicator to hub"
```

### Task 12: Convert hub agents to compact indicator dots

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/scenes/hub-scene.ts`

- [ ] **Step 1: Replace AgentActor with simple indicator dots in hub**

The hub should show small status-colored dots (8px radius) with name labels — not full pixel-art actors. Only agents without a domain get full actors in the hub.

Update `updateAgents` to create two types of actors:
- Agents WITH a domain: small circle indicator (an `ex.Actor` with a Canvas drawing a colored circle + tiny name), non-interactive (clicking navigates to their room instead)
- Agents WITHOUT a domain: full `AgentActor` with pixel-art, click-to-interact

This prevents dual-presence (full actor in hub + full actor in room).

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/scenes/hub-scene.ts"
git commit -m "feat: use compact indicator dots for domain-assigned agents in hub"
```

### Task 13: Fix activity ticker timestamp stripping

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/scenes/hub-scene.ts`

- [ ] **Step 1: Update ticker cleanup regex**

In `updateTicker`, add timestamp stripping:

```typescript
const clean = e.summary
	.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s*/i, "") // strip ISO timestamps
	.replace(/^(thinking|speaking|asking|using-tool)\s*/i, "")
	.replace(/```[\s\S]*?```/g, "[code]")
	.replace(/\{[\s\S]*?\}/g, "") // strip JSON objects
	.replace(/\n/g, " ")
	.trim()
	.slice(0, 50);
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/scenes/hub-scene.ts"
git commit -m "fix: strip timestamps and JSON from activity ticker"
```

---

## Chunk 5: Full Integration Loop

Wire panel actions to produce real game-side effects.

### Task 14: Wire speaking SSE to talk tab and bubble

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/main.ts`

- [ ] **Step 1: Verify speaking handler in onAgentAction**

The current code in main.ts already handles `speaking` events (shows bubble, appends to panel). Verify it works by checking:
1. `appendAgentResponse` is called with the right content element
2. The bubble system gets the speech text
3. Brain transitions to `talking` state

Read the current implementation, fix any issues found (e.g., the panel content query selector might not match). No changes needed if already correct.

- [ ] **Step 2: Commit if changes made**

```bash
git add "01 - Projects/Flowti CLI/agents/src/main.ts"
git commit -m "fix: verify and fix speaking SSE to panel and bubble wiring"
```

### Task 15: Wire permission auto-open with same-scene check

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/main.ts`
- Modify: `01 - Projects/Flowti CLI/agents/src/ui/agent-panel.ts`

- [ ] **Step 1: Add switchToTab method to panel**

In `agent-panel.ts`, after rendering tabs, expose a way to switch tabs programmatically. Add a `data-tab` attribute to each tab button and export a helper:

```typescript
export function switchToTab(panelContainer: HTMLElement, tabName: TabName): void {
	const tabBtn = panelContainer.querySelector(`[data-tab="${tabName}"]`);
	if (tabBtn instanceof HTMLElement) tabBtn.click();
}
```

- [ ] **Step 2: Update requesting-permission handler in main.ts**

In the `onAgentAction` handler for `requesting-permission`:
1. Check if the agent is in the current scene: find the actor in the current scene's actors
2. If yes: open panel, call `switchToTab(panelEl, "Permissions")`
3. If no: update the ticker with a notification message like `[AgentName] needs permission for [tool]`

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/main.ts" "01 - Projects/Flowti CLI/agents/src/ui/agent-panel.ts"
git commit -m "feat: auto-open panel to Permissions tab on same-scene permission request"
```

### Task 16: Wire task assignment brain transition

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/ui/tasks-tab.ts`
- Modify: `01 - Projects/Flowti CLI/agents/src/main.ts`

- [ ] **Step 1: Add onTaskAssigned callback to TasksTabOptions**

```typescript
export interface TasksTabOptions {
	readonly assignTask: typeof assignTask;
	readonly baseUrl: string;
	readonly currentPhase?: string;
	readonly isAiAgent?: boolean;
	readonly onTaskAssigned?: (agentName: string, taskName: string) => void;
}
```

- [ ] **Step 2: Call callback after successful assign**

In `renderTasksTab`, after the `assignTask()` call succeeds, call `options.onTaskAssigned?.(agent.name, taskName)`.

- [ ] **Step 3: Wire in main.ts**

In the panel render content callback, pass `onTaskAssigned` that calls:
```typescript
brainSystem.applyEvent(agentName, "task-started");
bubbleSystem.showBubble(agentName, "thought", taskName, engine.currentScene, findAgentActor);
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/ui/tasks-tab.ts" "01 - Projects/Flowti CLI/agents/src/main.ts"
git commit -m "feat: wire task assignment to brain transition and thought bubble"
```

---

## Chunk 6: Final Wiring, Build & Verification

Wire remaining pieces in main.ts, run all tests, build, verify.

### Task 17: Wire room scenes and sync system together in main.ts

**Files:**
- Modify: `01 - Projects/Flowti CLI/agents/src/main.ts`

- [ ] **Step 1: Pass room scenes to sync system**

After creating scenes and sync system:

```typescript
syncSystem.setRoomScenes({
	office: officeScene,
	village: villageScene,
	station: stationScene,
});
```

- [ ] **Step 2: Pass brain system to room scenes**

```typescript
officeScene.setBrainSystem(brainSystem);
villageScene.setBrainSystem(brainSystem);
stationScene.setBrainSystem(brainSystem);
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/agents/src/main.ts"
git commit -m "feat: wire room scenes to sync system and brain system in main"
```

### Task 18: Run all game tests

- [ ] **Step 1: Run all game tests**

```bash
cd "01 - Projects/Flowti CLI/agents" && npx vitest run
```

Expected: All tests pass (brain, data, config, UI, pixel-sprites, scene-backgrounds).

- [ ] **Step 2: Run all CLI tests**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts
```

Expected: All tests pass. No regressions.

- [ ] **Step 3: Type check CLI**

```bash
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json
```

- [ ] **Step 4: Build game**

```bash
cd "01 - Projects/Flowti CLI/agents" && node build.mjs --outdir="$(cd ../../../.. && pwd)/.flowti/agents"
```

- [ ] **Step 5: Commit if any remaining changes**

```bash
git add -A "01 - Projects/Flowti CLI/"
git commit -m "feat(iter-5): Excalibur RPG Phase B2 — pixel-art agents, room life, full integration"
```
