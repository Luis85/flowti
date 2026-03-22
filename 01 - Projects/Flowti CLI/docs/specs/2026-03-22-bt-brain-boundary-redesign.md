# BT–Brain Boundary Redesign

**Date:** 2026-03-22
**Status:** Approved
**Scope:** Flowti Plugin — agent decision pipeline cleanup
**Supersedes:** Patches from commits 8debc432..6aa9f2cc

## Problem

The BT and brain system compete for control of agent state. The worldState bridge forwards ALL BT actions to `brainSystem.applyEvent()`, causing:

1. **Idle stateTimer reset** — BT emits `"idle"` every 3s tick, resetting the brain's 8s idle→wander threshold. Agents never wander.
2. **Double-call seek actions** — Seek actions call `deps.brain?.applyEvent()` directly AND go through the bridge. The second call re-resolves a new random target.
3. **Chatter freezes movement** — `"speaking"` from chatter transitions brain to `"talking"` (no movement for 10s).
4. **Erratic direction changes** — `"wander"` through bridge picks a new random target every tick, agents constantly redirect.

Five patches were applied as workarounds: action type changes, bridge blocklist (reverted), redundancy guard in `applyEvent`, legacy threshold guards. The result works but is fragile.

## Design: BT as Strategic, Brain as Tactical

The BT makes high-level decisions (satisfy hunger, socialize, work). The brain owns all movement pacing (idle timing, wander rhythm, walk speed). The bridge only forwards intent-changing actions.

### Action Classification

Every BT collected action falls into one of three categories:

**Intent actions** — meaningful state changes forwarded through the bridge to `brainSystem.applyEvent()`:

| Action | Brain Transition |
|--------|-----------------|
| `goal-started` | walking-to (workstation) |
| `goal-completed` | idle |
| `artifact-dropped` | idle |
| `thinking` | working |
| `asking` | waiting |
| `using-tool` | working |
| `speaking` | talking |
| `error` | idle |

**Seek actions** — movement commands already applied directly by the BT action function via `deps.brain?.applyEvent()`. The bridge does NOT forward these (eliminates double-call):

- `seek-rest`, `seek-food`, `seek-drink`, `seek-agent`, `seek-quiet`, `seek-merchant`
- `seek-preferred-food`, `seek-preferred-drink`

**Passive actions** — BT bookkeeping invisible to the brain. The bridge does NOT forward:

- `idle`, `chatter`, `wander`, `wander-sad`, `browsing-merchant`
- `interaction-evaluated`, `interaction-submitted`
- `file-read`, `file-written`, `file-opened`, `template-generated`

### Bridge Implementation

```typescript
const BT_INTENT_ACTIONS: ReadonlySet<string> = new Set([
    "goal-started", "goal-completed", "artifact-dropped",
    "thinking", "asking", "using-tool",
    "speaking", "error",
]);

const btWorldState: BtWorldStateBridge = {
    emitAction: (action) => {
        if (BT_INTENT_ACTIONS.has(action.type)) {
            brainSystem.applyEvent(action.agentName, action.type);
        }
    },
    updateEntity: () => {},
};
```

### Brain Autonomous Cycle

The brain system keeps its existing state machine unchanged:

```
idle (8s, personality-driven) → wandering (walk to target) → arrive → idle → repeat
```

Brain-owned behaviors (no changes):
- Idle→wander timer (`idleResistance * idleResistanceMult`)
- Idle pose cycling (fidgety/calm/restless)
- Wander target resolution with social drift, focus drift, echo hints
- Break routine after prolonged working
- Social facing toward nearby agents
- Separation nudge for overlapping agents
- Talking/waiting timeout (10s → idle)

When a seek or intent action arrives, it interrupts the autonomous cycle. On arrival, the brain returns to idle and the cycle resumes.

### Remove applyEvent Redundancy Guard

The "skip redundant transition" guard added in commit 9ce280d1 is removed. With the whitelist bridge, only intent actions reach `applyEvent` — these are genuine state changes that should always apply. Seek actions go through the direct `deps.brain` path and are legitimate interrupts.

### Simplify BT Idle Behavior

`EchoBiasedIdle`, `Wander`, `WanderSad`, `Chatter`, and `Emote` all simplify to `collect("idle", {})`. The echo-biased weighting is removed from `EchoBiasedIdle` — wander hints are already handled by the needs tick via `setWanderHint` (bond/preference biases in `tickNeeds`). The talk engine handles ambient chatter independently on its own timer (12-30s, personality-driven).

### Legacy System Guards

`processThresholds` and `tryObjectAttraction` in `tickBehaviorThresholds` skip agents with a registered BT (`sys.bt.has(agentName)`). Already implemented.

### Staggered BT Ticks

BT accumulators use a deterministic stagger based on entry index to spread agent ticks across the 3s interval. Already implemented.

## Files Changed

### Modified

| File | Change |
|------|--------|
| `src/game/engine-systems-init.ts` | Bridge whitelist replacing pass-all |
| `src/game/systems/brain-system.ts` | Remove redundancy guard from `applyEvent` |
| `src/game/brain/behavior-tree/bt-agent.ts` | Simplify idle actions, remove `EchoBiasedIdle` weighting |
| `src/game/brain/agent-brain.ts` | Keep `"wander"` transition for seek-quiet (already exists) |

### Unchanged (already correct)

| File | Status |
|------|--------|
| `src/game/engine-simulation.ts` | BT guard on processThresholds + tryObjectAttraction already in place |
| `src/game/systems/bt-system.ts` | Staggered accumulators already in place |
| `src/game/systems/bubble-system.ts` | Scene filter + kill guard already in place |
| `src/game/engine.ts` | Fish exclusion + scene filter wiring already in place |
| `src/game/brain/behavior-tree/bt-agent-extensions.ts` | Eat/Drink/BrowseMerchant already fixed |

### Tests Updated

| File | Change |
|------|--------|
| `tests/game/brain/behavior-tree/bt-factory.test.ts` | Accept simplified idle action types |
| `tests/game/brain/behavior-tree/integration.test.ts` | Accept simplified idle action types |

## Verification

After implementation:
- Agents idle for ~8s, then wander smoothly to a new point, then idle again
- Seek actions (needs-driven) interrupt the cycle and walk to a specific target
- Agents return to idle after arriving at seek targets
- Talk engine fires ambient chatter during idle periods
- No jitter, no erratic direction changes, no synchronized activation
- All existing game tests pass
