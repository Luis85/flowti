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

import {
	checkPrerequisites,
	checkPrerequisiteIssues,
	ensureDependencies,
	getFirstRunStatus,
	getPostBuildGuidance,
} from "../../../src/domain/onboarding/onboarding.js";
import { createMockFs } from "../../mocks/mock-fs.js";
import { createMockShell } from "../../mocks/mock-shell.js";

beforeEach(() => vi.clearAllMocks());

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
	});

	it("exits when node is missing", () => {
		const mockExit = vi.fn();
		const mockSh = createMockShell({ failChecks: [] });
		checkPrerequisites({ sh: mockSh, exit: mockExit });
		expect(mockExit).toHaveBeenCalledWith(2);
	});

	it("exits when node version is too old", () => {
		const mockExit = vi.fn();
		const mockSh = createMockShell({
			outputs: { "node --version": "v14.0.0" },
		});
		checkPrerequisites({ sh: mockSh, exit: mockExit });
		expect(mockExit).toHaveBeenCalledWith(2);
	});
});

describe("checkPrerequisiteIssues", () => {
	it("returns empty when git and node are available", () => {
		const mockSh = createMockShell({
			outputs: { "node --version": "v20.0.0" },
		});
		const issues = checkPrerequisiteIssues({ sh: mockSh });
		expect(issues).toEqual([]);
	});

	it("reports Git when git is missing", () => {
		const mockSh = createMockShell({
			failChecks: ["git --version"],
			outputs: { "node --version": "v20.0.0" },
		});
		const issues = checkPrerequisiteIssues({ sh: mockSh });
		expect(issues.some(i => i.name.includes("Git"))).toBe(true);
	});

	it("reports Node.js when node is missing", () => {
		const mockSh = createMockShell({ failChecks: [] });
		const issues = checkPrerequisiteIssues({ sh: mockSh });
		expect(issues.some(i => i.name.includes("Node.js"))).toBe(true);
	});

	it("reports version mismatch when node is too old", () => {
		const mockSh = createMockShell({
			outputs: { "node --version": "v14.0.0" },
		});
		const issues = checkPrerequisiteIssues({ sh: mockSh });
		expect(issues.some(i => i.name.includes("v14.0.0"))).toBe(true);
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

describe("getFirstRunStatus", () => {
	it("returns pluginBuilt=false when plugin is not built", () => {
		const mockFs = createMockFs();
		const status = getFirstRunStatus({ fs: mockFs });
		expect(status.pluginBuilt).toBe(false);
	});

	it("returns pluginBuilt=true when plugin is already built", () => {
		const mockFs = createMockFs({
			"/vault/.obsidian/plugins/flowti-ibde/main.js": "content",
		});
		const status = getFirstRunStatus({ fs: mockFs });
		expect(status.pluginBuilt).toBe(true);
	});
});

describe("getPostBuildGuidance", () => {
	it("returns show=true when plugin is built", () => {
		const mockFs = createMockFs({
			"/vault/.obsidian/plugins/flowti-ibde/main.js": "content",
		});
		const guidance = getPostBuildGuidance({ fs: mockFs });
		expect(guidance.show).toBe(true);
		expect(guidance.vaultRoot).toBe("/vault");
	});

	it("returns show=false when plugin is not built", () => {
		const mockFs = createMockFs();
		const guidance = getPostBuildGuidance({ fs: mockFs });
		expect(guidance.show).toBe(false);
	});
});
