import { describe, it, expect, vi } from "vitest";
import { createMockFs } from "../mocks/mock-fs.js";

vi.mock("../../src/infrastructure/config.js", () => ({
	ROOT: "/project",
}));

vi.mock("../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

vi.mock("../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import { writeFile, writeFileAt, countFiles, findLatestReport, parseFrontmatter } from "../../src/infrastructure/fs.js";

describe("writeFile", () => {
	it("delegates to writeFileAt with ROOT as base", () => {
		const fs = createMockFs();
		const result = writeFile("src/hello.ts", "content", fs);
		expect(result).toBe(true);
		expect(fs.files.get("/project/src/hello.ts")).toBe("content");
	});
});

describe("writeFileAt", () => {
	it("creates a new file and returns true", () => {
		const fs = createMockFs();
		const result = writeFileAt("/base", "src/hello.ts", "content", fs);
		expect(result).toBe(true);
		expect(fs.files.get("/base/src/hello.ts")).toBe("content");
	});

	it("skips existing file and returns false", () => {
		const fs = createMockFs({ "/base/src/hello.ts": "old" });
		const result = writeFileAt("/base", "src/hello.ts", "new", fs);
		expect(result).toBe(false);
		expect(fs.files.get("/base/src/hello.ts")).toBe("old");
	});

	it("creates parent directories", () => {
		const fs = createMockFs();
		writeFileAt("/base", "deep/nested/file.ts", "x", fs);
		expect(fs.dirs.has("/base/deep/nested")).toBe(true);
		expect(fs.dirs.has("/base/deep")).toBe(true);
	});
});

describe("countFiles", () => {
	it("counts files with matching extension", () => {
		const fs = createMockFs({
			"/src/a.ts": "",
			"/src/b.ts": "",
			"/src/c.js": "",
		});
		expect(countFiles("/src", ".ts", fs)).toBe(2);
	});

	it("recurses into subdirectories", () => {
		const fs = createMockFs({
			"/src/a.ts": "",
			"/src/sub/b.ts": "",
			"/src/sub/deep/c.ts": "",
		});
		expect(countFiles("/src", ".ts", fs)).toBe(3);
	});

	it("skips node_modules and .git", () => {
		const fs = createMockFs({
			"/src/a.ts": "",
			"/src/node_modules/dep.ts": "",
			"/src/.git/config.ts": "",
		});
		expect(countFiles("/src", ".ts", fs)).toBe(1);
	});

	it("returns 0 for non-existent directory", () => {
		const fs = createMockFs();
		expect(countFiles("/nope", ".ts", fs)).toBe(0);
	});
});

describe("findLatestReport", () => {
	it("returns the latest markdown file (alphabetically last)", () => {
		const fs = createMockFs({
			"/reports/2026-01-01-report.md": "",
			"/reports/2026-03-07-report.md": "",
			"/reports/2026-02-15-report.md": "",
		});
		expect(findLatestReport("/reports", fs)).toContain("2026-03-07-report.md");
	});

	it("ignores hidden files", () => {
		const fs = createMockFs({
			"/reports/.hidden.md": "",
			"/reports/2026-01-01-report.md": "",
		});
		expect(findLatestReport("/reports", fs)).toContain("2026-01-01-report.md");
	});

	it("ignores non-md files", () => {
		const fs = createMockFs({
			"/reports/data.json": "",
			"/reports/2026-01-01-report.md": "",
		});
		expect(findLatestReport("/reports", fs)).toContain("2026-01-01-report.md");
	});

	it("returns null for non-existent directory", () => {
		const fs = createMockFs();
		expect(findLatestReport("/nope", fs)).toBeNull();
	});

	it("returns null for empty directory", () => {
		const fs = createMockFs();
		fs.mkdirSync("/empty");
		expect(findLatestReport("/empty", fs)).toBeNull();
	});
});

describe("parseFrontmatter", () => {
	it("parses YAML frontmatter key-value pairs", () => {
		const fs = createMockFs({
			"/note.md": "---\ntype: Report\nversion: 1\n---\n# Hello",
		});
		const fm = parseFrontmatter("/note.md", fs);
		expect(fm).toEqual({ type: "Report", version: "1" });
	});

	it("strips surrounding quotes from values", () => {
		const fs = createMockFs({
			"/note.md": '---\nname: "Hello World"\n---',
		});
		expect(parseFrontmatter("/note.md", fs).name).toBe("Hello World");
	});

	it("skips comment lines and array items", () => {
		const fs = createMockFs({
			"/note.md": "---\ntags:\n  - foo\n  - bar\n# comment\ntype: Note\n---",
		});
		const fm = parseFrontmatter("/note.md", fs);
		expect(fm.type).toBe("Note");
		expect(fm["# comment"]).toBeUndefined();
		expect(fm["  - foo"]).toBeUndefined();
	});

	it("returns empty object when no frontmatter", () => {
		const fs = createMockFs({
			"/note.md": "# Just a heading\nNo frontmatter here.",
		});
		expect(parseFrontmatter("/note.md", fs)).toEqual({});
	});

	it("returns empty object for missing file", () => {
		const fs = createMockFs();
		expect(parseFrontmatter("/missing.md", fs)).toEqual({});
	});

	it("handles values with colons", () => {
		const fs = createMockFs({
			"/note.md": "---\nurl: https://example.com\n---",
		});
		expect(parseFrontmatter("/note.md", fs).url).toBe("https://example.com");
	});
});
