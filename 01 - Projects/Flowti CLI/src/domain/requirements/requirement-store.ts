/**
 * requirement-store.ts — CRUD operations for IREB-compliant requirements.
 *
 * Manages three entity types under the requirements directory:
 *   - Requirements (root dir)
 *   - Use Cases (use-cases/ subdir)
 *   - User Stories (user-stories/ subdir)
 */

import { Document } from "../../infrastructure/document.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import type { RequirementsConfig } from "../../infrastructure/types.js";
import type {
	RequirementDefinition, RequirementSummary, RequirementStatus,
	UseCaseDefinition, UseCaseSummary,
	UserStoryDefinition, UserStorySummary, UserStoryStatus,
} from "./requirement-types.js";
import { resolveDir, listItems, toMdFilename, updateField, readFrontmatter, listMdFiles } from "../shared/markdown-store.js";

export type RequirementStoreDeps = Pick<CliDeps, "disk" | "paths" | "clock">;

// ── Directory helpers ───────────────────────────────────────────────

/** Resolve the requirements root directory for a project. */
export function requirementsDir(deps: Pick<CliDeps, "paths">, projectPath: string, config?: RequirementsConfig): string {
	return resolveDir(deps, projectPath, config?.dir, "docs/requirements");
}

function useCasesDir(deps: Pick<CliDeps, "paths">, projectPath: string, config?: RequirementsConfig): string {
	return deps.paths.join(requirementsDir(deps, projectPath, config), "use-cases");
}

function userStoriesDir(deps: Pick<CliDeps, "paths">, projectPath: string, config?: RequirementsConfig): string {
	return deps.paths.join(requirementsDir(deps, projectPath, config), "user-stories");
}

// ── ID generation ───────────────────────────────────────────────────

/** Generate the next sequential ID for a given prefix (e.g., REQ-001, UC-001). */
export function nextId(prefix: string, existingIds: string[]): string {
	let max = 0;
	const pattern = new RegExp(`^${prefix}-(\\d+)$`);
	for (const id of existingIds) {
		const m = id.match(pattern);
		if (m) {
			const n = parseInt(m[1], 10);
			if (n > max) max = n;
		}
	}
	return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}

// ── Requirements CRUD ───────────────────────────────────────────────

function parseRequirementSummary(fm: Record<string, string>, file: string): RequirementSummary | null {
	if (fm.type && fm.type !== "Requirement") return null;
	return {
		name: fm.name ?? file.replace(/\.md$/, ""),
		id: fm.id ?? "",
		requirementType: (fm.requirementType as RequirementSummary["requirementType"]) ?? "functional",
		status: fm.status ?? "draft",
		priority: fm.priority ?? "should",
		file,
	};
}

/** List all requirements from the root requirements directory. */
export function listRequirements(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, config?: RequirementsConfig): RequirementSummary[] {
	const dir = requirementsDir(deps, projectPath, config);
	const files = listMdFiles(deps, dir);
	const reqs: RequirementSummary[] = [];

	for (const file of files) {
		const fm = readFrontmatter(deps, dir, file);
		const summary = parseRequirementSummary(fm, file);
		if (summary) reqs.push(summary);
	}

	return reqs.sort((a, b) => a.id.localeCompare(b.id));
}

function buildRequirementFrontmatter(def: RequirementDefinition, date: string): Record<string, string> {
	const fm: Record<string, string> = {
		type: "Requirement",
		requirementType: def.requirementType,
		name: def.name,
		id: def.id,
		status: def.status,
		priority: def.priority,
		date,
	};
	if (def.category) fm.category = def.category;
	if (def.source) fm.source = def.source;
	if (def.rationale) fm.rationale = def.rationale;
	if (def.linkedUseCases?.length) fm.linkedUseCases = def.linkedUseCases.join(", ");
	if (def.linkedUserStories?.length) fm.linkedUserStories = def.linkedUserStories.join(", ");
	return fm;
}

/** Create a new requirement markdown file. Returns the file path or null if it already exists. */
export function createRequirement(deps: RequirementStoreDeps, projectPath: string, def: RequirementDefinition, config?: RequirementsConfig): string | null {
	const dir = requirementsDir(deps, projectPath, config);
	deps.disk.mkdirSync(dir, { recursive: true });

	const filename = toMdFilename(def.name);
	const filePath = deps.paths.join(dir, filename);

	if (deps.disk.existsSync(filePath)) return null;

	const doc = Document.create(def.name)
		.mergeFrontmatter(buildRequirementFrontmatter(def, deps.clock.iso()))
		.addBlank()
		.heading(1, `${def.id} — ${def.name}`)
		.addBlank();

	if (def.description) {
		doc.text(def.description).addBlank();
	}

	doc.heading(2, "Acceptance Criteria").addBlank();
	if (def.acceptanceCriteria?.length) {
		for (const ac of def.acceptanceCriteria) {
			doc.text(`- ${ac}`);
		}
		doc.addBlank();
	} else {
		doc.text("<!-- Define acceptance criteria here. -->");
	}

	doc.save(filePath, deps.disk);
	return filePath;
}

/** Update the status of a named requirement. Returns true if successful. */
export function updateRequirementStatus(
	deps: Pick<CliDeps, "disk" | "paths">,
	projectPath: string,
	reqName: string,
	status: RequirementStatus,
	config?: RequirementsConfig,
): boolean {
	const dir = requirementsDir(deps, projectPath, config);
	const filePath = deps.paths.join(dir, toMdFilename(reqName));
	return updateField(deps, filePath, "status", status);
}

