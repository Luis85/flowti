# Camera Follow + BT Service Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the camera follow agents across room switches, and isolate mistreevous behind a single vendor adapter.

**Architecture:** Feature 1 adds follow-aware scene switching in the `onTransferComplete` callback (3 lines of logic). Feature 2 creates `bt-service.ts` as the sole mistreevous import point, then mechanically migrates 5 consumer files to import from it instead.

**Tech Stack:** TypeScript, ExcaliburJS, mistreevous, Vitest

**Spec:** `01 - Projects/Flowti CLI/docs/specs/2026-03-21-camera-follow-bt-service-design.md`

---

## Chunk 1: Camera Follow Across Room Switches

### Task 1: Add follow-aware scene switch to onTransferComplete

**Files:**
- Modify: `src/game/engine.ts:576-580`
- Modify: `tests/game/engine.test.ts`

- [ ] **Step 1: Write the failing tests**

In `tests/game/engine.test.ts`, add a new describe block after the existing `createAgentWorld` describe. The existing test file mocks `RoomSwitcher` as a constructor function. Access the `onTransferComplete` callback from the mock constructor's captured config argument.

```typescript
describe("follow across rooms", () => {
	function getTransferCallback(): (entityId: string, from: string, to: string, reason: string) => void {
		const { RoomSwitcher } = require("../../src/game/systems/room-switcher.js");
		const config = (RoomSwitcher as ReturnType<typeof vi.fn>).mock.calls[0][0];
		return config.onTransferComplete;
	}

	function getStoreInstance(): Record<string, unknown> {
		const { DashboardStore } = require("../../src/game/store/dashboard-store.js");
		return (DashboardStore as ReturnType<typeof vi.fn>).mock.instances[0] as Record<string, unknown>;
	}

	function getEngineInstance(): Record<string, unknown> {
		const ex = require("excalibur");
		return (ex.Engine as ReturnType<typeof vi.fn>).mock.instances[0] as Record<string, unknown>;
	}

	it("switches scene when followed agent transfers rooms", () => {
		createAgentWorld({
			container: document.createElement("div"),
			provider: createMockProvider(),
			spriteBasePath: "/test",
		});
		const store = getStoreInstance();
		store.followedAgent = "alice";

		getTransferCallback()("alice", "hub", "office", "transfer");

		expect(getEngineInstance().goToScene).toHaveBeenCalledWith("office", expect.any(Object));
	});

	it("does NOT switch scene when a different agent transfers", () => {
		createAgentWorld({
			container: document.createElement("div"),
			provider: createMockProvider(),
			spriteBasePath: "/test",
		});
		const store = getStoreInstance();
		store.followedAgent = "alice";

		getTransferCallback()("bob", "hub", "office", "transfer");

		expect(getEngineInstance().goToScene).not.toHaveBeenCalledWith("office", expect.any(Object));
	});

	it("does NOT switch scene when no agent is followed", () => {
		createAgentWorld({
			container: document.createElement("div"),
			provider: createMockProvider(),
			spriteBasePath: "/test",
		});

		getTransferCallback()("alice", "hub", "office", "transfer");

		expect(getEngineInstance().goToScene).not.toHaveBeenCalledWith("office", expect.any(Object));
	});

	it("does NOT call selectAgent during follow-triggered scene switch", () => {
		createAgentWorld({
			container: document.createElement("div"),
			provider: createMockProvider(),
			spriteBasePath: "/test",
		});
		const store = getStoreInstance();
		store.followedAgent = "alice";
		(store.selectAgent as ReturnType<typeof vi.fn>).mockClear();

		getTransferCallback()("alice", "hub", "office", "transfer");

		expect(store.selectAgent).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/engine.test.ts -t "follow across rooms"`
Expected: FAIL — `goToScene` is not called because the feature isn't implemented yet

- [ ] **Step 3: Implement the follow-aware scene switch**

In `src/game/engine.ts`, update the `onTransferComplete` callback (around line 576-580). Replace:

```typescript
onTransferComplete: (entityId, _from, to) => {
	const label = to.charAt(0).toUpperCase() + to.slice(1);
	bubbleSystem.showBubble(entityId, "thought", `Visiting ${label}...`, engine.currentScene, findAgentActor, 3000);
	store.pushWorldEvent("room-switch", `${entityId} moved to ${label}`);
},
```

With:

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

- [ ] **Step 4: Run the tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/engine.test.ts`
Expected: All pass (existing + new)

- [ ] **Step 5: Run full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: 9,019+ pass, 0 fail

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine.ts" \
        "01 - Projects/Flowti Plugin/tests/game/engine.test.ts"
git commit -m "feat(engine): camera follows agent across room switches

When the user is following an agent and that agent transfers to another
room via RoomSwitcher, the scene automatically switches with a fade
transition and the camera re-locks on the agent in the new scene."
```

