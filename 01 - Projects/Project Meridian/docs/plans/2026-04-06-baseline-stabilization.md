# Baseline Stabilization Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 simulation-breaking and quality issues so Meridian sustains itself day-over-day with working economy, accurate mood, and correct agent behavior.

**Architecture:** All fixes are independent — no fix depends on another. Each task touches a small set of files. The pattern is TDD: write/update failing test, implement fix, verify green, commit.

**Tech Stack:** TypeScript, Vitest, mistreevous BT (MDSL), Zod schemas, ExcaliburJS ECS components.

**Spec:** `01 - Projects/Project Meridian/docs/specs/2026-04-06-baseline-stabilization-design.md`

**Test command:** `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`

**Single test:** `cd "01 - Projects/Project Meridian" && npx vitest run tests/path/file.test.ts --config configs/vitest.config.ts`

---

## Chunk 1: Facility Worker Reservation Model (Fix 1)

### Task 1: Add `claimFacility`/`releaseFacility` to BehaviorAgent interface

**Files:**
- Modify: `src/domain/systems/behavior-agent.ts:52-185`

- [ ] **Step 1: Add the two methods to the `BehaviorAgent` interface**

In `src/domain/systems/behavior-agent.ts`, add to the interface after line 184 (`recordPriceObservation`):

```typescript
claimFacility(facilityId: string): boolean;
releaseFacility(): void;
```

- [ ] **Step 2: Verify typecheck fails**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json 2>&1 | head -20`
Expected: errors in `behavior-agent-factory.ts` — the returned object doesn't implement the new methods yet.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/behavior-agent.ts"
git commit -m "feat(meridian): add claimFacility/releaseFacility to BehaviorAgent interface"
```

---

### Task 2: Implement `claimFacility`/`releaseFacility` in behavior-agent-factory

**Files:**
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts:34-213`

- [ ] **Step 1: Add the helper functions inside `createBehaviorAgent`**

After the `resolveNearbyLocations` function (after line 127), add:

```typescript
function claimFacility(facilityId: string): boolean {
	const locationActorMap = getLocationActors();
	const locActor = locationActorMap.get(facilityId);
	if (locActor === undefined || !locActor.has(FacilityComponent)) return false;
	const facility = locActor.get(FacilityComponent);
	if (facility.state.workerId !== null && facility.state.workerId !== actor.agentId) return false;
	facility.state = { ...facility.state, workerId: actor.agentId };
	facility.markDirty();
	return true;
}

