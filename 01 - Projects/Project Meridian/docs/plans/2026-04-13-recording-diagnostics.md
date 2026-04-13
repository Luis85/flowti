# Recording Diagnostics Enhancement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add 4 transition-based diagnostic events to the JSONL recording system and throttle BtEvaluated to reduce noise.

**Architecture:** New events emit on state transitions only (action changed, commitment lifecycle, need threshold crossed, trade processed). No recorder changes — events flow through the existing `eventBus.onAny()` pipeline. BtEvaluated is throttled to leaf-changed-only.

**Tech Stack:** TypeScript, ExcaliburJS ECS, Vitest

**Spec:** `01 - Projects/Project Meridian/docs/specs/2026-04-13-recording-diagnostics-design.md`

**Test command:** `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

**Typecheck:** `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: ActionChanged + BtEvaluated Throttle

### Task 1: ActionChanged event + BtEvaluated throttle in behavior-tree-system.ts

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/systems/behavior-tree-system.ts`
- Test: `01 - Projects/Project Meridian/tests/infrastructure/systems/behavior-tree-system.test.ts`

- [ ] **Step 1: Write failing tests for ActionChanged**

Add to the existing `describe` block in `behavior-tree-system.test.ts`:

```typescript
it('emits ActionChanged when btAction changes between ticks', () => {
	const agent = createMockAgent();
	const deps = createDeps();
	const emitSpy = vi.spyOn(deps.eventBus, 'emit');
	const system = createBehaviorTreeSystem(() => [agent]);

	// Tick 1: btAction stays null (step mock doesn't set it)
	system.execute(deps);

	// Tick 2: step sets btAction to 'work'
	(agent as unknown as { _stepFn: ReturnType<typeof vi.fn> })._stepFn.mockImplementation(() => {
		agent.behaviorAgent.btAction = 'work';
	});
	deps.tickCount = 2;
	system.execute(deps);

	const changed = emitSpy.mock.calls.filter(c => c[0].type === 'ActionChanged');
	expect(changed).toHaveLength(1);
	expect(changed[0]![0].payload).toMatchObject({
		agentId: 'agent-test',
		previousAction: null,
		newAction: 'work',
		preempted: false,
	});
});

it('sets preempted=true when both old and new actions are non-null', () => {
	const agent = createMockAgent();
	const deps = createDeps();
	const emitSpy = vi.spyOn(deps.eventBus, 'emit');
	const system = createBehaviorTreeSystem(() => [agent]);

	// Tick 1: set action to 'seek_well'
	(agent as unknown as { _stepFn: ReturnType<typeof vi.fn> })._stepFn.mockImplementation(() => {
		agent.behaviorAgent.btAction = 'seek_well';
	});
	system.execute(deps);

	// Tick 2: action changes to 'seek_market'
	(agent as unknown as { _stepFn: ReturnType<typeof vi.fn> })._stepFn.mockImplementation(() => {
		agent.behaviorAgent.btAction = 'seek_market';
	});
	deps.tickCount = 2;
	system.execute(deps);

	const changed = emitSpy.mock.calls.filter(c => c[0].type === 'ActionChanged');
	expect(changed).toHaveLength(2); // null→seek_well, seek_well→seek_market
	const preemption = changed[1]![0].payload;
	expect(preemption.preempted).toBe(true);
	expect(preemption.previousAction).toBe('seek_well');
	expect(preemption.newAction).toBe('seek_market');
});

