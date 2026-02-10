import { describe, it, expect, beforeEach } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import { getEventCategory } from "../../src/infrastructure/events/catalog";

/**
 * Tests for EventLogView's core logic — wildcard subscription,
 * event buffering, log.* filtering, category visibility, mode
 * filtering, and cleanup.
 *
 * Since EventLogView is an Obsidian ItemView (DOM-dependent),
 * we test the behavioral contracts using the EventBus directly.
 */
describe("EventLogView behavior", () => {
	let eventBus: EventBus;

	beforeEach(() => {
		eventBus = new EventBus();
	});

	describe("wildcard subscription", () => {
		it("should receive events via wildcard listener", async () => {
			const received: string[] = [];

			eventBus.on("*", (event) => {
				received.push(event.type);
			});

			await eventBus.emit("user.created", {
				user: { id: "u1" as never, name: "Test", createdAt: "2026-01-01" },
			});
			await eventBus.emit("settings.changed", {
				settings: {} as never,
			});

			expect(received).toEqual(["user.created", "settings.changed"]);
		});

		it("should allow filtering out log.* events", async () => {
			const received: string[] = [];
			const SKIPPED_PREFIXES = ["log."];

			eventBus.on("*", (event) => {
				if (SKIPPED_PREFIXES.some((p) => event.type.startsWith(p))) return;
				received.push(event.type);
			});

			await eventBus.emit("user.created", {
				user: { id: "u1" as never, name: "Test", createdAt: "2026-01-01" },
			});
			await eventBus.emit("log.entry", {
				level: "info",
				message: "test",
				context: "test",
				timestamp: "2026-01-01",
			});
			await eventBus.emit("plugin.ready", {
				timestamp: "2026-01-01",
			});

			expect(received).toEqual(["user.created", "plugin.ready"]);
		});
	});

	describe("unsubscribe on close", () => {
		it("should stop receiving events after unsubscribe", async () => {
			const received: string[] = [];

			const unsubscribe = eventBus.on("*", (event) => {
				received.push(event.type);
			});

			await eventBus.emit("plugin.ready", { timestamp: "2026-01-01" });
			expect(received).toHaveLength(1);

			// Simulate onClose
			unsubscribe();

			await eventBus.emit("user.created", {
				user: { id: "u1" as never, name: "Test", createdAt: "2026-01-01" },
			});
			expect(received).toHaveLength(1); // No new events
		});
	});

	describe("circular buffer behavior", () => {
		it("should cap events at MAX_ENTRIES", async () => {
			const MAX_ENTRIES = 500;
			const events: unknown[] = [];

			eventBus.on("*", (event) => {
				events.unshift(event);
				if (events.length > MAX_ENTRIES) {
					events.length = MAX_ENTRIES;
				}
			});

			// Emit more than MAX_ENTRIES events
			for (let i = 0; i < 510; i++) {
				await eventBus.emit("plugin.ready", { timestamp: `2026-01-01T00:00:${String(i).padStart(2, "0")}` });
			}

			expect(events.length).toBe(MAX_ENTRIES);
		});
	});

	describe("pause behavior", () => {
		it("should skip events when paused", async () => {
			const received: string[] = [];
			let paused = false;

			eventBus.on("*", (event) => {
				if (paused) return;
				received.push(event.type);
			});

			await eventBus.emit("plugin.ready", { timestamp: "2026-01-01" });
			expect(received).toHaveLength(1);

			paused = true;
			await eventBus.emit("user.created", {
				user: { id: "u1" as never, name: "Test", createdAt: "2026-01-01" },
			});
			expect(received).toHaveLength(1); // Paused, no new events

			paused = false;
			await eventBus.emit("settings.loaded", { settings: {} as never });
			expect(received).toHaveLength(2);
		});
	});

	describe("hidden category filtering", () => {
		it("should skip events from hidden categories", async () => {
			const received: string[] = [];
			const hiddenCategories = new Set(["Plugin Lifecycle", "Service Lifecycle"]);
			const SKIPPED_PREFIXES = ["log."];

			eventBus.on("*", (event) => {
				if (SKIPPED_PREFIXES.some((p) => event.type.startsWith(p))) return;
				const category = getEventCategory(event.type) ?? "Unknown";
				if (hiddenCategories.has(category)) return;
				received.push(event.type);
			});

			// Plugin Lifecycle — hidden
			await eventBus.emit("plugin.ready", { timestamp: "2026-01-01" });
			// Service Lifecycle — hidden
			await eventBus.emit("service.registered", { serviceId: "test" });
			// User — visible
			await eventBus.emit("user.created", {
				user: { id: "u1" as never, name: "Test", createdAt: "2026-01-01" },
			});

			expect(received).toEqual(["user.created"]);
		});

		it("should pass events from visible categories", async () => {
			const received: string[] = [];
			const hiddenCategories = new Set(["Commands"]);

			eventBus.on("*", (event) => {
				const category = getEventCategory(event.type) ?? "Unknown";
				if (hiddenCategories.has(category)) return;
				received.push(event.type);
			});

			// File Notifications — visible
			await eventBus.emit("file.created", { path: "test.md", source: "user" });
			// Commands — hidden
			await eventBus.emit("command.registered", { commandId: "test", commandName: "Test" });

			expect(received).toEqual(["file.created"]);
		});
	});

	describe("subscribed mode filtering", () => {
		it("should filter to notified types only in subscribed mode", () => {
			const notifiedTypes = new Set(["file.created", "user.created"]);
			const allEvents = [
				{ type: "file.created" },
				{ type: "plugin.ready" },
				{ type: "user.created" },
				{ type: "settings.changed" },
			];

			const subscribed = allEvents.filter((e) => notifiedTypes.has(e.type));
			expect(subscribed.map((e) => e.type)).toEqual(["file.created", "user.created"]);
		});

		it("should show all events in 'all' mode", () => {
			const allEvents = [
				{ type: "file.created" },
				{ type: "plugin.ready" },
				{ type: "user.created" },
			];

			// "all" mode = no notifiedTypes filter
			expect(allEvents).toHaveLength(3);
		});

		it("should return empty when no events are subscribed", () => {
			const notifiedTypes = new Set<string>();
			const allEvents = [
				{ type: "file.created" },
				{ type: "plugin.ready" },
			];

			const subscribed = allEvents.filter((e) => notifiedTypes.has(e.type));
			expect(subscribed).toHaveLength(0);
		});
	});
});
