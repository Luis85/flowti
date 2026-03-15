/**
 * iteration-store.ts — CRUD operations for iteration management.
 *
 * Each iteration produces two markdown files:
 *   - iteration-NNN-plan.md  — tracks the iteration over its duration
 *   - iteration-NNN-report.md — consolidates metrics and retrospective
 *
 * Stores iteration files in docs/iterations/ (configurable).
 *
 * The custom filename pattern (iteration-NNN-plan.md) and plan/report dual-file
 * structure cannot be handled by the generic createStore() engine, so we
 * implement the StoreApi manually and expose __descriptor for conformance checking.
 */

import type { CliDeps } from "../../infrastructure/deps.js";
import type { IterationsConfig, IterationStatus } from "../../infrastructure/types.js";
import type { StoreApi } from "../../infrastructure/store-engine.js";
import type { IterationDefinition, IterationSummary, ScopeItem, AgentReference, ResourceAllocation, CapacityEntry } from "./iteration-types.js";
import type { LifecycleTemplate, GatedTransitionResult } from "../lifecycle/lifecycle-types.js";
import { resolveDir, listMdFiles, readFrontmatter, updateField, appendToSection, replaceSectionLine } from "../shared/markdown-store.js";
import { parseFrontmatterContent } from "../../infrastructure/frontmatter.js";
import { validateGatedTransition, getEntryTasks } from "../lifecycle/lifecycle-engine.js";
import { makeGateEvaluator } from "./iteration-gates.js";
import { buildPlanDocument, buildReportDocument, formatAgent, formatResource, formatCapacity } from "./iteration-documents.js";

export type IterationStoreDeps = Pick<CliDeps, "disk" | "paths" | "clock">;

const DEFAULT_DIR = "docs/iterations";

// ── Store descriptor ────────────────────────────────────────────────

/**
 * iterationStore — StoreApi-conformant descriptor for iterations.
 *
 * Iteration storage uses a custom filename scheme (iteration-NNN-plan.md)
 * and a plan/report dual-file pattern. The createStore() engine would need
 * significant extension to support this, so we implement the StoreApi manually.
 * The __descriptor exposes store metadata for conformance checking.
 */
export const iterationStore: StoreApi<IterationSummary, IterationDefinition> = {
	__descriptor: {
		name: "iteration",
		defaultDir: DEFAULT_DIR,
		configPath: "dir",
		typeTag: "Iteration",
		fields: {
			name: { type: "string", required: true, default: "" },
			number: { type: "number", default: 0 },
			startDate: { type: "string", default: "" },
			endDate: { type: "string", default: "" },
			goal: { type: "string", default: "" },
			capacity: { type: "string", default: "" },
			description: { type: "string", default: "" },
			status: { type: "enum", options: ["new", "planned", "ready", "in-progress", "in-review", "done", "cancelled"], default: "new" },
		},
		filename: (def) => `${iterationPrefix(def.number)}-plan.md`,
		sort: (a, b) => a.number - b.number,
		buildBody: (def) => {
			const lines: string[] = [
				`# ${def.name}`, "",
				def.goal ? `**Goal:** ${def.goal}` : "",
				"",
				"## Scope Items", "",
				"<!-- List requirements and work items for this iteration. -->", "",
				"## Notes", "",
				"<!-- Track progress and decisions during the iteration. -->", "",
				"## Transition History", "",
				"| Date | From | To | Reason |",
				"|---|---|---|---|",
			];
			return lines.filter((l) => l !== undefined).join("\n");
		},
	},

	resolveDir(deps, projectPath, config?) {
		return resolveDir(deps, projectPath, (config?.dir as string | undefined), DEFAULT_DIR);
	},

	list(deps, projectPath, config?) {
		return listIterations(deps, projectPath, config ? { dir: config.dir as string } : undefined);
	},

	read(deps, projectPath, name, config?) {
		const items = listIterations(deps, projectPath, config ? { dir: config.dir as string } : undefined);
		return items.find((it) => it.name === name);
	},

	create(deps, projectPath, def, config?) {
		const clock = (deps as IterationStoreDeps).clock;
		const result = createIteration(
			{ ...deps, clock } as IterationStoreDeps,
			projectPath,
			def,
			config ? { dir: config.dir as string } : undefined,
		);
		const dir = iterationsDir(deps, projectPath, config ? { dir: config.dir as string } : undefined);
		return result ?? deps.paths.join(dir, `${iterationPrefix(def.number)}-plan.md`);
	},

	updateField(deps, projectPath, name, field, value, config?) {
		const items = listIterations(deps, projectPath, config ? { dir: config.dir as string } : undefined);
		const item = items.find((it) => it.name === name);
		if (!item) return false;
		const dir = iterationsDir(deps, projectPath, config ? { dir: config.dir as string } : undefined);
		return updateField(deps, deps.paths.join(dir, item.file), field, value);
	},

	remove(deps, projectPath, name, config?) {
		const items = listIterations(deps, projectPath, config ? { dir: config.dir as string } : undefined);
		const item = items.find((it) => it.name === name);
		if (!item) return;
		const dir = iterationsDir(deps, projectPath, config ? { dir: config.dir as string } : undefined);
		const filePath = deps.paths.join(dir, item.file);
		if (deps.disk.existsSync(filePath)) deps.disk.unlinkSync(filePath);
	},
};

