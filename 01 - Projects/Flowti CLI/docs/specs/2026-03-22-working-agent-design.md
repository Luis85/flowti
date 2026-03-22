# The Working Agent — Design Spec

> **Date:** 2026-03-22
> **Status:** Draft
> **Goal:** Close the execution-to-reward gap so agents earn real XP/Coin from task completion, with live visual feedback in the game world.

---

## Context

The Task & Economy Engine increment built all data layers: task CRUD (7-state lifecycle), economy ledger (XP/Coin/Tokens), leveling (8 tiers), trust manager (7 vault ops × 3 tiers), merchant catalog, task routing, and visual progression. The Plugin has UI components for all of these — `panel-economy.ts`, floating reward text, level-up celebrations, visual glow/aura.

**The gap:** These layers aren't connected. When a CLI subprocess completes a task, `handleDone()` saves output but never credits XP/Coin, never fires the `level-up` event, and never updates the Plugin's economy state. The UI renders empty because no economy data reaches it.

**Architecture reminder:** CLI↔Plugin communication is **file-watch + subprocess JSONL**. No server, no SSE. CLI writes `world-state.json` (debounced 1s); Plugin watches it. Agent work runs as CLI subprocesses (`node .flowti/bin/main.mjs agent:start`) with JSONL event streams back to the Plugin.

---

## Scope Items

### 1. Reward Loop Completion

**Problem:** `handleDone()` in `dashboard-store.ts` dispatches `task-completed` without economy data. The floating "+XP +Coin" text listener in `engine-events-store.ts` exists but receives no numbers. The `level-up` event listener exists but is never dispatched.

**Solution:**

#### 1a. New CLI command: `economy:reward`

A new command that encapsulates the full reward flow, keeping CLI as data authority:

```
flowti economy:reward --agent=<name> --task=<id> [--xp=50] [--coin=25] [--trust-tier=review]
```

Behavior:
1. Read task definition from task store (get base reward, trust tier)
2. Call `calculateReward()` with multipliers (trust tier, first completion, standing order, delegation)
3. Call `creditReward()` to update economy ledger — returns `{ ledger, reward: { xp, coin, leveledUp, newLevel? } }`
4. If `leveledUp`, call `titleForLevel(newLevel)` from `leveling.ts` to get `newTitle`
5. Call `appendTransaction()` to log the transaction
6. Derive `successCount` for auto-promotion: call `countCompletedByAgent(deps, vaultRoot, agentName)` — a new helper in `task-store.ts` that counts tasks with `status === "completed"` and matching `assignee`. Uses the standard `(deps, vaultRoot)` signature pattern.
7. Call `checkAutoPromotion(profile, operation, agentLevel, successCount)` — if `shouldPromote`, call `promote()` and `saveTrustProfile()`
8. Return JSON result:

```json
{
  "agent": "auditor",
  "xp": 60,
  "coin": 30,
  "totalXp": 360,
  "totalCoin": 180,
  "level": 3,
  "leveledUp": true,
  "newLevel": 3,
  "newTitle": "Journeyman",
  "trustPromoted": { "agentName": "auditor", "op": "vault-tag", "from": "review", "to": "auto" }
}
```

Falls back to `--xp`/`--coin` flag values if task not found in store (supports ad-hoc rewards).

**New helper:** `countCompletedByAgent(deps, vaultRoot, agentName)` in `src/domain/tasks/task-store.ts` — filters completed tasks by assignee. Used by `economy:reward` to supply `successCount` to `checkAutoPromotion()`.

#### 1b. Wire `handleDone()` to call `economy:reward`

In `dashboard-store.ts`, after the subprocess reports `"done"`:

1. Call CLI: `flowti economy:reward --agent=<name> --task=<id> --format=json`
2. Parse the JSON result
3. Dispatch `task-completed` with `{ agentName, xp, coin }` in event detail
4. If `leveledUp === true`, dispatch `level-up` with `{ agentName, level: newLevel, title: newTitle }`
5. If `trustPromoted`, dispatch `trust-promoted` with `{ agentName, op, from, to }` — the `agentName` field is required by the existing `engine-events-store.ts` listener
6. Call `setAgentEconomy()` to update store with new balances: `{ level, coin, tokens, xp: totalXp }` — note: `xp` must be added to the `setAgentEconomy` parameter type (see section 2c)

