import { describe, it, expect } from "vitest";
import {
	CANVAS_TEMPLATES,
	getCanvasTemplate,
} from "../../../../src/domain/canvas/templates/canvasTemplates";
import type { CanvasTemplate } from "../../../../src/domain/canvas/templates/types";

describe("CANVAS_TEMPLATES registry", () => {
	it("contains exactly 5 templates", () => {
		expect(CANVAS_TEMPLATES).toHaveLength(5);
	});

	it("all IDs are unique", () => {
		const ids = CANVAS_TEMPLATES.map((t) => t.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("all templates have required metadata", () => {
		for (const t of CANVAS_TEMPLATES) {
			expect(t.id).toBeTruthy();
			expect(t.name).toBeTruthy();
			expect(t.description).toBeTruthy();
			expect(t.icon).toBeTruthy();
			expect(t.category).toBeTruthy();
			expect(typeof t.generate).toBe("function");
		}
	});

	it("includes the 5 expected template IDs", () => {
		const ids = CANVAS_TEMPLATES.map((t) => t.id);
		expect(ids).toContain("domain-design");
		expect(ids).toContain("sprint-planning");
		expect(ids).toContain("retrospective");
		expect(ids).toContain("brainstorm");
		expect(ids).toContain("flow-design");
	});
});

describe("getCanvasTemplate()", () => {
	it("returns a template by ID", () => {
		const t = getCanvasTemplate("domain-design");
		expect(t).toBeDefined();
		expect(t!.name).toBe("Domain Design");
	});

	it("returns undefined for unknown ID", () => {
		expect(getCanvasTemplate("nonexistent")).toBeUndefined();
	});
});

describe("template generators", () => {
	const templates = CANVAS_TEMPLATES as readonly CanvasTemplate[];

	for (const template of templates) {
		describe(`${template.name} template`, () => {
			it("generates valid CanvasData with nodes and edges", () => {
				const data = template.generate();
				expect(data.nodes).toBeDefined();
				expect(Array.isArray(data.nodes)).toBe(true);
				expect(data.nodes.length).toBeGreaterThan(0);
				expect(data.edges).toBeDefined();
				expect(Array.isArray(data.edges)).toBe(true);
			});

			it("generates unique IDs across all elements", () => {
				const data = template.generate();
				const nodeIds = data.nodes.map((n) => n.id);
				const edgeIds = data.edges.map((e) => e.id);
				const allIds = [...nodeIds, ...edgeIds];
				expect(new Set(allIds).size).toBe(allIds.length);
			});

			it("generates different IDs on each call", () => {
				const data1 = template.generate();
				const data2 = template.generate();
				const ids1 = new Set(data1.nodes.map((n) => n.id));
				const ids2 = new Set(data2.nodes.map((n) => n.id));
				// No overlap between two generations
				for (const id of ids1) {
					expect(ids2.has(id)).toBe(false);
				}
			});

			it("has at least one group node", () => {
				const data = template.generate();
				const groups = data.nodes.filter((n) => n.type === "group");
				expect(groups.length).toBeGreaterThan(0);
			});

			it("has at least one text placeholder node", () => {
				const data = template.generate();
				const texts = data.nodes.filter((n) => n.type === "text");
				expect(texts.length).toBeGreaterThan(0);
			});

			it("all nodes have valid dimensions", () => {
				const data = template.generate();
				for (const node of data.nodes) {
					expect(node.width).toBeGreaterThan(0);
					expect(node.height).toBeGreaterThan(0);
					expect(typeof node.x).toBe("number");
					expect(typeof node.y).toBe("number");
				}
			});

			it("all edges reference existing node IDs", () => {
				const data = template.generate();
				const nodeIds = new Set(data.nodes.map((n) => n.id));
				for (const edge of data.edges) {
					expect(nodeIds.has(edge.fromNode)).toBe(true);
					expect(nodeIds.has(edge.toNode)).toBe(true);
				}
			});

			it("generates valid JSON", () => {
				const data = template.generate();
				const json = JSON.stringify(data, null, "\t");
				const parsed = JSON.parse(json);
				expect(parsed.nodes).toHaveLength(data.nodes.length);
				expect(parsed.edges).toHaveLength(data.edges.length);
			});
		});
	}
});
