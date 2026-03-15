/**
 * requirement-store.ts — CRUD operations for IREB-compliant requirements.
 *
 * Manages three entity types under the requirements directory:
 *   - Requirements (root dir)
 *   - Use Cases (use-cases/ subdir)
 *   - User Stories (user-stories/ subdir)
 */

import { createStore } from "../../infrastructure/store-engine.js";
import type { StoreDeps } from "../../infrastructure/store-engine.js";
import { toMdFilename } from "../../infrastructure/markdown-utils.js";
import type { RequirementsConfig } from "../../infrastructure/types.js";
import type {
	RequirementDefinition, RequirementSummary, RequirementStatus,
	UseCaseDefinition, UseCaseSummary,
	UserStoryDefinition, UserStorySummary, UserStoryStatus,
} from "./requirement-types.js";

export type RequirementStoreDeps = StoreDeps & { clock: import("../../infrastructure/types.js").IClock };

const REQ_DEFAULT_DIR = "docs/requirements";

// ── Store instances ─────────────────────────────────────────────────

export const requirementStore = createStore<RequirementSummary, RequirementDefinition>({
	name: "requirement",
	defaultDir: REQ_DEFAULT_DIR,
	configPath: "dir",
	typeTag: "Requirement",
	needsClock: true,
	filter: (fm) => !fm.type || fm.type === "Requirement",
	fields: {
		name: { type: "string", from: "frontmatter", required: true, default: "" },
		id: { type: "string", default: "" },
		requirementType: { type: "enum", options: ["functional", "non-functional", "constraint"], default: "functional" },
		status: { type: "enum", options: ["draft", "proposed", "approved", "implemented", "verified", "rejected", "deferred"], default: "draft" },
		priority: { type: "enum", options: ["must", "should", "could", "wont"], default: "should" },
	},
	sort: (a, b) => a.id.localeCompare(b.id),
	idGeneration: { prefix: "REQ", padding: 3 },
	buildBody: (def) => {
		const lines: string[] = [];
		lines.push(`# ${def.id} — ${def.name}`, "");
		if (def.description) { lines.push(def.description, ""); }
		lines.push("## Acceptance Criteria", "");
		if (def.acceptanceCriteria?.length) {
			for (const ac of def.acceptanceCriteria) { lines.push(`- ${ac}`); }
			lines.push("");
		} else {
			lines.push("<!-- Define acceptance criteria here. -->");
		}
		return lines.join("\n");
	},
});

export const useCaseStore = createStore<UseCaseSummary, UseCaseDefinition>({
	name: "useCase",
	defaultDir: `${REQ_DEFAULT_DIR}/use-cases`,
	configPath: "dir",
	typeTag: "UseCase",
	needsClock: true,
	fields: {
		name: { type: "string", from: "frontmatter", required: true, default: "" },
		id: { type: "string", default: "" },
		actor: { type: "string", default: "" },
	},
	sort: (a, b) => a.id.localeCompare(b.id),
	idGeneration: { prefix: "UC", padding: 3 },
	buildBody: (def) => {
		const lines: string[] = [];
		lines.push(`# ${def.id} — ${def.name}`, "");
		if (def.preconditions?.length) {
			lines.push("## Preconditions", "");
			for (const p of def.preconditions) { lines.push(`- ${p}`); }
			lines.push("");
		}
		if (def.postconditions?.length) {
			lines.push("## Postconditions", "");
			for (const p of def.postconditions) { lines.push(`- ${p}`); }
			lines.push("");
		}
		lines.push("## Main Flow", "");
		if (def.description) { lines.push(def.description, ""); }
		else { lines.push("<!-- Describe the main flow here. -->"); }
		lines.push("", "## Alternative Flows", "");
		lines.push("<!-- Describe alternative flows here. -->");
		return lines.join("\n");
	},
});

export const userStoryStore = createStore<UserStorySummary, UserStoryDefinition>({
	name: "userStory",
	defaultDir: `${REQ_DEFAULT_DIR}/user-stories`,
	configPath: "dir",
	typeTag: "UserStory",
	needsClock: true,
	fields: {
		name: { type: "string", from: "frontmatter", required: true, default: "" },
		id: { type: "string", default: "" },
		role: { type: "string", default: "" },
		goal: { type: "string", default: "" },
		benefit: { type: "string", default: "" },
		status: { type: "enum", options: ["backlog", "ready", "in-progress", "done"], default: "backlog" },
		storyPoints: { type: "number", default: 0, parse: (raw) => parseInt(raw, 10) || 0 },
	},
	sort: (a, b) => a.id.localeCompare(b.id),
	idGeneration: { prefix: "US", padding: 3 },
	buildBody: (def) => {
		const lines: string[] = [];
		lines.push(`# ${def.id} — ${def.name}`, "");
		lines.push(`As a **${def.role}**, I want to **${def.goal}** so that **${def.benefit}**.`, "");
		lines.push("## Acceptance Criteria", "");
		if (def.description) { lines.push(def.description, ""); }
		else { lines.push("<!-- Given... When... Then... -->"); }
		return lines.join("\n");
	},
});

// ── Subdir helpers (compute relative subdir from config base) ───────

function ucSubdir(config?: RequirementsConfig): string {
	return `${config?.dir ?? REQ_DEFAULT_DIR}/use-cases`;
}

function usSubdir(config?: RequirementsConfig): string {
	return `${config?.dir ?? REQ_DEFAULT_DIR}/user-stories`;
}

// ── Frontmatter builders (preserve exact original output) ───────────

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

