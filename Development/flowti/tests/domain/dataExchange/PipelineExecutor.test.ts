import { describe, it, expect, beforeEach, vi } from "vitest";
import { PipelineExecutor } from "../../../src/domain/dataExchange/PipelineExecutor";
import type { PipelineExecutorDeps } from "../../../src/domain/dataExchange/PipelineExecutor";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { IFileSystemClient } from "../../../src/infrastructure/filesystem/types";
import type { ImportResult, SavedExportConfig, SavedMultiImportPipeline } from "../../../src/domain/dataExchange/types";

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

function makeSuccessResult(rows = 2, created = 2): ImportResult {
	return {
		totalRows: rows,
		created,
		updated: 0,
		skipped: 0,
		failed: 0,
		errors: [],
	};
}

function makeUpdateResult(rows = 2): ImportResult {
	return {
		totalRows: rows,
		created: 0,
		updated: rows,
		skipped: 0,
		failed: 0,
		errors: [],
	};
}

function makePipeline(overrides: Partial<SavedMultiImportPipeline> = {}): SavedMultiImportPipeline {
	return {
		id: "pipe-1",
		name: "Test Pipeline",
		createdAt: 1000,
		targetFolder: "out/items",
		mergeKey: "item_id",
		sources: [
			{
				id: "s1",
				csvPath: "data/source1.csv",
				mergeKeyColumn: "ItemID",
				columnMappings: [
					{ csvColumn: "description", frontmatterKey: "description", included: true },
				],
			},
		],
		...overrides,
	};
}

