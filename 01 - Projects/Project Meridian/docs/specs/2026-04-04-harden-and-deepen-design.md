# Harden & Deepen — Design Spec

**Date:** 2026-04-04
**Status:** Approved
**Scope:** Interleaved code hardening (split god objects, coverage, perf budget) with simulation deepening (wage competition, supply chains, mood wiring)

## Problem

The simulation core works — 18 systems, 910 tests, economy loop running. But two files have grown into maintenance liabilities (`behavior-agent-factory.ts` at 951 lines, `day-night-system.ts` at 438 lines), branch coverage is at 71% (target 80%), there's no performance budget enforcement, and 2 of 7 mood factors are still stubbed. Meanwhile, the economy lacks wage competition and smart supply chain routing — agents can't compare wages or plan multi-hop deliveries.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Approach | Interleave hardening with features | Each step delivers visible value; refactoring scoped to files being modified |
| Factory split | 4 files (factory, conditions, actions, working-memory) | Each module independently testable; conditions/actions composable |
| Day-night split | 6 files (core + 5 extracted systems) | Single-responsibility; each system testable in isolation |
| Day boundary coordination | Flag on TimeComponent (`dayBoundaryThisTick`) | Simpler than event subscription; systems read flag at priority 0.8 |
| Perf budget | Soft (observe + warn), not hard (skip systems) | Hard cutoff breaks determinism; observability first, optimize later |
| Supply chain routing | Agent uses known locations + price memories | No omniscience; information limited to what agent has personally observed |

## Step 1: Split behavior-agent-factory.ts + Wage Comparison

### Current State

951 lines, one closure containing ~25 conditions and ~20 actions as inline methods. Untestable in isolation, hard to extend.

### New File Structure

```
src/infrastructure/entity/
  behavior-agent-factory.ts    → slim orchestrator (~80 lines)
  bt-conditions.ts             → all condition methods (~200 lines)
  bt-actions.ts                → all action methods (~400 lines)
  bt-working-memory.ts         → working memory state + accessors (~50 lines)
```

### bt-working-memory.ts

Exports `createWorkingMemory()` returning a typed object holding all the `let` bindings currently in the factory closure:

```typescript
export interface WorkingMemory {
	movementTarget: MovementTarget | null;
	journey: JourneyState | null;
	atLocation: string | null;
	currentRegion: string;
	haulCargo: CargoState | null;
	socialCooldowns: Map<string, number>;
	committedAction: string | null;
	btAction: string | null;
	buyTargetItem: string | null;
	restingAt: string | null;
	arrivalSlot: number | null;
	knownLocations: string[];
	priceMemories: CircularBuffer<PriceMemory>;
	skills: SkillEntry[];
	traitModifiers: ModifierMap | null;
	unemployedTicks: number;
	gossipPending: string | null;
	feedingAt: string | null;
	recovering: boolean;
}
```

**Note:** `cachedFacilities` / `cachedFacilitiesTick` remain implementation-internal (not on the interface) — they are a performance cache rebuilt per tick by `resolveNearbyFacilities()`.

Plus property accessors and the `recordPriceObservation` helper.

### bt-conditions.ts

Exports `createConditions(memory: WorkingMemory, actor: AgentActor, deps: BehaviorAgentDeps)` returning an object with all condition functions:

- Need conditions: `IsHungry`, `IsExhausted`, `IsRecovering`, `IsLonely`, `IsThirsty`, `NeedsCritical`
- Inventory conditions: `HasFood`, `HasFoodReserve`, `HasGold`, `CanAffordFood`, `HasWater`, `HasTradeGoods`, `NeedsTools`, `NeedsEquipment`, `CanAffordItem`, `HasCargo`, `HasNoJob`
- Job conditions: `HasJob`, `OpenFacilityNearby`, `OpenProductionFacilityNearby`
- Spatial conditions: `AtLocation`, `NearLocation`, `NearAgent`, `NearAgentClose`, `AtJobFacility`, `CargoDestinationNearby`
- Time conditions: `IsDaytime`, `IsNighttime`, `IsWorkHours`
- Facility conditions: `FacilityHasStock`, `FacilityNeedsSupply`
- Knowledge conditions: `KnowsFoodSource`

