# Agent World Deepening — "The Living World" Design Spec

> **Date:** 2026-03-20
> **Status:** Approved
> **Scope:** 7 new systems transforming the agent world into a persistent, rhythmic, emergent mini-society — no LLM calls

---

## Overview

Seven interlocking systems that deepen the Flowti Plugin's agent world:

1. **DayClock** — compressed day cycle (~25 min) with phases driving all other systems
2. **Environmental Objects** — interactive furniture (coffee machine, whiteboard, snack table, couch, water cooler, plant, notice board)
3. **Micro-Events** — scheduled/random world events (build breaks, deploy celebrations, standups, eureka moments)
4. **Agent Quirks** — 2-3 behavioral modifiers per agent derived from attributes (pacer, coffee addict, hermit, etc.)
5. **Evolving Relationships** — affinity tracking, opinion clashes, friendship tiers, rivalry bickering
6. **Ambient Visuals** — day/night lighting, weather system, interaction-driven particle effects
7. **Agent Memory** — cross-session persistence of streaks, comfort zones, milestones, recent events

**Design principles:**
- No LLM calls — everything driven by data, timers, randomness, and accumulated state
- Full persistence — relationships, quirks, memory, and preferences survive restarts
- Real + simulated events — real project data drives big moments, simulated events fill gaps
- Compressed time — one full "day" plays out over ~25 minutes regardless of when you open the world
- Director agency — user can click environmental objects to trigger actions

---

## System 1: DayClock

A clock system that compresses a full day into ~25 minutes, serving as the master driver for all other systems.

### Phases

| Phase | % of cycle | ~Duration | Character |
|-------|-----------|-----------|-----------|
| `morning-arrival` | 8% | 2 min | Agents spawn in one by one, greetings, coffee runs |
| `productive-morning` | 25% | 6.25 min | High focus, deep work, few social interruptions |
| `lunch` | 10% | 2.5 min | Agents cluster at snack table, social spike, energy restore |
| `afternoon` | 25% | 6.25 min | Normal work rhythm, conversations pick up |
| `afternoon-slump` | 12% | 3 min | Movement slows, yawning emotes, coffee machine visits spike |
| `wind-down` | 12% | 3 min | Wrapping up, reflective thoughts, farewell conversations |
| `evening-departure` | 8% | 2 min | Agents leave one by one, lights dim |

### Phase effects

Each phase provides:
- **Need rate multipliers** — energy restores faster at lunch, drains faster in slump
- **Phase-specific phrase pools** — morning greetings, lunch chatter, farewell lines
- **Movement bias** — morning: drift toward workstations, lunch: drift toward snack table, evening: drift toward exit
- **Social rate modifiers** — suppressed during productive morning, boosted during lunch/afternoon

### Public API

```typescript
interface DayClock {
  getPhase(): DayPhase;
  getProgress(): number;          // 0-1 within current phase
  getCycleProgress(): number;     // 0-1 across full cycle
  getTimeOfDay(): string;         // "morning" | "midday" | "afternoon" | "evening"
  getCycleCount(): number;        // total completed cycles (persisted)
  onPhaseChange(cb: (phase: DayPhase) => void): void;
}
```

### Need rate multipliers by phase

| Phase | Energy | Social | Focus | Morale |
|-------|--------|--------|-------|--------|
| morning-arrival | ×1.2 | ×1.5 | ×0.5 | ×1.3 |
| productive-morning | ×0.8 | ×0.7 | ×1.3 | ×1.2 |
| lunch | ×1.5 | ×2.0 | ×0.3 | ×1.5 |
| afternoon | ×1.0 | ×1.0 | ×1.0 | ×1.0 |
| afternoon-slump | ×0.6 | ×1.2 | ×0.6 | ×0.7 |
| wind-down | ×1.1 | ×1.3 | ×0.5 | ×1.0 |
| evening-departure | ×1.0 | ×1.5 | ×0.2 | ×1.2 |

### Persistence

Current cycle position and cycle count saved to `.flowti/var/world-clock.json`.

**Resume policy:** On reopen, DayClock calculates elapsed time since `lastUpdated`. If elapsed < total cycle duration, it snaps forward to the correct phase position (skipping intermediate phases). Skipped phase-change events are **not** fired retroactively — guaranteed events for skipped phases are simply missed. If elapsed >= total cycle duration, a fresh cycle starts from `morning-arrival`. This avoids stale mid-cycle state while keeping the world predictable.

