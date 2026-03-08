import { describe, it, expect, vi } from "vitest";
import { createMockFs } from "../mocks/mock-fs.js";

vi.mock("../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/mock/vault",
	CLI_PROJECT: "/mock/vault/01 - Projects/Flowti CLI",
}));

import { loadState, saveState } from "../../src/infrastructure/state.js";

// State path is: VAULT_ROOT + "/.flowti/var/state.json"
const STATE_DIR = "/mock/vault/.flowti/var";
const STATE_PATH = "/mock/vault/.flowti/var/state.json";

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
		saveState({ projectSource: "development" }, fs);

		const written = JSON.parse(fs.files.get(STATE_PATH)!);
		expect(written).toEqual({ selectedProject: "old", projectSource: "development" });
	});

	it("creates state file when it does not exist", () => {
		const fs = createMockFs();
		saveState({ selectedProject: "new" }, fs);

		const written = JSON.parse(fs.files.get(STATE_PATH)!);
		expect(written.selectedProject).toBe("new");
	});

	it("overwrites existing keys", () => {
		const fs = createMockFs({ [STATE_PATH]: JSON.stringify({ selectedProject: "old", projectSource: "projects" }) });
		saveState({ selectedProject: "new" }, fs);

		const written = JSON.parse(fs.files.get(STATE_PATH)!);
		expect(written.selectedProject).toBe("new");
		expect(written.projectSource).toBe("projects");
	});

	it("can clear values with undefined", () => {
		const fs = createMockFs({ [STATE_PATH]: JSON.stringify({ selectedProject: "old", projectSource: "development" }) });
		saveState({ selectedProject: undefined, projectSource: undefined }, fs);

		const written = JSON.parse(fs.files.get(STATE_PATH)!);
		expect(written.selectedProject).toBeUndefined();
		expect(written.projectSource).toBeUndefined();
	});
});
