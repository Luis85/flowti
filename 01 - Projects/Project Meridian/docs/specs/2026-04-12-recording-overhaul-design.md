# Recording System Overhaul — Design Spec

**Date:** 2026-04-12
**Goal:** Replace the markdown-based recording system with a structured JSONL recorder that captures every event unfiltered and interleaves full world-state snapshots at phase boundaries. Primary consumers are machines and analysts.

---

## Architecture

### Approach: Dedicated Recorder Module

A new `recorder.ts` module owns the recording lifecycle. The debug overlay merely toggles it on/off. The existing markdown snapshot builder and live overlay panels remain untouched.

```
debug-overlay.ts (UI)
    │
    ├── buildDiagnosticSnapshot()  — markdown, for copy-to-clipboard (unchanged)
    ├── live panels                — agents/world/economy/quests/stats (unchanged)
    │
    └── recorder.start() / recorder.stop()
            │
            recorder.ts (infrastructure, no DOM dependency)
                ├── subscribes to eventBus.onAny() — captures all events
                ├── on DayPhaseChanged — calls buildSnapshotData() for full snapshot
                ├── serializes records to JSONL
                └── on stop — writes .jsonl file to vault
```

### Key Principles

- **No write-time filtering** — every event emitted to the bus appears in the recording. Analysts filter at read time.
- **Hybrid cadence** — continuous per-tick event stream + full snapshots at phase boundaries (4/day).
- **Two formats, two purposes** — markdown stays for human clipboard inspection; JSONL for machine analysis.
- **No DOM dependency** — the recorder is pure infrastructure, testable with mock event bus and mock writeFile.

---

## JSONL Record Schema

Each line is a self-contained JSON object. Two record types, discriminated by `record` field:

### Event Record

Thin wrapper around the existing `GameEvent` interface. All fields pass through unchanged.

```json
{
    "record": "event",
    "tick": 237,
    "type": "GoldFlowed",
    "source": "UseService",
    "wallClock": 1718217600000,
    "payload": {
        "category": "transfer",
        "subcategory": "service_fee",
        "amount": 5,
        "fromEntity": "agent-aldric",
        "toEntity": "tavern"
    }
}
```

### Snapshot Record

Full world state captured at phase boundaries. Structured typed data instead of formatted strings.

```json
{
    "record": "snapshot",
    "tick": 240,
    "day": 0,
    "phase": "day",
    "phaseProgress": "240/480",
    "economy": { "..." },
    "population": { "..." },
    "agents": ["..."],
    "facilities": ["..."],
    "quests": ["..."],
    "goldFlows": { "..." },
    "actionDistribution": { "..." },
    "anomalies": ["..."],
    "config": { "..." }
}
```

Records are interleaved chronologically — events flow between snapshots, all ordered by tick.

---

## Snapshot Data Structure

```typescript
interface SnapshotData {
    tick: number;
    day: number;
    phase: string;
    phaseProgress: string;

    economy: {
        treasury: number;
        agentGold: number;
        facilityGold: number;
        totalGold: number;
        velocity: number;
        velocityHealth: string;
        faucetRate: number;
        sinkRate: number;
        netFlow: number;
        dailySummary: {
            wages: number;
            tax: number;
            sales: number;
            jobSwitches: number;
            supplyDeliveries: number;
            questsCompleted: number;
        };
        marketPrices: Record<string, number>;
        stimulusActive: boolean;
    };

    population: {
        agentCount: number;
        employedCount: number;
        avgHunger: number;
        avgEnergy: number;
        avgThirst: number;
        avgMood: number;
        avgSleepDebt: number;
    };

    agents: Array<{
        name: string;
        id: string;
        kind: string;
        action: string | null;
        commitment: { action: string; ticksRemaining: number } | null;
        btPath: string;
        attributes: { st: number; dx: number; iq: number; ht: number };
        traits: string[];
        position: { x: number; y: number };
        location: string | null;
        destination: string | null;
        facilityOccupancy: string | null;
        needs: {
            hunger: { value: number; threshold: number };
            energy: { value: number; threshold: number };
            thirst: { value: number; threshold: number };
            social: { value: number };
        };
        mood: {
            value: number;
            bucket: string;
            factors: Record<string, number>;
        };
        gold: number;
        stamina: { current: number; max: number };
        sleepDebt: number;
        recovering: boolean;
        wakeOffset: number;
        sleepOffset: number;
        job: { role: string; facility: string } | null;
        unemployedTicks: number;
        knownLocations: string[];
        inventory: Array<{ item: string; quantity: number; charges?: number }>;
        priceMemory: { count: number; cheapestFood: number | null; oldestTick: number | null };
        memories: { count: number; max: number; inWindow: number; positive: number; negative: number };
        relationships: Array<{ target: string; disposition: number; familiarity: number }>;
        quests: string[];
        supplyRoutes: string[];
        hauling: string | null;
        serviceVisit: { facilityId: string; ticksRemaining: number; costPaid: boolean } | null;
    }>;

    facilities: Array<{
        name: string;
        id: string;
        type: string;
        status: string;
        fund: number;
        workerId: string | null;
        stock: Array<{ item: string; quantity: number }>;
        production: {
            output: string;
            quantity: number;
            intervalTicks: number;
            wage: number;
            job: string;
            input?: string;
        } | null;
    }>;

    quests: Array<{
        state: string;
        type: string;
        facilityId: string;
        itemId: string | null;
        quantity: number;
        reward: number;
        expiryTicksRemaining: number;
        claimedBy: string | null;
        repairProgress: number;
    }>;

    goldFlows: Record<string, { total: number; count: number }>;

    actionDistribution: Record<string, string[]>;

    anomalies: string[];

    config: {
        ticksPerDay: number;
        phases: Record<string, { start: number; end: number }>;
        restDayInterval: number;
        leisureMoodThreshold: number;
        sleepDebtMax: number;
        treasuryRegenPerAgentPerDay: number;
        moodWeights: Record<string, number>;
        restTiers: Record<string, number>;
    };
}
```

