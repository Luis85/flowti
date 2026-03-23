# Agent AI Architecture Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the competing BT + brain system with a clean blackboard + ECS locomotion architecture.

**Architecture:** BT writes decisions to a per-agent blackboard. A locomotion system reads movement commands from ECS components and executes per-frame movement. Sensors write world state to blackboards. Presentation systems read intent from blackboards. No system calls another system directly — all communication flows through the blackboard.

**Tech Stack:** TypeScript, Excalibur.js (ECS components, not systems), mistreevous (BT), Vitest

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-23-agent-ai-architecture-design.md`

---

## Chunk 1: Foundation — Blackboard + Components + Locomotion

Create the new infrastructure alongside the existing code. No deletions yet.

### Task 1: AgentBlackboard + BlackboardManager

**Files:**
- Create: `src/game/systems/blackboard.ts`
- Test: `tests/game/systems/blackboard.test.ts`

- [ ] **Step 1: Write failing tests for BlackboardManager**

```typescript
// tests/game/systems/blackboard.test.ts
import { describe, it, expect } from "vitest";
import { BlackboardManager } from "../../../src/game/systems/blackboard.js";

describe("BlackboardManager", () => {
    it("registers an agent and returns its blackboard", () => {
        const mgr = new BlackboardManager();
        mgr.register("Alice");
        const bb = mgr.get("Alice");
        expect(bb).toBeDefined();
        expect(bb.intent).toBe("idle");
        expect(bb.movementCommand).toBe("none");
    });

    it("returns same blackboard on repeated get", () => {
        const mgr = new BlackboardManager();
        mgr.register("Alice");
        expect(mgr.get("Alice")).toBe(mgr.get("Alice"));
    });

    it("throws on get for unregistered agent", () => {
        const mgr = new BlackboardManager();
        expect(() => mgr.get("nobody")).toThrow();
    });

    it("unregisters an agent", () => {
        const mgr = new BlackboardManager();
        mgr.register("Alice");
        mgr.unregister("Alice");
        expect(() => mgr.get("Alice")).toThrow();
    });

    it("getAll returns all registered blackboards", () => {
        const mgr = new BlackboardManager();
        mgr.register("Alice");
        mgr.register("Bob");
        const all = mgr.getAll();
        expect(all.size).toBe(2);
    });

    it("has() returns true for registered, false for unknown", () => {
        const mgr = new BlackboardManager();
        mgr.register("Alice");
        expect(mgr.has("Alice")).toBe(true);
        expect(mgr.has("Bob")).toBe(false);
    });

    it("blackboard defaults are correct", () => {
        const mgr = new BlackboardManager();
        mgr.register("Alice");
        const bb = mgr.get("Alice");
        expect(bb.arrived).toBe(false);
        expect(bb.isMoving).toBe(false);
        expect(bb.movementTarget).toBeNull();
        expect(bb.nearbyAgents).toEqual([]);
        expect(bb.nearestFoodStation).toBeNull();
        expect(bb.speechRequest).toBeNull();
        expect(bb.wanderHint).toBeNull();
        expect(bb.cascadeHint).toBeNull();
    });
});
```

- [ ] **Step 2: Run tests — verify they fail** (BlackboardManager not defined)

Run: `npx vitest run tests/game/systems/blackboard.test.ts`

- [ ] **Step 3: Implement BlackboardManager**

```typescript
// src/game/systems/blackboard.ts
import type { BubbleKind } from "../systems/talk/talk-types.js";

export interface AgentNeeds {
    energy: number;
    social: number;
    focus: number;
    morale: number;
    hunger: number;
    thirst: number;
}

export interface AgentBlackboard {
    // Written by BT, read by locomotion
    movementCommand: "none" | "walk-to" | "wander";
    movementTarget: { x: number; y: number } | null;

    // Written by BT, read by presentation
    intent: "idle" | "working" | "talking" | "waiting" | "on-break" | "seeking";
    intentDetail: string;

    // Written by locomotion, read by BT
    arrived: boolean;
    position: { x: number; y: number };
    isMoving: boolean;

    // Written by sensors, read by BT
    needs: AgentNeeds;
    nearbyAgents: string[];
    nearbyEntities: string[];
    currentRoom: string;
    nearestFoodStation: { x: number; y: number } | null;
    nearestDrinkStation: { x: number; y: number } | null;
    nearestRestStation: { x: number; y: number } | null;

