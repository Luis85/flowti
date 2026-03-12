import { describe, it, expect, vi } from "vitest";
import {
	readComponentInstance,
	writeComponentInstance,
	getEditableFields,
	setField,
	addProperty,
	removeProperty,
	addAction,
	removeAction,
} from "../../../../src/domain/make/component/component-editor.js";
import type { ComponentInstance, ComponentEditorDeps } from "../../../../src/domain/make/component/component-editor.js";

function mockDeps(files: Record<string, string> = {}): ComponentEditorDeps {
	return {
		disk: {
			existsSync: vi.fn((p: string) => p in files),
			readFileSync: vi.fn((p: string) => files[p] ?? ""),
			writeFileSync: vi.fn(),
		} as any,
		paths: {
			join: (...parts: string[]) => parts.join("/"),
		} as any,
	};
}

function instance(overrides: Partial<ComponentInstance> = {}): ComponentInstance {
	return {
		name: "Test Component",
		id: "test-component",
		type: "ui-component",
		status: "draft",
		...overrides,
	};
}

describe("readComponentInstance", () => {
	it("reads and parses a component JSON", () => {
		const json = JSON.stringify({ name: "Button", id: "button", type: "ui-component", status: "active" });
		const deps = mockDeps({ "/project/components/button/button.json": json });
		const result = readComponentInstance("/project", "button", deps);
		expect(result).toEqual({ name: "Button", id: "button", type: "ui-component", status: "active" });
	});

	it("returns null when file does not exist", () => {
		const deps = mockDeps();
		expect(readComponentInstance("/project", "missing", deps)).toBeNull();
	});

	it("returns null when JSON is invalid", () => {
		const deps = mockDeps({ "/project/components/bad/bad.json": "not json" });
		expect(readComponentInstance("/project", "bad", deps)).toBeNull();
	});
});

describe("writeComponentInstance", () => {
	it("writes formatted JSON to disk", () => {
		const deps = mockDeps();
		const inst = instance();
		writeComponentInstance("/project", "test-component", inst, deps);
		expect(deps.disk.writeFileSync).toHaveBeenCalledWith(
			"/project/components/test-component/test-component.json",
			expect.stringContaining('"name": "Test Component"'),
			"utf-8",
		);
	});
});

describe("getEditableFields", () => {
	it("returns known editable field names", () => {
		const fields = getEditableFields();
		expect(fields).toContain("name");
		expect(fields).toContain("description");
		expect(fields).toContain("status");
		expect(fields).toContain("owner");
	});
});

describe("setField", () => {
	it("sets a field value", () => {
		const inst = instance();
		setField(inst, "description", "Updated");
		expect(inst.description).toBe("Updated");
	});

	it("deletes a field when value is empty", () => {
		const inst = instance({ description: "old" });
		setField(inst, "description", "");
		expect(inst.description).toBeUndefined();
	});
});

describe("addProperty", () => {
	it("adds a property with default value", () => {
		const inst = instance();
		addProperty(inst, "color", "red");
		expect(inst.properties).toEqual({ color: "red" });
	});

	it("creates properties object if missing", () => {
		const inst = instance();
		delete inst.properties;
		addProperty(inst, "size", 12);
		expect(inst.properties).toEqual({ size: 12 });
	});
});

describe("removeProperty", () => {
	it("removes a property by key", () => {
		const inst = instance({ properties: { a: 1, b: 2 } });
		removeProperty(inst, "a");
		expect(inst.properties).toEqual({ b: 2 });
	});

	it("deletes properties object when last property removed", () => {
		const inst = instance({ properties: { a: 1 } });
		removeProperty(inst, "a");
		expect(inst.properties).toBeUndefined();
	});

	it("does nothing when properties is undefined", () => {
		const inst = instance();
		delete inst.properties;
		removeProperty(inst, "x");
		expect(inst.properties).toBeUndefined();
	});
});

describe("addAction", () => {
	it("adds an action name", () => {
		const inst = instance();
		addAction(inst, "onClick");
		expect(inst.actions).toEqual(["onClick"]);
	});

	it("does not add duplicate action", () => {
		const inst = instance({ actions: ["onClick"] });
		addAction(inst, "onClick");
		expect(inst.actions).toEqual(["onClick"]);
	});

	it("creates actions array if missing", () => {
		const inst = instance();
		delete inst.actions;
		addAction(inst, "onHover");
		expect(inst.actions).toEqual(["onHover"]);
	});
});

describe("removeAction", () => {
	it("removes an action by name", () => {
		const inst = instance({ actions: ["onClick", "onFocus"] });
		removeAction(inst, "onClick");
		expect(inst.actions).toEqual(["onFocus"]);
	});

	it("deletes actions array when last action removed", () => {
		const inst = instance({ actions: ["onClick"] });
		removeAction(inst, "onClick");
		expect(inst.actions).toBeUndefined();
	});

	it("does nothing when actions is undefined", () => {
		const inst = instance();
		delete inst.actions;
		removeAction(inst, "x");
		expect(inst.actions).toBeUndefined();
	});
});
