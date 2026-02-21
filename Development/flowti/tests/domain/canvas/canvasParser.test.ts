import { describe, it, expect } from "vitest";
import {
	parseCanvasJson,
	extractLegend,
	resolveNodeType,
	slugifyTitle,
	toPascalCase,
	isNodeInsideGroup,
} from "../../../src/domain/canvas/CanvasParser";
import type { AllCanvasNodeData, CanvasGroupData, CanvasTextData } from "obsidian/canvas";
import type { CanvasData } from "../../../src/domain/canvas/types";

// ─────────────────────────────────────────────────────────────
// Helpers — build minimal canvas fixtures
// ─────────────────────────────────────────────────────────────

function textNode(id: string, text: string, overrides: Partial<CanvasTextData> = {}): CanvasTextData {
	return { id, type: "text", text, x: 0, y: 0, width: 100, height: 50, ...overrides };
}

function groupNode(id: string, label: string, overrides: Partial<CanvasGroupData> = {}): CanvasGroupData {
	return { id, type: "group", label, x: 0, y: 0, width: 500, height: 500, ...overrides };
}

function canvas(nodes: AllCanvasNodeData[], edges: CanvasData["edges"] = []): CanvasData {
	return { nodes, edges };
}

// ─────────────────────────────────────────────────────────────
// parseCanvasJson
// ─────────────────────────────────────────────────────────────

describe("parseCanvasJson", () => {
	it("parses valid JSON with nodes and edges", () => {
		const json = JSON.stringify({ nodes: [textNode("1", "Hello")], edges: [] });
		const result = parseCanvasJson(json);
		expect(result).not.toBeNull();
		expect(result!.nodes).toHaveLength(1);
		expect(result!.edges).toHaveLength(0);
	});

	it("returns null for empty string", () => {
		expect(parseCanvasJson("")).toBeNull();
	});

	it("returns null for whitespace-only string", () => {
		expect(parseCanvasJson("   ")).toBeNull();
	});

	it("returns null for malformed JSON", () => {
		expect(parseCanvasJson("{not valid}")).toBeNull();
	});

	it("returns null when nodes array is missing", () => {
		expect(parseCanvasJson(JSON.stringify({ edges: [] }))).toBeNull();
	});

	it("returns null when nodes is not an array", () => {
		expect(parseCanvasJson(JSON.stringify({ nodes: "oops", edges: [] }))).toBeNull();
	});

	it("handles empty nodes array", () => {
		const result = parseCanvasJson(JSON.stringify({ nodes: [], edges: [] }));
		expect(result).not.toBeNull();
		expect(result!.nodes).toHaveLength(0);
	});

	it("defaults edges to empty array when missing", () => {
		const result = parseCanvasJson(JSON.stringify({ nodes: [] }));
		expect(result).not.toBeNull();
		expect(result!.edges).toHaveLength(0);
	});
});

// ─────────────────────────────────────────────────────────────
// extractLegend
// ─────────────────────────────────────────────────────────────

