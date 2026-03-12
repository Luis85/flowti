/**
 * capa.controller.ts — Controller for CAPA management commands.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler, CAPAStatus, CAPAType } from "../infrastructure/types.js";
import type { CAPASource, CAPASeverity } from "../domain/capa/capa-types.js";
import { listCAPAItems, createCAPAItem, updateCAPAStatus, nextCapaId } from "../domain/capa/capa-store.js";
import { renderCAPAList, renderCAPAAdded, renderCAPAUpdated } from "../ui/capa-display.js";
import { renderError } from "../ui/common-renderers.js";
import type { ErrorModel } from "../ui/common-renderers.js";

const VALID_TYPES: CAPAType[] = ["corrective", "preventive"];
const VALID_STATUSES: CAPAStatus[] = ["open", "investigating", "action-planned", "implementing", "verification", "closed", "rejected"];
const VALID_SEVERITIES: CAPASeverity[] = ["critical", "high", "medium", "low"];
const VALID_SOURCES: CAPASource[] = ["audit", "complaint", "incident", "observation", "review", "other"];

function flagStr(flags: Record<string, string | boolean>, key: string, fallback: string): string {
	return typeof flags[key] === "string" ? flags[key] : fallback;
}

const actions: Record<string, ControllerAction> = {
	"capa:list": (req) => {
		if (!req.project) return;
		const items = listCAPAItems(req.deps, req.project.path, req.project.config.management?.capa);
		return dataResponse(items, renderCAPAList);
	},

	"capa:add": (req) => {
		if (!req.project) return;
		const { paths } = req.deps;
		const name = req.flags.name;
		if (!name || typeof name !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --name flag.", hint: 'Usage: flowti capa:add --name="Process Failure" --capa-type="corrective"' },
				renderError,
			);
		}
		const capaType = flagStr(req.flags, "capa-type", "corrective") as CAPAType;
		if (!VALID_TYPES.includes(capaType)) {
			return dataResponse<ErrorModel>(
				{ error: `Invalid capa-type "${capaType}". Valid: ${VALID_TYPES.join(", ")}` },
				renderError,
			);
		}
		const existing = listCAPAItems(req.deps, req.project.path, req.project.config.management?.capa);
		const id = flagStr(req.flags, "id", nextCapaId(existing.map((c) => c.id)));

		const filePath = createCAPAItem(req.deps, req.project.path, {
			name,
			id,
			capaType,
			status: "open",
			severity: flagStr(req.flags, "severity", "medium") as CAPASeverity,
			source: flagStr(req.flags, "source", "observation") as CAPASource,
			owner: flagStr(req.flags, "owner", "") || undefined,
			dueDate: flagStr(req.flags, "due", "") || undefined,
			rootCause: flagStr(req.flags, "root-cause", "") || undefined,
			description: flagStr(req.flags, "description", ""),
		}, req.project.config.management?.capa);
		if (filePath) {
			return dataResponse(
				{ relPath: paths.relative(req.project.path, filePath) },
				(m: { relPath: string }) => renderCAPAAdded(m.relPath),
			);
		}
	},

	"capa:update": (req) => {
		if (!req.project) return;
		const name = req.flags.name;
		const status = req.flags.status;
		if (!name || typeof name !== "string" || !status || typeof status !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --name and/or --status flag.", hint: 'Usage: flowti capa:update --name="Process Failure" --status="investigating"' },
				renderError,
			);
		}
		if (!VALID_STATUSES.includes(status as CAPAStatus)) {
			return dataResponse<ErrorModel>(
				{ error: `Invalid status "${status}". Valid: ${VALID_STATUSES.join(", ")}` },
				renderError,
			);
		}
		const ok = updateCAPAStatus(req.deps, req.project.path, name, status as CAPAStatus, req.project.config.management?.capa);
		if (ok) {
			return dataResponse(
				{ name, status },
				(m: { name: string; status: string }) => renderCAPAUpdated(m.name, m.status),
			);
		}
	},
};

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
