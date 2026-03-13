/**
 * timelog-menu.ts — Interactive time-log menu.
 */

import { paths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { clock } from "../../infrastructure/clock.js";
import { printHeader } from "../../infrastructure/ui.js";
import { input } from "../../infrastructure/input.js";
import type { TimeLogConfig } from "../../infrastructure/types.js";
import { createTimeLogEntry } from "../../domain/timelog/timelog-store.js";
import { renderTimeLogAdded } from "../displays/timelog-display.js";

function storeDeps() { return { disk, paths, clock } as const; }

export async function logTimeInteractive(projectPath: string, config?: TimeLogConfig): Promise<void> {
	printHeader("Log Time");

	const person = await input.ask("Person");
	if (!person) return;

	const hours = parseFloat(await input.ask("Hours", "1"));
	const category = await input.ask("Category", "development");
	const task = await input.ask("Task");
	if (!task) return;

	const description = await input.ask("Notes (optional)", "");

	const filePath = createTimeLogEntry(storeDeps(), projectPath, {
		date: clock.iso().slice(0, 10),
		person,
		hours,
		category,
		task,
		description,
	}, config);

	if (filePath) {
		renderTimeLogAdded(paths.relative(projectPath, filePath));
	}
}
