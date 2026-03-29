# Region Graph + A* Pathfinding — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agents navigate between polygonal regions via A* pathfinding with automatic waypoint chaining, stamina cost on boundary crossings, and obstacle avoidance during movement.

**Architecture:** Pure domain functions (polygon math, A*, crossing points, steering) wrapped in thin infrastructure changes to BehaviorTreeSystem and MovementSystem. New StaminaComponent tracks travel resource separately from energy. Region data loaded as JSON alongside existing entity data.

**Tech Stack:** TypeScript (strict), ExcaliburJS v0.32+ (ECS, Actor), Zod (schema validation), Vitest, ESLint

**Design Spec:** `docs/specs/2026-03-29-region-pathfinding-design.md`

**Project Root:** `01 - Projects/Project Meridian/`

---

## Conventions

- **File naming:** kebab-case (`region-schema.ts`, `pathfinding.test.ts`)
- **Imports:** `.js` extension in all imports (ESM)
- **Indentation:** tabs
- **No `any` types**, no `@ts-ignore`
- **Tests mirror source:** `src/foo/bar.ts` → `tests/foo/bar.test.ts`
- **TDD:** Write failing test → implement → verify → commit
- **ESLint:** `npx eslint src/ tests/ --config configs/eslint.config.mjs` — 0 errors
- **TypeScript:** `npx tsc --noEmit --project configs/tsconfig.json` — 0 errors
- **Full test:** `npx vitest run --config configs/vitest.config.ts` — all tests pass
- **Spread-copy pattern** for all component state mutations
- **Config-driven** — use values from `GameConfigSchema`, never hardcoded numbers in infrastructure

---

## Chunk A: Foundation (Schema + Components + Polygon Math)

Everything in this chunk is foundation — all subsequent chunks depend on it.

### Task A1: RegionSchema + StaminaComponent + JourneyState

**Files:**
- Create: `src/domain/schemas/region-schema.ts`
- Create: `src/infrastructure/components/stamina-component.ts`
- Modify: `src/domain/core/component-data.ts`
- Modify: `src/infrastructure/entity/agent-actor.ts`

- [ ] **Step 1: Create RegionSchema**

Create `src/domain/schemas/region-schema.ts`:

```typescript
import { z } from 'zod';

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

- [ ] **Step 2: Add JourneyState + StaminaState to component-data.ts**

In `src/domain/core/component-data.ts`, add after the existing interfaces:

```typescript
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

export interface StaminaState {
	current: number;
	max: number;
}
```

- [ ] **Step 3: Create StaminaComponent**

Create `src/infrastructure/components/stamina-component.ts`:

```typescript
import type { StaminaState } from '../../domain/core/component-data.js';
import { TrackedComponent } from './tracked-component.js';

export class StaminaComponent extends TrackedComponent {
	constructor(public state: StaminaState) { super(); }
}
```

- [ ] **Step 4: Add StaminaComponent to AgentActor**

In `src/infrastructure/entity/agent-actor.ts`, add import:

```typescript
import { StaminaComponent } from '../components/stamina-component.js';
```

After the RelationshipComponent line in the constructor, add:

```typescript
this.addComponent(new StaminaComponent({ current: agent.attributes.HT, max: agent.attributes.HT }));
```

- [ ] **Step 5: Add region field to LocationSchema**

In `src/domain/schemas/location-schema.ts`, add after `production: ProductionSchema`:

```typescript
region: z.string().regex(/^region-[a-z0-9-]+$/).nullable().default(null),
```

- [ ] **Step 6: Run typecheck + lint**

```bash
cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs
```

- [ ] **Step 7: Run full tests**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts
```

Expected: all 461 existing tests pass.

- [ ] **Step 8: Commit**

```bash
git add "01 - Projects/Project Meridian/src/domain/schemas/region-schema.ts" \
  "01 - Projects/Project Meridian/src/infrastructure/components/stamina-component.ts" \
  "01 - Projects/Project Meridian/src/domain/core/component-data.ts" \
  "01 - Projects/Project Meridian/src/infrastructure/entity/agent-actor.ts" \
  "01 - Projects/Project Meridian/src/domain/schemas/location-schema.ts"
git commit -m "feat(meridian): Phase 2 foundation — RegionSchema, StaminaComponent, JourneyState, LocationSchema region field"
```

---

### Task A2: Polygon Utilities (TDD)