describe("extractLegend", () => {
	it("extracts color-to-type mappings from legend group", () => {
		const legend = groupNode("g1", "Legend", { x: 0, y: 0, width: 500, height: 500 });
		const red = textNode("t1", "Bug Report", { color: "1", x: 10, y: 10 });
		const blue = textNode("t2", "Feature", { color: "5", x: 10, y: 60 });
		const data = canvas([legend, red, blue]);

		const result = extractLegend(data);
		expect(result).toEqual({ "1": "BugReport", "5": "Feature" });
	});

	it("returns null when no legend group exists", () => {
		const data = canvas([textNode("t1", "Hello")]);
		expect(extractLegend(data)).toBeNull();
	});

	it("returns null when legend group has no colored children", () => {
		const legend = groupNode("g1", "Legend");
		const noColor = textNode("t1", "No Color", { x: 10, y: 10 });
		expect(extractLegend(canvas([legend, noColor]))).toBeNull();
	});

	it("is case-insensitive for legend label", () => {
		const legend = groupNode("g1", "LEGEND", { x: 0, y: 0, width: 500, height: 500 });
		const item = textNode("t1", "Issue", { color: "1", x: 10, y: 10 });
		expect(extractLegend(canvas([legend, item]))).toEqual({ "1": "Issue" });
	});

	it("skips text nodes without color", () => {
		const legend = groupNode("g1", "legend", { x: 0, y: 0, width: 500, height: 500 });
		const colored = textNode("t1", "Epic", { color: "2", x: 10, y: 10 });
		const noColor = textNode("t2", "Ignore Me", { x: 10, y: 60 });

		const result = extractLegend(canvas([legend, colored, noColor]));
		expect(result).toEqual({ "2": "Epic" });
	});

	it("skips text nodes outside the legend group", () => {
		const legend = groupNode("g1", "Legend", { x: 0, y: 0, width: 100, height: 100 });
		const inside = textNode("t1", "Inside", { color: "1", x: 10, y: 10 });
		const outside = textNode("t2", "Outside", { color: "2", x: 500, y: 500 });

		const result = extractLegend(canvas([legend, inside, outside]));
		expect(result).toEqual({ "1": "Inside" });
	});
});

// ─────────────────────────────────────────────────────────────
// resolveNodeType
// ─────────────────────────────────────────────────────────────

describe("resolveNodeType", () => {
	it("returns 'Group' for group nodes without color", () => {
		const node = groupNode("g1", "My Group") as AllCanvasNodeData;
		expect(resolveNodeType(node, null)).toBe("Group");
	});

	it("uses legend mapping over default color", () => {
		const node = textNode("t1", "Hello", { color: "1" }) as AllCanvasNodeData;
		const legendMap = { "1": "CustomType" };
		expect(resolveNodeType(node, legendMap)).toBe("CustomType");
	});

	it("uses shape mapping over default color", () => {
		const node = { ...textNode("t1", "Hello", { color: "1" }), shape: "circle" } as AllCanvasNodeData;
		expect(resolveNodeType(node, null)).toBe("Event");
	});

	it("maps all 6 default colors", () => {
		expect(resolveNodeType(textNode("1", "A", { color: "1" }) as AllCanvasNodeData, null)).toBe("Issue");
		expect(resolveNodeType(textNode("2", "B", { color: "2" }) as AllCanvasNodeData, null)).toBe("Epic");
		expect(resolveNodeType(textNode("3", "C", { color: "3" }) as AllCanvasNodeData, null)).toBe("Task");
		expect(resolveNodeType(textNode("4", "D", { color: "4" }) as AllCanvasNodeData, null)).toBe("Test");
		expect(resolveNodeType(textNode("5", "E", { color: "5" }) as AllCanvasNodeData, null)).toBe("Deliverable");
		expect(resolveNodeType(textNode("6", "F", { color: "6" }) as AllCanvasNodeData, null)).toBe("Feature");
	});

	it("returns 'Node' when no color, shape, or legend match", () => {
		const node = textNode("t1", "Plain") as AllCanvasNodeData;
		expect(resolveNodeType(node, null)).toBe("Node");
	});

	it("uses custom colorMap when provided", () => {
		const node = textNode("t1", "Hello", { color: "1" }) as AllCanvasNodeData;
		const customColorMap = { "1": "SpecialType" };
		expect(resolveNodeType(node, null, customColorMap)).toBe("SpecialType");
	});

	it("uses custom shapeMap when provided", () => {
		const node = { ...textNode("t1", "Hello"), shape: "hexagon" } as AllCanvasNodeData;
		const customShapeMap = { "hexagon": "Decision" };
		expect(resolveNodeType(node, null, undefined, customShapeMap)).toBe("Decision");
	});

	it("legend takes priority over shape", () => {
		const node = { ...textNode("t1", "Hello", { color: "2" }), shape: "circle" } as AllCanvasNodeData;
		const legendMap = { "2": "LegendWins" };
		expect(resolveNodeType(node, legendMap)).toBe("LegendWins");
	});

	it("group with color uses legend/color mapping, not 'Group'", () => {
		const node = { ...groupNode("g1", "Colored Group"), color: "3" } as AllCanvasNodeData;
		expect(resolveNodeType(node, null)).toBe("Task");
	});
});

