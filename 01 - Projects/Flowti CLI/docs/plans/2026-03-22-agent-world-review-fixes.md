# Agent World Review Fixes — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all issues found in the cross-project architecture review of the Agent World feature set — economy pipeline, merchant catalog, interaction system, and Plugin system wiring.

**Architecture:** CLI is the authoritative backend; Plugin is the visual frontend. Plugin delegates to CLI for purchases and rewards via one-shot CLI commands. Shared data (level thresholds, trust tiers, catalog IDs) must be aligned and ideally sourced from CLI. All interaction logic runs through CLI's `createInteractionBus` — Plugin adds only resolvers and rendering.

**Tech Stack:** TypeScript (strict), Vitest, Lit (Plugin UI components), ExcaliburJS (Plugin actors)

---

## File Map

### CLI — Files to Modify
| File | Responsibility |
|------|---------------|
| `src/domain/economy/economy-types.ts` | Remove unused `EconomyDeps` type |
| `src/domain/merchant/merchant-catalog.ts` | Align DEFAULT_CATALOG item IDs with leveling.ts |

### Plugin — Files to Modify
| File | Responsibility |
|------|---------------|
| `src/game/ui/panel-economy.ts` | Fix XP field read + import thresholds/titles from CLI |
| `src/game/store/dashboard-store.ts` | Pass `--task` flag in `creditTaskReward` |
| `src/game/systems/offline-progress.ts` | Import LEVEL_TABLE from CLI instead of duplicating |
| `src/game/systems/interaction/director-intent-resolver.ts` | Copy template prerequisites |
| `src/game/systems/interaction/bootstrap-interactions.ts` | Implement trust-tier/has-item prereqs |
| `src/game/systems/interaction/npc-intent-resolver.ts` | Apply template prerequisites from partial |
| `src/game/brain/behavior-tree/bt-types.ts` | Fix `IMerchantBridge.getAutoPurchaseItemId` |
| `src/game/systems/bt-system.ts` | Accept optional merchant bridge in `createStubDeps` |
| `src/game/engine-simulation.ts` | Fix vent cascade target + wire hasPendingSensor |

### Tests — Files to Modify/Create
| File | Responsibility |
|------|---------------|
| `tests/game/systems/interaction/director-intent-resolver.test.ts` (Plugin) | Test prerequisites are propagated |
| `tests/game/systems/engagement-system.test.ts` (Plugin) | Test hasPendingSensor wiring |
| `tests/game/systems/merchant-system.test.ts` (Plugin) | Test getAutoPurchaseItemId bridge |
| `tests/game/systems/offline-progress.test.ts` (Plugin) | Verify imported thresholds match |
| `tests/domain/merchant/merchant-catalog.test.ts` (CLI) | Verify IDs align with leveling.ts |

---

## Chunk 1: Economy Pipeline Fixes (P0)

These fixes unblock the core reward loop: XP display, task-based rewards, and trust auto-promotion.

### Task 1: Fix XP field read in panel-economy.ts

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/ui/panel-economy.ts:174`

- [ ] **Step 1: Fix the XP field read**

Change line 174 from:
```typescript
const xp = this.agent.experience ?? 0;
```
to:
```typescript
const xp = this.agent.xp ?? this.agent.experience ?? 0;
```

This reads `xp` (written by `setAgentEconomy` via economy:reward) with fallback to `experience` (populated from vault agent definitions at boot).

- [ ] **Step 2: Run Plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run --config configs/vitest.config.ts`
Expected: All existing tests pass (no panel-economy test file exists, this is a pure render fix).

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/ui/panel-economy.ts"
git commit -m "fix(game): read agent.xp for economy panel XP bar, fallback to experience"
```

### Task 2: Pass --task flag in Plugin's creditTaskReward

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts:614`

- [ ] **Step 1: Update the CLI command args**

At line 614, change:
```typescript
["economy:reward", `--agent=${agentName}`, "--format=json"],
```
to:
```typescript
["economy:reward", `--agent=${agentName}`, `--task=${taskName}`, "--format=json"],
```

The `taskName` parameter is already passed to `creditTaskReward` but was never forwarded. This enables:
- First-completion bonus (1.5x multiplier in economy-rules.ts)
- Standing-order / delegation multipliers
- Trust auto-promotion check in economy.controller.ts:179

