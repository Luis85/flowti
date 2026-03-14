/**
 * iteration-documents.ts — Markdown document builders for iteration plans and reports.
 */

import { Document } from "../../infrastructure/document.js";
import type { IterationDefinition, IterationSummary, AgentReference, ResourceAllocation, CapacityEntry } from "./iteration-types.js";

export function buildPlanDocument(def: IterationDefinition): Document {
	const doc = Document.create(def.name)
		.mergeFrontmatter({
			type: "IterationPlan",
			name: def.name,
			number: def.number,
			status: "new",
			startDate: def.startDate,
			endDate: def.endDate,
			goal: def.goal,
		});

	if (def.capacity) doc.setFrontmatter("capacity", def.capacity);
	if (def.description) doc.setFrontmatter("description", def.description);
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

	doc.heading(2, "Transition History").addBlank()
		.text("| Date | From | To | Reason |")
		.text("|---|---|---|---|").addBlank();

	doc.heading(2, "Notes").addBlank()
		.text("<!-- Track progress and decisions during the iteration. -->");
}

export function buildReportDocument(summary: IterationSummary, closedDate: string): Document {
	const doc = Document.create(`${summary.name} — Report`)
		.mergeFrontmatter({
			type: "IterationReport",
			name: summary.name,
			number: summary.number,
			status: "done",
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

export function formatAgent(a: AgentReference): string {
	return `${a.name}|${a.file}`;
}

export function formatResource(r: ResourceAllocation): string {
	return [r.name, r.role ?? "", r.allocation ?? ""].join("|");
}

export function formatCapacity(c: CapacityEntry): string {
	return [c.label, c.value, c.unit ?? ""].join("|");
}
