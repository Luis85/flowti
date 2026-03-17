import { describe, it, expect } from "vitest";
import {
	generateCanvasId,
	rebuildCanvasData,
	writeRebuiltCanvas,
} from "../../../src/domain/canvas/CanvasRebuilder";
import type { AllCanvasNodeData, CanvasEdgeData } from "obsidian/canvas";
import { createMockFileSystem } from "../../mocks/filesystem";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function textNode(id: string, overrides: Partial<AllCanvasNodeData> = {}): AllCanvasNodeData {
	return {
		id,
		type: "text",
		text: `Content ${id}`,
		x: 0, y: 0, width: 200, height: 100,
		...overrides,
	} as AllCanvasNodeData;
}

function groupNode(id: string, label: string, overrides: Partial<AllCanvasNodeData> = {}): AllCanvasNodeData {
	return {
		id,
		type: "group",
		label,
		x: 0, y: 0, width: 500, height: 500,
		...overrides,
	} as AllCanvasNodeData;
}

function fileNode(id: string, file: string): AllCanvasNodeData {
	return {
		id,
		type: "file",
		file,
		x: 10, y: 10, width: 200, height: 100,
	} as AllCanvasNodeData;
}

function edge(from: string, to: string, overrides: Partial<CanvasEdgeData> = {}): CanvasEdgeData {
	return {
		id: `e-${from}-${to}`,
		fromNode: from,
		fromSide: "right",
		toNode: to,
		toSide: "left",
		...overrides,
	} as CanvasEdgeData;
}

function deterministicIdGen(): () => string {
	let counter = 0;
	return () => `new-${String(counter++).padStart(3, "0")}`;
}

// ─────────────────────────────────────────────────────────────
// generateCanvasId
// ─────────────────────────────────────────────────────────────

describe("generateCanvasId", () => {
	it("produces 16-char hex string", () => {
		const id = generateCanvasId();
		expect(id).toMatch(/^[0-9a-f]{16}$/);
	});

	it("produces unique IDs", () => {
		const ids = new Set(Array.from({ length: 100 }, () => generateCanvasId()));
		expect(ids.size).toBe(100);
	});
});

// ─────────────────────────────────────────────────────────────
// rebuildCanvasData
// ─────────────────────────────────────────────────────────────

describe("rebuildCanvasData", () => {
	it("preserves groups with new IDs", () => {
		const nodes = [groupNode("g1", "My Group")];
		const result = rebuildCanvasData(nodes, [], new Map(), deterministicIdGen());

		expect(result.nodes).toHaveLength(1);
		expect(result.nodes[0].id).toBe("new-000");
		expect(result.nodes[0].type).toBe("group");
		expect((result.nodes[0] as Record<string, unknown>).label).toBe("My Group");
	});

	it("replaces text nodes with file references when imported", () => {
		const nodes = [textNode("t1", { x: 10, y: 20, width: 200, height: 100 })];
		const fileMap = new Map([["t1", "output/My Note.md"]]);

		const result = rebuildCanvasData(nodes, [], fileMap, deterministicIdGen());

		expect(result.nodes).toHaveLength(1);
		const node = result.nodes[0] as Record<string, unknown>;
		expect(node.type).toBe("file");
		expect(node.file).toBe("output/My Note.md");
	});

	it("preserves spatial layout on file references", () => {
		const nodes = [textNode("t1", { x: 42, y: 99, width: 300, height: 150 })];
		const fileMap = new Map([["t1", "output/note.md"]]);

		const result = rebuildCanvasData(nodes, [], fileMap, deterministicIdGen());

		const node = result.nodes[0];
		expect(node.x).toBe(42);
		expect(node.y).toBe(99);
		expect(node.width).toBe(300);
		expect(node.height).toBe(150);
	});

	it("preserves color on file references", () => {
		const nodes = [textNode("t1", { color: "3" } as Partial<AllCanvasNodeData>)];
		const fileMap = new Map([["t1", "output/note.md"]]);

		const result = rebuildCanvasData(nodes, [], fileMap, deterministicIdGen());

		expect((result.nodes[0] as Record<string, unknown>).color).toBe("3");
	});

	it("keeps text nodes without imported path as fallback", () => {
		const nodes = [textNode("t1")];

		const result = rebuildCanvasData(nodes, [], new Map(), deterministicIdGen());

		expect(result.nodes).toHaveLength(1);
		expect(result.nodes[0].type).toBe("text");
		expect(result.nodes[0].id).toBe("new-000");
	});

	it("preserves existing file nodes with new IDs", () => {
		const nodes = [fileNode("f1", "existing/doc.md")];

		const result = rebuildCanvasData(nodes, [], new Map(), deterministicIdGen());

		expect(result.nodes).toHaveLength(1);
		expect(result.nodes[0].type).toBe("file");
		expect((result.nodes[0] as Record<string, unknown>).file).toBe("existing/doc.md");
		expect(result.nodes[0].id).toBe("new-000");
	});

	it("remaps edge IDs to new node IDs", () => {
		const nodes = [textNode("a"), textNode("b")];
		const edges = [edge("a", "b")];

		const result = rebuildCanvasData(nodes, edges, new Map(), deterministicIdGen());

		expect(result.edges).toHaveLength(1);
		expect(result.edges[0].fromNode).toBe("new-000");
		expect(result.edges[0].toNode).toBe("new-001");
		expect(result.edges[0].id).toBe("new-002");
	});

	it("drops edges with unmapped node IDs", () => {
		const nodes = [textNode("a")];
		const edges = [edge("a", "missing")];

		const result = rebuildCanvasData(nodes, edges, new Map(), deterministicIdGen());

		expect(result.edges).toHaveLength(0);
	});

	it("preserves edge properties (fromSide, toSide, label, color)", () => {
		const nodes = [textNode("a"), textNode("b")];
		const edges = [edge("a", "b", {
			fromSide: "bottom",
			toSide: "top",
			label: "depends on",
			color: "2",
		})];

		const result = rebuildCanvasData(nodes, edges, new Map(), deterministicIdGen());

		expect(result.edges[0].fromSide).toBe("bottom");
		expect(result.edges[0].toSide).toBe("top");
		expect(result.edges[0].label).toBe("depends on");
		expect(result.edges[0].color).toBe("2");
	});

	it("handles empty arrays", () => {
		const result = rebuildCanvasData([], [], new Map(), deterministicIdGen());

		expect(result.nodes).toHaveLength(0);
		expect(result.edges).toHaveLength(0);
	});
});