**Files:**
- Create: `src/domain/core/polygon.ts`
- Create: `tests/domain/core/polygon.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/core/polygon.test.ts
import { describe, it, expect } from 'vitest';
import { pointInPolygon, polygonCentroid, type Polygon } from '../../../src/domain/core/polygon.js';

const square: Polygon = {
	vertices: [
		{ x: 0, y: 0 },
		{ x: 100, y: 0 },
		{ x: 100, y: 100 },
		{ x: 0, y: 100 },
	],
};

const triangle: Polygon = {
	vertices: [
		{ x: 50, y: 0 },
		{ x: 100, y: 100 },
		{ x: 0, y: 100 },
	],
};

const concaveL: Polygon = {
	vertices: [
		{ x: 0, y: 0 },
		{ x: 100, y: 0 },
		{ x: 100, y: 50 },
		{ x: 50, y: 50 },
		{ x: 50, y: 100 },
		{ x: 0, y: 100 },
	],
};

describe('pointInPolygon', () => {
	it('detects point inside square', () => {
		expect(pointInPolygon(50, 50, square)).toBe(true);
	});

	it('detects point outside square', () => {
		expect(pointInPolygon(150, 50, square)).toBe(false);
	});

	it('detects point inside triangle', () => {
		expect(pointInPolygon(50, 70, triangle)).toBe(true);
	});

	it('detects point outside triangle', () => {
		expect(pointInPolygon(10, 10, triangle)).toBe(false);
	});

	it('handles concave polygon — point in notch is outside', () => {
		expect(pointInPolygon(75, 75, concaveL)).toBe(false);
	});

	it('handles concave polygon — point in L-body is inside', () => {
		expect(pointInPolygon(25, 75, concaveL)).toBe(true);
	});

	it('detects point far outside', () => {
		expect(pointInPolygon(-100, -100, square)).toBe(false);
	});
});

describe('polygonCentroid', () => {
	it('computes centroid of square', () => {
		const c = polygonCentroid(square);
		expect(c.x).toBeCloseTo(50);
		expect(c.y).toBeCloseTo(50);
	});

	it('computes centroid of triangle', () => {
		const c = polygonCentroid(triangle);
		expect(c.x).toBeCloseTo(50);
		expect(c.y).toBeCloseTo(66.67, 1);
	});
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/core/polygon.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 3: Implement polygon utilities**

```typescript
// src/domain/core/polygon.ts

export interface Polygon {
	vertices: { x: number; y: number }[];
}

/** Ray-casting point-in-polygon test. */
export function pointInPolygon(px: number, py: number, polygon: Polygon): boolean {
	const { vertices } = polygon;
	let inside = false;
	for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
		const xi = vertices[i].x;
		const yi = vertices[i].y;
		const xj = vertices[j].x;
		const yj = vertices[j].y;
		const intersect = ((yi > py) !== (yj > py))
			&& (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
		if (intersect) inside = !inside;
	}
	return inside;
}

/** Compute the centroid (average of vertices) of a polygon. */
export function polygonCentroid(polygon: Polygon): { x: number; y: number } {
	const { vertices } = polygon;
	let cx = 0;
	let cy = 0;
	for (const v of vertices) {
		cx += v.x;
		cy += v.y;
	}
	return { x: cx / vertices.length, y: cy / vertices.length };
}
```

- [ ] **Step 4: Run tests to verify they pass** (9 tests)

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/core/polygon.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 5: Lint + commit**

```bash
cd "01 - Projects/Project Meridian" && npx eslint src/domain/core/polygon.ts tests/domain/core/polygon.test.ts --config configs/eslint.config.mjs
git add "01 - Projects/Project Meridian/src/domain/core/polygon.ts" "01 - Projects/Project Meridian/tests/domain/core/polygon.test.ts"
git commit -m "feat(meridian): polygon utilities with TDD — pointInPolygon, polygonCentroid"
```

---

### Task A3: Region Data Validation Tests

**Files:**
- Modify: `tests/integration/data-validation.test.ts`

- [ ] **Step 1: Add RegionSchema validation tests**

Add to `tests/integration/data-validation.test.ts`:

```typescript
import { RegionSchema } from '../../src/domain/schemas/region-schema.js';
```

Add a new describe block:

```typescript
describe('RegionSchema', () => {
	it('parses a region with polygon bounds', () => {
		const region = RegionSchema.parse({
			id: 'region-test',
			name: 'Test',
			bounds: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
		});
		expect(region.bounds).toHaveLength(3);
		expect(region.connections).toEqual([]);
		expect(region.rest_tier).toBeNull();
	});

	it('parses connections with travel_cost', () => {
		const region = RegionSchema.parse({
			id: 'region-test',
			name: 'Test',
			bounds: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
			connections: [{ regionId: 'region-other', travel_cost: 2 }],
		});
		expect(region.connections).toHaveLength(1);
		expect(region.connections[0].travel_cost).toBe(2);
	});

	it('defaults travel_cost to 1', () => {
		const region = RegionSchema.parse({
			id: 'region-test',
			name: 'Test',
			bounds: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
			connections: [{ regionId: 'region-other' }],
		});
		expect(region.connections[0].travel_cost).toBe(1);
	});

	it('rejects fewer than 3 vertices', () => {
		expect(() => RegionSchema.parse({
			id: 'region-test',
			name: 'Test',
			bounds: [{ x: 0, y: 0 }, { x: 100, y: 0 }],
		})).toThrow();
	});

	it('parses rest_tier', () => {
		const region = RegionSchema.parse({
			id: 'region-test',
			name: 'Test',
			bounds: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }],
			rest_tier: 'outdoors',
		});
		expect(region.rest_tier).toBe('outdoors');
	});
});
```

- [ ] **Step 2: Run tests**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/integration/data-validation.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/tests/integration/data-validation.test.ts"
git commit -m "test(meridian): RegionSchema validation tests"
```

