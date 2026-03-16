/**
 * requirements-traceability.ts — Generates a Requirements Traceability reference.
 *
 * Cross-references requirements, use cases, and user stories
 * with status, priority, and link analysis.
 */

import { Document } from "../../../infrastructure/document.js";
import { ReportService } from "../cli/report-service.js";
import { requirementStore, useCaseStore, userStoryStore } from "../../requirements/requirement-store.js";

const REQ_DEFAULT_DIR = "docs/requirements";
import { readProjectConfig } from "../../project/project-config.js";
import type { ReportDeps } from "../../../infrastructure/deps.js";
import type { GeneratorOutput } from "../../../infrastructure/types.js";

// ── Generator ────────────────────────────────────────────────────────

export function generateRequirementsTraceability(projectPath: string, deps: ReportDeps): GeneratorOutput {
	const svc = new ReportService(projectPath, deps);
	const { config } = readProjectConfig(projectPath, deps);
	const reqConfig = config?.management?.requirements;
	const reqBaseDir = reqConfig?.dir ?? REQ_DEFAULT_DIR;
	const requirements = requirementStore.list(deps, projectPath, reqConfig ? { dir: reqConfig.dir } : undefined);
	const useCases = useCaseStore.list(deps, projectPath, { dir: `${reqBaseDir}/use-cases` });
	const userStories = userStoryStore.list(deps, projectPath, { dir: `${reqBaseDir}/user-stories` });

	const totalItems = requirements.length + useCases.length + userStories.length;

	const doc = Document.create("Requirements Traceability")
		.mergeFrontmatter({
			type: "RequirementsTraceability",
			date: deps.clock.iso(),
			requirements: requirements.length,
			useCases: useCases.length,
			userStories: userStories.length,
			tags: ["reference", "requirements", "traceability", "management"],
		})
		.addBlank()
		.heading(1, "Requirements Traceability")
		.addBlank()
		.text(`${totalItems} item(s): ${requirements.length} requirements, ${useCases.length} use cases, ${userStories.length} user stories.`)
		.addBlank();

	if (totalItems === 0) {
		doc.text("No requirements artifacts found.").addBlank();
	}

	appendRequirements(doc, requirements);
	appendUseCases(doc, useCases);
	appendUserStories(doc, userStories);
	appendStatusSummary(doc, requirements, userStories);

	const outputPath = svc.saveReference(doc, "Requirements Traceability.md");

	return {
		success: true,
		outputPath,
		metrics: { requirements: requirements.length, useCases: useCases.length, userStories: userStories.length },
	};
}

// ── Helpers ──────────────────────────────────────────────────────────

function appendRequirements(doc: Document, reqs: { name: string; id: string; requirementType: string; status: string; priority: string }[]): void {
	if (reqs.length === 0) return;

	doc.heading(2, "Requirements").addBlank();
	doc.table(
		["ID", "Name", "Type", "Priority", "Status"],
		reqs.map((r) => [
			r.id,
			Document.wikilink(r.name),
			r.requirementType,
			r.priority,
			r.status,
		]),
	).addBlank();
}

function appendUseCases(doc: Document, ucs: { name: string; id: string; actor: string }[]): void {
	if (ucs.length === 0) return;

	doc.heading(2, "Use Cases").addBlank();
	doc.table(
		["ID", "Name", "Actor"],
		ucs.map((uc) => [
			uc.id,
			Document.wikilink(uc.name),
			uc.actor || "—",
		]),
	).addBlank();
}

function appendUserStories(doc: Document, stories: { name: string; id: string; role: string; status: string; storyPoints: number }[]): void {
	if (stories.length === 0) return;

	const totalPoints = stories.reduce((sum, s) => sum + s.storyPoints, 0);

	doc.heading(2, "User Stories").addBlank();
	doc.table(
		["ID", "Name", "Role", "Points", "Status"],
		stories.map((s) => [
			s.id,
			Document.wikilink(s.name),
			s.role || "—",
			String(s.storyPoints),
			s.status,
		]),
	).addBlank();
	doc.text(`Total story points: **${totalPoints}**`).addBlank();
}

function appendStatusSummary(
	doc: Document,
	reqs: { status: string }[],
	stories: { status: string }[],
): void {
	if (reqs.length === 0 && stories.length === 0) return;

	doc.heading(2, "Status Summary").addBlank();

	if (reqs.length > 0) {
		const byStatus = countBy(reqs, (r) => r.status);
		doc.heading(3, "Requirements by Status").addBlank();
		doc.table(
			["Status", "Count"],
			[...byStatus.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([s, c]) => [s, String(c)]),
		).addBlank();
	}

	if (stories.length > 0) {
		const byStatus = countBy(stories, (s) => s.status);
		doc.heading(3, "User Stories by Status").addBlank();
		doc.table(
			["Status", "Count"],
			[...byStatus.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([s, c]) => [s, String(c)]),
		).addBlank();
	}
}

function countBy<T>(items: T[], key: (item: T) => string): Map<string, number> {
	const counts = new Map<string, number>();
	for (const item of items) {
		const k = key(item);
		counts.set(k, (counts.get(k) ?? 0) + 1);
	}
	return counts;
}