    // Written by echo/social, read by BT
    wanderHint: { x: number; y: number } | null;
    cascadeHint: string | null;
    cascadeTarget: { x: number; y: number } | null;
    roomAvoidance: string | null;
    breakThresholdBias: number;

    // Written by BT, read by presentation
    speechRequest: { text: string; kind: BubbleKind } | null;
}

export function createDefaultBlackboard(): AgentBlackboard {
    return {
        movementCommand: "none",
        movementTarget: null,
        intent: "idle",
        intentDetail: "",
        arrived: false,
        position: { x: 0, y: 0 },
        isMoving: false,
        needs: { energy: 80, social: 60, focus: 70, morale: 75, hunger: 80, thirst: 80 },
        nearbyAgents: [],
        nearbyEntities: [],
        currentRoom: "",
        nearestFoodStation: null,
        nearestDrinkStation: null,
        nearestRestStation: null,
        wanderHint: null,
        cascadeHint: null,
        cascadeTarget: null,
        roomAvoidance: null,
        breakThresholdBias: 0,
        speechRequest: null,
    };
}

export class BlackboardManager {
    private readonly boards = new Map<string, AgentBlackboard>();

    register(name: string): void {
        if (this.boards.has(name)) return;
        this.boards.set(name, createDefaultBlackboard());
    }

    unregister(name: string): void {
        this.boards.delete(name);
    }

    get(name: string): AgentBlackboard {
        const bb = this.boards.get(name);
        if (!bb) throw new Error(`No blackboard for agent "${name}"`);
        return bb;
    }

    has(name: string): boolean {
        return this.boards.has(name);
    }

    getAll(): ReadonlyMap<string, AgentBlackboard> {
        return this.boards;
    }

    /** Sync blackboard movement/intent → ECS components on actors. */
    push(getActor: (name: string) => { movementComponent?: MovementComponentData; intentComponent?: IntentComponentData } | undefined): void {
        for (const [name, bb] of this.boards) {
            const actor = getActor(name);
            if (!actor) continue;
            if (actor.movementComponent) {
                actor.movementComponent.command = bb.movementCommand;
                actor.movementComponent.target = bb.movementTarget;
            }
            if (actor.intentComponent) {
                actor.intentComponent.intent = bb.intent;
                actor.intentComponent.detail = bb.intentDetail;
            }
        }
    }

    /** Sync ECS component physical state → blackboard. */
    pull(getActor: (name: string) => { pos?: { x: number; y: number }; movementComponent?: MovementComponentData } | undefined): void {
        for (const [name, bb] of this.boards) {
            const actor = getActor(name);
            if (!actor) continue;
            if (actor.pos) {
                bb.position = { x: actor.pos.x, y: actor.pos.y };
            }
            if (actor.movementComponent) {
                bb.arrived = actor.movementComponent.arrived;
                bb.isMoving = actor.movementComponent.command !== "none";
            }
        }
    }
}

// Minimal data interfaces for push/pull (avoids importing Excalibur in tests)
export interface MovementComponentData {
    command: "none" | "walk-to" | "wander";
    target: { x: number; y: number } | null;
    arrived: boolean;
}

export interface IntentComponentData {
    intent: string;
    detail: string;
}
```

- [ ] **Step 4: Run tests — verify they pass**

Run: `npx vitest run tests/game/systems/blackboard.test.ts`

- [ ] **Step 5: Add push/pull tests**

```typescript
// Append to blackboard.test.ts
describe("BlackboardManager push/pull", () => {
    it("push syncs movement command to actor component", () => {
        const mgr = new BlackboardManager();
        mgr.register("Alice");
        const bb = mgr.get("Alice");
        bb.movementCommand = "walk-to";
        bb.movementTarget = { x: 100, y: 200 };

        const component = { command: "none" as const, target: null, arrived: false };
        const actor = { movementComponent: component };
        mgr.push(() => actor as never);

        expect(component.command).toBe("walk-to");
        expect(component.target).toEqual({ x: 100, y: 200 });
    });

    it("pull syncs position and arrived from actor", () => {
        const mgr = new BlackboardManager();
        mgr.register("Alice");

        const component = { command: "none" as const, target: null, arrived: true };
        const actor = { pos: { x: 50, y: 75 }, movementComponent: component };
        mgr.pull(() => actor as never);

        const bb = mgr.get("Alice");
        expect(bb.position).toEqual({ x: 50, y: 75 });
        expect(bb.arrived).toBe(true);
    });
});
```

- [ ] **Step 6: Run tests — verify pass**
- [ ] **Step 7: Commit**

```
git add src/game/systems/blackboard.ts tests/game/systems/blackboard.test.ts
git commit -m "feat(plugin): add BlackboardManager — per-agent data store for AI pipeline"
```

---

### Task 2: ECS Components

**Files:**
- Create: `src/game/components/agent-components.ts`
- Test: `tests/game/components/agent-components.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect } from "vitest";
import { MovementComponent, IntentComponent } from "../../../src/game/components/agent-components.js";

