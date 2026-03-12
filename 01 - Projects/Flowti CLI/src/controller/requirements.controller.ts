/**
 * requirements.controller.ts — Controller for IREB requirements management commands.
 */

import type { ControllerAction } from "../infrastructure/request-response.js";
import { adapt, dataResponse } from "../infrastructure/request-response.js";
import type { CommandHandler, RequirementType, MoSCoWPriority } from "../infrastructure/types.js";
import {
	listRequirements, createRequirement, updateRequirementStatus, nextId,
	listUseCases, createUseCase,
	listUserStories, createUserStory,
} from "../domain/requirements/requirement-store.js";
import type { RequirementStatus } from "../domain/requirements/requirement-types.js";
import {
	renderRequirementList, renderUseCaseList, renderUserStoryList,
	renderRequirementAdded, renderRequirementUpdated,
} from "../ui/requirements-display.js";
import { renderError } from "../ui/common-renderers.js";
import type { ErrorModel } from "../ui/common-renderers.js";

const VALID_TYPES: RequirementType[] = ["functional", "non-functional", "constraint"];
const VALID_STATUSES: RequirementStatus[] = ["draft", "proposed", "approved", "implemented", "verified", "rejected", "deferred"];

function flagStr(flags: Record<string, string | boolean>, key: string, fallback: string): string {
	return typeof flags[key] === "string" ? flags[key] : fallback;
}

function createStoryAction(req: Parameters<ControllerAction>[0], name: string, role: string, goal: string, benefit: string) {
	const { paths } = req.deps;
	const existing = listUserStories(req.deps, req.project!.path, req.project!.config.management?.requirements);
	const id = flagStr(req.flags, "id", nextId("US", existing.map((s) => s.id)));
	const pts = parseInt(flagStr(req.flags, "points", "0"), 10);
	const filePath = createUserStory(req.deps, req.project!.path, {
		name, id, role, goal, benefit,
		storyPoints: isNaN(pts) ? undefined : pts,
		status: "backlog",
		description: flagStr(req.flags, "description", ""),
	}, req.project!.config.management?.requirements);
	if (filePath) {
		return dataResponse(
			{ relPath: paths.relative(req.project!.path, filePath) },
			(m: { relPath: string }) => renderRequirementAdded(m.relPath),
		);
	}
}

const actions: Record<string, ControllerAction> = {
	"requirements:list": (req) => {
		if (!req.project) return;
		const reqs = listRequirements(req.deps, req.project.path, req.project.config.management?.requirements);
		return dataResponse(reqs, renderRequirementList);
	},

	"requirements:add": (req) => {
		if (!req.project) return;
		const { paths } = req.deps;
		const name = req.flags.name;
		if (!name || typeof name !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --name flag.", hint: 'Usage: flowti requirements:add --name="User Auth" --type="functional"' },
				renderError,
			);
		}
		const reqType = flagStr(req.flags, "type", "functional") as RequirementType;
		if (!VALID_TYPES.includes(reqType)) {
			return dataResponse<ErrorModel>(
				{ error: `Invalid type "${reqType}". Valid: ${VALID_TYPES.join(", ")}` },
				renderError,
			);
		}
		const existing = listRequirements(req.deps, req.project.path, req.project.config.management?.requirements);
		const id = flagStr(req.flags, "id", nextId("REQ", existing.map((r) => r.id)));
		const priority = flagStr(req.flags, "priority", "should") as MoSCoWPriority;

		const filePath = createRequirement(req.deps, req.project.path, {
			name,
			requirementType: reqType,
			id,
			status: (flagStr(req.flags, "status", "draft") as RequirementStatus),
			priority,
			source: flagStr(req.flags, "source", "") || undefined,
			rationale: flagStr(req.flags, "rationale", "") || undefined,
			description: flagStr(req.flags, "description", ""),
		}, req.project.config.management?.requirements);
		if (filePath) {
			return dataResponse(
				{ relPath: paths.relative(req.project.path, filePath) },
				(m: { relPath: string }) => renderRequirementAdded(m.relPath),
			);
		}
	},

	"requirements:update": (req) => {
		if (!req.project) return;
		const name = req.flags.name;
		const status = req.flags.status;
		if (!name || typeof name !== "string" || !status || typeof status !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --name and/or --status flag.", hint: 'Usage: flowti requirements:update --name="User Auth" --status="approved"' },
				renderError,
			);
		}
		if (!VALID_STATUSES.includes(status as RequirementStatus)) {
			return dataResponse<ErrorModel>(
				{ error: `Invalid status "${status}". Valid: ${VALID_STATUSES.join(", ")}` },
				renderError,
			);
		}
		const ok = updateRequirementStatus(req.deps, req.project.path, name, status as RequirementStatus, req.project.config.management?.requirements);
		if (ok) {
			return dataResponse(
				{ name, status },
				(m: { name: string; status: string }) => renderRequirementUpdated(m.name, m.status),
			);
		}
	},

	"usecases:list": (req) => {
		if (!req.project) return;
		const ucs = listUseCases(req.deps, req.project.path, req.project.config.management?.requirements);
		return dataResponse(ucs, renderUseCaseList);
	},

	"usecases:add": (req) => {
		if (!req.project) return;
		const { paths } = req.deps;
		const name = req.flags.name;
		if (!name || typeof name !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --name flag.", hint: 'Usage: flowti usecases:add --name="User Login" --actor="End User"' },
				renderError,
			);
		}
		const actor = flagStr(req.flags, "actor", "");
		if (!actor) {
			return dataResponse<ErrorModel>(
				{ error: "Missing --actor flag.", hint: 'Usage: flowti usecases:add --name="User Login" --actor="End User"' },
				renderError,
			);
		}
		const existing = listUseCases(req.deps, req.project.path, req.project.config.management?.requirements);
		const id = flagStr(req.flags, "id", nextId("UC", existing.map((uc) => uc.id)));

		const filePath = createUseCase(req.deps, req.project.path, {
			name, id, actor,
			description: flagStr(req.flags, "description", ""),
		}, req.project.config.management?.requirements);
		if (filePath) {
			return dataResponse(
				{ relPath: paths.relative(req.project.path, filePath) },
				(m: { relPath: string }) => renderRequirementAdded(m.relPath),
			);
		}
	},

	"stories:list": (req) => {
		if (!req.project) return;
		const stories = listUserStories(req.deps, req.project.path, req.project.config.management?.requirements);
		return dataResponse(stories, renderUserStoryList);
	},

	"stories:add": (req) => {
		if (!req.project) return;
		const name = req.flags.name;
		if (!name || typeof name !== "string") {
			return dataResponse<ErrorModel>(
				{ error: "Missing --name flag.", hint: 'Usage: flowti stories:add --name="Login Story" --role="User" --goal="log in" --benefit="access dashboard"' },
				renderError,
			);
		}
		const role = flagStr(req.flags, "role", "");
		const goal = flagStr(req.flags, "goal", "");
		const benefit = flagStr(req.flags, "benefit", "");
		if (!role || !goal || !benefit) {
			return dataResponse<ErrorModel>(
				{ error: "Missing --role, --goal, or --benefit flag." },
				renderError,
			);
		}
		return createStoryAction(req, name, role, goal, benefit);
	},
};

export const commands: Record<string, CommandHandler> = Object.fromEntries(
	Object.entries(actions).map(([key, action]) => [key, adapt(action)]),
);
