/**
 * raid.controller.ts — Controller for RAID log management commands.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler, RAIDItemType, RAIDStatus } from "../infrastructure/types.js";
import { listRAIDItems, createRAIDItem, updateRAIDStatus } from "../domain/raid/raid-store.js";
import { renderRAIDList, renderRAIDAdded, renderRAIDUpdated } from "../ui/raid-display.js";
import { renderError } from "../ui/common-renderers.js";
import type { ErrorModel } from "../ui/common-renderers.js";

const VALID_TYPES: RAIDItemType[] = ["risk", "assumption", "issue", "dependency", "decision"];
const VALID_STATUSES: RAIDStatus[] = ["open", "mitigated", "closed", "accepted", "resolved", "deferred"];

function flagStr(flags: Record<string, string | boolean>, key: string, fallback: string): string {
	return typeof flags[key] === "string" ? flags[key] : fallback;
}

const actions: Record<string, ControllerAction> = {
	"raid:list": (req) => {
		if (!req.project) return;
		const items = listRAIDItems(req.deps, req.project.path, req.project.config.management?.raid);
		return dataResponse(items, renderRAIDList);
	},

	"raid:add": (req) => {
		if (!req.project) return;
		const { paths } = req.deps;
		const name = req.flags.name;
		if (!name || typeof name !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --name flag.", hint: 'Usage: flowti raid:add --name="DB Migration Risk" --item-type="risk"' },
				renderError,
			);
		}
		const itemType = flagStr(req.flags, "item-type", "risk") as RAIDItemType;
		if (!VALID_TYPES.includes(itemType)) {
			return dataResponse<ErrorModel>(
				{ error: `Invalid item-type "${itemType}". Valid: ${VALID_TYPES.join(", ")}` },
				renderError,
			);
		}
		const filePath = createRAIDItem(req.deps, req.project.path, {
			name,
			itemType,
			status: "open",
			severity: flagStr(req.flags, "severity", "medium") as "critical" | "high" | "medium" | "low",
			owner: flagStr(req.flags, "owner", "") || undefined,
			dueDate: flagStr(req.flags, "due", "") || undefined,
			category: (flagStr(req.flags, "category", "technical") as "technical" | "business" | "organizational" | "external") || undefined,
			description: flagStr(req.flags, "description", ""),
		}, req.project.config.management?.raid);
		if (filePath) {
			return dataResponse(
				{ relPath: paths.relative(req.project.path, filePath) },
				(m: { relPath: string }) => renderRAIDAdded(m.relPath),
			);
		}
	},

	"raid:update": (req) => {
		if (!req.project) return;
		const name = req.flags.name;
		const status = req.flags.status;
		if (!name || typeof name !== "string" || !status || typeof status !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --name and/or --status flag.", hint: 'Usage: flowti raid:update --name="DB Risk" --status="mitigated"' },
				renderError,
			);
		}
		if (!VALID_STATUSES.includes(status as RAIDStatus)) {
			return dataResponse<ErrorModel>(
				{ error: `Invalid status "${status}". Valid: ${VALID_STATUSES.join(", ")}` },
				renderError,
			);
		}
		const ok = updateRAIDStatus(req.deps, req.project.path, name, status as RAIDStatus, req.project.config.management?.raid);
		if (ok) {
			return dataResponse(
				{ name, status },
				(m: { name: string; status: string }) => renderRAIDUpdated(m.name, m.status),
			);
		}
	},
};

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