### NeedsSystem integration

DayClock exposes `getPhaseMultipliers(): { energy: number; social: number; focus: number; morale: number }`. The engine passes this to `NeedsSystem.update()` via a new fourth parameter:

```typescript
// Updated NeedsSystem.update signature:
update(
  deltaMs: number,
  getState: (name: string) => string,
  getNearby: (name: string) => string[],
  phaseMultipliers?: { energy: number; social: number; focus: number; morale: number },
): void
```

When `phaseMultipliers` is provided, each need's rate is multiplied by the corresponding value before applying. When omitted (backward-compatible), multipliers default to 1.0.

---

## System 2: Environmental Objects

New actor types serving as destinations and interaction points. Each object has autonomous attraction logic plus user-click actions.

### Object definitions

| Object | Scene | Autonomous trigger | User-click action | Visual |
|--------|-------|-------------------|-------------------|--------|
| **Coffee Machine** | Office | Energy < 40 or morning/slump phase | Nearest idle agent goes for coffee | Steam particles when in use, cup emoji bubble |
| **Whiteboard** | Office | Collaboration cluster (3+ agents nearby) | 2-3 idle agents gather for impromptu huddle | Scribble particles, fade after huddle |
| **Snack Table** | Village | Lunch phase or idle + social < 30 | All idle agents drift toward it | Food emoji thought bubbles, social boost |
| **Notice Board** | Hub | Agents occasionally glance when idle | Overlay shows project metrics (health, tests, tasks) | Subtle pin-add animation periodically |
| **Water Cooler** | Village | Random idle chance (15%), social-seeking agents | Two nearest agents start casual conversation | Water-drip particles |
| **Plant** | All scenes | None (decorative) | Nearest agent comments on it | Gentle sway, occasional sparkle |
| **Couch** | Station | On-break agents prefer it | Force-break the hardest-working agent | Cushion-squish animation on sit |

### Architecture

- Base class `InteractableActor extends ex.Actor` with hooks: `onAgentArrive(name)`, `onAgentLeave(name)`, `onDirectorClick()`
- Each object defines an attraction function: `shouldAttract(agentName, phase, needs, brainState) → number` (0 = no attraction, 1 = strong)
- Navigation uses the existing `brainSystem.walkTo(agentName, { x, y })` — the engine extracts the object's interaction point position at the call site, keeping BrainSystem free of ExcaliburJS actor imports
- Objects registered with scenes via config — positions in scene setup

### Needs effects on arrival

| Object | Energy | Social | Focus | Morale |
|--------|--------|--------|-------|--------|
| Coffee Machine | +15 | — | +5 | — |
| Snack Table | +10 | +8 | — | +3 |
| Water Cooler | — | +10 | — | — |
| Couch | +20 | — | — | +5 |
| Whiteboard | — | +5 | +3 | +2 |

---

## System 3: Micro-Events (WorldEventScheduler)

A scheduler that fires periodic events — some real-data-driven, some simulated. Events trigger coordinated multi-agent reactions.

### Event types

| Event | Trigger | Reaction | Visual |
|-------|---------|----------|--------|
| **Build break** | Real sensor OR simulated (1/cycle, afternoon) | All agents look up. Ops agent rushes to console. Engineering agents show "uh oh" bubbles. 15s drama → resolution | Red flash overlay 200ms, alert particles |
| **Deploy success** | Real sensor OR simulated (1/cycle, morning) | Celebration — confetti, high-five emotes, celebration bubbles | Confetti burst 3s, green glow pulse |
| **Standup** | Every cycle during morning phase (~3 min in) | Agents gather in circle, round-robin thought bubbles (2s each), disperse | Circle formation, speaking indicator rotates |
| **New PR** | Real sensor OR simulated (2-3/cycle) | One agent walks to whiteboard, scribbles; nearby agent walks over | Whiteboard scribble particles |
| **Birthday** | Random (10%/cycle, picks one agent) | Cake emoji on snack table, agents cluster, celebration bubbles | Cake particle, party emotes |
| **Power flicker** | Random (5%/cycle, afternoon/slump) | Screen dims 500ms, agents confused (? bubbles), ops agent: "Just a blip" | Opacity dip, question emotes |
| **Tea time** | Every cycle during afternoon phase | 2-3 agents drift to coffee machine, casual conversation triggers | Group movement, steam particles |
| **Eureka moment** | Random (15%/cycle, any work phase) | Working agent jumps up, lightbulb emote, excited bubble, nearby react | Lightbulb particle, star burst |
| **End-of-day bell** | Wind-down phase start | Expanding ring visual, agents start farewell behaviors | Expanding circle wave |

