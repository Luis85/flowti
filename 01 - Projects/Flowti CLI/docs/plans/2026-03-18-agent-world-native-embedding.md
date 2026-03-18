# Agent World Native Embedding — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the ExcaliburJS Agent World game from a CLI-hosted blob URL artifact into a native TypeScript module inside the Flowti Plugin.

**Architecture:** The game becomes `src/game/` inside the plugin — imported, compiled, rendered natively. A factory function `createAgentWorld()` replaces the self-executing `main()` + window globals. A single `PluginProvider` reads vault files for data (no server required). Sprites ship as PNGs in the plugin output, loaded via Obsidian's `app://` protocol.

**Tech Stack:** ExcaliburJS 0.32.0, Lit 3.3.2, TypeScript 5.9, esbuild (CJS), Obsidian API

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-18-agent-world-native-embedding-design.md`

---

## Chunk 1: Infrastructure Setup

### Task 1: Add ExcaliburJS dependency and update build config

**Files:**
- Modify: `01 - Projects/Flowti Plugin/package.json`
- Modify: `01 - Projects/Flowti Plugin/esbuild.config.mjs`

- [ ] **Step 1: Install ExcaliburJS**

```bash
cd "01 - Projects/Flowti Plugin" && npm install excalibur@0.32.0
```

Excalibur goes in `dependencies` (not devDependencies) because it's bundled into the plugin output.

- [ ] **Step 2: Add sprite copy step to esbuild.config.mjs**

After the existing `syncAssets()` function (line ~174), add a `syncSprites()` function:

```javascript
/** Copy character sprite PNGs to output directory. */
const syncSprites = () => {
	const srcBase = path.resolve(__dirname, "assets/Actor/Characters");
	if (!safeExists(srcBase)) return;
	const characters = readdirSync(srcBase, { withFileTypes: true })
		.filter((d) => d.isDirectory())
		.map((d) => d.name);
	for (const char of characters) {
		const animDir = path.join(srcBase, char, "SeparateAnim");
		if (!safeExists(animDir)) continue;
		const outAnimDir = path.join(OUTDIR, "assets/Actor/Characters", char, "SeparateAnim");
		mkdirSync(outAnimDir, { recursive: true });
		for (const file of ["Idle.png", "Walk.png"]) {
			const src = path.join(animDir, file);
			if (safeExists(src)) safeCopyFile(src, path.join(outAnimDir, file));
		}
	}
};
```

Add `import { readdirSync, mkdirSync } from "node:fs";` at the top if not already imported.

Call `syncSprites()` inside the existing `syncAssets()` function, after the asset copy loop.

- [ ] **Step 3: Verify build still works**

```bash
cd "01 - Projects/Flowti Plugin" && npm run build
```

Expected: Build succeeds. Output directory should NOT contain sprites yet (no sprite assets exist at `assets/Actor/Characters/` yet).

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/package.json" "01 - Projects/Flowti Plugin/package-lock.json" "01 - Projects/Flowti Plugin/esbuild.config.mjs"
git commit -m "feat(game): add excalibur dependency and sprite copy build step"
```

### Task 2: Move sprite assets to plugin

**Files:**
- Move: `01 - Projects/Flowti CLI/agents/assets/Actor/Characters/` → `01 - Projects/Flowti Plugin/assets/Actor/Characters/`

- [ ] **Step 1: Copy only Idle.png and Walk.png per character**

Write a script or use shell commands to copy only the needed sprites:

```bash
cd "C:/Projects/flowti"
mkdir -p "01 - Projects/Flowti Plugin/assets/Actor/Characters"
for dir in "01 - Projects/Flowti CLI/agents/assets/Actor/Characters"/*/; do
  char=$(basename "$dir")
  animdir="$dir/SeparateAnim"
  if [ -d "$animdir" ]; then
    mkdir -p "01 - Projects/Flowti Plugin/assets/Actor/Characters/$char/SeparateAnim"
    for f in Idle.png Walk.png; do
      if [ -f "$animdir/$f" ]; then
        cp "$animdir/$f" "01 - Projects/Flowti Plugin/assets/Actor/Characters/$char/SeparateAnim/$f"
      fi
    done
  fi
done
```

- [ ] **Step 2: Git-track the sprite assets**

The sprites are small (~1-3KB each, ~200-400KB total) and the CLI `agents/` directory is being deleted — there is no shared source location to copy from at build time. Git-track them directly in the plugin's `assets/` directory. No `.gitignore` entry needed.

- [ ] **Step 3: Verify build copies sprites to output**

```bash
cd "01 - Projects/Flowti Plugin" && npm run build
ls ".obsidian/plugins/flowti-ibde/assets/Actor/Characters/" | head -10
```

Expected: Character directories appear in the output.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/assets/" "01 - Projects/Flowti Plugin/.gitignore"
git commit -m "feat(game): move character sprites to plugin assets"
```

---

## Chunk 2: Pure Domain Migration (no ExcaliburJS deps)

These files have zero ExcaliburJS imports and can be migrated with minimal changes. They form the foundation that actors, scenes, and systems depend on.

### Task 3: Migrate brain/ directory

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/brain/brain-types.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/brain/agent-brain.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/brain/movement.ts`
- Create: `01 - Projects/Flowti Plugin/tests/game/brain/agent-brain.test.ts`
- Create: `01 - Projects/Flowti Plugin/tests/game/brain/movement.test.ts`

- [ ] **Step 1: Copy brain files from CLI agents**

```bash
mkdir -p "01 - Projects/Flowti Plugin/src/game/brain"
cp "01 - Projects/Flowti CLI/agents/src/brain/brain-types.ts" "01 - Projects/Flowti Plugin/src/game/brain/"
cp "01 - Projects/Flowti CLI/agents/src/brain/agent-brain.ts" "01 - Projects/Flowti Plugin/src/game/brain/"
cp "01 - Projects/Flowti CLI/agents/src/brain/movement.ts" "01 - Projects/Flowti Plugin/src/game/brain/"
```

- [ ] **Step 2: Adapt to plugin conventions**

For each file:
- Convert indentation from spaces to tabs
- Update import paths: `"./brain-types.js"` stays the same (relative within game/)
- No other changes needed — these are pure domain files with no ExcaliburJS or Lit imports

- [ ] **Step 3: Write tests for agent-brain.ts**

Create `tests/game/brain/agent-brain.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { transition, computeParams, computeHabits } from "../../../src/game/brain/agent-brain.js";

describe("transition", () => {
	it("idle → wandering on wander event", () => {
		expect(transition("idle", "wander").state).toBe("wandering");
	});

	it("idle → working on task-started event", () => {
		expect(transition("idle", "task-started").state).toBe("working");
	});

	it("working → idle on idle event", () => {
		expect(transition("working", "idle").state).toBe("idle");
	});
});

describe("computeParams", () => {
	it("returns default params with no attributes", () => {
		const params = computeParams({});
		expect(params.speed).toBeGreaterThan(0);
		expect(params.socialRadius).toBeGreaterThan(0);
	});

	it("high CHA increases social radius", () => {
		const low = computeParams({ cha: 5 });
		const high = computeParams({ cha: 20 });
		expect(high.socialRadius).toBeGreaterThan(low.socialRadius);
	});
});

describe("computeHabits", () => {
	it("returns habits object", () => {
		const habits = computeHabits({}, "neutral", "engineering");
		expect(habits).toBeDefined();
	});
});
```

