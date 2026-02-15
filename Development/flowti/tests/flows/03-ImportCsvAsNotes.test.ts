/**
 * Flow 03: Import CSV as Notes
 *
 * Tests the CSV import workflow:
 * Open CSV → configure column mappings → preview → execute import →
 * notes created in vault → save configuration.
 *
 * Event sequence:
 *   dataExchange.import.execute → dataExchange.import.progress ×N →
 *   dataExchange.import.completed
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { DataExchangeService } from "../../src/domain/dataExchange/DataExchangeService";
import type { DataExchangeState } from "../../src/domain/dataExchange/types";
import { createMockStorage, createMockFileSystem, waitForAsync } from "./testHelpers";

describe("Flow 03: Import CSV as Notes", () => {
	let eventBus: IEventBus;
	let service: DataExchangeService;
	let fileSystem: ReturnType<typeof createMockFileSystem>;

	beforeEach(() => {
		eventBus = new EventBus();
		fileSystem = createMockFileSystem({
			"data/contacts.csv": "name,email,role\nAlice,alice@test.com,Dev\nBob,bob@test.com,PM",
		});
		const storageMock = createMockStorage<DataExchangeState>();
		service = new DataExchangeService({
			eventBus,
			fileSystem,
			storage: storageMock.storage,
			listFiles: () => [],
		});
	});

	describe("successful import", () => {
		it("should emit import.completed with correct counts on successful import", async () => {
			const completedHandler = vi.fn();
			eventBus.on("dataExchange.import.completed", completedHandler);

			await eventBus.emit("dataExchange.import.execute", {
				config: {
					sourcePath: "data/contacts.csv",
					targetFolder: "People",
					nameColumn: "name",
					columnMappings: [
						{ csvColumn: "name", frontmatterKey: "name", included: true },
						{ csvColumn: "email", frontmatterKey: "email", included: true },
						{ csvColumn: "role", frontmatterKey: "role", included: true },
					],
					conflictStrategy: "skip" as const,
				},
			});

			await waitForAsync(100);

			expect(completedHandler).toHaveBeenCalledOnce();
			expect(completedHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						result: expect.objectContaining({
							created: 2,
						}),
					}),
				}),
			);
		});

		it("should create note files in the target folder", async () => {
			await eventBus.emit("dataExchange.import.execute", {
				config: {
					sourcePath: "data/contacts.csv",
					targetFolder: "People",
					nameColumn: "name",
					columnMappings: [
						{ csvColumn: "name", frontmatterKey: "name", included: true },
						{ csvColumn: "email", frontmatterKey: "email", included: true },
					],
					conflictStrategy: "skip" as const,
				},
			});

			await waitForAsync(100);

			const createCalls = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls;
			const paths = createCalls.map((c: string[]) => c[0]);
			expect(paths).toContainEqual(expect.stringContaining("People/Alice.md"));
			expect(paths).toContainEqual(expect.stringContaining("People/Bob.md"));
		});

		it("should include YAML frontmatter in created notes", async () => {
			await eventBus.emit("dataExchange.import.execute", {
				config: {
					sourcePath: "data/contacts.csv",
					targetFolder: "People",
					nameColumn: "name",
					columnMappings: [
						{ csvColumn: "email", frontmatterKey: "email", included: true },
						{ csvColumn: "role", frontmatterKey: "role", included: true },
					],
					conflictStrategy: "skip" as const,
				},
			});

			await waitForAsync(100);

			const createCalls = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls;
			const aliceCall = createCalls.find((c: string[]) => c[0].includes("Alice"));
			expect(aliceCall).toBeDefined();
			const content = aliceCall![1] as string;
			expect(content).toContain("---");
			// ImportService generates YAML frontmatter with column values
			expect(content).toContain("email");
			expect(content).toContain("alice@test.com");
		});
	});

	describe("import failure", () => {
		it("should emit import.failed when CSV file is missing", async () => {
			const failedHandler = vi.fn();
			eventBus.on("dataExchange.import.failed", failedHandler);

			await eventBus.emit("dataExchange.import.execute", {
				config: {
					sourcePath: "data/missing.csv",
					targetFolder: "People",
					nameColumn: "name",
					columnMappings: [],
					conflictStrategy: "skip" as const,
				},
			});

			await waitForAsync(100);
			expect(failedHandler).toHaveBeenCalledOnce();
		});
	});

	describe("conflict strategies", () => {
		it("should skip existing files with skip strategy", async () => {
			// Pre-create Alice
			(fileSystem.fileExists as ReturnType<typeof vi.fn>).mockImplementation(
				async (path: string) => path.includes("Alice"),
			);

			const completedHandler = vi.fn();
			eventBus.on("dataExchange.import.completed", completedHandler);

			await eventBus.emit("dataExchange.import.execute", {
				config: {
					sourcePath: "data/contacts.csv",
					targetFolder: "People",
					nameColumn: "name",
					columnMappings: [
						{ csvColumn: "name", frontmatterKey: "name", included: true },
					],
					conflictStrategy: "skip" as const,
				},
			});

			await waitForAsync(100);

			expect(completedHandler).toHaveBeenCalledOnce();
			const result = completedHandler.mock.calls[0][0].payload.result;
			expect(result.skipped).toBeGreaterThanOrEqual(1);
		});
	});

	describe("config persistence", () => {
		it("should save and retrieve import configs", async () => {
			await service.load();

			const saved = await service.saveImportConfig({
				name: "Contacts Import",
				sourcePath: "data/contacts.csv",
				targetFolder: "People",
				nameColumn: "name",
				columnMappings: [
					{ csvColumn: "name", frontmatterKey: "name", included: true },
				],
				conflictStrategy: "skip",
			});

			expect(saved.id).toBeDefined();
			expect(saved.name).toBe("Contacts Import");

			const retrieved = service.getImportConfig(saved.id);
			expect(retrieved).toBeDefined();
			expect(retrieved!.name).toBe("Contacts Import");
		});

		it("should delete import configs", async () => {
			await service.load();

			const saved = await service.saveImportConfig({
				name: "Temp Config",
				sourcePath: "x.csv",
				targetFolder: "Out",
				nameColumn: "name",
				columnMappings: [],
				conflictStrategy: "skip",
			});

			await service.deleteImportConfig(saved.id);
			expect(service.getImportConfig(saved.id)).toBeUndefined();
		});
	});

	it.skip("should render ImportModal 4-page wizard (requires Obsidian Modal)", () => {
		// ImportModal extends Modal with step-by-step wizard UI.
	});

	it.skip("should show CSV preview table in ImportModal (requires DOM rendering)", () => {
		// Preview table renders parsed CSV rows in HTML table.
	});
});