### Scheduler architecture

```typescript
interface ScheduledEvent {
  type: string;
  triggerPhase: DayPhase | DayPhase[];
  probability: number;           // 0-1, rolled on phase entry
  cooldownMs: number;
  guaranteed: boolean;           // true = always fires in eligible phase
  lastFired: number;
  handler: (ctx: EventContext) => void;
}
```

- On each DayClock phase transition, evaluate eligible events and roll probability dice
- Real sensor events **promote** simulated events — if a real build-fail fires, simulated "build break" suppressed for that cycle
- Events are **non-overlapping** — only one scripted event at a time, 30s minimum gap
- Guaranteed events for the same phase are **queued in priority order** (standup before deploy, tea before eureka) and fired sequentially with the 30s gap. If the phase ends before all guaranteed events fire, remaining ones are dropped for that cycle — the phase duration is the hard cap
- Each handler receives full system context (brainSystem, needsSystem, bubbleSystem, particlePool, etc.)

### Default event schedule per cycle

- Morning arrival: deploy success (guaranteed if no real deploy), standup (guaranteed), 1 PR event
- Productive morning: 1-2 PR events, eureka chance (15%)
- Lunch: birthday chance (10%)
- Afternoon: tea time (guaranteed), 1-2 PR events, eureka chance (15%)
- Slump: build break chance (simulated if no real one), power flicker (5%)
- Wind-down: end-of-day bell (guaranteed)

---

## System 4: Agent Quirks & Habits

Each agent gets 2-3 behavioral quirks assigned at registration, derived from attributes + domain, persisted across sessions.

### Quirk pool (15 quirks)

| Quirk | Trigger | Behavior | Derived from |
|-------|---------|----------|-------------|
| `pacer` | Thinking/working | Walks short loops instead of sitting | DEX > 13 |
| `doodler` | Idle near whiteboard | Drifts to whiteboard, scribble particles | CHA > 12 + design/product |
| `coffee-addict` | Any phase | 2x coffee machine frequency, "need coffee" bubbles | CON < 8 |
| `early-bird` | Morning phase | Arrives first, greets everyone | WIS > 14 |
| `night-owl` | Wind-down phase | Last to leave, still working during farewells | INT > 14 |
| `neat-freak` | Idle at workstation | "Tidying" emote, comments on mess | WIS > 12 + quality |
| `fidgeter` | Idle anywhere | Faster bob, "restless" thought bubbles | DEX > 14 + CON < 10 |
| `snacker` | Idle, slump phase | Drifts to snack table, food thought bubbles | Random 20% |
| `social-butterfly` | Any idle | +50% social radius, 2x conversation rate | CHA > 15 |
| `hermit` | Social > 70 | Seeks quiet corner, -30% social radius | CHA < 7 |
| `rubber-ducker` | Working | Self-talk thought bubbles | INT > 12 + engineering |
| `music-lover` | Working/idle | Musical note emotes, playlist comments | Random 25% |
| `plant-parent` | Idle near plant | Drifts to plant, comments, water emote | Random 15% |
| `whiteboard-warrior` | Collaboration | Always at whiteboard during huddles | CHA > 12 + management/orchestration |
| `stretcher` | Every ~5 min work | Stand, stretch emote, brief wander, return. Energy +3 | CON > 12 |

### Implementation

- On first registration, roll quirks from eligible pool (attribute/domain filters)
- Pick 2-3 quirks weighted by qualification strength
- Persisted in agent data file as `quirks: string[]`
- Each quirk registers a `QuirkModifier`: `{ modifyParams?, modifyMovement?, modifyIdle?, emoteChance?, phraseBias? }`
- Brain system applies active quirk modifiers during state transitions
- Quirk-specific phrase pools (5-8 lines each) injected into talk engine when quirk triggers

---

## System 5: Evolving Relationships

A `RelationshipSystem` tracking how agents feel about each other, evolving through interactions.

### SocialSystem integration

