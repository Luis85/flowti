# Quest Economy — Design Spec

> **Increment:** Quest Economy
> **Date:** 2026-04-04
> **Status:** Draft
> **Depends on:** Harden & Deepen (complete)

## 1. Goal

Facilities autonomously generate quests when they need help. Agents claim, pursue, and complete quests for gold and positive memories. Facilities that run dry abandon and generate repair quests. Agents go inside facilities when working. The economy self-heals through emergent quest behavior.

No Director involvement — pure autonomous simulation deepening.

## 2. Workstreams

| # | Workstream | Scope |
|---|-----------|-------|
| 1 | Surgical debt fixes (I1, I2, I4) | Typed attribute accessor, maxCharges from ItemSchema, EconomyHealthMetrics |
| 2 | Facility abandonment | New abandonment-system, `'abandoned'` status, facility-system guard, restoration on fund recovery |
| 3 | Quest system | Schema, QuestBoardComponent, generation system, evaluation system, 9 BT methods |
| 4 | Facility interior | insideFacility flag, perception filtering, sprite hiding |

## 3. Quest Data Model

### 3.1 Quest Schema (`src/domain/schemas/quest-schema.ts`)

```typescript
export const QUEST_TYPES = ['supply', 'restock', 'repair'] as const;
export const QUEST_STATES = ['open', 'claimed', 'completed', 'expired'] as const;

export const QuestSchema = z.object({
  id: z.string(),
  type: z.enum(QUEST_TYPES),
  facilityId: z.string(),
  itemId: z.string().nullable(),
  quantity: z.number().default(1),
  reward: z.number(),
  rewardXp: z.number().default(5),
  state: z.enum(QUEST_STATES).default('open'),
  claimedBy: z.string().nullable().default(null),
  createdTick: z.number(),
  expiryTicks: z.number(),
});

export type Quest = z.infer<typeof QuestSchema>;

/** Runtime-only extension — not persisted. Used by QuestBoardComponent. */
export type QuestRuntime = Quest & { repairProgress: number };
```

### 3.2 Quest Types

**supply** — Facility needs input material (e.g., bakery needs wheat). Agent picks up from source, delivers to destination. Reuses existing cargo/delivery actions. Reward = item base value * quantity * `supply_reward_multiplier`.

**restock** — Market stock quantity below `restock_threshold`. Agent buys from source and delivers. Reward = `restock_reward` flat amount.

**repair** — Facility status is `'abandoned'`. Agent goes there and works for `repair_ticks` ticks to restore it. No cargo involved. On completion, facility gets `repair_fund_injection` gold from treasury and status returns to `'idle'`. Reward = `repair_reward`.

### 3.3 QuestBoardComponent (`src/infrastructure/components/quest-board-component.ts`)

Lives on the world entity. Holds all active quests using the runtime type.

```typescript
export interface QuestBoardState {
  quests: QuestRuntime[];
}
```

Simple array. At current scale (10-20 facilities), linear scan is sufficient.

### 3.4 Ledger Integration

Add `'quest_reward'` to the `LedgerEntry.type` union in `component-data.ts` so quest reward transfers appear in the daily report and ledger audit trail.

## 4. Facility Abandonment

### 4.1 Status Change

Add `'abandoned'` to FacilityState status union in `component-data.ts`:

```typescript
status: 'idle' | 'producing' | 'auto' | 'abandoned';
```

Also update `FacilityTickResult.status` in `src/domain/systems/facility.ts` to include `'abandoned'` so TypeScript accepts the assignment.

### 4.2 Facility System Guard

Add an early-exit guard in `processFacilityTick` (infrastructure layer) that skips abandoned facilities:

```typescript
if (facility.state.status === 'abandoned') continue;
```

This prevents the facility-system (priority 6) from overwriting `'abandoned'` back to `'idle'` each tick. Consistent with the existing `if (loc.production === null) continue` guard pattern.

### 4.3 Abandonment System (`src/infrastructure/systems/abandonment-system.ts`)

**Priority:** `SystemPriority.ABANDONMENT` (18.8, already reserved)

Runs every tick. For each facility:

1. If `fund <= 0` AND `workerId === null` AND `status !== 'abandoned'` → set status to `'abandoned'`, emit `FacilityAbandoned` event with `{ facilityId, lastWorker }`.
2. If `status === 'abandoned'` AND `fund > 0` → set status to `'idle'`, emit `FacilityRestored` event with `{ facilityId, newFund }`.

