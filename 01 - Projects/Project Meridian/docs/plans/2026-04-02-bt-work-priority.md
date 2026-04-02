# BT Work Priority Reorder — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder base.mdsl priorities so agents work before eating (unless critical), and broaden the work-hours gate to include dawn.

**Architecture:** Add `IsWorkHours()` condition (dawn + day), promote role behavior to P1 (above non-critical hunger/energy), update role branch `while()` guards to use `IsWorkHours` instead of `IsDaytime`.

**Tech Stack:** TypeScript (strict), mistreevous MDSL, Vitest

**Spec:** `docs/specs/2026-04-02-bt-work-priority-design.md`

**Project root for all commands:** `cd "01 - Projects/Project Meridian"`

---

## Chunk 1: IsWorkHours Condition + BT Reorder

---

### Task 1: Add IsWorkHours to BehaviorAgent Interface

**Files:**
- Modify: `src/domain/systems/behavior-agent.ts`

- [ ] **Step 1: Add IsWorkHours to condition list**

In `src/domain/systems/behavior-agent.ts`, add after `IsNighttime(): boolean;` (line 101):

```typescript
	IsWorkHours(): boolean;
```

Update the condition count comment from `(20)` to `(21)`.

- [ ] **Step 2: Verify types compile**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: Type error in behavior-agent-factory.ts (missing IsWorkHours implementation). This confirms the interface change is picked up.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/behavior-agent.ts"
git commit -m "feat(meridian): add IsWorkHours condition to BehaviorAgent interface"
```

---

### Task 2: Implement IsWorkHours in Factory

**Files:**
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts`

- [ ] **Step 1: Add implementation after IsNighttime**

In `src/infrastructure/entity/behavior-agent-factory.ts`, find `IsNighttime()` (around line 288) and add after it:

```typescript
		IsWorkHours(): boolean {
			return agent.timePhase === 'dawn' || agent.timePhase === 'day';
		},
```

Update the condition count comment from `(20)` to `(21)`.

- [ ] **Step 2: Verify types compile**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: No type errors.

- [ ] **Step 3: Run existing tests**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/ tests/integration/
```

Expected: All tests pass (no regressions).

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/behavior-agent-factory.ts"
git commit -m "feat(meridian): implement IsWorkHours — true for dawn + day phases"
```

---

### Task 3: Reorder base.mdsl Priorities

**Files:**
- Modify: `behavior-trees/base.mdsl`

- [ ] **Step 1: Replace entire base.mdsl**

Replace the contents of `behavior-trees/base.mdsl` with:

```
root {
    selector {

        /* P0: Critical survival — any need at dangerous levels */
        sequence {
            condition [NeedsCritical]
            selector {
                sequence {
                    condition [IsHungry]
                    condition [HasFood]
                    action [Eat] while(IsHungry)
                }
                /* Already at a food facility with stock — buy immediately */
                sequence {
                    condition [IsHungry]
                    condition [CanAffordFood]
                    condition [FacilityHasStock, "bread"]
                    action [Buy]
                }
                /* Not at facility — navigate to cheapest known or nearest, then buy */
                sequence {
                    condition [IsHungry]
                    condition [CanAffordFood]
                    selector {
                        sequence {
                            condition [KnowsFoodSource]
                            action [SeekBestFoodSource] while(IsHungry)
                        }
                        action [SeekFood] while(IsHungry)
                    }
                    action [Buy]
                }
                sequence {
                    condition [IsExhausted]
                    action [SeekRest] while(IsExhausted)
                }
            }
        }

        /* P1: Role-specific behavior (work hours: dawn + day) */
        sequence {
            condition [IsWorkHours]
            branch [Role]
        }

        /* P2: Hunger — not critical but below comfort threshold */
        sequence {
            condition [IsHungry]
            selector {
                /* Eat from inventory if possible */
                sequence {
                    condition [HasFood]
                    action [Eat] while(IsHungry)
                }
                /* Buy food if at a facility with stock */
                sequence {
                    condition [CanAffordFood]
                    condition [FacilityHasStock, "bread"]
                    action [Buy]
                }
                /* Navigate to cheapest known food source, or nearest, then buy */
                sequence {
                    condition [CanAffordFood]
                    selector {
                        sequence {
                            condition [KnowsFoodSource]
                            action [SeekBestFoodSource]
                        }
                        action [SeekFood]
                    }
                    action [Buy]
                }
                /* No food, no money — go work */
                sequence {
                    condition [HasJob]
                    action [SeekWork]
                }
            }
        }

        /* P3: Energy — rest when tired */
        sequence {
            condition [IsExhausted]
            action [SeekRest] while(IsExhausted)
        }

        /* P4: Social needs */
        sequence {
            condition [IsLonely]
            condition [NearAgentClose]
            action [Talk] while(IsLonely)
        }
        sequence {
            condition [IsLonely]
            action [SeekSocial] while(IsLonely)
        }

        /* P5: Night behavior */
        sequence {
            condition [IsNighttime]
            action [SeekRest]
        }

        /* P6: Fallback */
        action [Wander]
    }
}
```

