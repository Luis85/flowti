# Game World Full Increment — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the complete Task & Economy Engine — agents do real vault work, earn XP/Coin, level up, buy capabilities from a Merchant NPC, progress through trust tiers, and interact with hunger/thirst-driven sustenance stations. Pets gain functional utility roles. Visual progression shows in the game world.

**Architecture:** CLI owns data and rules (task store, economy ledger, trust, merchant catalog). Plugin owns presentation and execution runtime (BT, game engine, UI). Communication via existing SSE bridge. Hunger/thirst extends the Plugin's needs system as energy sub-drivers.

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-21-task-economy-engine-design.md`
**Hunger/Thirst Spec:** `01 - Projects/Flowti Plugin/docs/specs/2026-03-21-hunger-thirst-design.md`

**Test commands:**
- CLI: `cd "01 - Projects/Flowti CLI" && npm test`
- Plugin: `cd "01 - Projects/Flowti Plugin" && npm test`

---

## Pre-Execution Notes

### TUI/Interactive Mode Removal
The Flowti CLI is removing TUI and interactive mode. All new commands in this plan are **non-interactive CLI commands only** — no sitemap pages, no menu items, no interactive prompts. Commands output JSON or ANSI and exit.

### Agent Experience Migration
`DashboardAgent.experience` already exists in the Plugin. On first run with the economy ledger:
- Economy ledger `xp` field becomes the single source of truth
- Existing `experience` values are NOT migrated (agents start fresh at XP 0, Level 1)
- The Plugin's `panel-info.ts` `renderXp()` will be rewired to read from economy data via SSE

### Sprite Assets Confirmed
Ninja Adventure item sprites extracted to `.obsidian/plugins/flowti-ibde/assets/Items/`:
- `Items/Food/Meat.png`, `Items/Food/Onigiri.png`
- `Items/Potion/MilkPot.png`, `Items/Potion/WaterPot.png`
- `Items/Object/Gourd.png`

Merchant NPC character (Master): `.obsidian/plugins/flowti-ibde/assets/Actor/Characters/Master/`

### SSE Event Contract (define before Chunk 4)
New event types to add to `handleCliEvent()` in `dashboard-store.ts`:

| Event Type | Payload | Trigger |
|-----------|---------|---------|
| `"economy-update"` | `{ agent, xp, level, coin, tokens }` | After any ledger mutation |
| `"trust-update"` | `{ agent, tier, operations }` | After trust promotion/demotion |
| `"task-status"` | `{ taskId, status, reward? }` | On task lifecycle transition |
| `"level-up"` | `{ agent, newLevel, title }` | When XP crosses level threshold |

### Default Merchant Catalog
Initial `merchant-catalog.json` seed data (5 items):

```json
{
  "version": 1,
  "items": [
    { "id": "tool-vault-write", "name": "Vault Write Access", "category": "capability", "cost": { "coin": 200 }, "requiresLevel": 3, "description": "Unlocks note creation and file editing", "oneTime": true },
    { "id": "token-pack-5k", "name": "Token Pack (5,000)", "category": "resource", "cost": { "coin": 100 }, "description": "5,000 LLM tokens", "oneTime": false },
    { "id": "title-senior", "name": "Senior Title Badge", "category": "cosmetic", "cost": { "coin": 150 }, "requiresLevel": 5, "description": "Display 'Senior' title in the world", "oneTime": true },
    { "id": "pet-hat-tophat", "name": "Top Hat (Pet)", "category": "pet-cosmetic", "cost": { "coin": 50 }, "description": "A dapper top hat for your companion", "oneTime": false },
    { "id": "delegation-license", "name": "Delegation License", "category": "capability", "cost": { "coin": 300 }, "requiresLevel": 4, "description": "Unlocks ability to assign tasks to other agents", "oneTime": true }
  ],
  "buyback": 0.5,
  "restockCycle": "daily"
}
```

---

## Dependency Graph

```
Chunk 1A: Economy Foundation (CLI)  ─────────┐
Chunk 1B: Hunger/Thirst (Plugin)  ──── parallel, no deps ──┐
                                              │              │
Chunk 2: Trust + Vault Ops (CLI)  ←── depends on 1A        │
                                              │              │
Chunk 3: Merchant + NPC (CLI+Plugin) ←── depends on 1A     │
                                              │              │
Chunk 4: WorkerManager + Journey (CLI+Plugin) ←── depends on 2, 3
                                              │              │