Each is a named function, independently importable and testable.

### bt-actions.ts

Exports `createActions(memory: WorkingMemory, actor: AgentActor, deps: BehaviorAgentDeps)` returning all action functions:

- Life actions: `Eat`, `Drink`, `Rest`, `FillWaterskin`
- Economy actions: `Harvest`, `SellAtMarket`, `BuyItem`, `SeekFood`, `SeekBestFoodSource`, `SeekWater`, `SeekMarket`
- Work actions: `SeekWork`, `Work`, `ClaimBestJob`, `ClaimJob`, `ReleaseJob`
- Supply actions: `PickupCargo`, `DeliverCargo`, `SeekSupplySource`, `SeekDeliveryTarget`
- Social actions: `Talk`, `SeekSocial`
- Navigation actions: `SeekRest`, `Wander`, `Idle`

### behavior-agent-factory.ts (slim)

```typescript
export function createBehaviorAgent(deps: BehaviorAgentDeps): BehaviorAgent {
	const memory = createWorkingMemory(deps.actor, deps.config);
	const conditions = createConditions(memory, deps.actor, deps);
	const actions = createActions(memory, deps.actor, deps);
	return { ...memory.accessors, ...conditions, ...actions };
}
```

### New Feature: Wage Comparison

**Prerequisite — extend `PerceivedFacility` with `wage`:**

The `PerceivedFacility` interface in `behavior-agent.ts` currently exposes `id`, `job`, `stock`, `distance`, `hasUnmetInput`, `workerId`. It does NOT include `wage`. The `resolveNearbyFacilities()` helper in the factory already reads `FacilityComponent` and the location's `production` — add `wage: number` to the interface and populate it from `production.wage` in the helper.

```typescript
// behavior-agent.ts — extend PerceivedFacility
export interface PerceivedFacility {
	// ... existing fields ...
	wage: number;  // NEW — from WorldLocation.production.wage
}
```

**New condition in bt-conditions.ts:**

```typescript
BetterPayAvailable(): boolean
```

Checks `nearbyFacilities` for open positions offering higher wage than the agent's current facility. Uses the aptitude efficiency modifier — a job paying 4g but matching the agent's primary attribute may be better than 5g at a mismatched job. Effective wage = `wage * (aptitude / baseline)`.

**New action in bt-actions.ts:**

```typescript
SwitchJob(): ActionResult
```

1. Releases current job (`job = null`)
2. Claims the better-paying facility
3. Emits `JobSwitched` event with old/new job, old/new wage, reason
4. Returns SUCCEEDED

**BT integration (base.mdsl):**

New low-priority branch between work and social:

```
/* P5.5: Switch to better job if available */
sequence {
    condition [IsWorkHours]
    condition [HasJob]
    condition [BetterPayAvailable]
    action [SwitchJob]
}
```

Only evaluates during work hours, only for employed agents, only when a better option is visible.

### Testing

- `bt-conditions.test.ts` — unit tests for each condition with mock working memory
- `bt-actions.test.ts` — unit tests for each action
- `bt-working-memory.test.ts` — memory initialization, price observation recording
- Existing `behavior-agent-factory.test.ts` becomes an integration test that verifies the composed agent

---

## Step 2: Split day-night-system.ts + Economy Health Dashboard

### Current State

438 lines, complexity 34. Seven concerns in one file: time advancement, welfare, stipends, subsidies, equipment decay, economy liveness, daily reports.

### New File Structure

```
src/infrastructure/systems/
  day-night-system.ts          → time advancement + day boundary flag (~80 lines)
  welfare-system.ts            → welfare grants for poor agents (~60 lines)
  stipend-system.ts            → guard/merchant treasury stipends (~80 lines)
  subsidy-system.ts            → facility fund top-ups (~70 lines)
  equipment-decay-system.ts    → daily equipment charge decay (~50 lines)
  daily-report-system.ts       → liveness checks + report generation (~120 lines)
```

### Day Boundary Coordination

`day-night-system.ts` sets a flag on `TimeComponent` when a day boundary occurs:

```typescript
interface TimeState {
	// ... existing fields ...
	dayBoundaryThisTick: boolean;  // initialized to false
}
```

