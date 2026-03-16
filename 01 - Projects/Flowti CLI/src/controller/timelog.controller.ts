/**
 * timelog.controller.ts — Controller for time-log commands.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { timelogStore, createTimeLogEntry, summarizeTimeLog } from "../domain/timelog/timelog-store.js";
import { renderTimeLogList, renderTimeLogSummary, renderTimeLogAdded } from "../ui/displays/timelog-display.js";
import { renderError } from "../ui/renderers/common-renderers.js";
import type { ErrorModel } from "../ui/renderers/common-renderers.js";
import type { LogFn } from "../infrastructure/command-engine.js";

type TimeLogListModel = ReturnType<typeof timelogStore.list>;
type TimeLogSummaryModel = ReturnType<typeof summarizeTimeLog>;
type TimeLogAddModel = { relPath: string } | ErrorModel;

function isErrorModel(m: unknown): m is ErrorModel {
	return typeof m === "object" && m !== null && "error" in m;
}

function renderTimeLogAdd(data: TimeLogAddModel, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderTimeLogAdded(data.relPath, log);
}

export const commands: Record<string, CommandHandler> = {
	"timelog:list": adaptDescriptor<Record<string, unknown>, TimeLogListModel>({
		requires: "project",
		handler: (ctx) => timelogStore.list(ctx.deps, ctx.project!.path, ctx.project!.config.management?.timelog ? { dir: ctx.project!.config.management.timelog.dir } : undefined),
		renderer: renderTimeLogList,
	}),

	"timelog:add": adaptDescriptor<Record<string, unknown>, TimeLogAddModel>({
		requires: "project",
		flags: {
			person: { type: "string", required: true, hint: 'Usage: flowti timelog:add --person="Jane" --task="Implement feature" --hours=4' },
			task: { type: "string", required: true, hint: 'Usage: flowti timelog:add --person="Jane" --task="Implement feature" --hours=4' },
			date: { type: "string", default: "" },
			hours: { type: "string", default: "1" },
			category: { type: "string", default: "development" },
			description: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const person = ctx.flags.person as string;
			const task = ctx.flags.task as string;
			const date = (ctx.flags.date as string) || ctx.deps.clock.iso().slice(0, 10);
			const filePath = createTimeLogEntry(ctx.deps, ctx.project!.path, {
				date,
				person,
				hours: parseFloat(ctx.flags.hours as string),
				category: ctx.flags.category as string,
				task,
				description: ctx.flags.description as string,
			}, ctx.project!.config.management?.timelog);
			if (filePath) {
				return { relPath: ctx.deps.paths.relative(ctx.project!.path, filePath) };
			}
			return { error: "Failed to create time log entry." } as ErrorModel;
		},
		renderer: renderTimeLogAdd,
	}),

	"timelog:summary": adaptDescriptor<Record<string, unknown>, TimeLogSummaryModel>({
		requires: "project",
		handler: (ctx) => {
			const entries = timelogStore.list(ctx.deps, ctx.project!.path, ctx.project!.config.management?.timelog ? { dir: ctx.project!.config.management.timelog.dir } : undefined);
			return summarizeTimeLog(entries);
		},
		renderer: renderTimeLogSummary,
	}),
};
