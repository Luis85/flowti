/**
 * requirements.controller.ts — Controller for IREB requirements management commands.
 */

import { adaptDescriptor } from "../infrastructure/command-engine.js";
import type { CommandHandler, RequirementType, MoSCoWPriority } from "../infrastructure/types.js";
import {
	requirementStore, useCaseStore, userStoryStore,
	createRequirement, createUseCase, createUserStory, nextId,
} from "../domain/requirements/requirement-store.js";
import type { RequirementStatus } from "../domain/requirements/requirement-types.js";
import {
	renderRequirementList, renderUseCaseList, renderUserStoryList,
	renderRequirementAdded, renderRequirementUpdated,
} from "../ui/displays/requirements-display.js";
import { renderError } from "../ui/renderers/common-renderers.js";
import type { ErrorModel } from "../ui/renderers/common-renderers.js";
import type { LogFn, CommandContext } from "../infrastructure/command-engine.js";

const VALID_TYPES: RequirementType[] = ["functional", "non-functional", "constraint"];
const VALID_STATUSES: RequirementStatus[] = ["draft", "proposed", "approved", "implemented", "verified", "rejected", "deferred"];

const REQ_DEFAULT_DIR = "docs/requirements";

type ReqListModel = ReturnType<typeof requirementStore.list>;
type UseCaseListModel = ReturnType<typeof useCaseStore.list>;
type UserStoryListModel = ReturnType<typeof userStoryStore.list>;
type ReqAddModel = { relPath: string } | ErrorModel;
type ReqUpdateModel = { name: string; status: string } | ErrorModel;

function isErrorModel(m: unknown): m is ErrorModel {
	return typeof m === "object" && m !== null && "error" in m;
}

function renderReqAdd(data: ReqAddModel, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderRequirementAdded(data.relPath, log);
}

function renderReqUpdate(data: ReqUpdateModel, log: LogFn): void {
	if (isErrorModel(data)) { renderError(data, log); return; }
	renderRequirementUpdated(data.name, data.status, log);
}

function createStoryResult(ctx: CommandContext, name: string, role: string, goal: string, benefit: string): ReqAddModel {
	const reqConfig = ctx.project!.config.management?.requirements;
	const existing = userStoryStore.list(ctx.deps, ctx.project!.path, { dir: `${reqConfig?.dir ?? REQ_DEFAULT_DIR}/user-stories` });
	const idFlag = ctx.flags.id as string | undefined;
	const id = idFlag || nextId("US", existing.map((s) => s.id));
	const pointsStr = ctx.flags.points as string | undefined;
	const pts = parseInt(pointsStr ?? "0", 10);
	const filePath = createUserStory(ctx.deps, ctx.project!.path, {
		name, id, role, goal, benefit,
		storyPoints: isNaN(pts) ? undefined : pts,
		status: "backlog",
		description: (ctx.flags.description as string) ?? "",
	}, ctx.project!.config.management?.requirements);
	if (filePath) {
		return { relPath: ctx.deps.paths.relative(ctx.project!.path, filePath) };
	}
	return { error: "Failed to create user story." } as ErrorModel;
}

