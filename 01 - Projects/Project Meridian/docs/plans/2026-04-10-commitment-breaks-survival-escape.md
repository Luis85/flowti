# Commitment Breaks & Survival Escape Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make long commitments (work, leisure) breakable by non-critical needs, and let critically starving agents override recovery to travel for food.

**Architecture:** Two changes to existing files. Change 1 adds proactive break conditions to `ContinueCommitment` for work/leisure commitments. Change 2 adds a critical hunger/thirst override to `IsRecovering`. Both are TDD — tests first, then implementation.

**Tech Stack:** TypeScript, Vitest, mistreevous BT (MDSL), Zod schemas.

**Spec:** `01 - Projects/Project Meridian/docs/specs/2026-04-10-commitment-breaks-survival-escape-design.md`

**Test command:** `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

**Single test:** `cd "01 - Projects/Project Meridian" && npx vitest run tests/path/file.test.ts --config configs/vitest.config.ts`

**Typecheck:** `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: ContinueCommitment Break Conditions

### Task 1: Add imports for InventoryComponent

**Files:**
- Modify: `src/infrastructure/entity/bt-actions.ts:7` — add import

- [ ] **Step 1: Add InventoryComponent import**

In `src/infrastructure/entity/bt-actions.ts`, after the existing `NeedsComponent` import on line 7, add:

```typescript
import { InventoryComponent } from '../components/inventory-component.js';
```