Key changes from the original:
- P1 (role) promoted above P2 (hunger) and P3 (energy)
- Role gate changed from `IsDaytime` to `IsWorkHours`
- Old P1/P2 renumbered to P2/P3

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Project Meridian/behavior-trees/base.mdsl"
git commit -m "feat(meridian): reorder BT — role behavior (P1) before non-critical hunger (P2)"
```

---

### Task 4: Update Role Branch while() Guards

**Files:**
- Modify: `behavior-trees/branch-artisan.mdsl`
- Modify: `behavior-trees/branch-scholar.mdsl`
- Modify: `behavior-trees/branch-guard.mdsl`

- [ ] **Step 1: Update branch-artisan.mdsl**

Replace `while(IsDaytime)` with `while(IsWorkHours)`:

```
root [Role] {
    selector {
        sequence {
            condition [AtJobFacility]
            action [Work] while(IsWorkHours)
        }
        sequence {
            condition [HasJob]
            action [SeekWork]
        }
        action [Wander]
    }
}
```

- [ ] **Step 2: Update branch-scholar.mdsl**

Same change — replace `while(IsDaytime)` with `while(IsWorkHours)`:

```
root [Role] {
    selector {
        sequence {
            condition [AtJobFacility]
            action [Work] while(IsWorkHours)
        }
        sequence {
            condition [HasJob]
            action [SeekWork]
        }
        action [Wander]
    }
}
```

- [ ] **Step 3: Update branch-guard.mdsl**

Replace `while(IsDaytime)` with `while(IsWorkHours)`:

```
root [Role] {
    selector {
        /* Patrol: head to town square, then wander nearby */
        sequence {
            condition [AtLocation, "social"]
            action [Wander] while(IsWorkHours)
        }
        sequence {
            action [SeekSocial]
        }
    }
}
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/behavior-trees/branch-artisan.mdsl" "01 - Projects/Project Meridian/behavior-trees/branch-scholar.mdsl" "01 - Projects/Project Meridian/behavior-trees/branch-guard.mdsl"
git commit -m "feat(meridian): update role branches — while(IsDaytime) → while(IsWorkHours)"
```

---

### Task 5: Final Verification

- [ ] **Step 1: Type check**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: No type errors.

- [ ] **Step 2: Run full test suite**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/ tests/integration/
```

Expected: All tests pass. Same baseline as before (8 ExcaliburJS window failures are pre-existing).

- [ ] **Step 3: Update spec status**

In `docs/specs/2026-04-02-bt-work-priority-design.md`, change status from `Approved` to `Implemented`.

- [ ] **Step 4: Update arc42 doc condition count**

In `docs/2026-03-28-arc42-architecture.md`, update the BehaviorAgent line from `20 conditions` to `21 conditions`.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/docs/specs/2026-04-02-bt-work-priority-design.md" "01 - Projects/Project Meridian/docs/2026-03-28-arc42-architecture.md"
git commit -m "docs(meridian): mark BT work priority spec implemented, update condition count"
```