describe("MovementComponent", () => {
    it("defaults to no movement", () => {
        const c = new MovementComponent();
        expect(c.command).toBe("none");
        expect(c.target).toBeNull();
        expect(c.arrived).toBe(false);
    });
});

describe("IntentComponent", () => {
    it("defaults to idle", () => {
        const c = new IntentComponent();
        expect(c.intent).toBe("idle");
        expect(c.detail).toBe("");
    });
});
```

- [ ] **Step 2: Run tests — verify fail**
- [ ] **Step 3: Implement components**

```typescript
// src/game/components/agent-components.ts
import * as ex from "excalibur";

export class MovementComponent extends ex.Component {
    command: "none" | "walk-to" | "wander" = "none";
    target: { x: number; y: number } | null = null;
    arrived = false;
    speed = 40;
    movementStyle: "deliberate" | "brisk" | "darting" = "brisk";
}

export class IntentComponent extends ex.Component {
    intent = "idle";
    detail = "";
    idlePose = "idle";
    idlePoseTimer = 0;
}
```

- [ ] **Step 4: Run tests — verify pass**
- [ ] **Step 5: Commit**

```
git add src/game/components/agent-components.ts tests/game/components/agent-components.test.ts
git commit -m "feat(plugin): add MovementComponent + IntentComponent for ECS data model"
```

---

### Task 3: LocomotionSystem

**Files:**
- Create: `src/game/systems/locomotion-system.ts`
- Test: `tests/game/systems/locomotion-system.test.ts`
- Reference: `src/game/brain/movement.ts` (reuse `resolveIdleTarget`, `computeSeparation`, `randomWanderPoint`)

- [ ] **Step 1: Write failing tests for walk-to + arrival**

```typescript
import { describe, it, expect, vi } from "vitest";
import { LocomotionSystem } from "../../../src/game/systems/locomotion-system.js";

const BOUNDS = { minX: 0, maxX: 800, minY: 0, maxY: 600 };

function makeEntry(overrides = {}) {
    return {
        command: "none" as const,
        target: null as { x: number; y: number } | null,
        arrived: false,
        speed: 40,
        movementStyle: "brisk" as const,
        position: { x: 400, y: 300 },
        ...overrides,
    };
}

describe("LocomotionSystem", () => {
    it("moves agent toward walk-to target", () => {
        const sys = new LocomotionSystem(BOUNDS);
        const entry = makeEntry({
            command: "walk-to",
            target: { x: 500, y: 300 },
        });
        sys.updateAgent(entry, 1000); // 1 second
        expect(entry.position.x).toBeGreaterThan(400);
        expect(entry.arrived).toBe(false);
    });

    it("sets arrived when reaching target", () => {
        const sys = new LocomotionSystem(BOUNDS);
        const entry = makeEntry({
            command: "walk-to",
            target: { x: 402, y: 300 }, // 2px away, within threshold
            position: { x: 400, y: 300 },
        });
        sys.updateAgent(entry, 1000);
        expect(entry.arrived).toBe(true);
        expect(entry.command).toBe("none");
    });

    it("does nothing when command is none", () => {
        const sys = new LocomotionSystem(BOUNDS);
        const entry = makeEntry();
        const origX = entry.position.x;
        sys.updateAgent(entry, 1000);
        expect(entry.position.x).toBe(origX);
    });

    it("picks a wander target when command is wander", () => {
        const sys = new LocomotionSystem(BOUNDS);
        const entry = makeEntry({ command: "wander" });
        sys.updateAgent(entry, 16);
        // Should have resolved a target and started moving
        expect(entry.target).not.toBeNull();
        expect(entry.command).toBe("walk-to"); // wander resolves to walk-to
    });
});
```

- [ ] **Step 2: Run tests — verify fail**
- [ ] **Step 3: Implement LocomotionSystem**

The locomotion system extracts movement logic from `brain-system.ts` `updateMoving()` (line 433-469). Key constants: `BASE_SPEED = 40`, `ARRIVAL_THRESHOLD = 4`, `SPRITE_MARGIN = 16`. Reuse `resolveIdleTarget` and `computeSeparation` from `src/game/brain/movement.ts`.

```typescript
// src/game/systems/locomotion-system.ts
import { resolveIdleTarget, computeSeparation, type Bounds, type Position } from "../brain/movement.js";

