# Region Graph + A* Pathfinding — Design Spec

**Goal:** Complete Phase 2 Spatial — agents navigate between polygonal regions via A* pathfinding with automatic waypoint chaining, stamina cost on boundary crossings, and obstacle avoidance during movement.

**Design Spec:** `docs/specs/2026-03-29-region-pathfinding-design.md`
**Project Root:** `01 - Projects/Project Meridian/`

---

## ADR Amendments

This spec deviates from GDD/arc42 in two documented ways:

1. **Polygonal bounds (not rectangular)** — GDD §9.1 shows `bounds: { width, height }` rectangles. This spec uses polygon vertex arrays for organic region shapes, as agreed during design. ADR-08 is amended: bounds format is `{ x, y }[]` polygons, not axis-aligned rects.

2. **Tick-based region detection (not ExcaliburJS triggers)** — GDD §9.4 specifies ExcaliburJS `collisionstart` trigger zones. The existing codebase uses tick-based domain systems for all game logic (perception, movement, BT, facilities). This spec keeps that pattern — `pointInPolygon` polling in the BT system, waypoint arrival in MovementSystem. ADR-08 is amended: region transitions use tick-based detection, not ExcaliburJS collision events.

3. **JSON region files (not markdown)** — GDD §9.1 shows markdown frontmatter. The current codebase loads all entity data (agents, locations, BTs, traits) as JSON with Zod validation. Regions follow this established pattern.

---

## 1. Region Schema

JSON files in `regions/` directory, Zod-validated by world-loader.

```typescript
const RegionConnectionSchema = z.object({
	regionId: z.string().regex(/^region-[a-z0-9-]+$/),
	travel_cost: z.number().min(0).default(1),
});

export const RegionSchema = z.object({
	id: z.string().regex(/^region-[a-z0-9-]+$/),
	name: z.string().min(1),
	bounds: z.array(z.object({
		x: z.number(),
		y: z.number(),
	})).min(3),
	connections: z.array(RegionConnectionSchema).default([]),
	rest_tier: z.enum(['owned_home', 'public_shelter', 'outdoors']).nullable().default(null),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#2a2a4a'),
});

export type WorldRegion = z.infer<typeof RegionSchema>;
```

File: `src/domain/schemas/region-schema.ts`

## 2. Region Data (4 Initial Regions)

Partition the current world into 4 polygonal regions:

- **region-market-square** — center area, contains `loc-market` + `loc-tavern`
- **region-farmlands** — top area, contains `loc-farm`
- **region-craft-quarter** — bottom-left, contains `loc-workshop`
- **region-residential** — bottom-right, contains `loc-bakery` + `loc-square`

Connections (bidirectional — declared on both sides):
- market-square ↔ farmlands (cost 2)
- market-square ↔ craft-quarter (cost 1)
- market-square ↔ residential (cost 1)
- craft-quarter ↔ residential (cost 2)

Polygon vertices defined to cover the location positions with reasonable borders. Exact coordinates determined during implementation based on current location positions.

Files: `regions/market-square.json`, `regions/farmlands.json`, `regions/craft-quarter.json`, `regions/residential.json`

## 3. LocationSchema Extension

Add `region` field to LocationSchema:

```typescript
export const LocationSchema = z.object({
	id: z.string().regex(/^loc-[a-z0-9-]+$/),
	name: z.string().min(1),
	type: z.enum(LOCATION_TYPES),
	position: PositionSchema,
	capacity: z.number().int().min(1).default(10),
	color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#808080'),
	production: ProductionSchema,
	region: z.string().regex(/^region-[a-z0-9-]+$/).nullable().default(null),
});
```

The `region` field is nullable with default null for backward compatibility. The world-loader validates that locations with a non-null region fall within that region's polygon bounds. Locations with null region are auto-assigned to the region containing their position.

## 4. Polygon Utilities

Pure domain utility for point-in-polygon testing (ray-casting algorithm).

```typescript
// src/domain/core/polygon.ts

export interface Polygon {
	vertices: { x: number; y: number }[];
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(px: number, py: number, polygon: Polygon): boolean;

/** Compute the centroid of a polygon. */
export function polygonCentroid(polygon: Polygon): { x: number; y: number };
```

Tests: point inside, point outside, point on edge, concave polygon, triangle.