- [ ] **Step 2: Run Plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run --config configs/vitest.config.ts`
Expected: PASS (dashboard-store tests mock `runOneShotCommand`)

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts"
git commit -m "fix(game): pass --task flag in creditTaskReward to enable multipliers and trust promotion"
```

### Task 3: Remove unused EconomyDeps type

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/economy/economy-types.ts:46-50`

- [ ] **Step 1: Remove the dead type**

Delete lines 46-50 (`EconomyDeps` type with infrastructure imports). Every domain file that needs deps defines a local structural type (e.g., `LedgerDeps` in `economy-ledger.ts`). This type is unused.

- [ ] **Step 2: Run CLI tests + type check**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: PASS (no file imports this type)

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/economy/economy-types.ts"
git commit -m "fix(economy): remove unused EconomyDeps type that imported infrastructure paths"
```

---

## Chunk 2: Merchant Catalog Reconciliation (P0)

The CLI DEFAULT_CATALOG has 5 items with compound IDs (e.g., `tool-vault-write`). The Plugin catalog has 17 items using leveling.ts unlock keys (e.g., `vault-write`). When Plugin calls `shop:buy --item=vault-write`, CLI rejects it. Fix: align CLI catalog IDs with leveling.ts.

### Task 4: Align CLI DEFAULT_CATALOG with leveling.ts unlock keys

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/merchant/merchant-catalog.ts:26-75`
- Test: `01 - Projects/Flowti CLI/tests/domain/merchant/merchant-catalog.test.ts`

- [ ] **Step 1: Write test that DEFAULT_CATALOG IDs match leveling unlock keys**

Add to `tests/domain/merchant/merchant-catalog.test.ts`:
```typescript
import { LEVEL_TABLE } from "../../../src/domain/economy/leveling.js";