**Priority rationale:** Runs late (18.8) so all economic systems (wages, subsidies, stipends) have had a chance to adjust funds first. The facility-system guard (§4.2) prevents status overwrite on subsequent ticks.

### 4.4 Subsidy Interaction

Abandoned facilities should NOT receive subsidies — the subsidy-system already checks `facility.state.fund >= threshold`, and an abandoned facility with fund=0 would qualify for subsidy. Add a guard in subsidy-system: skip facilities with `status === 'abandoned'`. Repair quests are the intended recovery path, not subsidies.

### 4.5 Emergence Chain

Treasury runs dry → subsidies can't cover → facility fund hits 0 → worker leaves (no wage) → facility abandons → repair quest generated → agent claims quest → works at facility → facility restored → production resumes → economy self-heals.

## 5. Quest Generation

### 5.1 Quest Generation System (`src/infrastructure/systems/quest-generation-system.ts`)

**Priority:** 7.1 (right after `QUEST_EVALUATION` at 7)

Runs at day boundary (checks `time.state.dayBoundaryThisTick`). For each facility, evaluates three conditions:

**Supply quest** — Facility has `production.input` and input stock is below required quantity. Generates: "deliver N of item X to this facility." Reward = item base value * quantity * `config.quests.supply_reward_multiplier`.

**Restock quest** — Facility is a market and total stock quantity is below `config.quests.restock_threshold`. Generates: "bring food/trade goods to this market." Reward = `config.quests.restock_reward`.

**Repair quest** — Facility status is `'abandoned'`. Generates: "work at this facility for N ticks to restore it." Reward = `config.quests.repair_reward`.

**Guards:**
- Max 1 quest per facility (skip if facility already has an open/claimed quest on the board).
- Max total open quests: `config.quests.max_open` (default 5).
- Expired quests cleaned up at the start of the same pass (state → `'expired'`, removed from board).

**Quest IDs:** Generated as `q-{facilityId}-{tick}` for uniqueness.

### 5.2 Quest Evaluation System (`src/infrastructure/systems/quest-evaluation-system.ts`)

**Priority:** `SystemPriority.QUEST_EVALUATION` (7)

Runs every tick:
1. Expire quests where `currentTick - createdTick > expiryTicks` and state is `'open'`. Emit `QuestExpired`.
2. For repair quests in `'claimed'` state: if the claiming agent has `btAction === 'repair'` and is at the quest facility, increment `repairProgress`. When progress reaches `config.quests.repair_ticks`, the quest is ready for the agent's `CompleteQuest` action.

Repair progress is tracked on the `QuestRuntime` object (§3.1) as `repairProgress: number`, initialized to 0 when the quest is created.

### 5.3 Metrics Timing

The daily-report-system runs at priority 0.84 (early in the tick). `questsCompletedThisDay` reflects the *previous* day's completions, since quest evaluation and completion happen later in the tick. This is consistent with how other daily metrics (wages, sales) are computed — they summarize the day that just ended.

## 6. Agent Quest Behavior (BT Integration)

### 6.1 New Working Memory Fields (`bt-working-memory.ts`)

```typescript
activeQuest: QuestRuntime | null;
cachedAvailableQuest: QuestRuntime | null;
insideFacility: boolean;
```

All initialized to `null`, `null`, `false`.

### 6.2 Quest Board Access

Add a `getQuestBoard` accessor to `BehaviorAgentDeps`:

```typescript
getQuestBoard?: () => QuestBoardState;
```

Optional so existing tests don't break. Passed through `createConditions` and `createActions` signatures. In game-view.ts, wired as `() => worldEntity.get(QuestBoardComponent).state`.

### 6.3 New Conditions (`bt-conditions.ts`)

**HasQuest()** — Returns `memory.activeQuest !== null`.

**QuestAvailable()** — Reads quest board via `deps.getQuestBoard()`. Scans for open quests. Scores each by `reward / estimatedDistance` where distance is calculated from agent position to quest facility. Filters to quests whose required item the agent can source from `memory.knownLocations`. Caches best quest in `memory.cachedAvailableQuest`. Returns true if a viable quest was found.

**Known limitation:** For supply quests, scoring uses distance to quest facility only, not total trip distance including source pickup. Acceptable for v1.

**QuestAtFacility()** — Agent's `atLocation` matches `memory.activeQuest.facilityId`.

**QuestCargoReady()** — For supply/restock quests: agent inventory contains the required `itemId` with sufficient `quantity`. For repair quests: always true (no cargo needed).

### 6.4 New Actions (`bt-actions.ts`)

