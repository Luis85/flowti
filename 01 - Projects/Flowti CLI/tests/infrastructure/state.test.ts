import { describe, it, expect, vi, beforeEach } from "vitest";
import fs from "node:fs";

vi.mock("node:fs");
vi.mock("../../src/infrastructure/config.js", () => ({
	CLI_PROJECT: "/mock/cli-project",
}));

import {
	loadState,
	saveState,
	getSelectedProject,
	getProjectSource,
	setSelectedProject,
	clearSelectedProject,
} from "../../src/infrastructure/state.js";

const mockedFs = vi.mocked(fs);

beforeEach(() => {
	vi.clearAllMocks();
});

describe("loadState", () => {
	it("returns parsed state from file", () => {
		mockedFs.readFileSync.mockReturnValue(JSON.stringify({ selectedProject: "my-app" }));
		expect(loadState()).toEqual({ selectedProject: "my-app" });
	});

	it("returns empty object when file does not exist", () => {
		mockedFs.readFileSync.mockImplementation(() => { throw new Error("ENOENT"); });
		expect(loadState()).toEqual({});
	});
});

describe("saveState", () => {
	it("merges and writes state to file", () => {
		mockedFs.readFileSync.mockReturnValue(JSON.stringify({ selectedProject: "old" }));
		saveState({ projectSource: "development" });

		expect(mockedFs.writeFileSync).toHaveBeenCalledOnce();
		const written = JSON.parse(mockedFs.writeFileSync.mock.calls[0][1] as string);
		expect(written).toEqual({ selectedProject: "old", projectSource: "development" });
	});
});

describe("getSelectedProject", () => {
	it("returns project name when set", () => {
		mockedFs.readFileSync.mockReturnValue(JSON.stringify({ selectedProject: "flowti" }));
		expect(getSelectedProject()).toBe("flowti");
	});

	it("returns null when not set", () => {
		mockedFs.readFileSync.mockReturnValue(JSON.stringify({}));
		expect(getSelectedProject()).toBeNull();
	});
});

describe("getProjectSource", () => {
	it("returns source when set", () => {
		mockedFs.readFileSync.mockReturnValue(JSON.stringify({ projectSource: "development" }));
		expect(getProjectSource()).toBe("development");
	});

	it("defaults to 'projects'", () => {
		mockedFs.readFileSync.mockReturnValue(JSON.stringify({}));
		expect(getProjectSource()).toBe("projects");
	});
});

describe("setSelectedProject", () => {
	it("saves project name and source", () => {
		mockedFs.readFileSync.mockReturnValue(JSON.stringify({}));
		setSelectedProject("my-app", "development");

		const written = JSON.parse(mockedFs.writeFileSync.mock.calls[0][1] as string);
		expect(written.selectedProject).toBe("my-app");
		expect(written.projectSource).toBe("development");
	});

	it("defaults source to 'projects'", () => {
		mockedFs.readFileSync.mockReturnValue(JSON.stringify({}));
		setSelectedProject("my-app");

		const written = JSON.parse(mockedFs.writeFileSync.mock.calls[0][1] as string);
		expect(written.projectSource).toBe("projects");
	});
});

describe("clearSelectedProject", () => {
	it("clears project and source", () => {
		mockedFs.readFileSync.mockReturnValue(JSON.stringify({ selectedProject: "old", projectSource: "development" }));
		clearSelectedProject();

		const written = JSON.parse(mockedFs.writeFileSync.mock.calls[0][1] as string);
		expect(written.selectedProject).toBeUndefined();
		expect(written.projectSource).toBeUndefined();
	});
});
