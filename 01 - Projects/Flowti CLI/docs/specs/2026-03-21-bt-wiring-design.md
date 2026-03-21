# BT Wiring — Behavior Trees as Agent Orchestrator

**Date:** 2026-03-21
**Status:** Approved
**Scope:** Flowti Plugin — game engine BT integration

## Summary

Wire behavior trees into the game engine as the single decision-maker for agent and pet behavior. Fix the data flow gap preventing BT activation, add needs-driven subtrees that work with existing game systems, and convert pet state machines to BTs for architectural consistency.

## Architecture Decision

**BT as orchestrator** — The BT reads from existing systems (needs, social, sensors) and drives actions through them. Existing systems become sensors/actuators, not competing decision-makers. The needs system's threshold-action pathway is replaced by BT conditions that read the same values and make the same decisions, but through a unified tree.

## Part 1: Data Flow Fix

### Problem

Both data providers (`agent-markdown-roster.ts` and `world-state-agents.ts`) construct `DashboardAgent` objects without `behaviors`, `goals`, `skills`, or `experience`. The BtSystem checks `agent.behaviors?.length` before registering a BT — so it silently skips all 24 agents.

### Solution

**`agent-markdown-roster.ts`** — Extend `dashboardAgentFromFrontmatter()` to map:
- `behaviors` — from frontmatter list (already parsed by YAML parser)
- `skills` — from frontmatter pipe-delimited list (`Name|level`)
- `experience` — from frontmatter number

Extend `dashboardAgentsFromAgentsMarkdownDir()` to load companion `.json` files alongside markdown:
- `goals` — from companion JSON `goals[]` array, mapped to `{ text, priority }` format

**`world-state-agents.ts`** — Extend `mapEntityToDashboardAgent()` to extract from entity components, following the existing `identity` component pattern:
- `behaviors` — from `c["behaviors"]` (string array at component root, same level as `domain`, `status`)
- `goals` — from `c["goals"]` (array of `{ name, priority }` objects)
- `skills` — from `c["skills"]` (array of `{ name, level }` objects)
- `experience` — from `c["experience"]` (number at component root)

These follow the flat component-key convention already used for `domain`, `status`, and `agentType`.

**No type changes** — all fields are already optional on `DashboardAgent`.

## Part 2: Needs-Driven Agent BT Subtrees

### New Subtrees

| File | Trigger | Behavior |
|------|---------|----------|
| `needs-energy.ts` | energy < 30 | Walk to couch/coffee machine, on-break state, wait until energy > 60 |
| `needs-social.ts` | social < 25 | Find nearest idle agent, walk-to, talking state, wait until social > 50 |
| `needs-focus.ts` | focus < 20 | Walk to quiet corner (away from agents), idle, wait until focus > 50 |
| `needs-morale.ts` | morale < 10 | Emote sad, wander aimlessly, wait until morale > 30 |
| `work-cycle.ts` | has goals + energy > 50 + focus > 40 | Pick goal, walk to workstation, working state, drain focus, release |

### Master Tree Restructure

```
root {
  selector {
    branch [UrgentReaction]        // existing — sensor events
    branch [NeedsEnergy]           // NEW — seek rest
    branch [NeedsSocial]           // NEW — seek agent
    branch [NeedsFocus]            // NEW — seek quiet
    branch [NeedsMorale]           // NEW — demoralized
    branch [WorkCycle]             // NEW — goal-driven work
    sequence {                     // existing LLM goal work (Phase 2)
      condition [HasEnoughEnergy]
      condition [HasEnoughFocus]
      condition [HasEnoughMorale]
      action [PickGoal]
      selector { ...goal subtrees... }
    }
    branch [SocialBehavior]        // existing
    branch [IdleBehavior]          // existing
  }
}
```

Priority order: urgent > needs > work > LLM goals > social > idle.

### Existing `subtrees/needs.ts` Disposition

The existing `NeedsSatisfaction` subtree (Phase 1 stub) is **removed**. The four new granular needs subtrees (`NeedsEnergy`, `NeedsSocial`, `NeedsFocus`, `NeedsMorale`) replace it entirely. The `NEEDS_SUBTREE` export and its import in `bt-factory.ts` are deleted from `collectSubtrees()`.

### BT-System Bridge

**System access** — The `AgentToolDeps` interface gains two new optional members to provide game system access to BT conditions and actions:

```typescript
// Added to AgentToolDeps in bt-types.ts
needs?: {
  getNeeds: (name: string) => { energy: number; social: number; focus: number; morale: number };
};
brain?: {
  assignWork: (name: string) => void;
  releaseWork: (name: string) => void;
  applyEvent: (name: string, event: string) => void;
  getState: (name: string) => string;
};
```

These are injected via `createStubDeps()` in `engine.ts`, which already has access to both `needsSystem` and `brainSystem`. The `BTAgentContext` blackboard gains a cached `needs` snapshot (energy/social/focus/morale numbers) that is refreshed each tick from `deps.needs.getNeeds(name)`.

BT actions call game system methods via `btWorldState.emitAction()`:
- `brainSystem.assignWork()` / `brainSystem.releaseWork()` for work transitions
- `brainSystem.applyEvent()` for state changes
- Needs effects applied through interactable occupancy

