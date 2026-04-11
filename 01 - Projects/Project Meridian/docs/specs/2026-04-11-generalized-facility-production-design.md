# Generalized Facility Production — Design

**Status:** Draft
**Date:** 2026-04-11
**Source:** Review of recording 2026-04-11-1639 + user requirements for generalized production/service/area-effect facility model
**Scope:** Full refactor of the facility, production, recipe, and service subsystems — ~70 files touched, ~1360 LoC added, ~450 LoC deleted, ~98 new tests
**Replaces:** inline production config + separate `LeisureSystem` / `RestSystem` / direct-interaction water source
**Follows GDD §5.4 / §6** (with YAGNI scoping — see "Out of scope")

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
  id: z.string().regex(/^recipe-[a-z0-9-]+$/),
  name: z.string().min(1),
  inputs: z.array(z.object({
    item_id: z.string(),
    quantity: z.number().int().min(1),
  })).default([]),                              // empty for raw producers
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

### Facility type schema

`src/domain/schemas/facility-type-schema.ts`:

```typescript
const CommonFields = z.object({
  id: z.string().regex(/^[a-z_]+$/),
  primary_job: z.string(),
  default_wage: z.number().min(0).default(3),
  default_fund: z.number().min(0).default(200),
  funding: z.enum(['facility', 'treasury']).default('facility'),
  capacity: z.number().int().min(1).default(1),   // max workers (kept for future)
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
  lastPulseTick: number;        // NEW — for area_effect kind
  currentPrices?: Record<string, number>;  // unchanged — EconomySystem writes
}
```

Only addition is `lastPulseTick` for area-effect pulse tracking.

### Item schema (water addition)

`03 - Resources/items/water.md` (new):

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

`03 - Resources/items/waterskin.md` → **deleted**.

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
      wage: recipe.wage_override ?? facilityType.default_wage,
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
          // can't afford — mark abandoned on next eval
          emit 'FacilityInsolvent'
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

Visits are tracked via a new `memory.currentServiceVisit: { facilityId, ticksRemaining } | null` field. A new `UseService` BT action initiates a visit (checks cost, moves into facility, starts countdown).

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

### Wage model summary

| Kind | When wage paid | Source | Amount |
|---|---|---|---|
| Production | On cycle complete | Fund (private) or treasury (public) | `recipe.wage_override ?? facility_type.default_wage` |
| Service | Every tick while worker present | Fund (private) or treasury (public) | `facility_type.default_wage` |
| Area effect | On pulse tick | Fund or treasury | `facility_type.default_wage` |

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

| File | Kind | Primary job | Key config |
|---|---|---|---|
| `farm.json` | production | settler | `allowed_recipes: [farm-wheat]` |
| `workshop.json` | production | craftsman | `allowed_recipes: [craft-tools]` |
| `smithy.json` | production | blacksmith | `allowed_recipes: [smithy-equipment]` |
| `well.json` | production | water_carrier | `allowed_recipes: [draw-water]` |
| `guard_post.json` | area_effect | guard | `modifier: mood +2, radius: 150, ticks_per_pulse: 30` |
| `rest_inn.json` | service | innkeeper | staffed: `energy+8, mood+3`; unstaffed: `energy+4`; cost: 2 |
| `bathhouse.json` | service | bathhouse_keeper | staffed: `mood+15, energy+5`; unstaffed: `mood+5`; cost: 5 |
| `tavern.json` | service | bartender | staffed: `social+15, mood+10`; unstaffed: `social+5, mood+3`; cost: 5 |
| `library.json` | service | librarian | staffed: `mood+10, skill_xp+1`; unstaffed: `mood+3`; cost: 3 |
| `park.json` | service | park_keeper | staffed: `mood+8, energy+3`; unstaffed: `mood+5, energy+2`; cost: 0 |
| `market_stall.json` | service | shopkeeper | staffed: `mood+2`; unstaffed: `mood+0`; cost: 0 (just a trade hub) |

`rest_inn.json` is shared across the 4 existing rest facilities (cabin, cottage, farmstead, house) per user decision.

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
| cottage.json | `type: rest, leisure: null` | `facility_type: rest_inn` |
| farmstead.json | `type: rest, leisure: null` | `facility_type: rest_inn` |
| house.json | `type: rest, leisure: null` | `facility_type: rest_inn` |

**New location file:**
- `locations/smithy.json` — new Smithy facility somewhere near Workshop

### Item changes

- **`water`** item added (real inventory item like food)
- **`waterskin`** item removed
- Agent starting inventories: `waterskin(3)x1` → `water×3`

### Code deletions

