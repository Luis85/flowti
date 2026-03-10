import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	PLUGIN_ROOT: "/plugin",
	cliConfig: { onboarding: { pluginId: "flowti-ibde", nodeMinVersion: 16 } },
}));

vi.mock("../../../src/infrastructure/proc.js", () => ({
	proc: { exit: vi.fn() },
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {},
}));

vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {},
}));

import { log } from "../../../src/infrastructure/logger.js";
import {
	checkPrerequisites,
	ensureDependencies,
	checkFirstRun,
	showPostBuildGuidance,
} from "../../../src/domain/onboarding/onboarding.js";
import { createMockFs } from "../../mocks/mock-fs.js";
import { createMockShell } from "../../mocks/mock-shell.js";

const mockLog = log as ReturnType<typeof vi.fn>;

beforeEach(() => mockLog.mockClear());

describe("checkPrerequisites", () => {
	it("passes when git and node are available", () => {
		const mockExit = vi.fn();
		const mockSh = createMockShell({
			outputs: { "node --version": "v20.0.0" },
		});
		checkPrerequisites({ sh: mockSh, exit: mockExit });
		expect(mockExit).not.toHaveBeenCalled();
	});

	it("exits when git is missing", () => {
		const mockExit = vi.fn();
		const mockSh = createMockShell({
			failChecks: ["git --version"],
			outputs: { "node --version": "v20.0.0" },
		});
		checkPrerequisites({ sh: mockSh, exit: mockExit });
		expect(mockExit).toHaveBeenCalledWith(2);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Git");
	});

	it("exits when node is missing", () => {
		const mockExit = vi.fn();
		const mockSh = createMockShell({ failChecks: [] });
		checkPrerequisites({ sh: mockSh, exit: mockExit });
		expect(mockExit).toHaveBeenCalledWith(2);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Node.js");
	});

	it("exits when node version is too old", () => {
		const mockExit = vi.fn();
		const mockSh = createMockShell({
			outputs: { "node --version": "v14.0.0" },
		});
		checkPrerequisites({ sh: mockSh, exit: mockExit });
		expect(mockExit).toHaveBeenCalledWith(2);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("v14.0.0");
	});
});

describe("ensureDependencies", () => {
	it("skips when node_modules exists", () => {
		const mockFs = createMockFs({ "/plugin/node_modules/placeholder": "" });
		const mockSh = createMockShell();
		ensureDependencies("/plugin", { fs: mockFs, sh: mockSh });
		expect(mockSh.calls).toHaveLength(0);
	});

	it("runs npm install when node_modules is missing", () => {
		const mockFs = createMockFs();
		const mockSh = createMockShell();
		const mockExit = vi.fn();
		ensureDependencies("/plugin", { fs: mockFs, sh: mockSh, exit: mockExit });
		expect(mockSh.calls).toHaveLength(1);
		expect(mockSh.calls[0].cmd).toBe("npm install");
		expect(mockSh.calls[0].opts?.cwd).toBe("/plugin");
		expect(mockExit).not.toHaveBeenCalled();
	});

	it("exits on npm install failure", () => {
		const mockFs = createMockFs();
		const mockSh = createMockShell({ exitCodes: { "npm install": 1 } });
		const mockExit = vi.fn();
		ensureDependencies("/plugin", { fs: mockFs, sh: mockSh, exit: mockExit });
		expect(mockExit).toHaveBeenCalledWith(1);
	});
});

describe("checkFirstRun", () => {
	it("logs guidance when plugin is not built", () => {
		const mockFs = createMockFs();
		checkFirstRun({ fs: mockFs });
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("not yet built");
	});

	it("stays silent when plugin is already built", () => {
		const mockFs = createMockFs({
			"/vault/.obsidian/plugins/flowti-ibde/main.js": "content",
		});
		checkFirstRun({ fs: mockFs });
		expect(mockLog).not.toHaveBeenCalled();
	});
});

describe("showPostBuildGuidance", () => {
	it("shows guidance when plugin is built", () => {
		const mockFs = createMockFs({
			"/vault/.obsidian/plugins/flowti-ibde/main.js": "content",
		});
		showPostBuildGuidance({ fs: mockFs });
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("built successfully");
	});

	it("stays silent when plugin is not built", () => {
		const mockFs = createMockFs();
		showPostBuildGuidance({ fs: mockFs });
		expect(mockLog).not.toHaveBeenCalled();
	});
});
