# Universal Interaction System — Design Spec

**Date:** 2026-03-22
**Status:** Approved
**Depends on:** Behaviour Tree (done), Needs System (done), Relationship System (done), DayClock (done)
**Enhances:** Rich Dialogue Expansion (planned), Task & Economy Engine (planned), Merchant NPC (planned)
**Enables:** Dynamic NPC spawning, room-as-actor, director multi-select commands, future entity types

---

## 1. Overview

A universal interaction fabric where any entity (agent, pet, NPC, director, room/environment) can interact with any other at any cardinality (1:1, 1:N, N:N, entity-to-environment). Built on an **InteractionBus + IntentResolver** architecture.

### Design Goals

| Priority | Goal | Weight |
|----------|------|--------|
| Primary | **Emergent storytelling** — interactions cascade into surprising narratives | ~50% |
| Foundation | **Living ecosystem** — simulation depth makes stories feel believable | ~35% |
| Spice | **Director agency** — light-touch interventions without breaking autonomy | ~15% |

### Principles

- Interactions are **first-class data objects**, not ad-hoc function calls
- Every entity type participates through a uniform **IntentResolver** interface
- The **InteractionBus** is the single routing/coordination point — no side-channel entity communication
- Existing systems (TalkEngine, ConversationEngine, RelationshipSystem) become **effect executors**, not replaced
- Templates are **pure data** — adding new interactions is content work, not code work
- Chained interactions (depth ≤ 3) create emergent multi-step sequences from simple templates

---

## 2. Core Data Model

### Entity Reference

```typescript
type InteractionEntityType = "agent" | "pet" | "npc" | "director" | "room";

type EntityRef = {
  id: string;
  entityType: InteractionEntityType;
};
```

**Mapping from existing types:**

| Existing `AgentType` | `InteractionEntityType` | Notes |
|----------------------|------------------------|-------|
| `"ai"` | `"agent"` | AI-driven agents |
| `"human"` | `"agent"` | Human-represented agents |
| `"npc"` | `"npc"` | NPC entities (merchant, courier, etc.) |
| — | `"pet"` | Pet actors (no AgentType equivalent) |
| — | `"director"` | Singleton — `id` is always `"director"` |
| — | `"room"` | Room scenes — `id` is the room name (e.g., `"office"`, `"village"`, `"hub"`, `"station"`) |

**Note:** "room" covers both the physical room and its environmental properties (lighting, mood, weather). There is no separate "environment" entity type — environmental state is a property of the room, not a distinct actor.

### Cardinality

```typescript
type Cardinality = "one-to-one" | "one-to-many" | "many-to-many" | "entity-to-environment";
```

### Interaction Categories

```typescript
type InteractionCategory =
  | "social"        // conversation, greeting, gossip, bickering
  | "care"          // feeding, comforting, grooming
  | "work"          // collaboration, delegation, review
  | "commerce"      // buying, trading, gifting
  | "environmental" // room mood shift, weather reaction, object activation
  | "directive"     // director commands, assignments, interventions
  | "reactive"      // startle, celebrate, mourn, panic
  | "playful";      // jokes, pranks, games, pet zoomies
```

### Interaction Object

```typescript
interface Interaction {
  id: string;
  initiator: EntityRef;
  targets: EntityRef[];           // 1+ targets
  cardinality: Cardinality;
  category: InteractionCategory;
  action: string;                 // e.g. "gossip", "feed-pet", "room-pressure"
  priority: number;               // 0-100, higher preempts lower
  context: InteractionContext;
  cooldownMs: number;
  duration?: number;              // how long the interaction locks participants (ms)
  prerequisites?: InteractionPrerequisite[];
  effects: InteractionEffect[];
  timestamp: number;
  chainDepth?: number;            // tracked internally, max 3
}

interface InteractionContext {
  topic?: string;                  // what the interaction is about
  triggerReason?: string;          // what caused it (e.g., "proximity", "need-driven", "event")
  mood?: string;                   // initiator's mood at time of interaction
  roomId?: string;                 // room where interaction occurs
  phase?: DayPhase;                // day phase at time of interaction
  templateId?: string;             // which template produced this interaction
  extra?: Record<string, string>;  // template-specific variables for phrase interpolation
}
```