const ARRIVAL_THRESHOLD = 4;
const SPRITE_MARGIN = 16;

export interface LocomotionEntry {
    command: "none" | "walk-to" | "wander";
    target: { x: number; y: number } | null;
    arrived: boolean;
    speed: number;
    movementStyle: "deliberate" | "brisk" | "darting";
    position: { x: number; y: number };
    // Optional personality for wander resolution
    habits?: { socialDrift: number; focusDrift: number };
}

const SPEED_MAP: Record<string, number> = {
    deliberate: 0.7,
    brisk: 1.0,
    darting: 1.4,
};

export class LocomotionSystem {
    private readonly bounds: Bounds;
    private readonly targetBounds: Bounds;

    constructor(bounds: Bounds) {
        this.bounds = bounds;
        this.targetBounds = {
            minX: bounds.minX + SPRITE_MARGIN,
            maxX: bounds.maxX - SPRITE_MARGIN,
            minY: bounds.minY + SPRITE_MARGIN,
            maxY: bounds.maxY - SPRITE_MARGIN,
        };
    }

    updateAgent(entry: LocomotionEntry, deltaMs: number, nearbyPositions: Position[] = []): void {
        if (entry.command === "wander" && !entry.target) {
            const dest = resolveIdleTarget(
                entry.habits ?? { socialDrift: 0.3, focusDrift: 0.1 },
                nearbyPositions,
                this.targetBounds,
                Math.random,
                entry.position,
            );
            if (dest) {
                entry.target = dest;
                entry.command = "walk-to";
            } else {
                entry.command = "none";
                return;
            }
        }

        if (entry.command === "walk-to" && entry.target) {
            const dx = entry.target.x - entry.position.x;
            const dy = entry.target.y - entry.position.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < ARRIVAL_THRESHOLD) {
                entry.arrived = true;
                entry.command = "none";
                entry.target = null;
                return;
            }

            const speedMult = SPEED_MAP[entry.movementStyle] ?? 1.0;
            const speed = entry.speed * speedMult * (deltaMs / 1000);
            const move = Math.min(speed, dist);
            entry.position.x += (dx / dist) * move;
            entry.position.y += (dy / dist) * move;
        }
    }

    applySeparation(entries: LocomotionEntry[]): void {
        for (const entry of entries) {
            if (entry.command !== "none") continue; // only nudge idle agents
            const others = entries
                .filter((e) => e !== entry)
                .map((e) => e.position);
            const nudged = computeSeparation(entry.position, others, this.targetBounds);
            entry.position.x = nudged.x;
            entry.position.y = nudged.y;
        }
    }
}
```

Note: `resolveIdleTarget` expects an `AgentHabits` object but we only pass a partial. The actual implementation may need to adapt the habits interface or pass the full habits from the blackboard. Adjust during implementation.

- [ ] **Step 4: Run tests — verify pass**
- [ ] **Step 5: Add separation test**

```typescript
it("applies separation between overlapping idle agents", () => {
    const sys = new LocomotionSystem(BOUNDS);
    const a = makeEntry({ position: { x: 400, y: 300 } });
    const b = makeEntry({ position: { x: 402, y: 300 } }); // 2px apart
    sys.applySeparation([a, b]);
    // Should have pushed them apart
    const dist = Math.abs(a.position.x - b.position.x);
    expect(dist).toBeGreaterThan(2);
});
```

- [ ] **Step 6: Run tests — verify pass**
- [ ] **Step 7: Commit**

```
git add src/game/systems/locomotion-system.ts tests/game/systems/locomotion-system.test.ts
git commit -m "feat(plugin): add LocomotionSystem — per-frame movement executor"
```

---

### Task 4: Sensor Phase

**Files:**
- Create: `src/game/systems/sensor-phase.ts`
- Test: `tests/game/systems/sensor-phase.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, it, expect, vi } from "vitest";
import { tickSensors } from "../../../src/game/systems/sensor-phase.js";

