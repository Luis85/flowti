import { describe, it, expect, vi } from "vitest";

vi.mock("../../../src/domain/project/project.js", () => ({
	listProjects: vi.fn(),
}));

vi.mock("../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(),
}));

vi.mock("../../../src/domain/make/component/storybook-service.js", () => ({
	resolveStorybookDir: vi.fn(),
	isStorybookInstalled: vi.fn(),
}));

vi.mock("../../../src/domain/make/component/storybook-browser.js", () => ({
	isStorybookRunning: vi.fn().mockReturnValue(false),
}));

import { getProjectList, getProjectDetail } from "../../../src/domain/serve/project-api.js";
import { listProjects } from "../../../src/domain/project/project.js";
import { readProjectConfig } from "../../../src/domain/project/project-config.js";
import { isStorybookInstalled } from "../../../src/domain/make/component/storybook-service.js";
import type { IFileSystem, IPaths } from "../../../src/infrastructure/types.js";

// ── Helpers ──────────────────────────────────────────────────────────

const mockPaths: Pick<IPaths, "join" | "extname"> = {
	join: (...parts: string[]) => parts.join("/"),
	extname: (p: string) => {
		const dot = p.lastIndexOf(".");
		return dot === -1 ? "" : p.slice(dot);
	},
};

function mockDisk(files: Record<string, string | boolean> = {}): IFileSystem {
	return {
		existsSync: (p: string) => p in files,
		readFileSync: (p: string) => (typeof files[p] === "string" ? files[p] : "") as string,
		writeFileSync: vi.fn(),
		mkdirSync: vi.fn(),
		readdirSync: vi.fn().mockReturnValue([]),
		copyFileSync: vi.fn(),
		rmSync: vi.fn(),
		unlinkSync: vi.fn(),
		statSync: vi.fn(),
	} as unknown as IFileSystem;
}

// ── getProjectList ──────────────────────────────────────────────────

describe("getProjectList", () => {
	it("returns empty array when no projects exist", () => {
		(listProjects as ReturnType<typeof vi.fn>).mockReturnValue([]);
		const deps = { disk: mockDisk(), paths: mockPaths as IPaths };
		const result = getProjectList("/projects", deps);
		expect(result).toEqual({ projects: [] });
	});

	it("returns project summaries with config data", () => {
		(listProjects as ReturnType<typeof vi.fn>).mockReturnValue(["Flowti CLI", "Flowti Plugin"]);
		(readProjectConfig as ReturnType<typeof vi.fn>).mockImplementation((path: string) => {
			if (path.includes("Flowti CLI")) {
				return { config: { name: "Flowti CLI", type: "typescript-cli" }, warnings: [] };
			}
			return { config: { name: "Flowti Plugin", type: "obsidian-plugin" }, warnings: [] };
		});
		(isStorybookInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);

		const files: Record<string, string | boolean> = {
			"/projects/Flowti CLI/Flowti CLI.md": true,
		};
		const deps = { disk: mockDisk(files), paths: mockPaths as IPaths };
		const result = getProjectList("/projects", deps);

		expect(result.projects).toHaveLength(2);
		expect(result.projects[0].name).toBe("Flowti CLI");
		expect(result.projects[0].type).toBe("typescript-cli");
		expect(result.projects[0].hasNote).toBe(true);
		expect(result.projects[1].name).toBe("Flowti Plugin");
		expect(result.projects[1].hasNote).toBe(false);
	});

	it("defaults type to config name when type is absent", () => {
		(listProjects as ReturnType<typeof vi.fn>).mockReturnValue(["MyProject"]);
		(readProjectConfig as ReturnType<typeof vi.fn>).mockReturnValue({
			config: { name: "MyProject" },
			warnings: [],
		});
		(isStorybookInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);

		const deps = { disk: mockDisk(), paths: mockPaths as IPaths };
		const result = getProjectList("/projects", deps);
		expect(result.projects[0].type).toBe("MyProject");
	});

	it("defaults type to unknown when no config exists", () => {
		(listProjects as ReturnType<typeof vi.fn>).mockReturnValue(["Bare"]);
		(readProjectConfig as ReturnType<typeof vi.fn>).mockReturnValue({
			config: null,
			warnings: [],
		});

		const deps = { disk: mockDisk(), paths: mockPaths as IPaths };
		const result = getProjectList("/projects", deps);
		expect(result.projects[0].type).toBe("unknown");
	});
});

// ── getProjectDetail ────────────────────────────────────────────────

describe("getProjectDetail", () => {
	it("returns null when project directory does not exist", () => {
		const deps = { disk: mockDisk(), paths: mockPaths as IPaths };
		const result = getProjectDetail("Missing", "/projects", deps);
		expect(result).toBeNull();
	});

	it("returns full detail for an existing project", () => {
		const files: Record<string, string | boolean> = {
			"/projects/Flowti CLI": true,
			"/projects/Flowti CLI/Flowti CLI.md": true,
		};
		(readProjectConfig as ReturnType<typeof vi.fn>).mockReturnValue({
			config: { name: "Flowti CLI", type: "typescript-cli" },
			warnings: [],
		});
		(isStorybookInstalled as ReturnType<typeof vi.fn>).mockReturnValue(false);

		const deps = { disk: mockDisk(files), paths: mockPaths as IPaths };
		const result = getProjectDetail("Flowti CLI", "/projects", deps);

		expect(result).not.toBeNull();
		expect(result!.name).toBe("Flowti CLI");
		expect(result!.type).toBe("typescript-cli");
		expect(result!.hasNote).toBe(true);
		expect(result!.notePath).toBe("/projects/Flowti CLI/Flowti CLI.md");
		expect(result!.projectPath).toBe("/projects/Flowti CLI");
		expect(result!.storybook.installed).toBe(false);
	});

	it("returns notePath as null when project note is missing", () => {
		const files: Record<string, string | boolean> = {
			"/projects/Bare": true,
		};
		(readProjectConfig as ReturnType<typeof vi.fn>).mockReturnValue({
			config: null,
			warnings: [],
		});

		const deps = { disk: mockDisk(files), paths: mockPaths as IPaths };
		const result = getProjectDetail("Bare", "/projects", deps);

		expect(result).not.toBeNull();
		expect(result!.hasNote).toBe(false);
		expect(result!.notePath).toBeNull();
	});
});
