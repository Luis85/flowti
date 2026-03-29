# Phase 2E: Economy & Social Foundation — Design Spec

## 1. Goal

Make the economy work. Agents earn gold from facility jobs, buy food and rest with gold, and develop skills through work. Facilities produce goods when staffed and supplied. A world economy ledger tracks all transactions, with daily markdown reports written to the vault. Relationships form as agents interact economically.

## 2. Exit Criteria

1. JobSystem iterates facilities, checks worker + input, produces goods, pays wages from facility fund
2. Farm produces wheat (single-step), Bakery consumes wheat and produces bread (two-step chain)
3. Workshop produces tools (single-step)
4. TradeSystem processes `buy` action — deducts gold from agent, adds item to inventory, adds gold to facility fund
5. FeedSystem consumes food items from agent inventory (not location-based), recovers hunger
6. RestSystem deducts gold for public_shelter tier (owned_home free, outdoors free)
7. Agents with no gold cannot buy food — must work to earn
8. Tax collected on wages flows to Director treasury
9. Economy ledger tracks all transactions (wage, purchase, tax, consumption)
10. Daily economy report written to `03 - Resources/Economy/day-{N}.md` with Dataview-queryable frontmatter
11. Relationship tracking: disposition + familiarity updated by socializing, working together, trading
12. Skill progression: skill-by-use on production complete, use_bonus increments at thresholds
13. BTs restructured with economic conditions (`has_gold`, `has_item`, `can_afford`, `facility_has_stock`, `has_job_facility`)
14. New BT actions: `buy`, `seek_market`
15. Welfare safety net: treasury subsidizes agents below `welfare_threshold_gold` with direct gold injection
16. Daytime-only work guard prevents 24/7 production (stand-in for GDD shift scheduling)
17. All Phase 0-1D tests still pass (no regressions)
18. 50+ new tests, all passing
19. tsc, eslint, build all green

## 3. Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Production unit | Facility-driven — JobSystem iterates facilities, not agents | Agents are labor. The facility is the unit of production with its own state (stock, fund, workProgress, status). This is a Phase 2E partial implementation of the GDD's Phase 5 JobSystem, covering product-type jobs only (no shift scheduling or service jobs). |
| Trade model | Direct facility sales — agents buy from the facility where goods are produced | No separate MarketSystem needed. TradeSystem handles purchase at any facility with stock. |
| Food consumption | Inventory-based — FeedSystem consumes items from agent inventory | Agents must first buy food (or already have it). Separates commerce (TradeSystem) from consumption (FeedSystem). |
| Gold costs for needs | Eating costs gold (food_price, default 2). Public shelter rest costs gold (rest_price, default 1, one-time on entry). Owned locations free. | Broke agents can't buy food, creating a natural pressure to work. |
| Director economy | Passive — tax auto-collected on wages, treasury accumulates | Tax on wages is a Phase 2E simplification. GDD §20.1 taxes trades, not wages. Phase 5 will migrate tax collection to TradeSystem on completed sales; the wage-tax path will be removed or retained only for non-trade production. |
| Relationships | Runtime-only ECS component, not Canvas-backed | RelationshipComponent is an in-memory representation updated as side effects. It is NOT persisted to vault and NOT connected to AgentSchema.relationships (which is a Canvas graph path). Phase 3 adds Canvas checkpoint (every 50 ticks per arc42 ADR-10). |
| Skill progression | Pure function called by JobSystem on ProductionComplete | Phase 2E stub that will be absorbed into ProgressionSystem (priority 13) at Phase 5. Fires at priority 6 inside JobSystem for now, not at the designated ProgressionSystem slot. |
| Economy ledger | Append-only log on world entity | EconomyComponent on world entity alongside TimeComponent. Daily summary + transaction log. |
| Vault reports | DayNightSystem writes markdown at day boundaries | Minimal vault-write capability via new `writeFile` on GameCoreDeps. Not full Phase 9 VaultSync. |
| Welfare safety net | Minimal treasury subsidy when agent gold < welfare_threshold | If agent gold drops below `economy.welfare_threshold_gold` (default 10), treasury injects `economy.welfare_reward_min` (default 15) directly. No quest mechanism — direct injection as Phase 2E stand-in for GDD §20.2 welfare quests. |