---

## Chunk B: Pure Domain Functions (TDD)

All tasks in this chunk are independent — they can be done in any order or in parallel. Each produces a pure domain function with full tests.

### Task B1: buildRegionGraph + findRegionPath (A*)

**Files:**
- Create: `src/domain/systems/pathfinding.ts`
- Create: `tests/domain/systems/pathfinding.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/systems/pathfinding.test.ts
import { describe, it, expect } from 'vitest';
import { buildRegionGraph, findRegionPath } from '../../../src/domain/systems/pathfinding.js';
import type { WorldRegion } from '../../../src/domain/schemas/region-schema.js';

function makeRegion(id: string, cx: number, cy: number, connections: { regionId: string; travel_cost: number }[] = []): WorldRegion {
	const size = 50;
	return {
		id,
		name: id,
		bounds: [
			{ x: cx - size, y: cy - size },
			{ x: cx + size, y: cy - size },
			{ x: cx + size, y: cy + size },
			{ x: cx - size, y: cy + size },
		],
		connections: connections.map(c => ({ regionId: c.regionId, travel_cost: c.travel_cost })),
		rest_tier: null,
		color: '#000000',
	};
}

// Graph: A --1-- B --2-- C, A --5-- C (direct but expensive)
const regions: WorldRegion[] = [
	makeRegion('region-a', 0, 0, [
		{ regionId: 'region-b', travel_cost: 1 },
		{ regionId: 'region-c', travel_cost: 5 },
	]),
	makeRegion('region-b', 100, 0, [
		{ regionId: 'region-a', travel_cost: 1 },
		{ regionId: 'region-c', travel_cost: 2 },
	]),
	makeRegion('region-c', 200, 0, [
		{ regionId: 'region-b', travel_cost: 2 },
		{ regionId: 'region-a', travel_cost: 5 },
	]),
];

describe('buildRegionGraph', () => {
	it('creates nodes for all regions', () => {
		const graph = buildRegionGraph(regions);
		expect(graph.nodes.size).toBe(3);
		expect(graph.nodes.has('region-a')).toBe(true);
		expect(graph.nodes.has('region-b')).toBe(true);
		expect(graph.nodes.has('region-c')).toBe(true);
	});

	it('computes centroids from polygon vertices', () => {
		const graph = buildRegionGraph(regions);
		const nodeA = graph.nodes.get('region-a');
		expect(nodeA?.centroid.x).toBeCloseTo(0);
		expect(nodeA?.centroid.y).toBeCloseTo(0);
	});
});

describe('findRegionPath', () => {
	const graph = buildRegionGraph(regions);

	it('finds direct neighbor path', () => {
		const result = findRegionPath(graph, 'region-a', 'region-b');
		expect(result).not.toBeNull();
		expect(result?.path).toEqual(['region-a', 'region-b']);
		expect(result?.totalCost).toBe(1);
	});

	it('finds cheapest multi-hop path over expensive direct', () => {
		const result = findRegionPath(graph, 'region-a', 'region-c');
		expect(result).not.toBeNull();
		// A→B→C = 1+2=3, cheaper than A→C = 5
		expect(result?.path).toEqual(['region-a', 'region-b', 'region-c']);
		expect(result?.totalCost).toBe(3);
	});

	it('returns single-element path for same region', () => {
		const result = findRegionPath(graph, 'region-a', 'region-a');
		expect(result).not.toBeNull();
		expect(result?.path).toEqual(['region-a']);
		expect(result?.totalCost).toBe(0);
	});

	it('returns null for disconnected region', () => {
		const isolated = makeRegion('region-d', 500, 500, []);
		const graphWithIsolated = buildRegionGraph([...regions, isolated]);
		const result = findRegionPath(graphWithIsolated, 'region-a', 'region-d');
		expect(result).toBeNull();
	});

	it('returns null for unknown region', () => {
		const result = findRegionPath(graph, 'region-a', 'region-unknown');
		expect(result).toBeNull();
	});

	it('handles cycles without infinite loop', () => {
		// The test graph already has a cycle: A↔B↔C↔A
		const result = findRegionPath(graph, 'region-c', 'region-a');
		expect(result).not.toBeNull();
		expect(result?.path.length).toBeLessThanOrEqual(3);
	});
});
```

- [ ] **Step 2: Implement pathfinding**