function buildUseCaseFrontmatter(def: UseCaseDefinition, date: string): Record<string, string> {
	const fm: Record<string, string> = {
		type: "UseCase",
		name: def.name,
		id: def.id,
		actor: def.actor,
		date,
	};
	if (def.linkedRequirements?.length) fm.linkedRequirements = def.linkedRequirements.join(", ");
	return fm;
}

function buildUserStoryFrontmatter(def: UserStoryDefinition, date: string): Record<string, string> {
	const fm: Record<string, string> = {
		type: "UserStory",
		name: def.name,
		id: def.id,
		role: def.role,
		goal: def.goal,
		benefit: def.benefit,
		status: def.status,
		date,
	};
	if (def.storyPoints !== undefined) fm.storyPoints = String(def.storyPoints);
	if (def.linkedRequirements?.length) fm.linkedRequirements = def.linkedRequirements.join(", ");
	return fm;
}

function writeMarkdownFile(deps: RequirementStoreDeps, dir: string, filename: string, fm: Record<string, string>, body: string): string {
	deps.disk.mkdirSync(dir, { recursive: true });
	const filePath = deps.paths.join(dir, filename);
	const yamlLines = Object.entries(fm).map(([k, v]) => `${k}: ${v}`);
	const content = `---\n${yamlLines.join("\n")}\n---\n\n${body}`;
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return filePath;
}

// ── ID generation (standalone, for direct use by controllers) ───────

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

// ── Backwards-compatible re-exports ────────────────────────────────

/** Resolve the requirements root directory for a project. */
export function requirementsDir(deps: Pick<import("../../infrastructure/deps.js").CliDeps, "paths">, projectPath: string, config?: RequirementsConfig): string {
	return requirementStore.resolveDir(deps as StoreDeps, projectPath, config ? { dir: config.dir } : undefined);
}

/** List all requirements from the root requirements directory. */
export function listRequirements(deps: Pick<import("../../infrastructure/deps.js").CliDeps, "disk" | "paths">, projectPath: string, config?: RequirementsConfig): RequirementSummary[] {
	return requirementStore.list(deps as StoreDeps, projectPath, config ? { dir: config.dir } : undefined);
}

/** Create a new requirement markdown file. Returns the file path or null if it already exists. */
export function createRequirement(deps: RequirementStoreDeps, projectPath: string, def: RequirementDefinition, config?: RequirementsConfig): string | null {
	const dir = requirementStore.resolveDir(deps, projectPath, config ? { dir: config.dir } : undefined);
	const filename = toMdFilename(def.name);
	if (deps.disk.existsSync(deps.paths.join(dir, filename))) return null;
	const fm = buildRequirementFrontmatter(def, deps.clock.iso());
	const body = requirementStore.__descriptor.buildBody(def, deps);
	return writeMarkdownFile(deps, dir, filename, fm, body);
}

/** Update the status of a named requirement. Returns true if successful. */
export function updateRequirementStatus(
	deps: Pick<import("../../infrastructure/deps.js").CliDeps, "disk" | "paths">,
	projectPath: string,
	reqName: string,
	status: RequirementStatus,
	config?: RequirementsConfig,
): boolean {
	return requirementStore.updateField(deps as StoreDeps, projectPath, reqName, "status", status, config ? { dir: config.dir } : undefined);
}

/** List all use cases from the use-cases/ subdirectory. */
export function listUseCases(deps: Pick<import("../../infrastructure/deps.js").CliDeps, "disk" | "paths">, projectPath: string, config?: RequirementsConfig): UseCaseSummary[] {
	return useCaseStore.list(deps as StoreDeps, projectPath, { dir: ucSubdir(config) });
}

/** Create a new use case markdown file. Returns the file path or null if it already exists. */
export function createUseCase(deps: RequirementStoreDeps, projectPath: string, def: UseCaseDefinition, config?: RequirementsConfig): string | null {
	const subdir = ucSubdir(config);
	const dir = useCaseStore.resolveDir(deps, projectPath, { dir: subdir });
	const filename = toMdFilename(def.name);
	if (deps.disk.existsSync(deps.paths.join(dir, filename))) return null;
	const fm = buildUseCaseFrontmatter(def, deps.clock.iso());
	const body = useCaseStore.__descriptor.buildBody(def, deps);
	return writeMarkdownFile(deps, dir, filename, fm, body);
}

/** List all user stories from the user-stories/ subdirectory. */
export function listUserStories(deps: Pick<import("../../infrastructure/deps.js").CliDeps, "disk" | "paths">, projectPath: string, config?: RequirementsConfig): UserStorySummary[] {
	return userStoryStore.list(deps as StoreDeps, projectPath, { dir: usSubdir(config) });
}

/** Create a new user story markdown file. Returns the file path or null if it already exists. */
export function createUserStory(deps: RequirementStoreDeps, projectPath: string, def: UserStoryDefinition, config?: RequirementsConfig): string | null {
	const subdir = usSubdir(config);
	const dir = userStoryStore.resolveDir(deps, projectPath, { dir: subdir });
	const filename = toMdFilename(def.name);
	if (deps.disk.existsSync(deps.paths.join(dir, filename))) return null;
	const fm = buildUserStoryFrontmatter(def, deps.clock.iso());
	const body = userStoryStore.__descriptor.buildBody(def, deps);
	return writeMarkdownFile(deps, dir, filename, fm, body);
}

/** Update the status of a named user story. Returns true if successful. */
export function updateUserStoryStatus(
	deps: Pick<import("../../infrastructure/deps.js").CliDeps, "disk" | "paths">,
	projectPath: string,
	storyName: string,
	status: UserStoryStatus,
	config?: RequirementsConfig,
): boolean {
	return userStoryStore.updateField(deps as StoreDeps, projectPath, storyName, "status", status, { dir: usSubdir(config) });
}