- [ ] **Step 2: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean (unused import is fine in this codebase).

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions.ts"
git commit -m "chore(meridian): add InventoryComponent import to bt-actions"
```

---

### Task 2: Write tests for work/leisure commitment breaks

**Files:**
- Test: `tests/infrastructure/entity/bt-actions.test.ts`

These tests go inside the existing `describe('bt-actions: createActions', ...)` block. Find a suitable location — after the last describe block (Leisure actions) or inside a new `describe('ContinueCommitment', ...)` block.

- [ ] **Step 1: Add ContinueCommitment describe block with work hunger break test**

Add after the last `describe` block inside `describe('bt-actions: createActions', ...)`:

```typescript
describe('ContinueCommitment', () => {
	it('breaks work commitment when hunger < personal threshold', () => {
		const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
		const { actions, memory } = setupActions(actor, { config });
		memory.committedAction = 'work';
		memory.commitmentTicks = 20;
		actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 35 };
		memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
		// Give equipment so equipment check doesn't trigger
		actor.get(InventoryComponent).state = { items: [{ item_id: 'equipment', quantity: 1, charges: 15 }] };
		expect(actions.ContinueCommitment()).toBe('mistreevous.failed');
		expect(memory.committedAction).toBeNull();
	});

	it('breaks work commitment when thirst < personal threshold', () => {
		const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
		const { actions, memory } = setupActions(actor, { config });
		memory.committedAction = 'work';
		memory.commitmentTicks = 20;
		actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, thirst: 35 };
		memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
		actor.get(InventoryComponent).state = { items: [{ item_id: 'equipment', quantity: 1, charges: 15 }] };
		expect(actions.ContinueCommitment()).toBe('mistreevous.failed');
		expect(memory.committedAction).toBeNull();
	});

	it('breaks work commitment when equipment missing', () => {
		const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
		const { actions, memory } = setupActions(actor, { config });
		memory.committedAction = 'work';
		memory.commitmentTicks = 20;
		actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 80, thirst: 80 };
		memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
		actor.get(InventoryComponent).state = { items: [] };
		expect(actions.ContinueCommitment()).toBe('mistreevous.failed');
	});

	it('breaks work commitment when equipment charges < repair threshold', () => {
		const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
		const { actions, memory } = setupActions(actor, { config });
		memory.committedAction = 'work';
		memory.commitmentTicks = 20;
		actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 80, thirst: 80 };
		memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
		// charges 5 < repair threshold 10
		actor.get(InventoryComponent).state = { items: [{ item_id: 'equipment', quantity: 1, charges: 5 }] };
		expect(actions.ContinueCommitment()).toBe('mistreevous.failed');
	});

	it('does NOT break work commitment when equipment charges at repair threshold', () => {
		const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
		const { actions, memory } = setupActions(actor, { config });
		memory.committedAction = 'work';
		memory.commitmentTicks = 20;
		actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 80, thirst: 80 };
		memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
		// charges 10 === repair threshold 10 → should NOT break
		actor.get(InventoryComponent).state = { items: [{ item_id: 'equipment', quantity: 1, charges: 10 }] };
		expect(actions.ContinueCommitment()).toBe('mistreevous.running');
	});

	it('does NOT break work commitment when all needs healthy and equipment OK', () => {
		const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
		const { actions, memory } = setupActions(actor, { config });
		memory.committedAction = 'work';
		memory.commitmentTicks = 20;
		actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 80, thirst: 80 };
		memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
		actor.get(InventoryComponent).state = { items: [{ item_id: 'equipment', quantity: 1, charges: 15 }] };
		expect(actions.ContinueCommitment()).toBe('mistreevous.running');
		expect(memory.commitmentTicks).toBe(19);
	});

	it('breaks leisure commitment when hunger < personal threshold', () => {
		const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
		const { actions, memory } = setupActions(actor, { config });
		memory.committedAction = 'leisure';
		memory.commitmentTicks = 20;
		actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 35 };
		memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
		actor.get(InventoryComponent).state = { items: [{ item_id: 'equipment', quantity: 1, charges: 15 }] };
		expect(actions.ContinueCommitment()).toBe('mistreevous.failed');
	});

	it('breaks leisure commitment when thirst < personal threshold', () => {
		const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
		const { actions, memory } = setupActions(actor, { config });
		memory.committedAction = 'leisure';
		memory.commitmentTicks = 20;
		actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, thirst: 35 };
		memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
		actor.get(InventoryComponent).state = { items: [{ item_id: 'equipment', quantity: 1, charges: 15 }] };
		expect(actions.ContinueCommitment()).toBe('mistreevous.failed');
	});

	it('does NOT break sell commitment at personal hunger threshold', () => {
		const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
		const { actions, memory } = setupActions(actor, { config });
		memory.committedAction = 'sell';
		memory.commitmentTicks = 5;
		actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 35 };
		memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
		expect(actions.ContinueCommitment()).toBe('mistreevous.running');
	});

	it('does NOT break rest commitment at personal hunger threshold', () => {
		const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
		const { actions, memory } = setupActions(actor, { config });
		memory.committedAction = 'rest';
		memory.commitmentTicks = 15;
		actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 35, energy: 50 };
		memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
		expect(actions.ContinueCommitment()).toBe('mistreevous.running');
	});

	it('existing: eat commitment breaks when hunger satisfied', () => {
		const actor = new AgentActor(createTestAgentData('a1'), defaultMoodConfig);
		const { actions, memory } = setupActions(actor, { config });
		memory.committedAction = 'eat';
		memory.commitmentTicks = 5;
		actor.get(NeedsComponent).state = { ...actor.get(NeedsComponent).state, hunger: 80 };
		memory.personalThresholds = { hunger: 40, energy: 30, thirst: 40 };
		expect(actions.ContinueCommitment()).toBe('mistreevous.failed');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/bt-actions.test.ts --config configs/vitest.config.ts`

Expected: 6 tests fail (work hunger, work thirst, work equipment missing, work equipment low charges, leisure hunger, leisure thirst). The "does NOT break" tests and the existing eat test should pass.

- [ ] **Step 3: Commit failing tests**

```bash
git add "01 - Projects/Project Meridian/tests/infrastructure/entity/bt-actions.test.ts"
git commit -m "test(meridian): add ContinueCommitment break condition tests (red)"
```

---

### Task 3: Implement work/leisure break conditions

**Files:**
- Modify: `src/infrastructure/entity/bt-actions.ts:86-117` — add break conditions to ContinueCommitment

- [ ] **Step 1: Add InventoryComponent import**

In `src/infrastructure/entity/bt-actions.ts`, after the `NeedsComponent` import on line 7, add:

```typescript
import { InventoryComponent } from '../components/inventory-component.js';
```

- [ ] **Step 2: Add work/leisure break conditions**

In the `ContinueCommitment()` method, after the existing `buy` break condition (line 113) and before the `// Restore btAction` comment (line 115), insert:

```typescript
			// Break work/leisure commitments when maintenance needs arise
			if (ca === 'work' || ca === 'leisure') {
				if (needs.hunger < memory.personalThresholds.hunger) {
					memory.commitmentTicks = 0;
					memory.committedAction = null;
					return FAILED;
				}
				if (needs.thirst < memory.personalThresholds.thirst) {
					memory.commitmentTicks = 0;
					memory.committedAction = null;
					return FAILED;
				}
				const inv = actor.get(InventoryComponent).state.items;
				const equip = inv.find(i => i.item_id === 'equipment');
				if (equip === undefined || equip.quantity === 0 || (equip.charges ?? 0) === 0) {
					memory.commitmentTicks = 0;
					memory.committedAction = null;
					return FAILED;
				}
				if ((equip.charges ?? 0) > 0 && (equip.charges ?? 0) < config.economy.equipment_repair_threshold) {
					memory.commitmentTicks = 0;
					memory.committedAction = null;
					return FAILED;
				}
			}
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/bt-actions.test.ts --config configs/vitest.config.ts`
Expected: all ContinueCommitment tests pass.

- [ ] **Step 4: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions.ts"
git commit -m "feat(meridian): break work/leisure commitments when maintenance needs arise"
```

---

## Chunk 2: IsRecovering Critical Override

### Task 4: Write tests for IsRecovering critical override

**Files:**
- Test: `tests/infrastructure/entity/bt-conditions.test.ts`

Find the existing `describe('IsRecovering', ...)` block and add tests inside it.

- [ ] **Step 1: Add critical override tests to IsRecovering**

Find the `describe('IsRecovering', ...)` block in `tests/infrastructure/entity/bt-conditions.test.ts` and add these tests at the end of the block:

```typescript
	it('returns false when recovering but hunger is critical', () => {
		const actor = new AgentActor(
			createTestAgentData('a1', { needs: { hunger: 10, energy: 40, social: 70, thirst: 80 } }),
			defaultMoodConfig,
		);
		const deps = setupDeps(actor, { config });
		const { conditions, memory } = makeConditions(actor, deps);
		memory.recovering = true;
		expect(conditions.IsRecovering()).toBe(false);
		// recovering flag stays set — not cleared
		expect(memory.recovering).toBe(true);
	});

	it('returns false when recovering but thirst is critical', () => {
		const actor = new AgentActor(
			createTestAgentData('a1', { needs: { hunger: 80, energy: 40, social: 70, thirst: 10 } }),
			defaultMoodConfig,
		);
		const deps = setupDeps(actor, { config });
		const { conditions, memory } = makeConditions(actor, deps);
		memory.recovering = true;
		expect(conditions.IsRecovering()).toBe(false);
		expect(memory.recovering).toBe(true);
	});

	it('returns true when recovering and needs are above critical', () => {
		const actor = new AgentActor(
			createTestAgentData('a1', { needs: { hunger: 50, energy: 40, social: 70, thirst: 50 } }),
			defaultMoodConfig,
		);
		const deps = setupDeps(actor, { config });
		const { conditions, memory } = makeConditions(actor, deps);
		memory.recovering = true;
		expect(conditions.IsRecovering()).toBe(true);
	});
```

- [ ] **Step 2: Run tests to verify the first two fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/bt-conditions.test.ts --config configs/vitest.config.ts`

Expected: the two "returns false when recovering but hunger/thirst is critical" tests FAIL. The "returns true when recovering and needs are above critical" test passes.

- [ ] **Step 3: Commit failing tests**

```bash
git add "01 - Projects/Project Meridian/tests/infrastructure/entity/bt-conditions.test.ts"
git commit -m "test(meridian): add IsRecovering critical hunger/thirst override tests (red)"
```

---

### Task 5: Implement IsRecovering critical override

**Files:**
- Modify: `src/infrastructure/entity/bt-conditions-survival.ts:24-32` — add critical override

- [ ] **Step 1: Add critical override to IsRecovering**

In `src/infrastructure/entity/bt-conditions-survival.ts`, replace the `IsRecovering()` method (lines 24-32) with:

```typescript
		IsRecovering(): boolean {
			if (!memory.recovering) return false;
			// Survival trumps recovery — let agent travel to find food/water
			const needs = actor.get(NeedsComponent).state;
			if (needs.hunger < NEED_CRITICAL_THRESHOLDS.hunger) return false;
			if (needs.thirst < NEED_CRITICAL_THRESHOLDS.thirst) return false;
			const recoveredThreshold = Math.min(memory.personalThresholds.energy + config.needs.recovery_hysteresis, 100);
			if (needs.energy >= recoveredThreshold) {
				memory.recovering = false;
				return false;
			}
			return true;
		},
```

Note: `NEED_CRITICAL_THRESHOLDS` is already imported on line 5.

- [ ] **Step 2: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/entity/bt-conditions.test.ts --config configs/vitest.config.ts`
Expected: all IsRecovering tests pass.

- [ ] **Step 3: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 4: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-conditions-survival.ts"
git commit -m "feat(meridian): IsRecovering returns false when hunger or thirst are critical"
```