```typescript
// src/domain/systems/pathfinding.ts
import { polygonCentroid } from '../core/polygon.js';
import type { WorldRegion } from '../schemas/region-schema.js';
import { distance } from '../core/math-utils.js';

export interface RegionGraphNode {
	id: string;
	centroid: { x: number; y: number };
	connections: { regionId: string; travelCost: number }[];
}

export interface RegionGraph {
	nodes: Map<string, RegionGraphNode>;
}

export interface RegionPathResult {
	path: string[];
	totalCost: number;
}

export function buildRegionGraph(regions: WorldRegion[]): RegionGraph {
	const nodes = new Map<string, RegionGraphNode>();
	for (const region of regions) {
		const centroid = polygonCentroid({ vertices: region.bounds });
		nodes.set(region.id, {
			id: region.id,
			centroid,
			connections: region.connections.map(c => ({
				regionId: c.regionId,
				travelCost: c.travel_cost,
			})),
		});
	}
	return { nodes };
}

export function findRegionPath(
	graph: RegionGraph,
	fromRegionId: string,
	toRegionId: string,
): RegionPathResult | null {
	if (!graph.nodes.has(fromRegionId) || !graph.nodes.has(toRegionId)) return null;
	if (fromRegionId === toRegionId) return { path: [fromRegionId], totalCost: 0 };

	const goalNode = graph.nodes.get(toRegionId)!;

	// A* with travel_cost weights, Euclidean heuristic
	const openSet = new Set<string>([fromRegionId]);
	const cameFrom = new Map<string, string>();
	const gScore = new Map<string, number>();
	const fScore = new Map<string, number>();

	gScore.set(fromRegionId, 0);
	const fromNode = graph.nodes.get(fromRegionId)!;
	fScore.set(fromRegionId, distance(fromNode.centroid.x, fromNode.centroid.y, goalNode.centroid.x, goalNode.centroid.y));

	while (openSet.size > 0) {
		// Find node in openSet with lowest fScore
		let current = '';
		let bestF = Infinity;
		for (const id of openSet) {
			const f = fScore.get(id) ?? Infinity;
			if (f < bestF) {
				bestF = f;
				current = id;
			}
		}

		if (current === toRegionId) {
			// Reconstruct path
			const path: string[] = [current];
			let node = current;
			while (cameFrom.has(node)) {
				node = cameFrom.get(node)!;
				path.unshift(node);
			}
			return { path, totalCost: gScore.get(toRegionId) ?? 0 };
		}

		openSet.delete(current);
		const currentNode = graph.nodes.get(current)!;

		for (const conn of currentNode.connections) {
			if (!graph.nodes.has(conn.regionId)) continue;
			const tentativeG = (gScore.get(current) ?? Infinity) + conn.travelCost;
			if (tentativeG < (gScore.get(conn.regionId) ?? Infinity)) {
				cameFrom.set(conn.regionId, current);
				gScore.set(conn.regionId, tentativeG);
				const neighbor = graph.nodes.get(conn.regionId)!;
				const h = distance(neighbor.centroid.x, neighbor.centroid.y, goalNode.centroid.x, goalNode.centroid.y);
				fScore.set(conn.regionId, tentativeG + h);
				openSet.add(conn.regionId);
			}
		}
	}

	return null; // No path found
}
```

- [ ] **Step 3: Run tests** (8 tests), lint, commit

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/pathfinding.test.ts --config configs/vitest.config.ts
npx eslint src/domain/systems/pathfinding.ts tests/domain/systems/pathfinding.test.ts --config configs/eslint.config.mjs
git add "01 - Projects/Project Meridian/src/domain/systems/pathfinding.ts" "01 - Projects/Project Meridian/tests/domain/systems/pathfinding.test.ts"
git commit -m "feat(meridian): A* pathfinding with TDD — buildRegionGraph, findRegionPath"
```

---

### Task B2: computeCrossingPoint

**Files:**
- Create: `src/domain/systems/crossing-point.ts`
- Create: `tests/domain/systems/crossing-point.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/systems/crossing-point.test.ts
import { describe, it, expect } from 'vitest';
import { computeCrossingPoint } from '../../../src/domain/systems/crossing-point.js';
import type { Polygon } from '../../../src/domain/core/polygon.js';

describe('computeCrossingPoint', () => {
	it('returns midpoint of shared edge between adjacent squares', () => {
		const left: Polygon = {
			vertices: [
				{ x: 0, y: 0 }, { x: 100, y: 0 },
				{ x: 100, y: 100 }, { x: 0, y: 100 },
			],
		};
		const right: Polygon = {
			vertices: [
				{ x: 100, y: 0 }, { x: 200, y: 0 },
				{ x: 200, y: 100 }, { x: 100, y: 100 },
			],
		};
		const cp = computeCrossingPoint(left, right);
		// Shared edge is x=100, y=0 to x=100, y=100 → midpoint (100, 50)
		expect(cp.x).toBeCloseTo(100);
		expect(cp.y).toBeCloseTo(50);
	});

	it('returns midpoint between nearest edges when regions have a gap', () => {
		const left: Polygon = {
			vertices: [
				{ x: 0, y: 0 }, { x: 90, y: 0 },
				{ x: 90, y: 100 }, { x: 0, y: 100 },
			],
		};
		const right: Polygon = {
			vertices: [
				{ x: 110, y: 0 }, { x: 200, y: 0 },
				{ x: 200, y: 100 }, { x: 110, y: 100 },
			],
		};
		const cp = computeCrossingPoint(left, right);
		// Nearest edges: right edge of left (x=90) and left edge of right (x=110)
		// Midpoints: (90, 50) and (110, 50) → crossing at (100, 50)
		expect(cp.x).toBeCloseTo(100);
		expect(cp.y).toBeCloseTo(50);
	});

	it('works with triangular regions', () => {
		const triA: Polygon = {
			vertices: [
				{ x: 0, y: 0 }, { x: 100, y: 50 }, { x: 0, y: 100 },
			],
		};
		const triB: Polygon = {
			vertices: [
				{ x: 100, y: 50 }, { x: 200, y: 0 }, { x: 200, y: 100 },
			],
		};
		const cp = computeCrossingPoint(triA, triB);
		// Nearest point between the two is around (100, 50)
		expect(cp.x).toBeCloseTo(100, 0);
		expect(cp.y).toBeCloseTo(50, 0);
	});
});
```

- [ ] **Step 2: Implement computeCrossingPoint**

```typescript
// src/domain/systems/crossing-point.ts
import type { Polygon } from '../core/polygon.js';
import { distance } from '../core/math-utils.js';

