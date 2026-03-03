import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JourneyBuilderService } from "../../../src/domain/journeyBuilder/JourneyBuilderService";
import type { JourneyExportPayload } from "../../../src/domain/journeyBuilder/events";
import type { CanvasSyncInput } from "../../../src/domain/journeyBuilder/canvasSync";
import type { IFileSystemClient } from "../../../src/infrastructure/filesystem/types";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { createMockFileSystemStub } from "../../mocks/filesystem";

// ── Helpers ─────────────────────────────────────────────────────────

type Listener = (payload: unknown) => void;

function createMockEventBus(): IEventBus & {
	_emitted: Array<{ type: string; payload: unknown }>;
	_listeners: Map<string, Listener[]>;
	_trigger: (type: string, payload: unknown) => void;
} {
	const emitted: Array<{ type: string; payload: unknown }> = [];
	const listeners = new Map<string, Listener[]>();
	return {
		emit: vi.fn(async (type: string, payload: unknown) => {
			emitted.push({ type, payload });
		}),
		on: vi.fn((type: string, listener: Listener) => {
			const list = listeners.get(type) ?? [];
			list.push(listener);
			listeners.set(type, list);
			return () => {
				const idx = list.indexOf(listener);
				if (idx >= 0) list.splice(idx, 1);
			};
		}),
		_emitted: emitted,
		_listeners: listeners,
		_trigger: (type: string, payload: unknown) => {
			const event = { type, payload, timestamp: new Date().toISOString() };
			for (const fn of listeners.get(type) ?? []) fn(event);
		},
	} as unknown as ReturnType<typeof createMockEventBus>;
}

function samplePayload(overrides?: Partial<JourneyExportPayload>): JourneyExportPayload {
	return {
		path: "journeys/My Journey.journey.json",
		definition: {
			journey: "My Journey",
			description: "A test journey",
			startEvent: "app.opened",
			endEvent: "app.closed",
			steps: [
				{ id: "step-1", title: "Open the hub", description: "", swimlane: "", guideSection: 1 },
				{ id: "step-2", title: "Click the button", description: "", swimlane: "", guideSection: 2 },
			],
		},
		...overrides,
	};
}

// ── Tests ───────────────────────────────────────────────────────────

