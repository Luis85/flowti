# Echo System — Emergent Behavior Engine

**Status:** Approved
**Increment:** 3 (post merchant/narrative/offline + interaction system)
**Date:** 2026-03-22
**Goal:** Create a system of emergent behavior where social emergence, systemic chain reactions, and agent autonomy arise from accumulated weighted preferences — observable through behavior, inspectable on demand.

---

## 1. Overview

The Echo System is a lightweight event-residue layer that sits between existing game systems. Every meaningful game event leaves an **echo** — a weighted preference record — on the agents involved. Echoes decay over time, modify behavior tree weights, bias dialogue selection, drift relationship affinity, shape spatial preferences, and feed narrative beats. When echoes cross intensity thresholds, they trigger **cascading reactions** — agent behaviors that produce new events, which produce new echoes on other agents.

The result: agents develop opinions, form habits, avoid things that burned them, seek out agents they like, gossip about agents they don't — all without scripting. The player discovers these patterns through observation; clicking an agent reveals an "Inner World" panel showing their current echoes.

### Design Principles

- **Effect over history** — Store the behavioral residue, not the event journal. "deploy-aversion: -15" not "failed deploy on cycle 42 because timeout."
- **Decay is the default** — Every echo fades. Only repeated reinforcement creates lasting preferences. Forgetting is a feature.
- **Systems compose** — The echo system doesn't own behavior. It nudges existing systems (BT, dialogue, relationships, navigation) through weight queries. Each system remains independently testable.
- **Bounded complexity** — Max 20 echoes per agent, max 3 cascade hops, max 5 cascades per cycle. Emergence comes from connection density, not data volume.
- **Observable before inspectable** — Behavioral changes are visible first (movement patterns, dialogue shifts, social clusters). The detail panel explains why, for curious players.

---

## 2. Echo Data Model

An Echo is a lightweight record of behavioral residue from a game event.

```typescript
interface Echo {
  id: string;                // "echo:opinion:atlas:c42"
  kind: EchoKind;            // category of experience
  source: string;            // what caused it (event type or entity name)
  target?: string;           // who/what it's about (agent, object, room)
  weight: number;            // -100 to +100 (intensity)
  decay: number;             // weight lost per cycle (absolute, applied toward 0)
  reinforcements: number;    // how many times this echo has been reinforced
  tags: string[];            // for filtering: ["work", "failure", "deploy"]
  cycleCreated: number;      // when it formed
}

type EchoKind =
  | "opinion"       // about another agent
  | "preference"    // positive toward activity, object, or room
  | "aversion"      // negative toward activity, object, or room
  | "memory"        // neutral but memorable shared experience
  | "reputation"    // what others say about you
  | "bond"          // pet-agent or agent-agent attachment
  | "mood-residue"; // lingering emotional state

interface DialogueBias {
  moodOverride?: string;                    // override mood_adj in TemplateVars
  targetOpinions: Map<string, number>;      // agent name → net opinion weight
  moodResidueWeight: number;                // net mood-residue (negative = lingering bad mood)
  memoryBoosts: Map<string, number>;        // joke/memory ID → weight boost for running jokes
}

interface EchoSummary {
  kind: EchoKind;
  target: string;
  weight: number;
  direction: "warming" | "cooling" | "stable" | "fading" | "strong";
  label: string;              // human-readable: "Morning coffee ritual", "Atlas"
  reinforcements: number;
}

interface DecayResult {
  evicted: Echo[];            // echoes that decayed to |weight| ≤ 2 and were removed
  thresholdsCrossed: Echo[];  // echoes that crossed ±30 this cycle
  habitsFormed: Echo[];       // echoes with reinforcements >= 3
}
```

### Key Properties

- **Weight decays every cycle** — A snack theft is -8 weight at 4/cycle decay (gone in 2 cycles). A drama confrontation is ±15 at 1/cycle (lingers for 15 cycles). Decay rate encodes event significance.
- **Echoes merge on match** — If an echo with the same kind + source + target exists, the weight is reinforced (additive, capped at ±100), the `reinforcements` counter increments, and the decay rate resets to the new echo's decay value. No duplicates created.
- **Max 20 echoes per agent** — When full, the weakest echo (lowest |weight|) is evicted. Only meaningful experiences persist.
- **Eviction threshold ±2** — Echoes with |weight| ≤ 2 are evicted during decay. This prevents near-zero echoes from occupying slots without serving any purpose.
- **No event journal** — The store holds current state, not history.