The flag is initialized to `false` and set to `true` on the tick where dayCount increments, then cleared to `false` at the start of every subsequent tick (before any boundary check). Extracted systems run at priority `0.8` (after `DAY_NIGHT = 0.7`) and check:

**Ordering constraint:** The clear-before-set sequencing is guaranteed by system priority (DayNightSystem at 0.7 runs before all extracted systems at 0.8+). This must be captured in a test: "given no day boundary occurred this tick, extracted systems see `dayBoundaryThisTick === false`."

```typescript
const time = worldEntity.get(TimeComponent);
if (!time.state.dayBoundaryThisTick) return;
```

### System Priorities

| System | Priority | When |
|--------|----------|------|
| DayNightSystem | 0.7 | Every tick |
| WelfareSystem | 0.8 | Day boundary only |
| StipendSystem | 0.81 | Day boundary only |
| SubsidySystem | 0.82 | Day boundary only |
| EquipmentDecaySystem | 0.83 | Day boundary only |
| DailyReportSystem | 0.84 | Day boundary only |

### New Feature: Economy Health Dashboard

`daily-report-system.ts` extends the daily report with wage competition metrics:

```typescript
interface EconomyHealthMetrics {
	avgWage: number;
	wageSpread: number;         // max - min wage across facilities
	vacancyCount: number;       // facilities with no worker
	unemploymentCount: number;  // agents with no job
	jobSwitchesThisDay: number; // from JobSwitched events
	supplyDeliveries: number;   // from SupplyDelivered events (step 3)
}
```

Written to vault as part of the daily report markdown. The debug overlay reads these from `EconomyComponent.state.dailySummary` (extended with these fields).

### Testing

Each extracted system gets its own test file. Tests are ported from the existing `day-night-system.test.ts` (91% coverage) — each test moves to the file that now owns that behavior. The existing test file becomes a thin integration test verifying time advancement and day boundary flag.

---

## Step 3: Supply Chain Routing + Coverage Push

### Current State

`PickupCargo` and `DeliverCargo` actions exist. `FacilityNeedsSupply` condition exists. But supply routing requires both source and destination to be in perception range simultaneously.

### Smart Supply Chain Routing

**New domain function in `domain/systems/cargo.ts`:**

```typescript
export function planSupplyRoute(input: {
	knownLocations: string[];
	facilityData: Map<string, { production: Production | null; stock: StockItem[] }>;
	currentRegion: string;
	regionGraph: RegionEdge[];
}): SupplyRoute | null
```

Pure function. Uses agent's `knownLocations` and facility data from previous visits to find a route: source facility (has output in stock) → destination facility (needs that item as input). Returns `{ sourceId, destinationId, itemId, waypoints }` or null.

**New condition in bt-conditions.ts:**

```typescript
KnowsSupplyRoute(): boolean
```

Calls `planSupplyRoute()` with the agent's known locations. Returns true if a viable route exists. Caches the result in working memory for the action to use.

**Enhanced DeliverSupply action:**

Instead of requiring both facilities in perception range, reads the cached supply route and initiates a multi-step journey:
1. Set movement target to source facility
2. On arrival: pick up cargo
3. Set movement target to destination (may require cross-region journey via waypoints)
4. On arrival: deliver cargo
5. Emit `SupplyDelivered` event

Uses the existing journey/waypoint system for cross-region travel.

**New event:**

```typescript
{
	type: 'SupplyDelivered',
	payload: {
		agentId: string;
		itemId: string;
		quantity: number;
		sourceId: string;
		destinationId: string;
	}
}
```

Feeds the economy dashboard from step 2.

### Coverage Push Strategy

Target: branch coverage from 71% to 80%.

**New test coverage:**
- `planSupplyRoute` — thorough branch tests: no known locations, no viable route, single-hop route, cross-region route, multiple candidates (pick nearest), known location absent from facilityData (stale)
- `bt-conditions.test.ts` — edge cases for all spatial/knowledge conditions
- `bt-actions.test.ts` — edge cases for supply chain actions, cargo state transitions

**Existing coverage gaps to close:**
- `movement-system.ts` (58% stmts) — add tests for journey waypoint navigation, exhaustion during movement, arrival spread edge cases
- `facility-system.ts` — test private production path, tool multiplier, aptitude efficiency branches
- `rest-system.ts` — test public shelter gold deduction, facility fund credit

