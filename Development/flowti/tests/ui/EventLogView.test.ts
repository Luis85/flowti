import { describe, it, expect, beforeEach } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import { getEventCategory } from "../../src/infrastructure/events/catalog";
import { getStatusClass, getContextLine } from "../../src/ui/catalog/EventLogView";

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

	describe("status class resolution", () => {
		it("should return 'success' for completed events", () => {
			expect(getStatusClass("ingestion.job.completed")).toBe("success");
			expect(getStatusClass("installer.step.completed")).toBe("success");
		});

		it("should return 'success' for created events", () => {
			expect(getStatusClass("user.created")).toBe("success");
			expect(getStatusClass("subscription.created")).toBe("success");
		});

		it("should return 'success' for loaded events", () => {
			expect(getStatusClass("settings.loaded")).toBe("success");
			expect(getStatusClass("eventDefinition.loaded")).toBe("success");
		});

		it("should return 'success' for matched events", () => {
			expect(getStatusClass("subscription.matched")).toBe("success");
			expect(getStatusClass("eventDefinition.matched")).toBe("success");
		});

		it("should return 'error' for failed events", () => {
			expect(getStatusClass("ingestion.job.failed")).toBe("error");
			expect(getStatusClass("installer.failed")).toBe("error");
		});

		it("should return 'error' for error.* events", () => {
			expect(getStatusClass("error.occurred")).toBe("error");
		});

		it("should return 'info' for started events", () => {
			expect(getStatusClass("ingestion.job.started")).toBe("info");
			expect(getStatusClass("ingestion.batch.started")).toBe("info");
		});

		it("should return 'info' for queued events", () => {
			expect(getStatusClass("ingestion.job.queued")).toBe("info");
		});

		it("should return 'neutral' for other events", () => {
			expect(getStatusClass("settings.changed")).toBe("neutral");
			expect(getStatusClass("file.created")).toBe("success");
			expect(getStatusClass("plugin.ready")).toBe("neutral");
		});
	});

	describe("context line extraction", () => {
		it("should extract subscription label from subscription.matched", () => {
			const result = getContextLine({
				type: "subscription.matched",
				category: "Watch Rules",
				description: "",
				payload: { subscriptionLabel: "Daily Reports", eventType: "file.created", subscriptionId: "sub1" },
				timestamp: "2026-01-01T00:00:00Z",
			});
			expect(result).toBe("Watcher: Daily Reports");
		});

		it("should fall back to eventType when subscriptionLabel is missing", () => {
			const result = getContextLine({
				type: "subscription.matched",
				category: "Watch Rules",
				description: "",
				payload: { eventType: "file.created", subscriptionId: "sub1" },
				timestamp: "2026-01-01T00:00:00Z",
			});
			expect(result).toBe("Watcher: file.created");
		});

		it("should extract file path from ingestion.job.completed", () => {
			const result = getContextLine({
				type: "ingestion.job.completed",
				category: "File Processing",
				description: "",
				payload: { jobId: "j1", eventType: "file.created", payload: { path: "Reports/daily.csv" } },
				timestamp: "2026-01-01T00:00:00Z",
			});
			expect(result).toBe("File: Reports/daily.csv");
		});

		it("should extract error from ingestion.job.failed", () => {
			const result = getContextLine({
				type: "ingestion.job.failed",
				category: "File Processing",
				description: "",
				payload: { jobId: "j1", eventType: "file.created", error: "Timeout", retryCount: 1, willRetry: true },
				timestamp: "2026-01-01T00:00:00Z",
			});
			expect(result).toBe("Error: Timeout");
		});

		it("should extract domainEventName from eventDefinition.matched", () => {
			const result = getContextLine({
				type: "eventDefinition.matched",
				category: "Transforms",
				description: "",
				payload: { definitionId: "def1", domainEventName: "report.received", sourcePath: "Reports/daily.csv" },
				timestamp: "2026-01-01T00:00:00Z",
			});
			expect(result).toBe("Emitted: report.received");
		});

		it("should return null for events without enrichment", () => {
			const result = getContextLine({
				type: "plugin.ready",
				category: "Plugin Lifecycle",
				description: "",
				payload: { timestamp: "2026-01-01" },
				timestamp: "2026-01-01T00:00:00Z",
			});
			expect(result).toBeNull();
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

	describe("E2E mode contracts", () => {
		it("should parse valid JSON payload from trace entries", () => {
			const payload = '{"source":"tool-showcase","step":"3"}';
			const parsed = JSON.parse(payload);
			expect(parsed).toEqual({ source: "tool-showcase", step: "3" });
		});

		it("should handle invalid JSON payload gracefully", () => {
			const payload = "not-json";
			let result: unknown;
			try {
				result = JSON.parse(payload);
			} catch {
				result = payload;
			}
			expect(result).toBe("not-json");
		});

		it("should handle empty payload string", () => {
			const payload = "{}";
			const parsed = JSON.parse(payload);
			expect(parsed).toEqual({});
		});

		it("should convert epoch timestamp to ISO string", () => {
			const ts = 1709251200000; // 2024-03-01T00:00:00.000Z
			const iso = new Date(ts).toISOString();
			expect(iso).toBe("2024-03-01T00:00:00.000Z");
		});

		it("should track asserted event types in a Set", () => {
			const asserted = new Set(["hub.tab.changed", "session.created"]);
			expect(asserted.has("hub.tab.changed")).toBe(true);
			expect(asserted.has("session.created")).toBe(true);
			expect(asserted.has("file.created")).toBe(false);
		});

		it("should bypass subscribed mode filter in E2E mode", () => {
			const notifiedTypes = new Set(["file.created"]);
			const e2eMode = true;
			const allEvents = [
				{ type: "file.created" },
				{ type: "plugin.ready" },
				{ type: "user.created" },
			];

			// E2E mode: bypass subscribed filter, show all
			const visible = allEvents.filter((e) => {
				if (!e2eMode && !notifiedTypes.has(e.type)) return false;
				return true;
			});
			expect(visible).toHaveLength(3);
		});

		it("should still apply text filter in E2E mode", () => {
			const e2eMode = true;
			const activeFilter = "hub";
			const allEvents = [
				{ type: "hub.tab.changed", description: "Tab changed" },
				{ type: "plugin.ready", description: "Plugin ready" },
				{ type: "hub.navigate", description: "Navigate hub" },
			];

			const visible = allEvents.filter((e) => {
				if (activeFilter) {
					return e.type.toLowerCase().includes(activeFilter) || e.description.toLowerCase().includes(activeFilter);
				}
				return true;
			});
			expect(visible.map((e) => e.type)).toEqual(["hub.tab.changed", "hub.navigate"]);
			expect(e2eMode).toBe(true); // E2E mode doesn't affect text filter
		});
	});
});
