/**
 * agent-store.ts — CRUD operations for agent entities.
 *
 * Stores agents as markdown files with YAML frontmatter in docs/agents/.
 * Follows the resource-store.ts pattern: pure functions with injected deps.
 *
 * Scalar and array fields (skills, tools, roles, behaviors, domain) live in
 * frontmatter. Complex nested objects (components, goals, ai, relationships)
 * are stored alongside the markdown in a companion JSON definition file.
 */

import { Document } from "../../infrastructure/document.js";
import { parseFrontmatterContent } from "../../infrastructure/frontmatter.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import type { AgentsConfig } from "../../infrastructure/types.js";
import type { AgentDefinition, AgentSummary, AgentSkill, AgentComponent, AgentGoal, AgentAIConfig, AgentRelationship } from "./agent-types.js";
import { resolveDir, listMdFiles, toMdFilename, updateField } from "../shared/markdown-store.js";

export type AgentStoreDeps = Pick<CliDeps, "disk" | "paths">;

const DEFAULT_DIR = "docs/agents";

/** Resolve the agents directory for a project. */
function agentsDir(deps: Pick<CliDeps, "paths">, projectPath: string, config?: AgentsConfig): string {
	return resolveDir(deps, projectPath, config?.dir, DEFAULT_DIR);
}

// ── Parsing ──────────────────────────────────────────────────────────

function parseSkill(raw: string): AgentSkill {
	const idx = raw.indexOf("|");
	if (idx === -1) return { name: raw.trim(), level: "" };
	return { name: raw.slice(0, idx).trim(), level: raw.slice(idx + 1).trim() };
}

function toStringArray(value: unknown): string[] {
	if (Array.isArray(value)) return value.map(String);
	if (typeof value === "string" && value) return [value];
	return [];
}

function parseJsonFile<T>(deps: AgentStoreDeps, dir: string, mdFile: string): T | null {
	const jsonFile = mdFile.replace(/\.md$/, ".json");
	const jsonPath = deps.paths.join(dir, jsonFile);
	if (!deps.disk.existsSync(jsonPath)) return null;
	try {
		return JSON.parse(deps.disk.readFileSync(jsonPath, "utf-8")) as T;
	} catch { return null; }
}

export interface AgentJson {
	components?: AgentComponent[];
	goals?: AgentGoal[];
	ai?: AgentAIConfig;
	relationships?: AgentRelationship[];
}

function parseAgentSummary(deps: AgentStoreDeps, dir: string, content: string, file: string): AgentSummary | null {
	const fm = parseFrontmatterContent(content);
	if (!fm) return null;
	const json = parseJsonFile<AgentJson>(deps, dir, file);
	return {
		name: String(fm.name ?? file.replace(/\.md$/, "")),
		agentType: fm.agentType === "ai" ? "ai" : "human",
		description: String(fm.description ?? ""),
		domain: fm.domain ? String(fm.domain) : undefined,
		skills: toStringArray(fm.skills).map(parseSkill),
		tools: toStringArray(fm.tools),
		roles: toStringArray(fm.roles),
		behaviors: toStringArray(fm.behaviors),
		components: json?.components,
		goals: json?.goals,
		ai: json?.ai,
		relationships: json?.relationships,
		file,
	};
}

// ── List ─────────────────────────────────────────────────────────────

/** List all agents from the agents directory. */
export function listAgents(deps: AgentStoreDeps, projectPath: string, config?: AgentsConfig): AgentSummary[] {
	const dir = agentsDir(deps, projectPath, config);
	const files = listMdFiles(deps, dir);
	const items: AgentSummary[] = [];
	for (const file of files) {
		const content = deps.disk.readFileSync(deps.paths.join(dir, file), "utf-8");
		const summary = parseAgentSummary(deps, dir, content, file);
		if (summary) items.push(summary);
	}
	return items.sort((a, b) => a.name.localeCompare(b.name));
}

/** Find a single agent by name. */
export function findAgent(deps: AgentStoreDeps, projectPath: string, name: string, config?: AgentsConfig): AgentSummary | null {
	const agents = listAgents(deps, projectPath, config);
	return agents.find((a) => a.name === name) ?? null;
}

// ── Create ───────────────────────────────────────────────────────────

function serializeSkill(skill: AgentSkill): string {
	return skill.level ? `${skill.name}|${skill.level}` : skill.name;
}

