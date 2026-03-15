/**
 * health.controller.ts — Controller for health, snapshot, history, and debt commands.
 *
 * Returns typed data models; rendering is handled by ui/health-display.ts.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler, ProjectContext } from "../infrastructure/types.js";
import { collectHealth } from "../domain/health/health.js";
import { scoreHealth, DEFAULT_THRESHOLDS, type HealthThresholds } from "../domain/health/health-scoring.js";
import { saveSnapshot, loadHistory, buildTrend, type StoredSnapshot } from "../domain/health/health-trends.js";
import { estimateDebt } from "../domain/health/tech-debt.js";
import {
	renderHealthDashboard, renderSnapshotSaved, renderHealthHistory, renderDebtEstimate,
	type HealthViewModel, type SnapshotSavedModel,
} from "../ui/displays/health-display.js";

// ── Helpers ─────────────────────────────────────────────────────────

function mergeDefaults<T extends Record<string, unknown>>(partial: Partial<T> | undefined, defaults: T): T {
	if (!partial) return defaults;
	const result = { ...defaults };
	for (const key of Object.keys(defaults) as (keyof T)[]) {
		if (partial[key] !== undefined) result[key] = partial[key] as T[keyof T];
	}
	return result;
}

function resolveThresholds(project: ProjectContext): HealthThresholds {
	const cfg = project.config.health?.thresholds;
	if (!cfg) return DEFAULT_THRESHOLDS;
	return {
		coverage: mergeDefaults(cfg.coverage, DEFAULT_THRESHOLDS.coverage),
		lint: mergeDefaults(cfg.lint, DEFAULT_THRESHOLDS.lint),
		tests: mergeDefaults(cfg.tests, DEFAULT_THRESHOLDS.tests),
	};
}

// ── Commands ─────────────────────────────────────────────────────────

export const commands: Record<string, CommandHandler> = {
	health: adaptDescriptor<Record<string, unknown>, HealthViewModel>({
		requires: "project",
		handler: (ctx) => {
			const { disk, paths, shell, clock } = ctx.deps;
			const healthDeps = { disk, paths, shell } as const;
			const trendDeps = { disk, paths, clock } as const;
			const snapshot = collectHealth(healthDeps, ctx.project!);
			const thresholds = resolveThresholds(ctx.project!);
			const score = scoreHealth(snapshot, thresholds);
			const history = loadHistory(trendDeps, ctx.project!.path);
			const current: StoredSnapshot = { timestamp: "", snapshot, score };
			const trend = buildTrend(current, history);
			return { ...snapshot, score, trend: trend.deltas };
		},
		renderer: renderHealthDashboard,
	}),

	"health:snapshot": adaptDescriptor<Record<string, unknown>, SnapshotSavedModel>({
		requires: "project",
		handler: (ctx) => {
			const { disk, paths, shell, clock } = ctx.deps;
			const healthDeps = { disk, paths, shell } as const;
			const trendDeps = { disk, paths, clock } as const;
			const snapshot = collectHealth(healthDeps, ctx.project!);
			const thresholds = resolveThresholds(ctx.project!);
			const score = scoreHealth(snapshot, thresholds);
			const filePath = saveSnapshot(trendDeps, ctx.project!.path, snapshot, score);
			return { relativePath: paths.relative(ctx.project!.path, filePath) };
		},
		renderer: renderSnapshotSaved,
	}),

	"health:history": adaptDescriptor({
		requires: "project",
		handler: (ctx) => {
			const { disk, paths, clock } = ctx.deps;
			const trendDeps = { disk, paths, clock } as const;
			return loadHistory(trendDeps, ctx.project!.path);
		},
		renderer: renderHealthHistory,
	}),

	"debt:estimate": adaptDescriptor({
		requires: "project",
		handler: (ctx) => {
			const { disk, paths, shell } = ctx.deps;
			const healthDeps = { disk, paths, shell } as const;
			const snapshot = collectHealth(healthDeps, ctx.project!);
			const thresholds = resolveThresholds(ctx.project!);
			const score = scoreHealth(snapshot, thresholds);
			return estimateDebt(snapshot, score);
		},
		renderer: renderDebtEstimate,
	}),
};