### Bounds

| Constraint | Value | Rationale |
|---|---|---|
| Max echoes per agent | 20 | Memory bounded, only meaningful experiences persist |
| Max weight | ±100 | Matches relationship affinity scale |
| Eviction threshold | |weight| ≤ 2 | Prevents dead-zone echoes occupying slots |
| Min display threshold | ±5 | Weak echoes invisible to player in detail panel |
| Cascade threshold | ±15 | Only strong echoes trigger behavioral reactions |
| Cascade budget per cycle | 5 | Prevents echo storms |
| Max cascade depth | 3 | Matches interaction system chain limit |

---

## 3. Echo Formation

Echoes form when game events cross a significance threshold. A single `EchoProducer` subscribes to existing engine events and translates them into echoes. No changes to existing event-producing systems are needed.

### Event → Echo Mapping

| Game Event | Echo Kind | Weight | Decay/cycle | Example |
|---|---|---|---|---|
| Task completed successfully | preference | +10 | 2 | "I'm good at review tasks" |
| Task failed | aversion | -15 | 2 | "Deploy tasks go wrong for me" |
| Conversation (friend+ tier) | opinion | +5 | 3 | "I like working near Atlas" |
| Gossip heard about X | reputation | ±8 | 2 | "People say Nova cuts corners" |
| Gossip about you overheard | opinion | -12 | 1 | "They were talking about me" |
| Snack/drink stolen by pet | aversion | -8 | 4 | "That cat is a menace" |
| Pet comfort when sad | bond | +10 | 1 | "The dog came to me when I was down" |
| Morale hit below 20 | mood-residue | -10 | 3 | "Rough cycle, still shaky" |
| Morale boost above 80 | mood-residue | +8 | 4 | "Feeling great after that win" |
| Rivalry conversation | opinion | -6 | 2 | "Competitive tension with Orion" |
| Drama/confrontation | opinion | ±15 | 1 | "That confrontation changed things" |
| Running joke escalation | memory | +4 | 5 | "Our bit about tabs vs spaces" |
| Merchant purchase (for agent) | opinion | +6 | 3 | "Director invested in me" |
| Paired work (same task) | preference | +5 | 2 | "We work well together" |
| Ritual participation | preference | +3 | 4 | "I like the morning standup" |
| Fed by director | bond | +8 | 2 | "Director takes care of me" |
| Needs neglected (hunger/thirst >80%) | aversion | -6 | 3 | "Nobody fed us today" |
| Level-up | mood-residue | +12 | 2 | "Big milestone moment" |
| Offline return (rested) | mood-residue | +5 | 4 | "Came back refreshed" |

### Formation Rules

- **Cooldown per source** — Same event source cannot produce echoes on the same agent faster than once per cycle. Prevents spam from rapid-fire events.
- **Merge on match** — If an echo with the same kind + source + target already exists on the agent, reinforce the weight (additive, capped at ±100), increment `reinforcements`, and reset the decay rate to the incoming echo's value. Do not create a duplicate.
- **Significance gate** — Only events listed in the mapping table produce echoes. Trivial events (idle chatter, normal movement, routine ticks) are ignored.

---

## 4. Echo Consumption

Five existing systems read echoes to modify their behavior. No system owns the echoes — they all query the same EchoStore.

### 4a. Behavior Tree Weight Modifiers

#### Pet BT Integration

Pet BT chance-roll functions (`SleepChanceRoll`, `WanderChanceRoll`, `CatalystChanceRoll` in `pet-bt.ts`) use `Math.random() < threshold` with hardcoded thresholds. Echo integration adds a multiplier to these thresholds:

```typescript
// Before (current):
function CatalystChanceRoll(): boolean {
  return context.state === "idle" && Math.random() < 0.02;
}

// After (with echo bias):
function CatalystChanceRoll(): boolean {
  const bias = echoStore.queryWeight(context.entityId, "bond");
  const multiplier = 1 + clamp(bias, -50, 50) / 100; // range: 0.5× to 1.5×
  return context.state === "idle" && Math.random() < 0.02 * multiplier;
}
```