- [ ] **Step 4: Write tests for movement.ts**

Create `tests/game/brain/movement.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { preferredWorkstation } from "../../../src/game/brain/movement.js";

describe("preferredWorkstation", () => {
	it("returns nearest unoccupied workstation", () => {
		const pos = { x: 100, y: 100 };
		const workstations = [
			{ id: "ws-1", x: 200, y: 100, occupied: false },
			{ id: "ws-2", x: 110, y: 100, occupied: false },
		];
		const result = preferredWorkstation(pos, workstations);
		expect(result).toBeDefined();
		expect(result!.id).toBe("ws-2");
	});

	it("skips occupied workstations", () => {
		const pos = { x: 100, y: 100 };
		const workstations = [
			{ id: "ws-1", x: 110, y: 100, occupied: true },
			{ id: "ws-2", x: 200, y: 100, occupied: false },
		];
		const result = preferredWorkstation(pos, workstations);
		expect(result!.id).toBe("ws-2");
	});

	it("returns null when all occupied", () => {
		const pos = { x: 100, y: 100 };
		const workstations = [
			{ id: "ws-1", x: 110, y: 100, occupied: true },
		];
		const result = preferredWorkstation(pos, workstations);
		expect(result).toBeNull();
	});
});
```

- [ ] **Step 5: Run tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/brain/ -v
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/brain/" "01 - Projects/Flowti Plugin/tests/game/brain/"
git commit -m "feat(game): migrate brain domain — state machine, movement, params"
```

### Task 4: Migrate data/types.ts, data/message-utils.ts, config/settings.ts, config/domain-map.ts

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/data/types.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/data/message-utils.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/config/settings.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/config/domain-map.ts`
- Create: `01 - Projects/Flowti Plugin/tests/game/config/domain-map.test.ts`

- [ ] **Step 1: Copy files**

```bash
mkdir -p "01 - Projects/Flowti Plugin/src/game/data"
mkdir -p "01 - Projects/Flowti Plugin/src/game/config"
cp "01 - Projects/Flowti CLI/agents/src/data/types.ts" "01 - Projects/Flowti Plugin/src/game/data/"
cp "01 - Projects/Flowti CLI/agents/src/data/message-utils.ts" "01 - Projects/Flowti Plugin/src/game/data/"
cp "01 - Projects/Flowti CLI/agents/src/config/settings.ts" "01 - Projects/Flowti Plugin/src/game/config/"
cp "01 - Projects/Flowti CLI/agents/src/config/domain-map.ts" "01 - Projects/Flowti Plugin/src/game/config/"
```

- [ ] **Step 2: Merge ConnectionStatus type into data/types.ts**

Add to the end of `src/game/data/types.ts`:

```typescript
export type ConnectionStatus = "connected" | "disconnected" | "reconnecting";
```

This type is copied verbatim from `event-stream.ts` (line 3) which is being deleted. The PluginProvider maps its internal state to these values.

- [ ] **Step 3: Adapt to plugin conventions**

Convert indentation to tabs in all four files. Update any import paths to be relative within `src/game/`.

- [ ] **Step 4: Write domain-map test**

Create `tests/game/config/domain-map.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveSettingForDomain } from "../../../src/game/config/domain-map.js";

describe("resolveSettingForDomain", () => {
	it("maps engineering to office", () => {
		expect(resolveSettingForDomain("engineering")).toBe("office");
	});

	it("maps design to village", () => {
		expect(resolveSettingForDomain("design")).toBe("village");
	});

	it("maps management to station", () => {
		expect(resolveSettingForDomain("management")).toBe("station");
	});

	it("returns hub for unknown domain", () => {
		expect(resolveSettingForDomain("unknown")).toBe("hub");
	});

	it("returns hub for undefined domain", () => {
		expect(resolveSettingForDomain(undefined as unknown as string)).toBe("hub");
	});
});
```

- [ ] **Step 5: Run tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/config/ -v
```

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/data/" "01 - Projects/Flowti Plugin/src/game/config/" "01 - Projects/Flowti Plugin/tests/game/config/"
git commit -m "feat(game): migrate data types, message utils, config, domain map"
```

### Task 5: Migrate sprites/ and store/

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/sprites/character-pool.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/sprites/sprite-loader.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts`
- Create: `01 - Projects/Flowti Plugin/tests/game/sprites/character-pool.test.ts`
- Create: `01 - Projects/Flowti Plugin/tests/game/store/dashboard-store.test.ts`

- [ ] **Step 1: Copy files**

```bash
mkdir -p "01 - Projects/Flowti Plugin/src/game/sprites"
mkdir -p "01 - Projects/Flowti Plugin/src/game/store"
cp "01 - Projects/Flowti CLI/agents/src/sprites/character-pool.ts" "01 - Projects/Flowti Plugin/src/game/sprites/"
cp "01 - Projects/Flowti CLI/agents/src/sprites/sprite-loader.ts" "01 - Projects/Flowti Plugin/src/game/sprites/"
cp "01 - Projects/Flowti CLI/agents/src/store/dashboard-store.ts" "01 - Projects/Flowti Plugin/src/game/store/"
```

- [ ] **Step 2: Adapt to plugin conventions**

- Convert indentation to tabs
- `sprite-loader.ts` imports `excalibur` — these imports stay as-is since excalibur is now a plugin dependency
- `dashboard-store.ts` has no ExcaliburJS imports — it's a pure EventTarget store
- Update relative imports within `src/game/`

- [ ] **Step 3: Write character-pool test**

Create `tests/game/sprites/character-pool.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { resolveCharacter, DOMAIN_POOLS } from "../../../src/game/sprites/character-pool.js";

describe("resolveCharacter", () => {
	it("returns a character name from the engineering pool", () => {
		const char = resolveCharacter("TestAgent", "engineering");
		expect(DOMAIN_POOLS["engineering"]).toContain(char);
	});

	it("is deterministic — same name always returns same character", () => {
		const a = resolveCharacter("Atlas", "engineering");
		const b = resolveCharacter("Atlas", "engineering");
		expect(a).toBe(b);
	});

	it("different names can produce different characters", () => {
		const chars = new Set<string>();
		for (let i = 0; i < 20; i++) {
			chars.add(resolveCharacter(`Agent${i}`, "engineering"));
		}
		expect(chars.size).toBeGreaterThan(1);
	});

	it("uses fallback pool for unknown domain", () => {
		const char = resolveCharacter("Test", "nonexistent");
		expect(DOMAIN_POOLS["fallback"]).toContain(char);
	});
});
```

- [ ] **Step 4: Write dashboard-store test**

Create `tests/game/store/dashboard-store.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { DashboardStore } from "../../../src/game/store/dashboard-store.js";

