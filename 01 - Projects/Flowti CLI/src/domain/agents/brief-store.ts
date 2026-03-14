/** brief-store.ts — Brief generation, storage, and lifecycle (open → active → done). */

import type { CliDeps } from "../../infrastructure/deps.js";
import type { OrchestrationConfig, PhaseBinding } from "../../infrastructure/types.js";
import type { IterationSummary } from "../iterations/iteration-types.js";
import type { LifecycleTemplate, GatedTransitionResult } from "../lifecycle/lifecycle-types.js";
import { parseFrontmatterContent } from "../../infrastructure/frontmatter.js";
import { validateTransition } from "../lifecycle/lifecycle-engine.js";

export type BriefStoreDeps = Pick<CliDeps, "disk" | "paths">;
export type BriefStatus = "open" | "active" | "done";

export interface BriefSummary {
	readonly agentName: string;
	readonly iterationNumber: number;
	readonly phase: string;
	readonly status: BriefStatus;
	readonly file: string;
}

/** Minimal agent info for roster injection into system prompts. */
export interface RosterEntry {
	readonly name: string;
	readonly description: string;
	readonly roles: readonly string[];
	readonly skills: readonly string[];
}

/** Unified context for brief generation. Every brief is a full role-aware prompt. */
export interface BriefContext {
	readonly agentName: string;
	readonly agentDescription?: string;
	readonly agentSkills?: readonly string[];
	readonly agentRoles?: readonly string[];
	readonly systemPrompt?: string | null;
	readonly iteration: IterationSummary;
	readonly iterationTemplate?: LifecycleTemplate;
	readonly rosterAgents?: readonly RosterEntry[];
	/** When set, generates a full-iteration brief with lifecycle path and per-phase instructions. */
	readonly orchestration?: OrchestrationConfig;
}

// ── Utilities ─────────────────────────────────────────────────────────