it('does not emit ActionChanged when btAction stays the same', () => {
	const agent = createMockAgent();
	const deps = createDeps();
	const emitSpy = vi.spyOn(deps.eventBus, 'emit');
	const system = createBehaviorTreeSystem(() => [agent]);

	// Both ticks: btAction = 'work'
	(agent as unknown as { _stepFn: ReturnType<typeof vi.fn> })._stepFn.mockImplementation(() => {
		agent.behaviorAgent.btAction = 'work';
	});
	system.execute(deps);
	deps.tickCount = 2;
	system.execute(deps);

	const changed = emitSpy.mock.calls.filter(c => c[0].type === 'ActionChanged');
	expect(changed).toHaveLength(1); // only the initial null→work
});
```

- [ ] **Step 2: Write failing test for BtEvaluated throttle**

```typescript
it('throttles BtEvaluated — only emits when leaf changes', () => {
	const agent = createMockAgent();
	(agent.behaviorTree as Record<string, unknown>).getTreeNodeDetails = vi.fn().mockReturnValue({
		name: 'ROOT', type: 'root', state: 'mistreevous.running',
		children: [{ name: 'Eat', type: 'action', state: 'mistreevous.running', children: [] }],
	});
	const deps = createDeps();
	const emitSpy = vi.spyOn(deps.eventBus, 'emit');
	const system = createBehaviorTreeSystem(() => [agent]);

	// Tick 1: leaf=Eat — emit
	system.execute(deps);
	// Tick 2: leaf=Eat again — throttled
	deps.tickCount = 2;
	system.execute(deps);

	const btEvents = emitSpy.mock.calls.filter(c => c[0].type === 'BtEvaluated');
	expect(btEvents).toHaveLength(1); // only first tick emits
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/behavior-tree-system.test.ts --config configs/vitest.config.ts`
Expected: FAIL — ActionChanged events not emitted, BtEvaluated not throttled.

- [ ] **Step 4: Implement ActionChanged + BtEvaluated throttle**

Replace the full `createBehaviorTreeSystem` function in `behavior-tree-system.ts`:

```typescript
export function createBehaviorTreeSystem(
	agents: () => AgentActor[],
): GameSystem {
	const previousActions = new Map<string, string | null>();
	const previousLeaves = new Map<string, string>();

	return {
		name: 'BehaviorTreeSystem',
		priority: SystemPriority.BEHAVIOR_TREE,
		execute(deps: GameCoreDeps): void {
			const agentList = agents();
			const currentAgentIds = new Set<string>();

			for (const agent of agentList) {
				currentAgentIds.add(agent.agentId);
				agent.behaviorAgent.tickUnemployment();
				agent.behaviorAgent.btAction = null;
				agent.behaviorTree.reset();
				agent.behaviorTree.step();

				// ── ActionChanged ──────────────────────────────────
				const newAction = agent.behaviorAgent.btAction;
				const prevAction = previousActions.get(agent.agentId) ?? null;
				if (newAction !== prevAction) {
					deps.eventBus.emit({
						type: 'ActionChanged',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'BehaviorTreeSystem',
						payload: {
							agentId: agent.agentId,
							previousAction: prevAction,
							newAction,
							preempted: prevAction !== null && newAction !== null && prevAction !== newAction,
							committedAction: agent.behaviorAgent.committedAction,
							commitmentTicks: agent.behaviorAgent.commitmentTicks,
						},
					});
				}
				previousActions.set(agent.agentId, newAction);

				// ── BtEvaluated (throttled — leaf change only) ────
				let leaf = 'unknown';
				let leafStatus = 'unknown';
				try {
					const details = agent.behaviorTree.getTreeNodeDetails();
					const result = extractLeafNode(details);
					leaf = result.name;
					leafStatus = result.state;
				} catch {
					// Tree may throw during initialization
				}

				const prevLeaf = previousLeaves.get(agent.agentId);
				if (leaf !== prevLeaf) {
					deps.eventBus.emit({
						type: 'BtEvaluated',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'BehaviorTreeSystem',
						payload: {
							agentId: agent.agentId,
							leaf,
							leafStatus,
							action: newAction,
							committedAction: agent.behaviorAgent.committedAction,
							commitmentTicks: agent.behaviorAgent.commitmentTicks,
						},
					});
				}
				previousLeaves.set(agent.agentId, leaf);
			}

			// Cleanup stale entries for removed agents
			for (const id of previousActions.keys()) {
				if (!currentAgentIds.has(id)) {
					previousActions.delete(id);
					previousLeaves.delete(id);
				}
			}
		},
	};
}
```

- [ ] **Step 5: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/behavior-tree-system.test.ts --config configs/vitest.config.ts`
Expected: PASS. Note: the existing test `emits BtEvaluated event after each agent step` should still pass since the first tick always emits (leaf change from undefined to 'Eat').

- [ ] **Step 6: Run typecheck + full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/behavior-tree-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/systems/behavior-tree-system.test.ts"
git commit -m "feat(meridian): emit ActionChanged event, throttle BtEvaluated to leaf-change-only"
```

---

## Chunk 2: CommitmentChanged

### Task 2: CommitmentChanged from beginAction (created + higher_priority)

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/entity/bt-action-helpers.ts`

- [ ] **Step 1: Implement CommitmentChanged emissions in beginAction**

In `bt-action-helpers.ts`, update `beginAction` to emit events. The function already has access to `ctx.deps.eventBus` and `ctx.deps.tickCount()`:

```typescript
export function beginAction(ctx: ActionContext, actionName: string): void {
	const { memory, commitmentMultiplier } = ctx;
	const { config } = ctx.deps;
	memory.btAction = actionName;
	// If a different action overrides an existing commitment (e.g., P0 critical needs
	// preempting P-1), clear the stale commitment so the new action owns the timer.
	if (memory.commitmentTicks > 0 && memory.committedAction !== actionName) {
		ctx.deps.eventBus.emit({
			type: 'CommitmentChanged',
			tick: ctx.deps.tickCount(),
			wallClock: Date.now(),
			source: 'beginAction',
			payload: {
				agentId: ctx.actor.agentId,
				event: 'broken',
				action: memory.committedAction ?? actionName,
				reason: 'higher_priority',
				ticksRemaining: memory.commitmentTicks,
			},
		});
		memory.commitmentTicks = 0;
		memory.committedAction = null;
	}
	if (memory.commitmentTicks <= 0) {
		const duration = Math.round((config.commitment_ticks[actionName] ?? 0) * commitmentMultiplier);
		if (duration > 0) {
			memory.commitmentTicks = duration;
			memory.committedAction = actionName;
			ctx.deps.eventBus.emit({
				type: 'CommitmentChanged',
				tick: ctx.deps.tickCount(),
				wallClock: Date.now(),
				source: 'beginAction',
				payload: {
					agentId: ctx.actor.agentId,
					event: 'created',
					action: actionName,
					ticksRemaining: duration,
				},
			});
		}
	}
}
```

- [ ] **Step 2: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-action-helpers.ts"
git commit -m "feat(meridian): emit CommitmentChanged from beginAction (created + higher_priority)"
```

---

### Task 3: CommitmentChanged from ContinueCommitment (expired + broken)

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions.ts`

- [ ] **Step 1: Refactor breakCommitment to accept reason and emit**

In `bt-actions.ts`, inside `ContinueCommitment`, refactor `breakCommitment` to accept a reason and emit `CommitmentChanged`. The closure has access to `ctx.deps.eventBus` and `ctx.deps.tickCount()` via the `createActions` scope:

Replace the existing `breakCommitment` helper (lines 148-156):

```typescript
			const breakCommitment = (reason: string): void => {
				const ca = memory.committedAction;
				const remaining = memory.commitmentTicks;
				memory.commitmentTicks = 0;
				memory.committedAction = null;
				if (ca === 'use_service') {
					memory.currentServiceVisit = null;
					memory.insideFacility = false;
				}
				deps.eventBus.emit({
					type: 'CommitmentChanged',
					tick: deps.tickCount(),
					wallClock: Date.now(),
					source: 'ContinueCommitment',
					payload: {
						agentId: actor.agentId,
						event: reason === 'timer_expired' ? 'expired' : 'broken',
						action: ca ?? '',
						reason,
						ticksRemaining: remaining,
					},
				});
			};
```

- [ ] **Step 2: Update all breakCommitment call sites with reason**

Replace each `breakCommitment()` call with the appropriate reason:

1. Critical needs break (lines 166): `breakCommitment('critical_need')`
2. Timer expired (line 173): `breakCommitment('timer_expired')`
3. Eat satisfied (line 180): `breakCommitment('need_satisfied')`
4. Drink satisfied (line 184): `breakCommitment('need_satisfied')`
5. Rest satisfied (line 188): `breakCommitment('need_satisfied')`
6. Buy satisfied (line 192): `breakCommitment('need_satisfied')`
7. Work hunger (line 200): `breakCommitment('need_satisfied')`
8. Work thirst (line 204): `breakCommitment('need_satisfied')`
9. Work energy (line 208): `breakCommitment('need_satisfied')`
10. Work equipment missing (line 214): `breakCommitment('need_satisfied')`
11. Work equipment repair (line 218): `breakCommitment('need_satisfied')`
12. Travel critical (line 227): `breakCommitment('critical_need')`

- [ ] **Step 3: Run typecheck + tests**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: clean. Existing tests should pass since they don't assert on CommitmentChanged events.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions.ts"
git commit -m "feat(meridian): emit CommitmentChanged from ContinueCommitment with break reasons"
```

---

## Chunk 3: NeedThresholdCrossed

### Task 4: NeedThresholdCrossed in needs-decay-system.ts

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/systems/needs-decay-system.ts`
- Test: `01 - Projects/Project Meridian/tests/infrastructure/systems/needs-decay-system.test.ts`

- [ ] **Step 1: Write failing test**

Add to the existing test file for `needs-decay-system.test.ts`:

```typescript
it('emits NeedThresholdCrossed when hunger crosses personal threshold downward', () => {
	// Create agent with hunger just above personal threshold (40)
	const agent = createAgent({ hunger: 40.05, energy: 80, social: 80, thirst: 80 });
	const deps = createDeps();
	const emitSpy = vi.spyOn(deps.eventBus, 'emit');
	const system = createNeedsDecaySystem(() => [agent]);

	system.execute(deps);

	const crossed = emitSpy.mock.calls.filter(c => c[0].type === 'NeedThresholdCrossed');
	expect(crossed.length).toBeGreaterThanOrEqual(1);
	const hungerCross = crossed.find(c => c[0].payload.need === 'hunger');
	expect(hungerCross).toBeDefined();
	expect(hungerCross![0].payload.direction).toBe('below');
	expect(hungerCross![0].payload.thresholdType).toBe('personal');
});
```

Note: Adapt the helper function names to match the existing test patterns in the file. Read the test file first to understand the mock setup.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/needs-decay-system.test.ts --config configs/vitest.config.ts`
Expected: FAIL — NeedThresholdCrossed not emitted.

- [ ] **Step 3: Implement NeedThresholdCrossed**

In `needs-decay-system.ts`, inside the `execute` method, BEFORE `needs.state = result.state` (line 93), snapshot old values. AFTER the assignment, check crossings:

```typescript
				// Snapshot old values for threshold crossing detection
				const oldHunger = needs.state.hunger;
				const oldEnergy = needs.state.energy;
				const oldThirst = needs.state.thirst;

				needs.state = result.state;
				needs.markDirty();

				// Check threshold crossings
				const personalThresholds = ba.personalThresholds;
				const crossings: [string, number, number, number, string][] = [];
				const checkCross = (need: string, oldVal: number, newVal: number, threshold: number, type: string): void => {
					if (oldVal >= threshold && newVal < threshold) crossings.push([need, newVal, threshold, type, 'below'] as unknown as [string, number, number, number, string]);
					if (oldVal < threshold && newVal >= threshold) crossings.push([need, newVal, threshold, type, 'above'] as unknown as [string, number, number, number, string]);
				};
				checkCross('hunger', oldHunger, result.state.hunger, personalThresholds.hunger, 'personal');
				checkCross('energy', oldEnergy, result.state.energy, personalThresholds.energy, 'personal');
				checkCross('thirst', oldThirst, result.state.thirst, personalThresholds.thirst, 'personal');
				checkCross('hunger', oldHunger, result.state.hunger, NEED_CRITICAL_THRESHOLDS.hunger, 'critical');
				checkCross('energy', oldEnergy, result.state.energy, NEED_CRITICAL_THRESHOLDS.energy, 'critical');
				checkCross('thirst', oldThirst, result.state.thirst, NEED_CRITICAL_THRESHOLDS.thirst, 'critical');

				for (const [need, value, threshold, thresholdType, direction] of crossings) {
					deps.eventBus.emit({
						type: 'NeedThresholdCrossed',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'NeedsDecaySystem',
						payload: { agentId: entity.agentId, need, value, threshold, thresholdType, direction },
					});
				}
```

Add the import at the top:
```typescript
import { NEED_CRITICAL_THRESHOLDS } from '../../domain/schemas/ranges.js';
```

- [ ] **Step 4: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/needs-decay-system.test.ts --config configs/vitest.config.ts`
Expected: PASS.

- [ ] **Step 5: Run typecheck + full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/needs-decay-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/systems/needs-decay-system.test.ts"
git commit -m "feat(meridian): emit NeedThresholdCrossed on personal/critical threshold crossings"
```

---

## Chunk 4: TradeAttempted + Cleanup

### Task 5: TradeAttempted in trade-system.ts

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/systems/trade-system.ts`

- [ ] **Step 1: Add TradeAttempted emissions**

In `trade-system.ts`, replace the trade processing block (lines 229-280) with TradeAttempted events. After the existing `if (btAction !== 'buy' && pendingBuy === null) continue;` gate:

When `target === undefined` (no facility found), emit and continue:
```typescript
				const target = findNearestFacilityWithItem(agent, locationList, locationActorMap, radius, targetItem);
				if (target === undefined) {
					deps.eventBus.emit({
						type: 'TradeAttempted',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'TradeSystem',
						payload: { agentId: agent.agentId, item: targetItem, result: 'no_facility' },
					});
					agent.behaviorAgent.buyTargetItem = null;
					continue;
				}
```

On successful trade (`result.success`), emit:
```typescript
					deps.eventBus.emit({
						type: 'TradeAttempted',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'TradeSystem',
						payload: { agentId: agent.agentId, item: targetItem, result: 'purchased', amount: foodPrice, facilityId: target.location.id },
					});
```

On failed trade, emit:
```typescript
					deps.eventBus.emit({
						type: 'TradeAttempted',
						tick: deps.tickCount,
						wallClock: Date.now(),
						source: 'TradeSystem',
						payload: { agentId: agent.agentId, item: targetItem, result: 'insufficient_gold', facilityId: target.location.id },
					});
```

- [ ] **Step 2: Run typecheck + tests**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/trade-system.ts"
git commit -m "feat(meridian): emit TradeAttempted events for all trade outcomes"
```

---

### Task 6: Remove temporary DebugNote instrumentation

**Files:**
- Modify: `01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-economy.ts`
- Modify: `01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-service.ts`

- [ ] **Step 1: Remove BuyItem DebugNote from bt-actions-economy.ts**

Revert `BuyItem` to its pre-diagnostic form. Replace the current version (with DebugNote emitters) with:

```typescript
		BuyItem(itemId: string): ActionResult {
			if (memory.atLocation === null) return FAILED;
			const atFacility = resolveNearbyFacilities().find(f =>
				f.id === memory.atLocation && f.stock.some(s => s.item_id === itemId && s.quantity > 0),
			);
			if (atFacility === undefined) return FAILED;
			beginAction(ctx, 'buy');
			memory.buyTargetItem = itemId;
			return SUCCEEDED;
		},
```

- [ ] **Step 2: Remove SeekService/UseService DebugNotes from bt-actions-service.ts**

Remove all `deps.eventBus.emit({ type: 'DebugNote', ...})` calls from:
- `SeekService` (4 DebugNote emitters: visit already active, facility type not resolved, insufficient gold, VISIT_STARTED)
- `UseService` (4 DebugNote emitters: serviceTarget null, currentServiceVisit set, facility type null, insufficient gold)

Keep the logic — just remove the emit calls.

- [ ] **Step 3: Run typecheck + full test suite + build**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts && npm run build`
Expected: all clean.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-economy.ts" "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions-service.ts"
git commit -m "chore(meridian): remove temporary DebugNote instrumentation, replaced by diagnostic events"
```
