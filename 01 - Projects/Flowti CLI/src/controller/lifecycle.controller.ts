/**
 * lifecycle.controller.ts — Controller for lifecycle management commands.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler, EntityType, LifecycleState } from "../infrastructure/types.js";
import { listLifecycleItems, readLifecycleItem, createLifecycleFile, transitionLifecycleItem, getLifecycleHistory } from "../domain/lifecycle/lifecycle-store.js";
import { renderLifecycleStatus, renderLifecycleList, renderTransitionResult, renderTransitionHistory, renderLifecycleCreated } from "../ui/displays/lifecycle-display.js";
import { renderError } from "../ui/renderers/common-renderers.js";
import type { ErrorModel } from "../ui/renderers/common-renderers.js";

const VALID_TYPES: EntityType[] = ["project", "product", "feature"];

function flagStr(flags: Record<string, string | boolean>, key: string, fallback: string): string {
	return typeof flags[key] === "string" ? flags[key] : fallback;
}

const actions: Record<string, ControllerAction> = {
	"lifecycle:list": (req) => {
		if (!req.project) return;
		const entityType = flagStr(req.flags, "type", "") as EntityType;
		const subdir = flagStr(req.flags, "subdir", "") || undefined;
		const items = listLifecycleItems(req.deps, req.project.path, subdir);
		const filtered = entityType && VALID_TYPES.includes(entityType)
			? items.filter((i) => i.entityType === entityType)
			: items;
		return dataResponse(filtered, renderLifecycleList);
	},

	"lifecycle:status": (req) => {
		if (!req.project) return;
		const name = flagStr(req.flags, "name", "");
		if (!name) {
			return dataResponse<ErrorModel>(
				{ error: "Missing --name flag.", hint: 'Usage: flowti lifecycle:status --name="My Feature"' },
				renderError,
			);
		}
		const subdir = flagStr(req.flags, "subdir", "") || undefined;
		const record = readLifecycleItem(req.deps, req.project.path, name, subdir);
		if (!record) {
			return dataResponse<ErrorModel>(
				{ error: `Lifecycle not found for "${name}".` },
				renderError,
			);
		}
		return dataResponse(record, renderLifecycleStatus);
	},

	"lifecycle:transition": (req) => {
		if (!req.project) return;
		const name = flagStr(req.flags, "name", "");
		const to = flagStr(req.flags, "to", "");
		const reason = flagStr(req.flags, "reason", "");
		if (!name || !to) {
			return dataResponse<ErrorModel>(
				{ error: "Missing --name and/or --to flag.", hint: 'Usage: flowti lifecycle:transition --name="My Feature" --to=development --reason="Ready"' },
				renderError,
			);
		}
		if (!reason) {
			return dataResponse<ErrorModel>(
				{ error: "Missing --reason flag.", hint: 'Provide a reason for the transition.' },
				renderError,
			);
		}
		const subdir = flagStr(req.flags, "subdir", "") || undefined;
		const result = transitionLifecycleItem(req.deps, req.project.path, name, to as LifecycleState, reason, subdir);
		return dataResponse(result, renderTransitionResult);
	},

	"lifecycle:history": (req) => {
		if (!req.project) return;
		const name = flagStr(req.flags, "name", "");
		if (!name) {
			return dataResponse<ErrorModel>(
				{ error: "Missing --name flag.", hint: 'Usage: flowti lifecycle:history --name="My Feature"' },
				renderError,
			);
		}
		const subdir = flagStr(req.flags, "subdir", "") || undefined;
		const history = getLifecycleHistory(req.deps, req.project.path, name, subdir);
		return dataResponse(history, renderTransitionHistory);
	},

	"lifecycle:create": (req) => {
		if (!req.project) return;
		const { paths } = req.deps;
		const name = flagStr(req.flags, "name", "");
		const entityType = flagStr(req.flags, "type", "feature") as EntityType;
		if (!name) {
			return dataResponse<ErrorModel>(
				{ error: "Missing --name flag.", hint: 'Usage: flowti lifecycle:create --name="My Feature" --type=feature' },
				renderError,
			);
		}
		if (!VALID_TYPES.includes(entityType)) {
			return dataResponse<ErrorModel>(
				{ error: `Invalid type "${entityType}". Valid: ${VALID_TYPES.join(", ")}` },
				renderError,
			);
		}
		const description = flagStr(req.flags, "description", "") || undefined;
		const subdir = flagStr(req.flags, "subdir", "") || undefined;
		const filePath = createLifecycleFile(req.deps, req.project.path, entityType, name, description, subdir);
		if (filePath) {
			return dataResponse(
				{ relPath: paths.relative(req.project.path, filePath) },
				(m: { relPath: string }) => renderLifecycleCreated(m.relPath),
			);
		}
		return dataResponse<ErrorModel>(
			{ error: `Item "${name}" already exists.` },
			renderError,
		);
	},
};

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