// ── Use Cases CRUD ──────────────────────────────────────────────────

function parseUseCaseSummary(fm: Record<string, string>, file: string): UseCaseSummary {
	return {
		name: fm.name ?? file.replace(/\.md$/, ""),
		id: fm.id ?? "",
		actor: fm.actor ?? "",
		file,
	};
}

/** List all use cases from the use-cases/ subdirectory. */
export function listUseCases(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, config?: RequirementsConfig): UseCaseSummary[] {
	return listItems(deps, useCasesDir(deps, projectPath, config), parseUseCaseSummary, (a, b) => a.id.localeCompare(b.id));
}

function addUseCaseBody(doc: Document, def: UseCaseDefinition): void {
	if (def.preconditions?.length) {
		doc.heading(2, "Preconditions").addBlank();
		for (const p of def.preconditions) doc.text(`- ${p}`);
		doc.addBlank();
	}
	if (def.postconditions?.length) {
		doc.heading(2, "Postconditions").addBlank();
		for (const p of def.postconditions) doc.text(`- ${p}`);
		doc.addBlank();
	}
	doc.heading(2, "Main Flow").addBlank();
	if (def.description) {
		doc.text(def.description).addBlank();
	} else {
		doc.text("<!-- Describe the main flow here. -->");
	}
	doc.addBlank().heading(2, "Alternative Flows").addBlank();
	doc.text("<!-- Describe alternative flows here. -->");
}

/** Create a new use case markdown file. Returns the file path or null if it already exists. */
export function createUseCase(deps: RequirementStoreDeps, projectPath: string, def: UseCaseDefinition, config?: RequirementsConfig): string | null {
	const dir = useCasesDir(deps, projectPath, config);
	deps.disk.mkdirSync(dir, { recursive: true });

	const filename = toMdFilename(def.name);
	const filePath = deps.paths.join(dir, filename);

	if (deps.disk.existsSync(filePath)) return null;

	const frontmatter: Record<string, string> = {
		type: "UseCase",
		name: def.name,
		id: def.id,
		actor: def.actor,
		date: deps.clock.iso(),
	};

	if (def.linkedRequirements?.length) frontmatter.linkedRequirements = def.linkedRequirements.join(", ");

	const doc = Document.create(def.name)
		.mergeFrontmatter(frontmatter)
		.addBlank()
		.heading(1, `${def.id} — ${def.name}`)
		.addBlank();

	addUseCaseBody(doc, def);
	doc.save(filePath, deps.disk);
	return filePath;
}

// ── User Stories CRUD ───────────────────────────────────────────────

function parseUserStorySummary(fm: Record<string, string>, file: string): UserStorySummary {
	return {
		name: fm.name ?? file.replace(/\.md$/, ""),
		id: fm.id ?? "",
		role: fm.role ?? "",
		status: fm.status ?? "backlog",
		storyPoints: parseInt(fm.storyPoints ?? "0", 10),
		file,
	};
}

/** List all user stories from the user-stories/ subdirectory. */
export function listUserStories(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, config?: RequirementsConfig): UserStorySummary[] {
	return listItems(deps, userStoriesDir(deps, projectPath, config), parseUserStorySummary, (a, b) => a.id.localeCompare(b.id));
}

/** Create a new user story markdown file. Returns the file path or null if it already exists. */
export function createUserStory(deps: RequirementStoreDeps, projectPath: string, def: UserStoryDefinition, config?: RequirementsConfig): string | null {
	const dir = userStoriesDir(deps, projectPath, config);
	deps.disk.mkdirSync(dir, { recursive: true });

	const filename = toMdFilename(def.name);
	const filePath = deps.paths.join(dir, filename);

	if (deps.disk.existsSync(filePath)) return null;

	const frontmatter: Record<string, string> = {
		type: "UserStory",
		name: def.name,
		id: def.id,
		role: def.role,
		goal: def.goal,
		benefit: def.benefit,
		status: def.status,
		date: deps.clock.iso(),
	};

	if (def.storyPoints !== undefined) frontmatter.storyPoints = String(def.storyPoints);
	if (def.linkedRequirements?.length) frontmatter.linkedRequirements = def.linkedRequirements.join(", ");

	const doc = Document.create(def.name)
		.mergeFrontmatter(frontmatter)
		.addBlank()
		.heading(1, `${def.id} — ${def.name}`)
		.addBlank()
		.text(`As a **${def.role}**, I want to **${def.goal}** so that **${def.benefit}**.`)
		.addBlank();

	if (def.description) {
		doc.heading(2, "Acceptance Criteria").addBlank();
		doc.text(def.description).addBlank();
	} else {
		doc.heading(2, "Acceptance Criteria").addBlank();
		doc.text("<!-- Given... When... Then... -->");
	}

	doc.save(filePath, deps.disk);
	return filePath;
}

/** Update the status of a named user story. Returns true if successful. */
export function updateUserStoryStatus(
	deps: Pick<CliDeps, "disk" | "paths">,
	projectPath: string,
	storyName: string,
	status: UserStoryStatus,
	config?: RequirementsConfig,
): boolean {
	const dir = userStoriesDir(deps, projectPath, config);
	const filePath = deps.paths.join(dir, toMdFilename(storyName));
	return updateField(deps, filePath, "status", status);
}
