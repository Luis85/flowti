import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(), printSection: vi.fn(), printDivider: vi.fn(),
}));
vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(), confirm: vi.fn(), select: vi.fn(), waitForEnter: vi.fn() },
}));
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: { existsSync: vi.fn(() => false), readFileSync: vi.fn(() => ""), readdirSync: vi.fn(() => []), writeFileSync: vi.fn(), mkdirSync: vi.fn() },
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		resolve: (...args: string[]) => args.join("/"),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		basename: (p: string) => p.split("/").pop() ?? "",
	},
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	cliConfig: { defaultAuthor: "Default Author" },
}));
vi.mock("../../../src/domain/make/naming.js", () => ({
	toKebab: vi.fn((s: string) => s.toLowerCase().replace(/\s+/g, "-")),
	toPascal: vi.fn((s: string) => s.replace(/(?:^|\s)\w/g, (m: string) => m.trim().toUpperCase()).replace(/\s/g, "")),
}));
vi.mock("../../../src/domain/project/project-config.js", () => ({
	readProjectConfig: vi.fn(() => ({ config: null })),
}));
vi.mock("../../../src/domain/make/templates/file-writer.js", () => ({
	createFileWriter: vi.fn(() => ({ write: vi.fn(), created: 3 })),
}));
vi.mock("../../../src/domain/make/makers.js", () => ({
	getNextTestFileNumber: vi.fn(() => "50"),
}));
vi.mock("../../../src/domain/make/plans.js", () => ({
	buildPluginPlan: vi.fn(() => [{ path: "src/main.ts", content: "" }]),
	buildAppPlan: vi.fn(() => [{ path: "src/main.ts", content: "" }]),
	buildCliAppPlan: vi.fn(() => [{ path: "src/main.ts", content: "" }]),
	buildJourneyPlan: vi.fn(() => [{ path: "journey.json", content: "" }]),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { input } from "../../../src/infrastructure/input.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { createFileWriter } from "../../../src/domain/make/templates/file-writer.js";
import { buildPluginPlan, buildAppPlan, buildCliAppPlan, buildJourneyPlan } from "../../../src/domain/make/plans.js";
import { readProjectConfig } from "../../../src/domain/project/project-config.js";
import { makePlugin, makeApp, makeCliApp, makeJourney } from "../../../src/ui/menus/make-makers.js";

const mockLog = vi.mocked(log);
const mockInput = vi.mocked(input);
const mockDisk = vi.mocked(disk);

const makeDeps = { disk, paths, input, log } as any;

function output(): string {
	return mockLog.mock.calls.map((c) => c[0] ?? "").join("\n");
}

beforeEach(() => {
	vi.clearAllMocks();
	mockDisk.existsSync.mockReturnValue(false);
});

// ── makePlugin ───────────────────────────────────────────────────────

describe("makePlugin", () => {
	it("happy path: scaffolds plugin", async () => {
		mockInput.ask
			.mockResolvedValueOnce("My Plugin")     // name
			.mockResolvedValueOnce("my-plugin")      // pluginId
			.mockResolvedValueOnce("Author")         // author
			.mockResolvedValueOnce("Y");             // proceed
		vi.mocked(createFileWriter).mockReturnValue({ write: vi.fn(), created: 4 } as any);

		await makePlugin("/project", makeDeps);

		expect(vi.mocked(buildPluginPlan)).toHaveBeenCalledWith({
			name: "My Plugin", pluginId: "my-plugin", author: "Author",
		});
		expect(output()).toContain("Created 4 files");
		expect(mockInput.waitForEnter).toHaveBeenCalled();
	});

	it("cancels when name is empty", async () => {
		mockInput.ask.mockResolvedValueOnce("");

		await makePlugin("/project", makeDeps);

		expect(vi.mocked(buildPluginPlan)).not.toHaveBeenCalled();
	});

	it("aborts when folder already exists", async () => {
		mockInput.ask
			.mockResolvedValueOnce("My Plugin")
			.mockResolvedValueOnce("my-plugin")
			.mockResolvedValueOnce("Author");
		mockDisk.existsSync.mockReturnValue(true);

		await makePlugin("/project", makeDeps);

		expect(vi.mocked(buildPluginPlan)).not.toHaveBeenCalled();
		expect(output()).toContain("Folder already exists");
	});

	it("aborts when user declines", async () => {
		mockInput.ask
			.mockResolvedValueOnce("My Plugin")
			.mockResolvedValueOnce("my-plugin")
			.mockResolvedValueOnce("Author")
			.mockResolvedValueOnce("n");

		await makePlugin("/project", makeDeps);

		expect(vi.mocked(buildPluginPlan)).not.toHaveBeenCalled();
	});

	it("uses default author from config", async () => {
		mockInput.ask
			.mockResolvedValueOnce("My Plugin")
			.mockResolvedValueOnce("my-plugin")
			.mockResolvedValueOnce("Default Author")
			.mockResolvedValueOnce("Y");
		vi.mocked(createFileWriter).mockReturnValue({ write: vi.fn(), created: 1 } as any);

		await makePlugin("/project", makeDeps);

		// The ask for Author should have received "Default Author" as default
		expect(mockInput.ask).toHaveBeenCalledWith("Author", "Default Author");
	});
});

// ── makeApp ──────────────────────────────────────────────────────────

describe("makeApp", () => {
	it("happy path: scaffolds app", async () => {
		mockInput.ask
			.mockResolvedValueOnce("My App")    // name
			.mockResolvedValueOnce("my-app")    // appId
			.mockResolvedValueOnce("Author")    // author
			.mockResolvedValueOnce("Y");        // proceed
		vi.mocked(createFileWriter).mockReturnValue({ write: vi.fn(), created: 5 } as any);

		await makeApp("/project", makeDeps);

		expect(vi.mocked(buildAppPlan)).toHaveBeenCalledWith(
			expect.objectContaining({ name: "My App", appId: "my-app", author: "Author" }),
		);
		expect(output()).toContain("Created 5 files");
		expect(mockInput.waitForEnter).toHaveBeenCalled();
	});

	it("cancels when name is empty", async () => {
		mockInput.ask.mockResolvedValueOnce("");

		await makeApp("/project", makeDeps);

		expect(vi.mocked(buildAppPlan)).not.toHaveBeenCalled();
	});

	it("aborts when folder exists", async () => {
		mockInput.ask
			.mockResolvedValueOnce("My App")
			.mockResolvedValueOnce("my-app")
			.mockResolvedValueOnce("Author");
		mockDisk.existsSync.mockReturnValue(true);

		await makeApp("/project", makeDeps);

		expect(vi.mocked(buildAppPlan)).not.toHaveBeenCalled();
		expect(output()).toContain("Folder already exists");
	});

	it("aborts when user declines", async () => {
		mockInput.ask
			.mockResolvedValueOnce("My App")
			.mockResolvedValueOnce("my-app")
			.mockResolvedValueOnce("Author")
			.mockResolvedValueOnce("n");

		await makeApp("/project", makeDeps);

		expect(vi.mocked(buildAppPlan)).not.toHaveBeenCalled();
	});
});

// ── makeCliApp ───────────────────────────────────────────────────────

describe("makeCliApp", () => {
	it("happy path: scaffolds CLI app", async () => {
		mockInput.ask
			.mockResolvedValueOnce("My CLI")    // name
			.mockResolvedValueOnce("my-cli")    // appId
			.mockResolvedValueOnce("Y");        // proceed
		vi.mocked(createFileWriter).mockReturnValue({ write: vi.fn(), created: 3 } as any);

		await makeCliApp("/project", makeDeps);

		expect(vi.mocked(buildCliAppPlan)).toHaveBeenCalledWith({
			name: "My CLI", appId: "my-cli",
		});
		expect(output()).toContain("Created 3 files");
		expect(mockInput.waitForEnter).toHaveBeenCalled();
	});

	it("cancels when name is empty", async () => {
		mockInput.ask.mockResolvedValueOnce("");

		await makeCliApp("/project", makeDeps);

		expect(vi.mocked(buildCliAppPlan)).not.toHaveBeenCalled();
	});

	it("aborts when folder exists", async () => {
		mockInput.ask
			.mockResolvedValueOnce("My CLI")
			.mockResolvedValueOnce("my-cli");
		mockDisk.existsSync.mockReturnValue(true);

		await makeCliApp("/project", makeDeps);

		expect(vi.mocked(buildCliAppPlan)).not.toHaveBeenCalled();
		expect(output()).toContain("Folder already exists");
	});

	it("aborts when user declines", async () => {
		mockInput.ask
			.mockResolvedValueOnce("My CLI")
			.mockResolvedValueOnce("my-cli")
			.mockResolvedValueOnce("n");

		await makeCliApp("/project", makeDeps);

		expect(vi.mocked(buildCliAppPlan)).not.toHaveBeenCalled();
	});
});

// ── makeJourney ──────────────────────────────────────────────────────

describe("makeJourney", () => {
	it("happy path: scaffolds journey", async () => {
		mockInput.ask
			.mockResolvedValueOnce("Getting Started")  // name
			.mockResolvedValueOnce("getting-started")   // slug
			.mockResolvedValueOnce("E2E journey")       // description
			.mockResolvedValueOnce("Y");                // proceed
		vi.mocked(readProjectConfig).mockReturnValue({ config: null } as any);
		vi.mocked(createFileWriter).mockReturnValue({ write: vi.fn(), created: 3 } as any);

		await makeJourney("/project", makeDeps);

		expect(vi.mocked(buildJourneyPlan)).toHaveBeenCalledWith(
			expect.objectContaining({
				name: "Getting Started",
				slug: "getting-started",
				description: "E2E journey",
			}),
		);
		expect(output()).toContain("Created 3 files");
		expect(mockInput.waitForEnter).toHaveBeenCalled();
	});

	it("cancels when name is empty", async () => {
		mockInput.ask.mockResolvedValueOnce("");

		await makeJourney("/project", makeDeps);

		expect(vi.mocked(buildJourneyPlan)).not.toHaveBeenCalled();
	});

	it("aborts when journey file already exists", async () => {
		mockInput.ask
			.mockResolvedValueOnce("Getting Started")
			.mockResolvedValueOnce("getting-started")
			.mockResolvedValueOnce("desc");
		vi.mocked(readProjectConfig).mockReturnValue({ config: null } as any);
		mockDisk.existsSync.mockReturnValue(true);

		await makeJourney("/project", makeDeps);

		expect(vi.mocked(buildJourneyPlan)).not.toHaveBeenCalled();
		expect(output()).toContain("Journey already exists");
	});

	it("aborts when user declines", async () => {
		mockInput.ask
			.mockResolvedValueOnce("Getting Started")
			.mockResolvedValueOnce("getting-started")
			.mockResolvedValueOnce("desc")
			.mockResolvedValueOnce("n");
		vi.mocked(readProjectConfig).mockReturnValue({ config: null } as any);

		await makeJourney("/project", makeDeps);

		expect(vi.mocked(buildJourneyPlan)).not.toHaveBeenCalled();
	});

	it("uses journeysDir from project config", async () => {
		mockInput.ask
			.mockResolvedValueOnce("My Journey")
			.mockResolvedValueOnce("my-journey")
			.mockResolvedValueOnce("desc")
			.mockResolvedValueOnce("Y");
		vi.mocked(readProjectConfig).mockReturnValue({
			config: { review: { journeysDir: "custom/journeys" } },
		} as any);
		vi.mocked(createFileWriter).mockReturnValue({ write: vi.fn(), created: 3 } as any);

		await makeJourney("/project", makeDeps);

		expect(vi.mocked(buildJourneyPlan)).toHaveBeenCalledWith(
			expect.objectContaining({ journeysDir: "custom/journeys" }),
		);
	});

	it("shows created files summary", async () => {
		mockInput.ask
			.mockResolvedValueOnce("My Journey")
			.mockResolvedValueOnce("my-journey")
			.mockResolvedValueOnce("desc")
			.mockResolvedValueOnce("Y");
		vi.mocked(readProjectConfig).mockReturnValue({ config: null } as any);
		vi.mocked(createFileWriter).mockReturnValue({ write: vi.fn(), created: 3 } as any);

		await makeJourney("/project", makeDeps);

		expect(output()).toContain("Journey definition");
		expect(output()).toContain("Test entry");
		expect(output()).toContain("Journey canvas");
		expect(output()).toContain("Next steps");
	});
});
