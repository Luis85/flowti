# Location Memory — Design Spec

**Date:** 2026-04-13
**Goal:** Replace the permanent `knownLocations` string array with a significance-based location memory system where agents discover locations through perception, arrival, and gossip — each with independent decay rates.

---

## Architecture

### Approach: WorkingMemory Extension

A new `locationMemories` array on WorkingMemory stores `LocationMemoryEntry` records. The existing `knownLocations: string[]` becomes a derived getter computed from entries above a usable significance threshold. Three systems write entries (PerceptionSystem, MovementSystem, GossipSystem). A new `LocationMemoryDecaySystem` ticks significance down over time.

### Key Principles

- **No magic knowledge** — agents learn locations by seeing them (perception), visiting them (arrival), or hearing about them (gossip)
- **Source hierarchy** — `visited > perceived > gossip`. Higher sources never downgrade.
- **Decay creates forgetting** — unused location knowledge fades. Routine visits refresh it. Gossip-learned locations fade fastest.
- **Preference not exclusion** — gossip-learned locations are usable for navigation but deprioritized behind personally-visited ones

---

## LocationMemoryEntry Structure

```typescript
interface LocationMemoryEntry {
    locationId: string;
    facilityType: string;
    position: { x: number; y: number };
    significance: number;
    originalSignificance: number;
    source: 'visited' | 'perceived' | 'gossip';
    reliability: number;           // 1.0 for first-hand, degrades for gossip
    discoveredTick: number;
    lastRefreshedTick: number;     // resets decay clock
}
```

---

## Significance Tiers & Decay Timing

**Decay formula:** flat configurable rate `decay_per_tick` (default 0.025/tick), applied after source-specific min_lifespan elapses since `lastRefreshedTick`. Not the event memory formula — location memory decays independently.

| Source | Initial Significance | Min Lifespan | Decay Phase | Total Lifetime |
|--------|---------------------|-------------|-------------|---------------|
| `visited` | 50 | 960 ticks (~2 days) | (50-5)/0.025 = 1800 ticks | 2760 ticks (~5.75 days) |
| `perceived` | 25 | 480 ticks (~1 day) | (25-5)/0.025 = 800 ticks | 1280 ticks (~2.67 days) |
| `gossip` (rel 1.0) | 20 | 480 ticks (~1 day) | (20-5)/0.025 = 600 ticks | 1080 ticks (~2.25 days) |
| `gossip` (rel 0.6) | 12 | 480 ticks (~1 day) | (12-5)/0.025 = 280 ticks | 760 ticks (~1.58 days) |
| `gossip` (rel 0.4) | 8 | 480 ticks (~1 day) | (8-5)/0.025 = 120 ticks | 600 ticks (~1.25 days) |
| `gossip` (rel 0.2) | 4 | — | below threshold | **not usable** |

### Decay Algorithm

- Entries begin decaying after `min_lifespan_ticks` (per-source) since `lastRefreshedTick`
- Decay rate: `config.location_memory.decay_per_tick` per tick (default 0.025)
- Entries below `usable_threshold` (5) are pruned from the array
- Re-visiting or re-perceiving a location resets `lastRefreshedTick` and refreshes significance to the source tier level

### Config

```typescript
location_memory: {
    usable_threshold: 5,
    decay_per_tick: 0.025,
    visited: { significance: 50, min_lifespan_ticks: 960 },
    perceived: { significance: 25, min_lifespan_ticks: 480 },
    gossip: { significance_multiplier: 20, min_lifespan_ticks: 480 },
}
```

---

## Writers — Three Systems

All writes target `memory.locationMemories` on the agent's WorkingMemory (accessed via `agent.behaviorAgent`). These are infrastructure-layer operations, not domain function changes.

### 1. PerceptionSystem (modified — `perception-system.ts`)

