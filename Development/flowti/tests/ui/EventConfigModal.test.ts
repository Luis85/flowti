import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import type { Subscription } from "../../src/domain/subscription/types";
import type { EventDefinition } from "../../src/domain/eventDefinition/types";

/**
 * Tests for EventConfigModal's event interaction patterns.
 *
 * Since the modal depends on Obsidian DOM, we test the event-driven
 * contracts: filtering subscriptions/definitions by event type,
 * emitting correct commands with pre-filled event types, and
 * requesting state on open via refresh events.
 */
describe("EventConfigModal event interactions", () => {
	let eventBus: IEventBus;

	beforeEach(() => {
		eventBus = new EventBus();
	});

	describe("refresh on open", () => {
		it("should emit subscription.refresh to request state", async () => {
			const handler = vi.fn();
			eventBus.on("subscription.refresh", handler);

			await eventBus.emit("subscription.refresh", {});

			expect(handler).toHaveBeenCalledTimes(1);
		});

		it("should emit eventDefinition.refresh to request state", async () => {
			const handler = vi.fn();
			eventBus.on("eventDefinition.refresh", handler);

			await eventBus.emit("eventDefinition.refresh", {});

			expect(handler).toHaveBeenCalledTimes(1);
		});
	});

	describe("subscription filtering by event type", () => {
		it("should filter subscriptions to matching event type", () => {
			const targetType = "file.created";
			const allSubscriptions: Subscription[] = [
				{
					id: "sub1",
					eventType: "file.created",
					label: "Reports",
					filters: { pathPattern: "Reports/**" },
					enabled: true,
					createdAt: "2026-01-01T00:00:00Z",
				},
				{
					id: "sub2",
					eventType: "file.modified",
					label: "Modified files",
					filters: {},
					enabled: true,
					createdAt: "2026-01-01T00:00:00Z",
				},
				{
					id: "sub3",
					eventType: "file.created",
					label: "CSV files",
					filters: { extension: "csv" },
					enabled: true,
					createdAt: "2026-01-01T00:00:00Z",
				},
			];

			const filtered = allSubscriptions.filter(
				(s) => s.eventType === targetType
			);

			expect(filtered).toHaveLength(2);
			expect(filtered.map((s) => s.id)).toEqual(["sub1", "sub3"]);
		});
	});

	describe("definition filtering by source event type", () => {
		it("should filter definitions to matching source event type", () => {
			const targetType = "file.created";
			const allDefinitions: EventDefinition[] = [
				{
					id: "def1",
					sourceEventType: "file.created",
					domainEventName: "report.received",
					filePattern: "Reports/**",
					payloadMappings: [],
					emissionPolicy: "always",
					enabled: true,
					createdAt: "2026-01-01T00:00:00Z",
				},
				{
					id: "def2",
					sourceEventType: "file.modified",
					domainEventName: "doc.updated",
					payloadMappings: [],
					emissionPolicy: "once",
					enabled: true,
					createdAt: "2026-01-01T00:00:00Z",
				},
			];

			const filtered = allDefinitions.filter(
				(d) => d.sourceEventType === targetType
			);

			expect(filtered).toHaveLength(1);
			expect(filtered[0].id).toBe("def1");
		});
	});

	describe("subscription creation with pre-filled event type", () => {
		it("should emit subscription.create with the catalog event type", async () => {
			const handler = vi.fn();
			eventBus.on("subscription.create", handler);

			// Simulate what the modal does when user clicks Create
			await eventBus.emit("subscription.create", {
				eventType: "file.created",
				label: "Test sub",
				filters: { pathPattern: "Reports/**" },
			});

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						eventType: "file.created",
						label: "Test sub",
						filters: { pathPattern: "Reports/**" },
					}),
				})
			);
		});
	});

	describe("definition creation with pre-filled source event type", () => {
		it("should emit eventDefinition.create with the catalog event type", async () => {
			const handler = vi.fn();
			eventBus.on("eventDefinition.create", handler);

			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "report.received",
				payloadMappings: [
					{ field: "ext", source: "derived", expression: "extension" },
				],
				emissionPolicy: "always",
			});

			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						sourceEventType: "file.created",
						domainEventName: "report.received",
						emissionPolicy: "always",
					}),
				})
			);
		});
	});
});