Chunk 5: Visual + Debug (Plugin)  ←── depends on 1B, 3, 4 ─┘
```

Chunks 1A and 1B share zero files and execute fully in parallel.
Chunks 2 and 3 can partially overlap (different files, both depend on 1A).
Chunk 4 depends on trust (2) and merchant (3).
Chunk 5 depends on everything.

---

## Chunk 1A: Economy Foundation (CLI) — 10 tasks

> **Detailed plan:** `01 - Projects/Flowti CLI/docs/plans/2026-03-21-task-economy-engine-phase-a.md`

Execute all 10 tasks from the existing Phase A plan. Summary:

| Task | What it builds |
|------|---------------|
| 1 | Task types (`task-types.ts`) |
| 2 | Task lifecycle state machine (`task-lifecycle.ts`) |
| 3 | Task store — manual CRUD (`task-store.ts`) |
| 4 | Economy types (`economy-types.ts`) |
| 5 | Leveling system — 8 tiers (`leveling.ts`) |
| 6 | Economy ledger — credit/debit/grant (`economy-ledger.ts`) |
| 7 | Reward rules — multipliers (`economy-rules.ts`) |
| 8 | Task controller + renderer (`task.controller.ts`, `task-display.ts`) |
| 9 | Economy controller + renderer (`economy.controller.ts`, `economy-display.ts`) |
| 10 | Register commands in `main.ts` |

**Verification gate:**
- [ ] `cd "01 - Projects/Flowti CLI" && npm test` — all pass
- [ ] `flowti task:list` returns empty
- [ ] `flowti economy:balance --agent=auditor` returns default account

---

## Chunk 1B: Hunger/Thirst (Plugin) — 18 tasks

> **Detailed plan:** `01 - Projects/Flowti Plugin/docs/plans/2026-03-21-hunger-thirst.md`
> **Review fixes:** 6 critical issues documented at top of that plan — apply during execution.

Execute all 18 tasks. Summary:

| Task | What it builds |
|------|---------------|
| 1 | Extend AgentNeeds interfaces (hunger/thirst fields) |
| 2 | Extend NeedsSystem methods (register, getNeeds, serialize, restore) |
| 3 | Energy multiplier + day-phase config |
| 4 | loadItemSprite utility |
| 5 | Retrofit existing stations (CoffeeMachine +thirst, SnackTable +hunger, WaterCooler +thirst) |
| 6 | FoodBowl actor |
| 7 | WaterBowl actor |
| 7b | Replace Canvas with Ninja Adventure sprites |
| 8 | needs-hunger BT subtree |
| 9 | needs-thirst BT subtree |
| 10 | BT conditions/actions (IsHungry, IsThirsty, SeekFoodStation, Eat, etc.) |
| 11 | Insert in master selector (priority 3 and 4) |
| 12 | Pet BT hunger/thirst branches |
| 13 | Wire FoodBowl/WaterBowl in engine-objects.ts |
| 14 | Object attractions + share mechanic |
| 15 | Needs to DashboardStore |
| 16 | Hunger/thirst bars in panel-info |
| 17 | Pet hunger/thirst persistence |
| 18 | Integration test + build |

**Verification gate:**
- [ ] `cd "01 - Projects/Flowti Plugin" && npm test` — all pass
- [ ] `npm run build` succeeds
- [ ] Agents show 6 needs bars in info panel
- [ ] Agents seek food/drink when hungry/thirsty

---

## Chunk 2: Trust + Vault Operations (CLI) — 10 tasks

**Depends on:** Chunk 1A complete (trust checks reference economy levels)

### Task 11: Trust Types

**Files:**
- Create: `src/domain/trust/trust-types.ts`
- Test: `tests/domain/trust/trust-types.test.ts`

- [ ] **Step 1: Write type definitions**

```typescript
// src/domain/trust/trust-types.ts
export type TrustLevel = "manual" | "review" | "auto";

export type VaultOperation =
	| "vault-read" | "vault-search" | "vault-tag"
	| "vault-create" | "vault-edit" | "vault-move" | "vault-link";

export interface OperationTrust {
	readonly operation: VaultOperation;
	readonly level: TrustLevel;
}

export interface PromotionLogEntry {
	readonly op: VaultOperation;
	readonly from: TrustLevel;
	readonly to: TrustLevel;
	readonly at: string;
	readonly reason: string;
}

export interface AgentTrustProfile {
	readonly tier: "supervised" | "trusted" | "autonomous";
	readonly operations: Record<VaultOperation, TrustLevel>;
	readonly promotionLog: readonly PromotionLogEntry[];
}

export interface TrustThreshold {
	readonly successes: number;
	readonly minLevel: number;
}

export interface TrustConfig {
	readonly autoPromote: boolean;
	readonly thresholds: Partial<Record<VaultOperation, TrustThreshold>>;
}

export const DEFAULT_OPERATION_TRUST: Record<VaultOperation, TrustLevel> = {
	"vault-read": "auto",
	"vault-search": "auto",
	"vault-tag": "review",
	"vault-create": "review",
	"vault-edit": "manual",
	"vault-move": "manual",
	"vault-link": "review",
};

export const DEFAULT_TRUST_CONFIG: TrustConfig = {
	autoPromote: true,
	thresholds: {
		"vault-tag": { successes: 20, minLevel: 2 },
		"vault-create": { successes: 50, minLevel: 4 },
		"vault-edit": { successes: 100, minLevel: 5 },
	},
};
```

- [ ] **Step 2: Write type-check tests, run, commit**

```bash
git commit -m "feat(trust): add trust type definitions and defaults"
```

---

### Task 12: Trust Manager

**Files:**
- Create: `src/domain/trust/trust-manager.ts`
- Test: `tests/domain/trust/trust-manager.test.ts`

- [ ] **Step 1: Write failing tests**

Test `getTrustProfile`, `canPerform`, `promote`, `demote`, `recordSuccess`, `checkAutoPromotion`, `deriveTier`.

Key test cases:
- New agent gets DEFAULT_OPERATION_TRUST, tier "supervised"
- `canPerform("vault-read")` returns `{ allowed: true, level: "auto" }`
- `canPerform("vault-edit")` returns `{ allowed: false, level: "manual", reason: "requires Director" }`
- `promote("vault-tag", "auto")` updates operation and logs entry
- After N successes at minLevel, auto-promotion fires
- `deriveTier` returns "autonomous" when 80%+ operations are "auto"

- [ ] **Step 2: Implement trust-manager.ts**

Pure domain functions receiving deps (disk, paths, clock). Trust profiles stored in agent companion JSON under `"trust"` key. Functions: `loadTrustProfile(deps, vaultRoot, agentName)`, `saveTrustProfile(deps, vaultRoot, agentName, profile)`, `canPerform(profile, operation)`, `promote(profile, operation, level, reason, clock)`, `demote(profile, operation, level, reason, clock)`, `recordSuccess(profile, operation, count)`, `checkAutoPromotion(profile, operation, agentLevel, config)`, `deriveTier(profile)`.

- [ ] **Step 3: Run tests, verify pass, commit**

```bash
git commit -m "feat(trust): add trust manager with promote/demote/auto-promotion"
```

---

### Task 13: Staging Area

**Files:**
- Create: `src/domain/tasks/staging.ts`
- Test: `tests/domain/tasks/staging.test.ts`

- [ ] **Step 1: Write failing tests**

Test `createStagingArea`, `readManifest`, `approveStaged`, `rejectStaged`, `listPendingReviews`.

- [ ] **Step 2: Implement staging.ts**

Staging area at `.flowti/var/staging/{task-id}/`. Functions operate on `manifest.json` (what the agent did) and `preview/` directory (created/modified files). `approveStaged` moves files from staging to vault. `rejectStaged` cleans up staging and marks task as rejected.

```typescript
export interface StagingManifest {
	readonly taskId: string;
	readonly agentName: string;
	readonly operation: VaultOperation;
	readonly files: readonly StagedFile[];
	readonly createdAt: string;
	readonly status: "pending" | "approved" | "rejected";
}

