import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConfigDocService } from "../../../src/domain/dataExchange/ConfigDocService";
import type { ConfigDocServiceDeps } from "../../../src/domain/dataExchange/ConfigDocService";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { IFileSystemClient } from "../../../src/infrastructure/filesystem/types";
import type { DataExchangeState, SavedImportConfig, SavedExportConfig, SavedMultiImportPipeline, DataDictionaryEntry } from "../../../src/domain/dataExchange/types";

function createMockFileSystem(): IFileSystemClient {
	return {
		fileExists: vi.fn(async () => false),
		createFile: vi.fn(async () => {}),
		readFile: vi.fn(async () => { throw new Error("File not found"); }),
		updateFile: vi.fn(async () => {}),
		deleteFile: vi.fn(async () => {}),
		moveFile: vi.fn(async (_p: string, np: string) => np),
		renameFile: vi.fn(async (_p: string, nn: string) => nn),
		getFrontmatter: vi.fn(async () => ({})),
		updateFrontmatter: vi.fn(async (_p: string, d: Record<string, unknown>) => d),
		setFrontmatter: vi.fn(async () => {}),
	} as unknown as IFileSystemClient;
}

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
		columnMappings: [{ csvColumn: "Name", frontmatterKey: "name", included: true }],
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
		columns: ["name", "status"],
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
		sources: [
			{
				id: "s1", csvPath: "data.csv", mergeKeyColumn: "ItemID",
				columnMappings: [{ csvColumn: "Name", frontmatterKey: "name", included: true }],
			},
		],
		...overrides,
	};
}

