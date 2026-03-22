# Agent World Review Round 2 — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all 17 issues from the second architecture review — BT/brain wiring, roster sync, type alignment, store consistency, and domain purity.

**Architecture:** CLI is authoritative backend (markdown agents, economy ledger, trust profiles). Plugin is visual frontend (ExcaliburJS game world). Plugin imports CLI domain types for interactions but mirrors most other types. BT actions flow through `IBrainBridge` callbacks AND engine dispatch — both must handle all action types.

**Tech Stack:** TypeScript (strict), Vitest, Lit (Plugin UI), ExcaliburJS (Plugin actors)

---

## File Map

### CLI — Files to Modify
| File | Changes |
|------|---------|
| `src/domain/agents/world-state-types.ts` | Backport 7 Plugin-only action types |
| `src/domain/trust/trust-types.ts` | Export named `TrustTier` type |
| `src/domain/agents/agent-export.ts` | Fix goals shape `name→text` in buildDashboardAgent |
| `src/infrastructure/worker-manager.ts` | Fix `toPublicWorker.stop()` to use `setWorkerState` |

### Plugin — Files to Modify
| File | Changes |
|------|---------|
| `src/game/brain/agent-brain.ts` | Add TRANSITIONS for BT locomotion events |
| `src/game/engine-simulation.ts` | Handle 7 missing BT action types in tickBehaviorTree |
| `src/game/systems/brain-system.ts` | Add timeout exit for talking/waiting states |
| `src/game/brain/behavior-tree/subtrees/work-cycle.ts` | Remove SpeakBubble from WorkCycle |
| `src/game/store/dashboard-store.ts` | Immutable update in setAgentEconomy; preserve economy on roster sync |
| `src/game/engine-events-store.ts` | Fix showEconomyCue to use findBubbleAnchor |
| `src/game/engine-lifecycle.ts` | Fix offline progress to use xp field |
| `src/game/data/types.ts` | Align TaskStatus with CLI; import TrustTier; fix goals type |
| `src/game/systems/needs-system.ts` | Import AgentAttributes from data/types |

---

## Chunk 1: BT → Brain Wiring (P0 — Issues 1, 2)

The most impactful fixes. BT locomotion events currently do nothing — agents never walk to food/drink/merchant/rest.

### Task 1: Add TRANSITIONS entries for BT locomotion events

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/brain/agent-brain.ts:10-20`
- Test: `01 - Projects/Flowti Plugin/tests/game/brain/agent-brain.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for each new transition:
```typescript
it("seek-rest transitions to walking-to with custom target", () => {
	const result = transition("idle", { type: "seek-rest" });
	expect(result.state).toBe("walking-to");
	expect(result.target.kind).toBe("custom");
});

it("seek-food transitions to walking-to with custom target", () => {
	const result = transition("idle", { type: "seek-food" });
	expect(result.state).toBe("walking-to");
});

it("seek-drink transitions to walking-to with custom target", () => {
	const result = transition("idle", { type: "seek-drink" });
	expect(result.state).toBe("walking-to");
});

it("seek-merchant transitions to walking-to with custom target", () => {
	const result = transition("idle", { type: "seek-merchant" });
	expect(result.state).toBe("walking-to");
});

it("seek-agent transitions to walking-to with agent target", () => {
	const result = transition("idle", { type: "seek-agent" });
	expect(result.state).toBe("walking-to");
	expect(result.target.kind).toBe("agent");
});

it("seek-quiet transitions to wandering", () => {
	const result = transition("idle", { type: "seek-quiet" });
	expect(result.state).toBe("wandering");
});

it("break transitions to on-break", () => {
	const result = transition("idle", { type: "break" });
	expect(result.state).toBe("on-break");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/brain/agent-brain.test.ts`
Expected: FAIL — unknown transitions return current state

- [ ] **Step 3: Add transition entries**

In `agent-brain.ts`, add these entries to `TRANSITIONS` (after line 19, before the closing `}`):
```typescript
"seek-rest": () => ({ state: "walking-to" as BrainState, target: { kind: "custom" } as MovementTarget }),
"seek-food": () => ({ state: "walking-to" as BrainState, target: { kind: "custom" } as MovementTarget }),
"seek-drink": () => ({ state: "walking-to" as BrainState, target: { kind: "custom" } as MovementTarget }),
"seek-merchant": () => ({ state: "walking-to" as BrainState, target: { kind: "custom" } as MovementTarget }),
"seek-agent": () => ({ state: "walking-to" as BrainState, target: { kind: "agent" } as MovementTarget }),
"seek-quiet": () => ({ state: "wandering" as BrainState, target: NO_MOVE }),
"break": () => ({ state: "on-break" as BrainState, target: NO_MOVE }),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/brain/agent-brain.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/brain/agent-brain.ts" "01 - Projects/Flowti Plugin/tests/game/brain/agent-brain.test.ts"
git commit -m "fix(brain): add TRANSITIONS for BT locomotion events (seek-food/drink/rest/merchant/agent/quiet)"
```