describe("tickSensors", () => {
    it("writes needs snapshot to blackboard", () => {
        const bb = { needs: { energy: 0, social: 0, focus: 0, morale: 0, hunger: 0, thirst: 0 } };
        const needs = { getNeeds: vi.fn(() => ({ energy: 80, social: 60, focus: 70, morale: 75, hunger: 80, thirst: 80 })) };
        tickSensors({ name: "Alice", bb: bb as never, needs: needs as never });
        expect(bb.needs.energy).toBe(80);
    });

    it("writes nearby agents to blackboard", () => {
        const bb = { nearbyAgents: [] as string[] };
        const getNearby = vi.fn(() => ["Bob"]);
        tickSensors({ name: "Alice", bb: bb as never, getNearby });
        expect(bb.nearbyAgents).toEqual(["Bob"]);
    });
});
```

Note: The actual `tickSensors` signature will take an `EngineContext`-like object. The tests above use a simplified interface. Adapt during implementation to match the real context shape. The sensor phase gathers data from `NeedsSystem`, `SceneRegistry`, `InteractableActor` stations, `EchoStore`, and writes it all to the agent's blackboard.

- [ ] **Step 2: Run tests — verify fail**
- [ ] **Step 3: Implement sensor phase**

Extract sensor logic from current `tickNeeds` (echo hints, wander hints, room avoidance), `tickBehaviorThresholds` (station resolution), and `getNearbyAgents`. All writes go to blackboard fields.

- [ ] **Step 4: Run tests — verify pass**
- [ ] **Step 5: Commit**

```
git commit -m "feat(plugin): add sensor phase — gathers world state into blackboards"
```

---

### Task 5: New BT Subtrees

**Files:**
- Create: `src/game/brain/behavior-tree/subtrees/idle-wander.ts`
- Create: `src/game/brain/behavior-tree/subtrees/break-routine.ts`
- Create: `src/game/brain/behavior-tree/subtrees/talking-timeout.ts`
- Test: `tests/game/brain/behavior-tree/subtrees/idle-wander.test.ts`

- [ ] **Step 1: Write idle-wander MDSL subtree + condition/action**

The idle-wander subtree replaces `brain.updateIdle()`. The BT condition checks if the agent has been idle for longer than the personality-driven threshold. The action writes `movementCommand: "wander"` to blackboard.

```typescript
// src/game/brain/behavior-tree/subtrees/idle-wander.ts
export const IDLE_WANDER_SUBTREE = `
root [IdleWander] {
    sequence {
        condition [IsIdleLongEnough]
        action [CommandWander]
    }
}
`.trim();
```

`IsIdleLongEnough` reads a `stateTimer` from the BT context (maintained by the BT tick). `CommandWander` writes `bb.movementCommand = "wander"` to the blackboard.

- [ ] **Step 2: Write break-routine and talking-timeout subtrees**

```typescript
// break-routine.ts
export const BREAK_ROUTINE_SUBTREE = `
root [BreakRoutine] {
    sequence {
        condition [NeedsBreak]
        action [SeekRestSpot]
        action [Rest]
    }
}
`.trim();