interface EdgeMidpoint {
	x: number;
	y: number;
}

function edgeMidpoint(ax: number, ay: number, bx: number, by: number): EdgeMidpoint {
	return { x: (ax + bx) / 2, y: (ay + by) / 2 };
}

/** Find the crossing point between two connected polygonal regions.
 *  Returns the midpoint between the two closest polygon edge midpoints. */
export function computeCrossingPoint(
	regionA: Polygon,
	regionB: Polygon,
): { x: number; y: number } {
	let bestDist = Infinity;
	let bestMidA: EdgeMidpoint = { x: 0, y: 0 };
	let bestMidB: EdgeMidpoint = { x: 0, y: 0 };

	const edgesA = getEdges(regionA);
	const edgesB = getEdges(regionB);

	for (const eA of edgesA) {
		for (const eB of edgesB) {
			const d = distance(eA.x, eA.y, eB.x, eB.y);
			if (d < bestDist) {
				bestDist = d;
				bestMidA = eA;
				bestMidB = eB;
			}
		}
	}

	return {
		x: (bestMidA.x + bestMidB.x) / 2,
		y: (bestMidA.y + bestMidB.y) / 2,
	};
}

function getEdges(polygon: Polygon): EdgeMidpoint[] {
	const { vertices } = polygon;
	const edges: EdgeMidpoint[] = [];
	for (let i = 0; i < vertices.length; i++) {
		const j = (i + 1) % vertices.length;
		edges.push(edgeMidpoint(vertices[i].x, vertices[i].y, vertices[j].x, vertices[j].y));
	}
	return edges;
}
```

- [ ] **Step 3: Run tests** (3 tests), lint, commit

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/crossing-point.test.ts --config configs/vitest.config.ts
npx eslint src/domain/systems/crossing-point.ts tests/domain/systems/crossing-point.test.ts --config configs/eslint.config.mjs
git add "01 - Projects/Project Meridian/src/domain/systems/crossing-point.ts" "01 - Projects/Project Meridian/tests/domain/systems/crossing-point.test.ts"
git commit -m "feat(meridian): computeCrossingPoint with TDD — polygon edge midpoint proximity"
```

---

### Task B3: resolveSteeringOffset (Obstacle Avoidance)

**Files:**
- Create: `src/domain/systems/steering.ts`
- Create: `tests/domain/systems/steering.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/domain/systems/steering.test.ts
import { describe, it, expect } from 'vitest';
import { resolveSteeringOffset, type Obstacle } from '../../../src/domain/systems/steering.js';

describe('resolveSteeringOffset', () => {
	it('returns original target when path is clear', () => {
		const result = resolveSteeringOffset(0, 0, 100, 0, [], 14);
		expect(result.x).toBe(100);
		expect(result.y).toBe(0);
	});

	it('steers around obstacle blocking direct path', () => {
		const obstacle: Obstacle = { x: 50, y: 0, radius: 20 };
		const result = resolveSteeringOffset(0, 0, 100, 0, [obstacle], 14);
		// Should not be the original target
		expect(result.y).not.toBeCloseTo(0, 0);
		// Should still be roughly toward the target
		expect(result.x).toBeGreaterThan(0);
	});

	it('does not steer when obstacle is far from path', () => {
		const obstacle: Obstacle = { x: 50, y: 200, radius: 20 };
		const result = resolveSteeringOffset(0, 0, 100, 0, [obstacle], 14);
		expect(result.x).toBe(100);
		expect(result.y).toBe(0);
	});

	it('handles obstacle directly on agent position', () => {
		const obstacle: Obstacle = { x: 0, y: 0, radius: 20 };
		const result = resolveSteeringOffset(0, 0, 100, 0, [obstacle], 14);
		// Should still produce a valid target
		expect(typeof result.x).toBe('number');
		expect(typeof result.y).toBe('number');
	});

	it('avoids closest blocking obstacle when multiple exist', () => {
		const obstacles: Obstacle[] = [
			{ x: 50, y: 0, radius: 20 },
			{ x: 80, y: 0, radius: 20 },
		];
		const result = resolveSteeringOffset(0, 0, 100, 0, obstacles, 14);
		expect(result.y).not.toBeCloseTo(0, 0);
	});

	it('returns original target when no obstacles provided', () => {
		const result = resolveSteeringOffset(10, 20, 90, 80, [], 14);
		expect(result.x).toBe(90);
		expect(result.y).toBe(80);
	});
});
```