**Bond echoes** boost catalyst probability (pet with strong bonds is more socially active). **Aversion echoes** suppress approach toward specific agents — in `PickWanderPoint`, the pet's target position is biased away from agents with negative bond/aversion echoes:

```typescript
// In PickWanderPoint — bias away from aversive agents
const aversionTarget = echoStore.getStrongest(context.entityId, "aversion");
if (aversionTarget && isAgent(aversionTarget.target)) {
  // Exclude positions near the aversive agent from the candidate pool
}
```

The `echoStore` reference is injected into the pet BT context object alongside the existing `state`, `sleepChance`, and `stateTimer` fields.

#### Agent BT Integration

Agent idle behavior uses a `lotto [1,1,1]` node in `subtrees/idle.ts` with three equal-weight children: `Wander`, `Emote`, `Chatter`. Since mistreevous lotto weights are static MDSL, echo integration wraps the idle subtree with a **new `EchoBiasedIdle` action** that replaces the static lotto:

```typescript
// New action in bt-agent.ts — replaces the lotto [1,1,1] subtree
function EchoBiasedIdle(): State {
  const socialWeight = 1 + clamp(echoStore.queryWeight(agentName, "bond"), -50, 50) / 100;
  const wanderWeight = 1 + clamp(echoStore.queryWeight(agentName, "preference", currentRoom), -50, 50) / 100;
  const weights = [wanderWeight, 1, socialWeight]; // [Wander, Emote, Chatter]
  const pick = weightedRandom(weights);
  // Collect the corresponding action
  if (pick === 0) collect("idle", {});           // Wander
  else if (pick === 1) collect("idle", {});      // Emote
  else collect("speaking", { text: "", source: "chatter" }); // Chatter
  return fromNodeState("succeeded");
}
```

This replaces the `lotto [1,1,1]` node in the idle subtree MDSL. The static lotto becomes a dynamic weighted selection driven by echoes.

**Mood-residue** also modifies the agent BT's break-seeking threshold. Negative mood-residue lowers the energy threshold at which agents seek breaks (in `tickNeeds` or the BT's break condition):

```typescript
const moodResidueWeight = echoStore.queryWeight(agentName, "mood-residue");
const breakThreshold = BASE_BREAK_THRESHOLD + clamp(moodResidueWeight, -20, 0);
// Negative residue → lower threshold → seeks breaks earlier
```

### 4b. Dialogue Selection Bias

The TalkEngine's `resolvePhrase()` uses a 10-level waterfall with percentage chance gates. Echo bias integrates by extending `TalkEngineEnrichment` with a new field and adding a bias step early in the waterfall.

**TalkEngineEnrichment extension:**

```typescript
export interface TalkEngineEnrichment {
  readonly composer?: FragmentComposer;
  readonly getTier?: (a: string, b: string) => RelationshipTier;
  readonly getEchoBias?: (agent: string) => DialogueBias; // NEW
}
```

**Bias application in resolvePhrase() — inserted as step 1.5 (after activated phrase, before mood phrase):**

```typescript
// In resolvePhrase(), after activated-phrase check:
if (enrichment?.getEchoBias) {
  const bias = enrichment.getEchoBias(agentName);
  // Override mood if echo says lingering bad/good mood
  if (bias.moodResidueWeight < -10) {
    entry.vars = { ...entry.vars, mood: "tired", mood_adj: "drained" };
  } else if (bias.moodResidueWeight > 10) {
    entry.vars = { ...entry.vars, mood: "excited", mood_adj: "energized" };
  }
  // Boost weight of nearby_agent templates if strong opinion exists
  const nearbyAgent = entry.vars.nearby_agent;
  if (nearbyAgent && bias.targetOpinions.has(nearbyAgent)) {
    const opinion = bias.targetOpinions.get(nearbyAgent)!;
    // Negative opinion → frustrated templates get 2× weight
    // Positive opinion → social templates get 2× weight
    // Applied by modifying the template pool before weighted selection
  }
}
```

The `getEchoBias` callback is wired in `engine.ts` during TalkEngine construction, calling `echoStore.getDialogueBias(agentName)`.

**Running joke boost:** When `getDialogueBias()` returns `memoryBoosts` with a joke ID, `ConversationEngine` uses those boosts as weight multipliers during script selection, increasing the chance of triggering jokes the agents have a shared memory of.

