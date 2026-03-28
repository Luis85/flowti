---
type: ProjectBrief
project: "Project Meridian"
goal: "Build an emergent agent-simulation sandbox RPG where the Director orchestrates a living world through indirect control"
description: "Emergent agent-simulation sandbox with living economy. The player is The Director — an orchestrator who seeds the world with quests, objects, and zones, watching autonomous agents work, trade, build, remember, and form relationships. Built on ECS architecture, behavior trees, Zod-validated data, and Obsidian vault persistence."
status: "design"
start: "2026-03-27"
end: ""
---

# Project Meridian - Game Design Document

> **Working Title.** "Project Meridian"

---

## 1 · Vision & Concept

### 1.1 Elevator Pitch

Project Meridian is an **emergent agent-simulation sandbox** with a living economy. The player is _The Director_ — an orchestrator who seeds the world with quests, places objects, designates zones, and watches as autonomous agents work jobs at farms and workshops, produce and trade goods, buy land, build homes and businesses, care for pets, remember their history, experience moods, and form complex social networks — all emerging from the interaction of simple, composable systems backed by an ECS architecture, behavior trees, Zod-validated data, and an Obsidian vault as the persistent layer.

No single system creates the game. The game emerges from the collision of all of them.

### 1.2 Design Philosophy: Emergence First

**Emergent complexity from simple, composable rules.** Every system is deliberately simple in isolation. Complexity, narrative, and surprise arise only from their interaction at runtime.

**Principles:**

- Systems communicate exclusively through the EventBus and shared ECS components. No system knows another's internals.
- No behavior is hardcoded. If an agent builds a bakery, it's because the BT evaluated savings, available land, baking skill, local bread scarcity, and current mood — not because we wrote a "build bakery" script.
- The Director creates conditions and observes outcomes. Agents decide.
- Data drives everything. A single frontmatter value change ripples through systems.
- The system is **resilient**. Errors are handled with typed Result values, circuit breakers, and recovery queues — never bare try/catch.
- All data is **Zod-validated** at the boundary. Invalid data is quarantined, not silently accepted.

**The Emergence Stack:**

```
Layer 5 — NARRATIVE          Stories the Director interprets from patterns
Layer 4 — ECONOMIC DYNAMICS  Supply chains, property booms, scarcity spirals
Layer 3 — SOCIAL DYNAMICS    Alliances, rivalries, mood cascades, memory-driven grudges
Layer 2 — ENTITY BEHAVIOR    BT decisions from needs × mood × goals × memory × economy
Layer 1 — SYSTEM RULES       Needs decay, production, proximity, skill rolls, supply/demand
Layer 0 — DATA               Markdown, Canvas graphs, Zod schemas, ECS components
```

### 1.3 Competitive Positioning

|Feature|DF|RimWorld|Sims|Lords & Villeins|Stanford Agents|**Meridian**|
|---|---|---|---|---|---|---|
|Autonomous agents|✓✓✓|✓✓|✓✓|✓|✓✓✓|✓✓✓|
|LLM integration|✗|✗|✗|✗|✓✓✓|✓✓ (hybrid)|
|Production economy|✓✓✓|✓✓|✗|✓✓✓|✗|✓✓|
|Supply/demand pricing|✓|✗|✗|✓✓✓|✗|✓✓|
|Relationship graphs|✓✓|✓|✓✓|✓|✓✓✓|✓✓ (Canvas)|
|Data-driven (external)|✗|✗|✗|✗|✗|✓✓✓ (vault)|
|Director/indirect control|✗ (direct)|✗ (direct)|✓ (partial)|✓✓|✗|✓✓✓|
|Error recovery arch.|✗|✗|✗|✗|✗|✓✓✓|

**Key lessons from competitors:**
- **Dwarf Fortress** — Emergence works best when the designer *does not anticipate* outcomes. DF's "tantrum spirals" were unplanned but became the game's signature. All complexity from system interaction, no LLM.
- **RimWorld** — Simpler systems can still produce compelling emergence if feedback loops are tight. The Storyteller AI modulates pressure — our Director fills this role manually.
- **The Sims** — Objects as need-satisfiers is the core loop. Our vending machines and food carts follow this pattern.
- **Lords & Villeins** — Closest competitor to our economy design. Indirect control, supply/demand pricing, autonomous economic units. Key difference: our agents have memory, mood, and LLM dialogue.
- **Stanford Generative Agents** — Memory → reflection → planning creates coherent long-term behavior. But all intelligence from LLM = expensive and fragile. Our hybrid (BT for decisions + LLM for dialogue) is more resilient.

**Our differentiators:** LLM hybrid approach, vault-as-database, Director-as-player with indirect control + dialogue, structured error recovery, Zod-validated data pipeline, Obsidian integration.

### 1.4 Core Fantasy

You are the hand behind the curtain — placing farms and quest boards, watching agents earn their first paycheck, grow wheat, bake bread, sell it at market, buy a plot of land, build a home, adopt a stray cat, remember a grudge, and have a breakdown when it all gets too much. Think _Dwarf Fortress_ meets _The Sims_ meets _Rimworld_ meets a tabletop GM screen.

### 1.5 Unique Selling Points

- **Emergent world** — interacting rule systems produce unpredictable outcomes.
- **Production economy** — agents work at facilities, produce goods and services, trade, invest in property, respond to scarcity.
- **Agent memory & mood** — agents remember events, form opinions, and experience mood shifts that alter behavior.
- **Autonomous brains** — agents with BTs and optional LLM; animals with instinct BTs.
- **Data-driven reality** — the Obsidian vault _is_ the database. Markdown, Canvas, JSON.
- **Director-as-player** — indirect control through quests, zones, object placement, and dialogue.
- **Resilient runtime** — Result types, circuit breakers, retry queues, entity suspension.
- **Zod-validated pipeline** — schemas are the single source of truth for types and validation.

### 1.6 Target Experience

1. The Director places a vending machine near the marketplace and stocks it.
2. She creates a quest: _"Deliver the merchant's ledger to the archive."_
3. Agent Elena (merchant) is on shift at her shop, selling bread she bought from the bakery. Her shift ends in 20 ticks. Off-duty, she checks the billboard — the quest reward exceeds her remaining shift wage. She accepts.
4. Marcus (guard, on patrol) notices Elena leaving. High disposition, critical social need. BT: "escort friendly agent."
5. Elena's cat follows (bonded instinct BT). Marcus's dog tags along.
6. Elena stops at a food cart — hunger dropping. Spends 5 gold for bread (produced by Farmer Gregor → milled → baked — a supply chain). Food cart stock decreases.
7. They pass a vacant land plot. Elena's goal: "own property." Wallet: not yet. BT notes the plot in memory.
8. A wanderer helps past a locked door. The wanderer's dog chases Elena's cat (instinct BTs).
9. Ledger delivered. Elena earns 50 gold + 100 XP. Her mood rises (+quest completion). Memory logs: "delivered ledger, helped by wanderer Kai, Marcus escorted."
10. Over 200 ticks, Elena saves from job + quests. Buys the plot. Posts a construction quest: "Build a shop on plot 7." A laborer accepts, gathers lumber (recipe: logs → planks at sawmill), builds over several game-days (construction recipe `time_ticks` varies by building size).
11. Elena's shop opens. She stocks bread. Her pet cat lounges inside. She remembers Kai fondly and offers him discounted trades.
12. One day, a _drought event_ fires. Farm output drops 50%. Bread becomes scarce. Prices rise. Elena's mood drops (low stock, worried about business). She gets stressed but remembers that Farmer Gregor helped her before — she seeks him out to negotiate a supply deal.
13. None of this was scripted.

### 1.7 Emergence Validation Scenarios

These must arise naturally without special-case code:

|Systems Interacting|Emergent Behavior|
|---|---|
|Memory + Relationship + BT|Agent remembers being refused help by Marcus. BT avoids asking Marcus for future help.|
|Mood + NeedsDecay + Job|Stressed agent (negative mood from failed quest + low needs) calls in sick from their job. Production at their facility drops.|
|Mood + Relationship + Dialogue|Agent in bad mood has a conversation with a friend. Template/LLM adjusts tone. Positive interaction partially restores mood.|
|Recipe + Jobs + Economy|Wheat shortage → flour shortage → bread shortage → price spike → agents switch to alternative food → baker's mood drops (low income).|
|WorldEvents + Economy + Scarcity|Drought event reduces farm output. Food prices rise. Agents with farming skill are incentivized to take farming jobs (higher demand = higher wage).|
|Equipment + Skills + Progression|Guard equips better sword (+1 combat). More quest successes → more XP → skill-by-use → self-specialization into combat roles.|
|Building + Property + Jobs|Agent builds workshop → workshop becomes job site → other agents work there → owner earns rent/commission.|
|Zoning + Property + Economy|Director zones area as commercial. Land prices rise. Only shops/workshops can be built. Agricultural agents relocate to agricultural zones.|
|AnimalBT + Memory + Agent|Pet dog barks at stranger. Agent remembers stranger from a negative past interaction. BT weight for "avoid" increases.|
|ErrorRecovery + CircuitBreaker + LLM|LLM provider goes down. Circuit breaker opens after 3 failures. All agents seamlessly fall back to template dialogue. Circuit half-opens after cooldown.|
|Memory + Goals + Economy|Agent remembers that trading quests paid well last 50 ticks. Goal "accumulate 1000 gold" → BT increasingly favors trading quests → self-specialization.|
|Gossip + Reputation + Trade|Agent A tells Agent B that merchant Elena overcharges. B's disposition toward Elena drops. B avoids Elena's shop. Elena's revenue drops. Elena lowers prices to attract customers.|
|Crime + Memory + Guards|Starving agent steals bread at night (no guard, no witnesses). Next day, a guard is assigned to the district. The agent's memory of successful theft lowers the threshold for future crime — but now the guard's perception catches them.|
|Seasons + Economy + Mood|Winter arrives. Farm output drops 50%. Food prices spike. Agents who stockpiled in autumn are fine. Agents who didn't go hungry. Mood cascades. The Director learns to plan around seasons.|
|Traits + Mortality + Legacy|Agent with "unkillable" trait survives a famine that kills two others. Inherits their property. Becomes the wealthiest agent. Other agents' gossip spreads: "the survivor." Status rises via milestones.|
|DayNight + Crime + Perception|Night falls. Perception radius halves. Distressed agent spots an unguarded food cart. No witnesses in reduced perception range. Crime triggers. Dawn comes — a guard passes by and the cart owner notices missing stock. Gossip spreads.|
|Treasury + Quests + Economy|Director's treasury runs low (economy stagnated). Can't post high-reward quests. Agents have less incentive to act. Director must invest wisely in infrastructure to restart the economic engine and rebuild tax revenue.|
|Chronicler + Mortality + Story|Agent Elena dies of despair after prolonged breakdown. Chronicler records eulogy. Three agents who knew Elena receive grief memories. Marcus (high disposition) inherits her shop. The Chronicler's seasonal report names this "The Season Elena Fell."|
|FacilityFund + Jobs + Economy|Bakery operating fund depletes (owner spent gold on personal goals). Baker stops receiving wages. Baker's BT skips JobDuty. Bread production halts. Bread scarcity spikes. Prices rise. Owner realizes the problem and recapitalizes — or the bakery fails.|
|Status + Jobs + Progression|Agent completes 10 quests. Status rises to 2. Can now take the Doctor job (status_requirement: 2). Switches careers. Earns more. Buys property. Status rises again. Self-reinforcing social mobility.|

---

## 2 · Core Loop

```
┌─────────────────┐
│    DIRECTOR     │
│  Seeds          │──────► Quests, Objects, Zones, Events, Config
│  Observes       │            │
│  Intervenes     │            ▼
│  Treasury ◄─tax─┤     ┌─────────────┐
└──────▲──────────┘     │  BILLBOARD  │
       │                │  Direct Assign│
       │                │  Agent Quests │
       │                └──────┬──────┘
       │                       ▼
       │                ┌──────────────────┐
       │                │   ENTITIES       │
       │                │  Agents ─────────│──► BT + Memory + Mood + Traits + LLM
       │                │  Animals/Pets ───│──► Instinct BT + Bond
       │                │  Chronicler ─────│──► Observer + Narrator + Historian
       │                │  World Objects ──│──► Passive interaction
       │                └──────┬───────────┘
       │                       ▼
       │  ┌────────┐   ┌──────────────┐     ┌──────────────┐
       │  │SEASONS │──►│   WORLD      │◄───►│   ECONOMY    │
       │  │Day/Night│  │  Mutations   │     │  Production  │
       │  └────────┘  │  Events      │     │  Supply/Demand│
       │               │  Recovery    │     │  Property    │
       │               │  Gossip     │     │  Treasury tax │
       │               └──────┬───────┘     └──────────────┘
       │                      │
       └──────────────────────┘
```

### 2.1 Tick Cycle

Each tick (~500 ms default). The tick system runs inside ExcaliburJS's update loop using the **fixed timestep with accumulator** pattern: ExcaliburJS renders at ~60 FPS; elapsed time accumulates; when the accumulator exceeds the tick interval (500ms), a simulation tick executes. This gives smooth rendering between ticks while maintaining deterministic simulation order. All game state changes happen strictly at tick boundaries — ExcaliburJS interpolates positions between ticks for smooth visual movement.

Systems execute in deterministic order, each inside an **error boundary** using the Result pattern:

|#|System|Emergence Role|
|---|---|---|
|0.5|`TraitResolverSystem`|Builds per-entity modifier map from traits|
|0.7|`DayNightSystem`|Sets global `timeOfDay` flag (dawn/day/dusk/night)|
|1|`NeedsDecaySystem`|Behavioral pressure (reads timeOfDay for night modifiers)|
|2|`MoodSystem`|Emotional state recalculation|
|3|`PerceptionSystem`|Spatial awareness (agents, animals, objects)|
|4|`MemorySystem`|Memory decay, consolidation|
|5|`BehaviorTreeSystem`|Decision engine (agent + animal BTs via Blackboard)|
|5.5|`MovementSystem`|Processes move ActionIntents, region transitions, stamina deduction|
|6|`JobSystem`|Shift eval, production (recipes), wage distribution|
|7|`QuestEvaluationSystem`|Objective tracking, completion, failure|
|8|`ObjectInteractionSystem`|World object use, stock depletion|
|9|`ToolExecutionSystem`|Vault file ops (via Command pattern)|
|10|`ConstructionSystem`|Building progress (via recipes), property registration|
|11|`TradeSystem`|Agent-to-agent exchange (via Saga pattern)|
|12|`DialogueSystem`|Social fabric (template + LLM with Circuit Breaker)|
|13|`ProgressionSystem`|XP, skill-by-use|
|14|`RelationshipSystem`|Canvas graph updates|
|14.5|`MortalityCheckSystem`|Starvation/despair/quest-danger evaluation, collapse, death, legacy|
|15|`ItemDurabilitySystem`|Equipment wear, breakage, spoilage|
|16|`EconomySystem`|Price recalculation (every N ticks)|
|17|`WorldEventSystem`|Random event evaluation and firing|
|17.5|`SeasonSystem`|Season advancement, seasonal modifier application|
|18|`NotificationSystem`|Director alert filtering|
|18.5|`ChroniclerSystem`|Observation, narration, milestone detection, welfare quests, candidate pool|
|18.7|`ScenarioSystem`|Goal tracking, scoring, time limit evaluation (every N ticks)|
|18.8|`AbandonmentSystem`|Detects depleted/unowned facilities → state change to abandoned|
|19|`VaultSyncSystem`|Persistence with retry queue|
|20|`UIBridgeSystem`|Display updates|

**Key constraints:**

- Systems 1–17 read components and emit events. No direct cross-system mutation.
- Each system runs inside an error boundary: `Result.err` → logged, system skipped for this tick, tick continues.
- `EconomySystem` runs every N ticks (default 10). `WorldEventSystem` evaluates every M ticks (default 50).

### 2.2 Tick Budgeting

Target: ~300 entities (100 agents + 50 animals + 100 objects/buildings + 50 misc).

- TraitResolver + DayNight: lightweight global, ~0.5ms total.
- Agent BT: dirty-flag, ~2ms each. Animal BT: ~0.5ms. Objects: zero unless interacted with.
- MoodSystem: lightweight derived calculation, ~0.1ms per agent.
- MemorySystem: decay pass, ~0.1ms per agent.
- SeasonSystem: once per season transition, otherwise ~0.01ms check.
- ChroniclerSystem: event aggregation, ~1ms. LLM-enhanced reports: async, non-blocking.
- LLM: async, non-blocking, priority-queued (§10.5). Circuit breaker prevents timeout cascades.
- VaultSync: debounced 2s batch writes with retry queue.
- Economy + WorldEvents: amortized over N/M ticks.

---

## 3 · Entity Types

### 3.1 Entity Hierarchy

```
Entity (ECS base — Position, Renderable)
│
├── Agent (full brain)
│   ├── CharacterSheet (ST, DX, IQ, HT + Status, Rep, Chr)
│   ├── Needs (hunger, energy, social)
│   ├── Mood (derived emotional state)
│   ├── Memory (episodic event log, recency-weighted)
│   ├── Goals (aspirational objectives)
│   ├── Skills (hybrid point-buy + use-based)
│   ├── Inventory (carried items)
│   ├── Equipment (worn items with slot assignments)
│   ├── Wallet (gold)
│   ├── Progression (xp, level)
│   ├── QuestLog (active + completed)
│   ├── JobAssignment (job, facility, schedule, wage)
│   ├── Property (owned plots, buildings)
│   ├── Relationships (Canvas-backed graph)
│   ├── Traits (data-driven tag array, e.g. ["trait-unkillable", "trait-founder"])
│   ├── BrainState (mistreevous BT + Blackboard)
│   ├── DialogueConfig (template + optional LLM)
│   └── ToolAccess (file ops, skill-gated)
│
├── Chronicler (special entity — observer, no brain)
│   ├── Kind: chronicler (unique, one per world, cannot be deleted)
│   ├── No Needs, No Wallet, No Job, No BT, No Mortality
│   └── Runs dedicated ChroniclerSystem (narrator, historian, onboarding)
│
├── Animal (instinct brain)
│   ├── AnimalStats (ST, DX, HT — no IQ, no social)
│   ├── AnimalNeeds (hunger, energy — no social)
│   ├── Instinct (species profile: temperament, diet, prey/predator tags)
│   ├── Bond (optional owner agent, loyalty value)
│   ├── BrainState (instinct BT + Blackboard — no LLM, no quests, no tools)
│   └── Position
│
└── WorldObject (no brain)
    ├── ObjectType (vending_machine, food_cart, fountain, workbench, forge, etc.)
    ├── ObjectInteraction (use_cost, effect, cooldown_ticks, required_skill)
    ├── ObjectInventory (stock: item refs + quantities)
    ├── ObjectState (active | depleted | broken | under_construction)
    ├── Ownership (optional owner agent)
    └── Position
```

### 3.2 Entity Interaction Matrix

|Initiator → Target|Agent|Animal|WorldObject|
|---|---|---|---|
|**Agent**|Dialogue, trade, cooperate, hire|Pet, feed, tame, command|Use, buy from, repair, build|
|**Animal**|Follow owner, alert, flee, approach|Chase, play, territorial|Eat from (food sources)|
|**WorldObject**|—|—|— (passive)|

---

## 4 · Agent System

### 4.1 Primary Attributes (GURPS-Derived)

|Attribute|Abbr|Default|Range|Description|
|---|---|---|---|---|
|Strength|ST|10|1–20|Physical power, carry capacity|
|Dexterity|DX|10|1–20|Agility, crafting precision|
|Intelligence|IQ|10|1–20|Reasoning, perception radius, learning speed|
|Health|HT|10|1–20|Stamina, need decay resistance|

### 4.2 Social Attributes

|Attribute|Abbr|Default|Range|Description|
|---|---|---|---|---|
|Status|Status|0|-4 to 8|Social standing, job/quest access tier, property rights|
|Reputation|Rep|0|-4 to 4|Others' willingness to cooperate, trade price modifier (contextual via gossip §27.1)|
|Charisma|Chr|10|1–20|Likability, trade modifier, social need decay modifier|

**Status Progression (milestone-driven):** Status changes are evaluated every N ticks (default 100). Max change of +/- 1 per evaluation cycle. Emits `StatusChanged` event.

|Change|Trigger|
|---|---|
|+1|Own property (first time)|
|+1|Accumulate 500+ gold|
|+1|Complete 10+ quests|
|+1|Hold a skilled job (status_requirement > 0) for 100+ ticks|
|-1|Bankruptcy (wallet = 0 for 50+ ticks)|
|-1|Witnessed crime committed by this agent|
|-1|Prolonged breakdown (mood < -60 for 100+ ticks)|

### 4.3 Derived Stats

- **HP:** ST. **Stamina:** HT (consumed by movement between regions, work, tool use; recovered by brief rest and food. At 0: "exhausted" — movement speed halved, skill rolls -2, must rest).
- **Basic Speed:** (DX + HT) / 4. **Basic Move:** floor(Basic Speed) px/tick.
- **Perception Radius:** IQ × 20 px (halved at night: IQ × 10 px). **Social Reach:** Chr × 0.5 (disposition gain modifier).
- **Carry Capacity:** ST × 5 weight units. **Trade Modifier:** (Chr - 10) × 2%.

### 4.4 Needs (Hybrid Model)

|Need|Range|Decay/Tick|Modifier|Critical|Recovery|
|---|---|---|---|---|---|
|Hunger|0–100|0.5|÷ (HT/10)|< 20|Eat (food source, item, object)|
|Energy|0–100|0.25|÷ (HT/10)|< 15|Sleep (rest location — see tiers below)|
|Social|0–100|0.15|÷ (Chr/10)|< 25|Converse with nearby agent|

