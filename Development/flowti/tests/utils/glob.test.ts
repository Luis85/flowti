import { describe, it, expect } from "vitest";
import { matchGlob } from "../../src/utils/glob";

describe("matchGlob", () => {
	describe("exact match", () => {
		it("should match an exact string", () => {
			expect(matchGlob("foo.md", "foo.md")).toBe(true);
		});

		it("should not match different strings", () => {
			expect(matchGlob("foo.md", "bar.md")).toBe(false);
		});
	});

	describe("single star (*)", () => {
		it("should match any characters within a segment", () => {
			expect(matchGlob("*.md", "report.md")).toBe(true);
			expect(matchGlob("*.csv", "data.csv")).toBe(true);
		});

		it("should not match across path separators", () => {
			expect(matchGlob("*.md", "folder/report.md")).toBe(false);
		});

		it("should match with prefix", () => {
			expect(matchGlob("report-*.csv", "report-2026.csv")).toBe(true);
			expect(matchGlob("report-*.csv", "other-2026.csv")).toBe(false);
		});
	});

	describe("double star (**)", () => {
		it("should match across path separators", () => {
			expect(matchGlob("**/*.md", "docs/report.md")).toBe(true);
			expect(matchGlob("**/*.md", "a/b/c/report.md")).toBe(true);
		});

		it("should match deeply nested paths", () => {
			expect(matchGlob("Reports/**", "Reports/daily/2026/jan.csv")).toBe(true);
		});

		it("should match at the root level too", () => {
			expect(matchGlob("**/*.md", "report.md")).toBe(true);
		});
	});

	describe("question mark (?)", () => {
		it("should match a single character", () => {
			expect(matchGlob("file?.md", "file1.md")).toBe(true);
			expect(matchGlob("file?.md", "fileA.md")).toBe(true);
		});

		it("should not match zero or multiple characters", () => {
			expect(matchGlob("file?.md", "file.md")).toBe(false);
			expect(matchGlob("file?.md", "file12.md")).toBe(false);
		});
	});

	describe("regex special characters", () => {
		it("should handle dots in patterns", () => {
			expect(matchGlob("file.md", "file.md")).toBe(true);
			expect(matchGlob("file.md", "fileXmd")).toBe(false);
		});

		it("should handle parentheses", () => {
			expect(matchGlob("file(1).md", "file(1).md")).toBe(true);
		});

		it("should handle brackets", () => {
			expect(matchGlob("file[1].md", "file[1].md")).toBe(true);
		});
	});

	describe("path patterns", () => {
		it("should match a specific folder prefix", () => {
			expect(matchGlob("Reports/**/*.csv", "Reports/daily/jan.csv")).toBe(true);
			expect(matchGlob("Reports/**/*.csv", "Other/jan.csv")).toBe(false);
		});

		it("should match empty path segments with **", () => {
			expect(matchGlob("**/test.md", "test.md")).toBe(true);
			expect(matchGlob("**/test.md", "a/test.md")).toBe(true);
			expect(matchGlob("**/test.md", "a/b/test.md")).toBe(true);
		});
	});
});
