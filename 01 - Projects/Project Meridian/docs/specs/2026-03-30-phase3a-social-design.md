# Phase 3A: Social Foundation — Design Spec

## 1. Goal

Make agents talk, share information, and form persistent relationships. Template-based dialogue replaces generic socialization. Gossip propagates location knowledge and reputation through the population. Relationship data checkpoints to Obsidian Canvas files for Director visibility.

Phase 3A delivers visible social behavior without external dependencies. LLM integration, Circuit Breaker, priority queue, and Chronicler agent are deferred to Phase 3B.

## 2. Exit Criteria

1. Two agents with `btAction: 'talk'` produce dialogue memories with actual template lines (not generic "Talked with X")
2. Dialogue tone derived from mood + disposition — positive pair yields positive tone, negative pair yields negative
3. Disposition updates after dialogue based on conversation tone
4. Gossip exchanges only when `familiarity >= gossip_familiarity_threshold` — strangers don't gossip
5. Location gossip transfers with reliability degradation (1.0 → 0.7 after one hop)
6. Reputation gossip shifts receiver's disposition toward subject, scaled by reliability
7. Agents with IQ >= 12 reject gossip below 0.3 reliability
8. Gossip stops propagating at hop count 4
9. Duplicate gossip (same location/subject) is not re-transferred
10. Relationship graph `.canvas` file written every N ticks with correct Obsidian Canvas JSON format
11. Per-agent filtered relationship view generated on demand via event trigger
12. All existing tests still pass (no regressions)
13. tsc, eslint, vitest all green

## 3. Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Template storage | Inline TypeScript registry (`Record<string, string[]>`) | No file I/O or locale system needed yet. Keeps focus on systems, not content authoring. Trivially swappable for vault-loaded files in Phase 3B. |
| Relationship persistence | Single world graph (`03 - Resources/Graphs/relationships.canvas`) + per-agent views on demand | One file, one write, one source of truth. Per-agent filtered views generated only when Director requests via event. Avoids duplicate data across per-agent files. |
| Gossip types | Location knowledge + reputation | Durable information with immediate gameplay value. Stock gossip deferred to Phase 5 (dynamic economy). |
| Dialogue integration | Separate DialogueSystem (priority 12) downstream of SocializeSystem (6.7) | SocializeSystem stays lean (need recovery + cooldown). DialogueSystem handles rich social layer. Event-based coordination matches existing codebase pattern. Dialogue can be toggled without breaking basic socialization. |
| Gossip system | Separate GossipSystem (priority 12.5) downstream of DialogueSystem | Clean isolation for testing. GDD envisions gossip growing (stock gossip Phase 5, opportunity gossip Phase 6). Avoids future extraction from DialogueSystem. |

### Deferred to Phase 3B

| Feature | GDD Section | Notes |
|---------|-------------|-------|
| LLM Provider interface | §10.2 | CursorAPIProvider, prompt assembly, response parsing |
| Circuit Breaker | §16.3 | State machine for LLM fallback |
| LLM Priority Queue | §10.5 | Director > Chronicler > Agent-to-agent |
| Chronicler Agent | §21 | Observer entity: narrator, historian, onboarding |
| Agent-to-Agent LLM dialogue | §10.4 | Both-LLM and mixed modes |
| Locale/file-based templates | §10.1 | Vault-loaded markdown templates |

## 4. Detailed Design

### 4.1 System Pipeline

```
Existing tick order:
  TraitResolver (0.5) → DayNight (0.7) → NeedsDecay (1) → Mood (2) →
  Perception (3) → Memory (4) → BehaviorTree (5) → Movement (5.5) →
  Facility (6) → Rest (6.5) → Feed (6.6) → Socialize (6.7) →
  Trade (11)

New systems inserted:
  → Dialogue (12) → Gossip (12.5) → ... → RelationshipCheckpoint (19)
```

**Data flow per tick:**

