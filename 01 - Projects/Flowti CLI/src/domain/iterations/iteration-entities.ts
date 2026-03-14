/**
 * iteration-entities.ts — Create and manage entity markdown files for iterations.
 *
 * Agents, resource needs, and estimations are stored as markdown files
 * in the project's docs/ folder, each in their own subfolder.
 */

import { Document } from "../../infrastructure/document.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import { toMdFilename } from "../shared/markdown-store.js";
import { createAgent, agentsDir } from "../agents/agent-store.js";
import { listMdFiles } from "../shared/markdown-store.js";

export type EntityDeps = Pick<CliDeps, "disk" | "paths">;

// ── Default directories ─────────────────────────────────────────────

const RESOURCES_DIR = "docs/resources";
const ESTIMATIONS_DIR = "docs/estimations";

// ── Agent entities (delegates to agent-store) ───────────────────────

export interface AgentEntity {
	name: string;
	type: "human" | "ai";
	description?: string;
}

export function createAgentFile(deps: EntityDeps, projectPath: string, agent: AgentEntity): string {
	const result = createAgent(deps, projectPath, {
		name: agent.name,
		agentType: agent.type,
		description: agent.description ?? "",
		skills: [],
		tools: [],
		roles: [],
	});
	if (result) return result;
	// Already exists — return expected path
	const dir = agentsDir(deps, projectPath);
	return deps.paths.join(dir, toMdFilename(agent.name));
}

export function listAgentFiles(deps: EntityDeps, projectPath: string): string[] {
	const dir = agentsDir(deps, projectPath);
	return listMdFiles(deps, dir);
}

// ── Resource need entities ──────────────────────────────────────────

export interface ResourceNeedEntity {
	name: string;
	role?: string;
	allocation?: string;
}

export function createResourceFile(deps: EntityDeps, projectPath: string, resource: ResourceNeedEntity): string {
	const dir = deps.paths.join(projectPath, RESOURCES_DIR);
	deps.disk.mkdirSync(dir, { recursive: true });
	const filename = toMdFilename(resource.name);
	const filePath = deps.paths.join(dir, filename);
	if (deps.disk.existsSync(filePath)) return filePath;

	const doc = Document.create(resource.name)
		.mergeFrontmatter({
			type: "ResourceNeed",
			name: resource.name,
		});
	if (resource.role) doc.setFrontmatter("role", resource.role);
	if (resource.allocation) doc.setFrontmatter("allocation", resource.allocation);
	doc.addBlank().heading(1, resource.name).addBlank();
	doc.heading(2, "Requirements").addBlank()
		.text("<!-- Define requirements for this resource. -->");
	doc.save(filePath, deps.disk);
	return filePath;
}

// ── Estimation entities ─────────────────────────────────────────────

export interface EstimationEntity {
	label: string;
	value: string;
	unit?: string;
}

export function createEstimationFile(deps: EntityDeps, projectPath: string, estimation: EstimationEntity): string {
	const dir = deps.paths.join(projectPath, ESTIMATIONS_DIR);
	deps.disk.mkdirSync(dir, { recursive: true });
	const filename = toMdFilename(estimation.label);
	const filePath = deps.paths.join(dir, filename);
	if (deps.disk.existsSync(filePath)) return filePath;

	const doc = Document.create(estimation.label)
		.mergeFrontmatter({
			type: "Estimation",
			label: estimation.label,
			value: estimation.value,
		});
	if (estimation.unit) doc.setFrontmatter("unit", estimation.unit);
	doc.addBlank().heading(1, estimation.label).addBlank();
	doc.heading(2, "Breakdown").addBlank()
		.text("<!-- Add estimation breakdown details. -->");
	doc.save(filePath, deps.disk);
	return filePath;
}
