/** agents-interact-menu.ts — Talk, task assignment, and project assignment for agents. */
import { printHeader, RESET, DIM, GREEN, RED, CYAN, BOLD } from "../../infrastructure/ui.js";
import type { MenuDeps, ShellMenuDeps } from "../../infrastructure/deps.js";
import type { AgentsConfig, ProjectConfig, IAgentProcessRunner } from "../../infrastructure/types.js";
import { readSystemPrompt } from "../../domain/agents/agent-store.js";
import type { AgentSummary } from "../../domain/agents/agent-types.js";
import { buildConversationPrompt, buildClarificationPrompt, parseAgentResponse } from "../../domain/agents/agent-conversation.js";
import type { AgentResponse, AgentCharacter } from "../../domain/agents/agent-conversation.js";
import type { ConversationTurn } from "../../domain/agents/agent-conversation-store.js";
import { readProjectConfig, updateProjectConfig } from "../../domain/project/project-config.js";
import { listProjects } from "../../domain/project/project.js";
import type { ThinkingDisplay } from "../displays/agent-run-display.js";

/** Deps for talk/clarify functions — needs processRunner for LLM spawning. */
export type TalkDeps = ShellMenuDeps & { readonly processRunner: IAgentProcessRunner };

// ── Spinner ──────────────────────────────────────────────────────────

const SPINNER_FRAMES = ["   ", ".  ", ".. ", "..."];

function createSpinner(label: string, log: (msg?: string) => void, hint?: string): { stop: () => void } {
	let frame = 0;
	const hintText = hint ? `  ${DIM}${hint}${RESET}` : "";
	const render = (): void => { process.stdout.write(`\r  ${DIM}${label}${SPINNER_FRAMES[frame % SPINNER_FRAMES.length]}${RESET}${hintText}`); };
	render();
	const timer = setInterval(() => { frame++; render(); }, 400);
	return {
		stop() {
			clearInterval(timer);
			const clearLen = label.length + SPINNER_FRAMES[0].length + (hint ? hint.length + 6 : 0) + 4;
			process.stdout.write(`\r${" ".repeat(clearLen)}\r`);
		},
	};
}

/** Check for unread agent notes in the inbox. */
export function checkAgentNotifications(deps: Pick<ShellMenuDeps, "disk" | "paths" | "log">): void {
	const inboxDir = deps.paths.join(deps.paths.resolve("."), "00 - Connectivity", "inbox");
	if (!deps.disk.existsSync(inboxDir)) return;
	const files = deps.disk.readdirSync(inboxDir).filter((f) => f.endsWith(".md"));
	const agentNotes: string[] = [];
	for (const file of files) {
		const content = deps.disk.readFileSync(deps.paths.join(inboxDir, file), "utf-8");
		if (content.includes("type: agent-note")) {
			const personaMatch = content.match(/^persona:\s*(.+)$/m);
			if (personaMatch) agentNotes.push(personaMatch[1]);
		}
	}
	if (agentNotes.length > 0) {
		const unique = [...new Set(agentNotes)];
		deps.log(`  ${CYAN}You have ${agentNotes.length} note${agentNotes.length > 1 ? "s" : ""} from: ${unique.join(", ")}${RESET}`);
		deps.log(`  ${DIM}Check your inbox: 00 - Connectivity/inbox/${RESET}\n`);
	}
}

// ── Talk ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<AgentResponse["status"], string> = {
	message: "",
	question: ` ${DIM}(question)${RESET}`,
	ready: ` ${GREEN}(ready)${RESET}`,
	error: ` ${RED}(error)${RESET}`,
};

/** Display a parsed agent response with optional persona name. */
function displayResponse(agentName: string, parsed: AgentResponse, deps: TalkDeps, persona?: string): void {
	const displayName = persona ?? agentName;
	const tag = STATUS_LABELS[parsed.status];
	deps.log(`\n  ${CYAN}${BOLD}${displayName}${RESET}${tag}`);
	for (const line of parsed.message.split("\n")) deps.log(`    ${line}`);
	deps.log("");
}