function slugify(name: string): string {
	return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** Build the file name for a brief. Format: iteration-NNN-agent-name--phase.md */
export function briefFileName(iterationNumber: number, agentName: string, phase: string): string {
	return `iteration-${String(iterationNumber).padStart(3, "0")}-${slugify(agentName)}--${slugify(phase)}.md`;
}

/** Generate a wikilink to an agent: [[agent-name|Agent Name]] */
export function agentWikilink(agentName: string): string {
	return `[[${slugify(agentName)}|${agentName}]]`;
}

/** Generate a wikilink to an iteration plan: [[iteration-NNN-plan|Iteration #N Plan]] */
export function planWikilink(iteration: IterationSummary): string {
	return `[[${iteration.file.replace(/\.md$/, "")}|Iteration #${iteration.number} Plan]]`;
}

// ── Brief lifecycle template ──────────────────────────────────────────

const BRIEF_TEMPLATE: LifecycleTemplate = {
	entityType: "brief",
	states: ["open", "active", "done"],
	transitions: { open: ["active"], active: ["done"], done: [] },
	initialState: "open",
	terminalStates: ["done"],
};

export function getBriefTemplate(): LifecycleTemplate {
	return BRIEF_TEMPLATE;
}

// ── CRUD ──────────────────────────────────────────────────────────────

function briefsDir(deps: BriefStoreDeps, iterationsDir: string): string {
	const dir = deps.paths.join(iterationsDir, "briefs");
	if (!deps.disk.existsSync(dir)) deps.disk.mkdirSync(dir, { recursive: true });
	return dir;
}

/** Find an existing brief for an agent in an iteration phase. */
export function findBrief(deps: BriefStoreDeps, iterDir: string, iterationNumber: number, agentName: string, phase: string): BriefSummary | null {
	const dir = deps.paths.join(iterDir, "briefs");
	const file = briefFileName(iterationNumber, agentName, phase);
	const filePath = deps.paths.join(dir, file);
	if (!deps.disk.existsSync(filePath)) return null;
	const content = deps.disk.readFileSync(filePath, "utf-8");
	const fm = parseFrontmatterContent(content);
	return { agentName, iterationNumber, phase, status: parseBriefStatus(fm?.status), file };
}

/** List all briefs for an iteration (all agents, all phases). */
export function listBriefs(deps: BriefStoreDeps, iterDir: string, iterationNumber: number): BriefSummary[] {
	const dir = deps.paths.join(iterDir, "briefs");
	if (!deps.disk.existsSync(dir)) return [];
	const prefix = `iteration-${String(iterationNumber).padStart(3, "0")}-`;
	const files = deps.disk.readdirSync(dir).filter((f) => f.startsWith(prefix) && f.endsWith(".md"));
	const results: BriefSummary[] = [];
	for (const file of files) {
		const content = deps.disk.readFileSync(deps.paths.join(dir, file), "utf-8");
		const fm = parseFrontmatterContent(content);
		const status = parseBriefStatus(fm?.status);
		const agent = typeof fm?.agent === "string" ? fm.agent : "unknown";
		const phase = typeof fm?.phase === "string" ? fm.phase : "unknown";
		results.push({ agentName: agent, iterationNumber, phase, status, file });
	}
	return results;
}

/** Save a brief to the briefs directory. Creates the directory if needed. */
export function saveBrief(deps: BriefStoreDeps, iterDir: string, iterationNumber: number, agentName: string, phase: string, content: string): string {
	const dir = briefsDir(deps, iterDir);
	const file = briefFileName(iterationNumber, agentName, phase);
	const filePath = deps.paths.join(dir, file);
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return filePath;
}

/** Append a task to an existing brief's Assigned Tasks section. */
export function appendTask(deps: BriefStoreDeps, iterDir: string, iterationNumber: number, agentName: string, phase: string, task: string): boolean {
	const dir = deps.paths.join(iterDir, "briefs");
	const file = briefFileName(iterationNumber, agentName, phase);
	const filePath = deps.paths.join(dir, file);
	if (!deps.disk.existsSync(filePath)) return false;
	let content = deps.disk.readFileSync(filePath, "utf-8");
	const taskLine = `- [ ] ${task}`;
	if (content.includes("## Assigned Tasks")) {
		content = content.replace(/(## Assigned Tasks\n(?:\n|.)*?)(\n## |\n*$)/, (_, section, rest) => {
			return section.trimEnd() + "\n" + taskLine + "\n" + rest;
		});
	} else {
		content = content.trimEnd() + "\n\n## Assigned Tasks\n\n" + taskLine + "\n";
	}
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return true;
}

/** Transition a brief to a new lifecycle state. */
export function transitionBrief(deps: BriefStoreDeps, iterDir: string, iterationNumber: number, agentName: string, phase: string, to: BriefStatus): GatedTransitionResult {
	const dir = deps.paths.join(iterDir, "briefs");
	const file = briefFileName(iterationNumber, agentName, phase);
	const filePath = deps.paths.join(dir, file);
	if (!deps.disk.existsSync(filePath)) return { success: false, error: "Brief not found." };
	let content = deps.disk.readFileSync(filePath, "utf-8");
	const fm = parseFrontmatterContent(content);
	const from = parseBriefStatus(fm?.status);
	const result = validateTransition(BRIEF_TEMPLATE, from, to);
	if (!result.success) return result;
	content = updateFrontmatterField(content, "status", to);
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return { success: true, from, to };
}

function parseBriefStatus(raw: unknown): BriefStatus {
	if (raw === "active") return "active";
	if (raw === "done") return "done";
	return "open";
}

function updateFrontmatterField(content: string, field: string, value: string): string {
	const regex = new RegExp(`^(${field}:\\s*).*$`, "m");
	if (regex.test(content)) return content.replace(regex, `$1${value}`);
	return content.replace(/^(---\r?\n)/, `$1${field}: ${value}\n`);
}

// ── Roster resolution ─────────────────────────────────────────────────

/** Replace {{roster}} in a prompt with formatted agent roster. */
export function resolvePromptVariables(prompt: string, roster: readonly RosterEntry[]): string {
	if (!prompt.includes("{{roster}}")) return prompt;
	return prompt.replace("{{roster}}", formatRosterForPrompt(roster));
}

/** Format roster agents as a readable list for prompt injection. */
export function formatRosterForPrompt(roster: readonly RosterEntry[]): string {
	if (roster.length === 0) return "_No agents on the roster._";
	return roster.map((a) => {
		const parts = [`- **${a.name}**`];
		if (a.description) parts[0] += ` — ${a.description}`;
		if (a.roles.length > 0) parts.push(`  Roles: ${a.roles.join(", ")}`);
		if (a.skills.length > 0) parts.push(`  Skills: ${a.skills.join(", ")}`);
		return parts.join("\n");
	}).join("\n");
}

// ── Brief generation (unified) ────────────────────────────────────────

const DEFAULT_AC: readonly string[] = [
	"All scope items marked as done", "No unresolved blockers remain",
	"Changes committed and pushed to version control", "Brief reviewed and approved by stakeholder",
];

/**
 * Generate a brief (prompt) for an agent. Every brief includes the agent's full
 * role context, system prompt, iteration context, scope, and phase-aware DoD.
 *
 * If `orchestration` is set, generates a full-iteration brief with lifecycle path
 * and per-phase instructions. Otherwise generates a standard phase brief.
 */
export function generateBrief(ctx: BriefContext): string {
	const lines: string[] = [];
	const phase = ctx.iteration.status;
	appendFrontmatter(lines, ctx.agentName, ctx.iteration.number, phase);
	appendHeader(lines, ctx.agentName, ctx.iteration.number, ctx.orchestration);
	appendRole(lines, ctx);
	appendSystemPrompt(lines, ctx.systemPrompt, ctx.rosterAgents);
	if (ctx.orchestration) appendLifecyclePath(lines, ctx.iteration, ctx.iterationTemplate, ctx.orchestration);
	appendIterationContext(lines, ctx.iteration);
	appendScope(lines, ctx.iteration);
	appendAcceptanceCriteria(lines);
	if (ctx.orchestration && ctx.iterationTemplate) {
		appendFullDoD(lines, ctx.iteration, ctx.iterationTemplate);
	} else {
		appendDoD(lines, ctx.iteration, ctx.iterationTemplate);
	}
	appendExpectedOutput(lines, ctx.iteration);
	lines.push("## Assigned Tasks");
	lines.push("");
	return lines.join("\n");
}

// ── Section builders ──────────────────────────────────────────────────

function appendFrontmatter(lines: string[], agent: string, num: number, phase: string): void {
	lines.push("---", `agent: ${agent}`, `iteration: ${num}`, `phase: ${phase}`, "status: open", "---", "");
}

function appendHeader(lines: string[], agent: string, num: number, orchestration?: OrchestrationConfig): void {
	const prefix = orchestration ? "Full Iteration Brief" : "Agent Brief";
	lines.push(`# ${prefix}: ${agent} — Iteration #${num}`, "", `**Agent**: ${agentWikilink(agent)}`, "**Status**: open", "");
}

function appendRole(lines: string[], ctx: BriefContext): void {
	lines.push("## Your Role", "");
	if (ctx.orchestration) {
		lines.push(`You are **${ctx.agentName}** for this entire iteration. Execute all phases from ${ctx.iteration.status} → done.`);
		lines.push("Use other agents from the roster to delegate specialist work and maintain quality throughout the process.", "");
	}
	if (ctx.agentDescription) { lines.push(ctx.agentDescription); lines.push(""); }
	const hasSkills = ctx.agentSkills && ctx.agentSkills.length > 0;
	const hasRoles = ctx.agentRoles && ctx.agentRoles.length > 0;
	if (hasSkills) lines.push(`**Skills**: ${ctx.agentSkills!.join(", ")}`);
	if (hasRoles) lines.push(`**Roles**: ${ctx.agentRoles!.join(", ")}`);
	if (hasSkills || hasRoles) lines.push("");
}

function appendSystemPrompt(lines: string[], prompt: string | null | undefined, roster?: readonly RosterEntry[]): void {
	if (!prompt) return;
	const resolved = roster ? resolvePromptVariables(prompt, roster) : prompt;
	lines.push("## System Prompt", "", resolved, "");
}

function appendLifecyclePath(lines: string[], iter: IterationSummary, template?: LifecycleTemplate, orchestration?: OrchestrationConfig): void {
	if (!template) return;
	const path = buildLifecyclePath(template, iter.status);
	lines.push("## Lifecycle Path", "", path.join(" → "), "");
	const phases = orchestration?.phases;
	if (!phases) return;
	const entries = path.map((s) => [s, phases[s]] as [string, PhaseBinding | undefined]).filter(([, b]) => b);
	if (entries.length === 0) return;
	lines.push("## Phase Instructions", "");
	for (const [state, binding] of entries) {
		if (!binding) continue;
		lines.push(`### ${state} (${binding.role ?? "contributor"})`, binding.instruction ?? "_No specific instruction._", "");
	}
}

export function buildLifecyclePath(template: LifecycleTemplate, fromState: string): string[] {
	const path: string[] = [fromState];
	let current = fromState;
	const visited = new Set<string>([current]);
	while (!template.terminalStates.includes(current)) {
		const transitions = template.transitions[current] ?? [];
		const next = transitions.find((t) => !template.terminalStates.includes(t) || t === "done") ?? transitions[0];
		if (!next || visited.has(next)) break;
		path.push(next);
		visited.add(next);
		current = next;
	}
	return path;
}

function appendIterationContext(lines: string[], iteration: IterationSummary): void {
	lines.push("## Iteration Context", "");
	lines.push(`- **Plan**: ${planWikilink(iteration)}`);
	lines.push(`- **Name**: ${iteration.name}`, `- **Goal**: ${iteration.goal}`);
	if (iteration.description) lines.push(`- **Description**: ${iteration.description}`);
	lines.push(`- **Status**: ${iteration.status}`, `- **Dates**: ${iteration.startDate} → ${iteration.endDate}`, "");
}

function appendScope(lines: string[], iteration: IterationSummary): void {
	const link = planWikilink(iteration);
	if (iteration.scopeItems.length === 0) {
		lines.push("## Scope Items", "", "_No scope items yet._ See " + link, "");
		return;
	}
	const done = iteration.scopeItems.filter((s) => s.done).length;
	lines.push(`## Scope Items (${done}/${iteration.scopeItems.length} done)`, "", `See ${link} for the full task list.`, "");
}

function appendAcceptanceCriteria(lines: string[]): void {
	lines.push("## Acceptance Criteria", "");
	for (const item of DEFAULT_AC) lines.push(`- [ ] ${item}`);
	lines.push("");
}

function appendDoD(lines: string[], iteration: IterationSummary, template?: LifecycleTemplate): void {
	lines.push("## Definition of Done", "");
	const tasks = template?.tasks?.[iteration.status];
	if (tasks && tasks.length > 0) {
		lines.push(`To advance from **${iteration.status}** to the next phase:`, "");
		for (const task of tasks) lines.push(`- [ ] ${task}`);
	} else {
		lines.push("- [ ] All scope items completed", "- [ ] Changes pushed to version control", "- [ ] Stakeholder sign-off received");
	}
	lines.push("");
}

function appendFullDoD(lines: string[], iteration: IterationSummary, template: LifecycleTemplate): void {
	lines.push("## Definition of Done", "");
	const path = buildLifecyclePath(template, iteration.status);
	let hasAny = false;
	for (const state of path) {
		if (template.terminalStates.includes(state)) continue;
		const tasks = template.tasks?.[state];
		if (!tasks || tasks.length === 0) continue;
		hasAny = true;
		lines.push(`### ${state}`, "");
		for (const task of tasks) lines.push(`- [ ] ${task}`);
		lines.push("");
	}
	if (!hasAny) lines.push("- [ ] All scope items completed", "- [ ] Changes pushed to version control", "- [ ] Stakeholder sign-off received", "");
}

function appendExpectedOutput(lines: string[], iteration: IterationSummary): void {
	lines.push("## Expected Output", "");
	lines.push(`Update the iteration plan (${planWikilink(iteration)}) directly:`);
	lines.push("- Mark completed items as `- [x]`", "- Add new items as `- [ ]`", "- Add notes under `## Notes`", "");
	lines.push("## When You Are Done", "");
	lines.push("Come back to this brief and update it:");
	lines.push("- Check off completed items in **Acceptance Criteria** and **Definition of Done**");
	lines.push("- Mark all **Assigned Tasks** as `- [x]`");
	lines.push("- Update **Scope Items** count to reflect final state");
	lines.push("- Change the `status` in frontmatter and header from `open` to `done`", "");
}
