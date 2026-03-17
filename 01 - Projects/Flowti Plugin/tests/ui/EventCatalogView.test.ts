import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import type { DiscoveredEvent } from "../../src/domain/discovery/types";
import type { Subscription } from "../../src/domain/subscription/types";
import type { EventDefinition } from "../../src/domain/eventDefinition/types";
import { DEFAULT_CATALOG_CATEGORIES, DEFAULT_ENTITY_PATHS } from "../../src/domain/settings/settings";

/**
 * Tests for EventCatalogView's behavioral contracts — event subscriptions,
 * state tracking, and data synchronization.
 *
 * Since EventCatalogView is an Obsidian ItemView (DOM-dependent),
 * we test the behavioral contracts using the EventBus directly,
 * mirroring the same patterns in subscribeToEvents().
 */
describe("EventCatalogView behavior", () => {
	let eventBus: IEventBus;

	beforeEach(() => {
		eventBus = new EventBus();
	});

	// ── Discovery sync ───────────────────────────────────────

	describe("discovery event sync", () => {
		it("should replace discovered events on discovery.loaded", async () => {
			let discoveredEvents: DiscoveredEvent[] = [];

			eventBus.on("discovery.loaded", (event) => {
				discoveredEvents = event.payload.discoveredEvents;
			});

			const payload: DiscoveredEvent[] = [
				{ eventName: "custom.report", sourcePath: "Events/report.md", triggerCount: 3, firstSeenAt: "2026-01-01", lastSeenAt: "2026-01-01" },
			];
			await eventBus.emit("discovery.loaded", { discoveredEvents: payload });

			expect(discoveredEvents).toHaveLength(1);
			expect(discoveredEvents[0].eventName).toBe("custom.report");
		});

		it("should upsert on discovery.updated (new event)", async () => {
			let discoveredEvents: DiscoveredEvent[] = [
				{ eventName: "existing.event", sourcePath: "Events/existing.md", triggerCount: 1, firstSeenAt: "2026-01-01", lastSeenAt: "2026-01-01" },
			];

			eventBus.on("discovery.updated", (event) => {
				const idx = discoveredEvents.findIndex(
					(e) => e.eventName === event.payload.event.eventName,
				);
				if (idx >= 0) {
					discoveredEvents[idx] = event.payload.event;
				} else {
					discoveredEvents.push(event.payload.event);
				}
			});

			const newEvent: DiscoveredEvent = {
				eventName: "new.event", sourcePath: "Events/new.md", triggerCount: 1, firstSeenAt: "2026-01-01", lastSeenAt: "2026-01-01",
			};
			await eventBus.emit("discovery.updated", { event: newEvent, isNew: true });

			expect(discoveredEvents).toHaveLength(2);
			expect(discoveredEvents[1].eventName).toBe("new.event");
		});

		it("should upsert on discovery.updated (existing event)", async () => {
			let discoveredEvents: DiscoveredEvent[] = [
				{ eventName: "existing.event", sourcePath: "Events/existing.md", triggerCount: 1, firstSeenAt: "2026-01-01", lastSeenAt: "2026-01-01" },
			];

			eventBus.on("discovery.updated", (event) => {
				const idx = discoveredEvents.findIndex(
					(e) => e.eventName === event.payload.event.eventName,
				);
				if (idx >= 0) {
					discoveredEvents[idx] = event.payload.event;
				} else {
					discoveredEvents.push(event.payload.event);
				}
			});

			const updated: DiscoveredEvent = {
				eventName: "existing.event", sourcePath: "Events/existing.md", triggerCount: 5, firstSeenAt: "2026-01-01", lastSeenAt: "2026-02-01",
			};
			await eventBus.emit("discovery.updated", { event: updated, isNew: false });

			expect(discoveredEvents).toHaveLength(1);
			expect(discoveredEvents[0].triggerCount).toBe(5);
		});

		it("should remove on discovery.removed", async () => {
			let discoveredEvents: DiscoveredEvent[] = [
				{ eventName: "a.event", sourcePath: "a.md", triggerCount: 1, firstSeenAt: "2026-01-01", lastSeenAt: "2026-01-01" },
				{ eventName: "b.event", sourcePath: "b.md", triggerCount: 1, firstSeenAt: "2026-01-01", lastSeenAt: "2026-01-01" },
			];

			eventBus.on("discovery.removed", (event) => {
				discoveredEvents = discoveredEvents.filter(
					(e) => e.eventName !== event.payload.eventName,
				);
			});

			await eventBus.emit("discovery.removed", { eventName: "a.event" });

			expect(discoveredEvents).toHaveLength(1);
			expect(discoveredEvents[0].eventName).toBe("b.event");
		});
	});

	// ── Event filter sync ────────────────────────────────────

	describe("event filter sync", () => {
		it("should update excluded types on eventFilter.loaded", async () => {
			let excludedTypes = new Set<string>();

			eventBus.on("eventFilter.loaded", (event) => {
				excludedTypes = new Set(event.payload.excludedTypes);
			});

			await eventBus.emit("eventFilter.loaded", {
				excludedTypes: ["file.created", "file.modified"],
			});

			expect(excludedTypes.size).toBe(2);
			expect(excludedTypes.has("file.created")).toBe(true);
			expect(excludedTypes.has("file.modified")).toBe(true);
		});

		it("should update excluded types on eventFilter.changed", async () => {
			let excludedTypes = new Set(["file.created"]);

			eventBus.on("eventFilter.changed", (event) => {
				excludedTypes = new Set(event.payload.excludedTypes);
			});

			await eventBus.emit("eventFilter.changed", {
				excludedTypes: ["user.created"],
			});

			expect(excludedTypes.has("file.created")).toBe(false);
			expect(excludedTypes.has("user.created")).toBe(true);
		});
	});

	// ── Notification sync ────────────────────────────────────

	describe("notification sync", () => {
		it("should update notified types on eventNotify.loaded", async () => {
			let notifiedTypes = new Set<string>();

			eventBus.on("eventNotify.loaded", (event) => {
				notifiedTypes = new Set(event.payload.notifiedTypes);
			});

			await eventBus.emit("eventNotify.loaded", {
				notifiedTypes: ["file.created", "user.created"],
			});

			expect(notifiedTypes.size).toBe(2);
			expect(notifiedTypes.has("file.created")).toBe(true);
		});

		it("should update notified types on eventNotify.changed", async () => {
			let notifiedTypes = new Set(["old.event"]);

			eventBus.on("eventNotify.changed", (event) => {
				notifiedTypes = new Set(event.payload.notifiedTypes);
			});

			await eventBus.emit("eventNotify.changed", {
				notifiedTypes: ["new.event"],
			});

			expect(notifiedTypes.has("old.event")).toBe(false);
			expect(notifiedTypes.has("new.event")).toBe(true);
		});
	});

	// ── Settings sync ────────────────────────────────────────

	describe("settings sync", () => {
		it("should update catalog state on settings.loaded", async () => {
			let docsRootPath = "default/path";
			let showSystemEvents = false;
			let entityPaths = DEFAULT_ENTITY_PATHS;

			eventBus.on("settings.loaded", (event) => {
				docsRootPath = event.payload.settings.docsRootPath;
				entityPaths = event.payload.settings.entityPaths ?? DEFAULT_ENTITY_PATHS;
				showSystemEvents = event.payload.settings.showSystemEvents;
			});

			await eventBus.emit("settings.loaded", {
				settings: {
					docsRootPath: "03 - Docs",
					entityPaths: { events: "Events", domains: "Domains", services: "Services", categories: "Categories", flows: "Flows", systems: "Systems", actors: "Actors", products: "Products" },
					catalogCategories: DEFAULT_CATALOG_CATEGORIES,
					showSystemEvents: true,
					catalogDomains: [],
					catalogServices: [],
				} as never,
			});

			expect(docsRootPath).toBe("03 - Docs");
			expect(showSystemEvents).toBe(true);
			expect(entityPaths.events).toBe("Events");
		});

		it("should update catalog state on settings.changed", async () => {
			let docsRootPath = "default/path";

			eventBus.on("settings.changed", (event) => {
				docsRootPath = event.payload.settings.docsRootPath;
			});

			await eventBus.emit("settings.changed", {
				settings: {
					docsRootPath: "new/docs/path",
					catalogCategories: DEFAULT_CATALOG_CATEGORIES,
					showSystemEvents: false,
					catalogDomains: [],
					catalogServices: [],
				} as never,
			});

			expect(docsRootPath).toBe("new/docs/path");
		});
	});

	// ── Subscription tracking ────────────────────────────────

	describe("subscription tracking", () => {
		it("should replace all subscriptions on subscription.loaded", async () => {
			let subscriptions: Subscription[] = [];

			eventBus.on("subscription.loaded", (event) => {
				subscriptions = event.payload.subscriptions;
			});

			const subs: Subscription[] = [
				{ id: "s1", eventType: "file.created", label: "CSV Files", enabled: true, filters: {}, createdAt: "2026-01-01" },
				{ id: "s2", eventType: "file.modified", label: "Reports", enabled: false, filters: {}, createdAt: "2026-01-01" },
			];
			await eventBus.emit("subscription.loaded", { subscriptions: subs });

			expect(subscriptions).toHaveLength(2);
		});

		it("should add or replace on subscription.created", async () => {
			let subscriptions: Subscription[] = [
				{ id: "s1", eventType: "file.created", label: "Old", enabled: true, filters: {}, createdAt: "2026-01-01" },
			];

			eventBus.on("subscription.created", (event) => {
				subscriptions = [
					...subscriptions.filter((s) => s.id !== event.payload.subscription.id),
					event.payload.subscription,
				];
			});

			const newSub: Subscription = { id: "s2", eventType: "file.modified", label: "New", enabled: true, filters: {}, createdAt: "2026-01-01" };
			await eventBus.emit("subscription.created", { subscription: newSub });

			expect(subscriptions).toHaveLength(2);
			expect(subscriptions[1].label).toBe("New");
		});

		it("should update existing subscription on subscription.updated", async () => {
			let subscriptions: Subscription[] = [
				{ id: "s1", eventType: "file.created", label: "Old Label", enabled: true, filters: {}, createdAt: "2026-01-01" },
			];

			eventBus.on("subscription.updated", (event) => {
				subscriptions = subscriptions.map((s) =>
					s.id === event.payload.subscription.id ? event.payload.subscription : s,
				);
			});

			const updated: Subscription = { id: "s1", eventType: "file.created", label: "New Label", enabled: false, filters: {}, createdAt: "2026-01-01" };
			await eventBus.emit("subscription.updated", { subscription: updated });

			expect(subscriptions).toHaveLength(1);
			expect(subscriptions[0].label).toBe("New Label");
			expect(subscriptions[0].enabled).toBe(false);
		});

		it("should remove on subscription.deleted", async () => {
			let subscriptions: Subscription[] = [
				{ id: "s1", eventType: "file.created", label: "A", enabled: true, filters: {}, createdAt: "2026-01-01" },
				{ id: "s2", eventType: "file.modified", label: "B", enabled: true, filters: {}, createdAt: "2026-01-01" },
			];

			eventBus.on("subscription.deleted", (event) => {
				subscriptions = subscriptions.filter(
					(s) => s.id !== event.payload.subscriptionId,
				);
			});

			await eventBus.emit("subscription.deleted", { subscriptionId: "s1" });

			expect(subscriptions).toHaveLength(1);
			expect(subscriptions[0].id).toBe("s2");
		});
	});

	// ── Definition tracking ──────────────────────────────────

	describe("definition tracking", () => {
		it("should replace all definitions on eventDefinition.loaded", async () => {
			let definitions: EventDefinition[] = [];

			eventBus.on("eventDefinition.loaded", (event) => {
				definitions = event.payload.definitions;
			});

			const defs: EventDefinition[] = [
				{ id: "d1", sourceEventType: "file.created", filePattern: "**/*.csv", domainEventName: "report.received", emissionPolicy: "always", payloadMappings: [], enabled: true, createdAt: "2026-01-01" },
			];
			await eventBus.emit("eventDefinition.loaded", { definitions: defs });

			expect(definitions).toHaveLength(1);
		});

		it("should add on eventDefinition.created", async () => {
			let definitions: EventDefinition[] = [];

			eventBus.on("eventDefinition.created", (event) => {
				definitions = [
					...definitions.filter((d) => d.id !== event.payload.definition.id),
					event.payload.definition,
				];
			});

			const def: EventDefinition = {
				id: "d1", sourceEventType: "file.created", filePattern: "**/*.csv",
				domainEventName: "report.received", emissionPolicy: "always",
				payloadMappings: [], enabled: true, createdAt: "2026-01-01",
			};
			await eventBus.emit("eventDefinition.created", { definition: def });

			expect(definitions).toHaveLength(1);
			expect(definitions[0].domainEventName).toBe("report.received");
		});

		it("should update existing definition on eventDefinition.updated", async () => {
			let definitions: EventDefinition[] = [
				{ id: "d1", sourceEventType: "file.created", filePattern: "**/*.csv", domainEventName: "report.received", emissionPolicy: "always", payloadMappings: [], enabled: true, createdAt: "2026-01-01" },
			];

			eventBus.on("eventDefinition.updated", (event) => {
				definitions = definitions.map((d) =>
					d.id === event.payload.definition.id ? event.payload.definition : d,
				);
			});

			const updated: EventDefinition = {
				id: "d1", sourceEventType: "file.created", filePattern: "**/*.md",
				domainEventName: "doc.received", emissionPolicy: "once",
				payloadMappings: [], enabled: false, createdAt: "2026-01-01",
			};
			await eventBus.emit("eventDefinition.updated", { definition: updated });

			expect(definitions).toHaveLength(1);
			expect(definitions[0].filePattern).toBe("**/*.md");
			expect(definitions[0].emissionPolicy).toBe("once");
		});

		it("should remove on eventDefinition.deleted", async () => {
			let definitions: EventDefinition[] = [
				{ id: "d1", sourceEventType: "file.created", filePattern: "**/*.csv", domainEventName: "report.received", emissionPolicy: "always", payloadMappings: [], enabled: true, createdAt: "2026-01-01" },
			];

			eventBus.on("eventDefinition.deleted", (event) => {
				definitions = definitions.filter(
					(d) => d.id !== event.payload.definitionId,
				);
			});

			await eventBus.emit("eventDefinition.deleted", { definitionId: "d1" });

			expect(definitions).toHaveLength(0);
		});
	});

	// ── Doc lifecycle ────────────────────────────────────────

	describe("doc lifecycle", () => {
		it("should schedule delayed re-render on doc.created", async () => {
			const renderSpy = vi.fn();

			eventBus.on("doc.created", () => {
				setTimeout(() => renderSpy(), 500);
			});

			await eventBus.emit("doc.created", {
				path: "docs/Flows/Daily.md",
				created: true,
				docType: "FlowDoc" as const,
				name: "Daily",
				source: "FlowsTab",
			});

			// Not called immediately (delayed by 500ms)
			expect(renderSpy).not.toHaveBeenCalled();

			// After delay
			await new Promise((r) => setTimeout(r, 600));
			expect(renderSpy).toHaveBeenCalledOnce();
		});

		it("should schedule immediate re-render on doc.deleted", async () => {
			const renderSpy = vi.fn();

			eventBus.on("doc.deleted", () => {
				renderSpy();
			});

			await eventBus.emit("doc.deleted", {
				path: "docs/Flows/Daily.md",
				source: "FlowsTab",
			});

			expect(renderSpy).toHaveBeenCalledOnce();
		});
	});

	// ── Refresh requests ─────────────────────────────────────

	describe("refresh requests on open", () => {
		it("should emit subscription.refresh to request current state", async () => {
			const refreshSpy = vi.fn();
			eventBus.on("subscription.refresh", refreshSpy);

			await eventBus.emit("subscription.refresh", {});

			expect(refreshSpy).toHaveBeenCalledOnce();
		});

		it("should emit eventDefinition.refresh to request current state", async () => {
			const refreshSpy = vi.fn();
			eventBus.on("eventDefinition.refresh", refreshSpy);

			await eventBus.emit("eventDefinition.refresh", {});

			expect(refreshSpy).toHaveBeenCalledOnce();
		});
	});

	// ── Cleanup ──────────────────────────────────────────────

	describe("cleanup on close", () => {
		it("should stop receiving events after all unsubscribes", async () => {
			const received: string[] = [];

			const unsub1 = eventBus.on("subscription.loaded", () => { received.push("sub"); });
			const unsub2 = eventBus.on("eventDefinition.loaded", () => { received.push("def"); });

			await eventBus.emit("subscription.loaded", { subscriptions: [] });
			expect(received).toHaveLength(1);

			// Simulate onClose — unsubscribe all
			unsub1();
			unsub2();

			await eventBus.emit("subscription.loaded", { subscriptions: [] });
			await eventBus.emit("eventDefinition.loaded", { definitions: [] });

			// Should not receive any new events
			expect(received).toHaveLength(1);
		});
	});
});