RelationshipSystem does **not** modify SocialSystem. Instead, the engine wires relationship updates inside the existing `onConversation` and `onCluster` callbacks — same pattern as the existing bubble/brain wiring. The engine calls `relationshipSystem.recordConversation(nameA, nameB)` as an additional step inside the `socialSystem.onConversation(...)` closure. No new callbacks are added to SocialSystem.

### Relationship entry

```typescript
interface RelationshipEntry {
  agentA: string;
  agentB: string;
  affinity: number;              // -100 to 100
  interactionCount: number;
  lastInteraction: number;       // timestamp
  sharedMemories: string[];      // max 5 event descriptions
  opinion: string | null;        // template-generated description
}
```

### Affinity tiers

| Range | Tier | Behavior |
|-------|------|----------|
| -100 to -30 | **Rival** | Avoid each other, snarky templates, occasional bickering |
| -29 to 15 | **Acquaintance** | Neutral interactions, generic social templates |
| 16 to 50 | **Colleague** | Prefer working nearby, domain conversations unlock |
| 51 to 80 | **Friend** | Seek each other during breaks, inside jokes unlock, shared lunch |
| 81 to 100 | **Best friend** | Walk together, paired bubble sequences, defend during incidents |

### Affinity changes

| Event | Change |
|-------|--------|
| Pair conversation | +2 |
| Cluster huddle together | +1 per participant |
| Adjacent workstations (per 5 min) | +1 |
| Collaborated on same task | +5 |
| Both reacted to same sensor event | +1 |
| No interaction for full cycle | -1 (drift toward 0) |
| Rival forced proximity | -2 |
| Birthday celebration attended | +3 to birthday agent |
| Opinion clash (bicker) | -3 |

### Opinion system

Agents get 2-3 opinions from a pool of ~15 topics at registration:

Topics: `tabs-vs-spaces`, `tdd-vs-write-after`, `react-vs-svelte`, `vim-vs-vscode`, `dark-vs-light-mode`, `meetings-vs-async`, `monolith-vs-microservices`, `coffee-vs-tea`, `early-vs-late`, `docs-vs-code-speaks`, `rebase-vs-merge`, `types-vs-dynamic`, `css-vs-tailwind`, `agile-vs-kanban`, `deploy-friday-vs-never`

Each opinion has side A or B. Same side → +1 affinity on discovery, "agreement" templates. Opposing → 30% bicker chance per conversation → affinity -3.

### Conversation template selection

- **Acquaintance**: generic social pool
- **Colleague**: + domain-specific pool
- **Friend**: + inside joke pool + shared memory references
- **Best friend**: + finishing sentences + paired bubble sequences
- **Rival**: + bickering pool (replaces 30% of interactions)

### Persistence

Full relationship map saved to `.flowti/var/world-relationships.json`.

---

## System 6: Ambient Visuals (WorldAmbience)

Environmental atmosphere — lighting, weather, and interaction-driven particles.

### Day/night lighting

Tied to DayClock phase — a background overlay that shifts across the cycle:

| Phase | Tint | Opacity |
|-------|------|---------|
| morning-arrival | warm gold `rgb(255, 200, 100)` | 0.05 |
| productive-morning | none | 0 |
| lunch | warm `rgb(255, 210, 130)` | 0.03 |
| afternoon | none | 0 |
| afternoon-slump | amber `rgb(200, 150, 80)` | 0.08 |
| wind-down | cool blue `rgb(100, 120, 200)` | 0.06 |
| evening-departure | blue-purple `rgb(80, 80, 160)` | 0.12 |

Implemented as full-screen `ex.Canvas` at z=500 (above agents at default z, below bubbles at z=998 and cursor spirit at z=999), phase transitions use 3s lerp. The existing particle renderer sits at z=-10 (below scene floor), and scene backgrounds are at z=0. The lighting overlay must be above all scene content to tint everything.

### Weather system

Decorative ambient particles cycling every 2-3 day cycles:

| Weather | Visual | Agent comments |
|---------|--------|----------------|
| `clear` | No particles, standard lighting | "Nice day" |
| `rain` | Diagonal blue-gray streaks (20-30 active) | "Still raining?", "Cozy weather for coding" |
| `overcast` | Gray tint overlay, slightly dimmer | "Gray sky matches my mood" |
| `sunny` | Gold sparkle particles (8-10, slow drift) | "Sun's out, code's out" |

No gameplay effect — purely atmospheric. Talk engine queries `getWeather()` for phrase selection.

### Interaction particle presets

