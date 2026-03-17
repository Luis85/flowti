import { describe, it, expect } from "vitest";
import { buildDataDictionary } from "../../../src/domain/dataExchange/DataDictionaryBuilder";
import type { DataExchangeState, SavedImportConfig, SavedExportConfig, SavedMultiImportPipeline } from "../../../src/domain/dataExchange/types";

function makeState(overrides: Partial<DataExchangeState> = {}): DataExchangeState {
	return {
		savedImportConfigs: [],
		savedExportConfigs: [],
		savedPipelines: [],
		...overrides,
	};
}

function makeImportConfig(overrides: Partial<SavedImportConfig> = {}): SavedImportConfig {
	return {
		id: "imp-1",
		name: "Test Import",
		createdAt: 1000,
		targetFolder: "out",
		nameColumn: "id",
		columnMappings: [],
		conflictStrategy: "skip",
		...overrides,
	};
}

function makeExportConfig(overrides: Partial<SavedExportConfig> = {}): SavedExportConfig {
	return {
		id: "exp-1",
		name: "Test Export",
		createdAt: 1000,
		sourcePath: "src",
		sourceType: "folder",
		format: "csv",
		outputPath: "out.csv",
		columns: [],
		fileProperties: [],
		...overrides,
	};
}

function makePipeline(overrides: Partial<SavedMultiImportPipeline> = {}): SavedMultiImportPipeline {
	return {
		id: "pipe-1",
		name: "Test Pipeline",
		createdAt: 1000,
		targetFolder: "out",
		mergeKey: "item_id",
		sources: [],
		...overrides,
	};
}