// ─────────────────────────────────────────────────────────────
// writeRebuiltCanvas
// ─────────────────────────────────────────────────────────────

describe("writeRebuiltCanvas", () => {
	it("creates new canvas file", async () => {
		const fs = createMockFileSystem();
		const data = { nodes: [] as AllCanvasNodeData[], edges: [] as CanvasEdgeData[] };

		const result = await writeRebuiltCanvas(data, "output", "My Canvas", fs);

		expect(result.action).toBe("created");
		expect(result.path).toBe("output/My Canvas.canvas");
		expect(fs.createFile).toHaveBeenCalledOnce();
	});

	it("skips existing canvas when overwrite is false", async () => {
		const fs = createMockFileSystem({ "output/My Canvas.canvas": "{}" });
		const data = { nodes: [] as AllCanvasNodeData[], edges: [] as CanvasEdgeData[] };

		const result = await writeRebuiltCanvas(data, "output", "My Canvas", fs, false);

		expect(result.action).toBe("skipped");
		expect(fs.createFile).not.toHaveBeenCalled();
		expect(fs.updateFile).not.toHaveBeenCalled();
	});

	it("updates existing canvas when overwrite is true", async () => {
		const fs = createMockFileSystem({ "output/My Canvas.canvas": "{}" });
		const data = { nodes: [] as AllCanvasNodeData[], edges: [] as CanvasEdgeData[] };

		const result = await writeRebuiltCanvas(data, "output", "My Canvas", fs, true);

		expect(result.action).toBe("updated");
		expect(fs.updateFile).toHaveBeenCalledOnce();
	});

	it("passes createFolders option to createFile", async () => {
		const fs = createMockFileSystem();
		const data = { nodes: [] as AllCanvasNodeData[], edges: [] as CanvasEdgeData[] };

		await writeRebuiltCanvas(data, "deep/folder", "test", fs);

		expect(fs.createFile).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			{ createFolders: true },
		);
	});

	it("serializes canvas data as formatted JSON", async () => {
		const fs = createMockFileSystem();
		const data = { nodes: [textNode("n1")], edges: [] as CanvasEdgeData[] };

		await writeRebuiltCanvas(data, "output", "test", fs);

		const content = (fs.createFile as ReturnType<typeof import("vitest").vi.fn>).mock.calls[0][1] as string;
		expect(content).toContain('"nodes"');
		expect(content).toContain('"n1"');
		expect(content).toContain("  "); // formatted with indent
	});
});