export const commands: Record<string, CommandHandler> = {
	"requirements:list": adaptDescriptor<Record<string, unknown>, ReqListModel>({
		requires: "project",
		handler: (ctx) => requirementStore.list(ctx.deps, ctx.project!.path, ctx.project!.config.management?.requirements ? { dir: ctx.project!.config.management.requirements.dir } : undefined),
		renderer: renderRequirementList,
	}),

	"requirements:add": adaptDescriptor<Record<string, unknown>, ReqAddModel>({
		requires: "project",
		flags: {
			name: { type: "string", required: true, hint: 'Usage: flowti requirements:add --name="User Auth" --type="functional"' },
			type: { type: "string", default: "functional" },
			id: { type: "string", default: "" },
			status: { type: "string", default: "draft" },
			priority: { type: "string", default: "should" },
			source: { type: "string", default: "" },
			rationale: { type: "string", default: "" },
			description: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const name = ctx.flags.name as string;
			const reqType = (ctx.flags.type as string) as RequirementType;
			if (!VALID_TYPES.includes(reqType)) {
				return { error: `Invalid type "${reqType}". Valid: ${VALID_TYPES.join(", ")}` } as ErrorModel;
			}
			const existing = requirementStore.list(ctx.deps, ctx.project!.path, ctx.project!.config.management?.requirements ? { dir: ctx.project!.config.management.requirements.dir } : undefined);
			const id = (ctx.flags.id as string) || nextId("REQ", existing.map((r) => r.id));
			const priority = (ctx.flags.priority as string) as MoSCoWPriority;
			const filePath = createRequirement(ctx.deps, ctx.project!.path, {
				name,
				requirementType: reqType,
				id,
				status: (ctx.flags.status as string) as RequirementStatus,
				priority,
				source: (ctx.flags.source as string) || undefined,
				rationale: (ctx.flags.rationale as string) || undefined,
				description: ctx.flags.description as string,
			}, ctx.project!.config.management?.requirements);
			if (filePath) {
				return { relPath: ctx.deps.paths.relative(ctx.project!.path, filePath) };
			}
			return { error: "Failed to create requirement." } as ErrorModel;
		},
		renderer: renderReqAdd,
	}),

	"requirements:update": adaptDescriptor<Record<string, unknown>, ReqUpdateModel>({
		requires: "project",
		flags: {
			name: { type: "string", required: true, hint: 'Usage: flowti requirements:update --name="User Auth" --status="approved"' },
			status: { type: "string", required: true, hint: 'Usage: flowti requirements:update --name="User Auth" --status="approved"' },
		},
		handler: (ctx) => {
			const name = ctx.flags.name as string;
			const status = ctx.flags.status as string;
			if (!VALID_STATUSES.includes(status as RequirementStatus)) {
				return { error: `Invalid status "${status}". Valid: ${VALID_STATUSES.join(", ")}` } as ErrorModel;
			}
			const ok = requirementStore.updateField(ctx.deps, ctx.project!.path, name, "status", status, ctx.project!.config.management?.requirements ? { dir: ctx.project!.config.management.requirements.dir } : undefined);
			if (ok) {
				return { name, status };
			}
			return { error: `Failed to update requirement "${name}".` } as ErrorModel;
		},
		renderer: renderReqUpdate,
	}),

	"usecases:list": adaptDescriptor<Record<string, unknown>, UseCaseListModel>({
		requires: "project",
		handler: (ctx) => {
			const reqConfig = ctx.project!.config.management?.requirements;
			return useCaseStore.list(ctx.deps, ctx.project!.path, { dir: `${reqConfig?.dir ?? REQ_DEFAULT_DIR}/use-cases` });
		},
		renderer: renderUseCaseList,
	}),

	"usecases:add": adaptDescriptor<Record<string, unknown>, ReqAddModel>({
		requires: "project",
		flags: {
			name: { type: "string", required: true, hint: 'Usage: flowti usecases:add --name="User Login" --actor="End User"' },
			actor: { type: "string", required: true, hint: 'Usage: flowti usecases:add --name="User Login" --actor="End User"' },
			id: { type: "string", default: "" },
			description: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const name = ctx.flags.name as string;
			const actor = ctx.flags.actor as string;
			const reqConfig = ctx.project!.config.management?.requirements;
			const existing = useCaseStore.list(ctx.deps, ctx.project!.path, { dir: `${reqConfig?.dir ?? REQ_DEFAULT_DIR}/use-cases` });
			const id = (ctx.flags.id as string) || nextId("UC", existing.map((uc) => uc.id));
			const filePath = createUseCase(ctx.deps, ctx.project!.path, {
				name, id, actor,
				description: ctx.flags.description as string,
			}, ctx.project!.config.management?.requirements);
			if (filePath) {
				return { relPath: ctx.deps.paths.relative(ctx.project!.path, filePath) };
			}
			return { error: "Failed to create use case." } as ErrorModel;
		},
		renderer: renderReqAdd,
	}),

	"stories:list": adaptDescriptor<Record<string, unknown>, UserStoryListModel>({
		requires: "project",
		handler: (ctx) => {
			const reqConfig = ctx.project!.config.management?.requirements;
			return userStoryStore.list(ctx.deps, ctx.project!.path, { dir: `${reqConfig?.dir ?? REQ_DEFAULT_DIR}/user-stories` });
		},
		renderer: renderUserStoryList,
	}),

	"stories:add": adaptDescriptor<Record<string, unknown>, ReqAddModel>({
		requires: "project",
		flags: {
			name: { type: "string", required: true, hint: 'Usage: flowti stories:add --name="Login Story" --role="User" --goal="log in" --benefit="access dashboard"' },
			role: { type: "string", required: true, hint: 'Usage: flowti stories:add --name="Login Story" --role="User" --goal="log in" --benefit="access dashboard"' },
			goal: { type: "string", required: true, hint: 'Usage: flowti stories:add --name="Login Story" --role="User" --goal="log in" --benefit="access dashboard"' },
			benefit: { type: "string", required: true, hint: 'Usage: flowti stories:add --name="Login Story" --role="User" --goal="log in" --benefit="access dashboard"' },
			id: { type: "string", default: "" },
			points: { type: "string", default: "0" },
			description: { type: "string", default: "" },
		},
		handler: (ctx) => {
			const name = ctx.flags.name as string;
			const role = ctx.flags.role as string;
			const goal = ctx.flags.goal as string;
			const benefit = ctx.flags.benefit as string;
			return createStoryResult(ctx, name, role, goal, benefit);
		},
		renderer: renderReqAdd,
	}),
};
