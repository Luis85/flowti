import { describe, it, expect, vi, beforeEach } from "vitest";
import {
	toCanvasNotePath,
	toCanvasNoteFrontmatter,
	toCanvasNoteContent,
	writeCanvasNote,
	importCanvas,
} from "../../../src/domain/canvas/CanvasImporter";
import type { CanvasImporterDeps } from "../../../src/domain/canvas/CanvasImporter";
import type { CanvasItem, CanvasImportConfig } from "../../../src/domain/canvas/types";
import { createMockFileSystem } from "../../mocks/filesystem";

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function canvasItem(id: string, overrides: Partial<CanvasItem> = {}): CanvasItem {
	return {
		id,
		title: `Item ${id}`,
		type: "Node",
		originalType: "text",
		status: "new",
		color: null,
		shape: null,
		parentId: null,
		parent: null,
		isEmpty: false,
		x: 0, y: 0, width: 100, height: 50,
		up: [], down: [], prev: [], next: [],
		...overrides,
	};
}

function defaultConfig(): Pick<CanvasImportConfig, "canvasPath" | "targetFolder" | "conflictStrategy" | "hierarchyMode"> {
	return {
		canvasPath: "designs/my-canvas.canvas",
		targetFolder: "output/notes",
		conflictStrategy: "skip",
		hierarchyMode: "flat",
	};
}

// ─────────────────────────────────────────────────────────────
// toCanvasNotePath
// ─────────────────────────────────────────────────────────────

describe("toCanvasNotePath", () => {
	it("builds flat path with slugified title", () => {
		const item = canvasItem("n1", { title: "My Task" });
		expect(toCanvasNotePath(item, "output", "flat")).toBe("output/My Task.md");
	});

	it("builds product hierarchy path with type subfolder", () => {
		const item = canvasItem("n1", { title: "Login Flow", type: "Epic" });
		expect(toCanvasNotePath(item, "output", "product")).toBe("output/Epics/Login Flow.md");
	});

	it("uses 'Other' subfolder for unknown types in product mode", () => {
		const item = canvasItem("n1", { title: "Custom", type: "CustomType" });
		expect(toCanvasNotePath(item, "output", "product")).toBe("output/Other/Custom.md");
	});

	it("slugifies title with special characters", () => {
		const item = canvasItem("n1", { title: '## "Design: Phase 1"' });
		expect(toCanvasNotePath(item, "out", "flat")).toBe("out/Design Phase 1.md");
	});

	it("handles untitled items", () => {
		const item = canvasItem("n1", { title: "" });
		expect(toCanvasNotePath(item, "out", "flat")).toBe("out/untitled.md");
	});
});

// ─────────────────────────────────────────────────────────────
// toCanvasNoteFrontmatter
// ─────────────────────────────────────────────────────────────

describe("toCanvasNoteFrontmatter", () => {
	it("includes type, status, and canvas_id", () => {
		const item = canvasItem("abc", { type: "Task", status: "new" });
		const fm = toCanvasNoteFrontmatter(item, "canvas.canvas", new Map());

		expect(fm.type).toBe("Task");
		expect(fm.status).toBe("new");
		expect(fm.canvas_id).toBe("abc");
	});

	it("includes parent as wikilink", () => {
		const item = canvasItem("n1", { parent: "My Group" });
		const fm = toCanvasNoteFrontmatter(item, "", new Map());

		expect(fm.parent).toBe("[[My Group]]");
	});

	it("omits parent when null", () => {
		const item = canvasItem("n1");
		const fm = toCanvasNoteFrontmatter(item, "", new Map());

		expect(fm.parent).toBeUndefined();
	});

	it("includes color when present", () => {
		const item = canvasItem("n1", { color: "3" });
		const fm = toCanvasNoteFrontmatter(item, "", new Map());

		expect(fm.color).toBe("3");
	});

	it("resolves up/down/prev/next IDs to wikilinks", () => {
		const a = canvasItem("a", { title: "Alpha", up: ["b"], down: ["c"] });
		const b = canvasItem("b", { title: "Beta" });
		const c = canvasItem("c", { title: "Gamma" });
		const itemsById = new Map([["a", a], ["b", b], ["c", c]]);

		const fm = toCanvasNoteFrontmatter(a, "", itemsById);
		expect(fm.up).toEqual(["[[Beta]]"]);
		expect(fm.down).toEqual(["[[Gamma]]"]);
	});

	it("drops unresolvable IDs from relations", () => {
		const a = canvasItem("a", { up: ["missing"] });
		const fm = toCanvasNoteFrontmatter(a, "", new Map([["a", a]]));

		expect(fm.up).toBeUndefined(); // empty array omitted
	});

	it("includes source canvas as wikilink", () => {
		const item = canvasItem("n1");
		const fm = toCanvasNoteFrontmatter(item, "designs/arch.canvas", new Map());

		expect(fm.source).toBe("[[designs/arch.canvas]]");
	});

	it("omits source when canvasPath is empty", () => {
		const item = canvasItem("n1");
		const fm = toCanvasNoteFrontmatter(item, "", new Map());

		expect(fm.source).toBeUndefined();
	});
});