### Task 2: Handle missing BT action types in tickBehaviorTree

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-simulation.ts:514-522`

- [ ] **Step 1: Add handlers for the 7 missing action types**

After the `else if (action.type === "error")` block (line 521) and before the closing `}` of the for loop, add:

```typescript
} else if (action.type === "seek-rest") {
	sys.bubble.showBubble(action.agentName, "thought", "Need a break...", ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 2500);
} else if (action.type === "seek-merchant") {
	sys.bubble.showBubble(action.agentName, "thought", "Off to the shop...", ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 2500);
} else if (action.type === "seek-food") {
	sys.bubble.showBubble(action.agentName, "thought", "Getting hungry...", ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 2500);
} else if (action.type === "seek-drink") {
	sys.bubble.showBubble(action.agentName, "thought", "Need something to drink...", ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 2500);
} else if (action.type === "seek-agent") {
	sys.bubble.showBubble(action.agentName, "thought", "Looking for company...", ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 2500);
} else if (action.type === "seek-quiet") {
	sys.bubble.showBubble(action.agentName, "thought", "Need some quiet...", ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, 2500);
}
```

Note: `wander-sad` and `idle` can be safely ignored (no visual effect needed). The brain transition handles state changes — these handlers add the missing visual feedback.

- [ ] **Step 2: Run Plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-simulation.ts"
git commit -m "fix(game): handle BT seek-* action types in tickBehaviorTree with thought bubbles"
```

### Task 3: Add timeout exit for talking/waiting brain states (Issue 11)

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/systems/brain-system.ts:322-340`

- [ ] **Step 1: Add timeout cases to tickAgentState**

In the `tickAgentState` switch (line 323), add after the `on-break` case:
```typescript
case "talking":
case "waiting":
	if (entry.stateTimer > 10_000) {
		entry.state = "idle";
		entry.stateTimer = 0;
		entry.target = { kind: "none" };
	}
	break;
```

- [ ] **Step 2: Run brain-system tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/brain-system.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/brain-system.ts"
git commit -m "fix(brain): add 10s timeout exit for talking/waiting states to prevent permanent freeze"
```

### Task 4: Remove SpeakBubble from WorkCycle subtree (Issue 12)

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/subtrees/work-cycle.ts`

- [ ] **Step 1: Remove SpeakBubble from the MDSL**

Replace the entire `WORK_CYCLE_SUBTREE` with:
```typescript
export const WORK_CYCLE_SUBTREE = `
root [WorkCycle] {
	sequence {
		condition [HasWorkGoal]
		action [PickGoal]
		action [GoToWorkstation]
		action [DoWork]
		action [LeaveWorkstation]
	}
}
`.trim();
```

`SpeakBubble` was emitting an empty `speaking` action (since `lastLLMResult` is null in this path), inadvertently triggering the `talking` brain state with no content.

- [ ] **Step 2: Run BT tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/brain/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/brain/behavior-tree/subtrees/work-cycle.ts"
git commit -m "fix(bt): remove SpeakBubble from WorkCycle to prevent empty speaking state"
```

---

## Chunk 2: Roster Sync & Type Alignment (P0-P1 — Issues 3, 4, 6, 7, 13)

Fix the data flow between CLI agent definitions and Plugin dashboard state.

### Task 5: Fix goals shape in buildDashboardAgent (Issue 3)

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/agents/agent-export.ts:248`

- [ ] **Step 1: Map goals field names**

At line 248, change:
```typescript
goals: agent.goals,
```
to:
```typescript
goals: agent.goals?.map(g => ({ text: g.name, priority: String(g.priority ?? 0) })),
```

This converts CLI's `{name, priority, condition}` to Plugin's `{text, priority}` shape.

- [ ] **Step 2: Run CLI tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-export.ts"
git commit -m "fix(agents): map goals name→text in buildDashboardAgent for Plugin compatibility"
```