function releaseFacility(): void {
	const locationActorMap = getLocationActors();
	for (const [, locActor] of locationActorMap) {
		if (!locActor.has(FacilityComponent)) continue;
		const facility = locActor.get(FacilityComponent);
		if (facility.state.workerId === actor.agentId) {
			facility.state = { ...facility.state, workerId: null };
			facility.markDirty();
			break;
		}
	}
}
```

- [ ] **Step 2: Wire the functions into the returned `agent` object**

In the `agent` object (around line 207, before `...conditions`), add:

```typescript
claimFacility,
releaseFacility,
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/behavior-agent-factory.ts"
git commit -m "feat(meridian): implement claimFacility/releaseFacility in behavior-agent-factory"
```

---

### Task 3: Update ClaimJob, ClaimBestJob, and ReleaseJob to use reservation

**Files:**
- Modify: `src/infrastructure/entity/bt-actions.ts:320-374`

- [ ] **Step 1: Update `ClaimJob()` (line 320)**

Replace the current `ClaimJob` body:

```typescript
ClaimJob(): ActionResult {
	const agentKind = actor.kind;
	const openFacilities = resolveNearbyFacilities().filter(f =>
		f.workerId === null && f.job !== '' && f.job === agentKind,
	);
	if (openFacilities.length === 0) return FAILED;
	const nearest = openFacilities.reduce((a, b) => a.distance < b.distance ? a : b);
	actor.job = nearest.job;
	if (!deps.actor.behaviorAgent.claimFacility(nearest.id)) {
		actor.job = null;
		return FAILED;
	}
	beginAction('claim_job');
	return SUCCEEDED;
},
```

- [ ] **Step 2: Update `ClaimBestJob()` (line 332)**

After `actor.job = chosen.job;` (line 361) and before `memory.unemployedTicks = 0;`, add the claim call. If it fails, revert:

```typescript
actor.job = chosen.job;
if (!deps.actor.behaviorAgent.claimFacility(chosen.id)) {
	actor.job = null;
	return FAILED;
}
memory.unemployedTicks = 0;
```

- [ ] **Step 3: Update `ReleaseJob()` (line 368)**

Add `releaseFacility()` call before clearing `actor.job`:

```typescript
ReleaseJob(): ActionResult {
	deps.actor.behaviorAgent.releaseFacility();
	actor.job = null;
	memory.unemployedTicks = 0;
	memory.btAction = null;
	deps.swapBehaviorTree?.(null);
	return SUCCEEDED;
},
```

- [ ] **Step 4: Update `SwitchJob()` (line 376)**

Replace the manual `workerId` clearing loop (lines 402-411) with the helper:

```typescript
// Release old facility worker slot
deps.actor.behaviorAgent.releaseFacility();
```

Then after setting `actor.job = bestFacility.job;`, add the claim:

```typescript
actor.job = bestFacility.job;
if (!deps.actor.behaviorAgent.claimFacility(bestFacility.id)) {
	actor.job = oldJob;
	return FAILED;
}
```

- [ ] **Step 5: Verify typecheck passes**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions.ts"
git commit -m "feat(meridian): ClaimJob/ClaimBestJob/ReleaseJob/SwitchJob use facility reservation"
```

---

### Task 4: Update Work() and SeekWork() to use reservation

**Files:**
- Modify: `src/infrastructure/entity/bt-actions.ts:449-499`

- [ ] **Step 1: Update `Work()` (line 450)**

Remove the `f.workerId === null` fallback:

```typescript
Work(): ActionResult {
	if (memory.atLocation === null || actor.job === null) return FAILED;
	const facilities = resolveNearbyFacilities();
	const jobFacility = facilities.find(f =>
		f.id === memory.atLocation &&
		f.job === actor.job &&
		f.workerId === actor.agentId,
	);
	if (jobFacility === undefined) return FAILED;
	beginAction('work');
	return RUNNING;
},
```

- [ ] **Step 2: Update `SeekWork()` (line 472)**

Remove the `f.workerId === null` fallback from the nearby facility search, and add a `workerId` guard to the `allLocations` fallback:

```typescript
SeekWork(): ActionResult {
	if (actor.job === null) return FAILED;

	// Target the facility this agent is reserved at
	const availableFacility = resolveNearbyFacilities().find(f =>
		f.job === actor.job && f.workerId === actor.agentId,
	);
	if (availableFacility !== undefined) {
		beginAction('seek_work');
		memory.movementTarget = { id: availableFacility.id, type: 'location' };
		if (memory.atLocation === availableFacility.id) return SUCCEEDED;
		return RUNNING;
	}

	// Fallback: search all locations for this agent's reserved facility
	const allLocations = getLocations();
	const locationActorMap = getLocationActors();
	const jobLoc = allLocations.find(l => {
		if (l.production === null || l.production.job !== actor.job) return false;
		const locActor = locationActorMap.get(l.id);
		if (locActor === undefined || !locActor.has(FacilityComponent)) return false;
		return locActor.get(FacilityComponent).state.workerId === actor.agentId;
	});
	if (jobLoc === undefined) return FAILED;

	if (memory.atLocation === jobLoc.id) return FAILED;

	beginAction('seek_work');
	memory.movementTarget = { id: jobLoc.id, type: 'location' };
	return RUNNING;
},
```