export interface StagedFile {
	readonly path: string;
	readonly action: "create" | "modify" | "tag" | "move" | "link";
	readonly previewPath: string;
}
```

- [ ] **Step 3: Run tests, commit**

```bash
git commit -m "feat(tasks): add staging area for review-tier vault operations"
```

---

### Task 14: Standing Order Index

**Files:**
- Create: `src/domain/tasks/standing-order-index.ts`
- Test: `tests/domain/tasks/standing-order-index.test.ts`

- [ ] **Step 1: Write failing tests**

Test `buildIndex`, `matchEvent`, `getActiveOrders`.

- [ ] **Step 2: Implement**

In-memory index built from task store. `buildIndex(tasks)` filters standing orders by status "assigned". `matchEvent(index, event)` checks folder/tag patterns against event data. `getActiveOrders(index, agentName)` returns orders assigned to a specific agent.

```typescript
export interface StandingOrderIndex {
	readonly orders: readonly IndexedOrder[];
}

export interface IndexedOrder {
	readonly taskId: string;
	readonly assignee: string;
	readonly watchFolder: string;
	readonly watchEvent: string;
	readonly rules: readonly StandingOrderRule[];
}

export function buildIndex(tasks: TaskSummary[]): StandingOrderIndex;
export function matchEvent(index: StandingOrderIndex, event: { folder: string; type: string }): IndexedOrder[];
export function getActiveOrders(index: StandingOrderIndex, agentName: string): IndexedOrder[];
```

- [ ] **Step 3: Run tests, commit**

```bash
git commit -m "feat(tasks): add standing order index for event matching"
```

---

### Task 15: Trust Controller

**Files:**
- Create: `src/controller/trust.controller.ts`
- Create: `src/ui/trust-display.ts`
- Test: `tests/controller/trust.controller.test.ts`

- [ ] **Step 1: Write renderers**

`renderTrustProfile(data, log)` — shows agent name, tier, all operations with trust levels, promotion history.
`renderTrustUpdated(data, log)` — confirmation message for promote/demote.

- [ ] **Step 2: Write controller**

Commands: `trust:show`, `trust:promote`, `trust:demote`, `trust:history`. Follow `adaptDescriptor()` pattern. Import `VAULT_ROOT` from `"../infrastructure/config.js"`.

- [ ] **Step 3: Write tests, run, commit**

```bash
git commit -m "feat(trust): add trust CLI commands and renderers"
```

---

### Task 16: Extend Task Controller with Review/Approve/Reject

**Files:**
- Modify: `src/controller/task.controller.ts`
- Modify: `src/ui/task-display.ts`
- Test: `tests/controller/task.controller.test.ts`

- [ ] **Step 1: Add `task:review`, `task:approve`, `task:reject` commands**

`task:review` lists tasks in "review" status. `task:approve` transitions review→completed, awards XP/Coin via economy ledger, records transaction. `task:reject` transitions review→pending with rejection reason.

- [ ] **Step 2: Add `task:standing-orders` command**

Lists all standing orders with run counts and status.

- [ ] **Step 3: Add renderers for review/approve/reject output**

- [ ] **Step 4: Run tests, commit**

```bash
git commit -m "feat(tasks): add review/approve/reject and standing-orders commands"
```

---

### Task 17: Journey Checkpoint Format

**Files:**
- Create: `src/domain/tasks/journey-checkpoint.ts`
- Test: `tests/domain/tasks/journey-checkpoint.test.ts`

- [ ] **Step 1: Write failing tests**

Test `createCheckpoint`, `updateStepResult`, `pauseForReview`, `resumeFromCheckpoint`.

- [ ] **Step 2: Implement**

```typescript
export interface JourneyCheckpoint {
	readonly journeyId: string;
	readonly taskId: string;
	readonly currentStep: number;
	readonly totalSteps: number;
	readonly status: "running" | "paused-for-review" | "completed" | "failed";
	readonly stepResults: readonly StepResult[];
}

export interface StepResult {
	readonly step: number;
	readonly status: "completed" | "awaiting-review" | "failed";
	readonly at: string;
}
```

Stored at `.flowti/var/staging/{task-id}/journey-checkpoint.json`.

- [ ] **Step 3: Run tests, commit**

```bash
git commit -m "feat(tasks): add journey checkpoint format for review-gated pauses"
```

---

### Task 18: Register Trust Commands + Wire Phase B

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Register trust controller commands alongside task/economy**
- [ ] **Step 2: Run full CLI test suite + type check + build**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat: register trust commands, complete Phase B CLI foundation"
```

**Verification gate:**
- [ ] `npm test` — all pass
- [ ] `flowti trust:show --agent=auditor` returns default supervised profile
- [ ] `flowti task:standing-orders` returns empty list

---

## Chunk 3: Merchant + NPC Type (CLI + Plugin) — 10 tasks

**Depends on:** Chunk 1A complete

### Task 19: Merchant Types + Catalog Domain (CLI)

**Files:**
- Create: `src/domain/merchant/merchant-types.ts`
- Create: `src/domain/merchant/merchant-catalog.ts`
- Test: `tests/domain/merchant/merchant-catalog.test.ts`

- [ ] **Step 1: Write types**

```typescript
export type ShopCategory = "capability" | "resource" | "cosmetic" | "pet-cosmetic" | "room";

export interface CatalogItem {
	readonly id: string;
	readonly name: string;
	readonly category: ShopCategory;
	readonly cost: { readonly coin: number };
	readonly requiresLevel?: number;
	readonly description: string;
	readonly oneTime?: boolean;
}

export interface MerchantCatalog {
	readonly version: number;
	readonly items: readonly CatalogItem[];
	readonly buyback: number;
	readonly restockCycle: string;
}
```

- [ ] **Step 2: Write failing tests for catalog CRUD**

Test `readCatalog`, `writeCatalog`, `purchaseItem` (validates balance, level, one-time check), `getAvailableItems` (filters by agent level).

