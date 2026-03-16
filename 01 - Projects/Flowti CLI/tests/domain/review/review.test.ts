import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../../mocks/mock-presets.js");
	return mockShellPreset();
});

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
	warn: vi.fn(),
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		rmSync: vi.fn(),
	},
}));

vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
}));

vi.mock("../../../src/infrastructure/test-vault.js", () => ({
	resolveTestVaultRoot: vi.fn((name: string, root: string) => `${root}/../${name}`),
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop() || "",
	},
}));

vi.mock("../../../src/domain/review/change-analysis.js", () => ({
	analyzeWorkingTree: vi.fn(),
	analyzeBranchDiff: vi.fn(),
}));

import { commands } from "../../../src/controller/review.controller.js";
import { shell } from "../../../src/infrastructure/shell.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { log } from "../../../src/infrastructure/logger.js";
import type { ProjectContext } from "../../../src/infrastructure/types.js";

const mockShell = vi.mocked(shell);
const mockDisk = vi.mocked(disk);
const mockLog = vi.mocked(log);

beforeEach(() => {
	vi.clearAllMocks();
});

function makeProject(overrides: Partial<ProjectContext> = {}): ProjectContext {
	return {
		path: "/project",
		config: { name: "test-project", ...overrides.config },
		...overrides,
	} as ProjectContext;
}

describe("review command", () => {
	it("runs configured runner", () => {
		const p = makeProject({ config: { name: "test", review: { runner: "npm run e2e" } } });
		commands.review({}, [], "review", p);
		expect(mockShell.run).toHaveBeenCalledWith("npm run e2e", expect.objectContaining({ cwd: "/project" }));
	});

	it("defaults to npm test when no runner configured", () => {
		const p = makeProject();
		commands.review({}, [], "review", p);
		expect(mockShell.run).toHaveBeenCalledWith("npm test", expect.objectContaining({ cwd: "/project" }));
	});
});

describe("review:all command", () => {
	it("runs build → test → E2E sequentially", () => {
		const p = makeProject({ config: { name: "test", review: { build: "make build", test: "make test", runner: "make e2e" } } });
		mockShell.run.mockReturnValue(0);

		commands["review:all"]({}, [], "review:all", p);

		expect(mockShell.run).toHaveBeenCalledTimes(3);
		expect(mockShell.run).toHaveBeenCalledWith("make build", expect.objectContaining({ label: "Step 1/3: Build" }));
		expect(mockShell.run).toHaveBeenCalledWith("make test", expect.objectContaining({ label: "Step 2/3: Test" }));
		expect(mockShell.run).toHaveBeenCalledWith("make e2e", expect.objectContaining({ label: "Step 3/3: E2E" }));
	});

	it("stops on build failure", () => {
		const p = makeProject({ config: { name: "test", review: { build: "make build", test: "make test" } } });
		mockShell.run.mockReturnValue(1);

		commands["review:all"]({}, [], "review:all", p);

		expect(mockShell.run).toHaveBeenCalledTimes(1);
	});

	it("stops on test failure", () => {
		const p = makeProject({ config: { name: "test", review: { build: "make build", test: "make test" } } });
		mockShell.run
			.mockReturnValueOnce(0)  // build passes
			.mockReturnValueOnce(1); // test fails

		commands["review:all"]({}, [], "review:all", p);

		expect(mockShell.run).toHaveBeenCalledTimes(2);
	});

	it("uses defaults when no review config", () => {
		const p = makeProject();
		mockShell.run.mockReturnValue(0);

		commands["review:all"]({}, [], "review:all", p);

		expect(mockShell.run).toHaveBeenCalledWith("npm run build", expect.anything());
		expect(mockShell.run).toHaveBeenCalledWith("npm test", expect.anything());
		expect(mockShell.run).toHaveBeenCalledWith("npx vitest run tests/e2e/", expect.anything());
	});

	it("does nothing without project context", () => {
		commands["review:all"]({}, [], "review:all", undefined);
		expect(mockShell.run).not.toHaveBeenCalled();
	});
});

describe("review:clean command", () => {
	it("removes test vault when it exists", () => {
		mockDisk.existsSync.mockReturnValue(true);
		const p = makeProject({ config: { name: "test-project", review: { testVault: "my-e2e-vault" } } });

		commands["review:clean"]({}, [], "review:clean", p);

		expect(mockDisk.rmSync).toHaveBeenCalledTimes(1);
		const calls = mockLog.mock.calls.map(([msg]) => String(msg));
		expect(calls.some((m) => m.includes("Removed"))).toBe(true);
	});

	it("reports when no test vault found", () => {
		mockDisk.existsSync.mockReturnValue(false);
		const p = makeProject({ config: { name: "test-project" } });

		commands["review:clean"]({}, [], "review:clean", p);

		expect(mockDisk.rmSync).not.toHaveBeenCalled();
		const calls = mockLog.mock.calls.map(([msg]) => String(msg));
		expect(calls.some((m) => m.includes("not found") || m.includes("does not exist"))).toBe(true);
	});

	it("does nothing without project context", () => {
		commands["review:clean"]({}, [], "review:clean", undefined);
		expect(mockDisk.rmSync).not.toHaveBeenCalled();
	});
});