Critical needs override all other BT priorities.

**Pacing Targets (at 480 ticks/day):**

|Activity|Target Frequency|Derived From|
|---|---|---|
|Eat|2–3× per day|Hunger 100→20 in ~160 ticks (~3.3 game-hours)|
|Sleep|1× per day|Energy 100→15 in ~340 ticks (~7 game-hours, aligns with night)|
|Socialize|1× per 1–2 days|Social 100→25 in ~500 ticks|
|Job shift|1× per day|Schedule: 240 ticks (half the day)|
|Quest attempt|1× per 1–2 days|Off-shift hours, when quest available|
|Stamina depletion|3–5 region trips|Stamina = HT (default 10), 1 per hop. Brief rest (20 ticks idle) recovers 1.|

These rates are configurable in `game-config.json`. The design intent: a single agent's day should show a complete rhythm — wake, eat, work, socialize, eat, quest, sleep. Not a frantic survival scramble.

**Rest Location Tiers:**

|Tier|Location|Energy Recovery Rate|Mood Effect|
|---|---|---|---|
|Owned home|Agent's own property with a home building|100% (base recovery: 2.0/tick)|+2 mood ("home comfort")|
|Public shelter|Any residential zone building, tavern, inn|75% (1.5/tick)|Neutral|
|Outdoors|Anywhere — bench, ground, open field|50% (1.0/tick)|-3 mood ("slept rough")|

Homeless agents always have the worst tier. They can rest but recover slowly and suffer a mood penalty. This creates natural housing demand without locking agents out of rest entirely.

**Aspirational Goals:**

```yaml
goals:
  - id: goal-wealth
    type: aspirational
    metric: wallet.gold
    priority: high
    target: 1000
    reward_xp: 500
  - id: goal-property
    type: aspirational
    metric: property.buildings.count
    priority: high
    target: 1
    reward_xp: 800
```

**Goal Dynamics (ladder with opportunistic branching):**

Each kind has a default goal ladder defined in `config/kinds/`. When an agent achieves their current goal, they advance to the next. The ladder is data-driven and configurable:

```yaml
# config/kinds/merchant.md — goal ladder
goal_ladder:
  - id: goal-wealth-1
    metric: wallet.gold
    target: 500
    reward_xp: 300
  - id: goal-property
    metric: property.buildings.count
    target: 1
    reward_xp: 800
  - id: goal-wealth-2
    metric: wallet.gold
    target: 2000
    reward_xp: 500
  - id: goal-empire
    metric: property.buildings.count
    target: 3
    reward_xp: 1000
```

**Branching:** Agents can diverge from the ladder when world conditions change. A merchant who goes bankrupt resets to the wealth step. A guard who develops high cooking skill (use-based) may branch to "become a baker." Branching conditions are evaluated by the BT's Goal Pursuit node — it checks current skills, wallet, and world state against available goal templates.

**Completion state:** Agents who complete all ladder goals enter a "content" state — +10 mood bonus, BT focuses on social interactions and maintenance. They become community pillars, not aimless wanderers.

### 4.5 Mood System

Mood is a derived emotional state recalculated each tick by the `MoodSystem`. It is NOT a need — it's a composite score that influences BT decision thresholds, dialogue tone, work productivity, and social willingness.

**Mood Calculation:**

```
Mood = Σ (factor × weight)

Factors (default weights — configurable in game-config.json, overridable per-kind and per-agent):
  + Needs satisfaction: avg(hunger, energy, social) / 100          × 30
  + Recent positive memories (last 50 ticks): count × 3           × 20
  - Recent negative memories (last 50 ticks): count × 5           × 20
  + Goal progress: (progress / target) for highest-priority goal   × 10
  + Wallet health: min(gold / 100, 1.0)                           × 10
  + Equipment condition: avg durability of equipped items           × 5
  + Relationship quality: avg disposition of top 3 relationships   × 5
```

**Mood weight override chain:** `game-config.json` defaults → kind definition override → agent frontmatter override. This allows: merchants that care more about wallet health (kind override `wallet: 20, equipment: 2`), or a specific agent with unique priorities (agent override). MoodSystem resolves weights at Blackboard build time.

**Mood Range:** -100 (despairing) to +100 (elated).

**External Modifiers (applied after base calculation):**

```
Final Mood = clamp(Base Mood + External Modifiers, -100, +100)

External Modifiers:
  + Season global_mood_delta             (e.g., +5 in summer, -5 in winter)
  + Trait mood modifiers                 (from trait effects targeting MoodSystem)
  + Time-of-day modifier                 (e.g., -3 at night if outdoors)
  + Active world event mood modifiers    (e.g., -5 during drought)
```

**Mood Buckets and Effects:**

|Bucket|Range|BT Effect|Dialogue Effect|Work Effect|
|---|---|---|---|---|
|Elated|60–100|+10% skill rolls, seeks social|Enthusiastic tone|+20% productivity|
|Content|20–59|Normal thresholds|Neutral tone|Normal productivity|
|Stressed|-19–19|Avoids optional tasks|Terse/irritable tone|-10% productivity|
|Distressed|-59– -20|May refuse non-critical quests|Hostile/withdrawn tone|-30% productivity|
|Breakdown|-100– -60|Triggers breakdown behavior|Refuses dialogue or lashes out|Stops working|

**Breakdown Behaviors** (selected by BT when mood <= -60, data-driven per kind in `config/kinds/`):

|Kind|Default Breakdown|
|---|---|
|merchant|Refuses to trade, hoards items|
|guard|Abandons patrol, sits at tavern|
|scholar|Destroys research (deletes a file)|
|laborer|Refuses all work, wanders aimlessly|
|noble|Demands tribute from nearby agents|
|wanderer|Flees to the map edge|

Breakdown behavior is defined as a `breakdown_behavior` field in each kind definition file (`config/kinds/merchant.md`). Per-agent override is possible via agent frontmatter. This allows modders to add new kinds with custom breakdowns and Directors to customize individual agents.

**Rock Bottom Recovery:** When world-wide average mood drops below -40 (configurable), the ChroniclerSystem triggers a "Dawn of Hope" event: all agents receive +10 mood and one guaranteed positive memory ("a moment of shared resilience"). This prevents the hard lock where universal breakdown is self-reinforcing with no exit. The threshold and boost are in `game-config.json`.

**Emergence note:** Mood creates cascading social dynamics. An agent in breakdown affects coworkers (their facility is understaffed), relationship partners (negative interactions lower their mood), and the economy (production drops). A single bad event can ripple through the social graph — like DF's tantrum spirals, but emergent from our system interactions.

### 4.6 Memory System

Each agent has a `Memory` component — a bounded list of episodic records that fade over time.

**Memory Entry:**

```yaml
- tick: 4520
  type: quest_completed
  description: "Delivered ledger to archive"
  participants: ["agent-wanderer-kai", "agent-guard-marcus"]
  outcome: positive
  significance: 8  # 1-10, affects retention
  mood_impact: +5
```

**Memory Rules:**

- Max entries: 50 per agent (configurable).
- New entries added by systems emitting `MemoryEvent` (quest completion, relationship change, trade, breakdown, dialogue, failure, etc.).
- `MemorySystem` runs each tick: decays `significance` of old memories. Entries below significance 1 are pruned.
- **Minimum lifespan:** Every memory survives at least 20 ticks regardless of significance, then normal decay applies. This gives even minor memories a brief window to influence BT decisions.
- Decay rate (after minimum lifespan): `significance -= 0.1 / (original_significance / 5)` per tick. High-significance memories last longer.
- BT reads memory via the Blackboard: "have I been helped by this agent before?" "did I fail this type of quest recently?"
- LLM prompts include the 5 most significant recent memories as context.

**Emergence note:** Memory transforms agents from stateless automatons into entities with history. An agent who remembers three successful trades with Elena will offer her better prices. An agent who remembers a breakdown will avoid the location where it happened. Memory + mood + relationships form a self-reinforcing triangle that makes every agent's story unique.

### 4.7 Skills (Hybrid: Point-Buy + Use-Based)

**Effective Skill = Controlling Attribute + Purchased Points + Use Bonus + Equipment Bonus**

Use-based: successful skill use increments `use_count`. At thresholds [10, 25, 50, 100, 200], `use_bonus` +1. Max +3.

**Success Roll:** 3d6 ≤ Effective Skill. Mood modifies: Elated +1, Distressed -1, Breakdown -3.

### 4.8 Inventory & Equipment

**Inventory** is a list of item references with quantities. Constrained by Carry Capacity (ST × 5).

**Equipment** is a set of named slots. Equipped items provide attribute/skill bonuses and may have durability.

**Equipment Slots:**

|Slot|Example Items|Typical Bonuses|
|---|---|---|
|`head`|Scholar's cap, guard helmet|+IQ, +HP|
|`body`|Trader's vest, laborer's apron|+Chr, +ST|
|`hands`|Crafting gloves, gauntlets|+DX, +skill|
|`tool`|Sword, lockpick, quill, hammer|+specific skill|
|`accessory`|Trader's satchel, lucky charm|+various|

**Equipment in frontmatter:**

```yaml
equipment:
  head: "items/scholars-cap.md"
  body: null
  hands: "items/crafting-gloves.md"
  tool: "items/blacksmith-hammer.md"
  accessory: "items/traders-satchel.md"
```

### 4.9 Agent Kinds

|Kind|BT Template|Priorities|Default Tools|
|---|---|---|---|
|`merchant`|trade-focused|Wealth, reputation|read, write|
|`scholar`|research-focused|Knowledge, mastery|read, write, copy|
|`guard`|patrol-focused|Order, protection|read, move|
|`laborer`|task-focused|Survival, completion|read, move, copy|
|`noble`|influence-focused|Status, control|read, write|
|`wanderer`|exploration-focused|Freedom, discovery|read, copy, move|

Kind is a starting template. Agents self-specialize through skill-by-use and goal pursuit.

---

## 5 · Items, Equipment & Crafting

### 5.1 Item Categories

|Category|Examples|Properties|
|---|---|---|
|`raw`|Wheat, ore, logs, wool|Produced by farms/mines. Input to recipes.|
|`processed`|Flour, ingots, planks, thread|Output of processing recipes. Input to crafting.|
|`finished`|Bread, tools, furniture, clothes|Output of crafting recipes. Sold or used.|
|`consumable`|Healing potion, bread, drink|Consumed on use. Satisfies needs or restores stats.|
|`equipment`|Sword, satchel, helmet, gloves|Equipped in slots. Provides bonuses. Has durability.|
|`document`|Ledger, letter, report|Quest objectives. File ops target these.|
|`material`|Nails, bricks, glass|Construction inputs.|
|`key`|Door key, chest key|Unlocks specific world objects or locations.|

### 5.2 Item Schema (Zod-validated)

```yaml
---
id: item-bread
name: "Bread"
category: consumable
description: "A fresh loaf. Restores hunger."
effect:
  target: needs.hunger
  delta: 30
weight: 1
base_value: 5
durability: null          # null = not applicable
equipment_slot: null      # null = not equippable
equipment_bonus: null
requires_skill: null
requires_level: null
stackable: true
max_stack: 20
spoilage_ticks: 200       # null = never spoils
---
```

**Equipment item example:**

```yaml
---
id: item-traders-satchel
name: "Trader's Satchel"
category: equipment
description: "A well-worn leather satchel. Improves trading."
effect: null
weight: 2
base_value: 80
durability: 500           # ticks of use before breaking
equipment_slot: accessory
equipment_bonus:
  skill_bonus:
    trading: 2
  attribute_bonus: null
requires_skill: null
requires_level: null
stackable: false
spoilage_ticks: null
---
```

### 5.3 Item Durability

Equipped items degrade with use. Each tick an equipped item is "active" (agent is working, fighting, or using a tool), durability decrements by a base rate of 1, modified by the modifier pipeline (traits like "careful craftsman" can reduce wear; harsh winter events can accelerate it). At durability 0, the item breaks — bonuses removed, `ItemBroken` event emitted, agent's mood takes a hit.

Broken items can be repaired (repair service or workbench interaction) or replaced.

### 5.4 Recipe System

Recipes are the backbone of production and construction. Each recipe is a markdown file with Zod-validated frontmatter.

**Recipe Schema:**

```yaml
---
id: recipe-bread
name: "Bake Bread"
type: crafting         # crafting | processing | construction
category: food
inputs:
  - item_id: item-flour
    quantity: 2
  - item_id: item-water
    quantity: 1
outputs:
  - item_id: item-bread
    quantity: 3
required_facility: bakery
required_skill: cooking
required_level: 10
time_ticks: 5
xp_reward: 15
---
```

**Recipe types:**

- `processing` — transforms raw into processed (wheat → flour at mill).
- `crafting` — transforms processed/materials into finished goods (flour → bread at bakery).
- `construction` — transforms materials into buildings/objects (planks + nails → shop at land plot). Construction recipes should use multi-day `time_ticks` values: small objects (food cart, workbench) 50–100 ticks, buildings (shop, home) 480–960 ticks (1–2 days), major facilities (forge, clinic) 1440–2400 ticks (3–5 days). Multiple builders can contribute progress per shift. **Construction time is affected by the modifier pipeline:** seasonal modifiers (winter slows construction), trait modifiers (workaholic speeds it up), and world events (storms halt it).

**Production flow:**

```
Farm (Job) ──produces──► Wheat (raw)
                            │
Mill (Job) ──recipe──► Flour (processed)  [consumes Wheat]
                            │
Bakery (Job) ──recipe──► Bread (finished)  [consumes Flour]
                            │
Shop (Job) ──sells──► Bread to agents     [consumes Gold]
```

### 5.5 Spoilage

Items with `spoilage_ticks` degrade in inventory. Each tick, the spoilage counter decrements. At 0, the item is destroyed. This creates urgency in the supply chain — farmers must sell or process perishable goods quickly.

---

## 6 · Jobs & Production

### 6.1 Job Types

Jobs take place at **facilities** (buildings/world objects). Each job has a schedule, a wage, and either produces **products** (items via recipes) or provides **services** (skill-based labor consumed on delivery).

**Product Jobs** — produce tangible items:

|Job|Facility|Produces|Recipe|
|---|---|---|---|
|Farmer|Farm|Wheat, vegetables|Grow crops|
|Miner|Mine|Ore, stone|Extract minerals|
|Lumberjack|Lumber yard|Logs|Fell trees|
|Miller|Mill|Flour|Wheat → Flour|
|Baker|Bakery|Bread|Flour → Bread|
|Blacksmith|Forge|Tools, weapons|Ingots → Equipment|
|Carpenter|Workshop|Furniture, planks|Logs → Finished goods|
|Weaver|Loom house|Cloth, clothes|Thread → Finished goods|
|Brewer|Brewery|Drinks|Grain → Drinks|

**Service Jobs** — provide intangible labor:

|Job|Facility|Service|Quality Scaling|
|---|---|---|---|
|Shopkeeper|Shop|Sells goods to buyers|Chr affects prices|
|Doctor|Clinic|Heals HP/treats conditions|IQ + medicine skill|
|Teacher|School|Trains skills for other agents|IQ + relevant skill|
|Guard (patrol)|Guard post|Area protection service|DX + combat skill|
|Builder|Construction site|Constructs buildings (recipes)|ST + construction skill|
|Entertainer|Tavern|Restores social need for visitors|Chr + performance skill|
|Repairsmith|Repair shop|Restores equipment durability|DX + repair skill|

### 6.2 Job Schema

```yaml
---
id: job-baker
name: "Baker"
type: product
facility_type: bakery
schedule:
  start_tick_of_day: 60    # morning
  end_tick_of_day: 300     # evening
  days_off: [7]            # day 7 of the cycle
wage_per_tick: 0.5
recipe_id: recipe-bread
production_rate: 1         # recipe executions per shift
required_skill: cooking
required_level: 8
status_requirement: 0
---
```

**Service job example:**

```yaml
---
id: job-doctor
name: "Doctor"
type: service
facility_type: clinic
schedule:
  start_tick_of_day: 60
  end_tick_of_day: 300
  days_off: []
wage_per_tick: 1.0
service:
  effect:
    target: hp
    delta_base: 10          # base healing amount
    skill_scaling: 0.5      # effective_skill × 0.5 added
  cost_to_consumer: 20      # gold charged per service use
  cooldown_ticks: 10        # min ticks between service uses
required_skill: medicine
required_level: 12
status_requirement: 2
---
```

### 6.3 Production Flow

Each tick during a job shift, the `JobSystem`:

1. Checks if agent is at their facility and on-shift.
2. For product jobs: checks facility inventory for recipe inputs. If available, consumes inputs, produces outputs, adds to facility inventory. Agent earns wage from facility operating fund. Skill use counted.
3. For service jobs: if a customer agent is present and requesting service, executes service effect. Customer pays `cost_to_consumer` (goes to facility operating fund). Agent earns wage from facility operating fund. Skill use counted.
4. Emits `ProductionCompleted` or `ServiceProvided` event.

### 6.4 Supply Chain Logistics

Items move between facilities via the **quest economy** — no dedicated logistics system.

When a facility's inventory is low on recipe inputs, the owner's BT triggers a facility auto-quest (§8.2): "Deliver 10 wheat to my mill" posted to the billboard, funded from the facility's operating fund. Any agent can accept — they travel to the supplier (farm), purchase the inputs (agent-to-agent trade or shop purchase), carry them to the requesting facility, and deliver. Quest completed, inputs transferred.

This means supply chains are emergent:
- A thriving economy has plenty of delivery quests flowing, keeping facilities stocked.
- A depressed economy has fewer agents willing to haul goods — supply chains slow, creating scarcity pressure.
- The Director can stimulate logistics by posting delivery quests from their own treasury.
- Agents self-specialize into hauling roles if delivery quests consistently pay well (goal pursuit + memory of past quest rewards).

**Construction logistics** follow the same pattern: construction quests request materials, agents deliver them to the building site.

### 6.5 Facility Operating Fund & Wage Source

Every facility has an **operating fund** — a gold pool that pays wages and receives revenue.

