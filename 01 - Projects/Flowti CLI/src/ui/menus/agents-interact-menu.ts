/** agents-interact-menu.ts — Talk, task assignment, and project assignment for agents. */
import { printHeader, RESET, DIM, GREEN, RED, CYAN, BOLD } from "../../infrastructure/ui.js";
import { startSpinner } from "../../infrastructure/progress.js";
import type { MenuDeps, ShellMenuDeps } from "../../infrastructure/deps.js";
import type { AgentsConfig, ProjectConfig } from "../../infrastructure/types.js";
import { readSystemPrompt } from "../../domain/agents/agent-store.js";
import type { AgentSummary } from "../../domain/agents/agent-types.js";
import { buildConversationPrompt, buildClarificationPrompt, buildTalkCommand, parseAgentResponse } from "../../domain/agents/agent-conversation.js";
import type { ConversationTurn, AgentResponse } from "../../domain/agents/agent-conversation.js";
import { readProjectConfig, updateProjectConfig } from "../../domain/project/project-config.js";
import { listProjects } from "../../domain/project/project.js";

// ── Talk ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<AgentResponse["status"], string> = {
	message: "",
	question: ` ${DIM}(question)${RESET}`,
	ready: ` ${GREEN}(ready)${RESET}`,
	error: ` ${RED}(error)${RESET}`,
};

/** Display a parsed agent response. */
function displayResponse(agentName: string, parsed: AgentResponse, deps: ShellMenuDeps): void {
	const tag = STATUS_LABELS[parsed.status];
	deps.log(`\n  ${CYAN}${BOLD}${agentName}:${RESET}${tag}`);
	for (const line of parsed.message.split("\n")) deps.log(`    ${line}`);
	deps.log("");
}

/** Start a spinner with elapsed-time updates. Returns a stop function. */
function startThinking(agentName: string): () => void {
	const start = Date.now();
	const spinner = startSpinner(`${agentName} is thinking...`);
	const timer = setInterval(() => {
		const secs = Math.round((Date.now() - start) / 1000);
		spinner.update(`${agentName} is thinking... ${DIM}(${secs}s)${RESET}`);
	}, 1000);
	return () => { clearInterval(timer); spinner.stop(); };
}

/** Send a single message to an agent via Claude CLI and return the parsed response (or null on failure). */
async function sendTurn(
	agentName: string, systemPrompt: string | null, history: readonly ConversationTurn[],
	userMessage: string, model: string | undefined, deps: ShellMenuDeps,
): Promise<AgentResponse | null> {
	const content = buildConversationPrompt(agentName, systemPrompt, history, userMessage);
	const stopSpinner = startThinking(agentName);
	const { output, exitCode } = await deps.shell.runAsync(buildTalkCommand(model), { timeout: 120000, input: content });
	stopSpinner();
	if (exitCode !== 0 || !output.trim()) {
		deps.log(`  ${RED}Agent did not respond.${RESET}`);
		if (output.trim()) deps.log(`  ${DIM}${output.trim()}${RESET}`);
		deps.log("");
		return null;
	}
	const parsed = parseAgentResponse(output);
	displayResponse(agentName, parsed, deps);
	return parsed;
}

/** Prompt the user — direct prompt when agent asked a question, optional hint otherwise. */
async function askUser(lastStatus: AgentResponse["status"] | null, deps: ShellMenuDeps, label: string, hint: string): Promise<string> {
	if (lastStatus === null || lastStatus === "question") {
		return deps.input.ask(label);
	}
	return deps.input.ask(`${label} ${DIM}(${hint})${RESET}`, "");
}

/**
 * Interactive conversation loop with an agent via Claude CLI.
 *
 * Flow: user types a message → Claude responds → user replies or ends.
 * Agent responses are parsed as JSON: status "question" triggers a direct prompt.
 */
