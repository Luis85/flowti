import { describe, it, expect } from "vitest";
import {
	buildBaseFileContent,
	writeBaseFile,
} from "../../../src/domain/canvas/CanvasBaseGenerator";
import { createMockFileSystem } from "../../mocks/filesystem";

// ─────────────────────────────────────────────────────────────
// buildBaseFileContent
// ─────────────────────────────────────────────────────────────

describe("buildBaseFileContent", () => {
	it("generates filter for folder path", () => {
		const content = buildBaseFileContent("output/notes");

		expect(content).toContain('file.inFolder("output/notes")');
		expect(content).toContain('file.ext == "md"');
	});

	it("includes table view grouped by type", () => {
		const content = buildBaseFileContent("output");

		expect(content).toContain("type: table");
		expect(content).toContain("name: Imported Files");
		expect(content).toContain("property: type");
		expect(content).toContain("direction: ASC");
	});

	it("includes all canvas frontmatter columns", () => {
		const content = buildBaseFileContent("output");
		const columns = [
			"file.name", "status", "type", "parent",
			"up", "down", "prev", "next",
			"original_type", "color", "shape", "source", "tags",
		];
		for (const col of columns) {
			expect(content).toContain(`- ${col}`);
		}
	});

	it("escapes quotes in folder path", () => {
		const content = buildBaseFileContent('my "special" folder');

		expect(content).toContain('file.inFolder("my \\"special\\" folder")');
	});

	it("handles empty folder path", () => {
		const content = buildBaseFileContent("");

		expect(content).toContain('file.inFolder("")');
	});

	it("ends with newline", () => {
		const content = buildBaseFileContent("output");

		expect(content.endsWith("\n")).toBe(true);
	});
});

// ─────────────────────────────────────────────────────────────
// writeBaseFile
// ─────────────────────────────────────────────────────────────

describe("writeBaseFile", () => {
	it("creates new base file named after folder", async () => {
		const fs = createMockFileSystem();

		const result = await writeBaseFile("output/notes", fs);

		expect(result.action).toBe("created");
		expect(result.path).toBe("output/notes/notes.base");
		expect(fs.createFile).toHaveBeenCalledOnce();
	});

	it("skips existing base file when overwrite is false", async () => {
		const fs = createMockFileSystem({ "output/notes/notes.base": "existing" });

		const result = await writeBaseFile("output/notes", fs, false);

		expect(result.action).toBe("skipped");
		expect(fs.createFile).not.toHaveBeenCalled();
		expect(fs.updateFile).not.toHaveBeenCalled();
	});

	it("updates existing base file when overwrite is true", async () => {
		const fs = createMockFileSystem({ "output/notes/notes.base": "existing" });

		const result = await writeBaseFile("output/notes", fs, true);

		expect(result.action).toBe("updated");
		expect(fs.updateFile).toHaveBeenCalledOnce();
	});

	it("passes createFolders option to createFile", async () => {
		const fs = createMockFileSystem();

		await writeBaseFile("deep/folder", fs);

		expect(fs.createFile).toHaveBeenCalledWith(
			expect.any(String),
			expect.any(String),
			{ createFolders: true },
		);
	});

	it("uses 'index' for empty folder name", async () => {
		const fs = createMockFileSystem();

		const result = await writeBaseFile("", fs);

		expect(result.path).toBe("/index.base");
	});
});