/** Resolve the iterations directory for a project. */
export function iterationsDir(deps: Pick<CliDeps, "paths">, projectPath: string, config?: IterationsConfig): string {
	return resolveDir(deps, projectPath, config?.dir, DEFAULT_DIR);
}

/** Compute the next iteration number from existing summaries. */
export function nextIterationNumber(existing: IterationSummary[]): number {
	let max = 0;
	for (const item of existing) {
		if (item.number > max) max = item.number;
	}
	return max + 1;
}

/** Compute an end date by adding durationDays to a start date string (YYYY-MM-DD). */
export function computeEndDate(startDate: string, durationDays: number): string {
	const ms = Date.parse(startDate);
	if (isNaN(ms)) return startDate;
	const end = new Date(ms + durationDays * 86_400_000);
	return end.toISOString().slice(0, 10);
}

/** Build the zero-padded file prefix for an iteration number. */
function iterationPrefix(num: number): string {
	return `iteration-${String(num).padStart(3, "0")}`;
}

function planPath(deps: Pick<CliDeps, "paths">, dir: string, num: number): string {
	return deps.paths.join(dir, `${iterationPrefix(num)}-plan.md`);
}

// ── Frontmatter parsers ─────────────────────────────────────────────

function parseAgents(fm: Record<string, unknown>): AgentReference[] {
	const raw = fm.agents;
	if (!Array.isArray(raw)) return [];
	return raw.map((entry: unknown) => {
		if (typeof entry === "string") {
			const parts = entry.split("|").map((s: string) => s.trim());
			return { name: parts[0], file: parts[1] ?? parts[0] };
		}
		return { name: String(entry), file: String(entry) };
	});
}

function parseResources(fm: Record<string, unknown>): ResourceAllocation[] {
	const raw = fm.resources;
	if (!Array.isArray(raw)) return [];
	return raw.map((entry: unknown) => {
		if (typeof entry === "string") {
			const parts = entry.split("|").map((s: string) => s.trim());
			return { name: parts[0], role: parts[1], allocation: parts[2] };
		}
		return { name: String(entry) };
	});
}

function parseCapacities(fm: Record<string, unknown>): CapacityEntry[] {
	const raw = fm.capacities;
	if (!Array.isArray(raw)) return [];
	return raw.map((entry: unknown) => {
		if (typeof entry === "string") {
			const parts = entry.split("|").map((s: string) => s.trim());
			return { label: parts[0], value: parts[1] ?? "0", unit: parts[2] };
		}
		return { label: String(entry), value: "0" };
	});
}

function parseScopeItems(content: string, sectionTitle: string): ScopeItem[] {
	const regex = new RegExp(`^## ${sectionTitle}\\s*\\n([\\s\\S]*?)(?=^## |\\Z)`, "m");
	const match = regex.exec(content);
	if (!match) return [];
	const body = match[1];
	return body.split("\n").filter((line) => /^\s*-\s+/.test(line)).map((line) => {
		const done = /^\s*-\s+\[x\]\s+/i.test(line);
		const text = line.replace(/^\s*-\s+(\[.\]\s+)?/, "").trim();
		return { text, done };
	});
}

