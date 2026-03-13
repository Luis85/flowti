/**
 * requirements-menu.ts — Interactive requirements management menu.
 */

import { paths } from "../../infrastructure/paths.js";
import { disk } from "../../infrastructure/filesystem.js";
import { clock } from "../../infrastructure/clock.js";
import { printHeader } from "../../infrastructure/ui.js";
import { input } from "../../infrastructure/input.js";
import { runMenu } from "../../infrastructure/menu.js";
import { log } from "../../infrastructure/logger.js";
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
} from "../requirements-display.js";

function storeDeps() { return { disk, paths, clock } as const; }

const REQ_STATUSES: RequirementStatus[] = ["draft", "proposed", "approved", "implemented", "verified", "rejected", "deferred"];

export async function addRequirementInteractive(reqType: RequirementType, projectPath: string, config?: RequirementsConfig): Promise<void> {
	const labels: Record<RequirementType, string> = {
		functional: "Functional Requirement",
		"non-functional": "Non-Functional Requirement",
		constraint: "Constraint",
	};
	printHeader(`Add ${labels[reqType]}`);

	const name = await input.ask("Name");
	if (!name) return;

	const existing = listRequirements(storeDeps(), projectPath, config);
	const suggestedId = nextId("REQ", existing.map((r) => r.id));
	const id = await input.ask("ID", suggestedId);

	const priority = (await input.ask("Priority (must/should/could/wont)", "should")) as MoSCoWPriority;
	const category = await input.ask("Category (security/performance/usability/reliability/maintainability)", "");
	const source = await input.ask("Source", "");
	const rationale = await input.ask("Rationale", "");
	const description = await input.ask("Description", "");

	const filePath = createRequirement(storeDeps(), projectPath, {
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
		renderRequirementAdded(paths.relative(projectPath, filePath));
	}
}

export async function addUseCaseInteractive(projectPath: string, config?: RequirementsConfig): Promise<void> {
	printHeader("Add Use Case");

	const name = await input.ask("Name");
	if (!name) return;

	const existing = listUseCases(storeDeps(), projectPath, config);
	const suggestedId = nextId("UC", existing.map((uc) => uc.id));
	const id = await input.ask("ID", suggestedId);

	const actor = await input.ask("Actor");
	if (!actor) return;

	const description = await input.ask("Main flow description", "");
	const linkedReqs = await input.ask("Linked requirements (comma-separated IDs)", "");

	const filePath = createUseCase(storeDeps(), projectPath, {
		name,
		id,
		actor,
		linkedRequirements: linkedReqs ? linkedReqs.split(",").map((s) => s.trim()) : undefined,
		description,
	}, config);

	if (filePath) {
		renderRequirementAdded(paths.relative(projectPath, filePath));
	}
}

export async function addUserStoryInteractive(projectPath: string, config?: RequirementsConfig): Promise<void> {
	printHeader("Add User Story");

	const name = await input.ask("Name");
	if (!name) return;

	const existing = listUserStories(storeDeps(), projectPath, config);
	const suggestedId = nextId("US", existing.map((s) => s.id));
	const id = await input.ask("ID", suggestedId);

	const role = await input.ask("Role (As a...)");
	if (!role) return;

	const goal = await input.ask("Goal (I want to...)");
	if (!goal) return;

	const benefit = await input.ask("Benefit (So that...)");
	if (!benefit) return;

	const storyPoints = parseInt(await input.ask("Story points", "0"), 10);
	const linkedReqs = await input.ask("Linked requirements (comma-separated IDs)", "");
	const description = await input.ask("Acceptance criteria", "");

	const filePath = createUserStory(storeDeps(), projectPath, {
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
		renderRequirementAdded(paths.relative(projectPath, filePath));
	}
}

export async function updateStatusInteractive(projectPath: string, config?: RequirementsConfig): Promise<void> {
	printHeader("Update Requirement Status");

	const reqs = listRequirements(storeDeps(), projectPath, config);
	if (reqs.length === 0) {
		log(`\n  No requirements to update.\n`);
		return;
	}

	for (let i = 0; i < reqs.length; i++) {
		log(`  ${i + 1}. ${reqs[i].id} ${reqs[i].name} [${reqs[i].status}]`);
	}
	const choice = await input.ask("Select requirement (number)");
	const idx = parseInt(choice, 10) - 1;
	if (isNaN(idx) || idx < 0 || idx >= reqs.length) return;

	const req = reqs[idx];
	log(`\n  Statuses: ${REQ_STATUSES.join(", ")}`);
	const newStatus = await input.ask("New status", req.status) as RequirementStatus;
	if (!REQ_STATUSES.includes(newStatus)) return;

	const ok = updateRequirementStatus(storeDeps(), projectPath, req.name, newStatus, config);
	if (ok) {
		renderRequirementUpdated(req.name, newStatus);
	}
}

export async function requirementsMenu(projectPath: string, config?: RequirementsConfig): Promise<MenuResult> {
	const items: MenuEntry[] = [
		{
			key: "1",
			label: "List Requirements",
			action: async () => {
				renderRequirementList(listRequirements(storeDeps(), projectPath, config));
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "2",
			label: "Add Functional Requirement",
			action: async () => {
				await addRequirementInteractive("functional", projectPath, config);
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "3",
			label: "Add Non-Functional Requirement",
			action: async () => {
				await addRequirementInteractive("non-functional", projectPath, config);
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "4",
			label: "Add Constraint",
			action: async () => {
				await addRequirementInteractive("constraint", projectPath, config);
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "5",
			label: "Add Use Case",
			action: async () => {
				await addUseCaseInteractive(projectPath, config);
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "6",
			label: "Add User Story",
			action: async () => {
				await addUserStoryInteractive(projectPath, config);
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{
			key: "7",
			label: "Update Requirement Status",
			action: async () => {
				await updateStatusInteractive(projectPath, config);
				await input.waitForEnter();
				return "main" as const;
			},
		},
		{ separator: true },
		{ key: "b", label: "Back", action: () => "main" as const },
		{ key: "q", label: "Quit", action: () => "quit" as const },
	];

	return runMenu("Requirements", items);
}
