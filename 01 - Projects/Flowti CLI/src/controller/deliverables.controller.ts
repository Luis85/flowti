/**
 * deliverables.controller.ts — Controller for deliverable management commands.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler, DeliverableStatus } from "../infrastructure/types.js";
import { deliverableStore, createDeliverableFile, updateDeliverableStatus } from "../domain/deliverables/deliverable-store.js";
import { renderDeliverableList, renderDeliverableAdded, renderDeliverableUpdated } from "../ui/displays/deliverables-display.js";
import { renderError } from "../ui/renderers/common-renderers.js";
import type { ErrorModel } from "../ui/renderers/common-renderers.js";
import type { LogFn } from "../infrastructure/command-engine.js";

const VALID_STATUSES: DeliverableStatus[] = ["planned", "in-progress", "review", "done", "blocked"];

type DeliverableListModel = ReturnType<typeof deliverableStore.list>;
type DeliverableAddModel = { relPath: string } | ErrorModel;
type DeliverableUpdateModel = { name: string; status: string } | ErrorModel;

function isErrorModel(m: unknown): m is ErrorModel {
	return typeof m === "object" && m !== null && "error" in m;
}

function renderDeliverableAdd(data: DeliverableAddModel, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderDeliverableAdded(data.relPath, log);
}

function renderDeliverableUpdate(data: DeliverableUpdateModel, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderDeliverableUpdated(data.name, data.status, log);
}

export const commands: Record<string, CommandHandler> = {
	"deliverables:list": adaptDescriptor<Record<string, unknown>, DeliverableListModel>({
		requires: "project",
		handler: (ctx) => deliverableStore.list(ctx.deps, ctx.project!.path, ctx.project!.config.management?.deliverables ? { dir: ctx.project!.config.management.deliverables.dir } : undefined),
		renderer: renderDeliverableList,
	}),

	"deliverables:add": adaptDescriptor<Record<string, unknown>, DeliverableAddModel>({
		requires: "project",
		flags: {
			name: { type: "string", required: true, hint: 'Usage: flowti deliverables:add --name="MVP Release"' },
			status: { type: "string", default: "planned" },
			due: { type: "string", default: "" },
			assignee: { type: "string", default: "" },
			priority: { type: "string", default: "medium" },
			completion: { type: "string", default: "0" },
			description: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const name = ctx.flags.name as string;
			const filePath = createDeliverableFile(ctx.deps, ctx.project!.path, {
				name,
				status: (ctx.flags.status as string) as DeliverableStatus,
				dueDate: (ctx.flags.due as string) || undefined,
				assignee: (ctx.flags.assignee as string) || undefined,
				priority: (ctx.flags.priority as string) || undefined,
				completionPct: parseInt(ctx.flags.completion as string, 10),
				description: ctx.flags.description as string,
			}, ctx.project!.config.management?.deliverables);
			if (filePath) {
				return { relPath: ctx.deps.paths.relative(ctx.project!.path, filePath) };
			}
			return { error: "Failed to create deliverable." } as ErrorModel;
		},
		renderer: renderDeliverableAdd,
	}),

	"deliverables:update": adaptDescriptor<Record<string, unknown>, DeliverableUpdateModel>({
		requires: "project",
		flags: {
			name: { type: "string", required: true, hint: 'Usage: flowti deliverables:update --name="MVP" --status="done"' },
			status: { type: "string", required: true, hint: 'Usage: flowti deliverables:update --name="MVP" --status="done"' },
			completion: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const name = ctx.flags.name as string;
			const status = ctx.flags.status as string;
			if (!VALID_STATUSES.includes(status as DeliverableStatus)) {
				return { error: `Invalid status "${status}". Valid: ${VALID_STATUSES.join(", ")}` } as ErrorModel;
			}
			const completionStr = ctx.flags.completion as string;
			const pct = completionStr ? parseInt(completionStr, 10) : undefined;
			const ok = updateDeliverableStatus(ctx.deps, ctx.project!.path, name, status as DeliverableStatus, pct, ctx.project!.config.management?.deliverables);
			if (ok) {
				return { name, status };
			}
			return { error: `Failed to update deliverable "${name}".` } as ErrorModel;
		},
		renderer: renderDeliverableUpdate,
	}),
};
