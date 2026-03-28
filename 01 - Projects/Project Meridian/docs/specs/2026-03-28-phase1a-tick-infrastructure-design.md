# Phase 1A: Tick Infrastructure + ECS Components — Design Spec

> **Phase:** 1A of 1 (1A = tick infrastructure, 1B = game systems + BT)
> **Depends on:** Phase 0 Foundation (complete)
> **Produces:** Tick loop, ECS component foundations, GameDeps wiring, EventBus batching
> **GDD Reference:** `Project Meridian.md` — §2.1 (tick cycle), §4 (agent system), §14.1 (event batching), §16 (error handling)
> **Arc42 Reference:** `docs/2026-03-28-arc42-architecture.md` — §6.1 (tick execution), §8.15-8.17

---

## 1. Goal

Deliver the tick loop, ECS component foundations, GameCoreDeps wiring, and EventBus batching — everything Phase 1B game systems need to run on. No game logic in this phase.

## 2. Exit Criteria

1. Tick runner executes registered systems at 2Hz inside ExcaliburJS's update loop
2. Systems execute in declared priority order with error boundaries (failed system is skipped, tick continues)
3. EventBus batches events between system executions (transparent to systems)
4. `TrackedComponent` base class tracks dirty state per component
5. Agent entity can be constructed with NeedsComponent, MoodComponent, MemoryComponent (data initialized from defaults)
6. `GameCoreDeps` wired in `plugin.ts` → passed to game view → available to tick runner
7. PerformanceTracker records per-system timing through the tick runner
8. All Phase 0 tests still pass (no regressions)

## 3. Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Tick loop location | Domain interface + infrastructure implementation | Domain defines the contract (TickScheduler, GameSystem). Infrastructure implements with ExcaliburJS accumulator. Domain stays testable without ExcaliburJS. |
| ECS components | Thin infrastructure wrappers around domain data interfaces | Domain defines `NeedsState`, `MoodState`, `MemoryState` as plain interfaces. Infrastructure wraps in ExcaliburJS `Component` subclasses with dirty tracking. Systems operate on pure data. |
| GameDeps | Progressive — minimal `GameCoreDeps` now | Logger, eventBus, config, performanceTracker, tickCount. ISP subsets extracted in Phase 1B when real system dependencies emerge. |
| EventBus batching | Transparent — tick runner controls it | `emit()` API unchanged. Tick runner calls batch methods on a `BatchableEventBus` (infrastructure extension). Domain `EventBus` interface untouched. Phase 0 tests pass without modification. |
| ExcaliburJS integration | Single System as tick accumulator | One ExcaliburJS `System` subclass hosts the fixed-timestep accumulator. Game systems are plain objects implementing `GameSystem`, NOT individual ExcaliburJS Systems. |

**GDD Deviation — §30.2:** The GDD states "All GDD systems are ExcaliburJS `System` subclasses with priority ordering." This spec departs from that: only `MeridianTickSystem` is registered with the ExcaliburJS World. Game simulation systems (NeedsDecay, Mood, etc.) are plain objects implementing the `GameSystem` interface, dispatched by the tick runner at 2Hz — not at 60fps. GDD §30.2 should be updated to reflect this decision. The rationale: ExcaliburJS Systems run every frame; our simulation systems must run at the fixed tick rate.

## 4. Architecture

### 4.1 Layer Map

```
Domain Layer (pure, testable without ExcaliburJS):
  domain/core/tick-scheduler.ts     — TickScheduler + GameSystem interfaces, SystemPriority constants
  domain/core/game-deps.ts          — GameCoreDeps interface
  domain/core/component-data.ts     — NeedsState, MoodState, MemoryState, BlackboardState

Infrastructure Layer (ExcaliburJS integration):
  infrastructure/engine/tick-runner.ts         — TickScheduler implementation + BatchableEventBus
  infrastructure/engine/tick-system.ts         — ExcaliburJS System subclass hosting the tick runner
  infrastructure/components/tracked-component.ts   — TrackedComponent base (dirty flag)
  infrastructure/components/needs-component.ts     — ExcaliburJS Component wrapping NeedsState
  infrastructure/components/mood-component.ts      — ExcaliburJS Component wrapping MoodState
  infrastructure/components/memory-component.ts    — ExcaliburJS Component wrapping MemoryState
  infrastructure/components/blackboard-component.ts — ExcaliburJS Component (empty, Phase 1B consumer)

Plugin wiring (modified):
  plugin.ts                          — GameCoreDeps composition in initializeGame()
  infrastructure/engine/game-view.ts — Receives deps, creates tick runner + tick system
```

### 4.2 TickScheduler Interface (Domain)