- [ ] **Step 2: Implement steering**

```typescript
// src/domain/systems/steering.ts
import { distance } from '../core/math-utils.js';

export interface Obstacle {
	x: number;
	y: number;
	radius: number;
}

/** Check if a line segment from (ax,ay) to (bx,by) intersects a circle at (cx,cy) with given radius. */
function lineIntersectsCircle(
	ax: number, ay: number,
	bx: number, by: number,
	cx: number, cy: number,
	combinedRadius: number,
): boolean {
	const dx = bx - ax;
	const dy = by - ay;
	const fx = ax - cx;
	const fy = ay - cy;
	const a = dx * dx + dy * dy;
	if (a === 0) return distance(ax, ay, cx, cy) < combinedRadius;
	const b = 2 * (fx * dx + fy * dy);
	const c = fx * fx + fy * fy - combinedRadius * combinedRadius;
	const discriminant = b * b - 4 * a * c;
	if (discriminant < 0) return false;
	const sqrtD = Math.sqrt(discriminant);
	const t1 = (-b - sqrtD) / (2 * a);
	const t2 = (-b + sqrtD) / (2 * a);
	return (t1 >= 0 && t1 <= 1) || (t2 >= 0 && t2 <= 1) || (t1 < 0 && t2 > 1);
}

export function resolveSteeringOffset(
	agentX: number,
	agentY: number,
	targetX: number,
	targetY: number,
	obstacles: Obstacle[],
	agentRadius: number,
): { x: number; y: number } {
	if (obstacles.length === 0) return { x: targetX, y: targetY };

	// Find closest blocking obstacle
	let closestDist = Infinity;
	let blocker: Obstacle | null = null;

	for (const obs of obstacles) {
		const combinedRadius = obs.radius + agentRadius;
		if (!lineIntersectsCircle(agentX, agentY, targetX, targetY, obs.x, obs.y, combinedRadius)) continue;
		const d = distance(agentX, agentY, obs.x, obs.y);
		if (d < closestDist) {
			closestDist = d;
			blocker = obs;
		}
	}

	if (blocker === null) return { x: targetX, y: targetY };

	// Steer perpendicular to the agent→target line, away from the obstacle
	const dx = targetX - agentX;
	const dy = targetY - agentY;
	const len = Math.sqrt(dx * dx + dy * dy);
	if (len === 0) return { x: targetX, y: targetY };

	// Perpendicular vector (normalized)
	const perpX = -dy / len;
	const perpY = dx / len;

	// Choose the side that moves away from the obstacle
	const toObsX = blocker.x - agentX;
	const toObsY = blocker.y - agentY;
	const dot = toObsX * perpX + toObsY * perpY;
	const sign = dot >= 0 ? -1 : 1;

	const steerAmount = blocker.radius + agentRadius;
	return {
		x: targetX + sign * perpX * steerAmount,
		y: targetY + sign * perpY * steerAmount,
	};
}
```

- [ ] **Step 3: Run tests** (6 tests), lint, commit

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/domain/systems/steering.test.ts --config configs/vitest.config.ts
npx eslint src/domain/systems/steering.ts tests/domain/systems/steering.test.ts --config configs/eslint.config.mjs
git add "01 - Projects/Project Meridian/src/domain/systems/steering.ts" "01 - Projects/Project Meridian/tests/domain/systems/steering.test.ts"
git commit -m "feat(meridian): resolveSteeringOffset with TDD — obstacle avoidance"
```

---

## Chunk C: Region Data + Location Updates

Depends on Chunk A (RegionSchema).

### Task C1: Create Region JSON Files

**Files:**
- Create: `regions/market-square.json`
- Create: `regions/farmlands.json`
- Create: `regions/craft-quarter.json`
- Create: `regions/residential.json`

Current location positions for reference:
- Market (200, 150), Tavern (300, 200), Town Square (400, 250) — center
- Farm (100, 100) — top-left
- Workshop (150, 350) — bottom-left
- Bakery (350, 350) — bottom-right

- [ ] **Step 1: Create region files**

Design regions as polygons that contain their locations with ~50px padding:

`regions/market-square.json`:
```json
{
	"id": "region-market-square",
	"name": "Market Square",
	"bounds": [
		{ "x": 150, "y": 100 },
		{ "x": 450, "y": 100 },
		{ "x": 450, "y": 300 },
		{ "x": 150, "y": 300 }
	],
	"connections": [
		{ "regionId": "region-farmlands", "travel_cost": 2 },
		{ "regionId": "region-craft-quarter", "travel_cost": 1 },
		{ "regionId": "region-residential", "travel_cost": 1 }
	],
	"color": "#2a2a4a"
}
```

`regions/farmlands.json`:
```json
{
	"id": "region-farmlands",
	"name": "Farmlands",
	"bounds": [
		{ "x": 30, "y": 30 },
		{ "x": 200, "y": 30 },
		{ "x": 200, "y": 150 },
		{ "x": 30, "y": 150 }
	],
	"connections": [
		{ "regionId": "region-market-square", "travel_cost": 2 }
	],
	"color": "#3a5a2a"
}
```

`regions/craft-quarter.json`:
```json
{
	"id": "region-craft-quarter",
	"name": "Craft Quarter",
	"bounds": [
		{ "x": 80, "y": 280 },
		{ "x": 250, "y": 280 },
		{ "x": 250, "y": 420 },
		{ "x": 80, "y": 420 }
	],
	"connections": [
		{ "regionId": "region-market-square", "travel_cost": 1 },
		{ "regionId": "region-residential", "travel_cost": 2 }
	],
	"color": "#5a4a3a"
}
```

`regions/residential.json`:
```json
{
	"id": "region-residential",
	"name": "Residential",
	"bounds": [
		{ "x": 280, "y": 280 },
		{ "x": 450, "y": 280 },
		{ "x": 450, "y": 420 },
		{ "x": 280, "y": 420 }
	],
	"connections": [
		{ "regionId": "region-market-square", "travel_cost": 1 },
		{ "regionId": "region-craft-quarter", "travel_cost": 2 }
	],
	"color": "#4a3a5a"
}
```

- [ ] **Step 2: Update location JSON files with region field**

Add `"region"` field to each location file:
- `locations/market.json`: `"region": "region-market-square"`
- `locations/tavern.json`: `"region": "region-market-square"`
- `locations/town-square.json`: `"region": "region-market-square"`
- `locations/farm.json`: `"region": "region-farmlands"`
- `locations/workshop.json`: `"region": "region-craft-quarter"`
- `locations/bakery.json`: `"region": "region-residential"`

- [ ] **Step 3: Run data validation tests**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/integration/data-validation.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/regions/" "01 - Projects/Project Meridian/locations/"
git commit -m "feat(meridian): region data — 4 polygonal regions, location region assignments"
```