### Prerequisites (Discriminated Union)

Gate whether an interaction can fire. Each prerequisite type has strongly-typed params:

```typescript
type InteractionPrerequisite =
  | { type: "proximity"; maxDistance: number }
  | { type: "affinity-range"; min: number; max: number }
  | { type: "need-threshold"; need: string; op: "<" | ">" | "==" | "<=" | ">="; value: number }
  | { type: "phase"; phases: DayPhase[] }
  | { type: "cooldown-clear" }
  | { type: "not-locked" }
  | { type: "has-item"; itemId: string }
  | { type: "trust-tier"; minTier: "supervised" | "trusted" | "autonomous" };

// Implementation note: import DayPhase from the existing day clock types
// rather than redefining — listed here for spec clarity
type DayPhase =
  | "morning-arrival" | "productive-morning" | "lunch"
  | "afternoon" | "afternoon-slump" | "wind-down" | "evening-departure";
```

### Effects (Discriminated Union)

Describe what changes when an interaction executes. Each effect type has strongly-typed params:

```typescript
type EffectTarget = "initiator" | "targets" | "all" | "room" | EntityRef;

type InteractionEffect =
  | { type: "affinity-change"; target: EffectTarget; amount: number }
  | { type: "need-change"; target: EffectTarget; need: string; amount: number }
  | { type: "mood-change"; target: EffectTarget; mood: string }
  | { type: "bubble"; target: EffectTarget; bubbleKind: "speech" | "thought" | "emote"; phrasePool: string; templateVars?: Record<string, string> }
  | { type: "particle"; target: EffectTarget; particleType: string }
  | { type: "sound"; target: EffectTarget; soundId: string }
  | { type: "state-change"; target: EffectTarget; key: string; value: string | number | boolean }
  | { type: "spawn-interaction"; templateId: string; delayMs?: number }
  | { type: "economy-transaction"; target: EffectTarget; currency: "xp" | "coin" | "tokens"; amount: number }
  | { type: "memory-record"; target: EffectTarget; memory: string }
  | { type: "room-mood-shift"; mood: string; amount: number };
```

The key mechanic is `spawn-interaction` — interactions can chain. A pet's `DragToy` spawns a `social` conversation between two nearby agents. A `room-pressure` event spawns individual `reactive` interactions on each agent in the room. This is how emergent storytelling happens — one interaction cascading into others.

---

## 3. InteractionBus

The single nerve center that receives interactions, validates them, resolves conflicts, and dispatches effects.

### Interface

```typescript
interface InteractionBus {
  submit(interaction: Interaction): SubmitResult;
  getActive(): ActiveInteraction[];
  getHistory(filter?: InteractionFilter): Interaction[];
  on(event: InteractionLifecycleEvent, handler: InteractionHandler): void;
  tick(deltaMs: number): InteractionAction[];
}
```

**`submit()` is a lightweight enqueue operation.** It performs basic validation (entity exists, initiator type matches template) and returns immediately. Full prerequisite validation and conflict resolution happen in `tick()`.

```typescript
type SubmitResult =
  | { status: "enqueued"; interactionId: string }
  | { status: "rejected"; reason: string };  // only for malformed or invalid interactions
```

**`tick()` returns `InteractionAction[]`** — a bridge type that maps interaction effects to renderable actions for the Plugin EventBus:

```typescript
interface InteractionAction {
  interactionId: string;
  entityId: string;
  entityType: InteractionEntityType;
  actionType: string;              // maps to visual handler (e.g. "bubble", "particle", "movement")
  params: Record<string, unknown>; // intentionally loose — bridges to diverse Plugin visual handlers
  timestamp: number;
}
```

**Lifecycle events** emitted by the bus for subscribers:

