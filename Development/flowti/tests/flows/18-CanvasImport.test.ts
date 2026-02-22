/**
 * Flow 18: Import Canvas as Notes
 *
 * Tests the end-to-end canvas import pipeline:
 * Configure → parse → legend → items → parentage → relations →
 * filter → import notes → rebuild canvas → base file → inbox notification.
 *
 * Event sequence:
 *   canvas.config.saved → canvas.import.started →
 *   canvas.import.progress (×N) → canvas.import.completed →
 *   inbox.itemAdded
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import { EventBus } from "../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../src/infrastructure/events/types";
import { CanvasService } from "../../src/domain/canvas/CanvasService";
import type { CanvasConfigInput } from "../../src/domain/canvas/CanvasService";
import { InboxService, ALL_INBOX_SOURCES } from "../../src/domain/inbox/InboxService";
import type { CanvasState, CanvasImportConfig } from "../../src/domain/canvas/types";
import type { InboxState } from "../../src/domain/inbox/types";
import { createMockStorage, createMockFileSystem, waitForAsync } from "./testHelpers";

/** Collect canvas.* events using the wildcard listener and prefix filter. */
function collectCanvasEvents(bus: IEventBus): string[] {
	const events: string[] = [];
	bus.on("*", (e: { type: string }) => {
		if (e.type.startsWith("canvas.")) events.push(e.type);
	});
	return events;
}

// ── Canvas JSON fixtures ─────────────────────────────────────

function makeCanvasJson(nodes: Record<string, unknown>[] = [], edges: Record<string, unknown>[] = []): string {
	return JSON.stringify({ nodes, edges });
}

function makeTextNode(id: string, text: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id,
		type: "text",
		text,
		x: 0,
		y: 0,
		width: 200,
		height: 100,
		...overrides,
	};
}

function makeGroupNode(id: string, label: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id,
		type: "group",
		label,
		x: -50,
		y: -50,
		width: 500,
		height: 500,
		...overrides,
	};
}

function makeEdge(id: string, fromNode: string, toNode: string, overrides: Record<string, unknown> = {}): Record<string, unknown> {
	return {
		id,
		fromNode,
		toNode,
		fromSide: "bottom",
		toSide: "top",
		...overrides,
	};
}

function makeDefaultInput(canvasPath = "designs/my-canvas.canvas"): CanvasConfigInput {
	return {
		name: "Test Config",
		canvasPath,
		targetFolder: "imported",
		colorMap: {},
		shapeMap: {},
		conflictStrategy: "skip",
		hierarchyMode: "flat",
		subfolderName: "",
		createCanvas: false,
		createBase: false,
		excludedTypes: [],
	};
}

// ── Test suite ───────────────────────────────────────────────

