import { describe, it, expect } from "vitest";
import {
	parseProcessCanvas,
	isProcessCanvas,
	detectNodeType,
	extractNodeName,
	extractMetadata,
	parseSimpleYaml,
} from "../../../src/domain/process/canvasParser";
import type { CanvasJson, CanvasNodeData } from "../../../src/domain/process/canvasParser";

// ── Test helpers ────────────────────────────────────────────

function makeNode(overrides: Partial<CanvasNodeData> & { id: string }): CanvasNodeData {
	return { type: "text", x: 0, y: 0, width: 200, height: 100, ...overrides };
}

function makeCanvas(nodes: CanvasNodeData[], edges: CanvasJson["edges"] = []): CanvasJson {
	return { nodes, edges };
}

/** A minimal valid process canvas with Start → Activity → End. */
function minimalProcessCanvas(): CanvasJson {
	return makeCanvas(
		[
			makeNode({ id: "s1", text: "● Feedback & Intake" }),
			makeNode({ id: "a1", text: "■ Development\n```yaml\nphase: 6\nrole: engineer\n```" }),
			makeNode({ id: "d1", text: "◇ Gate Check" }),
			makeNode({ id: "e1", text: "⦿ Done" }),
		],
		[
			{ fromNode: "s1", toNode: "a1" },
			{ fromNode: "a1", toNode: "d1" },
			{ fromNode: "d1", toNode: "e1", label: "Pass" },
		],
	);
}

// ── isProcessCanvas ─────────────────────────────────────────

describe("isProcessCanvas", () => {
	it("returns true when nodes have process tokens", () => {
		const canvas = minimalProcessCanvas();
		expect(isProcessCanvas(canvas)).toBe(true);
	});

	it("returns false for empty canvas", () => {
		expect(isProcessCanvas(makeCanvas([]))).toBe(false);
	});

	it("returns false when no process tokens present", () => {
		const canvas = makeCanvas([
			makeNode({ id: "n1", text: "Regular note" }),
			makeNode({ id: "n2", text: "Another note" }),
		]);
		expect(isProcessCanvas(canvas)).toBe(false);
	});
});

// ── detectNodeType ──────────────────────────────────────────

describe("detectNodeType", () => {
	it("detects start node (●)", () => {
		expect(detectNodeType(makeNode({ id: "n1", text: "● Start" }))).toBe("start");
	});

	it("detects activity node (■)", () => {
		expect(detectNodeType(makeNode({ id: "n1", text: "■ Development" }))).toBe("activity");
	});

	it("detects decision node (◇)", () => {
		expect(detectNodeType(makeNode({ id: "n1", text: "◇ Gate Check" }))).toBe("decision");
	});

	it("detects end node (⦿)", () => {
		expect(detectNodeType(makeNode({ id: "n1", text: "⦿ Done" }))).toBe("end");
	});

	it("returns null for unrecognized text", () => {
		expect(detectNodeType(makeNode({ id: "n1", text: "Regular text" }))).toBeNull();
	});

	it("returns null for empty text", () => {
		expect(detectNodeType(makeNode({ id: "n1", text: "" }))).toBeNull();
	});

	it("returns null for node without text", () => {
		expect(detectNodeType(makeNode({ id: "n1" }))).toBeNull();
	});

	it("detects token from label when no text", () => {
		expect(detectNodeType(makeNode({ id: "n1", label: "● Start" }))).toBe("start");
	});

	it("only checks first line for token", () => {
		expect(detectNodeType(makeNode({ id: "n1", text: "Regular\n● Start" }))).toBeNull();
	});
});

// ── extractNodeName ─────────────────────────────────────────

describe("extractNodeName", () => {
	it("removes start token and trims", () => {
		const node = makeNode({ id: "n1", text: "● Feedback & Intake" });
		expect(extractNodeName(node, "start")).toBe("Feedback & Intake");
	});

	it("removes activity token", () => {
		const node = makeNode({ id: "n1", text: "■ Development" });
		expect(extractNodeName(node, "activity")).toBe("Development");
	});

	it("handles multiline — takes first line only", () => {
		const node = makeNode({ id: "n1", text: "◇ Gate Check\nSome description" });
		expect(extractNodeName(node, "decision")).toBe("Gate Check");
	});
});

// ── extractMetadata ─────────────────────────────────────────

describe("extractMetadata", () => {
	it("parses fenced YAML block", () => {
		const node = makeNode({ id: "n1", text: "■ Dev\n```yaml\nphase: 6\nrole: engineer\n```" });
		expect(extractMetadata(node)).toEqual({ phase: 6, role: "engineer" });
	});

	it("returns empty object when no YAML block", () => {
		const node = makeNode({ id: "n1", text: "■ Dev\nNo metadata here" });
		expect(extractMetadata(node)).toEqual({});
	});

	it("returns empty object for empty text", () => {
		expect(extractMetadata(makeNode({ id: "n1" }))).toEqual({});
	});

	it("handles yml fence variant", () => {
		const node = makeNode({ id: "n1", text: "■ Dev\n```yml\nphase: 3\n```" });
		expect(extractMetadata(node)).toEqual({ phase: 3 });
	});
});

