/**
 * Flow 15: Manage Inbox Notifications
 *
 * Tests the inbox notification lifecycle:
 * Source event fires → mapper creates inbox item → inbox.itemAdded →
 * mark read → dismiss → clear all → inbox.itemsChanged.
 *
 * Event sequence:
 *   subscription.matched → inbox.itemAdded
 *   dataExchange.import.completed → inbox.itemAdded
 *   dataExchange.import.failed → inbox.itemAdded
 *   dataExchange.export.completed → inbox.itemAdded
 *   inbox.itemsChanged (mark read / dismiss / clear)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { InboxService, ALL_INBOX_SOURCES } from "../../src/domain/inbox/InboxService";
import type { InboxState } from "../../src/domain/inbox/types";
import { createMockStorage, waitForAsync } from "./testHelpers";

describe("Flow 15: Manage Inbox Notifications", () => {
	let eventBus: IEventBus;
	let inboxService: InboxService;

	beforeEach(async () => {
		eventBus = new EventBus();
		const mock = createMockStorage<InboxState>();
		inboxService = new InboxService({ storage: mock.storage, eventBus });
		inboxService.setEnabledSources([...ALL_INBOX_SOURCES]);
		await inboxService.load();
	});

	describe("source event → inbox item creation", () => {
		it("should create inbox item when subscription.matched fires", async () => {
			const addedHandler = vi.fn();
			eventBus.on("inbox.itemAdded", addedHandler);

			await eventBus.emit("subscription.matched", {
				eventType: "file.created",
				subscriptionId: "sub-1",
				subscriptionLabel: "Watch new files",
				timestamp: new Date().toISOString(),
			});
			await waitForAsync();

			expect(addedHandler).toHaveBeenCalledOnce();
			const item = addedHandler.mock.calls[0][0].payload.item;
			expect(item.sourceEvent).toBe("subscription.matched");
			expect(item.type).toBe("info");
			expect(item.title).toContain("Watch new files");
			expect(item.read).toBe(false);
		});

		it("should create inbox item when import completes successfully", async () => {
			const addedHandler = vi.fn();
			eventBus.on("inbox.itemAdded", addedHandler);

			await eventBus.emit("dataExchange.import.completed", {
				operationId: "op-1",
				result: { totalRows: 10, created: 8, updated: 1, skipped: 1, failed: 0, errors: [] },
			});
			await waitForAsync();

			// 2 items: standard import notification + analytics bridge action
			expect(addedHandler).toHaveBeenCalledTimes(2);
			const importItem = addedHandler.mock.calls[0][0].payload.item;
			expect(importItem.sourceEvent).toBe("dataExchange.import.completed");
			expect(importItem.type).toBe("info");
			expect(importItem.title).toContain("8 created");
			const analyticsItem = addedHandler.mock.calls[1][0].payload.item;
			expect(analyticsItem.sourceHub).toBe("analytics");
			expect(analyticsItem.type).toBe("action");
		});

		it("should create action-type inbox item when import has failures", async () => {
			const addedHandler = vi.fn();
			eventBus.on("inbox.itemAdded", addedHandler);

			await eventBus.emit("dataExchange.import.completed", {
				operationId: "op-2",
				result: { totalRows: 10, created: 5, updated: 0, skipped: 2, failed: 3, errors: [] },
			});
			await waitForAsync();

			const item = addedHandler.mock.calls[0][0].payload.item;
			expect(item.type).toBe("action");
			expect(item.title).toContain("3 errors");
		});

		it("should create inbox item when import fails completely", async () => {
			const addedHandler = vi.fn();
			eventBus.on("inbox.itemAdded", addedHandler);

			await eventBus.emit("dataExchange.import.failed", {
				operationId: "op-3",
				error: "File not found",
				config: {
					sourcePath: "data/missing.csv",
					targetFolder: "imports",
					nameColumn: "name",
					columnMappings: [],
					conflictStrategy: "skip",
				},
			});
			await waitForAsync();

			const item = addedHandler.mock.calls[0][0].payload.item;
			expect(item.type).toBe("action");
			expect(item.title).toBe("Import failed");
			expect(item.description).toContain("missing.csv");
		});

		it("should create inbox item when export completes", async () => {
			const addedHandler = vi.fn();
			eventBus.on("inbox.itemAdded", addedHandler);

			await eventBus.emit("dataExchange.export.completed", {
				operationId: "op-4",
				result: { totalRows: 50, totalColumns: 5, outputPath: "exports/data.csv" },
			});
			await waitForAsync();

			const item = addedHandler.mock.calls[0][0].payload.item;
			expect(item.sourceEvent).toBe("dataExchange.export.completed");
			expect(item.type).toBe("info");
			expect(item.title).toContain("50 rows");
		});

		it("should create inbox item when pipeline completes", async () => {
			const addedHandler = vi.fn();
			eventBus.on("inbox.itemAdded", addedHandler);

			await eventBus.emit("dataExchange.pipeline.completed", {
				result: {
					totalSources: 3, completedSources: 3, totalRows: 100,
					created: 90, updated: 5, skipped: 3, failed: 2,
					errors: [], sourceResults: [],
				},
			});
			await waitForAsync();

			const item = addedHandler.mock.calls[0][0].payload.item;
			expect(item.sourceEvent).toBe("dataExchange.pipeline.completed");
			expect(item.type).toBe("action"); // has failures
			expect(item.title).toContain("2 error");
		});

		it("should create inbox item when pipeline fails", async () => {
			const addedHandler = vi.fn();
			eventBus.on("inbox.itemAdded", addedHandler);

			await eventBus.emit("dataExchange.pipeline.failed", {
				error: "Source unavailable",
				pipelineId: "pipe-1",
			});
			await waitForAsync();

			const item = addedHandler.mock.calls[0][0].payload.item;
			expect(item.type).toBe("action");
			expect(item.title).toBe("Pipeline failed");
		});
	});

	describe("inbox state management", () => {
		it("should accumulate items from multiple source events", async () => {
			await eventBus.emit("subscription.matched", {
				eventType: "file.created",
				subscriptionId: "sub-1",
				timestamp: new Date().toISOString(),
			});
			await eventBus.emit("dataExchange.export.completed", {
				operationId: "op-5",
				result: { totalRows: 10, totalColumns: 3, outputPath: "out.csv" },
			});
			await waitForAsync();

			const items = inboxService.getItems();
			expect(items).toHaveLength(2);
			expect(inboxService.getUnreadCount()).toBe(2);
		});

		it("should mark an item as read and emit itemsChanged", async () => {
			const changedHandler = vi.fn();
			eventBus.on("inbox.itemsChanged", changedHandler);

			await eventBus.emit("subscription.matched", {
				eventType: "file.created",
				subscriptionId: "sub-1",
				timestamp: new Date().toISOString(),
			});
			await waitForAsync();

			const item = inboxService.getItems()[0];
			await inboxService.markRead(item.id);
			await waitForAsync();

			expect(changedHandler).toHaveBeenCalled();
			expect(inboxService.getUnreadCount()).toBe(0);
			expect(inboxService.getItems()[0].read).toBe(true);
		});

		it("should dismiss an item and emit itemsChanged", async () => {
			const changedHandler = vi.fn();
			eventBus.on("inbox.itemsChanged", changedHandler);

			await eventBus.emit("subscription.matched", {
				eventType: "file.created",
				subscriptionId: "sub-1",
				timestamp: new Date().toISOString(),
			});
			await waitForAsync();

			const item = inboxService.getItems()[0];
			await inboxService.dismiss(item.id);
			await waitForAsync();

			expect(changedHandler).toHaveBeenCalled();
			expect(inboxService.getItems()).toHaveLength(0);
		});

		it("should clear all items and emit itemsChanged", async () => {
			const changedHandler = vi.fn();
			eventBus.on("inbox.itemsChanged", changedHandler);

			// Add multiple items
			await eventBus.emit("subscription.matched", {
				eventType: "file.created",
				subscriptionId: "sub-1",
				timestamp: new Date().toISOString(),
			});
			await eventBus.emit("subscription.matched", {
				eventType: "file.modified",
				subscriptionId: "sub-2",
				timestamp: new Date().toISOString(),
			});
			await waitForAsync();

			expect(inboxService.getItems()).toHaveLength(2);

			await inboxService.clearAll();
			await waitForAsync();

			expect(changedHandler).toHaveBeenCalled();
			expect(inboxService.getItems()).toHaveLength(0);
			expect(inboxService.getUnreadCount()).toBe(0);
		});
	});

	describe("inbox refresh", () => {
		it("should re-emit inbox.loaded on refresh request", async () => {
			const loadedHandler = vi.fn();

			await eventBus.emit("subscription.matched", {
				eventType: "file.created",
				subscriptionId: "sub-1",
				timestamp: new Date().toISOString(),
			});
			await waitForAsync();

			eventBus.on("inbox.loaded", loadedHandler);
			await eventBus.emit("inbox.refresh", {});
			await waitForAsync();

			expect(loadedHandler).toHaveBeenCalledOnce();
			const payload = loadedHandler.mock.calls[0][0].payload;
			expect(payload.items).toHaveLength(1);
			expect(payload.unreadCount).toBe(1);
		});
	});

	describe("source filtering", () => {
		it("should not create inbox items for disabled sources", async () => {
			const addedHandler = vi.fn();
			eventBus.on("inbox.itemAdded", addedHandler);

			// Disable subscription.matched source
			inboxService.setEnabledSources([
				"dataExchange.import.completed",
				"dataExchange.export.completed",
			]);

			await eventBus.emit("subscription.matched", {
				eventType: "file.created",
				subscriptionId: "sub-1",
				timestamp: new Date().toISOString(),
			});
			await waitForAsync();

			expect(addedHandler).not.toHaveBeenCalled();
			expect(inboxService.getItems()).toHaveLength(0);
		});

		it("should create inbox items for enabled sources only", async () => {
			const addedHandler = vi.fn();
			eventBus.on("inbox.itemAdded", addedHandler);

			inboxService.setEnabledSources(["dataExchange.export.completed"]);

			// Disabled source — should not create item
			await eventBus.emit("subscription.matched", {
				eventType: "file.created",
				subscriptionId: "sub-1",
				timestamp: new Date().toISOString(),
			});

			// Enabled source — should create item
			await eventBus.emit("dataExchange.export.completed", {
				operationId: "op-6",
				result: { totalRows: 5, totalColumns: 2, outputPath: "out.csv" },
			});
			await waitForAsync();

			expect(addedHandler).toHaveBeenCalledOnce();
			expect(inboxService.getItems()).toHaveLength(1);
		});
	});

	describe("end-to-end: source → inbox → user interaction", () => {
		it("should support the full notification lifecycle", async () => {
			const events: string[] = [];
			eventBus.on("inbox.itemAdded", () => { events.push("itemAdded"); });
			eventBus.on("inbox.itemsChanged", () => { events.push("itemsChanged"); });

			// 1. Source event fires → inbox items created (import notification + analytics bridge)
			await eventBus.emit("dataExchange.import.completed", {
				operationId: "op-7",
				result: { totalRows: 20, created: 18, updated: 2, skipped: 0, failed: 0, errors: [] },
			});
			await waitForAsync();

			expect(events).toContain("itemAdded");
			expect(inboxService.getItems()).toHaveLength(2);
			expect(inboxService.getUnreadCount()).toBe(2);

			// 2. User reads both items
			for (const item of inboxService.getItems()) {
				await inboxService.markRead(item.id);
			}
			await waitForAsync();

			expect(inboxService.getUnreadCount()).toBe(0);
			expect(events).toContain("itemsChanged");

			// 3. User dismisses all items
			await inboxService.clearAll();
			await waitForAsync();

			expect(inboxService.getItems()).toHaveLength(0);
		});
	});

	describe("persistence", () => {
		it("should persist state across load cycles", async () => {
			const mock = createMockStorage<InboxState>();

			// First service instance — add an item
			const service1 = new InboxService({ storage: mock.storage, eventBus });
			service1.setEnabledSources([...ALL_INBOX_SOURCES]);
			await service1.load();

			await eventBus.emit("subscription.matched", {
				eventType: "file.created",
				subscriptionId: "sub-1",
				timestamp: new Date().toISOString(),
			});
			await waitForAsync();

			expect(service1.getItems()).toHaveLength(1);
			service1.dispose();

			// Second service instance — should restore state
			const eventBus2 = new EventBus();
			const service2 = new InboxService({ storage: mock.storage, eventBus: eventBus2 });
			await service2.load();

			expect(service2.getItems()).toHaveLength(1);
			expect(service2.getUnreadCount()).toBe(1);
			service2.dispose();
		});
	});

	describe("dispose", () => {
		it("should not create inbox items after dispose", async () => {
			const addedHandler = vi.fn();
			eventBus.on("inbox.itemAdded", addedHandler);

			inboxService.dispose();

			await eventBus.emit("subscription.matched", {
				eventType: "file.created",
				subscriptionId: "sub-1",
				timestamp: new Date().toISOString(),
			});
			await waitForAsync();

			expect(addedHandler).not.toHaveBeenCalled();
		});
	});
});
