# Phase 1D: Action Consequences — Design Spec

## 1. Goal

Make actions matter. When agents arrive at locations or encounter other agents, their needs change. Rest recovers energy, food restores hunger, socializing builds social bonds and creates memories. Movement costs energy, creating a natural rest cycle. The result: a self-sustaining life loop where agents autonomously balance their needs.

## 2. Exit Criteria

1. RestSystem recovers energy at rest locations, scaled by rest tier (owned/public/outdoors)
2. FeedSystem recovers hunger at food locations
3. SocializeSystem recovers social need near agents and creates mutual memories
4. Movement drains energy proportional to distance, agents slow when exhausted
5. Rest tier detection works (owned_home vs public_shelter vs outdoors)
6. Social memory cooldown prevents flooding (one memory per pair per 50 ticks)
7. All events emitted correctly (RestStarted, FeedStarted, SocialInteraction, AgentExhausted)
8. All Phase 0–1C tests still pass (no regressions)
9. ~25 new tests, all passing
10. tsc, eslint, build all green

## 3. Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Location interaction | Distance-based (within interaction radius) | No new component needed — check position vs location each tick |
| Food/rest source | Location-based, not inventory | Keeps scope tight. Inventory consumption deferred to Phase 1E (trade/economy) |
| Socialization trigger | Proximity + active `socialize` BT action | Prevents random passers-by from instantly bonding |
| Energy cost | Tied to existing energy need | Reuses NeedsComponent, no new stamina bar. BT already seeks rest on low energy |
| Rest tiers | From existing `rest_tiers` config | Config already defines owned_home/public_shelter/outdoors with recovery rates |
| Memory creation | Both agents get a memory | Asymmetric memories possible in future, symmetric for now |
| System priorities | 6.5/6.6/6.7 (after Movement at 5.5) | Action consequences run after movement resolves arrival |

## 4. Detailed Design

### 4.1 File Map

```
New domain files:
  domain/systems/rest.ts              — pure energy recovery formula
  domain/systems/feed.ts              — pure hunger recovery formula
  domain/systems/socialize.ts         — pure social recovery + memory creation

New infrastructure files:
  infrastructure/systems/rest-system.ts        — GameSystem wrapper (priority 6.5)
  infrastructure/systems/feed-system.ts        — GameSystem wrapper (priority 6.6)
  infrastructure/systems/socialize-system.ts   — GameSystem wrapper (priority 6.7)

Modified files:
  infrastructure/systems/movement-system.ts    — add energy drain per tick
  domain/core/tick-scheduler.ts                — add REST, FEED, SOCIALIZE priorities

New test files:
  tests/domain/systems/rest.test.ts
  tests/domain/systems/feed.test.ts
  tests/domain/systems/socialize.test.ts
  tests/infrastructure/systems/rest-system.test.ts
  tests/infrastructure/systems/feed-system.test.ts
  tests/infrastructure/systems/socialize-system.test.ts
  tests/integration/consequences-integration.test.ts
```

### 4.2 Pure Domain Functions

#### `domain/systems/rest.ts`

Stateless energy recovery. No side effects, no EventBus, no ECS.

```typescript
export interface RestInput {
  currentEnergy: number;
  restTier: 'owned_home' | 'public_shelter' | 'outdoors';
}

export interface RestConfig {
  owned_home: { recovery_rate: number; mood_effect: number };
  public_shelter: { recovery_rate: number; mood_effect: number };
  outdoors: { recovery_rate: number; mood_effect: number };
}

export interface RestResult {
  newEnergy: number;
  recovered: number;
  moodEffect: number;
  tier: string;
}

export function applyRest(input: RestInput, config: RestConfig): RestResult
```

**Formula:**
```
tierConfig = config[restTier]
recovered = tierConfig.recovery_rate
newEnergy = clamp(currentEnergy + recovered, 0, 100)
moodEffect = tierConfig.mood_effect
```

Default config (from `rest_tiers`):
- owned_home: recovery 2.0/tick, mood +2
- public_shelter: recovery 1.5/tick, mood 0
- outdoors: recovery 1.0/tick, mood -3

