/**
 * raid.controller.ts — Controller for RAID log management commands.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler, RAIDItemType, RAIDStatus } from "../infrastructure/types.js";
import { raidStore, createRAIDItem } from "../domain/raid/raid-store.js";
import { renderRAIDList, renderRAIDAdded, renderRAIDUpdated } from "../ui/displays/raid-display.js";
import { renderError } from "../ui/renderers/common-renderers.js";
import type { ErrorModel } from "../ui/renderers/common-renderers.js";
import type { LogFn } from "../infrastructure/command-engine.js";

const VALID_TYPES: RAIDItemType[] = ["risk", "assumption", "issue", "dependency", "decision"];
const VALID_STATUSES: RAIDStatus[] = ["open", "mitigated", "closed", "accepted", "resolved", "deferred"];

type RAIDListModel = ReturnType<typeof raidStore.list>;
type RAIDAddModel = { relPath: string } | ErrorModel;
type RAIDUpdateModel = { name: string; status: string } | ErrorModel;

function isErrorModel(m: unknown): m is ErrorModel {
	return typeof m === "object" && m !== null && "error" in m;
}

function renderRAIDAdd(data: RAIDAddModel, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderRAIDAdded(data.relPath, log);
}

function renderRAIDUpdate(data: RAIDUpdateModel, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderRAIDUpdated(data.name, data.status, log);
}

export const commands: Record<string, CommandHandler> = {
	"raid:list": adaptDescriptor<Record<string, unknown>, RAIDListModel>({
		requires: "project",
		handler: (ctx) => raidStore.list(ctx.deps, ctx.project!.path, ctx.project!.config.management?.raid ? { dir: ctx.project!.config.management.raid.dir } : undefined),
		renderer: renderRAIDList,
	}),

	"raid:add": adaptDescriptor<Record<string, unknown>, RAIDAddModel>({
		requires: "project",
		flags: {
			name: { type: "string", required: true, hint: 'Usage: flowti raid:add --name="DB Migration Risk" --item-type="risk"' },
			"item-type": { type: "string", default: "risk" },
			severity: { type: "string", default: "medium" },
			owner: { type: "string", default: "" },
			due: { type: "string", default: "" },
			category: { type: "string", default: "technical" },
			description: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const name = ctx.flags.name as string;
			const itemType = (ctx.flags["item-type"] as string) as RAIDItemType;
			if (!VALID_TYPES.includes(itemType)) {
				return { error: `Invalid item-type "${itemType}". Valid: ${VALID_TYPES.join(", ")}` } as ErrorModel;
			}
			const filePath = createRAIDItem(ctx.deps, ctx.project!.path, {
				name,
				itemType,
				status: "open",
				severity: (ctx.flags.severity as string) as "critical" | "high" | "medium" | "low",
				owner: (ctx.flags.owner as string) || undefined,
				dueDate: (ctx.flags.due as string) || undefined,
				category: ((ctx.flags.category as string) as "technical" | "business" | "organizational" | "external") || undefined,
				description: ctx.flags.description as string,
			}, ctx.project!.config.management?.raid);
			if (filePath) {
				return { relPath: ctx.deps.paths.relative(ctx.project!.path, filePath) };
			}
			return { error: "Failed to create RAID item." } as ErrorModel;
		},
		renderer: renderRAIDAdd,
	}),

	"raid:update": adaptDescriptor<Record<string, unknown>, RAIDUpdateModel>({
		requires: "project",
		flags: {
			name: { type: "string", required: true, hint: 'Usage: flowti raid:update --name="DB Risk" --status="mitigated"' },
			status: { type: "string", required: true, hint: 'Usage: flowti raid:update --name="DB Risk" --status="mitigated"' },
		},
		handler: (ctx) => {
			const name = ctx.flags.name as string;
			const status = ctx.flags.status as string;
			if (!VALID_STATUSES.includes(status as RAIDStatus)) {
				return { error: `Invalid status "${status}". Valid: ${VALID_STATUSES.join(", ")}` } as ErrorModel;
			}
			const ok = raidStore.updateField(ctx.deps, ctx.project!.path, name, "status", status, ctx.project!.config.management?.raid ? { dir: ctx.project!.config.management.raid.dir } : undefined);
			if (ok) {
				return { name, status };
			}
			return { error: `Failed to update RAID item "${name}".` } as ErrorModel;
		},
		renderer: renderRAIDUpdate,
	}),
};
