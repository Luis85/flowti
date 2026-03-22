import { describe, it, expect } from "vitest";
import { DEFAULT_IBDE_FOLDERS } from "../../../src/domain/installer/folders";
import { DEFAULT_FOLDER_CONFIG, getTopLevelEntries } from "../../../src/domain/installer/folderConfig";

describe("DEFAULT_IBDE_FOLDERS", () => {
	it("should be a non-empty array", () => {
		expect(DEFAULT_IBDE_FOLDERS.length).toBeGreaterThan(0);
	});

	it("should match the folder count from the config JSON", () => {
		expect(DEFAULT_IBDE_FOLDERS.length).toBe(DEFAULT_FOLDER_CONFIG.folders.length);
	});

	it("should contain every path defined in the config JSON", () => {
		for (const entry of DEFAULT_FOLDER_CONFIG.folders) {
			expect(DEFAULT_IBDE_FOLDERS).toContain(entry.path);
		}
	});

	it("should contain all top-level folders from the config", () => {
		const topLevel = getTopLevelEntries(DEFAULT_FOLDER_CONFIG);
		for (const entry of topLevel) {
			expect(DEFAULT_IBDE_FOLDERS).toContain(entry.path);
		}
	});

	it("should have parent folders before children (ordering)", () => {
		const seen = new Set<string>();
		for (const path of DEFAULT_IBDE_FOLDERS) {
			const slashIndex = path.lastIndexOf("/");
			if (slashIndex !== -1) {
				const topLevel = path.split("/")[0];
				expect(seen.has(topLevel)).toBe(true);
			}
			seen.add(path);
		}
	});

	it("should not have duplicate entries", () => {
		const unique = new Set(DEFAULT_IBDE_FOLDERS);
		expect(unique.size).toBe(DEFAULT_IBDE_FOLDERS.length);
	});
});
