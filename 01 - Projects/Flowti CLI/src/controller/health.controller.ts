/**
 * health.controller.ts — Controller for health, snapshot, history, and debt commands.
 *
 * Returns typed data models; rendering is handled by ui/health-display.ts.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler, ProjectContext } from "../infrastructure/types.js";
import { collectHealth } from "../domain/health/health.js";
import { scoreHealth, DEFAULT_THRESHOLDS, type HealthThresholds } from "../domain/health/health-scoring.js";
import { saveSnapshot, loadHistory, buildTrend, type StoredSnapshot } from "../domain/health/health-trends.js";
import { estimateDebt } from "../domain/health/tech-debt.js";
import {
	renderHealthDashboard, renderSnapshotSaved, renderHealthHistory, renderDebtEstimate,
	type HealthViewModel, type SnapshotSavedModel,
} from "../ui/displays/health-display.js";
import { renderNoProject, type NoProjectModel } from "../ui/renderers/common-renderers.js";

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

function noProjectResponse(command: string) {
	return dataResponse<NoProjectModel>({ command }, renderNoProject);
}

// ── Controller actions ──────────────────────────────────────────────

const actions: Record<string, ControllerAction> = {
	health: (req) => {
		if (!req.project) return noProjectResponse("health");
		const { disk, paths, shell, clock } = req.deps;
		const healthDeps = { disk, paths, shell } as const;
		const trendDeps = { disk, paths, clock } as const;
		const snapshot = collectHealth(healthDeps, req.project);
		const thresholds = resolveThresholds(req.project);
		const score = scoreHealth(snapshot, thresholds);
		const history = loadHistory(trendDeps, req.project.path);
		const current: StoredSnapshot = { timestamp: "", snapshot, score };
		const trend = buildTrend(current, history);
		const viewData: HealthViewModel = { ...snapshot, score, trend: trend.deltas };

		return dataResponse(viewData, renderHealthDashboard);
	},

	"health:snapshot": (req) => {
		if (!req.project) return noProjectResponse("health:snapshot");
		const { disk, paths, shell, clock } = req.deps;
		const healthDeps = { disk, paths, shell } as const;
		const trendDeps = { disk, paths, clock } as const;
		const snapshot = collectHealth(healthDeps, req.project);
		const thresholds = resolveThresholds(req.project);
		const score = scoreHealth(snapshot, thresholds);
		const filePath = saveSnapshot(trendDeps, req.project.path, snapshot, score);
		const model: SnapshotSavedModel = { relativePath: paths.relative(req.project.path, filePath) };

		return dataResponse(model, renderSnapshotSaved);
	},

	"health:history": (req) => {
		if (!req.project) return noProjectResponse("health:history");
		const { disk, paths, clock } = req.deps;
		const trendDeps = { disk, paths, clock } as const;
		const history = loadHistory(trendDeps, req.project.path);

		return dataResponse(history, renderHealthHistory);
	},

	"debt:estimate": (req) => {
		if (!req.project) return noProjectResponse("debt:estimate");
		const { disk, paths, shell } = req.deps;
		const healthDeps = { disk, paths, shell } as const;
		const snapshot = collectHealth(healthDeps, req.project);
		const thresholds = resolveThresholds(req.project);
		const score = scoreHealth(snapshot, thresholds);
		const estimate = estimateDebt(snapshot, score);

		return dataResponse(estimate, renderDebtEstimate);
	},
};

// ── Adapted commands for CommandRegistry ─────────────────────────────

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
