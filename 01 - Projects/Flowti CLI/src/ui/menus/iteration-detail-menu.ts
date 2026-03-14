/**
 * iteration-detail-menu.ts — Interactive iteration detail view.
 *
 * Shows iteration info (goal, status, dates, resources, capacities,
 * agents) and provides action items via sitemap slots.
 */

import { runMenu } from "../../infrastructure/menu.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { MenuEntry, MenuResult } from "../../infrastructure/types.js";
import { listIterations, findCurrentIteration } from "../../domain/iterations/iteration-store.js";
import { renderIterationDetail, renderGateStatus } from "../displays/iterations-display.js";
import type { IterationsConfig } from "../../infrastructure/types.js";
import type { IterationSummary } from "../../domain/iterations/iteration-types.js";
import type { LifecycleTemplate } from "../../domain/lifecycle/lifecycle-types.js";
import { getValidTransitions, getGates } from "../../domain/lifecycle/lifecycle-engine.js";
import { makeGateEvaluator } from "../../domain/iterations/iteration-gates.js";

export async function iterationDetailMenu(
	projectPath: string,
	iterationNumber: number,
	config: IterationsConfig | undefined,
	dataSourceEntries: Readonly<Record<string, readonly MenuEntry[]>> | undefined,
	deps: MenuDeps,
	template?: LifecycleTemplate,
): Promise<MenuResult> {
	const all = listIterations(deps, projectPath, config);
	const iteration = all.find((it) => it.number === iterationNumber);
	if (!iteration) return "main";

	const items: MenuEntry[] = [];

	if (dataSourceEntries?.["_actions"]) {
		for (const entry of dataSourceEntries["_actions"]) {
			if (template && "label" in entry && entry.label === "Advance") {
				const label = buildAdvanceLabel(template, iteration.status);
				items.push({ ...entry, label });
			} else {
				items.push(entry);
			}
		}
	} else {
		items.push(
			{ key: "b", label: "Back", action: () => "main" as const },
		);
	}

	const gateInfo = template ? buildGateInfo(template, iteration) : undefined;

	return runMenu(`#${iteration.number} — ${iteration.name}`, items, {
		beforeMenu: () => {
			renderIterationDetail(iteration, deps.log);
			if (gateInfo) renderGateStatus(gateInfo, deps.log);
		},
	});
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
	return gates.map((g) => {
		const result = evaluator(g.id);
		return { label: g.label, passed: result.passed };
	});
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