**ClaimQuest()** — Must re-read quest state from QuestBoardComponent at claim time (not trust the cached value) to handle the case where another agent claimed it in the same tick. Sets quest state to `'claimed'`, quest `claimedBy` to agent ID. Stores quest in `memory.activeQuest`. Clears `memory.cachedAvailableQuest`. Sets `btAction = 'claim_quest'`. Emits `QuestClaimed` event with `{ agentId, questId, questType, facilityId }`. Returns SUCCEEDED if claimed, FAILED if quest was already claimed.

**SeekQuestFacility()** — Sets `movementTarget` to the quest's `facilityId`. Sets `btAction = 'seek_quest'`. Returns RUNNING if not there yet, SUCCEEDED if at the facility.

**WorkRepair()** — For repair quests only. Sets `btAction = 'repair'`. The quest-evaluation-system tracks progress externally. Returns RUNNING (the BT re-evaluates each tick; when progress is complete, `CompleteQuest` takes over).

**CompleteQuest()** — Checks completion conditions based on quest type:
- **supply/restock:** Agent has required item in inventory → remove item from inventory, add to facility stock.
- **repair:** `activeQuest.repairProgress >= config.quests.repair_ticks` → restore facility status to `'idle'`, inject `config.quests.repair_fund_injection` gold from treasury to facility fund.

On success:
- Transfer `quest.reward` gold from treasury to agent wallet. Emit `GoldFlowed` (category: `'transfer'`, subcategory: `'quest_reward'`). Add `'quest_reward'` ledger entry.
- Create positive memory: `{ type: 'quest_completed', description: 'Completed a {questType} quest at {facilityName}', participants: [quest.facilityId], outcome: 'positive', significance: 8, mood_impact: 15, tick: currentTick }`.
- Set quest state to `'completed'`.
- Clear `memory.activeQuest`.
- Emit `QuestCompleted` event with `{ agentId, questId, questType, facilityId, reward }`.
- Returns SUCCEEDED.

If treasury can't pay the reward, still complete the quest (the work was done) but emit a `QuestRewardSkipped` event and log a warning. The agent gets the memory but not the gold.

If conditions not met, returns FAILED.

**AbandonQuest()** — Agent gives up (can't find cargo, can't reach facility, etc.).
- Create negative memory: `{ type: 'quest_failed', description: 'Failed a {questType} quest at {facilityName}', participants: [quest.facilityId], outcome: 'negative', significance: 5, mood_impact: -10, tick: currentTick }`.
- Reset quest state to `'open'`, clear `claimedBy`, reset `repairProgress` to 0.
- Clear `memory.activeQuest`.
- Emit `QuestAbandoned` event with `{ agentId, questId, reason: 'abandoned' }`.
- Returns SUCCEEDED.

### 6.5 Activity Costs

Add to `activity_costs` in game-config defaults:
- `repair: { hunger: 1.2, thirst: 1.1, energy: 1.3 }` — repair is physical work, slightly more draining than normal work.
- `seek_quest: { hunger: 1.0, thirst: 1.0, energy: 1.0 }` — same as normal movement.
- `claim_quest: { hunger: 1.0, thirst: 1.0, energy: 1.0 }` — instant action, base rates.

### 6.6 BehaviorAgent Interface Changes (`behavior-agent.ts`)

Add to working memory section:
```
activeQuest: QuestRuntime | null;
cachedAvailableQuest: QuestRuntime | null;
insideFacility: boolean;
```

Add to conditions section:
```
HasQuest(): boolean;
QuestAvailable(): boolean;
QuestAtFacility(): boolean;
QuestCargoReady(): boolean;
```

Add to actions section:
```
ClaimQuest(): ActionResult;
SeekQuestFacility(): ActionResult;
WorkRepair(): ActionResult;
CompleteQuest(): ActionResult;
AbandonQuest(): ActionResult;
```

### 6.7 BT Tree Integration Note

This increment adds conditions/actions to the BehaviorAgent interface so they're callable from any BT definition. Wiring specific MDSL behavior trees (e.g., adding a quest subtree to `bt-villager.mdsl`) is a data task, not a code task. The quest subtree should be prioritized below survival needs (eat, drink, rest) but above idle/wander. Example pseudostructure:

```
selector
  sequence [survival: eat, drink, rest]
  sequence [work: if HasJob, seek work, work]
  sequence [quest: if QuestAvailable OR HasQuest, claim/pursue/complete]
  sequence [social: if IsLonely, seek social]
  action [wander/idle]
```

## 7. Facility Interior & Agent Visibility

