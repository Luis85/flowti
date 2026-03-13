import { describe, it, expect } from "vitest";
import {
	addRequirement, removeRequirement,
	addFeature, removeFeature,
	addRelationship, removeRelationship,
	type ComponentInstance,
	type InstanceRelationship,
} from "../../../../src/domain/make/component/component-editor.js";

function makeInstance(overrides: Partial<ComponentInstance> = {}): ComponentInstance {
	return { name: "Test", id: "test", type: "component", status: "active", ...overrides };
}

describe("requirement editing", () => {
	it("adds a requirement", () => {
		const inst = makeInstance();
		addRequirement(inst, "REQ-001");
		expect(inst.requirements).toEqual(["REQ-001"]);
	});

	it("does not add duplicate requirements", () => {
		const inst = makeInstance({ requirements: ["REQ-001"] });
		addRequirement(inst, "REQ-001");
		expect(inst.requirements).toEqual(["REQ-001"]);
	});

	it("removes a requirement", () => {
		const inst = makeInstance({ requirements: ["REQ-001", "REQ-002"] });
		removeRequirement(inst, "REQ-001");
		expect(inst.requirements).toEqual(["REQ-002"]);
	});

	it("deletes requirements array when empty", () => {
		const inst = makeInstance({ requirements: ["REQ-001"] });
		removeRequirement(inst, "REQ-001");
		expect(inst.requirements).toBeUndefined();
	});

	it("handles remove on empty instance", () => {
		const inst = makeInstance();
		removeRequirement(inst, "REQ-001");
		expect(inst.requirements).toBeUndefined();
	});
});

describe("feature editing", () => {
	it("adds a feature", () => {
		const inst = makeInstance();
		addFeature(inst, "dark-mode");
		expect(inst.features).toEqual(["dark-mode"]);
	});

	it("does not add duplicate features", () => {
		const inst = makeInstance({ features: ["dark-mode"] });
		addFeature(inst, "dark-mode");
		expect(inst.features).toEqual(["dark-mode"]);
	});

	it("removes a feature", () => {
		const inst = makeInstance({ features: ["dark-mode", "i18n"] });
		removeFeature(inst, "dark-mode");
		expect(inst.features).toEqual(["i18n"]);
	});

	it("deletes features array when empty", () => {
		const inst = makeInstance({ features: ["dark-mode"] });
		removeFeature(inst, "dark-mode");
		expect(inst.features).toBeUndefined();
	});
});

describe("relationship editing", () => {
	const rel: InstanceRelationship = { target: "AuthService", type: "uses" };

	it("adds a relationship", () => {
		const inst = makeInstance();
		addRelationship(inst, rel);
		expect(inst.relationships).toHaveLength(1);
		expect(inst.relationships![0].target).toBe("AuthService");
	});

	it("does not add duplicate relationships (same target + type)", () => {
		const inst = makeInstance({ relationships: [rel] });
		addRelationship(inst, rel);
		expect(inst.relationships).toHaveLength(1);
	});

	it("allows same target with different type", () => {
		const inst = makeInstance({ relationships: [rel] });
		addRelationship(inst, { target: "AuthService", type: "calls" });
		expect(inst.relationships).toHaveLength(2);
	});

	it("removes a relationship by target", () => {
		const inst = makeInstance({ relationships: [rel, { target: "DB", type: "depends-on" }] });
		removeRelationship(inst, "AuthService");
		expect(inst.relationships).toHaveLength(1);
		expect(inst.relationships![0].target).toBe("DB");
	});

	it("removes a relationship by target and type", () => {
		const inst = makeInstance({
			relationships: [
				{ target: "AuthService", type: "uses" },
				{ target: "AuthService", type: "calls" },
			],
		});
		removeRelationship(inst, "AuthService", "uses");
		expect(inst.relationships).toHaveLength(1);
		expect(inst.relationships![0].type).toBe("calls");
	});

	it("deletes relationships array when empty", () => {
		const inst = makeInstance({ relationships: [rel] });
		removeRelationship(inst, "AuthService");
		expect(inst.relationships).toBeUndefined();
	});
});
