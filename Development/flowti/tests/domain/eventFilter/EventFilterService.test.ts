import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { EventFilterService } from "../../../src/domain/eventFilter/EventFilterService";
import type { IStorageProvider } from "../../../src/utils/types";
import type { EventFilterState } from "../../../src/domain/eventFilter/types";

/**
 * Creates a mock storage provider for testing.
 */
function createMockStorage(initialData: Record<string, unknown> = {}): {
	storage: IStorageProvider;
	getData: () => Record<string, unknown>;
} {
	let data = { ...initialData };
	return {
		storage: {
			load: vi.fn(async () => data),
			save: vi.fn(async (newData: unknown) => {
				data = newData as Record<string, unknown>;
			}),
		},
		getData: () => data,
	};
}

describe("EventFilterService", () => {
	let service: EventFilterService;
	let storage: IStorageProvider;
	let getData: () => Record<string, unknown>;
	let eventBus: IEventBus;

	beforeEach(() => {
		const mock = createMockStorage();
		storage = mock.storage;
		getData = mock.getData;
		eventBus = new EventBus();
		service = new EventFilterService({ storage, eventBus });
	});

	describe("load", () => {
		it("should load empty state when no data exists", async () => {
			await service.load();
			expect(service.getExcludedTypes()).toEqual([]);
		});

		it("should load persisted filter state", async () => {
			const existingState: EventFilterState = {
				excludedTypes: ["file.created", "file.modified"],
			};
			const mock = createMockStorage({ eventFilter: existingState });
			service = new EventFilterService({ storage: mock.storage, eventBus });

			await service.load();

			expect(service.isExcluded("file.created")).toBe(true);
			expect(service.isExcluded("file.modified")).toBe(true);
			expect(service.isExcluded("file.deleted")).toBe(false);
		});

		it("should emit eventFilter.loaded on load", async () => {
			const handler = vi.fn();
			eventBus.on("eventFilter.loaded", handler);

			await service.load();

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "eventFilter.loaded",
					payload: { excludedTypes: [] },
				})
			);
		});

		it("should emit eventFilter.loaded with persisted exclusions", async () => {
			const existingState: EventFilterState = {
				excludedTypes: ["user.created"],
			};
			const mock = createMockStorage({ eventFilter: existingState });
			service = new EventFilterService({ storage: mock.storage, eventBus });

			const handler = vi.fn();
			eventBus.on("eventFilter.loaded", handler);

			await service.load();

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { excludedTypes: ["user.created"] },
				})
			);
		});
	});

	describe("toggle single event", () => {
		it("should exclude an event type when toggled", async () => {
			const handler = vi.fn();
			eventBus.on("eventFilter.changed", handler);

			await eventBus.emit("eventFilter.toggle", { eventType: "file.created" });

			expect(service.isExcluded("file.created")).toBe(true);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { excludedTypes: ["file.created"] },
				})
			);
		});

		it("should include an event type when toggled again", async () => {
			await eventBus.emit("eventFilter.toggle", { eventType: "file.created" });
			expect(service.isExcluded("file.created")).toBe(true);

			await eventBus.emit("eventFilter.toggle", { eventType: "file.created" });
			expect(service.isExcluded("file.created")).toBe(false);
		});

		it("should persist state after toggle", async () => {
			await eventBus.emit("eventFilter.toggle", { eventType: "file.created" });

			const data = getData();
			const filter = data.eventFilter as EventFilterState;
			expect(filter.excludedTypes).toContain("file.created");
		});
	});

	describe("toggle category", () => {
		it("should exclude all events in a category", async () => {
			const handler = vi.fn();
			eventBus.on("eventFilter.changed", handler);

			await eventBus.emit("eventFilter.toggleCategory", { category: "Plugin Lifecycle" });

			expect(service.isExcluded("plugin.loading")).toBe(true);
			expect(service.isExcluded("plugin.loaded")).toBe(true);
			expect(service.isExcluded("plugin.ready")).toBe(true);
			expect(service.isExcluded("plugin.unloading")).toBe(true);
			expect(service.isExcluded("plugin.unloaded")).toBe(true);
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it("should include all events when all are already excluded", async () => {
			// First exclude all
			await eventBus.emit("eventFilter.toggleCategory", { category: "Plugin Lifecycle" });
			expect(service.isExcluded("plugin.loading")).toBe(true);

			// Toggle again — all excluded → include all
			await eventBus.emit("eventFilter.toggleCategory", { category: "Plugin Lifecycle" });
			expect(service.isExcluded("plugin.loading")).toBe(false);
			expect(service.isExcluded("plugin.loaded")).toBe(false);
			expect(service.isExcluded("plugin.ready")).toBe(false);
			expect(service.isExcluded("plugin.unloading")).toBe(false);
			expect(service.isExcluded("plugin.unloaded")).toBe(false);
		});

		it("should exclude all when partially excluded (mixed → all excluded)", async () => {
			// Exclude just one event first
			await eventBus.emit("eventFilter.toggle", { eventType: "plugin.loading" });
			expect(service.isExcluded("plugin.loading")).toBe(true);
			expect(service.isExcluded("plugin.loaded")).toBe(false);

			// Toggle category — partial → exclude all
			await eventBus.emit("eventFilter.toggleCategory", { category: "Plugin Lifecycle" });
			expect(service.isExcluded("plugin.loading")).toBe(true);
			expect(service.isExcluded("plugin.loaded")).toBe(true);
			expect(service.isExcluded("plugin.ready")).toBe(true);
		});

		it("should do nothing for unknown category", async () => {
			const handler = vi.fn();
			eventBus.on("eventFilter.changed", handler);

			await eventBus.emit("eventFilter.toggleCategory", { category: "Nonexistent" });
			expect(handler).not.toHaveBeenCalled();
		});

		it("should persist state after category toggle", async () => {
			await eventBus.emit("eventFilter.toggleCategory", { category: "Logging" });

			const data = getData();
			const filter = data.eventFilter as EventFilterState;
			expect(filter.excludedTypes).toContain("log.entry");
			expect(filter.excludedTypes).toContain("log.error");
		});
	});

	describe("persistence", () => {
		it("should preserve other storage keys when saving", async () => {
			const mock = createMockStorage({ someOtherKey: "preserved" });
			service = new EventFilterService({ storage: mock.storage, eventBus });

			await eventBus.emit("eventFilter.toggle", { eventType: "file.created" });

			const data = mock.getData();
			expect(data.someOtherKey).toBe("preserved");
			expect(data.eventFilter).toBeDefined();
		});
	});

	describe("dispose", () => {
		it("should stop listening after dispose", async () => {
			service.dispose();

			const handler = vi.fn();
			eventBus.on("eventFilter.changed", handler);

			await eventBus.emit("eventFilter.toggle", { eventType: "file.created" });
			expect(handler).not.toHaveBeenCalled();
			expect(service.isExcluded("file.created")).toBe(false);
		});
	});
});
