import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";

vi.mock("../../../src/infrastructure/config.js", () => ({
	PROJECTS_DIR: "/mock/projects",
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));

vi.mock("../../../src/infrastructure/paths.js", async () => {
	const path = await import("node:path");
	return {
		paths: {
			join: (...args: string[]) => path.default.join(...args).replace(/\\/g, "/"),
			resolve: (...args: string[]) => path.default.join(...args).replace(/\\/g, "/"),
			dirname: (p: string) => path.default.dirname(p).replace(/\\/g, "/"),
			basename: path.default.basename,
		},
	};
});

import * as fsMod from "../../../src/infrastructure/filesystem.js";
import { listProjects, getProjectPath } from "../../../src/domain/project/project.js";
import { paths as mockPaths } from "../../../src/infrastructure/paths.js";

function setDisk(mockFs: ReturnType<typeof createMockFs>): void {
	Object.assign(fsMod, { disk: mockFs });
}

beforeEach(() => vi.clearAllMocks());

// ── listProjects ────────────────────────────────────────────────────

describe("listProjects", () => {
	it("returns sorted directory names from PROJECTS_DIR", () => {
		const mockFs = createMockFs({
			"/mock/projects/beta/package.json": "{}",
			"/mock/projects/alpha/package.json": "{}",
		});
		setDisk(mockFs);

		const result = listProjects({ disk: fsMod.disk });
		expect(result).toEqual(["alpha", "beta"]);
	});

	it("returns empty array when PROJECTS_DIR does not exist", () => {
		const mockFs = createMockFs();
		// Override readdirSync to throw
		mockFs.readdirSync = () => { throw new Error("ENOENT"); };
		setDisk(mockFs);

		expect(listProjects({ disk: fsMod.disk })).toEqual([]);
	});

	it("filters out files (only directories)", () => {
		const mockFs = createMockFs({
			"/mock/projects/readme.md": "content",
		});
		// readme.md is a file, not a directory — should be excluded
		setDisk(mockFs);

		const result = listProjects({ disk: fsMod.disk });
		// readme.md won't appear as a directory entry
		expect(result.includes("readme.md")).toBe(false);
	});
});

// ── getProjectPath ──────────────────────────────────────────────────

describe("getProjectPath", () => {
	it("joins PROJECTS_DIR with project name", () => {
		const result = getProjectPath("my-app", { paths: mockPaths });
		expect(result.replace(/\\/g, "/")).toContain("mock/projects/my-app");
	});
});