// ── parseSimpleYaml ─────────────────────────────────────────

describe("parseSimpleYaml", () => {
	it("parses key-value pairs", () => {
		expect(parseSimpleYaml("phase: 6\nrole: engineer")).toEqual({ phase: 6, role: "engineer" });
	});

	it("handles quoted values", () => {
		expect(parseSimpleYaml('name: "Hello World"')).toEqual({ name: "Hello World" });
	});

	it("handles single-quoted values", () => {
		expect(parseSimpleYaml("name: 'Hello'")).toEqual({ name: "Hello" });
	});

	it("parses numbers", () => {
		expect(parseSimpleYaml("phase: 6")).toEqual({ phase: 6 });
	});

	it("skips comments", () => {
		expect(parseSimpleYaml("# comment\nphase: 6")).toEqual({ phase: 6 });
	});

	it("skips empty lines", () => {
		expect(parseSimpleYaml("phase: 6\n\nrole: dev")).toEqual({ phase: 6, role: "dev" });
	});

	it("returns empty object for empty input", () => {
		expect(parseSimpleYaml("")).toEqual({});
	});
});

// ── parseProcessCanvas ──────────────────────────────────────

describe("parseProcessCanvas", () => {
	it("parses a valid process canvas", () => {
		const canvas = minimalProcessCanvas();
		const result = parseProcessCanvas(canvas, "Dev Lifecycle", "processes/dev.process.canvas");

		expect(result).not.toBeNull();
		expect(result!.name).toBe("Dev Lifecycle");
		expect(result!.filePath).toBe("processes/dev.process.canvas");
		expect(result!.nodes).toHaveLength(4);
		expect(result!.edges).toHaveLength(3);
	});

	it("assigns correct node types", () => {
		const result = parseProcessCanvas(minimalProcessCanvas(), "Test", "test.canvas");
		const types = result!.nodes.map((n) => n.type);
		expect(types).toEqual(["start", "activity", "decision", "end"]);
	});

	it("extracts node names without token prefix", () => {
		const result = parseProcessCanvas(minimalProcessCanvas(), "Test", "test.canvas");
		expect(result!.nodes[0].name).toBe("Feedback & Intake");
		expect(result!.nodes[1].name).toBe("Development");
		expect(result!.nodes[2].name).toBe("Gate Check");
		expect(result!.nodes[3].name).toBe("Done");
	});

	it("extracts metadata from YAML blocks", () => {
		const result = parseProcessCanvas(minimalProcessCanvas(), "Test", "test.canvas");
		expect(result!.nodes[1].metadata).toEqual({ phase: 6, role: "engineer" });
	});

	it("preserves edge labels", () => {
		const result = parseProcessCanvas(minimalProcessCanvas(), "Test", "test.canvas");
		const labeledEdge = result!.edges.find((e) => e.label);
		expect(labeledEdge?.label).toBe("Pass");
	});

	it("only includes edges between process nodes", () => {
		const canvas = makeCanvas(
			[
				makeNode({ id: "s1", text: "● Start" }),
				makeNode({ id: "e1", text: "⦿ End" }),
				makeNode({ id: "x1", text: "Not a process node" }),
			],
			[
				{ fromNode: "s1", toNode: "e1" },
				{ fromNode: "s1", toNode: "x1" },
				{ fromNode: "x1", toNode: "e1" },
			],
		);
		const result = parseProcessCanvas(canvas, "Test", "test.canvas");
		expect(result!.edges).toHaveLength(1);
		expect(result!.edges[0]).toEqual({ fromNode: "s1", toNode: "e1" });
	});

	it("returns null for canvas with no process nodes", () => {
		const canvas = makeCanvas([
			makeNode({ id: "n1", text: "Regular text" }),
		]);
		expect(parseProcessCanvas(canvas, "Test", "test.canvas")).toBeNull();
	});

	it("returns null for empty canvas", () => {
		expect(parseProcessCanvas(makeCanvas([]), "Test", "test.canvas")).toBeNull();
	});

	it("skips non-process nodes gracefully", () => {
		const canvas = makeCanvas([
			makeNode({ id: "s1", text: "● Start" }),
			makeNode({ id: "x1", text: "Regular note" }),
			makeNode({ id: "e1", text: "⦿ End" }),
		]);
		const result = parseProcessCanvas(canvas, "Test", "test.canvas");
		expect(result!.nodes).toHaveLength(2);
	});

	it("handles nodes with no metadata", () => {
		const canvas = makeCanvas([makeNode({ id: "s1", text: "● Start" })]);
		const result = parseProcessCanvas(canvas, "Test", "test.canvas");
		expect(result!.nodes[0].metadata).toEqual({});
	});

	it("preserves node positions", () => {
		const canvas = makeCanvas([
			makeNode({ id: "s1", text: "● Start", x: 100, y: 200 }),
		]);
		const result = parseProcessCanvas(canvas, "Test", "test.canvas");
		expect(result!.nodes[0].x).toBe(100);
		expect(result!.nodes[0].y).toBe(200);
	});
});