---

## BtEvaluated Event

New event emitted from `behavior-tree-system.ts` each tick per agent after tree evaluation:

```typescript
{
    type: "BtEvaluated",
    tick: number,
    wallClock: number,
    source: "BehaviorTreeSystem",
    payload: {
        agentId: string,
        leaf: string,          // terminal node name
        leafStatus: string,    // "RUNNING" | "SUCCEEDED" | "FAILED"
        action: string | null, // btAction after evaluation
        committedAction: string | null,
        commitmentTicks: number
    }
}
```

Emitted right after `agent.behaviorTree.step()`. One event per agent per tick (~1,440 events/day with 3 agents). Flows through the standard event bus — captured by the recorder like any other event, no special-casing.

---

## Recorder Module

### Interface

```typescript
interface RecorderDeps {
    getEventBus: () => EventBus;
    buildSnapshot: () => SnapshotData;
    writeFile: (path: string, content: string) => Promise<void>;
    dataRoot?: string;
}

interface Recorder {
    start(): void;
    stop(): Promise<void>;
    isRecording(): boolean;
}

function createRecorder(deps: RecorderDeps): Recorder;
```

### Lifecycle

1. **`start()`** — subscribes to `eventBus.onAny()`. Every event is serialized as a JSONL event record and pushed to an in-memory string buffer. `DayPhaseChanged` events additionally trigger a full snapshot record. An initial snapshot is captured immediately on start.

2. **While recording** — events accumulate as JSONL strings in the buffer. Snapshots interleave at phase boundaries. No filtering.

3. **`stop()`** — captures a final snapshot, unsubscribes from the event bus, joins the buffer with newlines, writes to `{dataRoot}/Economy/Recordings/recording-YYYY-MM-DD-HHMM.jsonl`. Returns a promise that resolves on write completion.

---

## Integration Points

### 1. `behavior-tree-system.ts`

After `agent.behaviorTree.step()`, emit `BtEvaluated` event using `extractActivePath` to get the leaf node and status.

### 2. `debug-overlay.ts`

- Replace recording state variables and start/stop logic (~60 lines) with `createRecorder()` call
- Menu click handler delegates to `recorder.start()` / `recorder.stop()`
- Existing markdown builder, live panels, copy-to-clipboard — all unchanged

### 3. New: `recorder.ts`

New file `src/infrastructure/engine/recorder.ts` containing `createRecorder` and JSONL serialization.

### 4. New: `buildSnapshotData` in `debug-overlay.ts`

New function alongside `buildDiagnosticSnapshot` that returns `SnapshotData` typed objects. Extracts logic from existing `build*Snapshot` functions but returns structured data instead of formatted strings.

---

## Output

**File path:** `{dataRoot}/Economy/Recordings/recording-YYYY-MM-DD-HHMM.jsonl`

**Structure:** First line is always a snapshot (initial state). Last line is a final snapshot (on stop). Between phase-change snapshots, every event flows unfiltered in tick order.

```
{"record":"snapshot","tick":57,...}
{"record":"event","tick":58,"type":"NeedChanged",...}
{"record":"event","tick":58,"type":"BtEvaluated",...}
{"record":"event","tick":59,"type":"BtEvaluated",...}
...
{"record":"snapshot","tick":120,...}
...
{"record":"snapshot","tick":240,...}   (final snapshot on stop)
```