```typescript
// domain/core/tick-scheduler.ts

export interface GameSystem {
    /** Unique name for logging and performance tracking */
    readonly name: string;
    /** Execution priority — lower runs first (matches GDD §6.1 numbering) */
    readonly priority: number;
    /** Execute one tick of this system */
    execute(deps: GameCoreDeps): void;
}

export interface TickScheduler {
    /** Register a system. Systems execute in priority order on each tick. */
    register(system: GameSystem): void;
    /** Execute one complete tick — all registered systems in priority order. */
    tick(deps: GameCoreDeps): void;
    /** Current tick count (monotonically increasing, incremented after systems complete). */
    readonly tickCount: number;
}

/** Named priority constants matching GDD §6.1 system numbering */
export const SystemPriority = {
    TRAIT_RESOLVER: 0.5,
    DAY_NIGHT: 0.7,
    NEEDS_DECAY: 1,
    MOOD: 2,
    PERCEPTION: 3,
    MEMORY: 4,
    BEHAVIOR_TREE: 5,
    MOVEMENT: 5.5,
    JOB: 6,
    QUEST_EVALUATION: 7,
    OBJECT_INTERACTION: 8,
    TOOL_EXECUTION: 9,
    CONSTRUCTION: 10,
    TRADE: 11,
    DIALOGUE: 12,
    PROGRESSION: 13,
    RELATIONSHIP: 14,
    MORTALITY_CHECK: 14.5,
    ITEM_DURABILITY: 15,
    ECONOMY: 16,
    WORLD_EVENT: 17,
    SEASON: 17.5,
    NOTIFICATION: 18,
    CHRONICLER: 18.5,
    SCENARIO: 18.7,
    ABANDONMENT: 18.8,
    VAULT_SYNC: 19,
    UI_BRIDGE: 20,
} as const;
```

### 4.3 Tick Runner (Infrastructure)

Implements `TickScheduler`. Orchestrates system execution with:

- **Priority ordering**: Systems sorted by `priority` on registration. Re-sorted if systems are added dynamically.
- **Error boundary**: The entire per-system block (execute + endSystem + flushBatch) is wrapped in try/catch with a finally block that ensures batch mode is always reset. On failure: log error, emit `SystemError` event, skip the system for this tick, continue with next system. System is NOT permanently disabled (GDD §16.6 — per-tick error boundary).
- **EventBus batching**: Uses `BatchableEventBus` (infrastructure extension of domain `EventBus`). Calls `beginBatch()` before each system, `flushBatch()` after. Events emitted during system execution are queued and delivered before the next system runs.
- **Performance tracking**: Calls `performanceTracker.startSystem(name)` / `endSystem()` around each system if tracking is enabled.
- **Tick counter**: Incremented after all systems complete (so during execution, `tickCount` reflects the last completed tick; the "current" tick is `tickCount + 1`). Systems that need the current tick number read it from `deps.tickCount` which is updated by the runner before the system loop.

```
tick(deps):
    currentTick = tickCount + 1
    deps.tickCount = currentTick      // systems read this for GameEvent.tick
    for each system in priority order:
        batchableEventBus.beginBatch()
        performanceTracker.startSystem(system.name)
        try:
            system.execute(deps)
        catch (err):
            logger.error('TickRunner', 'System failed', err)
        finally:
            performanceTracker.endSystem()
            batchableEventBus.flushBatch()
    performanceTracker.completeTick(currentTick)
    tickCount = currentTick
```

### 4.4 BatchableEventBus (Infrastructure)

Batching is an infrastructure concern — it belongs to the tick runner, not to domain code. The domain `EventBus` interface in `domain/core/events.ts` is **unchanged**.

```typescript
// infrastructure/engine/tick-runner.ts (or a separate file)

export interface BatchableEventBus extends EventBus {
    beginBatch(): void;
    flushBatch(): void;
}
```

The existing `createEventBus()` implementation is extended to return `BatchableEventBus`. Since it's a superset, all existing code that types it as `EventBus` continues to work. The `GameCoreDeps.eventBus` field stays typed as `EventBus` (domain interface). Only the tick runner holds a `BatchableEventBus` reference.

**Internal behavior:**
- `batching: boolean` flag (default `false`)
- `batchQueue: GameEvent[]` — events queued during batch mode
- `emit()` when `batching === false`: dispatch immediately (Phase 0 behavior, all existing tests pass)
- `emit()` when `batching === true`: push to `batchQueue`, add to history, but don't dispatch to handlers
- `beginBatch()`: set `batching = true`, clear queue
- `flushBatch()`: set `batching = false`, dispatch all queued events in order, clear queue

