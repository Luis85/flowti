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
import { renderIterationDetail } from "../displays/iterations-display.js";
import type { IterationsConfig } from "../../infrastructure/types.js";

export async function iterationDetailMenu(
	projectPath: string,
	iterationNumber: number,
	config: IterationsConfig | undefined,
	dataSourceEntries: Readonly<Record<string, readonly MenuEntry[]>> | undefined,
	deps: MenuDeps,
): Promise<MenuResult> {
	const all = listIterations(deps, projectPath, config);
	const iteration = all.find((it) => it.number === iterationNumber);
	if (!iteration) return "main";

	const items: MenuEntry[] = [];

	if (dataSourceEntries?.["_actions"]) {
		items.push(...dataSourceEntries["_actions"]);
	} else {
		items.push(
			{ key: "b", label: "Back", action: () => "main" as const },
		);
	}

	return runMenu(`#${iteration.number} — ${iteration.name}`, items, {
		beforeMenu: () => renderIterationDetail(iteration, deps.log),
	});
}

export function resolveCurrentIterationNumber(projectPath: string, config: IterationsConfig | undefined, deps: MenuDeps): number | null {
	const current = findCurrentIteration(deps, projectPath, config);
	return current?.number ?? null;
}
