/** agents-interact-menu.ts — Talk, task assignment, and project assignment for agents. */
import { printHeader, RESET, DIM, GREEN, RED, CYAN, BOLD } from "../../infrastructure/ui.js";
import type { MenuDeps } from "../../infrastructure/deps.js";
import type { AgentsConfig, ProjectConfig } from "../../infrastructure/types.js";
import { readSystemPrompt, writeSystemPrompt } from "../../domain/agents/agent-store.js";
import type { AgentSummary } from "../../domain/agents/agent-types.js";
import { readProjectConfig, updateProjectConfig } from "../../domain/project/project-config.js";
import { listProjects } from "../../domain/project/project.js";

// ── Shared helpers ──────────────────────────────────────────────────

async function readMultilineInput(deps: MenuDeps): Promise<string | null> {
	const lines: string[] = [];
	for (;;) {
		const line = await deps.input.ask("");
		if (line === "") break;
		lines.push(line);
	}
	return lines.length > 0 ? lines.join("\n") : null;
}

function showPromptPreview(current: string, deps: MenuDeps): void {
	deps.log(`  ${BOLD}Current prompt${RESET} ${DIM}(${current.length} chars)${RESET}\n`);
	const lines = current.split("\n");
	for (const line of lines.slice(0, 8)) deps.log(`  ${DIM}${line}${RESET}`);
	if (lines.length > 8) deps.log(`  ${DIM}... (${lines.length - 8} more lines)${RESET}`);
	deps.log("");
}

// ── Talk ─────────────────────────────────────────────────────────────

export async function talkToAgentInteractive(projectPath: string, agent: AgentSummary, config: AgentsConfig | undefined, deps: MenuDeps): Promise<void> {
	printHeader(`Talk — ${agent.name}`);
	const current = readSystemPrompt(deps, projectPath, agent.name, config);
	if (current) showPromptPreview(current, deps);
	else deps.log(`  ${DIM}No prompt file yet.${RESET}\n`);

	const action = current
		? await deps.input.ask("(e)dit / (r)eplace / (d)elete / Enter to skip", "")
		: await deps.input.ask("(w)rite new prompt / Enter to skip", "");
	if (!action) return;

	if (action === "d" && current) {
		writeSystemPrompt(deps, projectPath, agent.name, "", config);
		deps.log(`  ${GREEN}✓${RESET} Prompt cleared.\n`);
		return;
	}
	if (action === "e" && current) {
		deps.log(`  ${DIM}Enter lines (empty line to finish):${RESET}`);
		const addition = await readMultilineInput(deps);
		if (!addition) return;
		const merged = current + "\n\n" + addition;
		writeSystemPrompt(deps, projectPath, agent.name, merged, config);
		deps.log(`  ${GREEN}✓${RESET} Prompt updated (${merged.length} chars).\n`);
		return;
	}
	deps.log(`  ${DIM}Enter prompt lines (empty line to finish):${RESET}`);
	const content = await readMultilineInput(deps);
	if (!content) return;
	writeSystemPrompt(deps, projectPath, agent.name, content, config);
	deps.log(`  ${GREEN}✓${RESET} Prompt saved (${content.length} chars).\n`);
}

// ── Assign Task ─────────────────────────────────────────────────────

export interface TaskContext {
	readonly projectName?: string;
	readonly iterationFile?: string;
	readonly iterationNumber?: number;
}

function agentCapabilities(agent: AgentSummary): string[] {
	return [
		...agent.skills.map((s) => `skill: ${s.name}`),
		...agent.tools.map((t) => `tool: ${t}`),
		...agent.roles.map((r) => `role: ${r}`),
	];
}

export async function assignTaskInteractive(projectPath: string, agent: AgentSummary, config: AgentsConfig | undefined, deps: MenuDeps, taskCtx?: TaskContext): Promise<void> {
	printHeader(`Assign Task — ${agent.name}`);
	const capabilities = agentCapabilities(agent);
	if (capabilities.length > 0) {
		deps.log(`  ${BOLD}Capabilities${RESET}`);
		for (let i = 0; i < capabilities.length; i++) deps.log(`  ${CYAN}${i + 1})${RESET} ${capabilities[i]}`);
		deps.log("");
	} else {
		deps.log(`  ${DIM}No skills, tools, or roles defined yet.${RESET}\n`);
	}

	const taskName = await deps.input.ask("Task name");
	if (!taskName) return;
	const taskDesc = await deps.input.ask("Task description (what to do)");
	if (!taskDesc) return;
	const context = await deps.input.ask("Context (optional)", "");

	const parts = [`# Task: ${taskName}`, "", `**Agent:** ${agent.name}`, `**Description:** ${taskDesc}`];
	if (context) parts.push(`**Context:** ${context}`);
	appendContextLinks(parts, taskCtx);
	if (capabilities.length > 0) parts.push("", "## Available Capabilities", ...capabilities.map((c) => `- ${c}`));

	const taskContent = parts.join("\n");
	const taskFile = deps.paths.join(deps.paths.dirname(agent.file), `${agent.name}.task.md`);
	deps.disk.writeFileSync(taskFile, taskContent, "utf-8");
	deps.log(`\n  ${GREEN}✓${RESET} Task saved: ${DIM}${deps.paths.relative(projectPath, taskFile)}${RESET}\n`);
}

