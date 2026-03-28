# Project Meridian — Player Depth Design Spec

> **Date:** 2026-03-27
> **Status:** Approved (brainstorm validated + polishing pass + pre-lock review integrated)
> **Scope:** New GDD sections covering Director experience, economy bootstrap, onboarding, agent lifecycle, world creation, information presentation, failure states, social dynamics, seasonal cycles, localization, debug/performance, system requirements, engineering principles (12-Factor, TDD, ESLint).
> **Context:** The original GDD was technically thorough but lacked player experience depth. This spec defines the missing player-facing systems. A pre-lock design review (competitive analysis + gap analysis) was integrated during the polishing pass — all critical and important gaps are now addressed in the GDD.

---

## 1 · Director Progression & Motivation

The Director's engagement operates on three interlocking layers.

### 1.1 Layer 1 — Scenarios

Pre-designed challenges with specific goals and constraints. Each scenario is a world template with attached victory conditions.

**Scenario schema (Zod-validated):**

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

**Behavior:**
- Scenarios appear in a dedicated "Scenarios" menu.
- Goals are tracked in real-time on the Director UI.
- Time limits create urgency. If the deadline passes without meeting goals, the scenario is marked "incomplete" — not "failed."
- Scoring: bronze/silver/gold based on efficiency (time remaining, average mood, economic health). Creates replayability.
- On completion (or timeout), the world continues in sandbox mode. The Chronicler narrates the outcome.

**Starter scenarios (ship with):**

| Scenario | Difficulty | Template | Key Goal |
|----------|-----------|----------|----------|
| "The First Settlement" | Easy | Hamlet | Reach population 10 with average mood > 40 |
| "The Market District" | Medium | Market Town | 5 profitable shops before Day 60 |
| "Frontier Survival" | Hard | Frontier Post | All agents alive through winter with mortality on |
| "The Great Drought" | Hard | Prosperous Village | Maintain food supply through a 2-season drought |

### 1.2 Layer 2 — Emergent Milestones

In sandbox mode (and running alongside scenarios), the game tracks and celebrates emergent achievements as they occur organically.

**Milestone categories:**

| Category | Examples |
|----------|---------|
| Economic | "First supply chain operational," "Total trade volume exceeds 1000 gold," "Agent opened a business" |
| Social | "First friendship formed," "Agent remembered a past kindness," "First gossip chain (3+ agents)" |
| Property | "First building constructed," "Agent-created quest completed," "All land plots claimed" |
| Population | "10 agents thriving," "First agent death — legacy recorded," "3 generations of property inheritance" |
| Survival | "Survived first winter," "Recovered from economic collapse," "Agent rescued from starvation" |

**Behavior:**
- Milestones are recognized via Chronicler narration and logged in a persistent milestone log (vault markdown).
- No unlock gating — milestones are celebrations, not prerequisites.
- Milestones can award traits to involved agents (e.g., "founder" trait for starting agents).

### 1.3 Layer 3 — Story Curation

The Director's endgame. Tools for building a narrative artifact from the world's history.

**Features:**
- **Bookmark moments** — Director tags any tick/event as a bookmark with a custom note.
- **Name eras** — Director assigns names to time periods ("The Great Drought of Year 2," "The Elena Era").
- **Agent biographies** — Auto-generated from memory + relationships + career + cause of death. Exportable.
- **World timeline** — Visual chronological view of bookmarks, milestones, era boundaries, births, deaths, and major events.
- **Chapter summaries** — The Chronicler compiles periodic narrative summaries (seasonal or on-demand).
- **Export** — World history exportable as a markdown document.

**Vault paths:** Story curation data (bookmarks, eras, timelines, chapter summaries) persisted in `chronicles/`. Agent biographies and death eulogies persisted in `legacy/`. The distinction: `chronicles/` is the world's story; `legacy/` is the record of individual lives ended.

---

## 2 · Economy Bootstrap & Monetary Policy

### 2.1 Two-Layer Economy

**Agent Economy (self-sustaining loop).**
Facilities generate revenue from customers. Facility owners pay worker wages from that revenue. Agents spend wages on goods and services. Gold circulates.

