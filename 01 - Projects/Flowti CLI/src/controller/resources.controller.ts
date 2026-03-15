/**
 * resources.controller.ts — Controller for project resource management commands.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler, ResourceType } from "../infrastructure/types.js";
import { listResources, createResourceFile } from "../domain/resources/resource-store.js";
import { analyzeFinancials } from "../domain/resources/resource-analysis.js";
import { renderResourceList, renderFinancialSummary, renderResourceAdded } from "../ui/displays/resources-display.js";
import { renderError } from "../ui/renderers/common-renderers.js";
import type { ErrorModel } from "../ui/renderers/common-renderers.js";
import type { LogFn } from "../infrastructure/command-engine.js";

const VALID_TYPES: ResourceType[] = ["human", "material", "role", "budget"];

type ResourceListModel = ReturnType<typeof listResources>;
type FinancialSummaryModel = ReturnType<typeof analyzeFinancials>;
type ResourceAddModel = { relPath: string } | ErrorModel;

function isErrorModel(m: unknown): m is ErrorModel {
	return typeof m === "object" && m !== null && "error" in m;
}

function renderResourceAdd(data: ResourceAddModel, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderResourceAdded(data.relPath, log);
}

export const commands: Record<string, CommandHandler> = {
	"resources:list": adaptDescriptor<Record<string, unknown>, ResourceListModel>({
		requires: "project",
		handler: (ctx) => listResources(ctx.deps, ctx.project!.path, ctx.project!.config.management?.resources),
		renderer: renderResourceList,
	}),

	"resources:add": adaptDescriptor<Record<string, unknown>, ResourceAddModel>({
		requires: "project",
		flags: {
			name: { type: "string", required: true, hint: 'Usage: flowti resources:add --name="Jane Doe" --type="human"' },
			type: { type: "string", default: "human" },
			role: { type: "string", default: "" },
			price: { type: "string", default: "0" },
			amount: { type: "string", default: "1" },
			description: { type: "string", default: "" },
			category: { type: "string", default: "" },
			currency: { type: "string", default: "" },
			"period-start": { type: "string", default: "" },
			"period-end": { type: "string", default: "" },
		},
		handler: (ctx) => {
			const name = ctx.flags.name as string;
			const resourceType = (ctx.flags.type as string) as ResourceType;
			if (!VALID_TYPES.includes(resourceType)) {
				return { error: `Invalid type "${resourceType}". Valid: ${VALID_TYPES.join(", ")}` } as ErrorModel;
			}
			const price = resourceType === "budget" ? 1 : parseFloat(ctx.flags.price as string);
			const filePath = createResourceFile(ctx.deps, ctx.project!.path, {
				name, resourceType,
				role: ctx.flags.role as string,
				price,
				hourlyRate: resourceType === "role" ? price : undefined,
				amount: parseFloat(ctx.flags.amount as string),
				consumed: 0,
				status: "active",
				description: ctx.flags.description as string,
				category: (ctx.flags.category as string) || undefined,
				currency: (ctx.flags.currency as string) || undefined,
				periodStart: (ctx.flags["period-start"] as string) || undefined,
				periodEnd: (ctx.flags["period-end"] as string) || undefined,
			}, ctx.project!.config.management?.resources);
			if (filePath) {
				return { relPath: ctx.deps.paths.relative(ctx.project!.path, filePath) };
			}
			return { error: "Failed to create resource." } as ErrorModel;
		},
		renderer: renderResourceAdd,
	}),

	"resources:summary": adaptDescriptor<Record<string, unknown>, FinancialSummaryModel>({
		requires: "project",
		handler: (ctx) => {
			const resources = listResources(ctx.deps, ctx.project!.path, ctx.project!.config.management?.resources);
			return analyzeFinancials(resources);
		},
		renderer: renderFinancialSummary,
	}),
};