| Trigger | Preset | Details |
|---------|--------|---------|
| Agents greet | `hearts` | 3 particles between them, 0.5s |
| Coffee machine use | `steam` | 6 particles rising, 2s |
| Couch sit | `cushion` | 4 particles outward, 0.3s |
| Whiteboard collab | `scribble` | Colored dots near board, 3s |
| Birthday | `confetti` | 30 particles multi-color, 4s |
| Deploy success | `firework` | 15 particles expanding ring, green, 2s |
| Build break | `alert` | Screen-edge glow, red, 0.5s flash |
| Eureka | `lightbulb` | 8 particles gold star burst, 1.5s |
| Best friend reached | `sparkle-arc` | 5 particles connecting arc, 1s |
| Rival bicker | `thunder` | Gray cloud particles above both, 2s |

### Implementation

- Extend `ParticlePool` with `ParticlePreset` enum and preset configs
- Increase pool from 200 → 400 particles
- `WorldAmbience` system owns lighting canvas + weather state
- Exposes `getWeather()` and `getLighting()` for other systems

---

## System 7: Agent Memory & Continuity

Cross-session persistence of agent state — streaks, comfort zones, milestones, recent events.

### Per-agent memory structure

Persisted in existing `data-{agentName}.json` in `.flowti/var/`:

```typescript
interface AgentMemory {
  // Comfort & habits
  preferredSpot: { x: number; y: number; scene: string } | null;
  preferredObject: string | null;
  visitCounts: Record<string, number>;

  // Streaks & milestones
  workStreak: number;
  socialStreak: number;
  daysActive: number;
  longestWorkStreak: number;
  milestones: string[];              // max 10

  // Recent memory (rolling window)
  recentEvents: Array<{
    cycle: number;
    type: string;
    with?: string;
    summary: string;
  }>;                                // max 20

  // Mood history
  moodLog: Array<{ cycle: number; dominant: string }>;  // last 10

  // From other systems
  opinions: Array<{ topic: string; side: "A" | "B" }>;
  quirks: string[];
}
```

### Migration & defaults

When `MemorySystem` loads an existing `data-{agentName}.json` that lacks the new `AgentMemory` fields, all fields initialize to safe defaults: `preferredSpot: null`, `visitCounts: {}`, `workStreak: 0`, `quirks: []` (triggers first-registration quirk roll), `opinions: []` (triggers opinion assignment), `milestones: ["first-day"]`, `recentEvents: []`, `moodLog: []`, `daysActive: 0`. This means existing agents seamlessly gain memory on first load with no migration script needed.

### Memory effects on behavior

| Memory | Effect |
|--------|--------|
| Preferred spot | Drifts back during idle. If occupied: slight morale dip, "someone's in my spot" |
| Preferred object | 2x attraction weight. Comments: "My usual spot" |
| Work streak ≥3 | Proud thoughts: "Three days running". Break: "That streak was nice while it lasted" |
| Social streak ≥3 | +20% social radius. Break: "Been keeping to myself lately" |
| Days active milestones | Celebration micro-event at 5, 10, 25, 50, 100 cycles |
| Recent events | Talk engine references: "Still thinking about yesterday's deploy" |
| Mood log (3+ same) | "I've been feeling {mood} a lot lately". Triggers self-care behavior |

### Milestones (15)

| Milestone | Trigger | Reaction |
|-----------|---------|----------|
| `first-day` | First cycle | "New here! Taking it all in" |
| `first-friend` | Relationship → Friend | "I think {name} and I really click" |
| `best-friend` | Relationship → Best Friend | "{name} gets me" |
| `first-rivalry` | Relationship → Rival | "{name} and I disagree on everything" |
| `coffee-regular` | 20 coffee visits | "The barista knows my order. Wait, there's no barista" |
| `social-butterfly` | 50 conversations | "I've talked to everyone about everything" |
| `work-streak-5` | 5-cycle streak | "Five days strong" |
| `work-streak-10` | 10-cycle streak | "Double digits. Don't jinx it" |
| `survivor` | 10 build breaks | "I've seen things. Build things" |
| `early-adopter` | 25 cycles | "Been here since the early days" |
| `veteran` | 100 cycles | "I remember when this office was empty" |
| `peacemaker` | Rival → Colleague | "We worked it out. Growth is real" |
| `night-owl-champion` | Last to leave 10x | "Someone has to close up" |
| `team-player` | 20 huddles/rituals | "Every standup, every retro. I show up" |
| `green-thumb` | 15 plant interactions | "I'm emotionally attached to this plant" |

