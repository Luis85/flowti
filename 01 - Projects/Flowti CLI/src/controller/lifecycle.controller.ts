/**
 * lifecycle.controller.ts — Controller for lifecycle management commands.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler, EntityType, LifecycleState } from "../infrastructure/types.js";
import { listLifecycleItems, readLifecycleItem, createLifecycleFile, transitionLifecycleItem, getLifecycleHistory } from "../domain/lifecycle/lifecycle-store.js";
import { renderLifecycleStatus, renderLifecycleList, renderTransitionResult, renderTransitionHistory, renderLifecycleCreated } from "../ui/displays/lifecycle-display.js";
import { renderError } from "../ui/renderers/common-renderers.js";
import type { ErrorModel } from "../ui/renderers/common-renderers.js";
import type { LogFn } from "../infrastructure/command-engine.js";

const VALID_TYPES: EntityType[] = ["project", "product", "feature"];

type LifecycleListModel = ReturnType<typeof listLifecycleItems>;
type LifecycleStatusModel = ReturnType<typeof readLifecycleItem> | ErrorModel;
type TransitionModel = ReturnType<typeof transitionLifecycleItem> | ErrorModel;
type HistoryModel = ReturnType<typeof getLifecycleHistory> | ErrorModel;
type LifecycleCreateModel = { relPath: string } | ErrorModel;

function isErrorModel(m: unknown): m is ErrorModel {
	return typeof m === "object" && m !== null && "error" in m;
}

function renderLifecycleStatusOrError(data: LifecycleStatusModel, log: LogFn): void {
	if (isErrorModel(data) || data == null) {
		renderError(isErrorModel(data) ? data : { error: "Not found." }, log);
		return;
	}
	renderLifecycleStatus(data, log);
}

function renderTransitionOrError(data: TransitionModel, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderTransitionResult(data, log);
}

function renderHistoryOrError(data: HistoryModel, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderTransitionHistory(data as ReturnType<typeof getLifecycleHistory>, log);
}

function renderLifecycleCreateOrError(data: LifecycleCreateModel, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderLifecycleCreated(data.relPath, log);
}

export const commands: Record<string, CommandHandler> = {
	"lifecycle:list": adaptDescriptor<Record<string, unknown>, LifecycleListModel>({
		requires: "project",
		flags: {
			type: { type: "string", default: "" },
			subdir: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const entityType = (ctx.flags.type as string) as EntityType;
			const subdir = (ctx.flags.subdir as string) || undefined;
			const items = listLifecycleItems(ctx.deps, ctx.project!.path, subdir);
			const filtered = entityType && VALID_TYPES.includes(entityType)
				? items.filter((i) => i.entityType === entityType)
				: items;
			return filtered;
		},
		renderer: renderLifecycleList,
	}),

	"lifecycle:status": adaptDescriptor<Record<string, unknown>, LifecycleStatusModel>({
		requires: "project",
		flags: {
			name: { type: "string", required: true, hint: 'Usage: flowti lifecycle:status --name="My Feature"' },
			subdir: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const name = ctx.flags.name as string;
			const subdir = (ctx.flags.subdir as string) || undefined;
			const record = readLifecycleItem(ctx.deps, ctx.project!.path, name, subdir);
			if (!record) {
				return { error: `Lifecycle not found for "${name}".` } as ErrorModel;
			}
			return record;
		},
		renderer: renderLifecycleStatusOrError,
	}),

	"lifecycle:transition": adaptDescriptor<Record<string, unknown>, TransitionModel>({
		requires: "project",
		flags: {
			name: { type: "string", required: true, hint: 'Usage: flowti lifecycle:transition --name="My Feature" --to=development --reason="Ready"' },
			to: { type: "string", required: true, hint: 'Usage: flowti lifecycle:transition --name="My Feature" --to=development --reason="Ready"' },
			reason: { type: "string", required: true, hint: "Provide a reason for the transition." },
			subdir: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const name = ctx.flags.name as string;
			const to = ctx.flags.to as string;
			const reason = ctx.flags.reason as string;
			const subdir = (ctx.flags.subdir as string) || undefined;
			return transitionLifecycleItem(ctx.deps, ctx.project!.path, name, to as LifecycleState, reason, subdir);
		},
		renderer: renderTransitionOrError,
	}),

	"lifecycle:history": adaptDescriptor<Record<string, unknown>, HistoryModel>({
		requires: "project",
		flags: {
			name: { type: "string", required: true, hint: 'Usage: flowti lifecycle:history --name="My Feature"' },
			subdir: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const name = ctx.flags.name as string;
			const subdir = (ctx.flags.subdir as string) || undefined;
			return getLifecycleHistory(ctx.deps, ctx.project!.path, name, subdir);
		},
		renderer: renderHistoryOrError,
	}),

	"lifecycle:create": adaptDescriptor<Record<string, unknown>, LifecycleCreateModel>({
		requires: "project",
		flags: {
			name: { type: "string", required: true, hint: 'Usage: flowti lifecycle:create --name="My Feature" --type=feature' },
			type: { type: "string", default: "feature" },
			description: { type: "string", default: "" },
			subdir: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const name = ctx.flags.name as string;
			const entityType = (ctx.flags.type as string) as EntityType;
			if (!VALID_TYPES.includes(entityType)) {
				return { error: `Invalid type "${entityType}". Valid: ${VALID_TYPES.join(", ")}` } as ErrorModel;
			}
			const description = (ctx.flags.description as string) || undefined;
			const subdir = (ctx.flags.subdir as string) || undefined;
			const filePath = createLifecycleFile(ctx.deps, ctx.project!.path, entityType, name, description, subdir);
			if (filePath) {
				return { relPath: ctx.deps.paths.relative(ctx.project!.path, filePath) };
			}
			return { error: `Item "${name}" already exists.` } as ErrorModel;
		},
		renderer: renderLifecycleCreateOrError,
	}),
};