/** Normalize legacy status values when reading existing files. */
function normalizeStatus(raw: string): IterationStatus {
	if (raw === "completed") return "done";
	return raw as IterationStatus;
}

function parseIterationSummary(fm: Record<string, string>, typedFm: Record<string, unknown>, file: string, content?: string): IterationSummary {
	return {
		name: fm.name ?? file.replace(/\.md$/, ""),
		number: parseInt(fm.number ?? "0", 10),
		startDate: fm.startDate ?? "",
		endDate: fm.endDate ?? "",
		goal: fm.goal ?? "",
		capacity: fm.capacity ?? "",
		description: fm.description ?? "",
		status: normalizeStatus(fm.status ?? "new"),
		file,
		agents: parseAgents(typedFm),
		resources: parseResources(typedFm),
		capacities: parseCapacities(typedFm),
		scopeItems: content ? parseScopeItems(content, "Scope Items") : [],
	};
}

// ── List / Find ─────────────────────────────────────────────────────

/** List all iterations by scanning plan files. */
export function listIterations(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, config?: IterationsConfig): IterationSummary[] {
	const dir = iterationsDir(deps, projectPath, config);
	const files = listMdFiles(deps, dir).filter((f: string) => f.endsWith("-plan.md"));
	return files.map((file: string) => {
		const fm = readFrontmatter(deps, dir, file);
		const content = deps.disk.readFileSync(deps.paths.join(dir, file), "utf-8");
		const typedFm = parseFrontmatterContent(content) ?? {};
		return parseIterationSummary(fm, typedFm, file, content);
	}).sort((a, b) => a.number - b.number);
}

const ACTIVE_STATUSES = new Set<string>(["new", "planned", "ready", "in-progress", "in-review"]);

/** Find the current iteration (any non-terminal status). */
export function findCurrentIteration(deps: Pick<CliDeps, "disk" | "paths" | "clock">, projectPath: string, config?: IterationsConfig): IterationSummary | null {
	const items = listIterations(deps, projectPath, config);
	return items.find((it) => ACTIVE_STATUSES.has(it.status)) ?? null;
}

/** Find a specific iteration by number. */
export function findIteration(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, config?: IterationsConfig): IterationSummary | null {
	const items = listIterations(deps, projectPath, config);
	return items.find((it) => it.number === iterationNumber) ?? null;
}

// ── Create ──────────────────────────────────────────────────────────

/** Create an iteration plan file. Returns the plan file path or null if exists. */
export function createIteration(deps: IterationStoreDeps, projectPath: string, def: IterationDefinition, config?: IterationsConfig, template?: LifecycleTemplate): string | null {
	const dir = iterationsDir(deps, projectPath, config);
	deps.disk.mkdirSync(dir, { recursive: true });
	const path = planPath(deps, dir, def.number);
	if (deps.disk.existsSync(path)) return null;
	buildPlanDocument(def).save(path, deps.disk);
	if (template) {
		const initial = template.initialState;
		for (const task of getEntryTasks(template, initial)) {
			appendToSection(deps, path, "Scope Items", `[ ] ${task}`);
		}
	}
	return path;
}

// ── Lifecycle transitions ───────────────────────────────────────────

/** Transition an iteration to a new state via the lifecycle engine. */
export function transitionIteration(
	deps: IterationStoreDeps, projectPath: string, iterationNumber: number,
	newState: IterationStatus, reason: string, template: LifecycleTemplate,
	config?: IterationsConfig,
): GatedTransitionResult {
	const dir = iterationsDir(deps, projectPath, config);
	const path = planPath(deps, dir, iterationNumber);
	if (!deps.disk.existsSync(path)) return { success: false, error: "Plan file not found." };

	const fm = readFrontmatter(deps, dir, `${iterationPrefix(iterationNumber)}-plan.md`);
	const content = deps.disk.readFileSync(path, "utf-8");
	const typedFm = parseFrontmatterContent(content) ?? {};
	const summary = parseIterationSummary(fm, typedFm, `${iterationPrefix(iterationNumber)}-plan.md`, content);

	const evaluator = makeGateEvaluator(summary);
	const result = validateGatedTransition(template, summary.status, newState, evaluator);
	if (!result.success) return result;

	updateField(deps, path, "status", newState);
	appendTransitionHistory(deps, path, summary.status, newState, reason);
	for (const task of getEntryTasks(template, newState)) {
		appendToSection(deps, path, "Scope Items", `[ ] ${task}`);
	}
	return result;
}

