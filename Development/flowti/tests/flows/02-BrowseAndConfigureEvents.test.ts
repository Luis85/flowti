/**
 * Flow 02: Browse and Configure Events
 *
 * Tests the event catalog browsing and configuration workflow:
 * Open catalog → browse events → search/filter → select event →
 * open config modal → create subscription → create event definition.
 *
 * Event sequence:
 *   subscription.refresh → subscription.loaded →
 *   eventDefinition.refresh → eventDefinition.loaded →
 *   subscription.create → subscription.created
 *   eventDefinition.create → eventDefinition.created
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { SubscriptionService } from "../../src/domain/subscription/SubscriptionService";
import { EventDefinitionService } from "../../src/domain/eventDefinition/EventDefinitionService";
import type { SubscriptionState } from "../../src/domain/subscription/types";
import type { EventDefinitionState } from "../../src/domain/eventDefinition/types";
import { DEFAULT_SETTINGS } from "../../src/domain/settings/settings";
import { createMockStorage, waitForAsync } from "./testHelpers";

describe("Flow 02: Browse and Configure Events", () => {
	let eventBus: IEventBus;
	let subService: SubscriptionService;
	let defService: EventDefinitionService;

	beforeEach(async () => {
		eventBus = new EventBus();

		const subMock = createMockStorage<SubscriptionState>();
		subService = new SubscriptionService({ storage: subMock.storage, eventBus });

		const defMock = createMockStorage<EventDefinitionState>();
		defService = new EventDefinitionService({ storage: defMock.storage, eventBus });

		// Enable event system (simulate settings.loaded)
		await eventBus.emit("settings.loaded", {
			settings: { ...DEFAULT_SETTINGS, eventSystemEnabled: true },
		});

		await subService.load();
		await defService.load();
	});

	describe("catalog open (refresh cycle)", () => {
		it("should emit subscription.loaded on refresh", async () => {
			const handler = vi.fn();
			eventBus.on("subscription.loaded", handler);

			await eventBus.emit("subscription.refresh", {});

			await waitForAsync();
			expect(handler).toHaveBeenCalled();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ subscriptions: [] }),
				}),
			);
		});

		it("should emit eventDefinition.loaded on refresh", async () => {
			const handler = vi.fn();
			eventBus.on("eventDefinition.loaded", handler);

			await eventBus.emit("eventDefinition.refresh", {});

			await waitForAsync();
			expect(handler).toHaveBeenCalled();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ definitions: [] }),
				}),
			);
		});
	});

	describe("create subscription from config modal", () => {
		it("should create a subscription via subscription.create event", async () => {
			const createdHandler = vi.fn();
			eventBus.on("subscription.created", createdHandler);

			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "Watch Reports",
				filters: { pathPattern: "Reports/**" },
			});

			await waitForAsync();
			expect(createdHandler).toHaveBeenCalledOnce();
			expect(createdHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						subscription: expect.objectContaining({
							eventType: "file.created",
							label: "Watch Reports",
						}),
					}),
				}),
			);
		});

		it("should persist the subscription after creation", async () => {
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "Watch Docs",
				filters: { extension: "md" },
			});

			await waitForAsync();
			const subs = subService.getSubscriptions();
			expect(subs).toHaveLength(1);
			expect(subs[0].eventType).toBe("file.created");
			expect(subs[0].label).toBe("Watch Docs");
		});
	});

	describe("create event definition from config modal", () => {
		it("should create an event definition via eventDefinition.create event", async () => {
			const createdHandler = vi.fn();
			eventBus.on("eventDefinition.created", createdHandler);

			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "report.generated",
				filePattern: "Reports/**",
				emissionPolicy: "always",
				payloadMappings: [],
			});

			await waitForAsync();
			expect(createdHandler).toHaveBeenCalledOnce();
			expect(createdHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						definition: expect.objectContaining({
							domainEventName: "report.generated",
							sourceEventType: "file.created",
						}),
					}),
				}),
			);
		});

		it("should persist the definition after creation", async () => {
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.modified",
				domainEventName: "note.updated",
				emissionPolicy: "once",
				payloadMappings: [],
			});

			await waitForAsync();
			const defs = defService.getDefinitions();
			expect(defs).toHaveLength(1);
			expect(defs[0].domainEventName).toBe("note.updated");
		});
	});

	describe("update and remove configurations", () => {
		it("should update a subscription via subscription.update event", async () => {
			const updatedHandler = vi.fn();
			eventBus.on("subscription.updated", updatedHandler);

			// Create first
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "Original",
				filters: {},
			});
			await waitForAsync();

			const sub = subService.getSubscriptions()[0];

			// Update
			await eventBus.emit("subscription.update", {
				subscriptionId: sub.id,
				label: "Updated Label",
				filters: { pathPattern: "Notes/**" },
			});
			await waitForAsync();

			expect(updatedHandler).toHaveBeenCalledOnce();
			const updated = subService.getSubscription(sub.id);
			expect(updated?.label).toBe("Updated Label");
			expect(updated?.filters.pathPattern).toBe("Notes/**");
		});

		it("should remove a subscription via subscription.remove event", async () => {
			const deletedHandler = vi.fn();
			eventBus.on("subscription.deleted", deletedHandler);

			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "ToDelete",
				filters: {},
			});
			await waitForAsync();

			const sub = subService.getSubscriptions()[0];
			await eventBus.emit("subscription.remove", { subscriptionId: sub.id });
			await waitForAsync();

			expect(deletedHandler).toHaveBeenCalledOnce();
			expect(subService.getSubscriptions()).toHaveLength(0);
		});

		it("should remove an event definition via eventDefinition.remove event", async () => {
			const deletedHandler = vi.fn();
			eventBus.on("eventDefinition.deleted", deletedHandler);

			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "temp.event",
				emissionPolicy: "always",
				payloadMappings: [],
			});
			await waitForAsync();

			const def = defService.getDefinitions()[0];
			await eventBus.emit("eventDefinition.remove", { definitionId: def.id });
			await waitForAsync();

			expect(deletedHandler).toHaveBeenCalledOnce();
			expect(defService.getDefinitions()).toHaveLength(0);
		});
	});

	describe("full browse-and-configure flow", () => {
		it("should support refresh → create sub → create def in sequence", async () => {
			const events: string[] = [];
			eventBus.on("subscription.loaded", () => { events.push("sub.loaded"); });
			eventBus.on("eventDefinition.loaded", () => { events.push("def.loaded"); });
			eventBus.on("subscription.created", () => { events.push("sub.created"); });
			eventBus.on("eventDefinition.created", () => { events.push("def.created"); });

			// Catalog opens: refresh both
			await eventBus.emit("subscription.refresh", {});
			await eventBus.emit("eventDefinition.refresh", {});
			await waitForAsync();

			// User creates a subscription
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "Watch",
				filters: { pathPattern: "Data/**" },
			});
			await waitForAsync();

			// User creates a definition
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "data.ingested",
				emissionPolicy: "always",
				payloadMappings: [],
			});
			await waitForAsync();

			expect(events).toContain("sub.loaded");
			expect(events).toContain("def.loaded");
			expect(events).toContain("sub.created");
			expect(events).toContain("def.created");

			// Both services have persisted state
			expect(subService.getSubscriptions()).toHaveLength(1);
			expect(defService.getDefinitions()).toHaveLength(1);
		});
	});

	it.skip("should render EventCatalogView tabs and search bar (requires Obsidian ItemView)", () => {
		// EventCatalogView extends ItemView with Obsidian rendering lifecycle.
	});

	it.skip("should open EventConfigModal when clicking event name (requires Obsidian Modal)", () => {
		// EventConfigModal.onOpen() requires live Modal rendering.
	});
});