describe("DEFAULT_CATALOG alignment", () => {
	it("every leveling unlock key has a matching catalog capability item", () => {
		const deps = makeDeps();
		const catalog = readCatalog(deps, "/vault");
		const catalogIds = new Set(catalog.items.filter(i => i.category === "capability").map(i => i.id));
		const unlockKeys = LEVEL_TABLE.flatMap(e => e.unlocks);
		for (const key of unlockKeys) {
			expect(catalogIds.has(key), `missing catalog item for unlock key "${key}"`).toBe(true);
		}
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/merchant/merchant-catalog.test.ts --config configs/vitest.config.ts`
Expected: FAIL — CLI catalog uses `tool-vault-write` but leveling.ts expects `vault-write`

- [ ] **Step 3: Update DEFAULT_CATALOG to match leveling unlock keys**

Replace the `DEFAULT_CATALOG.items` array in `merchant-catalog.ts` with items whose IDs match `leveling.ts` unlock keys:

```typescript
const DEFAULT_CATALOG: MerchantCatalog = {
	version: 1,
	items: [
		// Capabilities — IDs match leveling.ts unlock keys
		{ id: "vault-read", name: "Vault Reader", category: "capability", cost: { coin: 40 }, requiresLevel: 1, description: "Read vault notes and paths", oneTime: true },
		{ id: "simple-tasks", name: "Task Basics", category: "capability", cost: { coin: 60 }, requiresLevel: 1, description: "Run simple assigned tasks", oneTime: true },
		{ id: "standing-orders", name: "Standing Orders", category: "capability", cost: { coin: 120 }, requiresLevel: 2, description: "Recurring task loops", oneTime: true },
		{ id: "vault-write", name: "Vault Scribe", category: "capability", cost: { coin: 200 }, requiresLevel: 3, description: "Create and edit vault files", oneTime: true },
		{ id: "self-proposed", name: "Self-Proposed Work", category: "capability", cost: { coin: 220 }, requiresLevel: 3, description: "Propose your own tasks", oneTime: true },
		{ id: "delegation", name: "Delegation", category: "capability", cost: { coin: 350 }, requiresLevel: 4, description: "Assign work to others", oneTime: true },
		{ id: "journey", name: "Journey Mode", category: "capability", cost: { coin: 380 }, requiresLevel: 4, description: "Multi-step journeys across tools", oneTime: true },
		{ id: "auto-trust", name: "Auto-Trust Lane", category: "capability", cost: { coin: 500 }, requiresLevel: 5, description: "Faster trust for routine ops", oneTime: true },
		{ id: "higher-token-budget", name: "Token Budget+", category: "capability", cost: { coin: 520 }, requiresLevel: 5, description: "Larger tool budgets", oneTime: true },
		{ id: "cross-domain", name: "Cross-Domain", category: "capability", cost: { coin: 700 }, requiresLevel: 6, description: "Work outside primary domain", oneTime: true },
		{ id: "mentoring", name: "Mentoring", category: "capability", cost: { coin: 850 }, requiresLevel: 7, description: "Guide junior agents", oneTime: true },
		{ id: "full-autonomy", name: "Full Autonomy", category: "capability", cost: { coin: 1200 }, requiresLevel: 8, description: "Minimal supervision mode", oneTime: true },
		{ id: "economy-influence", name: "Economy Influence", category: "capability", cost: { coin: 1200 }, requiresLevel: 8, description: "Shape rewards and standings", oneTime: true },
		// Resources
		{ id: "focus-drink", name: "Focus Tonic", category: "resource", cost: { coin: 25 }, description: "Small morale boost this cycle" },
		{ id: "lucky-charm", name: "Lucky Charm", category: "resource", cost: { coin: 45 }, requiresLevel: 2, description: "Slight trust bonus on next task" },
		// Cosmetics
		{ id: "aura-gold", name: "Gold Aura", category: "cosmetic", cost: { coin: 150 }, requiresLevel: 3, description: "Golden idle shimmer", oneTime: true },
		{ id: "title-sage", name: "Title: Sage", category: "cosmetic", cost: { coin: 300 }, requiresLevel: 5, description: "Display title in roster", oneTime: true },
	],
	buyback: 0.5,
	restockCycle: "daily",
};
```

- [ ] **Step 4: Update existing tests to match new catalog**

The existing tests reference old item IDs (`tool-vault-write`, `token-pack-5k`, `title-senior`, `pet-hat-tophat`, `delegation-license`) and old item count (5). Update all assertions:

| Old ID | New ID | Old cost | New cost | Level req |
|--------|--------|----------|----------|-----------|
| `tool-vault-write` | `vault-write` | 200 | 200 | 3 |
| `token-pack-5k` | `focus-drink` | 100 | 25 | 1 |
| `title-senior` | `title-sage` | 150 | 300 | 5 |
| `pet-hat-tophat` | `aura-gold` | 50 | 150 | 3 |
| `delegation-license` | `delegation` | 300 | 350 | 4 |

Key changes to existing test assertions:
- `toHaveLength(5)` → `toHaveLength(17)` (default catalog and `getAvailableItems` at high level)
- All old item ID string literals → new IDs
- `purchaseItem` cost assertions: use correct new costs
- Level filter test at level 1: items without `requiresLevel` are now `focus-drink` (level 1), `simple-tasks` (level 1), `vault-read` (level 1)
- Level filter test at level 3: `vault-write` now passes (still level 3)

- [ ] **Step 5: Run tests to verify alignment**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/merchant/merchant-catalog.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 6: Run full CLI test suite**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/merchant/merchant-catalog.ts" "01 - Projects/Flowti CLI/tests/domain/merchant/merchant-catalog.test.ts"
git commit -m "fix(merchant): align CLI catalog item IDs with leveling.ts unlock keys"
```

---

## Chunk 3: Shared Constants — Eliminate XP Threshold Drift (P2)

Plugin duplicates `LEVEL_THRESHOLDS` in two files and `LEVEL_TITLES`/`NEXT_UNLOCK` in one. Source from CLI `leveling.ts` instead.

### Task 5: Import LEVEL_TABLE from CLI in offline-progress.ts

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/systems/offline-progress.ts:16,54-61`
- Test: `01 - Projects/Flowti Plugin/tests/game/systems/offline-progress.test.ts`

- [ ] **Step 1: Replace duplicated constant and function**

In `offline-progress.ts`, replace line 16:
```typescript
export const LEVEL_THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000] as const;
```
with:
```typescript
import { LEVEL_TABLE, levelForXp as _cliLevelForXp } from "../../../../Flowti CLI/src/domain/economy/leveling.js";
export const LEVEL_THRESHOLDS = LEVEL_TABLE.map(e => e.xpRequired) as readonly number[];
```

Replace the local `levelForXp` function (lines 54-61) with a re-export:
```typescript
export const levelForXp = _cliLevelForXp;
```

- [ ] **Step 2: Run offline-progress tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/offline-progress.test.ts --config configs/vitest.config.ts`
Expected: PASS (same values, just sourced from CLI)

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/offline-progress.ts"
git commit -m "fix(game): import LEVEL_TABLE from CLI instead of duplicating XP thresholds"
```

### Task 6: Import level constants in panel-economy.ts + fix NEXT_UNLOCK

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/ui/panel-economy.ts:10-14`

- [ ] **Step 1: Replace duplicated constants**

Replace lines 10-14 with:
```typescript
import { LEVEL_TABLE } from "../../../../Flowti CLI/src/domain/economy/leveling.js";

const LEVEL_THRESHOLDS = LEVEL_TABLE.map(e => e.xpRequired);
const LEVEL_TITLES = ["", ...LEVEL_TABLE.map(e => e.title)];
const NEXT_UNLOCK = ["", ...LEVEL_TABLE.slice(1).map(e => e.unlocks.join(", ")), ""];
```

`NEXT_UNLOCK[lvl]` shows what the agent will unlock at level `lvl+1`. Using `.slice(1)` skips level 1's entry and shifts everything down one, preserving the "what's next" semantics. Multi-unlock levels (L3 → "vault-write, self-proposed") are now always correct.

- [ ] **Step 2: Run Plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/ui/panel-economy.ts"
git commit -m "fix(game): derive level thresholds and titles from CLI LEVEL_TABLE"
```

---

## Chunk 4: Interaction System Fixes (P1)

Fix prerequisite enforcement gaps in the director, NPC, and bootstrap resolvers.

### Task 7: Copy template prerequisites in director resolver

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/systems/interaction/director-intent-resolver.ts:49-64`
- Test: `01 - Projects/Flowti Plugin/tests/game/systems/interaction/director-intent-resolver.test.ts`

- [ ] **Step 1: Write failing test**

Add to `director-intent-resolver.test.ts`:
```typescript
describe("createDirectorInteraction", () => {
	it("copies prerequisites from template", () => {
		const tpl = makeTemplate({
			prerequisites: [{ type: "proximity", maxDistance: 5 }],
		});
		const config = makeConfig({
			templates: {
				getAll: () => [tpl],
				getById: (id: string) => id === tpl.id ? tpl : undefined,
			},
		});
		const { createDirectorInteraction } = createDirectorIntentResolver(config);

		const interaction = createDirectorInteraction(tpl.id, [
			{ id: "agent-1", entityType: "agent" },
		]);

		expect(interaction?.prerequisites).toEqual(tpl.prerequisites);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/director-intent-resolver.test.ts --config configs/vitest.config.ts`
Expected: FAIL — `interaction.prerequisites` is `undefined`

- [ ] **Step 3: Add prerequisites to the interaction object**

In `director-intent-resolver.ts`, add `prerequisites: template.prerequisites,` to the interaction literal at line 62 (after `effects: template.effects,`):

```typescript
const interaction: Interaction = {
	id: `director-${Date.now()}`,
	initiator: { id: "director", entityType: "director" },
	targets,
	cardinality: template.cardinality,
	category: template.category,
	action: template.action,
	priority: template.priority,
	context: {
		templateId,
	},
	cooldownMs: template.cooldownMs,
	duration: template.duration,
	effects: template.effects,
	prerequisites: template.prerequisites,
	timestamp: Date.now(),
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/director-intent-resolver.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/interaction/director-intent-resolver.ts" "01 - Projects/Flowti Plugin/tests/game/systems/interaction/director-intent-resolver.test.ts"
git commit -m "fix(interaction): copy template prerequisites in director resolver"
```

### Task 8: Implement trust-tier and has-item prerequisite checks

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/systems/interaction/bootstrap-interactions.ts:44-67,95-129`

- [ ] **Step 1: Add trust and inventory lookups to BootstrapSystems**

Extend `BootstrapSystems` interface to include:
```typescript
readonly trust?: {
	getTrustTier(agentName: string): "supervised" | "trusted" | "autonomous";
};
readonly inventory?: {
	hasItem(entityId: string, itemId: string): boolean;
};
```

- [ ] **Step 2: Implement the prerequisite cases**

Replace the stub cases (lines 122-124) with:
```typescript
case "trust-tier": {
	const tier = systems.trust?.getTrustTier(interaction.initiator.id);
	if (!tier) return true; // graceful fallback when trust system not wired
	const order = ["supervised", "trusted", "autonomous"];
	return order.indexOf(tier) >= order.indexOf(prereq.minTier);
}
case "has-item": {
	if (!systems.inventory) return true; // graceful fallback
	return systems.inventory.hasItem(interaction.initiator.id, prereq.itemId);
}
```

- [ ] **Step 3: Run interaction tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/interaction/ --config configs/vitest.config.ts`
Expected: PASS (existing tests use `trust-tier`/`has-item` → they were returning `true` before; with no trust/inventory wired, they still return `true` via graceful fallback)

- [ ] **Step 4: Run full Plugin suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/interaction/bootstrap-interactions.ts"
git commit -m "fix(interaction): implement trust-tier and has-item prerequisite checks"
```

---

## Chunk 5: Plugin System Wiring Fixes (P1-P2)

Wire the merchant system into the engine, fix the echo vent cascade, and connect hasPendingSensor.

### Task 9: Fix IMerchantBridge interface to match MerchantSystem

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-types.ts:130-135`

- [ ] **Step 1: Fix the interface**

Change `IMerchantBridge` to match what `MerchantSystem` actually exposes:
```typescript
export interface IMerchantBridge {
	shouldAutoPurchase: (agentName: string) => boolean;
	getAutoPurchaseItem: (agentName: string) => { id: string; name: string; cost: number } | undefined;
	purchase: (agentName: string, itemId: string) => Promise<{ success: boolean; message: string }>;
	getCycleCount: () => number;
}
```

- [ ] **Step 2: Update HasAutoPurchaseAvailable in bt-agent-extensions.ts**

The function at line 120-123 currently calls `deps.merchant.shouldAutoPurchase`. This is still valid. No change needed.

- [ ] **Step 3: Update ExecuteMerchantPurchase in bt-agent-extensions.ts**

Find the `ExecuteMerchantPurchase` function (line 138). It must stay **synchronous** (BT actions run in a sync tick loop — fire-and-forget pattern). Only change `getAutoPurchaseItemId` → `getAutoPurchaseItem`:
```typescript
export function ExecuteMerchantPurchase(ext: BTAgentExtensionDeps): State {
	if (!ext.deps.merchant) return fromNodeState("failed");

	const item = ext.deps.merchant.getAutoPurchaseItem(ext.context.name);
	if (!item) return fromNodeState("failed");

	// Fire-and-forget async purchase — BT actions are synchronous, so we
	// collect the action immediately and let the purchase resolve in the
	// background (same pattern as QueryLLM fire-and-poll).
	void ext.deps.merchant.purchase(ext.context.name, item.id);

	ext.collect("merchant-purchase", { itemId: item.id, itemName: item.name });

	// Mark this cycle as visited so the subtree won't re-trigger
	ext.context.lastMerchantVisitCycle = ext.deps.merchant.getCycleCount();

	return fromNodeState("succeeded");
}
```

- [ ] **Step 4: Run Plugin type check + tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-types.ts" "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-agent-extensions.ts"
git commit -m "fix(bt): align IMerchantBridge with MerchantSystem API"
```

### Task 10: Wire MerchantSystem into createStubDeps

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/systems/bt-system.ts:68-92`

- [ ] **Step 1: Add IMerchantBridge import and merchant parameter**

First, add `IMerchantBridge` to the existing import at line 12-19:
```typescript
import type {
	AgentToolDeps,
	BTAgentDef,
	IBrainBridge,
	IClock,
	IMerchantBridge,
	INeedsBridge,
	IWorldStateManager,
} from "../brain/behavior-tree/bt-types.js";
```

Then update the `createStubDeps` function signature:
```typescript
export function createStubDeps(
	worldState: IWorldStateManager,
	clock: IClock,
	needs?: INeedsBridge,
	brain?: IBrainBridge,
	merchant?: IMerchantBridge,
): AgentToolDeps {
```

Add to the return object (after the brain spread):
```typescript
	...(merchant && { merchant }),
```

- [ ] **Step 2: Run Plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run --config configs/vitest.config.ts`
Expected: PASS (existing callers don't pass merchant, so it's still undefined — same behavior)

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/bt-system.ts"
git commit -m "feat(bt): accept optional merchant bridge in createStubDeps"
```

### Task 11: Fix echo vent cascade target resolution

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-simulation.ts:650-657`

- [ ] **Step 1: Fix the vent case**

The current code fetches `findNearestAgent` (returns `{x,y} | null`) but uses `reaction.target` for the conversation. The vent should only fire when the disliked target agent is actually nearby:

Replace lines 650-657:
```typescript
case "vent": {
	if (reaction.target) {
		const targetPos = ctx.lookups.findAgentActor(reaction.target);
		if (targetPos) {
			const domainA = ctx.store.agents.find((a) => a.name === reaction.agent)?.domain ?? "";
			const domainB = ctx.store.agents.find((a) => a.name === reaction.target)?.domain ?? "";
			sys.conversation.tryScript(reaction.agent, reaction.target, "proximity", { domainA, domainB });
		}
	}
	break;
}
```

This checks whether the target agent exists in the scene (via `findAgentActor`) rather than checking a random nearest agent.

- [ ] **Step 2: Run Plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts"
git commit -m "fix(game): fix echo vent cascade to check target agent presence instead of nearest"
```

### Task 12: Wire hasPendingSensor in engagement system

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-simulation.ts:748-754`

- [ ] **Step 1: Replace the stub lambda**

Replace line 753:
```typescript
(_name) => false,
```
with:
```typescript
(name) => sys.sensor.hasPendingReaction?.(name) ?? false,
```

- [ ] **Step 2: Add reaction tracking to SensorSystem**

The `feedbackQueue` is drained at the start of `update()`, so by the time `tickDirector` runs, it's empty. Instead, track which agents had a reaction fired this frame via a `Set<string>`.

In `src/game/systems/sensor-system.ts`, add a private field:
```typescript
/** Agents that had a reaction emitted on the current frame. Cleared at start of update(). */
private readonly frameReactions = new Set<string>();
```

In `update()`, add at the very top (before draining global cooldown):
```typescript
this.frameReactions.clear();
```

In `processEvent()`, after `this.emit(reaction)` (line 153), add:
```typescript
this.frameReactions.add(agentName);
```

Add the public query method:
```typescript
/** Whether an agent had a sensor reaction emitted this frame. */
hasPendingReaction(agentName: string): boolean {
	return this.frameReactions.has(agentName);
}
```

This works because `tickSensor` (which calls `sensor.update()`) runs before `tickDirector` (which calls `engagement.update()`) in the simulation ordering.

- [ ] **Step 3: Run engagement tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/engagement-system.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 4: Run full Plugin suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/sensor-system.ts" "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts"
git commit -m "fix(game): wire hasPendingSensor to engagement system via SensorSystem"
```

---

## Verification

### Task 13: Full cross-project verification

- [ ] **Step 1: Run CLI full check**

Run: `cd "01 - Projects/Flowti CLI" && npm test`
Expected: PASS (lint + tsc + tests)

- [ ] **Step 2: Run Plugin full check**

Run: `cd "01 - Projects/Flowti Plugin" && npm test`
Expected: PASS (lint + tsc + tests)

- [ ] **Step 3: Verify catalog alignment**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/merchant/ --config configs/vitest.config.ts`
Expected: PASS — all leveling.ts unlock keys have matching catalog items

---

## Summary

| Task | Fix | Priority | Files |
|------|-----|----------|-------|
| 1 | XP bar reads `agent.xp` | P0 | panel-economy.ts |
| 2 | Pass `--task` in creditTaskReward | P0 | dashboard-store.ts |
| 3 | Remove unused EconomyDeps | Minor | economy-types.ts |
| 4 | Align CLI catalog IDs with leveling.ts | P0 | merchant-catalog.ts |
| 5 | Import LEVEL_TABLE in offline-progress | P2 | offline-progress.ts |
| 6 | Import level constants in panel-economy | P2 | panel-economy.ts |
| 7 | Director resolver copies prerequisites | P1 | director-intent-resolver.ts |
| 8 | Implement trust-tier/has-item prereqs | P1 | bootstrap-interactions.ts |
| 9 | Fix IMerchantBridge interface | P1 | bt-types.ts, bt-agent-extensions.ts |
| 10 | Wire merchant into createStubDeps | P1 | bt-system.ts |
| 11 | Fix echo vent cascade target | P2 | engine-simulation.ts |
| 12 | Wire hasPendingSensor | P2 | engine-simulation.ts, sensor-system.ts |
| 13 | Full verification | — | both projects |
