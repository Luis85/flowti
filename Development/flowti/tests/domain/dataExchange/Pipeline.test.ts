import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { DataExchangeService } from "../../../src/domain/dataExchange/DataExchangeService";
import type { IFileSystemClient } from "../../../src/infrastructure/filesystem/types";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { DataExchangeState, MultiImportResult, SavedMultiImportPipeline } from "../../../src/domain/dataExchange/types";

function createMockStorage(initialState?: DataExchangeState): ITypedStorage<DataExchangeState> {
	let data: DataExchangeState | undefined = initialState;
	return {
		load: vi.fn(async () => data),
		save: vi.fn(async (state: DataExchangeState) => { data = state; }),
		safeLoad: vi.fn(async () => data),
		safeSave: vi.fn(async (state: DataExchangeState) => { data = state; return true; }),
	};
}

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

describe("Pipeline", () => {
	let eventBus: IEventBus;
	let fileSystem: IFileSystemClient;
	let storage: ITypedStorage<DataExchangeState>;
	let svc: DataExchangeService;

	beforeEach(() => {
		eventBus = new EventBus();
		fileSystem = createMockFileSystem();
		storage = createMockStorage();
		svc = new DataExchangeService({
			eventBus,
			fileSystem,
			storage,
			listFiles: () => [],
		});
	});

	// ── CRUD ────────────────────────────────────────────────

	describe("CRUD", () => {
		it("should save and retrieve a pipeline", async () => {
			const saved = await svc.savePipeline({
				name: "Daily Merge",
				targetFolder: "out/items",
				mergeKey: "item_id",
				sources: [],
			});

			expect(saved.id).toBeTruthy();
			expect(saved.name).toBe("Daily Merge");
			expect(saved.createdAt).toBeGreaterThan(0);
			expect(saved.mergeKey).toBe("item_id");

			const pipelines = svc.getSavedPipelines();
			expect(pipelines).toHaveLength(1);
			expect(pipelines[0].name).toBe("Daily Merge");
		});

		it("should get a pipeline by id", async () => {
			const saved = await svc.savePipeline({
				name: "Test",
				targetFolder: "out",
				mergeKey: "id",
				sources: [],
			});

			const found = svc.getPipeline(saved.id);
			expect(found).toBeDefined();
			expect(found!.name).toBe("Test");

			expect(svc.getPipeline("nonexistent")).toBeUndefined();
		});

		it("should update a pipeline", async () => {
			const saved = await svc.savePipeline({
				name: "Original",
				targetFolder: "out",
				mergeKey: "id",
				sources: [],
			});

			const updated = await svc.updatePipeline(saved.id, {
				name: "Updated",
				targetFolder: "new-out",
			});

			expect(updated).toBeDefined();
			expect(updated!.name).toBe("Updated");
			expect(updated!.targetFolder).toBe("new-out");
			expect(updated!.mergeKey).toBe("id"); // unchanged

			const configs = svc.getSavedPipelines();
			expect(configs[0].name).toBe("Updated");
		});

		it("should return undefined when updating nonexistent pipeline", async () => {
			const result = await svc.updatePipeline("missing", { name: "X" });
			expect(result).toBeUndefined();
		});

		it("should delete a pipeline", async () => {
			const saved = await svc.savePipeline({
				name: "To Delete",
				targetFolder: "tmp",
				mergeKey: "id",
				sources: [],
			});

			await svc.deletePipeline(saved.id);
			expect(svc.getSavedPipelines()).toHaveLength(0);
		});

		it("should toggle favourite", async () => {
			const saved = await svc.savePipeline({
				name: "Fav Test",
				targetFolder: "out",
				mergeKey: "id",
				sources: [],
			});

			expect(svc.getPipeline(saved.id)!.favourite).toBeFalsy();

			await svc.togglePipelineFavourite(saved.id);
			expect(svc.getPipeline(saved.id)!.favourite).toBe(true);

			await svc.togglePipelineFavourite(saved.id);
			expect(svc.getPipeline(saved.id)!.favourite).toBe(false);
		});

		it("should persist pipelines to storage", async () => {
			await svc.savePipeline({
				name: "Persisted",
				targetFolder: "out",
				mergeKey: "item_id",
				sources: [],
			});

			expect(storage.save).toHaveBeenCalled();
			const state = await storage.load();
			expect(state?.savedPipelines).toHaveLength(1);
		});

		it("should load persisted pipelines", async () => {
			const mockStorage = createMockStorage({
				savedImportConfigs: [],
				savedExportConfigs: [],
				savedPipelines: [
					{
						id: "pipe-1",
						name: "Existing Pipeline",
						createdAt: 1000,
						targetFolder: "out",
						mergeKey: "id",
						sources: [],
					},
				],
			});

			const loadedSvc = new DataExchangeService({
				eventBus: new EventBus(),
				fileSystem: createMockFileSystem(),
				storage: mockStorage,
			});
			await loadedSvc.load();

			const pipes = loadedSvc.getSavedPipelines();
			expect(pipes).toHaveLength(1);
			expect(pipes[0].name).toBe("Existing Pipeline");
		});

		it("should emit config.changed on save", async () => {
			const handler = vi.fn();
			eventBus.on("dataExchange.config.changed", handler);

			await svc.savePipeline({
				name: "Event Test",
				targetFolder: "out",
				mergeKey: "id",
				sources: [],
			});

			expect(handler).toHaveBeenCalled();
		});

		it("should emit config.changed on delete", async () => {
			const saved = await svc.savePipeline({
				name: "To Delete",
				targetFolder: "out",
				mergeKey: "id",
				sources: [],
			});

			const handler = vi.fn();
			eventBus.on("dataExchange.config.changed", handler);

			await svc.deletePipeline(saved.id);
			expect(handler).toHaveBeenCalled();
		});
	});

	// ── Execution ───────────────────────────────────────────

	describe("execution", () => {
		/**
		 * Helper: create a service with controlled CSV data.
		 * readFile returns the appropriate CSV content based on the path.
		 */
		function setupExecService(
			csvFiles: Record<string, string>,
		): { svc: DataExchangeService; bus: IEventBus; fs: IFileSystemClient } {
			const bus = new EventBus();
			const fs = createMockFileSystem();

			// readFile returns CSV content by path; for note existence checks, throw
			(fs.readFile as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
				if (csvFiles[path]) return csvFiles[path];
				throw new Error("File not found");
			});

			const service = new DataExchangeService({
				eventBus: bus,
				fileSystem: fs,
				storage: createMockStorage(),
				listFiles: () => [],
			});

			return { svc: service, bus, fs };
		}

		it("should execute a 2-source pipeline and aggregate results", async () => {
			const { svc: execSvc, bus } = setupExecService({
				"reports/source1.csv": "Item_ID,price\nA001,10\nA002,20",
				"reports/source2.csv": "item_id,weight\nA001,5\nA002,8",
			});

			const saved = await execSvc.savePipeline({
				name: "Merge Test",
				targetFolder: "out/items",
				mergeKey: "item_id",
				sources: [
					{
						id: "s1",
						csvPath: "reports/source1.csv",
						mergeKeyColumn: "Item_ID",
						columnMappings: [
							{ csvColumn: "price", frontmatterKey: "price", included: true },
						],
					},
					{
						id: "s2",
						csvPath: "reports/source2.csv",
						mergeKeyColumn: "item_id",
						columnMappings: [
							{ csvColumn: "weight", frontmatterKey: "weight", included: true },
						],
					},
				],
			});

			const completedHandler = vi.fn();
			bus.on("dataExchange.pipeline.completed", completedHandler);

			await bus.emit("dataExchange.pipeline.execute", {
				pipelineId: saved.id,
			});

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(completedHandler).toHaveBeenCalledOnce();
			const result: MultiImportResult = completedHandler.mock.calls[0][0].payload.result;
			expect(result.totalSources).toBe(2);
			expect(result.completedSources).toBe(2);
			expect(result.sourceResults).toHaveLength(2);
			// First source creates notes, second updates them
			expect(result.created).toBeGreaterThanOrEqual(2);
			expect(result.totalRows).toBe(4);
		});

		it("should emit started event before processing", async () => {
			const { svc: execSvc, bus } = setupExecService({
				"data.csv": "id,name\n1,Foo",
			});

			const saved = await execSvc.savePipeline({
				name: "Start Test",
				targetFolder: "out",
				mergeKey: "id",
				sources: [
					{
						id: "s1",
						csvPath: "data.csv",
						mergeKeyColumn: "id",
						columnMappings: [
							{ csvColumn: "name", frontmatterKey: "name", included: true },
						],
					},
				],
			});

			const startedHandler = vi.fn();
			bus.on("dataExchange.pipeline.started", startedHandler);

			await bus.emit("dataExchange.pipeline.execute", {
				pipelineId: saved.id,
			});

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(startedHandler).toHaveBeenCalledOnce();
			expect(startedHandler.mock.calls[0][0].payload.totalSources).toBe(1);
		});

		it("should emit sourceCompleted for each source", async () => {
			const { svc: execSvc, bus } = setupExecService({
				"a.csv": "id,x\n1,a",
				"b.csv": "id,y\n1,b",
			});

			const saved = await execSvc.savePipeline({
				name: "Progress Test",
				targetFolder: "out",
				mergeKey: "id",
				sources: [
					{ id: "s1", csvPath: "a.csv", mergeKeyColumn: "id", columnMappings: [{ csvColumn: "x", frontmatterKey: "x", included: true }] },
					{ id: "s2", csvPath: "b.csv", mergeKeyColumn: "id", columnMappings: [{ csvColumn: "y", frontmatterKey: "y", included: true }] },
				],
			});

			const sourceHandler = vi.fn();
			bus.on("dataExchange.pipeline.sourceCompleted", sourceHandler);

			await bus.emit("dataExchange.pipeline.execute", {
				pipelineId: saved.id,
			});

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(sourceHandler).toHaveBeenCalledTimes(2);
			expect(sourceHandler.mock.calls[0][0].payload.sourceIndex).toBe(0);
			expect(sourceHandler.mock.calls[1][0].payload.sourceIndex).toBe(1);
		});

		it("should continue processing when one source fails", async () => {
			const { svc: execSvc, bus } = setupExecService({
				// First source missing → will throw
				"good.csv": "id,val\n1,ok",
			});

			const saved = await execSvc.savePipeline({
				name: "Failure Test",
				targetFolder: "out",
				mergeKey: "id",
				sources: [
					{ id: "bad", csvPath: "missing.csv", mergeKeyColumn: "id", columnMappings: [] },
					{ id: "good", csvPath: "good.csv", mergeKeyColumn: "id", columnMappings: [{ csvColumn: "val", frontmatterKey: "val", included: true }] },
				],
			});

			const completedHandler = vi.fn();
			bus.on("dataExchange.pipeline.completed", completedHandler);

			await bus.emit("dataExchange.pipeline.execute", {
				pipelineId: saved.id,
			});

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(completedHandler).toHaveBeenCalledOnce();
			const result: MultiImportResult = completedHandler.mock.calls[0][0].payload.result;
			// Bad source failed, good source succeeded
			expect(result.sourceResults).toHaveLength(2);
			expect(result.errors.length).toBeGreaterThan(0);
			expect(result.completedSources).toBe(1); // only good source
		});

		it("should fail when pipeline has no sources", async () => {
			const saved = await svc.savePipeline({
				name: "Empty",
				targetFolder: "out",
				mergeKey: "id",
				sources: [],
			});

			const failedHandler = vi.fn();
			eventBus.on("dataExchange.pipeline.failed", failedHandler);

			await eventBus.emit("dataExchange.pipeline.execute", {
				pipelineId: saved.id,
			});

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(failedHandler).toHaveBeenCalledOnce();
			expect(failedHandler.mock.calls[0][0].payload.error).toContain("no sources");
		});

		it("should fail when pipeline does not exist", async () => {
			const failedHandler = vi.fn();
			eventBus.on("dataExchange.pipeline.failed", failedHandler);

			await eventBus.emit("dataExchange.pipeline.execute", {
				pipelineId: "nonexistent",
			});

			await new Promise((resolve) => setTimeout(resolve, 100));

			expect(failedHandler).toHaveBeenCalledOnce();
			expect(failedHandler.mock.calls[0][0].payload.error).toContain("not found");
		});

		it("should auto-map merge key column to canonical frontmatter key", async () => {
			const { svc: execSvc, bus, fs } = setupExecService({
				"source.csv": "Item_ID,description\nX1,Widget",
			});

			const saved = await execSvc.savePipeline({
				name: "Merge Key Test",
				targetFolder: "out",
				mergeKey: "item_id",
				sources: [
					{
						id: "s1",
						csvPath: "source.csv",
						mergeKeyColumn: "Item_ID",
						columnMappings: [
							{ csvColumn: "description", frontmatterKey: "description", included: true },
						],
					},
				],
			});

			await bus.emit("dataExchange.pipeline.execute", {
				pipelineId: saved.id,
			});

			await new Promise((resolve) => setTimeout(resolve, 100));

			// The createFile call should have frontmatter with "item_id" (canonical), not "Item_ID"
			const createCalls = (fs.createFile as ReturnType<typeof vi.fn>).mock.calls;
			// Filter out doc creation calls (which contain "Pipeline - ")
			const noteCalls = createCalls.filter(
				(c: unknown[]) => !(c[0] as string).includes("Pipeline - ") && !(c[0] as string).includes("Config - "),
			);
			expect(noteCalls.length).toBeGreaterThan(0);
			// Check that the content contains the canonical "item_id" key
			const noteContent = noteCalls[0][1] as string;
			expect(noteContent).toContain("item_id:");
		});
	});

	// ── Data dictionary integration ─────────────────────────

	describe("data dictionary", () => {
		it("should include pipeline merge key and source columns", async () => {
			await svc.savePipeline({
				name: "Dict Test",
				targetFolder: "out",
				mergeKey: "product_id",
				sources: [
					{
						id: "s1",
						csvPath: "prices.csv",
						mergeKeyColumn: "ProductID",
						columnMappings: [
							{ csvColumn: "price", frontmatterKey: "unit_price", included: true },
							{ csvColumn: "currency", frontmatterKey: "currency", included: false },
						],
					},
				],
			});

			const dict = svc.buildDataDictionary();
			const propNames = dict.map((e) => e.propertyName);

			// merge key should appear
			expect(propNames).toContain("product_id");
			// included column mapping should appear
			expect(propNames).toContain("unit_price");
		});
	});

	// ── Rename tracking ─────────────────────────────────────

	describe("rename tracking", () => {
		it("should update pipeline source csvPath on file rename", async () => {
			await svc.savePipeline({
				name: "Rename Test",
				targetFolder: "out",
				mergeKey: "id",
				sources: [
					{ id: "s1", csvPath: "data/report.csv", mergeKeyColumn: "id", columnMappings: [] },
				],
			});

			await eventBus.emit("file.renamed", {
				oldPath: "data/report.csv",
				newPath: "data/report-v2.csv",
				source: "obsidian",
			});
			await new Promise((r) => setTimeout(r, 50));

			const pipe = svc.getSavedPipelines()[0];
			expect(pipe.sources[0].csvPath).toBe("data/report-v2.csv");
		});

		it("should update pipeline targetFolder on folder rename", async () => {
			await svc.savePipeline({
				name: "Folder Rename",
				targetFolder: "projects/alpha/items",
				mergeKey: "id",
				sources: [
					{ id: "s1", csvPath: "projects/alpha/data.csv", mergeKeyColumn: "id", columnMappings: [] },
				],
			});

			await eventBus.emit("folder.renamed", {
				oldPath: "projects/alpha",
				newPath: "projects/beta",
				source: "obsidian",
			});
			await new Promise((r) => setTimeout(r, 50));

			const pipe = svc.getSavedPipelines()[0];
			expect(pipe.targetFolder).toBe("projects/beta/items");
			expect(pipe.sources[0].csvPath).toBe("projects/beta/data.csv");
		});

		it("should not match partial folder name overlap", async () => {
			await svc.savePipeline({
				name: "Partial",
				targetFolder: "projects/alpha-backup/items",
				mergeKey: "id",
				sources: [],
			});

			await eventBus.emit("folder.renamed", {
				oldPath: "projects/alpha",
				newPath: "projects/beta",
				source: "obsidian",
			});
			await new Promise((r) => setTimeout(r, 50));

			// "alpha-backup" should NOT match "alpha"
			expect(svc.getSavedPipelines()[0].targetFolder).toBe("projects/alpha-backup/items");
		});
	});

	// ── Note type / TypeDoc ─────────────────────────────────

	describe("noteType", () => {
		it("should inject type into customProperties during execution", async () => {
			const bus = new EventBus();
			const fs = createMockFileSystem();
			(fs.readFile as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
				if (path === "data.csv") return "id,name\n1,Foo\n2,Bar";
				throw new Error("File not found");
			});

			const execSvc = new DataExchangeService({
				eventBus: bus,
				fileSystem: fs,
				storage: createMockStorage(),
				listFiles: () => [],
			});

			const saved = await execSvc.savePipeline({
				name: "Typed Pipeline",
				targetFolder: "out/events",
				mergeKey: "id",
				noteType: "Event",
				sources: [
					{
						id: "s1",
						csvPath: "data.csv",
						mergeKeyColumn: "id",
						columnMappings: [
							{ csvColumn: "name", frontmatterKey: "name", included: true },
						],
					},
				],
			});

			const completedHandler = vi.fn();
			bus.on("dataExchange.pipeline.completed", completedHandler);

			await bus.emit("dataExchange.pipeline.execute", { pipelineId: saved.id });
			await new Promise((r) => setTimeout(r, 100));

			expect(completedHandler).toHaveBeenCalledOnce();

			// Verify createFile was called with content containing "type: Event"
			const createCalls = (fs.createFile as ReturnType<typeof vi.fn>).mock.calls;
			const noteCalls = createCalls.filter(
				(c: unknown[]) =>
					!(c[0] as string).includes("Pipeline - ") &&
					!(c[0] as string).includes("Config - ") &&
					!(c[0] as string).includes("Type - "),
			);
			expect(noteCalls.length).toBeGreaterThan(0);
			const noteContent = noteCalls[0][1] as string;
			expect(noteContent).toContain("type: Event");
		});

		it("should preserve existing source customProperties alongside type", async () => {
			const bus = new EventBus();
			const fs = createMockFileSystem();
			(fs.readFile as ReturnType<typeof vi.fn>).mockImplementation(async (path: string) => {
				if (path === "data.csv") return "id,val\n1,x";
				throw new Error("File not found");
			});

			const execSvc = new DataExchangeService({
				eventBus: bus,
				fileSystem: fs,
				storage: createMockStorage(),
				listFiles: () => [],
			});

			const saved = await execSvc.savePipeline({
				name: "Mixed Props",
				targetFolder: "out",
				mergeKey: "id",
				noteType: "Asset",
				sources: [
					{
						id: "s1",
						csvPath: "data.csv",
						mergeKeyColumn: "id",
						columnMappings: [
							{ csvColumn: "val", frontmatterKey: "val", included: true },
						],
						customProperties: { source: "csv-import" },
					},
				],
			});

			const completedHandler = vi.fn();
			bus.on("dataExchange.pipeline.completed", completedHandler);

			await bus.emit("dataExchange.pipeline.execute", { pipelineId: saved.id });
			await new Promise((r) => setTimeout(r, 100));

			const createCalls = (fs.createFile as ReturnType<typeof vi.fn>).mock.calls;
			const noteCalls = createCalls.filter(
				(c: unknown[]) =>
					!(c[0] as string).includes("Pipeline - ") &&
					!(c[0] as string).includes("Config - ") &&
					!(c[0] as string).includes("Type - "),
			);
			expect(noteCalls.length).toBeGreaterThan(0);
			const noteContent = noteCalls[0][1] as string;
			// Both type and source custom property should be present
			expect(noteContent).toContain("type: Asset");
			expect(noteContent).toContain("source: csv-import");
		});

		it("should tag dictionary entries with typeNames from pipeline noteType", async () => {
			await svc.savePipeline({
				name: "Typed Dict",
				targetFolder: "out",
				mergeKey: "item_id",
				noteType: "Event",
				sources: [
					{
						id: "s1",
						csvPath: "data.csv",
						mergeKeyColumn: "item_id",
						columnMappings: [
							{ csvColumn: "description", frontmatterKey: "description", included: true },
						],
					},
				],
			});

			const dict = svc.buildDataDictionary();
			const descEntry = dict.find((e) => e.propertyName === "description");
			expect(descEntry).toBeDefined();
			expect(descEntry!.typeNames).toContain("Event");

			// merge key should also be tagged
			const keyEntry = dict.find((e) => e.propertyName === "item_id");
			expect(keyEntry).toBeDefined();
			expect(keyEntry!.typeNames).toContain("Event");
		});

		it("should create TypeDoc on pipeline save with noteType", async () => {
			svc.setDocsRootPath("03 - Resources/Documentation/Reference");

			// Listen for doc.create event
			const docCreateEvents: unknown[] = [];
			eventBus.on("doc.create", (event) => {
				docCreateEvents.push(event.payload);
			});

			const saved = await svc.savePipeline({
				name: "Auto Type",
				targetFolder: "out",
				mergeKey: "id",
				noteType: "Service",
				sources: [
					{
						id: "s1",
						csvPath: "data.csv",
						mergeKeyColumn: "id",
						columnMappings: [
							{ csvColumn: "name", frontmatterKey: "name", included: true },
						],
					},
				],
			});

			// Wait for fire-and-forget TypeDoc creation
			await new Promise((r) => setTimeout(r, 100));

			// doc.create should be emitted for the TypeDoc
			const typeDocEvents = docCreateEvents.filter(
				(p: unknown) => (p as { docType: string }).docType === "TypeDoc",
			);
			expect(typeDocEvents.length).toBeGreaterThanOrEqual(1);

			// TypeDoc content should list the properties
			const payload = typeDocEvents[0] as { content: string; name: string; path: string };
			expect(payload.content).toContain("type: TypeDoc");
			expect(payload.content).toContain('name: "Service"');
			expect(payload.content).toContain("name"); // property in the list
			expect(payload.path).toContain("Type - Service");
			expect(saved.noteType).toBe("Service");
		});
	});
});