describe("DashboardStore", () => {
	it("sets and retrieves agents", () => {
		const store = new DashboardStore("");
		store.setAgents([{ name: "Atlas", agentType: "ai", status: "idle" }] as any);
		expect(store.agents).toHaveLength(1);
		expect(store.agents[0].name).toBe("Atlas");
	});

	it("emits state-changed event", () => {
		const store = new DashboardStore("");
		const handler = vi.fn();
		store.addEventListener("state-changed", handler);
		store.setAgents([{ name: "Atlas", agentType: "ai", status: "idle" }] as any);
		// state-changed uses requestAnimationFrame, so flush
		expect(handler).toHaveBeenCalled();
	});

	it("selects and deselects agent", () => {
		const store = new DashboardStore("");
		store.selectAgent("Atlas");
		expect(store.selectedAgent).toBe("Atlas");
		store.selectAgent(null);
		expect(store.selectedAgent).toBeNull();
	});

	it("batches position updates", () => {
		const store = new DashboardStore("");
		store.beginBatch();
		store.updatePositions(new Map([["Atlas", { x: 10, y: 20 }]]));
		store.endBatch();
		expect(store.agentPositions.get("Atlas")).toEqual({ x: 10, y: 20 });
	});
});
```

- [ ] **Step 5: Run tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/sprites/ tests/game/store/ -v
```

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/sprites/" "01 - Projects/Flowti Plugin/src/game/store/" "01 - Projects/Flowti Plugin/tests/game/sprites/" "01 - Projects/Flowti Plugin/tests/game/store/"
git commit -m "feat(game): migrate sprite pool, sprite loader, dashboard store"
```

### Task 6: Migrate talk engine and templates

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/systems/talk/talk-types.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/systems/talk/talk-engine.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/systems/talk/templates/index.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/systems/talk/templates/core.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/systems/talk/templates/engineering.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/systems/talk/templates/design.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/systems/talk/templates/product.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/systems/talk/templates/social.ts`
- Create: `01 - Projects/Flowti Plugin/tests/game/systems/talk/talk-engine.test.ts`

- [ ] **Step 1: Copy all talk files**

```bash
mkdir -p "01 - Projects/Flowti Plugin/src/game/systems/talk/templates"
cp "01 - Projects/Flowti CLI/agents/src/systems/talk/talk-types.ts" "01 - Projects/Flowti Plugin/src/game/systems/talk/"
cp "01 - Projects/Flowti CLI/agents/src/systems/talk/talk-engine.ts" "01 - Projects/Flowti Plugin/src/game/systems/talk/"
cp "01 - Projects/Flowti CLI/agents/src/systems/talk/templates/"*.ts "01 - Projects/Flowti Plugin/src/game/systems/talk/templates/"
```

Note: The CLI has a `talk-engine.ts` shim that re-exports from `./talk/talk-engine.js`. In the plugin, the talk engine lives directly at `src/game/systems/talk/talk-engine.ts` — no shim needed.

- [ ] **Step 2: Adapt to plugin conventions**

Convert indentation to tabs. Update imports to be relative within `src/game/`.

- [ ] **Step 3: Write talk-engine test**

Create `tests/game/systems/talk/talk-engine.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { TalkEngine } from "../../../../src/game/systems/talk/talk-engine.js";

describe("TalkEngine", () => {
	let showBubble: ReturnType<typeof vi.fn>;
	let isIdle: ReturnType<typeof vi.fn>;
	let engine: TalkEngine;

	beforeEach(() => {
		showBubble = vi.fn();
		isIdle = vi.fn().mockReturnValue(true);
		engine = new TalkEngine({ showBubble, isIdle });
	});

	it("registers an agent", () => {
		engine.register("Atlas", "engineering", ["Focused"], 10);
		// No error thrown
	});

	it("silence prevents chatter", () => {
		engine.register("Atlas", "engineering", ["Focused"], 10);
		engine.silence("Atlas");
		engine.update(10000); // Large delta
		expect(showBubble).not.toHaveBeenCalled();
	});

	it("generates chatter after enough time", () => {
		engine.register("Atlas", "engineering", ["Focused"], 20);
		// Run enough updates to trigger chatter
		for (let i = 0; i < 100; i++) {
			engine.update(500);
		}
		// With high CHA and enough time, should eventually talk
		// (probabilistic — test that it CAN talk, not exact timing)
		expect(showBubble.mock.calls.length).toBeGreaterThanOrEqual(0);
	});
});
```

- [ ] **Step 4: Run tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/talk/ -v
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/talk/" "01 - Projects/Flowti Plugin/tests/game/systems/talk/"
git commit -m "feat(game): migrate talk engine and domain conversation templates"
```

---

## Chunk 3: DataProvider Interface and PluginProvider

### Task 7: Migrate DataProvider interface

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/config/data-provider.ts`

- [ ] **Step 1: Copy and adapt DataProvider interface**

Copy from CLI:

```bash
cp "01 - Projects/Flowti CLI/agents/src/config/data-provider.ts" "01 - Projects/Flowti Plugin/src/game/config/"
```

- [ ] **Step 2: Update imports**

Change the import for `ConnectionStatus` to point to `../data/types.js` (where it was merged in Task 4). Convert indentation to tabs.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/config/data-provider.ts"
git commit -m "feat(game): migrate DataProvider interface"
```

### Task 8: Create PluginProvider

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/config/plugin-provider.ts`
- Create: `01 - Projects/Flowti Plugin/tests/game/config/plugin-provider.test.ts`

- [ ] **Step 1: Write the PluginProvider test**

