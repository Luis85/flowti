# Phase 1C: Agent Agency — Design Spec

## 1. Goal

Give agents agency — the ability to perceive their environment, make decisions based on internal state, and act. Built on Phase 1B's life systems (needs, mood, memory, traits), Phase 1C adds time cycles, spatial awareness, behavior trees, and movement. The result: agents that get hungry and walk to the tavern, get tired and seek rest, get lonely and approach other agents.

## 2. Exit Criteria

1. DayNightSystem cycles through dawn/day/dusk/night phases (~2 min real time per cycle)
2. PerceptionSystem provides distance-based awareness with night penalty
3. BehaviorTreeSystem evaluates JSON-defined BTs, selects actions from agent state
4. MovementSystem moves agents toward targets at attribute-derived speed
5. GameRNG provides seeded, deterministic randomness per agent per tick
6. World locations loaded from vault JSON, validated with Zod
7. Agents autonomously seek food, rest, and social interaction based on their needs
8. All events emitted with correct payloads (DayPhaseChanged, AgentArrived, BTActionSelected)
9. All Phase 0 + 1A + 1B tests still pass (no regressions)
10. ~40 new tests, all passing
11. tsc, eslint, build all green
12. Plugin settings expose tick rate, day cycle duration, and perception radius

## 3. Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| BT format | JSON files validated with Zod | Unambiguous, machine-parseable, consistent with agent schema pattern |
| BT evaluation | Pure domain function, stateless per tick | Each tick re-evaluates from root — no persistent BT state needed for Phase 1C's simple trees |
| Movement | Continuous pixel-space, speed from DX | ExcaliburJS handles Actor position natively; grid/pathfinding deferred to later phases |
| Perception | Distance radius × IQ scaling × night modifier | Config-driven, uses existing `perception` and `day_night` config schemas |
| Time | Tick-counter modulo cycle length | Simple, deterministic, no wall-clock dependency |
| World entity | Singleton Actor for TimeComponent | Keeps per-tick data in ECS; systems query it like any other component |
| RNG | Seeded mulberry32 per agent per tick | Deterministic replay; seed = `baseSeed XOR tickCount XOR agentIdHash` |
| Location data | Vault JSON in `03 - Resources/Locations/` | Matches agent/persona vault pattern; user-editable in Obsidian |
| Plugin settings | Tick rate, day cycle, perception radius | Exposed in MeridianSettingsTab; hot-swapped via existing `applySettings()` path |

## 4. Detailed Design

### 4.1 File Map

```
New domain files:
  domain/systems/day-night.ts          — pure time advancement
  domain/systems/perception.ts         — pure distance-based awareness
  domain/systems/behavior-tree.ts      — pure BT evaluator
  domain/systems/movement.ts           — pure position stepping
  domain/core/game-rng.ts              — seeded PRNG factory
  domain/core/component-data.ts        — add TimeState, PerceptionState (modify)
  domain/schemas/location-schema.ts    — Zod schema for world locations
  domain/schemas/behavior-tree-schema.ts — Zod schema for BT JSON

New infrastructure files:
  infrastructure/systems/day-night-system.ts        — GameSystem wrapper (priority 0.7)
  infrastructure/systems/perception-system.ts       — GameSystem wrapper (priority 3)
  infrastructure/systems/behavior-tree-system.ts    — GameSystem wrapper (priority 5)
  infrastructure/systems/movement-system.ts         — GameSystem wrapper (priority 5.5)
  infrastructure/components/time-component.ts       — singleton world time
  infrastructure/components/perception-component.ts — per-agent awareness
  infrastructure/entity/location-loader.ts          — vault → schema → location list
  infrastructure/entity/bt-loader.ts                — vault → schema → BT definitions

Modified files:
  domain/core/settings.ts              — add tick rate, day cycle, perception radius
  infrastructure/settings/settings-tab.ts — add UI controls for new settings
  infrastructure/engine/game-view.ts   — load locations + BTs, register 4 new systems
  plugin.ts                            — thread new settings to deps

New test files:
  tests/domain/systems/day-night.test.ts
  tests/domain/systems/perception.test.ts
  tests/domain/systems/behavior-tree.test.ts
  tests/domain/systems/movement.test.ts
  tests/domain/core/game-rng.test.ts
  tests/infrastructure/systems/day-night-system.test.ts
  tests/infrastructure/systems/perception-system.test.ts
  tests/infrastructure/systems/behavior-tree-system.test.ts
  tests/infrastructure/systems/movement-system.test.ts
  tests/infrastructure/entity/location-loader.test.ts
  tests/infrastructure/entity/bt-loader.test.ts
  tests/integration/agency-integration.test.ts
```