1. **SocializeSystem (6.7)** — detects `talk` pairs, recovers social need, emits `SocialInteraction` event with `{ agentId, partnerId, memoryCreated }`.
2. **DialogueSystem (12)** — reads `SocialInteraction` events from this tick via `deps.eventBus.history()` filtered to `event.tick === deps.tickCount && event.type === 'SocialInteraction'`. Skips events where `memoryCreated === false` (agents on cooldown — no dialogue for non-interactions). For each qualifying pair: selects dialogue lines via template registry, creates rich dialogue memories (overwriting the generic "Talked with X"), updates disposition based on tone, sets `bb.state.gossipPending` on both agents (bidirectional gossip exchange) if familiarity meets threshold.
3. **GossipSystem (12.5)** — iterates agents with `gossipPending` on blackboard. Transfers location knowledge and reputation gossip with reliability degradation. Creates `type: 'gossip'` memories. Applies reputation-based disposition changes. Clears blackboard flag.
4. **RelationshipCheckpointSystem (19)** — every N ticks, serializes relationship graph to `.canvas` file. Handles `RequestAgentRelationshipView` events for on-demand per-agent views.

### 4.2 File Map

```
New domain files:
  domain/systems/dialogue.ts                — template registry, selectDialogue()
  domain/systems/gossip.ts                  — exchangeGossip(), reliability logic
  domain/systems/relationship-canvas.ts     — Canvas JSON serialization

New infrastructure files:
  infrastructure/systems/dialogue-system.ts               — GameSystem wrapper
  infrastructure/systems/gossip-system.ts                  — GameSystem wrapper
  infrastructure/systems/relationship-checkpoint-system.ts — GameSystem wrapper

Modified files:
  domain/core/component-data.ts      — RelationshipEntry gains tags + lastInteractionTick
  domain/core/tick-scheduler.ts      — Add GOSSIP (12.5) priority constant
  domain/schemas/game-config-schema.ts — Extend GossipConfigSchema with 3 new fields
  infrastructure/engine/game-view.ts — Register 3 new systems
  infrastructure/entity/agent-actor.ts       — Add readonly color field for Canvas serialization
  infrastructure/systems/movement-system.ts   — Populate bb.state.knownLocations on arrival
  infrastructure/systems/facility-system.ts  — Adapt to RelationshipEntry new fields, add 'worked_with' tag
  infrastructure/systems/trade-system.ts     — Adapt to RelationshipEntry new fields, add 'traded_with' tag
  infrastructure/systems/socialize-system.ts — Adapt to RelationshipEntry new fields
  domain/systems/relationship.ts             — Adapt to RelationshipEntry new fields
```

### 4.3 Dialogue System

#### Template Registry

Inline TypeScript `Record<string, string[]>` keyed by `{kind}:{moodBucket}`:

```typescript
const DIALOGUE_TEMPLATES: Record<string, string[]> = {
  'merchant:elated':    ['Business is booming! What can I get you?', 'A fine day for trade!', ...],
  'merchant:content':   ['Fair prices today. Looking for anything?', ...],
  'merchant:stressed':  ['I need to move this stock...', ...],
  'merchant:distressed':['I can barely keep the stall open.', ...],
  'merchant:breakdown': ['...just take what you need.', ...],
  'guard:elated':       ['All quiet on the watch — fine day!', ...],
  // ... 4 kinds × 5 mood buckets = 20 entries, 3-5 lines each
};
```

Fallback: if no template matches (unknown kind), use a generic `'default:{moodBucket}'` entry.

#### Domain Function

```typescript
interface DialogueInput {
  agentKind: string;
  agentName: string;
  agentMoodBucket: string;
  partnerKind: string;
  partnerName: string;
  partnerMoodBucket: string;
  disposition: number;           // agent's disposition toward partner
  partnerDisposition: number;    // partner's disposition toward agent
  familiarity: number;
  gossipFamiliarityThreshold: number;
  rng: GameRNG;
}

interface DialogueResult {
  agentLine: string;
  partnerLine: string;
  tone: 'positive' | 'negative' | 'neutral';
  dispositionChange: number;
  shouldExchangeGossip: boolean;
}
```

**Tone determination** (uses `minDisposition = Math.min(disposition, partnerDisposition)`):
- Both agents' mood bucket is `content` or `elated` AND `minDisposition >= 0` → `positive` (+1 disposition)
- Either agent's mood bucket is `distressed` or `breakdown` OR `minDisposition <= -20` → `negative` (-1 disposition)
- Otherwise → `neutral` (0 disposition change)

**Line selection:** `Math.floor(rng.range(0, templates.length))` picks from the array for each agent's kind + mood bucket. (`GameRNG.range` returns a float; floor converts to a valid index.)

**Gossip gate:** `shouldExchangeGossip = familiarity >= gossipFamiliarityThreshold`

#### Infrastructure System

