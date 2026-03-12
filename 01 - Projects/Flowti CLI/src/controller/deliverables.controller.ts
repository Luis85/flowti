/**
 * deliverables.controller.ts — Controller for deliverable management commands.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler, DeliverableStatus } from "../infrastructure/types.js";
import { listDeliverables, createDeliverableFile, updateDeliverableStatus } from "../domain/deliverables/deliverable-store.js";
import { renderDeliverableList, renderDeliverableAdded, renderDeliverableUpdated } from "../ui/deliverables-display.js";
import { renderError } from "../ui/common-renderers.js";
import type { ErrorModel } from "../ui/common-renderers.js";

const VALID_STATUSES: DeliverableStatus[] = ["planned", "in-progress", "review", "done", "blocked"];

function flagStr(flags: Record<string, string | boolean>, key: string, fallback: string): string {
	return typeof flags[key] === "string" ? flags[key] : fallback;
}

const actions: Record<string, ControllerAction> = {
	"deliverables:list": (req) => {
		if (!req.project) return;
		const deliverables = listDeliverables(req.deps, req.project.path, req.project.config.management?.deliverables);
		return dataResponse(deliverables, renderDeliverableList);
	},

	"deliverables:add": (req) => {
		if (!req.project) return;
		const { paths } = req.deps;
		const name = req.flags.name;
		if (!name || typeof name !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --name flag.", hint: 'Usage: flowti deliverables:add --name="MVP Release"' },
				renderError,
			);
		}
		const filePath = createDeliverableFile(req.deps, req.project.path, {
			name,
			status: (flagStr(req.flags, "status", "planned") as DeliverableStatus),
			dueDate: flagStr(req.flags, "due", "") || undefined,
			assignee: flagStr(req.flags, "assignee", "") || undefined,
			priority: flagStr(req.flags, "priority", "medium") || undefined,
			completionPct: parseInt(flagStr(req.flags, "completion", "0"), 10),
			description: flagStr(req.flags, "description", ""),
		}, req.project.config.management?.deliverables);
		if (filePath) {
			return dataResponse(
				{ relPath: paths.relative(req.project.path, filePath) },
				(m: { relPath: string }) => renderDeliverableAdded(m.relPath),
			);
		}
	},

	"deliverables:update": (req) => {
		if (!req.project) return;
		const name = req.flags.name;
		const status = req.flags.status;
		if (!name || typeof name !== "string" || !status || typeof status !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --name and/or --status flag.", hint: 'Usage: flowti deliverables:update --name="MVP" --status="done"' },
				renderError,
			);
		}
		if (!VALID_STATUSES.includes(status as DeliverableStatus)) {
			return dataResponse<ErrorModel>(
				{ error: `Invalid status "${status}". Valid: ${VALID_STATUSES.join(", ")}` },
				renderError,
			);
		}
		const pct = typeof req.flags.completion === "string" ? parseInt(req.flags.completion, 10) : undefined;
		const ok = updateDeliverableStatus(req.deps, req.project.path, name, status as DeliverableStatus, pct, req.project.config.management?.deliverables);
		if (ok) {
			return dataResponse(
				{ name, status },
				(m: { name: string; status: string }) => renderDeliverableUpdated(m.name, m.status),
			);
		}
	},
};

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