Events emitted during `flushBatch()` handler execution dispatch immediately (batching is `false` during flush). This allows one level of reactive events but prevents infinite cascading.

### 4.5 TickSystem (ExcaliburJS Integration)

A single ExcaliburJS `System` subclass registered with the gameplay scene's `World`. This is the bridge between ExcaliburJS's 60fps update loop and our 2Hz simulation tick.

**Note:** `MeridianTickSystem` deliberately has no ECS query — it is a scheduling bridge, not an entity processor. It does not read or write any ExcaliburJS components. This is an accepted deviation from the standard ExcaliburJS System pattern where systems typically declare component queries.

```typescript
// infrastructure/engine/tick-system.ts

class MeridianTickSystem extends ex.System {
    systemType = ex.SystemType.Update;
    static override priority = 0;  // after physics (-5), standard update position

    private accumulator = 0;
    private readonly maxCatchUp = 3;

    constructor(
        private tickRunner: TickScheduler,
        private deps: GameCoreDeps,
    ) { super(); }

    update(elapsed: number): void {
        this.accumulator += elapsed;
        const interval = this.deps.config.tick_interval_ms;
        let steps = 0;
        while (this.accumulator >= interval && steps < this.maxCatchUp) {
            this.tickRunner.tick(this.deps);
            this.accumulator -= interval;
            steps++;
        }
        // Clamp to prevent death spiral
        if (this.accumulator > interval) {
            this.accumulator = interval;
        }
    }
}
```

**Key details:**
- `static override priority = 0` — runs after ExcaliburJS physics systems (priority -5), at the standard update position
- `maxCatchUp = 3` — prevents death spiral if a tick takes too long
- Accumulator clamped after catch-up to prevent unbounded growth
- `elapsed` is in milliseconds (ExcaliburJS convention — parameter named `elapsed` in the base class)
- Registered once in `game-view.ts` on scene initialization

### 4.6 Component Data Interfaces (Domain)

Plain TypeScript interfaces. No ExcaliburJS dependency. Located in `domain/core/component-data.ts`.

```typescript
export interface NeedsState {
    hunger: number;      // 0-100
    energy: number;      // 0-100
    social: number;      // 0-100
}

export interface MoodState {
    value: number;       // -100 to 100
    bucket: string;      // 'elated' | 'content' | 'stressed' | 'distressed' | 'breakdown'
}

export interface MemoryEntry {
    tick: number;
    type: string;
    description: string;
    participants: string[];
    outcome: 'positive' | 'negative' | 'neutral';
    significance: number;
    mood_impact: number;
    original_significance?: number;
}

export interface MemoryState {
    entries: MemoryEntry[];
    maxEntries: number;
}

export interface BlackboardState {
    [key: string]: unknown;
}
```

These match the existing Zod schemas (`MemoryEntrySchema`, `AgentSchema.needs`, etc.) but are runtime state interfaces, not validation schemas. Systems in Phase 1B mutate these directly.

### 4.7 TrackedComponent Base (Infrastructure)

```typescript
// infrastructure/components/tracked-component.ts

export abstract class TrackedComponent extends ex.Component {
    private _dirty = true;  // dirty on creation

    get dirty(): boolean { return this._dirty; }
    markDirty(): void { this._dirty = true; }
    clearDirty(): void { this._dirty = false; }
}
```

Concrete components extend this and hold domain state:

```typescript
// infrastructure/components/needs-component.ts

export class NeedsComponent extends TrackedComponent {
    constructor(public state: NeedsState) { super(); }
}
```

**Pattern:**
- State mutation: `component.state.hunger -= decayRate; component.markDirty();`
- VaultSync (Phase 9): checks `component.dirty` to know what to persist
- UIBridge (Phase 8): checks `component.dirty` to know what to push to Pinia stores

### 4.8 GameCoreDeps (Domain)

```typescript
// domain/core/game-deps.ts

export interface GameCoreDeps {
    readonly logger: Logger;
    readonly eventBus: EventBus;
    readonly config: GameConfig;
    readonly performanceTracker: PerformanceTracker;
    /** Current tick number — set by the tick runner before system execution each tick */
    tickCount: number;
}
```

`tickCount` is mutable — the tick runner updates it at the start of each tick so systems can stamp `GameEvent.tick` with the current simulation tick. Phase 1B will extract ISP subsets as system dependencies become clear.

### 4.9 Plugin Wiring Changes

**`plugin.ts` — `initializeGame()` gets a body:**