/** Send a single message to an agent via processRunner.spawn() and return the parsed response (or null on failure). */
async function sendTurn(
	agent: AgentSummary, systemPrompt: string | null,
	history: readonly ConversationTurn[],
	userMessage: string, deps: TalkDeps, thinkingDisplay: ThinkingDisplay,
	character?: AgentCharacter, processTimeoutMs?: number,
): Promise<{ response: AgentResponse; thinking: string } | null> {
	const oldHistory = history.map((t) => ({ role: t.role, content: t.content }));
	const content = buildConversationPrompt(agent.name, systemPrompt, oldHistory, userMessage, character);

	const who = character?.persona ?? agent.name;
	const proc = deps.processRunner.spawn(agent, content);

	// Animated spinner — shows immediately with detach hint
	const spinner = createSpinner(who, deps.log, "Enter to step away");
	let gotFirstEvent = false;

	proc.onEvent((event) => {
		if (!gotFirstEvent) { gotFirstEvent = true; spinner.stop(); }
		if (event.kind === "thinking") {
			if (thinkingDisplay === "full") {
				deps.log(`  ${DIM}${event.text}${RESET}`);
			} else if (thinkingDisplay !== "hidden") {
				const preview = event.text.trim().slice(0, 80);
				if (preview) process.stdout.write(`\r  ${DIM}${who}: ${preview}${preview.length >= 80 ? "..." : ""}${RESET}${" ".repeat(10)}\r`);
			}
		}
	});

	// Race: proc.result vs user detach
	const detach = deps.input.askAbortable("");
	let sessionDone = false;
	detach.promise.then(() => { if (!sessionDone) { spinner.stop(); proc.kill(); } });
	const result = await proc.result;
	sessionDone = true;
	detach.abort();
	// Let the aborted readline drain before the next input.ask()
	await new Promise((r) => setTimeout(r, 50));
	spinner.stop();
	// Clear the thinking preview line
	process.stdout.write(`\r${" ".repeat(100)}\r`);

	if (result.exitCode !== 0 && !result.text) return null;
	if (!result.text) {
		deps.log(`  ${DIM}${who} will leave a note in your inbox when done.${RESET}\n`);
		return { response: { message: "", status: "message" as const }, thinking: "" };
	}
	return { response: parseAgentResponse(result.text), thinking: result.thinking };
}

/** Prompt the user — direct prompt when agent asked a question, optional hint otherwise. */
async function askUser(lastStatus: AgentResponse["status"] | null, deps: TalkDeps, label: string, hint: string): Promise<string> {
	if (lastStatus === null || lastStatus === "question") {
		return deps.input.ask(label);
	}
	return deps.input.ask(`${label} ${DIM}(${hint})${RESET}`, "");
}

/**
 * Interactive conversation loop with an agent via processRunner.spawn().
 *
 * Flow: user types a message -> Claude responds via streaming -> user replies or ends.
 * Conversation history is persisted across sessions in .flowti/var/conversations/.
 */
export async function talkToAgentInteractive(projectPath: string, agent: AgentSummary, config: AgentsConfig | undefined, deps: TalkDeps): Promise<void> {
	const talkTitle = agent.persona ? `Talk — ${agent.persona} (${agent.name})` : `Talk — ${agent.name}`;
	printHeader(talkTitle);
	if (!deps.shell.check("claude --version")) {
		deps.log(`  ${RED}Claude CLI is not installed or not in PATH.${RESET}`);
		deps.log(`  ${DIM}Install it to enable agent conversations.${RESET}\n`);
		return;
	}

	const { loadConversation, saveConversation, createThread, appendTurn, getActiveHistory } = await import("../../domain/agents/agent-conversation-store.js");

	const varDir = deps.paths.join(deps.paths.resolve("."), ".flowti", "var");
	let conversation = loadConversation(deps, varDir, agent.name);
	const thinkingDisplay: ThinkingDisplay = config?.thinkingDisplay ?? "indicator";
	const systemPrompt = readSystemPrompt(deps, projectPath, agent.name, config);
	const character: AgentCharacter = {
		description: agent.description, persona: agent.persona,
		mood: agent.mood, personality: agent.personality,
		attributes: agent.attributes, experience: agent.experience,
	};

	if (systemPrompt) deps.log(`  ${DIM}System prompt loaded (${systemPrompt.length} chars)${RESET}\n`);

	if (conversation.activeThread) {
		const history = getActiveHistory(conversation);
		deps.log(`\n  Resuming conversation (${history.length} turns). Send empty to start fresh.\n`);
	}

	conversation = await runTalkLoop(agent, systemPrompt, conversation, thinkingDisplay, varDir, deps, { createThread, appendTurn, getActiveHistory, saveConversation }, character, config?.processTimeoutMs);

	const finalHistory = conversation.activeThread ? getActiveHistory(conversation) : [];
	if (finalHistory.length > 0) deps.log(`  ${DIM}Conversation ended (${Math.ceil(finalHistory.length / 2)} exchanges).${RESET}\n`);
}

interface ConversationOps {
	createThread: typeof import("../../domain/agents/agent-conversation-store.js").createThread;
	appendTurn: typeof import("../../domain/agents/agent-conversation-store.js").appendTurn;
	getActiveHistory: typeof import("../../domain/agents/agent-conversation-store.js").getActiveHistory;
	saveConversation: typeof import("../../domain/agents/agent-conversation-store.js").saveConversation;
}

