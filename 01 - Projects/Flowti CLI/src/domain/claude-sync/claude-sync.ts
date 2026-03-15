/**
 * claude-sync.ts — Synchronize agent/tool definitions to .claude/ for Claude Code.
 *
 * Generates:
 *   .claude/skills/agents/SKILL.md — On-demand skill with all agent definitions
 *   .claude/skills/tools/SKILL.md  — On-demand skill with all tool definitions
 *
 * Pure functions with injected deps. Called after agent/tool CRUD operations
 * and via the `flowti claude:sync` command.
 */

import type { CliDeps } from "../../infrastructure/deps.js";
import type { AgentSummary } from "../agents/agent-types.js";
import type { LoadedAiTool } from "../ai-tools/ai-tool-types.js";
import type { ClaudeSyncResult } from "./claude-sync-types.js";

export type ClaudeSyncDeps = Pick<CliDeps, "disk" | "paths">;

// ── Path constants (relative to vault root) ─────────────────────────

const AGENT_SKILL_PATH = ".claude/skills/agents/SKILL.md";
const TOOL_SKILL_PATH = ".claude/skills/tools/SKILL.md";

// ── Helpers ─────────────────────────────────────────────────────────

function formatSkills(agent: AgentSummary): string {
	if (agent.skills.length === 0) return "—";
	return agent.skills.map((s) => s.level ? `${s.name} (${s.level})` : s.name).join(", ");
}

function formatList(items: string[]): string {
	return items.length > 0 ? items.join(", ") : "—";
}

function promptFileName(agentFile: string): string {
	return agentFile.replace(/\.md$/, ".prompt.md");
}

function readPrompt(deps: ClaudeSyncDeps, agentsDir: string, agentFile: string): string | null {
	const promptPath = deps.paths.join(agentsDir, promptFileName(agentFile));
	if (!deps.disk.existsSync(promptPath)) return null;
	return deps.disk.readFileSync(promptPath, "utf-8");
}