function appendContextLinks(parts: string[], taskCtx?: TaskContext): void {
	if (!taskCtx) return;
	const links: string[] = [];
	if (taskCtx.iterationFile) {
		const target = taskCtx.iterationFile.replace(/\.md$/, "");
		links.push(`[[${target}|Iteration #${taskCtx.iterationNumber ?? "?"} Plan]]`);
	}
	if (taskCtx.projectName) links.push(`**Project:** ${taskCtx.projectName}`);
	if (links.length > 0) {
		parts.push("");
		parts.push("## Context");
		for (const link of links) parts.push(`- ${link}`);
	}
}

// ── Assign to Project ───────────────────────────────────────────────

function resolveProjectByChoice(choice: string, projects: string[]): string | undefined {
	const idx = parseInt(choice, 10);
	if (!isNaN(idx) && idx >= 1 && idx <= projects.length) return projects[idx - 1];
	return projects.find((p) => p.toLowerCase() === choice.toLowerCase());
}

function showProjectList(projects: string[], projectsDir: string, agentName: string, deps: MenuDeps): void {
	deps.log(`  ${BOLD}Projects${RESET}\n`);
	for (let i = 0; i < projects.length; i++) {
		const { config } = readProjectConfig(deps.paths.join(projectsDir, projects[i]), deps);
		const assigned = (config?.management?.agents?.roster ?? []).some((n) => n.toLowerCase() === agentName.toLowerCase());
		deps.log(`  ${CYAN}${i + 1})${RESET} ${projects[i]}${assigned ? ` ${GREEN}(assigned)${RESET}` : ""}`);
	}
	deps.log("");
}

function persistRoster(projectPath: string, projectConfig: ProjectConfig, newRoster: string[], deps: MenuDeps): boolean {
	const ok = updateProjectConfig(projectPath, deps, (cfg) => {
		if (!cfg.management) cfg.management = {};
		if (!cfg.management.agents) cfg.management.agents = {};
		cfg.management.agents.roster = newRoster;
	});
	if (ok) {
		projectConfig.management = projectConfig.management ?? {};
		projectConfig.management.agents = projectConfig.management.agents ?? {};
		projectConfig.management.agents.roster = newRoster;
	}
	return ok;
}

function tryAssignAgent(projectPath: string, projectName: string, agentName: string, deps: MenuDeps): void {
	const { config } = readProjectConfig(projectPath, deps);
	if (!config) { deps.log(`  ${DIM}No flowti.config.json found for "${projectName}".${RESET}\n`); return; }
	const roster = config.management?.agents?.roster ?? [];
	if (roster.some((n) => n.toLowerCase() === agentName.toLowerCase())) {
		deps.log(`  ${DIM}${agentName} is already assigned to ${projectName}.${RESET}\n`);
		return;
	}
	if (persistRoster(projectPath, config, [...roster, agentName], deps)) {
		deps.log(`  ${GREEN}✓${RESET} Assigned ${agentName} to ${projectName}.\n`);
	}
}

export async function assignToProjectInteractive(vaultRoot: string, agent: AgentSummary, deps: MenuDeps): Promise<void> {
	printHeader(`Assign to Project — ${agent.name}`);
	const projectsDir = deps.paths.join(vaultRoot, "01 - Projects");
	const projects = listProjects(projectsDir, deps);
	if (projects.length === 0) { deps.log(`  ${DIM}No projects found.${RESET}\n`); return; }

	showProjectList(projects, projectsDir, agent.name, deps);
	const choice = await deps.input.ask("Project number or name");
	if (!choice) return;
	const projectName = resolveProjectByChoice(choice, projects);
	if (!projectName) { deps.log(`  ${RED}Project "${choice}" not found.${RESET}\n`); return; }
	tryAssignAgent(deps.paths.join(projectsDir, projectName), projectName, agent.name, deps);
}