function buildFrontmatterArrays(doc: Document, def: AgentDefinition): void {
	if (def.skills.length > 0) doc.setFrontmatter("skills", def.skills.map(serializeSkill));
	if (def.tools.length > 0) doc.setFrontmatter("tools", def.tools);
	if (def.roles.length > 0) doc.setFrontmatter("roles", def.roles);
	if (def.behaviors && def.behaviors.length > 0) doc.setFrontmatter("behaviors", def.behaviors);
}

function buildBody(doc: Document, def: AgentDefinition): void {
	doc.addBlank().heading(1, def.name).addBlank();
	if (def.description) doc.text(def.description).addBlank();
	buildListSection(doc, "Skills", def.skills.map((s) => `**${s.name}**: ${s.level || "(unrated)"}`), "<!-- List skills for this agent. -->");
	buildListSection(doc, "Tools", def.tools, "<!-- List tools available to this agent. -->");
	buildListSection(doc, "Roles", def.roles, "<!-- List roles this agent can fill. -->");
}

function buildListSection(doc: Document, heading: string, items: string[], placeholder: string): void {
	doc.heading(2, heading).addBlank();
	if (items.length > 0) {
		for (const item of items) doc.text(`- ${item}`);
		doc.addBlank();
	} else {
		doc.text(placeholder).addBlank();
	}
}

function hasJsonFields(def: AgentDefinition): boolean {
	return !!(
		(def.components && def.components.length > 0) ||
		(def.goals && def.goals.length > 0) ||
		def.ai ||
		(def.relationships && def.relationships.length > 0)
	);
}

function writeJsonDefinition(deps: AgentStoreDeps, dir: string, def: AgentDefinition): void {
	if (!hasJsonFields(def)) return;
	const json: AgentJson = {};
	if (def.components && def.components.length > 0) json.components = def.components;
	if (def.goals && def.goals.length > 0) json.goals = def.goals;
	if (def.ai) json.ai = def.ai;
	if (def.relationships && def.relationships.length > 0) json.relationships = def.relationships;
	const jsonPath = deps.paths.join(dir, toMdFilename(def.name).replace(/\.md$/, ".json"));
	deps.disk.writeFileSync(jsonPath, JSON.stringify(json, null, "\t"), "utf-8");
}

/** Create a new agent markdown file. Returns the file path or null if it already exists. */
export function createAgent(deps: AgentStoreDeps, projectPath: string, def: AgentDefinition, config?: AgentsConfig): string | null {
	const dir = agentsDir(deps, projectPath, config);
	deps.disk.mkdirSync(dir, { recursive: true });

	const filename = toMdFilename(def.name);
	const filePath = deps.paths.join(dir, filename);
	if (deps.disk.existsSync(filePath)) return null;

	const doc = Document.create(def.name)
		.mergeFrontmatter({
			type: "Agent",
			name: def.name,
			agentType: def.agentType,
			description: def.description || undefined,
		});
	if (def.domain) doc.setFrontmatter("domain", def.domain);

	buildFrontmatterArrays(doc, def);
	buildBody(doc, def);
	doc.save(filePath, deps.disk);
	writeJsonDefinition(deps, dir, def);
	return filePath;
}

// ── Update ───────────────────────────────────────────────────────────

/** Update a single frontmatter field on an agent file. Returns true if successful. */
export function updateAgentField(deps: AgentStoreDeps, projectPath: string, name: string, field: string, value: string, config?: AgentsConfig): boolean {
	const dir = agentsDir(deps, projectPath, config);
	const filePath = deps.paths.join(dir, toMdFilename(name));
	return updateField(deps, filePath, field, value);
}

/** Add an item to a frontmatter array field. Returns true if successful. */
export function addArrayItem(deps: AgentStoreDeps, projectPath: string, name: string, field: string, value: string, config?: AgentsConfig): boolean {
	const dir = agentsDir(deps, projectPath, config);
	const filePath = deps.paths.join(dir, toMdFilename(name));
	if (!deps.disk.existsSync(filePath)) return false;
	let content = deps.disk.readFileSync(filePath, "utf-8");

	const fieldRegex = new RegExp(`^${field}:`, "m");
	if (fieldRegex.test(content)) {
		const appendRegex = new RegExp(`(^${field}:.*(?:\\n\\s+-\\s+.*)*)`, "m");
		content = content.replace(appendRegex, `$1\n  - ${value}`);
	} else {
		content = content.replace(/^---\r?\n/, `---\n${field}:\n  - ${value}\n`);
	}
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return true;
}