function appendTransitionHistory(deps: Pick<CliDeps, "disk" | "clock">, filePath: string, from: string, to: string, reason: string): void {
	let content = deps.disk.readFileSync(filePath, "utf-8");
	const date = deps.clock.iso().slice(0, 10);
	const row = `| ${date} | ${from} | ${to} | ${reason} |`;
	if (/\|---\|---\|---\|---\|/.test(content)) {
		content = content.replace(/(\|---\|---\|---\|---\|)/, `$1\n${row}`);
	} else {
		content += `\n## Transition History\n\n| Date | From | To | Reason |\n|---|---|---|---|\n${row}\n`;
	}
	deps.disk.writeFileSync(filePath, content, "utf-8");
}

/** Close an iteration: transition to done + create the report file. */
export function closeIteration(deps: IterationStoreDeps, projectPath: string, iterationNumber: number, template: LifecycleTemplate, config?: IterationsConfig): GatedTransitionResult {
	const result = transitionIteration(deps, projectPath, iterationNumber, "done", "Iteration closed", template, config);
	if (!result.success) return result;

	const dir = iterationsDir(deps, projectPath, config);
	const path = planPath(deps, dir, iterationNumber);
	addClosedDate(deps, path);

	const fm = readFrontmatter(deps, dir, `${iterationPrefix(iterationNumber)}-plan.md`);
	const content = deps.disk.readFileSync(path, "utf-8");
	const typedFm = parseFrontmatterContent(content) ?? {};
	const summary = parseIterationSummary(fm, typedFm, `${iterationPrefix(iterationNumber)}-plan.md`, content);
	const reportsDir = deps.paths.join(dir, "reports");
	if (!deps.disk.existsSync(reportsDir)) deps.disk.mkdirSync(reportsDir, { recursive: true });
	const reportPath = deps.paths.join(reportsDir, `${iterationPrefix(iterationNumber)}-report.md`);
	buildReportDocument(summary, deps.clock.iso().slice(0, 10)).save(reportPath, deps.disk);
	return result;
}

function addClosedDate(deps: Pick<CliDeps, "disk" | "clock">, filePath: string): void {
	let content = deps.disk.readFileSync(filePath, "utf-8");
	const date = deps.clock.iso().slice(0, 10);
	if (/^closedDate:/m.test(content)) {
		content = content.replace(/^closedDate:\s*.+$/m, `closedDate: ${date}`);
	} else {
		content = content.replace(/^---\r?\n/, `---\nclosedDate: ${date}\n`);
	}
	deps.disk.writeFileSync(filePath, content, "utf-8");
}

// ── Metadata updates ────────────────────────────────────────────────

/** Update the name of an iteration plan. */
export function updateName(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, name: string, config?: IterationsConfig): boolean {
	return updateField(deps, planPath(deps, iterationsDir(deps, projectPath, config), iterationNumber), "name", name);
}

/** Update the goal of an iteration plan. */
export function updateGoal(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, goal: string, config?: IterationsConfig): boolean {
	return updateField(deps, planPath(deps, iterationsDir(deps, projectPath, config), iterationNumber), "goal", goal);
}

/** Update the start date of an iteration plan. */
export function updateStartDate(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, startDate: string, config?: IterationsConfig): boolean {
	return updateField(deps, planPath(deps, iterationsDir(deps, projectPath, config), iterationNumber), "startDate", startDate);
}

/** Update the end date of an iteration plan. */
export function updateEndDate(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, endDate: string, config?: IterationsConfig): boolean {
	return updateField(deps, planPath(deps, iterationsDir(deps, projectPath, config), iterationNumber), "endDate", endDate);
}

