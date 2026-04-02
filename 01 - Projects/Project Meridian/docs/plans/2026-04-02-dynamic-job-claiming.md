# Dynamic Job Claiming — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow unemployed agents to claim open facility positions via BT behavior, making the economy self-organizing.

**Architecture:** Three new BehaviorAgent members (HasNoJob condition, OpenFacilityNearby condition, ClaimJob action), one PerceivedFacility field addition (workerId), one AgentActor mutability change (job), one BT node insertion, one agent data change (Marcus job → null).

**Tech Stack:** TypeScript (strict), mistreevous MDSL, Vitest

**Spec:** `docs/specs/2026-04-02-dynamic-job-claiming-design.md`

**Project root for all commands:** `cd "01 - Projects/Project Meridian"`

---

## Chunk 1: Interface + Implementation + BT

---

### Task 1: Add workerId to PerceivedFacility

**Files:**
- Modify: `src/domain/systems/behavior-agent.ts`
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts`

- [ ] **Step 1: Add workerId to PerceivedFacility interface**

In `src/domain/systems/behavior-agent.ts`, add `workerId` to the `PerceivedFacility` interface (after line 25, before the closing `}`):

```typescript
	workerId: string | null;
```

- [ ] **Step 2: Add workerId to resolveNearbyFacilities**

In `src/infrastructure/entity/behavior-agent-factory.ts`, in the `resolveNearbyFacilities()` function (around line 90), add `workerId` to the object pushed to `facilities`:

Change:
```typescript
			facilities.push({
				id: nearLoc.id,
				job: locData.production.job,
				stock: [...facility.state.stock],
				distance: nearLoc.distance,
				hasUnmetInput,
			});
```

To:
```typescript
			facilities.push({
				id: nearLoc.id,
				job: locData.production.job,
				stock: [...facility.state.stock],
				distance: nearLoc.distance,
				hasUnmetInput,
				workerId: facility.state.workerId,
			});
```

- [ ] **Step 3: Verify types compile**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: No type errors.

- [ ] **Step 4: Run tests**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/ tests/integration/
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/behavior-agent.ts" "01 - Projects/Project Meridian/src/infrastructure/entity/behavior-agent-factory.ts"
git commit -m "feat(meridian): add workerId to PerceivedFacility for job claiming visibility"
```

---

### Task 2: Make AgentActor.job mutable

**Files:**
- Modify: `src/infrastructure/entity/agent-actor.ts`

- [ ] **Step 1: Remove readonly from job property**

In `src/infrastructure/entity/agent-actor.ts` (line 25), change:

```typescript
	readonly job: string | null;
```

To:

```typescript
	job: string | null;
```

- [ ] **Step 2: Verify types compile**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: No type errors.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/agent-actor.ts"
git commit -m "feat(meridian): make AgentActor.job mutable for dynamic job claiming"
```

---

### Task 3: Add HasNoJob, OpenFacilityNearby, ClaimJob to BehaviorAgent

**Files:**
- Modify: `src/domain/systems/behavior-agent.ts`
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts`

- [ ] **Step 1: Add to BehaviorAgent interface**

In `src/domain/systems/behavior-agent.ts`:

Add after `KnowsFoodSource(): boolean;` (line 108):

```typescript
	HasNoJob(): boolean;
	OpenFacilityNearby(): boolean;
```

Update the condition count comment from `(21)` to `(23)`.

Add after `SeekBestFoodSource(): ActionResult;` (line 127):

```typescript
	ClaimJob(): ActionResult;
```

Update the action count comment from `(17)` to `(18)`.

- [ ] **Step 2: Implement HasNoJob in factory**

In `src/infrastructure/entity/behavior-agent-factory.ts`, add after the `KnowsFoodSource()` implementation:

```typescript
		HasNoJob(): boolean {
			return actor.job === null;
		},

		OpenFacilityNearby(): boolean {
			return agent.nearbyFacilities.some(f => f.workerId === null);
		},
```

Update the condition count comment from `(21)` to `(23)`.

- [ ] **Step 3: Implement ClaimJob in factory**

Add after `SeekBestFoodSource()` implementation, before `Idle()`:

```typescript
		ClaimJob(): ActionResult {
			const openFacilities = agent.nearbyFacilities.filter(f => f.workerId === null);
			if (openFacilities.length === 0) return FAILED;
			const nearest = openFacilities.reduce((a, b) => a.distance < b.distance ? a : b);
			actor.job = nearest.job;
			btAction = 'claim_job';
			return SUCCEEDED;
		},
```

Update the action count comment from `(17)` to `(18)`.

- [ ] **Step 4: Verify types compile**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json
```

Expected: No type errors.

- [ ] **Step 5: Run tests**

```bash
cd "01 - Projects/Project Meridian"
npx vitest run tests/domain/ tests/integration/
```

Expected: All tests pass.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/behavior-agent.ts" "01 - Projects/Project Meridian/src/infrastructure/entity/behavior-agent-factory.ts"
git commit -m "feat(meridian): add HasNoJob, OpenFacilityNearby conditions + ClaimJob action"
```

---

### Task 4: Update base.mdsl with P6 job claiming

**Files:**
- Modify: `behavior-trees/base.mdsl`

- [ ] **Step 1: Insert P6 before Wander**

In `behavior-trees/base.mdsl`, replace the fallback section:

```
        /* P6: Fallback */
        action [Wander]
```

With:

```
        /* P6: Claim a job if unemployed and facility available */
        sequence {
            condition [IsWorkHours]
            condition [HasNoJob]
            condition [OpenFacilityNearby]
            action [ClaimJob]
        }

        /* P7: Fallback */
        action [Wander]
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Project Meridian/behavior-trees/base.mdsl"
git commit -m "feat(meridian): add P6 job claiming to base BT — unemployed agents claim open facilities"
```

---

### Task 5: Set Marcus job to null

**Files:**
- Modify: `agents/marcus.json`

- [ ] **Step 1: Remove guard job**

In `agents/marcus.json`, change:

```json
	"job": "guard",
```

To:

```json
	"job": null,
```

- [ ] **Step 2: Commit**

```bash
git add "01 - Projects/Project Meridian/agents/marcus.json"
git commit -m "data(meridian): set Marcus job to null — allows dynamic job claiming at open facilities"
```

---

### Task 6: Final Verification + Docs

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

Expected: All tests pass.

- [ ] **Step 3: Update spec status**

In `docs/specs/2026-04-02-dynamic-job-claiming-design.md`, change status from `Approved` to `Implemented`.

- [ ] **Step 4: Update arc42 condition/action counts**

In `docs/2026-03-28-arc42-architecture.md`, update the BehaviorAgent line from `21 conditions, 17 actions` to `23 conditions, 18 actions`.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/docs/specs/2026-04-02-dynamic-job-claiming-design.md" "01 - Projects/Project Meridian/docs/2026-03-28-arc42-architecture.md"
git commit -m "docs(meridian): mark job claiming spec implemented, update condition/action counts"
```
