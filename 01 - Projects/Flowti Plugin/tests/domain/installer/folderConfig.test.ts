import { describe, it, expect } from "vitest";
import {
	DEFAULT_FOLDER_CONFIG,
	getFolderPaths,
	getTopLevelEntries,
} from "../../../src/domain/installer/folderConfig";
import type { FolderConfig } from "../../../src/domain/installer/folderConfig";

describe("folderConfig", () => {
	describe("DEFAULT_FOLDER_CONFIG", () => {
		it("has a numeric version", () => {
			expect(typeof DEFAULT_FOLDER_CONFIG.version).toBe("number");
		});

		it("has a description", () => {
			expect(DEFAULT_FOLDER_CONFIG.description.length).toBeGreaterThan(0);
		});

		it("has at least one folder entry", () => {
			expect(DEFAULT_FOLDER_CONFIG.folders.length).toBeGreaterThan(0);
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

		it("returns at least one top-level folder", () => {
			const topLevel = getTopLevelEntries(DEFAULT_FOLDER_CONFIG);
			expect(topLevel.length).toBeGreaterThan(0);
		});

		it("each top-level entry has a description", () => {
			for (const entry of getTopLevelEntries(DEFAULT_FOLDER_CONFIG)) {
				expect(entry.description.length).toBeGreaterThan(0);
			}
		});
	});
});