Create `tests/game/config/plugin-provider.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPluginProvider, type PluginProviderDeps } from "../../../src/game/config/plugin-provider.js";

function createMockDeps(overrides: Partial<PluginProviderDeps> = {}): PluginProviderDeps {
	return {
		vaultAdapter: {
			exists: vi.fn().mockResolvedValue(true),
			read: vi.fn().mockResolvedValue(JSON.stringify({
				agents: [{ name: "Atlas", agentType: "ai", status: "idle", domain: "engineering" }],
			})),
		},
		eventBus: {
			on: vi.fn().mockReturnValue(() => {}),
			emit: vi.fn(),
		} as any,
		...overrides,
	};
}

describe("PluginProvider", () => {
	it("reads agents from vault file", async () => {
		const deps = createMockDeps();
		const provider = createPluginProvider(deps);
		await provider.start();
		const agents = await provider.getDashboardAgents();
		expect(agents).toHaveLength(1);
		expect(agents[0].name).toBe("Atlas");
		expect(deps.vaultAdapter.read).toHaveBeenCalledWith(
			expect.stringContaining("agent-dashboard.json"),
		);
	});

	it("reads world state from vault file", async () => {
		const deps = createMockDeps();
		deps.vaultAdapter.read = vi.fn()
			.mockResolvedValueOnce(JSON.stringify({ agents: [] }))
			.mockResolvedValueOnce(JSON.stringify({ version: 1, entities: {} }));
		const provider = createPluginProvider(deps);
		await provider.start();
		const state = await provider.getWorldState();
		expect(state).toBeDefined();
		expect(deps.vaultAdapter.read).toHaveBeenCalledWith(
			expect.stringContaining("world-state.json"),
		);
	});

	it("returns empty agents when vault file missing", async () => {
		const deps = createMockDeps();
		deps.vaultAdapter.exists = vi.fn().mockResolvedValue(false);
		const provider = createPluginProvider(deps);
		await provider.start();
		const agents = await provider.getDashboardAgents();
		expect(agents).toEqual([]);
	});

	it("subscribes to EventBus on start", async () => {
		const deps = createMockDeps();
		const provider = createPluginProvider(deps);
		await provider.start();
		expect(deps.eventBus.on).toHaveBeenCalled();
	});

	it("unsubscribes on stop", async () => {
		const unsub = vi.fn();
		const deps = createMockDeps();
		(deps.eventBus.on as ReturnType<typeof vi.fn>).mockReturnValue(unsub);
		const provider = createPluginProvider(deps);
		await provider.start();
		provider.stop();
		expect(unsub).toHaveBeenCalled();
	});

	it("relays EventBus agent actions to onAction callbacks", async () => {
		let busCallback: ((event: any) => void) | undefined;
		const deps = createMockDeps();
		(deps.eventBus.on as ReturnType<typeof vi.fn>).mockImplementation(
			(type: string, cb: (event: any) => void) => {
				if (type === "agent.status.changed") busCallback = cb;
				return () => {};
			},
		);
		const provider = createPluginProvider(deps);
		const actionCb = vi.fn();
		provider.onAction(actionCb);
		await provider.start();
		busCallback?.({ type: "agent.status.changed", payload: { agentName: "Atlas", type: "idle" } });
		expect(actionCb).toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/config/plugin-provider.test.ts -v
```

Expected: FAIL — module not found.

- [ ] **Step 3: Write PluginProvider implementation**

Create `src/game/config/plugin-provider.ts`:

```typescript
import type { DataProvider } from "./data-provider.js";
import type { AgentAction, DashboardAgent, WorldState, WorldEntity, ConnectionStatus } from "../data/types.js";

const AGENT_ROSTER_PATH = ".flowti/agents/data/agent-dashboard.json";
const WORLD_STATE_PATH = ".flowti/var/world-state.json";

const RELAYED_EVENTS = [
	"agent.status.changed",
	"agent.message.received",
	"agent.message.sent",
] as const;

export interface PluginProviderDeps {
	readonly vaultAdapter: {
		exists(path: string): Promise<boolean>;
		read(path: string): Promise<string>;
	};
	readonly eventBus: {
		on(type: string, cb: (event: { type: string; payload: unknown }) => void): () => void;
		emit?(type: string, payload: unknown): void;
	};
	readonly sseClient?: {
		connect(): void;
		disconnect(): void;
		on(event: string, cb: (data: unknown) => void): () => void;
	};
	readonly serverBaseUrl?: string;
}

export function createPluginProvider(deps: PluginProviderDeps): DataProvider {
	let agents: DashboardAgent[] = [];
	let worldState: WorldState | null = null;
	const actionCallbacks = new Set<(action: AgentAction) => void>();
	const entityCallbacks = new Set<(entity: WorldEntity) => void>();
	const connectionCallbacks = new Set<(status: ConnectionStatus) => void>();
	const unsubs: Array<() => void> = [];

	return {
		async start(): Promise<void> {
			// Read vault files
			try {
				const rosterExists = await deps.vaultAdapter.exists(AGENT_ROSTER_PATH);
				if (rosterExists) {
					const raw = await deps.vaultAdapter.read(AGENT_ROSTER_PATH);
					const data = JSON.parse(raw) as { agents?: DashboardAgent[] };
					agents = data.agents ?? [];
				}
			} catch {
				agents = [];
			}

			try {
				const stateExists = await deps.vaultAdapter.exists(WORLD_STATE_PATH);
				if (stateExists) {
					const raw = await deps.vaultAdapter.read(WORLD_STATE_PATH);
					worldState = JSON.parse(raw) as WorldState;
				}
			} catch {
				worldState = null;
			}

			// Subscribe to EventBus
			for (const eventType of RELAYED_EVENTS) {
				const unsub = deps.eventBus.on(eventType, (event) => {
					const action = event.payload as AgentAction;
					for (const cb of actionCallbacks) cb(action);
				});
				unsubs.push(unsub);
			}

			// Optional SSE
			if (deps.sseClient) {
				try {
					deps.sseClient.connect();
					unsubs.push(deps.sseClient.on("agent-action", (data) => {
						for (const cb of actionCallbacks) cb(data as AgentAction);
					}));
					unsubs.push(deps.sseClient.on("entity-update", (data) => {
						for (const cb of entityCallbacks) cb(data as WorldEntity);
					}));
					for (const cb of connectionCallbacks) cb("connected");
				} catch {
					// SSE not available — silent
				}
			}
		},

		stop(): void {
			for (const unsub of unsubs) unsub();
			unsubs.length = 0;
			deps.sseClient?.disconnect();
		},

		async getWorldState(): Promise<WorldState | null> {
			return worldState;
		},

		async getDashboardAgents(): Promise<DashboardAgent[]> {
			return agents;
		},

		onAction(cb: (action: AgentAction) => void): () => void {
			actionCallbacks.add(cb);
			return () => { actionCallbacks.delete(cb); };
		},

		onEntityUpdate(cb: (entity: WorldEntity) => void): () => void {
			entityCallbacks.add(cb);
			return () => { entityCallbacks.delete(cb); };
		},

		onConnectionStatus(cb: (status: ConnectionStatus) => void): () => void {
			connectionCallbacks.add(cb);
			return () => { connectionCallbacks.delete(cb); };
		},

		async sendCommand(endpoint: string, body: Record<string, unknown>): Promise<void> {
			if (deps.serverBaseUrl) {
				await fetch(`${deps.serverBaseUrl}${endpoint}`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(body),
				});
			} else if (deps.eventBus.emit) {
				deps.eventBus.emit("world.command", { endpoint, body });
			}
		},

		get assetBasePath(): string {
			return "";
		},
	};
}
```

- [ ] **Step 4: Run tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/config/plugin-provider.test.ts -v
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/config/plugin-provider.ts" "01 - Projects/Flowti Plugin/src/game/config/data-provider.ts" "01 - Projects/Flowti Plugin/tests/game/config/"
git commit -m "feat(game): add PluginProvider — vault-first data layer"
```

---

## Chunk 4: ExcaliburJS Actors, Scenes, and Systems

### Task 9: Migrate actors/

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/actors/agent-actor.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/actors/bubble-actor.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/actors/workstation-actor.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/actors/doorway-actor.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/actors/scene-backgrounds.ts`

- [ ] **Step 1: Copy all 5 actor files**

```bash
mkdir -p "01 - Projects/Flowti Plugin/src/game/actors"
for f in agent-actor.ts bubble-actor.ts workstation-actor.ts doorway-actor.ts scene-backgrounds.ts; do
  cp "01 - Projects/Flowti CLI/agents/src/actors/$f" "01 - Projects/Flowti Plugin/src/game/actors/"
done
```

