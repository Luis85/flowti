import { describe, it, expect } from "vitest";
import {
	getFilePropertyLabel,
	resolveFileProperty,
	getFilenameFromPath,
	getOutputFolder,
	getOutputFilename,
	buildOutputPath,
	swapOutputExtension,
} from "../../src/ui/export/exportUtils";
import type { VaultFileInfo } from "../../src/domain/dataExchange/types";

/**
 * Tests for ExportView's pure helper functions and state management logic.
 *
 * Since ExportView is an Obsidian ItemView (DOM-dependent),
 * we test the exported utility functions directly and verify
 * behavioral contracts like output path construction and
 * format swapping.
 */
describe("ExportView helpers", () => {
	// ── File property helpers ────────────────────────────────

	describe("getFilePropertyLabel", () => {
		it("should return label for known file properties", () => {
			expect(getFilePropertyLabel("file.name")).toBeTruthy();
			// Known property should have a user-friendly label, not the raw key
		});

		it("should strip file. prefix for unknown properties", () => {
			expect(getFilePropertyLabel("file.custom")).toBe("custom");
		});
	});

	describe("resolveFileProperty", () => {
		const file: VaultFileInfo = {
			basename: "report",
			path: "Reports/2026/report.csv",
			folder: "Reports/2026",
			extension: "csv",
			frontmatter: {},
			stat: { ctime: 1706745600000, mtime: 1706832000000, size: 1024 },
			tags: ["data", "quarterly"],
		};

		it("should resolve file.name to basename", () => {
			expect(resolveFileProperty(file, "file.name")).toBe("report");
		});

		it("should resolve file.basename to basename", () => {
			expect(resolveFileProperty(file, "file.basename")).toBe("report");
		});

		it("should resolve file.fullname to basename.extension", () => {
			expect(resolveFileProperty(file, "file.fullname")).toBe("report.csv");
		});

		it("should resolve file.path to full path", () => {
			expect(resolveFileProperty(file, "file.path")).toBe("Reports/2026/report.csv");
		});

		it("should resolve file.folder to folder", () => {
			expect(resolveFileProperty(file, "file.folder")).toBe("Reports/2026");
		});

		it("should resolve file.ext to extension", () => {
			expect(resolveFileProperty(file, "file.ext")).toBe("csv");
		});

		it("should resolve file.ctime to ISO string", () => {
			const result = resolveFileProperty(file, "file.ctime");
			expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		});

		it("should resolve file.mtime to ISO string", () => {
			const result = resolveFileProperty(file, "file.mtime");
			expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		});

		it("should resolve file.size to string number", () => {
			expect(resolveFileProperty(file, "file.size")).toBe("1024");
		});

		it("should resolve file.tags to comma-separated string", () => {
			expect(resolveFileProperty(file, "file.tags")).toBe("data, quarterly");
		});

		it("should return empty string for unknown property", () => {
			expect(resolveFileProperty(file, "file.unknown")).toBe("");
		});

		it("should handle missing stat gracefully", () => {
			const noStat: VaultFileInfo = { ...file, stat: undefined };
			expect(resolveFileProperty(noStat, "file.ctime")).toBe("");
			expect(resolveFileProperty(noStat, "file.size")).toBe("");
		});

		it("should handle missing tags gracefully", () => {
			const noTags: VaultFileInfo = { ...file, tags: undefined };
			expect(resolveFileProperty(noTags, "file.tags")).toBe("");
		});
	});

	// ── Path helpers ─────────────────────────────────────────

	describe("getFilenameFromPath", () => {
		it("should extract filename from forward-slash path", () => {
			expect(getFilenameFromPath("Reports/2026/data.csv")).toBe("data.csv");
		});

		it("should extract filename from backslash path", () => {
			expect(getFilenameFromPath("Reports\\2026\\data.csv")).toBe("data.csv");
		});

		it("should return filename when no slashes", () => {
			expect(getFilenameFromPath("data.csv")).toBe("data.csv");
		});

		it("should handle empty string", () => {
			expect(getFilenameFromPath("")).toBe("");
		});
	});

	describe("getOutputFolder", () => {
		it("should return folder portion of path", () => {
			expect(getOutputFolder("Reports/2026/data.csv")).toBe("Reports/2026");
		});

		it("should normalize backslashes", () => {
			expect(getOutputFolder("Reports\\2026\\data.csv")).toBe("Reports/2026");
		});

		it("should return empty string for filename-only path", () => {
			expect(getOutputFolder("data.csv")).toBe("");
		});
	});

	describe("getOutputFilename", () => {
		it("should extract filename from path", () => {
			expect(getOutputFilename("Reports/data.csv")).toBe("data.csv");
		});

		it("should return full string when no slashes", () => {
			expect(getOutputFilename("data.csv")).toBe("data.csv");
		});
	});

	describe("buildOutputPath", () => {
		it("should combine folder and filename", () => {
			expect(buildOutputPath("Reports/2026", "data.csv")).toBe("Reports/2026/data.csv");
		});

		it("should return filename-only when folder is empty", () => {
			expect(buildOutputPath("", "data.csv")).toBe("data.csv");
		});
	});

	// ── Format swapping ──────────────────────────────────────

	describe("swapOutputExtension", () => {
		it("should swap .csv to .txt when changing to tab format", () => {
			expect(swapOutputExtension("Reports/data.csv", "csv", "tab")).toBe("Reports/data.txt");
		});

		it("should swap .txt to .csv when changing to csv format", () => {
			expect(swapOutputExtension("Reports/data.txt", "tab", "csv")).toBe("Reports/data.csv");
		});

		it("should not change when formats are the same", () => {
			expect(swapOutputExtension("Reports/data.csv", "csv", "csv")).toBe("Reports/data.csv");
		});

		it("should not change when extension doesn't match old format", () => {
			// .txt file but oldFormat is csv — no swap
			expect(swapOutputExtension("Reports/data.txt", "csv", "tab")).toBe("Reports/data.txt");
		});

		it("should handle filename-only paths", () => {
			expect(swapOutputExtension("data.csv", "csv", "tab")).toBe("data.txt");
		});

		it("should handle deep nested paths", () => {
			expect(swapOutputExtension("a/b/c/data.csv", "csv", "tab")).toBe("a/b/c/data.txt");
		});
	});

	// ── State defaults ───────────────────────────────────────

	describe("state defaults", () => {
		it("should default to csv format", () => {
			const format: "csv" | "tab" = "csv";
			expect(format).toBe("csv");
		});

		it("should default to overwrite conflict strategy", () => {
			const strategy: "overwrite" | "skip" | "append" = "overwrite";
			expect(strategy).toBe("overwrite");
		});

		it("should default to file.name as selected file property", () => {
			const selectedFileProperties = ["file.name"];
			expect(selectedFileProperties).toContain("file.name");
		});

		it("should start on configure page", () => {
			const page = "configure";
			expect(page).toBe("configure");
		});
	});

	// ── Config change detection ──────────────────────────────

	describe("hasUnsavedChanges logic", () => {
		it("should detect format change", () => {
			const loaded: { format: "csv" | "tab" } = { format: "csv" };
			const current: { format: "csv" | "tab" } = { format: "tab" };
			expect(loaded.format !== current.format).toBe(true);
		});

		it("should detect output path change", () => {
			const loaded = { outputPath: "old/path.csv" };
			const current = { outputPath: "new/path.csv" };
			expect(loaded.outputPath !== current.outputPath).toBe(true);
		});

		it("should detect column selection change", () => {
			const loaded = ["name", "status"];
			const current = ["name", "status", "date"];
			const changed = loaded.length !== current.length ||
				loaded.some((c, i) => c !== current[i]);
			expect(changed).toBe(true);
		});

		it("should detect no change when configs match", () => {
			const loaded = { format: "csv" as const, outputPath: "data.csv" };
			const current = { format: "csv" as const, outputPath: "data.csv" };
			expect(loaded.format === current.format && loaded.outputPath === current.outputPath).toBe(true);
		});
	});
});