describe("PipelineExecutor", () => {
	let eventBus: IEventBus;
	let fileSystem: IFileSystemClient;
	let mockImportService: { executeImport: ReturnType<typeof vi.fn> };
	let mockExportService: { executeExport: ReturnType<typeof vi.fn> };
	let pipelines: Map<string, SavedMultiImportPipeline>;
	let exportConfigs: Map<string, SavedExportConfig>;
	let executor: PipelineExecutor;

	beforeEach(() => {
		eventBus = new EventBus();
		fileSystem = createMockFileSystem();
		mockImportService = { executeImport: vi.fn(async () => makeSuccessResult()) };
		mockExportService = { executeExport: vi.fn(async () => ({ totalRows: 0, totalColumns: 0, outputPath: "" })) };
		pipelines = new Map();
		exportConfigs = new Map();

		const deps: PipelineExecutorDeps = {
			eventBus,
			importService: mockImportService as never,
			exportService: mockExportService as never,
			fileSystem,
			getPipeline: (id) => pipelines.get(id),
			getExportConfig: (id) => exportConfigs.get(id),
		};
		executor = new PipelineExecutor(deps);
	});

	// ── Validation ───────────────────────────────────────────

	describe("validation", () => {
		it("should throw when pipeline not found", async () => {
			await expect(executor.executePipeline("nonexistent")).rejects.toThrow("Pipeline not found");
		});

		it("should throw when pipeline has no sources", async () => {
			const pipe = makePipeline({ sources: [] });
			pipelines.set(pipe.id, pipe);
			await expect(executor.executePipeline(pipe.id)).rejects.toThrow("no sources");
		});
	});

	// ── Single source execution ──────────────────────────────

	describe("single source execution", () => {
		it("should call importService.executeImport with correct config", async () => {
			const pipe = makePipeline();
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			expect(mockImportService.executeImport).toHaveBeenCalledOnce();
			const importConfig = mockImportService.executeImport.mock.calls[0][0];
			expect(importConfig.sourcePath).toBe("data/source1.csv");
			expect(importConfig.targetFolder).toBe("out/items");
			expect(importConfig.nameColumn).toBe("ItemID");
			expect(importConfig.conflictStrategy).toBe("update");
		});

		it("should auto-build merge key mapping", async () => {
			const pipe = makePipeline();
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			const importConfig = mockImportService.executeImport.mock.calls[0][0];
			const mergeMapping = importConfig.columnMappings.find(
				(m: { frontmatterKey: string }) => m.frontmatterKey === "item_id",
			);
			expect(mergeMapping).toBeDefined();
			expect(mergeMapping.csvColumn).toBe("ItemID");
			expect(mergeMapping.included).toBe(true);
		});

		it("should filter out user mappings that target merge key", async () => {
			const pipe = makePipeline({
				sources: [
					{
						id: "s1", csvPath: "data.csv", mergeKeyColumn: "ItemID",
						columnMappings: [
							{ csvColumn: "ItemID", frontmatterKey: "item_id", included: true },
							{ csvColumn: "Name", frontmatterKey: "name", included: true },
						],
					},
				],
			});
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			const importConfig = mockImportService.executeImport.mock.calls[0][0];
			// Should have auto-built merge key + "name" mapping (user merge key filtered out)
			const mergeKeyMappings = importConfig.columnMappings.filter(
				(m: { frontmatterKey: string }) => m.frontmatterKey === "item_id",
			);
			expect(mergeKeyMappings).toHaveLength(1);
		});

		it("should aggregate results correctly", async () => {
			const pipe = makePipeline();
			pipelines.set(pipe.id, pipe);
			mockImportService.executeImport.mockResolvedValueOnce(makeSuccessResult(5, 3));

			const result = await executor.executePipeline(pipe.id);

			expect(result.totalSources).toBe(1);
			expect(result.completedSources).toBe(1);
			expect(result.totalRows).toBe(5);
			expect(result.created).toBe(3);
			expect(result.sourceResults).toHaveLength(1);
			expect(result.sourceResults[0].sourceId).toBe("s1");
		});
	});

	// ── Multi-source execution ───────────────────────────────

	describe("multi-source execution", () => {
		it("should process sources in order", async () => {
			const pipe = makePipeline({
				sources: [
					{ id: "s1", csvPath: "a.csv", mergeKeyColumn: "id", columnMappings: [{ csvColumn: "x", frontmatterKey: "x", included: true }] },
					{ id: "s2", csvPath: "b.csv", mergeKeyColumn: "id", columnMappings: [{ csvColumn: "y", frontmatterKey: "y", included: true }] },
				],
			});
			pipelines.set(pipe.id, pipe);

			mockImportService.executeImport
				.mockResolvedValueOnce(makeSuccessResult(2, 2))
				.mockResolvedValueOnce(makeUpdateResult(2));

			const result = await executor.executePipeline(pipe.id);

			expect(result.totalSources).toBe(2);
			expect(result.completedSources).toBe(2);
			expect(result.totalRows).toBe(4);
			expect(result.created).toBe(2);
			expect(result.updated).toBe(2);
			expect(result.sourceResults).toHaveLength(2);
		});

		it("should continue when one source fails", async () => {
			const pipe = makePipeline({
				sources: [
					{ id: "bad", csvPath: "bad.csv", mergeKeyColumn: "id", columnMappings: [] },
					{ id: "good", csvPath: "good.csv", mergeKeyColumn: "id", columnMappings: [] },
				],
			});
			pipelines.set(pipe.id, pipe);

			mockImportService.executeImport
				.mockRejectedValueOnce(new Error("File not found"))
				.mockResolvedValueOnce(makeSuccessResult(1, 1));

			const result = await executor.executePipeline(pipe.id);

			expect(result.completedSources).toBe(1);
			expect(result.sourceResults).toHaveLength(2);
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.failed).toBe(1);
		});

		it("should handle non-Error exceptions", async () => {
			const pipe = makePipeline({
				sources: [{ id: "s1", csvPath: "data.csv", mergeKeyColumn: "id", columnMappings: [] }],
			});
			pipelines.set(pipe.id, pipe);
			mockImportService.executeImport.mockRejectedValueOnce("string error");

			const result = await executor.executePipeline(pipe.id);

			expect(result.errors[0].error).toBe("string error");
		});
	});

	// ── Events ───────────────────────────────────────────────

	describe("events", () => {
		it("should emit pipeline.started before processing", async () => {
			const pipe = makePipeline();
			pipelines.set(pipe.id, pipe);

			const handler = vi.fn();
			eventBus.on("dataExchange.pipeline.started", handler);

			await executor.executePipeline(pipe.id);

			expect(handler).toHaveBeenCalledOnce();
			expect(handler.mock.calls[0][0].payload.totalSources).toBe(1);
		});

		it("should emit sourceCompleted for each successful source", async () => {
			const pipe = makePipeline({
				sources: [
					{ id: "s1", csvPath: "a.csv", mergeKeyColumn: "id", columnMappings: [] },
					{ id: "s2", csvPath: "b.csv", mergeKeyColumn: "id", columnMappings: [] },
				],
			});
			pipelines.set(pipe.id, pipe);

			const handler = vi.fn();
			eventBus.on("dataExchange.pipeline.sourceCompleted", handler);

			await executor.executePipeline(pipe.id);

			expect(handler).toHaveBeenCalledTimes(2);
			expect(handler.mock.calls[0][0].payload.sourceIndex).toBe(0);
			expect(handler.mock.calls[1][0].payload.sourceIndex).toBe(1);
		});

		it("should not emit sourceCompleted for failed sources", async () => {
			const pipe = makePipeline({
				sources: [{ id: "bad", csvPath: "bad.csv", mergeKeyColumn: "id", columnMappings: [] }],
			});
			pipelines.set(pipe.id, pipe);
			mockImportService.executeImport.mockRejectedValueOnce(new Error("fail"));

			const handler = vi.fn();
			eventBus.on("dataExchange.pipeline.sourceCompleted", handler);

			await executor.executePipeline(pipe.id);

			expect(handler).not.toHaveBeenCalled();
		});
	});

	// ── noteType injection ───────────────────────────────────

	describe("noteType injection", () => {
		it("should inject noteType as type in customProperties", async () => {
			const pipe = makePipeline({ noteType: "Event" });
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			const importConfig = mockImportService.executeImport.mock.calls[0][0];
			expect(importConfig.customProperties.type).toBe("Event");
		});

		it("should not add type when noteType is undefined", async () => {
			const pipe = makePipeline({ noteType: undefined });
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			const importConfig = mockImportService.executeImport.mock.calls[0][0];
			expect(importConfig.customProperties).toBeUndefined();
		});

		it("should preserve source customProperties alongside type", async () => {
			const pipe = makePipeline({
				noteType: "Asset",
				sources: [{
					id: "s1", csvPath: "data.csv", mergeKeyColumn: "id",
					columnMappings: [],
					customProperties: { origin: "batch" },
				}],
			});
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			const importConfig = mockImportService.executeImport.mock.calls[0][0];
			expect(importConfig.customProperties.type).toBe("Asset");
			expect(importConfig.customProperties.origin).toBe("batch");
		});
	});

	// ── namePrefix / nameSuffix ──────────────────────────────

	describe("namePrefix and nameSuffix", () => {
		it("should pass namePrefix to importConfig", async () => {
			const pipe = makePipeline({ namePrefix: "PRE-" });
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			const importConfig = mockImportService.executeImport.mock.calls[0][0];
			expect(importConfig.namePrefix).toBe("PRE-");
		});

		it("should pass nameSuffix to importConfig", async () => {
			const pipe = makePipeline({ nameSuffix: "-v2" });
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			const importConfig = mockImportService.executeImport.mock.calls[0][0];
			expect(importConfig.nameSuffix).toBe("-v2");
		});
	});

	// ── createBase ────────────────────────────────────────────

	describe("createPipelineBaseFile", () => {
		it("should create .base file when createBase is true", async () => {
			const pipe = makePipeline({ createBase: true });
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			const createCalls = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls;
			const baseCalls = createCalls.filter((c: unknown[]) => (c[0] as string).endsWith(".base"));
			expect(baseCalls.length).toBeGreaterThanOrEqual(1);
		});

		it("should not create .base file when createBase is false", async () => {
			const pipe = makePipeline({ createBase: false });
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			const createCalls = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls;
			const baseCalls = createCalls.filter((c: unknown[]) => (c[0] as string).endsWith(".base"));
			expect(baseCalls).toHaveLength(0);
		});

		it("should use default path when basePath is empty", async () => {
			const pipe = makePipeline({ createBase: true, basePath: "" });
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			const createCalls = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls;
			const baseCalls = createCalls.filter((c: unknown[]) => (c[0] as string).endsWith(".base"));
			expect(baseCalls.length).toBeGreaterThanOrEqual(1);
			expect(baseCalls[0][0]).toContain("out/items/");
		});

		it("should use custom basePath when provided", async () => {
			const pipe = makePipeline({ createBase: true, basePath: "custom/view.base" });
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			const createCalls = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls;
			const baseCalls = createCalls.filter((c: unknown[]) => (c[0] as string).endsWith(".base"));
			expect(baseCalls.length).toBeGreaterThanOrEqual(1);
			expect(baseCalls[0][0]).toBe("custom/view.base");
		});

		it("should not overwrite existing base file", async () => {
			const pipe = makePipeline({ createBase: true, basePath: "existing.base" });
			pipelines.set(pipe.id, pipe);
			// readFile succeeds → file exists
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValueOnce("existing content");

			await executor.executePipeline(pipe.id);

			const createCalls = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls;
			const baseCalls = createCalls.filter((c: unknown[]) => (c[0] as string).endsWith(".base"));
			expect(baseCalls).toHaveLength(0);
		});

		it("should include all source columns in base file", async () => {
			const pipe = makePipeline({
				createBase: true,
				noteType: "Event",
				sources: [
					{
						id: "s1", csvPath: "a.csv", mergeKeyColumn: "id",
						columnMappings: [
							{ csvColumn: "Name", frontmatterKey: "name", included: true },
							{ csvColumn: "Status", frontmatterKey: "status", included: true },
						],
					},
				],
			});
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			const createCalls = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls;
			const baseCalls = createCalls.filter((c: unknown[]) => (c[0] as string).endsWith(".base"));
			const baseContent = baseCalls[0][1] as string;
			expect(baseContent).toContain('"item_id"'); // merge key
			expect(baseContent).toContain('"name"');
			expect(baseContent).toContain('"status"');
			expect(baseContent).toContain('"type"'); // from noteType
		});

		it("should include customProperties from sources in base columns", async () => {
			const pipe = makePipeline({
				createBase: true,
				sources: [{
					id: "s1", csvPath: "a.csv", mergeKeyColumn: "id",
					columnMappings: [],
					customProperties: { origin: "batch" },
				}],
			});
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			const createCalls = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls;
			const baseCalls = createCalls.filter((c: unknown[]) => (c[0] as string).endsWith(".base"));
			const baseContent = baseCalls[0][1] as string;
			expect(baseContent).toContain('"origin"');
		});

		it("should include filter for target folder", async () => {
			const pipe = makePipeline({ createBase: true });
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			const createCalls = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls;
			const baseCalls = createCalls.filter((c: unknown[]) => (c[0] as string).endsWith(".base"));
			const baseContent = baseCalls[0][1] as string;
			expect(baseContent).toContain('inFolder("out/items")');
		});

		it("should append .base extension when missing", async () => {
			const pipe = makePipeline({ createBase: true, basePath: "custom/view" });
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			const createCalls = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls;
			const baseCalls = createCalls.filter((c: unknown[]) => (c[0] as string).endsWith(".base"));
			expect(baseCalls[0][0]).toBe("custom/view.base");
		});
	});

	// ── Linked exports ───────────────────────────────────────

	describe("linked exports", () => {
		it("should execute linked export configs", async () => {
			const exportCfg: SavedExportConfig = {
				id: "exp-1",
				name: "Auto Export",
				createdAt: 1000,
				sourcePath: "out/items",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/items.csv",
				columns: ["name"],
				fileProperties: ["file.name"],
			};
			exportConfigs.set("exp-1", exportCfg);

			const pipe = makePipeline({ exportConfigIds: ["exp-1"] });
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			expect(mockExportService.executeExport).toHaveBeenCalledOnce();
			const exportConfig = mockExportService.executeExport.mock.calls[0][0];
			expect(exportConfig.sourcePath).toBe("out/items");
			expect(exportConfig.outputPath).toBe("exports/items.csv");
		});

		it("should skip missing export configs", async () => {
			const pipe = makePipeline({ exportConfigIds: ["nonexistent"] });
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			expect(mockExportService.executeExport).not.toHaveBeenCalled();
		});

		it("should continue when linked export fails", async () => {
			const exportCfg: SavedExportConfig = {
				id: "exp-1",
				name: "Failing Export",
				createdAt: 1000,
				sourcePath: "src",
				sourceType: "folder",
				format: "csv",
				outputPath: "out.csv",
				columns: [],
				fileProperties: [],
			};
			exportConfigs.set("exp-1", exportCfg);
			mockExportService.executeExport.mockRejectedValueOnce(new Error("Export failed"));

			const pipe = makePipeline({ exportConfigIds: ["exp-1"] });
			pipelines.set(pipe.id, pipe);

			// Should not throw
			const result = await executor.executePipeline(pipe.id);
			expect(result.completedSources).toBe(1);
		});

		it("should not run exports when exportConfigIds is undefined", async () => {
			const pipe = makePipeline({ exportConfigIds: undefined });
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			expect(mockExportService.executeExport).not.toHaveBeenCalled();
		});

		it("should execute multiple linked exports", async () => {
			exportConfigs.set("exp-1", {
				id: "exp-1", name: "Export A", createdAt: 1, sourcePath: "src", sourceType: "folder",
				format: "csv", outputPath: "a.csv", columns: [], fileProperties: [],
			});
			exportConfigs.set("exp-2", {
				id: "exp-2", name: "Export B", createdAt: 1, sourcePath: "src", sourceType: "folder",
				format: "tab", outputPath: "b.txt", columns: [], fileProperties: [],
			});

			const pipe = makePipeline({ exportConfigIds: ["exp-1", "exp-2"] });
			pipelines.set(pipe.id, pipe);

			await executor.executePipeline(pipe.id);

			expect(mockExportService.executeExport).toHaveBeenCalledTimes(2);
		});
	});
});
