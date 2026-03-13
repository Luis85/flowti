import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/logger.js", () => ({ log: vi.fn() }));
vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "", UNDERLINE: "",
	printHeader: vi.fn(),
}));
vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: { join: (...parts: string[]) => parts.join("/"), resolve: (...parts: string[]) => parts.join("/") },
}));
vi.mock("../../../src/infrastructure/config.js", () => ({
	PROJECTS_DIR: "/projects",
}));
vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => "{}"),
		readdirSync: vi.fn(() => []),
	},
}));
vi.mock("../../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../../mocks/mock-presets.js");
	return mockShellPreset();
});
vi.mock("../../../src/infrastructure/fs.js", () => ({
	countFiles: vi.fn(() => 0),
}));
vi.mock("../../../src/infrastructure/state.js", () => ({
	getSelectedProject: vi.fn(() => null),
}));
vi.mock("../../../src/domain/project/project-config.js", () => ({
	initializeProject: vi.fn(() => ({
		config: { name: "test" },
		path: "/test",
		pkg: null,
		scripts: {},
	})),
}));
vi.mock("../../../src/domain/project/tool-availability.js", () => ({
	detectTools: vi.fn(() => [
		{ id: "vitest", available: true, version: "4.0.0" },
		{ id: "typescript", available: true, version: "5.9.0" },
		{ id: "eslint", available: false },
	]),
}));

import { log } from "../../../src/infrastructure/logger.js";
import { displayInfo, showInfo } from "../../../src/ui/displays/info-display.js";
import { getSelectedProject } from "../../../src/infrastructure/state.js";

const mockLog = log as ReturnType<typeof vi.fn>;
const output = () => mockLog.mock.calls.map((c: unknown[]) => c[0] ?? "").join("\n");

beforeEach(() => {
	vi.clearAllMocks();
});

describe("displayInfo", () => {
	it("renders project name and path", () => {
		displayInfo({
			name: "my-app",
			path: "/projects/my-app",
			tools: [],
		} as never);
		const out = output();
		expect(out).toContain("my-app");
		expect(out).toContain("/projects/my-app");
	});

	it("renders version when present", () => {
		displayInfo({
			name: "app",
			path: "/p",
			version: "1.2.3",
			tools: [],
		} as never);
		expect(output()).toContain("1.2.3");
	});

	it("renders source info when present", () => {
		displayInfo({
			name: "app",
			path: "/p",
			source: { sourceFiles: 50, testFiles: 30, ext: ".ts" },
			tools: [],
		} as never);
		const out = output();
		expect(out).toContain("50");
		expect(out).toContain("30");
		expect(out).toContain(".ts");
	});

	it("renders dependencies when present", () => {
		displayInfo({
			name: "app",
			path: "/p",
			dependencies: { production: 5, development: 10, scripts: 3 },
			tools: [],
		} as never);
		const out = output();
		expect(out).toContain("Production");
		expect(out).toContain("5");
		expect(out).toContain("10");
	});

	it("renders tools with available and unavailable", () => {
		displayInfo({
			name: "app",
			path: "/p",
			tools: [
				{ id: "vitest", available: true, version: "4.0.0" },
				{ id: "eslint", available: false },
			],
		} as never);
		const out = output();
		expect(out).toContain("vitest");
		expect(out).toContain("eslint");
		expect(out).toContain("not installed");
		expect(out).toContain("1/2 available");
	});

	it("renders git info when present", () => {
		displayInfo({
			name: "app",
			path: "/p",
			tools: [],
			git: { branch: "main", commit: "abc1234", status: "clean" },
		} as never);
		const out = output();
		expect(out).toContain("main");
		expect(out).toContain("abc1234");
		expect(out).toContain("clean");
	});

	it("renders dirty git status", () => {
		displayInfo({
			name: "app",
			path: "/p",
			tools: [],
			git: { branch: "dev", commit: "def5678", status: "dirty" },
		} as never);
		expect(output()).toContain("dirty");
	});
});

describe("showInfo", () => {
	it("shows no-project message when none selected", () => {
		vi.mocked(getSelectedProject).mockReturnValue(null);
		showInfo();
		expect(output()).toContain("No project selected");
	});
});
