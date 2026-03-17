import { describe, it, expect, vi, beforeEach } from "vitest";
import "../../mocks/obsidian-stub";
import { BaseAnalyticsAdapter, type ScanColumnsCallback, type ResolveFilesCallback } from "../../../src/domain/analytics/BaseAnalyticsAdapter";
import type { ResolvedColumn, VaultFileInfo } from "../../../src/domain/dataExchange/types";

// ── Test helpers ──────────────────────────────────────────────

function makeColumn(key: string, header: string, source: "file" | "frontmatter" | "formula", resolveKey: string, resolveSource?: "file" | "frontmatter"): ResolvedColumn {
	return { key, header, source, resolveKey, resolveSource };
}

function makeFile(path: string, frontmatter?: Record<string, unknown>, stat?: { ctime: number; mtime: number; size: number }, tags?: string[]): VaultFileInfo {
	const parts = path.split("/");
	const filename = parts[parts.length - 1];
	const dotIdx = filename.lastIndexOf(".");
	const basename = dotIdx > 0 ? filename.slice(0, dotIdx) : filename;
	const extension = dotIdx > 0 ? filename.slice(dotIdx + 1) : "";
	const folder = parts.slice(0, -1).join("/");
	return { path, basename, extension, folder, frontmatter, stat, tags };
}