---

## Chunk 2: BT Service Wrapper

### Task 2: Create bt-service.ts — the vendor adapter

**Files:**
- Create: `src/game/brain/behavior-tree/bt-service.ts`
- Create: `tests/game/brain/behavior-tree/bt-service.test.ts`

- [ ] **Step 1: Write the test file**

Create `tests/game/brain/behavior-tree/bt-service.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
	toNodeState,
	fromNodeState,
	createTree,
	stepTree,
	type NodeState,
} from "../../../../src/game/brain/behavior-tree/bt-service.js";

describe("bt-service", () => {
	describe("toNodeState", () => {
		it("maps succeeded", () => {
			expect(toNodeState(fromNodeState("succeeded"))).toBe("succeeded");
		});

		it("maps running", () => {
			expect(toNodeState(fromNodeState("running"))).toBe("running");
		});

		it("maps failed", () => {
			expect(toNodeState(fromNodeState("failed"))).toBe("failed");
		});
	});

	describe("fromNodeState round-trip", () => {
		it.each(["succeeded", "running", "failed"] as NodeState[])("round-trips %s", (ns) => {
			expect(toNodeState(fromNodeState(ns))).toBe(ns);
		});
	});

	describe("createTree + stepTree", () => {
		it("creates a tree that can be stepped", () => {
			const agent = {
				Succeed: () => fromNodeState("succeeded"),
			};
			const tree = createTree("root { action [Succeed] }", agent);
			expect(() => stepTree(tree)).not.toThrow();
		});
	});
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/brain/behavior-tree/bt-service.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create bt-service.ts**

Create `src/game/brain/behavior-tree/bt-service.ts`:

```typescript
/**
 * bt-service.ts — Vendor adapter for the mistreevous behavior tree library.
 *
 * This is the ONLY file that imports mistreevous. All other BT code
 * imports types and utilities from here.
 */

import { BehaviourTree, State } from "mistreevous";

// ── Our state type — replaces mistreevous State enum ──────────
// mistreevous State is a string enum: State.SUCCEEDED = "mistreevous.succeeded" etc.
// NodeState provides clean, vendor-neutral string literals.
export type NodeState = "succeeded" | "running" | "failed";

// ── Conversion ────────────────────────────────────────────────
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
export function createTree(mdsl: string, agent: object): BehaviourTree {
	return new BehaviourTree(mdsl, agent as Record<string, unknown>);
}

export function stepTree(tree: BehaviourTree): void {
	tree.step();
}

// Re-export opaque types for consumer signatures
export type { BehaviourTree, State };
```

**Important:** `State` is re-exported as a type so that `BTAgentObject` and `PetBTObject` interfaces can use it for action method return types without importing mistreevous directly.

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/brain/behavior-tree/bt-service.test.ts`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-service.ts" \
        "01 - Projects/Flowti Plugin/tests/game/brain/behavior-tree/bt-service.test.ts"
git commit -m "feat(bt): add bt-service vendor adapter for mistreevous"
```

---

### Task 3: Migrate bt-tick.ts — replace direct mistreevous import

**Files:**
- Modify: `src/game/brain/behavior-tree/bt-tick.ts`

- [ ] **Step 1: Update imports and usage**

In `src/game/brain/behavior-tree/bt-tick.ts`, replace:

```typescript
import type { BehaviourTree } from "mistreevous";
```

With:

```typescript
import { stepTree, type BehaviourTree } from "./bt-service.js";
```

And replace line 22:

```typescript
	tree.step();
```

With:

```typescript
	stepTree(tree);
```

- [ ] **Step 2: Run existing BT tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/brain/behavior-tree/`
Expected: All pass — behavior unchanged

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-tick.ts"
git commit -m "refactor(bt): migrate bt-tick to use bt-service adapter"
```

---

### Task 4: Migrate bt-factory.ts — replace BehaviourTree constructor

**Files:**
- Modify: `src/game/brain/behavior-tree/bt-factory.ts`

- [ ] **Step 1: Update imports and usage**

In `src/game/brain/behavior-tree/bt-factory.ts`, replace line 9:

```typescript
import { BehaviourTree } from "mistreevous";
```

With:

```typescript
import { createTree, type BehaviourTree } from "./bt-service.js";
```

Replace line 96:

```typescript
	const tree = new BehaviourTree(allMDSL, btAgent as unknown as Record<string, unknown>);
```

With:

```typescript
	const tree = createTree(allMDSL, btAgent);
