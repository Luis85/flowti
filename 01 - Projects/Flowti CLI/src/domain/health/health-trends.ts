/**
 * health-trends.ts — Health snapshot persistence and trend analysis.
 *
 * Stores timestamped health snapshots as JSON files and computes
 * deltas between consecutive snapshots for trend indicators.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { clock } from "../../infrastructure/clock.js";
import type { HealthSnapshot } from "./health.js";
import type { HealthScore } from "./health-scoring.js";

// ── Types ────────────────────────────────────────────────────────────

export interface StoredSnapshot {
	timestamp: string;
	snapshot: HealthSnapshot;
	score: HealthScore;
}

export interface TrendDelta {
	metric: string;
	previous: number;
	current: number;
	delta: number;
	/** "▲", "▼", or "─" */
	indicator: string;
}

export interface HealthTrend {
	current: StoredSnapshot;
	previous: StoredSnapshot | null;
	deltas: TrendDelta[];
}

// ── Persistence ─────────────────────────────────────────────────────

const HISTORY_DIR = "health";
const MAX_SNAPSHOTS = 30;

function historyDir(projectPath: string): string {
	return paths.join(projectPath, "reports", HISTORY_DIR);
}

/** Save a health snapshot + score to the history directory. */
export function saveSnapshot(projectPath: string, snapshot: HealthSnapshot, score: HealthScore): string {
	const dir = historyDir(projectPath);
	disk.mkdirSync(dir, { recursive: true });

	const entry: StoredSnapshot = {
		timestamp: clock.iso(),
		snapshot,
		score,
	};

	const safeTs = clock.safeIso();
	const filePath = paths.join(dir, `${safeTs}-health.json`);
	disk.writeFileSync(filePath, JSON.stringify(entry, null, 2), "utf-8");

	// Trim old snapshots if over limit
	trimHistory(dir);

	return filePath;
}

function trimHistory(dir: string): void {
	const files = listSnapshotFiles(dir);
	if (files.length <= MAX_SNAPSHOTS) return;

	const toRemove = files.slice(MAX_SNAPSHOTS);
	for (const file of toRemove) {
		try { disk.rmSync(paths.join(dir, file)); } catch { /* ignore */ }
	}
}

/** List snapshot files sorted by name descending (most recent first). */
function listSnapshotFiles(dir: string): string[] {
	if (!disk.existsSync(dir)) return [];
	return disk.readdirSync(dir)
		.filter((f) => f.endsWith("-health.json"))
		.sort()
		.reverse();
}

/** Load all stored snapshots (most recent first). */
export function loadHistory(projectPath: string): StoredSnapshot[] {
	const dir = historyDir(projectPath);
	const files = listSnapshotFiles(dir);
	const entries: StoredSnapshot[] = [];

	for (const file of files) {
		try {
			const raw = JSON.parse(disk.readFileSync(paths.join(dir, file), "utf-8")) as StoredSnapshot;
			entries.push(raw);
		} catch { /* skip corrupt entries */ }
	}

	return entries;
}

// ── Delta computation ───────────────────────────────────────────────

function delta(metric: string, prev: number | undefined, curr: number | undefined): TrendDelta | null {
	if (prev === undefined || curr === undefined) return null;
	const d = curr - prev;
	const indicator = d > 0 ? "▲" : d < 0 ? "▼" : "─";
	return { metric, previous: prev, current: curr, delta: d, indicator };
}

function testDeltas(cs: HealthSnapshot, ps: HealthSnapshot): TrendDelta[] {
	if (!cs.tests || !ps.tests) return [];
	return [
		delta("tests.total", ps.tests.total, cs.tests.total),
		delta("tests.passed", ps.tests.passed, cs.tests.passed),
		delta("tests.failed", ps.tests.failed, cs.tests.failed),
	].filter((d): d is TrendDelta => d !== null);
}

function coverageDeltas(cs: HealthSnapshot, ps: HealthSnapshot): TrendDelta[] {
	if (!cs.coverage || !ps.coverage) return [];
	return [
		delta("coverage.lines", ps.coverage.lines, cs.coverage.lines),
		delta("coverage.branches", ps.coverage.branches, cs.coverage.branches),
		delta("coverage.functions", ps.coverage.functions, cs.coverage.functions),
	].filter((d): d is TrendDelta => d !== null);
}

function lintDeltas(cs: HealthSnapshot, ps: HealthSnapshot): TrendDelta[] {
	if (!cs.lint || !ps.lint) return [];
	return [
		delta("lint.errors", ps.lint.errors, cs.lint.errors),
		delta("lint.warnings", ps.lint.warnings, cs.lint.warnings),
	].filter((d): d is TrendDelta => d !== null);
}

/** Compute deltas between two snapshots. */
export function computeDeltas(current: StoredSnapshot, previous: StoredSnapshot): TrendDelta[] {
	const deltas: TrendDelta[] = [];
	const cs = current.snapshot;
	const ps = previous.snapshot;

	const d0 = delta("score.overall", previous.score.overall, current.score.overall);
	if (d0) deltas.push(d0);

	deltas.push(...testDeltas(cs, ps));
	deltas.push(...coverageDeltas(cs, ps));

	if (cs.build && ps.build) {
		const d = delta("build.duration", ps.build.durationMs, cs.build.durationMs);
		if (d) deltas.push(d);
	}

	deltas.push(...lintDeltas(cs, ps));

	const dc = delta("components", ps.components, cs.components);
	if (dc) deltas.push(dc);

	return deltas.filter((d) => d.delta !== 0);
}

/** Build a full trend analysis from the current snapshot and history. */
export function buildTrend(current: StoredSnapshot, history: StoredSnapshot[]): HealthTrend {
	const previous = history.length > 0 ? history[0] : null;
	const deltas = previous ? computeDeltas(current, previous) : [];
	return { current, previous, deltas };
}
