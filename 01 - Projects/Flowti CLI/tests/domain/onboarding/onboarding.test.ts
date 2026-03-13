import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";
import { createMockFs } from "../../mocks/mock-fs.js";
import { createMockShell } from "../../mocks/mock-shell.js";
import type { IPaths } from "../../../src/infrastructure/types.js";

vi.mock("../../../src/infrastructure/config.js", () => ({
	PLUGIN_ROOT: "/mock/root",
	VAULT_ROOT: "/mock/vault",
	cliConfig: { onboarding: { nodeMinVersion: 16, pluginId: "flowti-ibde" } },
}));

import {
	checkPrerequisites,
	checkPrerequisiteIssues,
	installDependencies,
	ensureDependencies,
	getFirstRunStatus,
	getPostBuildGuidance,
} from "../../../src/domain/onboarding/onboarding.js";

const mockPaths: IPaths = {
	join: (...args: string[]) => path.join(...args).replace(/\\/g, "/"),
	resolve: (...args: string[]) => path.join(...args).replace(/\\/g, "/"),
	dirname: (p: string) => path.dirname(p).replace(/\\/g, "/"),
	basename: (p: string, ext?: string) => path.basename(p, ext),
	relative: (from: string, to: string) => path.relative(from, to),
	extname: (p: string) => path.extname(p),
	isAbsolute: (p: string) => path.isAbsolute(p),
	sep: "/",
};

beforeEach(() => vi.clearAllMocks());

describe("checkPrerequisiteIssues", () => {
	it("returns empty array when git and node are available", () => {
		const shell = createMockShell({
			outputs: { "node --version": "v22.0.0" },
		});
		const issues = checkPrerequisiteIssues(16, { shell });
		expect(issues).toHaveLength(0);
	});

	it("returns git issue when git is missing", () => {
		const shell = createMockShell({
			failChecks: ["git --version"],
			outputs: { "node --version": "v22.0.0" },
		});
		const issues = checkPrerequisiteIssues(16, { shell });
		expect(issues.some((i) => i.name === "Git")).toBe(true);
	});

	it("returns node issue when node is missing", () => {
		const shell = createMockShell({
			failChecks: [],
		});
		const issues = checkPrerequisiteIssues(16, { shell });
		expect(issues.some((i) => i.name === "Node.js")).toBe(true);
	});

	it("returns node issue when version is too old", () => {
		const shell = createMockShell({
			outputs: { "node --version": "v14.0.0" },
		});
		const issues = checkPrerequisiteIssues(16, { shell });
		expect(issues.some((i) => i.name.includes("v14.0.0"))).toBe(true);
	});

	it("returns empty when node version meets minimum", () => {
		const shell = createMockShell({
			outputs: { "node --version": "v16.0.0" },
		});
		const issues = checkPrerequisiteIssues(16, { shell });
		expect(issues).toHaveLength(0);
	});
});

describe("checkPrerequisites", () => {
	it("does not exit when all prerequisites met", () => {
		const proc = { exit: vi.fn() };
		const shell = createMockShell({
			outputs: { "node --version": "v22.0.0" },
		});
		checkPrerequisites(16, { shell, proc });
		expect(proc.exit).not.toHaveBeenCalled();
	});

	it("exits when git is missing", () => {
		const proc = { exit: vi.fn() };
		const shell = createMockShell({
			failChecks: ["git --version"],
			outputs: { "node --version": "v22.0.0" },
		});
		checkPrerequisites(16, { shell, proc });
		expect(proc.exit).toHaveBeenCalledWith(2);
	});
});

describe("installDependencies", () => {
	it("skips when node_modules exists", () => {
		const disk = createMockFs({ "/mock/root/node_modules/placeholder": "" });
		const shell = createMockShell();
		const proc = { exit: vi.fn() };
		const result = installDependencies("/mock/root", { disk, shell, paths: mockPaths, proc });
		expect(result.alreadyPresent).toBe(true);
		expect(result.installed).toBe(false);
	});

	it("installs when node_modules is missing", () => {
		const disk = createMockFs();
		const shell = createMockShell();
		const proc = { exit: vi.fn() };
		const result = installDependencies("/mock/root", { disk, shell, paths: mockPaths, proc });
		expect(result.installed).toBe(true);
		expect(result.alreadyPresent).toBe(false);
		expect(shell.calls).toHaveLength(1);
		expect(shell.calls[0].cmd).toBe("npm install");
	});

	it("exits on npm install failure", () => {
		const disk = createMockFs();
		const shell = createMockShell({ exitCodes: { "npm install": 1 } });
		const proc = { exit: vi.fn() };
		installDependencies("/mock/root", { disk, shell, paths: mockPaths, proc });
		expect(proc.exit).toHaveBeenCalledWith(1);
	});
});

describe("ensureDependencies", () => {
	it("skips when node_modules exists", () => {
		const disk = createMockFs({ "/mock/root/node_modules/placeholder": "" });
		const shell = createMockShell();
		const proc = { exit: vi.fn() };
		ensureDependencies("/mock/root", { disk, shell, paths: mockPaths, proc });
		expect(shell.calls).toHaveLength(0);
	});

	it("runs npm install when node_modules is missing", () => {
		const disk = createMockFs();
		const shell = createMockShell();
		const proc = { exit: vi.fn() };
		ensureDependencies("/mock/root", { disk, shell, paths: mockPaths, proc });
		expect(shell.calls).toHaveLength(1);
		expect(shell.calls[0].cmd).toBe("npm install");
	});

	it("exits on npm install failure", () => {
		const disk = createMockFs();
		const shell = createMockShell({ exitCodes: { "npm install": 1 } });
		const proc = { exit: vi.fn() };
		ensureDependencies("/mock/root", { disk, shell, paths: mockPaths, proc });
		expect(proc.exit).toHaveBeenCalledWith(1);
	});
});

describe("getFirstRunStatus", () => {
	it("returns pluginBuilt: false when plugin not built", () => {
		const disk = createMockFs();
		const status = getFirstRunStatus("/mock/vault", "flowti-ibde", { disk, paths: mockPaths });
		expect(status.pluginBuilt).toBe(false);
	});

	it("returns pluginBuilt: true when plugin is built", () => {
		const disk = createMockFs({
			"/mock/vault/.obsidian/plugins/flowti-ibde/main.js": "content",
		});
		const status = getFirstRunStatus("/mock/vault", "flowti-ibde", { disk, paths: mockPaths });
		expect(status.pluginBuilt).toBe(true);
	});
});

describe("getPostBuildGuidance", () => {
	it("returns show: true when plugin is built", () => {
		const disk = createMockFs({
			"/mock/vault/.obsidian/plugins/flowti-ibde/main.js": "content",
		});
		const guidance = getPostBuildGuidance("/mock/vault", "flowti-ibde", { disk, paths: mockPaths });
		expect(guidance.show).toBe(true);
	});

	it("returns show: false when plugin is not built", () => {
		const disk = createMockFs();
		const guidance = getPostBuildGuidance("/mock/vault", "flowti-ibde", { disk, paths: mockPaths });
		expect(guidance.show).toBe(false);
	});
});