### 4.2 Pure Domain Functions

#### `domain/core/game-rng.ts`

Seeded PRNG for deterministic behavior variance.

```typescript
export interface GameRNG {
  next(): number;              // [0, 1)
  range(min: number, max: number): number;  // [min, max)
  chance(probability: number): boolean;     // true with given probability
}

export function createGameRNG(seed: number): GameRNG
```

Implementation: mulberry32 algorithm. Seed is constructed per agent per tick by the BT system: `baseSeed XOR tickCount XOR hash(agentId)`. This gives each agent different but reproducible rolls.

#### `domain/systems/day-night.ts`

Stateless time advancement. No side effects, no EventBus, no ECS.

```typescript
export interface TimeState {
  phase: 'dawn' | 'day' | 'dusk' | 'night';
  tickInCycle: number;
  dayCount: number;
}

export interface DayNightConfig {
  ticks_per_day: number;       // from config root (default 480)
  day_night: {
    dawn:  { start: number; end: number };  // absolute tick ranges within cycle
    day:   { start: number; end: number };
    dusk:  { start: number; end: number };
    night: { start: number; end: number };
  };
}

export interface DayNightResult {
  state: TimeState;
  phaseChanged: boolean;
  previousPhase: string;
}

export function advanceTime(
  currentTick: number,
  config: DayNightConfig,
): DayNightResult
```

**Formula:**
```
tickInCycle = currentTick % ticks_per_day
dayCount = floor(currentTick / ticks_per_day)
phase = first config.day_night entry where tickInCycle >= start AND tickInCycle <= end
fallback: 'night' if no phase matches (misconfigured boundaries)
```

Default config (tick_interval_ms=500, ticks_per_day=480 → 4 min real time per day):
- dawn: ticks 0–59 (0–30s)
- day: ticks 60–299 (30s–150s)
- dusk: ticks 300–359 (150s–180s)
- night: ticks 360–479 (180s–240s)

Note: plugin settings expose `dayCycleDuration` (seconds) which recalculates `ticks_per_day` at runtime as `dayCycleDuration × 1000 / tick_interval_ms`.

#### `domain/systems/perception.ts`

Stateless distance-based awareness.

```typescript
export interface PerceptionInput {
  agentPos: { x: number; y: number };
  agentIQ: number;
  agents: { id: string; pos: { x: number; y: number } }[];
  locations: { id: string; type: string; pos: { x: number; y: number } }[];
  timePhase: string;
}

export interface PerceptionResult {
  nearbyAgents: { id: string; distance: number }[];
  nearbyLocations: { id: string; type: string; distance: number }[];
}

export function resolvePerception(
  input: PerceptionInput,
  config: { base_multiplier: number; night_multiplier: number },
): PerceptionResult
```

**Formula:**
```
radius = base_multiplier × agentIQ
if timePhase === 'night': radius *= night_multiplier
```

Returns entities sorted by distance (nearest first). The agent itself is excluded from `nearbyAgents`.

#### `domain/systems/behavior-tree.ts`

Stateless BT evaluator. Walks the tree top-down, returns the first successful action.

```typescript
export type BTNode =
  | { type: 'selector'; children: BTNode[] }
  | { type: 'sequence'; children: BTNode[] }
  | { type: 'condition'; check: string; params: Record<string, unknown> }
  | { type: 'action'; action: string; params: Record<string, unknown> };

export interface BTContext {
  needs: NeedsState;
  mood: MoodState;
  perception: PerceptionResult;
  timePhase: string;
  rng: GameRNG;
}

export type BTStatus = 'success' | 'failure';

export interface BTResult {
  status: BTStatus;
  action: string | null;
  params: Record<string, unknown>;
}

export function evaluateBT(root: BTNode, context: BTContext): BTResult
```

**Node semantics:**
- `selector`: try children in order, return first success (OR)
- `sequence`: try children in order, fail on first failure (AND)
- `condition`: evaluate a named check against context → success/failure
- `action`: always succeeds, returns the action name + params

**Built-in conditions:**
| Check | Params | Logic |
|-------|--------|-------|
| `need_critical` | `{ need }` | need value < critical threshold (hunger:20, energy:15, social:25) |
| `need_below` | `{ need, threshold }` | need value < threshold |
| `mood_is` | `{ bucket }` | current mood bucket matches |
| `time_is` | `{ phase }` | current time phase matches |
| `nearby_location` | `{ locationType }` | perception has a location of given type |
| `nearby_agent` | `{}` | perception has at least one agent |
| `chance` | `{ probability }` | rng.chance(probability) — probabilistic branching. In a `sequence`, a failed roll aborts the sequence (AND semantics) — use inside a `selector` to provide fallback behavior. |