### Task 6: Preserve economy fields during roster sync (Issue 4)

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/config/cli-data-provider.ts:112-116`

- [ ] **Step 1: Merge economy fields instead of replacing wholesale**

Replace `applyRosterFromWatchPayload`:
```typescript
function applyRosterFromWatchPayload(data: { agents?: DashboardAgent[] }): void {
	const incoming = Array.isArray(data.agents) ? data.agents : [];
	// Preserve economy fields from current in-memory agents
	const economyMap = new Map(agents.map(a => [a.name, {
		level: a.level, coin: a.coin, tokens: a.tokens,
		xp: a.xp, trustTier: a.trustTier, capabilities: a.capabilities,
	}]));
	agents = incoming.map(a => {
		const eco = economyMap.get(a.name);
		if (!eco) return a;
		return {
			...a,
			level: a.level ?? eco.level,
			coin: a.coin ?? eco.coin,
			tokens: a.tokens ?? eco.tokens,
			xp: a.xp ?? eco.xp,
			trustTier: a.trustTier ?? eco.trustTier,
			capabilities: a.capabilities ?? eco.capabilities,
		};
	});
	applyRosterFallbacksFromSyncSources();
	notifyRosterSubscribers();
}
```

This preserves in-memory economy state when the roster file doesn't include those fields (which it currently doesn't).

- [ ] **Step 2: Run Plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/config/cli-data-provider.ts"
git commit -m "fix(game): preserve agent economy fields during roster sync instead of wiping"
```

### Task 7: Backport action types to CLI + export TrustTier (Issues 6, part of duplication)

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/agents/world-state-types.ts:9-28`
- Modify: `01 - Projects/Flowti CLI/src/domain/trust/trust-types.ts:20-21`

- [ ] **Step 1: Add missing action types to CLI**

In `world-state-types.ts`, add after line 28 (`"template-generated"`):
```typescript
| "queued"
| "seek-rest" | "seek-agent" | "seek-quiet" | "wander-sad"
| "seek-merchant" | "merchant-purchase";
```

- [ ] **Step 2: Export named TrustTier type**

In `trust-types.ts`, add before the `AgentTrustProfile` interface (before line 20):
```typescript
export type TrustTier = "supervised" | "trusted" | "autonomous";
```

Then change line 21 from:
```typescript
readonly tier: "supervised" | "trusted" | "autonomous";
```
to:
```typescript
readonly tier: TrustTier;
```

- [ ] **Step 3: Run CLI type check + tests**

Run: `cd "01 - Projects/Flowti CLI" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/world-state-types.ts" "01 - Projects/Flowti CLI/src/domain/trust/trust-types.ts"
git commit -m "fix(types): backport Plugin action types to CLI AgentActionType, export named TrustTier"
```

### Task 8: Align Plugin TaskStatus + goals type (Issue 7)

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/data/types.ts:79,92`

- [ ] **Step 1: Expand TaskStatus to match CLI**

Change line 92 from:
```typescript
export type TaskStatus = "pending" | "in-progress" | "completed" | "failed";
```
to:
```typescript
export type TaskStatus = "proposed" | "pending" | "assigned" | "in-progress" | "review" | "completed" | "failed";
```

- [ ] **Step 2: Fix goals type to accept both shapes**

Change line 79 from:
```typescript
readonly suggestedTasks?: readonly { name: string; phases: string[]; input?: { type: "text"; prompt: string }; tool?: { command: string } }[];
readonly goals?: readonly { text: string; priority: string }[];
```
to (the goals line):
```typescript
readonly goals?: readonly { text: string; priority: string; name?: string }[];
```

Adding `name?` makes the type accept both CLI's raw shape and the mapped shape, preventing runtime issues during the transition.

- [ ] **Step 3: Run Plugin type check**

Run: `cd "01 - Projects/Flowti Plugin" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/data/types.ts"
git commit -m "fix(types): align Plugin TaskStatus with CLI 7-state enum, add name field to goals"
```

### Task 9: Fix worker stop() to update world state (Issue 13)

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/infrastructure/worker-manager.ts:179`

- [ ] **Step 1: Fix toPublicWorker.stop()**

Change line 179 from:
```typescript
stop() { impl.state = "stopped"; },
```
to:
```typescript
stop() { setWorkerState(impl, "stopped", worldState); },
```

This ensures world state is updated when the public API is used to stop a worker.

- [ ] **Step 2: Run worker-manager tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/infrastructure/worker-manager.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/infrastructure/worker-manager.ts"
git commit -m "fix(worker): update world state when stopping worker via public API"
```

---

## Chunk 3: Store & Engine Quality (P1-P2 — Issues 5, 14, 15)

