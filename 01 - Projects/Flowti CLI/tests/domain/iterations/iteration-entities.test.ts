import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/document.js", () => {
	const mockDoc = {
		mergeFrontmatter: vi.fn().mockReturnThis(),
		setFrontmatter: vi.fn().mockReturnThis(),
		addBlank: vi.fn().mockReturnThis(),
		heading: vi.fn().mockReturnThis(),
		text: vi.fn().mockReturnThis(),
		save: vi.fn(),
	};
	return { Document: { create: vi.fn(() => mockDoc) } };
});

import { createResourceFile, createEstimationFile } from "../../../src/domain/iterations/iteration-entities.js";

const mockDisk = {
	existsSync: vi.fn(),
	mkdirSync: vi.fn(),
	readdirSync: vi.fn(),
	readFileSync: vi.fn(),
	writeFileSync: vi.fn(),
};

const mockPaths = {
	join: vi.fn((...parts: string[]) => parts.join("/")),
	basename: vi.fn((p: string) => p.split("/").pop()),
	relative: vi.fn((_from: string, to: string) => to),
};

const deps = { disk: mockDisk as any, paths: mockPaths as any };

beforeEach(() => {
	vi.clearAllMocks();
});

describe("createResourceFile", () => {
	it("creates resource need markdown in docs/resources/", () => {
		mockDisk.existsSync.mockReturnValue(false);
		const result = createResourceFile(deps, "/project", { name: "Senior Dev", role: "Developer", allocation: "80%" });
		expect(result).toBe("/project/docs/resources/senior-dev.md");
		expect(mockDisk.mkdirSync).toHaveBeenCalledWith("/project/docs/resources", { recursive: true });
	});

	it("returns existing path without overwriting", () => {
		mockDisk.existsSync.mockReturnValue(true);
		const result = createResourceFile(deps, "/project", { name: "Senior Dev" });
		expect(result).toBe("/project/docs/resources/senior-dev.md");
	});
});

describe("createEstimationFile", () => {
	it("creates estimation markdown in docs/estimations/", () => {
		mockDisk.existsSync.mockReturnValue(false);
		const result = createEstimationFile(deps, "/project", { label: "Story Points", value: "13", unit: "SP" });
		expect(result).toBe("/project/docs/estimations/story-points.md");
		expect(mockDisk.mkdirSync).toHaveBeenCalledWith("/project/docs/estimations", { recursive: true });
	});

	it("returns existing path without overwriting", () => {
		mockDisk.existsSync.mockReturnValue(true);
		const result = createEstimationFile(deps, "/project", { label: "Story Points", value: "13" });
		expect(result).toBe("/project/docs/estimations/story-points.md");
	});
});