- Priority: `SystemPriority.DIALOGUE` (12, already reserved)
- **Event reading:** Uses `deps.eventBus.history()` filtered to `event.tick === deps.tickCount && event.type === 'SocialInteraction'`. This is stateless — no subscription needed. Events are already in history because SocializeSystem's batch was flushed before DialogueSystem runs.
- **Cooldown filter:** Skips events where `payload.memoryCreated === false` (agents on cooldown produce no dialogue).
- **Agent lookup:** If either agent cannot be found in the agent list, skip the pair (defensive null check).
- For each qualifying event: looks up both agents, reads mood/disposition/familiarity, calls `selectDialogue`
- **RNG creation:** Per-pair seeded RNG via `createGameRNG((deps.tickCount ^ hashString(pairKey)) >>> 0)` where pairKey is the alphabetically-sorted agent ID pair (same pattern as BehaviorTreeSystem).
- **Memory replacement:** Finds and removes the generic `type: 'social'` memory created by SocializeSystem for this pair this tick (match by `type === 'social' && tick === deps.tickCount && participants includes partnerId`). Replaces it with a richer `type: 'dialogue'` memory whose description includes the actual template line, participants, tone-based outcome and mood_impact. This avoids duplicate memories per interaction.
- Updates both agents' RelationshipComponent disposition via `applyRelationshipUpdate`, with `lastInteractionTick: deps.tickCount` and `tags` array appended with `'talked_with'` (if not already present).
- If `shouldExchangeGossip`: sets `bb.state.gossipPending = partnerId` on **both agents** (bidirectional — each agent shares gossip with the other)
- Emits `DialogueCompleted` event with `{ agentId, partnerId, tone, agentLine, partnerLine }`

### 4.4 Gossip System

#### Gossip Data Types

```typescript
interface LocationGossip {
  gossipType: 'location';
  locationId: string;
  locationType: string;
  position: { x: number; y: number };
  reliability: number;
  sourceAgentId: string;
  hopCount: number;
}

interface ReputationGossip {
  gossipType: 'reputation';
  subjectAgentId: string;
  dispositionBias: number;    // range [-10, +10] — small nudge, not absolute override
  reliability: number;
  sourceAgentId: string;
  hopCount: number;
}

type GossipData = LocationGossip | ReputationGossip;
```

Gossip data is stored in the `metadata` field of a MemoryEntry (see Section 4.6), with `type: 'gossip'`. The `description` holds a human-readable summary. The `participants` array contains the source agent. The `significance` is set to `reliability * 5` (so high-reliability gossip is more memorable and low-reliability gossip naturally decays faster).

#### Domain Function

```typescript
interface GossipExchangeInput {
  giverGossip: { memory: MemoryEntry; data: GossipData }[];
  receiverGossip: { memory: MemoryEntry; data: GossipData }[];
  receiverIQ: number;
  reliabilityTiers: number[];           // [1.0, 0.7, 0.5, 0.3]
  iqFilterThreshold: number;            // 12
  minReliability: number;               // 0.3
  maxItemsPerExchange: number;          // 2
  currentTick: number;
}

interface GossipExchangeResult {
  transferred: {
    memory: MemoryEntry;
    dispositionChanges: { agentId: string; change: number }[];
  }[];
}
```

**Transfer rules:**
1. Giver selects up to `maxItemsPerExchange` gossip items (highest significance first)
2. Each item's reliability degrades: `newReliability = reliabilityTiers[hopCount]` (look up by new hop count)
3. If `hopCount >= reliabilityTiers.length`, gossip is too stale — skip
4. If `newReliability < minReliability` AND `receiverIQ >= iqFilterThreshold` — skip (smart agents reject unreliable gossip)
5. Duplicate check: if receiver already has gossip with same `locationId` (location type) or same `subjectAgentId` (reputation type) — skip
6. For reputation gossip: compute `dispositionBias * newReliability` as disposition change toward subject

#### Infrastructure System