// talking-timeout.ts
export const TALKING_TIMEOUT_SUBTREE = `
root [TalkingTimeout] {
    sequence {
        condition [IsTalkingTooLong]
        action [StopTalking]
    }
}
`.trim();
```

- [ ] **Step 3: Write tests for new conditions/actions**
- [ ] **Step 4: Run tests — verify pass**
- [ ] **Step 5: Commit**

```
git commit -m "feat(plugin): add idle-wander, break-routine, talking-timeout BT subtrees"
```

---

## Chunk 2: BT Rewire — collect() → blackboard

### Task 6: Update BT Types

**Files:**
- Modify: `src/game/brain/behavior-tree/bt-types.ts`
- Test: existing type tests

- [ ] **Step 1: Update AgentToolDeps** — remove `brain?: IBrainBridge`, add `blackboard: AgentBlackboard`. Remove `CollectedAction` type.
- [ ] **Step 2: Update BTAgentContext** — remove collect-related fields. Add `stateTimer: number` for idle-wander condition.
- [ ] **Step 3: Run type check** — `npx tsc --noEmit` to find all broken imports
- [ ] **Step 4: Commit**

```
git commit -m "refactor(plugin): update BT types — blackboard replaces brain bridge + collect"
```

---

### Task 7: Rewire bt-agent.ts

**Files:**
- Modify: `src/game/brain/behavior-tree/bt-agent.ts`
- Test: `tests/game/brain/behavior-tree/bt-agent.test.ts`

- [ ] **Step 1: Replace all `collect()` calls with blackboard writes**

For each action in bt-agent.ts, replace:
```typescript
// Old pattern
function SeekRestSpot(): State {
    collect("seek-rest", {});
    deps.brain?.applyEvent(context.name, "seek-rest");
    return fromNodeState("succeeded");
}

// New pattern
function SeekRestSpot(): State {
    const bb = deps.blackboard;
    bb.intent = "seeking";
    bb.intentDetail = "seek-rest";
    bb.movementCommand = "walk-to";
    bb.movementTarget = bb.nearestRestStation;
    return fromNodeState("succeeded");
}
```

Apply this pattern to ALL actions: Wander, Emote, Chatter, Socialize, Rest, HandleEvent, SeekRestSpot, SeekNearbyAgent, SeekQuietCorner, WanderSad, GoToWorkstation, DoWork, LeaveWorkstation, EchoBiasedIdle, PickGoal, ReadFile, WriteFile, OpenInVault, QueryLLM, GenerateFromTemplate, DropArtifact, SpeakBubble.

Remove the `collectedActions` array and `collect()` closure from `createBTAgent`.

- [ ] **Step 2: Remove all `deps.brain?.applyEvent()` direct calls**
- [ ] **Step 3: Update tests** — verify blackboard writes instead of collect() calls
- [ ] **Step 4: Run tests — verify pass**
- [ ] **Step 5: Commit**

```
git commit -m "refactor(plugin): BT actions write to blackboard instead of collect/applyEvent"
```

---

### Task 8: Rewire bt-agent-extensions.ts

**Files:**
- Modify: `src/game/brain/behavior-tree/bt-agent-extensions.ts`
- Test: `tests/game/brain/behavior-tree/bt-agent-extensions.test.ts`

- [ ] **Step 1: Replace all seek actions** — same pattern as Task 7

```typescript
// Old
export function SeekFoodStation(ext: BTAgentExtensionDeps): State {
    ext.collect("seek-food");
    ext.deps.brain?.applyEvent(ext.context.name, "seek-food");
    return fromNodeState("succeeded");
}