- [ ] **Step 3: Implement catalog.ts**

Catalog stored at `.flowti/var/merchant-catalog.json` (NOT in agent companion JSON). `purchaseItem` returns updated catalog + economy ledger debit, or null if insufficient funds/level.

- [ ] **Step 4: Run tests, commit**

```bash
git commit -m "feat(merchant): add catalog domain with purchase validation"
```

---

### Task 20: Shop Controller (CLI)

**Files:**
- Create: `src/controller/shop.controller.ts`
- Create: `src/ui/shop-display.ts`
- Test: `tests/controller/shop.controller.test.ts`

Commands: `shop:list`, `shop:buy`, `shop:catalog:add`, `shop:catalog:edit`.

- [ ] **Step 1-4: Write renderers, controller, tests, commit**

```bash
git commit -m "feat(merchant): add shop CLI commands"
```

---

### Task 21: NPC Agent Type — CLI Side

**Files:**
- Modify: `src/domain/agents/agent-types.ts` — extend `AgentType` union with `"npc"`
- Modify: `src/domain/agents/agent-store.ts` — update frontmatter parser to accept `"npc"`
- Test: `tests/domain/agents/agent-store.test.ts`

- [ ] **Step 1: Extend AgentType**

```typescript
export type AgentType = "human" | "ai" | "npc";
```

- [ ] **Step 2: Update agent-store.ts parser**

Change the binary parse `agentType === "ai" ? "ai" : "human"` to accept all three values:

```typescript
const validTypes = new Set(["human", "ai", "npc"]);
agentType: validTypes.has(fm.agentType) ? fm.agentType as AgentType : "human",
```

- [ ] **Step 3: Add test for NPC parsing**
- [ ] **Step 4: Create Merchant agent definition**

Create `docs/agents/merchant.md` with `agentType: npc`, `domain: commerce`.

- [ ] **Step 5: Run tests, commit**

```bash
git commit -m "feat(agents): add NPC agent type, create Merchant definition"
```

---

### Task 22: NPC Agent Type — Plugin Side

**Files:**
- Modify: `src/game/data/types.ts` — extend DashboardAgent agentType
- Modify: `src/game/config/agent-markdown-roster.ts` — accept "npc"
- Modify: `src/game/ui/panel-info.ts` — render "NPC" label
- Modify: `src/game/ui/panel-tasks.ts` — handle NPC in isAiAgent check
- Modify: `src/game/systems/bt-system.ts` — skip BT for NPCs
- Modify: `src/game/store/dashboard-store.ts` — extend TabName with "debug"

- [ ] **Step 1: Extend DashboardAgent agentType to accept "npc"**

In `types.ts`, update the `agentType` field comment. Since it's typed as `string`, no code change needed — but add a type guard:

```typescript
export type AgentType = "human" | "ai" | "npc";
```

- [ ] **Step 2: Update agent-markdown-roster.ts**

Line 179: Keep the default "ai" fallback but let "npc" pass through:

```typescript
agentType: (fm.agentType === "ai" || fm.agentType === "npc") ? fm.agentType : "human",
```

- [ ] **Step 3: Update panel-info.ts rendering**

```typescript
const typeLabel = agentType === "ai" ? "AI Agent" : agentType === "npc" ? "NPC" : "Human";
```

- [ ] **Step 4: Update panel-tasks.ts isAiAgent check**

```typescript
private get isAiAgent(): boolean {
	return this.agent?.agentType === "ai";
}
private get isNpc(): boolean {
	return this.agent?.agentType === "npc";
}
```

- [ ] **Step 5: Skip BT for NPCs in bt-system.ts**

Add guard in `register()`:

```typescript
register(agent: DashboardAgent, deps: AgentToolDeps): void {
	if (this.entries.has(agent.name)) return;
	if (agent.agentType === "npc") return; // NPCs don't get behavior trees
	if (!agent.behaviors || agent.behaviors.length === 0) return;
	// ... rest unchanged
}
```

- [ ] **Step 6: Run Plugin tests, commit**

```bash
git commit -m "feat(game): add NPC agent type across Plugin (roster, UI, BT skip)"
```

---

### Task 23: Delegation Flow (CLI)

**Files:**
- Create: `src/domain/tasks/delegation.ts`
- Test: `tests/domain/tasks/delegation.test.ts`

- [ ] **Step 1: Write failing tests**

Test `canDelegate` (checks capability, balance), `createDelegatedTask`, `awardDelegationCut`.

- [ ] **Step 2: Implement**

`canDelegate(ledger, agentName, delegationFee)` checks Coin balance and delegation capability. `createDelegatedTask(taskDef, fromAgent, toAgent)` creates a delegated task. `awardDelegationCut(ledger, assignerName, assigneeReward)` applies x0.2 management cut.

- [ ] **Step 3: Run tests, commit**

```bash
git commit -m "feat(tasks): add delegation flow with fee and management cut"
```

---

### Task 24: Register Merchant + Delegation Commands

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Register shop controller commands**
- [ ] **Step 2: Run full CLI test suite + build**
- [ ] **Step 3: Commit**

```bash
git commit -m "feat: register shop commands, complete Phase C CLI foundation"
```

**Verification gate:**
- [ ] `flowti shop:list` shows default catalog (5 items)
- [ ] `flowti shop:buy --agent=auditor --item=tool-vault-write` fails (insufficient level/coin)

---

## Chunk 4: WorkerManager + Journey Integration (CLI + Plugin) — 12 tasks

**Depends on:** Chunks 2 and 3 complete

### Task 25: Extend WorkerManager with Task Routing (CLI)

**Files:**
- Modify: `src/infrastructure/worker-manager.ts`
- Create: `src/infrastructure/task-router.ts`
- Test: `tests/infrastructure/task-router.test.ts`

- [ ] **Step 1: Write failing tests for task-router**

Test `findEligibleAgent` (scope match, domain match, trust match, capacity headroom, affinity), `routeTask`, `checkCapacity`.

- [ ] **Step 2: Implement task-router.ts**