```

The `as unknown as Record<string, unknown>` cast is no longer needed — `createTree` accepts `object` and handles the cast internally.

- [ ] **Step 2: Run BT tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/brain/behavior-tree/`
Expected: All pass

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-factory.ts"
git commit -m "refactor(bt): migrate bt-factory to use bt-service adapter"
```

---

### Task 5: Migrate bt-agent.ts — replace State enum with fromNodeState

**Files:**
- Modify: `src/game/brain/behavior-tree/bt-agent.ts`
- Modify: `tests/game/brain/behavior-tree/bt-agent.test.ts`

This is the largest migration: 38 `State.SUCCEEDED/RUNNING/FAILED` references in bt-agent.ts and 10 in the test file.

**Warning:** Do NOT use bare `State.` as a find target — `deps.worldState.updateEntity` (line 333) contains `State.` and must not be changed. Target only `State.SUCCEEDED`, `State.RUNNING`, and `State.FAILED` specifically.

- [ ] **Step 1: Update bt-agent.ts imports**

Replace:

```typescript
import { State } from "mistreevous";
```

With:

```typescript
import { fromNodeState, type State } from "./bt-service.js";
```

`State` is imported as a type — it's still needed for the `BTAgentObject` interface action method return types (e.g., `PickGoal(): State`) and for the function implementation return type annotations (e.g., `function PickGoal(): State {`). These type annotations stay as `State` — only the value references change.

- [ ] **Step 2: Mechanical replacement in bt-agent.ts**

Replace all value-level `State.*` references (38 total):

| Find (exact) | Replace |
|------|---------|
| `State.SUCCEEDED` | `fromNodeState("succeeded")` |
| `State.RUNNING` | `fromNodeState("running")` |
| `State.FAILED` | `fromNodeState("failed")` |

Leave untouched:
- `(): State;` in the `BTAgentObject` interface — these are type annotations
- `): State {` in function signatures — these are return type annotations
- `deps.worldState.updateEntity` — not a mistreevous reference

- [ ] **Step 3: Update bt-agent.test.ts**

Replace the import:

```typescript
import { State } from "mistreevous";
```

With:

```typescript
import { fromNodeState } from "../../../../src/game/brain/behavior-tree/bt-service.js";
```

Then replace all `State.SUCCEEDED` → `fromNodeState("succeeded")` and `State.FAILED` → `fromNodeState("failed")` (10 occurrences).

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/brain/behavior-tree/bt-agent.test.ts`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/bt-agent.ts" \
        "01 - Projects/Flowti Plugin/tests/game/brain/behavior-tree/bt-agent.test.ts"
git commit -m "refactor(bt): migrate bt-agent to use bt-service adapter

Replace 38 State.* value references with fromNodeState() calls.
Eliminate direct mistreevous import."
```

---

### Task 6: Migrate pet-bt.ts — replace State and BehaviourTree

**Files:**
- Modify: `src/game/brain/behavior-tree/pet-bt.ts`

- [ ] **Step 1: Update imports**

Replace:

```typescript
import { BehaviourTree, State } from "mistreevous";
```

With:

```typescript
import { createTree, fromNodeState, type BehaviourTree, type State } from "./bt-service.js";
```

`State` is imported as a type for the `PetBTObject` interface action method return types and function signature return types.

- [ ] **Step 2: Replace State value references**

Replace all 7 `State.SUCCEEDED` → `fromNodeState("succeeded")` in the action function bodies.

Leave untouched:
- `(): State;` in the `PetBTObject` interface
- `): State {` in function implementation signatures

- [ ] **Step 3: Replace tree construction**

Replace:

```typescript
	const tree = new BehaviourTree(PET_MASTER_MDSL, agent as unknown as Record<string, unknown>);
```

With:

```typescript
	const tree = createTree(PET_MASTER_MDSL, agent);
```

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/brain/behavior-tree/pet-bt.test.ts`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/pet-bt.ts"
git commit -m "refactor(bt): migrate pet-bt to use bt-service adapter"
```

---

### Task 7: Final verification — confirm zero mistreevous imports outside bt-service

**Files:** None (verification only)

- [ ] **Step 1: Verify no remaining mistreevous imports**

Run from the Plugin project root (`01 - Projects/Flowti Plugin`):

```bash
grep -r "from \"mistreevous\"" src/ --include="*.ts" | grep -v "bt-service.ts"
```
Expected: No output (zero matches)

```bash
grep -r "from \"mistreevous\"" tests/ --include="*.ts"
```
Expected: No output (zero matches)

- [ ] **Step 2: Run full test suite**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: 9,019+ pass, 0 fail

- [ ] **Step 3: Type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit 2>&1 | grep -v node_modules/ | grep "^src/\|^tests/" | head -20`
Expected: Only pre-existing errors (interactable-actor tests, hub-scene import) — no new errors

- [ ] **Step 4: Final commit if any cleanup needed**

Only if there are remaining fixes. Otherwise, the feature is complete.
