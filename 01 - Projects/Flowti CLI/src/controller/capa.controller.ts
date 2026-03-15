/**
 * capa.controller.ts — Controller for CAPA management commands.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler, CAPAStatus, CAPAType } from "../infrastructure/types.js";
import type { CAPASeverity, CAPASource } from "../domain/capa/capa-types.js";
import { listCAPAItems, createCAPAItem, updateCAPAStatus, nextCapaId } from "../domain/capa/capa-store.js";
import { renderCAPAList, renderCAPAAdded, renderCAPAUpdated } from "../ui/displays/capa-display.js";
import { renderError } from "../ui/renderers/common-renderers.js";
import type { ErrorModel } from "../ui/renderers/common-renderers.js";
import type { LogFn } from "../infrastructure/command-engine.js";

const VALID_TYPES: CAPAType[] = ["corrective", "preventive"];
const VALID_STATUSES: CAPAStatus[] = ["open", "investigating", "action-planned", "implementing", "verification", "closed", "rejected"];

type CAPAListModel = ReturnType<typeof listCAPAItems>;
type CAPAAddModel = { relPath: string } | ErrorModel;
type CAPAUpdateModel = { name: string; status: string } | ErrorModel;

function isErrorModel(m: unknown): m is ErrorModel {
	return typeof m === "object" && m !== null && "error" in m;
}

function renderCAPAAdd(data: CAPAAddModel, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderCAPAAdded(data.relPath, log);
}

function renderCAPAUpdate(data: CAPAUpdateModel, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderCAPAUpdated(data.name, data.status, log);
}

export const commands: Record<string, CommandHandler> = {
	"capa:list": adaptDescriptor<Record<string, unknown>, CAPAListModel>({
		requires: "project",
		handler: (ctx) => listCAPAItems(ctx.deps, ctx.project!.path, ctx.project!.config.management?.capa),
		renderer: renderCAPAList,
	}),

	"capa:add": adaptDescriptor<Record<string, unknown>, CAPAAddModel>({
		requires: "project",
		flags: {
			name: { type: "string", required: true, hint: 'Usage: flowti capa:add --name="Process Failure" --capa-type="corrective"' },
			"capa-type": { type: "string", default: "corrective" },
			id: { type: "string", default: "" },
			severity: { type: "string", default: "medium" },
			source: { type: "string", default: "observation" },
			owner: { type: "string", default: "" },
			due: { type: "string", default: "" },
			"root-cause": { type: "string", default: "" },
			description: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const name = ctx.flags.name as string;
			const capaType = (ctx.flags["capa-type"] as string) as CAPAType;
			if (!VALID_TYPES.includes(capaType)) {
				return { error: `Invalid capa-type "${capaType}". Valid: ${VALID_TYPES.join(", ")}` } as ErrorModel;
			}
			const existing = listCAPAItems(ctx.deps, ctx.project!.path, ctx.project!.config.management?.capa);
			const id = (ctx.flags.id as string) || nextCapaId(existing.map((c) => c.id));
			const filePath = createCAPAItem(ctx.deps, ctx.project!.path, {
				name, id, capaType,
				status: "open",
				severity: (ctx.flags.severity as string) as CAPASeverity,
				source: (ctx.flags.source as string) as CAPASource,
				owner: (ctx.flags.owner as string) || undefined,
				dueDate: (ctx.flags.due as string) || undefined,
				rootCause: (ctx.flags["root-cause"] as string) || undefined,
				description: ctx.flags.description as string,
			}, ctx.project!.config.management?.capa);
			if (filePath) {
				return { relPath: ctx.deps.paths.relative(ctx.project!.path, filePath) };
			}
			return { error: "Failed to create CAPA item." } as ErrorModel;
		},
		renderer: renderCAPAAdd,
	}),

	"capa:update": adaptDescriptor<Record<string, unknown>, CAPAUpdateModel>({
		requires: "project",
		flags: {
			name: { type: "string", required: true, hint: 'Usage: flowti capa:update --name="Process Failure" --status="investigating"' },
			status: { type: "string", required: true, hint: 'Usage: flowti capa:update --name="Process Failure" --status="investigating"' },
		},
		handler: (ctx) => {
			const name = ctx.flags.name as string;
			const status = ctx.flags.status as string;
			if (!VALID_STATUSES.includes(status as CAPAStatus)) {
				return { error: `Invalid status "${status}". Valid: ${VALID_STATUSES.join(", ")}` } as ErrorModel;
			}
			const ok = updateCAPAStatus(ctx.deps, ctx.project!.path, name, status as CAPAStatus, ctx.project!.config.management?.capa);
			if (ok) {
				return { name, status };
			}
			return { error: `Failed to update CAPA item "${name}".` } as ErrorModel;
		},
		renderer: renderCAPAUpdate,
	}),
};
