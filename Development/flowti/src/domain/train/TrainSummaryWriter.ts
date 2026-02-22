/**
 * TrainSummaryWriter — Pure function that generates a markdown summary document
 * from a completed train's state.
 *
 * The summary includes YAML frontmatter with metadata and sections for stats,
 * timeline (with branch annotations), branches, and merges.
 */

import type { TrainState, ThoughtNode, ThoughtRelation } from "./types";

/**
 * Generate a structured markdown summary for a completed train.
 *
 * @param train - The train state to summarize.
 * @returns Markdown string with YAML frontmatter + content sections.
 */
export function generateTrainSummary(train: TrainState): string {
	const lines: string[] = [];

	// ── Compute graph metrics ──────────────────────────────────
	const mainChainIds = computeMainChainIds(train);
	const branchThoughts = train.thoughts.filter((t) => !mainChainIds.has(t.id));
	const merges = train.relations.filter((r) => r.direction === "merge");
	const branchRelations = train.relations.filter((r) => r.direction === "branch");
	const duration = computeDurationMinutes(train);

	// ── Frontmatter ────────────────────────────────────────────
	lines.push("---");
	lines.push(`type: TrainSummary`);
	lines.push(`train: "${escapeFrontmatter(train.title)}"`);
	lines.push(`status: ${train.status}`);
	lines.push(`thoughts: ${train.thoughts.length}`);
	lines.push(`branches: ${branchRelations.length}`);
	lines.push(`merges: ${merges.length}`);
	lines.push(`duration: ${duration}`);
	lines.push(`created: ${train.createdAt}`);
	lines.push(`completed: ${train.completedAt ?? ""}`);
	lines.push("---");
	lines.push("");

	// ── Heading ────────────────────────────────────────────────
	lines.push(`# Train Summary: ${train.title}`);
	lines.push("");

	// ── Stats ──────────────────────────────────────────────────
	lines.push("## Stats");
	lines.push(`- **Duration:** ${duration} minutes`);
	lines.push(`- **Thoughts:** ${train.thoughts.length} (${mainChainIds.size} main + ${branchThoughts.length} branched)`);
	lines.push(`- **Merges:** ${merges.length}`);
	lines.push("");

	// ── Timeline ───────────────────────────────────────────────
	if (train.thoughts.length > 0) {
		lines.push("## Timeline");
		const timeline = computeTimeline(train);
		const branchMap = computeBranchMap(train);

		for (let i = 0; i < timeline.length; i++) {
			const t = timeline[i];
			const time = formatTime(t.createdAt);
			const suffix = i === 0 ? " — root" : "";
			lines.push(`${i + 1}. [[${t.title}]] (${time})${suffix}`);

			// Show branch children inline
			const branches = branchMap.get(t.id);
			if (branches) {
				for (const b of branches) {
					lines.push(`   - ↗ [[${b.title}]] (${formatTime(b.createdAt)})`);
				}
			}
		}
		lines.push("");
	}

	// ── Branches ───────────────────────────────────────────────
	if (branchRelations.length > 0) {
		lines.push("## Branches");
		const thoughtById = new Map(train.thoughts.map((t) => [t.id, t]));
		const grouped = groupBranchRelations(branchRelations, thoughtById);

		for (const [originTitle, childTitles] of grouped) {
			lines.push(`- Branch from "[[${originTitle}]]": ${childTitles.map((t) => `[[${t}]]`).join(", ")}`);
		}
		lines.push("");
	}

	// ── Merges ─────────────────────────────────────────────────
	if (merges.length > 0) {
		lines.push("## Merges");
		const thoughtById = new Map(train.thoughts.map((t) => [t.id, t]));
		for (const m of merges) {
			const source = thoughtById.get(m.fromId);
			const target = thoughtById.get(m.toId);
			if (source && target) {
				lines.push(`- [[${source.title}]] → [[${target.title}]]`);
			}
		}
		lines.push("");
	}

	return lines.join("\n");
}

// ── Internal helpers ──────────────────────────────────────────

/** Compute the set of thought IDs on the main chain (root → head via "next" edges). */
function computeMainChainIds(train: TrainState): Set<string> {
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
	const ids = new Set<string>([root.id]);
	let current = root.id;
	while (nextMap.has(current)) {
		current = nextMap.get(current)!;
		ids.add(current);
	}
	return ids;
}

/** Walk the main "next" chain from root to head. */
function computeTimeline(train: TrainState): ThoughtNode[] {
	if (train.thoughts.length === 0) return [];

	const nextMap = new Map<string, string>();
	const incomingNext = new Set<string>();
	for (const r of train.relations) {
		if (r.direction === "next") {
			nextMap.set(r.fromId, r.toId);
			incomingNext.add(r.toId);
		}
	}

	const root = train.thoughts.find((t) => !incomingNext.has(t.id)) ?? train.thoughts[0];
	const thoughtById = new Map(train.thoughts.map((t) => [t.id, t]));
	const timeline: ThoughtNode[] = [root];
	let current = root.id;
	while (nextMap.has(current)) {
		const nextId = nextMap.get(current)!;
		const next = thoughtById.get(nextId);
		if (!next) break;
		timeline.push(next);
		current = nextId;
	}
	return timeline;
}

/** Build a map: parentId → branch children. */
function computeBranchMap(train: TrainState): Map<string, ThoughtNode[]> {
	const thoughtById = new Map(train.thoughts.map((t) => [t.id, t]));
	const map = new Map<string, ThoughtNode[]>();

	for (const r of train.relations) {
		if (r.direction === "branch") {
			const child = thoughtById.get(r.toId);
			if (!child) continue;
			const list = map.get(r.fromId) ?? [];
			list.push(child);
			map.set(r.fromId, list);
		}
	}
	return map;
}

/** Group branch relations by origin thought title. */
function groupBranchRelations(
	branchRelations: ThoughtRelation[],
	thoughtById: Map<string, ThoughtNode>,
): Map<string, string[]> {
	const grouped = new Map<string, string[]>();
	for (const r of branchRelations) {
		const origin = thoughtById.get(r.fromId);
		const child = thoughtById.get(r.toId);
		if (!origin || !child) continue;
		const list = grouped.get(origin.title) ?? [];
		list.push(child.title);
		grouped.set(origin.title, list);
	}
	return grouped;
}

/** Compute duration in minutes from createdAt → completedAt (or now). */
function computeDurationMinutes(train: TrainState): number {
	const start = new Date(train.createdAt).getTime();
	const end = train.completedAt ? new Date(train.completedAt).getTime() : Date.now();
	return Math.round((end - start) / 60_000);
}

/** Format ISO timestamp to HH:MM (UTC). */
function formatTime(iso: string): string {
	const d = new Date(iso);
	return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}

/** Escape double quotes in frontmatter values. */
function escapeFrontmatter(value: string): string {
	return value.replace(/"/g, '\\"');
}