### 4c. Relationship Affinity Drift

Currently affinity changes only through explicit events (+2 conversation, -3 bicker, +1 cluster). Echoes add passive drift:

- Each cycle boundary, the relationship system scans opinion echoes between each pair
- Net positive opinion echoes → affinity drifts +1 per cycle
- Net negative → drifts -1 per cycle
- Two agents who keep having good conversations passively become better friends
- An agent who gets gossiped about passively drifts toward rival tier with the gossiper

Hooks into existing `RelationshipSystem.onCycleEnd()`. The echo store exposes a `queryWeight(agent, "opinion", targetAgent)` call for each relationship pair.

### 4d. Room & Object Preferences

Agent wander target selection currently has no preference system — the `Wander` action in `bt-agent.ts` is a stub that collects `"idle"` with no target data. Echo spatial bias is implemented at the **movement system level**, not in the BT:

When the brain system processes an `"idle"` action for an agent, it picks a wander target position. Currently this is random within the room. With echo integration:

```typescript
function pickWanderTarget(agentName: string, currentRoom: string): Vec2 {
  // Check room preference echoes
  const roomPrefs = echoStore.getPreferences(agentName)
    .filter(e => e.kind === "preference" && isRoom(e.target));

  // Check bond echoes — gravitate toward bonded agent's position
  const bondTarget = echoStore.getStrongest(agentName, "bond");
  if (bondTarget && Math.random() < 0.4) {
    const targetPos = getAgentPosition(bondTarget.target);
    if (targetPos) return jitter(targetPos, 30); // near but not on top of
  }

  // Check aversion echoes — avoid aversive rooms
  const aversions = echoStore.getPreferences(agentName)
    .filter(e => e.kind === "aversion" && isRoom(e.target));
  // Bias random point selection away from aversive objects/rooms

  return randomPointInRoom(currentRoom); // fallback
}
```

For pets, the same pattern applies to the existing `[PickWanderPoint]` action in `pet-bt.ts`, which picks a random point within the pet's room bounds. Echo bond preferences bias the target toward the bonded agent's position.

### 4e. Narrative System Enrichment

The narrative system composes story beats into prose. Echoes provide richer source material through three distinct narrative event types:

1. **Threshold beats** — Echo crossing |weight| > 30 generates a narrative beat: "Nova has developed a strong preference for morning work." Triggered during `decayAll()` when an echo's weight crosses the ±30 boundary.

2. **Pattern beats** — Echo with `reinforcements >= 3` generates a habit beat: "The cat has stolen Luna's snack for the third time this week." Triggered during `addEcho()` when the reinforcement counter hits 3. These are one-time events (not re-triggered at 4, 5, etc.).

3. **Resolution beats** — Echo evicted (decayed to |weight| ≤ 2) generates a resolution beat: "Nova seems to have moved past the deploy incident." Triggered during `decayAll()` when echoes are evicted.

`EchoStore.decayAll()` returns `DecayResult { evicted, thresholdsCrossed, habitsFormed }` which the engine routes to the narrative system.

---

## 5. Echo Cascades

When an echo forms or crosses the ±15 cascade threshold, it can trigger a reaction — a behavior that produces a real game event, which may produce new echoes on other agents. This is where systemic emergence lives.

### Cascade Rules

| Rule | Value | Rationale |
|---|---|---|
| Max chain depth | 3 | Prevents runaway spirals |
| Cascade probability | `min(0.6, 0.3 + |weight| / 100)` | Scales with echo intensity: ±15 → 45%, ±30 → 60% cap |
| Reaction timing | Next frame (queued, not immediate) | Prevents infinite loops within a single tick |
| Cascade cooldown | 1 per agent per cycle | Same agent can only trigger 1 cascade reaction per cycle |
| Dampening per hop | 0.6× weight | Each hop produces a weaker echo |
| Global budget per cycle | 5 cascades | Hard ceiling on chain reactions across all agents |

### Reaction Types

Cascade reactions are **direct game actions**, not InteractionBus routed. The CascadeResolver queues actions that the engine simulation processes on the next frame:

| Echo Crosses Threshold | Agent Reaction | Mechanism | Potential New Echo |
|---|---|---|---|
| Opinion of X drops below -20 | Vents to nearest friend about X | `conversation.tryScript(agent, friend, "proximity")` with frustrated bias | Friend gets reputation echo about X |
| Aversion to room > 15 | Avoids that room next cycle | Sets a `roomAvoidance` flag read by room-switcher | Nearby agents notice absence (no echo, just behavioral) |
| Bond with agent > 25 | Seeks proximity, initiates conversation | `conversation.tryScript(agent, bondTarget, "proximity")` | Partner gets reciprocal opinion echo |
| Mood-residue < -15 | Seeks break or isolation | Forces BT to break state via `brainSystem.forceState("on-break")` | Pet gets bond echo if it comforts (via existing pet-catalyst path) |
| Reputation echo received | Adjusts own opinion of subject (0.5×) | `echoStore.addEcho(agent, { kind: "opinion", source: "reputation", target: subject, weight: rep × 0.5, decay: 2, tags: ["social", "gossip"] })` | May gossip forward (30% chance → new gossip event) |
| Preference reinforced 3× | Develops visible habit | Emits narrative beat (terminal — no further cascade) | None |

### Gossip Propagation

Gossip has its own forwarding logic as a special cascade:

1. Agent A gossips about Agent C to Agent B
2. B receives "reputation" echo about C at 0.6× weight of A's opinion
3. 30% chance B forwards to Agent D next cycle (0.6× again = 0.36× original)
4. After 3 hops, gossip is at 0.22× original weight — fades naturally
5. If C overhears gossip about themselves — checked via **same-room proximity** (agents in the same room as the gossip conversation are considered "in earshot") — they get a strong opinion echo about the gossiper (-12 weight, 1/cycle decay)

### Loop Detection

The CascadeResolver maintains a **visited set** per cascade chain. Each entry is a `kind:source:target` tuple. Before executing a reaction that would produce a new echo, the resolver checks if that echo's `kind:source:target` key is already in the visited set. If so, the cascade is blocked (cycle detected). The visited set is created fresh for each root cascade and passed through all hops.

```typescript
interface CascadeChain {
  depth: number;          // 0, 1, 2 (max 3 hops = depths 0-2)
  visited: Set<string>;   // "opinion:conversation:atlas", "reputation:gossip:nova", ...
  rootEchoId: string;     // for debugging
}
```

### Safeguards

- **Loop detection** — Visited set per chain prevents A→B→A cycles
- **Per-agent cooldown** — Each agent can only trigger 1 cascade reaction per cycle
- **Global cascade budget** — Max 5 cascades per cycle across all agents. Budget exhausted → remaining echoes sit without triggering reactions
- **Dampening** — 0.6× weight per hop ensures cascades naturally attenuate
- **Queued execution** — Reactions execute on the next frame, never in the same tick as the triggering echo

---

## 6. Observability

### Observable Layer (behavioral changes the player notices)

**Movement patterns shift:**
- Agent with room preference gravitates to the same spot each cycle
- Agent with aversion takes longer paths to avoid a room
- Agent with bond echo walks toward preferred partner during breaks
- Pet follows bonded agent between rooms instead of wandering

**Dialogue reflects inner state:**
- Agent venting about someone ("I'm not saying anything, but...") — opinion echo
- Agent mentioning a place fondly ("I like it over here") — preference echo
- Agent using tired phrases despite recovered morale — lingering mood-residue
- Two bonded agents with boosted running joke weight — shared memory echoes

**Social clusters form visibly:**
- Agents with mutual positive opinion echoes clump during breaks
- Agent being avoided (negative opinion from multiple agents) ends up alone
- Gossip triangles — three agents who keep talking in pairs about each other

**Habits crystallize:**
- Agent who always gets coffee first (preference echo reinforced across cycles)
- Agent who sits in the same spot (room preference crystallized)
- Pet that only begs from one agent (dominant bond echo)

None of this is announced to the player. No popups, no notifications. The player notices patterns through observation.

### Inspectable Layer (agent detail panel)

Clicking an agent reveals a new "Inner World" section in the detail panel:

```
┌─ Inner World ──────────────────────────┐
│                                        │
│  Opinions                              │
│    Atlas ████████░░  +32  (warming)    │
│    Orion ███░░░░░░░  -18  (cooling)    │
│                                        │
│  Preferences                           │
│    ☕ Morning coffee ritual    +22      │
│    🏠 Village room            +15      │
│    ⚙️ Review tasks            +12      │
│                                        │
│  Aversions                             │
│    🚀 Deploy tasks            -14      │
│    🐱 Hub cat                 -8       │
│                                        │
│  Bonds                                 │
│    🐕 Office dog              +28      │
│    👤 Director                +16      │
│                                        │
│  Mood                                  │
│    Lingering: ☁️ residual frustration  │
│    From: failed review last cycle       │
│    Fading in: ~3 cycles                │
│                                        │
└────────────────────────────────────────┘
```

**Panel design principles:**
- **Bars, not numbers** — Visual weight indicators. Labels: "warming," "cooling," "stable," "fading," "strong."
- **Directional labels** — "warming" if reinforced this cycle, "cooling" if weight decreased, "stable" if unchanged, "fading" if |weight| < 10, "strong" if |weight| > 50.
- **Brief cause hint** — One line for the most recent reinforcement. Not a journal, just context.
- **Display threshold ±5** — Weak echoes are invisible even in the panel.
- **Grouped by kind** — Opinions, Preferences, Aversions, Bonds, Mood.
- **Pet panel too** — Simplified version: Bonds (which agents), Preferences (food bowl, sunny spots), Aversions (loud noises).

**Empty state handling:** For agents with no echoes (new agents, or all echoes decayed), the Inner World section shows "No strong impressions yet" — a clean empty state, not a hidden section.

---

## 7. Echo Store & Lifecycle

### EchoStore API

```typescript
interface IEchoStore {
  // Write
  addEcho(agent: string, echo: Omit<Echo, "id" | "cycleCreated" | "reinforcements">): AddResult;
  // Merges if matching kind+source+target exists, otherwise creates.
  // Returns { merged: boolean, echo: Echo, cascadeTriggered: boolean }

  // Read
  queryWeight(agent: string, kind: EchoKind, target?: string): number;
  // Net weight for a query. Returns 0 if no matching echoes.
  // queryWeight("nova", "opinion", "atlas") → +32
  // queryWeight("nova", "opinion") → sum of all opinion echoes
  // queryWeight("new-agent", "opinion") → 0 (no echoes)

  getDialogueBias(agent: string): DialogueBias;
  // Returns { moodOverride: undefined, targetOpinions: empty Map,
  //           moodResidueWeight: 0, memoryBoosts: empty Map } for agents with no echoes

  getPreferences(agent: string): EchoSummary[];
  // All echoes above |weight| ≥ 5, sorted by |weight| descending.
  // Returns [] for agents with no echoes.

  getStrongest(agent: string, kind: EchoKind): Echo | undefined;
  // Dominant echo by |weight|. Returns undefined if none.

  // Lifecycle
  decayAll(cycle: number): DecayResult;
  // Called at cycle boundary. Reduces weights, evicts |weight| ≤ 2.
  // Returns { evicted, thresholdsCrossed, habitsFormed }

  // Cascade
  getCascadeBudget(): number;
  consumeCascade(): boolean;
  // Returns false if budget exhausted for this cycle.
  resetCascadeBudget(): void;
  // Called at cycle boundary.

  // Persistence
  serialize(): Record<string, Echo[]>;
  restore(data: Record<string, Echo[]>): void;
}

interface AddResult {
  merged: boolean;
  echo: Echo;
  cascadeTriggered: boolean; // true if |weight| crossed ±15
}
```

### Persistence

Echoes are stored in a dedicated file following the existing `engine-state.ts` pattern:

**File:** `.flowti/var/world-echoes.json`

```json
{
  "nova": [
    {
      "id": "echo:opinion:atlas:c42",
      "kind": "opinion",
      "source": "conversation",
      "target": "atlas",
      "weight": 32,
      "decay": 3,
      "reinforcements": 4,
      "tags": ["social"],
      "cycleCreated": 42
    }
  ],
  "atlas": []
}
```

**I/O mechanism:** Follows the existing `engine-state.ts` pattern (used by memory, relationships, needs, positions):

