# Phase 1B: Core Life Systems + Agent Entity Pipeline — Design Spec

## 1. Goal

Deliver 4 game systems (TraitResolver, NeedsDecay, Mood, Memory) and a vault-loaded agent entity pipeline — the first agents with life that ticks. Built on Phase 1A's tick infrastructure, EventBus batching, and ECS component foundations.

## 2. Exit Criteria

1. 4 systems execute in priority order within the tick runner (SystemPriority.TRAIT_RESOLVER, NEEDS_DECAY, MOOD, MEMORY)
2. Agents loaded from vault → validated with AgentSchema → ECS entities with all components
3. NeedsDecay applies correct formulas with trait modifiers from blackboard
4. Mood calculates from 3 available factors (needs, positive memories, negative memories), maps to bucket
5. Memory decays significance per formula, prunes entries below threshold
6. TraitResolver writes modifier map to blackboard each tick
7. All events emitted with correct payloads (NeedChanged, NeedCritical, AgentExhausted, MoodChanged, MoodBreakdown, MemoryDecayed)
8. All Phase 0 + Phase 1A tests still pass (no regressions)
9. ~43 new tests, all passing
10. tsc, eslint, build all green

## 3. Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| System structure | Pure domain function + thin infrastructure GameSystem wrapper | Domain functions are fully unit-testable without ECS. Infrastructure wrappers handle component reads/writes and event emission. Matches trait-resolver.ts pattern. |
| Entity querying | Systems receive entity query at construction time (injected by game-view wiring) | Keeps GameCoreDeps domain-pure — no ExcaliburJS `World` reference in domain interface. |
| Mood partial factors | Zero-out unavailable factors (goals, wallet, equipment, relationships) | Structurally complete from day one. Factors light up naturally as future systems add components. Weights are configurable. |
| Agent spawning | Vault-loaded via Obsidian API, validated with AgentSchema | Full pipeline — agents are real vault data, not hardcoded test fixtures. |
| GameRNG | Not included | Phase 1B systems are all deterministic formulas. Add seeded RNG when BT/combat/events need it (YAGNI). |
| Trait definitions | Loaded once at startup, held in TraitResolverSystem closure | Simple for Phase 1B. Future phases can add hot-reload from vault. |

## 4. Detailed Design

### 4.1 File Map

```
New domain files:
  domain/systems/needs-decay.ts          — pure decay formula
  domain/systems/mood.ts                 — pure mood calculation
  domain/systems/memory-decay.ts         — pure decay + prune
  domain/core/component-data.ts          — add AttributesState, SocialState (modify)

New infrastructure files:
  infrastructure/systems/trait-resolver-system.ts   — GameSystem wrapper (priority 0.5)
  infrastructure/systems/needs-decay-system.ts      — GameSystem wrapper (priority 1)
  infrastructure/systems/mood-system.ts             — GameSystem wrapper (priority 2)
  infrastructure/systems/memory-decay-system.ts     — GameSystem wrapper (priority 4)
  infrastructure/entity/agent-actor.ts              — ExcaliburJS Actor subclass
  infrastructure/entity/agent-spawner.ts            — vault → schema → ECS pipeline
  infrastructure/components/attributes-component.ts — ST, DX, IQ, HT
  infrastructure/components/social-component.ts     — status, reputation, charisma
  infrastructure/components/traits-component.ts     — trait ID array

Modified files:
  plugin.ts                    — call initializeGame body
  infrastructure/engine/game-view.ts — register systems, spawn agents

New test files:
  tests/domain/systems/needs-decay.test.ts
  tests/domain/systems/mood.test.ts
  tests/domain/systems/memory-decay.test.ts
  tests/infrastructure/systems/trait-resolver-system.test.ts
  tests/infrastructure/systems/needs-decay-system.test.ts
  tests/infrastructure/systems/mood-system.test.ts
  tests/infrastructure/systems/memory-decay-system.test.ts
  tests/infrastructure/entity/agent-spawner.test.ts
  tests/integration/life-systems-integration.test.ts
```

### 4.2 Pure Domain Functions

#### `domain/systems/needs-decay.ts`

Stateless decay formula. No side effects, no EventBus, no ECS.

