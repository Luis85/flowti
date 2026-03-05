import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { JourneyBuilderService } from "../../../src/domain/journeyBuilder/JourneyBuilderService";
import type { JourneyExportPayload } from "../../../src/domain/journeyBuilder/events";
import { buildJourneyCanvas, type CanvasSyncInput } from "../../../src/domain/journeyBuilder/canvasSync";
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
		path: "journeys/My Journey.journey",
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
		service = new JourneyBuilderService({
			fileSystem,
			eventBus,
			getSettings: () => ({ journeyFolder: "03 - Resources/Journeys" }),
		});
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

		it("includes top-level startEvent and endEvent for roundtrip", () => {
			const json = service.buildDefinitionJSON(samplePayload());
			const parsed = JSON.parse(json);
			expect(parsed.startEvent).toBe("app.opened");
			expect(parsed.endEvent).toBe("app.closed");
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
			expect(path).toBe("journeys/My Journey.journey");
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

	// ── Test executor generation ────────────────────────────────────

	describe("buildTestExecutor()", () => {
		it("includes correct imports", () => {
			const content = service.buildTestExecutor("My Journey", "my-journey.journey");
			expect(content).toContain('import * as fs from "node:fs"');
			expect(content).toContain('import * as path from "node:path"');
			expect(content).toContain('import { executeJourney } from "./helpers/journeyExecutor"');
			expect(content).toContain('import type { JourneyDefinition } from "./helpers/journeyTypes"');
		});

		it("includes journey name in doc comment", () => {
			const content = service.buildTestExecutor("Getting Started", "getting-started.journey");
			expect(content).toContain("E2E Journey: Getting Started");
		});

		it("references correct JSON filename in configPath", () => {
			const content = service.buildTestExecutor("My Journey", "my-journey.journey");
			expect(content).toContain('"my-journey.journey"');
		});

		it("ends with executeJourney call", () => {
			const content = service.buildTestExecutor("My Journey", "my-journey.journey");
			expect(content).toContain("executeJourney(definition);");
		});

		it("references JSON in journeys subfolder", () => {
			const content = service.buildTestExecutor("My Journey", "my-journey.journey");
			expect(content).toContain('path.join(__dirname, "journeys"');
		});

		it("handles names with special characters", () => {
			const content = service.buildTestExecutor("Journey #1 — Test!", "journey-1-test.journey");
			expect(content).toContain("E2E Journey: Journey #1 — Test!");
			expect(content).toContain('"journey-1-test.journey"');
		});
	});

	// ── 3-file export ───────────────────────────────────────────────

	describe("handleExport — 3-file mode", () => {
		it("writes test executor when testFilePath is provided", async () => {
			service.start();
			const payload = samplePayload({
				testFilePath: "tests/e2e/90-journey-my-journey.test.ts",
			});
			eventBus._trigger("journey-builder.exported", payload);

			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalledTimes(2);
			});

			const calls = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls;
			const testCall = calls.find((c: string[]) => c[0].includes(".test.ts"));
			expect(testCall).toBeDefined();
			expect(testCall![0]).toBe("tests/e2e/90-journey-my-journey.test.ts");
			expect(testCall![1]).toContain("executeJourney");
		});

		it("writes canvas when canvasPath is provided", async () => {
			(fileSystem.fileExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
			service.start();
			const payload = samplePayload({
				canvasPath: "journeys/My Journey.canvas",
			});
			eventBus._trigger("journey-builder.exported", payload);

			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalledTimes(2);
			});

			const calls = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls;
			const canvasCall = calls.find((c: string[]) => c[0].includes(".canvas"));
			expect(canvasCall).toBeDefined();
			expect(canvasCall![0]).toBe("journeys/My Journey.canvas");

			const parsed = JSON.parse(canvasCall![1]);
			expect(parsed.nodes).toBeDefined();
			expect(parsed.edges).toBeDefined();
		});

		it("updates canvas when file already exists", async () => {
			(fileSystem.fileExists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
			service.start();
			const payload = samplePayload({
				canvasPath: "journeys/My Journey.canvas",
			});
			eventBus._trigger("journey-builder.exported", payload);

			await vi.waitFor(() => {
				expect(fileSystem.updateFile).toHaveBeenCalledOnce();
			});

			const [path] = (fileSystem.updateFile as ReturnType<typeof vi.fn>).mock.calls[0];
			expect(path).toBe("journeys/My Journey.canvas");
		});

		it("writes all three files when all paths provided", async () => {
			(fileSystem.fileExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
			service.start();
			const payload = samplePayload({
				testFilePath: "tests/e2e/90-journey-my-journey.test.ts",
				canvasPath: "journeys/My Journey.canvas",
			});
			eventBus._trigger("journey-builder.exported", payload);

			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalledTimes(3);
			});

			const paths = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls.map((c: string[]) => c[0]);
			expect(paths).toContain("journeys/My Journey.journey");
			expect(paths).toContain("tests/e2e/90-journey-my-journey.test.ts");
			expect(paths).toContain("journeys/My Journey.canvas");
		});

		it("only writes JSON when testFilePath and canvasPath are absent", async () => {
			service.start();
			eventBus._trigger("journey-builder.exported", samplePayload());

			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalledOnce();
			});

			const path = (fileSystem.createFile as ReturnType<typeof vi.fn>).mock.calls[0][0];
			expect(path).toBe("journeys/My Journey.journey");
		});
	});

	// ── Canvas sync ─────────────────────────────────────────────────

	describe("handleImport (via event trigger)", () => {
		it("subscribes to journey-builder.import-requested on start", () => {
			service.start();
			expect(eventBus.on).toHaveBeenCalledWith(
				"journey-builder.import-requested",
				expect.any(Function),
			);
		});

		it("unsubscribes on stop", () => {
			service.start();
			expect(eventBus._listeners.get("journey-builder.import-requested")).toHaveLength(1);
			service.stop();
			expect(eventBus._listeners.get("journey-builder.import-requested")).toHaveLength(0);
		});

		it("reads file and emits journey-builder.imported", async () => {
			const json = JSON.stringify({ journey: "Test", steps: [] });
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(json);
			service.start();
			eventBus._trigger("journey-builder.import-requested", { path: "journeys/Test.journey" });

			await vi.waitFor(() => {
				expect(fileSystem.readFile).toHaveBeenCalledWith("journeys/Test.journey");
				const imported = eventBus._emitted.find((e) => e.type === "journey-builder.imported");
				expect(imported).toBeDefined();
				expect(imported!.payload).toEqual({ json });
			});
		});

		it("emits notice.error and import-failed when readFile fails", async () => {
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("not found"));
			service.start();
			eventBus._trigger("journey-builder.import-requested", { path: "bad/path.json" });

			await vi.waitFor(() => {
				const imported = eventBus._emitted.find((e) => e.type === "journey-builder.imported");
				expect(imported).toBeUndefined();

				const notice = eventBus._emitted.find((e) => e.type === "notice.error");
				expect(notice).toBeDefined();
				expect((notice!.payload as { message: string }).message).toContain("path.json");

				const failed = eventBus._emitted.find((e) => e.type === "journey-builder.import-failed");
				expect(failed).toBeDefined();
				expect((failed!.payload as { path: string }).path).toBe("bad/path.json");
			});
		});

		it("emits user-friendly message on timeout", async () => {
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(
				new Error("Request timed out after 5000ms"),
			);
			service.start();
			eventBus._trigger("journey-builder.import-requested", { path: "journeys/Test.journey" });

			await vi.waitFor(() => {
				const notice = eventBus._emitted.find((e) => e.type === "notice.error");
				expect(notice).toBeDefined();
				const msg = (notice!.payload as { message: string }).message;
				expect(msg).toContain("timed out");
				expect(msg).toContain("Test.journey");
			});
		});

		it("validates JSON and rejects invalid journey", async () => {
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue("{ bad json");
			service.start();
			eventBus._trigger("journey-builder.import-requested", { path: "journeys/Bad.journey" });

			await vi.waitFor(() => {
				const imported = eventBus._emitted.find((e) => e.type === "journey-builder.imported");
				expect(imported).toBeUndefined();

				const notice = eventBus._emitted.find((e) => e.type === "notice.error");
				expect(notice).toBeDefined();
				expect((notice!.payload as { message: string }).message).toContain("Bad.journey");

				const failed = eventBus._emitted.find((e) => e.type === "journey-builder.import-failed");
				expect(failed).toBeDefined();
			});
		});

		it("validates structure and rejects missing journey name", async () => {
			const json = JSON.stringify({ steps: [] });
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(json);
			service.start();
			eventBus._trigger("journey-builder.import-requested", { path: "journeys/Missing.journey" });

			await vi.waitFor(() => {
				const imported = eventBus._emitted.find((e) => e.type === "journey-builder.imported");
				expect(imported).toBeUndefined();

				const failed = eventBus._emitted.find((e) => e.type === "journey-builder.import-failed");
				expect(failed).toBeDefined();
				const errors = (failed!.payload as { errors: string[] }).errors;
				expect(errors.some((e: string) => e.includes('"journey"'))).toBe(true);
			});
		});

		it("does not read when service is stopped", async () => {
			service.start();
			service.stop();
			eventBus._trigger("journey-builder.import-requested", { path: "journeys/Test.journey" });

			await new Promise((r) => setTimeout(r, 50));
			expect(fileSystem.readFile).not.toHaveBeenCalled();
		});
	});

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

	// ── Reverse sync (file.modified → canvas.changed) ───────────────

	describe("handleFileModified (reverse sync)", () => {
		function sampleSyncPayload(): { canvasPath: string; definition: CanvasSyncInput } {
			return {
				canvasPath: "journeys/My Journey.canvas",
				definition: {
					journey: "My Journey",
					description: "A test journey",
					startEvent: "app.opened",
					endEvent: "app.closed",
					steps: [
						{ id: "step-1", title: "Open the hub", description: "Opens hub", actions: [{ tool: "command" }] },
					],
				},
			};
		}

		function validCanvasJSON(): string {
			const canvas = buildJourneyCanvas({
				journey: "My Journey",
				description: "A test journey",
				startEvent: "app.opened",
				endEvent: "app.closed",
				steps: [{ id: "s1", title: "Open the hub", description: "Opens hub", actions: [{ tool: "command" }] }],
			});
			return JSON.stringify(canvas);
		}

		it("subscribes to file.modified on start", () => {
			service.start();
			expect(eventBus.on).toHaveBeenCalledWith("file.modified", expect.any(Function));
		});

		it("emits canvas.changed when tracked canvas file is modified", async () => {
			(fileSystem.fileExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(validCanvasJSON());
			service.start();

			// Trigger a canvas sync to set activeCanvasPath
			const syncTime = Date.now();
			eventBus._trigger("journey-builder.canvas.sync-requested", sampleSyncPayload());
			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalled();
			});

			// Mock Date.now to be past the self-write window
			const spy = vi.spyOn(Date, "now").mockReturnValue(syncTime + 3000);

			// Trigger file.modified for the tracked canvas
			eventBus._trigger("file.modified", { path: "journeys/My Journey.canvas" });

			await vi.waitFor(() => {
				const changed = eventBus._emitted.find((e) => e.type === "journey-builder.canvas.changed");
				expect(changed).toBeDefined();
				expect((changed!.payload as { canvasPath: string }).canvasPath).toBe("journeys/My Journey.canvas");
				expect((changed!.payload as { startEvent: string }).startEvent).toBe("app.opened");
			});

			spy.mockRestore();
		});

		it("ignores file.modified for non-tracked paths", async () => {
			(fileSystem.fileExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
			service.start();

			// Trigger a canvas sync to set activeCanvasPath
			eventBus._trigger("journey-builder.canvas.sync-requested", sampleSyncPayload());
			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalled();
			});

			// Trigger file.modified for a different path
			eventBus._trigger("file.modified", { path: "other/file.canvas" });

			await new Promise((r) => setTimeout(r, 50));
			expect(fileSystem.readFile).not.toHaveBeenCalled();
		});

		it("ignores file.modified within self-write window", async () => {
			(fileSystem.fileExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
			service.start();

			// Trigger a canvas sync to set activeCanvasPath
			eventBus._trigger("journey-builder.canvas.sync-requested", sampleSyncPayload());
			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalled();
			});

			// Trigger file.modified immediately (within self-write window)
			eventBus._trigger("file.modified", { path: "journeys/My Journey.canvas" });

			await new Promise((r) => setTimeout(r, 50));
			expect(fileSystem.readFile).not.toHaveBeenCalled();
		});

		it("ignores file.modified when canvas is not a journey canvas", async () => {
			(fileSystem.fileExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
			// Return non-journey canvas (no START/END nodes)
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockResolvedValue(
				JSON.stringify({ nodes: [{ id: "n1", type: "text", text: "Hello", x: 0, y: 0, width: 100, height: 50 }], edges: [] }),
			);
			service.start();

			const syncTime = Date.now();
			eventBus._trigger("journey-builder.canvas.sync-requested", sampleSyncPayload());
			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalled();
			});

			const spy = vi.spyOn(Date, "now").mockReturnValue(syncTime + 3000);

			eventBus._trigger("file.modified", { path: "journeys/My Journey.canvas" });

			await vi.waitFor(() => {
				expect(fileSystem.readFile).toHaveBeenCalled();
			});
			const changed = eventBus._emitted.find((e) => e.type === "journey-builder.canvas.changed");
			expect(changed).toBeUndefined();

			spy.mockRestore();
		});

		it("handles read/parse failure gracefully", async () => {
			(fileSystem.fileExists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
			(fileSystem.readFile as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("read error"));
			service.start();

			const syncTime = Date.now();
			eventBus._trigger("journey-builder.canvas.sync-requested", sampleSyncPayload());
			await vi.waitFor(() => {
				expect(fileSystem.createFile).toHaveBeenCalled();
			});

			const spy = vi.spyOn(Date, "now").mockReturnValue(syncTime + 3000);

			// Should not throw
			eventBus._trigger("file.modified", { path: "journeys/My Journey.canvas" });

			await new Promise((r) => setTimeout(r, 50));
			const changed = eventBus._emitted.find((e) => e.type === "journey-builder.canvas.changed");
			expect(changed).toBeUndefined();

			spy.mockRestore();
		});
	});

});
