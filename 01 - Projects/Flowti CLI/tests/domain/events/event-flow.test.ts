import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/clock.js", () => ({
	clock: {
		ms: () => Date.now(),
		now: () => new Date(),
		iso: () => "2026-03-08T12:00:00.000Z",
		safeIso: () => "2026-03-08T12-00-00",
	},
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...parts: string[]) => parts.join("/"),
		relative: (_from: string, to: string) => to,
		sep: "/",
	},
}));

const mockFs: Record<string, string> = {};
const mockDirs = new Set<string>();

function normalize(p: string): string {
	return p.replace(/\\/g, "/");
}

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: (p: string) => {
			const norm = normalize(p);
			for (const key of Object.keys(mockFs)) {
				if (normalize(key) === norm) return true;
			}
			for (const d of mockDirs) {
				if (normalize(d) === norm) return true;
			}
			return false;
		},
		readFileSync: (p: string) => {
			const norm = normalize(p);
			for (const [key, val] of Object.entries(mockFs)) {
				if (normalize(key) === norm) return val;
			}
			return "";
		},
		writeFileSync: vi.fn((p: string, content: string) => {
			mockFs[normalize(p)] = content;
		}),
		mkdirSync: vi.fn((p: string) => {
			mockDirs.add(normalize(p));
		}),
		readdirSync: (p: string) => {
			const prefix = normalize(p);
			return Object.keys(mockFs)
				.map(normalize)
				.filter((k) => k.startsWith(prefix + "/") && !k.slice(prefix.length + 1).includes("/"))
				.map((k) => k.split("/").pop()!);
		},
		copyFileSync: vi.fn(),
	},
}));

import {
	buildEventFlowGraph,
	renderMermaidFlowchart,
	renderMermaidByDomain,
	generateEventFlowDoc,
	saveEventFlowDoc,
} from "../../../src/domain/events/event-flow.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { clock } from "../../../src/infrastructure/clock.js";

const flowDeps = { disk, paths, clock } as const;

function seedEvent(name: string, domain: string, producers: string, consumers: string): void {
	const content = [
		"---",
		`name: ${name}`,
		`domain: ${domain}`,
		"version: 1.0.0",
		`producers: ${producers}`,
		`consumers: ${consumers}`,
		"---",
		"",
		`# ${name}`,
	].join("\n");
	mockFs[`/project/docs/events/${name.replace(/\./g, "-")}.md`] = content;
	mockDirs.add("/project/docs/events");
}

beforeEach(() => {
	for (const key of Object.keys(mockFs)) delete mockFs[key];
	mockDirs.clear();
});

// ── buildEventFlowGraph ────────────────────────────────────────────