```typescript
export interface NeedsDecayInput {
  state: NeedsState;
  hungerAttribute: number;    // HT (1-20)
  energyAttribute: number;    // HT (1-20)
  socialAttribute: number;    // Chr (1-20)
  modifiers: NeedsModifiers | null;  // from trait resolver
}

export interface NeedsModifiers {
  hungerDecayScale?: number;   // multiplier, default 1.0
  energyDecayScale?: number;
  socialDecayScale?: number;
}

export interface NeedEvent {
  type: 'NeedChanged' | 'NeedCritical' | 'AgentExhausted';
  need: 'hunger' | 'energy' | 'social';
  oldValue: number;
  newValue: number;
  threshold?: number;
}

export interface NeedsDecayResult {
  state: NeedsState;
  events: NeedEvent[];
}

export function applyNeedsDecay(
  input: NeedsDecayInput,
  config: { hunger_decay: number; energy_decay: number; social_decay: number },
): NeedsDecayResult
```

**Formula per need:**
```
decayAmount = baseDecayRate / (attribute / 10) * modifierScale
newValue = clamp(oldValue - decayAmount, 0, 100)
```

**Critical thresholds:**
- hunger < 20 → `NeedCritical`
- energy < 15 → `NeedCritical`
- social < 25 → `NeedCritical`
- energy === 0 → `AgentExhausted`

**Always emits `NeedChanged`** for any value change (UI consumption).

#### `domain/systems/mood.ts`

Stateless mood calculation from available factors.

```typescript
export interface MoodFactors {
  needsSatisfaction: number;    // avg(hunger, energy, social) / 100 → [0, 1]
  positiveMemories: number;     // count of positive memories in recent ticks
  negativeMemories: number;     // count of negative memories in recent ticks
  goalProgress: number;         // 0 (not available in Phase 1B)
  walletHealth: number;         // 0 (not available in Phase 1B)
  equipmentCondition: number;   // 0 (not available in Phase 1B)
  relationshipQuality: number;  // 0 (not available in Phase 1B)
}

export interface MoodResult {
  value: number;       // -100 to 100
  bucket: string;      // bucket name from config
  changed: boolean;    // bucket changed from previous
}

export function calculateMood(
  factors: MoodFactors,
  previousBucket: string,
  config: MoodConfig,
  externalModifiers: number,
): MoodResult
```

**Formula:**

All factors are normalised to `[0, 1]` before weighting. Positive factors contribute positively, negative factors are subtracted:

```
positivePart = needsSatisfaction × weight_needs
             + positiveMemories × weight_positive_memories
             + goalProgress × weight_goal_progress
             + walletHealth × weight_wallet
             + equipmentCondition × weight_equipment
             + relationshipQuality × weight_relationships

negativePart = negativeMemories × weight_negative_memories

rawMood = ((positivePart - negativePart) / totalWeight) × 200 - 100
  where totalWeight = sum of all 7 weights (default 100)
finalMood = clamp(rawMood + externalModifiers, -100, 100)
bucket = first config.mood.buckets entry where min <= finalMood <= max
changed = bucket !== previousBucket
```

This scales the weighted sum from `[0, 1]` to `[-100, 100]`. When all positive factors are at maximum (1.0) and negativeMemories is 0, rawMood approaches +100. When needs are empty and negative memories dominate, rawMood approaches -100.

`positiveMemories` and `negativeMemories` are normalised to `[0, 1]` by the system: `min(count / 10, 1.0)` — 10+ recent memories of one type saturates the factor.

**External modifiers** (Phase 1B: always 0, reserved for DayNight/Season/WorldEvent systems).

#### `domain/systems/memory-decay.ts`

Stateless significance decay and pruning.

```typescript
export interface MemoryDecayResult {
  state: MemoryState;
  decayedCount: number;
  prunedCount: number;
}

export function applyMemoryDecay(
  state: MemoryState,
  currentTick: number,
  config: { min_lifespan_ticks: number },
): MemoryDecayResult
```

**Rules:**
- Skip entries where `currentTick - entry.tick < min_lifespan_ticks`
- On first decay of an entry: if `original_significance` is undefined, set `entry.original_significance = entry.significance` before applying the formula
- Decay: `significance -= 0.1 / (original_significance / 5)` per tick
- Prune entries where `significance < 1`
- Never exceed `maxEntries` (drop lowest-significance if over)

### 4.3 Infrastructure GameSystems

All systems implement the `GameSystem` interface from Phase 1A:

```typescript
interface GameSystem {
  readonly name: string;
  readonly priority: number;
  execute(deps: GameCoreDeps): void;
}
```

Each system receives its entity query at construction time.

#### `infrastructure/systems/trait-resolver-system.ts` (priority `SystemPriority.TRAIT_RESOLVER`)

```typescript
export function createTraitResolverSystem(
  entities: () => AgentActor[],
  traitDefinitions: Record<string, TraitDefinition>,
): GameSystem
```

- Iterates entities with TraitsComponent
- Calls existing `resolveTraitModifiers(traits, definitions)` — returns `ResultValue<ModifierMap>`
- On `result.ok === true`: writes `result.value` to entity's BlackboardComponent under key `'traitModifiers'`
- On `result.ok === false` (trait conflict): logs warning with `result.error.message`, writes empty `new Map()` to blackboard
- Note: unknown trait IDs are silently skipped by the resolver itself and do not produce an error

#### `infrastructure/systems/needs-decay-system.ts` (priority `SystemPriority.NEEDS_DECAY`)

```typescript
export function createNeedsDecaySystem(
  entities: () => AgentActor[],
): GameSystem
```

- Config is read from `deps.config.needs` inside `execute()` — not injected at construction time
- Iterates entities with NeedsComponent + AttributesComponent
- Reads trait modifiers from BlackboardComponent (`'traitModifiers'`)
- Calls `applyNeedsDecay()` with state, attributes, modifiers, config
- Writes updated NeedsState, marks dirty
- Emits events via `deps.eventBus.emit()` with agent ID in payload

#### `infrastructure/systems/mood-system.ts` (priority `SystemPriority.MOOD`)

```typescript
export function createMoodSystem(
  entities: () => AgentActor[],
): GameSystem
```

- Config is read from `deps.config.mood` inside `execute()` — not injected at construction time
- Iterates entities with MoodComponent + NeedsComponent + MemoryComponent
- Builds `MoodFactors` from component state:
  - `needsSatisfaction`: avg of 3 needs / 100 → `[0, 1]`
  - `positiveMemories`: count entries with `outcome === 'positive'` where `entry.tick >= deps.tickCount - 50`, normalised as `min(count / 10, 1.0)`
  - `negativeMemories`: count entries with `outcome === 'negative'` where `entry.tick >= deps.tickCount - 50`, normalised as `min(count / 10, 1.0)`
  - Other 4 factors: 0
- Reads external modifiers from BlackboardComponent (0 for Phase 1B)
- Calls `calculateMood()` with factors, previous bucket from MoodComponent, config, modifiers
- Writes updated MoodState, marks dirty
- Emits `MoodChanged` on bucket change, `MoodBreakdown` on entering breakdown

#### `infrastructure/systems/memory-decay-system.ts` (priority `SystemPriority.MEMORY`)

```typescript
export function createMemoryDecaySystem(
  entities: () => AgentActor[],
): GameSystem
```

- Config is read from `deps.config.memory` inside `execute()` — not injected at construction time
- Iterates entities with MemoryComponent
- Calls `applyMemoryDecay()` with state, `deps.tickCount`, config
- Writes updated MemoryState if changed, marks dirty
- Emits `MemoryDecayed` if any entries decayed or pruned

### 4.4 Agent Entity Pipeline

#### `infrastructure/entity/agent-actor.ts`

```typescript
export class AgentActor extends ex.Actor {
  readonly agentId: string;
  readonly agentName: string;
  readonly kind: string;

  constructor(agent: Agent)  // Agent = z.infer<typeof AgentSchema>
}
```

Constructor attaches all components:
- `NeedsComponent` — from `agent.needs`
- `MoodComponent` — `agent.mood` is a bootstrap `number`, not `MoodState`. Construct initial `MoodState` by calling `calculateMood()` with needs-derived `MoodFactors` (from `agent.needs`), `''` as `previousBucket` (so `changed` is always `true` on first tick), default config, and 0 external modifiers. The bootstrap `mood` number from the schema is discarded; the component is authoritative from tick 1.
- `MemoryComponent` — from `agent.memory` + `config.memory.max_entries`
- `BlackboardComponent` — empty `{}`
- `AttributesComponent` — from `agent.attributes` (ST, DX, IQ, HT)
- `SocialComponent` — from `agent.social` (status, reputation, charisma)
- `TraitsComponent` — from `agent.traits`