The existing `engine-events-store.ts` listeners handle everything else automatically:
- Floating "+60 XP / +30 Coin" text (already wired)
- Level-up celebration bubble + nearby agent congrats (already wired)
- Trust-promoted particle sparkle (already wired)
- Visual glow/aura update via `actor.setLevel()` (already wired)

#### 1c. Fallback for tasks without store entries

Some tasks may be ad-hoc (not created via `task:create`). When `economy:reward` can't find the task in the store, use default reward `{ xp: 50, coin: 25 }` with the flags provided. This ensures every completed task earns something.

**Files changed:**
- Create: `src/controller/economy-reward.ts` (or extend `economy.controller.ts`)
- Create: `src/domain/tasks/task-store.ts` — add `countCompletedByAgent()` helper
- Modify: `01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts` — `handleDone()`
- Tests: reward command tests, countCompletedByAgent tests, handleDone integration

---

### 2. Economy State Sync at Boot

**Problem:** When the game boots, `panel-economy.ts` renders empty because `DashboardAgent` has no economy data populated. The economy ledger exists on disk but nobody reads it into Plugin state.

**Solution:**

#### 2a. Enrich agents at boot

In `cli-data-provider.ts` (or the engine bootstrap), after loading the agent roster:

1. Call CLI: `flowti economy:balance --agent=<name> --format=json` for each agent
2. Or read `.flowti/var/economy.json` directly (simpler, avoids N subprocess spawns)
3. Merge `{ level, coin, tokens, xp }` into each `DashboardAgent` via `store.setAgentEconomy()`

**Recommended:** Read `economy.json` directly at boot. This is a one-time read, not a live sync — acceptable for the Plugin to read CLI's data file at startup. The live sync happens through the reward loop (scope item 1) on each task completion.

#### 2b. Refresh after reward

After `handleDone()` calls `economy:reward` and gets the result, call `setAgentEconomy()` with the new balances. This keeps the Plugin's economy state current without re-reading the file.

#### 2c. Add `xp` to `setAgentEconomy` parameter type

`setAgentEconomy()` currently accepts `{ level?, coin?, tokens?, trustTier?, capabilities? }` but no `xp` field. Add `xp?: number` to the parameter interface and the `DashboardAgent` type so the reward loop can update XP in Plugin state. Without this, the XP progress bar in `panel-economy.ts` would only update on reboot.

#### 2d. Fix offline progress to persist earnings to CLI ledger

The offline progress system in `engine-lifecycle.ts` (lines 230-253) calls `store.setAgentEconomy()` directly — mutating Plugin state without writing back to `economy.json`. This creates a divergence: the next `economy:reward` CLI call would read stale balances from `economy.json`.

Fix: After calculating offline results, call `flowti economy:reward --agent=<name> --xp=<n> --coin=<n>` for each agent with earnings. The `economy:reward` command (scope item 1a) supports ad-hoc rewards via `--xp`/`--coin` flags when no task is found in the store (section 1c). This writes to the CLI ledger via `creditReward()` before the Plugin updates its own state, keeping both in sync. Do NOT use `economy:grant` for this — it only handles coin/tokens, not XP.

