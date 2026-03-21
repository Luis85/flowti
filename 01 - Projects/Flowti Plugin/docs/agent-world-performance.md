# Agent world performance events

The Excalibur-based **agent world** (living canvas) runs a **preframe simulation** (`tickSimulation`) and a **postframe** store sync. When `createAgentWorld({ …, eventBus })` is called with the plugin `IEventBus`, the engine emits structured perf events for analysis and for `PerfAggregator`.

## Events

| Event | When | Payload highlights |
|-------|------|-------------------|
| `perf.agentWorld.sample` | Every **~2s** or **120 frames** (whichever first) | `simulation` / `postframe` / `delta` avg & max ms; per-phase breakdown (`clock`, `brain`, `social`, …); `agentCount`, `sceneName` |
| `perf.agentWorld.slowFrame` | Single-frame simulation **≥ 24ms** (default), throttled **4s** | `simulationMs`, `sceneName`, `agentCount`, `deltaMs` |

Phase names match the order in `tickSimulation` (`engine-simulation.ts`): `clock`, `sensor`, `needs`, `reactiveTriggers`, `behaviorThresholds`, `pets`, `roomTransit`, `behaviorTree`, `brain`, `social`, `director`, `visuals`.

## Wiring

### Obsidian (production)

`AgentWorldView` (`src/ui/agents/agent-world-view.ts`) passes:

- `eventBus` — same instance as the plugin (`setupAgentDomain`)
- `getPerfDashboard` — calls `FlowtiBasePlugin.getPerfDashboard()` (returns `PerfAggregator` after `onLayoutReady`)

So **plugin users** get live samples and **PerfAggregator** rollups in Ask Bob → **World** → **World perf monitor** without extra config.

### Embedded / tests

```typescript
import { createAgentWorld } from "./game/engine.js";

const world = createAgentWorld({
  container,
  provider,
  spriteBasePath,
  eventBus: this.eventBus, // enables perf.* agent world emission
  perfDashboard: staticRef, // optional — tests
  getPerfDashboard: () => this.perfAggregator, // optional — lazy, like production
});
```

Without `eventBus`, overhead is a null `perfSampler` check per phase (negligible).

## Ask Bob — World tab

The **Ask Bob** overlay (`ft-game-ask-bob`) receives `eventBus` and `perfDashboard` from `createAgentWorld` deps. In the **World** tab:

1. Enable **World perf monitor** to subscribe to `perf.agentWorld.sample` and `perf.agentWorld.slowFrame`.
2. See live **simulation / postframe / delta** timing, **per-phase** bars, and session **slow-frame** count.
3. If `perfDashboard` is set (typically `PerfAggregator`), the panel also shows **buffered samples** and **p50 / p95 / max** simulation peaks across windows.

## Aggregator

`PerfAggregator.getAgentWorldSummary()` returns the last **20** `perf.agentWorld.sample` snapshots, **`slowFrameCount`**, and a **`MetricSummary`** over per-window `simulation.maxMs` values.

## Tuning

Optional `agentWorldPerf` on `createAgentWorld` deps maps to `createAgentWorldPerfCollector` options: `sampleIntervalMs`, `maxFramesPerSample`, `slowSimulationThresholdMs`, `slowFrameThrottleMs` (see `src/game/performance/agent-world-perf.ts`).