// ─────────────────────────────────────────────────────────────
// toCanvasNoteContent
// ─────────────────────────────────────────────────────────────

describe("toCanvasNoteContent", () => {
	it("produces valid YAML frontmatter with heading", () => {
		const item = canvasItem("n1", { title: "My Task", type: "Task", status: "new" });
		const content = toCanvasNoteContent(item, "canvas.canvas", new Map());

		expect(content).toContain("---");
		expect(content).toContain("type: Task");
		expect(content).toContain("status: new");
		expect(content).toContain("# My Task");
	});

	it("quotes wikilinks in frontmatter", () => {
		const item = canvasItem("n1", { parent: "Parent Group" });
		const content = toCanvasNoteContent(item, "", new Map());

		expect(content).toContain('parent: "[[Parent Group]]"');
	});

	it("renders relation arrays as YAML lists", () => {
		const a = canvasItem("a", { title: "Alpha", down: ["b"] });
		const b = canvasItem("b", { title: "Beta" });
		const itemsById = new Map([["a", a], ["b", b]]);

		const content = toCanvasNoteContent(a, "", itemsById);
		expect(content).toContain("down:");
		expect(content).toContain('  - "[[Beta]]"');
	});
});

// ─────────────────────────────────────────────────────────────
// writeCanvasNote
// ─────────────────────────────────────────────────────────────

describe("writeCanvasNote", () => {
	it("creates new file when it does not exist", async () => {
		const fs = createMockFileSystem();
		const item = canvasItem("n1", { title: "New Note", type: "Task" });
		const config = defaultConfig();

		const result = await writeCanvasNote(item, config, fs, new Map([["n1", item]]));

		expect(result.action).toBe("created");
		expect(result.path).toBe("output/notes/New Note.md");
		expect(fs.createFile).toHaveBeenCalledOnce();
	});

	it("skips existing file with skip strategy", async () => {
		const fs = createMockFileSystem({ "output/notes/Existing.md": "# old" });
		const item = canvasItem("n1", { title: "Existing" });
		const config = { ...defaultConfig(), conflictStrategy: "skip" as const };

		const result = await writeCanvasNote(item, config, fs, new Map([["n1", item]]));

		expect(result.action).toBe("skipped");
		expect(fs.createFile).not.toHaveBeenCalled();
		expect(fs.updateFile).not.toHaveBeenCalled();
	});

	it("updates frontmatter with update strategy", async () => {
		const fs = createMockFileSystem({ "output/notes/Existing.md": "# old" });
		const item = canvasItem("n1", { title: "Existing", type: "Epic" });
		const config = { ...defaultConfig(), conflictStrategy: "update" as const };

		const result = await writeCanvasNote(item, config, fs, new Map([["n1", item]]));

		expect(result.action).toBe("updated");
		expect(fs.updateFrontmatter).toHaveBeenCalledOnce();
		expect(fs.updateFile).not.toHaveBeenCalled();
	});

	it("replaces file with overwrite strategy", async () => {
		const fs = createMockFileSystem({ "output/notes/Existing.md": "# old" });
		const item = canvasItem("n1", { title: "Existing", type: "Epic" });
		const config = { ...defaultConfig(), conflictStrategy: "overwrite" as const };

		const result = await writeCanvasNote(item, config, fs, new Map([["n1", item]]));

		expect(result.action).toBe("updated");
		expect(fs.updateFile).toHaveBeenCalledOnce();
		expect(fs.updateFrontmatter).not.toHaveBeenCalled();
	});

	it("uses product hierarchy for path when configured", async () => {
		const fs = createMockFileSystem();
		const item = canvasItem("n1", { title: "My Feature", type: "Feature" });
		const config = { ...defaultConfig(), hierarchyMode: "product" as const };

		const result = await writeCanvasNote(item, config, fs, new Map([["n1", item]]));

		expect(result.path).toBe("output/notes/Features/My Feature.md");
	});

	it("passes createFolders option to createFile", async () => {
		const fs = createMockFileSystem();
		const item = canvasItem("n1", { title: "Deep Note" });

		await writeCanvasNote(item, defaultConfig(), fs, new Map([["n1", item]]));

		expect(fs.createFile).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			{ createFolders: true },
		);
	});
});