```typescript
// In engine-state.ts:
export function saveEchoes(echoStore: IEchoStore, vaultPath: string): void {
  saveJson(join(varDir(vaultPath), "world-echoes.json"), echoStore.serialize());
}

export function restoreEchoes(echoStore: IEchoStore, vaultPath: string): void {
  const data = loadJson(join(varDir(vaultPath), "world-echoes.json"));
  if (data) echoStore.restore(data as Record<string, Echo[]>);
}
```

Saved during the existing periodic flush (~5s interval in `engine.on("postupdate")`) and on plugin unload.

### Lifecycle Timeline

```
Event occurs (e.g., conversation completed)
  → EchoProducer evaluates significance (is it in the mapping table?)
  → Cooldown check: has this source produced an echo on this agent this cycle?
  → If significant + not on cooldown: addEcho() — merge or create
  → addEcho() returns AddResult with cascadeTriggered flag
  → If cascadeTriggered: CascadeResolver evaluates (probability roll, budget check)
  → If cascade fires: queue reaction for next frame
  → Next frame: queued reaction executes as game action
  → Game action may produce new event → loop back to EchoProducer (depth ≤ 3)

Cycle boundary (in tickClock, ~25 min real time):
  → decayAll(currentCycle) reduces all weights by their decay rate
  → Echoes with |weight| ≤ 2 are evicted → resolution narrative beats
  → Echoes crossing |weight| > 30 → threshold narrative beats
  → Echoes with reinforcements = 3 → habit narrative beats (one-time)
  → resetCascadeBudget()
  → Relationship drift: opinion echoes → affinity ±1/cycle (in onCycleEnd)
```

### Engine Loop Integration

The echo system does **not** get its own `tickEchoes()` phase. Instead:

- **Echo formation** is event-driven (EchoProducer listens to existing callbacks — no tick needed)
- **Cascade queue processing** happens at the start of `tickBehaviorTree` — queued cascade reactions are injected as BT actions before the normal BT evaluation runs
- **Echo decay** happens inside `tickClock` at the cycle boundary, alongside existing cycle-end logic (relationship decay, cascade budget reset)

This means no new simulation phase is needed. The echo system is purely reactive (producer) and periodic (decay at cycle boundary).

---

## 8. Architecture

### Component Map

```
Game Events (existing systems — conversations, tasks, needs, pets)
       │
       ▼
  EchoProducer          ← pure listener, maps events → echoes
       │                   significance gate + cooldown check
       ▼
  EchoStore             ← per-agent echo storage (world-echoes.json)
       │
       ├──→ BT: EchoBiasedIdle node     (agent action selection)
       ├──→ BT: pet chance-roll multipliers (pet social activity)
       ├──→ TalkEngine: getEchoBias()    (mood override, opinion weights)
       ├──→ RelationshipSystem: drift    (passive affinity ±1/cycle)
       ├──→ Movement: pickWanderTarget() (room/object gravitation)
       ├──→ Narrative: DecayResult beats (threshold, habit, resolution)
       │
       ▼
  CascadeResolver       ← evaluates echoes crossing ±15
       │                   probability roll, budget check, loop detection
       ▼
  Cascade Queue         ← reactions queued for next frame
       │                   processed at start of tickBehaviorTree
       └──→ game actions → may produce new events → EchoProducer (depth ≤ 3)
```

### New Files

| File | Est. Lines | Purpose |
|---|---|---|
| `src/game/systems/echo/echo-types.ts` | ~60 | Echo, EchoKind, DialogueBias, EchoSummary, DecayResult, AddResult, CascadeChain |
| `src/game/systems/echo/echo-store.ts` | ~200 | Storage, query, merge, decay, eviction, serialization |
| `src/game/systems/echo/echo-producer.ts` | ~120 | Event → echo mapping, significance gate, cooldowns |
| `src/game/systems/echo/cascade-resolver.ts` | ~120 | Cascade evaluation, reaction selection, budget, loop detection (visited set) |
| `src/game/systems/echo/index.ts` | ~10 | Barrel export |
| `tests/game/systems/echo/echo-store.test.ts` | ~250 | Store CRUD, merge, decay, eviction, bounds, empty-state returns |
| `tests/game/systems/echo/echo-producer.test.ts` | ~150 | Event mapping, significance, cooldowns, merge behavior |
| `tests/game/systems/echo/cascade-resolver.test.ts` | ~180 | Chain depth, budget, dampening, loop detection, probability |

~510 lines source, ~580 lines tests.

### Integration Touchpoints

