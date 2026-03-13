/**
 * iteration-detail-menu.ts — Interactive iteration detail view.
 *
 * Shows iteration info (goal, status, dates, resources, capacities,
 * agents) and provides action items via sitemap slots.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { clock } from "../../infrastructure/clock.js";
import { runMenu } from "../../infrastructure/menu.js";
import type { MenuEntry, MenuResult } from "../../infrastructure/types.js";
import { listIterations, findCurrentIteration } from "../../domain/iterations/iteration-store.js";
import { renderIterationDetail } from "../displays/iterations-display.js";
import type { IterationsConfig } from "../../infrastructure/types.js";

function storeDeps() { return { disk, paths, clock } as const; }

export async function iterationDetailMenu(
	projectPath: string,
	iterationNumber: number,
	config?: IterationsConfig,
	sitemapSlots?: Readonly<Record<string, readonly MenuEntry[]>>,
): Promise<MenuResult> {
	const all = listIterations(storeDeps(), projectPath, config);
	const iteration = all.find((it) => it.number === iterationNumber);
	if (!iteration) return "main";

	renderIterationDetail(iteration);

	const items: MenuEntry[] = [];

	if (sitemapSlots) {
		items.push(...(sitemapSlots["_between_iteration-info"] ?? []));
		items.push(...(sitemapSlots["_after"] ?? []));
	} else {
		items.push(
			{ key: "b", label: "Back", action: () => "main" as const },
		);
	}

	return runMenu(`#${iteration.number} — ${iteration.name}`, items);
}

export function resolveCurrentIterationNumber(projectPath: string, config?: IterationsConfig): number | null {
	const current = findCurrentIteration(storeDeps(), projectPath, config);
	return current?.number ?? null;
}
