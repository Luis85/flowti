import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { InboxService } from "../../../src/domain/inbox/InboxService";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { InboxState, InboxItem } from "../../../src/domain/inbox/types";
import { MAX_INBOX_ITEMS } from "../../../src/domain/inbox/types";
import { createMockStorage } from "../../mocks/storage";

function createTestItem(overrides: Partial<InboxItem> = {}): InboxItem {
	return {
		id: "inbox_test",
		type: "info",
		title: "Test item",
		description: "Test description",
		sourceEvent: "test.event",
		sourceHub: "test",
		timestamp: "2026-02-15T10:00:00Z",
		read: false,
		...overrides,
	};
}

describe("InboxService", () => {
	let service: InboxService;
	let storage: ITypedStorage<InboxState>;
	let eventBus: IEventBus;

	beforeEach(() => {
		const mock = createMockStorage<InboxState>();
		storage = mock.storage;
		eventBus = new EventBus();
		service = new InboxService({ storage, eventBus });
	});

	afterEach(() => {
		service.dispose();
	});

	describe("load", () => {
		it("should load empty state when no data exists", async () => {
			await service.load();
			expect(service.getItems()).toEqual([]);
			expect(service.getUnreadCount()).toBe(0);
		});

		it("should load persisted inbox state", async () => {
			const existingState: InboxState = {
				items: [createTestItem({ id: "item1" }), createTestItem({ id: "item2", read: true })],
			};
			const mock = createMockStorage(existingState);
			service.dispose();
			service = new InboxService({ storage: mock.storage, eventBus });

			await service.load();

			expect(service.getItems()).toHaveLength(2);
			expect(service.getUnreadCount()).toBe(1);
		});

		it("should emit inbox.loaded on load", async () => {
			const handler = vi.fn();
			eventBus.on("inbox.loaded", handler);

			await service.load();

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { items: [], unreadCount: 0 },
				}),
			);
		});
	});

	describe("source event listeners", () => {
		it("should add item when subscription.matched is emitted", async () => {
			await service.load();

			const handler = vi.fn();
			eventBus.on("inbox.itemAdded", handler);

			await eventBus.emit("subscription.matched", {
				eventType: "file.created",
				subscriptionId: "sub_1",
				subscriptionLabel: "My Watcher",
				timestamp: "2026-02-15T10:00:00Z",
			});

			// Allow async handler to complete
			await vi.waitFor(() => {
				expect(handler).toHaveBeenCalledOnce();
			});

			const items = service.getItems();
			expect(items).toHaveLength(1);
			expect(items[0].title).toBe("Watcher matched: My Watcher");
			expect(items[0].sourceHub).toBe("subscription");
		});

		it("should add item when dataExchange.import.completed is emitted", async () => {
			await service.load();

			await eventBus.emit("dataExchange.import.completed", {
				operationId: "test-op-1",
				result: {
					totalRows: 10,
					created: 8,
					updated: 1,
					skipped: 1,
					failed: 0,
					errors: [],
				},
			});

			await vi.waitFor(() => {
				expect(service.getItems()).toHaveLength(1);
			});

			expect(service.getItems()[0].type).toBe("info");
			expect(service.getItems()[0].sourceHub).toBe("data-exchange");
		});

		it("should add action item when dataExchange.import.failed is emitted", async () => {
			await service.load();

			await eventBus.emit("dataExchange.import.failed", {
				operationId: "test-op-2",
				error: "Parse error",
				config: {
					sourcePath: "data.csv",
					targetFolder: "notes",
					nameColumn: "name",
					columnMappings: [],
					conflictStrategy: "skip" as const,
				},
			});

			await vi.waitFor(() => {
				expect(service.getItems()).toHaveLength(1);
			});

			expect(service.getItems()[0].type).toBe("action");
			expect(service.getItems()[0].title).toBe("Import failed");
		});

		it("should add item when dataExchange.pipeline.completed is emitted", async () => {
			await service.load();

			await eventBus.emit("dataExchange.pipeline.completed", {
				result: {
					totalSources: 2,
					completedSources: 2,
					totalRows: 100,
					created: 80,
					updated: 15,
					skipped: 5,
					failed: 0,
					errors: [],
					sourceResults: [],
				},
			});

			await vi.waitFor(() => {
				expect(service.getItems()).toHaveLength(1);
			});

			expect(service.getItems()[0].type).toBe("info");
			expect(service.getItems()[0].title).toContain("Pipeline completed");
			expect(service.getItems()[0].sourceHub).toBe("data-exchange");
		});

		it("should add action item when dataExchange.pipeline.failed is emitted", async () => {
			await service.load();

			await eventBus.emit("dataExchange.pipeline.failed", {
				error: "Source file missing",
				pipelineId: "pipe_123",
			});

			await vi.waitFor(() => {
				expect(service.getItems()).toHaveLength(1);
			});

			expect(service.getItems()[0].type).toBe("action");
			expect(service.getItems()[0].title).toBe("Pipeline failed");
		});

		it("should add item when dataExchange.export.completed is emitted", async () => {
			await service.load();

			await eventBus.emit("dataExchange.export.completed", {
				operationId: "test-op-3",
				result: {
					totalRows: 50,
					totalColumns: 3,
					outputPath: "export.csv",
				},
			});

			await vi.waitFor(() => {
				expect(service.getItems()).toHaveLength(1);
			});

			expect(service.getItems()[0].title).toBe("Export completed: 50 rows");
		});

		it("should add item when capture.note.created is emitted", async () => {
			await service.load();

			const handler = vi.fn();
			eventBus.on("inbox.itemAdded", handler);

			await eventBus.emit("capture.note.created", {
				path: "inbox/Test Note.md",
				title: "Test Note",
				type: "idea",
			});

			await vi.waitFor(() => {
				expect(handler).toHaveBeenCalledOnce();
			});

			const items = service.getItems();
			expect(items).toHaveLength(1);
			expect(items[0].title).toBe("Captured: Test Note");
			expect(items[0].sourceEvent).toBe("capture.note.created");
			expect(items[0].sourceHub).toBe("capture");
			expect(items[0].filePath).toBe("inbox/Test Note.md");
		});

		it("should not add item when capture.note.created source is disabled", async () => {
			await service.load();
			service.setEnabledSources(["subscription.matched"]);

			await eventBus.emit("capture.note.created", {
				path: "inbox/Test.md",
				title: "Test",
				type: "bug",
			});

			await new Promise((r) => setTimeout(r, 10));
			expect(service.getItems()).toHaveLength(0);
		});
	});

	describe("item cap", () => {
		it("should evict oldest items when exceeding MAX_INBOX_ITEMS", async () => {
			// Pre-populate with MAX_INBOX_ITEMS items
			const items: InboxItem[] = [];
			for (let i = 0; i < MAX_INBOX_ITEMS; i++) {
				items.push(createTestItem({ id: `item_${i}`, title: `Item ${i}` }));
			}
			const mock = createMockStorage({ items });
			service.dispose();
			service = new InboxService({ storage: mock.storage, eventBus });
			await service.load();

			expect(service.getItems()).toHaveLength(MAX_INBOX_ITEMS);

			// Add one more via event
			await eventBus.emit("subscription.matched", {
				eventType: "file.created",
				subscriptionId: "sub_new",
				timestamp: "2026-02-15T12:00:00Z",
			});

			await vi.waitFor(() => {
				// Should still be at MAX_INBOX_ITEMS (newest added, oldest evicted)
				expect(service.getItems()).toHaveLength(MAX_INBOX_ITEMS);
			});

			// Newest item should be first
			expect(service.getItems()[0].title).toContain("Watcher matched");
		});
	});

	describe("markRead", () => {
		it("should mark an item as read", async () => {
			const mock = createMockStorage({
				items: [createTestItem({ id: "item1" })],
			});
			service.dispose();
			service = new InboxService({ storage: mock.storage, eventBus });
			await service.load();

			expect(service.getUnreadCount()).toBe(1);

			const handler = vi.fn();
			eventBus.on("inbox.itemsChanged", handler);

			await service.markRead("item1");

			expect(service.getUnreadCount()).toBe(0);
			expect(service.getItems()[0].read).toBe(true);
			expect(handler).toHaveBeenCalledOnce();
			expect(mock.storage.save).toHaveBeenCalled();
		});

		it("should be a no-op for already-read items", async () => {
			const mock = createMockStorage({
				items: [createTestItem({ id: "item1", read: true })],
			});
			service.dispose();
			service = new InboxService({ storage: mock.storage, eventBus });
			await service.load();

			const handler = vi.fn();
			eventBus.on("inbox.itemsChanged", handler);

			await service.markRead("item1");

			expect(handler).not.toHaveBeenCalled();
		});

		it("should be a no-op for non-existent items", async () => {
			await service.load();

			const handler = vi.fn();
			eventBus.on("inbox.itemsChanged", handler);

			await service.markRead("nonexistent");

			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("markAllRead", () => {
		it("should mark all unread items as read", async () => {
			const mock = createMockStorage<InboxState>({
				items: [
					createTestItem({ id: "item1", read: false }),
					createTestItem({ id: "item2", read: true }),
					createTestItem({ id: "item3", read: false }),
				],
			});
			service.dispose();
			service = new InboxService({ storage: mock.storage, eventBus });
			await service.load();

			expect(service.getUnreadCount()).toBe(2);

			const handler = vi.fn();
			eventBus.on("inbox.itemsChanged", handler);

			await service.markAllRead();

			expect(service.getUnreadCount()).toBe(0);
			expect(service.getItems().every((i) => i.read)).toBe(true);
			expect(handler).toHaveBeenCalledOnce();
			expect(mock.storage.save).toHaveBeenCalled();
		});

		it("should be a no-op when all items are already read", async () => {
			const mock = createMockStorage<InboxState>({
				items: [
					createTestItem({ id: "item1", read: true }),
					createTestItem({ id: "item2", read: true }),
				],
			});
			service.dispose();
			service = new InboxService({ storage: mock.storage, eventBus });
			await service.load();

			const handler = vi.fn();
			eventBus.on("inbox.itemsChanged", handler);

			await service.markAllRead();

			expect(handler).not.toHaveBeenCalled();
		});

		it("should be a no-op when inbox is empty", async () => {
			await service.load();

			const handler = vi.fn();
			eventBus.on("inbox.itemsChanged", handler);

			await service.markAllRead();

			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("dismiss", () => {
		it("should remove an item from the inbox", async () => {
			const mock = createMockStorage({
				items: [
					createTestItem({ id: "item1" }),
					createTestItem({ id: "item2" }),
				],
			});
			service.dispose();
			service = new InboxService({ storage: mock.storage, eventBus });
			await service.load();

			const handler = vi.fn();
			eventBus.on("inbox.itemsChanged", handler);

			await service.dismiss("item1");

			expect(service.getItems()).toHaveLength(1);
			expect(service.getItems()[0].id).toBe("item2");
			expect(handler).toHaveBeenCalledOnce();
		});

		it("should be a no-op for non-existent items", async () => {
			await service.load();

			const handler = vi.fn();
			eventBus.on("inbox.itemsChanged", handler);

			await service.dismiss("nonexistent");

			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("clearAll", () => {
		it("should remove all items", async () => {
			const mock = createMockStorage({
				items: [
					createTestItem({ id: "item1" }),
					createTestItem({ id: "item2" }),
				],
			});
			service.dispose();
			service = new InboxService({ storage: mock.storage, eventBus });
			await service.load();

			const handler = vi.fn();
			eventBus.on("inbox.itemsChanged", handler);

			await service.clearAll();

			expect(service.getItems()).toEqual([]);
			expect(service.getUnreadCount()).toBe(0);
			expect(handler).toHaveBeenCalledOnce();
		});

		it("should be a no-op when inbox is already empty", async () => {
			await service.load();

			const handler = vi.fn();
			eventBus.on("inbox.itemsChanged", handler);

			await service.clearAll();

			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("inbox.refresh command", () => {
		it("should re-emit inbox.loaded with current state", async () => {
			const mock = createMockStorage({
				items: [createTestItem({ id: "item1" })],
			});
			service.dispose();
			service = new InboxService({ storage: mock.storage, eventBus });
			await service.load();

			const handler = vi.fn();
			eventBus.on("inbox.loaded", handler);

			await eventBus.emit("inbox.refresh", {});

			// Should have been called (once from load, once from refresh)
			// But our handler was registered after load, so only refresh
			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						items: expect.arrayContaining([
							expect.objectContaining({ id: "item1" }),
						]),
						unreadCount: 1,
					}),
				}),
			);
		});
	});

	describe("dispose", () => {
		it("should unsubscribe all listeners", async () => {
			await service.load();
			service.dispose();

			// After dispose, emitting source events should not add items
			await eventBus.emit("subscription.matched", {
				eventType: "file.created",
				subscriptionId: "sub_1",
				timestamp: "2026-02-15T10:00:00Z",
			});

			// Give a moment for any async processing
			await new Promise((r) => setTimeout(r, 10));

			expect(service.getItems()).toHaveLength(0);
		});
	});

	describe("getItems", () => {
		it("should return a copy, not the internal array", async () => {
			const mock = createMockStorage({
				items: [createTestItem({ id: "item1" })],
			});
			service.dispose();
			service = new InboxService({ storage: mock.storage, eventBus });
			await service.load();

			const items1 = service.getItems();
			const items2 = service.getItems();

			expect(items1).not.toBe(items2);
			expect(items1).toEqual(items2);
		});
	});

	describe("setEnabledSources", () => {
		it("should have all sources enabled by default", async () => {
			await service.load();

			await eventBus.emit("subscription.matched", {
				eventType: "file.created",
				subscriptionId: "sub_1",
				timestamp: "2026-02-15T10:00:00Z",
			});

			await vi.waitFor(() => {
				expect(service.getItems()).toHaveLength(1);
			});
		});

		it("should not create items for disabled sources", async () => {
			await service.load();

			// Disable subscription.matched
			service.setEnabledSources([
				"dataExchange.import.completed",
				"dataExchange.import.failed",
				"dataExchange.export.completed",
			]);

			await eventBus.emit("subscription.matched", {
				eventType: "file.created",
				subscriptionId: "sub_1",
				timestamp: "2026-02-15T10:00:00Z",
			});

			// Give time for async handler
			await new Promise((r) => setTimeout(r, 10));

			expect(service.getItems()).toHaveLength(0);
		});

		it("should create items for re-enabled sources", async () => {
			await service.load();

			// Disable all
			service.setEnabledSources([]);

			await eventBus.emit("subscription.matched", {
				eventType: "file.created",
				subscriptionId: "sub_1",
				timestamp: "2026-02-15T10:00:00Z",
			});
			await new Promise((r) => setTimeout(r, 10));
			expect(service.getItems()).toHaveLength(0);

			// Re-enable subscription.matched
			service.setEnabledSources(["subscription.matched"]);

			await eventBus.emit("subscription.matched", {
				eventType: "file.created",
				subscriptionId: "sub_2",
				timestamp: "2026-02-15T11:00:00Z",
			});

			await vi.waitFor(() => {
				expect(service.getItems()).toHaveLength(1);
			});
		});

		it("should not create items for disabled pipeline sources", async () => {
			await service.load();

			// Enable only non-pipeline sources
			service.setEnabledSources([
				"subscription.matched",
				"dataExchange.import.completed",
				"dataExchange.import.failed",
				"dataExchange.export.completed",
			]);

			await eventBus.emit("dataExchange.pipeline.completed", {
				result: {
					totalSources: 1,
					completedSources: 1,
					totalRows: 10,
					created: 10,
					updated: 0,
					skipped: 0,
					failed: 0,
					errors: [],
					sourceResults: [],
				},
			});
			await new Promise((r) => setTimeout(r, 10));
			expect(service.getItems()).toHaveLength(0);

			await eventBus.emit("dataExchange.pipeline.failed", {
				error: "error",
				pipelineId: "pipe_1",
			});
			await new Promise((r) => setTimeout(r, 10));
			expect(service.getItems()).toHaveLength(0);
		});

		it("should only affect the specified source", async () => {
			await service.load();

			// Disable only import completed
			service.setEnabledSources([
				"subscription.matched",
				"dataExchange.import.failed",
				"dataExchange.export.completed",
			]);

			await eventBus.emit("dataExchange.import.completed", {
				operationId: "test-op-4",
				result: { totalRows: 10, created: 10, updated: 0, skipped: 0, failed: 0, errors: [] },
			});
			await new Promise((r) => setTimeout(r, 10));
			expect(service.getItems()).toHaveLength(0);

			// But other sources should still work
			await eventBus.emit("dataExchange.export.completed", {
				operationId: "test-op-5",
				result: { totalRows: 50, totalColumns: 3, outputPath: "export.csv" },
			});

			await vi.waitFor(() => {
				expect(service.getItems()).toHaveLength(1);
			});
			expect(service.getItems()[0].title).toBe("Export completed: 50 rows");
		});
	});
});