describe("buildDataDictionary", () => {
	// ── Empty state ──────────────────────────────────────────

	it("should return empty array for empty state", () => {
		const result = buildDataDictionary(makeState());
		expect(result).toEqual([]);
	});

	// ── Import configs ───────────────────────────────────────

	describe("import configs", () => {
		it("should track included column mappings", () => {
			const state = makeState({
				savedImportConfigs: [
					makeImportConfig({
						columnMappings: [
							{ csvColumn: "Name", frontmatterKey: "name", included: true },
							{ csvColumn: "Desc", frontmatterKey: "description", included: true },
						],
					}),
				],
			});
			const result = buildDataDictionary(state);
			const names = result.map((e) => e.propertyName);
			expect(names).toContain("name");
			expect(names).toContain("description");
		});

		it("should skip excluded column mappings", () => {
			const state = makeState({
				savedImportConfigs: [
					makeImportConfig({
						columnMappings: [
							{ csvColumn: "Name", frontmatterKey: "name", included: true },
							{ csvColumn: "Internal", frontmatterKey: "internal", included: false },
						],
					}),
				],
			});
			const result = buildDataDictionary(state);
			const names = result.map((e) => e.propertyName);
			expect(names).toContain("name");
			expect(names).not.toContain("internal");
		});

		it("should track csvColumnNames from mappings", () => {
			const state = makeState({
				savedImportConfigs: [
					makeImportConfig({
						columnMappings: [
							{ csvColumn: "ProductName", frontmatterKey: "name", included: true },
						],
					}),
				],
			});
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "name");
			expect(entry?.csvColumnNames).toContain("ProductName");
		});

		it("should not duplicate csvColumnNames", () => {
			const state = makeState({
				savedImportConfigs: [
					makeImportConfig({
						id: "i1",
						columnMappings: [
							{ csvColumn: "Name", frontmatterKey: "name", included: true },
						],
					}),
					makeImportConfig({
						id: "i2",
						name: "Import 2",
						columnMappings: [
							{ csvColumn: "Name", frontmatterKey: "name", included: true },
						],
					}),
				],
			});
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "name");
			expect(entry?.csvColumnNames).toEqual(["Name"]);
		});

		it("should track usedInConfigs references", () => {
			const state = makeState({
				savedImportConfigs: [
					makeImportConfig({
						id: "cfg-1",
						name: "My Import",
						columnMappings: [
							{ csvColumn: "Name", frontmatterKey: "name", included: true },
						],
					}),
				],
			});
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "name");
			expect(entry?.usedInConfigs).toHaveLength(1);
			expect(entry?.usedInConfigs[0]).toEqual({
				configId: "cfg-1",
				configName: "My Import",
				configType: "import",
			});
		});

		it("should track customProperties", () => {
			const state = makeState({
				savedImportConfigs: [
					makeImportConfig({
						customProperties: { source: "csv-import", region: "EU" },
					}),
				],
			});
			const result = buildDataDictionary(state);
			const names = result.map((e) => e.propertyName);
			expect(names).toContain("source");
			expect(names).toContain("region");
		});

		it("should add customProperty values as sampleValues", () => {
			const state = makeState({
				savedImportConfigs: [
					makeImportConfig({
						customProperties: { source: "csv-import" },
					}),
				],
			});
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "source");
			expect(entry?.sampleValues).toContain("csv-import");
		});

		it("should not add empty customProperty values", () => {
			const state = makeState({
				savedImportConfigs: [
					makeImportConfig({
						customProperties: { source: "" },
					}),
				],
			});
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "source");
			expect(entry?.sampleValues).toEqual([]);
		});

		it("should tag entries with noteType", () => {
			const state = makeState({
				savedImportConfigs: [
					makeImportConfig({
						noteType: "Event",
						columnMappings: [
							{ csvColumn: "Name", frontmatterKey: "name", included: true },
						],
					}),
				],
			});
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "name");
			expect(entry?.typeNames).toContain("Event");
		});

		it("should not add typeNames when noteType is undefined", () => {
			const state = makeState({
				savedImportConfigs: [
					makeImportConfig({
						columnMappings: [
							{ csvColumn: "Name", frontmatterKey: "name", included: true },
						],
					}),
				],
			});
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "name");
			expect(entry?.typeNames).toBeUndefined();
		});

		it("should not duplicate typeNames", () => {
			const state = makeState({
				savedImportConfigs: [
					makeImportConfig({
						id: "i1",
						noteType: "Event",
						columnMappings: [
							{ csvColumn: "A", frontmatterKey: "name", included: true },
						],
					}),
					makeImportConfig({
						id: "i2",
						name: "Import 2",
						noteType: "Event",
						columnMappings: [
							{ csvColumn: "B", frontmatterKey: "name", included: true },
						],
					}),
				],
			});
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "name");
			expect(entry?.typeNames).toEqual(["Event"]);
		});
	});

	// ── Export configs ────────────────────────────────────────

	describe("export configs", () => {
		it("should track export columns", () => {
			const state = makeState({
				savedExportConfigs: [
					makeExportConfig({ columns: ["name", "description", "status"] }),
				],
			});
			const result = buildDataDictionary(state);
			const names = result.map((e) => e.propertyName);
			expect(names).toContain("name");
			expect(names).toContain("description");
			expect(names).toContain("status");
		});

		it("should track export usedInConfigs as 'export' type", () => {
			const state = makeState({
				savedExportConfigs: [
					makeExportConfig({
						id: "exp-1",
						name: "My Export",
						columns: ["name"],
					}),
				],
			});
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "name");
			expect(entry?.usedInConfigs[0].configType).toBe("export");
		});

		it("should tag export entries with noteType", () => {
			const state = makeState({
				savedExportConfigs: [
					makeExportConfig({ noteType: "Asset", columns: ["name"] }),
				],
			});
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "name");
			expect(entry?.typeNames).toContain("Asset");
		});

		it("should merge import and export references for same property", () => {
			const state = makeState({
				savedImportConfigs: [
					makeImportConfig({
						id: "i1",
						name: "Import",
						columnMappings: [{ csvColumn: "Name", frontmatterKey: "name", included: true }],
					}),
				],
				savedExportConfigs: [
					makeExportConfig({
						id: "e1",
						name: "Export",
						columns: ["name"],
					}),
				],
			});
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "name");
			expect(entry?.usedInConfigs).toHaveLength(2);
			expect(entry?.usedInConfigs.map((c) => c.configType)).toContain("import");
			expect(entry?.usedInConfigs.map((c) => c.configType)).toContain("export");
		});
	});

	// ── Pipelines ────────────────────────────────────────────

	describe("pipelines", () => {
		it("should track merge key", () => {
			const state = makeState({
				savedPipelines: [makePipeline({ mergeKey: "product_id" })],
			});
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "product_id");
			expect(entry).toBeDefined();
		});

		it("should track merge key csvColumnName from source", () => {
			const state = makeState({
				savedPipelines: [
					makePipeline({
						mergeKey: "item_id",
						sources: [{ id: "s1", csvPath: "data.csv", mergeKeyColumn: "ItemID", columnMappings: [] }],
					}),
				],
			});
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "item_id");
			expect(entry?.csvColumnNames).toContain("ItemID");
		});

		it("should not duplicate merge key csvColumnNames", () => {
			const state = makeState({
				savedPipelines: [
					makePipeline({
						mergeKey: "item_id",
						sources: [
							{ id: "s1", csvPath: "a.csv", mergeKeyColumn: "ItemID", columnMappings: [] },
							{ id: "s2", csvPath: "b.csv", mergeKeyColumn: "ItemID", columnMappings: [] },
						],
					}),
				],
			});
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "item_id");
			expect(entry?.csvColumnNames).toEqual(["ItemID"]);
		});

		it("should track source column mappings", () => {
			const state = makeState({
				savedPipelines: [
					makePipeline({
						sources: [
							{
								id: "s1", csvPath: "data.csv", mergeKeyColumn: "id",
								columnMappings: [
									{ csvColumn: "Price", frontmatterKey: "price", included: true },
									{ csvColumn: "Weight", frontmatterKey: "weight", included: false },
								],
							},
						],
					}),
				],
			});
			const result = buildDataDictionary(state);
			const names = result.map((e) => e.propertyName);
			expect(names).toContain("price");
			expect(names).not.toContain("weight"); // excluded
		});

		it("should track source customProperties", () => {
			const state = makeState({
				savedPipelines: [
					makePipeline({
						sources: [
							{
								id: "s1", csvPath: "data.csv", mergeKeyColumn: "id", columnMappings: [],
								customProperties: { origin: "batch-import" },
							},
						],
					}),
				],
			});
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "origin");
			expect(entry).toBeDefined();
			expect(entry?.sampleValues).toContain("batch-import");
		});

		it("should tag pipeline entries with noteType", () => {
			const state = makeState({
				savedPipelines: [
					makePipeline({
						noteType: "Event",
						sources: [
							{
								id: "s1", csvPath: "data.csv", mergeKeyColumn: "id",
								columnMappings: [{ csvColumn: "Name", frontmatterKey: "name", included: true }],
							},
						],
					}),
				],
			});
			const result = buildDataDictionary(state);
			const mergeEntry = result.find((e) => e.propertyName === "item_id");
			expect(mergeEntry?.typeNames).toContain("Event");
			const nameEntry = result.find((e) => e.propertyName === "name");
			expect(nameEntry?.typeNames).toContain("Event");
		});

		it("should not duplicate usedInConfigs for same pipeline", () => {
			const state = makeState({
				savedPipelines: [
					makePipeline({
						id: "pipe-1",
						sources: [
							{
								id: "s1", csvPath: "a.csv", mergeKeyColumn: "id",
								columnMappings: [{ csvColumn: "Name", frontmatterKey: "name", included: true }],
							},
							{
								id: "s2", csvPath: "b.csv", mergeKeyColumn: "id",
								columnMappings: [{ csvColumn: "Title", frontmatterKey: "name", included: true }],
							},
						],
					}),
				],
			});
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "name");
			const pipeRefs = entry?.usedInConfigs.filter((c) => c.configId === "pipe-1");
			expect(pipeRefs).toHaveLength(1);
		});

		it("should handle undefined savedPipelines", () => {
			const state = makeState({ savedPipelines: undefined });
			const result = buildDataDictionary(state);
			expect(result).toEqual([]);
		});

		it("should track multiple csvColumnNames from different sources", () => {
			const state = makeState({
				savedPipelines: [
					makePipeline({
						mergeKey: "item_id",
						sources: [
							{ id: "s1", csvPath: "a.csv", mergeKeyColumn: "ItemID", columnMappings: [] },
							{ id: "s2", csvPath: "b.csv", mergeKeyColumn: "product_id", columnMappings: [] },
						],
					}),
				],
			});
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "item_id");
			expect(entry?.csvColumnNames).toContain("ItemID");
			expect(entry?.csvColumnNames).toContain("product_id");
		});
	});

	// ── Sorting and limits ───────────────────────────────────

	describe("sorting and limits", () => {
		it("should sort results alphabetically by propertyName", () => {
			const state = makeState({
				savedImportConfigs: [
					makeImportConfig({
						columnMappings: [
							{ csvColumn: "C", frontmatterKey: "zebra", included: true },
							{ csvColumn: "A", frontmatterKey: "alpha", included: true },
							{ csvColumn: "B", frontmatterKey: "middle", included: true },
						],
					}),
				],
			});
			const result = buildDataDictionary(state);
			const names = result.map((e) => e.propertyName);
			expect(names).toEqual(["alpha", "middle", "zebra"]);
		});

		it("should limit sampleValues to 5", () => {
			const configs: SavedImportConfig[] = [];
			for (let i = 0; i < 8; i++) {
				configs.push(
					makeImportConfig({
						id: `i${i}`,
						name: `Import ${i}`,
						customProperties: { source: `value-${i}` },
					}),
				);
			}
			const state = makeState({ savedImportConfigs: configs });
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "source");
			expect(entry?.sampleValues.length).toBeLessThanOrEqual(5);
		});

		it("should not duplicate sampleValues", () => {
			const state = makeState({
				savedImportConfigs: [
					makeImportConfig({ id: "i1", customProperties: { source: "csv" } }),
					makeImportConfig({ id: "i2", name: "Import 2", customProperties: { source: "csv" } }),
				],
			});
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "source");
			expect(entry?.sampleValues).toEqual(["csv"]);
		});
	});

	// ── Cross-config interaction ─────────────────────────────

	describe("cross-config interaction", () => {
		it("should merge properties across import, export, and pipeline configs", () => {
			const state = makeState({
				savedImportConfigs: [
					makeImportConfig({
						id: "i1",
						columnMappings: [{ csvColumn: "N", frontmatterKey: "name", included: true }],
					}),
				],
				savedExportConfigs: [
					makeExportConfig({ id: "e1", columns: ["name", "status"] }),
				],
				savedPipelines: [
					makePipeline({
						id: "p1",
						sources: [
							{
								id: "s1", csvPath: "data.csv", mergeKeyColumn: "id",
								columnMappings: [{ csvColumn: "Name", frontmatterKey: "name", included: true }],
							},
						],
					}),
				],
			});

			const result = buildDataDictionary(state);
			const nameEntry = result.find((e) => e.propertyName === "name");
			expect(nameEntry).toBeDefined();
			expect(nameEntry!.usedInConfigs.length).toBe(3);
		});

		it("should aggregate typeNames from multiple sources", () => {
			const state = makeState({
				savedImportConfigs: [
					makeImportConfig({
						id: "i1",
						noteType: "Event",
						columnMappings: [{ csvColumn: "N", frontmatterKey: "name", included: true }],
					}),
				],
				savedExportConfigs: [
					makeExportConfig({
						id: "e1",
						noteType: "Asset",
						columns: ["name"],
					}),
				],
			});
			const result = buildDataDictionary(state);
			const entry = result.find((e) => e.propertyName === "name");
			expect(entry?.typeNames).toContain("Event");
			expect(entry?.typeNames).toContain("Asset");
		});
	});
});
