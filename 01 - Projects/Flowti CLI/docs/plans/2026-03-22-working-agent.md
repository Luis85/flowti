# The Working Agent — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the execution-to-reward gap so agents earn real XP/Coin from task completion, with live visual feedback in the game world. Connect the Echo System feedback loops to economy events.

**Architecture:** CLI remains data authority for economy (ledger, rewards, trust). Plugin calls CLI commands via `cliExecutor` / `runCli` pattern for mutations, reads `economy.json` directly at boot for initial state. Echo System produces mood-residue echoes from economy events automatically (EchoProducer already handles `level-up` and `merchant-purchase`).

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-22-working-agent-design.md`

**Test commands:**
- CLI: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
- Plugin: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
- Single file (CLI): `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/economy/economy-reward.test.ts --config configs/vitest.config.ts`

---

## Dependency Graph

```
Chunk 1: Reward CLI Command (CLI) ────── no deps, foundation
Chunk 2: Economy Boot Sync (Plugin) ──── parallel with 1 (reads existing economy.json)
Chunk 3: Reward Loop Wiring (Plugin) ─── depends on 1 (calls economy:reward)
Chunk 4: Debug Tab Wiring (Plugin) ───── depends on 2 (needs economy state to verify)
Chunk 5: Food Preferences (Plugin) ───── fully independent
Chunk 6: GDD Refresh (docs) ──────────── fully independent
```

Chunks 1+2+5+6 can all execute in parallel.
Chunk 3 depends on Chunk 1.
Chunk 4 depends on Chunk 2.

---

## Chunk 1: Reward CLI Command (CLI)

### Task 1: `countCompletedByAgent` helper

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/tasks/task-store.ts`
- Test: `01 - Projects/Flowti CLI/tests/domain/tasks/task-store.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// Add to existing tests/domain/tasks/task-store.test.ts describe block:

describe("countCompletedByAgent", () => {
	it("returns 0 when no completed tasks", () => {
		const deps = makeDeps();
		expect(taskStore.countCompletedByAgent(deps, "/proj", "auditor")).toBe(0);
	});

	it("counts completed tasks for specific agent", () => {
		const completedMd = TASK_MD.replace("status: pending", "status: completed");
		const otherMd = TASK_MD.replace("id: task-001", "id: task-002")
			.replace("assignee: auditor", "assignee: builder")
			.replace("status: pending", "status: completed");
		const deps = makeDeps({
			"/proj/docs/tasks/task-001.md": completedMd,
			"/proj/docs/tasks/task-002.md": otherMd,
		});
		expect(taskStore.countCompletedByAgent(deps, "/proj", "auditor")).toBe(1);
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/tasks/task-store.test.ts --config configs/vitest.config.ts`
Expected: FAIL — countCompletedByAgent not a function

- [ ] **Step 3: Implement the helper**

Add to `src/domain/tasks/task-store.ts` in the `taskStore` object:

```typescript
countCompletedByAgent(deps: TaskStoreDeps, projectPath: string, agentName: string): number {
	return this.list(deps, projectPath)
		.filter(t => t.status === "completed" && t.assignee === agentName)
		.length;
},
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/tasks/task-store.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/tasks/task-store.ts" "01 - Projects/Flowti CLI/tests/domain/tasks/task-store.test.ts"
git commit -m "feat(tasks): add countCompletedByAgent helper"
```

---

### Task 2: `economy:reward` command

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/controller/economy.controller.ts`
- Modify: `01 - Projects/Flowti CLI/src/ui/displays/economy-display.ts`
- Test: `01 - Projects/Flowti CLI/tests/controller/economy-reward.test.ts`
- Reference: `src/domain/economy/economy-ledger.ts` (creditReward), `src/domain/economy/economy-rules.ts` (calculateReward), `src/domain/economy/leveling.ts` (titleForLevel), `src/domain/trust/trust-manager.ts` (checkAutoPromotion, promote, loadTrustProfile, saveTrustProfile)

- [ ] **Step 1: Write the renderer**

Add to `src/ui/displays/economy-display.ts`:

```typescript
interface RewardModel {
	readonly agent: string;
	readonly xp: number;
	readonly coin: number;
	readonly totalXp: number;
	readonly totalCoin: number;
	readonly level: number;
	readonly leveledUp: boolean;
	readonly newLevel?: number;
	readonly newTitle?: string;
	readonly trustPromoted?: { agentName: string; op: string; from: string; to: string };
}