---

## Chunk D: Infrastructure Integration

Depends on Chunks A (schema, components), B (pure functions), and C (data).

### Task D1: World-Loader — Load Regions + Build Graph

**Files:**
- Modify: `src/infrastructure/engine/world-loader.ts`

- [ ] **Step 1: Read world-loader.ts and understand the loading pattern**

The loader uses `VaultReader` to list + read files, then parses with Zod schemas. Follow the same pattern for regions.

- [ ] **Step 2: Add region loading**

Add import for `RegionSchema` and `buildRegionGraph`. Add a `loadRegions` step in the load sequence. Add `regions: WorldRegion[]` and `regionGraph: RegionGraph` to the `WorldData` interface.

Load from `03 - Resources/Regions` (or `regions/` — check where other data is loaded from and follow the same path convention).

Validate each location's position falls within its declared region polygon using `pointInPolygon`. Log warnings for mismatches.

- [ ] **Step 3: Run typecheck + existing tests**

```bash
cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/world-loader.ts"
git commit -m "feat(meridian): world-loader — load regions, build region graph, validate locations"
```

---

### Task D2: BehaviorTreeSystem — Journey Detection

**Files:**
- Modify: `src/infrastructure/systems/behavior-tree-system.ts`

- [ ] **Step 1: Add journey computation to BT system**

When the BT resolves a movement target in a different region:
1. Import `pointInPolygon`, `findRegionPath`, `computeCrossingPoint`, `RegionGraph`, `WorldRegion`
2. Add `getRegions?: () => WorldRegion[]` and `regionGraph?: RegionGraph` to `createBehaviorTreeSystem` parameters (optional for backward compat)
3. After resolving movementTarget, determine agent's region (check blackboard `currentRegion`, fall back to `pointInPolygon`)
4. Determine target's region (for location targets, use the location's `region` field)
5. If different regions: compute journey via `findRegionPath` + `computeCrossingPoint`, store on blackboard, set movementTarget to first crossing point

- [ ] **Step 2: Run typecheck + full tests**

```bash
cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx vitest run --config configs/vitest.config.ts
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/behavior-tree-system.ts"
git commit -m "feat(meridian): BT system — cross-region journey detection, A* path + waypoints"
```

---

### Task D3: MovementSystem — Waypoint Following + Stamina + Steering

**Files:**
- Modify: `src/infrastructure/systems/movement-system.ts`
- Create: `tests/infrastructure/systems/movement-journey.test.ts`

- [ ] **Step 1: Write journey integration tests**

Test cases:
1. Agent with journey waypoints walks to crossing point, then advances to next waypoint
2. Stamina deducted on region crossing (StaminaComponent.state.current decreases by travelCost)
3. Agent halts when stamina reaches 0 mid-journey (journey cleared, movement stopped)
4. RegionEntered event emitted on crossing
5. Agent's blackboard `currentRegion` updated on crossing
6. Obstacle steering adjusts velocity when stationary agent blocks path

- [ ] **Step 2: Implement MovementSystem changes**

Add imports for `StaminaComponent`, `resolveSteeringOffset`, `JourneyState`.