```typescript
type InteractionLifecycleEvent =
  | "accepted" | "rejected" | "started"
  | "completed" | "preempted" | "expired" | "chained";
```

### Priority Bands

| Band | Range | Usage | Can Preempt Locks? |
|------|-------|-------|--------------------|
| Background | 0–20 | Ambient, environmental passive, idle chatter | No |
| Normal | 21–50 | Standard social, work, care interactions | No |
| Important | 51–70 | Need-driven, scheduled events, NPC-initiated | No |
| Urgent | 71–90 | World events, director commands | No |
| Override | 91–100 | Reactive emergencies, director force-commands | Yes |

### Processing Pipeline (per tick)

1. **Expire locks** — Unlock entities whose interaction duration has elapsed. Emit `completed`. Auto-release any lock exceeding `MAX_LOCK_DURATION` (15000ms) as a watchdog safety net.
2. **Drain queue** — Pull all enqueued interactions
3. **Validate prerequisites** — Check proximity, affinity, cooldowns, locks, phase, trust tier. Failed → emit `rejected`.
4. **Conflict resolution** — If two interactions target the same entity, higher priority wins. Equal priority → earlier timestamp wins. Loser is either queued (if target will unlock within 5s) or rejected.
5. **Lock participants** — Participating entities get locked for the interaction's duration. Locked entities reject new interactions unless the new interaction is in the Override band (91–100).
6. **Execute effects** — Apply each `InteractionEffect` in order. Effects that produce `spawn-interaction` get fed back into the queue with a 1-tick delay to prevent infinite loops.
7. **Record** — Push to history ring buffer (configurable, default 200). Emit lifecycle events for subscribers.
8. **Return** — Collect all `InteractionAction[]` for visual rendering.

### Conflict Resolution

When two interactions target the same entity:
- Higher priority wins
- Equal priority → earlier timestamp wins
- Loser: queued if target will unlock within 5s, otherwise rejected
- Rejection can itself spawn reactive interactions (jealousy, frustration)

### Lock Safeguards

- **Max duration cap:** `MAX_LOCK_DURATION = 15000` (15s). The bus auto-releases any lock exceeding this, preventing softlocks from malformed templates or bugs.
- **Director override:** Director interactions use priority 95 (Override band), so they can always preempt any active interaction.
- **Watchdog:** Step 1 of each tick releases expired and over-max locks before processing new interactions.

### Cascade Depth Limit

Chained interactions (`spawn-interaction` effects) are capped at depth 3. Depth is tracked on each interaction via `chainDepth`. This prevents runaway cascades while allowing rich multi-step sequences.

### Lock Ownership

The InteractionBus is the **sole lock authority**. ConversationEngine (from the Rich Dialogue Expansion spec) must be built lock-free — it queries the bus for lock state via `getActive()` rather than maintaining its own `Set<string>()`. This is a reconciliation with the Rich Dialogue Expansion spec: the lock model described there is superseded by the bus.

---

## 4. IntentResolvers

Every entity type implements a resolver that decides "what do I want to do?" and expresses it as an `Interaction` submitted to the bus.

### Agent IntentResolver

Agents produce intents via a new BT subtree `[InteractionIntent]` in the existing master selector:

```
root { selector {
  [UrgentReaction]       → existing
  [NeedsEnergy]          → existing
  [NeedsHunger]          → existing
  [NeedsThirst]          → existing
  [NeedsSocial]          → existing
  [NeedsFocus]           → existing
  [NeedsMorale]          → existing
  [JourneyExecution]     → existing
  [WorkCycle]            → existing
  [InteractionIntent]    → NEW: evaluate social/work/playful intents
  [SocialBehavior]       → existing (fallback for simple proximity chat)
  [IdleBehavior]         → existing
} }
```

