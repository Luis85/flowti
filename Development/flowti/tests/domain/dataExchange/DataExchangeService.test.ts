import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { DataExchangeService } from "../../../src/domain/dataExchange/DataExchangeService";
import type { IFileSystemClient } from "../../../src/infrastructure/filesystem/types";

function createMockFileSystem(): IFileSystemClient {
	return {
		createFile: vi.fn(async () => {}),
		readFile: vi.fn(async () => ""),
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
});