describe("buildEventFlowGraph", () => {
	it("returns empty graph when no events directory exists", () => {
		const graph = buildEventFlowGraph(flowDeps, "/project");
		expect(graph.nodes).toEqual([]);
		expect(graph.edges).toEqual([]);
	});

	it("returns empty graph when events directory has no .md files", () => {
		mockDirs.add("/project/docs/events");
		const graph = buildEventFlowGraph(flowDeps, "/project");
		expect(graph.nodes).toEqual([]);
		expect(graph.edges).toEqual([]);
	});

	it("builds graph from a single event with producers and consumers", () => {
		seedEvent("user.created", "user", "AuthService", "NotificationService, AnalyticsService");

		const graph = buildEventFlowGraph(flowDeps, "/project");

		expect(graph.nodes).toHaveLength(4); // 1 event + 1 producer + 2 consumers
		expect(graph.edges).toHaveLength(3); // 1 producer->event + 2 event->consumer
	});

	it("creates correct node types", () => {
		seedEvent("user.created", "user", "AuthService", "EmailService");

		const graph = buildEventFlowGraph(flowDeps, "/project");

		const eventNode = graph.nodes.find((n) => n.name === "user.created");
		const producerNode = graph.nodes.find((n) => n.name === "AuthService");
		const consumerNode = graph.nodes.find((n) => n.name === "EmailService");

		expect(eventNode?.type).toBe("event");
		expect(eventNode?.domain).toBe("user");
		expect(producerNode?.type).toBe("producer");
		expect(consumerNode?.type).toBe("consumer");
	});

	it("creates correct edges", () => {
		seedEvent("user.created", "user", "AuthService", "EmailService");

		const graph = buildEventFlowGraph(flowDeps, "/project");

		const producerEdge = graph.edges.find((e) => e.from === "AuthService");
		expect(producerEdge?.to).toBe("user.created");

		const consumerEdge = graph.edges.find((e) => e.to === "EmailService");
		expect(consumerEdge?.from).toBe("user.created");
	});

	it("handles multiple events with shared services", () => {
		seedEvent("user.created", "user", "AuthService", "NotificationService");
		seedEvent("user.deleted", "user", "AuthService", "NotificationService");

		const graph = buildEventFlowGraph(flowDeps, "/project");

		// AuthService and NotificationService should appear only once each
		const authNodes = graph.nodes.filter((n) => n.name === "AuthService");
		expect(authNodes).toHaveLength(1);

		const notifNodes = graph.nodes.filter((n) => n.name === "NotificationService");
		expect(notifNodes).toHaveLength(1);
	});

	it("handles events with no producers", () => {
		seedEvent("system.started", "core", "", "LogService");

		const graph = buildEventFlowGraph(flowDeps, "/project");

		const eventNode = graph.nodes.find((n) => n.name === "system.started");
		expect(eventNode).toBeDefined();

		// Only event->consumer edge, no producer edges
		const producerEdges = graph.edges.filter((e) => e.to === "system.started");
		expect(producerEdges).toHaveLength(0);
	});

	it("handles events with no consumers", () => {
		seedEvent("audit.logged", "audit", "AuditService", "");

		const graph = buildEventFlowGraph(flowDeps, "/project");

		const consumerEdges = graph.edges.filter((e) => e.from === "audit.logged");
		expect(consumerEdges).toHaveLength(0);
	});

	it("handles events with no producers and no consumers", () => {
		seedEvent("orphan.event", "misc", "", "");

		const graph = buildEventFlowGraph(flowDeps, "/project");

		expect(graph.nodes).toHaveLength(1);
		expect(graph.nodes[0].name).toBe("orphan.event");
		expect(graph.edges).toHaveLength(0);
	});

	it("returns nodes sorted by name", () => {
		seedEvent("z.event", "z", "ZService", "");
		seedEvent("a.event", "a", "AService", "");

		const graph = buildEventFlowGraph(flowDeps, "/project");
		const names = graph.nodes.map((n) => n.name);
		const expected = [...names].sort((a, b) => a.localeCompare(b));

		expect(names).toEqual(expected);
	});
});

// ── renderMermaidFlowchart ─────────────────────────────────────────

describe("renderMermaidFlowchart", () => {
	it("renders empty graph with comment", () => {
		const lines = renderMermaidFlowchart({ nodes: [], edges: [] });
		expect(lines[0]).toBe("graph LR");
		expect(lines[1]).toContain("No events defined");
	});

	it("renders graph with producer -> event -> consumer edges", () => {
		seedEvent("user.created", "user", "AuthService", "EmailService");
		const graph = buildEventFlowGraph(flowDeps, "/project");

		const lines = renderMermaidFlowchart(graph);
		const text = lines.join("\n");

		expect(text).toContain("graph LR");
		expect(text).toContain("AuthService");
		expect(text).toContain("user.created");
		expect(text).toContain("EmailService");
		expect(text).toContain("-->");
	});

	it("deduplicates identical edges", () => {
		const graph = buildEventFlowGraph(flowDeps, "/project");
		// Manually create a graph with duplicate edges
		const dupeGraph = {
			nodes: [
				{ type: "producer" as const, name: "A" },
				{ type: "event" as const, name: "B" },
			],
			edges: [
				{ from: "A", to: "B", label: "B" },
				{ from: "A", to: "B", label: "B" },
			],
		};

		const lines = renderMermaidFlowchart(dupeGraph);
		const edgeLines = lines.filter((l) => l.includes("-->"));
		expect(edgeLines).toHaveLength(1);
	});

	it("renders event nodes with double brackets (stadium shape)", () => {
		const graph = {
			nodes: [{ type: "event" as const, name: "user.created", domain: "user" }],
			edges: [],
		};

		const lines = renderMermaidFlowchart(graph);
		const text = lines.join("\n");

		expect(text).toContain('([["user.created"]])');
	});
});

// ── renderMermaidByDomain ──────────────────────────────────────────

