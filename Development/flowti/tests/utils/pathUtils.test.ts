import { describe, it, expect } from "vitest";
import {
	normalizeSeparators,
	basename,
	dirname,
	stripExtension,
} from "../../src/utils/pathUtils";

describe("normalizeSeparators", () => {
	it("replaces backslashes with forward slashes", () => {
		expect(normalizeSeparators("foo\\bar\\baz.md")).toBe("foo/bar/baz.md");
	});
	it("leaves forward slashes unchanged", () => {
		expect(normalizeSeparators("foo/bar/baz.md")).toBe("foo/bar/baz.md");
	});
	it("handles empty string", () => {
		expect(normalizeSeparators("")).toBe("");
	});
});

describe("basename", () => {
	it("returns the filename from a path", () => {
		expect(basename("folder/sub/file.md")).toBe("file.md");
	});
	it("returns the filename for a root-level file", () => {
		expect(basename("file.md")).toBe("file.md");
	});
	it("handles backslash paths", () => {
		expect(basename("folder\\sub\\file.md")).toBe("file.md");
	});
	it("returns empty string for empty input", () => {
		expect(basename("")).toBe("");
	});
	it("handles trailing slash", () => {
		expect(basename("folder/sub/")).toBe("");
	});
});

describe("dirname", () => {
	it("returns the parent directory", () => {
		expect(dirname("folder/sub/file.md")).toBe("folder/sub");
	});
	it("returns empty string for root-level files", () => {
		expect(dirname("file.md")).toBe("");
	});
	it("handles backslash paths", () => {
		expect(dirname("folder\\sub\\file.md")).toBe("folder/sub");
	});
	it("handles nested paths", () => {
		expect(dirname("a/b/c/d.txt")).toBe("a/b/c");
	});
});

describe("stripExtension", () => {
	it("strips .md extension", () => {
		expect(stripExtension("file.md", ".md")).toBe("file");
	});
	it("strips any extension when no specific ext provided", () => {
		expect(stripExtension("file.txt")).toBe("file");
	});
	it("only strips specified extension", () => {
		expect(stripExtension("file.txt", ".md")).toBe("file.txt");
	});
	it("handles files with multiple dots", () => {
		expect(stripExtension("my.file.name.md", ".md")).toBe("my.file.name");
	});
	it("handles files with no extension", () => {
		expect(stripExtension("README")).toBe("README");
	});
	it("handles hidden files (dot prefix)", () => {
		expect(stripExtension(".gitignore")).toBe(".gitignore");
	});
	it("strips generic extension from dotted filename", () => {
		expect(stripExtension("archive.tar.gz")).toBe("archive.tar");
	});
});