describe("BaseAnalyticsAdapter", () => {
	let scanColumns: ReturnType<typeof vi.fn<ScanColumnsCallback>>;
	let resolveFiles: ReturnType<typeof vi.fn<ResolveFilesCallback>>;
	let adapter: BaseAnalyticsAdapter;

	beforeEach(() => {
		scanColumns = vi.fn<ScanColumnsCallback>();
		resolveFiles = vi.fn<ResolveFilesCallback>();
		adapter = new BaseAnalyticsAdapter({ scanColumns, resolveFiles });
	});

	// ── Resolution ─────────────────────────────────────────

	describe("resolve()", () => {
		it("should produce correct headers and rows from frontmatter columns", async () => {
			scanColumns.mockResolvedValue([
				makeColumn("note.stage", "stage", "frontmatter", "stage"),
				makeColumn("note.domain", "domain", "frontmatter", "domain"),
			]);
			resolveFiles.mockResolvedValue([
				makeFile("docs/a.md", { stage: "active", domain: "session" }),
				makeFile("docs/b.md", { stage: "planned", domain: "inbox" }),
			]);

			const result = await adapter.resolve("items.base", 0);

			expect(result.headers).toEqual(["stage", "domain"]);
			expect(result.rows).toEqual([
				["active", "session"],
				["planned", "inbox"],
			]);
			expect(scanColumns).toHaveBeenCalledWith("items.base", 0);
			expect(resolveFiles).toHaveBeenCalledWith("items.base", "base", 0);
		});

		it("should resolve file properties", async () => {
			scanColumns.mockResolvedValue([
				makeColumn("file.name", "name", "file", "file.name"),
				makeColumn("file.path", "path", "file", "file.path"),
				makeColumn("file.folder", "folder", "file", "file.folder"),
				makeColumn("file.ext", "ext", "file", "file.ext"),
			]);
			resolveFiles.mockResolvedValue([
				makeFile("src/main.ts"),
			]);

			const result = await adapter.resolve("code.base", 0);

			expect(result.headers).toEqual(["name", "path", "folder", "ext"]);
			expect(result.rows).toEqual([["main", "src/main.ts", "src", "ts"]]);
		});

		it("should resolve file.fullname property", async () => {
			scanColumns.mockResolvedValue([
				makeColumn("file.fullname", "fullname", "file", "file.fullname"),
			]);
			resolveFiles.mockResolvedValue([makeFile("docs/readme.md")]);

			const result = await adapter.resolve("x.base", 0);
			expect(result.rows[0][0]).toBe("readme.md");
		});

		it("should resolve file.basename as same as file.name", async () => {
			scanColumns.mockResolvedValue([
				makeColumn("file.basename", "basename", "file", "file.basename"),
			]);
			resolveFiles.mockResolvedValue([makeFile("docs/readme.md")]);

			const result = await adapter.resolve("x.base", 0);
			expect(result.rows[0][0]).toBe("readme");
		});

		it("should resolve file stat properties (ctime, mtime, size)", async () => {
			scanColumns.mockResolvedValue([
				makeColumn("file.ctime", "created", "file", "file.ctime"),
				makeColumn("file.mtime", "modified", "file", "file.mtime"),
				makeColumn("file.size", "size", "file", "file.size"),
			]);
			resolveFiles.mockResolvedValue([
				makeFile("a.md", undefined, { ctime: 1700000000000, mtime: 1700001000000, size: 256 }),
			]);

			const result = await adapter.resolve("x.base", 0);
			expect(result.rows[0][0]).toBe(new Date(1700000000000).toISOString());
			expect(result.rows[0][1]).toBe(new Date(1700001000000).toISOString());
			expect(result.rows[0][2]).toBe("256");
		});

		it("should resolve file.tags as comma-separated", async () => {
			scanColumns.mockResolvedValue([
				makeColumn("file.tags", "tags", "file", "file.tags"),
			]);
			resolveFiles.mockResolvedValue([
				makeFile("a.md", undefined, undefined, ["foo", "bar"]),
			]);

			const result = await adapter.resolve("x.base", 0);
			expect(result.rows[0][0]).toBe("foo, bar");
		});

		it("should return empty string for missing stat on file properties", async () => {
			scanColumns.mockResolvedValue([
				makeColumn("file.ctime", "created", "file", "file.ctime"),
				makeColumn("file.size", "size", "file", "file.size"),
			]);
			resolveFiles.mockResolvedValue([makeFile("a.md")]);

			const result = await adapter.resolve("x.base", 0);
			expect(result.rows[0]).toEqual(["", ""]);
		});

		it("should resolve formula columns targeting file properties", async () => {
			scanColumns.mockResolvedValue([
				makeColumn("formula.Name", "Name", "formula", "file.name", "file"),
			]);
			resolveFiles.mockResolvedValue([makeFile("docs/report.md")]);

			const result = await adapter.resolve("x.base", 0);
			expect(result.rows[0][0]).toBe("report");
		});

		it("should resolve formula columns targeting frontmatter", async () => {
			scanColumns.mockResolvedValue([
				makeColumn("formula.Total", "Total", "formula", "price"),
			]);
			resolveFiles.mockResolvedValue([
				makeFile("items/a.md", { price: 42.5 }),
			]);

			const result = await adapter.resolve("x.base", 0);
			expect(result.rows[0][0]).toBe("42.5");
		});

		it("should return empty string for missing frontmatter values", async () => {
			scanColumns.mockResolvedValue([
				makeColumn("note.missing", "missing", "frontmatter", "missing"),
			]);
			resolveFiles.mockResolvedValue([
				makeFile("a.md", { other: "value" }),
			]);

			const result = await adapter.resolve("x.base", 0);
			expect(result.rows[0][0]).toBe("");
		});

		it("should return empty string when frontmatter is undefined", async () => {
			scanColumns.mockResolvedValue([
				makeColumn("note.stage", "stage", "frontmatter", "stage"),
			]);
			resolveFiles.mockResolvedValue([makeFile("a.md")]);

			const result = await adapter.resolve("x.base", 0);
			expect(result.rows[0][0]).toBe("");
		});

		it("should handle null frontmatter values", async () => {
			scanColumns.mockResolvedValue([
				makeColumn("note.val", "val", "frontmatter", "val"),
			]);
			resolveFiles.mockResolvedValue([
				makeFile("a.md", { val: null }),
			]);

			const result = await adapter.resolve("x.base", 0);
			expect(result.rows[0][0]).toBe("");
		});

		it("should pass correct viewIndex to callbacks", async () => {
			scanColumns.mockResolvedValue([
				makeColumn("note.x", "x", "frontmatter", "x"),
			]);
			resolveFiles.mockResolvedValue([]);

			await adapter.resolve("test.base", 3);

			expect(scanColumns).toHaveBeenCalledWith("test.base", 3);
			expect(resolveFiles).toHaveBeenCalledWith("test.base", "base", 3);
		});

		it("should handle empty file list", async () => {
			scanColumns.mockResolvedValue([
				makeColumn("note.stage", "stage", "frontmatter", "stage"),
			]);
			resolveFiles.mockResolvedValue([]);

			const result = await adapter.resolve("empty.base", 0);
			expect(result.headers).toEqual(["stage"]);
			expect(result.rows).toEqual([]);
		});

		it("should handle mixed column types in correct order", async () => {
			scanColumns.mockResolvedValue([
				makeColumn("file.name", "name", "file", "file.name"),
				makeColumn("note.domain", "domain", "frontmatter", "domain"),
				makeColumn("formula.Count", "Count", "formula", "count"),
			]);
			resolveFiles.mockResolvedValue([
				makeFile("items/widget.md", { domain: "shop", count: 7 }),
			]);

			const result = await adapter.resolve("x.base", 0);
			expect(result.headers).toEqual(["name", "domain", "Count"]);
			expect(result.rows).toEqual([["widget", "shop", "7"]]);
		});
	});

	// ── Error handling ─────────────────────────────────────

	describe("error handling", () => {
		it("should throw when view has no columns", async () => {
			scanColumns.mockResolvedValue(null);

			await expect(adapter.resolve("x.base", 0))
				.rejects.toThrow("Base view at index 0 has no columns defined");
		});

		it("should throw when columns array is empty", async () => {
			scanColumns.mockResolvedValue([]);

			await expect(adapter.resolve("x.base", 1))
				.rejects.toThrow("Base view at index 1 has no columns defined");
		});
	});

	// ── Backward compat ────────────────────────────────────

	describe("backward compatibility", () => {
		it("should work when files have no tags property", async () => {
			scanColumns.mockResolvedValue([
				makeColumn("file.tags", "tags", "file", "file.tags"),
			]);
			resolveFiles.mockResolvedValue([
				makeFile("a.md", { stage: "active" }),
			]);

			const result = await adapter.resolve("x.base", 0);
			expect(result.rows[0][0]).toBe("");
		});

		it("should coerce non-string frontmatter to string", async () => {
			scanColumns.mockResolvedValue([
				makeColumn("note.count", "count", "frontmatter", "count"),
				makeColumn("note.active", "active", "frontmatter", "active"),
			]);
			resolveFiles.mockResolvedValue([
				makeFile("a.md", { count: 42, active: true }),
			]);

			const result = await adapter.resolve("x.base", 0);
			expect(result.rows[0]).toEqual(["42", "true"]);
		});
	});
});