Pure routing logic. Receives agent list, task definition, trust profiles, economy ledger. Returns ranked list of eligible agents. Capacity limits per level (1-2→1, 3-4→2, 5-6→3, 7-8→4).

```typescript
export interface RoutingContext {
	readonly agents: readonly AgentSummary[];
	readonly trustProfiles: Record<string, AgentTrustProfile>;
	readonly ledger: EconomyLedger;
	readonly activeTasks: Record<string, number>; // agent → count
	readonly standingOrders: Record<string, number>; // agent → count
}

export function findEligibleAgent(task: TaskDefinition, ctx: RoutingContext): string | null;
export function checkCapacity(agentName: string, level: number, activeTasks: number): boolean;
```

- [ ] **Step 3: Wire into WorkerManager**

Extend `handleWorldEvent()` to check standing order index on "file-created"/"file-modified" events. Extend `executeDecision()` with "assign-task" decision type.

- [ ] **Step 4: Run tests, commit**

```bash
git commit -m "feat(infra): add task router with priority-based agent matching"
```

---

### Task 25b: Brain Task Integration (Plugin)

> **Source:** Unimplemented work from 2026-03-19 Agent Task Execution spec. The `taskLocked` flag already exists on `BrainSystem` but `assignWork()` / `releaseWork()` were never built. Without these, agents receive tasks but never visually transition to working on them.

**Files:**
- Modify: `src/game/systems/brain-system.ts`
- Test: `tests/game/systems/brain-system.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
it("assignWork sets taskLocked and transitions to walking-to", () => {
	brain.register("auditor", {});
	brain.assignWork("auditor");
	expect(brain.isTaskLocked("auditor")).toBe(true);
	expect(brain.getState("auditor")).toBe("walking-to");
});

it("releaseWork clears taskLocked and transitions to idle", () => {
	brain.register("auditor", {});
	brain.assignWork("auditor");
	brain.releaseWork("auditor");
	expect(brain.isTaskLocked("auditor")).toBe(false);
	expect(brain.getState("auditor")).toBe("idle");
});

it("BT state transitions are suppressed while taskLocked", () => {
	brain.register("auditor", {});
	brain.assignWork("auditor");
	// Attempting to change state externally should be blocked
	brain.setState("auditor", "wandering");
	expect(brain.getState("auditor")).not.toBe("wandering");
});
```

- [ ] **Step 2: Implement assignWork / releaseWork on BrainSystem**

```typescript
assignWork(name: string): void {
	const entry = this.agents.get(name);
	if (!entry) return;
	entry.taskLocked = true;
	entry.state = "walking-to";
}

releaseWork(name: string): void {
	const entry = this.agents.get(name);
	if (!entry) return;
	entry.taskLocked = false;
	entry.state = "idle";
}

isTaskLocked(name: string): boolean {
	return this.agents.get(name)?.taskLocked ?? false;
}
```

Modify `setState()` to check `taskLocked` — if locked, only allow transitions from `walking-to → working` (agent arrived at workstation). All other transitions are suppressed until `releaseWork()`.

- [ ] **Step 3: Wire into engine — on task-assigned SSE event, call assignWork()**

In `engine-events.ts`, when DashboardStore emits `"task-assigned"`, call `ctx.brain.assignWork(agentName)`. When `"task-completed"` fires, call `ctx.brain.releaseWork(agentName)`.

- [ ] **Step 4: Run tests, commit**

```bash
git commit -m "feat(game): add assignWork/releaseWork to BrainSystem for task execution"
```

---

### Task 25c: Auto-Dequeue Pipeline (CLI)

> **Source:** Unimplemented work from 2026-03-15 Task Queue Orchestrator spec. Tasks currently don't auto-progress through the queue — each must be manually managed.

**Files:**
- Create: `src/infrastructure/task-dequeue.ts`
- Test: `tests/infrastructure/task-dequeue.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
it("dequeues next pending task after cooldown", async () => {
	const queue = createDequeuePipeline({ cooldownMs: 100 });
	queue.onTaskCompleted("auditor", "task-001");
	// Should not dequeue immediately
	expect(queue.getPendingDequeue("auditor")).toBeNull();
	// After cooldown
	await sleep(150);
	expect(queue.getPendingDequeue("auditor")).toBeDefined();
});

it("stops after 3 consecutive failures", () => {
	const queue = createDequeuePipeline({ cooldownMs: 0 });
	queue.recordFailure("auditor");
	queue.recordFailure("auditor");
	queue.recordFailure("auditor");
	expect(queue.isBlocked("auditor")).toBe(true);
});

it("resets failure count on success", () => {
	const queue = createDequeuePipeline({ cooldownMs: 0 });
	queue.recordFailure("auditor");
	queue.recordFailure("auditor");
	queue.onTaskCompleted("auditor", "task-002");
	expect(queue.isBlocked("auditor")).toBe(false);
});
```

- [ ] **Step 2: Implement dequeue pipeline**

```typescript
export interface DequeueConfig {
	readonly cooldownMs: number; // default 10000 (10s)
	readonly maxConsecutiveFailures: number; // default 3
}

export function createDequeuePipeline(config: DequeueConfig): IDequeuePipeline;
```

On `task-completed`, schedule next dequeue after cooldown. On `task-failed`, increment failure counter. After 3 failures, block auto-dequeue for that agent (Director must manually intervene via `worker:resume`).

- [ ] **Step 3: Wire into WorkerManager — call dequeue pipeline on task completion events**
- [ ] **Step 4: Run tests, commit**

```bash
git commit -m "feat(infra): add auto-dequeue pipeline with cooldown and failure circuit breaker"
```

---

### Task 25d: Process Pool for Task Concurrency (CLI)

> **Source:** Unimplemented work from 2026-03-17 Agent World Stability spec. Without concurrency limiting, multiple agents executing vault operations simultaneously will crash the browser.

