import { describe, it, expect, vi } from "vitest";
import { listMdFiles, readFrontmatter, listItems, resolveDir, toMdFilename, updateField } from "../../../src/domain/shared/markdown-store.js";
import type { StoreDeps } from "../../../src/domain/shared/markdown-store.js";
import { createMockFs } from "../../mocks/mock-fs.js";

function mockDeps(files: Record<string, string> = {}): StoreDeps {
	const fs = createMockFs(files);
	return {
		disk: fs,
		paths: {
			join: (...parts: string[]) => parts.join("/"),
			dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
			resolve: (...parts: string[]) => parts.join("/"),
			basename: (p: string) => p.split("/").pop() ?? "",
			relative: (from: string, to: string) => to,
			extname: (p: string) => { const m = p.match(/\.[^.]+$/); return m ? m[0] : ""; },
			isAbsolute: (p: string) => p.startsWith("/"),
			sep: "/" as const,
		},
	};
}

describe("markdown-store utilities", () => {
	describe("listMdFiles", () => {
		it("returns empty array when directory does not exist", () => {
			const deps = mockDeps();
			expect(listMdFiles(deps, "/nonexistent")).toEqual([]);
		});

		it("filters only .md files", () => {
			const deps = mockDeps({
				"/dir/a.md": "---\n---",
				"/dir/b.txt": "text",
				"/dir/c.md": "---\n---",
			});
			const result = listMdFiles(deps, "/dir");
			expect(result).toEqual(["a.md", "c.md"]);
		});
	});

	describe("readFrontmatter", () => {
		it("parses YAML frontmatter from a .md file", () => {
			const deps = mockDeps({
				"/dir/test.md": "---\nname: Test Item\nstatus: open\n---\nBody text",
			});
			const fm = readFrontmatter(deps, "/dir", "test.md");
			expect(fm.name).toBe("Test Item");
			expect(fm.status).toBe("open");
		});
	});

	describe("listItems", () => {
		it("lists and parses items with custom parser", () => {
			const deps = mockDeps({
				"/dir/alpha.md": "---\nname: Alpha\nstatus: open\n---",
				"/dir/beta.md": "---\nname: Beta\nstatus: closed\n---",
			});
			const parser = (fm: Record<string, string>, file: string) => ({
				name: fm.name ?? file,
				status: fm.status ?? "unknown",
			});
			const items = listItems(deps, "/dir", parser, (a, b) => a.name.localeCompare(b.name));
			expect(items).toHaveLength(2);
			expect(items[0].name).toBe("Alpha");
			expect(items[1].name).toBe("Beta");
		});

		it("returns empty array for missing directory", () => {
			const deps = mockDeps();
			const items = listItems(deps, "/missing", (fm) => fm);
			expect(items).toEqual([]);
		});
	});

	describe("resolveDir", () => {
		it("uses config dir when provided", () => {
			const deps = mockDeps();
			expect(resolveDir(deps, "/project", "custom/dir", "docs/default")).toBe("/project/custom/dir");
		});

		it("uses default dir when config dir is undefined", () => {
			const deps = mockDeps();
			expect(resolveDir(deps, "/project", undefined, "docs/default")).toBe("/project/docs/default");
		});
	});

	describe("toMdFilename", () => {
		it("converts name to kebab-case .md filename", () => {
			expect(toMdFilename("My Item Name")).toBe("my-item-name.md");
		});

		it("handles already-kebab names", () => {
			expect(toMdFilename("already-kebab")).toBe("already-kebab.md");
		});
	});

	describe("updateField", () => {
		it("updates a frontmatter field value", () => {
			const deps = mockDeps({
				"/file.md": "---\nstatus: open\nname: Test\n---\nBody",
			});
			const result = updateField(deps, "/file.md", "status", "closed");
			expect(result).toBe(true);
			const content = deps.disk.readFileSync("/file.md", "utf-8");
			expect(content).toContain("status: closed");
			expect(content).toContain("name: Test");
		});

		it("returns false for non-existent file", () => {
			const deps = mockDeps();
			expect(updateField(deps, "/missing.md", "status", "closed")).toBe(false);
		});
	});
});