New conditions and actions are added to `bt-agent.ts` (both as `BTAgentObject` interface members and `createBTAgent()` implementations):
- Conditions: `IsEnergyLow`, `IsSocialLow`, `IsFocusLow`, `IsMoraleLow`, `HasWorkGoal`, `IsEnergyOk`, `IsFocusOk`
- Actions: `SeekRestSpot`, `SeekNearbyAgent`, `SeekQuietCorner`, `WanderSad`, `GoToWorkstation`, `DoWork`, `LeaveWorkstation`

Note: `IsEnergyLow` uses the same threshold (energy < 30) as the existing `HasEnoughEnergy` condition but inverted. Both coexist — `HasEnoughEnergy` gates the LLM goal sequence, `IsEnergyLow` triggers the needs subtree. The attribute modifier (`con/2`) applies to both.

## Part 3: Pet BTs

### Approach

Replace `PetActor.updateBehavior()` with a BT. Same behavioral outcomes, consistent architecture.

### Pet BT Tree

```
root {
  selector {
    sequence [Exit] {
      condition [HasExitTarget]
      action [WalkToExit]
    }
    sequence [Follow] {
      condition [HasFollowTarget]
      action [FollowAgent]
      condition [FollowTimeElapsed]
      action [ReturnHome]
    }
    sequence [Sleep] {
      condition [SleepChanceRoll]
      action [Nap]
    }
    sequence [Wander] {
      condition [WanderChanceRoll]
      action [PickWanderPoint]
      action [WalkToPoint]
    }
    action [Idle]
  }
}
```

### Pet BT Context

`pet-bt.ts` defines a `PetBTContext` blackboard type:

```typescript
interface PetBTContext {
  name: string;
  def: PetDefinition;          // sleepChance, wanderRadius, speed, etc.
  state: PetState;             // idle | wandering | sleeping | following | exiting
  followTarget: string | null;
  followTimer: number;         // ms remaining in follow behavior
  stateTimer: number;          // ms remaining in current state
  targetPos: { x: number; y: number } | null;
  homePos: { x: number; y: number };
}
```

Conditions read from this context. Actions mutate it and call PetActor methods.

### Implementation

- New file: `src/game/brain/behavior-tree/pet-bt.ts` — pet BT factory, conditions, actions, `PetBTContext`
- Pet conditions read from `PetDefinition.behaviors` (sleepChance, wanderRadius, etc.) via the context
- Pet actions call existing PetActor movement methods (`moveToward()`, `resetHome()`, etc.)
- `BtSystem` stores pet entries in a separate `petEntries` map with `PET_TICK_INTERVAL_MS = 1000` — the `update()` method ticks both maps with their respective intervals
- `PetActor.updateBehavior()` is **split**: state-transition decisions move to the BT, per-frame movement execution stays in the actor as `updateMovement(deltaMs)`. The BT sets `state` and `targetPos`; the actor moves toward the target each frame
- Per-frame movement math stays in the actor — BT decides *what*, actor executes *how*

## Files Changed

### Modified
- `src/game/config/agent-markdown-roster.ts` — add behaviors/goals/skills/experience mapping
- `src/game/config/world-state-agents.ts` — add behaviors/goals/skills/experience mapping
- `src/game/brain/behavior-tree/bt-factory.ts` — restructured master tree
- `src/game/brain/behavior-tree/bt-agent.ts` — new conditions and actions
- `src/game/brain/behavior-tree/bt-types.ts` — extended context with needs references
- `src/game/systems/bt-system.ts` — add registerPet/updatePets
- `src/game/actors/pet-actor.ts` — replace updateBehavior with BT delegation
- `src/game/engine.ts` — wire pet BTs into preframe loop (pet BT tick replaces `pet.updateBehavior(deltaMs)` call at ~line 1292 in the pet update loop; `createStubDeps()` extended to inject `needsSystem` and `brainSystem` references)

### New
- `src/game/brain/behavior-tree/subtrees/needs-energy.ts`
- `src/game/brain/behavior-tree/subtrees/needs-social.ts`
- `src/game/brain/behavior-tree/subtrees/needs-focus.ts`
- `src/game/brain/behavior-tree/subtrees/needs-morale.ts`
- `src/game/brain/behavior-tree/subtrees/work-cycle.ts`
- `src/game/brain/behavior-tree/pet-bt.ts`

### Removed
- `src/game/brain/behavior-tree/subtrees/needs.ts` — replaced by four granular needs subtrees

### Tests
- `tests/game/config/agent-markdown-roster.test.ts` — add cases for new fields
- `tests/game/config/world-state-agents.test.ts` — add cases for new fields
- `tests/game/systems/bt-system.test.ts` — add pet registration tests
- `tests/game/brain/behavior-tree/pet-bt.test.ts` — new
- `tests/game/brain/behavior-tree/subtrees/needs-subtrees.test.ts` — new, tests all four needs subtrees + work-cycle via btTick

## Non-Goals

- LLM integration (Phase 2 — existing subtrees handle this later)
- New pet types or new pet behaviors beyond current repertoire
- Changes to needs decay rates or threshold values
- Visual changes to agents or pets
