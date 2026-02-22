import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventBus } from "../../../src/infrastructure/events/EventBus";
import type { IEventBus } from "../../../src/infrastructure/events/types";
import { CanvasService, type CanvasConfigInput } from "../../../src/domain/canvas/CanvasService";
import type { CanvasState } from "../../../src/domain/canvas/types";
import { MAX_CANVAS_CONFIGS } from "../../../src/domain/canvas/types";
import { createMockStorage } from "../../mocks/storage";
import { createMockFileSystem } from "../../mocks/filesystem";

type MockFn = ReturnType<typeof vi.fn>;

function makeConfigInput(overrides: Partial<CanvasConfigInput> = {}): CanvasConfigInput {
	return {
		name: "Test Canvas",
		canvasPath: "design/architecture.canvas",
		targetFolder: "resources/architecture",
		colorMap: {},
		shapeMap: {},
		conflictStrategy: "skip",
		hierarchyMode: "flat",
		...overrides,
	};
}

describe("CanvasService", () => {
	let service: CanvasService;
	let eventBus: IEventBus;
	let getData: () => CanvasState | undefined;

	beforeEach(() => {
		const mock = createMockStorage<CanvasState>();
		getData = mock.getData;
		eventBus = new EventBus();
		service = new CanvasService({ storage: mock.storage, eventBus });
	});

	afterEach(() => {
		service.dispose();
	});

	// ── load ─────────────────────────────────────────────────

	describe("load", () => {
		it("should initialize with empty configs array", async () => {
			await service.load();
			expect(service.getConfigs()).toEqual([]);
		});

		it("should load persisted state from storage", async () => {
			const mock = createMockStorage<CanvasState>({
				configs: [{
					id: "canvas_existing",
					name: "Existing",
					canvasPath: "design/flow.canvas",
					targetFolder: "resources/flow",
					colorMap: {},
					shapeMap: {},
					conflictStrategy: "skip",
					hierarchyMode: "flat",
					createdAt: "2026-02-20T10:00:00Z",
					lastUsed: null,
				}],
			});
			service = new CanvasService({ storage: mock.storage, eventBus });

			await service.load();

			expect(service.getConfigs()).toHaveLength(1);
			expect(service.getConfigs()[0].name).toBe("Existing");
		});

		it("should emit canvas.loaded event with config count", async () => {
			const handler = vi.fn();
			eventBus.on("canvas.loaded", handler);

			await service.load();

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: { configCount: 0 },
				}),
			);
		});
	});

	// ── saveConfig ───────────────────────────────────────────

	describe("saveConfig", () => {
		it("should create a config with generated id and timestamps", async () => {
			await service.load();
			const config = await service.saveConfig(makeConfigInput());

			expect(config.id).toMatch(/^canvas_/);
			expect(config.name).toBe("Test Canvas");
			expect(config.createdAt).toBeTruthy();
			expect(config.lastUsed).toBeNull();
			expect(service.getConfigs()).toHaveLength(1);
		});

		it("should persist to storage", async () => {
			await service.load();
			await service.saveConfig(makeConfigInput());

			const saved = getData();
			expect(saved?.configs).toHaveLength(1);
		});

		it("should emit canvas.config.saved event", async () => {
			await service.load();
			const handler = vi.fn();
			eventBus.on("canvas.config.saved", handler);

			await service.saveConfig(makeConfigInput({ name: "My Canvas" }));

			expect(handler).toHaveBeenCalledOnce();
			expect(handler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({ name: "My Canvas" }),
				}),
			);
		});

		it("should throw when max configs reached", async () => {
			await service.load();
			for (let i = 0; i < MAX_CANVAS_CONFIGS; i++) {
				await service.saveConfig(makeConfigInput({ name: `Config ${i}` }));
			}

			await expect(
				service.saveConfig(makeConfigInput({ name: "One Too Many" })),
			).rejects.toThrow(/Maximum/);
		});
	});

	// ── removeConfig ─────────────────────────────────────────

	describe("removeConfig", () => {
		it("should remove existing config and return true", async () => {
			await service.load();
			const config = await service.saveConfig(makeConfigInput());

			const result = await service.removeConfig(config.id);

			expect(result).toBe(true);
			expect(service.getConfigs()).toHaveLength(0);
		});

		it("should return false for non-existent id", async () => {
			await service.load();
			const result = await service.removeConfig("canvas_nonexistent");
			expect(result).toBe(false);
		});

		it("should persist removal to storage", async () => {
			await service.load();
			const config = await service.saveConfig(makeConfigInput());
			await service.removeConfig(config.id);

			const saved = getData();
			expect(saved?.configs).toHaveLength(0);
		});
	});

	// ── getConfig ────────────────────────────────────────────

	describe("getConfig", () => {
		it("should return config by id", async () => {
			await service.load();
			const config = await service.saveConfig(makeConfigInput());

			expect(service.getConfig(config.id)).toEqual(config);
		});

		it("should return undefined for unknown id", async () => {
			await service.load();
			expect(service.getConfig("canvas_unknown")).toBeUndefined();
		});
	});

	// ── runImport ────────────────────────────────────────────

	describe("runImport", () => {
		it("should throw for unknown config id", async () => {
			await service.load();
			await expect(service.runImport("canvas_unknown")).rejects.toThrow(/not found/);
		});

		it("should throw when fileSystem is not available", async () => {
			const mock = createMockStorage<CanvasState>();
			service = new CanvasService({ storage: mock.storage, eventBus });
			await service.load();
			const config = await service.saveConfig(makeConfigInput());

			await expect(service.runImport(config.id)).rejects.toThrow(/FileSystem/);
		});

		it("should emit canvas.import.failed when canvas file is empty", async () => {
			const fs = createMockFileSystem();
			(fs.readFile as MockFn).mockResolvedValue("");
			const mock = createMockStorage<CanvasState>();
			service = new CanvasService({ storage: mock.storage, eventBus, fileSystem: fs });
			await service.load();
			const config = await service.saveConfig(makeConfigInput());

			const handler = vi.fn();
			eventBus.on("canvas.import.failed", handler);

			await expect(service.runImport(config.id)).rejects.toThrow(/not found or empty/);
			expect(handler).toHaveBeenCalledOnce();
		});

		it("should emit canvas.import.failed when canvas JSON is invalid", async () => {
			const fs = createMockFileSystem();
			(fs.readFile as MockFn).mockResolvedValue("not json");
			const mock = createMockStorage<CanvasState>();
			service = new CanvasService({ storage: mock.storage, eventBus, fileSystem: fs });
			await service.load();
			const config = await service.saveConfig(makeConfigInput());

			const handler = vi.fn();
			eventBus.on("canvas.import.failed", handler);

			await expect(service.runImport(config.id)).rejects.toThrow(/Invalid canvas JSON/);
			expect(handler).toHaveBeenCalledOnce();
		});

		it("should run full import pipeline for valid canvas", async () => {
			const canvasJson = JSON.stringify({
				nodes: [
					{ id: "n1", type: "text", text: "# My Task", x: 0, y: 0, width: 200, height: 100, color: "3" },
				],
				edges: [],
			});

			const fs = createMockFileSystem();
			(fs.readFile as MockFn).mockResolvedValue(canvasJson);
			(fs.fileExists as MockFn).mockResolvedValue(false);
			(fs.createFile as MockFn).mockResolvedValue(undefined);

			const mock = createMockStorage<CanvasState>();
			service = new CanvasService({ storage: mock.storage, eventBus, fileSystem: fs });
			await service.load();
			const config = await service.saveConfig(makeConfigInput());

			const completedHandler = vi.fn();
			eventBus.on("canvas.import.completed", completedHandler);

			const result = await service.runImport(config.id);

			expect(result.imported).toBe(1);
			expect(result.totalNodes).toBe(1);
			expect(completedHandler).toHaveBeenCalledOnce();
		});

		it("should update config lastUsed after successful import", async () => {
			const canvasJson = JSON.stringify({
				nodes: [
					{ id: "n1", type: "text", text: "Node", x: 0, y: 0, width: 200, height: 100 },
				],
				edges: [],
			});

			const fs = createMockFileSystem();
			(fs.readFile as MockFn).mockResolvedValue(canvasJson);
			(fs.fileExists as MockFn).mockResolvedValue(false);
			(fs.createFile as MockFn).mockResolvedValue(undefined);

			const mock = createMockStorage<CanvasState>();
			service = new CanvasService({ storage: mock.storage, eventBus, fileSystem: fs });
			await service.load();
			const config = await service.saveConfig(makeConfigInput());

			expect(service.getConfig(config.id)?.lastUsed).toBeNull();

			await service.runImport(config.id);

			expect(service.getConfig(config.id)?.lastUsed).toBeTruthy();
		});

		it("should emit canvas.legend.detected when legend group exists", async () => {
			const canvasJson = JSON.stringify({
				nodes: [
					{ id: "g1", type: "group", label: "Legend", x: 0, y: 0, width: 400, height: 200 },
					{ id: "n1", type: "text", text: "Bug", color: "1", x: 10, y: 10, width: 100, height: 50 },
					{ id: "n2", type: "text", text: "# Actual Node", x: 500, y: 0, width: 200, height: 100 },
				],
				edges: [],
			});

			const fs = createMockFileSystem();
			(fs.readFile as MockFn).mockResolvedValue(canvasJson);
			(fs.fileExists as MockFn).mockResolvedValue(false);
			(fs.createFile as MockFn).mockResolvedValue(undefined);

			const mock = createMockStorage<CanvasState>();
			service = new CanvasService({ storage: mock.storage, eventBus, fileSystem: fs });
			await service.load();
			const config = await service.saveConfig(makeConfigInput());

			const legendHandler = vi.fn();
			eventBus.on("canvas.legend.detected", legendHandler);

			await service.runImport(config.id);

			expect(legendHandler).toHaveBeenCalledOnce();
			expect(legendHandler).toHaveBeenCalledWith(
				expect.objectContaining({
					payload: expect.objectContaining({
						mappings: { "1": "Bug" },
					}),
				}),
			);
		});

		it("should write .base file after import", async () => {
			const canvasJson = JSON.stringify({
				nodes: [
					{ id: "n1", type: "text", text: "Node", x: 0, y: 0, width: 200, height: 100 },
				],
				edges: [],
			});

			const fs = createMockFileSystem();
			(fs.readFile as MockFn).mockResolvedValue(canvasJson);
			(fs.fileExists as MockFn).mockResolvedValue(false);
			(fs.createFile as MockFn).mockResolvedValue(undefined);

			const mock = createMockStorage<CanvasState>();
			service = new CanvasService({ storage: mock.storage, eventBus, fileSystem: fs });
			await service.load();
			const config = await service.saveConfig(makeConfigInput({
				targetFolder: "resources/arch",
			}));

			await service.runImport(config.id);

			// .base file created (one of the createFile calls)
			const createCalls = (fs.createFile as MockFn).mock.calls;
			const baseCalls = createCalls.filter(
				(call: unknown[]) => typeof call[0] === "string" && (call[0] as string).endsWith(".base"),
			);
			expect(baseCalls.length).toBe(1);
			expect(baseCalls[0][0]).toBe("resources/arch/arch.base");
		});
	});
});
