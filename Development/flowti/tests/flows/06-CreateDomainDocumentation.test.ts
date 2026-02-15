/**
 * Flow 06: Create Domain Documentation
 *
 * Tests the documentation creation workflow:
 * Open catalog → navigate to entity tab → create new doc →
 * edit content → view cross-references → mark as area (domains only).
 *
 * Event sequence:
 *   doc.create → doc.created (or doc.exists / doc.failed)
 *   doc.delete → doc.deleted
 *
 * NOTE: DocService auto-generates content only for FlowDoc, SystemDoc,
 * ActorDoc, ProductDoc. DomainDoc/ServiceDoc/ArchitectureDoc/AreaDoc
 * require caller-provided `content` since they need catalog context.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { DocService } from "../../src/domain/docs/DocService";
import { DEFAULT_SETTINGS } from "../../src/domain/settings/settings";
import { createMockFileSystem, waitForAsync } from "./testHelpers";

describe("Flow 06: Create Domain Documentation", () => {
	let eventBus: IEventBus;
	let fileSystem: ReturnType<typeof createMockFileSystem>;
	let docService: DocService;

	beforeEach(async () => {
		eventBus = new EventBus();
		fileSystem = createMockFileSystem();
		docService = new DocService({ eventBus, fileSystem });

		// DocService needs settings to resolve paths
		await eventBus.emit("settings.loaded", { settings: DEFAULT_SETTINGS });
	});

	describe("create domain doc (with content)", () => {
		it("should create a DomainDoc when content is provided", async () => {
			const createdHandler = vi.fn();
			eventBus.on("doc.created", createdHandler);

			await eventBus.emit("doc.create", {
				docType: "DomainDoc",
				name: "Billing",
				entityType: "domains",
				source: "DomainsTab",
				content: "---\ntype: DomainDoc\ndomain: Billing\n---\n# Billing\n",
			});

			await waitForAsync();

			expect(createdHandler).toHaveBeenCalledOnce();
			expect(createdHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						created: true,
						docType: "DomainDoc",
						name: "Billing",
					}),
				}),
			);
		});

		it("should create file at correct path under docsRootPath/Domains/", async () => {
			await eventBus.emit("doc.create", {
				docType: "DomainDoc",
				name: "Billing",
				entityType: "domains",
				source: "DomainsTab",
				content: "---\ntype: DomainDoc\ndomain: Billing\n---\n# Billing\n",
			});

			await waitForAsync();

			expect(fileSystem.createFile).toHaveBeenCalledOnce();
			const [path, content] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toContain("Domains/Billing.md");
			expect(content).toContain("type: DomainDoc");
		});

		it("should emit doc.failed when no content is provided for DomainDoc", async () => {
			const failedHandler = vi.fn();
			eventBus.on("doc.failed", failedHandler);

			await eventBus.emit("doc.create", {
				docType: "DomainDoc",
				name: "Billing",
				entityType: "domains",
				source: "DomainsTab",
				// No content — no auto-generator for DomainDoc
			});

			await waitForAsync();
			expect(failedHandler).toHaveBeenCalledOnce();
		});
	});

	describe("create auto-generated entity docs", () => {
		it("should create a FlowDoc with auto-generated content", async () => {
			const createdHandler = vi.fn();
			eventBus.on("doc.created", createdHandler);

			await eventBus.emit("doc.create", {
				docType: "FlowDoc",
				name: "Order Processing",
				entityType: "flows",
				source: "FlowsTab",
			});

			await waitForAsync();
			expect(createdHandler).toHaveBeenCalledOnce();

			const [path, content] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toContain("Flows/Order Processing.md");
			expect(content).toContain("type: FlowDoc");
		});

		it("should create a SystemDoc with auto-generated content", async () => {
			await eventBus.emit("doc.create", {
				docType: "SystemDoc",
				name: "ERP",
				entityType: "systems",
				source: "SystemsTab",
			});

			await waitForAsync();

			const [path] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toContain("Systems/ERP.md");
		});

		it("should create an ActorDoc with auto-generated content", async () => {
			await eventBus.emit("doc.create", {
				docType: "ActorDoc",
				name: "Administrator",
				entityType: "actors",
				source: "ActorsTab",
			});

			await waitForAsync();

			const [path] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toContain("Actors/Administrator.md");
		});

		it("should create a ProductDoc with auto-generated content", async () => {
			await eventBus.emit("doc.create", {
				docType: "ProductDoc",
				name: "Analytics Dashboard",
				entityType: "products",
				source: "ProductsTab",
			});

			await waitForAsync();

			const [path] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toContain("Products/Analytics Dashboard.md");
		});
	});

	describe("create docs with caller-provided content", () => {
		it("should create a ServiceDoc when content is provided", async () => {
			const createdHandler = vi.fn();
			eventBus.on("doc.created", createdHandler);

			await eventBus.emit("doc.create", {
				docType: "ServiceDoc",
				name: "PaymentService",
				entityType: "services",
				source: "ServicesTab",
				content: "---\ntype: ServiceDoc\nservice: PaymentService\n---\n# PaymentService\n",
			});

			await waitForAsync();
			expect(createdHandler).toHaveBeenCalledOnce();

			const [path] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toContain("Services/PaymentService.md");
		});
	});

	describe("mark domain as area", () => {
		it("should create an AreaDoc at explicit path", async () => {
			const createdHandler = vi.fn();
			eventBus.on("doc.created", createdHandler);

			await eventBus.emit("doc.create", {
				docType: "AreaDoc",
				name: "Billing",
				path: "02 - Areas/Billing/Billing.md",
				source: "DomainsTab",
				content: "---\ntype: AreaDoc\nname: Billing\n---\n# Billing Area\n",
			});

			await waitForAsync();
			expect(createdHandler).toHaveBeenCalledOnce();

			const [path, content] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toBe("02 - Areas/Billing/Billing.md");
			expect(content).toContain("type: AreaDoc");
		});
	});

	describe("architecture doc", () => {
		it("should create an ArchitectureDoc when content is provided", async () => {
			const createdHandler = vi.fn();
			eventBus.on("doc.created", createdHandler);

			await eventBus.emit("doc.create", {
				docType: "ArchitectureDoc",
				name: "Billing",
				entityType: "domains",
				source: "DomainsTab",
				content: "---\ntype: ArchitectureDoc\ndomain: Billing\n---\n# Billing Architecture\n```mermaid\ngraph TD\n```\n",
			});

			await waitForAsync();
			expect(createdHandler).toHaveBeenCalledOnce();

			const [path, content] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toContain("Billing.architecture.md");
			expect(content).toContain("type: ArchitectureDoc");
		});
	});

	describe("delete doc", () => {
		it("should delete a doc via doc.delete event", async () => {
			// Pre-create a file (cast to any to call mock directly)
			await (fileSystem.createFile as unknown as (path: string, content: string) => Promise<void>)("docs/Domains/Old.md", "content");

			const deletedHandler = vi.fn();
			eventBus.on("doc.deleted", deletedHandler);

			await eventBus.emit("doc.delete", {
				path: "docs/Domains/Old.md",
				source: "DomainsTab",
			});

			await waitForAsync();
			expect(deletedHandler).toHaveBeenCalledOnce();
			expect(fileSystem.deleteFile).toHaveBeenCalledWith("docs/Domains/Old.md");
		});
	});

	describe("duplicate detection", () => {
		it("should emit doc.exists when file already exists and upsert is false", async () => {
			// DocService.fileExists() uses readFile — mock it to return content
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
				"---\ntype: FlowDoc\n---\nExisting content",
			);

			const existsHandler = vi.fn();
			eventBus.on("doc.exists", existsHandler);

			await eventBus.emit("doc.create", {
				docType: "FlowDoc",
				name: "Existing Flow",
				entityType: "flows",
				source: "FlowsTab",
				upsert: false,
			});

			await waitForAsync();
			expect(existsHandler).toHaveBeenCalledOnce();
		});
	});

	describe("settings sync", () => {
		it("should update docsRootPath when settings change", async () => {
			const createdHandler = vi.fn();
			eventBus.on("doc.created", createdHandler);

			await eventBus.emit("settings.changed", {
				settings: {
					...DEFAULT_SETTINGS,
					docsRootPath: "Custom/Docs",
				},
			});

			// FlowDoc has auto-generator, so no content needed
			await eventBus.emit("doc.create", {
				docType: "FlowDoc",
				name: "Test",
				entityType: "flows",
				source: "FlowsTab",
			});

			await waitForAsync();

			const [path] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toContain("Custom/Docs");
		});
	});

	it.skip("should render entity detail panel with cross-references (requires Obsidian View)", () => {
		// Detail panel shows Related Flows, Systems, Actors sections.
	});

	it.skip("should open file in Obsidian editor on click (requires workspace.openFile)", () => {
		// Clicking doc name navigates to the markdown file.
	});
});