**Built-in actions:**
| Action | Params | Effect (written to blackboard by system) |
|--------|--------|------------------------------------------|
| `move_to_nearest` | `{ locationType }` | Find nearest location of type from perception, set as movement target |
| `move_to_agent` | `{}` | Find nearest agent from perception, set as movement target |
| `idle` | `{}` | Clear movement target, agent stays put |
| `rest` | `{}` | Clear movement target, recover energy (future: tied to rest location) |
| `eat` | `{}` | Clear movement target, recover hunger (future: tied to food source) |

#### `domain/systems/movement.ts`

Stateless position stepping.

```typescript
export interface MovementInput {
  currentPos: { x: number; y: number };
  targetPos: { x: number; y: number };
  speed: number;
  deltaTicks: number;
}

export interface MovementResult {
  newPos: { x: number; y: number };
  arrived: boolean;
}

export function computeMovement(input: MovementInput): MovementResult
```

**Formula:**
```
direction = normalize(targetPos - currentPos)
stepSize = speed × deltaTicks
if distance(currentPos, targetPos) <= stepSize:
  arrived = true, newPos = targetPos
else:
  newPos = currentPos + direction × stepSize
```

Speed is derived by the system wrapper: `agentDX / config.formulas.basic_speed_divisor` (basic_speed_divisor default: 4, so DX 10 → speed 2.5 px/tick).

### 4.3 Infrastructure GameSystems

All systems implement the `GameSystem` interface from Phase 1A. Each receives entity queries at construction time.

#### `infrastructure/systems/day-night-system.ts` (priority `SystemPriority.DAY_NIGHT`)

```typescript
export function createDayNightSystem(
  worldEntity: () => Actor,
): GameSystem
```

- Reads `deps.tickCount` and `deps.config.day_night`
- Calls `advanceTime()`
- Writes result to `TimeComponent` on the world entity
- Emits `DayPhaseChanged` on transition

#### `infrastructure/systems/perception-system.ts` (priority `SystemPriority.PERCEPTION`)

```typescript
export function createPerceptionSystem(
  agents: () => AgentActor[],
  locations: () => WorldLocation[],
  worldEntity: () => Actor,
): GameSystem
```

- Reads each agent's position + `AttributesComponent.IQ`
- Reads `TimeComponent.phase` from world entity
- Reads `deps.config.perception`
- Calls `resolvePerception()` per agent
- Writes `PerceptionComponent` on each agent

#### `infrastructure/systems/behavior-tree-system.ts` (priority `SystemPriority.BEHAVIOR_TREE`)

```typescript
export function createBehaviorTreeSystem(
  agents: () => AgentActor[],
  btDefinitions: Record<string, BTNode>,
  worldEntity: () => Actor,
  baseSeed: number,
): GameSystem
```

- Reads `NeedsComponent`, `MoodComponent`, `PerceptionComponent`, `TimeComponent`
- Constructs `BTContext` per agent
- Creates per-agent `GameRNG` from `baseSeed XOR tickCount XOR agentIdHash`
- Calls `evaluateBT()` with the agent's BT definition (keyed by `agent.behavior_tree` which must match a loaded BT's `id` field)
- Writes action result to `BlackboardComponent`:
  - `blackboard.btAction` = action name
  - `blackboard.movementTarget` = `{ x, y }` (resolved from perception) or null
- Emits `BTActionSelected` with `{ agentId, action, params }`

#### `infrastructure/systems/movement-system.ts` (priority `SystemPriority.MOVEMENT`)

```typescript
export function createMovementSystem(
  agents: () => AgentActor[],
): GameSystem
```

- Reads `BlackboardComponent.movementTarget` from each agent
- If no target, skip (agent is idle)
- Reads `AttributesComponent.DX` for speed calculation
- Calls `computeMovement()`
- Updates actor position (`entity.pos`)
- On arrival: emits `AgentArrived` with `{ agentId, targetId, targetType }`, clears `movementTarget`

### 4.4 New Components

#### `infrastructure/components/time-component.ts`

Singleton — attached to a world entity, not per-agent.

```typescript
import type { TimeState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class TimeComponent extends TrackedComponent {
  constructor(public state: TimeState) { super(); }
}
```

#### `infrastructure/components/perception-component.ts`

Per-agent — written fresh each tick.

```typescript
import type { PerceptionState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class PerceptionComponent extends TrackedComponent {
  constructor(public state: PerceptionState) { super(); }
}
```

### 4.5 Component Data Interfaces (Domain Additions)