**Agent-owned facilities:** Operating fund seeded on construction (configurable per building type, default 200 gold, paid from owner's wallet). Revenue from sales replenishes it. If the fund hits 0, the facility can't pay wages — workers' BT skips JobDuty (no wage = no work), and the owner receives a Chronicler warning. The owner can inject gold from their personal wallet to recapitalize.

**Director-placed public facilities** (clinics, schools, guard posts, billboards): Wages paid from the **Director's treasury**. These are public services the Director funds. If the treasury is empty, public facility workers go unpaid (same consequence — workers skip shifts).

**Template facilities:** Ship with pre-seeded operating funds sufficient for ~2 game-days of operation, giving the economy time to bootstrap.

### 6.6 Job Assignment & BT Integration

Agents can hold one job at a time. The BT evaluates job attendance as a mid-priority behavior (above idle/social, below survival needs):

```
BT Priority: Breakdown > Survival > Crime > Job Duty > Active Quest > Billboard > Goal > Social > Object Interaction > Idle
```

During shift hours, the agent's BT includes a `JobDuty` guard that activates, directing them to their facility. If a quest reward significantly exceeds remaining shift wage, the agent may skip work (with a mood penalty for "missed shift" — logged in memory).

Agents can quit jobs (mood < -30 for extended period at work), get fired (too many absences), or be hired via billboard. **Billboard-based hiring:** Facility owners with unfilled job slots post "Help Wanted" quests to the billboard (quest type `hiring`, reward = ongoing wage, requirements = skill + level). Unemployed agents evaluate these like any other quest. Acceptance creates a `JobAssignment`, emits `AgentHired` event. This reuses the existing quest infrastructure — no special hiring mechanic needed.

---

## 7 · Economy

### 7.1 Economic Loop

```
Production (Jobs) ──► Items enter facility inventories
       │
Supply (Shops, carts) ──► Items available for purchase
       │
Demand (Agent needs) ──► Agents buy items (gold flows to sellers)
       │
Wages (Jobs) ──► Gold flows to workers
       │
Savings ──► Agents accumulate gold
       │
Investment ──► Land purchase, construction, equipment
       │
Property Income ──► Rent, facility profits
       │
       └──► Back to Production
```

### 7.2 Pricing Model

The `EconomySystem` recalculates prices every N ticks (default 10).

**Price Formula:**

```
Current Price = Base Value × Scarcity Multiplier × Location Modifier

Scarcity Multiplier = max(0.5, min(3.0, Demand / Supply))
  where Demand = consumption rate over last N ticks
        Supply = available stock across all sellers

Location Modifier = 1.0 + (hops × 0.1)
  where hops = shortest path hop count on the region connection graph
        between seller's region and nearest production facility for this item

Pipeline Modifier = product of all active price_modifier values from traits, seasons, and world events
                    (e.g., winter food premium 1.2, merchant caravan discount 0.9 → 1.08)

Trade Price = Current Price × Pipeline Modifier × (1 - seller.tradeModifier + buyer.tradeModifier)
              × Relationship Modifier
  where Relationship Modifier = 1.0 - (disposition / 500)
        (positive disposition = small discount)
```

### 7.3 Agent-to-Agent Trade

Two agents within perception range can trade. The `TradeSystem` uses the **Saga pattern**:

```
Step 1: Validate seller has item → (compensate: nothing)
Step 2: Validate buyer has gold → (compensate: nothing)
Step 3: Remove item from seller → (compensate: return item)
Step 4: Add item to buyer → (compensate: remove item, return to seller)
Step 5: Deduct gold from buyer → (compensate: return gold, undo steps 3-4)
Step 6: Add gold to seller → (compensate: deduct gold, undo steps 3-5)
```

If any step fails, all prior compensating actions execute in reverse. Trade events logged to both agents' memory.

### 7.4 Property System

**Land Plots** are world entities with:

```yaml
---
id: plot-7
name: "Plot 7 — Market District"
type: land_plot
zone: commercial
position: { x: 500, y: 300 }
bounds: { width: 100, height: 80 }
owner: null
price: 200
building: null
---
```

**Buying:** Agent's BT evaluates `wallet.gold >= plot.price` and goal alignment. If purchased: `owner` set to agent ID, gold deducted, `PropertyPurchased` event.

**Building:** Owner posts a construction quest or directly commands a builder. Construction consumes materials (via construction recipes) over multiple ticks. On completion: `building` field populated, building becomes a functional world object (facility).

**Income:** If the building is a facility (shop, workshop), the owner can earn income: either by working there themselves or by hiring another agent (who earns a wage, owner keeps profit margin).

### 7.5 Zoning System

The Director designates zones on the map that constrain land use:

|Zone|Allowed Buildings|Property Price Modifier|Effect|
|---|---|---|---|
|`residential`|Homes, gardens|×1.0|Agents prefer to rest here|
|`commercial`|Shops, taverns, markets|×1.5|Higher foot traffic|
|`agricultural`|Farms, mills, barns|×0.7|Near fertile land|
|`industrial`|Forges, workshops, lumber yards|×0.8|Noisy — mood penalty for nearby residents|
|`public`|Billboard, fountain, clinic, school|×0 (not for sale)|Director-placed services|

Zone changes emit `ZoneChanged` events. Agents factor zone type into property purchase decisions.

---

## 8 · Director System

### 8.1 Role

The Director is the player. No in-world avatar. Powers: create quests, place objects, designate zones, talk to agents, inspect/configure, observe, adjust speed, trigger world events.

Cannot: directly move agents, force actions, override BT decisions.

**Pause-and-Plan:** All Director actions are available while paused — object placement, quest creation, zone designation, agent spawning, trait awards, dialogue, inspection. Actions that create entities or modify state are queued and execute on the first tick after unpause. Multiple actions can be queued. This is essential for thoughtful orchestration.

### 8.2 Quest System

Quests are markdown files. Lifecycle: `available → assigned → in_progress → completed | failed`.

```yaml
---
id: quest-deliver-ledger
title: "Deliver the Merchant's Ledger"
type: delivery
status: available
posted_to: billboard
assigned_to: null
prerequisites:
  skills: [{ name: literacy, min_level: 10 }]
  attributes: [{ name: IQ, min_value: 11 }]
objectives:
  - id: obj-pickup
    type: acquire_item
    target: "items/merchant-ledger.md"
    completed: false
  - id: obj-deliver
    type: move_file
    source: "items/merchant-ledger.md"
    destination: "locations/archive/"
    completed: false
rewards:
  gold: 50
  xp: 100
time_limit_ticks: 200
failure_penalty:
  reputation: -1
  mood_impact: -10
---
```

Agents evaluate billboard quests by scoring `(reward × goal_weight) - (estimated_cost)`. Mood modifies willingness: distressed agents reject low-reward quests.

Agents can also **create quests themselves** via two mechanisms:

**Facility owner auto-quests:** When a facility has an operational need (supply shortage, broken equipment, construction), the owner's BT generates a quest from `config/quest-templates/` (e.g., `supply-request.md`, `repair-request.md`, `construction-request.md`). The template's variable slots are filled from context (item needed, facility ID, plot ID). Reward is funded from the facility's operating fund or owner's wallet. Posted to the billboard.

**Goal pursuit quests:** Any agent's Goal Pursuit BT node (priority 6) can create a quest when the goal requires help they can't provide. E.g., an agent with goal "own property" and sufficient gold posts "Build a shop on plot 7." Limited to available quest templates. Reward funded from the agent's wallet. Max 1 active posted quest per agent.

Both sources feed the billboard — practical needs and personal ambitions compete for agent attention.

### 8.3 Director Dialogue

With LLM (Circuit Breaker protected): personality prompt + character sheet + memory (top 5) + relationship context + mood → LLM → response.

Without LLM: keyword matching → template lookup by `kind/mood_bucket`. Variables substituted.

### 8.4 Object Placement

The Director places world objects via the UI. Flow:

1. **UI:** Director selects object type from a catalog (filtered by zone compatibility), clicks a position on the map.
2. **ECS:** Entity is immediately created in ECS (sprite appears on map). `ObjectPlaced` event emitted.
3. **Treasury:** Placement cost deducted (configurable per object type via `placement_cost` field in the WorldObject schema, default 0 — some objects are free).
4. **Vault:** VaultSync creates the markdown file on the next sync cycle.
5. **Feedback:** Chronicler logs the placement. Notification confirms to Director.

Objects are defined as markdown files with Zod-validated frontmatter. The object catalog in the UI is populated from `config/objects/` definitions.

### 8.5 Object & Building Removal

The Director can remove world objects they placed (food carts, vending machines, billboards). Removal is immediate (ECS entity destroyed, VaultSync deletes file on next cycle). No treasury refund. `ObjectRemoved` event emitted.

**Buildings** (agent-constructed) cannot be directly demolished by the Director — this is an indirect control constraint. Instead: the Director can rezone the area (making the building non-compliant), or wait for the building to become abandoned (operating fund depleted, no owner, no workers for N ticks → state changes to `abandoned`). Abandoned buildings can be demolished by the Director or claimed by another agent.

### 8.6 Director Interaction Constraints

The Director's power is deliberately limited to indirect control:

|The Director CAN|The Director CANNOT|
|---|---|
|Create and post quests|Directly move agents|
|Place and remove world objects|Force an agent to take a quest|
|Designate and change zones|Override BT decisions|
|Spawn agents (from treasury)|Fire an agent from a job|
|Award and remove traits|Directly modify agent mood/needs|
|Talk to agents (dialogue)|Reassign agents to jobs|
|Adjust simulation speed|Delete living agents|
|Trigger world events|Modify agent inventory/equipment|
|Configure global settings|Control agent pathfinding|
|Bookmark moments, name eras|Force agent-to-agent interactions|

These constraints are the core of the "Director-as-player" design. The Director shapes the world; agents decide how to live in it.

### 8.7 Zone Designation

The Director paints zones on the map via a zone painting tool in the UI. Flow:

1. **UI:** Director selects zone type from a palette, draws a rectangular area on the map.
2. **ECS:** Zone entity created immediately. `ZoneChanged` event emitted.
3. **Canvas:** Zone boundaries written to `config/zones.canvas` as rectangular nodes with zone type metadata on next VaultSync cycle.
4. **Systems react:** Property prices recalculate. Agents factor zone type into building decisions. Incompatible buildings in rezoned areas get a Chronicler warning.

---

## 9 · World System

### 9.1 Spatial Model

**Hybrid region graph + free movement.** Top-down 2D map rendered by ExcaliburJS. (ExcaliburJS integration with Obsidian plugin views has been validated via technical spike — confirmed working.)

**Macro layer — Region graph.** The world is divided into named regions (market district, farm district, residential area, etc.). Each region is a markdown file with position, bounds, and connections:

```yaml
---
id: loc-marketplace
name: "Marketplace"
type: commercial
position: { x: 400, y: 200 }
bounds: { width: 200, height: 150 }
connections: [loc-farm-district, loc-residential-north, loc-forge-quarter]
travel_cost: 1                   # Stamina cost per hop when entering this region
---
```

Regions are connected via a graph. **Travel between regions** costs Stamina (the destination region's `travel_cost`) and takes time proportional to the hop count. Agents use A* on the region graph for macro pathfinding (which region to go to next).

**Micro layer — Free movement within regions.** Inside a region, agents move freely in 2D space (ExcaliburJS physics). Agents **collide** with each other and with world objects — creating emergent bottlenecks at doors, narrow paths, and popular shops. Pathfinding within a region uses ExcaliburJS built-in navigation (obstacle avoidance).

**Movement cost:** Each region transition costs Stamina (= destination's `travel_cost`). Movement within a region is free (no Stamina cost). This makes distance between regions strategically meaningful without penalizing local exploration.

### 9.2 Time Model

- 1 tick ≈ 500ms (default). Director controls: pause, slow (1s), normal (500ms), fast (100ms).
- Day cycle: 1 day = N ticks (default 480). Season cycle: 15 days per season, 60 days per year (§28).

**Day/Night Phases** (managed by `DayNightSystem`):

|Phase|Tick Range|Effects|
|---|---|---|
|Dawn|0–59|Agents wake, transition from night. Normal modifiers.|
|Day|60–299|Full activity. Normal perception, normal energy decay.|
|Dusk|300–359|Agents head home. Transition to night.|
|Night|360–479|Energy decay +50% if outdoors. Perception radius halved. Mood -3 if not in rest location. Crime opportunity increased (fewer witnesses). Most jobs off-shift.|

The `DayNightSystem` sets a global `timeOfDay` flag each tick. Other systems read this flag to apply their modifiers.

### 9.3 Perception & Interaction

Each entity has `perception_radius` (agents: IQ × 20px, animals: species-defined). `PerceptionSystem` populates ephemeral `Awareness` component via grid partitioning.

### 9.4 Movement System

**Hybrid: BT decides, ExcaliburJS moves, tick system tracks hops.**

1. BT writes `destination_region` to Blackboard via `ActionIntent(move_to_region)`.
2. ExcaliburJS moves the sprite toward the destination region's entry point (micro-level pathfinding, obstacle avoidance, collision).
3. When the agent crosses a region boundary (ExcaliburJS trigger zone), the `MovementSystem` (tick 5.5) deducts stamina (destination's `travel_cost`), updates `current_region` ECS component, and emits `RegionEntered`.
4. Multi-hop journeys chain automatically — the agent continues toward the next region on the A* path.
5. **Travel interruption:** BT re-evaluates each tick. If a higher-priority node fires (hunger critical, breakdown), the destination changes. The agent reroutes immediately.
6. **Exhaustion:** If stamina = 0 mid-journey, the agent stops in the current region (exhausted state). Movement resumes after brief rest recovers enough stamina.

### 9.5 Spatial Query Service

A stateless service populated by `PerceptionSystem` (tick 3) each tick via grid partitioning.

**Two consumers:**
- **Agent BTs** read ONLY the Blackboard (pre-categorized: nearbyFriendlies, nearbyObjects, nearbyRestLocations, etc.). Agents see the world through their perception.
- **Non-BT systems** query the `SpatialQueryService` directly: `findNearest(position, type, radius)`, `entitiesInRegion(regionId)`, `facilitiesOfType(type)`, `hopCount(regionA, regionB)`. Used by EconomySystem (location modifier), JobSystem (facility lookup), ConstructionSystem (material sources).

### 9.6 Navigation & Discovery

**Navigation model:** Agents know their own assigned facility location via a `FacilityRegistry` (global component, maintained by ConstructionSystem). The Blackboard's `jobFacilityLocation` field is populated from this registry. For everything else (shops, billboards, rest locations), agents rely on **memory + gossip + perception**. If an agent has never visited the market and nobody told them about it, they wander until they find it or hear about it. New agents must explore or be informed — this creates meaningful discovery and incentivizes social interaction.

**Interaction chain:** Proximity → Relationship check → Needs check → BT decides action → Interaction executes → Relationship/Memory updated.

### 9.7 Relationship Graph (Obsidian Canvas)

Relationships are stored in `.canvas` files following the Obsidian Canvas format:

```json
{
  "nodes": [
    { "id": "agent-merchant-elena", "type": "file", "file": "agents/agent-merchant-elena/agent-merchant-elena.md", "x": 0, "y": 0, "width": 200, "height": 100 },
    { "id": "agent-guard-marcus", "type": "file", "file": "agents/agent-guard-marcus/agent-guard-marcus.md", "x": 300, "y": 0, "width": 200, "height": 100 }
  ],
  "edges": [
    {
      "id": "rel-elena-marcus",
      "fromNode": "agent-merchant-elena",
      "toNode": "agent-guard-marcus",
      "label": "disposition: 35 | familiarity: 12",
      "color": "4"
    }
  ]
}
```

Edge metadata encodes: disposition (-100 to +100), familiarity (interaction count), last interaction tick, tags (traded_with, helped_on_quest, refused_help, etc.).

**Canvas I/O Optimization:** The `RelationshipSystem` maintains the graph in memory (ECS components). The Canvas file is NOT written on every relationship change. Instead:
- **Periodic checkpoint:** Canvas file written every N ticks (default 50).
- **Session events:** Written on session save and graceful shutdown.
- **On-demand export:** Director can trigger "Export relationship graph" to write the full Canvas file for Obsidian viewing.
- **In-game display:** Relationship data in the UI reads from ECS components, not the Canvas file.

This prevents expensive full-graph JSON serialization on every disposition change (100 agents = up to 4,950 edges). The Director can view the relationship graph in Obsidian directly via the periodic checkpoint or on-demand export.

### 9.8 World Events

The `WorldEventSystem` evaluates every M ticks (default 50). Events are data-driven markdown files:

```yaml
---
id: event-drought
name: "Drought"
type: environmental
probability: 0.05          # per evaluation cycle
duration_ticks: 200
effects:
  - system: JobSystem
    modifier: { production_rate: 0.5 }
    facility_filter: [farm]
  - system: EconomySystem
    modifier: { scarcity_boost: 1.5 }
    item_filter: [item-wheat, item-vegetables]
  - system: MoodSystem
    modifier: { global_mood_delta: -5 }
notification_severity: high
health_tag: negative             # positive | negative | neutral (for world health rubber-banding)
description: "A severe drought reduces farm output by 50%."
---
```

**Event types:**

- `environmental` — drought, storm, cold snap. Affect production and mood.
- `economic` — merchant caravan (trade opportunity), price shock, resource discovery.
- `social` — festival (social need boost), crime wave, morale shift.
- `infrastructure` — building fire, equipment failure.

The Director can also trigger events manually from the config panel.

Events emit `WorldEventStarted` and `WorldEventEnded` events on the EventBus. The `NotificationSystem` surfaces them as Director alerts.

---

## 10 · Dialogue & LLM System

### 10.1 Dual-Mode Architecture

**Mode 1 — Template (default):** Keyword matching → template lookup `config/templates/dialogue/{locale}/{kind}/{mood_bucket}.md` → variable substitution. Mood buckets: `elated` (mood >= 60), `content` (20–59), `stressed` (-19–19), `distressed` (-59– -20), `breakdown` (<= -60).

**Mode 2 — LLM (opt-in, Circuit Breaker protected):** Prompt assembly: personality + character sheet summary + top 5 memories + relationship context + mood state + active quest → LLM Adapter → response.

### 10.2 LLM Adapter (Unified Provider Interface)

```typescript
interface LLMProvider {
  id: string;
  name: string;
  sendMessage(prompt: LLMPrompt): Promise<Result<LLMResponse, LLMError>>;
  isAvailable(): boolean;
}
```

First implementation: `CursorAPIProvider`. The adapter wraps calls in a Circuit Breaker (see §16.3).

### 10.3 Agent Personality

```yaml
llm:
  enabled: true
  provider: cursor
  personality: >
    You are Elena Vasquez, a shrewd but fair merchant. You value repeat
    customers. You distrust nobility but respect hard workers.
  temperature: 0.7
  max_tokens: 150
```

### 10.4 Agent-to-Agent Dialogue

- Both LLM: two calls, turn-based. Exchange logged to both memories.
- One LLM, one template: LLM speaks, template responds.
- Both template: short exchange (1–2 lines), outcome by mood × disposition.

### 10.5 LLM Priority Queue

When multiple LLM requests compete, they are prioritized:

|Priority|Source|Rationale|
|---|---|---|
|1 (highest)|Director ↔ Agent dialogue|Player is directly engaged|
|2|Chronicler reports|Player-facing narrative|
|3 (lowest)|Agent ↔ Agent dialogue|Background; template fallback is invisible unless Director is watching|

Lower-priority requests fall back to template mode when the LLM is at capacity or the Circuit Breaker is open.

### 10.6 Dialogue Memory Integration

Every dialogue exchange generates a `MemoryEvent` with participants, tone (positive/negative), and key topics. These memories influence future dialogue (LLM receives them as context) and relationship disposition.

---

## 11 · Animals & Pets

### 11.1 Animal Attributes

Animals have a reduced attribute set — no IQ (instinct-driven), no social stats.

|Stat|Range|Description|
|---|---|---|
|ST|1–20|Physical power, carry weight|
|DX|1–10|Speed, agility|
|HT|1–20|Stamina, hunger decay resistance|

### 11.2 Animal Needs

|Need|Decay/Tick|Critical|Recovery|
|---|---|---|---|
|Hunger|0.8|< 25|Eat from food source or owner's inventory|
|Energy|0.3|< 15|Rest at owner's home or any rest location|

No social need. Animals don't require conversation.

### 11.3 Species & Instinct Profiles

Species are defined as vault config files:

```yaml
---
id: species-dog
name: "Dog"
category: pet
temperament: loyal        # loyal | independent | skittish | aggressive
diet: omnivore
perception_radius: 150
movement_speed: 8
prey_tags: []
predator_tags: [species-cat]   # will chase cats
bond_capable: true
alert_behavior: bark      # bark | growl | flee | none
---
```

### 11.4 Bond System

A bonded animal has an `owner` reference. Bond strength (0–100) affects:

- Following distance (high bond = stays closer).
- Alert behavior sensitivity (high bond = alerts owner to strangers sooner).
- Separation anxiety (bonded animal away from owner too long → mood equivalent drops, may run toward owner).
- **Pet comfort mood bonus:** When a bonded animal is within following distance, owner receives +2 to +5 mood modifier (scales with bond strength / 20). Added as an external modifier in the mood formula. Creates tangible value for pet ownership.
- **Pet food economy:** When a bonded pet eats from a commercial food source (shop, food cart), the cost is deducted from the owner's wallet automatically. Unbonded animals eating from commercial sources deplete stock without payment (an economic drain the Director should manage by providing natural food sources).

### 11.5 Animal Instinct BT

```
Root (Selector)
├── [1] Survival (Sequence)
│   ├── Condition: hunger < critical?
│   └── Action: seek food (owner inventory > diet-matched food source > forage)
├── [2] Bond (Sequence) — only if bonded
│   ├── Condition: owner within follow distance?
│   └── Action: move toward owner
├── [3] Alert (Sequence)
│   ├── Condition: unfamiliar entity in perception? AND bond > 50?
│   └── Action: alert behavior (bark/growl)
├── [4] Instinct (Selector)
│   ├── Condition: predator_tag entity nearby?
│   └── Action: chase (or flee if skittish temperament)
└── [5] Idle
    ├── Action: wander near owner (or near last known food source)
    └── Action: rest
```

No LLM, no quests, no tools, no dialogue. Pure instinct-driven behavior that interacts with other systems via the EventBus.

**Diet-based food sources:** The species `diet` field determines what counts as food. Herbivores eat from farms, gardens, and plant-based food carts. Carnivores eat from butcher shops or hunt prey-tagged animals (chase instinct). Omnivores eat from any food-tagged world object. Foraging = wander + perception + diet filter — animals search for diet-matched objects within perception range.

---

## 12 · Data Model

### 12.1 Vault Structure

```
vault/
├── config/
│   ├── game-config.json
│   ├── kinds/
│   │   ├── merchant.md
│   │   └── ...
│   ├── species/
│   │   ├── dog.md
│   │   ├── cat.md
│   │   └── ...
│   ├── templates/
│   │   ├── dialogue/{locale}/{kind}/{mood_bucket}.md
│   │   └── chronicler/{locale}/ (daily.md, seasonal.md, eulogy.md, ...)
│   ├── skills/
│   │   ├── trading.md
│   │   ├── cooking.md
│   │   └── ...
│   ├── recipes/
│   │   ├── recipe-bread.md
│   │   ├── recipe-flour.md
│   │   ├── recipe-planks.md
│   │   └── ...
│   ├── jobs/
│   │   ├── job-baker.md
│   │   ├── job-farmer.md
│   │   ├── job-doctor.md
│   │   └── ...
│   ├── events/
│   │   ├── event-drought.md
│   │   ├── event-caravan.md
│   │   ├── event-festival.md
│   │   └── ...
│   ├── traits/
│   │   ├── trait-unkillable.md
│   │   ├── trait-resilient.md
│   │   ├── trait-founder.md
│   │   └── ...
│   ├── seasons/
│   │   ├── season-spring.md
│   │   ├── season-summer.md
│   │   ├── season-autumn.md
│   │   └── season-winter.md
│   ├── objects/                  # world object type definitions (catalog for Director placement)
│   │   ├── food-cart.md
│   │   ├── vending-machine.md
│   │   └── ...
│   ├── quest-templates/
│   │   ├── supply-request.md
│   │   ├── construction-request.md
│   │   └── delivery-request.md
│   ├── locales/
│   │   ├── en.json
│   │   └── ...
│   └── zones.canvas          # zone boundaries
├── agents/
│   ├── agent-merchant-elena/
│   │   ├── agent-merchant-elena.md
│   │   └── dialogue-log.md
│   └── ...
├── animals/
│   ├── animal-dog-rex.md
│   └── ...
├── locations/
│   ├── loc-marketplace.md
│   └── ...
├── buildings/
│   ├── building-bakery-main.md
│   └── ...
├── plots/
│   ├── plot-7.md
│   └── ...
├── quests/
│   ├── quest-deliver-ledger.md
│   └── ...
├── items/
│   ├── item-bread.md
│   ├── item-traders-satchel.md
│   └── ...
├── graphs/
│   ├── relationships.canvas    # agent relationship graph
│   └── supply-chain.canvas     # production flow visualization
├── chronicles/                 # Chronicler output: digests, reports, chapter summaries
├── legacy/                     # Agent biographies and death eulogies
├── scenarios/
│   └── scenario-market-district.md
├── templates/                  # Saved custom world templates
├── migrations/                 # Vault version migration scripts
├── vault-version.json          # Vault schema version
├── game-config.json            # Game tuning (tick rate, decay rates, thresholds, locale, etc.)
├── game-secrets.json            # API keys, provider URLs (gitignored, never committed)
└── logs/
    └── event-log.md
```

### 12.2 Zod as Single Source of Truth

Every markdown frontmatter type has a corresponding Zod schema. Schemas serve triple duty:

1. **Runtime validation** — `VaultSyncSystem` validates on load. Invalid files are quarantined with a logged error and a Director notification.
2. **TypeScript types** — `z.infer<typeof AgentSchema>` generates the component type. No manual interface definitions.
3. **Documentation** — schemas are self-documenting. The GDD references them; the code implements them.

```typescript
// Example: AgentSchema (abbreviated)
const AgentSchema = z.object({
  id: z.string().regex(/^agent-[a-z0-9-]+$/),
  name: z.string().min(1),
  kind: z.string(),
  attributes: z.object({
    ST: z.number().int().min(1).max(20),
    DX: z.number().int().min(1).max(20),
    IQ: z.number().int().min(1).max(20),
    HT: z.number().int().min(1).max(20),
  }),
  social: z.object({
    status: z.number().int().min(-4).max(8),
    reputation: z.number().int().min(-4).max(4),
    charisma: z.number().int().min(1).max(20),
  }),
  needs: z.object({
    hunger: z.number().min(0).max(100),
    energy: z.number().min(0).max(100),
    social: z.number().min(0).max(100),
  }),
  mood: z.number().min(-100).max(100).default(50),
  memory: z.array(MemoryEntrySchema).default([]),
  goals: z.array(GoalSchema).default([]),
  skills: z.array(SkillSchema).default([]),
  inventory: z.array(InventoryItemSchema).default([]),
  equipment: EquipmentSchema.default({}),
  traits: z.array(z.string()).default([]),
  wallet: z.object({ gold: z.number().min(0) }),
  xp: z.number().min(0).default(0),
  level: z.number().int().min(1).default(1),
  position: PositionSchema,
  relationships: z.string().default("graphs/relationships.canvas"),
  llm: LLMConfigSchema.optional(),
  tools: z.array(z.string()).default([]),
  behavior_tree: z.string(),
  job: z.string().nullable().default(null),
  property: z.array(z.string()).default([]),
});

type Agent = z.infer<typeof AgentSchema>;
// Note: Stamina is NOT persisted. It resets to HT on session start (the session gap acts as rest).
// Stamina is a runtime-only ECS component derived from HT at load time.
```

**Referenced Sub-Schemas:**

```yaml
# GoalSchema
- id: goal-wealth-1
  type: aspirational           # aspirational | operational
  metric: wallet.gold          # predefined metric ID
  target: 500
  priority: high               # high | medium | low
  reward_xp: 300
  progress: 0                  # current progress (runtime)

# SkillSchema (config/skills/trading.md)
---
id: skill-trading
name: "Trading"
controlling_attribute: Chr     # attribute that contributes to effective skill
category: social               # social | craft | combat | knowledge | labor
description: "Negotiation and fair exchange of goods."
---

# BuildingSchema (buildings/building-bakery-main.md)
---
id: building-bakery-main
name: "Main Street Bakery"
type: bakery                   # maps to job facility_type
owner: agent-merchant-elena    # agent ID or null
position: { x: 420, y: 230 }
region: loc-marketplace
operating_fund: 200            # gold pool for wages
employee_slots: 2              # max concurrent workers
recipes: [recipe-bread]        # recipes this facility supports (jobs reference individual recipes)
state: active                  # active | under_construction | abandoned
construction_progress: null    # ticks remaining if under_construction
---

# LocationSchema (locations/loc-marketplace.md)
---
id: loc-marketplace
name: "Marketplace"
type: commercial               # residential | commercial | agricultural | industrial | public
position: { x: 400, y: 200 }
bounds: { width: 200, height: 150 }
connections: [loc-farm-district, loc-residential-north, loc-forge-quarter]
travel_cost: 1                 # stamina cost to enter
rest_tier: null                # null | public_shelter (if this region has rest facilities)
---

# SeasonSchema (config/seasons/season-spring.md)
---
id: season-spring
name: "Spring"
order: 1
duration_days: 15
effects:
  - system: JobSystem
    modifier: { production_rate: 1.2 }
    facility_filter: [farm]
  - system: NeedsDecaySystem
    modifier: { energy_decay: 0.9 }
  - system: MoodSystem
    modifier: { global_mood_delta: 3 }
weather_weights:
  rain: 0.3
  clear: 0.5
  storm: 0.1
  fog: 0.1
event_weights:
  event-drought: 0.01
  event-festival: 0.05
  event-caravan: 0.08
description: "New growth. Farms prepare for the season ahead."
---

# ToolSchema (config/tools/tool-read.md)
---
id: tool-read
name: "Read"
description: "View a document item."
operation: read_file           # read_file | write_file | copy_file | move_file
required_skill: literacy
required_level: 8
stamina_cost: 0
---
```

**game-config.json schema (abbreviated):**

```json
{
  "version": "1.0.0",
  "locale": "en",
  "tick_interval_ms": 500,
  "ticks_per_day": 480,
  "mortality": true,
  "needs": {
    "hunger_decay": 0.5,
    "energy_decay": 0.25,
    "social_decay": 0.15
  },
  "stamina": {
    "recovery_per_idle_tick": 0.05,
    "exhaustion_speed_modifier": 0.5,
    "exhaustion_skill_penalty": -2
  },
  "memory": {
    "max_entries": 50,
    "min_lifespan_ticks": 20
  },
  "economy": {
    "tax_rate": 0.05,
    "price_clamp_min": 0.5,
    "price_clamp_max": 3.0,
    "recalculation_interval_ticks": 10,
    "welfare_threshold_gold": 10,
    "welfare_reward_min": 15,
    "welfare_reward_max": 25,
    "max_active_welfare_quests": 3,
    "treasury_start_sandbox": 500,
    "treasury_regen_per_day": 1,
    "circulation_floor_per_agent": 50,
    "loan_interest_per_day": 0.01
  },
  "season": {
    "days_per_season": 15
  },
  "candidate_pool": {
    "size_min": 3,
    "size_max": 5,
    "weighted_count": 2,
    "refresh_days": 5
  },
  "world_events": {
    "evaluation_interval_ticks": 50
  },
  "status": {
    "evaluation_interval_ticks": 100
  },
  "canvas_checkpoint_interval_ticks": 50,
  "ui_bridge_snapshot_interval_ticks": 10,
  "vault_sync_debounce_ms": 2000,
  "llm": {
    "provider": "cursor",
    "budget_daily_calls": 50
  },
  "mood": {
    "factor_weights": {
      "needs": 30, "positive_memories": 20, "negative_memories": 20,
      "goal_progress": 10, "wallet": 10, "equipment": 5, "relationships": 5
    },
    "buckets": [
      { "name": "elated", "min": 60, "max": 100 },
      { "name": "content", "min": 20, "max": 59 },
      { "name": "stressed", "min": -19, "max": 19 },
      { "name": "distressed", "min": -59, "max": -20 },
      { "name": "breakdown", "min": -100, "max": -60 }
    ],
    "skill_roll_modifiers": { "elated": 1, "content": 0, "stressed": 0, "distressed": -1, "breakdown": -3 },
    "external_modifier_cap": 30
  },
  "status": {
    "evaluation_interval_ticks": 100,
    "triggers": [
      { "condition": "property.first_owned", "delta": 1 },
      { "condition": "wallet.gold >= 500", "delta": 1 },
      { "condition": "quests.completed >= 10", "delta": 1 },
      { "condition": "job.skilled_ticks >= 100", "delta": 1 },
      { "condition": "wallet.gold == 0 && duration >= 50", "delta": -1 },
      { "condition": "crime.witnessed", "delta": -1 },
      { "condition": "mood.breakdown_ticks >= 100", "delta": -1 }
    ]
  },
  "skills": {
    "use_thresholds": [10, 25, 50, 100, 200],
    "max_use_bonus": 3
  },
  "mortality": {
    "starvation_collapse_ticks": 50,
    "starvation_death_ticks": 100,
    "despair_death_ticks": 200,
    "quest_danger_mortality_chance": 0.1
  },
  "perception": {
    "base_multiplier": 20,
    "night_multiplier": 10
  },
  "formulas": {
    "basic_speed_divisor": 4,
    "carry_capacity_multiplier": 5,
    "trade_modifier_per_chr": 0.02,
    "social_reach_multiplier": 0.5
  },
  "day_night": {
    "dawn": { "start": 0, "end": 59 },
    "day": { "start": 60, "end": 299 },
    "dusk": { "start": 300, "end": 359 },
    "night": { "start": 360, "end": 479 }
  },
  "gossip": {
    "reliability_tiers": [1.0, 0.7, 0.5, 0.3],
    "iq_filter_threshold": 12
  },
  "crime": {
    "mood_threshold": -20
  },
  "rest_tiers": {
    "owned_home": { "recovery_rate": 2.0, "mood_effect": 2 },
    "public_shelter": { "recovery_rate": 1.5, "mood_effect": 0 },
    "outdoors": { "recovery_rate": 1.0, "mood_effect": -3 }
  },
  "bt": {
    "quest_wage_skip_multiplier": 1.5
  },
  "agent_creation": {
    "base_cost": 50,
    "cost_per_attribute_point": 5,
    "candidate_discount": 0.7
  },
  "debug": false
}
```

### 12.3 Canvas Format for Graphs

Obsidian Canvas (`.canvas`) JSON format stores graph data: nodes (entities) and edges (relationships). Used for:

- **Relationship graph** — agents as nodes, edges with disposition/familiarity metadata.
- **Zone map** — zone boundaries as rectangular nodes with zone type metadata.
- **Supply chain visualization** — facilities as nodes, production flows as edges (read-only, for Director inspection).

### 12.4 Data Flow

```
Vault (markdown + JSON + Canvas)
       │
       │  VaultSyncSystem: load → Zod validate → create/update ECS
       ▼
ECS Components (runtime state)
       │
       │  Systems read (Blackboard) → decide → emit events (Command)
       ▼
EventBus
       │
       ├──► VaultSyncSystem: dirty components → serialize → Zod validate → write (retry queue)
       ├──► UIBridgeSystem: diffs → Pinia stores → Vue reactivity
       ├──► NotificationSystem: filter → Director alerts
       └──► Logger: structured log → console + vault + UI
```

**Continuous sync:**

- **Startup:** full vault load → Zod validate all → create ECS entities. Invalid files quarantined.
- **Inbound:** filesystem watcher → re-parse → Zod validate → update component → `ExternalChangeEvent`.
- **Outbound:** dirty-flagged → debounced batch (2s) → Zod validate → write. Failed writes → retry queue.
- **Conflict:** last-write-wins with warning log. Vault is canonical after next sync.

### 12.5 Markdown Creation Service

A domain-level service for creating markdown files with proper YAML frontmatter, with optional template support. This is the **write counterpart** to the frontmatter parser (which reads).

**Interface:**

```typescript
// src/domain/core/markdown-service.ts
interface MarkdownService {
	/** Create a markdown string from a frontmatter object and optional body */
	serialize(frontmatter: Record<string, unknown>, body?: string): string;

	/** Create a markdown string from a template, substituting variables */
	fromTemplate(template: string, variables: Record<string, unknown>): ResultValue<string>;

	/** Load a template file via VaultAdapter, fill variables, return complete markdown */
	renderTemplate(templatePath: string, variables: Record<string, unknown>): Promise<ResultValue<string>>;
}
```

**Consumers:**
- **VaultSyncSystem** — serializes ECS component state back to markdown frontmatter for vault persistence
- **ChroniclerSystem** — creates eulogy files (`legacy/`), daily digests (`chronicles/`), seasonal reports
- **QuestSystem** — agent-created quests from templates (`config/quest-templates/`)
- **Director actions** — creating quests, spawning agents (generates agent markdown file)
- **WelfareQuestSystem** — Chronicler-generated welfare quests

**Template syntax:** Simple `{{variable}}` substitution in both frontmatter and body text:

```markdown
---
id: quest-supply-{{facility_id}}
title: "Deliver {{quantity}} {{item_name}} to {{facility_name}}"
type: delivery
status: available
posted_to: billboard
rewards:
  gold: {{reward_gold}}
---

{{facility_owner}} needs supplies for their {{facility_type}}.
```

**Template resolution:** Templates are loaded from vault via `VaultAdapter`, then variables substituted. Unresolved variables (missing from the variables map) return `Result.err` with `TEMPLATE_VARIABLE_MISSING` code.

**Zod validation on output:** After creating a markdown string, the caller can validate the generated frontmatter against the appropriate schema before writing to vault — ensuring generated files are always schema-compliant.

---

## 13 · UI/UX

### 13.1 Obsidian UI Integration

The game UI MUST feel native to Obsidian — not a foreign application dropped into a tab. All UI elements follow Obsidian's theming, styling, and interaction patterns.

**Theming rules:**
- Use Obsidian CSS custom properties (`--background-primary`, `--text-normal`, `--interactive-accent`, `--text-on-accent`, etc.) for ALL colors — never hardcode hex values in UI components.
- Respect light/dark mode switching automatically via CSS variables.
- Use Obsidian's font stack (`--font-interface`, `--font-text`, `--font-monospace`) — never import external fonts.
- Follow Obsidian's spacing scale (`--size-4-1`, `--size-4-2`, etc.) for margins/padding.
- Match Obsidian's border radius, shadow, and transition conventions.

**Component styling:**
- Buttons use Obsidian's `.mod-cta` (primary), `.clickable-icon` (icon buttons), and `.mod-warning` (destructive) classes.
- Inputs use Obsidian's native `<input>` and `<select>` styling — do not override.
- Collapsible sections use the same pattern as Obsidian's left sidebar (`.tree-item`, `.tree-item-self`, `.collapse-icon`).
- Scrollbars inherit Obsidian's themed scrollbar styling.
- Tooltips use Obsidian's tooltip API (`setTooltip` or `.tooltip` class).

**Layout integration — Multi-Leaf Architecture:**

The game uses multiple Obsidian leaf views, not a single monolithic view. Each view is an independent `ItemView` that the Director can dock, split, tab, resize, and rearrange using Obsidian's native workspace.

|View Type|Purpose|Default Position|
|---|---|---|
|`meridian-game-view`|World map (ExcaliburJS canvas), toolbar, speed controls|Center (main pane)|
|`meridian-detail-view`|Detail panel for selected entity (agent sheet, building info, quest detail, plot info)|Right sidebar or split right|
|`meridian-chronicler-view`|Chronicler output: observations, digests, reports, milestones|Right sidebar (tabbed)|
|`meridian-economy-view`|Economy dashboards: price charts, supply chain, treasury ledger|Bottom split or separate tab|
|`meridian-debug-view`|Debug panel: modifier inspector, Blackboard, performance|Bottom split (hidden by default)|

**How it works:**
- The **game view** is the primary view. Clicking an agent/object/building on the map opens or updates the **detail view** with that entity's information.
- The detail view is context-sensitive: selecting an agent shows the agent sheet (needs, mood, memory, skills, equipment); selecting a building shows facility info (operating fund, workers, recipes); selecting a quest shows objectives and progress.
- Each view type is registered independently in `plugin.ts`. The Director can open multiple instances, rearrange them freely, or close views they don't need.
- Views communicate via the EventBus: the game view emits `EntitySelected` events; the detail view subscribes and updates its content.
- This replaces the all-in-one sidebar approach — Obsidian's workspace gives us more flexible window real estate than a fixed sidebar could.
- When the Director first opens the plugin, a default layout is suggested (game center, detail right), but they can customize freely.

**Obsidian workspace commands:**
- "Open Game World" — opens/focuses the main game view
- "Open Detail Panel" — opens the detail view (or focuses if already open)
- "Open Chronicler" — opens the Chronicler view
- "Open Economy Dashboard" — opens the economy view
- "Toggle Debug" — opens/closes the debug view

**CSS architecture:**
- One `styles.css` file loaded by the plugin (Obsidian convention).
- CSS uses Obsidian's variable system exclusively for colors, fonts, and spacing.
- BEM naming convention for custom classes (e.g., `.meridian-agent-list`, `.meridian-agent-list__item`, `.meridian-agent-list__item--selected`).
- No `!important` overrides of Obsidian styles.
- Media queries for responsive layout within the view container (not viewport — the view may be split to any size).

**ExcaliburJS canvas styling:**
- The ExcaliburJS canvas fills the map container but defers to Obsidian's theme for background color.
- Canvas background should read from `--background-primary` (converted to hex for ExcaliburJS's `backgroundColor` config) so the map matches the vault theme.
- Debug overlays use semi-transparent colors that work in both light and dark themes.

### 13.2 Layout: Split View

```
┌──────────────────────────────────────────────────────────────┐
│  Toolbar: [⏸][▶][▶▶][▶▶▶] Tick:4521 Day:9 Agents:47 Sync:✓ │
│  [!3 Alerts]                                                 │
├────────────────────────────┬─────────────────────────────────┤
│                            │  [Agents][Quests][Jobs][Economy] │
│    World Map               │  [Config][Events][Dialogue]      │
│    (ExcaliburJS Canvas)    │                                  │
│                            │  ┌─ Content Area ──────────────┐ │
│    · Agent/animal sprites  │  │                              │ │
│    · Location regions      │  │  (context-sensitive panel)   │ │
│    · World objects         │  │                              │ │
│    · Zone overlays         │  │                              │ │
│    · Debug toggles         │  └──────────────────────────────┘ │
├────────────────────────────┴─────────────────────────────────┤
│  Status: Agents:47 Animals:12 Objects:35 Quests:5 Gold:∑4280 │
└──────────────────────────────────────────────────────────────┘
```

### 13.3 Multi-Leaf View Interaction

Views communicate via the shared EventBus and Pinia stores:

- **Entity selection:** Director clicks an agent/object/building on the map → game view emits `EntitySelected` event → detail view subscribes and displays that entity's information.
- **Notification follow:** Clicking a notification in the game toolbar emits `EntitySelected` for the relevant entity — the map centers on it and the detail view updates.
- **Cross-view actions:** The detail view can trigger Director actions (award trait, post quest) which flow through the game's action queue like any other Director action.
- **Dialogue:** Talking to an agent opens in the detail view as a dialogue sub-panel — the Director can chat while watching the map.
- **Config and scenario:** Global settings and scenario management are accessible via Obsidian commands or the game toolbar — they don't need dedicated views (modal dialogs or command palette).

### 13.4 Notification Bar

Toolbar displays alert count. Clicking expands a notification dropdown:

- 🔴 Critical: agent breakdown, quest failure, error recovery event, vault sync failure.
- 🟡 Warning: need critical, stock depleted, world event started, item broken.
- 🟢 Info: quest completed, skill improved, property purchased.

Clicking a notification selects the relevant entity on the map and panel.

### 13.5 Vue Component Architecture (Multi-Leaf)

Each Obsidian leaf view hosts its own Vue app instance. Pinia stores are shared across views (singleton per plugin instance).

**Game View (`meridian-game-view`):**
```
GameViewApp.vue
├── GameToolbar.vue
│   ├── SpeedControls.vue
│   ├── SeasonIndicator.vue
│   ├── TreasuryDisplay.vue
│   ├── NotificationDropdown.vue
│   └── DebugToggle.vue
├── MapContainer.vue
│   └── DebugOverlayLayer.vue
└── GameStatusBar.vue
```

**Detail View (`meridian-detail-view`) — context-sensitive:**
```
DetailViewApp.vue
├── DetailHeader.vue (entity name, type icon, close)
├── AgentDetailPanel.vue (when agent selected)
│   ├── CharacterSheet.vue
│   ├── NeedsBars.vue (+ StaminaBar)
│   ├── MoodIndicator.vue
│   ├── TraitBadges.vue
│   ├── MemoryTimeline.vue
│   ├── SkillsList.vue
│   ├── EquipmentSlots.vue
│   ├── InventoryGrid.vue
│   └── RelationshipMiniGraph.vue
├── BuildingDetailPanel.vue (when building selected)
│   ├── FacilityInfo.vue
│   ├── OperatingFundBar.vue
│   └── WorkerList.vue
├── QuestDetailPanel.vue (when quest selected)
│   ├── QuestObjectives.vue
│   └── QuestTimer.vue
└── PlotDetailPanel.vue (when plot selected)
```

**Chronicler View (`meridian-chronicler-view`):**
```
ChroniclerViewApp.vue
��── TickObservations.vue
├── DigestView.vue
├── SeasonalReport.vue
├── MilestoneLog.vue
└── StoryTools.vue (bookmarks, eras, timeline, biographies)
```

**Economy View (`meridian-economy-view`):**
```
EconomyViewApp.vue
├── PriceChart.vue
├── SupplyDemandTable.vue
├── SupplyChainFlow.vue
├── PropertyRegistry.vue
├── TreasuryLedger.vue
└── TradeLog.vue
```

**Debug View (`meridian-debug-view`):**
```
DebugViewApp.vue
├── ModifierInspector.vue
├── BlackboardInspector.vue
├── PerformancePanel.vue
├── EventLogPanel.vue
└── EntityBrowser.vue
```

### 13.6 Pinia Stores

|Store|Responsibility|Source|
|---|---|---|
|`useAgentStore`|Agent list, selection, detail|UIBridge events|
|`useAnimalStore`|Animal list, bonds|UIBridge events|
|`useQuestStore`|Quest lifecycle|UIBridge events|
|`useJobStore`|Job assignments, production|UIBridge events|
|`useEconomyStore`|Prices, supply/demand, property|EconomySystem events|
|`useWorldStore`|Tick, time, speed, active events|UIBridge events|
|`useDialogueStore`|Active conversation|DialogueSystem events|
|`useEventLogStore`|Ring buffer (last 500)|EventBus.onAny|
|`useNotificationStore`|Alert queue|NotificationSystem|
|`useConfigStore`|Global settings|Config panel ↔ VaultSync|
|`useChroniclerStore`|Chronicler output, digests, reports|ChroniclerSystem events|
|`useTreasuryStore`|Director treasury balance, income/expenses|EconomySystem events|
|`useSeasonStore`|Current season, day/night phase, modifiers|SeasonSystem + DayNightSystem|
|`useMilestoneStore`|Achieved milestones, milestone log|ChroniclerSystem events|
|`useScenarioStore`|Active scenario goals, progress, scoring|ScenarioSystem events|
|`useStoryStore`|Bookmarks, era names, timeline, agent biographies|DirectorAction events (BookmarkCreated, EraNameAssigned)|
|`useDebugStore`|Debug overlays, performance metrics, Blackboard inspector|Debug mode toggle|

### 13.7 UIBridge Contract

The `UIBridgeSystem` (tick position 20) bridges ECS state to Pinia stores. **Hybrid event + snapshot model:**

**High-frequency updates (every tick via events):** Agent positions, need values, mood changes, active BT node. Pushed as lightweight DTOs when the underlying event fires (e.g., `MoodChanged` → `useAgentStore` receives `{ agentId, mood, moodBucket }`). Minimal data, maximum responsiveness.

**Consistency snapshot (every N ticks, default 10):** Full reconciliation pass. UIBridgeSystem iterates all dirty-flagged entities, serializes UI-relevant fields into DTOs, and pushes to Pinia stores. This catches any missed events and prevents UI drift.

**DTO format (not full ECS components):**

```typescript
interface AgentUIDto {
  id: string;
  name: string;
  kind: string;
  position: { x: number; y: number; region: string };
  needs: { hunger: number; energy: number; social: number };
  stamina: number;
  mood: number;
  moodBucket: MoodBucket;
  traits: string[];
  activeAction: string | null;  // BT node label
  wallet: number;
  jobId: string | null;
  questId: string | null;
}
```

Only UI-relevant fields cross the boundary. ECS internals (Blackboard, raw memory entries, BT state machine) stay in ECS — the UI reads summaries, not raw state.

---

## 14 · EventBus, Logging & Notifications

### 14.1 EventBus

```typescript
interface GameEvent {
  type: string;
  tick: number;
  wallClock: number;
  source: string;
  payload: Record<string, unknown>;
}

interface EventBus {
  emit(event: GameEvent): void;
  on(type: string, handler: EventHandler): Unsubscribe;
  on(type: string, handler: EventHandler, priority?: number): Unsubscribe; // priority: lower = first
  off(type: string, handler: EventHandler): void;
  onAny(handler: EventHandler): Unsubscribe;
  filter(predicate: (event: GameEvent) => boolean, handler: EventHandler): Unsubscribe;
  history(filter?: { type?: string; source?: string; limit?: number }): GameEvent[];
}
```

**EventBus Enhancements:**

- **Event priorities** — Handlers can specify a priority (lower = processed first). Default: 100. Critical handlers (error recovery, circuit breaker) run at priority 0. UI handlers run at priority 200. This ensures safety-critical handlers process events before display handlers.
- **Event filtering** — Subscribe to events matching a predicate function: `bus.filter(e => e.payload.agentId === 'elena', handler)`. Useful for entity-specific listeners (e.g., Chronicler watching a specific agent).
- **Event batching** — The EventBus collects events during a system's tick execution and delivers them between systems. This prevents mid-tick event cascades and ensures deterministic processing order. Events emitted by system N are delivered before system N+1 runs.

```typescript
// Priority example: error recovery processes before UI
bus.on('VaultSyncFailed', handleRecovery, 0);    // critical
bus.on('VaultSyncFailed', updateUIAlert, 200);    // display
```

**Event Catalog** (expanded with new systems):

|Event|Source|
|---|---|
|`NeedChanged`, `NeedCritical`|NeedsDecay|
|`MoodChanged`, `MoodBreakdown`|MoodSystem|
|`MemoryAdded`, `MemoryDecayed`|MemorySystem|
|`EntitiesPerceived`|Perception|
|`ActionIntent`|BehaviorTree|
|`ProductionCompleted`, `ServiceProvided`|JobSystem|
|`QuestCreated`, `QuestAssigned`, `QuestCompleted`, `QuestFailed`|QuestEvaluation|
|`ObjectUsed`, `ObjectDepleted`|ObjectInteraction|
|`FileOpCompleted`, `FileOpFailed`|ToolExecution|
|`ConstructionProgress`, `ConstructionCompleted`|Construction|
|`TradeCompleted`, `TradeFailed`|TradeSystem|
|`DialogueCompleted`|Dialogue|
|`SkillUsed`, `SkillImproved`, `XPGained`|Progression|
|`RelationshipChanged`|Relationship|
|`ItemBroken`, `ItemSpoiled`|ItemDurability|
|`PriceChanged`|Economy|
|`PropertyPurchased`, `PropertyBuilt`|Property|
|`WorldEventStarted`, `WorldEventEnded`|WorldEvent|
|`ZoneChanged`|Zoning|
|`ExternalChangeDetected`, `VaultSyncFailed`|VaultSync|
|`CircuitBreakerOpened`, `CircuitBreakerClosed`|LLM/CircuitBreaker|
|`EntitySuspended`, `EntityResumed`|ErrorRecovery|
|`SeasonChanged`|SeasonSystem|
|`MilestoneAchieved`|ChroniclerSystem|
|`AgentDied`, `AgentCollapsed`|MortalityCheck|
|`AgentSpawned`|DirectorAction|
|`CrimeCommitted`|BehaviorTreeSystem|
|`GossipExchanged`|DialogueSystem|
|`TraitAwarded`, `TraitRemoved`, `TraitConflictDetected`|TraitResolverSystem|
|`ScenarioStarted`, `ScenarioCompleted`, `ScenarioIncomplete`|ScenarioSystem|
|`BookmarkCreated`, `EraNameAssigned`|DirectorAction|
|`DirectorTaxCollected`|EconomySystem|
|`WelfareQuestNeeded`|EconomySystem|
|`WelfareQuestPosted`|ChroniclerSystem|
|`PropertyInherited`|MortalityCheck|
|`CandidatePoolRefreshed`|ChroniclerSystem|
|`StatusChanged`|ProgressionSystem|
|`TimeOfDayChanged`|DayNightSystem|
|`FacilityFundDepleted`|JobSystem|
|`AgentExhausted`|NeedsDecaySystem|
|`LocaleChanged`|UIBridgeSystem|
|`ConfigChanged`|VaultSyncSystem|
|`AgentHired`|QuestEvaluationSystem|
|`ObjectPlaced`, `ObjectRemoved`|DirectorAction|
|`SpeedChanged`, `SimulationPaused`, `SimulationResumed`|DirectorAction|
|`DialogueRequested`, `DialogueRefused`|DialogueSystem|
|`FacilityVacancy`|JobSystem|
|`SupplyShortage`|JobSystem|
|`EntitySelected`|DirectorAction (game view click)|
|`RegionEntered`|MovementSystem|
|`BuildingAbandoned`|AbandonmentSystem|
|`WorldHealthCalculated`|ChroniclerSystem|
|`DirectorLoanTaken`, `DirectorLoanRepaid`|EconomySystem|

### 14.2 Logger

```typescript
interface Logger {
  debug(system: string, msg: string, data?: unknown): void;
  info(system: string, msg: string, data?: unknown): void;
  warn(system: string, msg: string, data?: unknown): void;
  error(system: string, msg: string, err?: Error, data?: unknown): void;
}
```

Targets: console (dev), vault file `logs/event-log.md`, UI Event Log panel.

### 14.3 Notification System

The `NotificationSystem` subscribes to the EventBus and filters events into Director-facing alerts based on severity rules (configurable):

```yaml
notification_rules:
  - event: MoodBreakdown
    severity: critical
    message: "{agentName} is having a breakdown!"
  - event: QuestFailed
    severity: warning
    message: "Quest '{questTitle}' failed."
  - event: WorldEventStarted
    severity: warning
    message: "World event: {eventName}"
  - event: VaultSyncFailed
    severity: critical
    message: "Vault sync failed for {filePath}"
  - event: QuestCompleted
    severity: info
    message: "{agentName} completed '{questTitle}'"
```

---

## 15 · Behavior Tree Design

### 15.1 Blackboard Pattern

Each agent/animal has a **Blackboard** — a key-value store populated at the start of each BT evaluation tick from ECS components:

```typescript
interface Blackboard {
  // Populated from components each tick
  needs: { hunger: number; energy: number; social: number };
  stamina: number;               // exertion pool (= HT). 0 = exhausted
  mood: number;
  moodBucket: MoodBucket;
  memories: MemoryEntry[];       // most significant recent
  awareness: EntityId[];         // from PerceptionSystem
  activeQuest: Quest | null;
  jobOnShift: boolean;
  jobFacilityLocation: RegionId | null;  // where to go for work
  jobWagePerTick: number;                // for quest-vs-wage comparison
  jobShiftRemaining: number;             // ticks left in current shift
  ownedFacilityFund: number | null;      // operating fund balance (if facility owner)
  wallet: number;
  skills: Map<string, number>;   // effective skill levels
  goals: Goal[];
  traits: string[];              // active trait IDs
  propertyOwned: PlotId[];       // owned land plots
  season: SeasonId;              // current season from SeasonSystem
  timeOfDay: TimeOfDay;          // dawn | day | dusk | night from DayNightSystem
  gossipKnowledge: GossipEntry[]; // gossip memories (filtered from memory by type)
  nearbyObjects: WorldObject[];
  nearbyFriendlies: EntityId[];
  nearbyStrangers: EntityId[];
  nearbyAnimals: EntityId[];
  nearbyUnguarded: WorldObject[]; // unguarded targets for crime evaluation
  nearbyRestLocations: { id: string; tier: RestTier }[]; // rest options with quality
  ownedFacilityVacancies: number; // unfilled job slots (0 if not a facility owner)

  // Written by BT nodes (read by systems next tick)
  selectedAction: ActionIntent | null;
}
```

The BT reads the Blackboard only. It writes `selectedAction` which is emitted as an `ActionIntent` event. This decoupling makes BTs independently testable: inject a mock Blackboard, assert the selected action.

### 15.2 Agent BT Structure

```
Root (Selector — first success wins)
│
├── [1] Breakdown (Sequence)
│   ├── Condition: mood < -60?
│   └── Action: kind-specific breakdown behavior
│
├── [2] Survival (Sequence)
│   ├── Condition: any need < critical?
│   └── Action: seek recovery (food/rest/social — check memory for preferred locations)
│
├── [2.5] Crime Evaluation (Sequence) — §27.2
│   ├── Condition: critical need AND mood <= -20 AND opportunity (unguarded target)?
│   └── Action: steal / trespass (memory + event logged)
│
├── [3] Job Duty (Sequence)
│   ├── Condition: on shift AND not excused?
│   └── Action: go to facility, execute production/service
│
├── [4] Active Quest (Sequence)
│   ├── Condition: has active quest?
│   ├── Selector: current objective
│   │   ├── Move to target
│   │   ├── Use required tool (Command pattern)
│   │   ├── Interact with required agent
│   │   └── Wait / retry
│   └── Action: report completion
│
├── [5] Billboard Scan (Sequence)
│   ├── Condition: near billboard AND no quest AND mood > -20?
│   ├── Action: evaluate quests (score by reward × goal alignment)
│   └── Action: accept best (or skip)
│
├── [6] Goal Pursuit (Sequence)
│   ├── Condition: has incomplete goals?
│   ├── Action: select highest priority
│   └── Action: take next step (buy land, seek training, accumulate gold)
│
├── [7] Social Opportunity (Sequence)
│   ├── Condition: friendly agent nearby AND social < 50?
│   ├── Condition: memory check — no recent negative interaction with this agent?
│   └── Action: initiate conversation
│
├── [8] Object Interaction (Sequence)
│   ├── Condition: useful object nearby AND relevant need < 50?
│   └── Action: use object (buy drink, eat food, repair equipment)
│
└── [9] Idle (Selector)
    ├── Action: wander within current location
    └── Action: wait
```

**Priority order creates emergence:** Breakdown (1) overrides everything. Survival (2) overrides work. Job duty (3) competes with quests (4). Mood gates billboard access (5). Memory gates social choices (7). Objects provide mid-priority need satisfaction (8).

### 15.3 Animal Instinct BT

See §11.5. Simpler: Survival > Bond > Alert > Instinct > Idle.

### 15.4 BT Customization

- Templates per `kind` in vault config. Director can override per agent.
- Custom BTs in JSON (mistreevous format), hot-reloaded next tick.

---

## 16 · Error Recovery Architecture

### 16.1 Design Philosophy

Errors are expected, not exceptional. The simulation must recover from: malformed vault files, LLM timeouts, filesystem failures, invalid state transitions, and unexpected runtime exceptions. No single failure should crash the simulation or corrupt the world state.

### 16.2 Result Type

All operations that can fail return a typed Result:

```typescript
type Result<T, E = GameError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

interface GameError {
  code: string;
  message: string;
  system: string;
  recoverable: boolean;
  context?: Record<string, unknown>;
}
```

No bare try/catch in system code. All error paths are explicit and composable:

```typescript
const parseResult = parseMarkdown(fileContent);
if (!parseResult.ok) {
  logger.warn('VaultSync', `Invalid file: ${path}`, parseResult.error);
  quarantine(path);
  return Result.err(parseResult.error);
}
const validated = AgentSchema.safeParse(parseResult.value);
if (!validated.success) {
  logger.warn('VaultSync', `Schema violation: ${path}`, validated.error);
  quarantine(path);
  return Result.err({ code: 'SCHEMA_INVALID', ... });
}
```

### 16.3 Circuit Breaker (LLM Protection)

```typescript
interface CircuitBreaker {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  failureThreshold: number;     // default: 3
  cooldownTicks: number;        // default: 100
  lastFailureTick: number;

  execute<T>(fn: () => Promise<Result<T>>): Promise<Result<T>>;
}
```

- **Closed:** calls pass through. On failure, increment count. At threshold → open.
- **Open:** all calls immediately return `Result.err` with `CIRCUIT_OPEN`. Template fallback activates. After cooldown → half-open.
- **Half-open:** allow one test call. Success → closed. Failure → open again.

Circuit state changes emit `CircuitBreakerOpened` / `CircuitBreakerClosed` events.

### 16.4 Command Pattern (Reversible Actions)

All state-mutating agent actions are expressed as Commands:

```typescript
interface Command {
  id: string;
  type: string;
  agentId: string;
  validate(): Result<void>;
  execute(): Result<void>;
  compensate(): Result<void>;   // undo
}
```

The `ToolExecutionSystem` and `TradeSystem` process Command queues. If `execute()` fails, the system calls `compensate()` on all prior successful commands in the transaction.

### 16.5 Saga Pattern (Multi-Step Transactions)

Trades and construction are modeled as Sagas — ordered Command sequences with compensating actions:

```typescript
interface Saga {
  steps: Command[];
  execute(): Result<void>;  // runs steps in order; on failure, compensates in reverse
}
```

### 16.6 System Error Boundaries

The tick runner wraps each system in an error boundary:

```typescript
for (const system of systems) {
  const result = system.update(tick);
  if (!result.ok) {
    logger.error('TickRunner', `System ${system.name} failed`, result.error);
    if (result.error.recoverable) {
      retryQueue.add(system.name, tick);
    }
    // Continue to next system — never halt the tick
  }
}
```

### 16.7 Entity Suspension

If a specific entity causes repeated errors (malformed data, corrupted state):

1. Entity is **suspended** — removed from system processing but not destroyed.
2. `EntitySuspended` event emitted → Director notification.
3. On next vault sync cycle, if the underlying file is corrected, entity is **resumed**.
4. `EntityResumed` event emitted.

---

## 17 · Technical Constraints & Testing

### 17.1 Performance Budgets

|Metric|Target|
|---|---|
|Tick processing (100 agents + 50 animals + 100 objects)|< 300ms|
|Agent BT evaluation|< 2ms each|
|Animal BT evaluation|< 0.5ms each|
|Mood/Memory recalculation|< 0.1ms each|
|Vault sync batch write (50 files)|< 500ms|
|UI reactivity (store → DOM)|< 16ms|
|LLM response|< 10s (async)|
|Economy recalculation|< 50ms (every 10 ticks)|

### 17.2 Testing Strategy

|Layer|Strategy|Tools|
|---|---|---|
|Zod Schemas|Unit: validate known-good and known-bad data|Vitest|
|ECS Components|Unit: creation, defaults, serialization|Vitest|
|Systems|Unit: inject mock Blackboard/components, assert events|Vitest|
|Result/Command/Saga|Unit: success paths, failure paths, compensation|Vitest|
|Circuit Breaker|Unit: state transitions, cooldown, half-open|Vitest|
|Behavior Trees|Integration: mock Blackboard → assert selected action|Vitest + mistreevous|
|EventBus|Unit: emit/subscribe, ordering, history, error isolation|Vitest|
|VaultSync|Integration: mock fs (memfs), assert read/write/quarantine|Vitest + memfs|
|LLM Adapter|Unit: mock HTTP, assert prompt assembly, Circuit Breaker|Vitest + MSW|
|Vue Components|Component: mount with mock stores, assert render|Vitest + Vue Test Utils|
|Vue Components (visual)|Isolated component dev, visual regression, design system docs|Storybook|
|Localization|Unit: all locale keys resolve, no missing translations|Vitest|
|Economy|Integration: seed items/agents, run N ticks, assert prices|Vitest|
|**Emergence**|**Scenario: seed world, run N ticks, assert pattern**|**Custom harness (Vitest)**|

**Emergence tests:**

```typescript
test('hunger overrides quest pursuit', async () => {
  const world = createTestWorld();
  const food = world.addFoodSource({ x: 100, y: 100 });
  const agent = world.spawnAgent({
    needs: { hunger: 18, energy: 80, social: 60 },
    quest: testQuest,
  });
  world.runTicks(10);
  expect(agent.position).toBeNear(food.position);
});

test('mood cascade from breakdown', async () => {
  const world = createTestWorld();
  const a = world.spawnAgent({ mood: -70 }); // breakdown
  const b = world.spawnAgent({ mood: 40, nearAgent: a });
  world.runTicks(20);
  expect(b.mood).toBeLessThan(40); // negative interaction impact
});

test('supply chain produces bread from wheat', async () => {
  const world = createTestWorld();
  world.addFacility('farm', { recipe: 'recipe-wheat' });
  world.addFacility('mill', { recipe: 'recipe-flour' });
  world.addFacility('bakery', { recipe: 'recipe-bread' });
  world.spawnAgent({ job: 'farmer' });
  world.spawnAgent({ job: 'miller' });
  world.spawnAgent({ job: 'baker' });
  world.runTicks(100);
  expect(world.getItemCount('item-bread')).toBeGreaterThan(0);
});

test('circuit breaker falls back to template on LLM failure', async () => {
  const world = createTestWorld();
  world.mockLLM({ failAfter: 0 }); // all calls fail
  const agent = world.spawnAgent({ llm: { enabled: true } });
  const response = await world.triggerDialogue(agent, "Hello");
  expect(response.mode).toBe('template');
  expect(world.circuitBreaker.state).toBe('open');
});
```

### 17.3 Emergence Test Determinism

Emergence tests seed a world, run N ticks, and assert patterns. But BT decisions depend on mood + memory + perception which can vary. **Hybrid determinism strategy:**

**Simple emergence tests (fixed seed):** Tests that involve 1-2 agents with clear causal chains use a deterministic seeded RNG. All "random" decisions (gossip probability, crime opportunity, world events) consume from the seeded RNG. Same seed = same outcomes = fully reproducible. Examples: hunger overrides quest, supply chain produces bread, circuit breaker fallback.

**Complex emergence tests (statistical):** Tests involving multi-agent interactions (mood cascade, gossip chain, economic spiral) use statistical assertions. Run the scenario N times (default 10). Assert the pattern occurs > 80% of runs. Slower but realistic for scenarios with many interacting variables.

**Seeded RNG requirement:** All systems that use randomness MUST consume from an injectable `GameRNG` interface (seeded in tests, `Math.random` in production). This is an architectural constraint enforced at code review.

**Balance regression tests:** Golden-file emergence tests snapshot key aggregate metrics (average mood, total gold circulation, quest completion rate, trade volume) after N ticks with a fixed seed. On subsequent runs, assert metrics are within ±5% of the golden file. Detects unintended balance changes from parameter tweaks.

### 17.4 Content Volume Estimates

|Content Type|Vertical Slice|Full MVP (Phase 13)|
|---|---|---|
|Agent kinds|3 (merchant, laborer, guard)|6 (all)|
|Dialogue templates (per kind × mood bucket)|15 (3 × 5)|30 (6 × 5)|
|Items|10|25–30|
|Recipes|5|15–20|
|Jobs|3|16 (all product + service)|
|Species|0|3 (dog, cat, horse)|
|Traits|3 (unkillable, founder, resilient)|7 (all starter)|
|World events|0|8–10|
|Seasons|0|4|
|Scenarios|0|4|
|World templates|1 (Hamlet)|4|
|Chronicler templates|3 (tip, observation, daily)|8 (all report types)|
|Pre-built quests|3|10|
|Quest templates (agent-created)|2|5|
|Locations/regions|4|8–12|
|Locale: en|Required|Required|

### 17.5 Error Handling Summary

|Failure|Response|Recovery|
|---|---|---|
|Malformed vault file|Quarantine file, log warning, notify Director|Fix file externally → auto-resume on sync|
|Zod validation failure|Reject data, use defaults or suspend entity|Same as above|
|LLM timeout/error|Circuit Breaker → template fallback|Auto-retry after cooldown|
|File operation failure|Command compensation, retry queue|Auto-retry next tick|
|Trade step failure|Saga rollback (compensating actions)|Trade cancelled cleanly|
|System exception|Error boundary, skip system for this tick|Auto-retry next tick|
|Entity corruption|Entity suspended, notification|Fix underlying data → resume|

---

## 18 · Development Phases

|Phase|Scope|Exit Criteria|
|---|---|---|
|**0 — Foundation**|ECS, EventBus, Logger, Result type, Zod schemas, VaultSync (load-only), Trait schema + validation|Agents load from vault, events logged, invalid files quarantined, traits validated|
|**1 — Agent Core**|Components, NeedsDecay, Mood, Memory, basic BT (idle + needs + mood), TraitResolverSystem, mortality toggle, mortality with legacy|Agents wander, seek food/rest, experience mood shifts, traits modify behavior, agents can die and leave legacies|
|**2 — Spatial**|Map rendering, PerceptionSystem, movement, pathfinding|Agents move between locations, perceive entities|
|**3 — Social**|DialogueSystem (templates), RelationshipSystem (Canvas), Blackboard, gossip layer|Agents talk, form relationships, remember interactions, spread information|
|**4 — Items & Equipment**|Item system, equipment slots, durability, inventory|Agents carry, equip, use, and trade items|
|**5 — Economy**|Recipes, JobSystem, production, pricing, TradeSystem (Saga), Director treasury, tax system, monetary safeguards, welfare quests|Supply chains produce goods, agents trade, Director has resource management|
|**6 — Quests**|QuestEvaluation, Billboard, ToolExecution (Command), scenario system (goals, scoring, time limits)|Director creates quests, agents complete them, scenarios provide structured challenges|
|**── VERTICAL SLICE GATE ──**|**First playable build. Everything after enriches.**|**Exit criteria below.**|

|**7 — Property**|Land plots, ConstructionSystem, zoning|Agents buy land, build, zones constrain use|
|**8 — Director UI**|Vue panels, Pinia, split view, notifications, Chronicler panel, data dashboards, world builder, story curation tools, smart notifications|Full management interface with narrative and analytical layers|
|**9 — Persistence**|VaultSync (continuous bi-directional), retry queue|Changes persist, external edits sync|
|**10 — Animals**|Animal entities, instinct BT, bond system, species|Pets follow owners, instinct behaviors|
|**11 — LLM**|Unified adapter, Cursor, Circuit Breaker, personality|LLM-enhanced dialogue with resilient fallback|
|**12 — World Events**|WorldEventSystem, event definitions, manual triggers, seasonal cycles (4-season model)|Random events and seasonal rhythms create external pressure|
|**13 — Polish**|Emergence tests, debug overlays, balance, performance, crime layer, milestone tracking, full Chronicler narrator, biography generation|Complete emergence stack validated|

**Phase Acceptance Criteria (concrete test scenarios per phase):**

**Phase 0 — Foundation:**
- ExcaliburJS engine initializes in Obsidian plugin view, renders a test sprite
- EventBus emits and receives a typed event; history query returns it
- Logger writes structured output to console and vault file
- `Result.ok()` and `Result.err()` compose correctly through a 3-step chain
- Zod schema validates a well-formed agent file; rejects a malformed one; quarantines invalid
- VaultSync loads all markdown from a test vault directory into ECS entities
- Trait schema validates `trait-unkillable.md`; `TraitResolverSystem` builds modifier map

**Phase 1 — Agent Core:**
- Agent spawns with all components; needs/mood/memory initialized to defaults
- NeedsDecaySystem: hunger decrements by expected rate per tick; HT modifier applied correctly
- MoodSystem: mood recalculates from all 7 factors + external modifiers (trait, time-of-day)
- MemorySystem: entry decays in significance per tick; pruned below threshold 1
- BT: agent with critical hunger selects "seek food"; agent with mood < -60 selects breakdown behavior
- TraitResolverSystem: agent with "resilient" trait has halved need decay vs. default agent
- Mortality (on): agent at hunger=0 for 50 ticks collapses; at 150 ticks dies; heir inherits property
- Mortality (off): same agent collapses but never dies; remains until rescued

**Phase 2 — Spatial:**
- Agent moves from region A to region B; stamina decremented by destination's travel_cost
- PerceptionSystem: agent perceives entities within IQ×20px by day; IQ×10px at night
- DayNightSystem: timeOfDay transitions dawn→day→dusk→night at correct tick boundaries
- Collision: two agents cannot occupy the same pixel position; pathfinding routes around

**Phase 3 — Social:**
- Two agents converse; MemoryEvent generated for both; disposition updated on Canvas graph
- Gossip: agent A shares price info with B; B's gossip memory has reliability 0.7
- Template dialogue: correct template selected by kind + mood bucket

**Phase 4 — Items & Equipment:**
- Agent picks up item; inventory weight checked against carry capacity
- Agent equips item; attribute bonus applied; durability decrements per active tick
- Item at durability 0 breaks; bonus removed; ItemBroken event emitted

**Phase 5 — Economy:**
- Full supply chain: farm→mill→bakery→shop produces and sells bread
- Agent pays gold; facility operating fund receives revenue; worker receives wage
- Treasury receives 5% tax; Director posts quest funded from treasury
- Welfare quest: agent below 10 gold receives and completes Chronicler quest

**Phase 6 — Quests:**
- Director creates quest via UI; appears on billboard; agent evaluates, accepts, completes, receives reward
- Agent-created quest: facility owner posts supply quest when stock low
- Scenario: load template; goals tracked; score calculated on completion/timeout

**Vertical Slice Gate — Exit Criteria:**

The Vertical Slice is the first playable build. It proves the emergence thesis and delivers a complete Director experience loop:

- 5 agents with distinct kinds, each with needs/mood/memory/BT making autonomous decisions
- 1 complete supply chain operational: farm → mill → bakery → shop
- At least 3 job types staffed and producing/serving
- Director can create and post a quest; an agent evaluates, accepts, and completes it
- Director treasury receives tax from trades, funds quest rewards
- Basic split-view UI: world map (agents moving between regions), agent list panel, quest panel
- Chronicler provides onboarding tips and tick observations
- Gossip exchanges information between agents during social interactions
- VaultSync persists world state between sessions (close Obsidian, reopen, world intact)
- 3 emergence validation scenarios pass as automated Vitest tests
- Performance: tick time < 100ms with 5 agents (headroom for scaling)

**Post-MVP Roadmap:**

- Agent Aging / Generational play (mortality and legacy are MVP; aging is post-MVP)
- Factions / Guilds (Canvas-backed groups, shared wallets, collective goals)
- Contextual Reputation tags per domain (`reputation.trading`, `reputation.combat`, `reputation.honesty`) — deeper than global gossip
- Research / Technology tree (XP/gold invested in library unlocks new recipes, buildings, skill categories)
- Weather / Environmental effects (seasons are MVP; dynamic weather is post-MVP)
- Audio design (ambient soundscapes, event stings, adaptive music)
- Game Plugin Architecture (custom BT nodes and system hooks registered at startup for deep extensibility — the vault already supports data-level modding via markdown files)
- Multiplayer / World sharing
- Building upgrades & specialization
- Transportation system (carts, roads, pack animals)
- Political / governance emergence (leadership roles, voting, community laws)

---

## 19 · Director Progression & Motivation

The Director's engagement operates on three interlocking layers.

### 19.1 Layer 1 — Scenarios

Pre-designed challenges with specific goals and constraints. Each scenario is a world template with attached victory conditions (Zod-validated):

```yaml
---
id: scenario-market-district
name: "The Market District"
difficulty: medium
template: market-town
goals:
  - id: goal-5-shops
    description: "5 operational shops with positive revenue"
    metric: buildings.shops.profitable
    target: 5
  - id: goal-avg-mood
    description: "Average agent mood above 30"
    metric: agents.mood.average
    target: 30
time_limit_days: 60
scoring:
  time_bonus: true
  mood_bonus: true
  economy_bonus: true
constraints:
  treasury_start: 500
  mortality: true
  max_director_agents: 3
---
```

Scenarios are scored bronze/silver/gold on efficiency (time, mood, economy). On completion or timeout, the world continues in sandbox mode. The Chronicler narrates the outcome.

### 19.2 Layer 2 — Emergent Milestones

The game tracks and celebrates emergent achievements as they occur organically:

|Category|Examples|
|---|---|
|Economic|"First supply chain operational," "Total trade volume exceeds 1000 gold"|
|Social|"First friendship formed," "First gossip chain (3+ agents)"|
|Property|"First building constructed," "All land plots claimed"|
|Population|"10 agents thriving," "First agent death — legacy recorded"|
|Survival|"Survived first winter," "Agent rescued from starvation"|

Milestones are recognized via Chronicler narration and a persistent milestone log.

### 19.3 Layer 3 — Story Curation

Tools for building a narrative artifact from the world's history: bookmark moments, name eras, export agent biographies (auto-generated from memory + relationships + career), view a world timeline, and read Chronicler chapter summaries. All story data persisted in `chronicles/`. Agent biographies and death eulogies in `legacy/`.

---

## 20 · Economy Bootstrap & Monetary Policy

### 20.1 Two-Layer Economy

**Agent Economy (self-sustaining loop).** Facilities generate revenue from customers. Owners pay worker wages from revenue. Agents spend wages on goods/services. Each agent spawns with a starting stipend (default 100 gold). Facilities start with initial stock and a small operating fund.

**Director Economy (meta-layer).** The Director has a treasury, separate from agent gold. Income: configurable tax rate (default 5%) on every trade. Expenses: quest rewards, object placement, agent creation fees. Investing in the world stimulates the agent economy, generating more tax revenue.

### 20.2 Monetary Safeguards

|Mechanism|Type|Description|
|---|---|---|
|Welfare quests|Gold floor|Agents below 10 gold receive Chronicler-posted tasks (15–25 gold reward, directly assigned, max 3 active)|
|Price clamping|Inflation guard|Prices clamped between 0.5× and 3.0× base value|
|Land purchases|Gold sink|Removes gold from circulation|
|Construction costs|Gold sink|Material purchases consume gold|
|Equipment repairs|Gold sink|Service fees for durability restoration|
|Director quest rewards|Gold faucet|Treasury gold enters agent circulation|
|Initial stipends|Gold faucet|New agents inject gold on spawn|
|Merchant caravans|Gold faucet|World events introduce external gold|

### 20.3 Death Spiral Recovery (Three-Layer Safety Net)

The economy can enter a death spiral: no production → no trade → no tax → empty treasury → no stimulus. Three mechanisms prevent unrecoverable collapse, each addressing a different severity:

**Layer 1 — Minimum Treasury Regeneration.** The Director's treasury regenerates at a minimum rate (default: 1 gold/day, configurable in `game-config.json` as `economy.treasury_regen_per_day`) even with zero trade activity. This prevents total lockout — the Director always slowly accumulates budget for free actions.

**Layer 2 — Guaranteed Recovery Events.** When total gold circulation drops below a configurable floor (default: 50 gold per agent, `economy.circulation_floor_per_agent`), the `WorldEventSystem` guarantees a "Merchant Caravan" event on the next evaluation cycle. The caravan injects external gold and goods into the economy. Not probabilistic — guaranteed. Acts as an economic circuit breaker.

**Layer 3 — Director Loans.** The treasury can go negative (loan). Interest accrues: 1% of outstanding debt per day (configurable). The Director uses loans for aggressive economic recovery — posting high-reward quests, placing infrastructure, spawning workers. The debt must be repaid from future tax revenue. Chronicler warns when debt exceeds configurable threshold.

**Free Director Actions (treasury = 0):** Zone designation, quest posting with 0 reward, talk to agents, place free objects (billboard, bench), adjust speed, inspect panels, story curation, remove own objects. These are always available regardless of treasury balance.

### 20.4 World Health & Rubber-Banding

A **World Health Score** is calculated by the `ChroniclerSystem` each day as a composite of: average agent mood (40%), economic velocity (trade volume / agent count, 30%), and population stability (alive agents / peak agents, 30%). Range 0–100.

World Health subtly influences `WorldEventSystem` probabilities via a configurable table in `game-config.json`:

```json
"world_health": {
  "tiers": [
    { "name": "critical", "max": 20, "positive_event_multiplier": 2.0, "negative_event_multiplier": 0.3 },
    { "name": "struggling", "max": 40, "positive_event_multiplier": 1.5, "negative_event_multiplier": 0.6 },
    { "name": "stable", "max": 60, "positive_event_multiplier": 1.0, "negative_event_multiplier": 1.0 },
    { "name": "thriving", "max": 80, "positive_event_multiplier": 0.8, "negative_event_multiplier": 1.3 },
    { "name": "booming", "max": 100, "positive_event_multiplier": 0.6, "negative_event_multiplier": 1.5 }
  ]
}
```

The score is visible in the Debug panel but NOT in normal play. The Director feels the world responding without seeing the number. World events are tagged `positive` or `negative` in their schema for this classification.

---

## 21 · The Chronicler

A special entity (kind: `chronicler`) that observes but does not participate. No needs, no wallet, no job, no BT, no mortality. One per world, cannot be deleted. All operations return `Result<T, GameError>`.

### 21.1 Onboarding Role

Contextual tips triggered by world state (not a fixed script): "Your agents are hungry — try placing a farm." Fades after Director demonstrates competence. Dismissable.

### 21.2 Narrator Role

|Output|Frequency|Content|
|---|---|---|
|Tick observations|Real-time|Notable events: "Elena bought Plot 7"|
|Daily digest|End of day|Spawns/deaths, quests, economic snapshot, mood distribution|
|Seasonal report|End of season|Patterns, achievements, supply chain health, relationship shifts|
|Decline warnings|As detected|"Food production dropping for 3 consecutive days"|
|Pre-season warnings|End of each season|"Autumn is ending. Food stockpile is low — winter will be hard."|

Template-based by default, LLM-enhanced when available (Circuit Breaker protected).

### 21.3 Historian Role

Records agent biographies, era names, death eulogies, chapter summaries, milestone narrations. Output persisted in `chronicles/` and `legacy/`.

---

## 22 · Agent Lifecycle

### 22.1 Entering the World — Director-Spawned

**Manual creation:** Pick kind → set name/attributes → assign traits → place on map. Cost: `agent_creation.base_cost + sum(ST+DX+IQ+HT) × agent_creation.cost_per_attribute_point` from treasury (defaults: 50 base + 5 per point = 250 gold for a default-10s agent). Configurable in `game-config.json`.

**Candidate pool:** 3–5 pre-rolled candidates. Refreshes every 5 days. Discounted creation fee. **Mixed generation:** the first 2 candidates are weighted toward world needs (checks job vacancies, unfilled facility roles, missing skill coverage). The remaining 1–3 are pure random — guaranteeing useful options while preserving variety and surprise.

### 22.2 Mortality with Legacy

**Global toggle:** `mortality: true | false` in `game-config.json`. Default: `true`. When off, agents collapse but never die.

|Cause|Condition|Grace Period|
|---|---|---|
|Starvation|Hunger = 0|Collapse after 50 ticks, death after 100 more if not rescued|
|Despair|Mood < -60 continuously|Death after 200 consecutive ticks in breakdown|
|Quest danger|Failed quest tagged `dangerous`|Configurable mortality chance (default 10%)|

**No random death, no combat death, no aging death.** Every death traces to causes the Director could have prevented.

### 22.3 Legacy System

On death: (1) property passes to highest-disposition agent or reverts to unclaimed, (2) heir receives wallet and inventory, (3) all related agents receive high-significance `agent_died` memory with mood impact, (4) Chronicler generates eulogy/biography in `legacy/`, (5) deceased remains as ghost node in relationship Canvas.

---

## 23 · Data-Driven Trait System

Traits are markdown files in `config/traits/` with Zod-validated frontmatter:

```yaml
---
id: trait-unkillable
name: "Unkillable"
description: "This agent cannot die. They collapse and auto-recover."
category: survival
effects:
  - system: MortalityCheck
    modifier: { prevent_death: true, auto_recover_ticks: 150 }
assignable_by: director
stackable: false
conflicts_with: []
---
```

**Properties:** `category` (survival | social | economic | work | special), `effects` (system/modifier pairs), `assignable_by` (director | definition | milestone | inherited), `stackable`, `conflicts_with`.

**Trait modifier resolution:** `TraitResolverSystem` (tick position 0.5) builds per-entity modifier map. Downstream systems check by name. Resolution order: traits → seasons → world events → time-of-day. Conflicts return `Result.err` and emit `TraitConflictDetected`.

**Modifier stacking semantics:**
- **Rate modifiers** (production_rate, decay modifiers, recovery rates) are **multiplicative**. Applied in pipeline order. Example: trait `production_rate: 1.5` × winter `production_rate: 0.5` = 0.75 (net 25% penalty).
- **Flat modifiers** (mood_delta, gold bonuses, skill_bonus) are **additive**. Example: trait `mood_delta: +5` + winter `mood_delta: -5` = 0.
- **System invariant:** After all modifiers are applied, rate values are clamped to `[0.0, ∞)` — no negative rates. Flat mood modifiers are capped at ±30 total to ensure base mood factors remain meaningful.

The Zod schema for trait/season/event effects validates `system` against an enum of known system names. Each system documents its accepted modifier keys.

**Starter traits:** unkillable, resilient, silver-tongue, frugal, workaholic, loner, founder.

---

## 24 · World Creation & Initial Setup

### 24.1 Templates

|Template|Agents|Buildings|Focus|
|---|---|---|---|
|"Hamlet"|5|Farm, shop, 2 homes|Gentle intro, growth-focused|
|"Market Town"|12|Multiple shops, tavern, clinic, forge|Trade & social dynamics|
|"Frontier Post"|4|Basic shelter, well|Survival, build from nothing|
|"Prosperous Village"|20|Full economy, school, guard post|Late-game sandbox|

### 24.2 World Builder

Wizard: (1) Map size/terrain, (2) Starting agents, (3) Starting buildings, (4) Conditions (season, treasury, difficulty), (5) Traits & rules (mortality toggle, global config). Custom worlds saveable as templates in `templates/`.

### 24.3 Scenarios

Templates with goals and constraints (see §19.1). Dedicated menu, scored on completion.

---

## 25 · Information Presentation

### 25.1 Chronicler Panel

Dedicated management panel tab. All Chronicler output: tick observations, daily digests, seasonal reports, decline warnings, milestone announcements. Searchable and filterable.

### 25.2 Data Dashboards

|Dashboard|Location|Shows|
|---|---|---|
|Mood heatmap|World map overlay (ExcaliburJS layer)|Color-coded zones by average agent mood|
|Economic activity|World map overlay|Trade volume hotspots, gold flow|
|Supply chain status|Economy panel|Raw → processed → finished flow, bottlenecks|
|Price history|Economy panel|Line charts by item category over time|
|Population stats|Agents panel|Mood distribution, needs averages, employment rate|
|Treasury ledger|Director toolbar|Income/expense breakdown, balance trend|

### 25.3 Smart Notifications

Enhancements: grouping (related alerts collapse), snooze (per category), follow (click → select entity + open panel).

---

## 26 · Failure States & Tension

**Soft failure model.** No game-over. Sandbox worlds always continue. If all agents die, the world enters "Abandoned" state — the Chronicler writes a final chapter, the Director can rebuild in the same world with history intact.

**Scenarios:** Time limits produce "incomplete" (not "failed"). Score breakdown shown. World continues in sandbox mode. Bronze/silver/gold ratings for replayability.

**Tension sources:** Agent mortality (permanent, emotionally impactful), economic pressure (seasonal scarcity, events), cascading mood (breakdown ripples through social graph), scenario time pressure, Chronicler accountability (records everything).

---

## 27 · Crime, Gossip & Antisocial Behavior

### 27.1 Gossip (Always Active)

Information spreads during social interactions: price gossip, reputation gossip, opportunity gossip. **Tier-based reliability:** `[1.0, 0.7, 0.5, 0.3]` — four fixed tiers by hop count. After 4 retellings, gossip is too unreliable to spread further (agents with IQ > 12 ignore reliability < 0.3). IQ affects reliability weighting. Stored as memory entries (type `gossip`), decays via MemorySystem. Reliability and significance are independent. Reputation becomes contextual — a network of perceptions, not a global number.

### 27.2 Crime (Extreme Conditions Only)

Triggers when ALL conditions met: critical need (hunger < 20 OR energy < 15, matching §4.4 thresholds), mood <= -20, opportunity (unguarded target, no witnesses in perception range).

|Crime|Effect|Evidence|
|---|---|---|
|Theft|Takes item without paying|Witnesses + victim remember|
|Trespass|Enters private building to rest|Owner's disposition drops|
|Vandalism|Damages object during breakdown|Witnesses remember, repair needed|

Consequences are emergent: witnesses gossip, guards respond, victims refuse future trades. No formal justice system — communities with guards have consequences, communities without don't.

---

## 28 · Seasonal Cycles

Four seasons, each 15 days (60 days per year). Data-driven definitions in `config/seasons/` (Zod-validated):

|Season|Production|Energy Decay|Mood|Key Dynamics|
|---|---|---|---|---|
|Spring|Farms +20%|Normal|+3|Planting, caravans|
|Summer|Farms +50%, others +10%|+10% (heat)|+5|Festivals, drought risk|
|Autumn|Farms +30% (harvest)|Normal|Neutral|Harvest surplus, preparation|
|Winter|Farms -50%, outdoor -20%|+30% (cold)|-5|Cold snaps, scarcity, indoor social|

Season transitions emit `SeasonChanged`. Chronicler narrates each transition. Director plans infrastructure and recruitment around the calendar.

**Season-event interaction:** Season `event_weights` are applied as **multipliers** to each world event's base `probability` during WorldEventSystem evaluation. Example: drought has base probability 0.05. In summer, `event-drought: 0.5` (in event_weights) means effective probability = 0.05 × 0.5 = 0.025. Omitted events use multiplier 1.0 (unchanged). This allows seasons to make certain events more or less likely without overriding the event's own definition.

**Weather weights** in the season schema are a **post-MVP placeholder**. No WeatherSystem exists in the current tick cycle. The field is reserved for future dynamic weather implementation but is not consumed by any MVP system.

---

## 29 · Platform: Obsidian Plugin

Project Meridian is implemented as an **Obsidian plugin**. The Obsidian vault _is_ the game world — markdown files are entities, Canvas files are relationship graphs, JSON files are configuration. The plugin renders the game world within Obsidian, leveraging the vault as both persistence layer and content-authoring tool.

**Key implications:**
- The Director can inspect and edit any game entity by opening its markdown file directly in Obsidian.
- The Chronicler's output (chronicles, biographies) is browsable as normal Obsidian notes, linkable and searchable.
- Relationship graphs are viewable in Obsidian's native Canvas view.
- The game UI (world map, management panels) renders in a custom Obsidian view (leaf) using ExcaliburJS + Vue.
- VaultSync leverages Obsidian's file system APIs for read/write/watch.
- Plugin settings map to `game-config.json`.

**Vault Versioning & Migration:**

The vault is the save file. Schema changes between plugin versions must not break existing worlds.

- **Vault version file:** `vault-version.json` at vault root (`{ "version": "1.0.0" }`). Plugin compares vault version to expected version on startup.
- **Schema tolerance:** All Zod schemas use `.default()` and `.optional()` for new fields. Missing fields get sensible defaults. Most version bumps need no migration — additive changes just work.
- **Migration scripts:** For breaking changes (renames, removals, structural changes), migration scripts run sequentially (`migrations/v1-to-v2.ts`, `v2-to-v3.ts`). Each migration reads affected files, transforms frontmatter, writes updated files. Vault version updated after successful migration.
- **Backup:** Automatic vault backup created before any migration runs.
- **Validation:** After migration, full Zod validation pass confirms all files are valid against the new schemas.

---

## 30 · ExcaliburJS Integration Architecture

This section maps every GDD system to ExcaliburJS v0.32+ capabilities, clarifying what is built-in vs. custom.

### 30.1 Entity Mapping

All game entities are ExcaliburJS types:

|GDD Entity|ExcaliburJS Type|What You Get For Free|Custom Components|
|---|---|---|---|
|Agent|`Actor` subclass|Position, velocity, collision, pointer events (click-to-select), sprite rendering, actions API, lifecycle hooks|NeedsComponent, MoodComponent, MemoryComponent, SkillsComponent, WalletComponent, GoalsComponent, TraitsComponent, InventoryComponent, EquipmentComponent, QuestLogComponent, JobAssignmentComponent, PropertyComponent, BrainStateComponent, DialogueConfigComponent|
|Animal|`Actor` subclass|Position, velocity, collision, sprite, actions, lifecycle|AnimalStatsComponent, AnimalNeedsComponent, InstinctComponent, BondComponent|
|WorldObject|`Actor` subclass|Position, collision (interaction radius), sprite, pointer events|ObjectTypeComponent, ObjectInteractionComponent, ObjectInventoryComponent, ObjectStateComponent, OwnershipComponent|
|Chronicler|`Entity` (no Actor — no visual presence)|ECS component container, system processing|ChroniclerStateComponent|
|Region|`Actor` with `CollisionType.Passive`|Boundary trigger zone (enter/exit events), visual bounds|RegionDataComponent (connections, travel_cost, rest_tier)|
|Zone|`Actor` with `CollisionType.PreventCollision`|Visual overlay rendering|ZoneTypeComponent|
|Land Plot|`Actor` subclass|Position, pointer events (click to inspect), visual bounds|PlotDataComponent (owner, price, building, zone)|

### 30.2 System Mapping

|GDD System|ExcaliburJS Built-In|Custom Work Needed|
|---|---|---|
|**ECS Framework**|Full: Entity, Component, System, World, Query, EntityManager, QueryManager|None — use ExcaliburJS ECS directly. Register custom systems via `World.add(system)`. System execution order via `SystemPriority`.|
|**Tick Cycle**|Engine update loop with fixed timestep accumulator (§2.1)|Tick accumulator logic. All GDD systems are ExcaliburJS `System` subclasses with priority ordering.|
|**MovementSystem**|Actions API: `actor.actions.moveTo(pos, speed)` with easing and chaining. Interrupt via `actor.actions.clearActions()`.|Thin coordinator: BT writes destination → system chains `.moveTo()` actions for multi-hop paths. Region transitions use ExcaliburJS trigger zones (see below).|
|**PerceptionSystem**|`SparseHashGrid` broadphase collision. Sensor colliders (circular, `CollisionType.Passive`).|Each agent gets a `PerceptionCollider` — a passive circle sized to IQ × 20px (IQ × 10px at night). Overlapping entities are the agent's perceived world. DayNightSystem resizes the collider. Results written to Blackboard.|
|**Collision**|Full: broadphase (SparseHashGrid), narrowphase, collision types (Active/Fixed/Passive), collision groups, collision events.|Set agents as `CollisionType.Active`. Buildings/walls as `CollisionType.Fixed`. Region boundaries as passive triggers. Agent-agent collision handled automatically.|
|**Region Transitions**|Trigger zones: `Actor` with `CollisionType.Passive` at region boundaries. `collisionstart` event fires on entry.|When agent enters a region trigger zone: deduct stamina, update `current_region`, emit `RegionEntered`. No manual position checking.|
|**Camera**|Full: follow strategies (lockToActor, elasticToActor, radiusAroundActor), zoom with easing, pan, shake, bounds limiting.|Configure strategies: follow selected agent, zoom via UI controls, pan via drag, limit to world bounds. Minimap via second camera to offscreen canvas.|
|**EventBus**|Typed `EventEmitter` on every ExcaliburJS object. Global `EventDispatcher` possible.|Extend with: priority handler ordering, event history (ring buffer), inter-system batching. Foundation is free.|
|**Timers (periodic systems)**|`scene.createTimer({ interval, repeating, callback })` synced to game clock. Respects pause.|Replace `if (tick % N === 0)` checks. Economy recalculation, world event evaluation, status evaluation, canvas checkpoint — all as ExcaliburJS timers. Pause-and-plan works automatically.|
|**Input Handling**|Keyboard (isPressed, wasPressed), pointer (click, hover, drag on actors), gamepad.|Director interactions: click agent to select (Actor pointer events), keyboard shortcuts for speed/pause, pointer for zone painting and object placement.|
|**Graphics**|Sprite, SpriteSheet, Animation, GraphicsGroup, Text, Circle, Rectangle, Polygon, Canvas. WebGL + Canvas 2D fallback. Z-index ordering.|Agent sprites, mood halos (Circle overlay), needs bars (Rectangle), BT labels (Text), zone overlays (Polygon fill), region boundaries (Rectangle outline). Use `GraphicsGroup` for composite agent visuals (sprite + mood halo + name label).|
|**Scene Management**|Scene lifecycle (onActivate, onDeactivate, onInitialize), transitions, data passing.|Main menu scene → World Builder scene → Gameplay scene. Scenario loading passes data via scene context.|
|**Debug**|`engine.isDebug` for collision/broadphase visualization. Chrome DevTools extension for live entity inspection and per-system execution time.|Use built-in for: collision shapes, broadphase grid, system timing. Build custom for: mood halos, BT labels, relationship lines, economic heatmaps, Blackboard inspector.|
|**Asset Loading**|`Loader` with `ImageSource`, progressive loading, scene-specific `onPreLoad()`.|Load agent sprites, tile textures, UI assets. Scene-specific loading for template worlds.|

### 30.3 What We Build vs. What ExcaliburJS Provides

**ExcaliburJS provides (don't build these):**
- ECS framework (Entity, Component, System, World, Query)
- Actor lifecycle (spawn, update, destroy)
- Position, velocity, movement execution
- Collision detection and response (SparseHashGrid broadphase)
- Trigger zones for region boundaries
- Camera follow/zoom/pan/shake/bounds
- Typed event system (EventEmitter)
- Game-synced timers (respect pause)
- Input handling (keyboard, pointer, gamepad)
- Sprite rendering, animation, text, shapes (WebGL + Canvas fallback)
- Scene management with transitions
- Debug visualization + Chrome DevTools
- Asset loading pipeline

**We build (game-specific, on top of ExcaliburJS):**
- All custom components (Needs, Mood, Memory, Skills, Wallet, Goals, Traits, etc.)
- All simulation systems (NeedsDecay, Mood, Memory, BT, Job, Quest, Trade, Economy, etc.)
- Behavior Tree integration (mistreevous + Blackboard pattern)
- Modifier pipeline (TraitResolver → Season → WorldEvent → DayNight composition)
- VaultSync (Obsidian file system ↔ ECS bidirectional sync)
- Zod validation pipeline (schema → validate → ECS component)
- Vue management sidebar (Pinia stores bridged from ECS)
- Chronicler system (observation, narration, reports)
- All game-specific UI (management panel, dashboards, story tools)
- LLM adapter + Circuit Breaker
- Error recovery (Result types, Sagas, Commands, entity suspension)
- Localization layer

### 30.4 Key Integration Patterns

**Agent as Actor:**
```typescript
class AgentActor extends ex.Actor {
  // ExcaliburJS provides: position, velocity, collision, graphics, pointer events, actions
  // We add: game-specific components
  constructor(config: AgentConfig) {
    super({ pos: config.position, width: 32, height: 32, collisionType: ex.CollisionType.Active });
    this.addComponent(new NeedsComponent(config.needs));
    this.addComponent(new MoodComponent());
    this.addComponent(new MemoryComponent());
    this.addComponent(new WalletComponent(config.wallet));
    // ... all custom components
  }
}
```

**Region as Trigger Zone:**
```typescript
class RegionBoundary extends ex.Actor {
  constructor(region: RegionData) {
    super({ pos: region.position, width: region.bounds.width, height: region.bounds.height,
            collisionType: ex.CollisionType.Passive });
    this.on('collisionstart', (evt) => {
      if (evt.other instanceof AgentActor) {
        deductStamina(evt.other, region.travel_cost);
        updateCurrentRegion(evt.other, region.id);
        eventBus.emit({ type: 'RegionEntered', agent: evt.other.id, region: region.id });
      }
    });
  }
}
```

**Perception as Sensor Collider:**
```typescript
// Perception radius as a passive circle collider on the agent
const perceptionCollider = new ex.Circle({ radius: agent.iq * perceptionMultiplier });
agent.addChild(new ex.Actor({
  collisionType: ex.CollisionType.Passive,
  collider: perceptionCollider,
  collisionGroup: perceptionGroup  // only collides with other agents/objects
}));
```

**Movement via Actions API:**
```typescript
// Multi-hop journey: BT decides destination, Actions API executes
const path = spatialQuery.findPath(agent.currentRegion, destinationRegion); // A* via plugin
for (const hop of path) {
  agent.actions.moveTo(hop.entryPoint, agent.moveSpeed);
  agent.actions.callMethod(() => deductStamina(agent, hop.travelCost));
}
// Interruption: if BT priority changes next tick
agent.actions.clearActions(); // cancel journey
```

**Periodic System via Timer:**
```typescript
// Economy recalculation every 10 ticks — respects pause automatically
scene.createTimer({
  interval: gameConfig.tick_interval_ms * gameConfig.economy.recalculation_interval_ticks,
  repeating: true,
  callback: () => economySystem.recalculate()
});
```

### 30.5 Pathfinding

ExcaliburJS does not include A* natively. Use the official `@excaliburjs/plugin-pathfinding` package:
- Supports A* and Dijkstra
- Can build graph from region connections (macro pathfinding)
- Can build grid from tilemap (micro pathfinding within regions)
- Single npm dependency, maintained by the ExcaliburJS team

---

## 31 · Localization (Multilang)

### 30.1 Architecture

All player-facing text passes through a localization layer. The active locale is set in `game-config.json` (`locale: "en"`). Default locale: `en`. Fallback: if a key is missing in the active locale, the English string is used.

**Hybrid storage model:**

|Content Type|Storage|Lookup|
|---|---|---|
|UI labels, button text, menu items|`config/locales/{locale}.json`|Key-based: `i18n.t("ui.toolbar.pause")`|
|Notification templates|`config/locales/{locale}.json`|Key-based with variable substitution: `"{agentName} completed '{questTitle}'"`|
|Item, trait, job, recipe, species, season, kind, zone display names|`config/locales/{locale}.json`|ID-based: `i18n.name("item-bread")` → locale lookup by entity ID|
|Mood bucket names, status labels, event type names|`config/locales/{locale}.json`|Key-based|
|Dialogue templates|`config/templates/dialogue/{locale}/{kind}/{mood_bucket}.md`|Folder-based per locale|
|Chronicler report templates|`config/templates/chronicler/{locale}/daily.md`, `seasonal.md`, etc.|Folder-based per locale|
|Scenario descriptions, goal descriptions|`config/locales/{locale}.json`|ID-based|

### 30.2 JSON Locale File Structure

```json
{
  "locale": "de",
  "ui": {
    "toolbar": {
      "pause": "Pause",
      "play": "Abspielen",
      "fast": "Schnell",
      "tick": "Tick",
      "day": "Tag",
      "agents": "Agenten",
      "alerts": "Warnungen"
    },
    "panels": {
      "agents": "Agenten",
      "quests": "Aufträge",
      "jobs": "Berufe",
      "economy": "Wirtschaft",
      "config": "Einstellungen",
      "events": "Ereignisse",
      "dialogue": "Dialog",
      "chronicler": "Chronist"
    }
  },
  "notifications": {
    "MoodBreakdown": "{agentName} hat einen Zusammenbruch!",
    "QuestCompleted": "{agentName} hat '{questTitle}' abgeschlossen",
    "WorldEventStarted": "Weltereignis: {eventName}",
    "SeasonChanged": "{seasonName} ist angebrochen."
  },
  "entities": {
    "item-bread": { "name": "Brot", "description": "Ein frisches Brot. Stillt den Hunger." },
    "trait-unkillable": { "name": "Unsterblich", "description": "Dieser Agent kann nicht sterben." },
    "season-winter": { "name": "Winter", "description": "Kälte und Knappheit." },
    "job-baker": { "name": "Bäcker" },
    "kind-merchant": { "name": "Händler" }
  },
  "mood_buckets": {
    "elated": "Begeistert",
    "content": "Zufrieden",
    "stressed": "Gestresst",
    "distressed": "Verzweifelt",
    "breakdown": "Zusammenbruch"
  }
}
```

### 30.3 Dialogue & Chronicler Templates

Long-form narrative content uses folder-based locale separation:

```
config/templates/
├── dialogue/
│   ├── en/
│   │   ├── merchant/
│   │   │   ├── elated.md
│   │   │   ├── content.md
│   │   │   ├── stressed.md
│   │   │   └── ...
│   │   └── ...
│   └── de/
│       ├── merchant/
│       │   ├── elated.md
│       │   └── ...
│       └── ...
└── chronicler/
    ├── en/
    │   ├── daily.md
    │   ├── seasonal.md
    │   ├── milestone.md
    │   ├── eulogy.md
    │   └── decline-warning.md
    └── de/
        ├── daily.md
        └── ...
```

Templates use the same variable substitution (`{agentName}`, `{questTitle}`, `{seasonName}`). Variables are resolved after locale selection — entity names in variables are also localized via the JSON lookup.

### 30.4 LLM-Aware Localization

When LLM dialogue is active, the locale affects prompt assembly:

- The system prompt prepends a language directive: `"Always respond in German (Deutsch)."`
- Agent personality prompts are stored per locale in the agent's frontmatter or use a locale-specific override file.
- The Chronicler's LLM-enhanced reports receive the same language directive.
- LLM responses are not post-processed — the language directive is trusted. If the LLM responds in the wrong language, it falls through to template fallback (which is correctly localized).

```yaml
# Agent frontmatter — LLM personality per locale
llm:
  enabled: true
  provider: cursor
  personality:
    en: >
      You are Elena Vasquez, a shrewd but fair merchant.
    de: >
      Du bist Elena Vasquez, eine gerissene aber faire Händlerin.
  temperature: 0.7
  max_tokens: 150
```

### 30.5 Director-Created Content

Content created by the Director (agent names, quest titles, era names, bookmarks) is **not auto-translated**. It remains in whatever language the Director writes. This is intentional — the Director's creative input is part of the story curation experience.

### 30.6 Implementation Notes

- Vue UI uses `vue-i18n` for reactive locale switching (no reload required).
- Game systems use a lightweight `i18n.t(key)` / `i18n.name(entityId)` function imported from infrastructure.
- Locale switch emits `LocaleChanged` event. UIBridgeSystem refreshes all display strings.
- Shipping locales: `en` (default). Additional locales are community-contributable — adding a locale requires: one JSON file + dialogue template folder + chronicler template folder.
- Zod schemas validate canonical IDs (English). Display names are resolved at render time, never stored in ECS components.

---

## 32 · Debug Mode & Performance Profiling

### 32.1 Debug Mode

Toggled via toolbar button or keyboard shortcut. Individual overlay categories toggled independently. Debug state is a Director preference, not persisted to the vault. All debug instrumentation is zero-cost when off — systems are wrapped in conditional timing decorators.

**Agent Overlays (per-entity or global toggle):**

|Overlay|Visualization|
|---|---|
|Perception radius|Circle around agent (blue = day, dim = night)|
|Needs bars|Floating bars above agent: hunger (red), energy (yellow), social (blue), stamina (green)|
|Mood indicator|Colored halo: green (elated) → yellow (content) → orange (stressed) → red (distressed) → black pulse (breakdown)|
|BT active node|Text label showing current priority: "Survival: seeking food", "Job Duty: baking", "Crime: stealing"|
|Pathfinding|Line from agent to destination (region path + local target)|
|Memory count|Badge showing active memory entries|
|Relationship lines|Lines to nearby agents colored by disposition (green = positive, red = negative, thickness = familiarity)|
|Trait badges|Small icons/tags for active traits|

**World Overlays (global toggles):**

|Overlay|Visualization|
|---|---|
|Region boundaries|Outlined rectangles with name and connection lines between regions|
|Zone coloring|Semi-transparent fill per zone type (green = residential, blue = commercial, brown = agricultural, grey = industrial, white = public)|
|Hop distances|Numbers on connection lines showing hop count|
|Time-of-day indicator|Screen tint or border color for dawn/day/dusk/night|
|Season modifiers|Active modifier values beside the season indicator|

**Economy & System Overlays:**

|Overlay|Visualization|
|---|---|
|Facility operating fund|Number above each facility showing current fund balance|
|Item flow|Animated dots along supply chain connections (raw → processed → finished)|
|Price tags|Floating price labels on shops/carts with scarcity multiplier|
|Event radius|Highlighted area affected by active world events|
|Gossip spread|Temporary lines between agents when gossip exchanged, color = type|
|Crime opportunity|Red tint on unguarded objects visible to distressed agents|

**Debug Panel (management UI tab):**

- **Modifier stack inspector:** For selected entity, lists all active modifiers (traits, season, world events, time-of-day) with their values and sources.
- **Blackboard inspector:** Raw Blackboard values for selected agent, updated per tick.
- **Entity count by type:** Agents, animals, objects, buildings, plots.
- **Event throughput:** Events/tick, breakdown by type.
- **Circuit breaker status:** Current state, failure count, cooldown remaining.

### 32.2 Performance Profiling

**Per-Tick System Profiling:**

|Metric|Measures|Display|
|---|---|---|
|System execution time|Wall-clock ms per system per tick|Stacked bar chart (segments per system)|
|System budget utilization|Actual ms vs. budget target|Percentage bar with red threshold|
|Tick total time|Sum of all systems|Running line chart with 500ms target line|
|Tick overrun count|Ticks exceeding 500ms budget|Counter + rate (overruns/minute)|
|Tick skip count|Ticks dropped due to previous overrun|Counter (should be 0)|

**Per-System Deep Profiling (expandable):**

|System|Specific Metrics|
|---|---|
|BehaviorTreeSystem|Avg/max/p95 BT eval time. Slowest agent ID. Node hit distribution.|
|VaultSyncSystem|Files written per sync. Batch duration. Retry queue depth. Failed writes.|
|EconomySystem|Price recalculation duration. Items tracked. Trade volume per cycle.|
|ChroniclerSystem|Report generation time. LLM call latency.|
|PerceptionSystem|Grid partition time. Entities in perception per agent (avg/max).|
|DialogueSystem|LLM queue depth. Template fallback rate. Avg LLM response time.|
|TraitResolverSystem|Modifier map build time. Traits per agent (avg/max).|

**EventBus Metrics:**

|Metric|Measures|
|---|---|
|Events emitted per tick|Total + breakdown by type|
|Listener count|Total registered listeners|
|Event processing time|Time in handlers per tick|
|Event queue depth|Pending events at end of tick (should be 0)|

**Resource Metrics (platform level):**

|Metric|Measures|
|---|---|
|Heap memory usage|JS heap size (current + trend)|
|Vault file count|Total markdown + JSON + Canvas files|
|Vault I/O throughput|Bytes read/written per sync cycle|
|Canvas render FPS|ExcaliburJS frame rate (separate from tick rate)|

**Performance Panel UI — three views:**

1. **Dashboard** — Key health indicators: tick time (rolling 100 ticks), overrun rate, FPS, memory, entity count. Green/yellow/red status per metric.
2. **Systems breakdown** — Expandable list of all systems. Sortable by execution time. Highlights systems exceeding budget.
3. **Timeline** — Flame chart for a single tick: execution order, time per system, gaps, overruns. Director can "freeze" a tick for inspection.

**Performance Alerts (debug mode only):**

|Alert|Trigger|
|---|---|
|`PerfTickOverrun`|Tick exceeds 500ms|
|`PerfSystemSlow`|Individual system exceeds its budget|
|`PerfMemoryHigh`|Heap exceeds 80% of available|
|`PerfVaultSyncSlow`|Sync batch exceeds 1000ms|
|`PerfFPSDrop`|Render FPS drops below 30|

---

## 33 · System Requirements

### 33.1 Hardware Requirements

|Resource|Minimum (300 entities)|Recommended|
|---|---|---|
|CPU|4 cores|6+ cores|
|RAM|8 GB total (Obsidian ~1 GB + plugin ~500 MB for ECS + Vue + ExcaliburJS)|16 GB|
|GPU|Integrated graphics (WebGL via Electron's Chromium)|Dedicated GPU for 60 FPS|
|Storage|SSD required (vault I/O every 2s; spinning disk bottlenecks VaultSync)|NVMe SSD|
|Display|1280×720 minimum (split view needs horizontal space)|1920×1080+|

### 33.2 Software Requirements

|Requirement|Version|
|---|---|
|OS|Windows 10+, macOS 12+, Linux (any Obsidian-supported)|
|Obsidian|v1.4+ (Canvas support, modern plugin API)|
|Node/Electron|Bundled with Obsidian (no user action)|

### 33.3 Scaling Limits

|Entity Count|Expected Tick Time|FPS|Notes|
|---|---|---|---|
|50 (small)|< 50ms|60|Comfortable. Debug overlays no impact.|
|150 (medium)|< 150ms|60|Normal play. Minor FPS dip with all debug overlays.|
|300 (target max)|< 300ms|45–60|At budget ceiling. LLM strictly async.|
|500+ (stress)|300–600ms|30–45|Tick overruns likely. Entity culling or reduced tick rate recommended.|

### 33.4 LLM Provider Requirements (optional)

|Provider|Requirement|
|---|---|
|API-based (Cursor, Claude, OpenAI)|Internet connection, API key, ~$0.01–0.05 per dialogue|
|Local LLM (Ollama, LM Studio)|16 GB+ RAM, GPU with 6 GB+ VRAM|
|Template-only (no LLM)|No additional requirements|

### 33.5 Vault Size Estimates

|World Size|Files|Disk Space|Notes|
|---|---|---|---|
|Hamlet (5 agents)|~80|~500 KB|Config + agents + items + locations|
|Market Town (12 agents)|~200|~2 MB|+ buildings, quests, recipes|
|Prosperous Village (20 agents)|~350|~5 MB|Full economy, relationships|
|Late-game (50+ agents)|~800+|~15 MB|Chronicles and legacy accumulate|

---

## 34 · Emergence Design Checklist

Before shipping any system:

- [ ] Does this system communicate exclusively through EventBus events?
- [ ] Does this system avoid hardcoded references to other systems?
- [ ] Can behavior change by modifying only data (frontmatter / JSON / Canvas)?
- [ ] Does this system produce different outcomes for different attribute/mood/memory values?
- [ ] Can this system participate in at least one documented emergence scenario (§1.7)?
- [ ] Is this system independently testable with mock Blackboard/components?
- [ ] Does this system use the Result type for all fallible operations?
- [ ] Does this system degrade gracefully (fallback, skip, retry) rather than crash?
- [ ] Does this system emit events that other systems can react to?
- [ ] Is the system's data schema Zod-validated?

If any answer is "no," redesign before implementing.

---

## 35 · Technology Stack Summary

|Layer|Technology|Role|
|---|---|---|
|Platform|Obsidian Plugin|Host environment, vault persistence, file system APIs|
|Runtime / ECS|ExcaliburJS v0.32+|ECS framework, Actor system, Actions API, collision (SparseHashGrid), camera strategies, EventEmitter, Timer/Clock, scene management, debug tools, input handling, graphics pipeline (WebGL + Canvas fallback)|
|Pathfinding|@excaliburjs/plugin-pathfinding|A* and Dijkstra for region graph and intra-region navigation|
|Language|TypeScript (strict)|Type safety, Zod integration|
|Behavior Trees|mistreevous|Agent and animal decision-making|
|UI Framework|Vue 3 (Composition API)|Declarative component-based Director UI|
|State Management|Pinia|Reactive stores bridging ECS → Vue|
|Data Validation|Zod|Schema definition, validation, type inference|
|Persistence|Obsidian Vault (markdown + Canvas + JSON)|Data-driven world definition and state|
|LLM|Unified Adapter (Cursor API first)|Optional dialogue enrichment|
|Testing|Vitest + Vue Test Utils + MSW + memfs|Unit, integration, component, emergence|
|Component Dev|Storybook|Isolated Vue component development, visual testing, design system documentation|
|Linting|ESLint (flat config)|Architecture enforcement, layer boundaries, code quality|
|Build|Vite|Fast builds, HMR|
|i18n|vue-i18n|Reactive locale switching for Vue UI|

---

## 36 · Engineering Principles

### 36.1 Twelve-Factor Adapted

The following 12-Factor App principles are adapted for an Obsidian plugin game:

**Factor III — Config Separation.** All tunable values live in config, never hardcoded. Two config layers:

|Layer|File|Contains|Committed to vault?|
|---|---|---|---|
|Game tuning|`game-config.json`|Tick rate, decay rates, tax rate, thresholds, locale, mortality toggle, season duration|Yes|
|Environment/secrets|`game-secrets.json`|LLM API keys, provider URLs, external service credentials|**Never** (gitignored)|

Systems read config via a typed `GameConfig` interface injected at startup. Config changes during play emit `ConfigChanged` event — systems react next tick.

**Factor IV — Backing Service Abstraction.** All external dependencies are accessed through typed interfaces, swappable via config:

|Service|Interface|Implementations|
|---|---|---|
|LLM|`LLMProvider`|CursorAPI, ClaudeAPI, OllamaLocal, TemplateFallback|
|Filesystem|`VaultAdapter`|ObsidianVaultAdapter, MemfsAdapter (test)|
|Logging|`Logger`|ConsoleLogger, VaultFileLogger, UILogger|
|Markdown|`MarkdownService`|MarkdownSerializer (serialize + templates)|

Switching providers requires only a config change — no code modification.

**Factor IX — Disposability.** Fast startup, graceful shutdown, crash resilience:

|Phase|Target|Behavior|
|---|---|---|
|Startup|< 3s|Load vault → Zod validate all → build ECS → ready|
|Shutdown|< 1s|Flush VaultSync → save dirty state → clean up listeners|
|Crash recovery|Automatic|Error boundaries prevent corruption. Next startup recovers from last persisted vault state.|

**Factor X — Dev/Prod Parity.** Development mode (Vite dev server, hot reload) behaves identically to production (bundled plugin). Same vault format, same ECS, same tick cycle. Storybook provides isolated component testing matching production rendering. No dev-only code paths that bypass game systems.

**Factor XI — Log Streams.** Structured log format: `{ tick, system, level, message, data }`. Log level configurable via `game-config.json`. Logs never block the tick cycle. Three targets: console (dev), vault file (`logs/`), UI Event Log panel. The EventBus is the canonical event stream — logging is a subscriber, not a gatekeeper.

### 36.2 Dependency Injection

All systems receive their dependencies through typed interfaces, never by importing concrete implementations. This is the backbone of testability and the backing service abstraction (Factor IV).

**DI Container:** A lightweight, manual DI container — no framework (no InversifyJS, no tsyringe). Dependencies are composed at plugin startup and passed via constructor or factory function parameters.

**GameDeps — the root dependency bag:**

```typescript
interface GameDeps {
	config: GameConfig;
	eventBus: EventBus;
	logger: Logger;
	vault: VaultAdapter;
	rng: GameRNG;
	spatialQuery: SpatialQueryService;
}
```

Systems receive a subset of `GameDeps` relevant to their function (Interface Segregation). A system that only needs the EventBus and Logger does not receive the full bag:

```typescript
// System receives only what it needs
interface NeedsDecayDeps {
	config: Pick<GameConfig, 'needs' | 'mortality'>;
	eventBus: EventBus;
	logger: Logger;
}

function createNeedsDecaySystem(deps: NeedsDecayDeps): System { ... }
```

**Composition root (plugin.ts onload):**

```typescript
// All dependencies composed once at startup
const config = loadGameConfig(configJson);
const eventBus = createEventBus();
const logger = createConsoleLogger(config.debug ? 'debug' : 'info');
const vault = new ObsidianVaultAdapter(this.app.vault);
const rng = createGameRNG(config.debug ? 42 : undefined); // seeded in debug

const deps: GameDeps = { config, eventBus, logger, vault, rng, spatialQuery };

// Systems created with their deps
const needsDecay = createNeedsDecaySystem({ config, eventBus, logger });
const moodSystem = createMoodSystem({ config, eventBus, logger });
// ... all systems
```

**In tests:**

```typescript
// Swap any dependency with a mock/stub
const testDeps: NeedsDecayDeps = {
	config: { needs: { hunger_decay: 0.5 }, mortality: { ... } },
	eventBus: createEventBus(), // real bus, isolated per test
	logger: createNoopLogger(), // silent logger for tests
};
const system = createNeedsDecaySystem(testDeps);
```

**Rules:**
- No global singletons. Every dependency is injected.
- No service locator pattern. Dependencies are explicit in function signatures.
- Factory functions (`createXxxSystem`) over classes — simpler, no `this` binding issues.
- ISP subsets: systems declare the minimal interface they need, not the full `GameDeps`.
- The composition root in `plugin.ts` is the ONLY place where concrete implementations are chosen.

### 36.3 Test-Driven Development

TDD is the primary development methodology. Every system, component, and feature is built test-first.

**TDD Cycle:**

```
1. RED    — Write a failing test that defines the expected behavior
2. GREEN  — Write the minimum code to make the test pass
3. REFACTOR — Clean up without changing behavior (tests stay green)
```

**What makes TDD natural in this architecture:**

|Architecture Feature|TDD Enabler|
|---|---|
|ECS components|Pure data objects — trivially constructable in tests without setup|
|Blackboard pattern|BT decisions are testable by injecting mock Blackboards: set inputs, assert `selectedAction`|
|EventBus decoupling|Systems communicate via events — test one system in isolation by asserting emitted events|
|Result type|Every fallible operation returns `Result<T, E>` — test both success and failure paths explicitly|
|Command/Saga pattern|Each command has `validate()`, `execute()`, `compensate()` — three testable units per action|
|Zod schemas|Schemas are testable independently: validate known-good data, reject known-bad data|
|Data-driven content|Game behavior changes by modifying data files — test different configurations without code changes|
|Typed DI|Systems receive dependencies via interfaces — swap real implementations for mocks/stubs in tests|
|VaultAdapter interface|Use `MemfsAdapter` in tests — full vault behavior without touching the real filesystem|
|Vue + Pinia|Components mount with mock stores — test UI rendering without running the game engine|
|Storybook|Visual component testing and documentation — each UI component has stories before integration|

**Test Layers (ordered by speed, innermost first):**

```
┌─────────────────────────────────────────────────┐
│  Unit Tests (Vitest)                            │
│  Schemas, components, pure functions, Result    │
│  Target: < 1ms per test, thousands of tests     │
├─────────────────────────────────────────────────┤
│  Integration Tests (Vitest + memfs)             │
│  System + EventBus, VaultSync, BT evaluation    │
│  Target: < 50ms per test                        │
├─────────────────────────────────────────────────┤
│  Component Tests (Vitest + Vue Test Utils)      │
│  Vue components with mock stores                │
│  Target: < 100ms per test                       │
├─────────────────────────────────────────────────┤
│  Visual Tests (Storybook)                       │
│  Isolated component rendering, design system    │
│  Target: visual regression per component        │
├─────────────────────────────────────────────────┤
│  Emergence Tests (Vitest, custom harness)       │
│  Seed world, run N ticks, assert patterns       │
│  Target: < 5s per scenario                      │
└─────────────────────────────────────────────────┘
```

**TDD Rules:**

1. **No implementation without a test.** Every system, every BT node, every schema, every command starts with a test.
2. **Tests are documentation.** Test names describe behavior: `"hungry agent abandons quest to seek food"`, not `"test NeedsDecay"`.
3. **Mock at boundaries, not internals.** Mock: VaultAdapter, LLMProvider, time (tick control). Don't mock: ECS components, EventBus, Blackboard (use real instances).
4. **Emergence tests are first-class.** The emergence validation scenarios (§1.7) are implemented as automated tests that seed a world and assert emergent patterns after N ticks.
5. **Coverage target: 80% statements, 80% lines.** Measured per system, not globally. New systems ship at or above target.

### 36.4 Obsidian Isolation Boundary

Obsidian is a hosting platform, not a dependency. The game MUST be able to run without Obsidian — enabling future platform migration (standalone Electron, web, different note-taking hosts).

**Obsidian API is allowed ONLY in these files:**
- `src/main.ts` — plugin entry point
- `src/infrastructure/engine/game-view.ts` — and all other `*-view.ts` ItemView files
- `src/infrastructure/settings/settings-tab.ts` — Obsidian SettingTab
- `src/infrastructure/vault/obsidian-vault-adapter.ts` — vault file system adapter
- `src/infrastructure/platform/obsidian-platform.ts` — platform services adapter

**Obsidian API is FORBIDDEN everywhere else.** No domain code, no system code, no UI components (Vue), no schemas, no tests (except integration tests for the adapters themselves) may import from `'obsidian'`.

**Platform Adapter pattern:**

All Obsidian-specific capabilities are abstracted behind platform-agnostic interfaces:

```typescript
// src/domain/core/platform.ts — the abstraction
interface PlatformServices {
	vault: VaultAdapter;           // file read/write/list/watch
	notifications: NotificationAdapter; // show user-facing notices
	commands: CommandRegistry;     // register keyboard commands
	modals: ModalAdapter;          // show confirmation/input dialogs
}

interface NotificationAdapter {
	show(message: string, timeout?: number): void;
	showError(message: string): void;
}

interface CommandRegistry {
	register(id: string, name: string, callback: () => void): void;
}

interface ModalAdapter {
	confirm(title: string, message: string): Promise<boolean>;
	prompt(title: string, placeholder: string): Promise<string | null>;
}
```

**Obsidian implementations** (`src/infrastructure/platform/`):
- `ObsidianVaultAdapter` — wraps `app.vault` API
- `ObsidianNotificationAdapter` — wraps `new Notice()`
- `ObsidianCommandRegistry` — wraps `plugin.addCommand()`
- `ObsidianModalAdapter` — wraps `new Modal()`

**Test implementations** (`tests/setup/` or `src/infrastructure/platform/`):
- `MemfsVaultAdapter` — in-memory filesystem
- `NoopNotificationAdapter` — silent, records calls for assertion
- `NoopCommandRegistry` — records registrations
- `NoopModalAdapter` — auto-confirms or returns preset values

**Composition root** (`plugin.ts`) assembles the real Obsidian implementations and passes them through `GameDeps`. Every system and UI component receives the platform-agnostic interfaces.

**Why this matters:**
- Domain code is testable without Obsidian mocks
- The game could be ported to a standalone Electron app by replacing 4 adapter files
- No accidental coupling to Obsidian internals (notices, modals, commands) in game logic
- ESLint enforces this at build time (see §36.5)

### 36.5 ESLint Architecture Enforcement

ESLint rules enforce architectural boundaries at build time. Violations fail CI.

**Layer Direction (strict):**

```
Infrastructure → Domain → Systems → UI
```

**Enforcement Rules:**

|Rule|Enforces|Example Violation|
|---|---|---|
|`no-restricted-imports` on domain files|Domain must not import infrastructure or `obsidian`|A system importing `ObsidianVaultAdapter` directly instead of using the `VaultAdapter` interface|
|`no-restricted-imports` on UI files|UI must not import domain internals or `obsidian`|A Vue component importing from `obsidian` or ECS component classes|
|`no-restricted-imports` on systems|Systems must not import other systems or `obsidian`|`JobSystem` importing `EconomySystem` instead of communicating via EventBus|
|`no-restricted-imports` on ALL except allowlist|`obsidian` only in: main.ts, *-view.ts, settings-tab.ts, obsidian-*-adapter.ts|Any file outside the allowlist importing from `obsidian` (§36.4)|
|`no-restricted-globals`|No bare `fs`, `path`, `process` outside infrastructure|A system using `node:fs` instead of VaultAdapter|
|`no-restricted-syntax`|No bare `try/catch` in system code|Using `try {} catch {}` instead of Result pattern|
|Custom rule: `no-cross-system-mutation`|Systems must not directly mutate another system's components|`TradeSystem` directly modifying `MoodComponent` instead of emitting an event|

**Additional ESLint Standards:**

|Rule|Purpose|
|---|---|
|`@typescript-eslint/no-explicit-any`|No `any` types — full type safety|
|`@typescript-eslint/strict-boolean-expressions`|No implicit boolean coercion|
|`import/no-cycle`|No circular dependency chains|
|`max-lines` (configurable per layer)|File size limits: systems < 350 lines, components < 250 lines|
|`max-complexity` (10)|Cyclomatic complexity cap per function|
|`naming-convention`|kebab-case files, PascalCase classes/components, camelCase functions/variables|

**Config location:** `configs/eslint.config.mjs` (flat config format). Custom rules for architecture enforcement in `configs/eslint-rules/`.

---

## 37 · Glossary

|Term|Definition|
|---|---|
|**Agent**|Autonomous entity with attributes, needs, mood, memory, goals, skills, and a full behavior tree.|
|**Animal**|Autonomous entity with simplified stats, instinct BT, and optional owner bond. No LLM, no tools.|
|**World Object**|Passive entity (vending machine, food cart, workbench) that agents interact with.|
|**Director**|The player. Operates from the management UI via indirect control.|
|**Billboard**|Location where quests are posted for agents to discover.|
|**Tick**|One discrete simulation step (~500ms default).|
|**Kind**|Agent archetype (merchant, scholar, etc.) setting BT template and defaults.|
|**Species**|Animal archetype (dog, cat, etc.) setting instinct profile and stats.|
|**Emergence**|Complex behavior arising from runtime interaction of simple, decoupled systems.|
|**Vault**|Obsidian-compatible filesystem serving as the game's database.|
|**Canvas**|Obsidian Canvas format (`.canvas` JSON) used for relationship and zone graphs.|
|**BT**|Behavior Tree — per-entity decision structure (mistreevous).|
|**Blackboard**|Per-entity key-value store populated from ECS components for BT reading.|
|**ECS**|Entity-Component-System architecture (ExcaliburJS).|
|**EventBus**|Typed pub/sub message bus connecting all systems.|
|**Result**|Typed error handling: `Result<T, E>` — explicit success/failure, no exceptions.|
|**Circuit Breaker**|Resilience pattern protecting LLM calls from cascading failures.|
|**Command**|Encapsulated action with validate/execute/compensate for reversibility.|
|**Saga**|Ordered sequence of Commands with compensating rollback on failure.|
|**Recipe**|Data-driven definition of inputs → outputs for production and construction.|
|**Mood**|Derived emotional state (-100 to +100) influencing BT decisions and dialogue.|
|**Memory**|Bounded episodic log of significant events, decaying over time.|
|**Zone**|Director-designated area constraining land use (residential, commercial, etc.).|
|**World Event**|Data-driven random occurrence (drought, caravan, festival) creating external pressure.|
|**Chronicler**|Special observer entity — tutorial guide, narrator, historian. One per world.|
|**Trait**|Data-driven tag (markdown file) modifying agent behavior via system/modifier pairs.|
|**Scenario**|World template with goals, time limits, and scoring. Structured Director challenge.|
|**Milestone**|Emergent achievement recognized and celebrated by the Chronicler.|
|**Season**|One of four cyclic time periods (spring/summer/autumn/winter) affecting production, energy, and mood.|
|**Treasury**|Director's gold reserve, funded by trade tax, spent on quests, objects, and agent creation.|
|**Legacy**|Biographical record and inheritance chain created when an agent dies.|
|**Gossip**|Information (prices, reputation, opportunities) spreading through social interactions with reliability decay.|
|**Crime**|Antisocial agent behavior (theft, trespass, vandalism) triggered under extreme need and mood conditions.|
|**Stamina**|Short-term exertion pool (= HT). Consumed by movement between regions and work. At 0: exhausted.|
|**Region**|Named area of the world map. Agents pathfind between regions via connection graph; move freely within.|
|**Operating Fund**|Gold pool attached to a facility. Pays wages, receives sales revenue.|
|**DayNight**|Global time-of-day flag (dawn/day/dusk/night) set by DayNightSystem, read by other systems.|
|**Locale**|Active language setting. UI strings, entity display names, and templates resolve per locale.|

---

> **Next document:** Arc42 + C4 Architecture Document — defining bounded contexts, container decomposition, component interfaces, deployment view, and system contracts.