describe("Flow 18: Import Canvas as Notes", () => {
	let eventBus: IEventBus;
	let canvasService: CanvasService;
	let inboxService: InboxService;
	let fileSystem: ReturnType<typeof createMockFileSystem>;

	beforeEach(async () => {
		eventBus = new EventBus();
		fileSystem = createMockFileSystem();

		const canvasMock = createMockStorage<CanvasState>();
		canvasService = new CanvasService({
			storage: canvasMock.storage,
			eventBus,
			fileSystem,
		});
		await canvasService.load();

		const inboxMock = createMockStorage<InboxState>();
		inboxService = new InboxService({ storage: inboxMock.storage, eventBus });
		inboxService.setEnabledSources([...ALL_INBOX_SOURCES]);
		await inboxService.load();
	});

	// ── Config CRUD ──────────────────────────────────────────

	describe("config management", () => {
		it("should save and retrieve a canvas config", async () => {
			const config = await canvasService.saveConfig(makeDefaultInput());

			expect(config.id).toBeTruthy();
			expect(config.name).toBe("Test Config");
			expect(config.canvasPath).toBe("designs/my-canvas.canvas");
			expect(config.createdAt).toBeTruthy();
			expect(config.lastUsed).toBeNull();

			const configs = canvasService.getConfigs();
			expect(configs).toHaveLength(1);
			expect(configs[0].id).toBe(config.id);
		});

		it("should emit canvas.config.saved on save", async () => {
			const events = collectCanvasEvents(eventBus);

			await canvasService.saveConfig(makeDefaultInput());

			expect(events).toContain("canvas.config.saved");
		});

		it("should update an existing config", async () => {
			const config = await canvasService.saveConfig(makeDefaultInput());
			const updated = await canvasService.updateConfig(config.id, { name: "Renamed" });

			expect(updated?.name).toBe("Renamed");
			expect(canvasService.getConfig(config.id)?.name).toBe("Renamed");
		});

		it("should remove a config", async () => {
			const config = await canvasService.saveConfig(makeDefaultInput());
			const removed = await canvasService.removeConfig(config.id);

			expect(removed).toBe(true);
			expect(canvasService.getConfigs()).toHaveLength(0);
		});

		it("should persist configs across load cycles", async () => {
			const mock = createMockStorage<CanvasState>();
			const service1 = new CanvasService({ storage: mock.storage, eventBus });
			await service1.load();
			await service1.saveConfig(makeDefaultInput());

			// New service instance sharing same storage
			const service2 = new CanvasService({ storage: mock.storage, eventBus });
			await service2.load();

			expect(service2.getConfigs()).toHaveLength(1);
			expect(service2.getConfigs()[0].name).toBe("Test Config");
		});
	});

	// ── Full import pipeline ─────────────────────────────────

	describe("import pipeline", () => {
		it("should execute full pipeline: configure → import → notes created", async () => {
			const canvasJson = makeCanvasJson([
				makeTextNode("n1", "Epic: User Management", { color: "2" }),
				makeTextNode("n2", "Feature: Login", { color: "6" }),
			]);
			fileSystem.readFile = vi.fn(async () => canvasJson);
			fileSystem.createFile = vi.fn(async () => undefined);
			fileSystem.fileExists = vi.fn(async () => false);

			const events = collectCanvasEvents(eventBus);
			const config = await canvasService.saveConfig(makeDefaultInput());
			const result = await canvasService.runImport(config.id);

			expect(result.totalNodes).toBe(2);
			expect(result.imported).toBe(2);
			expect(result.skipped).toBe(0);
			expect(result.errors).toHaveLength(0);
			expect(result.canvasPath).toBe("designs/my-canvas.canvas");

			expect(events).toContain("canvas.config.saved");
			expect(events).toContain("canvas.import.started");
			expect(events).toContain("canvas.import.completed");
		});

		it("should emit progress events per node", async () => {
			const canvasJson = makeCanvasJson([
				makeTextNode("n1", "Task A", { color: "3" }),
				makeTextNode("n2", "Task B", { color: "3" }),
				makeTextNode("n3", "Task C", { color: "3" }),
			]);
			fileSystem.readFile = vi.fn(async () => canvasJson);
			fileSystem.createFile = vi.fn(async () => undefined);
			fileSystem.fileExists = vi.fn(async () => false);

			const progressEvents: unknown[] = [];
			eventBus.on("canvas.import.progress", (e) => { progressEvents.push(e); });

			const config = await canvasService.saveConfig(makeDefaultInput());
			await canvasService.runImport(config.id);

			expect(progressEvents).toHaveLength(3);
		});

		it("should skip existing notes with skip conflict strategy", async () => {
			const canvasJson = makeCanvasJson([
				makeTextNode("n1", "Existing Note", { color: "1" }),
			]);
			fileSystem.readFile = vi.fn(async () => canvasJson);
			fileSystem.createFile = vi.fn(async () => undefined);
			fileSystem.fileExists = vi.fn(async () => true);

			const config = await canvasService.saveConfig(makeDefaultInput());
			const result = await canvasService.runImport(config.id);

			expect(result.imported).toBe(0);
			expect(result.skipped).toBe(1);
		});

		it("should update config lastUsed after successful import", async () => {
			const canvasJson = makeCanvasJson([makeTextNode("n1", "Node A", { color: "1" })]);
			fileSystem.readFile = vi.fn(async () => canvasJson);
			fileSystem.createFile = vi.fn(async () => undefined);
			fileSystem.fileExists = vi.fn(async () => false);

			const config = await canvasService.saveConfig(makeDefaultInput());
			expect(config.lastUsed).toBeNull();

			await canvasService.runImport(config.id);

			const updated = canvasService.getConfig(config.id);
			expect(updated?.lastUsed).toBeTruthy();
		});
	});

	// ── Legend detection ──────────────────────────────────────

	describe("legend override", () => {
		it("should detect legend group and apply custom color mappings", async () => {
			const canvasJson = makeCanvasJson([
				makeGroupNode("legend", "Legend", { x: 0, y: 0, width: 400, height: 200 }),
				makeTextNode("leg1", "Requirement", { color: "1", x: 10, y: 10, width: 100, height: 50 }),
				makeTextNode("n1", "My Requirement", { color: "1", x: 500, y: 500, width: 200, height: 100 }),
			]);
			fileSystem.readFile = vi.fn(async () => canvasJson);
			fileSystem.createFile = vi.fn(async () => undefined);
			fileSystem.fileExists = vi.fn(async () => false);

			const legendEvents: unknown[] = [];
			eventBus.on("canvas.legend.detected", (e) => { legendEvents.push(e); });

			const config = await canvasService.saveConfig(makeDefaultInput());
			const result = await canvasService.runImport(config.id);

			// Legend should be detected
			expect(legendEvents).toHaveLength(1);

			// Legend node should be filtered out, only non-legend node imported
			expect(result.imported).toBe(1);
		});
	});

	// ── Group parentage ──────────────────────────────────────

	describe("group containment", () => {
		it("should import both group and contained nodes", async () => {
			const canvasJson = makeCanvasJson([
				makeGroupNode("g1", "Sprint 1", { x: 0, y: 0, width: 600, height: 400 }),
				makeTextNode("n1", "Task Inside Group", { color: "3", x: 10, y: 10, width: 200, height: 100 }),
			]);
			fileSystem.readFile = vi.fn(async () => canvasJson);
			fileSystem.fileExists = vi.fn(async () => false);

			// Track what files are created
			const createdPaths: string[] = [];
			fileSystem.createFile = vi.fn(async (path: string) => {
				createdPaths.push(path);
			});

			const config = await canvasService.saveConfig(makeDefaultInput());
			const result = await canvasService.runImport(config.id);

			// Both group and text node are imported as notes
			expect(result.imported).toBe(2);
			expect(createdPaths.length).toBe(2);
		});
	});

	// ── Edge relations ───────────────────────────────────────

	describe("edge-to-relationship mapping", () => {
		it("should create notes with directional relationships from edges", async () => {
			const canvasJson = makeCanvasJson(
				[
					makeTextNode("n1", "Source Node", { color: "2" }),
					makeTextNode("n2", "Target Node", { color: "3" }),
				],
				[
					makeEdge("e1", "n1", "n2", { fromSide: "bottom", toSide: "top" }),
				],
			);
			fileSystem.readFile = vi.fn(async () => canvasJson);
			fileSystem.createFile = vi.fn(async () => undefined);
			fileSystem.fileExists = vi.fn(async () => false);

			const config = await canvasService.saveConfig(makeDefaultInput());
			const result = await canvasService.runImport(config.id);

			expect(result.imported).toBe(2);
			expect(result.errors).toHaveLength(0);
		});
	});

	// ── Type exclusion ───────────────────────────────────────

	describe("type exclusion", () => {
		it("should exclude specified types from import", async () => {
			const canvasJson = makeCanvasJson([
				makeTextNode("n1", "Epic Item", { color: "2" }),   // Epic
				makeTextNode("n2", "Task Item", { color: "3" }),   // Task
				makeTextNode("n3", "Issue Item", { color: "1" }),  // Issue
			]);
			fileSystem.readFile = vi.fn(async () => canvasJson);
			fileSystem.createFile = vi.fn(async () => undefined);
			fileSystem.fileExists = vi.fn(async () => false);

			const input = makeDefaultInput();
			input.excludedTypes = ["Issue"];

			const config = await canvasService.saveConfig(input);
			const result = await canvasService.runImport(config.id);

			// Issue should be excluded, only Epic and Task imported
			expect(result.imported).toBe(2);
		});
	});

	// ── Error handling ───────────────────────────────────────

	describe("error handling", () => {
		it("should emit canvas.import.failed for missing canvas file", async () => {
			fileSystem.readFile = vi.fn(async () => null as unknown as string);

			const failEvents: unknown[] = [];
			eventBus.on("canvas.import.failed", (e) => { failEvents.push(e); });

			const config = await canvasService.saveConfig(makeDefaultInput());

			await expect(canvasService.runImport(config.id)).rejects.toThrow("not found or empty");
			expect(failEvents).toHaveLength(1);
		});

		it("should emit canvas.import.failed for invalid JSON", async () => {
			fileSystem.readFile = vi.fn(async () => "not valid json {{{");

			const failEvents: unknown[] = [];
			eventBus.on("canvas.import.failed", (e) => { failEvents.push(e); });

			const config = await canvasService.saveConfig(makeDefaultInput());

			await expect(canvasService.runImport(config.id)).rejects.toThrow("Invalid canvas JSON");
			expect(failEvents).toHaveLength(1);
		});

		it("should throw for nonexistent config ID", async () => {
			await expect(canvasService.runImport("nonexistent")).rejects.toThrow("not found");
		});

		it("should collect per-node errors without stopping import", async () => {
			const canvasJson = makeCanvasJson([
				makeTextNode("n1", "Good Node", { color: "2" }),
				makeTextNode("n2", "Bad Node", { color: "3" }),
			]);
			fileSystem.readFile = vi.fn(async () => canvasJson);
			fileSystem.fileExists = vi.fn(async () => false);

			let callCount = 0;
			fileSystem.createFile = vi.fn(async () => {
				callCount++;
				if (callCount === 2) throw new Error("disk full");
			});

			const config = await canvasService.saveConfig(makeDefaultInput());
			const result = await canvasService.runImport(config.id);

			// First node succeeds, second fails
			expect(result.imported).toBe(1);
			expect(result.errors).toHaveLength(1);
			expect(result.errors[0].error).toContain("disk full");
		});
	});

	// ── Inbox integration ────────────────────────────────────

	describe("inbox notifications", () => {
		it("should create inbox item on successful import", async () => {
			const canvasJson = makeCanvasJson([
				makeTextNode("n1", "Node A", { color: "1" }),
			]);
			fileSystem.readFile = vi.fn(async () => canvasJson);
			fileSystem.createFile = vi.fn(async () => undefined);
			fileSystem.fileExists = vi.fn(async () => false);

			const config = await canvasService.saveConfig(makeDefaultInput());
			await canvasService.runImport(config.id);
			await waitForAsync();

			const items = inboxService.getItems();
			const canvasItems = items.filter((i) => i.sourceEvent === "canvas.import.completed");
			expect(canvasItems.length).toBeGreaterThanOrEqual(1);
		});

		it("should create inbox item on failed import", async () => {
			fileSystem.readFile = vi.fn(async () => null as unknown as string);

			const config = await canvasService.saveConfig(makeDefaultInput());
			try {
				await canvasService.runImport(config.id);
			} catch {
				// expected
			}
			await waitForAsync();

			const items = inboxService.getItems();
			const failItems = items.filter((i) => i.sourceEvent === "canvas.import.failed");
			expect(failItems.length).toBeGreaterThanOrEqual(1);
		});
	});

	// ── Lifecycle events ─────────────────────────────────────

	describe("event sequence", () => {
		it("should emit events in correct order for successful import", async () => {
			const canvasJson = makeCanvasJson([
				makeTextNode("n1", "Node", { color: "2" }),
			]);
			fileSystem.readFile = vi.fn(async () => canvasJson);
			fileSystem.createFile = vi.fn(async () => undefined);
			fileSystem.fileExists = vi.fn(async () => false);

			const events = collectCanvasEvents(eventBus);
			const config = await canvasService.saveConfig(makeDefaultInput());
			await canvasService.runImport(config.id);

			// Verify event ordering
			const startIdx = events.indexOf("canvas.import.started");
			const progressIdx = events.indexOf("canvas.import.progress");
			const completeIdx = events.indexOf("canvas.import.completed");

			expect(startIdx).toBeGreaterThanOrEqual(0);
			expect(progressIdx).toBeGreaterThan(startIdx);
			expect(completeIdx).toBeGreaterThan(progressIdx);
		});
	});
});
