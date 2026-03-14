/**
 * iteration-detail-menu.ts — Interactive iteration detail view.
 *
 * Shows iteration info (goal, status, dates, resources, capacities,
 * agents) and provides action items via sitemap slots. Optionally
 * watches the plan file for external changes and re-renders.
 */

import { runMenu } from "../../infrastructure/menu.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { MenuEntry, MenuResult } from "../../infrastructure/types.js";
import { listIterations, findCurrentIteration, iterationsDir } from "../../domain/iterations/iteration-store.js";
import { renderIterationDetail, renderGateStatus, renderActiveAgent } from "../displays/iterations-display.js";
import type { IterationsConfig } from "../../infrastructure/types.js";
import type { IterationSummary } from "../../domain/iterations/iteration-types.js";
import type { LifecycleTemplate } from "../../domain/lifecycle/lifecycle-types.js";
import { getValidTransitions, getGates } from "../../domain/lifecycle/lifecycle-engine.js";
import { makeGateEvaluator } from "../../domain/iterations/iteration-gates.js";
import { getActiveAgent } from "../../domain/agents/agent-orchestration.js";
import { PlanWatcher } from "../../infrastructure/plan-watcher.js";
import type { WatchFn } from "../../infrastructure/sitemap-watcher.js";

export interface DetailMenuOptions {
	template?: LifecycleTemplate;
	watchFn?: WatchFn;
}

export async function iterationDetailMenu(
	projectPath: string,
	iterationNumber: number,
	config: IterationsConfig | undefined,
	dataSourceEntries: Readonly<Record<string, readonly MenuEntry[]>> | undefined,
	deps: MenuDeps,
	options: DetailMenuOptions = {},
): Promise<MenuResult> {
	const initial = findIteration(deps, projectPath, iterationNumber, config);
	if (!initial) return "main";

	const { template, watchFn } = options;
	const orchestration = config?.orchestration;

	// Mutable state container — updated by the watcher callback
	const state = {
		iteration: initial,
		activeAgent: getActiveAgent(orchestration, initial.status),
		gateInfo: template ? buildGateInfo(template, initial) : undefined,
	};

	const items = buildActionItems(dataSourceEntries, template, initial.status);

	// ── Plan file watcher ──────────────────────────────────────────
	let watcher: PlanWatcher | null = null;
	if (watchFn) {
		const planPath = resolvePlanPath(deps, projectPath, initial.file, config);
		watcher = createWatcher(planPath, deps, watchFn);
		watcher.start(() => {
			const refreshed = findIteration(deps, projectPath, iterationNumber, config);
			if (refreshed) {
				state.iteration = refreshed;
				state.activeAgent = getActiveAgent(orchestration, refreshed.status);
				state.gateInfo = template ? buildGateInfo(template, refreshed) : undefined;
			}
		});
	}

	try {
		return await runMenu(`#${initial.number} — ${initial.name}`, items, {
			beforeMenu: () => {
				renderIterationDetail(state.iteration, deps.log);
				if (state.activeAgent) renderActiveAgent(state.activeAgent, deps.log);
				if (state.gateInfo) renderGateStatus(state.gateInfo, deps.log);
			},
		});
	} finally {
		watcher?.stop();
	}
}

// ── Helpers ──────────────────────────────────────────────────────────

function findIteration(deps: MenuDeps, projectPath: string, num: number, config: IterationsConfig | undefined): IterationSummary | null {
	const all = listIterations(deps, projectPath, config);
	return all.find((it) => it.number === num) ?? null;
}

function buildActionItems(
	dataSourceEntries: Readonly<Record<string, readonly MenuEntry[]>> | undefined,
	template: LifecycleTemplate | undefined,
	status: string,
): MenuEntry[] {
	const items: MenuEntry[] = [];
	if (dataSourceEntries?.["_actions"]) {
		for (const entry of dataSourceEntries["_actions"]) {
			if (template && "label" in entry && entry.label === "Advance") {
				items.push({ ...entry, label: buildAdvanceLabel(template, status) });
			} else {
				items.push(entry);
			}
		}
	} else {
		items.push({ key: "b", label: "Back", action: () => "main" as const });
	}
	return items;
}

function buildAdvanceLabel(template: LifecycleTemplate, status: string): string {
	const valid = getValidTransitions(template, status).filter((s) => s !== "cancelled");
	if (valid.length === 0) return "Advance";
	const target = valid[0];
	const label = template.labels?.[target] ?? target;
	return `Advance → ${label}`;
}

interface GateInfo { label: string; passed: boolean }

function buildGateInfo(template: LifecycleTemplate, iteration: IterationSummary): GateInfo[] | undefined {
	const gates = getGates(template, iteration.status);
	if (gates.length === 0) return undefined;
	const evaluator = makeGateEvaluator(iteration);
	return gates.map((g) => ({ label: g.label, passed: evaluator(g.id).passed }));
}

function resolvePlanPath(deps: MenuDeps, projectPath: string, file: string, config: IterationsConfig | undefined): string {
	return deps.paths.join(iterationsDir(deps, projectPath, config), file);
}

function createWatcher(planPath: string, deps: MenuDeps, watchFn: WatchFn): PlanWatcher {
	return new PlanWatcher(planPath, deps.disk, watchFn);
}

export function resolveCurrentIterationNumber(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): number | null {
	const current = findCurrentIteration(deps, projectPath, config);
	return current?.number ?? null;
}

/** Resolve a specific iteration number, falling back to current. */
export function resolveIterationNumber(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps, targetNumber?: number): number | null {
	if (targetNumber !== undefined) {
		const all = listIterations(deps, projectPath, config);
		const match = all.find((it) => it.number === targetNumber);
		return match ? match.number : null;
	}
	return resolveCurrentIterationNumber(projectPath, config, deps);
}