- `src/infrastructure/systems/leisure-system.ts`
- `src/infrastructure/systems/rest-system.ts` (if exists as standalone)
- `LocationSchema.production` field
- `LocationSchema.leisure` field
- `LocationSchema.type` field
- `FillWaterskin` BT action
- `HasWater` condition's waterskin check (replaced with water item check)
- Inline production handling in `facility-system.ts`

### Code additions

- `src/domain/schemas/recipe-schema.ts`
- `src/domain/schemas/facility-type-schema.ts`
- `src/domain/systems/recipe.ts` — pure `applyRecipeCycle` function
- `src/domain/systems/facility-worker.ts` — shared `findWorker` helper
- `src/infrastructure/entity/recipe-loader.ts`
- `src/infrastructure/entity/facility-type-loader.ts`
- `src/infrastructure/systems/service-system.ts`
- `src/infrastructure/systems/area-effect-system.ts`
- `UseService` BT action (for service visits)
- `memory.currentServiceVisit` and `memory.pendingAreaModifiers` working memory fields
- Updated `Drink` action (consumes water item)
- Updated `MoodSystem` to read `pendingAreaModifiers`

### Quest generation updates

`QuestGenerationSystem` currently triggers on:
- Facility abandonment → repair quest
- Production input stock low → supply quest
- Production output stock low → restock quest

After migration:
- **Abandonment trigger unchanged** (facility.fund <= 0 still drives abandonment)
- **Supply trigger** now reads `recipe.inputs` from the facility's active recipe (instead of `production.input`). Multi-input recipes generate one quest per missing input.
- **Restock trigger** reads the facility type's expected stock (for service facilities, may be different mechanic — defer to future spec)

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

≥75% line coverage on new systems and loaders (matches project standard). Estimated new test count: ~98 cases; estimated deleted: ~15.

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
- Location files updated: cabin, cottage, farmstead, house, bathhouse, tavern, library, park, market
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

| Metric | Baseline (recording 1639) | Target |
|---|---|---|
| Equipment production | zero producer | at least Smithy produces equipment when staffed |
| Bram as guard | 0 Work actions | measurable Work actions at Guard Post (assuming staffed + equipped) |
| Market water stock | zero (water not an item) | water items reach Market via supply or Well |
| Agents drink water items | use waterskin | `Drink` consumes water items |
| Guard Post impact | unused | observable `+2 mood/tick` while agents are in radius |
| Facility stocks | Farmland / Workshop only | all 4 producers populated |
| Service visits | `LeisureSystem` applies effects | `ServiceSystem` applies effects + pays wages + collects costs |
| Abandonment | fund-driven (unchanged) | works identically for all kinds |
| Test suite | 1489 pass | 1570ish pass (+98 new, -15 deleted) |

The recording after Phase 4 is the primary verification gate. If core metrics regress, we fix before shipping Phase 5/6.

---

## Risks

1. **Phase 3 (water + services)** is the highest-risk phase. Many test fixtures use `waterskin`, BT actions change, item schema changes. Budget extra verification time.

2. **Worker scarcity** — with 3 agents and 11+ facility types, most service facilities will be unstaffed. The degraded service mode is designed for this, but it's a noticeable gameplay shift from "any rest facility is usable". Expect initial confusion when agents can't find a staffed inn.

3. **Service fund depletion** — hourly wages + no customers = rapid fund drain. A bathhouse with 150g fund and 2g/tick wage abandons after 75 ticks if no customers visit. That's ~15s at x10 speed. We may need to raise default_fund for services, or reduce default_wage, after observing the first recording.

4. **Equipment supply chain** — Smithy requires tools as input. If the Workshop → Smithy haul quest doesn't fire reliably, Smithy stays idle and equipment remains scarce. Existing supply-chain quest system should cover this, but it's an integration point to verify.

5. **Smithy job scoring** — `blacksmith` uses ST as primary. Bram (ST 14) is the strongest ST agent in the default roster. His hiring may flip from guard → blacksmith, which breaks guard post staffing. May need to tune the agent roster or job attributes.

---

## Open questions for reviewers

- Should services have a minimum fund floor where they stop paying wages but don't immediately abandon? (Prevents rapid empty-bathhouse shutdown while still modeling financial stress.)
- Should service facilities advertise their staffed/unstaffed state to agents so the BT can prefer staffed ones? (Small feature but meaningful.)
- Should the Smithy's `smithy-equipment` recipe require more than just tools? (Would create longer supply chain at the cost of more content.)
- Is the Market Stall really a `service` facility, or is it a fourth kind (trade hub)? Currently modeled as service with negligible effects because it doesn't fit any kind cleanly.
