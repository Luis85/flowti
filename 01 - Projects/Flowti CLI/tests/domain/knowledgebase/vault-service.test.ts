import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: { execFile: vi.fn(() => null), runSilent: vi.fn(() => null) },
}));
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), readdirSync: vi.fn(() => []) },
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: { join: (...args: string[]) => args.join("/") },
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
}));

import { shell } from "../../../src/infrastructure/shell.js";
import { disk } from "../../../src/infrastructure/filesystem.js";

const mockExecFile = vi.mocked(shell.execFile);
const mockExistsSync = vi.mocked(disk.existsSync);
const mockReadFileSync = vi.mocked(disk.readFileSync);
const mockReaddirSync = vi.mocked(disk.readdirSync);

// ── isCliAvailable (uses module-level cache — needs resetModules) ────

describe("isCliAvailable", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();
	});

	it("returns true when obsidian version succeeds", async () => {
		mockExecFile.mockReturnValue("1.12.0" as any);
		const { isCliAvailable } = await import("../../../src/domain/knowledgebase/vault-service.js");
		expect(isCliAvailable()).toBe(true);
		expect(mockExecFile).toHaveBeenCalledWith("obsidian", ["version"], { timeout: 3000 });
	});

	it("returns false when obsidian is not found", async () => {
		mockExecFile.mockReturnValue(null as any);
		const { isCliAvailable } = await import("../../../src/domain/knowledgebase/vault-service.js");
		expect(isCliAvailable()).toBe(false);
	});

	it("caches the result on subsequent calls", async () => {
		mockExecFile.mockReturnValue("1.12.0" as any);
		const { isCliAvailable } = await import("../../../src/domain/knowledgebase/vault-service.js");
		isCliAvailable();
		isCliAvailable();
		expect(mockExecFile).toHaveBeenCalledTimes(1);
	});
});

// ── isVaultInitialized ───────────────────────────────────────────────

describe("isVaultInitialized", () => {
	beforeEach(() => { vi.clearAllMocks(); });

	it("returns true when .obsidian folder exists", async () => {
		mockExistsSync.mockReturnValue(true);
		const { isVaultInitialized } = await import("../../../src/domain/knowledgebase/vault-service.js");
		expect(isVaultInitialized()).toBe(true);
		expect(mockExistsSync).toHaveBeenCalledWith("/vault/.obsidian");
	});

	it("returns false when .obsidian folder is missing", async () => {
		mockExistsSync.mockReturnValue(false);
		const { isVaultInitialized } = await import("../../../src/domain/knowledgebase/vault-service.js");
		expect(isVaultInitialized()).toBe(false);
	});
});

// ── listFolder ───────────────────────────────────────────────────────

describe("listFolder", () => {
	beforeEach(() => { vi.clearAllMocks(); });

	it("returns empty array for non-existent folder", async () => {
		mockExistsSync.mockReturnValue(false);
		const { listFolder } = await import("../../../src/domain/knowledgebase/vault-service.js");
		expect(listFolder("missing/path")).toEqual([]);
	});

	it("returns sorted entries with directories first then files", async () => {
		mockExistsSync.mockReturnValue(true);
		mockReaddirSync.mockReturnValue([
			{ name: "zebra.md", isDirectory: () => false },
			{ name: "alpha", isDirectory: () => true },
			{ name: "beta.md", isDirectory: () => false },
			{ name: "delta", isDirectory: () => true },
		] as any);
		const { listFolder } = await import("../../../src/domain/knowledgebase/vault-service.js");
		const result = listFolder("docs");
		expect(result).toEqual([
			{ name: "alpha", isDir: true },
			{ name: "delta", isDir: true },
			{ name: "beta.md", isDir: false },
			{ name: "zebra.md", isDir: false },
		]);
	});

	it("filters out dotfiles", async () => {
		mockExistsSync.mockReturnValue(true);
		mockReaddirSync.mockReturnValue([
			{ name: ".hidden", isDirectory: () => false },
			{ name: ".git", isDirectory: () => true },
			{ name: "visible.md", isDirectory: () => false },
		] as any);
		const { listFolder } = await import("../../../src/domain/knowledgebase/vault-service.js");
		const result = listFolder("root");
		expect(result).toEqual([{ name: "visible.md", isDir: false }]);
	});
});

// ── readMarkdownFile ─────────────────────────────────────────────────

describe("readMarkdownFile", () => {
	beforeEach(() => { vi.clearAllMocks(); });

	it("returns content when file exists", async () => {
		mockExistsSync.mockReturnValue(true);
		mockReadFileSync.mockReturnValue("# Title\nBody content");
		const { readMarkdownFile } = await import("../../../src/domain/knowledgebase/vault-service.js");
		expect(readMarkdownFile("notes/hello.md")).toBe("# Title\nBody content");
	});

	it("returns null when file does not exist", async () => {
		mockExistsSync.mockReturnValue(false);
		const { readMarkdownFile } = await import("../../../src/domain/knowledgebase/vault-service.js");
		expect(readMarkdownFile("missing.md")).toBeNull();
	});
});

// ── searchVault ──────────────────────────────────────────────────────

describe("searchVault", () => {
	beforeEach(() => { vi.clearAllMocks(); });

	it("returns paths from JSON output", async () => {
		mockExecFile.mockReturnValue(JSON.stringify(["docs/a.md", "docs/b.md"]) as any);
		const { searchVault } = await import("../../../src/domain/knowledgebase/vault-service.js");
		const results = searchVault("keyword");
		expect(results).toEqual(["docs/a.md", "docs/b.md"]);
		expect(mockExecFile).toHaveBeenCalledWith("obsidian", ["search", "query=keyword", "format=json"]);
	});

	it("returns empty array when execFile returns null", async () => {
		mockExecFile.mockReturnValue(null as any);
		const { searchVault } = await import("../../../src/domain/knowledgebase/vault-service.js");
		expect(searchVault("missing")).toEqual([]);
	});
});
