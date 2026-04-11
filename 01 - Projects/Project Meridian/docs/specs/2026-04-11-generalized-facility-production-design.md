# Generalized Facility Production — Design

**Status:** Draft (rev 2 — reviewer findings incorporated)
**Date:** 2026-04-11
**Source:** Review of recording 2026-04-11-1639 + user requirements for generalized production/service/area-effect facility model
**Scope:** Full refactor of the facility, production, recipe, and service subsystems — ~80 files touched, ~1400 LoC added, ~500 LoC deleted, ~120 new tests (plus ~100-150 existing tests rewritten in Phase 3)
**Replaces:** inline production config + separate `LeisureSystem` / `RestSystem` / direct-interaction water source
**Follows GDD §5.4 / §6 with explicit deviations** (recipes as JSON not markdown; see "Deviations from GDD")

---

## Problem Statement

The current facility model has grown organically and is now the limiting factor for gameplay depth:

### Content gaps (from recording 2026-04-11-1639)

- **Equipment has no producer.** Only 2 units exist in the starting Market Stall stock. Once sold, agents cannot replace broken equipment. Guards without equipment can't work. Guard Post goes abandoned. Economy freezes. (Root cause of 111 "frozen economy" anomalies and 71 "Bram wandering while unemployed" anomalies.)
- **Water is not a production resource.** Spring is a direct-interaction location — agents `FillWaterskin` without a worker, without payment, without a production cycle. This violates the "every resource is produced by a facility" model.
- **Services are in a parallel system.** Bathhouse, Tavern, Library, Park use a `LeisureConfig` block on the location schema, processed by a separate `LeisureSystem`. Rest facilities use another parallel system. No workers, no wages, no production.
- **Guard Post's output is unused.** It produces `security` items into stock, but nothing consumes them. The whole facility contributes nothing to gameplay.
- **Recipes don't exist as first-class entities.** Production is hardcoded inline on each location, so adding equipment production to a Workshop requires editing the location file rather than pointing it at a new recipe.

### Structural gaps

- **Facilities are tied to their job via `location.type: 'work'`**, but the same behavioral type covers jobs that differ structurally (Workshop produces items, Guard Post provides area effect).
- **No concept of facility type** separate from behavioral location type. Bakery and Forge look identical to the BT — both are just `type: work` with different inline `production` blocks.
- **Service facilities have no workers**, violating the principle that every facility needs someone operating it.
- **No recipe library**, so the Director cannot swap what a facility produces without editing its location file.
- **`LeisureSystem` and `RestSystem` are separate pipelines** that duplicate the "agent visits, effect applied, cooldown" pattern.

### User's requirements (verbatim, from brainstorming session)

> we need to produce: water, food, tools, equipment. those resources get created in facilities, every facility has an input and an output, every facility needs at least one agent to work the facility, each facility has a production process, input and output needs to be transported to the facilities or to the market by agents, each facility posts jobs and quests, agents can accept and process them, every facility pays wages to agents, there are facilities who don't need an input, like a farm, to produce something. each facility has at least 1 recipe active, which dictates its output, those recipes carry all needed requirements to execute one cycle and produce the defined output, facilities are defined by their type, based on the type, facilities have access to corresponding recipes, a facility has inventory for input and output, recipe execution has a base execution time which can be altered via modifier. there are also facilities which produce services, those facilities need a worker, other agents can be customers from those, there are also facilities like the guard post, who provide their output as an modifier in a radius around them. All facilities need workers to operate.

---

## Design Decisions

Every decision below was made during the brainstorming session. Each one picks a specific option and documents why alternatives were rejected.

### Decision 1 — Phased against the GDD vision

**Chosen: Option C — phased, minimum viable now, extensible later.**

Rejected alternatives:
- (A) Minimum viable without extensibility hooks — would require a second refactor to extend later
- (B) Full GDD §5.4 / §6 implementation — too much scope for one pass, many features may never be needed

The full GDD design includes processing/crafting/construction recipe subtypes, job schedules with start/end tick-of-day, days_off, status requirements, service cooldown_ticks, skill_scaling on service output. None of these are needed to solve the content gaps above. We build the core generalized model now with a data shape that can be extended without rewriting.

### Decision 2 — Recipe storage

**Chosen: Option B — recipe library files, facilities reference them via facility type.**

Rejected alternatives:
- (A) Inline recipes in each facility config — duplicates data across facilities of the same type, doesn't match user's "facilities of a type have access to corresponding recipes"
- (C) Recipes embedded inside facility type definitions — prevents recipe sharing across types (e.g. a `repair_equipment` recipe useful at both Workshop and Smithy would be duplicated)

Layer structure:
- **Recipes** live in `recipes/*.json`
- **Facility types** live in `facility-types/*.json` and declare `allowed_recipes: string[]`
- **Location instances** live in `locations/*.json` and declare `facility_type: string` + `active_recipe: string`

### Decision 3 — Three facility kinds (not one schema)

**Chosen: Option B — three specialized kinds (production / service / area_effect) with shared top-level shape and kind-specific config blocks.**

Rejected alternatives:
- (A) One universal recipe schema with discriminated union output — bloats recipe schema with fields that only apply to one kind
- (C) Facility type declares a `produce` handler name with recipes as opaque data — over-abstracted for 3 concrete cases

Every facility type has: `id`, `kind`, `primary_job`, `default_wage`, `default_fund`, `funding`. Kind-specific block varies:
- `kind: production` → `allowed_recipes: string[]`
- `kind: service` → `staffed_effects`, `unstaffed_effects`, `cost_per_visit`, `ticks_per_visit`
- `kind: area_effect` → `modifier`, `radius`, `ticks_per_pulse`

### Decision 4 — Single active recipe per facility instance

**Chosen: Option A — `active_recipe: string`, one recipe at a time per facility.**

Rejected alternatives:
- (B) Multiple active recipes with worker-chosen rotation — unpredictable economy, complex worker AI
- (C) Multiple active recipes with Director-set ratios — adds config complexity for marginal gain

Rationale: simplest model that covers 100% of current content. To get both tools and equipment production, create a second Workshop instance (or a Smithy). Extension to multi-recipe later is one field change (`active_recipe: string` → `active_recipes: string[]`) without breaking the schema.

### Decision 5 — Worker requirement

**Chosen: Option C — strict for production and area-effect, degraded for services.**

Rejected alternatives:
- (A) Strict for all kinds — with 3 agents and 11+ facilities, most of the world sits idle and gameplay becomes depopulated
- (B) Degraded for all kinds — softens production too much, no clear incentive to staff a forge

Rules:
- **Production facility without worker** → `status: idle`, no progress, no fund drain
- **Service facility without worker** → runs in `unstaffed_effects` mode, no cost collected, no wage paid
- **Area-effect facility without worker** → no pulse, no modifier emitted, no wage paid