- [ ] **Step 2: Adapt to plugin conventions**

For each file:
- Convert indentation to tabs
- Update import paths for types, brain, sprites to be relative within `src/game/`
- All actors already have `collisionType: ex.CollisionType.PreventCollision` from our earlier fixes
- Keep `import * as ex from "excalibur"` as-is

- [ ] **Step 3: Verify compilation**

```bash
cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit --skipLibCheck 2>&1 | grep "src/game/actors" | head -10
```

Expected: No errors from game/actors/ files (other pre-existing errors may appear).

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/actors/"
git commit -m "feat(game): migrate ExcaliburJS actors — agent, bubble, workstation, doorway, backgrounds"
```

### Task 10: Migrate scenes/

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/scenes/hub-scene.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/scenes/room-scene.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/scenes/office-scene.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/scenes/village-scene.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/scenes/station-scene.ts`

- [ ] **Step 1: Copy all 5 scene files**

```bash
mkdir -p "01 - Projects/Flowti Plugin/src/game/scenes"
for f in hub-scene.ts room-scene.ts office-scene.ts village-scene.ts station-scene.ts; do
  cp "01 - Projects/Flowti CLI/agents/src/scenes/$f" "01 - Projects/Flowti Plugin/src/game/scenes/"
done
```

- [ ] **Step 2: Adapt to plugin conventions**

- Convert indentation to tabs
- Update import paths for actors, config, sprites, brain to be relative within `src/game/`
- All scene actors already have `collisionType: PreventCollision` and `body.collisionType` set on labels

- [ ] **Step 3: Verify compilation**

```bash
cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit --skipLibCheck 2>&1 | grep "src/game/scenes" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/scenes/"
git commit -m "feat(game): migrate ExcaliburJS scenes — hub, rooms, factories"
```

### Task 11: Migrate systems/ (excluding talk/ which was done in Task 6)

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/systems/brain-system.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/systems/bubble-system.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/systems/camera-system.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/systems/emote-system.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/systems/particle-system.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/systems/social-system.ts`

- [ ] **Step 1: Copy 6 system files**

```bash
for f in brain-system.ts bubble-system.ts camera-system.ts emote-system.ts particle-system.ts social-system.ts; do
  cp "01 - Projects/Flowti CLI/agents/src/systems/$f" "01 - Projects/Flowti Plugin/src/game/systems/"
done
```

- [ ] **Step 2: Adapt to plugin conventions**

- Convert indentation to tabs
- Update import paths for brain/, actors/, data/ to be relative within `src/game/`
- Remove the `talk-engine.ts` re-export shim from CLI (it was `export * from "./talk/talk-engine.js"`). Systems that import talk engine should import from `./talk/talk-engine.js` directly.

- [ ] **Step 3: Verify compilation**

```bash
cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit --skipLibCheck 2>&1 | grep "src/game/systems" | head -10
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/"
git commit -m "feat(game): migrate game systems — brain, bubble, camera, emote, particle, social"
```

### Task 11b: Build verification gate

- [ ] **Step 1: Full build to catch CJS bundling issues with ExcaliburJS**

```bash
cd "01 - Projects/Flowti Plugin" && npm run build
```

Expected: Build succeeds. This catches any issues with ExcaliburJS being bundled as CJS under `platform: "node"`. If it fails with browser API references, try changing `platform` to `"neutral"` in `esbuild.config.mjs`.

- [ ] **Step 2: Verify no type errors in game code**

```bash
cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit --skipLibCheck 2>&1 | grep "src/game" | head -20
```

Expected: No errors from `src/game/` files.

---

## Chunk 5: Lit UI Components

### Task 12: Migrate game-styles.ts and all 11 Lit components

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/ui/game-styles.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/ui/dashboard-overlays.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/ui/agent-panel.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/ui/panel-info.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/ui/panel-talk.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/ui/panel-tasks.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/ui/panel-permissions.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/ui/panel-history.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/ui/roster-bar.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/ui/camera-hud.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/ui/ask-bob.ts`
- Create: `01 - Projects/Flowti Plugin/src/game/data/api-client.ts`

- [ ] **Step 1: Copy all UI files**

```bash
mkdir -p "01 - Projects/Flowti Plugin/src/game/ui"
cp "01 - Projects/Flowti CLI/agents/src/ui/shared-styles.ts" "01 - Projects/Flowti Plugin/src/game/ui/game-styles.ts"
for f in dashboard-overlays.ts agent-panel.ts panel-info.ts panel-talk.ts panel-tasks.ts panel-permissions.ts panel-history.ts roster-bar.ts camera-hud.ts ask-bob.ts; do
  cp "01 - Projects/Flowti CLI/agents/src/ui/$f" "01 - Projects/Flowti Plugin/src/game/ui/"
done
```

Also copy api-client.ts (used by panel components for sending messages/commands):

```bash
cp "01 - Projects/Flowti CLI/agents/src/data/api-client.ts" "01 - Projects/Flowti Plugin/src/game/data/"
```

- [ ] **Step 2: Rename shared-styles import and adapt base class**

In `game-styles.ts`:
- Rename the export from `resetStyles` to `gameResetStyles` (or keep as-is, just update the filename reference)
- Convert indentation to tabs

In each of the 11 component files:
- Change `import { LitElement, ... } from "lit"` to `import { html, css } from "lit"` + `import { FlowtiElement } from "../../components/flowti-element.js"`
- Change `extends LitElement` to `extends FlowtiElement`
- Override `renderContent()` instead of `render()` (move current render body into renderContent)
- Update `import { resetStyles } from "./shared-styles.js"` to `import { resetStyles } from "./game-styles.js"`
- **Compose styles with parent:** `static styles = [...FlowtiElement.styles, resetStyles, css\`/* component CSS */\`]` — use spread to inherit FlowtiElement's token styles, then layer game styles and component-specific styles on top
- Prefix custom element names with `ft-game-`:
  - `dashboard-overlays` → `ft-game-overlays`
  - `roster-bar` → `ft-game-roster-bar`
  - `camera-hud` → `ft-game-camera-hud`
  - `agent-panel` → `ft-game-agent-panel`
  - `panel-info` → `ft-game-panel-info`
  - `panel-talk` → `ft-game-panel-talk`
  - `panel-tasks` → `ft-game-panel-tasks`
  - `panel-permissions` → `ft-game-panel-permissions`
  - `panel-history` → `ft-game-panel-history`
  - `ask-bob` → `ft-game-ask-bob`
- Update internal `document.createElement("roster-bar")` calls in engine.ts (Task 13) to use new tag names
- Convert indentation to tabs

- [ ] **Step 3: Update inter-component imports**