---

## Step 4: Performance Budget + Remaining Mood Factors

### Performance Budget

**Integration with existing PerformanceTracker:**

`tick-runner.ts` already calls `deps.performanceTracker.startSystem()` / `endSystem()` / `completeTick()` for per-system timing. The budget check builds on this existing infrastructure — no duplicate timing.

**tick-runner.ts changes:**

`completeTick()` already returns a `TickPerformance` object with `totalMs` and `systems: SystemTiming[]`. Currently the return value is discarded. Capture it and use it for budget checking — no new PerformanceTracker methods needed:

```typescript
const tickPerf = deps.performanceTracker.completeTick(currentTick);
const budgetMs = deps.config.performance?.budget_ms ?? 300;
if (tickPerf !== null && tickPerf.totalMs > budgetMs) {
	deps.eventBus.emit({
		type: 'TickBudgetExceeded',
		payload: {
			tick: deps.tickCount,
			elapsedMs: tickPerf.totalMs,
			breakdown: tickPerf.systems,
		},
	});
	deps.logger.warn('TickRunner', `Budget exceeded: ${tickPerf.totalMs.toFixed(1)}ms > ${budgetMs}ms`);
}
```

**Key constraint:** No system skipping. All systems always execute. This is purely observational — determinism preserved. The debug overlay picks up `TickBudgetExceeded` and shows a red timing indicator.

### Remaining Mood Factors

**goalProgress** — job satisfaction based on aptitude match:

```typescript
// In mood-system.ts
const jobSkillId = entity.job;
if (jobSkillId !== null && deps.config.jobs !== undefined) {
	const jobDef = deps.config.jobs.definitions[jobSkillId];
	if (jobDef !== undefined) {
		const attrs = entity.get(AttributesComponent).state;
		const attrValue = (attrs as Record<string, number>)[jobDef.primary_attribute] ?? 10;
		const baseline = deps.config.jobs.aptitude_baseline;
		goalProgress = clamp(attrValue / (baseline * 2), 0, 1);
	}
}
```

Agents working jobs matching their strongest attribute feel fulfilled. Mismatched agents feel less progress. Unemployed agents get 0.

**equipmentCondition** — fraction of tool charges remaining:

```typescript
// In mood-system.ts
const inv = entity.get(InventoryComponent);
const chargeable = inv.state.items.filter(i => i.charges !== undefined);
if (chargeable.length > 0) {
	const totalCharges = chargeable.reduce((sum, i) => sum + (i.charges ?? 0), 0);
	const maxCharges = chargeable.length * deps.config.economy.tools_max_charges;
	equipmentCondition = clamp(totalCharges / maxCharges, 0, 1);
} else {
	equipmentCondition = 0.5; // no equipment is neutral, not distressing
}
```

### Testing

- Tick-runner budget: test with mock system that records timing, verify `TickBudgetExceeded` emission
- Mood factors: add test cases to `mood-system.test.ts` for goalProgress (matched job, mismatched job, unemployed) and equipmentCondition (full charges, depleted, no equipment)

---

## Execution Order & Dependencies

```
Step 1 ──→ Step 2 ──→ Step 3 ──→ Step 4
 (factory    (day-night   (supply      (perf +
  split +     split +      chains +     mood)
  wages)      dashboard)   coverage)
```

Steps 1 and 2 are independent refactors that can run in parallel if desired. Step 3 depends on step 1 (new conditions/actions go in the split modules). Step 4 is independent.

## Success Criteria

| Metric | Before | Target |
|--------|--------|--------|
| behavior-agent-factory.ts | 951 lines | <100 lines (orchestrator) |
| day-night-system.ts | 438 lines, complexity 34 | <100 lines, complexity <10 |
| Branch coverage | 71% | ≥80% |
| Lint errors | 0 | 0 |
| Mood factors wired | 5/7 | 7/7 |
| Performance observability | None | Budget warnings + debug indicator |
| Wage competition | None | Agents switch jobs for better pay |
| Supply chains | Perception-only | Knowledge-based multi-hop routing |
