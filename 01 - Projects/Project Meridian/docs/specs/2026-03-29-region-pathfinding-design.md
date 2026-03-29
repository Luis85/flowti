# Region Graph + A* Pathfinding — Design Spec

**Goal:** Complete Phase 2 Spatial — agents navigate between polygonal regions via A* pathfinding with automatic waypoint chaining, energy cost on boundary crossings, and obstacle avoidance during movement.

**Design Spec:** `docs/specs/2026-03-29-region-pathfinding-design.md`
**Project Root:** `01 - Projects/Project Meridian/`

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

The `region` field is nullable with default null for backward compatibility. The world-loader validates that locations with a non-null region fall within that region's polygon bounds. Locations with null region are assumed to be in whatever region contains their position.

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

1. Determine which region the agent is currently in (using `pointInPolygon` against all regions)
2. Determine which region the target is in
3. If same region: set `movementTarget` as today (no journey needed)
4. If different region:
   - Call `findRegionPath(graph, agentRegion, targetRegion)`
   - Compute crossing points for each hop via `computeCrossingPoint`
   - Store `journey` on blackboard with waypoints + final target
   - Set `movementTarget` to the first crossing point

New dependencies: region graph (passed as parameter), regions list (for pointInPolygon).

## 10. MovementSystem Changes

Extended to handle journey waypoints:

1. On arrival at a waypoint (crossing point):
   - Deduct `travel_cost` energy from agent
   - Emit `RegionEntered` event
   - Advance `waypointIndex`
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
| `RegionEntered` | MovementSystem | agentId, fromRegion, toRegion, travelCost, energyRemaining |

## 14. Exit Criteria

1. Agent travels from region A to region B via automatic waypoint chain
2. Energy decremented by connection's `travel_cost` on each boundary crossing
3. A* finds shortest path through multi-hop regions
4. Agents steer around stationary obstacles during movement
5. `pointInPolygon` correctly determines agent's current region
6. World-loader loads and validates region data
7. Same-region movement unchanged from current behavior
8. All existing 461 tests pass + 30+ new tests
9. tsc, eslint, build green

## 15. Scope Boundaries

**In scope:** Region schema, polygon math, A* pathfinding, journey waypoints, crossing points, obstacle steering, energy deduction on crossing, RegionEntered event.

**Out of scope:** Navmesh, tile-based grids, mid-travel agent-agent collision, region rendering (beyond debug), region-specific weather/modifiers, dynamic region creation.

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
| `src/infrastructure/systems/movement-system.ts` | Modify | Waypoint following, crossing deduction, steering |
| `src/infrastructure/engine/game-view.ts` | Modify | Wire regions to systems |
| `locations/*.json` | Modify | Add region field |
