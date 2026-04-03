# Generalized Agents — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove hardcoded agent roles — all agents share one base BT, self-select jobs via aptitude scoring, and swap BT modules when changing jobs.

**Architecture:** Job-specific BT fragments (`jobs/*.mdsl`) are composed with the base BT at load time. Agents start with a jobless BT variant. When `ClaimBestJob` fires, the agent's `BehaviourTree` instance is reconstructed from the matched job's composed MDSL. Aptitude scoring uses the job's primary attribute; mismatched workers are slower via an efficiency modifier on `ticks_per_cycle`.

**Tech Stack:** TypeScript, Zod, mistreevous (MDSL behavior trees), ExcaliburJS (ECS), Vitest

**Spec:** `docs/specs/2026-04-03-generalized-agents-design.md`

**Test command:** `npx vitest run --config configs/vitest.config.ts`
**Type check:** `npx tsc --noEmit --project configs/tsconfig.json`
**Single test:** `npx vitest run tests/path/file.test.ts --config configs/vitest.config.ts`

---

## Chunk 1: Config & Schema Foundation (prerequisite for everything)

### Task 1: Add JobsConfigSchema to game config

**Files:**
- Modify: `src/domain/schemas/game-config-schema.ts`
- Modify: `configs/game-config.json`
- Modify: `tests/domain/schemas/economy-config.test.ts` (or create jobs config test)

- [ ] **Step 1: Write failing test**

```typescript
import { GameConfigSchema } from '../../../src/domain/schemas/game-config-schema.js';

it('JobsConfig includes aptitude and definitions', () => {
	const config = GameConfigSchema.parse({});
	expect(config.jobs.aptitude_baseline).toBe(12);
	expect(config.jobs.desperation_ticks).toBe(200);
	expect(config.jobs.definitions.settler.primary_attribute).toBe('HT');
	expect(config.jobs.definitions.guard.primary_attribute).toBe('ST');
	expect(config.jobs.definitions.craftsman.primary_attribute).toBe('DX');
});
```

- [ ] **Step 2: Run test — expect FAIL**

- [ ] **Step 3: Add JobsConfigSchema**

In `src/domain/schemas/game-config-schema.ts`, add before `GameConfigSchema`:

```typescript
const JobDefinitionSchema = z.object({
	primary_attribute: z.enum(['ST', 'DX', 'IQ', 'HT']),
});

const JobsConfigSchema = z.object({
	aptitude_baseline: z.number().default(12),
	desperation_ticks: z.number().default(200),
	definitions: z.record(z.string(), JobDefinitionSchema).default({
		settler: { primary_attribute: 'HT' },
		guard: { primary_attribute: 'ST' },
		craftsman: { primary_attribute: 'DX' },
	}),
});
```

Add to `GameConfigSchema`:
```typescript
jobs: withDefaults(JobsConfigSchema),
```

- [ ] **Step 4: Update game-config.json**

Add `"jobs"` section:
```json
"jobs": {
	"aptitude_baseline": 12,
	"desperation_ticks": 200,
	"definitions": {
		"settler":   { "primary_attribute": "HT" },
		"guard":     { "primary_attribute": "ST" },
		"craftsman": { "primary_attribute": "DX" }
	}
}
```

- [ ] **Step 5: Run tests, type check**
- [ ] **Step 6: Commit** `feat(meridian): add JobsConfigSchema with aptitude baseline and job definitions`

---

### Task 2: Make agent schema fields optional and strip agent JSON

**Files:**
- Modify: `src/domain/schemas/agent-schema.ts:24,59-60`
- Modify: `agents/settler.json`, `agents/guard.json`, `agents/craftsman.json`
- Modify: `tests/integration/data-validation.test.ts` (if it validates these fields)

- [ ] **Step 1: Make schema fields optional**

In `agent-schema.ts`, change:
```typescript
// Line 24: kind becomes optional with default
kind: z.string().default(''),
// Line 59: behavior_tree becomes optional with default
behavior_tree: z.string().default(''),
// Line 60: job already has .default(null), no change needed
```

- [ ] **Step 2: Strip agent JSON files**

Remove `kind`, `behavior_tree`, and `job` from all three agent files. Give them proper names:

**agents/settler.json** → rename to `agents/aldric.json`:
- Remove `"kind": "settler"`, `"behavior_tree": "settler"`, `"job": "settler"`
- Change `"id": "agent-settler"` → `"id": "agent-aldric"`
- Change `"name": "Settler"` → `"name": "Aldric"`

**agents/guard.json** → rename to `agents/bram.json`:
- Remove `"kind": "guard"`, `"behavior_tree": "guard"`, `"job": "guard"`
- Change `"id": "agent-guard"` → `"id": "agent-bram"`
- Change `"name": "Guard"` → `"name": "Bram"`

**agents/craftsman.json** → rename to `agents/celia.json`:
- Remove `"kind": "craftsman"`, `"behavior_tree": "craftsman"`, `"job": "craftsman"`
- Change `"id": "agent-craftsman"` → `"id": "agent-celia"`
- Change `"name": "Craftsman"` → `"name": "Celia"`

- [ ] **Step 3: Run data validation tests**
- [ ] **Step 4: Commit** `feat(meridian): make agent kind/behavior_tree optional, rename agents to proper names`

---

## Chunk 2: Job Module Files & Base BT

### Task 3: Create job module MDSL files

**Files:**
- Create: `jobs/settler.mdsl`
- Create: `jobs/guard.mdsl`
- Create: `jobs/craftsman.mdsl`

- [ ] **Step 1: Create jobs/settler.mdsl**

```
root [Job] {
    selector {
        /* Harvest food from farm if stock available */
        sequence {
            condition [AtJobFacility]
            condition [FacilityHasStock, "food"]
            action [Harvest]
        }
        /* Sell excess at market */
        sequence {
            condition [AtLocation, "market"]
            condition [HasFoodReserve]
            flip { condition [IsHungry] }
            action [SellAtMarket]
        }
        sequence {
            condition [HasFoodReserve]
            flip { condition [IsHungry] }
            action [SeekMarket]
        }
        /* Buy tools if needed */
        sequence {
            condition [AtLocation, "market"]
            condition [NeedsTools]
            condition [CanAffordItem, "tools"]
            condition [FacilityHasStock, "tools"]
            action [BuyItem, "tools"]
        }
        sequence {
            condition [NeedsTools]
            condition [CanAffordItem, "tools"]
            action [SeekMarket]
        }
        /* Work at facility */
        sequence {
            condition [AtJobFacility]
            action [Work] while(IsWorkHours)
        }
        /* Go to work */
        sequence {
            condition [HasJob]
            action [SeekWork]
        }
        action [Wander]
    }
}
```

- [ ] **Step 2: Create jobs/guard.mdsl**

