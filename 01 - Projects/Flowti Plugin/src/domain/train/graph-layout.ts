/**
 * Pure graph-layout functions for Train Timeline rendering.
 *
 * Extracted from TrainTimelineSidebar so both the legacy ItemView
 * and the new Lit component can share the layout computation.
 */

import type { ThoughtNode, TrainState } from "./types";

/** A single row in the computed graph layout. */
export interface GraphRow {
	thought: ThoughtNode;
	/** Lane index (0 = main chain, 1+ = branch depth). */
	lane: number;
	/** Snapshot of which lanes are active at this row, keyed by lane index to CSS color. */
	activeLanes: Map<number, string>;
	/** True for the first node of a branch chain (shows fork connector). */
	isBranchStart: boolean;
	/** Lane of the parent that forked this branch. */
	parentLane: number;
}

/** CSS color values for each graph lane. Defined via custom properties with hex fallbacks. */
export const LANE_COLORS = [
	"var(--ft-lane-0)",
	"var(--ft-lane-1)",
	"var(--ft-lane-2)",
	"var(--ft-lane-3)",
	"var(--ft-lane-4)",
	"var(--ft-lane-5)",
];

/** Width of each lane column in pixels. */
export const LANE_WIDTH = 20;

/**
 * Compute graph layout rows by walking the train thought graph.
 *
 * Pure function -- walks "next" chains at the same lane and "branch" forks
 * at lane+1. Collapsed nodes suppress their branch children.
 *
 * Returns rows in top-to-bottom (root-first) order. The caller should
 * reverse the array for bottom-to-top rendering.
 */
export function computeGraphLayout(
	timeline: ThoughtNode[],
	train: TrainState,
	getBranches: (trainId: string, thoughtId: string) => ThoughtNode[],
	collapsedNodes: Set<string>,
): GraphRow[] {
	const rows: GraphRow[] = [];
	const activeLanes = new Map<number, string>();

	function walk(
		start: ThoughtNode,
		lane: number,
		isBranchStart: boolean,
		parentLane: number,
	): void {
		let current: ThoughtNode | null = start;
		const visited = new Set<string>();
		let isFirst = true;

		activeLanes.set(lane, LANE_COLORS[lane % LANE_COLORS.length]);

		while (current && !visited.has(current.id)) {
			visited.add(current.id);

			rows.push({
				thought: current,
				lane,
				activeLanes: new Map(activeLanes),
				isBranchStart: isFirst && isBranchStart,
				parentLane,
			});
			isFirst = false;

			// Recurse into branches (unless collapsed or depth capped)
			if (!collapsedNodes.has(current.id) && lane < 5) {
				const branches = getBranches(train.id, current.id);
				for (const branch of branches) {
					walk(branch, lane + 1, true, lane);
				}
			}

			// Follow the "next" chain at the same lane
			const nextRel = train.relations.find(
				(r) => r.fromId === current!.id && r.direction === "next",
			);
			current = nextRel
				? train.thoughts.find((t) => t.id === nextRel.toId) ?? null
				: null;
		}

		// Close lane when branch ends (main chain at lane 0 stays open)
		if (lane > 0) {
			activeLanes.delete(lane);
		}
	}

	if (timeline.length > 0) {
		walk(timeline[0], 0, false, 0);
	}

	return rows;
}
