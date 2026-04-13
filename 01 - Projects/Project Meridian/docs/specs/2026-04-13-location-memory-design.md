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

| Source | Initial Significance | Min Lifespan | Total Lifetime (approx) |
|--------|---------------------|-------------|------------------------|
| `visited` | 50 | 2400 ticks (~5 days) | ~5.5 days after last visit |
| `perceived` | 25 | 960 ticks (~2 days) | ~2.5 days after last sighting |
| `gossip` | 15 * reliability | 480 ticks (~1 day) | 1-3 days (reliability 1.0 = ~2.5 days, 0.4 = ~1.2 days) |

### Decay Algorithm

- Entries begin decaying after `min_lifespan_ticks` (per-source) since `lastRefreshedTick`
- Decay rate: `0.1 / (originalSignificance / 5)` per tick — same formula as event memory decay
- Entries below `usable_threshold` (5) are pruned from the array
- Re-visiting or re-perceiving a location resets `lastRefreshedTick` and refreshes significance to the source tier level

### Config

```typescript
location_memory: {
    usable_threshold: 5,
    visited: { significance: 50, min_lifespan_ticks: 2400 },
    perceived: { significance: 25, min_lifespan_ticks: 960 },
    gossip: { significance_multiplier: 15, min_lifespan_ticks: 480 },
}
```

---

## Writers — Three Systems

### 1. PerceptionSystem (existing, modified)

After updating `PerceptionComponent.state`, scan `nearbyLocations`:
- No entry exists → create with `source: 'perceived'`, significance 25
- Entry exists with `source: 'perceived'` or `source: 'gossip'` → refresh `lastRefreshedTick` only (don't upgrade significance)
- Entry exists with `source: 'visited'` → refresh `lastRefreshedTick` only
- Skip locations with empty `facilityType`

### 2. MovementSystem (existing, modified — replaces line 246-248)

On arrival at a location:
- No entry exists → create with `source: 'visited'`, significance 50
- Entry exists → upgrade `source` to `'visited'`, reset significance to 50, refresh `lastRefreshedTick`

Gossip-learned locations get promoted to full knowledge on first visit.

### 3. GossipSystem (existing, modified)

When receiving LocationGossip:
- No entry exists → create with `source: 'gossip'`, significance `15 * reliability`, position from gossip data
- Entry exists with `source: 'gossip'` and new gossip has higher reliability → update reliability, refresh significance
- Entry exists with `source: 'perceived'` or `'visited'` → ignore (first-hand knowledge is better)

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

The setter is removed. All writes go through `locationMemories`. The only code that currently assigns to `knownLocations` directly is `movement-system.ts:246-248`, which is being rewritten as part of this change.

---

## Consumer Impact

### SeekKnownRestLocation (recently added)

Gains source-based preference sorting. Candidates are sorted by source tier first, distance second:

```
visited locations → perceived locations → gossip locations
    (each group sorted by distance)
```

This requires looking up the `locationMemories` entry for each candidate to check its source.

### Other Consumers

- `KnowsFoodSource` — uses `priceMemories`, not `knownLocations`. No change.
- `KnowsSupplyRoute` — reads `knownLocations` which now returns the derived list. Transparent.
- `QuestAvailable` — reads `knownLocations` via `new Set(memory.knownLocations)`. Transparent.
- Debug overlay — reads `ba.knownLocations`. Transparent.

---

## New System: LocationMemoryDecaySystem

Runs each tick at a low priority (after perception, before BT). For each agent:
1. Iterate `locationMemories`
2. For each entry, look up `min_lifespan_ticks` by `entry.source`
3. If `currentTick - entry.lastRefreshedTick > min_lifespan_ticks`, apply decay: `entry.significance -= 0.1 / (entry.originalSignificance / 5)`
4. Remove entries where `significance < usable_threshold`

---

## Out of Scope

- **Exploration behavior** — no BT branch for deliberate exploration. Agents learn organically.
- **Location quality memory** — no tracking of prices, stock levels, or service quality per location.
- **Vault persistence** — locationMemories is runtime-only WorkingMemory state.