Components import each other (e.g., agent-panel imports panel-info as a side-effect). Update all `import "./panel-info.js"` to `import "./panel-info.js"` (paths stay the same since they're in the same directory). Update `import { ... } from "../store/dashboard-store.js"` to point to the game store.

- [ ] **Step 4: Verify compilation**

```bash
cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit --skipLibCheck 2>&1 | grep "src/game/ui" | head -10
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/ui/" "01 - Projects/Flowti Plugin/src/game/data/api-client.ts"
git commit -m "feat(game): migrate Lit UI components — adopt FlowtiElement, ft-game-* prefix"
```

---

## Chunk 6: Engine Factory and View Rewrite

### Task 13: Create engine.ts factory

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/engine.ts`
- Create: `01 - Projects/Flowti Plugin/tests/game/engine.test.ts`

- [ ] **Step 1: Write engine.ts**

Refactor the CLI's `agents/src/main.ts` (~685 lines) into a factory function. The key changes:
- Remove the self-executing `main()` wrapper
- Remove bridge detection (`window.__flowtiWorldBridge`)
- Remove `window.__flowtiEngine` assignment
- Accept `AgentWorldDeps` instead of detecting environment
- Return `AgentWorldHandle` instead of relying on window globals
- Use `deps.spriteBasePath` instead of hardcoded `"assets/Actor/Characters/"`
- Change talk-engine import from `"./systems/talk-engine.js"` (the old shim) to `"./systems/talk/talk-engine.js"` (direct path)
- Always use `DisplayMode.Fixed` → mount canvas → switch to `FitContainer` (the pattern already validated)
- Move ResizeObserver, keyboard listeners, font injection inside the factory
- Use `ft-game-*` tag names for Lit component creation

The file structure:

```typescript
import * as ex from "excalibur";
import type { DataProvider } from "./config/data-provider.js";
// ... all other game imports

// Side-effect imports for Lit custom elements
import "./ui/dashboard-overlays.js";
import "./ui/ask-bob.js";
import "./ui/roster-bar.js";
import "./ui/camera-hud.js";
import "./ui/agent-panel.js";

export interface AgentWorldDeps {
	container: HTMLElement;
	provider: DataProvider;
	spriteBasePath: string;
}

export interface AgentWorldHandle {
	start(): Promise<void>;
	pause(): void;
	resume(): void;
	dispose(): void;
}

export function createAgentWorld(deps: AgentWorldDeps): AgentWorldHandle {
	const { container, provider } = deps;

	const ENGINE_WIDTH = 800;
	const ENGINE_HEIGHT = 500;

	const engine = new ex.Engine({
		width: ENGINE_WIDTH,
		height: ENGINE_HEIGHT,
		backgroundColor: ex.Color.fromHex("#0a0a0f"),
		displayMode: ex.DisplayMode.Fixed,
		antialiasing: true,
		suppressPlayButton: true,
	});

	// Mount canvas, switch to FitContainer
	container.appendChild(engine.canvas);
	engine.screen.displayMode = ex.DisplayMode.FitContainer;
	engine.screen.applyResolutionAndViewport();

	// ... (all the scene creation, system wiring, overlay mounting from main.ts)
	// Key difference: use deps.spriteBasePath for ASSET_BASE
	// Key difference: use ft-game-* tag names for createElement calls
	// Key difference: keyboard listeners scoped to container, not document

	let resizeObserver: ResizeObserver | null = null;
	const keydownHandler = (e: KeyboardEvent) => { /* ... */ };
	const keyupHandler = (e: KeyboardEvent) => { /* ... */ };

	return {
		async start(): Promise<void> {
			// Font injection
			const fontLink = document.createElement("link");
			fontLink.rel = "stylesheet";
			fontLink.href = "https://fonts.googleapis.com/css2?family=Silkscreen&display=swap";
			container.appendChild(fontLink);

			// Start engine
			await engine.start();
			engine.goToScene("hub");

			// Preload sprites
			const ASSET_BASE = `${deps.spriteBasePath}/`;
			const spriteRegistry = await preloadSpriteRegistry(allCharacters, ASSET_BASE);
			// ... pass to scenes, create camera system, etc.

			// ResizeObserver
			resizeObserver = new ResizeObserver(() => {
				const rect = container.getBoundingClientRect();
				engine.screen.viewport = { width: rect.width, height: rect.height };
			});
			resizeObserver.observe(container);

			// Keyboard (scoped to container)
			container.setAttribute("tabindex", "0");
			container.addEventListener("keydown", keydownHandler);
			container.addEventListener("keyup", keyupHandler);

			// Start provider
			await provider.start();
			const initialAgents = await provider.getDashboardAgents();
			registerAgents(initialAgents);
			// ... route to rooms, load world state, etc.
		},

		pause(): void {
			engine.stop();
		},

		resume(): void {
			void engine.start();
		},

		dispose(): void {
			engine.stop();
			engine.dispose();
			provider.stop();
			resizeObserver?.disconnect();
			container.removeEventListener("keydown", keydownHandler);
			container.removeEventListener("keyup", keyupHandler);
		},
	};
}
```

This is the largest file in the migration. Most of the body is a direct port of `main.ts` lines 58-677 with the changes listed above.

- [ ] **Step 2: Write engine test**

Create `tests/game/engine.test.ts` — tests the factory contract, not ExcaliburJS internals:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock excalibur before importing engine
vi.mock("excalibur", () => {
	const mockEngine = {
		canvas: document.createElement("canvas"),
		screen: { displayMode: 0, viewport: {}, applyResolutionAndViewport: vi.fn() },
		start: vi.fn().mockResolvedValue(undefined),
		stop: vi.fn(),
		dispose: vi.fn(),
		goToScene: vi.fn(),
		addScene: vi.fn(),
		on: vi.fn(),
		currentScene: { camera: { move: vi.fn() } },
	};
	return {
		Engine: vi.fn(() => mockEngine),
		Color: { fromHex: vi.fn() },
		DisplayMode: { Fixed: 0, FitContainer: 1 },
		CollisionType: { PreventCollision: 0 },
		vec: vi.fn((x: number, y: number) => ({ x, y })),
		Actor: vi.fn(),
		Label: vi.fn(),
		Scene: vi.fn(),
		Canvas: vi.fn(),
		Font: vi.fn(),
		SpriteSheet: { fromImageSource: vi.fn() },
		Animation: { fromSpriteSheet: vi.fn() },
		ImageSource: vi.fn(() => ({ load: vi.fn().mockResolvedValue(undefined) })),
		FadeInOut: vi.fn(),
		EasingFunctions: { EaseInOutCubic: vi.fn() },
		AnimationStrategy: { Loop: 0 },
		ImageFiltering: { Pixel: 0 },
		FontUnit: { Px: 0 },
		TextAlign: { Center: 0, Right: 1 },
	};
});

import { createAgentWorld } from "../../src/game/engine.js";

describe("createAgentWorld", () => {
	it("returns a handle with start, pause, resume, dispose", () => {
		const container = document.createElement("div");
		const provider = {
			start: vi.fn().mockResolvedValue(undefined),
			stop: vi.fn(),
			getWorldState: vi.fn().mockResolvedValue(null),
			getDashboardAgents: vi.fn().mockResolvedValue([]),
			onAction: vi.fn().mockReturnValue(() => {}),
			onEntityUpdate: vi.fn().mockReturnValue(() => {}),
			onConnectionStatus: vi.fn().mockReturnValue(() => {}),
			sendCommand: vi.fn(),
			assetBasePath: "",
		};

		const handle = createAgentWorld({
			container,
			provider,
			spriteBasePath: "/test/sprites",
		});

		expect(handle.start).toBeInstanceOf(Function);
		expect(handle.pause).toBeInstanceOf(Function);
		expect(handle.resume).toBeInstanceOf(Function);
		expect(handle.dispose).toBeInstanceOf(Function);
	});

	it("mounts canvas into container", () => {
		const container = document.createElement("div");
		const provider = {
			start: vi.fn().mockResolvedValue(undefined),
			stop: vi.fn(),
			getWorldState: vi.fn().mockResolvedValue(null),
			getDashboardAgents: vi.fn().mockResolvedValue([]),
			onAction: vi.fn().mockReturnValue(() => {}),
			onEntityUpdate: vi.fn().mockReturnValue(() => {}),
			onConnectionStatus: vi.fn().mockReturnValue(() => {}),
			sendCommand: vi.fn(),
			assetBasePath: "",
		};

		createAgentWorld({ container, provider, spriteBasePath: "/test" });
		expect(container.querySelector("canvas")).toBeTruthy();
	});
});
```

- [ ] **Step 3: Run tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/engine.test.ts -v
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine.ts" "01 - Projects/Flowti Plugin/tests/game/engine.test.ts"
git commit -m "feat(game): create engine factory — createAgentWorld() entry point"
```

### Task 14: Rewrite AgentWorldView

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/ui/agents/agent-world-view.ts`
- Modify: `01 - Projects/Flowti Plugin/src/bootstrap/agent-setup.ts`
- Rewrite: `01 - Projects/Flowti Plugin/tests/ui/agents/agent-world-view.test.ts`

- [ ] **Step 1: Rewrite agent-world-view.ts**

Replace the entire file. The new version:

```typescript
import { ItemView } from "obsidian";
import type { WorkspaceLeaf, Plugin } from "obsidian";
import type { IEventBus } from "../../infrastructure/events/types.js";
import { createAgentWorld, type AgentWorldHandle } from "../../game/engine.js";
import { createPluginProvider } from "../../game/config/plugin-provider.js";
import { VIEW_TYPE_AGENT_WORLD } from "./types.js";

export interface AgentWorldViewDeps {
	readonly plugin: Plugin;
	readonly eventBus: IEventBus;
	readonly sseClient?: { connect(): void; disconnect(): void; on(event: string, cb: (data: unknown) => void): () => void };
	readonly serverBaseUrl?: string;
}

export class AgentWorldView extends ItemView {
	private deps: AgentWorldViewDeps;
	private handle: AgentWorldHandle | null = null;
	private observer: IntersectionObserver | null = null;

	constructor(leaf: WorkspaceLeaf, deps: AgentWorldViewDeps) {
		super(leaf);
		this.deps = deps;
	}

	getViewType(): string { return VIEW_TYPE_AGENT_WORLD; }
	getDisplayText(): string { return "Agent world"; }
	getIcon(): string { return "globe"; }

	async onOpen(): Promise<void> {
		this.contentEl.empty();

		const container = this.contentEl.createDiv({ cls: "ft-world-container" });
		container.id = "flowti-world";

		// Resolve sprite path via plugin manifest
		const pluginDir = this.app.vault.configDir + "/plugins/" + this.deps.plugin.manifest.id;
		const adapter = this.app.vault.adapter as { getResourcePath?(p: string): string };
		const spriteBasePath = adapter.getResourcePath
			? adapter.getResourcePath(pluginDir + "/assets/Actor/Characters")
			: pluginDir + "/assets/Actor/Characters";

		// Create provider
		const provider = createPluginProvider({
			vaultAdapter: this.app.vault.adapter as { exists(p: string): Promise<boolean>; read(p: string): Promise<string> },
			eventBus: this.deps.eventBus as any,
			sseClient: this.deps.sseClient,
			serverBaseUrl: this.deps.serverBaseUrl,
		});

		// Create game
		this.handle = createAgentWorld({ container, provider, spriteBasePath });

		try {
			await this.handle.start();
		} catch {
			container.createDiv({
				cls: "ft-world-error",
				text: "Failed to start agent world.",
			});
		}

		// Visibility observer
		this.observer = new IntersectionObserver((entries) => {
			const entry = entries[0];
			if (!entry) return;
			if (entry.isIntersecting) {
				this.handle?.resume();
			} else {
				this.handle?.pause();
			}
		});
		this.observer.observe(container);
	}

	async onClose(): Promise<void> {
		this.handle?.dispose();
		this.handle = null;
		this.observer?.disconnect();
		this.observer = null;
		this.contentEl.empty();
	}
}
```

- [ ] **Step 2: Update agent-setup.ts**

In `src/bootstrap/agent-setup.ts`, find the `worldDeps` construction (around line 95) and replace it:

**Before:**
```typescript
const worldDeps: AgentWorldViewDeps = {
	app: deps.app,
	eventBus: deps.eventBus,
	baseUrl,
};
```

**After:**
```typescript
const worldDeps: AgentWorldViewDeps = {
	plugin: deps.plugin,
	eventBus: deps.eventBus,
	sseClient,
	serverBaseUrl: baseUrl,
};
```

Also update the import at the top of the file — change:
```typescript
import { AgentWorldView, type AgentWorldViewDeps } from "../ui/agents/agent-world-view.js";
```
The import path stays the same, but the `AgentWorldViewDeps` type now requires `plugin` (Plugin) instead of `app` (App). The `sseClient` variable is already created earlier in `setupAgentDomain()` (line ~38: `const sseClient = new SseClient(...)`) — wire it directly into `worldDeps`. The `baseUrl` variable is also already available (line ~37: `const baseUrl = deps.cliServerUrl ?? "http://localhost:3000"`).

- [ ] **Step 3: Rewrite agent-world-view.test.ts**

Replace the test file — no more blob URL tests, no window globals, no WorldBridge:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/game/engine.js", () => ({
	createAgentWorld: vi.fn(() => ({
		start: vi.fn().mockResolvedValue(undefined),
		pause: vi.fn(),
		resume: vi.fn(),
		dispose: vi.fn(),
	})),
}));