### 7.1 insideFacility Flag

Added to `WorkingMemory` as `insideFacility: boolean`, default `false`.

### 7.2 Movement System Changes

When movement-system sets `atLocation` to a location that has a FacilityComponent:
- Set `memory.insideFacility = true`

When `atLocation` is cleared (agent departs):
- Set `memory.insideFacility = false`

This applies uniformly — agents working, repairing, or just visiting a facility are all "inside." This is intentional: repair quest agents are hidden the same way as working agents.

### 7.3 Perception System Changes

Agents with `insideFacility = true`:
- Are **excluded** from other agents' `nearbyAgents` results (they can't be "seen" on the map).
- Have their own `nearbyAgents` limited to agents at the **same** `atLocation` (co-workers inside the same facility).
- `nearbyLocations` unchanged (they know where they are).

### 7.4 Rendering Changes

- `debug-overlay.ts` / ExcaliburJS rendering: hide agent sprite when `insideFacility = true`. Show a count badge on the facility sprite indicating how many agents are inside (e.g., "x3"). The badge is computed by scanning `getAgents()` and counting those with `insideFacility === true` grouped by `atLocation`.
- Facility sprites scaled larger than agent sprites in game-view.ts setup (visual config: `facilityScale: 2.0` vs agent default `1.0`).

## 8. Debt Fixes

### 8.1 I4: Typed Attribute Accessor

Add to `AttributesComponent`:
```typescript
getByName(name: string): number {
  return (this.state as Record<string, number>)[name] ?? 0;
}
```

Replace all 6 `as unknown as Record<string, number>` cast sites in bt-conditions.ts, bt-actions.ts, mood-system.ts, and facility-system.ts.

### 8.2 I2: maxCharges from ItemSchema

Pass item definitions to mood-system via deps or config. Look up `maxCharges` per item from the item registry. Fall back to `5` if no registry entry exists.

The `ItemSchema` already has `maxCharges: z.number().optional()`. Add an `items` map to game-config (keyed by item ID) so systems can look up item metadata. This also benefits quest generation (looking up `baseValue` for reward calculation).

### 8.3 I1: EconomyHealthMetrics

Extend `DailySummary` in `component-data.ts`:

```typescript
interface DailySummary {
  totalWages: number;
  totalTax: number;
  totalSales: number;
  totalConsumption: number;
  // Economy health dashboard
  avgWage: number;
  wageSpread: number;
  vacancyCount: number;
  unemploymentCount: number;
  jobSwitchesThisDay: number;
  supplyDeliveries: number;
  questsCompletedThisDay: number;
}
```

Computed in `daily-report-system.ts` by scanning facilities and agents at day boundary, plus counting events from EventBus history for the current day. The `questsCompletedThisDay` metric reflects the previous day's completions (see §5.3).

## 9. Config Additions

Add to `GameConfigSchema`:

```typescript
quests: z.object({
  max_open: z.number().default(5),
  expiry_ticks: z.number().default(960),
  supply_reward_multiplier: z.number().default(1.5),
  restock_reward: z.number().default(10),
  repair_reward: z.number().default(25),
  repair_ticks: z.number().default(30),
  repair_fund_injection: z.number().default(100),
  restock_threshold: z.number().default(3),
}),
```

Add activity cost entries for `repair`, `seek_quest`, `claim_quest` to the `activity_costs` defaults.

**Note:** The existing `bt.quest_wage_skip_multiplier` config is unrelated to this quest system — it controls whether agents skip wage-based work. It is not referenced by this increment.

## 10. New Files

| File | Type | Purpose |
|------|------|---------|
| `src/domain/schemas/quest-schema.ts` | Schema | Quest type, state, reward, QuestRuntime |
| `src/infrastructure/components/quest-board-component.ts` | Component | World-level quest board |
| `src/infrastructure/systems/abandonment-system.ts` | System | Facility abandon/restore detection |
| `src/infrastructure/systems/quest-generation-system.ts` | System | Day-boundary quest creation |
| `src/infrastructure/systems/quest-evaluation-system.ts` | System | Per-tick expiry + repair progress |
| `tests/infrastructure/systems/abandonment-system.test.ts` | Test | Abandonment logic |
| `tests/infrastructure/systems/quest-generation-system.test.ts` | Test | Quest creation from facility needs |
| `tests/infrastructure/systems/quest-evaluation-system.test.ts` | Test | Expiry + repair tracking |

## 11. Modified Files

