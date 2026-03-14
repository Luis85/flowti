/**
 * requirements-menu.ts — Interactive requirements management menu.
 */

import { printHeader } from "../../infrastructure/ui.js";
import { runMenu } from "../../infrastructure/menu.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { MenuResult, MenuEntry, RequirementsConfig, RequirementType, MoSCoWPriority } from "../../infrastructure/types.js";
import { collectFields, selectFromList, selectStatus } from "../../infrastructure/menu-helpers.js";
import {
	listRequirements, createRequirement, updateRequirementStatus, nextId,
	listUseCases, createUseCase,
	listUserStories, createUserStory,
} from "../../domain/requirements/requirement-store.js";
import type { RequirementStatus } from "../../domain/requirements/requirement-types.js";
import type { RequirementDefinition } from "../../domain/requirements/requirement-types.js";
import {
	renderRequirementList,
	renderRequirementAdded, renderRequirementUpdated,
} from "../displays/requirements-display.js";

const REQ_STATUSES: RequirementStatus[] = ["draft", "proposed", "approved", "implemented", "verified", "rejected", "deferred"];

export async function addRequirementInteractive(reqType: RequirementType, projectPath: string, config: RequirementsConfig | undefined, deps: MenuDeps): Promise<void> {
	const labels: Record<RequirementType, string> = {
		functional: "Functional Requirement",
		"non-functional": "Non-Functional Requirement",
		constraint: "Constraint",
	};
	printHeader(`Add ${labels[reqType]}`);

	const existing = listRequirements(deps, projectPath, config);
	const suggestedId = nextId("REQ", existing.map((r) => r.id));

	const data = await collectFields([
		{ key: "name", label: "Name", required: true },
		{ key: "id", label: "ID", default: suggestedId },
		{ key: "priority", label: "Priority (must/should/could/wont)", default: "should" },
		{ key: "category", label: "Category (security/performance/usability/reliability/maintainability)" },
		{ key: "source", label: "Source" },
		{ key: "rationale", label: "Rationale" },
		{ key: "description", label: "Description" },
	], deps.input);
	if (!data) return;

	const filePath = createRequirement(deps, projectPath, {
		name: data.name,
		requirementType: reqType,
		id: data.id,
		status: "draft",
		priority: data.priority as MoSCoWPriority,
		category: (data.category as RequirementDefinition["category"]) || undefined,
		source: data.source || undefined,
		rationale: data.rationale || undefined,
		description: data.description,
	}, config);

	if (filePath) {
		renderRequirementAdded(deps.paths.relative(projectPath, filePath), deps.log);
	}
}

export async function addUseCaseInteractive(projectPath: string, config: RequirementsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Add Use Case");

	const existing = listUseCases(deps, projectPath, config);
	const suggestedId = nextId("UC", existing.map((uc) => uc.id));

	const data = await collectFields([
		{ key: "name", label: "Name", required: true },
		{ key: "id", label: "ID", default: suggestedId },
		{ key: "actor", label: "Actor", required: true },
		{ key: "description", label: "Main flow description" },
		{ key: "linkedReqs", label: "Linked requirements (comma-separated IDs)" },
	], deps.input);
	if (!data) return;

	const filePath = createUseCase(deps, projectPath, {
		name: data.name,
		id: data.id,
		actor: data.actor,
		linkedRequirements: data.linkedReqs ? data.linkedReqs.split(",").map((s) => s.trim()) : undefined,
		description: data.description,
	}, config);

	if (filePath) {
		renderRequirementAdded(deps.paths.relative(projectPath, filePath), deps.log);
	}
}

export async function addUserStoryInteractive(projectPath: string, config: RequirementsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Add User Story");

	const existing = listUserStories(deps, projectPath, config);
	const suggestedId = nextId("US", existing.map((s) => s.id));

	const data = await collectFields([
		{ key: "name", label: "Name", required: true },
		{ key: "id", label: "ID", default: suggestedId },
		{ key: "role", label: "Role (As a...)", required: true },
		{ key: "goal", label: "Goal (I want to...)", required: true },
		{ key: "benefit", label: "Benefit (So that...)", required: true },
		{ key: "storyPoints", label: "Story points", default: "0" },
		{ key: "linkedReqs", label: "Linked requirements (comma-separated IDs)" },
		{ key: "description", label: "Acceptance criteria" },
	], deps.input);
	if (!data) return;

	const storyPoints = parseInt(data.storyPoints, 10);

	const filePath = createUserStory(deps, projectPath, {
		name: data.name,
		id: data.id,
		role: data.role,
		goal: data.goal,
		benefit: data.benefit,
		storyPoints: isNaN(storyPoints) ? undefined : storyPoints,
		status: "backlog",
		linkedRequirements: data.linkedReqs ? data.linkedReqs.split(",").map((s) => s.trim()) : undefined,
		description: data.description,
	}, config);

	if (filePath) {
		renderRequirementAdded(deps.paths.relative(projectPath, filePath), deps.log);
	}
}

export async function updateStatusInteractive(projectPath: string, config: RequirementsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Update Requirement Status");

	const reqs = listRequirements(deps, projectPath, config);
	const req = await selectFromList(reqs, deps, {
		format: (r) => `${r.id} ${r.name} [${r.status}]`,
		emptyMessage: "No requirements to update.",
	});
	if (!req) return;

	const newStatus = await selectStatus(REQ_STATUSES, req.status as RequirementStatus, deps);
	if (!newStatus) return;

	const ok = updateRequirementStatus(deps, projectPath, req.name, newStatus, config);
	if (ok) {
		renderRequirementUpdated(req.name, newStatus, deps.log);
	}
}

export async function requirementsMenu(projectPath: string, config: RequirementsConfig | undefined, deps: MenuDeps): Promise<MenuResult> {
	const items: MenuEntry[] = [
		{
			key: "1",
			label: "List Requirements",
			action: async () => {
				renderRequirementList(listRequirements(deps, projectPath, config), deps.log);
				await deps.input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "2",
			label: "Add Functional Requirement",
			action: async () => {
				await addRequirementInteractive("functional", projectPath, config, deps);
				await deps.input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "3",
			label: "Add Non-Functional Requirement",
			action: async () => {
				await addRequirementInteractive("non-functional", projectPath, config, deps);
				await deps.input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "4",
			label: "Add Constraint",
			action: async () => {
				await addRequirementInteractive("constraint", projectPath, config, deps);
				await deps.input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "5",
			label: "Add Use Case",
			action: async () => {
				await addUseCaseInteractive(projectPath, config, deps);
				await deps.input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "6",
			label: "Add User Story",
			action: async () => {
				await addUserStoryInteractive(projectPath, config, deps);
				await deps.input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "7",
			label: "Update Requirement Status",
			action: async () => {
				await updateStatusInteractive(projectPath, config, deps);
				await deps.input.waitForEnter();
				return "main" as const;
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	];

	return runMenu("Requirements", items);
}
