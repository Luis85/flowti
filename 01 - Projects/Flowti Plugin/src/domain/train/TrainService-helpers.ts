/**
 * TrainService helper functions — merge logic and navigation links.
 *
 * Extracted from TrainService.ts to stay under max-lines.
 */

import type { TrainState } from "./types";

/**
 * Check if a branch is already merged by walking forward from sourceId.
 */
export function isBranchAlreadyMerged(train: TrainState, sourceId: string, nextMap: Map<string, string>): boolean {
	const mergedSources = new Set(
		train.relations.filter((r) => r.direction === "merge").map((r) => r.fromId),
	);
	let fwd = sourceId;
	const visited = new Set<string>();
	while (fwd) {
		if (visited.has(fwd)) break;
		visited.add(fwd);
		if (mergedSources.has(fwd)) return true;
		fwd = nextMap.get(fwd) ?? "";
	}
	return false;
}

/**
 * Compute the set of thought IDs on the main chain (root -> head via "next" edges).
 */
export function computeMainChainIds(train: TrainState): Set<string> {
	if (train.thoughts.length === 0) return new Set();

	const nextMap = new Map<string, string>();
	const incomingNext = new Set<string>();
	for (const r of train.relations) {
		if (r.direction === "next") {
			nextMap.set(r.fromId, r.toId);
			incomingNext.add(r.toId);
		}
	}

	const root = train.thoughts.find((t) => !incomingNext.has(t.id)) ?? train.thoughts[0];
	const mainIds = new Set<string>([root.id]);
	let current = root.id;
	while (nextMap.has(current)) {
		current = nextMap.get(current)!;
		mainIds.add(current);
	}
	return mainIds;
}

/**
 * Check if targetId is reachable from sourceId via forward edges (next/branch).
 * Merge edges are NOT followed.
 */
export function isReachable(train: TrainState, sourceId: string, targetId: string): boolean {
	const visited = new Set<string>();
	const stack = [sourceId];

	const adj = new Map<string, string[]>();
	for (const r of train.relations) {
		if (r.direction === "next" || r.direction === "branch") {
			const list = adj.get(r.fromId) ?? [];
			list.push(r.toId);
			adj.set(r.fromId, list);
		}
	}

	while (stack.length > 0) {
		const current = stack.pop()!;
		if (current === targetId) return true;
		if (visited.has(current)) continue;
		visited.add(current);
		for (const neighbor of adj.get(current) ?? []) {
			stack.push(neighbor);
		}
	}
	return false;
}

/** Extract file basename without extension from a vault path. */
export function basenameFromPath(path: string): string {
	const filename = path.split("/").pop() ?? path;
	return filename.replace(/\.md$/, "");
}

/**
 * Build the navigation wikilink lists for a thought from the train's relations.
 */
export function buildNavLinks(
	train: TrainState,
	thoughtId: string,
): Record<string, string[]> {
	const thoughtById = new Map(train.thoughts.map((t) => [t.id, t]));
	const next: string[] = [];
	const prev: string[] = [];
	const up: string[] = [];
	const down: string[] = [];
	const mergeTarget: string[] = [];
	const mergedFrom: string[] = [];

	for (const r of train.relations) {
		if (r.fromId === thoughtId) {
			const child = thoughtById.get(r.toId);
			if (!child) continue;
			const link = `[[${basenameFromPath(child.path)}]]`;
			if (r.direction === "next") next.push(link);
			else if (r.direction === "branch") up.push(link);
			else if (r.direction === "merge") mergeTarget.push(link);
		} else if (r.toId === thoughtId) {
			const parent = thoughtById.get(r.fromId);
			if (!parent) continue;
			const link = `[[${basenameFromPath(parent.path)}]]`;
			if (r.direction === "next") prev.push(link);
			else if (r.direction === "branch") down.push(link);
			else if (r.direction === "merge") mergedFrom.push(link);
		}
	}

	return { next, prev, up, down, "merge-target": mergeTarget, "merged-from": mergedFrom };
}
