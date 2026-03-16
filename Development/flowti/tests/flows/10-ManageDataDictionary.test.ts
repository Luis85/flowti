/**
 * Flow 10: Manage Data Dictionary
 *
 * Tests the data dictionary management workflow:
 * Import CSV → open hub → navigate to properties tab →
 * explore property details → create documentation →
 * save configs → track usage across imports/exports.
 *
 * Event sequence:
 *   dataExchange.import.completed → dataExchange.config.changed →
 *   (property doc creation via DocService)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { parseYaml } from "obsidian";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { DataExchangeService } from "../../src/domain/dataExchange/DataExchangeService";
import type { DataExchangeState } from "../../src/domain/dataExchange/types";
import { createMockStorage, createMockFileSystem, waitForAsync } from "./testHelpers";

describe("Flow 10: Manage Data Dictionary", () => {
	let eventBus: IEventBus;
	let service: DataExchangeService;
	let fileSystem: ReturnType<typeof createMockFileSystem>;

	beforeEach(async () => {
		eventBus = new EventBus();
		fileSystem = createMockFileSystem({
			"data/contacts.csv": "name,email,role\nAlice,alice@co.com,Dev",
		});
		const storageMock = createMockStorage<DataExchangeState>();

		service = new DataExchangeService({
			eventBus,
			fileSystem,
			yamlParser: { parse: (c: string) => parseYaml(c) as Record<string, unknown> | null },
			storage: storageMock.storage,
			listFiles: () => [],
		});

		await service.load();
	});

	describe("import config management", () => {
		it("should save an import config after successful import", async () => {
			const config = await service.saveImportConfig({
				name: "Contacts Import",
				sourcePath: "data/contacts.csv",
				targetFolder: "People",
				nameColumn: "name",
				columnMappings: [
					{ csvColumn: "name", frontmatterKey: "name", included: true },
					{ csvColumn: "email", frontmatterKey: "email", included: true },
					{ csvColumn: "role", frontmatterKey: "role", included: true },
				],
				conflictStrategy: "skip",
			});

			expect(config.id).toBeDefined();
			expect(config.name).toBe("Contacts Import");
			expect(service.getSavedImportConfigs()).toHaveLength(1);
		});

		it("should find configs by CSV file path", async () => {
			await service.saveImportConfig({
				name: "Config A",
				sourcePath: "data/contacts.csv",
				targetFolder: "People",
				nameColumn: "name",
				columnMappings: [],
				conflictStrategy: "skip",
			});

			await service.saveImportConfig({
				name: "Config B",
				sourcePath: "data/other.csv",
				targetFolder: "Other",
				nameColumn: "name",
				columnMappings: [],
				conflictStrategy: "skip",
			});

			const matching = service.getImportConfigsForFile("data/contacts.csv");
			expect(matching).toHaveLength(1);
			expect(matching[0].name).toBe("Config A");
		});

		it("should update an import config", async () => {
			const config = await service.saveImportConfig({
				name: "Original",
				sourcePath: "x.csv",
				targetFolder: "Out",
				nameColumn: "name",
				columnMappings: [],
				conflictStrategy: "skip",
			});

			const updated = await service.updateImportConfig(config.id, {
				name: "Updated Name",
			});

			expect(updated?.name).toBe("Updated Name");
			expect(service.getImportConfig(config.id)?.name).toBe("Updated Name");
		});

		it("should toggle import config favourite", async () => {
			const config = await service.saveImportConfig({
				name: "Fav Test",
				sourcePath: "x.csv",
				targetFolder: "Out",
				nameColumn: "name",
				columnMappings: [],
				conflictStrategy: "skip",
			});

			await service.toggleImportFavourite(config.id);
			expect(service.getImportConfig(config.id)?.favourite).toBe(true);

			await service.toggleImportFavourite(config.id);
			expect(service.getImportConfig(config.id)?.favourite).toBe(false);
		});
	});

	describe("export config management", () => {
		it("should save and retrieve export configs", async () => {
			const config = await service.saveExportConfig({
				name: "Notes Export",
				sourcePath: "Notes",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/notes.csv",
				columns: ["title", "status"],
				fileProperties: [],
			});

			expect(config.id).toBeDefined();
			expect(service.getSavedExportConfigs()).toHaveLength(1);
		});

		it("should find export configs by source path", async () => {
			await service.saveExportConfig({
				name: "Export A",
				sourcePath: "Notes",
				sourceType: "folder",
				format: "csv",
				outputPath: "a.csv",
				columns: [],
				fileProperties: [],
			});

			const matching = service.getExportConfigsForSource("Notes");
			expect(matching).toHaveLength(1);
			expect(matching[0].name).toBe("Export A");
		});

		it("should find export configs by output path", async () => {
			await service.saveExportConfig({
				name: "Export B",
				sourcePath: "Data",
				sourceType: "folder",
				format: "csv",
				outputPath: "exports/data.csv",
				columns: [],
				fileProperties: [],
			});

			const matching = service.getExportConfigsForOutput("exports/data.csv");
			expect(matching).toHaveLength(1);
		});
	});

	describe("CSV display settings", () => {
		it("should save and retrieve CSV display settings", async () => {
			await service.saveCsvDisplaySettings("data/contacts.csv", {
				sortColumn: "name",
				sortDirection: "asc",
				hiddenColumns: [],
				filterColumn: null,
				filterText: "",
				maxPreviewRows: 100,
			});

			const settings = service.getCsvDisplaySettings("data/contacts.csv");
			expect(settings).toBeDefined();
			expect(settings?.sortColumn).toBe("name");
		});

		it("should hide and unhide CSV files", async () => {
			await service.hideCsv("data/hidden.csv");
			expect(service.getHiddenCsvPaths()).toContain("data/hidden.csv");

			await service.unhideCsv("data/hidden.csv");
			expect(service.getHiddenCsvPaths()).not.toContain("data/hidden.csv");
		});
	});

	describe("documentation paths", () => {
		it("should resolve CSV doc path", () => {
			const path = service.getCsvDocPath("data/contacts.csv");
			expect(path).toBeDefined();
			expect(typeof path).toBe("string");
		});

		it("should resolve config doc path", () => {
			const importPath = service.getConfigDocPath("MyImport", "import");
			const exportPath = service.getConfigDocPath("MyExport", "export");
			expect(importPath).toBeDefined();
			expect(exportPath).toBeDefined();
		});

		it("should resolve property doc path", () => {
			const path = service.getPropertyDocPath("email");
			expect(path).toBeDefined();
			expect(typeof path).toBe("string");
		});
	});

	describe("data dictionary building", () => {
		it("should build data dictionary from saved configs", async () => {
			await service.saveImportConfig({
				name: "Config",
				sourcePath: "data.csv",
				targetFolder: "Out",
				nameColumn: "name",
				columnMappings: [
					{ csvColumn: "name", frontmatterKey: "name", included: true },
					{ csvColumn: "email", frontmatterKey: "email", included: true },
				],
				conflictStrategy: "skip",
			});

			const dictionary = service.buildDataDictionary();
			expect(Array.isArray(dictionary)).toBe(true);
			// Dictionary should contain entries for mapped properties
		});
	});

	describe("config.changed event", () => {
		it("should emit dataExchange.config.changed on config save", async () => {
			const changedHandler = vi.fn();
			eventBus.on("dataExchange.config.changed", changedHandler);

			await service.saveImportConfig({
				name: "Trigger Config Change",
				sourcePath: "x.csv",
				targetFolder: "Out",
				nameColumn: "name",
				columnMappings: [],
				conflictStrategy: "skip",
			});

			await waitForAsync();
			expect(changedHandler).toHaveBeenCalled();
		});

		it("should emit dataExchange.config.changed on config delete", async () => {
			const config = await service.saveImportConfig({
				name: "To Delete",
				sourcePath: "x.csv",
				targetFolder: "Out",
				nameColumn: "name",
				columnMappings: [],
				conflictStrategy: "skip",
			});

			const changedHandler = vi.fn();
			eventBus.on("dataExchange.config.changed", changedHandler);

			await service.deleteImportConfig(config.id);
			await waitForAsync();

			expect(changedHandler).toHaveBeenCalled();
		});
	});

	describe("path tracking on rename", () => {
		it("should update config paths when a file is renamed", async () => {
			await service.saveImportConfig({
				name: "Rename Test",
				sourcePath: "data/old.csv",
				targetFolder: "Out",
				nameColumn: "name",
				columnMappings: [],
				conflictStrategy: "skip",
			});

			await eventBus.emit("file.renamed", {
				path: "data/new.csv",
				oldPath: "data/old.csv",
				newPath: "data/new.csv",
				source: "user" as const,
			});
			await waitForAsync();

			const configs = service.getImportConfigsForFile("data/new.csv");
			expect(configs).toHaveLength(1);
			expect(configs[0].sourcePath).toBe("data/new.csv");
		});
	});

	it.skip("should render Data Exchange Hub with tabs (requires Obsidian ItemView)", () => {
		// DataExchangeHubView extends ItemView with Configs/Properties/Pipelines tabs.
	});

	it.skip("should render property detail panel with usage tracking (requires UI rendering)", () => {
		// Property detail shows which imports/exports use each frontmatter key.
	});

	it.skip("should create property documentation via DocService (requires integrated DocService)", () => {
		// service.createPropertyDoc() calls DocService indirectly via fileSystem.
	});
});