export function renderReward(data: RewardModel, log: (msg?: string) => void): void {
	log(`${GREEN}Rewarded${RESET} ${BOLD}${data.agent}${RESET}: +${data.xp} XP, +${data.coin} Coin`);
	if (data.leveledUp && data.newTitle) {
		log(`  ${YELLOW}Level up!${RESET} Now Level ${data.newLevel} — ${data.newTitle}`);
	}
	if (data.trustPromoted) {
		log(`  ${CYAN}Trust promoted:${RESET} ${data.trustPromoted.op} ${data.trustPromoted.from} → ${data.trustPromoted.to}`);
	}
}
```

- [ ] **Step 2: Write the command handler**

Add `"economy:reward"` to the `commands` export in `src/controller/economy.controller.ts`:

```typescript
"economy:reward": adaptDescriptor({
	flags: {
		agent: { type: "string", required: true, hint: "--agent=<name>" },
		task: { type: "string", default: "", hint: "--task=<id>" },
		xp: { type: "number", default: 50, hint: "--xp=<amount>" },
		coin: { type: "number", default: 25, hint: "--coin=<amount>" },
		"trust-tier": { type: "string", default: "review", hint: "--trust-tier=<tier>" },
	},
	handler: (ctx) => {
		const agent = ctx.flags.agent as string;
		const taskId = ctx.flags.task as string;
		const ld = ledgerDeps(ctx.deps);

		// Read task from store if available
		const task = taskId ? taskStore.read(taskDeps(ctx.deps), VAULT_ROOT, taskId) : undefined;
		const baseReward = task
			? task.reward
			: { xp: ctx.flags.xp as number, coin: ctx.flags.coin as number };
		const trustTier = (task?.trustTier ?? ctx.flags["trust-tier"]) as TaskTrustTier;

		// Calculate reward with multipliers
		const reward = calculateReward(baseReward, {
			trustTier,
			isFirstCompletion: false,
			isStandingOrder: task?.type === "standing-order",
			isDelegation: task?.type === "delegated",
		});

		// Credit to ledger
		let ledger = readLedger(ld, VAULT_ROOT);
		const result = creditReward(ledger, agent, reward);
		ledger = result.ledger;
		writeLedger(ld, VAULT_ROOT, ledger);

		// Log transaction
		appendTransaction(ld, VAULT_ROOT, {
			ts: ctx.deps.clock.iso(), agent, type: "task-reward",
			taskId: taskId || undefined, xp: reward.xp, coin: reward.coin,
		});

		// Check auto-promotion
		let trustPromoted: { agentName: string; op: string; from: string; to: string } | undefined;
		if (task) {
			const profile = loadTrustProfile(trustDeps(ctx.deps), VAULT_ROOT, agent);
			const successCount = taskStore.countCompletedByAgent(taskDeps(ctx.deps), VAULT_ROOT, agent);
			const account = getAccount(ledger, agent);
			// Check each vault operation for auto-promotion
			for (const op of Object.keys(profile.operations) as VaultOperation[]) {
				const check = checkAutoPromotion(profile, op, account.level, successCount);
				if (check.shouldPromote && check.newLevel) {
					const promoted = promote(profile, op, check.newLevel, "auto-promotion after task reward", ctx.deps.clock.iso());
					saveTrustProfile(trustDeps(ctx.deps), VAULT_ROOT, agent, promoted);
					trustPromoted = { agentName: agent, op, from: profile.operations[op], to: check.newLevel };
					break; // One promotion per reward
				}
			}
		}

		const account = getAccount(ledger, agent);
		return {
			agent,
			xp: reward.xp,
			coin: reward.coin,
			totalXp: account.xp,
			totalCoin: account.coin,
			level: account.level,
			leveledUp: result.reward.leveledUp,
			newLevel: result.reward.newLevel,
			newTitle: result.reward.leveledUp ? titleForLevel(result.reward.newLevel!) : undefined,
			trustPromoted,
		};
	},
	renderer: renderReward,
}),
```

Add the necessary imports at the top of the file:

```typescript
import { creditReward, appendTransaction } from "../domain/economy/economy-ledger.js";
import { calculateReward } from "../domain/economy/economy-rules.js";
import { taskStore } from "../domain/tasks/task-store.js";
import type { TaskTrustTier } from "../domain/tasks/task-types.js";
import { loadTrustProfile, saveTrustProfile, checkAutoPromotion, promote } from "../domain/trust/trust-manager.js";
import type { VaultOperation } from "../domain/trust/trust-types.js";
```

Also add a `taskDeps` helper (like the existing `ledgerDeps`) and a `trustDeps` helper following the same pattern. Read how `ledgerDeps` works and create matching adapters for TaskStoreDeps and TrustDeps.

- [ ] **Step 3: Write the test**

```typescript
// tests/controller/economy-reward.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("../../src/infrastructure/ui.js", () => ({ RESET: "", DIM: "", BOLD: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", BLUE: "", MAGENTA: "", WHITE: "", BG_RED: "", BG_GREEN: "", BG_YELLOW: "" }));
vi.mock("../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));

import { commands } from "../../src/controller/economy.controller.js";

describe("economy:reward", () => {
	it("command is defined", () => {
		expect(commands["economy:reward"]).toBeDefined();
	});
});
```

- [ ] **Step 4: Register in CLI if not already**

Check `src/cli/register-builtin-domains.ts` — the `economy:reward` command should be auto-registered since it's added to the `commands` export of `economy.controller.ts`. Verify by grepping for `economyCmds` in the registration file.

- [ ] **Step 5: Run tests + type check**

```bash
cd "01 - Projects/Flowti CLI" && npx vitest run tests/controller/economy-reward.test.ts --config configs/vitest.config.ts
cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | grep -i "economy\|reward" | head -10
```

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/controller/economy.controller.ts" "01 - Projects/Flowti CLI/src/ui/displays/economy-display.ts" "01 - Projects/Flowti CLI/tests/controller/economy-reward.test.ts"
git commit -m "feat(economy): add economy:reward command with trust auto-promotion"
```

---

## Chunk 2: Economy Boot Sync (Plugin)

### Task 3: Add `xp` to DashboardAgent and setAgentEconomy

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/data/types.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts`

- [ ] **Step 1: Add `xp` field to DashboardAgent**

Read `src/game/data/types.ts`. Find the `DashboardAgent` interface. Add `xp?: number` alongside the existing `level`, `coin`, `tokens` fields.

- [ ] **Step 2: Add `xp` to setAgentEconomy parameter**

In `src/game/store/dashboard-store.ts`, find `setAgentEconomy`. Add `xp?: number` to the parameter type and add:
```typescript
if (data.xp !== undefined) agent.xp = data.xp;
```

Also update `getAgentEconomy` to include `xp`:
```typescript
return { ..., xp: agent.xp ?? 0, ... };
```

- [ ] **Step 3: Run Plugin tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/store/ 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/data/types.ts" "01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts"
git commit -m "feat(game): add xp field to DashboardAgent and setAgentEconomy"
```

---

### Task 4: Read economy.json at boot

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-lifecycle.ts`
- Reference: `01 - Projects/Flowti CLI/src/domain/economy/economy-ledger.ts` for file format

- [ ] **Step 1: Read the current engine-lifecycle.ts boot sequence**

Find where agents are first loaded/registered. After the roster is loaded, add economy enrichment.

- [ ] **Step 2: Add economy.json read at boot**

After agents are loaded, read `.flowti/var/economy.json` from the vault and merge data:

```typescript
// Read economy data from CLI ledger
const economyPath = `${vaultBasePath}/.flowti/var/economy.json`;
try {
	const adapter = (ctx.engine as unknown as { app?: { vault?: { adapter?: { exists(p: string): Promise<boolean>; read(p: string): Promise<string> } } } });
	// Use whatever file reading pattern engine-lifecycle already uses
	// Check if the file read pattern uses disk adapter, vault adapter, or fs
	// Then parse and merge:
	// const ledger = JSON.parse(raw);
	// for (const [name, account] of Object.entries(ledger.accounts)) {
	//     store.setAgentEconomy(name, { level: account.level, coin: account.coin, tokens: account.tokens, xp: account.xp });
	// }
} catch { /* economy.json may not exist yet — that's fine */ }
```

Read the existing file-read patterns in `engine-lifecycle.ts` to use the correct adapter. The Plugin uses Obsidian's vault adapter, NOT Node.js `fs`.

- [ ] **Step 3: Run Plugin tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run 2>&1 | grep -E "Test Files|Tests" | head -3
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-lifecycle.ts"
git commit -m "feat(game): read economy.json at boot to populate agent economy state"
```

---

### Task 5: Fix offline progress to persist via CLI

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-lifecycle.ts`

- [ ] **Step 1: Find the offline progress block**

Read `engine-lifecycle.ts` and find where offline earnings are applied via `store.setAgentEconomy()` (around lines 230-253).

- [ ] **Step 2: Replace direct store mutation with CLI command**

Instead of calling `store.setAgentEconomy()` directly for offline earnings, call the CLI `economy:reward` command (which writes to the ledger) and THEN update the store from the result:

```typescript
// For each agent with offline earnings:
for (const agentResult of results.agentResults) {
	if (agentResult.xpEarned <= 0 && agentResult.coinEarned <= 0) continue;
	// Persist to CLI ledger first (CLI is data authority)
	try {
		await runCli(`economy:reward --agent="${agentResult.name}" --xp=${agentResult.xpEarned} --coin=${agentResult.coinEarned} --format=json`);
	} catch { /* CLI not available — fall through to store-only update */ }
	// Then update Plugin state
	store.setAgentEconomy(agentResult.name, {
		coin: (store.getAgentEconomy(agentResult.name)?.coin ?? 0) + agentResult.coinEarned,
		xp: (store.getAgentEconomy(agentResult.name)?.xp ?? 0) + agentResult.xpEarned,
		level: agentResult.currentLevel,
	});
}
```

Check how `runCli` is available in the engine-lifecycle context. It may need to be passed via deps or accessed from the engine context.

- [ ] **Step 3: Run Plugin tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run 2>&1 | grep -E "Test Files|Tests" | head -3
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-lifecycle.ts"
git commit -m "fix(game): persist offline earnings to CLI ledger before updating Plugin state"
```

---

## Chunk 3: Reward Loop Wiring (Plugin)

### Task 6: Wire handleDone to call economy:reward

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts`

- [ ] **Step 1: Read the current handleDone method**

Read `dashboard-store.ts` lines 597-616 to understand the current flow.

- [ ] **Step 2: Add reward call after task completion**

After line 610 (the `dispatchEvent` for `task-completed`), add the reward flow:

```typescript
// Credit reward via CLI (async — fire and forget, show reward when ready)
if (this.cliExecutor) {
	const taskName = activeTask.name;
	this.cliExecutor.runCommand(`economy:reward --agent="${agentName}" --task="${taskName}" --format=json`)
		.then((output: string) => {
			try {
				const reward = JSON.parse(output);
				// Update store with new economy state
				this.setAgentEconomy(agentName, {
					level: reward.level,
					coin: reward.totalCoin,
					tokens: this.getAgentEconomy(agentName)?.tokens ?? 0,
					xp: reward.totalXp,
				});
				// Re-dispatch task-completed with economy data for floating text
				this.dispatchEvent(new CustomEvent("task-completed", {
					detail: { agentName, task: taskName, xp: reward.xp, coin: reward.coin },
				}));
				// Fire level-up if applicable
				if (reward.leveledUp) {
					this.dispatchEvent(new CustomEvent("level-up", {
						detail: { agentName, level: reward.newLevel, title: reward.newTitle },
					}));
				}
				// Fire trust-promoted if applicable
				if (reward.trustPromoted) {
					this.dispatchEvent(new CustomEvent("trust-promoted", {
						detail: reward.trustPromoted,
					}));
				}
			} catch { /* JSON parse failed — reward still credited on CLI side */ }
		})
		.catch(() => { /* CLI not available — no reward this time */ });
}
```

Check how `cliExecutor.runCommand()` works — it may have a different method name. Read the `ICliExecutor` interface. The merchant system uses `deps.runCli()` which may be a different pattern. Match whichever pattern is used in the store.

- [ ] **Step 3: Run Plugin tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/store/ 2>&1 | tail -10
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts"
git commit -m "feat(game): wire handleDone to call economy:reward and dispatch economy events"
```

---

## Chunk 4: Debug Tab Wiring (Plugin)

### Task 7: Wire debug panel events to CLI commands

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/engine-events-debug.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/engine.ts`
- Test: `01 - Projects/Flowti Plugin/tests/game/engine-events-debug.test.ts`

- [ ] **Step 1: Read panel-debug.ts to understand dispatched events**

Read `src/game/ui/panel-debug.ts` to see what custom events it dispatches (event names, detail shapes).

- [ ] **Step 2: Create engine-events-debug.ts**

```typescript
import type { EngineContext } from "./engine-types.js";

export function wireDebugEvents(ctx: EngineContext): void {
	const container = ctx.engine.canvas.parentElement;
	if (!container) return;

	container.addEventListener("debug-economy-cheat", async (e: Event) => {
		const { agentName, action } = (e as CustomEvent).detail;
		if (!ctx.store.cliExecutor) return;

		const CHEAT_MAP: Record<string, string> = {
			"+500coin": '--coin="500"',
			"+10000tokens": '--tokens="10000"',
			"+500xp": '--xp="500"',
			levelup: '--xp="500"',  // Enough XP to trigger level-up in most cases
		};
		const flags = CHEAT_MAP[action];
		if (!flags) return;

		try {
			await ctx.store.cliExecutor.runCommand(`debug:set --agent="${agentName}" ${flags} --format=json`);
			// Refresh economy state
			// Re-read from CLI result or re-read economy.json
		} catch { /* CLI unavailable */ }
	});

	container.addEventListener("debug-trust-mode", async (e: Event) => {
		const { agentName, operation, level } = (e as CustomEvent).detail;
		if (!ctx.store.cliExecutor) return;
		try {
			await ctx.store.cliExecutor.runCommand(`debug:trust --agent="${agentName}" --op="${operation}" --level="${level}" --format=json`);
		} catch { /* CLI unavailable */ }
	});

	container.addEventListener("debug-stat-adjust", async (e: Event) => {
		const { agentName, stat, value } = (e as CustomEvent).detail;
		if (!ctx.store.cliExecutor) return;
		try {
			await ctx.store.cliExecutor.runCommand(`debug:set --agent="${agentName}" --${stat}="${value}" --format=json`);
		} catch { /* CLI unavailable */ }
	});
}
```

Adapt the event names and detail shapes to match what `panel-debug.ts` actually dispatches. Read the file first.

- [ ] **Step 3: Wire into engine.ts**

Read `src/game/engine.ts` and find where other `wire*Events` functions are called. Add:

```typescript
import { wireDebugEvents } from "./engine-events-debug.js";
// ... in the bootstrap function:
wireDebugEvents(ctx);
```

- [ ] **Step 4: Write test**

```typescript
// tests/game/engine-events-debug.test.ts
import { describe, it, expect, vi } from "vitest";

describe("engine-events-debug", () => {
	it("module exists and exports wireDebugEvents", async () => {
		const mod = await import("../../src/game/engine-events-debug.js");
		expect(mod.wireDebugEvents).toBeTypeOf("function");
	});
});
```

- [ ] **Step 5: Run tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/engine-events-debug 2>&1 | tail -10
```

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-events-debug.ts" "01 - Projects/Flowti Plugin/src/game/engine.ts" "01 - Projects/Flowti Plugin/tests/game/engine-events-debug.test.ts"
git commit -m "feat(game): wire debug panel events to CLI debug commands"
```

---

## Chunk 5: Food Preferences (Plugin)

### Task 8: Station preference data + BT integration

**Files:**
- Create: `01 - Projects/Flowti Plugin/src/game/data/food-preferences.ts`
- Test: `01 - Projects/Flowti Plugin/tests/game/data/food-preferences.test.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/subtrees/needs-hunger.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/subtrees/needs-thirst.ts`
- Reference: `src/game/data/quirk-definitions.ts` (existing quirks), `src/game/engine-simulation.ts` (existing threshold modulation)

- [ ] **Step 1: Write the preference data file**

```typescript
// src/game/data/food-preferences.ts

/** Maps quirk IDs to preferred food/drink stations. */
export const FOOD_STATION_PREFERENCES: Record<string, string> = {
	"coffee-addict": "CoffeeMachine",
	"snacker": "SnackTable",
};

export const DRINK_STATION_PREFERENCES: Record<string, string> = {
	"coffee-addict": "CoffeeMachine",
	"health-nut": "WaterCooler",
};

/**
 * Returns the preferred station name for an agent based on their quirks,
 * or null if no preference applies.
 */
export function getPreferredFoodStation(quirks: readonly string[]): string | null {
	for (const q of quirks) {
		const pref = FOOD_STATION_PREFERENCES[q];
		if (pref) return pref;
	}
	return null;
}

export function getPreferredDrinkStation(quirks: readonly string[]): string | null {
	for (const q of quirks) {
		const pref = DRINK_STATION_PREFERENCES[q];
		if (pref) return pref;
	}
	return null;
}
```

- [ ] **Step 2: Write tests**

```typescript
// tests/game/data/food-preferences.test.ts
import { describe, it, expect } from "vitest";
import { getPreferredFoodStation, getPreferredDrinkStation } from "../../../src/game/data/food-preferences.js";

describe("food-preferences", () => {
	it("coffee-addict prefers CoffeeMachine for food", () => {
		expect(getPreferredFoodStation(["coffee-addict"])).toBe("CoffeeMachine");
	});

	it("snacker prefers SnackTable for food", () => {
		expect(getPreferredFoodStation(["snacker"])).toBe("SnackTable");
	});

	it("coffee-addict prefers CoffeeMachine for drinks", () => {
		expect(getPreferredDrinkStation(["coffee-addict"])).toBe("CoffeeMachine");
	});

	it("health-nut prefers WaterCooler for drinks", () => {
		expect(getPreferredDrinkStation(["health-nut"])).toBe("WaterCooler");
	});

	it("returns null for agents without food quirks", () => {
		expect(getPreferredFoodStation(["perfectionist"])).toBeNull();
	});

	it("returns null for empty quirk list", () => {
		expect(getPreferredFoodStation([])).toBeNull();
	});

	it("first matching quirk wins", () => {
		expect(getPreferredFoodStation(["snacker", "coffee-addict"])).toBe("SnackTable");
	});
});
```

- [ ] **Step 3: Run tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/data/food-preferences 2>&1 | tail -10
```

- [ ] **Step 4: Integrate into hunger/thirst BT subtrees**

Read `src/game/brain/behavior-tree/subtrees/needs-hunger.ts` and `needs-thirst.ts`. The current BT seeks the nearest available station. Add a selector branch that checks for a preferred station first:

In the BT context (which already has access to quirks via `ctx.quirks` or similar), look up the preferred station. If available and unoccupied, target it. Otherwise fall through to the existing nearest-available logic.

The exact integration depends on how the BT subtrees are structured — read them first. The change should be a `sequence` that checks `[HasPreferredStation] → [IsPreferredStationAvailable] → [SeekPreferredStation]` before the existing fallback.

Also leverage the **Echo System**: when an agent uses their preferred station, produce a `preference` echo via `echoProducer` to reinforce the behavior. This connects food preferences to the echo feedback loop.

- [ ] **Step 5: Run full Plugin tests**

```bash
cd "01 - Projects/Flowti Plugin" && npx vitest run 2>&1 | grep -E "Test Files|Tests" | head -3
```

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/data/food-preferences.ts" "01 - Projects/Flowti Plugin/tests/game/data/food-preferences.test.ts" "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/subtrees/needs-hunger.ts" "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/subtrees/needs-thirst.ts"
git commit -m "feat(game): add quirk-based food station preferences with echo feedback"
```

---

## Chunk 6: GDD Refresh (docs)

### Task 9: Update Game Design Document

**Files:**
- Modify: `01 - Projects/Flowti Plugin/docs/Agent World - Game Design Document.md`

- [ ] **Step 1: Read the current GDD**

Read the full GDD to understand the current Systems Inventory tables.

- [ ] **Step 2: Update Systems Inventory**

Move these from "Current Increment (in-progress)" or "Planned" to "Implemented (Stable)":
- Task Engine → "Stable" (CRUD, 7-state lifecycle, standing orders, staging, delegation, journey checkpoint)
- Economy → "Stable" (XP/Coin/Tokens ledger, 8-level leveling, reward rules, economy:reward command)
- Progressive Trust → "Stable" (7 vault ops × 3 tiers, auto-promotion, trust CLI commands)
- Merchant NPC → "Stable" (catalog, shop UI, auto-purchase BT, merchant panel, merchant stall actor)
- Task Routing → "Stable" (priority router, concurrency pool, dequeue pipeline, health monitor, task scoring)
- Process Pool → "Stable" (maxConcurrent, FIFO queue)
- Debug Panel → "Stable" (CLI commands + Plugin debug tab)
- Narrative System → "Stable" (beat collection, composition, vault markdown)
- Offline Progress → "Stable" (bounded simulation, briefing panel)
- Echo System → "Stable" (echo store, producer, cascade resolver, dialogue bias, BT idle bias)
- Interaction System → "Stable" (resolvers, effect renderer, merchant/rival rules)

Add new "Current Increment" section for "The Working Agent":
- Reward Loop Wiring → "In Progress"
- Economy Boot Sync → "In Progress"

- [ ] **Step 3: Update architecture description**

Replace any "SSE bridge" references with:
> CLI↔Plugin communication uses file-watch (world-state.json) + subprocess JSONL events. CLI writes state to `.flowti/var/`; Plugin reads at boot and watches for changes. Agent work runs as CLI subprocesses with real-time JSONL event streams.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/docs/Agent World - Game Design Document.md"
git commit -m "docs: refresh GDD systems inventory and architecture description"
```

---

## Phase Complete

After all 9 tasks, the Working Agent increment delivers:

| What | Effect |
|------|--------|
| `economy:reward` CLI command | Credits XP/Coin with multipliers, checks trust auto-promotion |
| handleDone → reward wiring | Task completion triggers live economy updates |
| Boot-time economy sync | Agent panel shows real Level/Coin/Tokens/XP on startup |
| Offline earnings persisted | CLI ledger stays in sync with Plugin state |
| Debug tab wired | Economy cheats and trust toggles work from Plugin UI |
| Food preferences | Quirk-driven station choice with echo feedback |
| GDD refreshed | Accurate systems inventory and architecture description |

**Verification:**
- [ ] `flowti economy:reward --agent=auditor --xp=100 --coin=50` → credits to ledger, returns JSON
- [ ] Agent completes task in game → floating "+XP +Coin" text appears
- [ ] Agent levels up → golden particle burst + celebration bubble
- [ ] Agent panel shows real economy data on boot
- [ ] Debug tab: click "+500 Coin" → economy panel updates
- [ ] Coffee-addict agent → heads to CoffeeMachine when hungry
