# Economy Balance & Needs Triage Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix gold inflation, market starvation, and cascading needs failure so the economy sustains over 50+ day runs.

**Architecture:** 5 fixes in 2 chunks. Chunk 1: config changes (treasury regen, overload threshold) + P0 MDSL reorder. Chunk 2: new FacilityMaintenanceSystem (TDD). All independently testable.

**Tech Stack:** TypeScript, Vitest, mistreevous BT (MDSL), Zod schemas, JSON config.

**Spec:** `01 - Projects/Project Meridian/docs/specs/2026-04-09-economy-balance-design.md`

**Test command:** `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

**Single test:** `cd "01 - Projects/Project Meridian" && npx vitest run tests/path/file.test.ts --config configs/vitest.config.ts`

**Typecheck:** `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

---

## Chunk 1: Config Changes & P0 Reorder

### Task 1: Reduce treasury regen and lower overload threshold

**Files:**
- Modify: `configs/game-config.json`

- [ ] **Step 1: Change treasury_regen_per_agent_per_day**

In `configs/game-config.json`, find `"treasury_regen_per_agent_per_day": 25` in the `economy` section and change to:

```json
"treasury_regen_per_agent_per_day": 15
```

- [ ] **Step 2: Change overload_food_threshold**

In the same file, find `"overload_food_threshold": 10` in the `needs` section and change to:

```json
"overload_food_threshold": 5
```