Actor positioned at `(agent.position.x, agent.position.y)`.

#### `infrastructure/entity/agent-spawner.ts`

```typescript
export interface VaultReader {
  list(path: string): Promise<string[]>;
  read(path: string): Promise<string>;
}

export interface SpawnResult {
  agents: AgentActor[];
  errors: { file: string; message: string }[];
}

export function createAgentSpawner(
  logger: Logger,
): {
  spawnFromVault(vault: VaultReader, agentsPath: string): Promise<SpawnResult>;
}
```

`VaultReader` is an ISP-narrowed subset of Obsidian's `DataAdapter`, keeping the spawner testable without a full Obsidian mock. In `game-view.ts`, pass `this.app.vault.adapter` which satisfies this interface.

- Lists files in `agentsPath` directory
- Reads each file, parses as JSON
- Validates with `AgentSchema.parse()`
- Creates `AgentActor` for each valid agent
- Collects errors for invalid agents (logs warning, continues)
- Returns spawned actors + error list

### 4.5 New Components

All extend `TrackedComponent` from Phase 1A.

#### `infrastructure/components/attributes-component.ts`

Imports `AttributesState` from `domain/core/component-data.ts` (defined in section 4.6).

```typescript
import type { AttributesState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class AttributesComponent extends TrackedComponent {
  constructor(public state: AttributesState) { super(); }
}
```

#### `infrastructure/components/social-component.ts`

Imports `SocialState` from `domain/core/component-data.ts` (defined in section 4.6).

```typescript
import type { SocialState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class SocialComponent extends TrackedComponent {
  constructor(public state: SocialState) { super(); }
}
```

#### `infrastructure/components/traits-component.ts`

```typescript
import { TrackedComponent } from './tracked-component.js';

export class TraitsComponent extends TrackedComponent {
  constructor(public traitIds: string[]) { super(); }
}
```

### 4.6 Component Data Interfaces (Domain Additions)

Add to `domain/core/component-data.ts`:

```typescript
export interface AttributesState {
  ST: number;
  DX: number;
  IQ: number;
  HT: number;
}

export interface SocialState {
  status: number;
  reputation: number;
  charisma: number;
}
```

### 4.7 Events

| Event | Source System | Payload |
|-------|-------------|---------|
| `NeedChanged` | NeedsDecaySystem | `{ agentId: string, need: string, oldValue: number, newValue: number }` |
| `NeedCritical` | NeedsDecaySystem | `{ agentId: string, need: string, value: number, threshold: number }` |
| `AgentExhausted` | NeedsDecaySystem | `{ agentId: string }` |
| `MoodChanged` | MoodSystem | `{ agentId: string, oldBucket: string, newBucket: string, value: number }` |
| `MoodBreakdown` | MoodSystem | `{ agentId: string, value: number }` |
| `MemoryDecayed` | MemoryDecaySystem | `{ agentId: string, decayedCount: number, prunedCount: number }` |

All events follow the `GameEvent` interface: `{ type, tick, wallClock, source, payload }`.

### 4.8 Plugin + Game View Wiring

**`plugin.ts` changes:**
- `initializeGame()` creates the agent spawner
- Stores trait definitions (loaded from config or defaults)

**`game-view.ts` changes:**
- After tick system registration:
  1. Spawn agents from vault via `agentSpawner.spawnFromVault()`
  2. Add AgentActors to scene
  3. Create entity query function: `() => scene.actors.filter(a => a instanceof AgentActor)`
  4. Create all 4 GameSystems with entity query + deps
  5. Register systems with tick runner in priority order

### 4.9 Data Flow Per Tick

```
Tick N starts:
  1. TraitResolverSystem (0.5)
     - Reads: TraitsComponent
     - Writes: BlackboardComponent['traitModifiers'] = ModifierMap
     - Emits: nothing

  2. NeedsDecaySystem (1)
     - Reads: NeedsComponent, AttributesComponent, BlackboardComponent['traitModifiers']
     - Writes: NeedsComponent (decayed values)
     - Emits: NeedChanged, NeedCritical?, AgentExhausted?

  3. MoodSystem (2)
     - Reads: NeedsComponent (post-decay), MoodComponent, MemoryComponent
     - Writes: MoodComponent (recalculated value + bucket)
     - Emits: MoodChanged?, MoodBreakdown?

  4. MemoryDecaySystem (4)
     - Reads: MemoryComponent
     - Writes: MemoryComponent (decayed/pruned entries)
     - Emits: MemoryDecayed?
```

