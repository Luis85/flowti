# Camera Follow Across Rooms + BT Service Wrapper — Design Spec

## Overview

Two independent improvements to the Flowti Plugin game engine:

1. **Camera follow across room switches** — when the user is following an agent and that agent transfers to another room, the scene automatically switches and the camera re-locks on the agent.
2. **BT Service wrapper** — isolate mistreevous vendor imports behind a single `bt-service.ts` adapter so the library never leaks into the rest of the codebase.

## Feature 1: Camera Follow Across Room Switches

### Problem

When a user clicks an agent to follow them, the camera tracks that agent within the current scene. But when the `RoomSwitcher` transfers the agent to a different room (scene), the camera stays in the old scene. The agent disappears from view and the user is stranded.

### Current Flow

1. User clicks agent → `handleAgentSelect` → `cameraSystem.startFollow(actor)` + `store.startFollow(agentName)`
2. Agent walks to room exit → `RoomSwitcher.executeTransfer()` moves entity between scenes
3. `onTransferComplete` callback fires → shows thought bubble + pushes world event
4. Camera stays in old scene — agent is gone from view

### Target Flow

1. User clicks agent → same as current
2. Agent transfers rooms → `onTransferComplete` fires
3. **New:** if `store.followedAgent === entityId`, trigger `engine.goToScene(targetRoom)` with fade transition
4. After scene transition completes, `cameraSystem.onSceneActivate()` re-locks camera to the agent's actor in the new scene
5. User sees a smooth fade transition and arrives in the new room with camera locked on agent

### Design

**Change location:** `engine.ts`, inside the `onTransferComplete` callback (currently lines 576-580).

**Logic:**

```typescript
onTransferComplete: (entityId, _from, to) => {
    const label = to.charAt(0).toUpperCase() + to.slice(1);
    bubbleSystem.showBubble(entityId, "thought", `Visiting ${label}...`, engine.currentScene, findAgentActor, 3000);
    store.pushWorldEvent("room-switch", `${entityId} moved to ${label}`);

    // If following this entity, switch scene to follow them
    if (store.followedAgent === entityId) {
        void engine.goToScene(to, {
            destinationIn: new ex.FadeInOut({ duration: SCENE_TRANSITION_DURATION, direction: "in" }),
            sourceOut: new ex.FadeInOut({ duration: SCENE_TRANSITION_DURATION, direction: "out" }),
        }).then(() => {
            cameraSystem?.onSceneActivate(findAgentActor, engine.currentScene.camera);
        });
    }
},
```

**Key decisions:**

- **Don't go through `sceneConfig.onSceneChange`** — that handler calls `store.selectAgent(null)` which would deselect the agent. We want to preserve selection + follow state during a follow-triggered scene switch.
- **No camera system changes needed** — `onSceneActivate` already checks `followedName` and re-locks if the actor is found in the new scene.
- **No store changes needed** — `followedAgent` persists across scene switches; it's only cleared by explicit user action (clicking the same agent again, pressing Escape, or clicking Home).
- **Actor availability is guaranteed** — `RoomSwitcher.executeTransfer()` calls `toScene.enter(entity, fromRoom)` synchronously before firing `onTransferComplete`. The actor is already in the target scene when we trigger `goToScene`.

### Edge Cases

| Scenario | Behavior |
|----------|----------|
| Followed agent transfers to a room | Scene switches, camera re-locks |
| Non-followed agent transfers | No scene switch (existing behavior) |
| Followed agent transfers while scene transition is already in progress | ExcaliburJS queues transitions — the second transition starts after the first completes |
| User manually switches scene while following | `sceneConfig.onSceneChange` deselects agent (`selectAgent(null)`) but does NOT call `stopFollow()` — the camera's `onSceneActivate` will try to re-lock in the new scene. If the followed agent is in the new scene, camera re-locks; if not, `stopFollow()` is called by the camera system. This is acceptable behavior — user navigated deliberately. |

### Testing

- Unit test in `engine.test.ts`: verify `goToScene` is called when `store.followedAgent` matches the transferred entity
- Unit test: verify `goToScene` is NOT called when `store.followedAgent` is null or a different entity
- Unit test: verify `store.selectAgent` is NOT called during follow-triggered scene switch

## Feature 2: BT Service Wrapper

### Problem

The `mistreevous` behavior tree library is imported in 5 files:

| File | Imports |
|------|---------|
| `bt-agent.ts` | `{ State }` |
| `bt-factory.ts` | `{ BehaviourTree }` |
| `pet-bt.ts` | `{ BehaviourTree, State }` |
| `bt-tick.ts` | `type { BehaviourTree }` |
| `bt-agent.test.ts` | `{ State }` |

Swapping the vendor or upgrading would require touching all of them.

### Target State

mistreevous is imported in exactly one file: `bt-service.ts`. All other files import from `bt-service.ts`.

### Design

**New file:** `src/game/brain/behavior-tree/bt-service.ts`