describe("renderMermaidByDomain", () => {
	it("groups events by domain", () => {
		seedEvent("user.created", "user", "AuthService", "EmailService");
		seedEvent("order.placed", "order", "CartService", "ShippingService");

		const graph = buildEventFlowGraph(flowDeps, "/project");
		const byDomain = renderMermaidByDomain(graph);

		expect(byDomain.size).toBe(2);
		expect(byDomain.has("user")).toBe(true);
		expect(byDomain.has("order")).toBe(true);
	});

	it("includes only relevant nodes and edges per domain", () => {
		seedEvent("user.created", "user", "AuthService", "EmailService");
		seedEvent("order.placed", "order", "CartService", "ShippingService");

		const graph = buildEventFlowGraph(flowDeps, "/project");
		const byDomain = renderMermaidByDomain(graph);

		const userDiagram = byDomain.get("user")!.join("\n");
		expect(userDiagram).toContain("AuthService");
		expect(userDiagram).toContain("user.created");
		expect(userDiagram).not.toContain("CartService");
		expect(userDiagram).not.toContain("order.placed");
	});

	it("returns empty map when no events have domains", () => {
		const graph = {
			nodes: [{ type: "event" as const, name: "orphan", domain: "" }],
			edges: [],
		};

		const byDomain = renderMermaidByDomain(graph);
		expect(byDomain.size).toBe(0);
	});
});

// ── generateEventFlowDoc ───────────────────────────────────────────

describe("generateEventFlowDoc", () => {
	it("generates markdown with frontmatter", () => {
		seedEvent("user.created", "user", "AuthService", "EmailService");

		const doc = generateEventFlowDoc(flowDeps, "/project");

		expect(doc).toContain("---");
		expect(doc).toContain("type: EventFlow");
		expect(doc).toContain("domain: all");
	});

	it("includes Mermaid code block", () => {
		seedEvent("user.created", "user", "AuthService", "EmailService");

		const doc = generateEventFlowDoc(flowDeps, "/project");

		expect(doc).toContain("```mermaid");
		expect(doc).toContain("graph LR");
		expect(doc).toContain("```");
	});

	it("includes summary table", () => {
		seedEvent("user.created", "user", "AuthService", "EmailService");

		const doc = generateEventFlowDoc(flowDeps, "/project");

		expect(doc).toContain("## Summary");
		expect(doc).toContain("| Events | 1 |");
		expect(doc).toContain("| Producers | 1 |");
		expect(doc).toContain("| Consumers | 1 |");
		expect(doc).toContain("| Connections | 2 |");
	});

	it("handles empty project", () => {
		const doc = generateEventFlowDoc(flowDeps, "/project");

		expect(doc).toContain("# Event Flow");
		expect(doc).toContain("No events defined yet");
	});

	it("filters by domain when specified", () => {
		seedEvent("user.created", "user", "AuthService", "EmailService");
		seedEvent("order.placed", "order", "CartService", "ShippingService");

		const doc = generateEventFlowDoc(flowDeps, "/project", "user");

		expect(doc).toContain("Event Flow — user");
		expect(doc).toContain("Domain: user");
		expect(doc).toContain("AuthService");
		expect(doc).not.toContain("CartService");
	});

	it("shows message for non-existent domain filter", () => {
		seedEvent("user.created", "user", "AuthService", "EmailService");

		const doc = generateEventFlowDoc(flowDeps, "/project", "nonexistent");

		expect(doc).toContain('No events found for domain "nonexistent"');
	});

	it("includes per-domain sections when multiple domains exist", () => {
		seedEvent("user.created", "user", "AuthService", "EmailService");
		seedEvent("order.placed", "order", "CartService", "ShippingService");

		const doc = generateEventFlowDoc(flowDeps, "/project");

		expect(doc).toContain("## By Domain");
		expect(doc).toContain("### user");
		expect(doc).toContain("### order");
	});
});

// ── saveEventFlowDoc ───────────────────────────────────────────────

describe("saveEventFlowDoc", () => {
	it("writes the document to docs/events/Event Flow.md", () => {
		seedEvent("user.created", "user", "AuthService", "EmailService");

		const filePath = saveEventFlowDoc(flowDeps, "/project");

		expect(normalize(filePath)).toContain("docs/events/Event Flow.md");
		expect(disk.writeFileSync).toHaveBeenCalled();
	});

	it("creates the events directory if needed", () => {
		seedEvent("user.created", "user", "AuthService", "EmailService");

		saveEventFlowDoc(flowDeps, "/project");

		expect(disk.mkdirSync).toHaveBeenCalled();
	});

	it("passes domain filter through", () => {
		seedEvent("user.created", "user", "AuthService", "EmailService");

		const filePath = saveEventFlowDoc(flowDeps, "/project", "user");

		expect(normalize(filePath)).toContain("Event Flow.md");
		const content = mockFs[normalize(filePath)];
		expect(content).toContain("Event Flow — user");
	});
});