| File | Change |
|------|--------|
| `src/domain/core/component-data.ts` | Add `'abandoned'` to FacilityState status, extend DailySummary, add `'quest_reward'` to LedgerEntry type |
| `src/domain/systems/facility.ts` | Add `'abandoned'` to FacilityTickResult.status |
| `src/domain/systems/behavior-agent.ts` | Add 9 quest BT methods to interface, add working memory fields |
| `src/infrastructure/entity/bt-working-memory.ts` | Add `activeQuest`, `cachedAvailableQuest`, `insideFacility` |
| `src/infrastructure/entity/bt-conditions.ts` | Add 4 quest conditions |
| `src/infrastructure/entity/bt-actions.ts` | Add 5 quest actions |
| `src/infrastructure/entity/behavior-agent-factory.ts` | Wire new working memory + spread new conditions/actions |
| `src/infrastructure/components/attributes-component.ts` | Add `getByName()` helper |
| `src/infrastructure/systems/facility-system.ts` | Add `'abandoned'` early-exit guard, replace attribute cast |
| `src/infrastructure/systems/mood-system.ts` | Use item registry for maxCharges, use `getByName()` |
| `src/infrastructure/systems/daily-report-system.ts` | Compute EconomyHealthMetrics |
| `src/infrastructure/systems/subsidy-system.ts` | Skip abandoned facilities |
| `src/infrastructure/systems/movement-system.ts` | Set/clear `insideFacility` on facility arrival/departure |
| `src/infrastructure/systems/perception-system.ts` | Filter out agents inside facilities |
| `src/infrastructure/engine/game-view.ts` | Register 3 new systems, facility sprite scaling, wire getQuestBoard |
| `src/infrastructure/engine/debug-overlay.ts` | Hide agents inside facilities, show occupancy badge |
| `src/domain/schemas/game-config-schema.ts` | Add `quests` config section, add activity cost entries |
| `src/domain/core/tick-scheduler.ts` | Add QUEST_GENERATION priority (7.1) |
| `tests/infrastructure/entity/bt-conditions.test.ts` | Add tests for 4 new quest conditions |
| `tests/infrastructure/entity/bt-actions.test.ts` | Add tests for 5 new quest actions |

## 12. Events

| Event | Source | Payload |
|-------|--------|---------|
| `FacilityAbandoned` | AbandonmentSystem | `{ facilityId, lastWorker }` |
| `FacilityRestored` | AbandonmentSystem | `{ facilityId, newFund }` |
| `QuestGenerated` | QuestGenerationSystem | `{ questId, type, facilityId, reward }` |
| `QuestExpired` | QuestEvaluationSystem | `{ questId, facilityId }` |
| `QuestClaimed` | BehaviorAgent | `{ agentId, questId, questType, facilityId }` |
| `QuestCompleted` | BehaviorAgent | `{ agentId, questId, questType, facilityId, reward }` |
| `QuestAbandoned` | BehaviorAgent | `{ agentId, questId, reason }` |
| `QuestRewardSkipped` | BehaviorAgent | `{ agentId, questId, reason: 'treasury_empty' }` |

## 13. Success Criteria

- [ ] Facilities generate supply/restock/repair quests autonomously at day boundary
- [ ] Agents claim, pursue, and complete quests for gold + memory + mood
- [ ] Quest completion creates positive memory with description and participants
- [ ] Quest failure creates negative memory
- [ ] Abandoned facilities get repaired through quest completion
- [ ] Abandoned facilities are skipped by facility-system and subsidy-system
- [ ] Agents hidden inside facilities, perception excludes them
- [ ] Facility sprites larger than agent sprites, occupancy badge shown
- [ ] All 6 attribute cast sites replaced with typed `getByName()`
- [ ] EconomyHealthMetrics computed at day boundary
- [ ] maxCharges read from item registry, not hardcoded
- [ ] Quest rewards create ledger entries
- [ ] Activity costs defined for repair/seek_quest/claim_quest
- [ ] ClaimQuest re-reads board state (race condition guard)
- [ ] All new code has tests, full suite green, 0 lint errors

## 14. Architecture Compliance

- All new domain functions are pure (no ECS, no side effects)
- All new systems follow dual-layer pattern (domain function + infrastructure wrapper)
- Quest schema validated by Zod; QuestRuntime extends schema output for runtime fields
- EventBus used for inter-system communication (no direct system imports)
- Layer direction maintained: Infrastructure → Domain
- New systems registered at correct priorities in game-view.ts
- Quest board accessed via injected accessor on BehaviorAgentDeps (not direct world entity access)