// ─────────────────────────────────────────────────────────────
// slugifyTitle
// ─────────────────────────────────────────────────────────────

describe("slugifyTitle", () => {
	it("returns trimmed title unchanged", () => {
		expect(slugifyTitle("Hello World")).toBe("Hello World");
	});

	it("removes invalid file characters", () => {
		expect(slugifyTitle('File: "test" <1>?')).toBe("File test 1");
	});

	it("strips leading # (markdown headers)", () => {
		expect(slugifyTitle("## My Heading")).toBe("My Heading");
	});

	it("collapses multiple spaces", () => {
		expect(slugifyTitle("Too   many   spaces")).toBe("Too many spaces");
	});

	it("truncates on word boundary at maxLength", () => {
		const long = "This is a very long title that exceeds the limit";
		expect(slugifyTitle(long, 20).length).toBeLessThanOrEqual(20);
		expect(slugifyTitle(long, 20)).toBe("This is a very long");
	});

	it("returns 'untitled' for empty string", () => {
		expect(slugifyTitle("")).toBe("untitled");
	});

	it("returns 'untitled' for string that becomes empty after sanitization", () => {
		expect(slugifyTitle('\\/:*?"<>|')).toBe("untitled");
	});

	it("uses default maxLength of 80", () => {
		const long = "A".repeat(100);
		expect(slugifyTitle(long).length).toBeLessThanOrEqual(80);
	});
});

// ─────────────────────────────────────────────────────────────
// toPascalCase
// ─────────────────────────────────────────────────────────────

describe("toPascalCase", () => {
	it("converts space-separated words", () => {
		expect(toPascalCase("hello world")).toBe("HelloWorld");
	});

	it("converts hyphen-separated words", () => {
		expect(toPascalCase("hello-world")).toBe("HelloWorld");
	});

	it("converts underscore-separated words", () => {
		expect(toPascalCase("hello_world")).toBe("HelloWorld");
	});

	it("handles single word", () => {
		expect(toPascalCase("hello")).toBe("Hello");
	});

	it("returns empty string for empty input", () => {
		expect(toPascalCase("")).toBe("");
	});

	it("handles already PascalCase input", () => {
		expect(toPascalCase("HelloWorld")).toBe("Helloworld");
	});

	it("trims whitespace", () => {
		expect(toPascalCase("  spaced  ")).toBe("Spaced");
	});
});

// ─────────────────────────────────────────────────────────────
// isNodeInsideGroup
// ─────────────────────────────────────────────────────────────

describe("isNodeInsideGroup", () => {
	const group = { x: 0, y: 0, width: 200, height: 200 };

	it("returns true when node is fully inside", () => {
		expect(isNodeInsideGroup({ x: 10, y: 10, width: 50, height: 30 }, group)).toBe(true);
	});

	it("returns false when node is outside", () => {
		expect(isNodeInsideGroup({ x: 300, y: 300, width: 50, height: 30 }, group)).toBe(false);
	});

	it("returns true when node is on the boundary", () => {
		expect(isNodeInsideGroup({ x: 0, y: 0, width: 50, height: 30 }, group)).toBe(true);
	});

	it("returns true when node is on the far boundary", () => {
		expect(isNodeInsideGroup({ x: 200, y: 200, width: 50, height: 30 }, group)).toBe(true);
	});

	it("returns false when node is partially outside (x)", () => {
		expect(isNodeInsideGroup({ x: -10, y: 10, width: 50, height: 30 }, group)).toBe(false);
	});

	it("returns false when node is partially outside (y)", () => {
		expect(isNodeInsideGroup({ x: 10, y: -10, width: 50, height: 30 }, group)).toBe(false);
	});
});