Add to `domain/core/component-data.ts` (source of truth — domain systems import from here, not re-declare):

```typescript
export interface TimeState {
  phase: 'dawn' | 'day' | 'dusk' | 'night';
  tickInCycle: number;
  dayCount: number;
}

export interface PerceptionState {
  nearbyAgents: { id: string; distance: number }[];
  nearbyLocations: { id: string; type: string; distance: number }[];
}
```

### 4.6 Schemas

#### `domain/schemas/location-schema.ts`

```typescript
export const LocationSchema = z.object({
  id: z.string().regex(/^loc-[a-z0-9-]+$/),
  name: z.string().min(1),
  type: z.enum(['rest', 'food', 'social', 'work', 'market']),
  position: PositionSchema,
  capacity: z.number().int().min(1).default(10),
});

export type WorldLocation = z.infer<typeof LocationSchema>;
```

#### `domain/schemas/behavior-tree-schema.ts`

Recursive Zod schema for BT nodes:

```typescript
const BTConditionSchema = z.object({
  type: z.literal('condition'),
  check: z.string(),
  params: z.record(z.unknown()).default({}),
});

const BTActionSchema = z.object({
  type: z.literal('action'),
  action: z.string(),
  params: z.record(z.unknown()).default({}),
});

const BTNodeSchema: z.ZodType<BTNode> = z.lazy(() =>
  z.discriminatedUnion('type', [
    z.object({ type: z.literal('selector'), children: z.array(BTNodeSchema) }),
    z.object({ type: z.literal('sequence'), children: z.array(BTNodeSchema) }),
    BTConditionSchema,
    BTActionSchema,
  ])
);

export const BehaviorTreeSchema = z.object({
  id: z.string(),
  root: BTNodeSchema,
});
```

### 4.7 Data Loaders

#### `infrastructure/entity/location-loader.ts`

Same pattern as `agent-spawner.ts`:

```typescript
export function createLocationLoader(
  logger: Logger,
): { loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<WorldLocation>> }
```

Reads `03 - Resources/Locations/*.json`, validates with `LocationSchema`, collects errors.

#### `infrastructure/entity/bt-loader.ts`

```typescript
export function createBTLoader(
  logger: Logger,
): { loadFromVault(vault: VaultReader, path: string): Promise<LoadResult<BehaviorTree>> }
```

Reads `03 - Resources/BehaviorTrees/*.json`, validates with `BehaviorTreeSchema`, collects errors.

### 4.8 Events

| Event | Source System | Payload |
|-------|-------------|---------|
| `DayPhaseChanged` | DayNightSystem | `{ oldPhase: string, newPhase: string, dayCount: number }` |
| `BTActionSelected` | BehaviorTreeSystem | `{ agentId: string, action: string, params: Record<string, unknown> }` |
| `AgentArrived` | MovementSystem | `{ agentId: string, targetId: string, targetType: string }` |

All events follow the `GameEvent` interface: `{ type, tick, wallClock, source, payload }`.

### 4.9 Plugin Settings

Add to `domain/core/settings.ts`:

```typescript
export interface MeridianSettings {
  logLevel: LogLevel;           // existing — import from logger.ts
  debugMode: boolean;           // existing
  performanceTracking: boolean; // existing
  tickRate: number;             // NEW — target ticks/second (default 60)
  dayCycleDuration: number;     // NEW — seconds per full day/night cycle (default 120)
  perceptionRadius: number;     // NEW — base perception multiplier (default 150)
}
```

Settings tab (`MeridianSettingsTab`) gets 3 new slider controls.

`applySettings()` in `plugin.ts` propagates changes to `GameCoreDeps.config` at runtime — same hot-swap pattern as Phase 1B.

**Derived config value:** `ticks_per_cycle = tickRate × dayCycleDuration` (computed when settings change, written into the config object).

### 4.10 World Data

#### Location files in `03 - Resources/Locations/`

Shipped with the build (same vault overlay pattern as agents/personas):

```
03 - Resources/Locations/
  tavern.json       — type: rest
  market.json       — type: food
  town-square.json  — type: social
  workshop.json     — type: work
```

#### BT files in `03 - Resources/BehaviorTrees/`

```
03 - Resources/BehaviorTrees/
  bt-merchant.json
  bt-guard.json
  bt-scholar.json
  bt-artisan.json
```

Agent JSON references these by filename in `behavior_tree` field (updated from `.md` to `.json`).

### 4.11 Plugin + Game View Wiring