/** Update the description of an iteration plan. */
export function updateDescription(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, description: string, config?: IterationsConfig): boolean {
	return updateField(deps, planPath(deps, iterationsDir(deps, projectPath, config), iterationNumber), "description", description);
}

/** Attach an agent reference to an iteration plan. */
export function attachAgent(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, agent: AgentReference, config?: IterationsConfig): boolean {
	return appendArrayField(deps, planPath(deps, iterationsDir(deps, projectPath, config), iterationNumber), "agents", formatAgent(agent));
}

/** List agents attached to an iteration plan. */
export function listAgents(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, config?: IterationsConfig): AgentReference[] {
	const path = planPath(deps, iterationsDir(deps, projectPath, config), iterationNumber);
	if (!deps.disk.existsSync(path)) return [];
	const content = deps.disk.readFileSync(path, "utf-8");
	return parseAgents(parseFrontmatterContent(content) ?? {});
}

/** Add a resource allocation to an iteration plan. */
export function addResource(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, resource: ResourceAllocation, config?: IterationsConfig): boolean {
	return appendArrayField(deps, planPath(deps, iterationsDir(deps, projectPath, config), iterationNumber), "resources", formatResource(resource));
}

/** Add a capacity entry to an iteration plan. */
export function addCapacity(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, capacity: CapacityEntry, config?: IterationsConfig): boolean {
	return appendArrayField(deps, planPath(deps, iterationsDir(deps, projectPath, config), iterationNumber), "capacities", formatCapacity(capacity));
}

// ── Scope items ─────────────────────────────────────────────────────

/** Add a scope item as a checklist entry. */
export function addScopeItem(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, item: string, config?: IterationsConfig): boolean {
	return appendToSection(deps, planPath(deps, iterationsDir(deps, projectPath, config), iterationNumber), "Scope Items", `[ ] ${item}`);
}

/** Edit a scope item by index (0-based). */
export function editScopeItem(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, index: number, newText: string, config?: IterationsConfig): boolean {
	return replaceSectionLine(deps, planPath(deps, iterationsDir(deps, projectPath, config), iterationNumber), "Scope Items", index, (done) => `- [${done ? "x" : " "}] ${newText}`);
}

/** Remove a scope item by index (0-based). */
export function removeScopeItem(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, index: number, config?: IterationsConfig): boolean {
	return replaceSectionLine(deps, planPath(deps, iterationsDir(deps, projectPath, config), iterationNumber), "Scope Items", index, () => null);
}

/** Toggle the done state of a scope item by index (0-based). */
export function toggleScopeItem(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, index: number, config?: IterationsConfig): boolean {
	return replaceSectionLine(deps, planPath(deps, iterationsDir(deps, projectPath, config), iterationNumber), "Scope Items", index, (done, text) => `- [${done ? " " : "x"}] ${text}`);
}

/** Add a note to an iteration plan. */
export function addNote(deps: Pick<CliDeps, "disk" | "paths" | "clock">, projectPath: string, iterationNumber: number, note: string, config?: IterationsConfig): boolean {
	const dir = iterationsDir(deps, projectPath, config);
	const date = deps.clock.iso().slice(0, 10);
	return appendToSection(deps, planPath(deps, dir, iterationNumber), "Notes", `**${date}** — ${note}`);
}

// ── Internal helpers ────────────────────────────────────────────────

function appendArrayField(deps: Pick<CliDeps, "disk">, filePath: string, field: string, value: string): boolean {
	if (!deps.disk.existsSync(filePath)) return false;
	let content = deps.disk.readFileSync(filePath, "utf-8");
	const arrayEntryLine = `  - ${value}`;

	const fieldRegex = new RegExp(`^${field}:`, "m");
	if (fieldRegex.test(content)) {
		const lastEntryRegex = new RegExp(`(^${field}:.*(?:\\n\\s+-\\s+.*)*)`, "m");
		content = content.replace(lastEntryRegex, `$1\n${arrayEntryLine}`);
	} else {
		content = content.replace(/^(---)\r?\n/, `$1\n${field}:\n${arrayEntryLine}\n`);
	}

	deps.disk.writeFileSync(filePath, content, "utf-8");
	return true;
}