### Phase Positioning Note

This phase is labeled "2E" but implements elements from GDD Phases 3 (relationships), 4 (inventory consumption), and 5 (production, wages, trade). This is a deliberate out-of-order implementation — building a simplified economic foundation bottom-up rather than following the GDD's breadth-first phase sequence.

### Deferred GDD Requirements

These items are explicitly part of the GDD's economy/job/social design but are NOT implemented in Phase 2E:

| GDD Feature | GDD Section | Deferred To | Notes |
|-------------|-------------|-------------|-------|
| Mill step in supply chain (wheat→flour→bread) | §5.4, §18 | Phase 5 | Phase 2E proves two-step pipeline (farm→bakery). Vertical Slice Gate requires adding Mill. |
| Shift scheduling (start/end ticks, days off) | §6.2 | Phase 5 | Phase 2E uses daytime-only BT guard as stand-in. |
| Saga-pattern agent-to-agent trade | §7.3 | Phase 5 | Phase 2E uses direct facility purchase. |
| Dynamic pricing (scarcity, location modifiers) | §7.1 | Phase 5 | Phase 2E uses fixed `food_price` from config. |
| Full welfare quest system | §20.2 | Phase 5 | Phase 2E uses direct treasury subsidy as stand-in. |
| Recipe system (multi-input, quality, tools) | §5.3 | Phase 5 | Phase 2E uses simple single-input ProductionSchema. |
| Canvas-backed relationship persistence | §3.1, ADR-10 | Phase 3 | Phase 2E uses runtime-only RelationshipComponent. |
| ProgressionSystem at priority 13 | Arc42 §6.1 | Phase 5 | Phase 2E fires skill progression inside JobSystem at priority 6. |
| Service jobs (bartender, clinic, school) | §6.2 | Phase 5 | Phase 2E covers product jobs only. |
| Director treasury spending | §20.1 | Phase 6 | Phase 2E treasury is accumulate-only (plus welfare subsidy). |

## 4. Detailed Design

### 4.1 File Map

```
New domain files:
	domain/systems/job.ts              — pure production cycle logic
	domain/systems/trade.ts                 — pure buy/sell logic
	domain/systems/skill-progression.ts     — pure skill-by-use logic
	domain/systems/relationship.ts          — pure disposition/familiarity update
	domain/systems/daily-report.ts          — pure markdown report generator

New infrastructure files:
	infrastructure/systems/job-system.ts       — GameSystem wrapper (priority 6)
	infrastructure/systems/trade-system.ts          — GameSystem wrapper (priority 11)

Modified domain files:
	domain/systems/feed.ts                  — switch from location-based to inventory-based consumption
	domain/systems/rest.ts                  — add gold cost for public_shelter tier

Modified infrastructure files:
	infrastructure/systems/feed-system.ts           — inventory consumption, ledger entries
	infrastructure/systems/rest-system.ts           — gold deduction for public rest
	infrastructure/systems/day-night-system.ts      — daily report writing at day boundary
	infrastructure/engine/game-view.ts              — wire new systems, attach new components
	infrastructure/entity/agent-actor.ts            — expose inventory, wallet, job on actor

Modified schema/config files:
	domain/schemas/game-config-schema.ts    — economy config additions
	domain/schemas/location-schema.ts       — ProductionSchema
	domain/core/tick-scheduler.ts           — reuse existing JOB slot (priority 6), TRADE already exists at 11
	domain/core/bt-actions.ts              — new conditions and actions

New test files:
	tests/domain/systems/job.test.ts
	tests/domain/systems/trade.test.ts
	tests/domain/systems/skill-progression.test.ts
	tests/domain/systems/relationship.test.ts
	tests/domain/systems/daily-report.test.ts
	tests/infrastructure/systems/job-system.test.ts
	tests/infrastructure/systems/trade-system.test.ts
	tests/infrastructure/systems/feed-system.test.ts         — updated/expanded
	tests/infrastructure/systems/rest-system.test.ts         — updated/expanded
	tests/integration/economy-integration.test.ts
	tests/integration/smoke-test.test.ts                     — new economy scenario
	tests/integration/data-validation.test.ts                — new config/schema validation
```

