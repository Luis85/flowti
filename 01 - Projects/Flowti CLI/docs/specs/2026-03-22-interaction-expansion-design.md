# Interaction System Expansion — Design Spec

## Overview

Expand the live interaction system from agent-only to full entity coverage, migrate four bypassing behaviors through the bus, and grow template content from 26 to ~100.

Three independent layers, each delivering value on its own:

1. **Complete the wiring** — register pet, NPC, and room resolvers
2. **Migrate bypassing behaviors** — route 4 direct-effect behaviors through the bus
3. **Template expansion** — grow from 26 to ~100 templates with differentiated weights, tags, and chains

---

## Layer 1: Complete the Wiring

### Pet Resolvers

Register a `PetIntentResolver` per pet during engine startup, matching the pattern used for agents in `engine-startup.ts`.

**Wiring point:** After pets are created in `engine.ts`, call `registerPetResolver()` for each pet. The pet resolver needs:
- `petId` — pet entity ID
- `getNearby()` — delegates to `SocialSystem.getNearbyEntities(petId)`
- `getPetState()` — returns `{ hunger, thirst, energy, affinity }` from the pet actor's state
- `getHistory()` — delegates to `bus.getHistory()`
- `templates` — the shared template registry from bootstrap

**Tick integration:** Pet resolvers are not BT-driven (pets don't use the agent BT). Instead, call `resolver.resolve()` during the `tickPets` phase and submit any resulting interactions to the bus. This replaces direct pet behaviors with bus-routed interactions.

**Templates unlocked:** `zoomies-disruption`, `sit-between`, `comfort-sad-agent` (3 pet-social templates already exist).

### NPC Resolver

Create one `NPCIntentResolver` for the merchant NPC.

**Wiring point:** After InteractionSystem bootstrap in `engine.ts`, create the merchant resolver with rule tables:
- Proximity trigger (agent within 3 units) → `merchant-pitch`
- Idle-timeout trigger (no agents nearby) → `merchant-idle-grumble`
- Schedule trigger (always eligible) → `merchant-comment-on-pair`

**Tick integration:** Call `resolver.resolve()` during `tickInteractions` phase. The resolver is registered on the bootstrap's `resolvers.entities` map and ticked alongside agent resolvers.

**getNearby dependency:** The merchant NPC needs a position in the SceneRegistry. If the merchant stall interactable already has a position, use that as the NPC's location for proximity queries.

**Templates unlocked:** `merchant-pitch`, `merchant-idle-grumble`, `merchant-comment-on-pair` (3 NPC templates already exist).

### Room Resolvers

Create one `RoomIntentResolver` per room (hub, office, village, station).

**Wiring point:** After InteractionSystem bootstrap in `engine.ts`, create four room resolvers. Each needs:
- `roomId` — room identifier (e.g., `"hub"`, `"office"`)
- `roomType` — room type for rule matching
- `rules` — room interaction rules (conditions + interaction templates)
- `getOccupancy()` — count of entities in room via `SceneRegistry`
- `getOccupantIds()` — list of entity IDs in room via `SceneRegistry`
- `getCollectiveMood()` — derive from average mood of occupants via `NeedsSystem`
- `getPhase()` — current day phase via `DayClock`

**Tick integration:** Room resolvers are ticked during `tickInteractions`, like NPC resolvers. Only reactive and active layer rules fire — passive rules are stat-only (handled by room configuration, not the bus).

**Collective mood derivation:** Average the morale of all agents in the room. Map to a mood string: `<30` → `"stressed"`, `30-60` → `"neutral"`, `>60` → `"relaxed"`, `>80` → `"energized"`. Intensity is the raw average.

**Templates unlocked:** `crunch-time-pressure`, `celebration-vibe`, `quiet-focus` (3 room templates already exist).

---

## Layer 2: Migrate Bypassing Behaviors

### Pet Proximity Reactions → Interaction Templates

**Current behavior** (`engine-simulation.ts` `checkPetProximityReactions`): When a pet is within interact radius of an agent, show a thought bubble (from PET_DEFINITIONS phrases), apply pet needs effects, spawn heart particles. Gated by `petReactionCooldowns` map.

**Migration:** Pet resolver produces a `pet-proximity-comfort` interaction when near an agent. Template effects replace the direct needs application + bubble rendering. The bus's built-in cooldown system replaces the manual `petReactionCooldowns` map.

**New template:** `pet-proximity-comfort` with:
- Category: `care`, initiatorTypes: `["pet"]`, targetTypes: `["agent"]`
- Prerequisites: `[{ type: "proximity", maxDistance: <pet interact radius> }]`
- Effects: need-change (morale +3 on target), bubble (reactive:comfort on initiator), particle (hearts)
- CooldownMs: matches current `PET_REACTION_COOLDOWN` value

**Removal:** Delete `checkPetProximityReactions()` from `tickPets` and `petReactionCooldowns` from engine state. The pet resolver's tick handles this now.

### Pet Catalyst Conversations → Interaction Templates

**Current behavior** (`engine-simulation.ts` `tryPetCatalystConversation`): When a pet is near two agents (0.05% chance per frame), calls `conversationEngine.tryScript()` directly with `"pet-catalyst"` trigger.

**Migration:** Pet resolver produces a `pet-catalyst-social` interaction when near 2+ agents. The interaction's effect triggers the ConversationEngine indirectly — the effect produces a `bubble` action with `phrasePool: "reactive:pet-catalyst"`, which the effect renderer routes to TalkEngine. The CE's own proximity-triggered scripts continue to handle the multi-turn conversation separately.

**Alternative approach:** Since CE pet-catalyst scripts are multi-turn (not single bubbles), the cleaner migration is: the pet resolver submits a `pet-catalyst-social` interaction with no bubble effects, just affinity and social need boosts. The interaction acts as the "pet brought them together" moment, and CE's own proximity triggering handles whether a full conversation starts. This avoids duplicating CE's script selection logic in the interaction system.

**New template:** `pet-catalyst-social` with:
- Category: `social`, initiatorTypes: `["pet"]`, targetTypes: `["agent"]`
- Prerequisites: proximity (nearby 2+ agents)
- Effects: affinity-change (+2 between targets), need-change (social +3 on targets)
- Weight: 1 (rare), cooldownMs: 120000
- No bubble — the social proximity naturally triggers CE scripts separately

**Removal:** Delete `tryPetCatalystConversation()` from `tickPets`. The pet resolver handles the "pet brings agents together" moment.

### Pet Share Interactions → Interaction Templates

**Current behavior** (`engine-pet-share.ts` `checkPetShareInteraction`): When pet is near an occupied food/drink station, both pet and agent get needs effects. Shows bubbles.

**Migration:** Pet resolver produces a `pet-share-food` or `pet-share-drink` interaction when near an agent at a food/drink station. Template effects apply needs to both parties.

**New templates:**
- `pet-share-food`: care category, pet→agent, effects: hunger +10 on all, bubble on initiator
- `pet-share-drink`: care category, pet→agent, effects: thirst +10 on all, bubble on initiator
- CooldownMs: matches current `petShareCooldowns` interval

**Removal:** Delete `checkPetShareInteraction()` call from `tickPets` and `petShareCooldowns` from engine state. Remove `engine-pet-share.ts` import.

### WorldEventScheduler → Interaction Submissions

**Current behavior** (`world-event-scheduler.ts`): Fires handler callbacks for micro-events. Handlers modify state directly.

**Migration:** Give the scheduler a reference to the interaction bus. When a world event fires, instead of calling handlers, submit an interaction using the matching environment template:
- Build break → `build-break-reaction` template
- Deploy success → `deploy-celebration` template
- Other events → map to existing or new environment templates

**Wiring:** Pass `interactionBootstrap.system.getBus()` to the WorldEventScheduler constructor or via a setter. The scheduler creates interactions with `initiatorTypes: ["room"]`, targeting all agents in the affected room.

**Fallback:** Events that don't map to templates still fire their existing handlers. This is additive — the scheduler gains interaction submission alongside its existing handler mechanism. Old handlers can be removed incrementally as templates cover their effects.

---

## Layer 3: Template Expansion

### Expansion Targets

| Category | Current | Target | Theme |
|----------|---------|--------|-------|
| social | 7 | 20 | Phase greetings, departures, domain banter, gossip, milestones |
| work | 1 | 10 | Pair debug, code review, brainstorm, deadline stress, mentoring |
| reactive | 2 | 12 | Bumped-into, overheard, mood-noticed, someone-returned, awkward-silence |
| care | 3 | 10 | Check-in, bring-coffee, suggest-break, notice-overwork, encourage |
| playful | 3 | 10 | Prank, inside-joke, competitive-challenge, show-off, celebrate-streak |
| environmental | 2 | 10 | Weather-mood, lunch-rush, wind-down, morning-energy, late-night |
| commerce | 1 | 8 | Browse, haggle, special-offer, loyalty, impulse-regret, show-purchase |
| directive | 3 | 8 | Praise, redirect, rally, one-on-one, delegate, announce |
| cross-type | 3 | 12 | Post-commerce gossip, post-care gratitude, post-play escalation |

**Total: 26 → ~100 templates**

### Template Design Principles

- **Differentiated weights** (1-5 scale): common ambient interactions weight 4-5, rare special moments weight 1
- **Unique tag combinations**: each template has at least one distinctive tag beyond its category
- **Phase filters**: morning greetings, lunch invites, afternoon venting, evening departures
- **Tier ranges**: rivals get snarky interactions, best-friends get vulnerable ones, acquaintances get surface-level
- **Chain templates**: follow-up cascades with decreasing `chainChance` (e.g., 20% → 10% → 5%)
- **phrasePool IDs**: reference existing TalkEngine reactive triggers or template-specific pools

### No Code Changes Required

Template expansion is pure data — new entries in existing template files using the `InteractionTemplate` type. The bus, resolvers, and renderer handle everything. The only code change is importing new template arrays into the bootstrap aggregation if new files are created.

---

## Architecture Constraints

- **CLI domain stays pure** — all templates and bus logic in CLI domain, no infrastructure imports
- **Plugin does wiring only** — engine.ts, engine-startup.ts, engine-simulation.ts connect systems
- **Bus is the single path** — after migration, no game behavior applies interaction-like effects directly
- **Cooperative locks respected** — all new resolver submissions go through the bus, which checks CE locks
- **Backwards compatible** — if InteractionSystem is absent (tests, standalone), all behaviors gracefully no-op

---

## Testing Strategy

- **Layer 1:** Integration tests per resolver type (pet, NPC, room) — verify resolve() produces correct interactions given mock system state
- **Layer 2:** Before/after tests — verify same observable effects (needs changes, bubbles) occur through the bus path as through the old direct path. Remove old tests for deleted functions.
- **Layer 3:** Template validation tests — verify all templates parse, have valid effect types, and unique IDs. No behavioral tests needed (bus tests cover execution).

---

## Out of Scope

- Trust tier / has-item prerequisite implementation (awaits economy system)
- CE trigger migration (BT social → bus → CE)
- NPC spawning system (merchant is a fixed environmental object)
- Object attraction migration (needs-driven urgency, not a social interaction)
- Reactive trigger migration (internal thought bubbles, not entity interactions)
- New effect types or bus mechanics
- Template count beyond ~100 (incremental content work)