```typescript
/**
 * bt-service.ts — Vendor adapter for the mistreevous behavior tree library.
 *
 * This is the ONLY file that imports mistreevous. All other BT code
 * imports types and utilities from here.
 */

import { BehaviourTree, State } from "mistreevous";

// ── Our state type — replaces mistreevous State enum ──────────
// State enum values are vendor-prefixed strings ("mistreevous.succeeded" etc.)
// NodeState provides clean, vendor-neutral string literals.
export type NodeState = "succeeded" | "running" | "failed";

// ── Conversion ────────────────────────────────────────────────
// mistreevous State is a string enum: State.SUCCEEDED = "mistreevous.succeeded"
const STATE_MAP: Record<string, NodeState> = {
    [State.SUCCEEDED]: "succeeded",
    [State.RUNNING]: "running",
    [State.FAILED]: "failed",
};

export function toNodeState(state: State): NodeState {
    return STATE_MAP[state] ?? "failed";
}

export function fromNodeState(ns: NodeState): State {
    switch (ns) {
        case "succeeded": return State.SUCCEEDED;
        case "running": return State.RUNNING;
        case "failed": return State.FAILED;
    }
}

// ── Tree lifecycle ────────────────────────────────────────────
// Accepts any agent object — handles the Record<string, unknown> cast internally
// so callers don't need `as unknown as Record<string, unknown>`.
export function createTree(mdsl: string, agent: object): BehaviourTree {
    return new BehaviourTree(mdsl, agent as Record<string, unknown>);
}

export function stepTree(tree: BehaviourTree): void {
    tree.step();
}

// Re-export the opaque tree type for signatures
export type { BehaviourTree };
```

**Note on `State.READY`:** mistreevous has a fourth state `State.READY` ("not yet visited"). This is an internal tree node state that is never returned by action methods — actions only return `SUCCEEDED`, `RUNNING`, or `FAILED`. `READY` is intentionally excluded from `NodeState`. If `toNodeState` ever receives `READY` (which should not happen in normal operation), it falls through to `"failed"` as a defensive default.

### Consumer Changes

Actions in `bt-agent.ts` and `pet-bt.ts` currently return `State` values directly (e.g., `return State.SUCCEEDED`). After migration, they return `fromNodeState("succeeded")` inline. This keeps the change mechanical — each `State.SUCCEEDED` becomes `fromNodeState("succeeded")`, each `State.RUNNING` becomes `fromNodeState("running")`, each `State.FAILED` becomes `fromNodeState("failed")`.

The `fromNodeState` call converts our `NodeState` string to the vendor `State` value at the boundary. mistreevous receives the `State` values it expects. No action wrapping layer is needed.

| File | Before | After |
|------|--------|-------|
| `bt-agent.ts` | `import { State } from "mistreevous"` | `import { fromNodeState } from "./bt-service.js"` |
| | `return State.SUCCEEDED` | `return fromNodeState("succeeded")` |
| | `return State.RUNNING` | `return fromNodeState("running")` |
| | `return State.FAILED` | `return fromNodeState("failed")` |
| `bt-factory.ts` | `import { BehaviourTree } from "mistreevous"` | `import { createTree } from "./bt-service.js"` |
| | `new BehaviourTree(mdsl, agent as unknown as ...)` | `createTree(mdsl, agent)` |
| `pet-bt.ts` | `import { BehaviourTree, State } from "mistreevous"` | `import { createTree, fromNodeState, type BehaviourTree } from "./bt-service.js"` |
| | `return State.SUCCEEDED` | `return fromNodeState("succeeded")` |
| | `new BehaviourTree(mdsl, agent as unknown as ...)` | `createTree(mdsl, agent)` |
| `bt-tick.ts` | `import type { BehaviourTree } from "mistreevous"` | `import { stepTree, type BehaviourTree } from "./bt-service.js"` |
| | `tree.step()` | `stepTree(tree)` |
| `bt-agent.test.ts` | `import { State } from "mistreevous"` | `import { fromNodeState } from "...bt-service.js"` |
| | `State.SUCCEEDED` comparisons | `fromNodeState("succeeded")` comparisons |

### Testing

- Unit test `bt-service.test.ts`: verify `toNodeState` maps all three states correctly
- Unit test: verify `fromNodeState` round-trips with `toNodeState`
- Unit test: verify `createTree` returns a tree that can be stepped
- Existing BT tests continue to pass after migration

## Files Changed

### Feature 1 (Camera Follow)
- **Modify:** `src/game/engine.ts` — add follow-aware scene switch in `onTransferComplete`
- **Modify:** `tests/game/engine.test.ts` — add follow-switch tests

### Feature 2 (BT Service)
- **Create:** `src/game/brain/behavior-tree/bt-service.ts`
- **Create:** `tests/game/brain/behavior-tree/bt-service.test.ts`
- **Modify:** `src/game/brain/behavior-tree/bt-agent.ts` — use fromNodeState
- **Modify:** `src/game/brain/behavior-tree/bt-factory.ts` — use createTree
- **Modify:** `src/game/brain/behavior-tree/pet-bt.ts` — use createTree + fromNodeState
- **Modify:** `src/game/brain/behavior-tree/bt-tick.ts` — use stepTree
- **Modify:** `tests/game/brain/behavior-tree/bt-agent.test.ts` — remove mistreevous import

## Non-Goals

- Abstracting away MDSL syntax — MDSL strings remain as-is
- Changing BT tick intervals or system behavior
- Adding new camera features (zoom behavior, pan limits, etc.)
- Pet follow-across-rooms (pets don't have follow-triggered scene switching)