### 4.2 Data Model

#### ProductionSchema (extension to LocationSchema)

```typescript
const ProductionSchema = z.object({
	job: z.string(),
	output: z.object({ item_id: z.string(), quantity: z.number().int() }),
	input: z.object({ item_id: z.string(), quantity: z.number().int() }).nullable().default(null),
	wage: z.number().default(5),
	ticks_per_cycle: z.number().int().default(30),
}).nullable().default(null);
```

Added as `production: ProductionSchema` on LocationSchema. Existing locations without production default to null.

#### FacilityComponent (new ECS component)

```typescript
interface FacilityState {
	stock: { item_id: string; quantity: number }[];
	fund: number;
	workProgress: number;
	status: 'idle' | 'producing';
	workerId: string | null;
}
```

Attached to location markers in `game-view.ts` `populateScene()`. Initialized with `fund` from `economy.facility_start_fund` (default 100).

#### RelationshipComponent (new ECS component)

```typescript
interface RelationshipEntry {
	agentId: string;
	disposition: number;    // -100 to +100
	familiarity: number;    // 0+
}

interface RelationshipState {
	entries: RelationshipEntry[];
}
```

Attached to each AgentActor. Starts with an empty `entries` array. Entries are created on first interaction and updated on subsequent interactions.

#### EconomyComponent (new, on world entity)

```typescript
interface LedgerEntry {
	tick: number;
	type: 'wage' | 'purchase' | 'tax' | 'consumption';
	from: string;
	to: string;
	itemId: string | null;
	quantity: number;
	gold: number;
}

interface DailySummary {
	totalWages: number;
	totalTax: number;
	totalSales: number;
	totalConsumption: number;
}

interface EconomyState {
	treasury: number;
	ledger: LedgerEntry[];
	dailySummary: DailySummary;
}
```

Attached to the world entity in `populateScene()` alongside TimeComponent. The `dailySummary` resets at each day boundary after the report is written.

#### GameConfigSchema Additions (EconomyConfigSchema extension)

```typescript
food_price: z.number().default(2),
rest_price: z.number().default(1),
facility_start_fund: z.number().default(200),
ledger_retention_days: z.number().int().default(7),
```

Added to the existing EconomyConfigSchema.

#### GameCoreDeps Extension

```typescript
writeFile: ((path: string, content: string) => Promise<void>) | null;
```

Nullable — `null` in tests, real vault adapter in production.

**Wiring in production:** In `game-view.ts`, the `initializeWorld()` method already has access to `this.app.vault`. Construct the write adapter alongside the existing `createVaultAdapter()`:

```typescript
const writeFile = async (path: string, content: string): Promise<void> => {
	const existing = vault.getFileByPath(path);
	if (existing !== null) {
		await vault.modify(existing, content);
	} else {
		await vault.create(path, content);
	}
};
```

Pass `writeFile` when constructing `GameCoreDeps` in `plugin.ts` `initializeGame()`. In tests, pass `writeFile: null` — all existing test `createDeps()` helpers need updating to include `writeFile: null`.

### 4.3 JobSystem (priority 6)

Pure domain function: `src/domain/systems/job.ts`
Infrastructure wrapper: `src/infrastructure/systems/job-system.ts`

Iterates all locations that have a FacilityComponent. Per facility per tick:

1. **Find worker:** any AgentActor within `interaction_radius` with `btAction === 'work'` and `agent.job` matching `production.job`
2. **No worker:** set status `'idle'`, set workerId `null`, emit `FacilityIdle` if changed, continue
3. **Input check:** if `production.input` is required, check facility stock has input item with sufficient quantity. If not, set status `'idle'`, emit `FacilityIdle`, continue
4. **Produce:** set status `'producing'`, set workerId
5. **Increment:** `workProgress += 1`
6. **Cycle complete:** if `workProgress >= ticks_per_cycle`:
	- If input required: deduct input item from stock
	- Add output item to stock
	- Calculate wages: `netWage = wage * (1 - taxRate)`, `tax = wage * taxRate`
	- Deduct wage from facility fund (if `fund >= wage`, else pay what's available)
	- Add netWage to worker wallet
	- Add tax to economy treasury
	- Append ledger entries (wage + tax)
	- Apply skill progression to worker (see Section 4.7)
	- Update relationship: worker familiarity with facility +1 (see Section 4.8)
	- Emit `ProductionComplete`
	- Reset `workProgress` to 0

**Pure domain function signature:**

```typescript
interface FacilityTickInput {
	hasWorker: boolean;
	workerJob: string | null;
	facilityJob: string;
	workProgress: number;
	ticksPerCycle: number;
	hasRequiredInput: boolean;
	wage: number;
	taxRate: number;
	facilityFund: number;
	workerGold: number;
}

interface FacilityTickResult {
	newWorkProgress: number;
	status: 'idle' | 'producing';
	cycleComplete: boolean;
	workerGoldChange: number;
	facilityFundChange: number;
	taxCollected: number;
	consumeInput: boolean;
	produceOutput: boolean;
	idleReason: 'no_worker' | 'no_input' | null;
}

export function applyJobTick(input: FacilityTickInput): FacilityTickResult;
```

### 4.4 TradeSystem (priority 11)

Pure domain function: `src/domain/systems/trade.ts`
Infrastructure wrapper: `src/infrastructure/systems/trade-system.ts`

Iterates agents with `btAction === 'buy'`. Per agent:

1. Find nearest facility within `interaction_radius` that has stock
2. Find cheapest available food item in facility stock (or item matching BT params)
3. Check agent `gold >= food_price`
4. If can afford: deduct gold, add item to agent inventory, add gold to facility fund, append ledger entries, emit `PurchaseComplete`
5. If cannot afford: emit `PurchaseFailed`, agent stays (BT will re-evaluate next tick)

Update relationship: buyer familiarity +0.5 with facility worker (if present).

**Pure domain function:**

```typescript
interface TradeInput {
	agentGold: number;
	price: number;
	facilityFund: number;
	itemId: string;
	quantity: number;
}

interface TradeResult {
	success: boolean;
	agentGoldChange: number;
	facilityFundChange: number;
	failReason: 'no_gold' | 'no_stock' | null;
}

export function applyTrade(input: TradeInput): TradeResult;
```

### 4.5 FeedSystem Modification

**Before (Phase 1D):** checks `btAction === 'eat'`, recovers hunger from location proximity.
**After (Phase 2E):** checks `btAction === 'eat'`, checks agent inventory for food item, consumes item, recovers hunger.

```typescript
// Check inventory for any food item
const foodItem = findFoodInInventory(agentInventory);
if (foodItem === null) continue;  // no food, no recovery

// Consume item
removeFromInventory(agentInventory, foodItem.item_id, 1);

// Apply recovery
const result = applyFeed({ currentHunger }, { recovery_rate });
```

**Food item identification:** a domain constant `FOOD_ITEMS` set: `new Set(['bread'])`. Only consumable items, not raw materials. Wheat is a production input (category: raw), not a consumable — allowing agents to eat wheat would short-circuit the farm→bakery chain. This is a domain constant like `KNOWN_ACTIONS`.

**Events:** emit `ItemConsumed` event on successful consumption.

**Ledger:** append consumption ledger entry via EconomyComponent.

The location-based feed from Phase 1D is fully removed. Agents must have food items in inventory to eat.

### 4.6 RestSystem Modification

When tier is `public_shelter`:

1. Check agent `gold >= economy.rest_price`
2. If can afford: deduct gold on entry (one-time charge when `RestStarted` would fire, not per tick), append ledger entry
3. If cannot afford: **in-place tier downgrade** to `outdoors` — the agent is still physically at the rest location but receives outdoors-tier recovery (+1.0/tick, -3 mood). They occupy the shelter but can't pay for proper rest. This is NOT a skip — `resolveRestTier` must return `'outdoors'` instead of `'public_shelter'` when gold is insufficient.

`owned_home` and `outdoors` tiers unchanged from Phase 1D.

### 4.7 BT Conditions and Actions

#### New Conditions

Add to `CONDITION_CHECKS` in `behavior-tree.ts`:

| Condition | Check |
|-----------|-------|
| `has_gold(ctx, params)` | `ctx.wallet >= params.amount` |
| `has_item(ctx, params)` | `ctx.inventory` contains `params.itemId` |
| `can_afford(ctx, params)` | At facility with stock AND has `gold >= food_price` |
| `facility_has_stock(ctx, params)` | Nearest facility within `interactionRadius` has `params.itemId` in stock |
| `has_job_facility(ctx)` | Nearby facility's `production.job` matches agent's job |

#### BTContext Additions

```typescript
wallet: number;                                     // extracted from agent.wallet.gold (number, not the { gold } object)
inventory: { item_id: string; quantity: number }[];  // agent's inventory items
job: string | null;                                  // agent's job
nearbyFacilities: {
	id: string;
	job: string;
	stock: { item_id: string; quantity: number }[];
}[];
```

**Translation step:** `BehaviorTreeSystem` reads `FacilityComponent` (infrastructure) from location actors within `interaction_radius` and translates into the pure-domain `nearbyFacilities` struct. This follows the same pattern as reading `NeedsComponent` → `needs` and `PerceptionComponent` → `perception`. The `populateScene()` method must retain references to location actors (see Section 4.15) so BehaviorTreeSystem can query their FacilityComponents.

**Action classification:** `eat`, `rest`, `talk`, `work`, `buy` are all **stationary actions** — they are NOT in `LOCATION_ACTIONS` or `AGENT_SOCIAL_ACTIONS`, so `MovementSystem` ignores them. `eat` specifically requires no location proximity — an agent with food in inventory can eat anywhere. `buy` requires facility proximity (enforced by BT conditions, not by the action type).

#### New Actions

Add to `KNOWN_ACTIONS`:

| Action | Type | Processor |
|--------|------|-----------|
| `buy` | Stationary | TradeSystem |
| `seek_market` | Movement | Targets nearest market-type location |

Add `seek_market: 'market'` to `LOCATION_ACTIONS` for movement resolution.

#### Updated BT Structure (example bt-merchant)

```
Selector:
	// Critical energy
	energy_critical -> at_location rest -> rest
	energy_critical -> nearby_location rest -> seek_rest
	// Hunger — eat from inventory, buy, seek food, work if broke
	hunger < 50 -> has_item bread -> eat
	hunger < 50 -> can_afford -> buy
	hunger < 50 -> has_gold 2 -> nearby_location food -> seek_food
	hunger < 50 -> has_job_facility -> seek_work
	// Social
	social < 40 -> nearby_agent_close -> talk
	social < 40 -> nearby_agent -> socialize
	// Default work (daytime only — stand-in for GDD shift scheduling)
	time_is day -> at_location work -> work
	time_is day -> has_job_facility -> seek_work
	idle
```

### 4.8 Skill Progression

Pure domain function: `src/domain/systems/skill-progression.ts`

```typescript
interface SkillProgressionInput {
	points: number;
	useCount: number;
	useBonus: number;
	thresholds: number[];
	maxUseBonus: number;
}

interface SkillProgressionResult {
	newPoints: number;
	newUseCount: number;
	newUseBonus: number;
	improved: boolean;
}

export function applySkillProgression(input: SkillProgressionInput): SkillProgressionResult;
```

Called by JobSystem when a production cycle completes. The agent's skill matching the facility's `job` field gets +1 point. If `use_count` crosses a threshold, `use_bonus` increments by 1. Emit `SkillImproved` event when `use_bonus` changes.

**Skill IDs for Phase 2E jobs:** `farming`, `baking`, `leatherworking`. These match the `production.job` field on facilities. Thresholds and max bonus come from `GameConfigSchema`: `skills.use_thresholds` (default `[10, 25, 50, 100, 200]`) and `skills.max_use_bonus` (default `3`).

### 4.9 Relationship Updates

Pure domain function: `src/domain/systems/relationship.ts`

```typescript
interface RelationshipUpdateInput {
	currentDisposition: number;
	currentFamiliarity: number;
	dispositionChange: number;
	familiarityChange: number;
}

interface RelationshipUpdateResult {
	newDisposition: number;  // clamped -100 to +100
	newFamiliarity: number;  // clamped at 0 minimum
}

export function applyRelationshipUpdate(input: RelationshipUpdateInput): RelationshipUpdateResult;
```

Called by:

| System | Trigger | Disposition | Familiarity |
|--------|---------|-------------|-------------|
| SocializeSystem | Social interaction | +1 | +1 |
| JobSystem | ProductionComplete (if multiple workers) | +0.5 | +1 |
| TradeSystem | PurchaseComplete | 0 | +0.5 (buyer toward worker) |

### 4.10 Daily Economy Report

Pure domain function: `src/domain/systems/daily-report.ts`

```typescript
interface DailyReportInput {
	dayCount: number;
	summary: DailySummary;
	treasury: number;
	facilities: {
		name: string;
		produced: { item: string; qty: number }[];
		workerName: string | null;
		status: string;
	}[];
	transactions: LedgerEntry[];
	agents: { name: string; gold: number; goldChange: number }[];
}

interface DailyReportOutput {
	frontmatter: string;
	body: string;
}

export function generateDailyReport(input: DailyReportInput): DailyReportOutput;
```

Called by DayNightSystem at day boundary. Writes to vault via `deps.writeFile`.

**File path:** `03 - Resources/Economy/day-${dayCount}.md`

**Frontmatter** (flat key:value, Dataview-queryable):

```yaml
---
day: 1
total_wages: 45
total_tax: 5
total_sales: 12
total_consumption: 8
treasury_balance: 55
active_facilities: 3
idle_facilities: 1
items_produced: 6
items_consumed: 4
---
```

**Body** sections:

- **Production** — table of facility name, worker, items produced, status
- **Transactions** — table of tick, type, from, to, item, gold
- **Agent Balances** — table of agent name, gold, change from previous day. `goldChange` is **derived from the ledger** — sum all wage credits minus purchases for that agent within the current day's ledger entries. No snapshot mechanism needed.

**Ledger pruning:** after writing the daily report, prune ledger entries older than `economy.ledger_retention_days` days (measured in ticks via the day-night cycle length). **Ordering is critical:** write report FIRST (which reads the ledger for goldChange derivation), THEN prune old entries.

### 4.11 Event Catalog

| Event | Source | Payload |
|-------|--------|---------|
| `ProductionComplete` | JobSystem | `facilityId, workerId, outputItem, outputQty, wage, taxCollected` |
| `FacilityIdle` | JobSystem | `facilityId, reason: 'no_worker' \| 'no_input'` |
| `PurchaseComplete` | TradeSystem | `buyerId, facilityId, itemId, quantity, price` |
| `PurchaseFailed` | TradeSystem | `buyerId, facilityId, reason: 'no_stock' \| 'no_gold'` |
| `SkillImproved` | JobSystem | `agentId, skillId, newUseBonus` |
| `ItemConsumed` | FeedSystem | `agentId, itemId` |
| `TaxCollected` | JobSystem | `amount, workerId, facilityId, source: 'wage'` |
| `FacilityInsolvent` | JobSystem | `facilityId, fund: 0, unpaidWage` |
| `DailyReportWritten` | DayNightSystem | `dayCount, path` |

All events follow the `GameEvent` interface: `{ type, tick, wallClock, source, payload }`.

### 4.12 Location Data Updates

#### Farm (updated)

```json
{
	"id": "loc-farm",
	"type": "food",
	"production": {
		"job": "farmer",
		"output": { "item_id": "wheat", "quantity": 1 },
		"input": null,
		"wage": 3,
		"ticks_per_cycle": 30
	}
}
```

#### Bakery (updated)

```json
{
	"id": "loc-bakery",
	"type": "food",
	"production": {
		"job": "baker",
		"output": { "item_id": "bread", "quantity": 1 },
		"input": { "item_id": "wheat", "quantity": 1 },
		"wage": 4,
		"ticks_per_cycle": 20
	}
}
```

#### Workshop (updated)

```json
{
	"id": "loc-workshop",
	"type": "work",
	"production": {
		"job": "leatherworker",
		"output": { "item_id": "leather-goods", "quantity": 1 },
		"input": null,
		"wage": 5,
		"ticks_per_cycle": 40
	}
}
```

#### Tavern

No production (rest location). May add service-based production in a future phase (bartender serves drinks).

#### Market

No production (trade hub). Elena works here but the market doesn't produce — it is where agents come to buy from facilities that have stock.

### 4.13 Agent Job Assignments

Current agent roster vs. available production facilities:

| Agent | Current Job | Matching Facility | Status |
|-------|------------|-------------------|--------|
| Sable | leatherworker | Workshop | Match |
| Elena | merchant/shopkeeper | Market (no production) | No production match |
| Marcus | guard/gate-guard | None | No production match |
| Wren | scholar/librarian | None | No production match |

**Problem:** only Sable has a matching production facility. Marcus and Wren have no facility for their jobs. Elena's market has no production output.

**Recommended solution:** reassign jobs for gameplay. Marcus becomes `farmer` (physical work suits a guard background). Wren becomes `baker` (intellectual curiosity extends to craft). Elena remains merchant with no production — she idles, socializes, and buys/sells at the market (future trade role). This ensures three agents actively participate in the economy while one demonstrates the idle/social fallback behavior.

The implementation plan should decide the final assignment. The BT gracefully handles agents with no matching facility — they fall through to idle/socialize behavior.

### 4.14 Data Flow Per Tick

```
Tick N starts:
	0.5  TraitResolverSystem          — [Phase 1B] trait modifiers
	0.7  DayNightSystem               — [Phase 1C] time phase + daily report write
	1    NeedsDecaySystem             — [Phase 1B] decays needs
	2    MoodSystem                   — [Phase 1B] recalculates mood
	3    PerceptionSystem             — [Phase 1C] spatial awareness
	4    MemoryDecaySystem            — [Phase 1B] decays old memories
	5    BehaviorTreeSystem           — [Phase 1C] selects action (new conditions)
	5.5  MovementSystem               — [Phase 1C] moves agent, drains energy
	6    JobSystem               — [Phase 2E] production cycles, wages, tax
	6.5  RestSystem                   — [Phase 1D] recovers energy (+ gold cost)
	6.6  FeedSystem                   — [Phase 1D->2E] inventory consumption
	6.7  SocializeSystem              — [Phase 1D] recovers social, creates memories
	11   TradeSystem                  — [Phase 2E] buy actions, facility purchases
```

TradeSystem runs at priority 11 (after all need-recovery systems) so agents who arrive at a market can buy on the same tick, and FeedSystem can consume on the next tick.

### 4.15 Plugin Wiring

`game-view.ts` `populateScene()` additions:

1. **Retain location actor references:** Currently `createLocationMarker()` returns an actor that's added to the scene but not stored. Refactor to retain references in a `locationActors` map (keyed by location ID), similar to how `world.agents` stores agent actors. This allows `JobSystem` and `BehaviorTreeSystem` to query `FacilityComponent` on location actors.

```typescript
const locationActors = new Map<string, ex.Actor>();
for (const loc of world.locations) {
	const marker = createLocationMarker(loc);
	engine.currentScene.add(marker);
	if (loc.production !== null) {
		marker.addComponent(new FacilityComponent({
			stock: [], fund: deps.config.economy.facility_start_fund, // default 200, matches GDD §6.5
			workProgress: 0, status: 'idle', workerId: null,
		}));
	}
	locationActors.set(loc.id, marker);
}
const getLocationActors = () => locationActors;
```

2. Attach `RelationshipComponent` to each AgentActor (empty entries)
3. Attach `EconomyComponent` to world entity
4. Register new systems:

```typescript
tickRunner.register(createJobSystem(getAgents, getLocationActors, getWorldEntity));
tickRunner.register(createTradeSystem(getAgents, getLocationActors, getWorldEntity));
```

5. Pass `writeFile` on `GameCoreDeps` — real vault adapter in production, null in tests (see Section 4.2)

## 5. Conventions

- **File naming:** kebab-case (`job-system.ts`, `daily-report.test.ts`)
- **Imports:** `.js` extension in all imports (ESM)
- **Indentation:** tabs
- **No `any` types**, no `@ts-ignore`, no `TODO`/`FIXME` comments
- **Tests mirror source:** `src/domain/systems/job.ts` -> `tests/domain/systems/job.test.ts`
- **TDD:** write failing test, implement, verify, commit
- **Pure domain functions** wrapped in infrastructure GameSystem wrappers
- **Config-driven:** no magic numbers in infrastructure systems (all from `GameConfigSchema`)
- **Immutable component state updates:** spread-copy + `markDirty()`
- **Domain constants:** `FOOD_ITEMS`, new actions/conditions follow the `KNOWN_ACTIONS` pattern

## 6. Dependencies and Assumptions

- Phase 1D complete (all 11 systems operational, action consequences working)
- BT action transitions (seek/do pattern) in place from Phase 1C
- AgentSchema already has: `wallet`, `inventory`, `skills`, `job`, `property` fields
- LocationSchema already has `LOCATION_TYPES` including `'market'`
- EconomyConfigSchema already has: `tax_rate`, `price_clamp_min`/`price_clamp_max`, welfare configs (`welfare_threshold_gold`)
- GameCoreDeps exists and is hot-swappable for testing
- TrackedComponent pattern established for all mutable components
- `interaction_radius` config available from Phase 1D

## 7. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Gold deflation — facilities run out of fund, wages stop, agents can't buy food | Medium | High | Treasury welfare system: if agent gold < `economy.welfare_threshold_gold`, treasury subsidizes. Existing config supports this. |
| Supply chain deadlock — bakery needs wheat but farm has no worker | Medium | Medium | BT falls back to idle/outdoors rest. Agents don't starve immediately due to existing outdoors rest recovery. Multiple agents can farm. |
| Inventory bloat — agents accumulate items they can't use | Low | Low | FeedSystem consumes food. Other items (leather-goods) are future-phase concerns — inventory is unbounded for now. |
| Vault write performance — daily report writes to vault | Low | Low | Single file per day, only at day boundary (not per-tick). Async write via deps. |
| FeedSystem regression — removing location-based feed breaks existing tests | Medium | Medium | Update all existing FeedSystem tests to use inventory-based model. Phase 1D tests for feed are explicitly replaced, not preserved. |
| BT complexity — new conditions increase tree depth | Low | Medium | Conditions are simple boolean checks on context. No new tree traversal logic. |

## 8. Operational Checklist

### README Generator
Update `scripts/generate-readme.mjs` to document:
- JobSystem, TradeSystem in the system pipeline table
- Economy config values (food_price, rest_price, facility_start_fund, tax_rate)
- Production chain: Farm (wheat) -> Bakery (bread), Workshop (leather-goods)
- Daily economy reports location

### Integration Safeguards
Update existing test files:
- `tests/integration/smoke-test.test.ts` — add economy scenario: agent works at facility, earns gold, buys food, eats
- `tests/integration/data-validation.test.ts` — validate ProductionSchema, EconomyConfigSchema additions, FacilityComponent shape

### World Snapshot
Update `scripts/generate-world-snapshot.mjs`:
- Add facility status indicators (producing/idle) to location markers
- Or defer to runtime VaultSync — document the decision

### Docs
After implementation, update Phase 2E Section 9 (post-implementation notes) with:
- Any deviations from this spec
- Additional artifacts created
- Final test count

### Agent Job Reassignment
Confirm final agent job assignments before implementation begins. Recommended: Marcus -> `farmer`, Wren -> `baker`, Sable -> `leatherworker`, Elena -> `merchant` (no production match, idles/socializes).

### Three Amigos Review
Run Three Amigos review before merge to verify:
- Economy loop is self-sustaining (agents can earn, buy, eat without manual intervention)
- No gold sinks that drain all currency
- Daily reports are Dataview-queryable

---

## 9. Post-Implementation Notes

*(To be completed after implementation.)*
