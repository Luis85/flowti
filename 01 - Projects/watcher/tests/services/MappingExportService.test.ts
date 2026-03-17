import { describe, it, expect } from "vitest";
import {
	serializeMappings,
	deserializeMappings,
	prepareMappingsForImport,
	type MappingExportData,
} from "../../src/services/MappingExportService";
import { type FolderMapping, createDefaultMapping } from "../../src/types";

function makeMapping(overrides: Partial<FolderMapping> = {}): FolderMapping {
	return createDefaultMapping({
		sourceFolder: "C:\\Users\\Test\\Documents",
		targetFolder: "imported/docs",
		description: "Test Mapping",
		...overrides,
	});
}

describe("MappingExportService", () => {
	// =========================================================================
	// serializeMappings
	// =========================================================================

	describe("serializeMappings", () => {
		it("should produce valid JSON with version, date, and mappings", () => {
			const mappings = [makeMapping()];
			const json = serializeMappings(mappings, "1.0.0");
			const parsed: MappingExportData = JSON.parse(json);

			expect(parsed.version).toBe(1);
			expect(parsed.pluginVersion).toBe("1.0.0");
			expect(parsed.exportedAt).toBeTruthy();
			expect(new Date(parsed.exportedAt).getTime()).not.toBeNaN();
			expect(parsed.mappings).toHaveLength(1);
		});

		it("should clear sourceFolder in exported mappings", () => {
			const mappings = [makeMapping({ sourceFolder: "C:\\Secret\\Path" })];
			const json = serializeMappings(mappings, "1.0.0");
			const parsed: MappingExportData = JSON.parse(json);

			expect(parsed.mappings[0].sourceFolder).toBe("");
		});

		it("should set enabled=false in exported mappings", () => {
			const mappings = [makeMapping({ enabled: true })];
			const json = serializeMappings(mappings, "1.0.0");
			const parsed: MappingExportData = JSON.parse(json);

			expect(parsed.mappings[0].enabled).toBe(false);
		});

		it("should preserve other mapping properties", () => {
			const mappings = [
				makeMapping({
					targetFolder: "my/target",
					description: "My Docs",
					fileExtensions: [".md", ".pdf"],
					conflictResolution: "rename",
					syncDirection: "bidirectional",
					excludePatterns: ["node_modules"],
				}),
			];
			const json = serializeMappings(mappings, "1.0.0");
			const parsed: MappingExportData = JSON.parse(json);
			const m = parsed.mappings[0];

			expect(m.targetFolder).toBe("my/target");
			expect(m.description).toBe("My Docs");
			expect(m.fileExtensions).toEqual([".md", ".pdf"]);
			expect(m.conflictResolution).toBe("rename");
			expect(m.syncDirection).toBe("bidirectional");
			expect(m.excludePatterns).toEqual(["node_modules"]);
		});

		it("should handle multiple mappings", () => {
			const mappings = [
				makeMapping({ targetFolder: "a" }),
				makeMapping({ targetFolder: "b" }),
				makeMapping({ targetFolder: "c" }),
			];
			const json = serializeMappings(mappings, "2.0.0");
			const parsed: MappingExportData = JSON.parse(json);

			expect(parsed.mappings).toHaveLength(3);
		});

		it("should handle empty mappings array", () => {
			const json = serializeMappings([], "1.0.0");
			const parsed: MappingExportData = JSON.parse(json);

			expect(parsed.mappings).toEqual([]);
		});
	});

	// =========================================================================
	// deserializeMappings
	// =========================================================================

	describe("deserializeMappings", () => {
		it("should parse valid export data", () => {
			const mappings = [makeMapping()];
			const json = serializeMappings(mappings, "1.0.0");
			const result = deserializeMappings(json);

			expect(result.errors).toEqual([]);
			expect(result.mappings).toHaveLength(1);
			expect(result.mappings[0].targetFolder).toBe("imported/docs");
		});

		it("should reject invalid JSON", () => {
			const result = deserializeMappings("not json {{{");

			expect(result.mappings).toEqual([]);
			expect(result.errors).toContain("Invalid JSON format");
		});

		it("should reject non-object JSON", () => {
			const result = deserializeMappings('"just a string"');

			expect(result.mappings).toEqual([]);
			expect(result.errors[0]).toContain("Expected a JSON object");
		});

		it("should reject missing version field", () => {
			const result = deserializeMappings(JSON.stringify({ mappings: [] }));

			expect(result.mappings).toEqual([]);
			expect(result.errors[0]).toContain("Unsupported version");
		});

		it("should reject unsupported version", () => {
			const result = deserializeMappings(
				JSON.stringify({ version: 99, mappings: [] })
			);

			expect(result.mappings).toEqual([]);
			expect(result.errors[0]).toContain("Unsupported version: 99");
		});

		it("should reject missing mappings array", () => {
			const result = deserializeMappings(JSON.stringify({ version: 1 }));

			expect(result.mappings).toEqual([]);
			expect(result.errors[0]).toContain("Missing or invalid mappings array");
		});

		it("should skip non-object entries in mappings array", () => {
			const result = deserializeMappings(
				JSON.stringify({ version: 1, mappings: ["not-an-object", 42, null] })
			);

			expect(result.mappings).toEqual([]);
			expect(result.errors).toHaveLength(3);
		});

		it("should report error for mapping missing targetFolder", () => {
			const result = deserializeMappings(
				JSON.stringify({
					version: 1,
					mappings: [{ description: "No target" }],
				})
			);

			expect(result.mappings).toEqual([]);
			expect(result.errors[0]).toContain("missing targetFolder");
		});

		it("should fill missing optional fields with defaults", () => {
			const result = deserializeMappings(
				JSON.stringify({
					version: 1,
					mappings: [{ targetFolder: "imported/test" }],
				})
			);

			expect(result.errors).toEqual([]);
			expect(result.mappings).toHaveLength(1);

			const m = result.mappings[0];
			expect(m.targetFolder).toBe("imported/test");
			expect(m.enabled).toBe(false);
			expect(m.sourceFolder).toBe("");
			expect(m.watchSubfolders).toBe(true);
			expect(m.conflictResolution).toBe("keepNewer");
			expect(m.debounceDelay).toBe(800);
			expect(m.syncDirection).toBe("source-only");
			expect(m.deletionHandling).toBe("ignore");
			expect(m.detectMoves).toBe(false);
		});

		it("should preserve valid field values from input", () => {
			const result = deserializeMappings(
				JSON.stringify({
					version: 1,
					mappings: [
						{
							targetFolder: "my/folder",
							description: "Custom",
							conflictResolution: "rename",
							syncDirection: "bidirectional",
							fileExtensions: [".md"],
							excludePatterns: ["temp"],
							debounceDelay: 1500,
							watchSubfolders: false,
							deletionHandling: "trash",
							detectMoves: true,
						},
					],
				})
			);

			expect(result.errors).toEqual([]);
			const m = result.mappings[0];
			expect(m.description).toBe("Custom");
			expect(m.conflictResolution).toBe("rename");
			expect(m.syncDirection).toBe("bidirectional");
			expect(m.fileExtensions).toEqual([".md"]);
			expect(m.excludePatterns).toEqual(["temp"]);
			expect(m.debounceDelay).toBe(1500);
			expect(m.watchSubfolders).toBe(false);
			expect(m.deletionHandling).toBe("trash");
			expect(m.detectMoves).toBe(true);
		});

		it("should handle invalid enum values by using defaults", () => {
			const result = deserializeMappings(
				JSON.stringify({
					version: 1,
					mappings: [
						{
							targetFolder: "test",
							conflictResolution: "invalidValue",
							syncDirection: "invalidDirection",
						},
					],
				})
			);

			expect(result.errors).toEqual([]);
			const m = result.mappings[0];
			expect(m.conflictResolution).toBe("keepNewer");
			expect(m.syncDirection).toBe("source-only");
		});

		it("should filter non-string entries from arrays", () => {
			const result = deserializeMappings(
				JSON.stringify({
					version: 1,
					mappings: [
						{
							targetFolder: "test",
							fileExtensions: [".md", 42, null, ".pdf"],
							excludePatterns: ["temp", 123, "*.log"],
						},
					],
				})
			);

			expect(result.errors).toEqual([]);
			const m = result.mappings[0];
			expect(m.fileExtensions).toEqual([".md", ".pdf"]);
			expect(m.excludePatterns).toEqual(["temp", "*.log"]);
		});
	});

	// =========================================================================
	// prepareMappingsForImport
	// =========================================================================

	describe("prepareMappingsForImport", () => {
		it("should assign new UUIDs to imported mappings", () => {
			const imported = [makeMapping({ id: "original-id", targetFolder: "a" })];
			const { mappings } = prepareMappingsForImport(imported, []);

			expect(mappings).toHaveLength(1);
			expect(mappings[0].id).not.toBe("original-id");
			expect(mappings[0].id).toBeTruthy();
		});

		it("should set imported mappings to disabled", () => {
			const imported = [makeMapping({ enabled: true, targetFolder: "a" })];
			const { mappings } = prepareMappingsForImport(imported, []);

			expect(mappings[0].enabled).toBe(false);
		});

		it("should skip mappings with overlapping target folders", () => {
			const existing = [makeMapping({ targetFolder: "imported/docs" })];
			const imported = [
				makeMapping({ targetFolder: "imported/docs", description: "Overlap" }),
			];

			const { mappings, warnings } = prepareMappingsForImport(imported, existing);

			expect(mappings).toHaveLength(0);
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain("Overlap");
			expect(warnings[0]).toContain("overlaps");
		});

		it("should skip nested target folder overlaps", () => {
			const existing = [makeMapping({ targetFolder: "imported" })];
			const imported = [
				makeMapping({ targetFolder: "imported/sub", description: "Nested" }),
			];

			const { mappings, warnings } = prepareMappingsForImport(imported, existing);

			expect(mappings).toHaveLength(0);
			expect(warnings).toHaveLength(1);
		});

		it("should skip parent target folder overlaps", () => {
			const existing = [makeMapping({ targetFolder: "imported/docs/sub" })];
			const imported = [
				makeMapping({ targetFolder: "imported/docs", description: "Parent" }),
			];

			const { mappings, warnings } = prepareMappingsForImport(imported, existing);

			expect(mappings).toHaveLength(0);
			expect(warnings).toHaveLength(1);
		});

		it("should allow non-overlapping targets", () => {
			const existing = [makeMapping({ targetFolder: "imported/docs" })];
			const imported = [
				makeMapping({ targetFolder: "imported/photos", description: "Photos" }),
			];

			const { mappings, warnings } = prepareMappingsForImport(imported, existing);

			expect(mappings).toHaveLength(1);
			expect(warnings).toEqual([]);
			expect(mappings[0].targetFolder).toBe("imported/photos");
		});

		it("should detect duplicates within the import batch", () => {
			const imported = [
				makeMapping({ targetFolder: "same/folder", description: "First" }),
				makeMapping({ targetFolder: "same/folder", description: "Duplicate" }),
			];

			const { mappings, warnings } = prepareMappingsForImport(imported, []);

			expect(mappings).toHaveLength(1);
			expect(mappings[0].description).toBe("First");
			expect(warnings).toHaveLength(1);
			expect(warnings[0]).toContain("Duplicate");
		});

		it("should handle empty imports", () => {
			const { mappings, warnings } = prepareMappingsForImport([], []);

			expect(mappings).toEqual([]);
			expect(warnings).toEqual([]);
		});

		it("should import multiple non-overlapping mappings", () => {
			const imported = [
				makeMapping({ targetFolder: "a" }),
				makeMapping({ targetFolder: "b" }),
				makeMapping({ targetFolder: "c" }),
			];

			const { mappings } = prepareMappingsForImport(imported, []);

			expect(mappings).toHaveLength(3);
			// All should have unique new IDs
			const ids = new Set(mappings.map((m) => m.id));
			expect(ids.size).toBe(3);
		});
	});

	// =========================================================================
	// Round-trip
	// =========================================================================

	describe("round-trip", () => {
		it("should preserve mapping data through export and import", () => {
			const original = [
				makeMapping({
					targetFolder: "imported/docs",
					description: "My Documents",
					fileExtensions: [".md", ".pdf"],
					conflictResolution: "rename",
					syncDirection: "bidirectional",
					excludePatterns: ["node_modules", "*.tmp"],
					watchSubfolders: false,
					debounceDelay: 1200,
					deletionHandling: "trash",
					detectMoves: true,
				}),
			];

			const json = serializeMappings(original, "1.0.0");
			const { mappings: deserialized, errors } = deserializeMappings(json);

			expect(errors).toEqual([]);
			expect(deserialized).toHaveLength(1);

			const m = deserialized[0];
			expect(m.targetFolder).toBe("imported/docs");
			expect(m.description).toBe("My Documents");
			expect(m.fileExtensions).toEqual([".md", ".pdf"]);
			expect(m.conflictResolution).toBe("rename");
			expect(m.syncDirection).toBe("bidirectional");
			expect(m.excludePatterns).toEqual(["node_modules", "*.tmp"]);
			expect(m.watchSubfolders).toBe(false);
			expect(m.debounceDelay).toBe(1200);
			expect(m.deletionHandling).toBe("trash");
			expect(m.detectMoves).toBe(true);
			// These should be cleared/disabled by export
			expect(m.sourceFolder).toBe("");
			expect(m.enabled).toBe(false);
		});

		it("should produce importable mappings after round-trip", () => {
			const original = [
				makeMapping({ targetFolder: "a", description: "A" }),
				makeMapping({ targetFolder: "b", description: "B" }),
			];

			const json = serializeMappings(original, "1.0.0");
			const { mappings: deserialized } = deserializeMappings(json);
			const { mappings: ready } = prepareMappingsForImport(deserialized, []);

			expect(ready).toHaveLength(2);
			expect(ready[0].enabled).toBe(false);
			expect(ready[1].enabled).toBe(false);
			expect(ready[0].id).not.toBe(original[0].id);
			expect(ready[1].id).not.toBe(original[1].id);
		});
	});
});