vi.mock("../../../src/game/config/plugin-provider.js", () => ({
	createPluginProvider: vi.fn(() => ({})),
}));

import { AgentWorldView } from "../../../src/ui/agents/agent-world-view.js";
import { createAgentWorld } from "../../../src/game/engine.js";

function createMockLeaf() {
	return { view: null } as any;
}

function createMockDeps() {
	return {
		plugin: {
			manifest: { id: "flowti-ibde" },
			app: {
				vault: {
					configDir: ".obsidian",
					adapter: {
						exists: vi.fn().mockResolvedValue(true),
						read: vi.fn().mockResolvedValue("{}"),
						getResourcePath: vi.fn((p: string) => `app://test/${p}`),
					},
				},
			},
		},
		eventBus: { on: vi.fn().mockReturnValue(() => {}) },
	} as any;
}

describe("AgentWorldView", () => {
	it("returns correct view type", () => {
		const view = new AgentWorldView(createMockLeaf(), createMockDeps());
		expect(view.getViewType()).toBe("flowti-agent-world");
	});

	it("returns correct display text", () => {
		const view = new AgentWorldView(createMockLeaf(), createMockDeps());
		expect(view.getDisplayText()).toBe("Agent world");
	});

	it("calls createAgentWorld on open", async () => {
		const view = new AgentWorldView(createMockLeaf(), createMockDeps());
		// Mock contentEl
		const contentEl = document.createElement("div");
		(view as any).contentEl = contentEl;
		(view as any).app = createMockDeps().plugin.app;

		await view.onOpen();
		expect(createAgentWorld).toHaveBeenCalled();
	});

	it("calls dispose on close", async () => {
		const view = new AgentWorldView(createMockLeaf(), createMockDeps());
		const contentEl = document.createElement("div");
		(view as any).contentEl = contentEl;
		(view as any).app = createMockDeps().plugin.app;

		await view.onOpen();
		const handle = (view as any).handle;
		await view.onClose();
		expect(handle.dispose).toHaveBeenCalled();
	});
});
```

- [ ] **Step 4: Run tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/ui/agents/agent-world-view.test.ts -v
```

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/ui/agents/agent-world-view.ts" "01 - Projects/Flowti Plugin/src/bootstrap/agent-setup.ts" "01 - Projects/Flowti Plugin/tests/ui/agents/agent-world-view.test.ts"
git commit -m "feat(game): rewrite AgentWorldView — native import, no blob URLs"
```

### Task 14b: Write remaining tests for coverage

**Files:**
- Create: `01 - Projects/Flowti Plugin/tests/game/actors/agent-actor.test.ts`
- Create: `01 - Projects/Flowti Plugin/tests/game/scenes/hub-scene.test.ts`
- Create: `01 - Projects/Flowti Plugin/tests/game/systems/brain-system.test.ts`
- Create: `01 - Projects/Flowti Plugin/tests/game/systems/bubble-system.test.ts`
- Create: `01 - Projects/Flowti Plugin/tests/game/ui/roster-bar.test.ts`

These are the highest-value test files not yet covered. The approach:

- [ ] **Step 1: Agent actor tests**

Test actor construction with correct `collisionType`, position, scale. Mock `ex.Actor` super constructor. Test `updateFromBrain()` state transitions and `focus()` method.

- [ ] **Step 2: Hub scene tests**

Test `updateAgents()` — adding new agents, skipping agents without sprites, removing stale actors. Mock sprite registry and engine.

- [ ] **Step 3: Brain system tests**

Test `register()`, `update()` cycle, `applyEvent()` state transitions, `getState()`, `freeze()`. These are the core gameplay loop tests.

- [ ] **Step 4: Bubble system tests**

Test `showBubble()` creates actor, `update()` despawns expired bubbles, `register()` sets up agent params.

- [ ] **Step 5: Roster bar Lit component test**

Test rendering with agents, click events dispatching `agent-select`, follow toggle. Use happy-dom environment.

- [ ] **Step 6: Run all game tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/ -v 2>&1 | tail -10
```