**Files:**
- Create: `src/infrastructure/task-concurrency.ts`
- Test: `tests/infrastructure/task-concurrency.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
it("allows up to maxConcurrent tasks", () => {
	const pool = createTaskPool({ maxConcurrent: 2 });
	expect(pool.acquire("auditor")).toBe(true);
	expect(pool.acquire("analyst")).toBe(true);
	expect(pool.acquire("designer")).toBe(false); // at capacity
});

it("releases slot on task completion", () => {
	const pool = createTaskPool({ maxConcurrent: 1 });
	pool.acquire("auditor");
	pool.release("auditor");
	expect(pool.acquire("designer")).toBe(true);
});

it("queues agents beyond capacity", () => {
	const pool = createTaskPool({ maxConcurrent: 1 });
	pool.acquire("auditor");
	pool.enqueue("analyst");
	expect(pool.getQueuedAgents()).toEqual(["analyst"]);
	pool.release("auditor");
	expect(pool.dequeueNext()).toBe("analyst");
});
```

- [ ] **Step 2: Implement task concurrency pool**

```typescript
export interface TaskPoolConfig {
	readonly maxConcurrent: number; // default 2
}

export function createTaskPool(config: TaskPoolConfig): ITaskPool;
```

Agents beyond the limit enter `"queued"` state (visible in game world). When a slot opens, next queued agent is promoted.

- [ ] **Step 3: Integrate into WorkerManager's task dispatch path**
- [ ] **Step 4: Run tests, commit**

```bash
git commit -m "feat(infra): add task concurrency pool with maxConcurrent limit"
```

---

### Task 25e: Attribute-Based Task Scoring (CLI)

> **Source:** Pattern from the Numbercruncher's Worker Decision Engine ideation. Agents should evaluate task suitability using their RPG attributes, not just scope/domain matching.

**Files:**
- Create: `src/domain/tasks/task-scoring.ts`
- Test: `tests/domain/tasks/task-scoring.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
it("high INT agent scores better on analysis tasks", () => {
	const scoreA = scoreTaskFit({ int: 16, wis: 10 }, { domain: "analysis" });
	const scoreB = scoreTaskFit({ int: 8, wis: 10 }, { domain: "analysis" });
	expect(scoreA).toBeGreaterThan(scoreB);
});

it("high CHA agent scores better on management tasks", () => {
	const scoreA = scoreTaskFit({ cha: 15 }, { domain: "management" });
	const scoreB = scoreTaskFit({ cha: 7 }, { domain: "management" });
	expect(scoreA).toBeGreaterThan(scoreB);
});

it("low energy applies penalty", () => {
	const scoreHigh = scoreTaskFit({ int: 14 }, { domain: "engineering" }, 80);
	const scoreLow = scoreTaskFit({ int: 14 }, { domain: "engineering" }, 20);
	expect(scoreLow).toBeLessThan(scoreHigh * 0.6);
});
```

- [ ] **Step 2: Implement scoring function**

```typescript
const DOMAIN_ATTRIBUTE_MAP: Record<string, keyof AgentAttributes> = {
	engineering: "int",
	analysis: "int",
	design: "cha",
	product: "wis",
	management: "cha",
	quality: "wis",
	operations: "con",
	orchestration: "cha",
};

export function scoreTaskFit(
	attributes: Partial<AgentAttributes>,
	task: { domain?: string },
	energy?: number,
): number {
	const primaryAttr = task.domain ? DOMAIN_ATTRIBUTE_MAP[task.domain] : undefined;
	let score = 50; // baseline
	if (primaryAttr && attributes[primaryAttr]) {
		score += (attributes[primaryAttr]! - 10) * 5; // each point above 10 adds 5
	}
	if (energy !== undefined && energy < 30) {
		score *= 0.5; // 50% penalty for exhausted agents
	}
	return Math.max(0, Math.min(100, score));
}
```

- [ ] **Step 3: Integrate into `findEligibleAgent()` in task-router.ts**

Add scoring as the 6th routing priority factor (after affinity). Score is used as a tiebreaker when multiple agents match equally on scope/domain/trust/capacity/affinity.

- [ ] **Step 4: Run tests, commit**

```bash
git commit -m "feat(tasks): add attribute-based task scoring using RPG stats"
```

---

### Task 26: Failure Handling + Health Monitor (CLI)

**Files:**
- Create: `src/infrastructure/task-health.ts`
- Test: `tests/infrastructure/task-health.test.ts`

- [ ] **Step 1: Write failing tests**

Test `recordFailure` (3 strikes suspends), `checkStaleTask` (5 min threshold), `autoRecover`.

- [ ] **Step 2: Implement**

Track per-agent failure counts. After 3 consecutive failures for same task type, suspend agent from that type for 1 cycle. Health check every 60s detects stale in-progress tasks. Process timeout reaping: kill agent processes exceeding configurable `processTimeoutMs` (default 300000 / 5 min).

- [ ] **Step 3: Add conversation DOM cap (Plugin)**

In `panel-talk.ts`, cap rendered conversation turns to 50 most recent. Prevents memory bloat during long sessions. Add a "Show earlier..." link to load more on demand.

- [ ] **Step 4: Run tests, commit**

```bash
git commit -m "feat(infra): add task health monitoring, timeout reaping, and DOM cap"
```

---

### Task 27: Worker Controller (CLI)

**Files:**
- Create: `src/controller/worker.controller.ts`
- Create: `src/ui/worker-display.ts`
- Test: `tests/controller/worker.controller.test.ts`

Commands: `worker:status`, `worker:queue`, `worker:reassign`, `worker:pause`, `worker:resume`.

- [ ] **Step 1-4: Renderers, controller, tests, commit**

```bash
git commit -m "feat(worker): add worker status and queue CLI commands"
```

---

### Task 28: Debug Controller (CLI)

**Files:**
- Create: `src/controller/debug.controller.ts`
- Create: `src/ui/debug-display.ts`
- Test: `tests/controller/debug.controller.test.ts`

Commands: `debug:set` (xp, coin, level), `debug:trust` (force trust level), `debug:needs` (set needs), `debug:bt` (force state), `debug:unlock` (grant capability).

All debug mutations logged in economy ledger with `type: "debug"`.

- [ ] **Step 1-4: Renderers, controller, tests, commit**

```bash
git commit -m "feat(debug): add debug CLI commands for economy/trust/needs"
```

---

### Task 29: Journey Integration — Executor Checkpoint (Plugin)

