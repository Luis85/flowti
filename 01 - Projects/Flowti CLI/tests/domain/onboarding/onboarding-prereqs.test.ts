import { describe, it, expect, vi, beforeEach } from "vitest";
import path from "node:path";
import { createMockFs } from "../../mocks/mock-fs.js";
import { createMockShell } from "../../mocks/mock-shell.js";
import type { IPaths } from "../../../src/infrastructure/types.js";

vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
	PLUGIN_ROOT: "/plugin",
	cliConfig: { onboarding: { pluginId: "flowti-ibde", nodeMinVersion: 16 } },
}));

import {
	checkPrerequisites,
	checkPrerequisiteIssues,
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

describe("checkPrerequisites", () => {
	it("passes when git and node are available", () => {
		const proc = { exit: vi.fn(), argv: () => [] as string[], cwd: () => "/", env: () => ({} as Record<string, string | undefined>) } as unknown as import("../../../src/infrastructure/types.js").IProcess;
		const shell = createMockShell({
			outputs: { "node --version": "v20.0.0" },
		});
		checkPrerequisites(16, { shell, proc });
		expect(proc.exit).not.toHaveBeenCalled();
	});

	it("exits when git is missing", () => {
		const proc = { exit: vi.fn(), argv: () => [] as string[], cwd: () => "/", env: () => ({} as Record<string, string | undefined>) } as unknown as import("../../../src/infrastructure/types.js").IProcess;
		const shell = createMockShell({
			failChecks: ["git --version"],
			outputs: { "node --version": "v20.0.0" },
		});
		checkPrerequisites(16, { shell, proc });
		expect(proc.exit).toHaveBeenCalledWith(2);
	});

	it("exits when node is missing", () => {
		const proc = { exit: vi.fn(), argv: () => [] as string[], cwd: () => "/", env: () => ({} as Record<string, string | undefined>) } as unknown as import("../../../src/infrastructure/types.js").IProcess;
		const shell = createMockShell({ failChecks: [] });
		checkPrerequisites(16, { shell, proc });
		expect(proc.exit).toHaveBeenCalledWith(2);
	});

	it("exits when node version is too old", () => {
		const proc = { exit: vi.fn(), argv: () => [] as string[], cwd: () => "/", env: () => ({} as Record<string, string | undefined>) } as unknown as import("../../../src/infrastructure/types.js").IProcess;
		const shell = createMockShell({
			outputs: { "node --version": "v14.0.0" },
		});
		checkPrerequisites(16, { shell, proc });
		expect(proc.exit).toHaveBeenCalledWith(2);
	});
});

describe("checkPrerequisiteIssues", () => {
	it("returns empty when git and node are available", () => {
		const shell = createMockShell({
			outputs: { "node --version": "v20.0.0" },
		});
		const issues = checkPrerequisiteIssues(16, { shell });
		expect(issues).toEqual([]);
	});

	it("reports Git when git is missing", () => {
		const shell = createMockShell({
			failChecks: ["git --version"],
			outputs: { "node --version": "v20.0.0" },
		});
		const issues = checkPrerequisiteIssues(16, { shell });
		expect(issues.some(i => i.name.includes("Git"))).toBe(true);
	});

	it("reports Node.js when node is missing", () => {
		const shell = createMockShell({ failChecks: [] });
		const issues = checkPrerequisiteIssues(16, { shell });
		expect(issues.some(i => i.name.includes("Node.js"))).toBe(true);
	});

	it("reports version mismatch when node is too old", () => {
		const shell = createMockShell({
			outputs: { "node --version": "v14.0.0" },
		});
		const issues = checkPrerequisiteIssues(16, { shell });
		expect(issues.some(i => i.name.includes("v14.0.0"))).toBe(true);
	});
});

describe("ensureDependencies", () => {
	it("skips when node_modules exists", () => {
		const disk = createMockFs({ "/plugin/node_modules/placeholder": "" });
		const shell = createMockShell();
		const proc = { exit: vi.fn(), argv: () => [] as string[], cwd: () => "/", env: () => ({} as Record<string, string | undefined>) } as unknown as import("../../../src/infrastructure/types.js").IProcess;
		ensureDependencies("/plugin", { disk, shell, paths: mockPaths, proc });
		expect(shell.calls).toHaveLength(0);
	});

	it("runs npm install when node_modules is missing", () => {
		const disk = createMockFs();
		const shell = createMockShell();
		const proc = { exit: vi.fn(), argv: () => [] as string[], cwd: () => "/", env: () => ({} as Record<string, string | undefined>) } as unknown as import("../../../src/infrastructure/types.js").IProcess;
		ensureDependencies("/plugin", { disk, shell, paths: mockPaths, proc });
		expect(shell.calls).toHaveLength(1);
		expect(shell.calls[0].cmd).toBe("npm install");
		expect(shell.calls[0].opts?.cwd).toBe("/plugin");
		expect(proc.exit).not.toHaveBeenCalled();
	});

	it("exits on npm install failure", () => {
		const disk = createMockFs();
		const shell = createMockShell({ exitCodes: { "npm install": 1 } });
		const proc = { exit: vi.fn(), argv: () => [] as string[], cwd: () => "/", env: () => ({} as Record<string, string | undefined>) } as unknown as import("../../../src/infrastructure/types.js").IProcess;
		ensureDependencies("/plugin", { disk, shell, paths: mockPaths, proc });
		expect(proc.exit).toHaveBeenCalledWith(1);
	});
});

describe("getFirstRunStatus", () => {
	it("returns pluginBuilt=false when plugin is not built", () => {
		const disk = createMockFs();
		const status = getFirstRunStatus("/vault", "flowti-ibde", { disk, paths: mockPaths });
		expect(status.pluginBuilt).toBe(false);
	});

	it("returns pluginBuilt=true when plugin is already built", () => {
		const disk = createMockFs({
			"/vault/.obsidian/plugins/flowti-ibde/main.js": "content",
		});
		const status = getFirstRunStatus("/vault", "flowti-ibde", { disk, paths: mockPaths });
		expect(status.pluginBuilt).toBe(true);
	});
});

describe("getPostBuildGuidance", () => {
	it("returns show=true when plugin is built", () => {
		const disk = createMockFs({
			"/vault/.obsidian/plugins/flowti-ibde/main.js": "content",
		});
		const guidance = getPostBuildGuidance("/vault", "flowti-ibde", { disk, paths: mockPaths });
		expect(guidance.show).toBe(true);
		expect(guidance.vaultRoot).toBe("/vault");
	});

	it("returns show=false when plugin is not built", () => {
		const disk = createMockFs();
		const guidance = getPostBuildGuidance("/vault", "flowti-ibde", { disk, paths: mockPaths });
		expect(guidance.show).toBe(false);
	});
});