- [ ] **Step 3: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/configs/game-config.json"
git commit -m "fix(meridian): reduce treasury regen 25→15g, overload threshold 10→5 — curb inflation"
```

---

### Task 2: Reorder P0 — rest first, then thirst, then hunger

**File:** `behavior-trees/base.mdsl`

- [ ] **Step 1: Replace the P0 block**

In `behavior-trees/base.mdsl`, find the P0 block that currently starts with:
```
        /* P0: Critical survival — any need at dangerous levels */
        sequence {
            condition [NeedsCritical]
            selector {
                /* Drink if thirsty and have water */
```

Replace the ENTIRE P0 block (from the `/* P0:` comment through the closing `}` of its sequence, just before `/* P0.5:`) with:

```
        /* P0: Critical survival — most dangerous need first */
        sequence {
            condition [NeedsCritical]
            selector {
                /* Rest if exhausted — energy depletion is most dangerous */
                sequence {
                    condition [IsExhausted]
                    action [SeekRest]
                    action [Rest] while(IsExhausted)
                }
                /* Drink if thirsty and have water */
                sequence {
                    condition [IsThirsty]
                    condition [HasWater]
                    action [Drink]
                }
                /* Go fill waterskin and drink if thirsty */
                sequence {
                    condition [IsThirsty]
                    action [SeekWater]
                    action [FillWaterskin]
                    action [Drink]
                }
                /* Eat if hungry and have food */
                sequence {
                    condition [IsHungry]
                    condition [HasFood]
                    action [Eat] while(IsHungry)
                }
                /* Buy food if hungry and available at current location */
                sequence {
                    condition [IsHungry]
                    condition [CanAffordFood]
                    condition [FacilityHasStock, "food"]
                    action [Buy]
                }
                /* Seek known food source */
                sequence {
                    condition [IsHungry]
                    condition [CanAffordFood]
                    condition [KnowsFoodSource]
                    action [SeekBestFoodSource]
                    action [Buy]
                }
                /* Fallback: seek any food source if desperate */
                sequence {
                    condition [IsHungry]
                    condition [CanAffordFood]
                    action [SeekFood]
                    action [Buy]
                }
            }
        }
```

Key changes from current:
1. **Rest moved to first position** (was last)
2. **Seek food split into two branches**: known source first (`KnowsFoodSource → SeekBestFoodSource`), then blind fallback (`SeekFood`). Previously these were combined in one branch with an inner selector.
3. Removed `while(IsHungry)` from `SeekBestFoodSource` and `SeekFood` — the while guard caused agents to loop seeking indefinitely.

- [ ] **Step 2: Run tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass. Integration tests validate BT parsing.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/behavior-trees/base.mdsl"
git commit -m "fix(meridian): reorder P0 — rest first, split seek-food with KnowsFoodSource guard"
```

---

## Chunk 2: Facility Maintenance System

### Task 3: Add facility_maintenance_per_day to config schema

**Files:**
- Modify: `src/domain/schemas/game-config-schema.ts`
- Modify: `configs/game-config.json`

- [ ] **Step 1: Add to EconomyConfigSchema**

In `src/domain/schemas/game-config-schema.ts`, find the economy config schema (the Zod object that contains `treasury_regen_per_agent_per_day`). Add:

```typescript
facility_maintenance_per_day: z.number().default(5),
```

- [ ] **Step 2: Add to game-config.json**

In `configs/game-config.json`, in the `"economy"` section, add:

```json
"facility_maintenance_per_day": 5
```

- [ ] **Step 3: Add FACILITY_MAINTENANCE to SystemPriority**

In `src/domain/core/tick-scheduler.ts`, find `EQUIPMENT_DECAY: 0.83` and add after it:

```typescript
FACILITY_MAINTENANCE: 0.835,
```

This places maintenance after equipment decay but before daily report, ensuring the day boundary flag is still set when maintenance runs.

- [ ] **Step 4: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/game-config-schema.ts"
git add "01 - Projects/Project Meridian/src/domain/core/tick-scheduler.ts"
git add "01 - Projects/Project Meridian/configs/game-config.json"
git commit -m "feat(meridian): add facility_maintenance_per_day config + SystemPriority slot"
```

---

### Task 4: Create FacilityMaintenanceSystem with TDD

**Files:**
- Create: `src/infrastructure/systems/facility-maintenance-system.ts`
- Create: `tests/infrastructure/systems/facility-maintenance-system.test.ts`

- [ ] **Step 1: Write failing tests**

Create `tests/infrastructure/systems/facility-maintenance-system.test.ts`. Follow the existing pattern from `equipment-decay-system.test.ts` or `subsidy-system.test.ts` for test setup (GameCoreDeps mocking, world entity with TimeComponent and FacilityComponent, etc.).

Write these tests:

```typescript
describe('FacilityMaintenanceSystem', () => {
    it('deducts maintenance cost from active facility on day boundary', () => {
        // Set dayBoundaryThisTick = true
        // Facility with fund=100, status='idle'
        // Execute system
        // Assert: fund = 95 (100 - 5)
    });

    it('skips abandoned facilities', () => {
        // Facility with status='abandoned', fund=50
        // Execute system
        // Assert: fund unchanged at 50
    });

    it('skips facilities at or below minimum fund threshold', () => {
        // Facility with fund=10 (minimum guard)
        // Execute system
        // Assert: fund unchanged at 10
    });

    it('does not drain below minimum fund threshold', () => {
        // Facility with fund=12 (above 10 but less than 10 + 5)
        // Execute system
        // Assert: fund = 10 (deducts only 2, not full 5)
    });

    it('does nothing when not day boundary', () => {
        // dayBoundaryThisTick = false
        // Execute system
        // Assert: no fund changes
    });

    it('emits GoldFlowed event with sink category', () => {
        // Set dayBoundaryThisTick = true, active facility
        // Execute system
        // Assert: eventBus received GoldFlowed with category='sink', subcategory='facility_maintenance'
    });
});
```

Adapt the test setup to match existing system test patterns — read `tests/infrastructure/systems/subsidy-system.test.ts` for reference on how facilities and location actors are mocked.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/facility-maintenance-system.test.ts --config configs/vitest.config.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement FacilityMaintenanceSystem**

Create `src/infrastructure/systems/facility-maintenance-system.ts`:

```typescript
import { SystemPriority, type GameSystem } from '../../domain/core/tick-scheduler.js';
import type { GameCoreDeps } from '../../domain/core/game-deps.js';
import type { Actor } from 'excalibur';
import { TimeComponent } from '../components/time-component.js';
import { FacilityComponent } from '../components/facility-component.js';

const MIN_FUND_FOR_MAINTENANCE = 10;

export function createFacilityMaintenanceSystem(
	worldEntity: () => Actor,
	getLocationActors: () => Map<string, Actor>,
): GameSystem {
	return {
		name: 'FacilityMaintenanceSystem',
		priority: SystemPriority.FACILITY_MAINTENANCE,

		execute(deps: GameCoreDeps): void {
			const time = worldEntity().get(TimeComponent);
			if (!time.state.dayBoundaryThisTick) return;

			const maintenanceCost = deps.config.economy.facility_maintenance_per_day;

			for (const [locId, locActor] of getLocationActors()) {
				if (!locActor.has(FacilityComponent)) continue;
				const facility = locActor.get(FacilityComponent);
				if (facility.state.status === 'abandoned') continue;
				if (facility.state.fund <= MIN_FUND_FOR_MAINTENANCE) continue;

				const deduction = Math.min(maintenanceCost, facility.state.fund - MIN_FUND_FOR_MAINTENANCE);
				facility.state = { ...facility.state, fund: facility.state.fund - deduction };
				facility.markDirty();

				deps.eventBus.emit({
					type: 'GoldFlowed',
					tick: deps.tickCount,
					wallClock: Date.now(),
					source: 'FacilityMaintenanceSystem',
					payload: {
						category: 'sink' as const,
						subcategory: 'facility_maintenance',
						amount: deduction,
						fromEntity: locId,
						toEntity: null,
					},
				});
			}
		},
	};
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/facility-maintenance-system.test.ts --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/facility-maintenance-system.ts"
git add "01 - Projects/Project Meridian/tests/infrastructure/systems/facility-maintenance-system.test.ts"
git commit -m "feat(meridian): add FacilityMaintenanceSystem — 5g/day sink per active facility"
```

---

### Task 5: Register FacilityMaintenanceSystem in game-view.ts

**Files:**
- Modify: `src/infrastructure/engine/game-view.ts`

- [ ] **Step 1: Import and register the system**

In `src/infrastructure/engine/game-view.ts`, add the import at the top (alongside other system imports):

```typescript
import { createFacilityMaintenanceSystem } from '../systems/facility-maintenance-system.js';
```

Find where systems are registered via `tickRunner.register(...)`. Look for `createEquipmentDecaySystem` or `createDailyReportSystem` — the maintenance system should be registered between them. Add:

```typescript
tickRunner.register(createFacilityMaintenanceSystem(
    () => worldEntity,
    () => locationActors,
));
```

Adapt the `worldEntity` and `locationActors` references to match the variable names used in the existing system registrations.

- [ ] **Step 2: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 3: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/game-view.ts"
git commit -m "feat(meridian): register FacilityMaintenanceSystem in tick pipeline"
```

---

### Task 6: Final verification

- [ ] **Step 1: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all tests pass.

- [ ] **Step 2: Run typecheck**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: clean.

- [ ] **Step 3: Run lint**

Run: `cd "01 - Projects/Project Meridian" && npx eslint src/ --config configs/eslint.config.mjs`
Expected: no new errors.

- [ ] **Step 4: Verify commit history**

Run: `git log --oneline -6`
Expected: 4 clean commits for the economy balance changes.