/** Remove an item from a frontmatter array field by value. Returns true if found and removed. */
export function removeArrayItem(deps: AgentStoreDeps, projectPath: string, name: string, field: string, value: string, config?: AgentsConfig): boolean {
	const dir = agentsDir(deps, projectPath, config);
	const filePath = deps.paths.join(dir, toMdFilename(name));
	if (!deps.disk.existsSync(filePath)) return false;
	let content = deps.disk.readFileSync(filePath, "utf-8");

	const lineRegex = new RegExp(`^\\s+-\\s+${escapeRegex(value)}\\s*$\\n?`, "m");
	if (!lineRegex.test(content)) return false;
	content = content.replace(lineRegex, "");
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return true;
}

function escapeRegex(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Update the companion JSON file for an agent. Merges fields into existing JSON. */
export function updateAgentJson(deps: AgentStoreDeps, projectPath: string, name: string, patch: Partial<AgentJson>, config?: AgentsConfig): boolean {
	const dir = agentsDir(deps, projectPath, config);
	const jsonPath = deps.paths.join(dir, toMdFilename(name).replace(/\.md$/, ".json"));
	let existing: AgentJson = {};
	if (deps.disk.existsSync(jsonPath)) {
		try { existing = JSON.parse(deps.disk.readFileSync(jsonPath, "utf-8")) as AgentJson; } catch { /* ignore */ }
	}
	const merged = { ...existing, ...patch };
	deps.disk.mkdirSync(dir, { recursive: true });
	deps.disk.writeFileSync(jsonPath, JSON.stringify(merged, null, "\t"), "utf-8");
	return true;
}

/** Read the system prompt file for an agent (<name>.prompt.md). */
export function readSystemPrompt(deps: AgentStoreDeps, projectPath: string, name: string, config?: AgentsConfig): string | null {
	const dir = agentsDir(deps, projectPath, config);
	const promptPath = deps.paths.join(dir, toMdFilename(name).replace(/\.md$/, ".prompt.md"));
	if (!deps.disk.existsSync(promptPath)) return null;
	return deps.disk.readFileSync(promptPath, "utf-8");
}

/** Write the system prompt file for an agent (<name>.prompt.md). */
export function writeSystemPrompt(deps: AgentStoreDeps, projectPath: string, name: string, content: string, config?: AgentsConfig): boolean {
	const dir = agentsDir(deps, projectPath, config);
	deps.disk.mkdirSync(dir, { recursive: true });
	const promptPath = deps.paths.join(dir, toMdFilename(name).replace(/\.md$/, ".prompt.md"));
	deps.disk.writeFileSync(promptPath, content, "utf-8");
	return true;
}

// ── Delete ───────────────────────────────────────────────────────────

/** Delete an agent file (and companion JSON if present). Returns true if the file existed and was removed. */
export function deleteAgent(deps: AgentStoreDeps, projectPath: string, name: string, config?: AgentsConfig): boolean {
	const dir = agentsDir(deps, projectPath, config);
	const filePath = deps.paths.join(dir, toMdFilename(name));
	if (!deps.disk.existsSync(filePath)) return false;
	deps.disk.unlinkSync(filePath);
	const jsonPath = filePath.replace(/\.md$/, ".json");
	if (deps.disk.existsSync(jsonPath)) deps.disk.unlinkSync(jsonPath);
	return true;
}

// ── Serialization ────────────────────────────────────────────────────

function addOptionalField(result: Record<string, unknown>, key: string, value: unknown): void {
	if (value === undefined || value === null) return;
	if (Array.isArray(value) && value.length === 0) return;
	result[key] = value;
}

/** Convert an AgentSummary to a plain JSON-serializable object. */
export function agentToJson(agent: AgentSummary): Record<string, unknown> {
	const result: Record<string, unknown> = {
		name: agent.name,
		agentType: agent.agentType,
		description: agent.description,
		skills: agent.skills.map((s) => ({ name: s.name, level: s.level })),
		tools: agent.tools,
		roles: agent.roles,
	};
	addOptionalField(result, "domain", agent.domain);
	addOptionalField(result, "behaviors", agent.behaviors);
	addOptionalField(result, "components", agent.components);
	addOptionalField(result, "goals", agent.goals);
	addOptionalField(result, "ai", agent.ai);
	addOptionalField(result, "relationships", agent.relationships);
	return result;
}
