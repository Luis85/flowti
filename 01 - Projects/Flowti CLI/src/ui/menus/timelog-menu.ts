/**
 * timelog-menu.ts — Interactive time-log menu.
 */

import { paths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { clock } from "../../infrastructure/clock.js";
import { printHeader } from "../../infrastructure/ui.js";
import { input } from "../../infrastructure/input.js";
import { runMenu } from "../../infrastructure/menu.js";
import type { MenuResult, MenuEntry, TimeLogConfig } from "../../infrastructure/types.js";
import { listTimeLogEntries, createTimeLogEntry, summarizeTimeLog } from "../../domain/timelog/timelog-store.js";
import { renderTimeLogList, renderTimeLogSummary, renderTimeLogAdded } from "../timelog-display.js";

function storeDeps() { return { disk, paths, clock } as const; }

async function logTimeInteractive(projectPath: string, config?: TimeLogConfig): Promise<void> {
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

export async function timelogMenu(projectPath: string, config?: TimeLogConfig): Promise<MenuResult> {
	const items: MenuEntry[] = [
		{
			key: "1",
			label: "List Entries",
			action: async () => {
				renderTimeLogList(listTimeLogEntries(storeDeps(), projectPath, config));
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "2",
			label: "Log Time",
			action: async () => {
				await logTimeInteractive(projectPath, config);
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "3",
			label: "Summary",
			action: async () => {
				const entries = listTimeLogEntries(storeDeps(), projectPath, config);
				renderTimeLogSummary(summarizeTimeLog(entries));
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	];

	return runMenu("Time-Log", items);
}