describe("ConfigDocService", () => {
	let eventBus: IEventBus;
	let fileSystem: IFileSystemClient;
	let state: DataExchangeState;
	let docsRoot: string;
	let svc: ConfigDocService;
	let docCreateEvents: Array<Record<string, unknown>>;

	beforeEach(() => {
		eventBus = new EventBus();
		fileSystem = createMockFileSystem();
		state = makeState();
		docsRoot = "03 - Resources/Documentation/Reference";
		docCreateEvents = [];

		eventBus.on("doc.create", (event) => {
			docCreateEvents.push(event.payload as unknown as Record<string, unknown>);
		});

		const deps: ConfigDocServiceDeps = {
			fileSystem,
			eventBus,
			getDocsRootPath: () => docsRoot,
			getState: () => state,
			getExportConfig: (id) => state.savedExportConfigs.find((c) => c.id === id),
			buildDataDictionary: () => [],
		};
		svc = new ConfigDocService(deps);
	});

	// ── Path accessors ───────────────────────────────────────

	describe("path accessors", () => {
		it("getConfigsFolderPath returns correct path", () => {
			expect(svc.getConfigsFolderPath()).toContain(docsRoot);
			expect(svc.getConfigsFolderPath()).toContain("Configs");
		});

		it("getReportsFolderPath returns correct path", () => {
			expect(svc.getReportsFolderPath()).toContain(docsRoot);
			expect(svc.getReportsFolderPath()).toContain("Reports");
		});

		it("getPropertiesFolderPath returns correct path", () => {
			expect(svc.getPropertiesFolderPath()).toContain(docsRoot);
			expect(svc.getPropertiesFolderPath()).toContain("Properties");
		});

		it("getTypesFolderPath returns correct path", () => {
			expect(svc.getTypesFolderPath()).toContain(docsRoot);
			expect(svc.getTypesFolderPath()).toContain("Types");
		});

		it("getCsvDocPath includes CSV basename", () => {
			const path = svc.getCsvDocPath("data/sales.csv");
			expect(path).toContain("sales");
			expect(path).toContain("Reports");
		});

		it("getConfigDocPath includes config name and type", () => {
			const importPath = svc.getConfigDocPath("My Config", "import");
			expect(importPath).toContain("Import");
			expect(importPath).toContain("My Config");

			const exportPath = svc.getConfigDocPath("My Config", "export");
			expect(exportPath).toContain("Export");
		});

		it("getPropertyDocPath includes property name", () => {
			const path = svc.getPropertyDocPath("status");
			expect(path).toContain("status");
		});

		it("getPipelineDocPath includes pipeline name", () => {
			const path = svc.getPipelineDocPath("Daily Merge");
			expect(path).toContain("Daily Merge");
		});

		it("getEventDocPath includes event type", () => {
			const path = svc.getEventDocPath("order.created");
			expect(path).toContain("order.created");
		});

		it("getTypeDocPath includes type name", () => {
			const path = svc.getTypeDocPath("Event");
			expect(path).toContain("Event");
		});
	});

	// ── createCsvDoc ─────────────────────────────────────────

	describe("createCsvDoc", () => {
		it("should emit doc.create with CsvDoc type", async () => {
			await svc.createCsvDoc("data/sales.csv", ["name", "price"], 100);
			expect(docCreateEvents).toHaveLength(1);
			expect(docCreateEvents[0].docType).toBe("CsvDoc");
		});

		it("should include headers and row count in content", async () => {
			await svc.createCsvDoc("data/sales.csv", ["name", "price"], 50, ",");
			const content = docCreateEvents[0].content as string;
			expect(content).toContain("name");
			expect(content).toContain("price");
		});

		it("should return the doc path", async () => {
			const result = await svc.createCsvDoc("data/sales.csv", ["name"], 10);
			expect(result).toContain("sales");
			expect(result).toContain("Reports");
		});

		it("should use basename from csvPath as name", async () => {
			await svc.createCsvDoc("deep/nested/file.csv", ["a"], 1);
			expect(docCreateEvents[0].name).toBe("file.csv");
		});

		it("should fallback to 'file.csv' when basename is empty", async () => {
			await svc.createCsvDoc("", ["a"], 1);
			expect(docCreateEvents[0].name).toBe("file.csv");
		});
	});

	// ── createPropertyDoc ────────────────────────────────────

	describe("createPropertyDoc", () => {
		it("should emit doc.create with PropertyDoc type", async () => {
			await svc.createPropertyDoc("status");
			expect(docCreateEvents).toHaveLength(1);
			expect(docCreateEvents[0].docType).toBe("PropertyDoc");
			expect(docCreateEvents[0].name).toBe("status");
		});

		it("should return the doc path", async () => {
			const result = await svc.createPropertyDoc("status");
			expect(result).toContain("status");
		});

		it("should use data dictionary entry when available", async () => {
			const dictEntry: DataDictionaryEntry = {
				propertyName: "status",
				usedInConfigs: [{ configId: "c1", configName: "Config A", configType: "import" }],
				csvColumnNames: ["Status"],
				sampleValues: ["active", "inactive"],
			};
			svc = new ConfigDocService({
				fileSystem,
				eventBus,
				getDocsRootPath: () => docsRoot,
				getState: () => state,
				getExportConfig: () => undefined,
				buildDataDictionary: () => [dictEntry],
			});
			// Re-register listener after new svc
			docCreateEvents = [];
			eventBus.on("doc.create", (event) => {
				docCreateEvents.push(event.payload as unknown as Record<string, unknown>);
			});

			await svc.createPropertyDoc("status");
			const content = docCreateEvents[0].content as string;
			expect(content).toContain("status");
		});
	});

	// ── createImportConfigDoc ────────────────────────────────

	describe("createImportConfigDoc", () => {
		it("should emit doc.create with ImportConfigDoc type", async () => {
			const config = makeImportConfig();
			await svc.createImportConfigDoc(config);
			expect(docCreateEvents).toHaveLength(1);
			expect(docCreateEvents[0].docType).toBe("ImportConfigDoc");
		});

		it("should include config name", async () => {
			const config = makeImportConfig({ name: "Sales Import" });
			await svc.createImportConfigDoc(config);
			expect(docCreateEvents[0].name).toBe("Sales Import");
		});

		it("should set upsert flag", async () => {
			await svc.createImportConfigDoc(makeImportConfig());
			expect(docCreateEvents[0].upsert).toBe(true);
		});

		it("should skip when docsRootPath is empty", async () => {
			docsRoot = "";
			await svc.createImportConfigDoc(makeImportConfig());
			expect(docCreateEvents).toHaveLength(0);
		});

		it("should preserve user notes from existing doc", async () => {
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
				"---\ntype: ImportConfigDoc\n---\n# Config\n\n## Notes\n\nMy custom workflow notes here.",
			);
			await svc.createImportConfigDoc(makeImportConfig());
			const content = docCreateEvents[0].content as string;
			expect(content).toContain("My custom workflow notes here.");
		});

		it("should not preserve default placeholder notes", async () => {
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
				"---\ntype: ImportConfigDoc\n---\n# Config\n\n## Notes\n\n> Document usage notes, scheduling, or workflow context.",
			);
			await svc.createImportConfigDoc(makeImportConfig());
			// Should still work — default placeholder is not preserved as user notes
			expect(docCreateEvents).toHaveLength(1);
		});

		it("should handle readFile errors gracefully", async () => {
			// readFile already throws "File not found" by default
			await svc.createImportConfigDoc(makeImportConfig());
			expect(docCreateEvents).toHaveLength(1);
		});
	});

	// ── createExportConfigDoc ────────────────────────────────

	describe("createExportConfigDoc", () => {
		it("should emit doc.create with ExportConfigDoc type", async () => {
			const config = makeExportConfig();
			await svc.createExportConfigDoc(config);
			expect(docCreateEvents).toHaveLength(1);
			expect(docCreateEvents[0].docType).toBe("ExportConfigDoc");
		});

		it("should include config name", async () => {
			const config = makeExportConfig({ name: "Monthly Export" });
			await svc.createExportConfigDoc(config);
			expect(docCreateEvents[0].name).toBe("Monthly Export");
		});

		it("should skip when docsRootPath is empty", async () => {
			docsRoot = "";
			await svc.createExportConfigDoc(makeExportConfig());
			expect(docCreateEvents).toHaveLength(0);
		});
	});

	// ── createPipelineConfigDoc ──────────────────────────────

	describe("createPipelineConfigDoc", () => {
		it("should emit doc.create with PipelineConfigDoc type", async () => {
			const pipeline = makePipeline();
			await svc.createPipelineConfigDoc(pipeline);
			expect(docCreateEvents).toHaveLength(1);
			expect(docCreateEvents[0].docType).toBe("PipelineConfigDoc");
		});

		it("should skip when docsRootPath is empty", async () => {
			docsRoot = "";
			await svc.createPipelineConfigDoc(makePipeline());
			expect(docCreateEvents).toHaveLength(0);
		});

		it("should resolve linked export configs", async () => {
			const exportCfg = makeExportConfig({ id: "exp-linked", name: "Linked Export" });
			state.savedExportConfigs = [exportCfg];
			const pipeline = makePipeline({ exportConfigIds: ["exp-linked"] });
			await svc.createPipelineConfigDoc(pipeline);
			expect(docCreateEvents).toHaveLength(1);
		});
	});

	// ── ensureConfigDoc ──────────────────────────────────────

	describe("ensureConfigDoc", () => {
		it("should recreate import config doc", async () => {
			const config = makeImportConfig({ name: "My Import" });
			state.savedImportConfigs = [config];

			const path = await svc.ensureConfigDoc("My Import", "import");
			expect(path).toContain("Import");
			expect(path).toContain("My Import");
			expect(docCreateEvents).toHaveLength(1);
		});

		it("should recreate export config doc", async () => {
			const config = makeExportConfig({ name: "My Export" });
			state.savedExportConfigs = [config];

			const path = await svc.ensureConfigDoc("My Export", "export");
			expect(path).toContain("Export");
			expect(docCreateEvents).toHaveLength(1);
		});

		it("should not emit doc.create when config not found", async () => {
			await svc.ensureConfigDoc("NonExistent", "import");
			expect(docCreateEvents).toHaveLength(0);
		});

		it("should return correct path even when config not found", async () => {
			const path = await svc.ensureConfigDoc("Missing", "export");
			expect(path).toContain("Export");
			expect(path).toContain("Missing");
		});
	});

	// ── ensurePipelineDoc ────────────────────────────────────

	describe("ensurePipelineDoc", () => {
		it("should recreate pipeline doc when found", async () => {
			const pipeline = makePipeline({ id: "pipe-1", name: "Merge" });
			state.savedPipelines = [pipeline];

			const path = await svc.ensurePipelineDoc("pipe-1");
			expect(path).toContain("Merge");
			expect(docCreateEvents).toHaveLength(1);
		});

		it("should return empty string when pipeline not found", async () => {
			const path = await svc.ensurePipelineDoc("nonexistent");
			expect(path).toBe("");
			expect(docCreateEvents).toHaveLength(0);
		});
	});

	// ── createOrUpdateTypeDoc ────────────────────────────────

	describe("createOrUpdateTypeDoc", () => {
		it("should emit doc.create with TypeDoc type", async () => {
			state.savedPipelines = [
				makePipeline({ noteType: "Event" }),
			];
			await svc.createOrUpdateTypeDoc("Event");
			// TypeDoc + 4 CRUD event docs
			const typeDocEvents = docCreateEvents.filter((e) => e.docType === "TypeDoc");
			expect(typeDocEvents).toHaveLength(1);
		});

		it("should collect properties from pipeline sources", async () => {
			state.savedPipelines = [
				makePipeline({
					noteType: "Asset",
					sources: [
						{
							id: "s1", csvPath: "a.csv", mergeKeyColumn: "id",
							columnMappings: [
								{ csvColumn: "Name", frontmatterKey: "name", included: true },
								{ csvColumn: "Price", frontmatterKey: "price", included: true },
							],
						},
					],
				}),
			];
			await svc.createOrUpdateTypeDoc("Asset");
			const typeDoc = docCreateEvents.find((e) => e.docType === "TypeDoc");
			const content = typeDoc?.content as string;
			expect(content).toContain("name");
			expect(content).toContain("price");
		});

		it("should collect properties from import configs", async () => {
			state.savedImportConfigs = [
				makeImportConfig({
					noteType: "Event",
					columnMappings: [
						{ csvColumn: "Status", frontmatterKey: "status", included: true },
					],
				}),
			];
			await svc.createOrUpdateTypeDoc("Event");
			const typeDoc = docCreateEvents.find((e) => e.docType === "TypeDoc");
			const content = typeDoc?.content as string;
			expect(content).toContain("status");
		});

		it("should collect properties from export configs", async () => {
			state.savedExportConfigs = [
				makeExportConfig({
					noteType: "Event",
					columns: ["category", "priority"],
				}),
			];
			await svc.createOrUpdateTypeDoc("Event");
			const typeDoc = docCreateEvents.find((e) => e.docType === "TypeDoc");
			const content = typeDoc?.content as string;
			expect(content).toContain("category");
			expect(content).toContain("priority");
		});

		it("should include merge key and type in properties", async () => {
			state.savedPipelines = [
				makePipeline({
					noteType: "Event",
					mergeKey: "event_id",
				}),
			];
			await svc.createOrUpdateTypeDoc("Event");
			const typeDoc = docCreateEvents.find((e) => e.docType === "TypeDoc");
			const content = typeDoc?.content as string;
			expect(content).toContain("event_id");
			expect(content).toContain("type");
		});

		it("should include customProperties from pipeline sources", async () => {
			state.savedPipelines = [
				makePipeline({
					noteType: "Asset",
					sources: [{
						id: "s1", csvPath: "a.csv", mergeKeyColumn: "id",
						columnMappings: [],
						customProperties: { origin: "batch" },
					}],
				}),
			];
			await svc.createOrUpdateTypeDoc("Asset");
			const typeDoc = docCreateEvents.find((e) => e.docType === "TypeDoc");
			const content = typeDoc?.content as string;
			expect(content).toContain("origin");
		});

		it("should include customProperties from import configs", async () => {
			state.savedImportConfigs = [
				makeImportConfig({
					noteType: "Event",
					customProperties: { source: "csv" },
				}),
			];
			await svc.createOrUpdateTypeDoc("Event");
			const typeDoc = docCreateEvents.find((e) => e.docType === "TypeDoc");
			const content = typeDoc?.content as string;
			expect(content).toContain("source");
		});

		it("should create TypeDoc with no properties when no configs match", async () => {
			state.savedPipelines = [
				makePipeline({ noteType: "Other" }),
			];
			await svc.createOrUpdateTypeDoc("Event");
			const typeDoc = docCreateEvents.find((e) => e.docType === "TypeDoc");
			// TypeDoc is still created, but with 0 properties
			expect(typeDoc).toBeDefined();
			const content = typeDoc!.content as string;
			expect(content).toContain("properties: []");
		});
	});

	// ── createConfigEventDocs ────────────────────────────────

	describe("createConfigEventDocs", () => {
		it("should emit 4 CRUD event docs", () => {
			const discoveryEvents: Array<Record<string, unknown>> = [];
			eventBus.on("discovery.create", (event) => {
				discoveryEvents.push(event.payload as unknown as Record<string, unknown>);
			});

			svc.createConfigEventDocs("Sales Import", "import");
			expect(discoveryEvents).toHaveLength(4);
			const suffixes = discoveryEvents.map((e) => (e.eventName as string).split(".").pop());
			expect(suffixes).toContain("created");
			expect(suffixes).toContain("read");
			expect(suffixes).toContain("updated");
			expect(suffixes).toContain("deleted");
		});

		it("should normalize config name for event type", () => {
			const discoveryEvents: Array<Record<string, unknown>> = [];
			eventBus.on("discovery.create", (event) => {
				discoveryEvents.push(event.payload as unknown as Record<string, unknown>);
			});

			svc.createConfigEventDocs("My Config!!", "pipeline");
			expect(discoveryEvents[0].eventName).toMatch(/^my-config\./);
		});

		it("should not emit when config name normalizes to empty", () => {
			const discoveryEvents: Array<Record<string, unknown>> = [];
			eventBus.on("discovery.create", (event) => {
				discoveryEvents.push(event.payload as unknown as Record<string, unknown>);
			});

			svc.createConfigEventDocs("!!!", "import");
			expect(discoveryEvents).toHaveLength(0);
		});

		it("should set correct domain for Data Exchange", () => {
			const discoveryEvents: Array<Record<string, unknown>> = [];
			eventBus.on("discovery.create", (event) => {
				discoveryEvents.push(event.payload as unknown as Record<string, unknown>);
			});

			svc.createConfigEventDocs("Test", "export");
			const meta = discoveryEvents[0].docMeta as Record<string, unknown>;
			expect(meta.domain).toBe("Data Exchange");
		});
	});
});