In the arrival logic, check if the arrived target is a journey waypoint (compare against `journey.waypoints[journey.waypointIndex].crossingPoint`):
- If waypoint arrival: deduct stamina, emit RegionEntered, advance or halt
- If final destination: existing arrival spread logic

For steering: before setting velocity, collect stationary obstacles (agents with `atLocation` set + location positions), call `resolveSteeringOffset`, use adjusted target for velocity calculation.

Update `createMovementSystem` signature to accept `getLocations` for obstacle positions (already available from existing parameter).

- [ ] **Step 3: Run all tests**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run --config configs/vitest.config.ts
```

- [ ] **Step 4: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/systems/movement-system.ts" \
  "01 - Projects/Project Meridian/tests/infrastructure/systems/movement-journey.test.ts"
git commit -m "feat(meridian): MovementSystem — waypoint following, stamina deduction, steering"
```

---

### Task D4: Game-View Wiring

**Files:**
- Modify: `src/infrastructure/engine/game-view.ts`

- [ ] **Step 1: Wire regions to systems**

In `populateScene()`:
- Pass `world.regions` and `world.regionGraph` to `createBehaviorTreeSystem` (new optional params)
- The MovementSystem already has `getLocations` — add obstacle collection logic using agents + locations

Update the `createBehaviorTreeSystem` call:
```typescript
tickRunner.register(createBehaviorTreeSystem(
	getAgents, world.btDefinitions, getWorldEntity, Date.now(),
	getLocationActors, getLocations,
	world.regions, world.regionGraph,
));
```

- [ ] **Step 2: Run typecheck + lint + full tests**

```bash
cd "01 - Projects/Project Meridian" && npx tsc --noEmit --project configs/tsconfig.json && npx eslint src/ tests/ --config configs/eslint.config.mjs && npx vitest run --config configs/vitest.config.ts
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/src/infrastructure/engine/game-view.ts"
git commit -m "feat(meridian): game-view wiring — regions + graph passed to BT system"
```

---

## Chunk E: Integration Tests + Full Verification

Depends on all previous chunks.

### Task E1: Region Integration Test

**Files:**
- Create: `tests/integration/region-integration.test.ts`

- [ ] **Step 1: Write integration test**

Test the full journey flow:
1. Create 3 regions (A, B, C in a line) with connections
2. Create an agent in region A, a location in region C
3. Build region graph, compute journey
4. Verify journey has 2 waypoints (A→B crossing, B→C crossing)
5. Simulate movement ticks — verify agent advances through waypoints
6. Verify stamina deducted at each crossing
7. Verify RegionEntered events emitted
8. Verify agent arrives at final destination

- [ ] **Step 2: Run integration test**

```bash
cd "01 - Projects/Project Meridian" && npx vitest run tests/integration/region-integration.test.ts --config configs/vitest.config.ts
```

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/tests/integration/region-integration.test.ts"
git commit -m "test(meridian): region integration — full journey A→B→C with stamina + events"
```

---

### Task E2: Full Verification

- [ ] **Step 1: Run complete quality gates**

```bash
cd "01 - Projects/Project Meridian"
npx tsc --noEmit --project configs/tsconfig.json
npx eslint src/ tests/ --config configs/eslint.config.mjs
npx vitest run --config configs/vitest.config.ts
npm run build
```

Expected: 0 errors, all tests pass (existing + 30+ new), build succeeds.

- [ ] **Step 2: Verify exit criteria**

| # | Criterion | Evidence |
|---|-----------|----------|
| 1 | Agent travels region A→B via waypoint chain | region-integration.test.ts |
| 2 | Stamina decremented on crossing | movement-journey.test.ts |
| 3 | Agent halts on stamina=0 | movement-journey.test.ts |
| 4 | A* finds shortest path | pathfinding.test.ts |
| 5 | Agents steer around obstacles | steering.test.ts |
| 6 | pointInPolygon determines region | polygon.test.ts |
| 7 | position.region updated on crossing | movement-journey.test.ts |
| 8 | World-loader loads regions | full test suite (smoke test) |
| 9 | Same-region movement unchanged | existing movement tests pass |
| 10 | PerceptionSystem regression | existing perception tests pass |
| 11 | DayNightSystem regression | existing day-night tests pass |

- [ ] **Step 3: Commit**

```bash
git add "01 - Projects/Project Meridian/"
git commit -m "feat(meridian): Phase 2 Spatial complete — regions, A* pathfinding, stamina, steering"
```

---

## Summary

| Chunk | Tasks | New Files | Modified Files | Estimated Tests |
|-------|-------|-----------|----------------|-----------------|
| A: Foundation | A1-A3 | 4 | 4 | 14 |
| B: Pure Domain Functions | B1-B3 | 6 | 0 | 17 |
| C: Region Data | C1 | 4 | 6 | 0 |
| D: Infrastructure | D1-D4 | 1 | 4 | 6 |
| E: Integration + Verify | E1-E2 | 1 | 0 | 1 |
| **Total** | **13 tasks** | **16 files** | **14 files** | **~38 tests** |

**Dependency chain:** A → B (independent) + C (depends on A) → D (depends on A+B+C) → E (depends on all)