**`game-view.ts` changes:**
After existing agent spawn block:
1. Load locations from `03 - Resources/Locations` via `locationLoader`
2. Load BT definitions from `03 - Resources/BehaviorTrees` via `btLoader`
3. Create world entity (Actor) with `TimeComponent`
4. Add `PerceptionComponent` to each spawned agent
5. Register 4 new systems with tick runner

**`vite.config.ts` changes:**
Add two more `copyDir` calls:
- `locations/` → `dist/03 - Resources/Locations/`
- `behavior-trees/` → `dist/03 - Resources/BehaviorTrees/`

### 4.12 Data Flow Per Tick

```
Tick N starts:
  1. TraitResolverSystem (0.5)     — [Phase 1B] writes trait modifiers
  2. DayNightSystem (0.7)          — writes TimeComponent { phase, tickInCycle, dayCount }
  3. NeedsDecaySystem (1)          — [Phase 1B] decays needs
  4. MoodSystem (2)                — [Phase 1B] recalculates mood
  5. PerceptionSystem (3)          — writes PerceptionComponent { nearbyAgents, nearbyLocations }
  6. MemoryDecaySystem (4)         — [Phase 1B] decays memories
  7. BehaviorTreeSystem (5)        — reads needs/mood/perception/time, writes btAction + movementTarget
  8. MovementSystem (5.5)          — reads movementTarget, moves actor, emits AgentArrived
```

Events from each system are batched and delivered before the next system runs (Phase 1A EventBus batching).

## 5. Testing Strategy

**Domain unit tests (~25):**

`tests/domain/core/game-rng.test.ts`:
- Same seed produces same sequence
- Different seeds produce different sequences
- `range()` stays within bounds
- `chance(0)` always false, `chance(1)` always true

`tests/domain/systems/day-night.test.ts`:
- Phase transitions at correct tick boundaries
- `phaseChanged` flag fires only on transitions
- Full cycle wraps back to dawn
- Day count increments each cycle

`tests/domain/systems/perception.test.ts`:
- Agents within radius detected, outside excluded
- IQ scaling expands/shrinks radius
- Night multiplier reduces radius
- Agent excludes itself
- Results sorted by distance

`tests/domain/systems/behavior-tree.test.ts`:
- Selector returns first success
- Sequence fails on first failure
- `need_critical` condition matches threshold
- `need_below` condition matches custom threshold
- `chance` condition uses RNG
- `move_to_nearest` action returns location params
- Nested selector/sequence combinations

`tests/domain/systems/movement.test.ts`:
- Moves toward target at correct speed
- Arrives when within step distance
- Zero distance = already arrived
- Diagonal movement normalised

**System-level tests (~10):**

One test file per system verifying ECS wiring, component reads/writes, and event emission.

**Loader tests (~5):**

`tests/infrastructure/entity/location-loader.test.ts`:
- Valid location → parsed
- Invalid location → error collected
- Empty directory → empty result

`tests/infrastructure/entity/bt-loader.test.ts`:
- Valid BT → parsed tree
- Invalid structure → error collected

**Integration test (~3):**

`tests/integration/agency-integration.test.ts`:
- Full tick: hungry agent perceives food location → BT selects move_to_nearest → movement steps toward it
- Night reduces perception radius (agent misses far location)
- Agent arrives at location → AgentArrived event emits

## 6. What's NOT in Phase 1C

- No pathfinding (agents move in straight lines)
- No collision avoidance (agents can overlap)
- No action effects (rest/eat don't actually restore needs yet — that's Phase 1D)
- No agent-to-agent dialogue or trade
- No BT persistent state (no `running` state between ticks)
- No location capacity enforcement
- No stamina system (uses config but not wired)
- No world map / terrain
- No pause/resume (game interaction, not settings)

## 7. Phase 1D Preview

Phase 1D would add consequences to actions — agents that arrive at locations actually benefit:
- RestSystem (recover energy at rest locations, scaled by rest tier)
- FeedSystem (recover hunger at food locations, consume inventory)
- SocializeSystem (recover social need near other agents, create memories)
- StaminaSystem (movement costs stamina, exhaustion slows speed)
- Action effects wired into BT actions

## 8. Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| BT evaluation too slow with deep trees | Low | Medium | Phase 1C trees are shallow (3-4 levels). Profile if >10 agents. |
| Perception O(n²) with many agents | Medium | Medium | <10 agents in Phase 1C. Spatial partitioning in future phase if needed. |
| Movement jitter at target | Low | Low | Snap to target within step distance (already in formula). |
| BT JSON authoring is tedious | Medium | Low | Only 4 BTs needed. Visual BT editor is a future UI feature. |
| Settings hot-swap causes mid-tick inconsistency | Low | Low | Settings are read once per tick from config object (same as Phase 1B). |