- Each agent spawns with a starting stipend (configurable per scenario/template, default 100 gold).
- Facilities start with initial stock and a small operating fund.
- Loop: production → sales → wages → spending → back to sales.

**Director Economy (meta-layer).**
The Director has a treasury, separate from agent gold.

- **Income:** Configurable tax rate (default 5%) skimmed from every trade transaction.
- **Expenses:** Posting quest rewards, placing world objects (some cost treasury gold), spawning new agents (creation fee scales with attribute total).
- **Feedback loop:** Investing in the world (quests, infrastructure) stimulates the agent economy, which generates more tax revenue.

### 2.2 Monetary Safeguards

| Mechanism | Type | Description |
|-----------|------|-------------|
| Welfare quests | Gold floor | Agents below 10 gold can take Chronicler-posted welfare quests to prevent permanent destitution (see §2.3) |
| Price clamping | Inflation/deflation guard | EconomySystem clamps prices between 0.5× and 3.0× base value |
| Land purchases | Gold sink | Removes gold from circulation permanently |
| Construction costs | Gold sink | Material purchases consume gold |
| Equipment repairs | Gold sink | Service fees for durability restoration |
| Item spoilage | Implicit sink | Gold spent on food that spoils is lost |
| Director quest rewards | Gold faucet | Treasury gold enters agent circulation |
| Initial stipends | Gold faucet | New agents inject gold on spawn |
| Merchant caravan events | Gold faucet | World events can introduce external gold |

### 2.3 Welfare Quest Mechanism

When the `EconomySystem` detects an agent with wallet < 10 gold and no active quest, it emits a `WelfareQuestNeeded` event. The `ChroniclerSystem` responds by generating a welfare quest:

- **Quest type:** Simple tasks — `delivery` (move item A to B within current location), `gather` (collect N items from nearby sources), or `errand` (visit a specific location).
- **Reward:** 15–25 gold (enough to buy basic food, not enough to accumulate wealth).
- **Delivery:** Posted directly to the agent (not the billboard). The agent sees it in their quest log next BT evaluation tick.
- **Limit:** One active welfare quest per agent at a time. Maximum 3 welfare quests active in the world simultaneously.
- **Generation:** On-demand via event response, not scheduled. The ChroniclerSystem generates the quest markdown file with a `welfare: true` tag.
- **Emergence note:** Welfare quests are a safety net, not a strategy. The low reward and direct assignment prevent agents from gaming the system. Agents with jobs and social connections should never need them.

---

## 3 · The Chronicler

### 3.1 Entity Definition

The Chronicler is a special agent entity with kind `chronicler`. It exists in the world but does not participate in the economy, take quests, or have needs. It observes.

**Properties:**
- No needs, no wallet, no job, no BT, no mortality.
- Unique — only one Chronicler per world.
- Cannot be deleted by the Director.
- Has its own dedicated panel in the management UI.
- Runs a dedicated `ChroniclerSystem` in the tick cycle. All operations return `Result<T, GameError>` (consistent with GDD §16.2).

### 3.2 Onboarding Role

For new Directors, the Chronicler offers contextual guidance through the notification system. Tips are triggered by world conditions, not a fixed script:

- "Your agents are hungry — try placing a farm or food cart."
- "Elena has no job. Buildings with vacancies create employment."
- "You have gold in your treasury. Posting quests motivates agents to act."

**Fade-out:** The Chronicler stops offering basic tips once the Director demonstrates competence (has placed N objects, created N quests, managed N agents). A "dismiss tips" option is always available.

### 3.3 Narrator Role

Once onboarding fades, the Chronicler transitions to ongoing narrator:

| Output | Frequency | Content |
|--------|-----------|---------|
| Tick observations | Real-time | Short one-liners for notable events: "Elena bought Plot 7" |
| Daily digest | End of day | Agents spawned/died, quests completed/failed, economic snapshot, mood distribution |
| Seasonal report | End of season | Major events, emerging patterns, achievements, supply chain health, relationship shifts |
| Decline warnings | As detected | Proactive alerts for negative trends: "Food production has dropped for 3 consecutive days" |