export async function talkToAgentInteractive(projectPath: string, agent: AgentSummary, config: AgentsConfig | undefined, deps: ShellMenuDeps): Promise<void> {
	printHeader(`Talk — ${agent.name}`);
	if (!deps.shell.check("claude --version")) {
		deps.log(`  ${RED}Claude CLI is not installed or not in PATH.${RESET}`);
		deps.log(`  ${DIM}Install it to enable agent conversations.${RESET}\n`);
		return;
	}

	const systemPrompt = readSystemPrompt(deps, projectPath, agent.name, config);
	if (systemPrompt) deps.log(`  ${DIM}System prompt loaded (${systemPrompt.length} chars)${RESET}\n`);

	const history: ConversationTurn[] = [];
	let lastStatus: AgentResponse["status"] | null = null;

	for (;;) {
		const prompt = await askUser(lastStatus, deps, `  ${BOLD}You${RESET}`, "Enter to end");
		if (!prompt) break;

		const response = await sendTurn(agent.name, systemPrompt, history, prompt, agent.ai?.model, deps);
		if (!response) break;
		history.push({ role: "user", content: prompt }, { role: "agent", content: response.message });
		lastStatus = response.status;
	}

	if (history.length > 0) deps.log(`  ${DIM}Conversation ended (${history.length / 2} exchanges).${RESET}\n`);
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

export interface AssignedTask {
	readonly taskName: string;
	readonly taskDescription: string;
	readonly taskContext: string;
}

export async function assignTaskInteractive(projectPath: string, agent: AgentSummary, config: AgentsConfig | undefined, deps: MenuDeps, taskCtx?: TaskContext): Promise<AssignedTask | undefined> {
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
	if (!taskName) return undefined;
	const taskDesc = await deps.input.ask("Task description (what to do)");
	if (!taskDesc) return undefined;
	const context = await deps.input.ask("Context (optional)", "");

	const parts = [`# Task: ${taskName}`, "", `**Agent:** ${agent.name}`, `**Description:** ${taskDesc}`];
	if (context) parts.push(`**Context:** ${context}`);
	appendContextLinks(parts, taskCtx);
	if (capabilities.length > 0) parts.push("", "## Available Capabilities", ...capabilities.map((c) => `- ${c}`));

	const taskContent = parts.join("\n");
	const taskFile = deps.paths.join(deps.paths.dirname(agent.file), `${agent.name}.task.md`);
	deps.disk.writeFileSync(taskFile, taskContent, "utf-8");
	deps.log(`\n  ${GREEN}✓${RESET} Task saved: ${DIM}${deps.paths.relative(projectPath, taskFile)}${RESET}\n`);
	return { taskName, taskDescription: taskDesc, taskContext: context };
}

/** Send a single clarification turn to the agent. */
async function sendClarification(
	agentName: string, systemPrompt: string | null, taskName: string, taskDesc: string, taskContext: string,
	history: readonly ConversationTurn[], userReply: string | undefined, model: string | undefined,
	deps: ShellMenuDeps,
): Promise<AgentResponse | null> {
	const content = buildClarificationPrompt(agentName, systemPrompt, taskName, taskDesc, taskContext, history, userReply);
	const stopSpinner = startThinking(agentName);
	const { output, exitCode } = await deps.shell.runAsync(buildTalkCommand(model), { timeout: 120000, input: content });
	stopSpinner();
	if (exitCode !== 0 || !output.trim()) return null;
	const parsed = parseAgentResponse(output);
	displayResponse(agentName, parsed, deps);
	return parsed;
}

/** Run the back-and-forth clarification loop after the agent's initial review. */
async function runClarificationLoop(
	agentName: string, systemPrompt: string | null, taskName: string, taskDesc: string,
	taskContext: string, history: ConversationTurn[], model: string | undefined,
	deps: ShellMenuDeps, lastStatus: AgentResponse["status"],
): Promise<void> {
	let status = lastStatus;
	for (;;) {
		if (status === "ready") {
			deps.log(`  ${GREEN}✓${RESET} ${agentName} is ready to begin.\n`);
			break;
		}
		const reply = await askUser(status, deps, `  ${BOLD}You${RESET}`, "Enter when ready to start");
		if (!reply) break;
		const response = await sendClarification(agentName, systemPrompt, taskName, taskDesc, taskContext, history, reply, model, deps);
		if (!response) break;
		history.push({ role: "user", content: reply }, { role: "agent", content: response.message });
		status = response.status;
	}
}

/**
 * Clarification dialog for AI agents — the agent reviews the task
 * and asks questions until the user confirms readiness.
 */
export async function clarifyTaskInteractive(
	projectPath: string, agent: AgentSummary, config: AgentsConfig | undefined,
	taskName: string, taskDesc: string, taskContext: string, deps: ShellMenuDeps,
): Promise<void> {
	if (agent.agentType !== "ai" || !deps.shell.check("claude --version")) return;

	deps.log(`  ${DIM}${agent.name} is reviewing the task...${RESET}`);
	const systemPrompt = readSystemPrompt(deps, projectPath, agent.name, config);
	const history: ConversationTurn[] = [];

	const initial = await sendClarification(agent.name, systemPrompt, taskName, taskDesc, taskContext, history, undefined, agent.ai?.model, deps);
	if (!initial) return;
	history.push({ role: "agent", content: initial.message });

	await runClarificationLoop(agent.name, systemPrompt, taskName, taskDesc, taskContext, history, agent.ai?.model, deps, initial.status);
	if (history.length > 0) deps.log(`  ${DIM}Clarification complete (${Math.ceil(history.length / 2)} exchanges).${RESET}\n`);
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