**Files:**
- Modify: `src/domain/journeyExecutor/JourneyExecutorService.ts`
- Create: `src/domain/journeyExecutor/journey-checkpoint-persistence.ts`
- Test: `tests/domain/journeyExecutor/journey-checkpoint.test.ts`

- [ ] **Step 1: Write failing tests for checkpoint save/resume**

Test: executor saves checkpoint after each step, pauses on review-required step, resumes from checkpoint on approval.

- [ ] **Step 2: Add checkpoint persistence**

Write checkpoint JSON to `.flowti/var/staging/{task-id}/journey-checkpoint.json` after each step. On pause, set status to "paused-for-review". On resume, read checkpoint and continue from `currentStep`.

- [ ] **Step 3: Extend JourneyExecutorService with pause/resume**

Add `pause()` and `resume(checkpoint)` methods. `pause()` stores current step index and returns. `resume()` loads checkpoint and calls `executeFromStep(step)`.

- [ ] **Step 4: Run tests, commit**

```bash
git commit -m "feat(journey): add checkpoint persistence for review-gated pauses"
```

---

### Task 30: Journey BT State (Plugin)

**Files:**
- Modify: `src/game/brain/behavior-tree/bt-agent.ts`
- Modify: `src/game/brain/behavior-tree/bt-factory.ts`

- [ ] **Step 1: Add `journey-execute` BT state**

New condition `[HasJourneyTask]` checks if agent has an assigned journey-type task. New action `[ExecuteJourney]` enters journey execution mode — loads journey definition, iterates steps through existing executor, reports completion.

- [ ] **Step 2: Insert in master MDSL before WorkCycle**

```
branch [JourneyExecution]  // NEW — between NeedsMorale and WorkCycle
```

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(game): add journey-execute BT state for agent journey capability"
```

**Verification gate:**
- [ ] CLI: `npm test` — all pass
- [ ] Plugin: `npm test` — all pass
- [ ] `flowti worker:status` shows all agents with capacity
- [ ] `flowti debug:set --agent=auditor --xp=1000 --coin=500` works

---

## Chunk 5: Visual Progression + Debug Panel (Plugin) — 10 tasks

**Depends on:** Chunks 1B, 3, 4 complete

### Task 31: Economy Data in DashboardStore (Plugin)

**Files:**
- Modify: `src/game/store/dashboard-store.ts`
- Modify: `src/game/data/types.ts`

- [ ] **Step 1: Extend DashboardAgent with economy fields**

```typescript
// In types.ts, extend DashboardAgent:
level?: number;
coin?: number;
tokens?: number;
trustTier?: "supervised" | "trusted" | "autonomous";
capabilities?: string[];
```

- [ ] **Step 2: Add economy-related store methods**

`setAgentEconomy(name, data)`, `getAgentEconomy(name)`. Fed via SSE from CLI's worldState broadcast.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(game): add economy data to DashboardStore"
```

---

### Task 32: Pet Utility Roles (Plugin)

**Files:**
- Create: `src/game/systems/pet-utility.ts`
- Modify: `src/game/brain/behavior-tree/pet-bt.ts`
- Modify: `src/game/data/pet-definitions.ts`
- Test: `tests/game/systems/pet-utility.test.ts`

- [ ] **Step 1: Define utility roles per pet type**

```typescript
export type PetUtilityRole = "scout" | "fetch" | "audit" | "echo" | "triage";

export interface PetUtility {
	readonly role: PetUtilityRole;
	readonly utilityScore: number;
	readonly lastAction?: string;
}

export const PET_ROLES: Record<string, PetUtilityRole> = {
	cat: "scout",    // spots untagged/orphan notes
	dog: "fetch",    // retrieves related notes
	owl: "audit",    // watches for stale content
	parrot: "echo",  // re-surfaces past events
	fox: "triage",   // prioritizes inbox
};
```

- [ ] **Step 2: Add utility actions to pet BT**

Each role adds a periodic BT action: `[PatrolVault]` (cat), `[FetchRelated]` (dog), `[AuditStale]` (owl), etc. These emit proposed tasks for nearby agents.

- [ ] **Step 3: Add bonding logic**

Track which agent a pet spends the most time near. Bonded pet: follows between rooms, +5 morale per cycle, preferential utility.

- [ ] **Step 4: Run tests, commit**

```bash
git commit -m "feat(game): add pet utility roles with bonding system"
```

---

### Task 33: Pet Affection + Progression (Plugin)

**Files:**
- Modify: `src/game/actors/pet-actor.ts`
- Modify: `src/game/data/pet-definitions.ts`

- [ ] **Step 1: Add affection field to PetActor**

`affection: 0-100`, increases with Director interaction (pet/feed/play), decays with neglect. Milestones at 25/50/75/100 unlock cosmetic slots.

- [ ] **Step 2: Add Director interaction radial menu**

On pet click: Pet (+5 affection), Feed (restore hunger, costs Coin), Play (boost morale), Command (assign patrol folder), Stats (show panel).

- [ ] **Step 3: Add utility score tracking**

Count useful findings surfaced by each pet.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(game): add pet affection, progression, and Director interaction"
```

---

### Task 34: Visual Level Progression (Plugin)

**Files:**
- Modify: `src/game/actors/agent-actor.ts`
- Modify: `src/game/systems/particle-system.ts`
- Create: `src/game/data/progression-visuals.ts`

- [ ] **Step 1: Define visual tiers**

```typescript
export interface LevelVisual {
	readonly levelRange: [number, number];
	readonly glowColor?: string;
	readonly glowOpacity?: number;
	readonly auraParticles?: boolean;
	readonly walkSpeedBoost?: number;
}

export const LEVEL_VISUALS: readonly LevelVisual[] = [
	{ levelRange: [1, 2] },
	{ levelRange: [3, 4], glowColor: "domain", glowOpacity: 0.15 },
	{ levelRange: [5, 6], glowColor: "domain", glowOpacity: 0.3, walkSpeedBoost: 0.05 },
	{ levelRange: [7, 8], glowColor: "domain", glowOpacity: 0.4, auraParticles: true, walkSpeedBoost: 0.1 },
];
```

- [ ] **Step 2: Apply visual tier in agent-actor.ts**

Read level from DashboardStore, apply glow overlay and particle aura based on tier.

- [ ] **Step 3: Add level-up particle burst**

On level change detected: golden particle burst (firework preset), level-up bubble, nearby agent celebration.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(game): add visual level progression with glow and particles"
```

