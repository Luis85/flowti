/**
 * Flow 07: Monitor and Debug Events
 *
 * Tests the event monitoring and debugging workflow:
 * Open catalog → subscribe to events → open event log →
 * view all events → filter/search → inspect event details.
 *
 * Event sequence:
 *   subscription.create → subscription.created →
 *   subscription.matched (when events fire) →
 *   eventNotify.changed (notification state updates)
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { SubscriptionService } from "../../src/domain/subscription/SubscriptionService";
import type { SubscriptionState } from "../../src/domain/subscription/types";
import { DEFAULT_SETTINGS } from "../../src/domain/settings/settings";
import { createMockStorage, waitForAsync } from "./testHelpers";

describe("Flow 07: Monitor and Debug Events", () => {
	let eventBus: IEventBus;
	let subService: SubscriptionService;

	beforeEach(async () => {
		eventBus = new EventBus();
		const mock = createMockStorage<SubscriptionState>();
		subService = new SubscriptionService({ storage: mock.storage, eventBus });

		await eventBus.emit("settings.loaded", {
			settings: { ...DEFAULT_SETTINGS, eventSystemEnabled: true },
		});
		await subService.load();
	});

	describe("create monitoring subscription", () => {
		it("should create a subscription to monitor file.created events", async () => {
			const createdHandler = vi.fn();
			eventBus.on("subscription.created", createdHandler);

			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "Monitor new files",
				filters: {},
			});

			await waitForAsync();

			expect(createdHandler).toHaveBeenCalledOnce();
			const subs = subService.getSubscriptions();
			expect(subs).toHaveLength(1);
			expect(subs[0].eventType).toBe("file.created");
		});

		it("should create a filtered subscription with path pattern", async () => {
			await eventBus.emit("subscription.create", {
				eventType: "file.modified",
				label: "Watch Reports",
				filters: { pathPattern: "Reports/**", extension: "md" },
			});

			await waitForAsync();

			const subs = subService.getSubscriptions();
			expect(subs[0].filters.pathPattern).toBe("Reports/**");
			expect(subs[0].filters.extension).toBe("md");
		});
	});

	describe("subscription matching", () => {
		it("should emit subscription.matched when a matching event fires", async () => {
			const matchedHandler = vi.fn();
			eventBus.on("subscription.matched", matchedHandler);

			// Create subscription first
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "Watch all",
				filters: {},
			});
			await waitForAsync();

			// Fire the matching event
			await eventBus.emit("file.created", { source: "user", path: "Notes/test.md" });
			await waitForAsync();

			expect(matchedHandler).toHaveBeenCalled();
		});

		it("should NOT match events that don't match the path filter", async () => {
			const matchedHandler = vi.fn();
			eventBus.on("subscription.matched", matchedHandler);

			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "Only Reports",
				filters: { pathPattern: "Reports/**" },
			});
			await waitForAsync();

			// Fire event for a non-matching path
			await eventBus.emit("file.created", { source: "user", path: "Notes/other.md" });
			await waitForAsync();

			expect(matchedHandler).not.toHaveBeenCalled();
		});

		it("should match events with correct path pattern", async () => {
			const matchedHandler = vi.fn();
			eventBus.on("subscription.matched", matchedHandler);

			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "Reports Only",
				filters: { pathPattern: "Reports/**" },
			});
			await waitForAsync();

			// Fire matching event
			await eventBus.emit("file.created", { source: "user", path: "Reports/monthly.md" });
			await waitForAsync();

			expect(matchedHandler).toHaveBeenCalled();
		});

		it("should match events filtered by extension", async () => {
			const matchedHandler = vi.fn();
			eventBus.on("subscription.matched", matchedHandler);

			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "CSV only",
				filters: { extension: "csv" },
			});
			await waitForAsync();

			// Non-matching extension
			await eventBus.emit("file.created", { source: "user", path: "data/file.md" });
			await waitForAsync();
			expect(matchedHandler).not.toHaveBeenCalled();

			// Matching extension
			await eventBus.emit("file.created", { source: "user", path: "data/file.csv" });
			await waitForAsync();
			expect(matchedHandler).toHaveBeenCalled();
		});
	});

	describe("subscription toggle", () => {
		it("should not match when subscription is disabled", async () => {
			const matchedHandler = vi.fn();
			eventBus.on("subscription.matched", matchedHandler);

			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "Toggle test",
				filters: {},
			});
			await waitForAsync();

			const sub = subService.getSubscriptions()[0];

			// Disable the subscription
			await eventBus.emit("subscription.update", {
				subscriptionId: sub.id,
				enabled: false,
			});
			await waitForAsync();

			// Fire event — should NOT match
			await eventBus.emit("file.created", { source: "user", path: "test.md" });
			await waitForAsync();

			expect(matchedHandler).not.toHaveBeenCalled();
		});
	});

	describe("multiple subscriptions", () => {
		it("should match multiple subscriptions for the same event type", async () => {
			const matchedHandler = vi.fn();
			eventBus.on("subscription.matched", matchedHandler);

			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "Sub A",
				filters: {},
			});
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "Sub B",
				filters: {},
			});
			await waitForAsync();

			await eventBus.emit("file.created", { source: "user", path: "test.md" });
			await waitForAsync();

			// Both subscriptions should match
			expect(matchedHandler).toHaveBeenCalledTimes(2);
		});
	});

	it.skip("should render EventLogView with live event stream (requires Obsidian ItemView)", () => {
		// EventLogView extends ItemView, renders event cards in real-time.
	});

	it.skip("should filter event log by event type or search text (requires UI rendering)", () => {
		// Event log supports search input and type filter chips.
	});

	it.skip("should pause/resume event log capture (requires UI state)", () => {
		// Event log has pause button that stops adding new events to display.
	});
});