#### `domain/systems/feed.ts`

Stateless hunger recovery.

```typescript
export interface FeedInput {
  currentHunger: number;
}

export interface FeedConfig {
  recovery_rate: number;
}

export interface FeedResult {
  newHunger: number;
  recovered: number;
}

export function applyFeed(input: FeedInput, config: FeedConfig): FeedResult
```

**Formula:**
```
recovered = config.recovery_rate
newHunger = clamp(currentHunger + recovered, 0, 100)
```

Default `recovery_rate`: 1.5/tick (add to `GameConfigSchema.needs` as `food_recovery_rate`).

#### `domain/systems/socialize.ts`

Stateless social recovery + memory generation.

```typescript
export interface SocializeInput {
  agentId: string;
  agentName: string;
  partnerId: string;
  partnerName: string;
  currentSocial: number;
  currentTick: number;
  lastSocialTick: number | null;  // from blackboard, per partner
}

export interface SocializeConfig {
  recovery_rate: number;
  memory_significance: number;
  memory_mood_impact: number;
  cooldown_ticks: number;
}

export interface SocializeResult {
  newSocial: number;
  recovered: number;
  memory: MemoryEntry | null;  // null if on cooldown
}

export function applySocialize(input: SocializeInput, config: SocializeConfig): SocializeResult
```

**Formula:**
```
recovered = config.recovery_rate
newSocial = clamp(currentSocial + recovered, 0, 100)

if lastSocialTick is null OR (currentTick - lastSocialTick) >= cooldown_ticks:
  memory = { tick, type: 'social', description: "Talked with {partnerName}",
             participants: [partnerId], outcome: 'positive',
             significance: config.memory_significance, mood_impact: config.memory_mood_impact }
else:
  memory = null  (on cooldown)
```

Default config (add to `GameConfigSchema` under a new `social` section):
- `social.recovery_rate`: 0.5/tick
- `social.memory_significance`: 3
- `social.memory_mood_impact`: 2
- `social.cooldown_ticks`: 50

The `SocializeConfig` interface mirrors these field names exactly (read from `deps.config.social`).

### 4.3 Infrastructure GameSystems

All systems implement `GameSystem`. Each runs after Movement (priority 5.5) so agents have already arrived at their destinations.

#### `infrastructure/systems/rest-system.ts` (priority 6.5)

```typescript
export function createRestSystem(
  agents: () => AgentActor[],
  locations: () => WorldLocation[],
): GameSystem
```

Each tick, for each agent:
1. Find nearest rest-type location within interaction radius (`deps.config.perception.interaction_radius`, default 25)
2. If at a rest location:
   - Determine tier: `agent.property.includes(location.id)` → `owned_home`, else → `public_shelter`
3. If NOT at a rest location but `bb.state.btAction` is `'idle'` or `undefined`:
   - Tier is `outdoors` (resting in place)
4. If no rest scenario applies, skip
5. Call `applyRest()`, write energy to `NeedsComponent`, emit `RestStarted` (only on first tick at location)

Note: `AgentActor` doesn't currently expose `property`. The spawner stores agent data — we need to either store property on the actor or look it up from the original agent data. Simplest: add a `readonly property: string[]` field to `AgentActor`.

#### `infrastructure/systems/feed-system.ts` (priority 6.6)

```typescript
export function createFeedSystem(
  agents: () => AgentActor[],
  locations: () => WorldLocation[],
): GameSystem
```

Each tick, for each agent:
1. Find nearest food-type location within interaction radius
2. If at a food location: call `applyFeed()`, write hunger to `NeedsComponent`
3. Emit `FeedStarted` on first tick at location

#### `infrastructure/systems/socialize-system.ts` (priority 6.7)

```typescript
export function createSocializeSystem(
  agents: () => AgentActor[],
): GameSystem
```

