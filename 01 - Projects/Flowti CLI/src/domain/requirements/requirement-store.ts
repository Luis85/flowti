/**
 * requirement-store.ts — CRUD operations for IREB-compliant requirements.
 *
 * Manages three entity types under the requirements directory:
 *   - Requirements (root dir)
 *   - Use Cases (use-cases/ subdir)
 *   - User Stories (user-stories/ subdir)
 */

import { Document } from "../../infrastructure/document.js";
import { parseFrontmatterStrings } from "../../infrastructure/frontmatter.js";
import { toKebab } from "../make/naming.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import type { RequirementsConfig } from "../../infrastructure/types.js";
import type {
	RequirementDefinition, RequirementSummary, RequirementStatus,
	UseCaseDefinition, UseCaseSummary,
	UserStoryDefinition, UserStorySummary, UserStoryStatus,
} from "./requirement-types.js";

export type RequirementStoreDeps = Pick<CliDeps, "disk" | "paths" | "clock">;

// ── Directory helpers ───────────────────────────────────────────────

/** Resolve the requirements root directory for a project. */
export function requirementsDir(deps: Pick<CliDeps, "paths">, projectPath: string, config?: RequirementsConfig): string {
	return deps.paths.join(projectPath, config?.dir ?? "docs/requirements");
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

// ── List helpers ────────────────────────────────────────────────────

function listMdFiles(deps: Pick<CliDeps, "disk">, dir: string): string[] {
	if (!deps.disk.existsSync(dir)) return [];
	return deps.disk.readdirSync(dir).filter((f: string) => f.endsWith(".md"));
}

// ── Requirements CRUD ───────────────────────────────────────────────

/** List all requirements from the root requirements directory. */
export function listRequirements(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, config?: RequirementsConfig): RequirementSummary[] {
	const dir = requirementsDir(deps, projectPath, config);
	const files = listMdFiles(deps, dir);
	const reqs: RequirementSummary[] = [];

	for (const file of files) {
		const content = deps.disk.readFileSync(deps.paths.join(dir, file), "utf-8");
		const fm = parseFrontmatterStrings(content);
		if (fm.type && fm.type !== "Requirement") continue;
		reqs.push({
			name: fm.name ?? file.replace(/\.md$/, ""),
			id: fm.id ?? "",
			requirementType: (fm.requirementType as RequirementSummary["requirementType"]) ?? "functional",
			status: fm.status ?? "draft",
			priority: fm.priority ?? "should",
			file,
		});
	}

	return reqs.sort((a, b) => a.id.localeCompare(b.id));
}

/** Create a new requirement markdown file. Returns the file path or null if it already exists. */
export function createRequirement(deps: RequirementStoreDeps, projectPath: string, def: RequirementDefinition, config?: RequirementsConfig): string | null {
	const dir = requirementsDir(deps, projectPath, config);
	deps.disk.mkdirSync(dir, { recursive: true });

	const kebab = toKebab(def.name);
	const filename = kebab + ".md";
	const filePath = deps.paths.join(dir, filename);

	if (deps.disk.existsSync(filePath)) return null;

	const frontmatter: Record<string, string> = {
		type: "Requirement",
		requirementType: def.requirementType,
		name: def.name,
		id: def.id,
		status: def.status,
		priority: def.priority,
		date: deps.clock.iso(),
	};

	if (def.category) frontmatter.category = def.category;
	if (def.source) frontmatter.source = def.source;
	if (def.rationale) frontmatter.rationale = def.rationale;
	if (def.linkedUseCases?.length) frontmatter.linkedUseCases = def.linkedUseCases.join(", ");
	if (def.linkedUserStories?.length) frontmatter.linkedUserStories = def.linkedUserStories.join(", ");

	const doc = Document.create(def.name)
		.mergeFrontmatter(frontmatter)
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

	doc.save(filePath);
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
	const kebab = toKebab(reqName);
	const filePath = deps.paths.join(dir, kebab + ".md");

	if (!deps.disk.existsSync(filePath)) return false;

	let content = deps.disk.readFileSync(filePath, "utf-8");
	content = content.replace(/^status:\s*.+$/m, `status: ${status}`);
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return true;
}

// ── Use Cases CRUD ──────────────────────────────────────────────────

/** List all use cases from the use-cases/ subdirectory. */
export function listUseCases(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, config?: RequirementsConfig): UseCaseSummary[] {
	const dir = useCasesDir(deps, projectPath, config);
	const files = listMdFiles(deps, dir);
	const ucs: UseCaseSummary[] = [];

	for (const file of files) {
		const content = deps.disk.readFileSync(deps.paths.join(dir, file), "utf-8");
		const fm = parseFrontmatterStrings(content);
		ucs.push({
			name: fm.name ?? file.replace(/\.md$/, ""),
			id: fm.id ?? "",
			actor: fm.actor ?? "",
			file,
		});
	}

	return ucs.sort((a, b) => a.id.localeCompare(b.id));
}

/** Create a new use case markdown file. Returns the file path or null if it already exists. */
export function createUseCase(deps: RequirementStoreDeps, projectPath: string, def: UseCaseDefinition, config?: RequirementsConfig): string | null {
	const dir = useCasesDir(deps, projectPath, config);
	deps.disk.mkdirSync(dir, { recursive: true });

	const kebab = toKebab(def.name);
	const filename = kebab + ".md";
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

	doc.save(filePath);
	return filePath;
}

// ── User Stories CRUD ───────────────────────────────────────────────

/** List all user stories from the user-stories/ subdirectory. */
export function listUserStories(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, config?: RequirementsConfig): UserStorySummary[] {
	const dir = userStoriesDir(deps, projectPath, config);
	const files = listMdFiles(deps, dir);
	const stories: UserStorySummary[] = [];

	for (const file of files) {
		const content = deps.disk.readFileSync(deps.paths.join(dir, file), "utf-8");
		const fm = parseFrontmatterStrings(content);
		stories.push({
			name: fm.name ?? file.replace(/\.md$/, ""),
			id: fm.id ?? "",
			role: fm.role ?? "",
			status: fm.status ?? "backlog",
			storyPoints: parseInt(fm.storyPoints ?? "0", 10),
			file,
		});
	}

	return stories.sort((a, b) => a.id.localeCompare(b.id));
}

/** Create a new user story markdown file. Returns the file path or null if it already exists. */
export function createUserStory(deps: RequirementStoreDeps, projectPath: string, def: UserStoryDefinition, config?: RequirementsConfig): string | null {
	const dir = userStoriesDir(deps, projectPath, config);
	deps.disk.mkdirSync(dir, { recursive: true });

	const kebab = toKebab(def.name);
	const filename = kebab + ".md";
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

	doc.save(filePath);
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
	const kebab = toKebab(storyName);
	const filePath = deps.paths.join(dir, kebab + ".md");

	if (!deps.disk.existsSync(filePath)) return false;

	let content = deps.disk.readFileSync(filePath, "utf-8");
	content = content.replace(/^status:\s*.+$/m, `status: ${status}`);
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return true;
}