Reports are template-based by default, LLM-enhanced when available (same Circuit Breaker protected adapter).

### 3.4 Historian Role

The Chronicler records:
- Agent biographies (auto-generated on death, on-demand for living agents)
- Era names (Director-assigned)
- Death eulogies
- Chapter summaries (seasonal)
- Milestone narrations

All output persisted as vault markdown in `chronicles/`.

---

## 4 · Agent Lifecycle

### 4.1 Entering the World — Director-Spawned

**Method 1 — Manual creation.**
The Director opens the agent creator in the management panel:
1. Pick a kind (merchant, scholar, guard, laborer, noble, wanderer).
2. Set name and optionally adjust attributes (within kind defaults +/- configurable range).
3. Assign starting traits.
4. Place on the map.

Cost: treasury gold. Creation fee scales with attribute total (higher stats = more expensive). The agent spawns with their stipend, default equipment for their kind, and no memories.

**Method 2 — Candidate pool.**
The game generates a rotating pool of 3–5 pre-rolled agent candidates (random kind, name, attributes, personality). The Director can browse and "hire" any at a discounted creation fee. Pool refreshes every N days (default 5).

### 4.2 Leaving the World — Mortality with Legacy

**Global toggle:** `mortality: true | false` in `game-config.json`. When off, agents collapse but never die — they remain in collapsed state until rescued. All other consequences still apply. Default: `true`.

**Death causes (when mortality is on):**

| Cause | Condition | Grace Period |
|-------|-----------|-------------|
| Starvation | Hunger = 0 | Collapse after 50 ticks. Death after 100 more ticks if not rescued. |
| Despair | Mood < -60 continuously | Death after 200 consecutive ticks in breakdown. Recoverable if mood improves. |
| Quest danger | Failed quest tagged `dangerous` | Configurable mortality chance (default 10%). Immediate. |

**Design constraint:** No random death, no combat death, no aging death. Every death traces to identifiable causes the Director could have prevented. This reinforces the Director's responsibility.

### 4.3 Legacy System

When an agent dies:

1. **Property inheritance** — Passes to the agent with highest disposition toward the deceased. If no positive disposition, reverts to unclaimed.
2. **Inventory & gold inheritance** — Same rule. Heir receives wallet and non-equipped items.
3. **Memory ripple** — All agents with a relationship to the deceased receive a high-significance `agent_died` memory. Mood impact scales with disposition (close friend = heavy grief, acquaintance = mild sadness). These memories decay slowly.
4. **Chronicler eulogy** — Biography generated: name, kind, career history, notable memories, relationships, cause of death, heir. Saved in `legacy/`.
5. **Relationship ghost** — Deceased remains as a node in the relationship Canvas, marked deceased. Edges persist so living agents still "remember" them.

---

## 5 · Data-Driven Trait System

### 5.1 Trait Definition

Traits are defined as markdown files in `config/traits/` with Zod-validated frontmatter:

```yaml
---
id: trait-unkillable
name: "Unkillable"
description: "This agent cannot die. They collapse and auto-recover."
category: survival
effects:
  - system: MortalityCheck
    modifier: { prevent_death: true, auto_recover_ticks: 150 }
  - system: MoodSystem
    modifier: { breakdown_floor: -80 }
assignable_by: director
stackable: false
conflicts_with: []
---

A resilient spirit that refuses to be extinguished.
```

### 5.2 Trait Properties

| Property | Type | Description |
|----------|------|-------------|
| `id` | string | Unique identifier (`trait-<name>`) |
| `name` | string | Display name |
| `description` | string | Tooltip text |
| `category` | enum | `survival`, `social`, `economic`, `work`, `special` |
| `effects` | array | System/modifier pairs applied when trait is active |
| `assignable_by` | enum | `director` (manual), `definition` (baked into kind), `milestone` (earned), `inherited` (from deceased) |
| `stackable` | boolean | Whether an agent can have this trait multiple times |
| `conflicts_with` | string[] | Trait IDs that cannot coexist |

### 5.3 Starter Traits

