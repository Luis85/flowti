import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { DataExchangeService } from "../../../src/domain/dataExchange/DataExchangeService";
import type { IFileSystemClient } from "../../../src/infrastructure/filesystem/types";
import type { IStorageProvider } from "../../../src/utils/types";

function createMockStorage(initialData: Record<string, unknown> = {}): IStorageProvider {
	let data: Record<string, unknown> = { ...initialData };
	return {
		load: vi.fn(async () => data),
		save: vi.fn(async (d: unknown) => { data = d as Record<string, unknown>; }),
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

describe("DataExchangeService", () => {
	let service: DataExchangeService;
	let eventBus: IEventBus;
	let fileSystem: IFileSystemClient;

	beforeEach(() => {
		eventBus = new EventBus();
		fileSystem = createMockFileSystem();
		service = new DataExchangeService({
			eventBus,
			fileSystem,
			listFiles: () => [],
		});
	});

	describe("event handling", () => {
		it("should emit import.completed on successful import", async () => {
			const completedHandler = vi.fn();
			eventBus.on("dataExchange.import.completed", completedHandler);

			// Mock file system to return CSV then throw for file-not-found
			let callCount = 0;
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockImplementation(async () => {
				callCount++;
				if (callCount === 1) return "name\nTest";
				throw new Error("Not found");
			});

			await eventBus.emit("dataExchange.import.execute", {
				config: {
					sourcePath: "data.csv",
					targetFolder: "out",
					nameColumn: "name",
					columnMappings: [
						{ csvColumn: "name", frontmatterKey: "name", included: true },
					],
					conflictStrategy: "skip" as const,
				},
			});

			// Wait for async handler
			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(completedHandler).toHaveBeenCalledOnce();
			expect(completedHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						result: expect.objectContaining({ created: 1 }),
					}),
				})
			);
		});

		it("should emit import.failed on error", async () => {
			const failedHandler = vi.fn();
			eventBus.on("dataExchange.import.failed", failedHandler);

			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(
				new Error("File not found")
			);

			await eventBus.emit("dataExchange.import.execute", {
				config: {
					sourcePath: "missing.csv",
					targetFolder: "out",
					nameColumn: "name",
					columnMappings: [],
					conflictStrategy: "skip" as const,
				},
			});

			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(failedHandler).toHaveBeenCalledOnce();
			expect(failedHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						error: expect.stringContaining("File not found"),
					}),
				})
			);
		});

		it("should emit export.completed on successful export", async () => {
			const completedHandler = vi.fn();
			eventBus.on("dataExchange.export.completed", completedHandler);

			await eventBus.emit("dataExchange.export.execute", {
				config: {
					sourcePath: "items",
					sourceType: "folder" as const,
					format: "csv" as const,
					outputPath: "out.csv",
					columns: [],
					fileProperties: [],
				},
			});

			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(completedHandler).toHaveBeenCalledOnce();
		});

		it("should emit export.failed on error", async () => {
			const failedHandler = vi.fn();
			eventBus.on("dataExchange.export.failed", failedHandler);

			(fileSystem.createFile as ReturnType<typeof vi.fn>).mockRejectedValue(
				new Error("Write failed")
			);

			await eventBus.emit("dataExchange.export.execute", {
				config: {
					sourcePath: "items",
					sourceType: "folder" as const,
					format: "csv" as const,
					outputPath: "out.csv",
					columns: [],
					fileProperties: [],
				},
			});

			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(failedHandler).toHaveBeenCalledOnce();
		});
	});

	describe("getImportService / getExportService", () => {
		it("should expose sub-services", () => {
			expect(service.getImportService()).toBeDefined();
			expect(service.getExportService()).toBeDefined();
		});
	});

	describe("setWriteExternalFile", () => {
		it("should pass through to export service", async () => {
			const writeExternal = vi.fn(async () => {});
			service.setWriteExternalFile(writeExternal);

			// Export with isExternal should use the injected callback
			const exportService = service.getExportService();
			const result = await exportService.executeExport({
				sourcePath: "items",
				sourceType: "folder",
				format: "csv",
				outputPath: "C:\\external\\out.csv",
				columns: [],
				fileProperties: [],
				isExternal: true,
			});

			expect(writeExternal).toHaveBeenCalledOnce();
			expect(result.outputPath).toBe("C:\\external\\out.csv");
		});
	});

	describe("dispose", () => {
		it("should unsubscribe event listeners", async () => {
			const handler = vi.fn();
			eventBus.on("dataExchange.import.completed", handler);

			service.dispose();

			// After dispose, emitting import.execute should not trigger completed
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue("name\nTest");

			await eventBus.emit("dataExchange.import.execute", {
				config: {
					sourcePath: "data.csv",
					targetFolder: "out",
					nameColumn: "name",
					columnMappings: [],
					conflictStrategy: "skip" as const,
				},
			});

			await new Promise((resolve) => setTimeout(resolve, 50));

			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("config persistence", () => {
		let storage: IStorageProvider;
		let svc: DataExchangeService;

		beforeEach(() => {
			storage = createMockStorage();
			svc = new DataExchangeService({
				eventBus: new EventBus(),
				fileSystem: createMockFileSystem(),
				storage,
			});
		});

		describe("import configs", () => {
			it("should save and retrieve import configs", async () => {
				const saved = await svc.saveImportConfig({
					name: "My Import",
					targetFolder: "out/items",
					nameColumn: "name",
					columnMappings: [
						{ csvColumn: "name", frontmatterKey: "name", included: true },
					],
					conflictStrategy: "skip",
				});

				expect(saved.id).toBeTruthy();
				expect(saved.name).toBe("My Import");
				expect(saved.createdAt).toBeGreaterThan(0);

				const configs = svc.getSavedImportConfigs();
				expect(configs).toHaveLength(1);
				expect(configs[0].name).toBe("My Import");
				expect(configs[0].targetFolder).toBe("out/items");
			});

			it("should persist import configs to storage", async () => {
				await svc.saveImportConfig({
					name: "Persisted",
					targetFolder: "folder",
					nameColumn: "id",
					columnMappings: [],
					conflictStrategy: "overwrite",
				});

				expect(storage.save).toHaveBeenCalled();
				const storedData = (await storage.load()) as Record<string, unknown>;
				const state = storedData.dataExchange as {
					savedImportConfigs: unknown[];
				};
				expect(state.savedImportConfigs).toHaveLength(1);
			});

			it("should delete import configs", async () => {
				const saved = await svc.saveImportConfig({
					name: "To Delete",
					targetFolder: "tmp",
					nameColumn: "x",
					columnMappings: [],
					conflictStrategy: "skip",
				});

				await svc.deleteImportConfig(saved.id);
				expect(svc.getSavedImportConfigs()).toHaveLength(0);
			});

			it("should load persisted import configs", async () => {
				const mockStorage = createMockStorage({
					dataExchange: {
						savedImportConfigs: [
							{
								id: "abc",
								name: "Existing",
								createdAt: 1000,
								targetFolder: "out",
								nameColumn: "name",
								columnMappings: [],
								conflictStrategy: "skip",
							},
						],
						savedExportConfigs: [],
					},
				});

				const loadedSvc = new DataExchangeService({
					eventBus: new EventBus(),
					fileSystem: createMockFileSystem(),
					storage: mockStorage,
				});
				await loadedSvc.load();

				const configs = loadedSvc.getSavedImportConfigs();
				expect(configs).toHaveLength(1);
				expect(configs[0].name).toBe("Existing");
			});
		});

		describe("export configs", () => {
			it("should save and retrieve export configs", async () => {
				const saved = await svc.saveExportConfig({
					name: "My Export",
					sourcePath: "data.base",
					sourceType: "base",
					format: "csv",
					outputPath: "out.csv",
					columns: ["stage", "domain"],
					fileProperties: ["file.name"],
					baseViewIndex: 0,
					conflictStrategy: "overwrite",
				});

				expect(saved.id).toBeTruthy();
				expect(saved.name).toBe("My Export");

				const configs = svc.getSavedExportConfigs();
				expect(configs).toHaveLength(1);
				expect(configs[0].columns).toEqual(["stage", "domain"]);
			});

			it("should persist export configs to storage", async () => {
				await svc.saveExportConfig({
					name: "Persisted Export",
					sourcePath: "items",
					sourceType: "folder",
					format: "tab",
					outputPath: "items.txt",
					columns: ["name"],
					fileProperties: [],
				});

				const storedData = (await storage.load()) as Record<string, unknown>;
				const state = storedData.dataExchange as {
					savedExportConfigs: unknown[];
				};
				expect(state.savedExportConfigs).toHaveLength(1);
			});

			it("should delete export configs", async () => {
				const saved = await svc.saveExportConfig({
					name: "To Delete",
					sourcePath: "x",
					sourceType: "folder",
					format: "csv",
					outputPath: "x.csv",
					columns: [],
					fileProperties: [],
				});

				await svc.deleteExportConfig(saved.id);
				expect(svc.getSavedExportConfigs()).toHaveLength(0);
			});

			it("should load persisted export configs", async () => {
				const mockStorage = createMockStorage({
					dataExchange: {
						savedImportConfigs: [],
						savedExportConfigs: [
							{
								id: "xyz",
								name: "Existing Export",
								createdAt: 2000,
								sourcePath: "data.base",
								sourceType: "base",
								format: "csv",
								outputPath: "out.csv",
								columns: ["col1"],
								fileProperties: ["file.name"],
							},
						],
					},
				});

				const loadedSvc = new DataExchangeService({
					eventBus: new EventBus(),
					fileSystem: createMockFileSystem(),
					storage: mockStorage,
				});
				await loadedSvc.load();

				const configs = loadedSvc.getSavedExportConfigs();
				expect(configs).toHaveLength(1);
				expect(configs[0].name).toBe("Existing Export");
			});
		});

		it("should work without storage (no-op)", async () => {
			const noStorageSvc = new DataExchangeService({
				eventBus: new EventBus(),
				fileSystem: createMockFileSystem(),
			});
			await noStorageSvc.load(); // Should not throw
			expect(noStorageSvc.getSavedImportConfigs()).toHaveLength(0);
			expect(noStorageSvc.getSavedExportConfigs()).toHaveLength(0);

			// Save should also not throw
			await noStorageSvc.saveImportConfig({
				name: "test",
				targetFolder: "tmp",
				nameColumn: "x",
				columnMappings: [],
				conflictStrategy: "skip",
			});
			// Still stored in memory
			expect(noStorageSvc.getSavedImportConfigs()).toHaveLength(1);
		});
	});

	describe("config path tracking on rename", () => {
		let bus: IEventBus;
		let storage: IStorageProvider;
		let svc: DataExchangeService;

		beforeEach(() => {
			bus = new EventBus();
			storage = createMockStorage();
			svc = new DataExchangeService({
				eventBus: bus,
				fileSystem: createMockFileSystem(),
				storage,
			});
		});

		describe("file.renamed", () => {
			it("should update export sourcePath when source file is renamed", async () => {
				await svc.saveExportConfig({
					name: "Base Export",
					sourcePath: "data/views.base",
					sourceType: "base",
					format: "csv",
					outputPath: "data/out.csv",
					columns: ["col1"],
					fileProperties: ["file.name"],
				});

				await bus.emit("file.renamed", {
					oldPath: "data/views.base",
					newPath: "data/renamed.base",
					source: "obsidian",
				});
				await new Promise((r) => setTimeout(r, 50));

				const configs = svc.getSavedExportConfigs();
				expect(configs[0].sourcePath).toBe("data/renamed.base");
			});

			it("should update export outputPath when output file is renamed", async () => {
				await svc.saveExportConfig({
					name: "Export",
					sourcePath: "items",
					sourceType: "folder",
					format: "csv",
					outputPath: "exports/report.csv",
					columns: [],
					fileProperties: [],
				});

				await bus.emit("file.renamed", {
					oldPath: "exports/report.csv",
					newPath: "exports/report-v2.csv",
					source: "obsidian",
				});
				await new Promise((r) => setTimeout(r, 50));

				expect(svc.getSavedExportConfigs()[0].outputPath).toBe("exports/report-v2.csv");
			});

			it("should NOT update outputPath when config is external", async () => {
				await svc.saveExportConfig({
					name: "External",
					sourcePath: "items",
					sourceType: "folder",
					format: "csv",
					outputPath: "C:\\external\\report.csv",
					columns: [],
					fileProperties: [],
					isExternal: true,
				});

				await bus.emit("file.renamed", {
					oldPath: "C:\\external\\report.csv",
					newPath: "C:\\external\\moved.csv",
					source: "obsidian",
				});
				await new Promise((r) => setTimeout(r, 50));

				// External paths are not vault paths, should not be updated
				expect(svc.getSavedExportConfigs()[0].outputPath).toBe("C:\\external\\report.csv");
			});

			it("should not modify configs when path does not match", async () => {
				await svc.saveExportConfig({
					name: "Unrelated",
					sourcePath: "other/file.base",
					sourceType: "base",
					format: "csv",
					outputPath: "other/out.csv",
					columns: [],
					fileProperties: [],
				});

				await bus.emit("file.renamed", {
					oldPath: "data/views.base",
					newPath: "data/renamed.base",
					source: "obsidian",
				});
				await new Promise((r) => setTimeout(r, 50));

				const cfg = svc.getSavedExportConfigs()[0];
				expect(cfg.sourcePath).toBe("other/file.base");
				expect(cfg.outputPath).toBe("other/out.csv");
			});

			it("should persist changes after rename", async () => {
				await svc.saveExportConfig({
					name: "Tracked",
					sourcePath: "old.base",
					sourceType: "base",
					format: "csv",
					outputPath: "out.csv",
					columns: [],
					fileProperties: [],
				});

				const saveSpy = storage.save as ReturnType<typeof vi.fn>;
				const callsBefore = saveSpy.mock.calls.length;

				await bus.emit("file.renamed", {
					oldPath: "old.base",
					newPath: "new.base",
					source: "obsidian",
				});
				await new Promise((r) => setTimeout(r, 50));

				expect(saveSpy.mock.calls.length).toBeGreaterThan(callsBefore);
			});
		});

		describe("folder.renamed", () => {
			it("should update export sourcePath when parent folder is renamed", async () => {
				await svc.saveExportConfig({
					name: "Nested",
					sourcePath: "projects/alpha/data.base",
					sourceType: "base",
					format: "csv",
					outputPath: "projects/alpha/export.csv",
					columns: [],
					fileProperties: [],
				});

				await bus.emit("folder.renamed", {
					oldPath: "projects/alpha",
					newPath: "projects/beta",
					source: "obsidian",
				});
				await new Promise((r) => setTimeout(r, 50));

				const cfg = svc.getSavedExportConfigs()[0];
				expect(cfg.sourcePath).toBe("projects/beta/data.base");
				expect(cfg.outputPath).toBe("projects/beta/export.csv");
			});

			it("should update export sourcePath when source folder itself is renamed", async () => {
				await svc.saveExportConfig({
					name: "Folder Export",
					sourcePath: "items/inbox",
					sourceType: "folder",
					format: "csv",
					outputPath: "items/inbox_export.csv",
					columns: [],
					fileProperties: [],
				});

				await bus.emit("folder.renamed", {
					oldPath: "items/inbox",
					newPath: "items/processed",
					source: "obsidian",
				});
				await new Promise((r) => setTimeout(r, 50));

				expect(svc.getSavedExportConfigs()[0].sourcePath).toBe("items/processed");
			});

			it("should update import targetFolder when folder is renamed", async () => {
				await svc.saveImportConfig({
					name: "Import",
					targetFolder: "data/imports/csv",
					nameColumn: "name",
					columnMappings: [],
					conflictStrategy: "skip",
				});

				await bus.emit("folder.renamed", {
					oldPath: "data/imports",
					newPath: "data/incoming",
					source: "obsidian",
				});
				await new Promise((r) => setTimeout(r, 50));

				expect(svc.getSavedImportConfigs()[0].targetFolder).toBe("data/incoming/csv");
			});

			it("should not match partial folder name overlap", async () => {
				await svc.saveExportConfig({
					name: "No Match",
					sourcePath: "projects/alpha-backup/data.base",
					sourceType: "base",
					format: "csv",
					outputPath: "out.csv",
					columns: [],
					fileProperties: [],
				});

				await bus.emit("folder.renamed", {
					oldPath: "projects/alpha",
					newPath: "projects/beta",
					source: "obsidian",
				});
				await new Promise((r) => setTimeout(r, 50));

				// "projects/alpha-backup" should NOT match "projects/alpha"
				expect(svc.getSavedExportConfigs()[0].sourcePath).toBe("projects/alpha-backup/data.base");
			});

			it("should emit config.changed after folder rename updates", async () => {
				await svc.saveExportConfig({
					name: "Tracked",
					sourcePath: "old-folder/data.base",
					sourceType: "base",
					format: "csv",
					outputPath: "out.csv",
					columns: [],
					fileProperties: [],
				});

				const changedHandler = vi.fn();
				bus.on("dataExchange.config.changed", changedHandler);

				await bus.emit("folder.renamed", {
					oldPath: "old-folder",
					newPath: "new-folder",
					source: "obsidian",
				});
				await new Promise((r) => setTimeout(r, 50));

				expect(changedHandler).toHaveBeenCalled();
			});
		});
	});
});
