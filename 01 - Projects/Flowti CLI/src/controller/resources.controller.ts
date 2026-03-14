/**
 * resources.controller.ts — Controller for project resource management commands.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler, ResourceType } from "../infrastructure/types.js";
import { listResources, createResourceFile } from "../domain/resources/resource-store.js";
import { analyzeFinancials } from "../domain/resources/resource-analysis.js";
import { renderResourceList, renderFinancialSummary, renderResourceAdded } from "../ui/displays/resources-display.js";
import { renderError } from "../ui/renderers/common-renderers.js";
import type { ErrorModel } from "../ui/renderers/common-renderers.js";

const VALID_TYPES: ResourceType[] = ["human", "material", "role", "budget"];

function flagStr(flags: Record<string, string | boolean>, key: string, fallback: string): string {
	return typeof flags[key] === "string" ? flags[key] : fallback;
}

function createResourceAction(req: Parameters<ControllerAction>[0], name: string, resourceType: ResourceType) {
	const { paths } = req.deps;
	const price = resourceType === "budget" ? 1 : parseFloat(flagStr(req.flags, "price", "0"));
	const filePath = createResourceFile(req.deps, req.project!.path, {
		name, resourceType,
		role: flagStr(req.flags, "role", ""),
		price,
		hourlyRate: resourceType === "role" ? price : undefined,
		amount: parseFloat(flagStr(req.flags, "amount", "1")),
		consumed: 0,
		status: "active",
		description: flagStr(req.flags, "description", ""),
		category: flagStr(req.flags, "category", "") || undefined,
		currency: flagStr(req.flags, "currency", "") || undefined,
		periodStart: flagStr(req.flags, "period-start", "") || undefined,
		periodEnd: flagStr(req.flags, "period-end", "") || undefined,
	}, req.project!.config.management?.resources);
	if (filePath) {
		return dataResponse(
			{ relPath: paths.relative(req.project!.path, filePath) },
			(m: { relPath: string }) => renderResourceAdded(m.relPath, req.deps.log),
		);
	}
}

const actions: Record<string, ControllerAction> = {
	"resources:list": (req) => {
		if (!req.project) return;
		const resources = listResources(req.deps, req.project.path, req.project.config.management?.resources);
		return dataResponse(resources, (d) => renderResourceList(d, req.deps.log));
	},

	"resources:add": (req) => {
		if (!req.project) return;
		const name = req.flags.name;
		if (!name || typeof name !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --name flag.", hint: 'Usage: flowti resources:add --name="Jane Doe" --type="human"' },
				(d) => renderError(req.deps.log, d),
			);
		}
		const resourceType = flagStr(req.flags, "type", "human") as ResourceType;
		if (!VALID_TYPES.includes(resourceType)) {
			return dataResponse<ErrorModel>(
				{ error: `Invalid type "${resourceType}". Valid: ${VALID_TYPES.join(", ")}` },
				(d) => renderError(req.deps.log, d),
			);
		}
		return createResourceAction(req, name, resourceType);
	},

	"resources:summary": (req) => {
		if (!req.project) return;
		const resources = listResources(req.deps, req.project.path, req.project.config.management?.resources);
		const summary = analyzeFinancials(resources);
		return dataResponse(summary, (d) => renderFinancialSummary(d, req.deps.log));
	},
};

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