| Existing File | Change | Est. Lines |
|---|---|---|
| `engine.ts` | Instantiate EchoStore, EchoProducer, CascadeResolver. Wire `getEchoBias` into TalkEngine enrichment. Add to save/restore calls. | ~35 |
| `engine-state.ts` | Add `saveEchoes()` / `restoreEchoes()` functions following existing pattern. | ~15 |
| `engine-simulation.ts` | In `tickClock` cycle boundary: call `decayAll()`, route DecayResult to narrative. In `tickBehaviorTree`: process cascade queue. In EchoProducer wiring: subscribe to conversation/task/needs callbacks. | ~25 |
| `talk-engine.ts` | Extend `TalkEngineEnrichment` with `getEchoBias?` field. In `resolvePhrase()`: apply mood override and opinion weight bias before mood-phrase step. | ~20 |
| `talk-types.ts` | No changes needed — DialogueBias is in echo-types.ts, not talk-types. | 0 |
| `bt-agent.ts` | Replace `lotto [1,1,1]` idle subtree with `EchoBiasedIdle` action. Inject echoStore into BT context. | ~25 |
| `pet-bt.ts` | Add echo weight multiplier to `CatalystChanceRoll` and `SleepChanceRoll`. Inject echoStore into pet BT context. | ~15 |
| `relationship-system.ts` | In `onCycleEnd()`, query opinion echoes for each pair, apply ±1 drift. | ~15 |
| `engine-types.ts` | Add `IEchoStore` to `EngineSystems` interface. | ~3 |

~153 lines of modifications across existing files.

---

## 9. Emergence Examples

**The Grudge:** Agent A fails a task assigned on B's recommendation → aversion echo on task type + opinion drop on B → A vents to C (cascade: opinion < -20 → tryScript with frustrated bias) → C's opinion of B dips (reputation echo at 0.6×) → B notices A avoiding them (bond echo drives proximity-seeking, but A has aversion) → B initiates reconciliation conversation → opinion echoes slowly heal through positive conversations → narrative captures resolution beat when the opinion echo decays.

**The Favorite Spot:** Agent keeps having good conversations in the village → preference echo reinforces across 5 cycles (reinforcements = 5) → `pickWanderTarget()` biases toward village → habit narrative beat at reinforcement 3: "Nova has made the village her regular spot" → other agents follow (bond echoes bias their wander targets too) → lunch clique forms → narrative: "The village became the team's unofficial hangout."

**The Pet Whisperer:** One agent feeds the pet consistently → bond echo stacks to +40 (reinforcements = 6) → pet's `CatalystChanceRoll` gets 1.4× multiplier near that agent → pet follows that agent between rooms (bond-biased wander target) → others comment via dialogue bias (TalkEngine pulls social phrases about the pet) → mild reputation echoes: "pet whisperer" → threshold narrative beat when bond crosses 30.

**The Comeback:** Agent has a terrible cycle (task fail → aversion -15, morale drop → mood-residue -10, gossip target → opinion -12) → mood-residue cascade: < -15 → `brainSystem.forceState("on-break")` → pet comforts them (existing pet-catalyst path) → bond echo +10 → next cycle they nail a task → strong positive mood-residue +10 → lingering negative residue decays → resolution narrative beat: "After a rough week, Nova came back stronger."

**The Office Politics:** Agent A gossips about C to B → B receives reputation echo about C (0.6× = -9.6) → reputation cascade: B adjusts own opinion of C (-4.8 via 0.5× multiplier) → 30% chance B gossips forward to D → D receives weaker reputation (-5.8 at 0.6×) → C is in the same room as D → overhear check triggers → C gets opinion echo about A (-12, 1/cycle decay) → C confronts A via drama script (cascade: opinion < -20) → drama outcome determines whether opinions recover or rivalry deepens.

---

## 10. Dependencies

### Required Before Implementation
- Merchant/Narrative/Offline system merged (narrative beats consumer)
- Interaction system merged (provides the full entity interaction vocabulary)

### Required Concurrently
- Agent detail panel UI (Inner World section) — can be built in parallel with core echo system

### No Dependencies On
- Task engine completion (echoes from task events can be added incrementally as task events become available)
- Economy system completion (merchant purchase echoes added when ready)
- Progressive trust (independent system)