**Files changed:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-lifecycle.ts` — read economy at boot, fix offline grant
- Modify: `01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts` — add xp to setAgentEconomy, refresh after reward
- Modify: `01 - Projects/Flowti Plugin/src/game/data/types.ts` — add xp to DashboardAgent

---

### 3. Debug Tab UI

**Problem:** Testing the reward loop without visual debug controls requires CLI commands. A Plugin-side debug tab enables rapid iteration.

**Solution:**

The `panel-debug.ts` Lit component already exists with stat override, needs override, trust toggle, and economy cheat sections. It dispatches custom events (`debug-stat-adjust`, `debug-economy-cheat`, etc.).

What's missing is **wiring these events to CLI commands**. Add event listeners in `engine-events-store.ts` or a new `engine-events-debug.ts` that:

1. Listen for `debug-economy-cheat` → call `flowti debug:set --agent=<name> --xp=<n> --coin=<n>`
2. Listen for `debug-stat-adjust` → call `flowti debug:set` with the appropriate flag
3. Listen for `debug-trust-mode` → call `flowti debug:trust --agent=<name> --op=<op> --level=<level>`
4. After each CLI call, refresh economy state via `setAgentEconomy()`

Note: `debug:set`, `debug:trust`, and `debug:needs` are `projectFree` commands in the CLI (registered in `register-builtin-domains.ts`) — no `--project` flag needed when calling from the Plugin.

**Files changed:**
- Create: `01 - Projects/Flowti Plugin/src/game/engine-events-debug.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/engine.ts` — wire debug events
- Tests: debug event handler tests

---

### 4. Agent Food Preferences

**Problem:** All agents treat food/drink stations equally. The quirk system defines personality traits (`coffee-addict`, `snacker`, `health-nut`) but these don't influence station choice.

**Solution:**

#### 4a. Station preference map

Create a mapping from quirk → preferred station:

```typescript
const FOOD_PREFERENCES: Record<string, string> = {
	"coffee-addict": "CoffeeMachine",
	"snacker": "SnackTable",
	"health-nut": "WaterCooler",
	"social-butterfly": "SnackTable",  // likes to eat with others
};
```

#### 4b. BT condition: `PreferredStationAvailable`

A new BT condition that checks if the agent's preferred station is unoccupied. If yes, the BT action targets that station. If no (or no preference), falls back to the existing nearest-available logic.

This is a small change to `needs-hunger.ts` and `needs-thirst.ts` subtrees — add a selector branch that tries the preferred station first, then falls back to the existing `SeekFoodStation`/`SeekDrinkStation`.

**Files changed:**
- Create: `01 - Projects/Flowti Plugin/src/game/data/food-preferences.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/subtrees/needs-hunger.ts`
- Modify: `01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/subtrees/needs-thirst.ts`
- Tests: preference mapping tests, BT condition tests

---

### 5. GDD Refresh

**Problem:** The Game Design Document's Systems Inventory is stale. Merchant is listed as "Planned" when it's stable. Several "In Progress" systems are now complete at the data layer.

**Solution:**

Update `01 - Projects/Flowti Plugin/docs/Agent World - Game Design Document.md`:

1. Move completed systems to "Implemented (Stable)" with accurate descriptions
2. Update "Current Increment" to reflect the new "Working Agent" scope
3. Replace "SSE bridge" references with "file-watch + subprocess JSONL"
4. Add the economy data flow diagram (CLI → economy.json → Plugin boot read → live refresh via reward loop)
5. Update the "Future" roadmap to reflect what's actually next after this increment

**Files changed:**
- Modify: `01 - Projects/Flowti Plugin/docs/Agent World - Game Design Document.md`

---

## What This Increment Does NOT Include

- **New vault operation types** — agents already execute vault ops via LLM tool calls. No new ops needed.
- **SSE server** — not needed. File-watch + subprocess is the architecture.
- **WorkerManager live routing** — task routing exists but wiring it to the live workload is a follow-up increment.
- **Journey executor integration** — checkpoint format exists, wiring is deferred.
- **Pet utility execution** — roles and bonding exist, vault-aware pet actions are deferred.

---

## Success Criteria

1. Agent completes a task → floating "+XP +Coin" appears above agent with real numbers
2. Agent levels up → golden particle burst, level-up bubble, nearby agent celebration
3. Agent panel shows current Level, Coin, Tokens, Trust Tier on boot
4. Debug tab can grant XP/Coin and see immediate visual update
5. Coffee-addict agent preferentially seeks CoffeeMachine when hungry
6. GDD accurately reflects current system state

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| `economy:reward` subprocess adds latency to task completion | Keep it async — show "task done" immediately, then show reward text when CLI responds |
| Reading economy.json at boot with many agents is slow | Economy.json is a single file with all accounts — one read, not N reads |
| Debug tab could corrupt economy state | All debug mutations logged with `type: "debug"` in transaction log — auditable |
| Food preferences create station congestion | Fallback to nearest-available when preferred station occupied |

---

## Dependency Order

```
Scope 1 (Reward Loop) ──┬── foundation for live economy updates
                        │
Scope 2 (Boot Sync) ────┘── parallel with 1 (reads existing economy.json, no new pattern needed)
  ↓
Scope 3 (Debug Tab) ────── needs boot sync working to verify visuals

Scope 4 (Food Prefs) ───── fully independent, can parallel with anything

Scope 5 (GDD Refresh) ──── fully independent, can parallel with anything
```

Note: Scopes 1 and 2 share zero files (1 touches CLI controller + Plugin handleDone; 2 touches Plugin engine-lifecycle + types). They can execute in parallel. Scope 2d (offline grant fix) requires the `economy:grant` CLI command which already exists.
