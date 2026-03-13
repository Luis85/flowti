/**
 * iteration-store.ts — CRUD operations for iteration management.
 *
 * Each iteration produces two markdown files:
 *   - iteration-NNN-plan.md  — tracks the iteration over its duration
 *   - iteration-NNN-report.md — consolidates metrics and retrospective
 *
 * Stores iteration files in docs/iterations/ (configurable).
 */

import { Document } from "../../infrastructure/document.js";
import type { CliDeps } from "../../infrastructure/deps.js";
import type { IterationsConfig, IterationStatus } from "../../infrastructure/types.js";
import type { IterationDefinition, IterationSummary, AgentReference, ResourceAllocation, CapacityEntry } from "./iteration-types.js";
import { resolveDir, listMdFiles, readFrontmatter, updateField } from "../shared/markdown-store.js";
import { parseFrontmatterContent } from "../../infrastructure/frontmatter.js";

export type IterationStoreDeps = Pick<CliDeps, "disk" | "paths" | "clock">;

const DEFAULT_DIR = "docs/iterations";

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

function parseIterationSummary(fm: Record<string, string>, typedFm: Record<string, unknown>, file: string): IterationSummary {
	return {
		name: fm.name ?? file.replace(/\.md$/, ""),
		number: parseInt(fm.number ?? "0", 10),
		startDate: fm.startDate ?? "",
		endDate: fm.endDate ?? "",
		goal: fm.goal ?? "",
		capacity: fm.capacity ?? "",
		status: (fm.status as IterationStatus) ?? "planned",
		file,
		agents: parseAgents(typedFm),
		resources: parseResources(typedFm),
		capacities: parseCapacities(typedFm),
	};
}

/** List all iterations by scanning plan files. */
export function listIterations(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, config?: IterationsConfig): IterationSummary[] {
	const dir = iterationsDir(deps, projectPath, config);
	const files = listMdFiles(deps, dir).filter((f: string) => f.endsWith("-plan.md"));
	return files
		.map((file: string) => {
			const fm = readFrontmatter(deps, dir, file);
			const content = deps.disk.readFileSync(deps.paths.join(dir, file), "utf-8");
			const typedFm = parseFrontmatterContent(content) ?? {};
			return parseIterationSummary(fm, typedFm, file);
		})
		.sort((a, b) => a.number - b.number);
}

const ACTIVE_STATUSES = new Set(["planned", "in-progress", "in-review"]);

/** Find the current iteration (planned, in-progress, or in-review). */
export function findCurrentIteration(deps: Pick<CliDeps, "disk" | "paths" | "clock">, projectPath: string, config?: IterationsConfig): IterationSummary | null {
	const items = listIterations(deps, projectPath, config);
	return items.find((it) => ACTIVE_STATUSES.has(it.status)) ?? null;
}

/** Create an iteration plan file. Returns the plan file path or null if exists. */
export function createIteration(deps: IterationStoreDeps, projectPath: string, def: IterationDefinition, config?: IterationsConfig): string | null {
	const dir = iterationsDir(deps, projectPath, config);
	deps.disk.mkdirSync(dir, { recursive: true });

	const prefix = iterationPrefix(def.number);
	const planPath = deps.paths.join(dir, `${prefix}-plan.md`);

	if (deps.disk.existsSync(planPath)) return null;

	buildPlanDocument(def).save(planPath, deps.disk);

	return planPath;
}

function buildPlanDocument(def: IterationDefinition): Document {
	const doc = Document.create(def.name)
		.mergeFrontmatter({
			type: "IterationPlan",
			name: def.name,
			number: def.number,
			status: "planned",
			startDate: def.startDate,
			endDate: def.endDate,
			goal: def.goal,
		});

	if (def.capacity) doc.setFrontmatter("capacity", def.capacity);
	addArrayFrontmatter(doc, def);

	doc.addBlank().heading(1, `#${def.number} — ${def.name}`).addBlank();
	if (def.description) doc.text(def.description).addBlank();
	doc.heading(2, "Goal").addBlank().text(def.goal).addBlank();
	addPlanBodySections(doc, def);
	return doc;
}

function addArrayFrontmatter(doc: Document, def: IterationDefinition): void {
	if (def.resources && def.resources.length > 0) {
		doc.setFrontmatter("resources", def.resources.map((r) => formatResource(r)));
	}
	if (def.capacities && def.capacities.length > 0) {
		doc.setFrontmatter("capacities", def.capacities.map((c) => formatCapacity(c)));
	}
	if (def.agents && def.agents.length > 0) {
		doc.setFrontmatter("agents", def.agents.map((a) => formatAgent(a)));
	}
}