### Task 10: Fix setAgentEconomy to use immutable update (Issue 5)

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts:100-109`

- [ ] **Step 1: Replace mutation with immutable pattern**

Replace the `setAgentEconomy` method:
```typescript
setAgentEconomy(name: string, data: { level?: number; coin?: number; tokens?: number; xp?: number; trustTier?: string; capabilities?: string[] }): void {
	const idx = this.agents.findIndex(a => a.name === name);
	if (idx === -1) return;
	const agent = this.agents[idx];
	const updated = { ...agent } as DashboardAgent;
	if (data.level !== undefined) updated.level = data.level;
	if (data.coin !== undefined) updated.coin = data.coin;
	if (data.tokens !== undefined) updated.tokens = data.tokens;
	if (data.xp !== undefined) updated.xp = data.xp;
	if (data.trustTier !== undefined) updated.trustTier = data.trustTier as "supervised" | "trusted" | "autonomous";
	if (data.capabilities !== undefined) updated.capabilities = data.capabilities;
	this.agents = [...this.agents.slice(0, idx), updated, ...this.agents.slice(idx + 1)] as unknown as readonly DashboardAgent[];
	this.notify();
}
```

This creates a new object and a new array, consistent with the store's immutable-identity semantics.

- [ ] **Step 2: Run store tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/store/`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/store/dashboard-store.ts"
git commit -m "fix(store): use immutable update in setAgentEconomy for consistent snapshot semantics"
```

### Task 11: Fix showEconomyCue bubble anchor (Issue 14)

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-events-store.ts:44`

- [ ] **Step 1: Change findAgentActor to findBubbleAnchor**

Change line 44 from:
```typescript
ctx.systems.bubble.showBubble(agentName, "thought", text, ctx.engine.currentScene, ctx.lookups.findAgentActor, cue.duration ?? 2000);
```
to:
```typescript
ctx.systems.bubble.showBubble(agentName, "thought", text, ctx.engine.currentScene, ctx.lookups.findBubbleAnchor, cue.duration ?? 2000);
```

- [ ] **Step 2: Run Plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-events-store.ts"
git commit -m "fix(game): use findBubbleAnchor in showEconomyCue for correct bubble anchoring"
```

### Task 12: Fix offline progress XP baseline (Issue 15)

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/engine-lifecycle.ts:247`

- [ ] **Step 1: Read xp field with fallback to experience**

Change line 247 from:
```typescript
xp: a.experience ?? 0,
```
to:
```typescript
xp: a.xp ?? a.experience ?? 0,
```

Same pattern as the panel-economy fix from round 1 — `xp` is the authoritative field set by `setAgentEconomy`, `experience` is the markdown-sourced fallback.

- [ ] **Step 2: Run Plugin tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/engine-lifecycle.ts"
git commit -m "fix(game): use xp field for offline progress baseline, fallback to experience"
```

---

## Chunk 4: Domain Purity & Minor Cleanup (P2 — Issues 8-10, 16-17)

These are pre-existing tech debt items. Each is independent.

### Task 13: Remove AgentAttributes shadow in needs-system.ts (from duplication review)

**Files:**
- Modify: `01 - Projects/Flowti Plugin/src/game/systems/needs-system.ts:28-35`

- [ ] **Step 1: Replace shadow with import**

Remove the private `AgentAttributes` interface (lines 28-35) and add an import at the top:
```typescript
import type { AgentAttributes } from "../data/types.js";
```

- [ ] **Step 2: Run needs-system tests**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run tests/game/systems/needs-system.test.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti Plugin/src/game/systems/needs-system.ts"
git commit -m "fix(needs): import AgentAttributes from data/types instead of shadowing"
```

### Task 14: Inject parseFrontmatterContent via deps (Issues 8-10)

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/agents/agent-session.ts:4`
- Modify: `01 - Projects/Flowti CLI/src/domain/agents/brief-store.ts:7,10`
- Modify: `01 - Projects/Flowti CLI/src/domain/agents/agent-store.ts:12-13`

These three domain files import `parseFrontmatterContent` directly from infrastructure. The fix pattern is the same for each: add `parseFrontmatter` to the deps type and inject it.

**Note:** This is a larger refactoring that touches multiple call sites. For `agent-session.ts` and `brief-store.ts`, the fix is straightforward — add the function to their deps type. For `agent-store.ts`, both `Document` and `parseFrontmatterContent` need injection, which requires more extensive changes to the store engine integration.

- [ ] **Step 1: Fix agent-session.ts**

Replace the value import (line 4):
```typescript
import { parseFrontmatterContent } from "../../infrastructure/frontmatter.js";
```
with a type-only import pattern — add `parseFrontmatter` to `SessionStoreDeps`:
```typescript
// In the SessionStoreDeps type, add:
readonly parseFrontmatter: (content: string) => { data: Record<string, unknown>; body: string } | null;
```
Then replace all calls to `parseFrontmatterContent(...)` with `deps.parseFrontmatter(...)`.

- [ ] **Step 2: Fix brief-store.ts**

Same pattern — remove value import (line 7), add `parseFrontmatter` to `BriefStoreDeps` (line 10):
```typescript
export type BriefStoreDeps = Pick<CliDeps, "disk" | "paths"> & {
	readonly parseFrontmatter: (content: string) => { data: Record<string, unknown>; body: string } | null;
};
```
Replace all three call sites.

- [ ] **Step 3: Update controllers that create these deps**

Controllers that call `agent-session` and `brief-store` functions need to pass `parseFrontmatter` in their deps object. Grep for callers and add the field.

- [ ] **Step 4: Run CLI tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-session.ts" "01 - Projects/Flowti CLI/src/domain/agents/brief-store.ts"
git commit -m "fix(agents): inject parseFrontmatter via deps in agent-session and brief-store"
```

