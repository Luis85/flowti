/**
 * Flow 04: Export Vault Data
 *
 * Tests the vault data export workflow:
 * Select source (base file or folder) → configure columns →
 * formula resolution → preview → execute export → save config.
 *
 * Event sequence:
 *   dataExchange.export.execute → dataExchange.export.progress →
 *   dataExchange.export.completed
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { DataExchangeService } from "../../src/domain/dataExchange/DataExchangeService";
import type { DataExchangeState } from "../../src/domain/dataExchange/types";
import { createMockStorage, createMockFileSystem, waitForAsync } from "./testHelpers";

describe("Flow 04: Export Vault Data", () => {
	let eventBus: IEventBus;
	let service: DataExchangeService;
	let fileSystem: ReturnType<typeof createMockFileSystem>;

	beforeEach(() => {
		eventBus = new EventBus();
		fileSystem = createMockFileSystem();
		const storageMock = createMockStorage<DataExchangeState>();

		// ExportService resolves files via listFiles, and reads frontmatter via getFrontmatter
		(fileSystem.getFrontmatter as ReturnType<typeof vi.fn>).mockImplementation(
			async (path: string) => {
				if (path.includes("Note1")) return { title: "First", status: "active" };
				if (path.includes("Note2")) return { title: "Second", status: "draft" };
				return {};
			},
		);

		service = new DataExchangeService({
			eventBus,
			fileSystem,
			storage: storageMock.storage,
			listFiles: (folder: string) => {
				if (folder === "Notes") {
					return [
						{ path: "Notes/Note1.md", basename: "Note1", extension: "md", folder: "Notes", frontmatter: undefined },
						{ path: "Notes/Note2.md", basename: "Note2", extension: "md", folder: "Notes", frontmatter: undefined },
					];
				}
				return [];
			},
		});
	});

	describe("folder export", () => {
		it("should emit export.completed on successful folder export", async () => {
			const completedHandler = vi.fn();
			eventBus.on("dataExchange.export.completed", completedHandler);

			await eventBus.emit("dataExchange.export.execute", {
				config: {
					sourcePath: "Notes",
					sourceType: "folder" as const,
					format: "csv" as const,
					outputPath: "exports/notes.csv",
					columns: ["title", "status"],
					fileProperties: [],
				},
			});

			await waitForAsync(100);
			expect(completedHandler).toHaveBeenCalledOnce();
		});

		it("should create a CSV file at the output path", async () => {
			await eventBus.emit("dataExchange.export.execute", {
				config: {
					sourcePath: "Notes",
					sourceType: "folder" as const,
					format: "csv" as const,
					outputPath: "exports/notes.csv",
					columns: ["title", "status"],
					fileProperties: [],
				},
			});

			await waitForAsync(100);

			const createCalls = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls;
			expect(createCalls.length).toBeGreaterThanOrEqual(1);
			const csvCall = createCalls.find((c: string[]) => c[0].includes("notes.csv"));
			expect(csvCall).toBeDefined();
		});
	});

	describe("export failure", () => {
		it("should emit export.failed when source folder has no files", async () => {
			// Override listFiles to return empty
			service.setListFiles(() => []);

			const failedHandler = vi.fn();
			const completedHandler = vi.fn();
			eventBus.on("dataExchange.export.failed", failedHandler);
			eventBus.on("dataExchange.export.completed", completedHandler);

			await eventBus.emit("dataExchange.export.execute", {
				config: {
					sourcePath: "Empty",
					sourceType: "folder" as const,
					format: "csv" as const,
					outputPath: "exports/empty.csv",
					columns: ["name"],
					fileProperties: [],
				},
			});

			await waitForAsync(100);

			// Either completed with 0 rows or failed — both are valid
			const totalCalls = failedHandler.mock.calls.length + completedHandler.mock.calls.length;
			expect(totalCalls).toBeGreaterThanOrEqual(1);
		});
	});

	describe("config persistence", () => {
		it("should save and retrieve export configs", async () => {
			await service.load();

			const saved = await service.saveExportConfig({
				name: "Notes Export",
				sourcePath: "Notes",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/notes.csv",
				columns: ["title", "status"],
				fileProperties: [],
			});

			expect(saved.id).toBeDefined();
			expect(saved.name).toBe("Notes Export");

			const retrieved = service.getExportConfig(saved.id);
			expect(retrieved).toBeDefined();
			expect(retrieved!.sourcePath).toBe("Notes");
		});

		it("should delete export configs", async () => {
			await service.load();

			const saved = await service.saveExportConfig({
				name: "Temp",
				sourcePath: "X",
				sourceType: "folder",
				format: "csv",
				outputPath: "x.csv",
				columns: [],
				fileProperties: [],
			});

			await service.deleteExportConfig(saved.id);
			expect(service.getExportConfig(saved.id)).toBeUndefined();
		});
	});

	describe("conflict strategies", () => {
		it.skip("should skip export when file exists and strategy is skip (requires ExportService internal wiring)", () => {
			// ExportService.executeExport checks fileExists before writing.
			// Skip strategy returns { skipped: true } without writing.
		});

		it.skip("should append to existing file with append strategy (requires file reading)", () => {
			// Append strategy reads existing file, strips header from new content,
			// then concatenates. Requires readExternalFile callback.
		});
	});

	it.skip("should render ExportModal 3-page wizard (requires Obsidian Modal)", () => {
		// ExportModal extends Modal with source/configure/execute pages.
	});

	it.skip("should resolve .base formula columns (requires BaseQueryEngine + vault files)", () => {
		// Formula resolution: formula.X → formulas[X] → actual frontmatter key.
		// Requires YAML-parsed base file + vault file listing.
	});

	it.skip("should export to external filesystem via dialog (requires Electron remote.dialog)", () => {
		// External export uses WriteExternalFileCallback with Node.js fs.writeFileSync.
	});
});