// New
export function SeekFoodStation(ext: BTAgentExtensionDeps): State {
    const bb = ext.deps.blackboard;
    bb.intent = "seeking";
    bb.intentDetail = "seek-food";
    bb.movementCommand = "walk-to";
    bb.movementTarget = bb.nearestFoodStation;
    return fromNodeState("succeeded");
}
```

Apply to: SeekFoodStation, SeekDrinkStation, Eat, Drink, SeekPreferredFoodStation, SeekPreferredDrinkStation, SeekMerchantStall, BrowseMerchant, ExecuteMerchantPurchase, ExecuteJourney.

- [ ] **Step 2: Update tests**
- [ ] **Step 3: Run tests — verify pass**
- [ ] **Step 4: Commit**

```
git commit -m "refactor(plugin): BT extensions write to blackboard instead of collect/applyEvent"
```

---

### Task 9: Rewire bt-tick.ts

**Files:**
- Modify: `src/game/brain/behavior-tree/bt-tick.ts`
- Test: `tests/game/brain/behavior-tree/bt-tick.test.ts`

- [ ] **Step 1: Remove collectedActions processing loop** — the BT now writes to blackboard directly during tree evaluation. btTick just steps the tree and returns (no post-processing).
- [ ] **Step 2: Remove `worldState.emitAction()` calls**
- [ ] **Step 3: Update return type** — btTick no longer returns `AgentAction[]`. It returns void or a simple status.
- [ ] **Step 4: Update tests**
- [ ] **Step 5: Run tests — verify pass**
- [ ] **Step 6: Commit**

```
git commit -m "refactor(plugin): btTick simplified — no collect/emitAction, BT writes blackboard directly"
```

---

### Task 10: Update BtSystem + createStubDeps

**Files:**
- Modify: `src/game/systems/bt-system.ts`
- Test: `tests/game/systems/bt-system.test.ts`

- [ ] **Step 1: Remove createStubDeps brain bridge** — replace with blackboard injection
- [ ] **Step 2: Update BtSystem.update()** — no longer collects/returns AgentAction[]. The BT writes to blackboards during tree evaluation.
- [ ] **Step 3: Update register()** — pass blackboard to BT deps
- [ ] **Step 4: Update tests**
- [ ] **Step 5: Run tests — verify pass**
- [ ] **Step 6: Commit**

```
git commit -m "refactor(plugin): BtSystem injects blackboard, no longer returns actions"
```

---

## Chunk 3: Engine Rewire — Simulation Loop + Integration

### Task 11: Update EngineContext + engine-types.ts

**Files:**
- Modify: `src/game/engine-types.ts`

- [ ] **Step 1: Add BlackboardManager to EngineContext** — replace brain system field
- [ ] **Step 2: Add LocomotionSystem to systems** — new field
- [ ] **Step 3: Remove brain-system types from context**
- [ ] **Step 4: Run type check** — find all downstream breaks
- [ ] **Step 5: Commit**

```
git commit -m "refactor(plugin): EngineContext uses BlackboardManager + LocomotionSystem"
```

---

### Task 12: Restructure engine-simulation.ts

**Files:**
- Modify: `src/game/engine-simulation.ts`
- Test: `tests/game/engine-simulation.test.ts`

This is the largest single task. The 12 tick functions are reorganized into the 5-stage pipeline from the spec.

- [ ] **Step 1: Delete** — `tickBehaviorThresholds`, `processThresholds`, `tryObjectAttraction`, `OBJECT_ATTRACTION_RULES` import
- [ ] **Step 2: Add** — `tickSensors` call (imports from sensor-phase.ts), `tickLocomotion` call, `blackboards.push()` / `blackboards.pull()`
- [ ] **Step 3: Reorder tickSimulation** — clock → needs → sensorCooldowns → sensors → pets → BT → push → locomotion → pull → roomTransit → interactions → social → director → presentation
- [ ] **Step 4: Update tickBehaviorTree** — remove all post-processing (assignWork, releaseWork, bubble display, seek thoughts). BT writes to blackboard; presentation phase reads.
- [ ] **Step 5: Create tickPresentation** — consolidate talk engine update, reactive triggers, speech requests from blackboard, seek thought bubbles, emotes, particles, camera
- [ ] **Step 6: Update all brain.getState() calls** — replace with blackboard reads
- [ ] **Step 7: Update cascade queue** — write hints to blackboard instead of calling walkTo/applyEvent
- [ ] **Step 8: Rewrite tests** — verify new phase ordering, new sensor/locomotion/presentation phases
- [ ] **Step 9: Run full game test suite** — `npx vitest run tests/game/`
- [ ] **Step 10: Commit**

```
git commit -m "refactor(plugin): restructure engine-simulation — 5-stage blackboard pipeline"
```

---

### Task 13: Rewire engine.ts

**Files:**
- Modify: `src/game/engine.ts`
- Test: `tests/game/engine.test.ts`

- [ ] **Step 1: Remove brain-system import and initialization**
- [ ] **Step 2: Add BlackboardManager + LocomotionSystem initialization**
- [ ] **Step 3: Update agent registration** — register with BlackboardManager instead of brain system
- [ ] **Step 4: Update isEntityIdleForTalk** — read from blackboard intent
- [ ] **Step 5: Remove createBtBridges call** — BT gets blackboard directly
- [ ] **Step 6: Update postframe handler** — read from blackboards.getAll()
- [ ] **Step 7: Add MovementComponent + IntentComponent to agent actors**
- [ ] **Step 8: Update engine.test.ts mocks**
- [ ] **Step 9: Run tests — verify pass**
- [ ] **Step 10: Commit**

```
git commit -m "refactor(plugin): engine.ts uses BlackboardManager, removes brain system"
```

---

### Task 14: Update supporting systems

**Files:**
- Modify: `src/game/systems/needs-system.ts` — read intent from blackboard
- Modify: `src/game/systems/talk/talk-engine.ts` — isIdle reads blackboard
- Modify: `src/game/systems/bubble-system.ts` — speechRequest from blackboard
- Modify: `src/game/systems/emote-system.ts` — intent from blackboard
- Modify: `src/game/systems/social-system.ts` — position from blackboard
- Modify: `src/game/engine-postframe.ts` — blackboard instead of brain
- Modify: `src/game/engine-startup.ts` — init blackboard
- Modify: `src/game/engine-lifecycle.ts` — lifecycle hooks use blackboard
- Modify: `src/game/store/dashboard-store.ts` — brain → blackboard reads

- [ ] **Step 1: Update needs-system** — `getState(name)` → `blackboard.get(name).intent`
- [ ] **Step 2: Update talk-engine** — `isIdle` callback reads blackboard
- [ ] **Step 3: Update remaining systems** — each is a small change (read blackboard instead of brain)
- [ ] **Step 4: Update dashboard-store** — map blackboard fields to store state
- [ ] **Step 5: Run full test suite**
- [ ] **Step 6: Commit**

```
git commit -m "refactor(plugin): all systems read from blackboard instead of brain"
```

---

## Chunk 4: Cleanup + Delete Legacy

### Task 15: Delete brain system files

**Files:**
- Delete: `src/game/brain/agent-brain.ts`
- Delete: `src/game/brain/brain-types.ts`
- Delete: `src/game/systems/brain-system.ts`
- Delete: `src/game/engine-systems-init.ts`
- Delete: `tests/game/brain/agent-brain.test.ts`
- Delete: `tests/game/systems/brain-system.test.ts`
- Delete: `tests/game/engine-systems-init.test.ts`

- [ ] **Step 1: Delete source files**
- [ ] **Step 2: Delete test files**
- [ ] **Step 3: Run `npx tsc --noEmit`** — verify no broken imports remain
- [ ] **Step 4: Run full test suite** — `npm test`
- [ ] **Step 5: Commit**

```
git commit -m "chore(plugin): delete brain system, agent-brain, engine-systems-init — replaced by blackboard + locomotion"
```

---

### Task 16: Final verification + integration test

**Files:**
- Modify: `tests/game/brain/behavior-tree/integration.test.ts` — rewrite for new pipeline

- [ ] **Step 1: Rewrite integration test** — verify end-to-end: sensor → BT → blackboard → locomotion → arrival
- [ ] **Step 2: Run full plugin test suite** — `npm test` (all 9700+ tests)
- [ ] **Step 3: Type check** — `npx tsc --noEmit`
- [ ] **Step 4: Build** — `npm run build`
- [ ] **Step 5: Commit**

```
git commit -m "test(plugin): rewrite integration tests for blackboard + locomotion pipeline"
```

---

## Chunk 5: Documentation

### Task 17: Update documentation

**Files:**
- Modify: Root `CLAUDE.md` or Plugin docs

- [ ] **Step 1: Update architecture description** — blackboard + locomotion replaces brain system
- [ ] **Step 2: Add inline comments** — blackboard.ts, locomotion-system.ts, sensor-phase.ts header comments explaining the pipeline
- [ ] **Step 3: Commit**

```
git commit -m "docs(plugin): update architecture docs for blackboard + locomotion pipeline"
```

---

## Execution Order Summary

| Chunk | Tasks | Dependencies | Est. Commits |
|-------|-------|-------------|-------------|
| **1: Foundation** | 1-5 | None — additive, no deletions | 5 |
| **2: BT Rewire** | 6-10 | Chunk 1 (blackboard exists) | 5 |
| **3: Engine Rewire** | 11-14 | Chunk 2 (BT writes to blackboard) | 4 |
| **4: Cleanup** | 15-16 | Chunk 3 (all systems use blackboard) | 2 |
| **5: Docs** | 17 | Chunk 4 (migration complete) | 1 |

**Total: 17 tasks, ~17 commits**

Each chunk is independently testable. Chunk 1 is purely additive (no breaks). Chunks 2-3 are the core migration. Chunk 4 is cleanup. Chunk 5 is documentation.
