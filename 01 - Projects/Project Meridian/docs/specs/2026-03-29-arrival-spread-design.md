# Arrival Spread — Design Spec

**Goal:** When multiple agents arrive at the same location, spread them in a ring around the location center instead of stacking on the exact same pixel.

**Approach:** Domain-level separation at destinations. No physics colliders. Agents pass through each other during travel.

---

## 1. Pure Domain Function

`resolveArrivalOffset(slotIndex: number, totalAgents: number, spreadRadius: number): { dx: number; dy: number }`

- 1 agent: offset `(0, 0)` — center
- 2+ agents: distribute evenly in a ring using `angle = (2 * PI / totalAgents) * slotIndex`
- `dx = cos(angle) * spreadRadius`, `dy = sin(angle) * spreadRadius`
- `spreadRadius` from config (default 22px)

File: `src/domain/systems/arrival-spread.ts`
Tests: `tests/domain/systems/arrival-spread.test.ts`

## 2. Movement System Changes

In `movement-system.ts`, on arrival (when `dist <= arrivalThreshold`):

1. Count how many agents are currently at this location (same target ID)
2. Assign a slot index to the arriving agent
3. Compute offset via `resolveArrivalOffset`
4. Snap to `targetPos + offset` instead of exact `targetPos`

Track occupancy: the movement system already clears `movementTarget` on arrival. We need a way to know which agents are "at" a location. Options:
- **Blackboard field `atLocation: string | null`** — set on arrival, cleared when new movement target is assigned
- Query all agents with `atLocation === targetId` to get slot count and index

When an agent departs (new `movementTarget` set), clear `atLocation` so its slot frees up.

## 3. Slot Recalculation

When an agent arrives or departs, the ring positions of all agents at that location shift (because `totalAgents` changed). To avoid visual popping, we have two options:

- **Option A (simple):** Accept the pop. Agents reposition instantly when someone arrives/departs.
- **Option B (smooth):** Only assign slots on arrival, don't rebalance when others leave. Gaps in the ring are fine.

**Choice: Option B** — assign a slot on arrival, keep it until departure. Ring may have gaps but no visual jitter. Slot index = next available index (0, 1, 2...).

## 4. Config

Add to `FormulasConfigSchema`:
```typescript
arrival_spread_radius: z.number().default(22),
```

## 5. Interaction Radius Compatibility

The `interaction_radius` is 25px. With spread radius 22px, agents at the edge of the ring are 22px from center — still within interaction radius for facility work, rest, feed, and trade systems. No changes needed to those systems.

## 6. Exit Criteria

1. Two agents arriving at the same location are visually separated (not overlapping)
2. Agents spread in a ring around the location center
3. Agents within spread radius are still detected by Facility/Rest/Trade systems (within interaction_radius)
4. Departing agents free their slot
5. Pure domain function with full test coverage
6. Existing 455 tests still pass

---

## 7. Scope Boundaries

**In scope:** Arrival offset, ring spread, slot tracking, config value.
**Out of scope:** Mid-travel collision, obstacle avoidance, A* pathfinding (Phase 2 region work).
