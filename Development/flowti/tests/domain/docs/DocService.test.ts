import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import type { IFileSystemClient } from "../../../src/infrastructure/filesystem/types";
import { DocService } from "../../../src/domain/docs/DocService";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/settings";

function createMockFileSystem(existingFiles: Record<string, string> = {}): IFileSystemClient {
	const files = new Map(Object.entries(existingFiles));
	return {
		fileExists: vi.fn(async (path: string) => files.has(path)),
		createFile: vi.fn(async (path: string, content: string) => {
			files.set(path, content);
		}),
		readFile: vi.fn(async (path: string) => {
			const content = files.get(path);
			if (content === undefined) throw new Error(`File not found: ${path}`);
			return content;
		}),
		updateFile: vi.fn(async (path: string, content: string) => {
			files.set(path, content);
		}),
		deleteFile: vi.fn(async (path: string) => {
			files.delete(path);
		}),
		moveFile: vi.fn(async () => ""),
		renameFile: vi.fn(async () => ""),
		getFrontmatter: vi.fn(async () => ({})),
		updateFrontmatter: vi.fn(async () => ({})),
		setFrontmatter: vi.fn(async () => undefined),
	};
}

describe("DocService", () => {
	let service: DocService;
	let eventBus: IEventBus;
	let fileSystem: IFileSystemClient;

	beforeEach(async () => {
		eventBus = new EventBus();
		fileSystem = createMockFileSystem();
		service = new DocService({ eventBus, fileSystem });

		// Simulate settings.loaded so DocService caches paths
		await eventBus.emit("settings.loaded", { settings: DEFAULT_SETTINGS });
	});

	describe("doc.create with auto-resolved path and content", () => {
		it("should create a FlowDoc with auto-generated content", async () => {
			const created = vi.fn();
			eventBus.on("doc.created", (e) => created(e.payload));

			await eventBus.emit("doc.create", {
				docType: "FlowDoc",
				name: "Order Processing",
				entityType: "flows",
				source: "FlowsTab",
			});

			expect(fileSystem.createFile).toHaveBeenCalledOnce();
			const [path, content] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toContain("Flows/Order Processing.md");
			expect(content).toContain("type: FlowDoc");
			expect(content).toContain("Order Processing");

			expect(created).toHaveBeenCalledWith(
				expect.objectContaining({
					created: true,
					docType: "FlowDoc",
					name: "Order Processing",
					source: "FlowsTab",
				}),
			);
		});

		it("should create a SystemDoc with auto-generated content", async () => {
			await eventBus.emit("doc.create", {
				docType: "SystemDoc",
				name: "ERP",
				entityType: "systems",
			});

			const [path, content] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toContain("Systems/ERP.md");
			expect(content).toContain("type: SystemDoc");
		});

		it("should create an ActorDoc with auto-generated content", async () => {
			await eventBus.emit("doc.create", {
				docType: "ActorDoc",
				name: "Product Owner",
				entityType: "actors",
			});

			const [path, content] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toContain("Actors/Product Owner.md");
			expect(content).toContain("type: ActorDoc");
		});

		it("should create a ProductDoc with auto-generated content", async () => {
			await eventBus.emit("doc.create", {
				docType: "ProductDoc",
				name: "Catalog App",
				entityType: "products",
			});

			const [path, content] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toContain("Products/Catalog App.md");
			expect(content).toContain("type: ProductDoc");
		});
	});

	describe("doc.create with explicit content", () => {
		it("should use provided content instead of generating", async () => {
			const customContent = "---\ntype: DomainDoc\ndomain: Sales\n---\n# Sales\n";

			await eventBus.emit("doc.create", {
				docType: "DomainDoc",
				name: "Sales",
				entityType: "domains",
				content: customContent,
			});

			expect(fileSystem.createFile).toHaveBeenCalledWith(
				expect.stringContaining("Domains/Sales.md"),
				customContent,
				{ createFolders: true },
			);
		});
	});

	describe("doc.create with explicit path", () => {
		it("should use provided path instead of resolving", async () => {
			await eventBus.emit("doc.create", {
				docType: "AreaDoc",
				name: "Operations",
				path: "02 - Areas/Operations/Operations.md",
				content: "---\ntype: AreaDoc\n---\n# Operations\n",
			});

			expect(fileSystem.createFile).toHaveBeenCalledWith(
				"02 - Areas/Operations/Operations.md",
				expect.stringContaining("type: AreaDoc"),
				{ createFolders: true },
			);
		});
	});

	describe("existence checks", () => {
		it("should emit doc.exists when file already present and upsert is false", async () => {
			const exists = vi.fn();
			eventBus.on("doc.exists", (e) => exists(e.payload));

			// Pre-populate existing file
			fileSystem = createMockFileSystem({
				"03 - Resources/Documentation/Reference/Flows/Existing Flow.md": "old content",
			});
			service.dispose();
			service = new DocService({ eventBus, fileSystem });
			await eventBus.emit("settings.loaded", { settings: DEFAULT_SETTINGS });

			await eventBus.emit("doc.create", {
				docType: "FlowDoc",
				name: "Existing Flow",
				entityType: "flows",
			});

			expect(fileSystem.createFile).not.toHaveBeenCalled();
			expect(exists).toHaveBeenCalledWith(
				expect.objectContaining({
					docType: "FlowDoc",
					name: "Existing Flow",
				}),
			);
		});

		it("should update file when upsert is true and file exists", async () => {
			const created = vi.fn();
			eventBus.on("doc.created", (e) => created(e.payload));

			fileSystem = createMockFileSystem({
				"03 - Resources/Documentation/Reference/Flows/My Flow.md": "old",
			});
			service.dispose();
			service = new DocService({ eventBus, fileSystem });
			await eventBus.emit("settings.loaded", { settings: DEFAULT_SETTINGS });

			await eventBus.emit("doc.create", {
				docType: "FlowDoc",
				name: "My Flow",
				entityType: "flows",
				upsert: true,
			});

			expect(fileSystem.updateFile).toHaveBeenCalledOnce();
			expect(created).toHaveBeenCalledWith(
				expect.objectContaining({
					created: false,
					updated: true,
					docType: "FlowDoc",
				}),
			);
		});
	});

	describe("error handling", () => {
		it("should emit doc.failed when path cannot be resolved", async () => {
			const failed = vi.fn();
			eventBus.on("doc.failed", (e) => failed(e.payload));

			await eventBus.emit("doc.create", {
				docType: "CsvDoc",
				name: "test",
				// No path, no entityType — can't resolve
			});

			expect(failed).toHaveBeenCalledWith(
				expect.objectContaining({
					docType: "CsvDoc",
					name: "test",
					error: expect.stringContaining("path"),
				}),
			);
		});

		it("should emit doc.failed when content cannot be generated", async () => {
			const failed = vi.fn();
			eventBus.on("doc.failed", (e) => failed(e.payload));

			await eventBus.emit("doc.create", {
				docType: "DomainDoc",
				name: "Test",
				entityType: "domains",
				// No content provided, and DomainDoc needs events context
			});

			expect(failed).toHaveBeenCalledWith(
				expect.objectContaining({
					docType: "DomainDoc",
					error: expect.stringContaining("content"),
				}),
			);
		});

		it("should emit doc.failed when file creation throws", async () => {
			const failed = vi.fn();
			eventBus.on("doc.failed", (e) => failed(e.payload));

			(fileSystem.createFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
				new Error("Disk full"),
			);

			await eventBus.emit("doc.create", {
				docType: "FlowDoc",
				name: "Broken",
				entityType: "flows",
			});

			expect(failed).toHaveBeenCalledWith(
				expect.objectContaining({
					docType: "FlowDoc",
					name: "Broken",
					error: "Disk full",
				}),
			);
		});
	});

	describe("doc.delete", () => {
		it("should delete file and emit doc.deleted", async () => {
			const deleted = vi.fn();
			eventBus.on("doc.deleted", (e) => deleted(e.payload));

			await eventBus.emit("doc.delete", {
				path: "some/doc.md",
				source: "DomainsTab",
			});

			expect(fileSystem.deleteFile).toHaveBeenCalledWith("some/doc.md");
			expect(deleted).toHaveBeenCalledWith(
				expect.objectContaining({
					path: "some/doc.md",
					source: "DomainsTab",
				}),
			);
		});
	});

	describe("settings sync", () => {
		it("should update docsRootPath from settings.changed", async () => {
			const customSettings = {
				...DEFAULT_SETTINGS,
				docsRootPath: "Custom/Docs",
			};
			await eventBus.emit("settings.changed", { settings: customSettings });

			expect(service.getDocsRootPath()).toBe("Custom/Docs");
		});

		it("should resolve paths using updated settings", async () => {
			const customSettings = {
				...DEFAULT_SETTINGS,
				docsRootPath: "My Docs",
			};
			await eventBus.emit("settings.changed", { settings: customSettings });

			await eventBus.emit("doc.create", {
				docType: "FlowDoc",
				name: "Test",
				entityType: "flows",
			});

			const [path] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toBe("My Docs/Flows/Test.md");
		});
	});

	describe("dispose", () => {
		it("should stop listening to events after dispose", async () => {
			service.dispose();

			await eventBus.emit("doc.create", {
				docType: "FlowDoc",
				name: "After Dispose",
				entityType: "flows",
			});

			expect(fileSystem.createFile).not.toHaveBeenCalled();
		});
	});
});