Events from each system are batched and delivered before the next system runs (Phase 1A EventBus batching).

## 5. Testing Strategy

**Domain unit tests (~20):**

`tests/domain/systems/needs-decay.test.ts`:
- Base decay with default attributes (HT=10)
- Decay scales inversely with attribute (HT=20 → half decay)
- Trait modifiers scale decay rate
- Critical threshold events at correct values
- AgentExhausted at energy=0
- Values clamped to [0, 100]
- No decay when already at 0

`tests/domain/systems/mood.test.ts`:
- Full needs satisfaction → high mood
- Empty needs → low mood
- Positive memories increase mood
- Negative memories decrease mood
- Bucket mapping matches config ranges
- Changed flag when bucket transitions
- External modifiers apply and clamp
- Zero factors → neutral mood

`tests/domain/systems/memory-decay.test.ts`:
- Entries within min lifespan not decayed
- High-significance entries decay slowly
- Low-significance entries decay quickly
- Entries below threshold pruned
- original_significance set on first decay
- Empty memory state is no-op
- Max entries enforced

**System-level tests (~15):**

`tests/infrastructure/systems/needs-decay-system.test.ts`:
- Reads NeedsComponent and writes decayed values
- Reads modifiers from blackboard
- Emits NeedChanged events via EventBus
- Skips entity without required components

`tests/infrastructure/systems/mood-system.test.ts`:
- Reads 3 components, calculates mood
- Emits MoodChanged on bucket transition
- Emits MoodBreakdown when entering breakdown

`tests/infrastructure/systems/memory-decay-system.test.ts`:
- Reads MemoryComponent, applies decay, writes back
- Emits MemoryDecayed when entries change

`tests/infrastructure/systems/trait-resolver-system.test.ts`:
- Reads traits, writes modifier map to blackboard
- Handles unknown trait gracefully

**Agent spawner tests (~5):**

`tests/infrastructure/entity/agent-spawner.test.ts`:
- Valid agent JSON → AgentActor with correct components
- Invalid agent → skipped with error in result
- Empty directory → empty result, no crash
- Multiple agents → all spawned
- Components initialized with schema values

**Integration test (~3):**

`tests/integration/life-systems-integration.test.ts`:
- Full tick: 4 systems execute in order, needs decay → mood reacts
- Trait modifiers flow through blackboard → affect needs decay
- Event delivery order: NeedChanged before MoodChanged

## 6. What's NOT in Phase 1B