| Trait | Category | Key Effect |
|-------|----------|------------|
| `unkillable` | survival | Prevents death, auto-recover after 150 ticks |
| `resilient` | survival | Halved need decay rates |
| `silver-tongue` | social | +3 trade modifier, +2 Chr for dialogue |
| `frugal` | economic | 20% less gold spent on purchases |
| `workaholic` | work | No mood penalty for overtime, +10% productivity |
| `loner` | social | No social need decay, but -50% relationship gain |
| `founder` | special | Awarded to starting agents, +1 Status, Chronicler records them as founders |

### 5.4 Agent Integration

Agents reference traits by ID in their frontmatter:

```yaml
traits: ["trait-unkillable", "trait-founder"]
```

Systems query the trait array and look up effects during processing via a **trait modifier resolver**:

1. At tick start, the `TraitResolverSystem` (runs before NeedsDecaySystem, position 0.5) builds a per-entity modifier map by loading each agent's trait definitions from the vault cache and collecting their `effects` arrays.
2. Each downstream system checks the modifier map for its system name (e.g., `MoodSystem` looks up `system: "MoodSystem"` entries). If modifiers exist, they are applied before the system's normal calculation.
3. This is the same dispatch pattern used by world event effects and season effects — a generic modifier pipeline that multiple sources can feed into. The resolution order is: trait modifiers → season modifiers → world event modifiers (later sources override earlier on conflict).
4. Trait addition emits `TraitAwarded`. Trait removal emits `TraitRemoved`. Conflict detection (via `conflicts_with`) returns a `Result.err` and emits `TraitConflictDetected` — the conflicting trait is not applied.

---

## 6 · World Creation & Initial Setup

### 6.1 Templates

Pre-built world snapshots ready to play. A template is a folder of pre-authored markdown files. Loading a template copies files into a new world vault.

| Template | Agents | Buildings | Focus |
|----------|--------|-----------|-------|
| "Hamlet" | 5 | Farm, shop, 2 homes | Gentle intro, growth-focused |
| "Market Town" | 12 | Multiple shops, tavern, clinic, forge | Trade & social dynamics |
| "Frontier Post" | 4 | Basic shelter, well | Survival, build from nothing |
| "Prosperous Village" | 20 | Full economy, school, guard post | Late-game sandbox, observe complexity |

### 6.2 World Builder

Step-by-step wizard for experienced Directors:

1. **Map** — Pick map size (small/medium/large), terrain style (plains, riverside, forest clearing). Defines available location slots and zone suitability.
2. **Starting agents** — Create manually or draw from candidate pool. Set number, kinds, customize attributes.
3. **Starting buildings** — Place initial facilities from a catalog. Each has a treasury cost.
4. **Conditions** — Set starting season, Director treasury amount, difficulty modifier (affects need decay rates, event frequency, agent starting stipend).
5. **Traits & rules** — Toggle mortality, assign starting traits, set global config overrides.

The builder produces a vault snapshot identical in structure to a template. Custom worlds can be saved as new templates in `templates/` at the vault root.

### 6.3 Scenarios

Scenarios are templates with attached goals and constraints (see §1.1 for schema). They appear in a dedicated "Scenarios" menu. Completed scenarios are logged with score.

---

## 7 · Information Presentation & Director Awareness

### 7.1 Chronicler Panel

Dedicated tab in the management panel. Displays all Chronicler output (see §3.3):
- Real-time tick observations
- Daily digests
- Seasonal reports
- Decline warnings
- Milestone announcements

All searchable and filterable by category, agent, time range.

### 7.2 Data Dashboards

| Dashboard | Location | Shows |
|-----------|----------|-------|
| Mood heatmap | World map overlay | Color-coded zones by average agent mood |
| Economic activity | World map overlay | Trade volume hotspots, gold flow direction |
| Supply chain status | Economy panel | Flow diagram: raw → processed → finished, bottleneck highlighting |
| Price history | Economy panel | Line charts per item category over time (by season) |
| Population stats | Agents panel | Mood distribution bar, needs averages, employment rate |
| Treasury ledger | Director toolbar | Income/expense breakdown, balance trend |

Map overlays are toggle-able from the toolbar. Dashboards update each tick via Pinia stores (UIBridge pattern).

### 7.3 Smart Notifications

