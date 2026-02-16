import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { EventDefinitionService } from "../../../src/domain/eventDefinition/EventDefinitionService";
import type { ITypedStorage } from "../../../src/utils/TypedStorage";
import type { EventDefinitionState } from "../../../src/domain/eventDefinition/types";
import { DEFAULT_SETTINGS } from "../../../src/domain/settings/settings";
import { createMockStorage } from "../../mocks/storage";

describe("EventDefinitionService", () => {
	let service: EventDefinitionService;
	let storage: ITypedStorage<EventDefinitionState>;
	let getData: () => EventDefinitionState | undefined;
	let eventBus: IEventBus;

	beforeEach(() => {
		const mock = createMockStorage<EventDefinitionState>();
		storage = mock.storage;
		getData = mock.getData;
		eventBus = new EventBus();
		service = new EventDefinitionService({ storage, eventBus });
	});

	describe("load", () => {
		it("should load empty state when no data exists", async () => {
			await service.load();
			expect(service.getDefinitions()).toEqual([]);
		});

		it("should load persisted definition state", async () => {
			const existingState: EventDefinitionState = {
				definitions: {
					def1: {
						id: "def1",
						sourceEventType: "file.created",
						filePattern: "Reports/**",
						domainEventName: "report.received",
						payloadMappings: [],
						emissionPolicy: "always",
						enabled: true,
						createdAt: "2026-01-01T00:00:00Z",
					},
				},
				emittedKeys: [],
			};
			const mock = createMockStorage(existingState);
			service = new EventDefinitionService({ storage: mock.storage, eventBus });

			await service.load();

			expect(service.getDefinitions()).toHaveLength(1);
			expect(service.getDefinition("def1")).toBeDefined();
			expect(service.getDefinition("def1")?.domainEventName).toBe("report.received");
		});

		it("should emit eventDefinition.loaded on load", async () => {
			const handler = vi.fn();
			eventBus.on("eventDefinition.loaded", handler);

			await service.load();

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "eventDefinition.loaded",
					payload: { definitions: [] },
				})
			);
		});
	});

	describe("create", () => {
		it("should create a definition via command event", async () => {
			const handler = vi.fn();
			eventBus.on("eventDefinition.created", handler);

			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				filePattern: "Reports/**",
				domainEventName: "report.received",
				payloadMappings: [
					{ field: "ext", source: "derived", expression: "extension" },
				],
				emissionPolicy: "always",
			});

			expect(service.getDefinitions()).toHaveLength(1);
			const def = service.getDefinitions()[0];
			expect(def.sourceEventType).toBe("file.created");
			expect(def.domainEventName).toBe("report.received");
			expect(def.filePattern).toBe("Reports/**");
			expect(def.enabled).toBe(true);
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it("should persist state after create", async () => {
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "test.event",
				payloadMappings: [],
				emissionPolicy: "always",
			});

			const state = getData();
			expect(state).toBeDefined();
			expect(Object.keys(state!.definitions)).toHaveLength(1);
		});
	});

	describe("update", () => {
		it("should update a definition's domainEventName", async () => {
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "original.event",
				payloadMappings: [],
				emissionPolicy: "always",
			});
			const def = service.getDefinitions()[0];

			const handler = vi.fn();
			eventBus.on("eventDefinition.updated", handler);

			await eventBus.emit("eventDefinition.update", {
				definitionId: def.id,
				domainEventName: "updated.event",
			});

			expect(service.getDefinition(def.id)?.domainEventName).toBe("updated.event");
			expect(handler).toHaveBeenCalledTimes(1);
		});

		it("should update a definition's enabled state", async () => {
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "test.event",
				payloadMappings: [],
				emissionPolicy: "always",
			});
			const def = service.getDefinitions()[0];
			expect(def.enabled).toBe(true);

			await eventBus.emit("eventDefinition.update", {
				definitionId: def.id,
				enabled: false,
			});

			expect(service.getDefinition(def.id)?.enabled).toBe(false);
		});

		it("should ignore update for non-existent definition", async () => {
			const handler = vi.fn();
			eventBus.on("eventDefinition.updated", handler);

			await eventBus.emit("eventDefinition.update", {
				definitionId: "nonexistent",
				domainEventName: "test",
			});

			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("remove", () => {
		it("should remove a definition", async () => {
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "test.event",
				payloadMappings: [],
				emissionPolicy: "always",
			});
			const def = service.getDefinitions()[0];

			const handler = vi.fn();
			eventBus.on("eventDefinition.deleted", handler);

			await eventBus.emit("eventDefinition.remove", {
				definitionId: def.id,
			});

			expect(service.getDefinitions()).toHaveLength(0);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { definitionId: def.id },
				})
			);
		});

		it("should ignore remove for non-existent definition", async () => {
			const handler = vi.fn();
			eventBus.on("eventDefinition.deleted", handler);

			await eventBus.emit("eventDefinition.remove", {
				definitionId: "nonexistent",
			});

			expect(handler).not.toHaveBeenCalled();
		});
	});

	describe("matching", () => {
		it("should emit domain event via emitCustom when definition matches", async () => {
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				filePattern: "Reports/**",
				domainEventName: "report.received",
				payloadMappings: [
					{ field: "ext", source: "derived", expression: "extension" },
				],
				emissionPolicy: "always",
			});

			const customHandler = vi.fn();
			eventBus.on("*", (event) => {
				if ((event.type as string) === "report.received") customHandler(event);
			});

			const matchHandler = vi.fn();
			eventBus.on("eventDefinition.matched", matchHandler);

			// Simulate ingestion.job.completed with enriched payload
			await eventBus.emit("ingestion.job.completed", {
				jobId: "job1",
				eventType: "file.created",
				payload: { path: "Reports/daily.csv", source: "sync" },
			});

			expect(customHandler).toHaveBeenCalledTimes(1);
			expect(customHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "report.received",
					payload: expect.objectContaining({ ext: "csv" }),
				})
			);
			expect(matchHandler).toHaveBeenCalledTimes(1);
		});

		it("should not match when file pattern does not match", async () => {
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				filePattern: "Reports/**",
				domainEventName: "report.received",
				payloadMappings: [],
				emissionPolicy: "always",
			});

			const matchHandler = vi.fn();
			eventBus.on("eventDefinition.matched", matchHandler);

			await eventBus.emit("ingestion.job.completed", {
				jobId: "job1",
				eventType: "file.created",
				payload: { path: "Other/data.csv", source: "sync" },
			});

			expect(matchHandler).not.toHaveBeenCalled();
		});

		it("should not match when source event type differs", async () => {
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "test.event",
				payloadMappings: [],
				emissionPolicy: "always",
			});

			const matchHandler = vi.fn();
			eventBus.on("eventDefinition.matched", matchHandler);

			await eventBus.emit("ingestion.job.completed", {
				jobId: "job1",
				eventType: "file.modified",
				payload: { path: "test.md", source: "user" },
			});

			expect(matchHandler).not.toHaveBeenCalled();
		});

		it("should not match disabled definitions", async () => {
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "test.event",
				payloadMappings: [],
				emissionPolicy: "always",
			});
			const def = service.getDefinitions()[0];

			await eventBus.emit("eventDefinition.update", {
				definitionId: def.id,
				enabled: false,
			});

			const matchHandler = vi.fn();
			eventBus.on("eventDefinition.matched", matchHandler);

			await eventBus.emit("ingestion.job.completed", {
				jobId: "job1",
				eventType: "file.created",
				payload: { path: "test.md", source: "user" },
			});

			expect(matchHandler).not.toHaveBeenCalled();
		});

		it("should match without file pattern (any path)", async () => {
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "any.file.event",
				payloadMappings: [],
				emissionPolicy: "always",
			});

			const matchHandler = vi.fn();
			eventBus.on("eventDefinition.matched", matchHandler);

			await eventBus.emit("ingestion.job.completed", {
				jobId: "job1",
				eventType: "file.created",
				payload: { path: "any/path/file.md", source: "user" },
			});

			expect(matchHandler).toHaveBeenCalledTimes(1);
		});

		it("should not emit when ingestion.job.completed has no payload", async () => {
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "test.event",
				payloadMappings: [],
				emissionPolicy: "always",
			});

			const matchHandler = vi.fn();
			eventBus.on("eventDefinition.matched", matchHandler);

			await eventBus.emit("ingestion.job.completed", {
				jobId: "job1",
				eventType: "file.created",
			});

			expect(matchHandler).not.toHaveBeenCalled();
		});
	});

	describe("emission policy: once", () => {
		it("should emit only once per definition+path combination", async () => {
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "report.received",
				payloadMappings: [],
				emissionPolicy: "once",
			});

			const matchHandler = vi.fn();
			eventBus.on("eventDefinition.matched", matchHandler);

			// First time — should match
			await eventBus.emit("ingestion.job.completed", {
				jobId: "job1",
				eventType: "file.created",
				payload: { path: "Reports/daily.csv", source: "sync" },
			});
			expect(matchHandler).toHaveBeenCalledTimes(1);

			// Second time, same path — should NOT match
			matchHandler.mockClear();
			await eventBus.emit("ingestion.job.completed", {
				jobId: "job2",
				eventType: "file.created",
				payload: { path: "Reports/daily.csv", source: "sync" },
			});
			expect(matchHandler).not.toHaveBeenCalled();
		});

		it("should emit for different paths with 'once' policy", async () => {
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "report.received",
				payloadMappings: [],
				emissionPolicy: "once",
			});

			const matchHandler = vi.fn();
			eventBus.on("eventDefinition.matched", matchHandler);

			await eventBus.emit("ingestion.job.completed", {
				jobId: "job1",
				eventType: "file.created",
				payload: { path: "Reports/jan.csv", source: "sync" },
			});
			expect(matchHandler).toHaveBeenCalledTimes(1);

			matchHandler.mockClear();
			await eventBus.emit("ingestion.job.completed", {
				jobId: "job2",
				eventType: "file.created",
				payload: { path: "Reports/feb.csv", source: "sync" },
			});
			expect(matchHandler).toHaveBeenCalledTimes(1);
		});
	});

	describe("master toggle", () => {
		it("should not match when disabled via settings.changed", async () => {
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "test.event",
				payloadMappings: [],
				emissionPolicy: "always",
			});

			const matchHandler = vi.fn();
			eventBus.on("eventDefinition.matched", matchHandler);

			await eventBus.emit("settings.changed", {
				settings: { ...DEFAULT_SETTINGS, eventSystemEnabled: false },
			});

			await eventBus.emit("ingestion.job.completed", {
				jobId: "job1",
				eventType: "file.created",
				payload: { path: "test.md", source: "user" },
			});

			expect(matchHandler).not.toHaveBeenCalled();
		});

		it("should respect settings.loaded for initial state", async () => {
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "test.event",
				payloadMappings: [],
				emissionPolicy: "always",
			});

			const matchHandler = vi.fn();
			eventBus.on("eventDefinition.matched", matchHandler);

			await eventBus.emit("settings.loaded", {
				settings: { ...DEFAULT_SETTINGS, eventSystemEnabled: false },
			});

			await eventBus.emit("ingestion.job.completed", {
				jobId: "job1",
				eventType: "file.created",
				payload: { path: "test.md", source: "user" },
			});

			expect(matchHandler).not.toHaveBeenCalled();
		});
	});

	describe("persistence", () => {
		it("should save state with definitions on create", async () => {
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "test.event",
				payloadMappings: [],
				emissionPolicy: "always",
			});

			const state = getData();
			expect(state).toBeDefined();
			expect(Object.keys(state!.definitions)).toHaveLength(1);
			expect(state!.emittedKeys).toBeDefined();
		});
	});

	describe("refresh", () => {
		it("should re-emit eventDefinition.loaded on eventDefinition.refresh", async () => {
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "report.received",
				payloadMappings: [],
				emissionPolicy: "always",
			});

			const handler = vi.fn();
			eventBus.on("eventDefinition.loaded", handler);

			await eventBus.emit("eventDefinition.refresh", {});

			expect(handler).toHaveBeenCalledTimes(1);
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					type: "eventDefinition.loaded",
					payload: {
						definitions: expect.arrayContaining([
							expect.objectContaining({
								sourceEventType: "file.created",
								domainEventName: "report.received",
							}),
						]),
					},
				})
			);
		});
	});

	describe("dispose", () => {
		it("should stop listening after dispose", async () => {
			service.dispose();

			const handler = vi.fn();
			eventBus.on("eventDefinition.created", handler);

			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "test.event",
				payloadMappings: [],
				emissionPolicy: "always",
			});

			expect(handler).not.toHaveBeenCalled();
			expect(service.getDefinitions()).toHaveLength(0);
		});

		it("should stop matching after dispose", async () => {
			await eventBus.emit("eventDefinition.create", {
				sourceEventType: "file.created",
				domainEventName: "test.event",
				payloadMappings: [],
				emissionPolicy: "always",
			});
			expect(service.getDefinitions()).toHaveLength(1);

			service.dispose();

			const handler = vi.fn();
			eventBus.on("eventDefinition.matched", handler);

			await eventBus.emit("ingestion.job.completed", {
				jobId: "job1",
				eventType: "file.created",
				payload: { path: "test.md", source: "user" },
			});

			expect(handler).not.toHaveBeenCalled();
		});
	});
});