- Priority: `SystemPriority.GOSSIP` (12.5, new constant)
- **Bidirectional exchange:** DialogueSystem sets `gossipPending` on both agents. GossipSystem processes each direction independently (A→B and B→A). Uses a `processedPairs` set (same pattern as SocializeSystem) to avoid double-processing when iterating the agent list.
- For each agent with `bb.state.gossipPending` set (and pair not yet processed):
  - Finds partner from `gossipPending` value (partner agent ID)
  - Extracts gossip from giver: (a) gossip-type memories from MemoryComponent (`entry.type === 'gossip'` with `metadata`), and (b) first-hand location knowledge from `bb.state.knownLocations` (converted to location gossip at reliability 1.0, hop count 0)
  - Calls `exchangeGossip` domain function for A→B direction
  - Calls `exchangeGossip` domain function for B→A direction
  - Writes transferred gossip to each receiver's MemoryComponent
  - Applies reputation disposition changes to each receiver's RelationshipComponent
  - Clears `bb.state.gossipPending` on both agents
  - Emits `GossipExchanged` event with `{ agentAId, agentBId, aToB: number, bToA: number, types: string[] }`

### 4.5 Relationship Checkpoint System

#### Canvas Serialization

Domain function `serializeRelationshipGraph(input) → string`:

```typescript
interface RelationshipGraphInput {
  agents: { id: string; name: string; kind: string; color: string }[];
  relationships: { agentId: string; entries: RelationshipEntry[] }[];
}
```

**Node layout:** Agents arranged in a circle centered at (400, 300) with radius 200 (evenly spaced by index). Fixed node `width: 160, height: 60`.

**Edge rules:**
- Only include edges where `familiarity > 0` (skip strangers who never interacted)
- Edge label: `"disposition: {N} | familiarity: {N}"`
- Edge color: disposition >= 20 → `"4"` (green), disposition <= -20 → `"1"` (red), else `"0"` (grey)
- Edge ID: `"rel-{fromId}-{toId}"`

**Per-agent view** `serializeAgentRelationshipView(agentId, input) → string`:

Same format, filtered to only edges involving the specified agent. Target agent centered at (400, 300), connected agents arranged in a semicircle. Positive offset ensures all nodes are visible when the Canvas file is opened in Obsidian.

#### Infrastructure System

- Priority: `SystemPriority.VAULT_SYNC` (19, existing)
- Internal counter: `ticksSinceCheckpoint`
- Every `config.relationships.checkpoint_interval_ticks` ticks:
  - Collects all agents and their RelationshipComponents
  - Calls `serializeRelationshipGraph`
  - Writes to `03 - Resources/Graphs/relationships.canvas` via `deps.writeFile`
  - Emits `RelationshipGraphCheckpointed` event
- **On-demand views:** Reads `deps.eventBus.history()` filtered to `event.tick === deps.tickCount && event.type === 'RequestAgentRelationshipView'` (same pattern as DialogueSystem). For each event:
  - Calls `serializeAgentRelationshipView` with `payload.agentId`
  - Writes to `03 - Resources/Graphs/{agentName}-relationships.canvas` via `deps.writeFile`

### 4.6 Type Extensions

**RelationshipEntry** — two new fields with backward-compatible defaults:

```typescript
export interface RelationshipEntry {
  agentId: string;
  disposition: number;
  familiarity: number;
  tags: string[];              // NEW — 'traded_with', 'gossiped_about', 'worked_with'
  lastInteractionTick: number; // NEW — tick of most recent interaction
}
```

All existing code that creates RelationshipEntry objects must add `tags: []` and `lastInteractionTick: 0` (or `deps.tickCount` where appropriate). Callers of `applyRelationshipUpdate` continue to construct the full `RelationshipEntry` — the domain function returns `{ newDisposition, newFamiliarity }` and callers spread in `tags` and `lastInteractionTick` at the call site.

**Tag assignments by system:**

| System | Tag | When |
|--------|-----|------|
| DialogueSystem | `'talked_with'` | On dialogue completion |
| GossipSystem | `'gossiped_about'` | On gossip exchange (added to relationship with the gossip subject, not the conversation partner) |
| FacilitySystem | `'worked_with'` | On production cycle complete (existing call site) |
| TradeSystem | `'traded_with'` | On successful purchase (existing call site) |

Tags are append-only and deduplicated (check `!tags.includes(tag)` before pushing). `lastInteractionTick` is set to `deps.tickCount` at every call site that modifies a relationship.

**AgentActor** — add `readonly color: string` to the class, assigned from `agent.color` in the constructor. Needed by RelationshipCheckpointSystem for Canvas node colors.

**MemoryEntry** — add optional `metadata` field for structured gossip data:

```typescript
export interface MemoryEntry {
  tick: number;
  type: string;
  description: string;
  participants: string[];
  outcome: 'positive' | 'negative' | 'neutral';
  significance: number;
  mood_impact: number;
  original_significance?: number;
  metadata?: Record<string, unknown>;  // NEW — structured data for gossip, etc.
}
```