Enhancement to existing notification system (GDD §14.3):

| Feature | Behavior |
|---------|----------|
| Grouping | Related notifications collapse: "3 agents completed quests" instead of 3 separate alerts |
| Snooze | Director can snooze a notification category for N ticks |
| Follow | Clicking a notification selects the entity on the map AND opens the relevant panel tab |

---

## 8 · Failure States & Tension

### 8.1 Soft Failure Model

**In sandbox mode:**
- The world never ends. Agents can die, the economy can collapse, the treasury can empty — the Director always has options to rebuild.
- If all agents die (mortality on), the world enters "Abandoned" state. The Chronicler writes a final chapter. The Director can spawn new agents and start over in the same world — ruins, unclaimed property, and history intact.
- Economic collapse triggers Chronicler warnings long before it becomes terminal. The Director can inject stimulus via quest rewards, place free food sources, or spawn agents with high stipends.

**In scenario mode:**
- Scenarios have time limits and goal conditions. If the deadline passes without meeting goals, the scenario is marked "incomplete."
- Score breakdown shows achievement vs. target. The world continues in sandbox mode.
- Bronze/silver/gold ratings based on efficiency create replayability.

### 8.2 Tension Sources

| Source | Mechanism |
|--------|-----------|
| Agent mortality | Death is permanent and emotionally impactful (legacy, grief cascade). The Director feels responsible. |
| Economic pressure | Seasons create scarcity cycles. World events disrupt production. Treasury depends on healthy economy. |
| Cascading mood | One breakdown ripples through the social graph via relationships and coworker dependencies. |
| Scenario time pressure | Goals with deadlines create urgency without punishment. |
| Chronicler accountability | The Chronicler records everything. The world history mirrors the Director's decisions. |

---

## 9 · Crime, Gossip & Antisocial Behavior

### 9.1 Layer 1 — Gossip (Always Active)

Information spreads through social interactions. When two agents converse (DialogueSystem), they can exchange knowledge:

| Gossip Type | Example | Effect |
|-------------|---------|--------|
| Price gossip | "Bread costs 12 gold at Elena's shop" | Listener updates internal price knowledge |
| Reputation gossip | "Marcus refused to help me on a quest" | Listener's disposition toward subject shifts (weighted by trust in speaker) |
| Opportunity gossip | "There's a vacant plot in the market district" | Listener gains awareness of jobs, land, quests |

**Gossip mechanics:**
- Each gossip item has a `reliability` score: 1.0 firsthand, 0.7 secondhand, 0.5 thirdhand. Agents with high IQ weigh reliability more heavily.
- Gossip is stored as a memory entry with type `gossip`. Decays in significance like any other memory (via MemorySystem).
- **Reliability vs. significance:** Reliability degrades at exchange time (when gossip is shared) and is fixed once stored. Significance decays over time (via MemorySystem tick). These are independent: a 0.5-reliability gossip item still decays in significance and is eventually pruned. Downstream copies created at exchange time are independent memory entries — they persist and decay on their own schedule. This is intentional: stale gossip fades from memory naturally, but the reliability discount applied at exchange time is permanent.
- Exchange happens probabilistically during social interactions — piggybacks on the existing DialogueSystem, not a separate system.

**Emergence note:** Gossip makes reputation contextual. An agent's reputation isn't a global number — it's a network of perceptions spreading through social connections. A merchant who cheats one customer won't immediately lose all business; the information must propagate.

### 9.2 Layer 2 — Crime (Extreme Conditions Only)

Crime triggers when an agent meets ALL conditions:
- Need is critical (hunger < 15 OR energy < 10)
- Mood is distressed or worse (<= -20)
- Opportunity exists (unguarded shop, unattended inventory, no witnesses in perception radius)

**Crime types:**

| Crime | Trigger | Effect | Evidence |
|-------|---------|--------|----------|
| Theft | Critical hunger + shop nearby + no guard | Takes food/item without paying. Shop inventory decremented. | Witnesses get `witnessed_theft` memory. Victim gets `was_robbed` memory. |
| Trespass | Critical energy + private property + no shelter | Enters private building to rest. | Owner gets `trespassed` memory. Disposition drops. |
| Vandalism | Breakdown + world object nearby | Damages object. Durability reduced. | Witnesses remember. Repair needed. |