function addPlanBodySections(doc: Document, def: IterationDefinition): void {
	doc.heading(2, "Resources").addBlank();
	if (def.resources && def.resources.length > 0) {
		doc.table(["Name", "Role", "Allocation"], def.resources.map((r) => [r.name, r.role ?? "", r.allocation ?? ""]));
	} else {
		doc.text("<!-- Add team members and their allocation. -->").addBlank();
	}

	doc.addBlank().heading(2, "Capacities").addBlank();
	if (def.capacities && def.capacities.length > 0) {
		doc.table(["Label", "Value", "Unit"], def.capacities.map((c) => [c.label, c.value, c.unit ?? ""]));
	} else {
		doc.text("<!-- Define capacity constraints (story points, hours, etc). -->").addBlank();
	}

	doc.addBlank().heading(2, "Agents").addBlank();
	if (def.agents && def.agents.length > 0) {
		doc.list(def.agents.map((a) => Document.wikilink(a.file, a.name)));
	} else {
		doc.text("<!-- Attach agent files from the agents folder. -->").addBlank();
	}

	doc.addBlank().heading(2, "Scope Items").addBlank()
		.text("<!-- List requirements and work items for this iteration. -->").addBlank();

	doc.heading(2, "Notes").addBlank()
		.text("<!-- Track progress and decisions during the iteration. -->");
}

function buildReportDocument(summary: IterationSummary, closedDate: string): Document {
	const doc = Document.create(`${summary.name} — Report`)
		.mergeFrontmatter({
			type: "IterationReport",
			name: summary.name,
			number: summary.number,
			status: "completed",
			startDate: summary.startDate,
			endDate: summary.endDate,
			closedDate,
		});

	if (summary.capacity) doc.setFrontmatter("capacity", summary.capacity);

	doc.addBlank()
		.heading(1, `#${summary.number} — ${summary.name} — Report`)
		.addBlank();

	addReportSections(doc);

	return doc;
}

function addReportSections(doc: Document): void {
	doc.heading(2, "Outcomes").addBlank()
		.text("<!-- Summarize what was delivered. -->").addBlank();

	doc.heading(2, "Process Metrics").addBlank()
		.text("| Metric | Planned | Actual |").text("| --- | --- | --- |")
		.text("| Velocity | | |").text("| Throughput | | |")
		.text("| Cycle Time | | |").text("| Lead Time | | |")
		.text("| Scope Changes | | |").addBlank();

	doc.heading(2, "Evidence-Based Management").addBlank();
	doc.heading(3, "Current Value").addBlank()
		.text("<!-- Revenue per employee, customer satisfaction, employee satisfaction. -->").addBlank();
	doc.heading(3, "Unrealized Value").addBlank()
		.text("<!-- Market share, customer/user satisfaction gap. -->").addBlank();
	doc.heading(3, "Ability to Innovate").addBlank()
		.text("<!-- Technical debt ratio, defect trends, innovation rate. -->").addBlank();
	doc.heading(3, "Time-to-Market").addBlank()
		.text("<!-- Release frequency, stabilization time, cycle time. -->").addBlank();

	doc.heading(2, "Retrospective").addBlank()
		.text("<!-- What went well, what to improve, action items. -->");
}

function formatAgent(a: AgentReference): string {
	return `${a.name}|${a.file}`;
}

function formatResource(r: ResourceAllocation): string {
	return [r.name, r.role ?? "", r.allocation ?? ""].join("|");
}

function formatCapacity(c: CapacityEntry): string {
	return [c.label, c.value, c.unit ?? ""].join("|");
}

/** Start an iteration by setting plan status to in-progress. Returns true if successful. */
export function startIteration(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, config?: IterationsConfig): boolean {
	const dir = iterationsDir(deps, projectPath, config);
	const prefix = iterationPrefix(iterationNumber);
	return updateField(deps, deps.paths.join(dir, `${prefix}-plan.md`), "status", "in-progress");
}

/** Advance an iteration to in-review. Returns true if successful. */
export function advanceToReview(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, config?: IterationsConfig): boolean {
	const dir = iterationsDir(deps, projectPath, config);
	const prefix = iterationPrefix(iterationNumber);
	return updateField(deps, deps.paths.join(dir, `${prefix}-plan.md`), "status", "in-review");
}

/** Close an iteration: mark plan as completed, create the report file. Returns true if successful. */
export function closeIteration(deps: Pick<CliDeps, "disk" | "paths" | "clock">, projectPath: string, iterationNumber: number, config?: IterationsConfig): boolean {
	const dir = iterationsDir(deps, projectPath, config);
	const prefix = iterationPrefix(iterationNumber);
	const planPath = deps.paths.join(dir, `${prefix}-plan.md`);
	const reportPath = deps.paths.join(dir, `${prefix}-report.md`);

	if (!deps.disk.existsSync(planPath)) return false;

	const planOk = updateField(deps, planPath, "status", "completed") && addClosedDate(deps, planPath);

	const fm = readFrontmatter(deps, dir, `${prefix}-plan.md`);
	const content = deps.disk.readFileSync(planPath, "utf-8");
	const typedFm = parseFrontmatterContent(content) ?? {};
	const summary = parseIterationSummary(fm, typedFm, `${prefix}-plan.md`);
	buildReportDocument(summary, deps.clock.iso().slice(0, 10)).save(reportPath, deps.disk);

	return planOk;
}