describe("JourneyBuilderService", () => {
	let service: JourneyBuilderService;
	let fileSystem: IFileSystemClient;
	let eventBus: ReturnType<typeof createMockEventBus>;

	beforeEach(() => {
		fileSystem = createMockFileSystemStub();
		eventBus = createMockEventBus();
		service = new JourneyBuilderService({ fileSystem, eventBus });
	});

	afterEach(() => {
		service.stop();
	});

	describe("start()", () => {
		it("subscribes to journey-builder.exported event", () => {
			service.start();
			expect(eventBus.on).toHaveBeenCalledWith(
				"journey-builder.exported",
				expect.any(Function),
			);
		});

		it("registers a listener that can be unsubscribed", () => {
			service.start();
			expect(eventBus._listeners.get("journey-builder.exported")).toHaveLength(1);

			service.stop();
			expect(eventBus._listeners.get("journey-builder.exported")).toHaveLength(0);
		});
	});

	describe("stop()", () => {
		it("is safe to call without start", () => {
			expect(() => service.stop()).not.toThrow();
		});

		it("is safe to call twice", () => {
			service.start();
			service.stop();
			expect(() => service.stop()).not.toThrow();
		});
	});

	describe("buildDefinitionJSON()", () => {
		it("produces valid JSON", () => {
			const json = service.buildDefinitionJSON(samplePayload());
			const parsed = JSON.parse(json);
			expect(parsed).toBeDefined();
		});

		it("includes the journey name", () => {
			const json = service.buildDefinitionJSON(samplePayload());
			const parsed = JSON.parse(json);
			expect(parsed.journey).toBe("My Journey");
		});

		it("includes the description", () => {
			const json = service.buildDefinitionJSON(samplePayload());
			const parsed = JSON.parse(json);
			expect(parsed.description).toBe("A test journey");
		});

		it("includes steps with id, title, and guideSection", () => {
			const json = service.buildDefinitionJSON(samplePayload());
			const parsed = JSON.parse(json);
			expect(parsed.steps).toHaveLength(2);
			expect(parsed.steps[0]).toMatchObject({
				id: "step-1",
				title: "Open the hub",
				guideSection: 1,
			});
			expect(parsed.steps[1]).toMatchObject({
				id: "step-2",
				title: "Click the button",
				guideSection: 2,
			});
		});

		it("includes steps with events array from startEvent", () => {
			const json = service.buildDefinitionJSON(samplePayload());
			const parsed = JSON.parse(json);
			expect(parsed.steps[0].events).toEqual(["app.opened"]);
		});

		it("includes empty setup and teardown arrays", () => {
			const json = service.buildDefinitionJSON(samplePayload());
			const parsed = JSON.parse(json);
			expect(parsed.setup).toEqual([]);
			expect(parsed.teardown).toEqual([]);
		});

		it("includes empty tools array", () => {
			const json = service.buildDefinitionJSON(samplePayload());
			const parsed = JSON.parse(json);
			expect(parsed.tools).toEqual([]);
		});

		it("uses tab indentation", () => {
			const json = service.buildDefinitionJSON(samplePayload());
			expect(json).toContain("\t");
		});

		it("includes description and swimlane per step", () => {
			const payload = samplePayload();
			payload.definition.steps[0].description = "Opens the hub via command";
			payload.definition.steps[0].swimlane = "frontstage";
			const json = service.buildDefinitionJSON(payload);
			const parsed = JSON.parse(json);
			expect(parsed.steps[0].description).toBe("Opens the hub via command");
			expect(parsed.steps[0].swimlane).toBe("frontstage");
		});

		it("preserves empty description and swimlane", () => {
			const json = service.buildDefinitionJSON(samplePayload());
			const parsed = JSON.parse(json);
			expect(parsed.steps[0].description).toBe("");
			expect(parsed.steps[0].swimlane).toBe("");
		});
	});

	describe("handleExport (via event trigger)", () => {
		it("writes a JSON file via fileSystem.createFile", async () => {
			service.start();
			const payload = samplePayload();
			eventBus._trigger("journey-builder.exported", payload);

			// Allow the async handler to settle
			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalledOnce();
			});

			const [path, content, opts] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toBe("journeys/My Journey.journey.json");
			expect(opts).toEqual({ createFolders: true });

			const parsed = JSON.parse(content);
			expect(parsed.journey).toBe("My Journey");
			expect(parsed.steps).toHaveLength(2);
		});

		it("does not throw when fileSystem.createFile fails", async () => {
			(fileSystem.createFile as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
				new Error("disk full"),
			);

			service.start();
			eventBus._trigger("journey-builder.exported", samplePayload());

			// Should not throw — error is caught internally
			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalledOnce();
			});
		});

		it("does not write when service is stopped", async () => {
			service.start();
			service.stop();

			eventBus._trigger("journey-builder.exported", samplePayload());

			// Give time for any potential async work
			await new Promise((r) => setTimeout(r, 50));
			expect(fileSystem.createFile).not.toHaveBeenCalled();
		});
	});

	// ── Canvas sync ─────────────────────────────────────────────────

	describe("handleCanvasSync (via event trigger)", () => {
		function sampleSyncPayload(): { canvasPath: string; definition: CanvasSyncInput } {
			return {
				canvasPath: "journeys/My Journey.canvas",
				definition: {
					journey: "My Journey",
					description: "A test journey",
					startEvent: "app.opened",
					endEvent: "app.closed",
					steps: [
						{ id: "step-1", title: "Open the hub", description: "", actions: [] },
					],
				},
			};
		}

		it("subscribes to journey-builder.canvas.sync-requested on start", () => {
			service.start();
			expect(eventBus.on).toHaveBeenCalledWith(
				"journey-builder.canvas.sync-requested",
				expect.any(Function),
			);
		});

		it("unsubscribes on stop", () => {
			service.start();
			expect(eventBus._listeners.get("journey-builder.canvas.sync-requested")).toHaveLength(1);
			service.stop();
			expect(eventBus._listeners.get("journey-builder.canvas.sync-requested")).toHaveLength(0);
		});

		it("creates canvas file when it does not exist", async () => {
			(fileSystem.fileExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
			service.start();
			eventBus._trigger("journey-builder.canvas.sync-requested", sampleSyncPayload());

			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalledOnce();
			});

			const [path, content, opts] = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toBe("journeys/My Journey.canvas");
			expect(opts).toEqual({ createFolders: true });

			const parsed = JSON.parse(content);
			expect(parsed.nodes).toBeDefined();
			expect(parsed.edges).toBeDefined();
		});

		it("updates canvas file when it already exists", async () => {
			(fileSystem.fileExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
			service.start();
			eventBus._trigger("journey-builder.canvas.sync-requested", sampleSyncPayload());

			await vi.waitFor(() => {
				expect(fileSystem.updateFile).toHaveBeenCalledOnce();
			});

			const [path, content] = (fileSystem.updateFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toBe("journeys/My Journey.canvas");

			const parsed = JSON.parse(content);
			expect(parsed.nodes.length).toBeGreaterThan(0);
		});

		it("emits journey-builder.canvas.synced after successful write", async () => {
			(fileSystem.fileExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
			service.start();
			eventBus._trigger("journey-builder.canvas.sync-requested", sampleSyncPayload());

			await vi.waitFor(() => {
				const synced = eventBus._emitted.find((e) => e.type === "journey-builder.canvas.synced");
				expect(synced).toBeDefined();
				expect(synced!.payload).toEqual({ canvasPath: "journeys/My Journey.canvas" });
			});
		});

		it("canvas JSON contains START node and step group", async () => {
			(fileSystem.fileExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
			service.start();
			eventBus._trigger("journey-builder.canvas.sync-requested", sampleSyncPayload());

			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalledOnce();
			});

			const content = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0][1];
			const parsed = JSON.parse(content);
			const hasStart = parsed.nodes.some((n: { text?: string }) => n.text?.includes("Start"));
			const hasGroup = parsed.nodes.some((n: { type: string }) => n.type === "group");
			expect(hasStart).toBe(true);
			expect(hasGroup).toBe(true);
		});

		it("does not throw when fileSystem fails", async () => {
			(fileSystem.fileExists as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("disk error"));
			service.start();
			eventBus._trigger("journey-builder.canvas.sync-requested", sampleSyncPayload());

			// Should not throw — error is caught internally
			await new Promise((r) => setTimeout(r, 50));
			const synced = eventBus._emitted.find((e) => e.type === "journey-builder.canvas.synced");
			expect(synced).toBeUndefined(); // no synced event on error
		});

		it("does not write when service is stopped", async () => {
			service.start();
			service.stop();
			eventBus._trigger("journey-builder.canvas.sync-requested", sampleSyncPayload());

			await new Promise((r) => setTimeout(r, 50));
			expect(fileSystem.fileExists).not.toHaveBeenCalled();
		});
	});
});