### Cycle boundary

When DayClock completes a full cycle (evening departure ends), MemorySystem:
1. Logs dominant mood for the cycle
2. Updates streaks (work streak ++/reset, social streak ++/reset)
3. Checks milestone triggers
4. Prunes recentEvents to last 20
5. Writes all agent data files

---

## System Interconnection Map

```
DayClock ──→ phase/time ──→ NeedsSystem (rate multipliers)
   │                    ──→ TalkEngine (phrase pool selection)
   │                    ──→ BrainSystem (movement bias)
   │                    ──→ WorldEventScheduler (event eligibility)
   │                    ──→ WorldAmbience (lighting, weather)
   │
   ├──→ Environmental Objects ←── BrainSystem (attraction navigation)
   │         ↕                ←── DirectorSystem (user clicks)
   │    NeedsSystem (effects on arrival)
   │
   ├──→ WorldEventScheduler ←── SensorSystem (real events promote/suppress)
   │         ↓
   │    BrainSystem + BubbleSystem + ParticlePool (choreographed reactions)
   │
   ├──→ Agent Quirks ──→ BrainSystem (param modifiers)
   │                 ──→ TalkEngine (quirk phrase pools)
   │
   ├──→ RelationshipSystem ←── SocialSystem (conversation events)
   │         ↓              ←── WorldEventScheduler (shared experiences)
   │    TalkEngine (tier-specific templates)
   │    BrainSystem (seek/avoid movement bias)
   │
   └──→ MemorySystem ←── all systems (event logging)
            ↓
       TalkEngine (memory references)
       BrainSystem (comfort zone drift)
       Persistence (.flowti/var/)
```

---

## New files

| File | Purpose |
|------|---------|
| `src/game/systems/day-clock.ts` | DayClock system — phase management, time progression, multipliers |
| `src/game/systems/world-event-scheduler.ts` | Micro-event scheduler — event queue, probability, choreography |
| `src/game/systems/relationship-system.ts` | Affinity tracking, opinion clashes, tier-driven template selection |
| `src/game/systems/memory-system.ts` | Per-agent cross-session persistence, streaks, milestones |
| `src/game/systems/world-ambience.ts` | Lighting overlay, weather state, ambient particle management |
| `src/game/systems/quirk-system.ts` | Quirk assignment, modifier application, quirk phrase injection |
| `src/game/actors/interactable-actor.ts` | Base class for clickable/attracting environmental objects |
| `src/game/actors/coffee-machine.ts` | Coffee machine actor |
| `src/game/actors/whiteboard-actor.ts` | Whiteboard actor |
| `src/game/actors/snack-table.ts` | Snack table actor |
| `src/game/actors/notice-board.ts` | Notice board actor (with project metrics overlay) |
| `src/game/actors/water-cooler.ts` | Water cooler actor |
| `src/game/actors/plant-actor.ts` | Decorative plant actor |
| `src/game/actors/couch-actor.ts` | Couch/rest area actor |
| `src/game/data/day-phase-config.ts` | Phase definitions, need multipliers, movement biases |
| `src/game/data/quirk-definitions.ts` | Quirk pool with attribute filters and modifiers |
| `src/game/data/opinion-topics.ts` | Opinion topic pool with sides A/B |
| `src/game/data/micro-event-definitions.ts` | Event type definitions with phase/probability/handlers |
| `src/game/data/relationship-templates.ts` | Tier-specific conversation templates (friend, rival, etc.) |
| `src/game/data/milestone-definitions.ts` | Milestone triggers and reaction templates |
| `src/game/data/weather-config.ts` | Weather states, particle configs, phrase tags |
| `src/game/data/quirk-phrases.ts` | Per-quirk phrase pools (5-8 lines each) |
| `tests/game/systems/day-clock.test.ts` | DayClock tests |
| `tests/game/systems/world-event-scheduler.test.ts` | Scheduler tests |
| `tests/game/systems/relationship-system.test.ts` | Relationship + affinity tests |
| `tests/game/systems/memory-system.test.ts` | Memory persistence + milestone tests |
| `tests/game/systems/world-ambience.test.ts` | Lighting + weather tests |
| `tests/game/systems/quirk-system.test.ts` | Quirk assignment + modifier tests |
| `tests/game/actors/interactable-actor.test.ts` | Environmental object interaction tests |

