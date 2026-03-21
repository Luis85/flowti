# Hunger & Thirst System — Design Spec

**Date:** 2026-03-21
**Status:** Draft
**Scope:** Flowti Plugin — Agent World game engine

## Overview

Add hunger and thirst as sub-drivers of energy to create a daily sustenance rhythm for agents and pets. When hunger or thirst runs low, energy decays faster — forcing agents and pets to seek food/drink stations. Pets compete with agents for stations (steal/share mechanic). All objects use Ninja Adventure sprite assets.

## Data Model

### AgentNeeds Extension

Two new fields on the existing `AgentNeeds` interface (defined in `needs-system.ts`, mirrored in `bt-types.ts` and `social-system.ts`):

```
hunger: 0-100 (100 = full, 0 = starving)
thirst: 0-100 (100 = hydrated, 0 = parched)
```

These are **energy sub-drivers**, not independent threshold triggers. When low, they apply a configurable multiplier to energy decay rate:

- `hunger < 40` → energy decay multiplied by configurable factor (default 1.5x)
- `thirst < 30` → energy decay multiplied by configurable factor (default 1.5x)
- Both low → multipliers stack (default 2.25x)

**Multiplier application order:** The energy drain formula becomes:
```
energyDelta = baseRate * attrMod * phaseMult * hungerMult * thirstMult
```
Hunger/thirst multipliers apply last, after attribute modifiers and phase multipliers.

### NeedsEntry + NeedsEffect Types

The internal `NeedsEntry` in NeedsSystem gains `hunger` and `thirst` fields. All methods that enumerate needs (`register`, `applyEffect`, `getNeeds`, `serialize`, `restore`, `update`) are extended.

The `needsEffects` type in `InteractableConfig` and `PetDefinition` becomes:
```
Partial<{ energy: number; social: number; focus: number; morale: number; hunger: number; thirst: number }>
```

### Decay Rates (per second, baseline)

Extend the existing `DECAY` constant in NeedsSystem:

| State | Hunger | Thirst |
|-------|--------|--------|
| working | -0.6 | -0.8 |
| idle | -0.2 | -0.3 |
| wandering | -0.3 | -0.4 |
| walking-to | -0.2 | -0.3 |
| talking | -0.3 | -0.5 |
| on-break | -0.1 | -0.1 |

Thirst decays ~30% faster than hunger across all states. All rates are configurable via `world-config.ts` and intended as starting points — tune after observation.

### Day-Phase Multipliers

Extend existing phase multiplier config:

| Phase | Hunger Mult | Thirst Mult |
|-------|------------|-------------|
| morning-arrival | 1.0 | 1.5 |
| productive-morning | 1.0 | 1.0 |
| lunch | 2.0 | 1.3 |
| afternoon | 1.0 | 1.0 |
| afternoon-slump | 1.5 | 1.2 |
| wind-down | 0.8 | 0.8 |
| evening-departure | 0.5 | 0.5 |

### Pet Needs

Pets get hunger and thirst with the same 0-100 scale. Simpler decay: constant rate regardless of state (configurable, default hunger -0.3/s, thirst -0.4/s). No day-phase multipliers for pets. Pet needs state is stored on PetActor (or PetSceneEntity) and updated in the engine tick loop alongside `updateBehavior()`.

### Initial Values

Agents: hunger 80, thirst 80 (matching existing energy pattern).
Pets: hunger 70, thirst 70.

### Configuration

All rates, thresholds, multipliers, and initial values stored in `world-config.ts` under the existing `needs` config block. Enables tuning after observation.

### Persistence

Hunger and thirst are saved/restored via the existing `world-needs.json` persistence path in NeedsSystem. Pet hunger/thirst are saved alongside pet positions in `world-positions.json`.

## Station Retrofit + Pet Bowls

### Existing Objects — Added Effects

| Station | Room | Current Effects | Added Effects |
|---------|------|----------------|---------------|
| CoffeeMachine | office | energy +15, focus +5 | thirst +20 |
| SnackTable | village | energy +10, social +8, morale +3 | hunger +25 |
| WaterCooler | village | social +10 | thirst +15 |

### New Objects

| Object | Rooms | Usable By | Hunger Effect | Thirst Effect | Other |
|--------|-------|-----------|---------------|---------------|-------|
| FoodBowl | hub, village | pets (primary), agents (reduced) | pet +30, agent +10 | — | — |
| WaterBowl | office, station | pets (primary), agents (reduced) | — | pet +25, agent +8 | — |

### Food/Drink Availability by Room

| Room | Hunger Sources | Thirst Sources |
|------|---------------|----------------|
| hub | FoodBowl | — |
| office | — | CoffeeMachine, WaterBowl |
| village | SnackTable, FoodBowl | WaterCooler |
| station | — | WaterBowl |

Agents in rooms without food (office, station) must cross-room transfer to eat. The BT `SeekFoodStation` action maintains a static lookup of which rooms have food-capable stations to pick the transfer target.