Gossip data (`LocationGossip` or `ReputationGossip`) is stored in `metadata` rather than JSON-encoded in `description`. The `description` field holds a human-readable summary (e.g., "Heard from Elena: the bakery is near the market"). The `metadata` field holds the machine-readable gossip payload for programmatic access. Gossip memories participate in normal memory decay — their significance is set to `reliability * 5`, so low-reliability gossip naturally decays faster.

**Location knowledge tracking** — agents track known locations via `bb.state.knownLocations`:

MovementSystem already emits `AgentArrived` events. The existing arrival code in MovementSystem sets `bb.state.atLocation = rawTarget.id`. We extend this: when an agent arrives at a location for the first time, add it to `bb.state.knownLocations` (a `Set<string>` serialized as `string[]` on the blackboard). This is populated by MovementSystem on arrival. GossipSystem reads `knownLocations` to build first-hand location gossip at reliability 1.0 for the giver.

**New SystemPriority constant:**

```typescript
GOSSIP: 12.5,   // between DIALOGUE (12) and PROGRESSION (13)
```

**Config changes** — extend existing sections rather than creating new ones:

The codebase already has a `GossipConfigSchema` with `reliability_tiers` and `iq_filter_threshold`, plus a top-level `canvas_checkpoint_interval_ticks`. Extend these:

```typescript
// Extend existing GossipConfigSchema (add new fields)
const GossipConfigSchema = z.object({
  reliability_tiers: z.array(z.number()).default([1.0, 0.7, 0.5, 0.3]),  // existing
  iq_filter_threshold: z.number().default(12),                           // existing
  familiarity_threshold: z.number().default(3),                          // NEW
  max_items_per_exchange: z.number().int().default(2),                   // NEW
  min_reliability: z.number().default(0.3),                              // NEW
});

// Existing top-level field — no change needed:
// canvas_checkpoint_interval_ticks: z.number().int().default(50)
```

DialogueSystem and GossipSystem read from `deps.config.gossip.*`. RelationshipCheckpointSystem reads from `deps.config.canvas_checkpoint_interval_ticks`.

### 4.7 Event Summary

| Event | Source | Payload |
|-------|--------|---------|
| `SocialInteraction` | SocializeSystem (existing) | `{ agentId, partnerId, memoryCreated }` |
| `DialogueCompleted` | DialogueSystem (new) | `{ agentId, partnerId, tone, agentLine, partnerLine }` |
| `GossipExchanged` | GossipSystem (new) | `{ agentAId, agentBId, aToB: number, bToA: number, types: string[] }` |
| `RelationshipGraphCheckpointed` | RelationshipCheckpointSystem (new) | `{ tickCount, agentCount, edgeCount, path }` |
| `RequestAgentRelationshipView` | External (Director UI) | `{ agentId }` |

## 5. Test Strategy

| Layer | File | Coverage |
|-------|------|----------|
| Domain | `tests/domain/systems/dialogue.test.ts` | Template selection by kind + mood, fallback to default, tone determination (positive/negative/neutral), disposition change calculation, gossip gate threshold, RNG line selection |
| Domain | `tests/domain/systems/gossip.test.ts` | Reliability degradation per hop, IQ-based filtering, duplicate detection (location + reputation), hop limit at 4, reputation disposition effect scaled by reliability, max items per exchange, empty giver |
| Domain | `tests/domain/systems/relationship-canvas.test.ts` | Canvas JSON structure, circle layout coordinates, edge color from disposition, familiarity > 0 filter, per-agent view filtering, empty graph |
| Infra | `tests/infrastructure/systems/dialogue-system.test.ts` | Event-driven activation from SocialInteraction, memory creation with dialogue lines, disposition update, gossipPending blackboard flag, DialogueCompleted event |
| Infra | `tests/infrastructure/systems/gossip-system.test.ts` | Blackboard flag consumption, gossip memory writes, reputation disposition changes, GossipExchanged event, flag cleared after processing |
| Infra | `tests/infrastructure/systems/relationship-checkpoint-system.test.ts` | Tick counter respects interval, writeFile called with valid JSON, on-demand view via event, checkpoint event emitted |
| Integration | `tests/integration/social-integration.test.ts` | Full pipeline: socialize → dialogue → gossip → checkpoint in one tick sequence |

Estimated: ~60-70 new tests.