function slugToLabel(slug: string): string {
	const name = slug.includes(":") ? slug.split(":").pop()! : slug;
	return name.replace(/-/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

function appendSkillMap(lines: string[], domain: string | undefined, skillMap?: Record<string, string[]>): void {
	if (!domain || !skillMap) return;
	const skills = skillMap[domain];
	if (!skills || skills.length === 0) return;
	lines.push("**Recommended Skills**:");
	for (const slug of skills) lines.push(`- \`/${slug}\` — ${slugToLabel(slug)}`);
	lines.push("");
}

// ── Agent skill content ─────────────────────────────────────────────

function agentDetailBlock(agent: AgentSummary, prompt: string | null, skillMap?: Record<string, string[]>): string {
	const lines: string[] = [];
	lines.push(`## ${agent.name}\n`);
	lines.push(`**Type**: ${agent.agentType}`);
	if (agent.domain) lines.push(` | **Domain**: ${agent.domain}`);
	lines.push("");
	if (agent.description) lines.push(`> ${agent.description}\n`);
	if (agent.skills.length > 0) {
		lines.push("**Skills**:");
		for (const s of agent.skills) lines.push(`- ${s.name}${s.level ? ` (${s.level})` : ""}`);
		lines.push("");
	}
	if (agent.tools.length > 0) lines.push(`**Tools**: ${agent.tools.join(", ")}\n`);
	if (agent.roles.length > 0) lines.push(`**Roles**: ${agent.roles.join(", ")}\n`);
	if (agent.preferredPhases && agent.preferredPhases.length > 0) lines.push(`**Preferred Phases**: ${agent.preferredPhases.join(", ")}\n`);
	if (agent.behaviors && agent.behaviors.length > 0) lines.push(`**Behaviors**: ${agent.behaviors.join(", ")}\n`);
	if (agent.relationships && agent.relationships.length > 0) {
		lines.push("**Relationships**:");
		for (const r of agent.relationships) lines.push(`- ${r.type} → ${r.target}${r.description ? `: ${r.description}` : ""}`);
		lines.push("");
	}
	if (agent.inventory && agent.inventory.length > 0) {
		lines.push("**Inventory**:");
		for (const item of agent.inventory) lines.push(`- \`${item.path}\`${item.label ? ` — ${item.label}` : ""}`);
		lines.push("");
	}
	appendSkillMap(lines, agent.domain, skillMap);
	if (prompt) {
		lines.push("### System Prompt\n");
		lines.push(prompt.trim());
		lines.push("");
	}
	return lines.join("\n");
}

/** Generate the full SKILL.md content for the /agents skill. */
export function generateAgentSkillContent(agents: AgentSummary[], agentsDir: string, deps: ClaudeSyncDeps, skillMap?: Record<string, string[]>): string {
	const lines: string[] = [];

	// Frontmatter
	lines.push("---");
	lines.push("name: agents");
	lines.push("description: Browse all Flowti agent definitions — roster, skills, tools, roles, and system prompts");
	lines.push("user-invocable: true");
	lines.push("---\n");

	lines.push("# Flowti Agents\n");

	if (agents.length === 0) {
		lines.push("No agents defined. Use `flowti agents:add` to create one.\n");
		return lines.join("\n");
	}

	// Summary table
	lines.push("## Roster\n");
	lines.push("| Agent | Type | Domain | Roles | Skills |");
	lines.push("|-------|------|--------|-------|--------|");
	for (const a of agents) {
		lines.push(`| ${a.name} | ${a.agentType} | ${a.domain ?? "—"} | ${formatList(a.roles)} | ${formatSkills(a)} |`);
	}
	lines.push("");

	// Detail sections
	for (const agent of agents) {
		const prompt = readPrompt(deps, agentsDir, agent.file);
		lines.push("---\n");
		lines.push(agentDetailBlock(agent, prompt, skillMap));
	}

	return lines.join("\n");
}

// ── Tool skill content ──────────────────────────────────────────────

/** Generate the full SKILL.md content for the /tools skill. */
export function generateToolSkillContent(tools: LoadedAiTool[]): string {
	const lines: string[] = [];

	// Frontmatter
	lines.push("---");
	lines.push("name: tools");
	lines.push("description: Browse all Flowti AI tool definitions — commands, parameters, and usage");
	lines.push("user-invocable: true");
	lines.push("---\n");

	lines.push("# Flowti AI Tools\n");

	const valid = tools.filter((t) => t.valid);
	if (valid.length === 0) {
		lines.push("No tools defined. Use `flowti ai:new` to create one.\n");
		return lines.join("\n");
	}

	// Summary table
	lines.push("| Tool | Version | Description | Tags |");
	lines.push("|------|---------|-------------|------|");
	for (const t of valid) {
		const d = t.definition;
		lines.push(`| ${d.name} | ${d.version ?? "—"} | ${d.description} | ${d.tags?.join(", ") ?? "—"} |`);
	}
	lines.push("");

	// Detail sections
	for (const t of valid) {
		const d = t.definition;
		lines.push("---\n");
		lines.push(`## ${d.name}\n`);
		lines.push(`> ${d.description}\n`);
		lines.push(`**Run**: \`${d.run}\``);
		if (d.cwd) lines.push(`**Working Directory**: \`${d.cwd}\``);
		if (d.version) lines.push(`**Version**: ${d.version}`);
		lines.push("");
		if (d.params && d.params.length > 0) {
			lines.push("**Parameters**:\n");
			lines.push("| Name | Type | Required | Description |");
			lines.push("|------|------|----------|-------------|");
			for (const p of d.params) {
				const req = p.required ? "yes" : "no";
				const def = p.default !== undefined ? ` (default: ${p.default})` : "";
				lines.push(`| ${p.name} | ${p.type} | ${req} | ${p.description}${def} |`);
			}
			lines.push("");
		}
		if (d.tags && d.tags.length > 0) lines.push(`**Tags**: ${d.tags.join(", ")}\n`);
	}

	return lines.join("\n");
}

// ── Sync operations ─────────────────────────────────────────────────

function ensureDir(deps: ClaudeSyncDeps, dirPath: string): void {
	deps.disk.mkdirSync(dirPath, { recursive: true });
}

/** Sync all agent definitions to .claude/skills/agents/SKILL.md. */
export function syncAgentsToClaude(deps: ClaudeSyncDeps, vaultRoot: string, agentsDir: string, agents: AgentSummary[], skillMap?: Record<string, string[]>): ClaudeSyncResult {
	const content = generateAgentSkillContent(agents, agentsDir, deps, skillMap);
	const skillPath = deps.paths.join(vaultRoot, AGENT_SKILL_PATH);
	ensureDir(deps, deps.paths.dirname(skillPath));
	deps.disk.writeFileSync(skillPath, content, "utf-8");
	return { written: [skillPath] };
}

/** Sync all tool definitions to .claude/skills/tools/SKILL.md. */
export function syncToolsToClaude(deps: ClaudeSyncDeps, vaultRoot: string, tools: LoadedAiTool[]): ClaudeSyncResult {
	const content = generateToolSkillContent(tools);
	const skillPath = deps.paths.join(vaultRoot, TOOL_SKILL_PATH);
	ensureDir(deps, deps.paths.dirname(skillPath));
	deps.disk.writeFileSync(skillPath, content, "utf-8");
	return { written: [skillPath] };
}

/** Full sync: agents + tools. Idempotent — safe to call repeatedly. */
export function syncAllToClaude(
	deps: ClaudeSyncDeps,
	vaultRoot: string,
	agentsDir: string,
	agents: AgentSummary[],
	tools: LoadedAiTool[],
	skillMap?: Record<string, string[]>,
): ClaudeSyncResult {
	const agentResult = syncAgentsToClaude(deps, vaultRoot, agentsDir, agents, skillMap);
	const toolResult = syncToolsToClaude(deps, vaultRoot, tools);
	return { written: [...agentResult.written, ...toolResult.written] };
}