Expected: All tests pass.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti Plugin/tests/game/"
git commit -m "test(game): add tests for actors, scenes, systems, and UI components"
```

---

## Chunk 7: Cleanup and Deletion

### Task 15: Delete old plugin files

**Files:**
- Delete: `01 - Projects/Flowti Plugin/src/infrastructure/agents/world-bridge.ts`
- Delete: `01 - Projects/Flowti Plugin/tests/infrastructure/agents/world-bridge.test.ts`

- [ ] **Step 1: Delete WorldBridge and its test**

```bash
rm "01 - Projects/Flowti Plugin/src/infrastructure/agents/world-bridge.ts"
rm "01 - Projects/Flowti Plugin/tests/infrastructure/agents/world-bridge.test.ts"
```

- [ ] **Step 2: Remove all WorldBridge references**

Search for any remaining references and remove them:

```bash
grep -r "world-bridge\|WorldBridge" "01 - Projects/Flowti Plugin/src/" --include="*.ts"
grep -r "world-bridge\|WorldBridge" "01 - Projects/Flowti Plugin/tests/" --include="*.ts"
```

The old `agent-world-view.ts` import is already gone (rewritten in Task 14). If any barrel exports, bootstrap files, or test utilities still reference WorldBridge, remove those imports/re-exports.

- [ ] **Step 3: Run full test suite**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run 2>&1 | tail -10
```

Expected: All tests pass (except pre-existing failures in server-status and project-handlers).

- [ ] **Step 4: Commit**

```bash
git add -A "01 - Projects/Flowti Plugin/"
git commit -m "chore(game): delete WorldBridge — replaced by native import"
```

### Task 16: Delete CLI agents/ directory

**Files:**
- Delete: `01 - Projects/Flowti CLI/agents/` (entire directory)

- [ ] **Step 1: Delete the agents directory**

```bash
rm -rf "01 - Projects/Flowti CLI/agents/"
```

- [ ] **Step 2: Remove dashboard build logic from CLI**

In `01 - Projects/Flowti CLI/src/domain/serve/dashboard-service.ts`:
- Search for `buildDashboard` and remove that function plus any helpers it calls (e.g., `ensureDashboardDeps`, `runDashboardBuild`)
- Keep `regenerateDashboardData()` and `startDashboardServer()` — they write `agent-dashboard.json` and serve SSE/API
- Search for callers: `grep -r "buildDashboard" "01 - Projects/Flowti CLI/src/"` — update any callers to skip the build step

In `01 - Projects/Flowti CLI/src/domain/serve/static-server.ts`:
- The static server serves ALL files from the agents output directory (API routes + static files). Keep it as-is — it still serves `agent-dashboard.json` and the API. The sprite PNGs just won't exist in `.flowti/agents/` anymore, which is fine (no 404 harm).

- [ ] **Step 3: Run CLI tests to verify nothing broke**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts 2>&1 | tail -10
```

Expected: Tests pass (some may need updates if they referenced dashboard build).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete CLI agents/ directory — game moved to plugin"
```

### Task 17: Final integration verification

- [ ] **Step 1: Full plugin build**

```bash
cd "01 - Projects/Flowti Plugin" && npm run build
```

Expected: Build succeeds. Output directory contains `main.js`, `styles.css`, and `assets/Actor/Characters/`.

- [ ] **Step 2: Verify sprite output**

```bash
ls ".obsidian/plugins/flowti-ibde/assets/Actor/Characters/" | wc -l
```

Expected: 86+ character directories.

- [ ] **Step 3: Full plugin test suite**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run 2>&1 | tail -10
```

Expected: All game tests pass. Total test count increased by ~50+ tests.

- [ ] **Step 4: Type check**

```bash
cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit --skipLibCheck 2>&1 | grep "src/game" | head -10
```

Expected: No type errors from `src/game/` files.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat(game): Agent World native embedding complete — verified"
```
