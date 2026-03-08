import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: { execFile: vi.fn(), runSilent: vi.fn() },
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: { join: (...args: string[]) => args.filter(Boolean).join("/"), sep: "/" },
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(),
		readFileSync: vi.fn(),
		readdirSync: vi.fn(),
	},
}));

vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
}));

import { shell } from "../../../src/infrastructure/shell.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import {
	isVaultInitialized,
	listFolder,
	readMarkdownFile,
	searchVault,
} from "../../../src/domain/knowledgebase/vault-service.js";

const mockExecFile = vi.mocked(shell.execFile);
const mockExistsSync = vi.mocked(disk.existsSync);
const mockReadFileSync = vi.mocked(disk.readFileSync);
const mockReaddirSync = vi.mocked(disk.readdirSync);

describe("isVaultInitialized", () => {
	beforeEach(() => { vi.clearAllMocks(); });

	it("returns true when .obsidian folder exists", () => {
		mockExistsSync.mockReturnValue(true);
		expect(isVaultInitialized()).toBe(true);
		expect(mockExistsSync).toHaveBeenCalledWith("/vault/.obsidian");
	});

	it("returns false when .obsidian folder is missing", () => {
		mockExistsSync.mockReturnValue(false);
		expect(isVaultInitialized()).toBe(false);
	});
});

describe("listFolder", () => {
	beforeEach(() => { vi.clearAllMocks(); });

	it("returns empty array when folder does not exist", () => {
		mockExistsSync.mockReturnValue(false);
		expect(listFolder("missing")).toEqual([]);
	});

	it("lists entries sorted with dirs first, hidden files excluded", () => {
		mockExistsSync.mockReturnValue(true);
		mockReaddirSync.mockReturnValue([
			{ name: ".hidden", isDirectory: () => false },
			{ name: "zebra.md", isDirectory: () => false },
			{ name: "alpha", isDirectory: () => true },
			{ name: "beta.md", isDirectory: () => false },
		] as any);
		const result = listFolder("docs");
		expect(result).toEqual([
			{ name: "alpha", isDir: true },
			{ name: "beta.md", isDir: false },
			{ name: "zebra.md", isDir: false },
		]);
	});

	it("sorts directories alphabetically", () => {
		mockExistsSync.mockReturnValue(true);
		mockReaddirSync.mockReturnValue([
			{ name: "charlie", isDirectory: () => true },
			{ name: "alpha", isDirectory: () => true },
			{ name: "bravo", isDirectory: () => true },
		] as any);
		const result = listFolder("");
		expect(result.map((e) => e.name)).toEqual(["alpha", "bravo", "charlie"]);
	});

	it("sorts files alphabetically after directories", () => {
		mockExistsSync.mockReturnValue(true);
		mockReaddirSync.mockReturnValue([
			{ name: "z.md", isDirectory: () => false },
			{ name: "a-folder", isDirectory: () => true },
			{ name: "a.md", isDirectory: () => false },
		] as any);
		const result = listFolder("");
		expect(result).toEqual([
			{ name: "a-folder", isDir: true },
			{ name: "a.md", isDir: false },
			{ name: "z.md", isDir: false },
		]);
	});
});

describe("readMarkdownFile", () => {
	beforeEach(() => { vi.clearAllMocks(); });

	it("returns file content when file exists", () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue("# Hello\nWorld");
		expect(readMarkdownFile("docs/hello.md")).toBe("# Hello\nWorld");
	});

	it("returns null when file does not exist", () => {
		mockExistsSync.mockReturnValue(false);
		expect(readMarkdownFile("missing.md")).toBeNull();
	});
});

describe("searchVault", () => {
	beforeEach(() => { vi.clearAllMocks(); });

	it("parses JSON string results from obsidian CLI", () => {
		mockExecFile.mockReturnValue(JSON.stringify(["docs/a.md", "docs/b.md"]) as any);
		const results = searchVault("test");
		expect(results).toEqual(["docs/a.md", "docs/b.md"]);
		expect(mockExecFile).toHaveBeenCalledWith("obsidian", ["search", "query=test", "format=json"]);
	});

	it("parses JSON object results with path property", () => {
		mockExecFile.mockReturnValue(JSON.stringify([{ path: "a.md" }, { path: "b.md" }]) as any);
		expect(searchVault("query")).toEqual(["a.md", "b.md"]);
	});

	it("falls back to filesystem search on invalid JSON", () => {
		mockExecFile.mockReturnValue("not json" as any);
		mockReaddirSync.mockReturnValue([]);
		const results = searchVault("test");
		expect(results).toEqual([]);
	});

	it("falls back to filesystem search when CLI returns null", () => {
		mockExecFile.mockReturnValue(null as any);
		mockReaddirSync.mockReturnValue([
			{ name: "match.md", isDirectory: () => false },
		] as any);
		mockReadFileSync.mockReturnValue("contains test keyword");
		const results = searchVault("test");
		expect(results).toEqual(["match.md"]);
	});

	it("filesystem search matches by filename", () => {
		mockExecFile.mockReturnValue(null as any);
		mockReaddirSync.mockReturnValue([
			{ name: "my-test-note.md", isDirectory: () => false },
		] as any);
		const results = searchVault("test");
		expect(results).toEqual(["my-test-note.md"]);
	});

	it("filesystem search recurses into subdirectories", () => {
		mockExecFile.mockReturnValue(null as any);
		mockReaddirSync
			.mockReturnValueOnce([
				{ name: "sub", isDirectory: () => true },
				{ name: "root.md", isDirectory: () => false },
			] as any)
			.mockReturnValueOnce([
				{ name: "nested.md", isDirectory: () => false },
			] as any);
		mockReadFileSync.mockReturnValue("has search term");
		const results = searchVault("search");
		expect(results).toContain("root.md");
		expect(results).toContain("sub/nested.md");
	});

	it("filesystem search skips hidden files and node_modules", () => {
		mockExecFile.mockReturnValue(null as any);
		mockReaddirSync.mockReturnValue([
			{ name: ".hidden", isDirectory: () => true },
			{ name: "node_modules", isDirectory: () => true },
			{ name: "visible.md", isDirectory: () => false },
		] as any);
		mockReadFileSync.mockReturnValue("match");
		const results = searchVault("match");
		expect(results).toEqual(["visible.md"]);
	});
});