- No DayNight system (no time-of-day modifiers on needs/perception)
- No Perception system (no spatial awareness)
- No BehaviorTree (agents don't act on their state)
- No Movement, Jobs, Quests, Trade, Dialogue
- No Mortality (starvation/despair detection)
- No VaultSync (dirty components not persisted back to vault)
- No UIBridge (no display updates)
- No GameRNG (all formulas deterministic)
- No goal, wallet, equipment, relationship factors in mood (zeroed out)

## 7. Phase 1C Preview

Phase 1C would build on Phase 1B to add agency — agents that respond to their internal state:
- DayNightSystem (time-of-day cycles, night modifiers)
- PerceptionSystem (spatial awareness, who sees whom)
- BehaviorTreeSystem with basic needs-driven nodes (rest, eat, socialize, idle)
- MovementSystem (agents walk to destinations)
- GameRNG for BT decision variance

## 8. Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ExcaliburJS entity query performance with many agents | Low | Medium | Phase 1B has <10 agents. Optimize in later phases if needed. |
| Vault file format mismatch with AgentSchema | Medium | Low | Schema validation catches mismatches. Spawner logs errors and continues. |
| Mood skewing positive with only 3 of 7 factors | Medium | Low | Configurable weights. Adjust defaults if needed. Factors zero-out cleanly. |
| Trait definitions not yet in vault | Low | Low | Use hardcoded defaults for Phase 1B. Vault loading in future phase. |
| Component dirty flag management burden | Medium | Low | Systems always markDirty() after writes. Established pattern from Phase 1A. |

## 9. Post-Implementation Notes (2026-03-28)

**Status:** Complete. 204 tests (54 new), all green. tsc/eslint/build clean.

### Deviations from Spec

| Section | Spec Said | Implementation | Reason |
|---------|-----------|----------------|--------|
| 4.4 AgentActor | `constructor(agent: Agent)` | `constructor(agent: Agent, moodConfig: MoodConfig, memoryMaxEntries = 50)` | Mood bootstrap requires config; maxEntries respects `config.memory.max_entries` |
| 4.4 AgentSpawner | `createAgentSpawner(logger)` | `createAgentSpawner(logger, moodConfig, memoryMaxEntries)` | Threads mood config + memory cap to AgentActor |
| 4.2 NeedCritical | Emits when `need < threshold` | Emits only on crossing: `oldValue >= threshold && newValue < threshold` | Prevents flooding — "drops below" implies crossing, not every tick |
| 4.7 NeedCritical payload | `{ agentId, need, value, threshold }` | `{ agentId, need, oldValue, newValue, value, threshold }` | `value` = `newValue` per spec; `oldValue`/`newValue` also included |
| 4.8 Plugin wiring | `initializeGame()` creates spawner | `game-view.ts onOpen()` creates spawner | game-view has `this.app.vault` access for VaultReader adapter |
| 4.8 Entity query | `scene.actors.filter(...)` | Closure over `spawnedAgents` array | Simpler; avoids filtering all actors every tick |

### Post-Merge Additions (not in original spec)

#### Persona Field

`AgentSchema` has `persona: z.string().nullable().default(null)` — path to a markdown file describing the agent's personality. Schema-only for Phase 1B; no system reads it yet. Future LLM/BT systems will load it.

#### Data-Driven Visuals

`AgentActor` renders a colored `Circle` (radius 14) + `Label` (agent name). Color read from `agent.color` field in the JSON file (hex string, validated by schema, default `#b0b0b0`). No hardcoded color map — colors are editable in the vault.

`AgentSchema` also has `color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#b0b0b0')`.

Bootstrap mood uses `needsSatisfaction = (hunger + energy + social) / 300`.

#### GameConfig Forward Declarations

`GameConfigSchema` (`domain/schemas/game-config-schema.ts`) forward-declares ~15 config sections for future phases (economy, stamina, mortality, gossip, skills, rest tiers, seasons, etc.). These exist in the schema with defaults but no system reads them yet. Phase 1B uses only `needs`, `memory`, and `mood`.

#### Shared Constants

`domain/schemas/ranges.ts` — GDD balance constants (`ATTRIBUTE_RANGE`, `NEED_CRITICAL_THRESHOLDS`, `MOOD_DEFAULT`, etc.). Single source of truth imported by schemas and tick systems.

#### Engine Architecture Change

`createGameEngine()` returns `GameEngineResult { engine, dispose }` instead of a bare `Engine`:
- Uses `DisplayMode.Fixed` (not `FitContainerAndFill`) to prevent WebGL zero-framebuffer errors
- A `ResizeObserver` updates `engine.screen.resolution` and `viewport` only when container dimensions > 0
- When Obsidian hides the tab, canvas keeps its last valid size — simulation keeps ticking
- `dispose()` disconnects the observer (called in `onClose()`)

#### Build Output — Portable Vault Overlay

`vite.config.ts` assembles `dist/` as a vault overlay:

```
dist/
  .obsidian/plugins/project-meridian/
    main.js, main.js.map, manifest.json, styles.css
  03 - Resources/
    Agents/    — agent JSON files (copied from agents/)
    Personas/  — persona markdown files (copied from personas/)
```

Copy `dist/` contents into any Obsidian vault to install.

#### Agent Data Path

Plugin reads agents from `03 - Resources/Agents` at runtime (not `01 - Projects/Project Meridian/agents/`). Source files in the project's `agents/` directory are copied to `dist/03 - Resources/Agents/` during build.

#### CSS — Fullscreen Game View

`styles.css` scoped to `[data-type="meridian-game-view"]`:
- Hides `.view-header` for fullscreen canvas
- Overrides Obsidian's `padding`/`overflow` on `.view-content`
- Canvas fills container at `100% × 100%`

#### Shared Math Utilities

`domain/core/math-utils.ts` — extracted `clamp()` and `round2()` shared by `needs-decay.ts`, `mood.ts`, and `memory-decay.ts`.

#### `createTestActor` Removed from Production

Moved from `game-engine.ts` (production bundle) to `tests/helpers/test-actors.ts` (test-only).