async function runTalkLoop(
	agent: AgentSummary, systemPrompt: string | null,
	conversation: import("../../domain/agents/agent-conversation-store.js").ConversationFile,
	thinkingDisplay: ThinkingDisplay, varDir: string, deps: TalkDeps, ops: ConversationOps,
	character?: AgentCharacter, processTimeoutMs?: number,
): Promise<import("../../domain/agents/agent-conversation-store.js").ConversationFile> {
	let conv = conversation;
	let lastStatus: AgentResponse["status"] | null = null;

	while (true) {
		const userInput = await askUser(lastStatus, deps, `  ${BOLD}You${RESET}`, "Enter to end");
		if (userInput === undefined || userInput === "" || userInput === "exit" || userInput === "quit") break;
		if (userInput === "new") {
			conv = ops.createThread(conv, `thread-${deps.clock.ms()}`, deps.clock.iso());
			ops.saveConversation(deps, varDir, agent.name, conv);
			deps.log("\n  New conversation started.\n");
			lastStatus = null;
			continue;
		}
		if (!conv.activeThread) conv = ops.createThread(conv, `thread-${deps.clock.ms()}`, deps.clock.iso());
		const exchangeResult = await processTurnExchange(agent, systemPrompt, conv, userInput, deps, thinkingDisplay, varDir, ops, character, processTimeoutMs);
		if (!exchangeResult) break;
		conv = exchangeResult.conversation;
		lastStatus = exchangeResult.status;
		if (lastStatus === "ready") break;
	}
	return conv;
}

async function processTurnExchange(
	agent: AgentSummary, systemPrompt: string | null,
	conv: import("../../domain/agents/agent-conversation-store.js").ConversationFile,
	userInput: string, deps: TalkDeps, thinkingDisplay: ThinkingDisplay, varDir: string, ops: ConversationOps,
	character?: AgentCharacter, processTimeoutMs?: number,
): Promise<{ conversation: import("../../domain/agents/agent-conversation-store.js").ConversationFile; status: AgentResponse["status"] } | null> {
	const history = ops.getActiveHistory(conv);
	const result = await sendTurn(agent, systemPrompt, history, userInput, deps, thinkingDisplay, character, processTimeoutMs);
	if (!result) { deps.log(`\n  ${RED}No response received.${RESET}\n`); return null; }
	// User detached — agent is working in background, will leave a note
	if (!result.response.message) return null;
	displayResponse(agent.name, result.response, deps, character?.persona);
	let updated = ops.appendTurn(conv, { role: "user", content: userInput, ts: deps.clock.iso() });
	updated = ops.appendTurn(updated, { role: "agent", content: result.response.message, ts: deps.clock.iso(), thinking: result.thinking || undefined });
	ops.saveConversation(deps, varDir, agent.name, updated);
	return { conversation: updated, status: result.response.status };
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

/** Run the back-and-forth clarification loop after the agent's initial review. */
async function runClarificationLoop(
	agent: AgentSummary, systemPrompt: string | null, taskName: string, taskDesc: string,
	taskContext: string, history: ConversationTurn[],
	deps: TalkDeps, lastStatus: AgentResponse["status"],
	character?: AgentCharacter,
): Promise<void> {
	let status = lastStatus;
	for (;;) {
		if (status === "ready") {
			deps.log(`  ${GREEN}✓${RESET} ${agent.name} is ready to begin.\n`);
			break;
		}
		const reply = await askUser(status, deps, `  ${BOLD}You${RESET}`, "Enter when ready to start");
		if (!reply) break;

		const content = buildClarificationPrompt(agent.name, systemPrompt, taskName, taskDesc, taskContext, history, reply, character);
		const proc = deps.processRunner.spawn(agent, content);
		const result = await proc.result;
		if (!result.text) break;
		const parsed = parseAgentResponse(result.text);
		if (!parsed.message) break;

		displayResponse(agent.name, parsed, deps, character?.persona);
		history.push({ role: "user", content: reply, ts: "" }, { role: "agent", content: parsed.message, ts: "" });
		status = parsed.status;
	}
}

/**
 * Clarification dialog for AI agents — the agent reviews the task
 * and asks questions until the user confirms readiness.
 */
export async function clarifyTaskInteractive(
	projectPath: string, agent: AgentSummary, config: AgentsConfig | undefined,
	taskName: string, taskDesc: string, taskContext: string, deps: TalkDeps,
): Promise<void> {
	if (agent.agentType !== "ai" || !deps.shell.check("claude --version")) return;

	deps.log(`  ${DIM}${agent.name} is reviewing the task...${RESET}`);
	const systemPrompt = readSystemPrompt(deps, projectPath, agent.name, config);
	const character: AgentCharacter = {
		description: agent.description, persona: agent.persona,
		mood: agent.mood, personality: agent.personality,
		attributes: agent.attributes, experience: agent.experience,
	};
	const history: ConversationTurn[] = [];

	const content = buildClarificationPrompt(agent.name, systemPrompt, taskName, taskDesc, taskContext, history, undefined, character);
	const proc = deps.processRunner.spawn(agent, content);
	const result = await proc.result;
	if (!result.text) return;
	const parsed = parseAgentResponse(result.text);
	if (!parsed.message) return;

	history.push({ role: "agent", content: parsed.message, ts: "" });
	displayResponse(agent.name, parsed, deps, character?.persona);

	await runClarificationLoop(agent, systemPrompt, taskName, taskDesc, taskContext, history, deps, parsed.status, character);
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