The `[InteractionIntent]` subtree evaluates:
- Relationship state (who's nearby, affinity levels, unresolved tensions)
- Current needs (high social need → seek group, low morale → seek comfort)
- Recent interaction history (avoid repeating, escalate running jokes)
- World context (phase, events, room mood)

Selects from the InteractionTemplate registry and submits to bus. If rejected or queued, BT falls through to simpler social/idle behavior.

### Pet IntentResolver

New subtree in pet BT. Simpler intent logic driven by:
- Hunger/thirst → seek bowls or beg from nearest agent
- Affinity → approach favorite agent, bring gifts, follow
- Energy → zoomies when high, sleep when low
- Social catalyst instinct → sensing tension between agents triggers `SitBetween` or `DragToy`

Pets filter to `social`, `care`, `playful`, and `reactive` categories only. No `work` or `commerce`.

### NPC IntentResolver

Rule tables — simpler than BT, stateless, data-driven:

```typescript
interface NPCInteractionRule {
  npcRole: string;              // "merchant", "courier", "visitor"
  trigger: "proximity" | "schedule" | "event" | "idle-timeout";
  conditions: InteractionPrerequisite[];
  interaction: Partial<Interaction>;
  weight: number;
  cooldownMs: number;
}
```

Merchant example rules:
- Agent lingers near stall > 3s → initiate `commerce` pitch
- Agent walks past → 20% chance call out a deal
- No customers for 60s → grumble to self (ambient)
- Two agents nearby → comment on their relationship

New NPC types add more rules. A courier NPC spawned by a "package delivery" world event brings its own rule table.

**NPC Framework:** NPCs are a spawning system. The world can introduce temporary or permanent NPCs based on events (client visits, auditor arrives, new hire onboards). Each NPC type is defined by its role string and associated rule table. The merchant is the first concrete NPC; the framework supports any number of future roles.

### Room/Environment IntentResolver

Condition-driven evaluator running each tick:

```typescript
interface RoomInteractionRule {
  roomType: string;             // "office", "village", "hub", "station"
  layer: "passive" | "reactive" | "active";
  conditions: EnvironmentCondition[];
  interaction: Partial<Interaction>;
  cooldownMs: number;
}

type EnvironmentCondition =
  | { type: "occupancy"; op: ">" | "<" | "=="; value: number }
  | { type: "collective-mood"; mood: string; threshold: number }
  | { type: "phase"; phases: DayPhase[] }
  | { type: "event-recent"; eventType: string; withinMs: number }
  | { type: "weather"; weather: string };
```

Three layers:
- **Passive:** Environmental effects based on room type + phase (office morning → focus boost). Not interactions — direct stat modifiers.
- **Reactive:** Room responds to collective state. 3+ agents arguing → lights dim, tension particles, `room-pressure` interaction targeting all occupants.
- **Active:** Room initiates. Notice board unseen for 2 cycles → board glows, `environmental` interaction targeting nearest idle agent.

### Director IntentResolver

User clicks/commands → immediate, high-priority interactions (priority 85+):

- Click agent → interaction menu (talk to, assign task, reassign, praise, scold)
- Click pet → pet menu (pet, feed, rename, send to agent)
- Click object → trigger action OR direct an agent to use it
- Click room → room commands (call meeting, clear room, change mood)
- Multi-select agents → group commands (team huddle, reassign, group praise)

Director interactions skip most prerequisites (you're the boss) but still route through the bus so they chain properly — praising an agent in front of a rival triggers the rival's `reactive` jealousy.

---

## 5. Integration with Existing Systems

The interaction system connects to everything already built without replacing it.

### Conversation System

TalkEngine and ConversationEngine become **effect executors**:
- `bubble` effects → delegate to TalkEngine for phrase selection (existing resolution chain, tier modifiers, fragment composer)
- `social` interactions with duration > 0 → delegate to ConversationEngine for multi-turn script playback
- Bus owns all locks. ConversationEngine checks the bus instead of managing its own — unified lock model.

The rich dialogue expansion spec (conversation scripts, running jokes, gossip, pet talk) stays exactly as designed. The interaction system becomes the **trigger layer** that decides *when* scripts fire.

### Relationship System

Both input and output:
- **Input:** IntentResolvers read affinity, tier, shared memories, joke play counts to select interaction templates
- **Output:** Bus applies `affinity-change` effects → relationship system processes them. Tier transitions emit `tier-change` events → can spawn new interactions (reconciliation arcs, best-friend bonding)

No changes to relationship-system.ts internals.

### Behaviour Tree

Minimal changes:
1. New `[InteractionIntent]` subtree (slot in existing master selector)
2. New blackboard flag: `activeInteraction: Interaction | null` (set by bus when locked)
3. New condition `IsInInteraction()` — other subtrees check this and yield if true

BT still drives everything. Interaction system is a new channel for the BT to express social/environmental decisions.

### Economy & Tasks

- `commerce` interactions carry `economy-transaction` effects (merchant → agent purchase)
- `work` interactions trigger task creation via task engine
- Task completion → `reactive` celebration auto-spawned with economy reward effects

### World Events

`world-event-scheduler.ts` becomes an interaction producer:
- Build break → submits `reactive` interaction targeting all agents, priority 80
- Deploy success → submits `reactive` celebration, `many-to-many`
- Birthday → submits `social` party cluster

World events get conflict resolution, locking, and chaining automatically.

### Persistence

- History (configurable, default last 200): `.flowti/var/interaction-log.jsonl` (append-only)
- Each JSONL line includes `"v": 1` schema version for forward-compatible parsing
- On session resume: active interactions discarded, history loaded for narrative continuity, cooldowns restored from timestamps

---

## 6. CLI / Plugin Layer Split

### CLI Domain (`src/domain/interactions/`)

Pure types, validation, resolution logic. No Excalibur, no UI.

| File | Responsibility |
|------|----------------|
| `interaction-types.ts` | All interfaces — `Interaction`, `EntityRef`, `InteractionEffect`, `InteractionPrerequisite`, etc. |
| `interaction-bus.ts` | Core bus logic — queue, validate, conflict resolve, lock manager, cascade depth, history ring buffer |
| `interaction-templates.ts` | Registry loader + selection algorithm for `InteractionTemplate` definitions |
| `templates/*.ts` | Template data files (agent-agent, agent-pet, npc-interactions, etc.) — pure data, CLI domain |
| `intent-resolver-types.ts` | `IntentResolver` interface, `NPCInteractionRule`, `RoomInteractionRule` types |
| `interaction-effects.ts` | Effect applicator — maps effect types to state changes (affinity, needs, mood, economy) |
| `interaction-persistence.ts` | Read/write `interaction-log.jsonl`, cooldown restoration on resume |

### Plugin Game Layer (`src/game/systems/interaction/`)

Wires CLI domain logic into the Excalibur game loop.

| File | Responsibility |
|------|----------------|
| `interaction-system.ts` | Owns `InteractionBus` instance. Calls `bus.tick()` each frame. Routes `InteractionAction[]` to EventBus. |
| `agent-intent-resolver.ts` | Reads BT context + world state, produces agent interactions. Plugs into `[InteractionIntent]` subtree. |
| `pet-intent-resolver.ts` | Reads pet BT context, produces pet interactions. |
| `npc-intent-resolver.ts` | Evaluates NPC rule tables against world state. |
| `room-intent-resolver.ts` | Evaluates room condition rules against occupancy, collective mood, phase. |
| `director-intent-resolver.ts` | Translates user clicks/commands into interactions. |
| `interaction-effect-renderer.ts` | Visual side of effects — triggers bubbles via TalkEngine, particles, sounds, sprite animations. |

### Tick Integration

Slots into the existing engine loop (from `engine-simulation.ts`), expanding it from 12 to 13 phases. The interaction bus tick goes between `tickBrain` (phase 9, where BT produces intents) and `tickSocial` (phase 11):

```
 1. tickClock
 2. tickSensor
 3. tickNeeds
 4. tickReactiveTriggers
 5. tickBehaviorThresholds
 6. tickPets                    ← pet BT produces intents here
 7. tickRoomTransit
 8. tickBehaviorTree
 9. tickBrain                   ← agent BT produces intents here
10. tickInteractions            ← NEW: InteractionBus.tick() — process queue, resolve, execute effects
11. tickSocial                  ← SIMPLIFIED: proximity detection only (see below)
12. tickDirector
13. tickVisuals                 ← renders interaction bubbles alongside existing visuals
```

### SocialSystem Handoff

The existing `SocialSystem` is simplified — it retains proximity detection but stops triggering conversations or managing cooldowns:

| Responsibility | Before | After |
|---|---|---|
| Proximity detection (pairwise distance) | SocialSystem | SocialSystem (unchanged) |
| Proximity timers + thresholds | SocialSystem | InteractionBus (via prerequisites) |
| Conversation triggering | SocialSystem | IntentResolvers → InteractionBus |
| Cooldown management | SocialSystem | InteractionBus |
| Cluster formation detection | SocialSystem | SocialSystem (feeds data to resolvers) |

IntentResolvers query `SocialSystem.getNearbyEntities(entityId)` for proximity data. SocialSystem's `onConversation` callback is deprecated in favor of bus lifecycle events.

### Data Flow

```
Agent BT → [InteractionIntent] subtree → submit to bus
Pet BT   → Pet intent subtree          → submit to bus
NPC      → Rule table evaluation        → submit to bus
Room     → Condition evaluation          → submit to bus
Director → Click handler                → submit to bus
                    ↓
            InteractionBus.tick()
                    ↓
        ┌── validate prerequisites
        ├── conflict resolution
        ├── lock participants
        ├── apply effects (CLI domain: state changes)
        ├── render effects (Plugin: visuals, bubbles, particles)
        ├── spawn chained interactions (depth ≤ 3)
        └── record to history + emit lifecycle events
```

---

## 7. Interaction Template Registry

Templates are pure data definitions that IntentResolvers select from based on context.

### Template Interface

```typescript
interface InteractionTemplate {
  id: string;
  category: InteractionCategory;
  action: string;
  cardinality: Cardinality;

  // Who can initiate / receive
  initiatorTypes: EntityRef["entityType"][];
  targetTypes: EntityRef["entityType"][];

  // Eligibility
  prerequisites: InteractionPrerequisite[];

  // Selection
  weight: number;
  tags: string[];                    // "humor", "tension", "bonding", "work"
  tierRange?: [string, string];      // relationship tier filter
  phaseFilter?: string[];            // day phases

  // Execution
  priority: number;
  cooldownMs: number;
  duration?: number;
  effects: InteractionEffect[];

  // Chaining
  chainTemplates?: string[];         // template IDs for follow-ups
  chainChance?: number;              // 0-1 probability
}
```

### Sample Templates

**Agent → Agent (1:1, social) — "code-review-banter":**
- Colleague+ tier, productive-morning phase
- Bubble effect (initiator: "Did you see that PR?", target picks from review phrases)
- Affinity +1
- 20% chain → "code-review-escalation" (friend+ tier: playful argument)

**Agent → Pet (1:1, care) — "sneak-treat":**
- Agent near food bowl + pet nearby, friend+ affinity with pet
- Bubble (agent: "Don't tell anyone...", pet instinct voice: "FOOD GIVER IS BEST GIVER")
- Pet hunger +15, pet affinity +3
- 30% chain → nearby agent notices → "caught-sneaking-treat" (reactive, humor)

**Pet → Agent cluster (1:N, playful) — "zoomies-disruption":**
- Pet energy > 80, 2+ agents in conversation
- Pet runs circles around group
- All targets: reactive surprise bubbles
- Conversation lock broken, social +5, mood lift
- 15% chain → one agent chases pet → "chase-sequence"

**Room → All occupants (environmental, reactive) — "crunch-time-pressure":**
- Office room, 4+ agents, afternoon-slump phase, 2+ agents low morale
- Room mood → "tense", lights dim, tension particles
- All agents: focus -3, stress bubble chance +20%
- 25% chain → one agent snaps → "need-a-break" (seeks couch)

**NPC → Agent (1:1, commerce) — "merchant-pitch":**
- Agent proximity > 3s, agent coin > 50
- Merchant bubble: pitch phrases based on agent trust tier
- Commerce interaction (agent accept/decline via BT)
- If accepted: economy-transaction
- 10% chain → nearby agent: "What did you buy?"

**Director → Agent group (1:N, directive) — "team-huddle":**
- Director multi-selects 3+ agents
- All targets walk to nearest whiteboard
- Group conversation script (round-robin bubbles)
- Social +10, focus +5
- Memory record: "Director called a huddle about {topic}"

**Agent → Room (entity-to-environment) — "decorate-desk":**
- Agent in office, idle, morale > 70, has cosmetic item
- Agent walks to workstation, item appears on desk
- Room mood → "cozy" (+2)
- 40% chance nearby agents comment

### Template Selection Algorithm

IntentResolvers select templates using weighted random selection (consistent with TalkEngine's existing `weightedRandom()`):

1. **Filter** — Narrow to templates matching: initiator entity type, available target types, prerequisite checks, tier range, phase filter, cooldown clear
2. **Tag boost** — Templates whose tags match current context (e.g., agent is low morale → "comfort" tag boosted 2x) get weight multiplied
3. **Recency penalty** — Templates in the interaction history (last 10 per entity pair) get weight halved to avoid repetition
4. **Weighted random** — Select from remaining candidates using `weight` as probability distribution

### Template File Organization

Templates are pure data and live in the **CLI domain** layer (`src/domain/interactions/templates/`):

```
src/domain/interactions/templates/
  agent-agent.ts        — ~40 templates
  agent-pet.ts          — ~20 templates
  pet-social.ts         — ~15 templates (pet-initiated)
  npc-interactions.ts   — ~15 templates (per NPC role)
  room-reactions.ts     — ~20 templates (per room type)
  director-commands.ts  — ~15 templates
  environment-events.ts — ~10 templates
  cross-type.ts         — ~15 templates (multi-type chains)
```

Starting with ~150 templates. Chain mechanics (20-30% chain rates) multiply effective variety into hundreds of unique interaction sequences.

---

## 8. Testing Strategy

Tests mirror source per project convention:

### CLI Domain Tests (`tests/domain/interactions/`)

| Test File | Covers |
|-----------|--------|
| `interaction-bus.test.ts` | Queue, validation, conflict resolution, locking, cascade depth, expiry, watchdog |
| `interaction-effects.test.ts` | Effect applicator — each effect type produces correct state changes |
| `interaction-templates.test.ts` | Template registry — filtering, weighted selection, recency penalty, tag boost |
| `interaction-persistence.test.ts` | JSONL read/write, cooldown restoration, schema versioning |

Mock strategy: Bus tests use in-memory entity state (no disk, no Excalibur). Effect tests mock relationship system and economy interfaces. Template tests use fixture templates.

### Plugin Game Tests (`tests/game/systems/interaction/`)

| Test File | Covers |
|-----------|--------|
| `interaction-system.test.ts` | Tick integration, action routing to EventBus |
| `agent-intent-resolver.test.ts` | BT context → interaction submission logic |
| `pet-intent-resolver.test.ts` | Pet BT context → interaction filtering (no work/commerce) |
| `npc-intent-resolver.test.ts` | Rule table evaluation, trigger matching |
| `room-intent-resolver.test.ts` | Condition evaluation, layer behavior (passive/reactive/active) |

Mock strategy: Resolver tests mock SocialSystem for proximity data. System test mocks InteractionBus to verify tick calls and action routing.

---

## 9. What This Does NOT Touch

- Excalibur rendering, actors, sprites — unchanged
- BT core (factory, tick, subtree MDSL) — only adds one new subtree
- TalkEngine internals — unchanged, called via effect delegation
- CLI domain purity — interaction types and bus logic are pure domain code
- Day clock, needs system, memory system — unchanged, read by resolvers
- Rich dialogue expansion content — stays as designed, interaction system triggers it