### Sprite Assets (Ninja Adventure)

| Station | Sprite | Path |
|---------|--------|------|
| CoffeeMachine | MilkPot.png | Items/Potion/MilkPot.png |
| SnackTable | Onigiri.png | Items/Food/Onigiri.png |
| WaterCooler | WaterPot.png | Items/Potion/WaterPot.png |
| FoodBowl | Meat.png | Items/Food/Meat.png |
| WaterBowl | Gourd.png | Items/Object/Gourd.png |

Sprites are 16x16 pixel art, scaled 2-3x in-game (32-48px) to match actor sizes.

**Loading approach:** Add a `loadItemSprite(basePath, itemPath, scale): Promise<ex.Sprite>` utility to `sprite-loader.ts` for single-frame item sprites. Station actors call this during initialization and apply via `this.graphics.use(sprite)`, replacing Canvas-drawn graphics.

### Steal/Share Mechanic

Determined by arrival order at a station:

**Pet arrives first (steal):**
- Pet occupies station via `occupy()`
- Agent BT checks `isOccupied()` → fails → agent gets reaction bubble (e.g., "Hey! That's my coffee!")
- Agent seeks alternative station or waits
- Pet vacates after normal interaction duration

**Agent arrives first (share):**
- Agent occupies station
- Per-frame proximity check in engine tick loop (alongside existing pet-agent reaction code): if a hungry/thirsty pet is within interaction radius of an occupied food/drink station, trigger share
- Pet gets effects without formally occupying (no multi-occupancy needed)
- Agent gets social +3 bonus for bonding
- Heart particles spawn between agent and pet
- Share has a 30s cooldown per agent-pet pair (same pattern as existing petReactionCooldowns)

### Object Attraction Updates

Extend the `objectAttractions` array in engine.ts with hunger/thirst triggers (additive alongside existing energy/social checks):

```
{ object: snackTable, phase: ["lunch", "afternoon-slump"], needCheck: (n) => n.hunger < 40, chance: 0.002 }
{ object: coffeeMachine, phase: ["morning-arrival", "afternoon-slump"], needCheck: (n) => n.thirst < 40, chance: 0.002 }
{ object: waterCooler, phase: ["afternoon", "afternoon-slump"], needCheck: (n) => n.thirst < 30, chance: 0.001 }
{ object: foodBowl, phase: ["lunch"], needCheck: (n) => n.hunger < 25, chance: 0.001 }
{ object: waterBowl, phase: [], needCheck: (n) => n.thirst < 20, chance: 0.001 }
```

## Behavior Tree Integration

### Agent BT — New Subtrees

Two new needs subtrees following the existing pattern (`needs-energy.ts`, `needs-social.ts`, etc.):

**`needs-hunger.ts`** (MDSL):
```
root {
  sequence {
    condition [IsHungry]
    action [SeekFoodStation]
    action [Eat]
  }
}
```

**`needs-thirst.ts`** (MDSL):
```
root {
  sequence {
    condition [IsThirsty]
    action [SeekDrinkStation]
    action [Drink]
  }
}
```

**BTAgentObject conditions:**
- `IsHungry()` — hunger < 35
- `IsThirsty()` — thirst < 30

**BTAgentObject actions:**
- `SeekFoodStation()` — find nearest unoccupied food-capable station (SnackTable or FoodBowl) using static room lookup. Walk to it. If none in current room, request RoomSwitcher transfer.
- `SeekDrinkStation()` — find nearest unoccupied drink-capable station (CoffeeMachine, WaterCooler, or WaterBowl). Cross-room transfer if needed.
- `Eat()` — occupy station, 5s interaction delay, apply hunger effects, vacate, spawn particle.
- `Drink()` — occupy station, 5s interaction delay, apply thirst effects, vacate, spawn particle.

### Master Selector Priority Order

```
1. UrgentReaction        (unchanged)
2. NeedsEnergy           (unchanged)
3. NeedsHunger           (NEW — hunger < 35)
4. NeedsThirst           (NEW — thirst < 30)
5. NeedsSocial           (unchanged)
6. NeedsFocus            (unchanged)
7. NeedsMorale           (unchanged)
8. WorkCycle             (unchanged)
9. SocialBehavior        (unchanged)
10. IdleBehavior         (unchanged)
```

Food/drink are higher priority than social/focus (eat before chat) but lower than energy crisis.

### Pet BT — New Branches

The `PetBTContext` interface in `pet-bt.ts` is extended with `hunger` and `thirst` fields. The `createPetBT()` factory receives pet needs state from engine.ts (read from PetActor/PetSceneEntity each tick).

Added above existing sleep/wander/follow in the pet selector:

```
selector {
  sequence { condition [IsHungry] → action [SeekFoodBowl] → action [Eat] }
  sequence { condition [IsThirsty] → action [SeekWaterBowl] → action [Drink] }
  sequence { condition [HasExitTarget] → action [WalkToExit] }
  sequence { condition [HasFollowTarget] → action [FollowAgent] ... }
  sequence { condition [SleepChanceRoll] → action [Nap] }
  sequence { condition [WanderChanceRoll] → action [PickWanderPoint] → action [WalkToPoint] }
  action [Idle]
}
```

Pet hunger/thirst thresholds: hunger < 40, thirst < 35.

Pet station seeking uses the same RoomSwitcher mechanism as agents for cross-room transfers.

## Agent Info Panel

### Needs Bar Display

Hunger and thirst bars added to the info tab (`ft-game-panel-info` in `panel-info.ts`).

**Display order:**
1. Energy (existing, color unchanged)
2. Hunger (new, warm orange #f97316)
3. Thirst (new, cyan blue #06b6d4)
4. Focus (existing, color unchanged)
5. Social (existing, color unchanged)
6. Morale (existing, color unchanged)

**Low-state indicators:** Same treatment as existing low-energy bars — pulse animation or warning color shift when hunger < 40 or thirst < 30.

### Store Integration

The `DashboardStore` does not currently expose agent needs to the UI. New plumbing is required:

1. NeedsSystem pushes `AgentNeeds` snapshots to DashboardStore each frame (via a new `setAgentNeeds(name, needs)` method)
2. DashboardStore exposes `getAgentNeeds(name): AgentNeeds | undefined`
3. `panel-info.ts` reads needs from store and renders bars (net-new needs bar UI component)

This is the same reactive pattern used for agent positions and states.

## Files to Create

| File | Purpose |
|------|---------|
| `src/game/actors/food-bowl.ts` | FoodBowl interactable (extends InteractableActor) |
| `src/game/actors/water-bowl.ts` | WaterBowl interactable (extends InteractableActor) |
| `src/game/brain/behavior-tree/needs-hunger.ts` | Agent BT subtree for hunger |
| `src/game/brain/behavior-tree/needs-thirst.ts` | Agent BT subtree for thirst |
| `tests/game/actors/food-bowl.test.ts` | FoodBowl unit tests |
| `tests/game/actors/water-bowl.test.ts` | WaterBowl unit tests |
| `tests/game/brain/behavior-tree/needs-hunger.test.ts` | Hunger subtree tests |
| `tests/game/brain/behavior-tree/needs-thirst.test.ts` | Thirst subtree tests |

## Files to Modify

| File | Changes |
|------|---------|
| `src/game/systems/needs-system.ts` | Add hunger/thirst to NeedsEntry + AgentNeeds, extend DECAY rates, register/applyEffect/getNeeds/serialize/restore/update, energy multiplier logic |
| `src/game/brain/behavior-tree/bt-types.ts` | Extend AgentNeeds mirror, update createDefaultNeeds() |
| `src/game/systems/social-system.ts` | Extend local AgentNeeds mirror with hunger/thirst |
| `src/game/actors/interactable-actor.ts` | Extend needsEffects type in InteractableConfig |
| `src/game/data/world-config.ts` | Add hunger/thirst config defaults |
| `src/game/data/day-phase-config.ts` | Add hunger/thirst multipliers |
| `src/game/actors/coffee-machine.ts` | Add thirst +20 to needsEffects, NA sprite |
| `src/game/actors/snack-table.ts` | Add hunger +25 to needsEffects, NA sprite |
| `src/game/actors/water-cooler.ts` | Add thirst +15 to needsEffects, NA sprite |
| `src/game/brain/behavior-tree/bt-factory.ts` | Insert NeedsHunger/NeedsThirst branches in master selector |
| `src/game/brain/behavior-tree/bt-agent.ts` | Add IsHungry, IsThirsty, SeekFoodStation, SeekDrinkStation, Eat, Drink |
| `src/game/brain/behavior-tree/pet-bt.ts` | Extend PetBTContext with hunger/thirst, add IsHungry/IsThirsty/SeekFoodBowl/SeekWaterBowl branches |
| `src/game/engine.ts` | Add FoodBowl/WaterBowl to scenes, extend objectAttractions, share interaction logic, push needs to store |
| `src/game/store/dashboard-store.ts` | Add setAgentNeeds/getAgentNeeds methods |
| `src/game/ui/panel-info.ts` | Render hunger/thirst bars in info tab |
| `src/game/sprites/sprite-loader.ts` | Add loadItemSprite() utility for single-frame NA sprites |
| `src/game/data/pet-definitions.ts` | Add hunger/thirst initial values to pet defs |
| `src/game/actors/pet-actor.ts` | Add hunger/thirst state fields, decay in updateBehavior |
| `tests/game/systems/needs-system.test.ts` | Extend existing tests for hunger/thirst decay + energy multiplier |

## Out of Scope

- Pet selection/info panel (deferred — click-to-inspect pets is not yet wired)
- Cooking mechanics or food crafting
- Food spoilage or inventory
- Agent food preferences