### Decision 6 — Area effect mechanic

**Chosen: Option A — mood bonus via MoodSystem's needs pipeline.**

Rejected alternatives:
- (B) Needs decay reduction — invisible to players unless surfaced in UI
- (C) Zone infrastructure registry — overkill for 1 concrete effect
- (D) Stub and defer — dead code tends to rot

Guard Post: agents within `radius` of a staffed Guard Post get `+2 mood/tick` via a new `areaModifiers` queue that MoodSystem reads each tick. Existing `NeedsModifiers` pipeline gets one new stage. When a future facility type needs a different modifier kind, we add a second case to the dispatcher.

### Decision 7 — Water and equipment content

**Chosen for water: A + B combined — Well as both producer and direct-sale point, with supply chain to Market.**
**Chosen for equipment: E — new Smithy facility type with a new `blacksmith` job.**

Rejected alternatives for water:
- (A alone) Well only, no Market — makes water logistics trivial, no emergent supply chain
- (B alone) Well → Market only, no direct sale — forces hauling for a basic need, frustrating gameplay
- (C) Area-effect well — violates the "water is produced and transported" model

Rejected alternatives for equipment:
- (D) Workshop second recipe — thematic mismatch (craftsmen shouldn't make armor)
- (F) No producer, repair-only — no supply chain gameplay, equipment scarcity is artificial

Water flow:
- Well (`kind: production`, `primary_job: water_carrier`, recipe: `draw-water`)
- Water is a real inventory item — `waterskin` concept is removed
- Customers buy `water×1` at the Well OR at the Market (supplied by hauling quest)
- `Drink` action consumes 1 water item, restores thirst (symmetrical with food/Eat)
- `FillWaterskin` BT action is deleted

Equipment flow:
- Smithy (`kind: production`, `primary_job: blacksmith`, recipe: `smithy-equipment`)
- Recipe input: `tools×1`, output: `equipment×1` — creates a Workshop → Smithy supply chain
- Existing `repair_equipment` path (tools repair existing equipment via `RepairWithTools`) remains as the primary maintenance loop

### Decision 8 — Migration strategy

**Chosen: Option A — big bang single spec.**

Rejected alternatives:
- (B) Producers first, services second — two migration specs, longer coexistence of old and new systems
- (C) New facility types only, leave existing alone — leaves two production systems in the codebase indefinitely

All 11 existing facilities are migrated to the new model in one spec. Implementation is phased into 6 commit-sized steps to manage risk, but the content and systems all land under one coherent plan.

### Decision 9 — Generic `Work` action across all kinds

**Chosen: single `Work` action, facility kind determines behavior.**

Agents don't know whether they're in a bathhouse or a forge. The BT says "be at my job facility, run Work, commit for 30 ticks." The relevant system (FacilitySystem / ServiceSystem / AreaEffectSystem) picks up the worker and does its thing.

Rationale: no change to agent BT, one action to maintain, simpler hiring logic, no duplication. Alternatives (separate actions per kind) would require BT awareness of facility kind, which defeats the abstraction.

### Decision 10 — Service worker wages are hourly, not per-visit

**Chosen: flat hourly wage from facility fund while worker has `btAction === 'work'` at the facility.**

Rejected alternative: per-visit wage (worker only earns when a customer completes a visit).

Rationale: the user chose this explicitly. Creates fragility (idle service facility drains fund until abandoned), which is a correct failure mode — empty bathhouses close down naturally via the existing abandonment system. Matches real-world staffing cost.

---

## Data Model

### Recipe schema

`src/domain/schemas/recipe-schema.ts`:

```typescript
export const RecipeSchema = z.object({
  id: z.string().regex(/^recipe-[a-z0-9-]+$/),   // must have 'recipe-' prefix
  name: z.string().min(1),
  inputs: z.array(z.object({
    item_id: z.string(),
    quantity: z.number().int().min(1),
  })).default([]),                                // empty for raw producers
  outputs: z.array(z.object({
    item_id: z.string(),
    quantity: z.number().int().min(1),
  })).min(1),
  ticks_per_cycle: z.number().int().min(1),
  required_skill: z.string().nullable().default(null),    // matches job.skill_id
  min_skill_level: z.number().int().min(0).default(0),    // always 0 in first pass
});

export type Recipe = z.infer<typeof RecipeSchema>;
```

Lives in `recipes/*.json`. Loaded at boot via `recipe-loader.ts` into a `Map<string, Recipe>` registry passed to systems.

**Recipe IDs must use the `recipe-` prefix** per the regex. Recipe FILES can be named without the prefix for brevity (e.g. `recipes/farm-wheat.json`), but the `id` field inside the file must be `recipe-farm-wheat`. Loader validates this.

File naming convention:
- `recipes/farm-wheat.json` → contains `id: "recipe-farm-wheat"`
- `recipes/craft-tools.json` → `id: "recipe-craft-tools"`
- `recipes/smithy-equipment.json` → `id: "recipe-smithy-equipment"`
- `recipes/draw-water.json` → `id: "recipe-draw-water"`

References elsewhere (facility type's `allowed_recipes`, location's `active_recipe`) use the full prefixed id.

### Facility type schema

`src/domain/schemas/facility-type-schema.ts`:

```typescript
const CommonFields = z.object({
  id: z.string().regex(/^[a-z_]+$/),
  primary_job: z.string(),
  default_wage: z.number().min(0).default(3),
  default_fund: z.number().min(0).default(200),
  funding: z.enum(['facility', 'treasury']).default('facility'),
  capacity: z.literal(1).default(1),      // YAGNI: multi-worker deferred, enforced to 1
});

const ProductionKindSchema = CommonFields.extend({
  kind: z.literal('production'),
  allowed_recipes: z.array(z.string()).min(1),
});

const ServiceKindSchema = CommonFields.extend({
  kind: z.literal('service'),
  staffed_effects: z.object({
    mood: z.number().default(0),
    energy: z.number().default(0),
    social: z.number().default(0),
    skill_xp: z.number().default(0),
  }),
  unstaffed_effects: z.object({
    mood: z.number().default(0),
    energy: z.number().default(0),
    social: z.number().default(0),
    skill_xp: z.number().default(0),
  }),
  cost_per_visit: z.number().min(0).default(0),
  ticks_per_visit: z.number().int().min(1).default(20),
});

const AreaEffectKindSchema = CommonFields.extend({
  kind: z.literal('area_effect'),
  modifier: z.object({
    kind: z.enum(['mood']),                       // only 'mood' in first pass
    delta_per_tick: z.number(),
  }),
  radius: z.number().int().min(1),
  ticks_per_pulse: z.number().int().min(1).default(30),
});

export const FacilityTypeSchema = z.discriminatedUnion('kind', [
  ProductionKindSchema,
  ServiceKindSchema,
  AreaEffectKindSchema,
]);

export type FacilityType = z.infer<typeof FacilityTypeSchema>;
```

Lives in `facility-types/*.json`. Loaded at boot.

### Location schema (modified)

`src/domain/schemas/location-schema.ts` changes:

```typescript
// REMOVED
- type: z.enum(LOCATION_TYPES),
- production: ProductionSchema,
- leisure: LeisureConfigSchema,

// ADDED
+ facility_type: z.string(),
+ active_recipe: z.string().nullable().default(null),    // null if kind !== production

// UNCHANGED
  id, name, position, color, region, fund, stock, capacity
```

Cross-validation in the loader:
- Every `location.facility_type` must exist in the facility type registry
- If the facility type's `kind === 'production'`, `location.active_recipe` must be in the facility type's `allowed_recipes`
- If the facility type's `kind !== 'production'`, `location.active_recipe` must be `null`

### FacilityComponent (unchanged runtime shape, new semantics)

```typescript
interface FacilityComponentState {
  stock: StockItem[];           // unified input + output list
  fund: number;
  workProgress: number;         // counts toward recipe.ticks_per_cycle (production) or ticks_per_visit (service)
  status: 'idle' | 'producing' | 'abandoned';
  workerId: string | null;
  lastPulseTick: number;        // NEW — for area_effect kind, initialized to deps.tickCount on spawn
  currentPrices?: Record<string, number>;  // unchanged — EconomySystem writes
}
```

Only addition is `lastPulseTick` for area-effect pulse tracking.

### Facility bootstrap (fund wiring)

Today, `game-view.ts` `populateScene()` reads `config.economy.facility_start_fund` (a single global number) and assigns it to every production facility's initial fund. After migration, facilities use `facility_type.default_fund` — a PER-TYPE value.

**Migration in Phase 2**: `populateScene` iterates locations, looks up `registry.facilityType(loc.facility_type).default_fund`, uses it as the initial `FacilityComponent.fund`. The location file can override via a top-level `fund: N` field (kept for back-compat and Director placement). Precedence: `location.fund ?? facility_type.default_fund`.

`config.economy.facility_start_fund` becomes unused after Phase 2 and is removed in Phase 6.

### Item schema (water addition)

`items/water.md` (new — items live at project root, NOT under `03 - Resources/`):

```yaml
---
display_name: Water
icon: droplet
color: "#4da6ff"
rarity: common
category: food                  # shares food's consumable category for schema reuse
base_price: 2
---
```

`items/waterskin.md` → **deleted**.

---

## Facility Lifecycle (tick behavior per kind)

### Production

```
FacilitySystem.execute(deps):
  for each location where facility_type.kind == 'production':
    facility = FacilityComponent(location)
    facilityType = registry.getType(location.facility_type)
    recipe = registry.getRecipe(location.active_recipe)

    if facility.status == 'abandoned': continue

    worker = findWorker(facility, facilityType, agents)
    if worker == null:
      facility.status = 'idle'
      continue

    if not checkInputs(facility.stock, recipe.inputs):
      facility.status = 'idle'
      continue

    // Aptitude scaling (existing logic)
    effectiveTicks = applyAptitudeScaling(recipe.ticks_per_cycle, worker, facilityType.primary_job)

    result = applyRecipeCycle({
      facilityStock: facility.stock,
      workProgress: facility.workProgress,
      ticksPerCycle: effectiveTicks,
      recipe,
      wage: facilityType.default_wage,        // wage lives on facility type, not recipe
      facilityFund: facility.fund,
      funding: facilityType.funding,
      treasuryFund: economy.treasury,
    })

    applyResult(facility, result)

    if result.cycleComplete:
      payWage(worker, result.workerGoldChange)
      collectTax(treasury, result.taxCollected)
      emit 'ProductionComplete'
```

Pure function `applyRecipeCycle` handles the cycle math (progress, consumption, production, wage calculation). Lives in `src/domain/systems/recipe.ts`. Tested in isolation.

### Service

```
ServiceSystem.execute(deps):
  for each location where facility_type.kind == 'service':
    facility = FacilityComponent(location)
    facilityType = registry.getType(location.facility_type)

    if facility.status == 'abandoned': continue

    worker = findWorker(facility, facilityType, agents)

    // Pay hourly wage to worker if present
    if worker != null:
      wage = facilityType.default_wage
      if facilityType.funding == 'facility':
        if facility.fund < wage:
          // Insufficient fund — skip wage this tick.
          // AbandonmentSystem will pick up facility.fund <= 0 on its next pass
          // and transition the facility to 'abandoned', causing the worker to
          // release. No new FacilityInsolvent event needed — reuse existing flow.
          continue
        facility.fund -= wage
      else:
        economy.treasury -= wage
      worker.wallet += wage
      collectTax(treasury, wage * taxRate)
      emit 'GoldFlowed wage'

    // Process visits (customers)
    for agent in agents where agent.currentServiceVisit?.facilityId == location.id:
      visit = agent.currentServiceVisit
      visit.ticksRemaining--

      if visit.ticksRemaining == 0:
        effects = worker != null ? facilityType.staffed_effects : facilityType.unstaffed_effects
        applyEffects(agent, effects)
        if facilityType.cost_per_visit > 0 and worker != null:
          agent.wallet -= facilityType.cost_per_visit
          facility.fund += facilityType.cost_per_visit
          emit 'GoldFlowed purchase'
        agent.insideFacility = null
        agent.currentServiceVisit = null
        emit 'ServiceDelivered'
```

Visits are tracked via a new `memory.currentServiceVisit: { facilityId, ticksRemaining, costPaid } | null` field.

**Worker eligibility for hourly wage** (fixes a reviewer-flagged gap):

The `findWorker` helper checks `agent.btAction === 'work'` — so a worker commuting (`seek_work`) does NOT get hourly wage. The wage starts the tick the worker arrives at the facility and begins the `Work` action, not during travel. This matches production behavior and means:

- A service worker in `seek_work` commit is paid nothing
- The moment they arrive and `beginAction('work', commit=30)` fires, they start earning per-tick wage
- If the work commit expires and the agent does NOT immediately re-claim (e.g., needs a rest cycle), the wage pauses
- A worker who walks out of radius mid-shift also stops earning (same check as production)

This is intentional: services should pay for active presence, not availability. Agents commuting don't earn, which is correct — commute time is unpaid.

**UseService action pseudocode** (fixes another reviewer gap — cost timing and exploit guards):

```
UseService():
  facility = nearestServiceFacility(agent.intent)
  if facility == null: return FAILED
  facilityType = registry.getType(facility.facility_type)
  if agent.wallet < facilityType.cost_per_visit: return FAILED
  if agent.currentServiceVisit !== null: return FAILED  // already using something

  // Debit cost UPFRONT — prevents the exploit of leaving mid-visit with free benefit
  agent.wallet -= facilityType.cost_per_visit
  facility.fund += facilityType.cost_per_visit
  emit 'GoldFlowed purchase'

  agent.currentServiceVisit = {
    facilityId: facility.id,
    ticksRemaining: facilityType.ticks_per_visit,
    costPaid: true,
  }
  agent.insideFacility = facility.id
  beginAction(ctx, 'use_service', facilityType.ticks_per_visit)
  return RUNNING
```

Cost is debited at visit START, not END. If the agent leaves mid-visit (commit broken by critical needs), effects are not applied but the cost is not refunded. That matches the real-world model of "you paid to enter, you got some of the benefit, no refunds".

**Negative wallet prevention**: `BuyItem` and `UseService` both check wallet ≥ cost before proceeding; neither allows negative gold.

### Area effect

```
AreaEffectSystem.execute(deps):
  for each location where facility_type.kind == 'area_effect':
    facility = FacilityComponent(location)
    facilityType = registry.getType(location.facility_type)

    if facility.status == 'abandoned': continue

    worker = findWorker(facility, facilityType, agents)
    if worker == null: continue

    if (deps.tickCount - facility.lastPulseTick) < facilityType.ticks_per_pulse:
      continue

    // Pay worker
    wage = facilityType.default_wage
    if facilityType.funding == 'facility':
      facility.fund -= wage
    else:
      economy.treasury -= wage
    worker.wallet += wage
    collectTax(treasury, wage * taxRate)

    // Find agents in radius and queue area modifier
    for agent in agents:
      dx = agent.pos.x - location.position.x
      dy = agent.pos.y - location.position.y
      if (dx*dx + dy*dy) <= (facilityType.radius ** 2):
        agent.pendingAreaModifiers.push(facilityType.modifier)

    facility.lastPulseTick = deps.tickCount
    emit 'AreaEffectPulsed'
```

`pendingAreaModifiers` is a new queue on the agent's working memory. MoodSystem drains the queue each tick and applies each modifier's `delta_per_tick` to mood. If the queue is empty, MoodSystem doesn't touch mood.

Multiple overlapping guard posts stack: 3 posts → `+6 mood/tick` for an agent in all three radiuses. Intuitive and correct.

**Pulse timing initialization** (fixes reviewer gap):

`facility.lastPulseTick` must be initialized to the current tick at facility spawn, not `0`. Otherwise, a game loaded at tick 5000 with a fresh `lastPulseTick = 0` would immediately fire a pulse on tick 5000 (because `5000 - 0 >= 30`), regardless of when the last pulse actually happened. The game-view's `populateScene` sets `lastPulseTick: deps.tickCount` when creating the FacilityComponent for an area-effect facility.

If the game is saved and reloaded later, `lastPulseTick` is persisted. Re-initialization only happens on fresh spawn.

### Wage model summary

| Kind | When wage paid | Source | Amount |
|---|---|---|---|
| Production | On cycle complete | Fund (private) or treasury (public) | `facility_type.default_wage` |
| Service | Every tick while worker is at facility + btAction=='work' | Fund (private) or treasury (public) | `facility_type.default_wage` |
| Area effect | On pulse tick | Fund or treasury | `facility_type.default_wage` |

Wage lives on the facility type, not the recipe. If two facilities of the same type (e.g., two Workshops) need different wages, they need different facility types (or the concept can be added later via a location-level `wage_override`).

Production and area-effect keep their existing funding fragility (fund empties → abandoned). Service inherits the same pattern but via hourly drain — if no customers pay, fund depletes faster.

---

## Worker Mechanics

### Unified `Work` action

```
BT action: Work (existing, unchanged)
  Preconditions: HasJob, AtJobFacility, IsWorkHours, facility.status != abandoned
  Effect: beginAction('work', commit=config.commitment_ticks.work)
  Return: RUNNING
```

Generic. All three systems filter for `agent.btAction === 'work'` + `agent.pos within radius`.

### Hiring (`ClaimBestJob` refactor)

```
ClaimBestJob():
  candidates = allLocations
    .filter(loc => loc.workerId == null)
    .filter(loc => facilityTypes[loc.facility_type].kind != null)
    .filter(loc => loc.facility.status != 'abandoned')
    .filter(loc => canDoJob(agent, facilityTypes[loc.facility_type].primary_job))

  if candidates.empty: return FAILED

  best = maxBy(candidates, scoreFn)
  claimFacility(best, agent)
  agent.job = facilityTypes[best.facility_type].primary_job
  return SUCCEEDED
```

`canDoJob` checks: agent attribute baseline for the job's `primary_attribute`, OR agent is unemployed (job:null) and willing to learn. Scoring considers distance, wage, match strength.

### New jobs (8 additions)

Added to `config.jobs.definitions`:

| Job | Primary attribute | Skill | Used by |
|---|---|---|---|
| `blacksmith` | ST | smithing | smithy |
| `water_carrier` | HT | hauling | well |
| `innkeeper` | Chr | hospitality | rest_inn |
| `bartender` | Chr | hospitality | tavern |
| `bathhouse_keeper` | Chr | hospitality | bathhouse |
| `librarian` | IQ | knowledge | library |
| `park_keeper` | HT | hospitality | park |
| `shopkeeper` | Chr | trade | market_stall |

All skills (`smithing`, `hauling`, `hospitality`, `knowledge`, `trade`) are cosmetic markers for this pass — no skill-based bonuses. Provide extension points for later.

### Job switching

`SwitchJob` + `BetterPayAvailable` condition already exists and iterates facilities. Generalization: iterate all kinds, compute expected wage-per-tick including service hourly rates. No structural change.

---

## Content Migration

### New files

**`recipes/` (new folder, 4 files):**

| File | Recipe |
|---|---|
| `farm-wheat.json` | `{inputs: [], outputs: [food×1], ticks: 15}` |
| `craft-tools.json` | `{inputs: [], outputs: [tools×1], ticks: 25}` |
| `smithy-equipment.json` | `{inputs: [tools×1], outputs: [equipment×1], ticks: 40}` |
| `draw-water.json` | `{inputs: [], outputs: [water×3], ticks: 10}` |

Note: no recipe for guard patrol — area-effect facilities don't have recipes, they have a `modifier` block on the facility type.

**`facility-types/` (new folder, 11 files or 10 after consolidation):**

| File | Kind | Primary job | Funding | Key config |
|---|---|---|---|---|
| `farm.json` | production | settler | facility | `allowed_recipes: [farm-wheat], default_wage: 3, default_fund: 200` |
| `workshop.json` | production | craftsman | facility | `allowed_recipes: [craft-tools], default_wage: 3, default_fund: 200` |
| `smithy.json` | production | blacksmith | facility | `allowed_recipes: [smithy-equipment], default_wage: 4, default_fund: 200` |
| `well.json` | production | water_carrier | facility | `allowed_recipes: [draw-water], default_wage: 2, default_fund: 150` |
| `guard_post.json` | area_effect | guard | **treasury** | `modifier: mood +2, radius: 150, ticks_per_pulse: 30, default_wage: 4` |
| `rest_inn.json` | service | innkeeper | facility | staffed: `energy+8, mood+3`; unstaffed: `energy+4`; cost: 2; `default_wage: 1, default_fund: 150` |
| `bathhouse.json` | service | bathhouse_keeper | facility | staffed: `mood+15, energy+5`; unstaffed: `mood+5`; cost: 5; `default_wage: 2, default_fund: 150` |
| `tavern.json` | service | bartender | facility | staffed: `social+15, mood+10`; unstaffed: `social+5, mood+3`; cost: 5; `default_wage: 2, default_fund: 150` |
| `library.json` | service | librarian | facility | staffed: `mood+10, skill_xp+1`; unstaffed: `mood+3`; cost: 3; `default_wage: 1, default_fund: 120` |
| `park.json` | service | park_keeper | **treasury** | staffed: `mood+8, energy+3`; unstaffed: `mood+5, energy+2`; cost: 0; `default_wage: 1, default_fund: 0` |
| `market_stall.json` | service | shopkeeper | facility | staffed: `mood+2`; unstaffed: `mood+0`; cost: 0 (trade hub); `default_wage: 1, default_fund: 200` |

**`rest_inn.json` is shared across the 3 existing rest facilities** (cabin, farmstead, house). There is no cottage in the current world — the spec previously listed 4 incorrectly. Count confirmed against `ls locations/`.

**Guard Post funding is `treasury`** — it's a public service, unchanged from the current config. This MUST be set correctly in `guard_post.json` or the treasury stops paying guards and the whole economy loop this spec exists to fix breaks.

**Park funding is also `treasury`** — matches current behavior (parks are public amenities).

### Location file changes

Every existing location in `locations/` gets its `type`, `production`, `leisure` fields replaced with `facility_type` + optional `active_recipe`:

| Location | Old | New |
|---|---|---|
| farmland.json | `type: food, production: {...}` | `facility_type: farm, active_recipe: farm-wheat` |
| workshop.json | `type: work, production: {...}` | `facility_type: workshop, active_recipe: craft-tools` |
| guard-post.json | `type: work, production: {...}` | `facility_type: guard_post` (no active_recipe — area_effect) |
| spring.json → **renamed** well.json | `type: water, production: null` | `facility_type: well, active_recipe: draw-water` |
| market.json | `type: market, production: null` | `facility_type: market_stall` |
| bathhouse.json | `type: leisure, leisure: {...}` | `facility_type: bathhouse` |
| tavern.json | `type: leisure, leisure: {...}` | `facility_type: tavern` |
| library.json | `type: leisure, leisure: {...}` | `facility_type: library` |
| park.json | `type: leisure, leisure: {...}` | `facility_type: park` |
| cabin.json | `type: rest, leisure: null` | `facility_type: rest_inn` |
| farmstead.json | `type: rest, leisure: null` | `facility_type: rest_inn` |
| house.json | `type: rest, leisure: null` | `facility_type: rest_inn` |

**No `cottage.json` exists** in the current `locations/` directory. Earlier drafts incorrectly listed 4 rest facilities. Confirmed by `ls locations/ | grep -E "cabin|farmstead|house"` → 3 files.

**New location file:**
- `locations/smithy.json` — new Smithy facility somewhere near Workshop

### Item changes

- **`water`** item added (real inventory item like food)
- **`waterskin`** item removed
- Agent starting inventories: `waterskin(3)x1` → `water×3`

### Code deletions

- `src/infrastructure/systems/leisure-system.ts`
- `src/infrastructure/systems/rest-system.ts`
- `LocationSchema.production` field
- `LocationSchema.leisure` field
- `LocationSchema.type` field
- `FillWaterskin` BT action (from `bt-actions-needs.ts`)
- `bt-actions-leisure.ts`'s `Leisure`, `ChooseLeisure`, `SeekLeisureTarget` actions — replaced by a new `UseService` action
- `HasWater` condition's waterskin check (replaced with water item check)
- `waterskin` item file + all references
- Inline production handling in `facility-system.ts`

**NOT deleted (kept in place):**
- `Wander`, `Idle` BT actions — relocated from `bt-actions-leisure.ts` to `bt-actions-needs.ts` or `bt-actions.ts`
- `IsAtLeisure` condition — repurposed to `IsUsingService` or deleted if unused after the BT rewrite

### Code additions

- `src/domain/schemas/recipe-schema.ts`
- `src/domain/schemas/facility-type-schema.ts`
- `src/domain/systems/recipe.ts` — pure `applyRecipeCycle` function
- `src/domain/systems/facility-worker.ts` — **existing `findWorker` function extracted and moved** from `facility-system.ts:48-66` (not a new implementation). Same signature and behavior; all three systems import from the new shared location.
- `src/infrastructure/entity/recipe-loader.ts`
- `src/infrastructure/entity/facility-type-loader.ts`
- `src/infrastructure/systems/service-system.ts`
- `src/infrastructure/systems/area-effect-system.ts`
- `src/infrastructure/entity/bt-actions-service.ts` — new file containing `UseService`, `SeekService`, `ChooseServiceFacility`
- `memory.currentServiceVisit: { facilityId: string, ticksRemaining: number, costPaid: boolean } | null`
- `memory.pendingAreaModifiers: Array<{ kind: 'mood', delta: number }>`
- Updated `Drink` action (consumes water item instead of waterskin charge)
- Updated `MoodSystem` to read `pendingAreaModifiers` queue (drained each tick)
- Updated `GameCoreDeps` to carry `getFacilityTypeRegistry: () => Map<string, FacilityType>` and `getRecipeRegistry: () => Map<string, Recipe>`

### Quest generation updates

`QuestGenerationSystem` currently triggers on:
- Facility abandonment → repair quest
- Production input stock low → supply quest
- Production output stock low → restock quest (gated by `loc.type === 'market'`)

After migration:
- **Abandonment trigger unchanged** (`facility.fund <= 0` still drives abandonment via `AbandonmentSystem`)
- **Supply trigger** — reads `recipe.inputs` from the facility's active recipe (instead of `production.input`). Only applies to facilities where `facility_type.kind === 'production'`. Multi-input recipes generate one quest per missing input. If `active_recipe === null` (service/area_effect), skip.
- **Restock trigger** — replaces the `loc.type === 'market'` gate with `facility_type.id === 'market_stall'`. Reads the Market Stall's configured "restock threshold" (new field `restock_threshold_per_item: Record<string, number>` on `market_stall` facility type) and emits a restock quest for any item below threshold. Without this concrete replacement, the restock trigger would silently stop firing after migration and the market supply loop would break.

### Incidental call sites that read removed fields

The spec removes `location.type`, `location.production`, and `location.leisure` from the schema. The following 14 files currently read those fields and must be updated during Phase 2 or Phase 3. Each entry lists the file, what it reads, and the replacement. If any of these are missed, the tsc build breaks.

| File | Current reference | Replacement | Phase |
|---|---|---|---|
| `src/domain/systems/world-validation.ts` | `loc.type` for region placement rules | `registry.facilityType(loc.facility_type).kind` (map kind→category) | Phase 2 |
| `src/infrastructure/engine/debug-overlay.ts` | `loc.type` for `LOCATION_ICONS` lookup (12 sites) | Derive icon from `facility_type.id` via new `FACILITY_TYPE_ICONS` map | Phase 3 |
| `src/infrastructure/engine/debug-overlay.ts` | `loc.production.job` in anomaly detector | Read `facility_type.primary_job` | Phase 2 |
| `src/infrastructure/engine/debug-overlay.ts` | `loc.production.funding` | Read `facility_type.funding` | Phase 2 |
| `src/infrastructure/engine/game-view.ts` | `loc.type === 'rest' \| 'leisure' \| 'market'` (3 sites) | Replace with `facility_type.kind === 'service'` and `facility_type.id === 'market_stall'` where distinction matters | Phase 3 |
| `src/infrastructure/engine/game-view.ts` | `loc.production.funding` bootstrap fund | Read `facility_type.default_fund` + `facility_type.funding` | Phase 2 |
| `src/infrastructure/engine/world-loader.ts` | `loc.production.job/output/input` in world projection | Read from recipe + facility type registries | Phase 2 |
| `src/infrastructure/engine/world-loader.ts` | `loc.type` in world snapshot graph | Read `facility_type.id` or `facility_type.kind` | Phase 2 |
| `src/infrastructure/entity/bt-actions-leisure.ts` | `loc.type === 'leisure' \| 'rest'` for target lookup | **Entire file deleted in Phase 3** (actions replaced by `UseService`) | Phase 3 |
| `src/infrastructure/entity/bt-conditions-economy.ts` | `loc.type === 'market'` for `FacilityHasStock` | `facility_type.id === 'market_stall'` | Phase 3 |
| `src/infrastructure/systems/daily-report-system.ts` | `loc.production?.wage`, `loc.production?.job` | Read `facility_type.default_wage` + `facility_type.primary_job` | Phase 2 |
| `src/infrastructure/systems/economy-system.ts` | `loc.production !== null \|\| loc.type === 'market'` (controls price updates) | `facility_type.kind === 'production' \|\| facility_type.id === 'market_stall'` | Phase 2 |
| `src/infrastructure/systems/facility-system.ts` | Inline production — entire tick loop | Rewrite to read facility type + recipe registries | Phase 2 |
| `src/infrastructure/systems/gossip-system.ts` | `locationType: loc.type` in rumor payload | `facility_type.id` | Phase 3 |
| `src/infrastructure/systems/leisure-system.ts` | Entire file — `loc.type === 'leisure'`, `loc.leisure` | **Entire file deleted in Phase 3** | Phase 3 |
| `src/infrastructure/systems/rest-system.ts` | Entire file — `loc.type === 'rest'` | **Entire file deleted in Phase 3** | Phase 3 |
| `src/infrastructure/systems/subsidy-system.ts` | `loc.production !== null` (decides who gets subsidies) | `facility_type.kind === 'production' && facility_type.funding === 'facility'` | Phase 2 |
| `src/domain/systems/gossip.ts` | 5 references to `loc.type` in rumor generation | Map `facility_type.id` to human label | Phase 3 |

Every replacement is a read against the new registries (facility types + recipes) which are injected via `deps`. The spec's Phase 1 creates the loaders; Phase 2 wires the registry into `GameCoreDeps`; Phases 2 and 3 do the field replacements on the respective call sites. No site is left reading removed fields after Phase 3.

### Behavior Tree changes (`base.mdsl`)

The BT dsl file hardcodes action names. Three sections need rewriting:

**P0.3 (Drink fallback during critical thirst)** — current:
```
sequence {
    condition [IsThirsty]
    action [SeekWater]
    action [FillWaterskin]
    action [Drink]
}
```
After Phase 3:
```
sequence {
    condition [IsThirsty]
    flip { condition [HasWater] }
    action [SeekMarket]           // or SeekWell — whichever is closer
    action [BuyItem, "water"]
    action [Drink]
}
sequence {
    condition [IsThirsty]
    condition [HasWater]
    action [Drink]
}
```

**P2.5 (Leisure branch)** — current:
```
sequence {
    selector {
        condition [IsRestDay]
        condition [IsMoodLow]
    }
    flip { condition [IsNighttime] }
    action [ChooseLeisure]
    action [SeekLeisureTarget]
    action [Leisure] while(IsAtLeisure)
}
```
After Phase 3:
```
sequence {
    selector {
        condition [IsRestDay]
        condition [IsMoodLow]
    }
    flip { condition [IsNighttime] }
    action [ChooseServiceFacility, "leisure"]   // picks a service facility with mood effects
    action [SeekService]
    action [UseService] while(IsUsingService)
}
```

**P5 (Rest branch)** — current uses `SeekRest` + `Rest` actions pointing at `loc.type === 'rest'`. After Phase 3, uses the same `UseService` pattern but filtered by service facilities with `staffed_effects.energy > 0`.

**New BT actions to add** (in `bt-actions-service.ts`, new file):
- `ChooseServiceFacility(intent: string)` — picks a service facility from nearby by matching intent ('leisure', 'rest', 'bathhouse') to its primary effect type
- `SeekService()` — moves toward the chosen service facility; same shape as existing `SeekLeisureTarget`
- `UseService()` — initiates a service visit: checks `cost_per_visit`, sets `memory.currentServiceVisit = {facilityId, ticksRemaining: ticks_per_visit}`, commits the agent

**BT actions to delete** (in Phase 3): `FillWaterskin`, `ChooseLeisure`, `SeekLeisureTarget`, `Leisure`, `Rest`, `SeekRest`.

**BT actions renamed/repurposed**: `SeekRest` → `SeekService` (energy-focused). Alternatively keep `SeekRest` as a thin wrapper that calls `SeekService` with rest intent.

The full `base.mdsl` rewrite happens atomically in Phase 3's commit. `bt-loader.test.ts` must parse the new tree.

---

## Test Strategy

### New unit tests

**`tests/domain/systems/recipe.test.ts`** — pure `applyRecipeCycle` function:
- Cycle with no inputs (raw producer) — workProgress increments, eventually produces
- Cycle with matching inputs — inputs consumed, output produced
- Cycle with missing inputs — no progress, no fund drain
- Cycle without worker — no progress
- Tax calculation, wage routing

**`tests/domain/systems/facility-worker.test.ts`** — shared `findWorker`:
- Worker present, correct job, within radius → returns agent
- Worker present, wrong job → returns null
- Worker present, wrong action (`btAction !== 'work'`) → returns null
- Worker present, out of radius → returns null
- Multiple candidates → returns the one matching `workerId`

**`tests/infrastructure/entity/recipe-loader.test.ts`** + **`facility-type-loader.test.ts`**:
- Valid recipe/type loads correctly
- Invalid schema → throws
- Cross-reference validation (location references non-existent facility_type → error)

### New system tests

**`tests/infrastructure/systems/service-system.test.ts`:**
- Staffed visit → effects applied, cost collected, worker earns hourly wage
- Unstaffed visit → degraded effects, no cost, no wage
- Worker earns wage each tick while at the service facility
- Fund depletion → abandonment on next tick
- Multiple customers visiting simultaneously

**`tests/infrastructure/systems/area-effect-system.test.ts`:**
- Staffed pulse → agents in radius get modifier queued
- Unstaffed facility → no pulse
- Pulse frequency → only every `ticks_per_pulse`
- Multiple overlapping effects → modifiers stack in queue
- Worker earns wage on pulse

**`tests/infrastructure/systems/facility-system.test.ts`** (extended):
- Production with recipe inputs → inputs consumed correctly
- Production with missing recipe inputs → idle
- Aptitude scaling applied to recipe ticks

**`tests/infrastructure/systems/mood-system.test.ts`** (extended):
- Area modifiers from queue are applied
- Queue is drained after application
- Empty queue → no mood change from area effects

### BT / integration tests

- `ClaimBestJob` iterates all facility kinds
- Agent claims a service facility
- `Drink` action consumes water item
- `BuyItem("water")` works at Well
- `UseService` BT action initiates a visit

### Tests deleted / rewritten

- `tests/infrastructure/systems/leisure-system.test.ts` → rewritten as `service-system.test.ts`
- `tests/infrastructure/systems/rest-system.test.ts` → absorbed into `service-system.test.ts`
- Any test asserting `location.type === 'rest'` or `production.job === ...` → rewrite against new schema
- Fixtures using `waterskin` → rewrite with `water`

### Coverage target

≥75% line coverage on new systems and loaders (matches project standard).

**Test churn estimate (revised after reviewer findings):**

A grep for `waterskin | leisure: | type.*['"]rest['"] | type.*['"]leisure['"] | type.*['"]market['"]` across `tests/` yields ~200 hits across ~31 files. Not all are deletions — many are fixture literals that need rewriting to the new schema. Breakdown:

- ~40 test files need some edit (fixture updates, assertion changes)
- ~100-150 individual test cases need rewriting (mostly fixture replacement, small assertion tweaks)
- ~15 test cases fully deleted (e.g. `FillWaterskin`-specific cases)
- ~120 new test cases added (recipe, facility type loader, ServiceSystem, AreaEffectSystem, BT service actions, bootstrap)

**Phase 3 test churn is the largest single item in the plan.** Budget accordingly — rewriting 150 test cases to use new fixtures is 1-2 days of focused work.

---

## Implementation Phasing

Implementation lands in 6 commit-sized phases. Each phase leaves the build green.

### Phase 1 — Foundation (no behavior change)

Pure additions: schemas, loaders, shared helpers, new systems (not yet registered).

Files:
- Recipe schema + loader + tests
- Facility type schema + loader + tests
- `findWorker` helper + tests
- `applyRecipeCycle` pure function + tests
- ServiceSystem + AreaEffectSystem implementations (not yet in tick pipeline)

Test state: all existing 1489 tests pass + ~40 new unit tests.

Risk: very low.

### Phase 2 — Production migration

Big cut-over for production facilities.

Files:
- `recipes/` folder populated
- `facility-types/` for production kinds (farm, workshop, smithy, well, guard_post shell)
- Location files updated: farmland, workshop, spring→well, smithy (new), guard-post (temporary production kind)
- FacilitySystem refactor to use recipes
- QuestGenerationSystem reads recipe inputs
- World loader loads recipes + facility types

Test state: production tests updated, all pass.

Risk: medium. Contained to production code paths.

### Phase 3 — Service migration (water items + rest + leisure)

Highest-risk phase. Touches item schema, BT actions, many tests.

Files:
- `facility-types/` for service kinds (rest_inn, bathhouse, tavern, library, park, market_stall)
- Location files updated: cabin, farmstead, house, bathhouse, tavern, library, park, market
- ServiceSystem registered in tick pipeline
- LeisureSystem, RestSystem deleted
- Water item added, waterskin removed
- `Drink` action uses water items
- `FillWaterskin` deleted
- `HasWater` condition updated
- BT P3/P4/P5 branches updated (rest + leisure + water)
- Agent spawn inventory migrated
- All affected tests updated

Test state: all pass. Recording gate recommended after this phase.

Risk: high.

### Phase 4 — Area effect (Guard Post)

Guard Post becomes area-effect facility.

Files:
- `facility-types/guard_post.json` finalized as area_effect
- AreaEffectSystem registered in tick pipeline (before MoodSystem)
- `pendingAreaModifiers` queue added to working memory
- MoodSystem reads + applies the queue
- Guard Post location file cleaned up

Test state: all pass.

Risk: low.

### Phase 5 — Job expansion + hiring

New jobs registered, hiring generalized.

Files:
- 8 new entries in `config.jobs.definitions`
- `ClaimBestJob` iterates all facility types (if not done in phase 2)

Risk: low.

### Phase 6 — Docs + cleanup

GDD §5.4, §6 updated to match implementation. arc42 §6.6 refreshed. Final verification.

Risk: zero.

### Manual recording verification gate

Between Phase 4 and Phase 5, run a new Obsidian recording session to verify:

- Production economy runs (all 4 producers active under staffed conditions)
- Agents drink water items without waterskin
- Guard Post provides observable mood buff
- Services pay hourly wages while staffed
- Service facilities go abandoned when fund depletes
- Quest generation creates supply/restock quests with new recipe inputs

If the recording is green, proceed to Phase 5 and 6. If not, fix and re-verify before advancing.

---

## Deviations from GDD

GDD §5.4 and §6 describe the recipe/job system. The spec follows the GDD structurally but diverges in these specific places:

- **Recipes as JSON, not markdown.** GDD §5.4 says "Each recipe is a markdown file with Zod-validated frontmatter." We use JSON for recipes and facility types because (a) they're pure data with no prose body, (b) JSON is the convention already used for `locations/*.json`, (c) Zod validation works identically against both formats. Items keep their existing markdown format (they have prose descriptions). If the Director ever wants to add prose/flavor text to recipes, we migrate to markdown at that point.
- **No processing / crafting / construction recipe subtypes.** GDD distinguishes them; we use one uniform `Recipe` schema. Subtypes added later if needed.
- **Jobs stay in `game-config.json`, not separate markdown files.** GDD §6.2 describes a job-baker.md schema. We extend the existing `config.jobs.definitions` map instead, because no gameplay difference exists yet and it avoids loader plumbing.
- **Services are a facility type kind, not a separate "service job" concept.** GDD §6.1 splits jobs into "product" and "service" types. Our split is at the facility type level (production vs service vs area_effect). The job name on a service facility is just a name; no `type: service` marker on the job itself.

## Out of Scope (explicit YAGNI)

The following GDD features are **not** implemented in this pass. Each can be added later as a separate spec once concrete need arises.

- **Recipe subtypes** (processing / crafting / construction) — one generic recipe type covers current needs
- **Recipe `xp_reward`** — skill progression already handled by FacilitySystem based on job
- **Recipe `min_skill_level` gating** — field exists in schema, always 0 in first pass
- **Spoilage** (`spoilage_ticks`) — not modeled
- **Multi-output recipes** — schema supports `outputs: []` as array for forward compat, always length 1 in first pass
- **Multi-recipe facilities** — single `active_recipe` only
- **Operating schedules per facility** — all facilities use existing `IsWorkHours` config (no tavern-runs-at-night yet)
- **Service cooldowns** (`cooldown_ticks` between visits) — agents can visit continuously
- **Service quality scaling** from worker skill — flat effects applied
- **Job days_off** — 7-day cycle rest days handled by existing `IsRestDay`
- **Job status requirements** — all jobs claimable by anyone with matching attribute
- **Construction recipes** — multi-day construction time, Director building placement — future phase
- **Worker capacity > 1** — `capacity` field kept for future, but facilities accept only 1 worker in first pass

---

## Success Criteria

After all 6 phases land, a new recording session should show:

Each row has an objective measurement method so the post-migration recording can be scored without interpretation.

| Metric | Baseline (recording 1639) | Target | Measurement |
|---|---|---|---|
| Equipment production | zero producer | ≥5 equipment items produced per 1000 ticks | Count `ProductionComplete` events where `outputItem === 'equipment'` in recent-events section |
| Bram work actions | 0 `Work` in 85 days | ≥20 `Work` actions over 500 ticks | Count snapshots where `Bram.Action === 'work'` and divide by snapshot count |
| Market water stock | zero (water not an item) | Market shows `water×N` in stock at least once | Grep `Market Stall.*water` across snapshots |
| Drink uses water items | `FillWaterskin` still present | zero `FillWaterskin` events, ≥1 `Drink` event with water consumed | Recent-events log has no `FillWaterskin` emission |
| Guard Post impact | unused | Agents in radius show mood breakdown with `area +2` factor | Mood factor breakdown in snapshot shows `area` contribution > 0 when agent is near guard post |
| Facility stocks | Farmland / Workshop only | all 4 producers have non-zero stock at some point | Grep `Farmland \| Workshop \| Smithy \| Well` for non-empty stock |
| Service visits | `LeisureSystem` applies effects | `ServiceDelivered` events emitted, agent mood changes observably | Recent events log has `ServiceDelivered` entries |
| Abandonment | fund-driven (unchanged) | no abandonment regressions vs baseline | Count `[HIGH] Facility ... abandoned` anomalies |
| Test suite | 1489 pass | 1570-1620 pass (+120 new, -15 deleted, ~100 rewritten) | `npx vitest run` green |

The recording after Phase 4 is the primary verification gate. If core metrics regress, we fix before shipping Phase 5/6.

---

## Risks

1. **Phase 3 (water + services)** is the highest-risk phase. Many test fixtures use `waterskin`, BT actions change, item schema changes. Budget extra verification time.

2. **Worker scarcity** — with 3 agents and 11+ facility types, most service facilities will be unstaffed. The degraded service mode is designed for this, but it's a noticeable gameplay shift from "any rest facility is usable". Expect initial confusion when agents can't find a staffed inn.

3. **Service fund depletion** — hourly wages + no customers = rapid fund drain. A bathhouse with 150g fund and 2g/tick wage abandons after 75 ticks if no customers visit. That's ~15s at x10 speed. We may need to raise default_fund for services, or reduce default_wage, after observing the first recording.

4. **Equipment supply chain** — Smithy requires tools as input. If the Workshop → Smithy haul quest doesn't fire reliably, Smithy stays idle and equipment remains scarce. Existing supply-chain quest system should cover this, but it's an integration point to verify.

5. **Smithy job scoring** — `blacksmith` uses ST as primary. Bram (ST 14) is the strongest ST agent in the default roster. His hiring may flip from guard → blacksmith, which breaks guard post staffing. May need to tune the agent roster or job attributes.

---

## Open questions — resolved

All reviewer-flagged open questions are decided here so implementation can proceed without further clarification.

- **Service fund floor**: **no special floor**. `facility.fund <= 0` → AbandonmentSystem marks abandoned on next tick (existing behavior). Fragility is intentional per Decision 10. If this turns out to be too aggressive in the first recording, raise `default_fund` on service types in a config patch rather than adding new mechanics.
- **BT prefers staffed services**: **yes**, the new `ChooseServiceFacility` action scores candidates with a preference for staffed facilities (same cost, better effects). Unstaffed is a fallback only.
- **Smithy input scope**: **tools only** (1 tool per equipment). Keeps supply chain short and the first-pass content load small. If equipment scarcity turns out to be boring, add ore/iron as a second input in a future spec.
- **Market Stall as service kind**: **yes, accepted as an architectural smell but not a blocker**. Market Stall doesn't fit cleanly — it has no effects, no cost, no real service. It's modeled as `kind: service` because (a) that lets it have a worker requirement uniformly, (b) ServiceSystem's visit loop is a no-op for facilities with zero effects + zero cost, (c) adding a 4th kind `trade_hub` just for one facility type is YAGNI. If we ever add a second trade facility (e.g., black market, auction house), consider promoting `trade` to a proper kind.

## Items tracked for post-migration observation

- **Guard Post causes `blacksmith` flip risk**: Bram has ST 14 (strongest), making him the best candidate for Smithy (ST primary). If `ClaimBestJob` flips him from guard → blacksmith, Guard Post goes unstaffed. Not a blocker for this spec, but observe in the first recording and tune agent attributes or `blacksmith.primary_attribute` if the problem is severe.
- **Waterskin `charges` infrastructure**: removing `waterskin` removes one consumer of the `item.charges` mechanic, but `equipment.charges` remains (equipment decay/repair). The charges concept stays in the item schema and inventory code.
- **Service wage drain**: hourly wages without customers may bankrupt services faster than expected at x10 speed. First recording will reveal the time-to-abandon for a bathhouse with 150g fund and 2g/tick wage. Adjust `default_fund` via config if needed.
