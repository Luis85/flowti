import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";
import { createMockShell } from "../../mocks/mock-shell.js";
import type { IPaths } from "../../../src/infrastructure/types.js";

vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
}));

import {
	isCliAvailable,
	isVaultInitialized,
	listFolder,
	readMarkdownFile,
	searchVault,
	resetCliAvailableCache,
} from "../../../src/domain/knowledgebase/vault-service.js";

const mockPaths: IPaths = {
	join: (...args: string[]) => args.join("/"),
	resolve: (...args: string[]) => args.join("/"),
	dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
	basename: (p: string) => p.split("/").pop() ?? "",
	relative: (from: string, to: string) => to,
	extname: (p: string) => { const i = p.lastIndexOf("."); return i >= 0 ? p.slice(i) : ""; },
	isAbsolute: (p: string) => p.startsWith("/"),
	sep: "/",
};

// ── isCliAvailable (uses module-level cache — needs resetCliAvailableCache) ────

describe("isCliAvailable", () => {
	beforeEach(() => {
		resetCliAvailableCache();
	});

	it("returns true when obsidian version succeeds", () => {
		const sh = createMockShell({ outputs: { "obsidian version": "1.12.0" } });
		expect(isCliAvailable({ shell: sh })).toBe(true);
		expect(sh.calls.some(c => c.cmd === "obsidian version")).toBe(true);
	});

	it("returns false when obsidian is not found", () => {
		const sh = createMockShell();
		expect(isCliAvailable({ shell: sh })).toBe(false);
	});

	it("caches the result on subsequent calls", () => {
		const sh = createMockShell({ outputs: { "obsidian version": "1.12.0" } });
		isCliAvailable({ shell: sh });
		isCliAvailable({ shell: sh });
		const execCalls = sh.calls.filter(c => c.method === "execFile");
		expect(execCalls).toHaveLength(1);
	});
});

// ── isVaultInitialized ───────────────────────────────────────────────

describe("isVaultInitialized", () => {
	it("returns true when .obsidian folder exists", () => {
		const disk = createMockFs({ "/vault/.obsidian/placeholder": "" });
		expect(isVaultInitialized("/vault", { disk, paths: mockPaths })).toBe(true);
	});

	it("returns false when .obsidian folder is missing", () => {
		const disk = createMockFs();
		expect(isVaultInitialized("/vault", { disk, paths: mockPaths })).toBe(false);
	});
});

// ── listFolder ───────────────────────────────────────────────────────

describe("listFolder", () => {
	it("returns empty array for non-existent folder", () => {
		const disk = createMockFs();
		expect(listFolder("missing/path", "/vault", { disk, paths: mockPaths })).toEqual([]);
	});

	it("returns sorted entries with directories first then files", () => {
		const disk = createMockFs({
			"/vault/docs/zebra.md": "",
			"/vault/docs/beta.md": "",
		});
		// Override readdirSync to return withFileTypes entries
		disk.readdirSync = ((p: string, opts?: { withFileTypes?: boolean }) => {
			if (opts?.withFileTypes) {
				return [
					{ name: "zebra.md", isDirectory: () => false },
					{ name: "alpha", isDirectory: () => true },
					{ name: "beta.md", isDirectory: () => false },
					{ name: "delta", isDirectory: () => true },
				];
			}
			return [];
		}) as typeof disk.readdirSync;

		const result = listFolder("docs", "/vault", { disk, paths: mockPaths });
		expect(result).toEqual([
			{ name: "alpha", isDir: true },
			{ name: "delta", isDir: true },
			{ name: "beta.md", isDir: false },
			{ name: "zebra.md", isDir: false },
		]);
	});

	it("filters out dotfiles", () => {
		const disk = createMockFs({ "/vault/root/visible.md": "" });
		disk.readdirSync = ((p: string, opts?: { withFileTypes?: boolean }) => {
			if (opts?.withFileTypes) {
				return [
					{ name: ".hidden", isDirectory: () => false },
					{ name: ".git", isDirectory: () => true },
					{ name: "visible.md", isDirectory: () => false },
				];
			}
			return [];
		}) as typeof disk.readdirSync;

		const result = listFolder("root", "/vault", { disk, paths: mockPaths });
		expect(result).toEqual([{ name: "visible.md", isDir: false }]);
	});
});

// ── readMarkdownFile ─────────────────────────────────────────────────

describe("readMarkdownFile", () => {
	it("returns content when file exists", () => {
		const disk = createMockFs({ "/vault/notes/hello.md": "# Title\nBody content" });
		expect(readMarkdownFile("notes/hello.md", "/vault", { disk, paths: mockPaths })).toBe("# Title\nBody content");
	});

	it("returns null when file does not exist", () => {
		const disk = createMockFs();
		expect(readMarkdownFile("missing.md", "/vault", { disk, paths: mockPaths })).toBeNull();
	});
});

// ── searchVault ──────────────────────────────────────────────────────

describe("searchVault", () => {
	it("returns paths from JSON output", () => {
		const sh = createMockShell({
			outputs: { "obsidian search query=keyword format=json": JSON.stringify(["docs/a.md", "docs/b.md"]) },
		});
		const results = searchVault("keyword", { shell: sh });
		expect(results).toEqual(["docs/a.md", "docs/b.md"]);
	});

	it("returns empty array when execFile returns null", () => {
		const sh = createMockShell();
		expect(searchVault("missing", { shell: sh })).toEqual([]);
	});
});