---

### Task 35: Economy Visual Cues (Plugin)

**Files:**
- Modify: `src/game/engine-events.ts`
- Modify: `src/game/systems/bubble-system.ts`

- [ ] **Step 1: Add task reward floating text**

On "task-completed" event: spawn "+50 XP / +25 Coin" floating text above agent (fades over 2s).

- [ ] **Step 2: Add trust visual indicators**

Review pending: pulsing clipboard icon. Approved: green checkmark flash. Rejected: red X flash. Trust promoted: brief fanfare.

- [ ] **Step 3: Add token spend pulse**

Subtle blue pulse when agent uses LLM tokens. Low-balance thought bubble when below 10%.

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(game): add economy and trust visual cues"
```

---

### Task 36: Merchant Stall Actor (Plugin)

**Files:**
- Create: `src/game/actors/merchant-stall.ts`
- Modify: `src/game/engine-objects.ts`

- [ ] **Step 1: Create MerchantStall interactable**

Fixed location in hub room. NPC sprite (Ninja Adventure shopkeeper). On agent visit: dialogue plays, purchase animation (coin particles). On Director click: opens shop overlay panel.

- [ ] **Step 2: Register in engine-objects.ts and EngineContext**

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(game): add Merchant stall actor in hub room"
```

---

### Task 37: Debug Tab in Agent Panel (Plugin)

**Files:**
- Create: `src/game/ui/panel-debug.ts`
- Modify: `src/game/ui/agent-panel.ts`
- Modify: `src/game/store/dashboard-store.ts`

- [ ] **Step 1: Create debug panel component**

Sections: Stats Override (Level/XP/Coin/Tokens +/-/SET), Attributes (+/-), Needs Override (FILL/DRAIN/SET per need), Trust Quick-Toggle (AUTO/REVIEW/MANUAL per operation), Capabilities (checkboxes), Economy Cheats (+500 Coin, +10000 Tokens, Level Up, Bankrupt), BT Debug (force state, pause/step/resume).

- [ ] **Step 2: Wire into agent-panel.ts**

Add "debug" to `TabName`. Show Debug tab only in Director mode. Route to `panel-debug` component.

- [ ] **Step 3: Add NPC debug variant**

For NPCs: shop tuning (edit prices, force restock), dialogue override, location move, economy view (transaction history).

- [ ] **Step 4: Commit**

```bash
git commit -m "feat(game): add Debug tab in agent panel for admin controls"
```

---

### Task 38: Standing Order Visuals (Plugin)

**Files:**
- Modify: `src/game/actors/agent-actor.ts`

- [ ] **Step 1: Add standing order indicator**

When agent is executing a standing order: subtle loop-arrows icon near name. Distinguishes routine work from one-off tasks.

- [ ] **Step 2: Add capability unlock animation**

On purchase from Merchant: tool icon briefly appears above agent (quill for vault-write, chain for delegation), inspection animation.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(game): add standing order and capability unlock visuals"
```

---

### Task 39: Economy Stats in Info Panel (Plugin)

**Files:**
- Modify: `src/game/ui/panel-info.ts`

- [ ] **Step 1: Add economy section to info tab**

Below the needs bars (added in Chunk 1B), add economy stats: Level badge with title, XP progress bar to next level, Coin balance, Token balance, Trust tier badge.

- [ ] **Step 2: Add capability badges**

Show purchased capabilities as small icons/tags.

- [ ] **Step 3: Commit**

```bash
git commit -m "feat(game): add economy stats and capability badges to info panel"
```

---

### Task 40: Final Integration + Build

- [ ] **Step 1: Run full CLI test suite**

`cd "01 - Projects/Flowti CLI" && npm test`

- [ ] **Step 2: Run full Plugin test suite**

`cd "01 - Projects/Flowti Plugin" && npm test`

- [ ] **Step 3: Build both projects**

```bash
cd "01 - Projects/Flowti CLI" && node configs/esbuild.config.mjs
cd "01 - Projects/Flowti Plugin" && npm run build
```

- [ ] **Step 4: Manual verification**

- [ ] Agents show 6 needs bars + economy stats in info panel
- [ ] Agents seek food/drink stations when hungry/thirsty
- [ ] Pet steal/share mechanic works at stations
- [ ] `flowti task:create --title="Test" --assignee=auditor` creates a task
- [ ] `flowti economy:grant --agent=auditor --coin=500 --tokens=5000` credits account
- [ ] `flowti shop:list` shows catalog
- [ ] `flowti trust:show --agent=auditor` shows supervised profile
- [ ] `flowti worker:status` shows capacity
- [ ] `flowti debug:set --agent=auditor --xp=300` triggers Level 3
- [ ] Level-up particle burst visible in game world
- [ ] Debug tab appears in agent panel with admin controls
- [ ] NPC Merchant visible in hub room
- [ ] Standing order loop icon visible during routine work

---

## Summary

| Chunk | Tasks | Scope | Project |
|-------|-------|-------|---------|
| 1A: Economy Foundation | 10 | Task store, economy ledger, leveling, CLI commands | CLI |
| 1B: Hunger/Thirst | 18 | Needs extension, stations, BT, sprites, UI bars | Plugin |
| 2: Trust + Vault Ops | 8 | Trust manager, staging area, standing orders, journey checkpoints | CLI |
| 3: Merchant + NPC | 6 | NPC type, catalog, shop, delegation | CLI + Plugin |
| 4: WorkerManager + Journey | 10 | Task router, brain integration, auto-dequeue, process pool, attribute scoring, health monitor, journey BT, worker/debug commands | CLI + Plugin |
| 5: Visual + Debug | 10 | Level progression, economy cues, merchant stall, debug panel, pet utility | Plugin |
| **Total** | **62 tasks** | | |