// ─────────────────────────────────────────────────────────────
// importCanvas
// ─────────────────────────────────────────────────────────────

describe("importCanvas", () => {
	let emit: CanvasImporterDeps["emit"];
	let deps: CanvasImporterDeps;

	beforeEach(() => {
		emit = vi.fn(async () => {}) as unknown as CanvasImporterDeps["emit"];
		deps = {
			fileSystem: createMockFileSystem(),
			emit,
		};
	});

	it("imports all items and returns result", async () => {
		const items = [canvasItem("a"), canvasItem("b"), canvasItem("c")];
		const result = await importCanvas(items, defaultConfig(), deps);

		expect(result.imported).toBe(3);
		expect(result.skipped).toBe(0);
		expect(result.errors).toHaveLength(0);
		expect(result.totalNodes).toBe(3);
	});

	it("emits started event", async () => {
		const items = [canvasItem("a")];
		await importCanvas(items, defaultConfig(), deps);

		expect(emit).toHaveBeenCalledWith("canvas.import.started", {
			canvasPath: "designs/my-canvas.canvas",
			targetFolder: "output/notes",
			totalNodes: 1,
		});
	});

	it("emits progress event per item", async () => {
		const items = [canvasItem("a"), canvasItem("b")];
		await importCanvas(items, defaultConfig(), deps);

		const emitMock = emit as unknown as ReturnType<typeof vi.fn>;
		const progressCalls = emitMock.mock.calls.filter(
			(c: unknown[]) => c[0] === "canvas.import.progress",
		);
		expect(progressCalls).toHaveLength(2);
		expect(progressCalls[0][1]).toMatchObject({ current: 1, total: 2 });
		expect(progressCalls[1][1]).toMatchObject({ current: 2, total: 2 });
	});

	it("emits completed event on success", async () => {
		const items = [canvasItem("a")];
		await importCanvas(items, defaultConfig(), deps);

		expect(emit).toHaveBeenCalledWith("canvas.import.completed", {
			result: expect.objectContaining({ imported: 1 }),
		});
	});

	it("counts skipped items with skip strategy", async () => {
		const fs = createMockFileSystem({
			"output/notes/Item a.md": "existing",
			"output/notes/Item b.md": "existing",
		});
		deps.fileSystem = fs;

		const items = [canvasItem("a"), canvasItem("b"), canvasItem("c")];
		const result = await importCanvas(items, defaultConfig(), deps);

		expect(result.skipped).toBe(2);
		expect(result.imported).toBe(1);
	});

	it("captures per-node errors without aborting", async () => {
		const fs = createMockFileSystem();
		(fs.createFile as ReturnType<typeof vi.fn>)
			.mockResolvedValueOnce(undefined)          // a succeeds
			.mockRejectedValueOnce(new Error("Disk full"))  // b fails
			.mockResolvedValueOnce(undefined);          // c succeeds

		deps.fileSystem = fs;

		const items = [canvasItem("a"), canvasItem("b"), canvasItem("c")];
		const result = await importCanvas(items, defaultConfig(), deps);

		expect(result.imported).toBe(2);
		expect(result.errors).toHaveLength(1);
		expect(result.errors[0]).toMatchObject({
			nodeId: "b",
			error: "Disk full",
		});
	});

	it("emits failed event when all nodes fail", async () => {
		const fs = createMockFileSystem();
		(fs.createFile as ReturnType<typeof vi.fn>)
			.mockRejectedValue(new Error("Permission denied"));
		deps.fileSystem = fs;

		const items = [canvasItem("a"), canvasItem("b")];
		await importCanvas(items, defaultConfig(), deps);

		expect(emit).toHaveBeenCalledWith("canvas.import.failed", {
			canvasPath: "designs/my-canvas.canvas",
			error: "All 2 nodes failed to import",
		});
	});

	it("returns duration in result", async () => {
		const items = [canvasItem("a")];
		const result = await importCanvas(items, defaultConfig(), deps);

		expect(result.duration).toBeGreaterThanOrEqual(0);
	});

	it("handles empty items array", async () => {
		const result = await importCanvas([], defaultConfig(), deps);

		expect(result.imported).toBe(0);
		expect(result.totalNodes).toBe(0);
		expect(emit).toHaveBeenCalledWith("canvas.import.completed", {
			result: expect.objectContaining({ imported: 0 }),
		});
	});
});