Each tick, for each agent whose `btAction` is in `AGENT_SOCIAL_ACTIONS` (from `bt-actions.ts`: `'socialize'`, `'interact'`):
1. Read `PerceptionComponent.nearbyAgents` — find closest agent
2. If a partner is within interaction radius:
   - Read `blackboard.lastSocialTick_{partnerId}` for cooldown check
   - Call `applySocialize()` for both agents
   - Write social to `NeedsComponent` for both
   - If memory returned (not on cooldown): append to `MemoryComponent` for both, write cooldown tick to blackboard
   - Emit `SocialInteraction` with both agent ids

#### Movement Energy Drain (modify `movement-system.ts`)

When an agent has active velocity (is moving):
```
distanceThisTick = speed * (tick_interval_ms / 1000)
energyCost = distanceThisTick * config.stamina.movement_energy_cost
needs.energy = clamp(needs.energy - energyCost, 0, 100)
```

When energy reaches 0: emit `AgentExhausted` event.
When energy < critical threshold (15): scale velocity by `config.stamina.exhaustion_speed_modifier` (0.5 → half speed).

### 4.4 Config Additions

Add to `GameConfigSchema`:

```typescript
// In NeedsConfigSchema:
food_recovery_rate: z.number().default(1.5),

// In StaminaConfigSchema:
movement_energy_cost: z.number().default(0.1),  // energy per pixel of movement

// New SocialConfigSchema:
const SocialConfigSchema = z.object({
  recovery_rate: z.number().default(0.5),
  memory_significance: z.number().int().default(3),
  memory_mood_impact: z.number().default(2),
  cooldown_ticks: z.number().int().default(50),
});

// In PerceptionConfigSchema:
interaction_radius: z.number().default(25),
```

### 4.5 SystemPriority Additions

Add to `tick-scheduler.ts`:

```typescript
REST: 6.5,
FEED: 6.6,
SOCIALIZE: 6.7,
```

These already have placeholder positions in the priority enum (JOB is 6, QUEST_EVALUATION is 7 — these fit between them).

### 4.6 AgentActor Change

Add `readonly property: string[]` to `AgentActor`, initialized from `agent.property` in the constructor. This lets the RestSystem check property ownership for rest tier determination.

### 4.7 Events

| Event | Source System | Payload |
|-------|-------------|---------|
| `RestStarted` | RestSystem | `{ agentId: string, tier: string, locationId: string }` |
| `FeedStarted` | FeedSystem | `{ agentId: string, locationId: string }` |
| `SocialInteraction` | SocializeSystem | `{ agentId: string, partnerId: string, memoryCreated: boolean }` |
| `AgentExhausted` | MovementSystem | `{ agentId: string, energy: number }` |

All events follow the `GameEvent` interface: `{ type, tick, wallClock, source, payload }`.

`AgentExhausted` emits when energy drops to 0 during movement (not every tick — only on the crossing tick).

Events emit only on the FIRST tick of the interaction (not every tick while the agent stays). Track via blackboard: `bb.state.restingAt`, `bb.state.feedingAt` — clear when agent leaves.

### 4.8 Data Flow Per Tick

```
Tick N starts:
  0.5  TraitResolverSystem          — [Phase 1B] trait modifiers
  0.7  DayNightSystem               — [Phase 1C] time phase
  1    NeedsDecaySystem             — [Phase 1B] decays needs
  2    MoodSystem                   — [Phase 1B] recalculates mood
  3    PerceptionSystem             — [Phase 1C] spatial awareness
  4    MemoryDecaySystem            — [Phase 1B] decays old memories
  5    BehaviorTreeSystem           — [Phase 1C] selects action
  5.5  MovementSystem               — [Phase 1C] moves agent, drains energy
  6.5  RestSystem                   — [Phase 1D] recovers energy at rest locations
  6.6  FeedSystem                   — [Phase 1D] recovers hunger at food locations
  6.7  SocializeSystem              — [Phase 1D] recovers social, creates memories
```

### 4.9 Plugin Wiring

`game-view.ts` → `world-loader.ts` already loads locations. After existing system registration, add:

```typescript
tickRunner.register(createRestSystem(getAgents, getLocations));
tickRunner.register(createFeedSystem(getAgents, getLocations));
tickRunner.register(createSocializeSystem(getAgents));
```

No new loader needed — all config comes from `deps.config`.

## 5. Testing Strategy

**Domain unit tests (~12):**

`tests/domain/systems/rest.test.ts`:
- Energy recovers at owned_home rate
- Energy recovers at public_shelter rate
- Energy recovers at outdoors rate (lower)
- Energy clamps to 100

`tests/domain/systems/feed.test.ts`:
- Hunger recovers at configured rate
- Hunger clamps to 100

`tests/domain/systems/socialize.test.ts`:
- Social recovers at configured rate
- Memory created with correct fields
- Memory NOT created when on cooldown
- Social clamps to 100

**System-level tests (~8):**

One test file per system:
- RestSystem detects agent at rest location, applies correct tier
- FeedSystem detects agent at food location, recovers hunger
- SocializeSystem creates memories for both agents, respects cooldown
- MovementSystem drains energy while moving, slows at critical

**Integration test (~3):**

`tests/integration/consequences-integration.test.ts`:
- Full tick: hungry agent walks to food → arrives → hunger recovers
- Agent walks to tavern → energy recovers → eventually leaves when full
- Two agents socialize → both gain memory → mood improves next tick

## 6. What's NOT in Phase 1D

- No inventory consumption (food from location, not items)
- No trade between agents
- No location capacity enforcement (unlimited agents at a location)
- No skill progression from actions
- No dialogue or conversation content
- No property acquisition (ownership is static from JSON)

## 7. Phase 1E Preview

Phase 1E would add economy and trade:
- TradeSystem (agents buy/sell items at market locations)
- Inventory consumption (eating requires food items)
- Gold transactions (buy food, pay for rest)
- Job income (agents earn gold from working)
- Property rent/purchase

## 8. Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Recovery rates too fast/slow | Medium | Low | All rates are config-driven, tunable in vault |
| Memory flooding from socialization | Low | Medium | Cooldown prevents more than 1 memory per pair per 50 ticks |
| Energy drain makes agents unable to reach destinations | Medium | Medium | Exhaustion halves speed, doesn't stop movement. Rest locations are reachable. |
| Interaction radius too small/large | Low | Low | Config-driven (default 25px), tunable |

## 9. Operational Checklist (Learnings from Phases 1B–1C)

These items must be completed alongside the core implementation:

### README Generator
Update `scripts/generate-readme.mjs` to document:
- RestSystem, FeedSystem, SocializeSystem in the system pipeline table
- Recovery rates (food, rest tiers, social) in a new "Action Consequences" section
- Energy drain formula and exhaustion mechanics
- Interaction radius and social memory cooldown

### Integration Safeguards
Update existing test files:
- `tests/integration/smoke-test.test.ts` — add a scenario: agent with low hunger at food location → hunger increases after tick
- `tests/integration/data-validation.test.ts` — no new JSON data types in Phase 1D (config-driven), but verify new `GameConfigSchema` sections parse correctly

### World Snapshot
Update `scripts/generate-world-snapshot.mjs`:
- Add interaction radius circles around locations (visual indicator of where agents can interact)
- Or defer to runtime VaultSync (Phase 1F) — document the decision

### Docs
After implementation, update Phase 1D Section 9 (post-implementation notes) with:
- Any deviations from this spec
- Additional artifacts created
- Final test count

### AgentActor Property Field
Add `readonly property: string[]` to `AgentActor` (from `agent.property`). `agent.property` is an array of `WorldLocation.id` strings — ownership check is `agent.property.includes(location.id)`.

### No New Plugin Settings
Phase 1D config values (recovery rates, interaction radius, social cooldown) live in `GameConfigSchema` defaults. They are tunable via a future `game-config.json` vault file but are NOT exposed as plugin settings sliders (too granular for the settings tab). Document this: "Phase 1D parameters are config-level, not settings-level. A vault-editable `game-config.json` override is a Phase 1F concern."
