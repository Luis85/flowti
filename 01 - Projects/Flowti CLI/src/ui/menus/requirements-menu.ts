/**
 * requirements-menu.ts — Interactive requirements management menu.
 */

import { printHeader } from "../../infrastructure/ui.js";
import { runMenu } from "../../infrastructure/menu.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { MenuResult, MenuEntry, RequirementsConfig, RequirementType, MoSCoWPriority } from "../../infrastructure/types.js";
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

	const name = await deps.input.ask("Name");
	if (!name) return;

	const existing = listRequirements(deps, projectPath, config);
	const suggestedId = nextId("REQ", existing.map((r) => r.id));
	const id = await deps.input.ask("ID", suggestedId);

	const priority = (await deps.input.ask("Priority (must/should/could/wont)", "should")) as MoSCoWPriority;
	const category = await deps.input.ask("Category (security/performance/usability/reliability/maintainability)", "");
	const source = await deps.input.ask("Source", "");
	const rationale = await deps.input.ask("Rationale", "");
	const description = await deps.input.ask("Description", "");

	const filePath = createRequirement(deps, projectPath, {
		name,
		requirementType: reqType,
		id,
		status: "draft",
		priority,
		category: (category as RequirementDefinition["category"]) || undefined,
		source: source || undefined,
		rationale: rationale || undefined,
		description,
	}, config);

	if (filePath) {
		renderRequirementAdded(deps.paths.relative(projectPath, filePath), deps.log);
	}
}

export async function addUseCaseInteractive(projectPath: string, config: RequirementsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Add Use Case");

	const name = await deps.input.ask("Name");
	if (!name) return;

	const existing = listUseCases(deps, projectPath, config);
	const suggestedId = nextId("UC", existing.map((uc) => uc.id));
	const id = await deps.input.ask("ID", suggestedId);

	const actor = await deps.input.ask("Actor");
	if (!actor) return;

	const description = await deps.input.ask("Main flow description", "");
	const linkedReqs = await deps.input.ask("Linked requirements (comma-separated IDs)", "");

	const filePath = createUseCase(deps, projectPath, {
		name,
		id,
		actor,
		linkedRequirements: linkedReqs ? linkedReqs.split(",").map((s) => s.trim()) : undefined,
		description,
	}, config);

	if (filePath) {
		renderRequirementAdded(deps.paths.relative(projectPath, filePath), deps.log);
	}
}

export async function addUserStoryInteractive(projectPath: string, config: RequirementsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Add User Story");

	const name = await deps.input.ask("Name");
	if (!name) return;

	const existing = listUserStories(deps, projectPath, config);
	const suggestedId = nextId("US", existing.map((s) => s.id));
	const id = await deps.input.ask("ID", suggestedId);

	const role = await deps.input.ask("Role (As a...)");
	if (!role) return;

	const goal = await deps.input.ask("Goal (I want to...)");
	if (!goal) return;

	const benefit = await deps.input.ask("Benefit (So that...)");
	if (!benefit) return;

	const storyPoints = parseInt(await deps.input.ask("Story points", "0"), 10);
	const linkedReqs = await deps.input.ask("Linked requirements (comma-separated IDs)", "");
	const description = await deps.input.ask("Acceptance criteria", "");

	const filePath = createUserStory(deps, projectPath, {
		name,
		id,
		role,
		goal,
		benefit,
		storyPoints: isNaN(storyPoints) ? undefined : storyPoints,
		status: "backlog",
		linkedRequirements: linkedReqs ? linkedReqs.split(",").map((s) => s.trim()) : undefined,
		description,
	}, config);

	if (filePath) {
		renderRequirementAdded(deps.paths.relative(projectPath, filePath), deps.log);
	}
}

export async function updateStatusInteractive(projectPath: string, config: RequirementsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader("Update Requirement Status");

	const reqs = listRequirements(deps, projectPath, config);
	if (reqs.length === 0) {
		deps.log(`\n  No requirements to update.\n`);
		return;
	}

	for (let i = 0; i < reqs.length; i++) {
		deps.log(`  ${i + 1}. ${reqs[i].id} ${reqs[i].name} [${reqs[i].status}]`);
	}
	const choice = await deps.input.ask("Select requirement (number)");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= reqs.length) return;

	const req = reqs[idx];
	deps.log(`\n  Statuses: ${REQ_STATUSES.join(", ")}`);
	const newStatus = await deps.input.ask("New status", req.status) as RequirementStatus;
	if (!REQ_STATUSES.includes(newStatus)) return;

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