**Note on agent-store.ts:** The `Document` import is deeply integrated with the store engine pattern. This is a larger refactoring best addressed as a separate tech-debt ticket rather than in this review fix pass.

### Task 15: Fix action-mapper module-level counter (Issue 16)

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/agents/action-mapper.ts:11,14`

- [ ] **Step 1: Remove module-level counter, use crypto-grade unique suffix**

Remove line 11 (`let actionCounter = 0;`).

Change line 14 from:
```typescript
const base = { id: `action-${clock.ms()}-${++actionCounter}`, agentName, timestamp: clock.iso() };
```
to:
```typescript
const base = { id: `action-${clock.ms()}-${Math.random().toString(36).slice(2, 8)}`, agentName, timestamp: clock.iso() };
```

This eliminates the shared mutable state while maintaining ID uniqueness. The `Math.random` suffix has sufficient entropy for action IDs (36^6 ≈ 2B combinations).

- [ ] **Step 2: Run action-mapper tests**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run tests/domain/agents/action-mapper.test.ts --config configs/vitest.config.ts`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/action-mapper.ts"
git commit -m "fix(agents): replace module-level counter with random suffix in action-mapper"
```

### Task 16: Document appendToEventLog O(n²) issue (Issue 17)

**Files:**
- Modify: `01 - Projects/Flowti CLI/src/domain/agents/agent-process-loop.ts:170-178`

This is a performance issue that requires adding `appendFileSync` to `IFileSystem`. For now, add a comment documenting the known issue and deferring to a tech-debt ticket.

- [ ] **Step 1: Add performance note**

Add a comment above `appendToEventLog`:
```typescript
/**
 * Append a line to the event log.
 * NOTE: Uses read-then-write pattern (O(n²) for long sessions).
 * Should use appendFileSync when IFileSystem supports it.
 */
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Flowti CLI/src/domain/agents/agent-process-loop.ts"
git commit -m "docs(agents): document appendToEventLog O(n²) performance issue"
```

---

## Verification

### Task 17: Full cross-project verification

- [ ] **Step 1: Run CLI full check**

Run: `cd "01 - Projects/Flowti CLI" && npx vitest run --config configs/vitest.config.ts`
Expected: PASS (same baseline failure count, no new failures)

- [ ] **Step 2: Run Plugin full check**

Run: `cd "01 - Projects/Flowti Plugin" && npx vitest run`
Expected: PASS (same baseline failure count, no new failures)

---

## Summary

| Task | Issue # | Fix | Priority |
|------|---------|-----|----------|
| 1 | 1,2 | Add BT locomotion TRANSITIONS | P0 |
| 2 | 1,2 | Handle BT seek-* in tickBehaviorTree | P0 |
| 3 | 11 | Timeout exit for talking/waiting | P1 |
| 4 | 12 | Remove SpeakBubble from WorkCycle | P1 |
| 5 | 3 | Goals name→text in buildDashboardAgent | P0 |
| 6 | 4 | Preserve economy fields during roster sync | P0 |
| 7 | 6 | Backport action types + export TrustTier | P1 |
| 8 | 7 | Align TaskStatus + goals type | P1 |
| 9 | 13 | Fix worker stop() world state | P1 |
| 10 | 5 | Immutable setAgentEconomy | P1 |
| 11 | 14 | Fix showEconomyCue bubble anchor | P1 |
| 12 | 15 | Fix offline progress XP baseline | P1 |
| 13 | duplication | Remove AgentAttributes shadow | P2 |
| 14 | 8-10 | Inject parseFrontmatter via deps | P2 |
| 15 | 16 | Fix action-mapper counter | P2 |
| 16 | 17 | Document appendToEventLog issue | P2 |
| 17 | — | Full verification | — |
