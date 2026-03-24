// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("excalibur", () => {
	function MockActor(this: Record<string, unknown>, config?: Record<string, unknown>) {
		this.pos = { x: 0, y: 0 };
		this.width = config?.width ?? 0;
		this.height = config?.height ?? 0;
		this.on = vi.fn();
		this.graphics = { use: vi.fn(), opacity: 1 };
	}
	return {
		Actor: MockActor,
		vec: vi.fn((x: number, y: number) => ({ x, y })),
		CollisionType: { PreventCollision: 0 },
		Canvas: vi.fn(function MockCanvas() { return {}; }),
	};
});

vi.mock("../../../src/game/actors/graphic-registry.js", () => ({
	getGraphic: vi.fn(() => vi.fn(() => ({ _mock: "canvas" }))),
}));

vi.mock("../../../src/game/data/scene-configs.js", () => ({
	ROOM_IDS: ["hub", "office", "village", "station"],
}));

import { createAllSceneObjects } from "../../../src/game/systems/scene-object-factory.js";
import type { SceneObjectConfig } from "../../../src/game/data/scene-object-schema.js";

function makeRegistry() {
	return {
		registerObject: vi.fn(),
		registerInteractable: vi.fn(),
	};
}

function makeScene() {
	return { add: vi.fn() };
}

function makeEngine() {
	return {
		canvas: {
			dispatchEvent: vi.fn(),
			classList: { add: vi.fn(), remove: vi.fn() },
			addEventListener: vi.fn(),
			removeEventListener: vi.fn(),
		},
	};
}

const testConfig: SceneObjectConfig = {
	id: "test-food",
	type: "food",
	room: "hub",
	position: { x: 100, y: 200 },
	size: { width: 32, height: 32 },
	interactionOffset: { x: 0, y: 20 },
	needsEffects: { hunger: 30 },
	graphic: "food-bowl",
};

describe("createAllSceneObjects", () => {
	let registry: ReturnType<typeof makeRegistry>;
	let scenes: Record<string, ReturnType<typeof makeScene>>;
	let engine: ReturnType<typeof makeEngine>;

	beforeEach(() => {
		registry = makeRegistry();
		scenes = { hub: makeScene(), office: makeScene(), village: makeScene(), station: makeScene() };
		engine = makeEngine();
	});

	it("creates GenericInteractable for each config entry", () => {
		const map = createAllSceneObjects([testConfig], { registry, scenes, engine } as never);
		expect(map.size).toBe(1);
		expect(map.get("test-food")).toBeDefined();
	});

	it("registers objects in SceneRegistry (metadata + actor)", () => {
		createAllSceneObjects([testConfig], { registry, scenes, engine } as never);
		expect(registry.registerObject).toHaveBeenCalledWith("test-food", "hub", "food", { x: 100, y: 200 });
		expect(registry.registerInteractable).toHaveBeenCalledWith("test-food", expect.anything());
	});

	it("sets actor position from config", () => {
		const map = createAllSceneObjects([testConfig], { registry, scenes, engine } as never);
		const actor = map.get("test-food")!;
		expect(actor.pos).toEqual({ x: 100, y: 200 });
	});

	it("adds actor to correct scene", () => {
		createAllSceneObjects([testConfig], { registry, scenes, engine } as never);
		expect(scenes.hub.add).toHaveBeenCalled();
		expect(scenes.office.add).not.toHaveBeenCalled();
	});

	it("wires pointer events", () => {
		const map = createAllSceneObjects([testConfig], { registry, scenes, engine } as never);
		const actor = map.get("test-food")!;
		expect(actor.on).toHaveBeenCalledWith("pointerdown", expect.any(Function));
		expect(actor.on).toHaveBeenCalledWith("pointerenter", expect.any(Function));
		expect(actor.on).toHaveBeenCalledWith("pointerleave", expect.any(Function));
	});

	it("handles multiple configs across rooms", () => {
		const configs: SceneObjectConfig[] = [
			testConfig,
			{ ...testConfig, id: "drink-office", type: "drink", room: "office", graphic: "water-bowl" },
		];
		const map = createAllSceneObjects(configs, { registry, scenes, engine } as never);
		expect(map.size).toBe(2);
		expect(scenes.hub.add).toHaveBeenCalled();
		expect(scenes.office.add).toHaveBeenCalled();
	});

	it("skips entries with missing id", () => {
		const bad = { ...testConfig, id: "" };
		const map = createAllSceneObjects([bad], { registry, scenes, engine } as never);
		expect(map.size).toBe(0);
	});

	it("returns readonly map keyed by objectId", () => {
		const map = createAllSceneObjects([testConfig], { registry, scenes, engine } as never);
		expect(map.get("test-food")?.objectId).toBe("test-food");
	});
});
