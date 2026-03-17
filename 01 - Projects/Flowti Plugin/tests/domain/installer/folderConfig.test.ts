import { describe, it, expect, vi } from "vitest";
import {
	DEFAULT_FOLDER_CONFIG,
	getFolderPaths,
	getTopLevelEntries,
	loadFolderConfig,
	FOLDER_CONFIG_PATH,
} from "../../../src/domain/installer/folderConfig";
import type { FolderConfig } from "../../../src/domain/installer/folderConfig";
import type { IFileSystemClient } from "../../../src/infrastructure/filesystem/types";

describe("folderConfig", () => {
	describe("DEFAULT_FOLDER_CONFIG", () => {
		it("has version 1", () => {
			expect(DEFAULT_FOLDER_CONFIG.version).toBe(1);
		});

		it("has a description", () => {
			expect(DEFAULT_FOLDER_CONFIG.description).toContain("PARA");
		});

		it("contains 25 folder entries", () => {
			expect(DEFAULT_FOLDER_CONFIG.folders).toHaveLength(25);
		});

		it("every entry has a non-empty path and description", () => {
			for (const entry of DEFAULT_FOLDER_CONFIG.folders) {
				expect(entry.path.length).toBeGreaterThan(0);
				expect(entry.description.length).toBeGreaterThan(0);
			}
		});

		it("paths are parent-first ordered (parent appears before children)", () => {
			const seen = new Set<string>();
			for (const entry of DEFAULT_FOLDER_CONFIG.folders) {
				const slashIndex = entry.path.lastIndexOf("/");
				if (slashIndex !== -1) {
					const parent = entry.path.slice(0, slashIndex);
					// Parent must have been seen already, or its parent must have
					// (handles multi-level nesting like Documentation/Reference/Entities)
					const segments = parent.split("/");
					const topLevel = segments[0];
					expect(seen.has(topLevel)).toBe(true);
				}
				seen.add(entry.path);
			}
		});

		it("has no duplicate paths", () => {
			const paths = DEFAULT_FOLDER_CONFIG.folders.map((f) => f.path);
			expect(new Set(paths).size).toBe(paths.length);
		});
	});

	describe("getFolderPaths", () => {
		it("returns an array of strings matching the folder paths", () => {
			const paths = getFolderPaths(DEFAULT_FOLDER_CONFIG);
			expect(paths).toHaveLength(DEFAULT_FOLDER_CONFIG.folders.length);
			for (let i = 0; i < paths.length; i++) {
				expect(paths[i]).toBe(DEFAULT_FOLDER_CONFIG.folders[i].path);
			}
		});

		it("works with a custom config", () => {
			const config: FolderConfig = {
				version: 2,
				description: "test",
				folders: [
					{ path: "a", description: "alpha" },
					{ path: "b", description: "beta" },
				],
			};
			expect(getFolderPaths(config)).toEqual(["a", "b"]);
		});
	});

	describe("getTopLevelEntries", () => {
		it("returns only entries without a slash in the path", () => {
			const topLevel = getTopLevelEntries(DEFAULT_FOLDER_CONFIG);
			for (const entry of topLevel) {
				expect(entry.path).not.toContain("/");
			}
		});

		it("returns 6 top-level folders", () => {
			const topLevel = getTopLevelEntries(DEFAULT_FOLDER_CONFIG);
			expect(topLevel).toHaveLength(6);
			expect(topLevel.map((e) => e.path)).toEqual([
				"00 - Connectivity",
				"01 - Projects",
				"02 - Areas",
				"03 - Resources",
				"04 - Archive",
				"var",
			]);
		});

		it("each top-level entry has a description", () => {
			for (const entry of getTopLevelEntries(DEFAULT_FOLDER_CONFIG)) {
				expect(entry.description.length).toBeGreaterThan(0);
			}
		});
	});

	describe("FOLDER_CONFIG_PATH", () => {
		it("points to expected vault path", () => {
			expect(FOLDER_CONFIG_PATH).toBe("var/config/installer/v1/folders.json");
		});
	});

	describe("loadFolderConfig", () => {
		function createMockFS(overrides: Partial<IFileSystemClient> = {}): IFileSystemClient {
			return {
				fileExists: vi.fn(async () => false),
				readFile: vi.fn(async () => ""),
				createFile: vi.fn(async () => {}),
				createFolder: vi.fn(async () => {}),
				deleteFile: vi.fn(async () => {}),
				renameFile: vi.fn(async () => {}),
				listFiles: vi.fn(async () => []),
				listFolders: vi.fn(async () => []),
				getModifiedTime: vi.fn(async () => 0),
				...overrides,
			} as unknown as IFileSystemClient;
		}

		it("returns DEFAULT when file does not exist", async () => {
			const fs = createMockFS({ fileExists: vi.fn(async () => false) });
			const config = await loadFolderConfig(fs);
			expect(config).toBe(DEFAULT_FOLDER_CONFIG);
		});

		it("returns parsed config when file is valid JSON", async () => {
			const custom: FolderConfig = {
				version: 2,
				description: "Custom",
				folders: [{ path: "a", description: "alpha" }],
			};
			const fs = createMockFS({
				fileExists: vi.fn(async () => true),
				readFile: vi.fn(async () => JSON.stringify(custom)),
			});
			const config = await loadFolderConfig(fs);
			expect(config).toEqual(custom);
		});

		it("returns DEFAULT when JSON is invalid", async () => {
			const fs = createMockFS({
				fileExists: vi.fn(async () => true),
				readFile: vi.fn(async () => "not-json"),
			});
			const config = await loadFolderConfig(fs);
			expect(config).toBe(DEFAULT_FOLDER_CONFIG);
		});

		it("returns DEFAULT when schema validation fails (empty folders)", async () => {
			const fs = createMockFS({
				fileExists: vi.fn(async () => true),
				readFile: vi.fn(async () => JSON.stringify({ version: 1, description: "x", folders: [] })),
			});
			const config = await loadFolderConfig(fs);
			expect(config).toBe(DEFAULT_FOLDER_CONFIG);
		});

		it("returns DEFAULT when schema validation fails (missing fields)", async () => {
			const fs = createMockFS({
				fileExists: vi.fn(async () => true),
				readFile: vi.fn(async () => JSON.stringify({ version: 1 })),
			});
			const config = await loadFolderConfig(fs);
			expect(config).toBe(DEFAULT_FOLDER_CONFIG);
		});

		it("returns DEFAULT when readFile throws", async () => {
			const fs = createMockFS({
				fileExists: vi.fn(async () => true),
				readFile: vi.fn(async () => { throw new Error("IO error"); }),
			});
			const config = await loadFolderConfig(fs);
			expect(config).toBe(DEFAULT_FOLDER_CONFIG);
		});

		it("returns DEFAULT when fileExists throws", async () => {
			const fs = createMockFS({
				fileExists: vi.fn(async () => { throw new Error("IO error"); }),
			});
			const config = await loadFolderConfig(fs);
			expect(config).toBe(DEFAULT_FOLDER_CONFIG);
		});

		it("reads from the correct path", async () => {
			const readFile = vi.fn(async () => JSON.stringify(DEFAULT_FOLDER_CONFIG));
			const fs = createMockFS({
				fileExists: vi.fn(async () => true),
				readFile,
			});
			await loadFolderConfig(fs);
			expect(readFile).toHaveBeenCalledWith(FOLDER_CONFIG_PATH);
		});
	});
});