Note: `FacilityComponent` is already imported at line 9 of `bt-actions.ts`.

- [ ] **Step 3: Verify typecheck passes**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-actions.ts"
git commit -m "feat(meridian): Work/SeekWork use reservation — no workerId===null fallback"
```

---

### Task 5: Update conditions — AtJobFacility and OpenProductionFacilityNearby

**Files:**
- Modify: `src/infrastructure/entity/bt-conditions.ts:193-243`

- [ ] **Step 1: Simplify `AtJobFacility()` (line 193)**

```typescript
AtJobFacility(): boolean {
	if (memory.atLocation === null || actor.job === null) return false;
	const facilities = resolveNearbyFacilities();
	return facilities.some(f =>
		f.id === memory.atLocation &&
		f.job === actor.job &&
		f.status !== 'abandoned' &&
		f.workerId === actor.agentId,
	);
},
```

- [ ] **Step 2: Verify `OpenProductionFacilityNearby()` (line 242)**

Already checks `f.workerId === null` — no change needed. The field is now authoritative (written at claim time), so this condition correctly identifies truly open facilities.

- [ ] **Step 3: Verify typecheck passes**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/bt-conditions.ts"
git commit -m "feat(meridian): AtJobFacility checks reservation — removes workerId===null fallback"
```

---

### Task 6: Update findWorker() to use reservation

**Files:**
- Modify: `src/infrastructure/systems/facility-system.ts:48-63`

- [ ] **Step 1: Replace `findWorker()` with reservation-based lookup**

```typescript
function findWorker(
	agentList: AgentActor[],
	workerId: string | null,
	facilityJob: string,
	locX: number,
	locY: number,
	radius: number,
): AgentActor | undefined {
	if (workerId === null) return undefined;
	for (const agent of agentList) {
		if (agent.agentId !== workerId) continue;
		if (agent.behaviorAgent.btAction !== 'work') return undefined;
		if (agent.job !== facilityJob) return undefined;
		const dist = distance(agent.pos.x, agent.pos.y, locX, locY);
		if (dist > radius) return undefined;
		return agent;
	}
	return undefined;
}
```

- [ ] **Step 2: Update the call site in the system's `execute()` method**

Find where `findWorker` is called (inside `processFacilityTick` wrapper). Add `facility.state.workerId` as the first lookup argument:

Change from:
```typescript
findWorker(agentList, production.job, loc.position.x, loc.position.y, interactionRadius)
```
To:
```typescript
findWorker(agentList, facility.state.workerId, production.job, loc.position.x, loc.position.y, interactionRadius)
```

- [ ] **Step 3: Remove the `workerId` overwrite at the end of `processFacilityTick`**

Find the line where `facility.state = { ...facility.state, workerId: worker?.agentId ?? null }` is written after the tick result. **Remove it** — `workerId` is now managed by `claimFacility`/`releaseFacility`, not by the per-tick observation.

- [ ] **Step 4: Verify typecheck passes**

Run: `cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json`

- [ ] **Step 5: Run all tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all 1,236 tests pass. Fix any broken tests that relied on the old `findWorker` behavior.

