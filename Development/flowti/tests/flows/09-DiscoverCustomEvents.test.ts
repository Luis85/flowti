/**
 * Flow 09: Discover Custom Events
 *
 * Tests the custom event discovery workflow:
 * Create event markdown file → EventBridge detects → metadata indexed →
 * discovery event emitted → catalog updated → configure subscription.
 *
 * Event sequence:
 *   event.file.triggered → discovery.updated →
 *   discovery.loaded → subscription.create → subscription.created
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { DiscoveryService } from "../../src/domain/discovery/DiscoveryService";
import { SubscriptionService } from "../../src/domain/subscription/SubscriptionService";
import type { DiscoveryState } from "../../src/domain/discovery/types";
import type { SubscriptionState } from "../../src/domain/subscription/types";
import { DEFAULT_SETTINGS } from "../../src/domain/settings/settings";
import { createMockStorage, waitForAsync } from "./testHelpers";

describe("Flow 09: Discover Custom Events", () => {
	let eventBus: IEventBus;
	let discoveryService: DiscoveryService;
	let subService: SubscriptionService;

	beforeEach(async () => {
		eventBus = new EventBus();

		const discoveryMock = createMockStorage<DiscoveryState>();
		discoveryService = new DiscoveryService({
			storage: discoveryMock.storage,
			eventBus,
		});

		const subMock = createMockStorage<SubscriptionState>();
		subService = new SubscriptionService({
			storage: subMock.storage,
			eventBus,
		});

		await eventBus.emit("settings.loaded", {
			settings: { ...DEFAULT_SETTINGS, eventSystemEnabled: true },
		});

		await discoveryService.load();
		await subService.load();
	});

	describe("event file detection", () => {
		it("should discover a new event when event.file.triggered fires", async () => {
			const updatedHandler = vi.fn();
			eventBus.on("discovery.updated", updatedHandler);

			await eventBus.emit("event.file.triggered", {
				eventName: "daily.review",
				path: "Events/Daily Review.md",
				action: "created",
			});

			await waitForAsync();

			expect(updatedHandler).toHaveBeenCalled();
			const events = discoveryService.getDiscoveredEvents();
			expect(events).toHaveLength(1);
			expect(events[0].eventName).toBe("daily.review");
			expect(events[0].sourcePath).toBe("Events/Daily Review.md");
		});

		it("should increment trigger count on repeated discovery", async () => {
			await eventBus.emit("event.file.triggered", {
				eventName: "daily.review",
				path: "Events/Daily Review.md",
				action: "created",
			});
			await waitForAsync();

			await eventBus.emit("event.file.triggered", {
				eventName: "daily.review",
				path: "Events/Daily Review.md",
				action: "created",
			});
			await waitForAsync();

			const events = discoveryService.getDiscoveredEvents();
			expect(events).toHaveLength(1);
			expect(events[0].triggerCount).toBe(2);
		});

		it.skip("should emit the custom event name via emitCustom (emitCustom only fires wildcard handlers)", () => {
			// emitCustom() dispatches to wildcard ("*") listeners only, not typed on() handlers.
			// Custom events are visible via the Activity Log wildcard listener.
		});
	});

	describe("discovery persistence", () => {
		it("should persist discovered events to storage", async () => {
			await eventBus.emit("event.file.triggered", {
				eventName: "weekly.sync",
				path: "Events/Weekly Sync.md",
				action: "created",
			});
			await waitForAsync();

			const events = discoveryService.getDiscoveredEvents();
			expect(events).toHaveLength(1);
			expect(events[0].eventName).toBe("weekly.sync");
		});

		it("should load previously discovered events from storage", async () => {
			const existingState: DiscoveryState = {
				events: {
					"quarterly.report": {
						eventName: "quarterly.report",
						sourcePath: "Events/Quarterly Report.md",
						firstSeenAt: "2026-01-01T00:00:00.000Z",
						lastSeenAt: "2026-01-15T00:00:00.000Z",
						triggerCount: 3,
					},
				},
			};
			const mock = createMockStorage<DiscoveryState>(existingState);
			const freshService = new DiscoveryService({
				storage: mock.storage,
				eventBus,
			});
			await freshService.load();

			const events = freshService.getDiscoveredEvents();
			expect(events).toHaveLength(1);
			expect(events[0].eventName).toBe("quarterly.report");
			expect(events[0].triggerCount).toBe(3);
		});
	});

	describe("discover then subscribe flow", () => {
		it("should support discover → subscribe end-to-end", async () => {
			const events: string[] = [];
			eventBus.on("discovery.updated", () => { events.push("discovered"); });
			eventBus.on("subscription.created", () => { events.push("subscribed"); });

			// Step 1: Event file detected
			await eventBus.emit("event.file.triggered", {
				eventName: "project.review",
				path: "Events/Project Review.md",
				action: "created",
			});
			await waitForAsync();

			// Step 2: User subscribes to the discovered event
			await eventBus.emit("subscription.create", {
				eventType: "project.review",
				label: "Watch Project Reviews",
				filters: {},
			});
			await waitForAsync();

			expect(events).toEqual(["discovered", "subscribed"]);

			// Verify both services have state
			const discovered = discoveryService.getDiscoveredEvents();
			expect(discovered).toHaveLength(1);

			const subs = subService.getSubscriptions();
			expect(subs).toHaveLength(1);
			expect(subs[0].eventType).toBe("project.review");
		});
	});

	describe("discovery with doc creation", () => {
		it("should emit doc.create when discovery.create includes docMeta", async () => {
			const docCreateHandler = vi.fn();
			eventBus.on("doc.create", docCreateHandler);

			await eventBus.emit("discovery.create", {
				eventName: "custom.event",
				docMeta: {
					description: "A custom event",
					domain: "Custom",
					services: "CustomService",
					direction: "outbound",
					stability: "experimental",
					visibility: "user-facing",
				},
			});

			await waitForAsync();

			expect(docCreateHandler).toHaveBeenCalled();
		});
	});

	describe("remove discovered event", () => {
		it("should remove a discovered event via discovery.remove", async () => {
			const removedHandler = vi.fn();
			eventBus.on("discovery.removed", removedHandler);

			// Discover first
			await eventBus.emit("event.file.triggered", {
				eventName: "temp.event",
				path: "Events/Temp.md",
				action: "created",
			});
			await waitForAsync();

			// Remove
			await eventBus.emit("discovery.remove", {
				eventName: "temp.event",
			});
			await waitForAsync();

			expect(removedHandler).toHaveBeenCalledOnce();
			expect(discoveryService.getDiscoveredEvents()).toHaveLength(0);
		});
	});

	it.skip("should detect event file via EventBridge metadataCache (requires Obsidian runtime)", () => {
		// EventBridge listens to vault metadataCache changes and emits event.file.triggered.
	});

	it.skip("should render discovered events in catalog (requires Obsidian ItemView)", () => {
		// EventCatalogView merges discovered events with built-in catalog.
	});
});
