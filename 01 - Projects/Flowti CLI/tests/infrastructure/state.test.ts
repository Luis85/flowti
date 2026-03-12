import { describe, it, expect, vi } from "vitest";
import { createMockFs } from "../mocks/mock-fs.js";

vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock/vault",
	CLI_PROJECT: "/mock/vault/01 - Projects/Flowti CLI",
}));

import {
	loadState,
	saveState,
	getSelectedProject,
	setSelectedProject,
	clearSelectedProject,
	getSelectedProduct,
	setSelectedProduct,
	clearSelectedProduct,
	getSelectedFeature,
	setSelectedFeature,
	clearSelectedFeature,
	getSelectedItemType,
	clearAllSelections,
} from "../../src/infrastructure/state.js";

// State path is: VAULT_ROOT + "/.flowti/var/state.json"
const STATE_DIR = "/mock/vault/.flowti/var";
const STATE_PATH = "/mock/vault/.flowti/var/state.json";
const LEGACY_PATH = "/mock/vault/01 - Projects/Flowti CLI/configs/.flowti-state.json";

describe("loadState", () => {
	it("returns parsed state from file", () => {
		const fs = createMockFs({ [STATE_PATH]: JSON.stringify({ selectedProject: "my-app" }) });
		expect(loadState(fs)).toEqual({ selectedProject: "my-app" });
	});

	it("returns empty object when file does not exist", () => {
		const fs = createMockFs();
		expect(loadState(fs)).toEqual({});
	});

	it("returns empty object for corrupt JSON", () => {
		const fs = createMockFs({ [STATE_PATH]: "not json {{{" });
		expect(loadState(fs)).toEqual({});
	});
});

describe("saveState", () => {
	it("merges and writes state to file", () => {
		const fs = createMockFs({ [STATE_PATH]: JSON.stringify({ selectedProject: "old" }) });
		saveState({ selectedProject: "updated" }, fs);

		const written = JSON.parse(fs.files.get(STATE_PATH)!);
		expect(written).toEqual({ selectedProject: "updated" });
	});

	it("creates state file when it does not exist", () => {
		const fs = createMockFs();
		saveState({ selectedProject: "new" }, fs);

		const written = JSON.parse(fs.files.get(STATE_PATH)!);
		expect(written.selectedProject).toBe("new");
	});

	it("overwrites existing keys", () => {
		const fs = createMockFs({ [STATE_PATH]: JSON.stringify({ selectedProject: "old" }) });
		saveState({ selectedProject: "new" }, fs);

		const written = JSON.parse(fs.files.get(STATE_PATH)!);
		expect(written.selectedProject).toBe("new");
	});

	it("can clear values with undefined", () => {
		const fs = createMockFs({ [STATE_PATH]: JSON.stringify({ selectedProject: "old" }) });
		saveState({ selectedProject: undefined }, fs);

		const written = JSON.parse(fs.files.get(STATE_PATH)!);
		expect(written.selectedProject).toBeUndefined();
	});

	it("creates state directory when it does not exist", () => {
		const fs = createMockFs();
		saveState({ selectedProject: "new" }, fs);
		expect(fs.dirs.has(STATE_DIR)).toBe(true);
	});
});

describe("migrateStateIfNeeded", () => {
	it("migrates state from legacy location when new path does not exist", () => {
		const legacyData = JSON.stringify({ selectedProject: "migrated" });
		const fs = createMockFs({ [LEGACY_PATH]: legacyData });
		const state = loadState(fs);
		expect(state).toEqual({ selectedProject: "migrated" });
		// Should have written to new location
		expect(fs.files.has(STATE_PATH)).toBe(true);
	});

	it("skips migration when new state file already exists", () => {
		const fs = createMockFs({
			[STATE_PATH]: JSON.stringify({ selectedProject: "current" }),
			[LEGACY_PATH]: JSON.stringify({ selectedProject: "legacy" }),
		});
		const state = loadState(fs);
		expect(state.selectedProject).toBe("current");
	});

	it("does nothing when neither file exists", () => {
		const fs = createMockFs();
		const state = loadState(fs);
		expect(state).toEqual({});
	});
});

describe("getSelectedProject / setSelectedProject / clearSelectedProject", () => {
	it("getSelectedProject returns null when no project selected", () => {
		expect(getSelectedProject()).toBeNull();
	});

	it("setSelectedProject and getSelectedProject round-trip", () => {
		setSelectedProject("my-project");
		expect(getSelectedProject()).toBe("my-project");
	});

	it("clearSelectedProject removes selection", () => {
		setSelectedProject("temp");
		clearSelectedProject();
		expect(getSelectedProject()).toBeNull();
	});
});

describe("getSelectedProduct / setSelectedProduct / clearSelectedProduct", () => {
	it("setSelectedProduct stores product and sets itemType to product", () => {
		setSelectedProduct("my-product");
		expect(getSelectedProduct()).toBe("my-product");
		expect(getSelectedItemType()).toBe("product");
	});

	it("clearSelectedProduct removes product selection", () => {
		setSelectedProduct("temp");
		clearSelectedProduct();
		expect(getSelectedProduct()).toBeNull();
	});
});

describe("getSelectedFeature / setSelectedFeature / clearSelectedFeature", () => {
	it("setSelectedFeature stores feature and sets itemType to feature", () => {
		setSelectedFeature("my-feature");
		expect(getSelectedFeature()).toBe("my-feature");
		expect(getSelectedItemType()).toBe("feature");
	});

	it("clearSelectedFeature removes feature selection", () => {
		setSelectedFeature("temp");
		clearSelectedFeature();
		expect(getSelectedFeature()).toBeNull();
	});
});

describe("clearAllSelections", () => {
	it("clears project, product, feature, and itemType", () => {
		setSelectedProject("proj");
		setSelectedProduct("prod");
		setSelectedFeature("feat");
		clearAllSelections();
		expect(getSelectedProject()).toBeNull();
		expect(getSelectedProduct()).toBeNull();
		expect(getSelectedFeature()).toBeNull();
		expect(getSelectedItemType()).toBeNull();
	});
});

describe("migrateStateIfNeeded — directory creation", () => {
	it("creates state directory during migration when it does not exist", () => {
		const legacyData = JSON.stringify({ selectedProject: "migrated" });
		// Create fs with only legacy file, no STATE_DIR
		const fs = createMockFs({ [LEGACY_PATH]: legacyData });
		// Remove the auto-seeded dirs to simulate STATE_DIR not existing
		fs.dirs.delete(STATE_DIR);
		loadState(fs);
		expect(fs.dirs.has(STATE_DIR)).toBe(true);
		expect(fs.files.has(STATE_PATH)).toBe(true);
	});
});