- [ ] **Step 6: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/facility-system.ts"
git commit -m "feat(meridian): findWorker reads reservation — production requires presence + btAction"
```

---

## Chunk 2: Mood Formula Recalibration (Fix 2)

### Task 7: Recenter mood formula and add empty-weight exclusion

**Files:**
- Modify: `src/domain/systems/mood.ts:33-66`
- Test: `tests/domain/systems/mood.test.ts`

- [ ] **Step 1: Update tests for new formula**

In `tests/domain/systems/mood.test.ts`, replace test expectations:

```typescript
describe('calculateMood', () => {
	it('mid-range factors with no memories → neutral mood (around 0)', () => {
		const result = calculateMood(makeFactors({
			needsSatisfaction: 0.5,
			goalProgress: 0.5,
			walletHealth: 0.5,
			equipmentCondition: 0.5,
			relationshipQuality: 0.5,
		}), '', defaultConfig, 0);
		// With empty memories excluded, factor-average 0.5 maps to mood 0
		expect(result.value).toBe(0);
		expect(result.bucket).toBe('stressed');
	});

	it('full needs satisfaction with no other factors → negative mood', () => {
		const result = calculateMood(makeFactors({ needsSatisfaction: 1.0 }), '', defaultConfig, 0);
		// Only needs at 1.0, all others at 0 → weighted avg below 0.5
		expect(result.value).toBeGreaterThan(-50);
		expect(result.value).toBeLessThan(0);
	});

	it('all factors at maximum → elated', () => {
		const result = calculateMood(makeFactors({
			needsSatisfaction: 1.0,
			positiveMemories: 1.0,
			goalProgress: 1.0,
			walletHealth: 1.0,
			equipmentCondition: 1.0,
			relationshipQuality: 1.0,
		}), '', defaultConfig, 0);
		expect(result.value).toBe(100);
		expect(result.bucket).toBe('elated');
	});

	it('all factors at maximum without memories → elated', () => {
		const result = calculateMood(makeFactors({
			needsSatisfaction: 1.0,
			positiveMemories: 0,
			negativeMemories: 0,
			goalProgress: 1.0,
			walletHealth: 1.0,
			equipmentCondition: 1.0,
			relationshipQuality: 1.0,
		}), '', defaultConfig, 0);
		// Memory weights excluded → factor avg is 1.0 → mood = 100
		expect(result.value).toBe(100);
		expect(result.bucket).toBe('elated');
	});

	it('negative memories lower mood', () => {
		const result = calculateMood(makeFactors({
			needsSatisfaction: 1.0,
			negativeMemories: 1.0,
		}), '', defaultConfig, 0);
		expect(result.value).toBeLessThan(0);
		expect(result.bucket).toBe('breakdown');
	});

	it('positive memories increase mood', () => {
		const baseResult = calculateMood(makeFactors({ needsSatisfaction: 0.5 }), '', defaultConfig, 0);
		const withPositive = calculateMood(makeFactors({ needsSatisfaction: 0.5, positiveMemories: 0.5 }), '', defaultConfig, 0);
		expect(withPositive.value).toBeGreaterThan(baseResult.value);
	});

	it('bucket changed flag is true when bucket transitions', () => {
		const result = calculateMood(makeFactors({ needsSatisfaction: 1.0 }), 'content', defaultConfig, 0);
		expect(result.changed).toBe(true);
	});

	it('bucket changed flag is false when bucket stays the same', () => {
		// needsSatisfaction: 0.5 with empty memories excluded → roughly mid-range
		const result = calculateMood(makeFactors({ needsSatisfaction: 0.5, goalProgress: 0.5 }), 'stressed', defaultConfig, 0);
		expect(result.changed).toBe(false);
	});

	it('external modifiers apply and clamp to [-100, 100]', () => {
		const result = calculateMood(makeFactors({
			needsSatisfaction: 1.0,
			positiveMemories: 1.0,
			goalProgress: 1.0,
			walletHealth: 1.0,
			equipmentCondition: 1.0,
			relationshipQuality: 1.0,
		}), '', defaultConfig, 50);
		expect(result.value).toBe(100);
	});

	it('all factors zero → lowest possible mood', () => {
		const result = calculateMood(makeFactors({ needsSatisfaction: 0 }), '', defaultConfig, 0);
		expect(result.value).toBe(-100);
		expect(result.bucket).toBe('breakdown');
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/mood.test.ts --config configs/vitest.config.ts`
Expected: failures on the new expectations.

- [ ] **Step 3: Implement the formula changes in `mood.ts`**

Replace `calculateMood` function body (lines 38-66):

```typescript
export function calculateMood(
	factors: MoodFactors,
	previousBucket: string,
	config: MoodConfig,
	externalModifiers: number,
): MoodResult {
	const w = config.factor_weights;

	const positivePart =
		factors.needsSatisfaction * w.needs
		+ factors.positiveMemories * w.positive_memories
		+ factors.goalProgress * w.goal_progress
		+ factors.walletHealth * w.wallet
		+ factors.equipmentCondition * w.equipment
		+ factors.relationshipQuality * w.relationships;

	const negativePart = factors.negativeMemories * w.negative_memories;

	// Exclude memory weights when no memories exist (both positive and negative are 0)
	const hasMemories = factors.positiveMemories > 0 || factors.negativeMemories > 0;
	const totalWeight = hasMemories
		? w.needs + w.positive_memories + w.negative_memories + w.goal_progress + w.wallet + w.equipment + w.relationships
		: w.needs + w.goal_progress + w.wallet + w.equipment + w.relationships;

	// Recentered formula: factor-average 0.5 maps to mood 0
	const rawMood = ((positivePart - negativePart) / totalWeight - 0.5) * 200;
	const value = clamp(Math.round(rawMood + externalModifiers), -100, 100);

	let bucket = 'stressed';
	for (const b of config.buckets) {
		if (value >= b.min && value <= b.max) {
			bucket = b.name;
			break;
		}
	}

	return { value, bucket, changed: bucket !== previousBucket };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/mood.test.ts --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/systems/mood.ts" "01 - Projects/Project Meridian/tests/domain/systems/mood.test.ts"
git commit -m "fix(meridian): recenter mood formula — factor avg 0.5 = neutral, exclude empty memory weights"
```

---

### Task 8: Fix goalProgress default for unemployed agents

**Files:**
- Modify: `src/infrastructure/systems/mood-system.ts:48`

- [ ] **Step 1: Change `goalProgress` default from `0` to `0.5`**

Line 48 of `mood-system.ts`:

```typescript
// Before:
let goalProgress = 0;

// After:
let goalProgress = 0.5;
```

- [ ] **Step 2: Run mood-system tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run tests/infrastructure/systems/mood-system.test.ts --config configs/vitest.config.ts`

The `goalProgress` test at line 118 (`'returns 0 for unemployed agent'`) will need updating. Change the test description and assertion — unemployed agents should now have mood equal to or close to agents with average job fit, not strictly lower:

Update the test name from `'returns 0 for unemployed agent'` to `'defaults to 0.5 for unemployed agent (neutral)'` and adjust the assertion to allow equal or close values (the employed agent with HT:15 still gets a slight aptitude bonus).

- [ ] **Step 3: Run all mood tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run -t "mood" --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/mood-system.ts" "01 - Projects/Project Meridian/tests/infrastructure/systems/mood-system.test.ts"
git commit -m "fix(meridian): goalProgress defaults to 0.5 for unemployed agents — neutral not negative"
```

---

### Task 9: Fix bootstrap mood in AgentActor

**Files:**
- Modify: `src/infrastructure/entity/agent-actor.ts:44-59`

- [ ] **Step 1: Replace hardcoded 0s with actual values**

Replace the bootstrap mood calculation (lines 44-59):

```typescript
// Bootstrap mood from needs + wallet + equipment
const needsSatisfaction = (agent.needs.hunger + agent.needs.energy + agent.needs.social + agent.needs.thirst) / 400;
const walletHealth = Math.min(agent.wallet.gold / 100, 1);
const equipmentCondition = agent.inventory.some(i => i.charges !== undefined) ? 0.5 : 0.5;
const initialMood = calculateMood(
	{
		needsSatisfaction,
		positiveMemories: 0,
		negativeMemories: 0,
		goalProgress: 0.5,
		walletHealth,
		equipmentCondition,
		relationshipQuality: 0.5,
	},
	'',
	moodConfig,
	0,
);
```

- [ ] **Step 2: Run all tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass. Some mood-system tests may need their expected mood values adjusted since bootstrap mood is now higher.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/entity/agent-actor.ts"
git commit -m "fix(meridian): bootstrap mood uses actual wallet/equipment values — not hardcoded 0s"
```

---

## Chunk 3: BT, Rest, and Config Fixes (Fixes 3-6)

### Task 10: Add IsWorkHours guard to P4 hunger fallback (Fix 3)

**Files:**
- Modify: `behavior-trees/base.mdsl:118-121`

- [ ] **Step 1: Add `IsWorkHours` condition**

In `behavior-trees/base.mdsl`, find the P4 hunger fallback (lines 118-121):

```
            sequence {
                condition [HasJob]
                action [SeekWork]
            }
```

Change to:

```
            sequence {
                condition [HasJob]
                condition [IsWorkHours]
                action [SeekWork]
            }
```

- [ ] **Step 2: Run all tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass (BT files are loaded at runtime, not compiled — tests that load BTs from fixtures won't be affected).

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/behavior-trees/base.mdsl"
git commit -m "fix(meridian): add IsWorkHours guard to P4 hunger SeekWork fallback — no midnight work"
```

---

### Task 11: Remove seek_rest from rest whitelist (Fix 4)

**Files:**
- Modify: `src/infrastructure/systems/rest-system.ts:41`

- [ ] **Step 1: Remove `seek_rest` from the isResting check**

Line 41 of `rest-system.ts`:

```typescript
// Before:
const isResting = btAction === null || btAction === 'idle' || btAction === 'rest' || btAction === 'seek_rest';

// After:
const isResting = btAction === null || btAction === 'idle' || btAction === 'rest';
```

- [ ] **Step 2: Run all tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass. No existing rest-system test file exists, so no test expectations to update.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/rest-system.ts"
git commit -m "fix(meridian): remove seek_rest from rest whitelist — no premature energy recovery in transit"
```

---

### Task 12: Fix social_decay config (Fix 5)

**Files:**
- Modify: `src/domain/schemas/game-config-schema.ts:19`
- Modify: `configs/game-config.json:8`

- [ ] **Step 1: Update schema default**

In `src/domain/schemas/game-config-schema.ts`, line 19:

```typescript
// Before:
social_decay: z.number().default(0),

// After:
social_decay: z.number().default(0.05),
```

- [ ] **Step 2: Update game config**

In `configs/game-config.json`, line 8:

```json
// Before:
"social_decay": 0.02,

// After:
"social_decay": 0.05,
```

- [ ] **Step 3: Run all tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/game-config-schema.ts" "01 - Projects/Project Meridian/configs/game-config.json"
git commit -m "fix(meridian): social_decay default 0.05 — schema and config aligned for meaningful social pressure"
```

---

### Task 13: Fix mortality default (Fix 6)

**Files:**
- Modify: `src/domain/schemas/game-config-schema.ts:309`

- [ ] **Step 1: Change mortality default**

In `src/domain/schemas/game-config-schema.ts`, line 309:

```typescript
// Before:
mortality: z.boolean().default(true),

// After:
mortality: z.boolean().default(false),
```

- [ ] **Step 2: Run all tests**

Run: `cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts`
Expected: all pass.

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/game-config-schema.ts"
git commit -m "fix(meridian): mortality defaults to false — no mortality system exists"
```

---

### Task 14: Full verification pass

- [ ] **Step 1: Run full test suite**

Run: `cd "01 - Projects/Project Meridian" && npm test`
Expected: lint (0 errors) + typecheck (0 errors) + all tests pass.

- [ ] **Step 2: Build**

Run: `cd "01 - Projects/Project Meridian" && npm run build`
Expected: clean build.

- [ ] **Step 3: Verify with a quick manual review**

Check the diagnostic snapshot output after running the game — facilities should show workers, mood should be neutral-to-positive, agents should sleep at night.
