/**
 * event-flow.ts — Event Flow Visualization for the Flowti CLI.
 *
 * Generates producer → event → consumer flow diagrams from Event Catalog data
 * and renders them as Mermaid flowcharts in markdown documents.
 */

import { disk } from "../../infrastructure/filesystem.js";
import { paths } from "../../infrastructure/paths.js";
import { clock } from "../../infrastructure/clock.js";
import { Document } from "../../infrastructure/document.js";
import { parseFrontmatterStrings } from "../../infrastructure/frontmatter.js";

// ── Types ──────────────────────────────────────────────────────────

export interface EventFlowNode {
	type: "producer" | "event" | "consumer";
	name: string;
	domain?: string;
}

export interface EventFlowEdge {
	from: string;
	to: string;
	label?: string;
}

export interface EventFlowGraph {
	nodes: EventFlowNode[];
	edges: EventFlowEdge[];
}

// ── Internal helpers ───────────────────────────────────────────────

function eventsDir(projectPath: string): string {
	return paths.join(projectPath, "docs", "events");
}

function parseCommaSeparated(value: string): string[] {
	return value
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

function nodeId(name: string): string {
	return name.replace(/[^a-zA-Z0-9]/g, "_");
}

// ── Core functions ─────────────────────────────────────────────────

function addEdges(names: string[], eventName: string, type: "producer" | "consumer", nodeMap: Map<string, EventFlowNode>, edges: EventFlowEdge[]): void {
	for (const name of names) {
		if (!nodeMap.has(name)) nodeMap.set(name, { type, name });
		if (type === "producer") {
			edges.push({ from: name, to: eventName, label: eventName });
		} else {
			edges.push({ from: eventName, to: name, label: eventName });
		}
	}
}

/** Read all events from docs/events/, parse frontmatter, and build a flow graph. */
export function buildEventFlowGraph(projectPath: string): EventFlowGraph {
	const dir = eventsDir(projectPath);
	if (!disk.existsSync(dir)) return { nodes: [], edges: [] };

	const files = disk.readdirSync(dir).filter((f: string) => f.endsWith(".md"));
	const nodeMap = new Map<string, EventFlowNode>();
	const edges: EventFlowEdge[] = [];

	for (const file of files) {
		const content = disk.readFileSync(paths.join(dir, file), "utf-8");
		const fm = parseFrontmatterStrings(content);
		const eventName = fm.name ?? file.replace(/\.md$/, "");

		nodeMap.set(eventName, { type: "event", name: eventName, domain: fm.domain ?? "" });
		addEdges(fm.producers ? parseCommaSeparated(fm.producers) : [], eventName, "producer", nodeMap, edges);
		addEdges(fm.consumers ? parseCommaSeparated(fm.consumers) : [], eventName, "consumer", nodeMap, edges);
	}

	const nodes = Array.from(nodeMap.values()).sort((a, b) => a.name.localeCompare(b.name));
	return { nodes, edges };
}

/** Render a flow graph as Mermaid diagram lines. */
export function renderMermaidFlowchart(graph: EventFlowGraph): string[] {
	if (graph.nodes.length === 0) return ["graph LR", "  %% No events defined"];

	const lines: string[] = ["graph LR"];
	const seen = new Set<string>();

	// Style definitions for node types
	for (const node of graph.nodes) {
		const id = nodeId(node.name);
		if (node.type === "event") {
			lines.push(`  ${id}([["${node.name}"]]) :::event`);
		}
	}

	for (const edge of graph.edges) {
		const fromId = nodeId(edge.from);
		const toId = nodeId(edge.to);
		const key = `${fromId}-->${toId}`;
		if (seen.has(key)) continue;
		seen.add(key);
		lines.push(`  ${fromId}["${edge.from}"] --> ${toId}["${edge.to}"]`);
	}

	return lines;
}

/** Group events by domain and return per-domain Mermaid diagrams. */
export function renderMermaidByDomain(graph: EventFlowGraph): Map<string, string[]> {
	const domainEvents = new Map<string, Set<string>>();

	for (const node of graph.nodes) {
		if (node.type === "event" && node.domain) {
			let set = domainEvents.get(node.domain);
			if (!set) {
				set = new Set();
				domainEvents.set(node.domain, set);
			}
			set.add(node.name);
		}
	}

	const result = new Map<string, string[]>();

	for (const [domain, eventNames] of domainEvents) {
		const subgraph = filterGraphByEvents(graph, eventNames);
		result.set(domain, renderMermaidFlowchart(subgraph));
	}

	return result;
}

/** Filter a graph to only include edges and nodes related to the given event names. */
function filterGraphByEvents(graph: EventFlowGraph, eventNames: Set<string>): EventFlowGraph {
	const relevantEdges = graph.edges.filter(
		(e) => eventNames.has(e.from) || eventNames.has(e.to),
	);

	const relevantNodeNames = new Set<string>();
	for (const edge of relevantEdges) {
		relevantNodeNames.add(edge.from);
		relevantNodeNames.add(edge.to);
	}

	// Include event nodes even if they have no edges
	for (const name of eventNames) {
		relevantNodeNames.add(name);
	}

	const relevantNodes = graph.nodes.filter((n) => relevantNodeNames.has(n.name));

	return { nodes: relevantNodes, edges: relevantEdges };
}

/** Generate a full markdown document with event flow diagrams. */
export function generateEventFlowDoc(projectPath: string, domainFilter?: string): string {
	const graph = buildEventFlowGraph(projectPath);
	const title = domainFilter ? `Event Flow — ${domainFilter}` : "Event Flow";

	const doc = Document.create(title)
		.mergeFrontmatter({
			type: "EventFlow",
			date: clock.iso(),
			domain: domainFilter ?? "all",
		})
		.addBlank()
		.heading(1, title)
		.addBlank();

	if (graph.nodes.length === 0) {
		doc.text("No events defined yet. Use `flowti events:add` to create events.")
			.addBlank();
		return doc.toString();
	}

	if (domainFilter) {
		const byDomain = renderMermaidByDomain(graph);
		const diagram = byDomain.get(domainFilter);
		if (diagram) {
			doc.heading(2, `Domain: ${domainFilter}`).addBlank();
			doc.mermaid(diagram.join("\n")).addBlank();
		} else {
			doc.text(`No events found for domain "${domainFilter}".`).addBlank();
		}
	} else {
		// Full diagram
		doc.heading(2, "All Events").addBlank();
		const fullDiagram = renderMermaidFlowchart(graph);
		doc.mermaid(fullDiagram.join("\n")).addBlank();

		// Per-domain diagrams
		const byDomain = renderMermaidByDomain(graph);
		if (byDomain.size > 1) {
			doc.heading(2, "By Domain").addBlank();
			for (const [domain, diagram] of byDomain) {
				doc.heading(3, domain).addBlank();
				doc.mermaid(diagram.join("\n")).addBlank();
			}
		}
	}

	// Summary table
	const eventNodes = graph.nodes.filter((n) => n.type === "event");
	const producerNodes = graph.nodes.filter((n) => n.type === "producer");
	const consumerNodes = graph.nodes.filter((n) => n.type === "consumer");

	doc.heading(2, "Summary").addBlank();
	doc.table(
		["Metric", "Count"],
		[
			["Events", String(eventNodes.length)],
			["Producers", String(producerNodes.length)],
			["Consumers", String(consumerNodes.length)],
			["Connections", String(graph.edges.length)],
		],
	).addBlank();

	return doc.toString();
}

/** Generate the event flow document and save it to docs/events/Event Flow.md. */
export function saveEventFlowDoc(projectPath: string, domainFilter?: string): string {
	const content = generateEventFlowDoc(projectPath, domainFilter);
	const dir = eventsDir(projectPath);
	disk.mkdirSync(dir, { recursive: true });
	const filePath = paths.join(dir, "Event Flow.md");
	disk.writeFileSync(filePath, content, "utf-8");
	return filePath;
}