## 5. A* Pathfinding

Pure domain function operating on a region graph.

```typescript
// src/domain/systems/pathfinding.ts

export interface RegionGraphNode {
	id: string;
	centroid: { x: number; y: number };
	connections: { regionId: string; travelCost: number }[];
}

export interface RegionGraph {
	nodes: Map<string, RegionGraphNode>;
}

export interface RegionPathResult {
	path: string[];        // ordered region IDs from start to goal (inclusive)
	totalCost: number;
}

/** Build a region graph from loaded region data. */
export function buildRegionGraph(regions: WorldRegion[]): RegionGraph;

/** A* pathfinding on the region graph. Returns null if no path exists. */
export function findRegionPath(
	graph: RegionGraph,
	fromRegionId: string,
	toRegionId: string,
): RegionPathResult | null;
```

- Edge weights: `travel_cost` from region connections
- Heuristic: Euclidean distance between region centroids
- Returns path including start and goal region IDs

Tests (8+):
- Direct neighbor path (1 hop)
- Multi-hop path (2+ hops)
- No path exists (disconnected regions)
- Same-region returns single-element path with cost 0
- Shortest path chosen when multiple routes exist
- Graph with cycles handled correctly

## 6. Crossing Points

Pure domain function to compute the point where an agent crosses between two regions.

```typescript
// src/domain/systems/crossing-point.ts

/** Find the crossing point between two connected polygonal regions.
 *  Returns the midpoint of the closest pair of polygon edges. */
export function computeCrossingPoint(
	regionA: Polygon,
	regionB: Polygon,
): { x: number; y: number };
```

Algorithm: for each edge of polygon A, find the closest edge of polygon B. The crossing point is the midpoint between the two closest edge midpoints. This handles regions that share a boundary (edges overlap) and regions with a gap between them.

Tests: shared edge, adjacent regions, near-touching edges.

## 7. Steering / Obstacle Avoidance

Pure domain function for simple obstacle avoidance during movement.

```typescript
// src/domain/systems/steering.ts

export interface Obstacle {
	x: number;
	y: number;
	radius: number;
}

/** Given agent position and intended target, compute an adjusted target
 *  that steers around nearby obstacles. Returns original target if path is clear. */
export function resolveSteeringOffset(
	agentX: number,
	agentY: number,
	targetX: number,
	targetY: number,
	obstacles: Obstacle[],
	agentRadius: number,
): { x: number; y: number };
```

Algorithm: check if the straight-line path intersects any obstacle circle. If so, offset the target perpendicular to the line of approach to steer around the closest blocking obstacle. Only considers stationary obstacles (agents with `atLocation` set, location markers).

Moving agents do NOT collide — they pass through each other during travel.

Tests: clear path (no change), single obstacle blocking, obstacle to the side (no adjustment), multiple obstacles.

## 8. Journey State

New interface on component-data for tracking multi-region journeys.

```typescript
// Added to src/domain/core/component-data.ts

export interface JourneyWaypoint {
	regionId: string;
	crossingPoint: { x: number; y: number };
	travelCost: number;
}

export interface JourneyState {
	waypoints: JourneyWaypoint[];
	waypointIndex: number;
	finalTarget: { id: string; type: 'agent' | 'location' };
	totalCost: number;
}
```

Stored on the blackboard as `journey: JourneyState | undefined`. Set by BehaviorTreeSystem when cross-region target detected. Consumed by MovementSystem to follow waypoints. Cleared on arrival at final destination or when BT selects a new action.

## 9. BehaviorTreeSystem Changes

When the BT resolves a movement target:

1. Determine agent's current region — first check `position.region` on the agent's blackboard/state; if null/stale, fall back to `pointInPolygon` against all regions
2. Determine which region the target is in
3. If same region: set `movementTarget` as today (no journey needed)
4. If different region:
   - Call `findRegionPath(graph, agentRegion, targetRegion)`
   - Compute crossing points for each hop via `computeCrossingPoint`
   - Store `journey` on blackboard with waypoints + final target
   - Set `movementTarget` to the first crossing point

New dependencies: region graph (passed as parameter), regions list (for pointInPolygon).

## 10. MovementSystem Changes

Extended to handle journey waypoints and stamina deduction:

1. On arrival at a waypoint (crossing point):
   - Deduct waypoint's `travelCost` from agent's **stamina** (not energy)
   - Update agent's `position.region` to the entered region
   - Emit `RegionEntered` event
   - **Exhaustion check:** if stamina <= 0 after deduction, clear `journey`, halt movement (agent is exhausted in current region). Movement resumes when BT re-evaluates after stamina recovers via idle rest (20 ticks idle recovers 1 stamina per GDD §5.5).
   - If stamina > 0: advance `waypointIndex`
     - If more waypoints: set `movementTarget` to next crossing point
     - If last waypoint reached: set `movementTarget` to final destination
2. On arrival at final destination: clear `journey`, set `atLocation` (existing arrival spread logic)

Obstacle avoidance: before setting velocity each tick, call `resolveSteeringOffset` with nearby stationary obstacles to adjust the movement vector.

Obstacles list: all agents with `atLocation` set (stationary at locations) + location marker positions. Passed as a parameter or computed from agent list.

## 11. World-Loader Changes

- Load `regions/` directory alongside agents/, locations/, behavior-trees/, traits/
- Parse with `RegionSchema`
- Build `RegionGraph` via `buildRegionGraph()`
- Validate: each location's position falls within its declared region's polygon (or auto-assign region if null)
- Pass regions + graph to game-view for system wiring

## 12. Game-View Wiring

- Pass region graph + regions list to `createBehaviorTreeSystem`
- Pass agent list + location positions to `createMovementSystem` for obstacle data
- Optionally render region boundaries in debug mode (polygon outlines)

## 13. Events

| Event | Source | Payload |
|-------|--------|---------|
| `RegionEntered` | MovementSystem | agentId, fromRegion, toRegion, travelCost, staminaRemaining |

## 14. Exit Criteria

1. Agent travels from region A to region B via automatic waypoint chain
2. **Stamina** decremented by connection's `travel_cost` on each boundary crossing
3. Agent halts mid-journey when stamina reaches 0 (exhaustion)
4. A* finds shortest path through multi-hop regions
5. Agents steer around stationary obstacles during movement
6. `pointInPolygon` correctly determines agent's current region
7. Agent's `position.region` updated on each boundary crossing
8. World-loader loads and validates region data
9. Same-region movement unchanged from current behavior
10. PerceptionSystem verified: IQ*20px day / IQ*10px night radius (already implemented — regression check)
11. DayNightSystem verified: dawn/day/dusk/night tick boundaries (already implemented — regression check)
12. All existing 461 tests pass + 30+ new tests
13. tsc, eslint, build green

## 15. Scope Boundaries

**In scope:** Region schema, polygon math, A* pathfinding, journey waypoints, crossing points, obstacle steering, stamina deduction on crossing, exhaustion halt, RegionEntered event, position.region tracking.

**Out of scope:** Navmesh, tile-based grids, mid-travel agent-agent collision, region rendering (beyond debug), region-specific weather/modifiers, dynamic region creation, `SpatialQueryService` (`hopCount`, `entitiesInRegion` — deferred to Phase 3 when consuming systems need it).

## 16. File Summary

| File | Action | Purpose |
|------|--------|---------|
| `src/domain/schemas/region-schema.ts` | Create | RegionSchema Zod validation |
| `src/domain/core/polygon.ts` | Create | pointInPolygon, polygonCentroid |
| `src/domain/systems/pathfinding.ts` | Create | buildRegionGraph, findRegionPath (A*) |
| `src/domain/systems/crossing-point.ts` | Create | computeCrossingPoint |
| `src/domain/systems/steering.ts` | Create | resolveSteeringOffset |
| `regions/*.json` | Create | 4 region data files |
| `src/domain/schemas/location-schema.ts` | Modify | Add region field |
| `src/domain/core/component-data.ts` | Modify | Add JourneyState |
| `src/infrastructure/engine/world-loader.ts` | Modify | Load regions, build graph |
| `src/infrastructure/systems/behavior-tree-system.ts` | Modify | Journey detection + path computation |
| `src/infrastructure/systems/movement-system.ts` | Modify | Waypoint following, stamina deduction, steering, exhaustion halt |
| `src/infrastructure/engine/game-view.ts` | Modify | Wire regions to systems |
| `locations/*.json` | Modify | Add region field |