In the infrastructure system body, after updating `PerceptionComponent.state`, scan `nearbyLocations` and write to `agent.behaviorAgent.locationMemories`:
- No entry exists → create with `source: 'perceived'`, significance 25
- Entry exists with `source: 'perceived'` or `source: 'gossip'` → refresh `lastRefreshedTick` only (don't upgrade significance)
- Entry exists with `source: 'visited'` → refresh `lastRefreshedTick` only
- Skip locations with empty `facilityType`

Note: this write happens in `perception-system.ts` (infrastructure), NOT in `perception.ts` (domain). The domain function `resolvePerception` remains pure.

### 2. MovementSystem (modified — replaces line 246-248)

On arrival at a location:
- No entry exists → create with `source: 'visited'`, significance 50
- Entry exists → upgrade `source` to `'visited'`, reset significance to 50, refresh `lastRefreshedTick`

Gossip-learned locations get promoted to full knowledge on first visit.

### 3. GossipSystem (modified — `gossip-system.ts`)

When receiving LocationGossip, write to `locationMemories` AND keep the existing `MemoryComponent` gossip entry (the episodic memory record "I heard about X from Y" is still valuable for mood/relationship calculations):
- No entry exists in `locationMemories` → create with `source: 'gossip'`, significance `20 * reliability`, position from gossip data
- Entry exists with `source: 'gossip'` and new gossip has higher reliability → update reliability, refresh significance
- Entry exists with `source: 'perceived'` or `'visited'` → ignore (first-hand knowledge is better)

**Gossip transitivity change:** because `knownLocations` is now derived from `locationMemories`, gossip-learned locations (above threshold) will appear in `buildFirstHandLocationGossip` and can be re-shared by the receiver. This is intentional — it models natural information flow where people pass on secondhand knowledge. The reliability/hop system already degrades trust appropriately.

---

## Derived knownLocations

The `knownLocations` getter on BehaviorAgent becomes computed:

```typescript
get knownLocations() {
    const threshold = config.location_memory?.usable_threshold ?? 5;
    return memory.locationMemories
        .filter(m => m.significance >= threshold)
        .map(m => m.locationId);
},
```

The setter is removed. This requires changes to three files:

1. **`bt-working-memory.ts`** — remove `knownLocations: string[]` from `WorkingMemory` interface and `createWorkingMemory` initializer. Add `locationMemories: LocationMemoryEntry[]` (initialized to `[]`).
2. **`behavior-agent.ts`** — remove the `knownLocations: string[]` writable property from `BehaviorAgent` interface. Add `readonly knownLocations: string[]` (read-only, getter-derived). Add `locationMemories: LocationMemoryEntry[]` for direct access where source metadata is needed.
3. **`behavior-agent-factory.ts`** — replace the getter/setter pair with a computed getter. Remove the setter. Add a `locationMemories` getter/setter delegating to `memory.locationMemories`.

The only code that currently writes to `knownLocations` directly is `movement-system.ts:246-248`, which is being rewritten to write to `locationMemories` instead.

---

## Consumer Impact

### SeekKnownRestLocation (recently added)

Gains source-based preference sorting. Must iterate `memory.locationMemories` directly (not the derived `knownLocations` getter) to access `.source` metadata. Candidates are sorted by source tier first, distance second:

```
visited locations → perceived locations → gossip locations
    (each group sorted by distance)
```

### Other Consumers

- `KnowsFoodSource` — uses `priceMemories`, not `knownLocations`. No change.
- `KnowsSupplyRoute` — reads `knownLocations` which now returns the derived list. Transparent.
- `QuestAvailable` — reads `knownLocations` via `new Set(memory.knownLocations)`. Transparent.
- `KnowsRestLocation` — reads `knownLocations`. Transparent.
- Debug overlay / SnapshotData — reads `ba.knownLocations`. Transparent (returns derived string array).

---

## New System: LocationMemoryDecaySystem

Runs each tick at a low priority (after perception, before BT — e.g., `SystemPriority.PERCEPTION + 0.5`). For each agent:
1. Iterate `locationMemories`
2. For each entry, look up `min_lifespan_ticks` by `entry.source` from config
3. If `currentTick - entry.lastRefreshedTick > min_lifespan_ticks`, apply decay: `entry.significance -= config.location_memory.decay_per_tick`
4. Remove entries where `significance < usable_threshold`

---

## Out of Scope

- **Exploration behavior** — no BT branch for deliberate exploration. Agents learn organically.
- **Location quality memory** — no tracking of prices, stock levels, or service quality per location.
- **Vault persistence** — locationMemories is runtime-only WorkingMemory state.