function addClosedDate(deps: Pick<CliDeps, "disk" | "clock">, filePath: string): boolean {
	if (!deps.disk.existsSync(filePath)) return false;
	let content = deps.disk.readFileSync(filePath, "utf-8");
	const date = deps.clock.iso().slice(0, 10);
	if (/^closedDate:/m.test(content)) {
		content = content.replace(/^closedDate:\s*.+$/m, `closedDate: ${date}`);
	} else {
		content = content.replace(/^---\r?\n/, `---\nclosedDate: ${date}\n`);
	}
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return true;
}

/** Attach an agent reference to an iteration plan. */
export function attachAgent(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, agent: AgentReference, config?: IterationsConfig): boolean {
	const dir = iterationsDir(deps, projectPath, config);
	const planPath = deps.paths.join(dir, `${iterationPrefix(iterationNumber)}-plan.md`);
	return appendArrayField(deps, planPath, "agents", formatAgent(agent));
}

/** List agents attached to an iteration plan. */
export function listAgents(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, config?: IterationsConfig): AgentReference[] {
	const dir = iterationsDir(deps, projectPath, config);
	const planPath = deps.paths.join(dir, `${iterationPrefix(iterationNumber)}-plan.md`);
	if (!deps.disk.existsSync(planPath)) return [];
	const content = deps.disk.readFileSync(planPath, "utf-8");
	const fm = parseFrontmatterContent(content) ?? {};
	return parseAgents(fm);
}

/** Add a resource allocation to an iteration plan. */
export function addResource(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, resource: ResourceAllocation, config?: IterationsConfig): boolean {
	const dir = iterationsDir(deps, projectPath, config);
	const planPath = deps.paths.join(dir, `${iterationPrefix(iterationNumber)}-plan.md`);
	return appendArrayField(deps, planPath, "resources", formatResource(resource));
}

/** Add a capacity entry to an iteration plan. */
export function addCapacity(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, capacity: CapacityEntry, config?: IterationsConfig): boolean {
	const dir = iterationsDir(deps, projectPath, config);
	const planPath = deps.paths.join(dir, `${iterationPrefix(iterationNumber)}-plan.md`);
	return appendArrayField(deps, planPath, "capacities", formatCapacity(capacity));
}

/** Append a bullet item under a markdown section heading. */
function appendToSection(deps: Pick<CliDeps, "disk">, filePath: string, sectionTitle: string, line: string): boolean {
	if (!deps.disk.existsSync(filePath)) return false;
	let content = deps.disk.readFileSync(filePath, "utf-8");
	const sectionRegex = new RegExp(`(^## ${sectionTitle}\\s*\\n)`, "m");
	if (!sectionRegex.test(content)) return false;
	const commentRegex = new RegExp(`(^## ${sectionTitle}\\s*\\n(?:\\s*\\n)*)<!-- .* -->`, "m");
	if (commentRegex.test(content)) {
		content = content.replace(commentRegex, `$1- ${line}`);
	} else {
		content = content.replace(sectionRegex, `$1\n- ${line}\n`);
	}
	deps.disk.writeFileSync(filePath, content, "utf-8");
	return true;
}

/** Add a scope item to an iteration plan. */
export function addScopeItem(deps: Pick<CliDeps, "disk" | "paths">, projectPath: string, iterationNumber: number, item: string, config?: IterationsConfig): boolean {
	const dir = iterationsDir(deps, projectPath, config);
	const planPath = deps.paths.join(dir, `${iterationPrefix(iterationNumber)}-plan.md`);
	return appendToSection(deps, planPath, "Scope Items", item);
}

/** Add a note to an iteration plan. */
export function addNote(deps: Pick<CliDeps, "disk" | "paths" | "clock">, projectPath: string, iterationNumber: number, note: string, config?: IterationsConfig): boolean {
	const dir = iterationsDir(deps, projectPath, config);
	const planPath = deps.paths.join(dir, `${iterationPrefix(iterationNumber)}-plan.md`);
	const date = deps.clock.iso().slice(0, 10);
	return appendToSection(deps, planPath, "Notes", `**${date}** — ${note}`);
}

/** Append a value to a YAML array field in frontmatter. Creates the array if absent. */
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