```typescript
private initializeGame(): void {
    this.logger?.info('Meridian', 'Game initialization started');

    // Load game config from vault (or use defaults)
    // Create EventBus (returns BatchableEventBus but stored as EventBus in deps)
    // Compose GameCoreDeps { logger, eventBus, config, performanceTracker, tickCount: 0 }
    // Store on plugin instance for game view access
}
```

**`game-view.ts` — accepts deps, creates tick infrastructure:**

```typescript
// Constructor/factory receives deps
// onOpen():
//   Create engine (existing)
//   Create TickRunner (receives BatchableEventBus)
//   Create MeridianTickSystem(tickRunner, deps)
//   Register tick system with scene.world
//   Start engine
```

The `registerView` factory closure captures deps from `initializeGame()`.

## 5. Testing Strategy

### 5.1 Infrastructure Tests

**`tests/infrastructure/engine/tick-runner.test.ts`** (~10 tests):
- Systems execute in declared priority order
- Lower priority runs before higher priority
- Registering systems after creation re-sorts
- Error boundary: failing system is skipped, next system still runs
- Error boundary: SystemError event emitted on failure
- Error boundary: flushBatch still called after system failure (finally block)
- PerformanceTracker receives startSystem/endSystem/completeTick calls
- BatchableEventBus beginBatch/flushBatch called around each system
- tickCount increments after all systems complete
- Empty tick runner (no systems) doesn't throw
- SystemPriority constants match GDD numbering (NEEDS_DECAY === 1, UI_BRIDGE === 20)

**`tests/infrastructure/engine/tick-system.test.ts`** (~4 tests):
- Accumulator fires tick when elapsed >= interval
- No tick fired when elapsed < interval
- Max catch-up of 3 prevents death spiral
- Accumulator clamped after catch-up

**`tests/infrastructure/components/tracked-component.test.ts`** (~4 tests):
- Dirty on creation
- markDirty() sets dirty to true
- clearDirty() sets dirty to false
- State accessible after construction

**`tests/infrastructure/components/needs-component.test.ts`** (~2 tests):
- Holds NeedsState, dirty on creation
- State mutation + markDirty pattern

**`tests/infrastructure/components/mood-component.test.ts`** (~2 tests)
**`tests/infrastructure/components/memory-component.test.ts`** (~2 tests)

**`tests/infrastructure/event-bus.test.ts`** (additions, ~5 tests):
- beginBatch queues events instead of dispatching
- flushBatch delivers all queued events in order
- emit outside batch mode still dispatches immediately (regression)
- Events emitted during flushBatch handler execute immediately
- beginBatch + flushBatch with no events is a no-op

### 5.2 Integration Test

**`tests/integration/tick-integration.test.ts`** (~3 tests):
- Two mock systems: system A emits event, system B receives it (via batch flush between them)
- System A fails: system B still executes, receives no events from A
- PerformanceTracker records timing for both systems

### Estimated Total: ~32 new tests → ~142 total

## 6. What's NOT in Phase 1A

- No game systems (NeedsDecay, Mood, Memory, BT — Phase 1B)
- No vault loading into ECS entities (schema → component wiring — Phase 1B)
- No mortality, no behavior trees, no movement
- No new Zod schemas
- No ISP dep subsets (extracted in Phase 1B when real patterns emerge)
- No entity spawning/despawning (no command buffer yet — Phase 1B when mortality needs it)

## 7. Phase 1B Preview

Phase 1B builds the actual game systems on Phase 1A's foundation:
- NeedsDecaySystem, MoodSystem, MemorySystem
- TraitResolverSystem integration (already exists as pure function, needs ECS wiring)
- Basic BT (idle + needs + mood breakdown) via mistreevous
- Blackboard population from components
- Mortality system (toggle, collapse, death, legacy)
- Vault → ECS entity spawning pipeline
- Entity lifecycle marker components (SpawningComponent, SuspendedComponent, DyingComponent)
- Command buffer for deferred entity operations

## 8. Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|------------|--------|------------|
| ExcaliburJS System.update `elapsed` units mismatch | Low | High | Verify `elapsed` is milliseconds in first test; ExcaliburJS docs confirm this |
| TrackedComponent conflicts with ExcaliburJS internals | Low | Medium | ExcaliburJS Component is a simple base; no known conflicts with dirty flag pattern |
| EventBus batching breaks existing Phase 0 tests | Low | Low | Batching is off by default; only active when tick runner calls beginBatch. Domain EventBus interface unchanged. |
| GameCoreDeps interface too narrow for Phase 1B | Medium | Low | Progressive design — add fields when needed, existing consumers unaffected |
| MeridianTickSystem has no ECS query | Low | Low | Deliberately queryless — scheduling bridge, not entity processor. ExcaliburJS does not enforce query at runtime. |
