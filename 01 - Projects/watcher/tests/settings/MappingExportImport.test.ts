import { describe, it, expect } from "vitest";
import {
	serializeMappings,
	deserializeMappings,
	prepareMappingsForImport,
} from "../../src/services/MappingExportService";
import { type FolderMapping, createDefaultMapping } from "../../src/types";

/**
 * Integration-style tests for the export/import flow.
 * Simulates the full data flow without Obsidian/DOM dependencies.
 */

function makeMapping(overrides: Partial<FolderMapping> = {}): FolderMapping {
	return createDefaultMapping({
		sourceFolder: "C:\\Users\\Test\\Docs",
		targetFolder: "imported/test",
		description: "Test",
		...overrides,
	});
}

describe("Mapping Export/Import Integration", () => {
	describe("Export flow", () => {
		it("should serialize and deserialize producing equivalent mappings", () => {
			const originals = [
				makeMapping({
					targetFolder: "imported/notes",
					description: "Notes",
					fileExtensions: [".md"],
					syncDirection: "source-only",
				}),
				makeMapping({
					targetFolder: "imported/photos",
					description: "Photos",
					fileExtensions: [".jpg", ".png"],
					syncDirection: "bidirectional",
				}),
			];

			// Simulate export: serialize to JSON string
			const json = serializeMappings(originals, "1.2.3");

			// Simulate import: parse JSON string
			const { mappings, errors } = deserializeMappings(json);

			expect(errors).toEqual([]);
			expect(mappings).toHaveLength(2);

			// Verify exported mappings have sourceFolder cleared and are disabled
			for (const m of mappings) {
				expect(m.sourceFolder).toBe("");
				expect(m.enabled).toBe(false);
			}

			// Verify mapping-specific data is preserved
			expect(mappings[0].targetFolder).toBe("imported/notes");
			expect(mappings[0].description).toBe("Notes");
			expect(mappings[0].fileExtensions).toEqual([".md"]);
			expect(mappings[1].targetFolder).toBe("imported/photos");
			expect(mappings[1].fileExtensions).toEqual([".jpg", ".png"]);
			expect(mappings[1].syncDirection).toBe("bidirectional");
		});
	});

	describe("Import flow", () => {
		it("should add imported mappings to existing ones with new IDs", () => {
			const existing = [
				makeMapping({ id: "existing-1", targetFolder: "existing/folder" }),
			];

			const json = serializeMappings(
				[makeMapping({ targetFolder: "new/folder", description: "Imported" })],
				"1.0.0"
			);

			const { mappings: parsed } = deserializeMappings(json);
			const { mappings: ready } = prepareMappingsForImport(parsed, existing);

			expect(ready).toHaveLength(1);
			expect(ready[0].targetFolder).toBe("new/folder");
			expect(ready[0].description).toBe("Imported");
			expect(ready[0].enabled).toBe(false);
			expect(ready[0].id).not.toBe("existing-1");

			// Simulate merging into settings
			const allMappings = [...existing, ...ready];
			expect(allMappings).toHaveLength(2);
		});

		it("should skip imported mappings that overlap with existing targets", () => {
			const existing = [
				makeMapping({ targetFolder: "imported/docs" }),
			];

			const json = serializeMappings(
				[
					makeMapping({ targetFolder: "imported/docs", description: "Overlap" }),
					makeMapping({ targetFolder: "imported/photos", description: "OK" }),
				],
				"1.0.0"
			);

			const { mappings: parsed } = deserializeMappings(json);
			const { mappings: ready, warnings } = prepareMappingsForImport(
				parsed,
				existing
			);

			expect(ready).toHaveLength(1);
			expect(ready[0].description).toBe("OK");
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain("Overlap");
		});

		it("should handle importing empty file gracefully", () => {
			const json = serializeMappings([], "1.0.0");
			const { mappings, errors } = deserializeMappings(json);

			expect(errors).toEqual([]);
			expect(mappings).toEqual([]);
		});

		it("should handle malformed import file", () => {
			const { mappings, errors } = deserializeMappings("garbage data!!!");

			expect(mappings).toEqual([]);
			expect(errors.length).toBeGreaterThan(0);
		});

		it("should handle import file with wrong version", () => {
			const { mappings, errors } = deserializeMappings(
				JSON.stringify({ version: 42, mappings: [] })
			);

			expect(mappings).toEqual([]);
			expect(errors[0]).toContain("Unsupported version");
		});
	});

	describe("Full round-trip scenario", () => {
		it("should support exporting from one vault and importing into another", () => {
			// Vault A: User has configured mappings
			const vaultAMappings = [
				makeMapping({
					sourceFolder: "C:\\Users\\Alice\\OneDrive\\Notes",
					targetFolder: "synced/notes",
					description: "OneDrive Notes",
					enabled: true,
					fileExtensions: [".md"],
					conflictResolution: "keepNewer",
					syncDirection: "source-only",
					excludePatterns: ["drafts/*"],
				}),
				makeMapping({
					sourceFolder: "D:\\Shared\\Team",
					targetFolder: "synced/team",
					description: "Team Files",
					enabled: true,
					syncDirection: "bidirectional",
				}),
			];

			// User A exports
			const exportedJson = serializeMappings(vaultAMappings, "1.0.0");

			// User B imports into their vault (which already has some mappings)
			const vaultBExisting = [
				makeMapping({
					targetFolder: "my-stuff",
					description: "My Local Stuff",
				}),
			];

			const { mappings: parsed, errors } = deserializeMappings(exportedJson);
			expect(errors).toEqual([]);

			const { mappings: ready, warnings } = prepareMappingsForImport(
				parsed,
				vaultBExisting
			);
			expect(warnings).toEqual([]);
			expect(ready).toHaveLength(2);

			// All imported mappings should be disabled and have empty sourceFolder
			for (const m of ready) {
				expect(m.enabled).toBe(false);
				expect(m.sourceFolder).toBe("");
			}

			// Target folders and descriptions should be preserved
			expect(ready[0].targetFolder).toBe("synced/notes");
			expect(ready[0].description).toBe("OneDrive Notes");
			expect(ready[0].fileExtensions).toEqual([".md"]);
			expect(ready[0].excludePatterns).toEqual(["drafts/*"]);

			expect(ready[1].targetFolder).toBe("synced/team");
			expect(ready[1].description).toBe("Team Files");
			expect(ready[1].syncDirection).toBe("bidirectional");

			// User B's final mappings
			const vaultBFinal = [...vaultBExisting, ...ready];
			expect(vaultBFinal).toHaveLength(3);
		});
	});
});
