// @vitest-environment happy-dom
import { describe, it, expect } from "vitest";
import { validateSceneObjects, type SceneObjectConfig } from "../../../src/game/data/scene-object-schema.js";

const validObject: SceneObjectConfig = {
	id: "test-obj",
	type: "food",
	room: "hub",
	position: { x: 100, y: 200 },
	size: { width: 32, height: 32 },
	graphic: "food-bowl",
	needsEffects: { hunger: 30 },
	interactionOffset: { x: 0, y: 20 },
};

describe("validateSceneObjects", () => {
	it("valid object config passes", () => {
		const result = validateSceneObjects([validObject]);
		expect(result.valid).toBe(true);
		expect(result.errors).toEqual([]);
	});

	it("missing id fails", () => {
		const result = validateSceneObjects([{ ...validObject, id: "" }]);
		expect(result.valid).toBe(false);
	});

	it("missing room fails", () => {
		const result = validateSceneObjects([{ ...validObject, room: "" }]);
		expect(result.valid).toBe(false);
	});

	it("invalid room fails", () => {
		const result = validateSceneObjects([{ ...validObject, room: "dungeon" as unknown as "hub" }]);
		expect(result.valid).toBe(false);
	});

	it("negative size.width fails", () => {
		const result = validateSceneObjects([{ ...validObject, size: { width: -1, height: 32 } }]);
		expect(result.valid).toBe(false);
	});

	it("duplicate id fails", () => {
		const result = validateSceneObjects([validObject, { ...validObject }]);
		expect(result.valid).toBe(false);
	});

	it("object with neither graphic nor sprite fails", () => {
		const { graphic: _graphic, ...noGraphic } = validObject;
		const result = validateSceneObjects([noGraphic as unknown as SceneObjectConfig]);
		expect(result.valid).toBe(false);
	});

	it("object with both graphic and sprite passes", () => {
		const result = validateSceneObjects([{ ...validObject, sprite: "sprite.png" }]);
		expect(result.valid).toBe(true);
	});

	it("needsEffects defaults handled (omitted is ok)", () => {
		const { needsEffects: _needsEffects, ...noEffects } = validObject;
		const result = validateSceneObjects([noEffects as unknown as SceneObjectConfig]);
		expect(result.valid).toBe(true);
	});

	it("interactionOffset defaults handled (omitted is ok)", () => {
		const { interactionOffset: _interactionOffset, ...noOffset } = validObject;
		const result = validateSceneObjects([noOffset as unknown as SceneObjectConfig]);
		expect(result.valid).toBe(true);
	});
});