**Consequences (all emergent):**
- Witnesses remember and spread via gossip. Thief's reputation degrades through the social network.
- Guards (if present) respond: move to crime location, confront agent (lowers criminal's mood, logs memory).
- Victims adjust disposition. Robbed shopkeeper refuses future trades with thief.
- No jail, no formal law. Justice is social. Communities with guards have consequences; communities without don't. Creates natural demand for security infrastructure.

**Design constraint:** Crime is rare. The conditions are narrow. Most antisocial behavior stays at the gossip layer.

---

## 10 · Seasonal Cycles

### 10.1 Four-Season Model

Each season lasts N days (default 15 days per season, 60 days per year). Season tracked in `game-config.json` and advanced by the tick cycle.

### 10.2 Season Definition Schema

Seasons are data-driven, defined in `config/seasons/` with Zod-validated frontmatter:

```yaml
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
```

### 10.3 Season Effects

| Season | Production | Energy Decay | Mood Baseline | Key Dynamics |
|--------|-----------|-------------|---------------|-------------|
| Spring | Farms +20% | Normal | +3 | Planting, caravans arrive |
| Summer | Farms +50%, others +10% | +10% (heat) | +5 | Festivals, drought risk |
| Autumn | Farms +30% (harvest), then drop | Normal | Neutral | Harvest surplus, preparation |
| Winter | Farms -50%, outdoor -20% | +30% (cold) | -5 | Cold snaps, scarcity, indoor social |

### 10.4 Gameplay Effects

- **Agricultural rhythm** — The Director must plan food production around seasons. Overproduction in summer/autumn builds stockpiles for winter. Neglect creates winter famine.
- **Economic cycles** — Prices fluctuate seasonally. Food is cheap in autumn (harvest surplus), expensive in late winter (scarcity). Merchants who stockpile profit.
- **Social patterns** — Winter drives agents indoors, increasing social interactions. Summer spreads them across the map. Seasonal festivals boost community mood.
- **Director planning** — Seasons are predictable. The Director plans infrastructure, quest timing, and recruitment around the calendar. World events add unpredictability on top.
- **Memory integration** — Agents with good memory recall last winter's prices and prepare. This creates self-improving economic behavior over time.

### 10.5 Season Transitions

- `SeasonChanged` event emitted on the EventBus.
- Chronicler narrates: "Winter has arrived. Stockpiles are low — this could be a hard one."
- UI toolbar shows current season with icon.
- All seasonal modifiers take effect immediately on transition.

---

## 11 · Audio Design

**Deferred to post-MVP.** No audio systems designed at this time. The architecture supports future addition without affecting existing systems — audio would subscribe to EventBus events and world state, same as the UI layer.

---

## 12 · Impact on Existing GDD

This spec adds new sections to the GDD. It also requires amendments to existing sections:

| GDD Section | Amendment |
|-------------|-----------|
| §2.1 Tick Cycle | Insert `TraitResolverSystem` at position 0.5 (before NeedsDecay). Insert `SeasonSystem` at position 17.5 (after WorldEventSystem, before NotificationSystem). Insert `ChroniclerSystem` at position 18.5 (after NotificationSystem, before VaultSyncSystem — so Chronicler output is persisted in the same tick's sync cycle). `GossipSystem` is not a separate system; gossip exchange is handled within the existing `DialogueSystem` (position 12). |
| §3.1 Entity Hierarchy | Add `traits: string[]` to Agent component. Add Chronicler as special entity kind (no needs, no wallet, no job, no BT, no mortality). |
| §4.2 Social Attributes | Note: Reputation is now contextual via gossip, not just a global number. Global Rep remains as a summary stat; local reputation flows through the relationship graph. |
| §7 Economy | Add §7.6 Director Treasury, §7.7 Monetary Safeguards, §7.8 Welfare Quests |
| §8 Director System | Add §8.6 Scenario System, §8.7 Agent Spawning (manual + candidate pool) |
| §9 World System | Add §9.6 Seasonal Cycles |
| §12.1 Vault Structure | Add `chronicles/`, `legacy/`, `config/traits/`, `config/seasons/`, `scenarios/`, `templates/` (saved custom world templates) |
| §12.2 Agent Schema | Add `traits: z.array(z.string()).default([])` to `AgentSchema` |
| §13 UI/UX | Add Chronicler panel tab, data dashboard overlays (map overlays rendered as a separate ExcaliburJS layer above the world map, toggled via toolbar), smart notification enhancements |
| §14.1 EventBus | Add new events (see §12.2 below) |
| §15.2 Agent BT | Insert `[2.5] Crime Evaluation` node between Survival (2) and Job Duty (3). Sequence: Condition (critical need AND mood <= -20 AND opportunity) → Action (steal/trespass). Also add `respond_to_crime` node to guard BT template. |
| §17 Progression | Note: Trait modifiers (e.g., `workaholic` +10% productivity) apply via the generic modifier pipeline. They affect system calculations but do NOT directly affect skill-by-use counts. Productivity bonuses scale output, not XP/use tracking. |
| §18 Development Phases | Integrate new systems into phasing (see §12.3 below) |
| §18 Post-MVP Roadmap | Remove "Agent Lifecycle (aging, death, succession)" and "Contextual Reputation" — now covered by this spec (§4 mortality/legacy, §9.1 gossip-driven reputation). Aging remains post-MVP. |

### 12.2 New EventBus Events

| Event | Source | Description |
|-------|--------|-------------|
| `SeasonChanged` | SeasonSystem | Emitted on season transition. Payload: previous season, new season. |
| `MilestoneAchieved` | ChroniclerSystem | Emitted when an emergent milestone is detected. Payload: milestone ID, involved agents. |
| `AgentDied` | MortalityCheck | Emitted on agent death. Payload: agent ID, cause, heir ID. |
| `AgentCollapsed` | MortalityCheck | Emitted when agent enters collapsed state. Payload: agent ID, cause. |
| `AgentSpawned` | DirectorAction | Emitted when Director creates an agent. Payload: agent ID, creation method (manual/candidate). |
| `CrimeCommitted` | BehaviorTreeSystem | Emitted when an agent commits a crime. Payload: agent ID, crime type, victim ID, witnesses. |
| `GossipExchanged` | DialogueSystem | Emitted when gossip is shared during conversation. Payload: speaker, listener, gossip type, subject. |
| `TraitAwarded` | TraitResolverSystem | Emitted when a trait is assigned to an agent. Payload: agent ID, trait ID, source (director/definition/milestone/inherited). |
| `TraitRemoved` | TraitResolverSystem | Emitted when a trait is removed from an agent. Payload: agent ID, trait ID. |
| `TraitConflictDetected` | TraitResolverSystem | Emitted when a trait assignment is rejected due to conflicts_with. Payload: agent ID, attempted trait, conflicting trait. |
| `ScenarioStarted` | ScenarioSystem | Emitted when a scenario begins. Payload: scenario ID. |
| `ScenarioCompleted` | ScenarioSystem | Emitted when all scenario goals are met. Payload: scenario ID, score, rating. |
| `ScenarioIncomplete` | ScenarioSystem | Emitted when scenario time limit expires without meeting goals. Payload: scenario ID, goals met, goals missed. |
| `BookmarkCreated` | DirectorAction | Emitted when Director bookmarks a moment. Payload: tick, note. |
| `EraNameAssigned` | DirectorAction | Emitted when Director names an era. Payload: era name, start tick, end tick. |
| `DirectorTaxCollected` | EconomySystem | Emitted on each trade tax collection. Payload: trade ID, tax amount, treasury balance. |
| `WelfareQuestNeeded` | EconomySystem | Emitted when an agent qualifies for welfare. Payload: agent ID, wallet balance. |
| `WelfareQuestPosted` | ChroniclerSystem | Emitted when a welfare quest is generated. Payload: quest ID, target agent ID. |
| `PropertyInherited` | MortalityCheck | Emitted when property transfers on death. Payload: deceased ID, heir ID, property IDs. |
| `CandidatePoolRefreshed` | WorldSystem | Emitted when the candidate pool refreshes. Payload: candidate count. |

### 12.3 Revised Development Phases

| Phase | New Systems Added |
|-------|------------------|
| 0 — Foundation | Trait schema + validation |
| 1 — Agent Core | Trait effects in NeedsDecay + Mood. Mortality toggle. |
| 3 — Social | Gossip layer within DialogueSystem |
| 5 — Economy | Director treasury, tax system, monetary safeguards, welfare quests |
| 6 — Quests | Scenario system (goals, scoring, time limits) |
| 8 — Director UI | Chronicler panel, data dashboards, smart notifications, world builder, story curation tools |
| 10 — Animals | (unchanged) |
| 12 — World Events | Seasonal cycles, season-weighted events |
| 13 — Polish | Crime layer, milestone tracking, full Chronicler narrator, biography generation |

---

## 13 · Platform: Obsidian Plugin

Project Meridian is implemented as an **Obsidian plugin**. The Obsidian vault _is_ the game world. Key implications:

- The Director can inspect and edit any game entity by opening its markdown file directly in Obsidian.
- Chronicler output (chronicles, biographies) is browsable as normal Obsidian notes, linkable and searchable.
- Relationship graphs are viewable in Obsidian's native Canvas view.
- Game UI (world map, management panels) renders in a custom Obsidian view (leaf) using ExcaliburJS + Vue.
- VaultSync leverages Obsidian's file system APIs for read/write/watch.
- Plugin settings map to `game-config.json`.

This also amends the Technology Stack (GDD §31): add `Platform: Obsidian Plugin` as the host environment.

---

## 15 · Polishing Pass (2026-03-27)

After the initial player depth design, a full systems review was conducted. The following issues were identified and resolved in the GDD:

**Critical fixes:**
- Facility operating fund & wage source defined (GDD §6.4): agent-owned facilities pay from operating fund, public facilities from Director treasury
- Spatial model expanded to hybrid region graph + free movement with collision (GDD §9.1)
- FP renamed to Stamina, separated from Energy (GDD §4.3)

**High fixes:**
- DayNightSystem added (GDD §9.2, tick 0.7): 4 phases with perception, energy, mood, and crime effects
- Location modifier defined as hop count on region graph (GDD §7.2)
- Blackboard updated with 7 new fields (GDD §15.1)
- BT priority summary corrected (GDD §6.5)

**Medium fixes:**
- Mood formula External Modifiers term (GDD §4.5)
- Scenario metrics use predefined function catalog
- Immigration event removed from world events
- Candidate pool: 2 weighted + 1-3 random (GDD §22.1)
- LLM priority: Director > Chronicler > agent-to-agent (GDD §10.5)
- Status progression: milestone-driven with triggers (GDD §4.2)
- Agent-created quests: facility auto-quests + goal pursuit templates (GDD §8.2)
- Construction time guidance (GDD §5.4)

**New sections added:**
- §30: Debug Mode & Performance Profiling
- §31: System Requirements (hardware, scaling limits, vault size estimates)

---

## 16 · Open Questions

Items acknowledged but explicitly deferred:

- **Agent aging / generational play** — Post-MVP. Agents currently don't age.
- **Multiplayer / world sharing** — Post-MVP. Worlds are single-Director.
- **Modding support** — The data-driven architecture is inherently mod-friendly. Formal mod API deferred.
- **Camera controls** — Assumed standard: pan, zoom, follow-agent, quick-jump to location. Detailed camera UX to be designed with the UI phase.
- **Content volume estimates** — To be determined during implementation planning. Minimum: 6 agent kinds, 4 species, 15 recipes, 20 items, 10 jobs, 5 world events, 7 traits, 4 seasons, 4 templates, 4 scenarios.
- **LLM cost management** — Budget/rate limiting per session to be designed with the LLM phase. Conversation frequency throttling, cost per tick estimates.
- **Vault I/O performance** — High-frequency state (positions, needs) may need memory-only storage with periodic checkpoint. To be validated during Foundation phase.
- **GURPS opacity** — Director UI should show descriptive labels ("Strong," "Quick") with raw numbers in advanced/debug view. UI design phase concern.
