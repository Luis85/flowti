/**
 * timelog.controller.ts — Controller for time-log commands.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler } from "../infrastructure/types.js";
import { listTimeLogEntries, createTimeLogEntry, summarizeTimeLog } from "../domain/timelog/timelog-store.js";
import { renderTimeLogList, renderTimeLogSummary, renderTimeLogAdded } from "../ui/displays/timelog-display.js";
import { renderError } from "../ui/renderers/common-renderers.js";
import type { ErrorModel } from "../ui/renderers/common-renderers.js";

function flagStr(flags: Record<string, string | boolean>, key: string, fallback: string): string {
	return typeof flags[key] === "string" ? flags[key] : fallback;
}

const actions: Record<string, ControllerAction> = {
	"timelog:list": (req) => {
		if (!req.project) return;
		const entries = listTimeLogEntries(req.deps, req.project.path, req.project.config.management?.timelog);
		return dataResponse(entries, renderTimeLogList);
	},

	"timelog:add": (req) => {
		if (!req.project) return;
		const { paths } = req.deps;
		const person = req.flags.person;
		const task = req.flags.task;
		if (!person || typeof person !== "string" || !task || typeof task !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --person and/or --task flag.", hint: 'Usage: flowti timelog:add --person="Jane" --task="Implement feature" --hours=4' },
				renderError,
			);
		}
		const filePath = createTimeLogEntry(req.deps, req.project.path, {
			date: flagStr(req.flags, "date", req.deps.clock.iso().slice(0, 10)),
			person,
			hours: parseFloat(flagStr(req.flags, "hours", "1")),
			category: flagStr(req.flags, "category", "development"),
			task,
			description: flagStr(req.flags, "description", ""),
		}, req.project.config.management?.timelog);
		if (filePath) {
			return dataResponse(
				{ relPath: paths.relative(req.project.path, filePath) },
				(m: { relPath: string }) => renderTimeLogAdded(m.relPath),
			);
		}
	},

	"timelog:summary": (req) => {
		if (!req.project) return;
		const entries = listTimeLogEntries(req.deps, req.project.path, req.project.config.management?.timelog);
		const summary = summarizeTimeLog(entries);
		return dataResponse(summary, renderTimeLogSummary);
	},
};

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