```
root [Job] {
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

- [ ] **Step 3: Create jobs/craftsman.mdsl**

```
root [Job] {
    selector {
        /* Sell goods at market if carrying any and not hungry */
        sequence {
            condition [AtLocation, "market"]
            condition [HasTradeGoods]
            flip { condition [IsHungry] }
            action [SellAtMarket]
        }
        sequence {
            condition [HasTradeGoods]
            flip { condition [IsHungry] }
            action [SeekMarket]
        }
        /* Work at workshop */
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

- [ ] **Step 4: Validate all 3 job MDSL files** (compose with base and validate)
- [ ] **Step 5: Commit** `feat(meridian): create job module MDSL files (settler, guard, craftsman)`

---

### Task 4: Update base BT

**Files:**
- Modify: `behavior-trees/base.mdsl`

- [ ] **Step 1: Update base.mdsl**

Three changes:
1. `branch [Role]` → `branch [Job]`
2. `action [ClaimJob]` → `action [ClaimBestJob]`
3. `condition [OpenFacilityNearby]` → `condition [OpenProductionFacilityNearby]`

- [ ] **Step 2: Validate** — compose base.mdsl with each job module and validate
- [ ] **Step 3: Commit** `feat(meridian): update base BT — branch Job, ClaimBestJob, OpenProductionFacilityNearby`

---

### Task 5: Remove old branch files

**Files:**
- Delete: `behavior-trees/branch-settler.mdsl`
- Delete: `behavior-trees/branch-guard.mdsl`
- Delete: `behavior-trees/branch-craftsman.mdsl`

- [ ] **Step 1: Delete the three branch files**
- [ ] **Step 2: Commit** `refactor(meridian): remove branch-*.mdsl — replaced by jobs/*.mdsl`

---

## Chunk 3: BehaviorAgent Interface & Factory Changes

### Task 6: Extend BehaviorAgent interface

**Files:**
- Modify: `src/domain/systems/behavior-agent.ts`

- [ ] **Step 1: Add new fields and methods to BehaviorAgent interface**

In the working memory section (after `buyTargetItem: string | null;`, line 86):
```typescript
unemployedTicks: number;
```

In the condition methods section (replace `OpenFacilityNearby`, add after `CanAffordItem`):
```typescript
OpenProductionFacilityNearby(): boolean;
```

In the action methods section (replace `ClaimJob`, add `ReleaseJob`):
```typescript
ClaimBestJob(): ActionResult;
ReleaseJob(): ActionResult;
```

Keep the old `ClaimJob` and `OpenFacilityNearby` in the interface for now (backward compat with tests). They can be removed once all references are updated.

- [ ] **Step 2: Run type check** — expect failures in factory (not yet implemented)
- [ ] **Step 3: Commit** `feat(meridian): extend BehaviorAgent interface — unemployedTicks, ClaimBestJob, ReleaseJob`

---

### Task 7: Add BT swap callback to BehaviorAgentDeps

**Files:**
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts:27-35`

- [ ] **Step 1: Extend BehaviorAgentDeps**

Add to `BehaviorAgentDeps` interface:
```typescript
swapBehaviorTree: (jobName: string | null) => void;
jobsConfig: GameConfig['jobs'];
```

This callback will be provided by `game-view.ts` when creating agents. It looks up the composed MDSL for the job and reconstructs the `BehaviourTree`.

- [ ] **Step 2: Run type check** — expect failures in game-view.ts (caller doesn't pass new fields yet)
- [ ] **Step 3: Commit** `feat(meridian): add swapBehaviorTree callback and jobsConfig to BehaviorAgentDeps`

---

### Task 8: Implement ClaimBestJob, ReleaseJob, OpenProductionFacilityNearby in factory

**Files:**
- Modify: `src/infrastructure/entity/behavior-agent-factory.ts`
- Modify: `tests/infrastructure/entity/behavior-agent-factory.test.ts`

- [ ] **Step 1: Write tests for ClaimBestJob**

Test cases:
- Claims highest-aptitude facility when multiple open
- Falls back to nearest when desperation threshold exceeded
- Returns FAILED when no open production facilities
- Triggers BT swap callback with job name
- Resets unemployedTicks on claim

- [ ] **Step 2: Write tests for OpenProductionFacilityNearby**

Test cases:
- Returns true when production facility with empty workerId nearby
- Returns false when only non-production facilities (rest, water) nearby
- Returns false when all production facilities occupied

- [ ] **Step 3: Write tests for ReleaseJob**

Test cases:
- Sets job to null
- Triggers BT swap callback with null
- Resets unemployedTicks

- [ ] **Step 4: Implement in factory**

Add `let unemployedTicks = 0;` in the working memory section.

Add getter/setter for `unemployedTicks`.

Replace `ClaimJob()` with `ClaimBestJob()`:
```typescript
ClaimBestJob(): ActionResult {
    const { swapBehaviorTree, jobsConfig } = deps;
    const openFacilities = agent.nearbyFacilities.filter(f =>
        f.workerId === null && f.job !== '',
    );
    if (openFacilities.length === 0) return FAILED;

    let chosen: typeof openFacilities[0];
    if (unemployedTicks >= jobsConfig.desperation_ticks) {
        // Desperate — take nearest regardless of fit
        chosen = openFacilities.reduce((a, b) => a.distance < b.distance ? a : b);
    } else {
        // Score by primary attribute aptitude, tiebreak by distance
        chosen = openFacilities.reduce((best, f) => {
            const jobDef = jobsConfig.definitions[f.job];
            const fScore = jobDef !== undefined
                ? (actor.get(AttributesComponent).state as Record<string, number>)[jobDef.primary_attribute] ?? 0
                : 0;
            const bestDef = jobsConfig.definitions[best.job];
            const bestScore = bestDef !== undefined
                ? (actor.get(AttributesComponent).state as Record<string, number>)[bestDef.primary_attribute] ?? 0
                : 0;
            if (fScore > bestScore) return f;
            if (fScore === bestScore && f.distance < best.distance) return f;
            return best;
        });
    }

    actor.job = chosen.job;
    unemployedTicks = 0;
    btAction = 'claim_job';
    swapBehaviorTree(chosen.job);
    return SUCCEEDED;
},
```

Add `OpenProductionFacilityNearby()`:
```typescript
OpenProductionFacilityNearby(): boolean {
    return agent.nearbyFacilities.some(f => f.workerId === null && f.job !== '');
},
```

Add `ReleaseJob()`:
```typescript
ReleaseJob(): ActionResult {
    const { swapBehaviorTree } = deps;
    actor.job = null;
    unemployedTicks = 0;
    swapBehaviorTree(null);
    btAction = null;
    return SUCCEEDED;
},
```

Add `unemployedTicks` increment in a convenient place — or handle externally. The simplest: check in the BT tick system. Actually, increment it inside `HasNoJob` is wrong (conditions shouldn't have side effects). Better: add a system-level tick or increment in the factory's tick hook if one exists.

Simplest approach: increment inside `ClaimBestJob` when it returns FAILED:
```typescript
// At the top of ClaimBestJob, before the open facilities check:
// (This runs every tick the BT evaluates P1, which is every work-hours tick when jobless)
```

Actually, even simpler: track it in the factory and expose a `tickUnemployed()` utility that the BT system calls. But for now, just increment `unemployedTicks` at the start of `ClaimBestJob` and reset on success. This means the counter only advances when P1 fires (work hours + jobless + facility nearby), which is close enough.

Wait, the condition gate `OpenProductionFacilityNearby` means ClaimBestJob only fires when there IS an open facility. But desperation means "take any job even if bad fit" — the tick counter should advance even when no facilities are nearby. 

Better approach: increment `unemployedTicks` inside `HasNoJob()` — but conditions shouldn't mutate state.

Best approach: add it as a per-tick counter in the factory, advanced by the BT system. The `behavior-agent-factory.ts` already has the factory function called once. The `game-view.ts` BT tick loop could call `agent.behaviorAgent.tickUnemployment()` each tick.

Actually simplest: just use the `btAction` approach. Add a new method `tickUnemployment()` to the interface, called by the BT tick loop in `game-view.ts`. If `job === null`, increment; else reset to 0.

```typescript
tickUnemployment(): void {
    if (actor.job === null) {
        unemployedTicks++;
    } else {
        unemployedTicks = 0;
    }
},
```

- [ ] **Step 5: Update all createStubBehaviorAgent functions** in test files to include new methods
- [ ] **Step 6: Run tests, type check**
- [ ] **Step 7: Commit** `feat(meridian): implement ClaimBestJob aptitude scoring, ReleaseJob, OpenProductionFacilityNearby`

---

## Chunk 4: Agent Actor & World Loader Changes

### Task 9: Update AgentActor for generic agents

**Files:**
- Modify: `src/infrastructure/entity/agent-actor.ts:19-39`
- Modify: `src/infrastructure/entity/agent-spawner.ts` (if it references kind/behavior_tree)

- [ ] **Step 1: Update AgentActor**

```typescript
export class AgentActor extends Actor {
    readonly agentId: string;
    readonly agentName: string;
    readonly property: string[];
    job: string | null;
    readonly agentColor: string;
    behaviorAgent!: BehaviorAgent;
    behaviorTree!: BehaviourTree;

    /** Display-only: derived from current job or 'unemployed' */
    get kind(): string {
        return this.job ?? 'unemployed';
    }
```

Remove:
- `readonly kind: string;` field (replaced by getter)
- `readonly behaviorTreeDef: string;` field (no longer needed)
- `this.kind = agent.kind;` from constructor
- `this.behaviorTreeDef = agent.behavior_tree;` from constructor

- [ ] **Step 2: Run type check** — expect failures in game-view.ts and world-loader.ts
- [ ] **Step 3: Commit** `refactor(meridian): AgentActor removes kind/behaviorTreeDef, kind derived from job`

---

### Task 10: Update world loader for dynamic job module loading

**Files:**
- Modify: `src/infrastructure/engine/world-loader.ts`

- [ ] **Step 1: Update WorldData interface**

Replace `btMdslDefinitions: Record<string, string>` with:
```typescript
jobTrees: Record<string, string>;  // job name → composed MDSL
joblessMdsl: string;               // base BT with branch [Job] → action [Wander]
```

- [ ] **Step 2: Remove BT_KINDS constant** (line 51)

- [ ] **Step 3: Update the load function**

Replace the BT loading section with:

```typescript
onProgress?.(5, total, STEPS[4]);
const btPath = `${root}/behavior-trees`;
const jobsPath = `${root}/jobs`;
const mdslLoader = createMDSLLoader(logger);

// Load base BT
let baseMdsl: string;
try {
    baseMdsl = await vault.read(`${btPath}/base.mdsl`);
} catch {
    logger.error('WorldLoader', 'Failed to read base.mdsl');
    errors.push({ step: 'behavior-trees', file: `${btPath}/base.mdsl`, message: 'File not found' });
    baseMdsl = '';
}

// Compose job trees from config definitions
const jobTrees: Record<string, string> = {};
if (baseMdsl !== '') {
    for (const jobName of Object.keys(config.jobDefinitions ?? {})) {
        const result = await mdslLoader.loadComposed(
            vault,
            `${btPath}/base.mdsl`,
            `${jobsPath}/${jobName}.mdsl`,
        );
        collectErrors('jobs', result.errors, errors);
        if (result.mdsl !== null) {
            jobTrees[jobName] = result.mdsl;
        }
    }
}

// Build jobless MDSL variant — replace branch [Job] with action [Wander]
const joblessMdsl = baseMdsl.replace(
    /branch\s*\[Job\]/,
    'action [Wander]',
);
```

Note: `config.jobDefinitions` is the job definitions from game config. The world loader config needs to receive this. Add to `WorldLoaderConfig`:
```typescript
jobDefinitions: Record<string, { primary_attribute: string }>;
```

- [ ] **Step 4: Update WorldData return** to use `jobTrees` and `joblessMdsl` instead of `btMdslDefinitions`

- [ ] **Step 5: Update world-loader.test.ts** — add mock job files, update assertions

- [ ] **Step 6: Run tests, type check**
- [ ] **Step 7: Commit** `feat(meridian): world loader composes job trees dynamically from jobs/*.mdsl`

---

### Task 11: Update game-view.ts for jobless init + BT swap

**Files:**
- Modify: `src/infrastructure/engine/game-view.ts:200-227`

- [ ] **Step 1: Update agent initialization loop**

Replace the current loop that uses `agent.behaviorTreeDef` with:

```typescript
// Store job trees for BT swap callback
const jobTrees = world.jobTrees;
const joblessMdsl = world.joblessMdsl;

function createSwapCallback(agent: AgentActor, behaviorAgent: BehaviorAgent): (jobName: string | null) => void {
    return (jobName: string | null) => {
        const mdsl = jobName !== null ? jobTrees[jobName] : joblessMdsl;
        if (mdsl === undefined) {
            deps.logger.warn('Meridian', `No job tree for "${jobName}" — keeping current tree`);
            return;
        }
        const rng = createGameRNG(hashString(agent.agentId + (jobName ?? 'jobless')));
        agent.behaviorTree = new BehaviourTree(mdsl, behaviorAgent, {
            random: () => rng.next(),
            getDeltaTime: () => deps.config.tick_interval_ms / 1000,
        });
    };
}

// Create BehaviorAgent + jobless BehaviourTree for each agent
for (const agent of world.agents) {
    const swapCallback = createSwapCallback(agent, null as unknown as BehaviorAgent);
    const behaviorAgent = createBehaviorAgent({
        actor: agent,
        worldEntity: getWorldEntity,
        config: deps.config,
        getLocationActors,
        getLocations,
        tickCount: () => deps.tickCount,
        eventBus: deps.eventBus,
        swapBehaviorTree: swapCallback,
        jobsConfig: deps.config.jobs,
    });

    // Fix circular ref: swap callback needs behaviorAgent
    const boundSwap = createSwapCallback(agent, behaviorAgent);

    const rng = createGameRNG(hashString(agent.agentId + 'jobless'));
    const tree = new BehaviourTree(joblessMdsl, behaviorAgent, {
        random: () => rng.next(),
        getDeltaTime: () => deps.config.tick_interval_ms / 1000,
    });

    agent.behaviorAgent = behaviorAgent;
    agent.behaviorAgent.swapBehaviorTree = boundSwap; // wire the real callback
    agent.behaviorTree = tree;
}
```

Actually, the above has a circular dependency issue. Simpler approach: store `jobTrees`/`joblessMdsl` on a shared object and have `swapBehaviorTree` close over the agent:

```typescript
const jobTrees = world.jobTrees;
const joblessMdsl = world.joblessMdsl;

for (const agent of world.agents) {
    const swapBehaviorTree = (jobName: string | null): void => {
        const mdsl = jobName !== null ? jobTrees[jobName] : joblessMdsl;
        if (mdsl === undefined) {
            deps.logger.warn('Meridian', `No job tree for "${jobName}"`);
            return;
        }
        const rng = createGameRNG(hashString(agent.agentId + (jobName ?? 'jobless')));
        agent.behaviorTree = new BehaviourTree(mdsl, agent.behaviorAgent, {
            random: () => rng.next(),
            getDeltaTime: () => deps.config.tick_interval_ms / 1000,
        });
    };

    const behaviorAgent = createBehaviorAgent({
        actor: agent,
        worldEntity: getWorldEntity,
        config: deps.config,
        getLocationActors,
        getLocations,
        tickCount: () => deps.tickCount,
        eventBus: deps.eventBus,
        swapBehaviorTree,
        jobsConfig: deps.config.jobs,
    });

    const rng = createGameRNG(hashString(agent.agentId + 'jobless'));
    const tree = new BehaviourTree(joblessMdsl, behaviorAgent, {
        random: () => rng.next(),
        getDeltaTime: () => deps.config.tick_interval_ms / 1000,
    });

    agent.behaviorAgent = behaviorAgent;
    agent.behaviorTree = tree;
}
```

This works because `swapBehaviorTree` closure captures `agent` (the AgentActor), and `agent.behaviorAgent` is assigned before any swap can occur (swap only happens when `ClaimBestJob` fires during tick execution, which is after this init loop).

- [ ] **Step 2: Add unemployment tick call to BT tick loop**

In the BT tick loop (find where `agent.behaviorTree.step()` is called), add before it:
```typescript
agent.behaviorAgent.tickUnemployment();
```

- [ ] **Step 3: Pass jobDefinitions to world loader config**

Update the `createWorldLoader` call to include:
```typescript
jobDefinitions: deps.config.jobs.definitions,
```

- [ ] **Step 4: Run type check**
- [ ] **Step 5: Commit** `feat(meridian): game-view initializes agents with jobless BT, wires swap callback`

---

## Chunk 5: Facility Aptitude Modifier

### Task 12: Apply aptitude efficiency modifier in FacilitySystem

**Files:**
- Modify: `src/infrastructure/systems/facility-system.ts`
- Modify: `tests/infrastructure/systems/facility-system.test.ts`

- [ ] **Step 1: Write tests**

Test cases:
- Worker with high primary attribute produces faster (fewer effective ticks)
- Worker with low primary attribute produces slower (more effective ticks)
- Worker with baseline attribute produces at normal speed
- Unknown job (no definition in config) uses baseline speed

- [ ] **Step 2: Implement**

In `processFacilityTick`, before calling `applyFacilityTick`, calculate effective ticks:

```typescript
// Aptitude efficiency modifier
let effectiveTicksPerCycle = production.ticks_per_cycle;
if (worker !== undefined) {
    const jobDef = deps.config.jobs?.definitions[production.job];
    if (jobDef !== undefined) {
        const workerAttrs = worker.get(AttributesComponent).state;
        const attrValue = (workerAttrs as Record<string, number>)[jobDef.primary_attribute] ?? deps.config.jobs.aptitude_baseline;
        const efficiency = attrValue / deps.config.jobs.aptitude_baseline;
        effectiveTicksPerCycle = Math.round(production.ticks_per_cycle / efficiency);
    }
}
```

Then pass `effectiveTicksPerCycle` to `applyFacilityTick` instead of `production.ticks_per_cycle`:
```typescript
ticksPerCycle: effectiveTicksPerCycle,
```

Add `import { AttributesComponent } from '../components/attributes-component.js';`

- [ ] **Step 3: Run tests, type check**
- [ ] **Step 4: Commit** `feat(meridian): aptitude efficiency modifier — mismatched workers produce slower`

---

## Chunk 6: Cleanup & Polish

### Task 13: Update debug overlay and world validation

**Files:**
- Modify: `src/infrastructure/engine/debug-overlay.ts`
- Modify: `src/domain/systems/world-validation.ts`

- [ ] **Step 1: Update debug overlay**

Replace `agent.kind` with `agent.job ?? 'unemployed'` in the agents panel (the `kind` getter already does this, so this may just work — verify).

- [ ] **Step 2: Update world validation**

In `src/domain/systems/world-validation.ts`, the `WorldValidationAgent` interface has `behaviorTree: string`. Make it optional:
```typescript
behaviorTree?: string;
```

Update any validation logic that checks `behaviorTree` to handle it being undefined.

In `world-loader.ts`, update the validation call to not pass `behaviorTree` (or pass empty string).

- [ ] **Step 3: Run tests, type check**
- [ ] **Step 4: Commit** `fix(meridian): update debug overlay and world validation for generic agents`

---

### Task 14: Update vite build config

**Files:**
- Modify: `configs/vite.config.ts`

- [ ] **Step 1: Add jobs/ directory to build output**

Add after the game data copyDir calls:
```typescript
copyDir(resolve(projectRoot, 'jobs'), resolve(resDir, 'jobs'), '.mdsl');
```

- [ ] **Step 2: Remove old branch files from behavior-trees copy** (if they were copied)

The behavior-trees copy already only copies `.mdsl` — the branch files were deleted in Task 5, so this is just verification.

- [ ] **Step 3: Build and verify dist structure**
- [ ] **Step 4: Commit** `fix(meridian): include jobs/*.mdsl in build output`

---

### Task 15: Update test stubs across all test files

**Files:**
- All test files with `createStubBehaviorAgent`

- [ ] **Step 1: Add new methods to all stubs**

In every `createStubBehaviorAgent` function, add:
```typescript
unemployedTicks: 0,
OpenProductionFacilityNearby: () => false,
ClaimBestJob: () => 'mistreevous.failed' as const,
ReleaseJob: () => 'mistreevous.succeeded' as const,
tickUnemployment: () => {},
```

- [ ] **Step 2: Run full test suite**
- [ ] **Step 3: Commit** `fix(meridian): update all test stubs with new BehaviorAgent methods`

---

## Chunk 7: Integration Tests & Final Verification

### Task 16: Integration tests — generalized agents

**Files:**
- Create: `tests/integration/generalized-agents.test.ts`

- [ ] **Step 1: Write integration tests**

```typescript
describe('generalized agents', () => {
    it('ClaimBestJob selects highest-aptitude facility', () => { ... });
    it('ClaimBestJob uses distance as tiebreaker for equal scores', () => { ... });
    it('desperate agent claims any open facility after threshold', () => { ... });
    it('ReleaseJob sets job to null', () => { ... });
    it('OpenProductionFacilityNearby ignores non-production facilities', () => { ... });
    it('aptitude modifier makes high-DX agent craft faster', () => { ... });
    it('aptitude modifier makes low-HT agent farm slower', () => { ... });
});
```

- [ ] **Step 2: Run tests — expect PASS**
- [ ] **Step 3: Commit** `test(meridian): integration tests for generalized agent job system`

---

### Task 17: Final verification pass

- [ ] **Step 1: Full test suite** — `npx vitest run --config configs/vitest.config.ts` — 0 failures
- [ ] **Step 2: Type check** — `npx tsc --noEmit --project configs/tsconfig.json` — 0 errors
- [ ] **Step 3: Validate all MDSL files** — base + each job module — all VALID
- [ ] **Step 4: Build** — `npm run build` — verify dist has `jobs/` with all 3 MDSL files
- [ ] **Step 5: Verify agent JSON** — no `kind`, `behavior_tree`, or `job` fields in agent files
