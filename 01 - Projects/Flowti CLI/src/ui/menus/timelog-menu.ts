/**
 * timelog-menu.ts — Interactive time-log menu.
 */

import { printHeader } from "../../infrastructure/ui.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { TimeLogConfig } from "../../infrastructure/types.js";
import { createTimeLogEntry } from "../../domain/timelog/timelog-store.js";
import { renderTimeLogAdded } from "../displays/timelog-display.js";

export async function logTimeInteractive(projectPath: string, config: TimeLogConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Log Time");

	const person = await deps.input.ask("Person");
	if (!person) return;

	const hours = parseFloat(await deps.input.ask("Hours", "1"));
	const category = await deps.input.ask("Category", "development");
	const task = await deps.input.ask("Task");
	if (!task) return;

	const description = await deps.input.ask("Notes (optional)", "");

	const filePath = createTimeLogEntry(deps, projectPath, {
		date: deps.clock.iso().slice(0, 10),
		person,
		hours,
		category,
		task,
		description,
	}, config);

	if (filePath) {
		renderTimeLogAdded(deps.paths.relative(projectPath, filePath), deps.log);
	}
}