### Modified files

| File | Changes |
|------|---------|
| `src/game/engine.ts` | Wire all 7 new systems, environmental objects, phase-driven updates |
| `src/game/systems/brain-system.ts` | Quirk modifiers via `applyQuirkOverrides(name, overrides)`, relationship-driven drift bias |
| `src/game/brain/agent-brain.ts` | `computeParams` / `computeHabits` accept optional quirk overrides for param adjustment |
| `src/game/systems/needs-system.ts` | Accept phase multipliers as 4th param to `update()` |
| `src/game/systems/social-system.ts` | No changes — relationship wiring done in engine.ts inside existing callbacks |
| `src/game/systems/engagement-system.ts` | Phase-aware engagement (suppress during productive morning) |
| `src/game/systems/talk/talk-engine.ts` | Query DayClock phase, weather, relationships, memory for template selection |
| `src/game/systems/particle-system.ts` | Add ParticlePreset enum, preset configs, pool increase 200→400 |
| `src/game/scenes/office-scene.ts` | Add coffee machine, whiteboard objects |
| `src/game/scenes/village-scene.ts` | Add snack table, water cooler objects |
| `src/game/scenes/station-scene.ts` | Add couch object |
| `src/game/scenes/hub-scene.ts` | Add notice board, plant objects |
| `src/game/store/dashboard-store.ts` | Expose DayClock state, weather, relationship data to UI |
| `src/game/data/world-config.ts` | Add day cycle, weather, quirk, relationship config sections |
| `tests/game/engine.test.ts` | Update mocks for new systems |

---

## WorldConfig extensions

New sections added to `DEFAULT_WORLD_CONFIG` in `data/world-config.ts`:

```typescript
dayCycle: {
  durationMs: 1_500_000,           // 25 minutes total cycle
  phases: DayPhase[],              // ordered phase definitions with percentage
},
weather: {
  cycleLengthInDayCycles: 2,       // weather changes every N day cycles
  states: ["clear", "rain", "overcast", "sunny"],
},
quirks: {
  maxPerAgent: 3,
  minPerAgent: 2,
},
relationships: {
  affinityDecayPerCycle: 1,        // drift toward 0 when no interaction
  bickerChance: 0.3,              // probability of opinion clash → bicker
  maxSharedMemories: 5,
},
```

### Quirk modifier API

QuirkSystem provides overrides to BrainSystem via a simple data object — no type dependency from BrainSystem on QuirkSystem:

```typescript
interface QuirkOverrides {
  socialRadiusMultiplier?: number;  // e.g., 1.5 for social-butterfly, 0.7 for hermit
  idleResistanceMultiplier?: number;
  moveSpeedMultiplier?: number;
  coffeeAttractionMultiplier?: number;
  conversationRateMultiplier?: number;
}
```

`BrainSystem.applyQuirkOverrides(name, overrides)` stores these per-agent and factors them into `computeParams`. This keeps BrainSystem unaware of the quirk concept — it just applies numeric multipliers.

### Relationship `opinion` field

The `opinion` field on `RelationshipEntry` is populated by `RelationshipSystem` when affinity crosses a tier boundary. It uses template strings like `"thinks {agentB} is hilarious"` (Friend), `"respects {agentB}'s focus"` (Colleague), `"can't stand {agentB}'s taste in editors"` (Rival). The opinion is displayed in the agent panel UI and referenced by the talk engine for relationship-aware phrases.

---

## Implementation phases (recommended order)

To reduce blast radius, implement in 3 phases:

1. **Phase A — Foundation** (DayClock + WorldAmbience + Agent Memory persistence)
2. **Phase B — Behavior** (Quirks + Environmental Objects + Micro-Events)
3. **Phase C — Social depth** (Relationships + opinion system + tier templates)

Each phase is independently shippable and testable.

---

## Persistence files

| File | Content |
|------|---------|
| `.flowti/var/world-clock.json` | `{ cycleCount, currentPhase, phaseProgress, lastUpdated }` |
| `.flowti/var/world-relationships.json` | `{ relationships: RelationshipEntry[] }` |
| `.flowti/var/world-weather.json` | `{ current, lastChanged, cyclesSinceChange }` |
| `.flowti/var/data-{agentName}.json` | Extended with `AgentMemory` fields (quirks, opinions, streaks, milestones, etc.) |
