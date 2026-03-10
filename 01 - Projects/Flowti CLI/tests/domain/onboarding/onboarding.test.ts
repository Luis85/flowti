import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";
import { createMockShell } from "../../mocks/mock-shell.js";

vi.mock("../../../src/infrastructure/config.js", () => ({
	PLUGIN_ROOT: "/mock/root",
	VAULT_ROOT: "/mock/vault",
	cliConfig: { onboarding: { nodeMinVersion: 16, pluginId: "flowti-ibde" } },
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
	installDependencies,
	ensureDependencies,
	getFirstRunStatus,
	getPostBuildGuidance,
} from "../../../src/domain/onboarding/onboarding.js";

beforeEach(() => vi.clearAllMocks());

describe("checkPrerequisiteIssues", () => {
	it("returns empty array when git and node are available", () => {
		const sh = createMockShell({
			outputs: { "node --version": "v22.0.0" },
		});
		const issues = checkPrerequisiteIssues({ sh });
		expect(issues).toHaveLength(0);
	});

	it("returns git issue when git is missing", () => {
		const sh = createMockShell({
			failChecks: ["git --version"],
			outputs: { "node --version": "v22.0.0" },
		});
		const issues = checkPrerequisiteIssues({ sh });
		expect(issues.some((i) => i.name === "Git")).toBe(true);
	});

	it("returns node issue when node is missing", () => {
		const sh = createMockShell({
			failChecks: [],
		});
		const issues = checkPrerequisiteIssues({ sh });
		expect(issues.some((i) => i.name === "Node.js")).toBe(true);
	});

	it("returns node issue when version is too old", () => {
		const sh = createMockShell({
			outputs: { "node --version": "v14.0.0" },
		});
		const issues = checkPrerequisiteIssues({ sh });
		expect(issues.some((i) => i.name.includes("v14.0.0"))).toBe(true);
	});

	it("returns empty when node version meets minimum", () => {
		const sh = createMockShell({
			outputs: { "node --version": "v16.0.0" },
		});
		const issues = checkPrerequisiteIssues({ sh });
		expect(issues).toHaveLength(0);
	});
});

describe("checkPrerequisites", () => {
	it("does not exit when all prerequisites met", () => {
		const exit = vi.fn();
		const sh = createMockShell({
			outputs: { "node --version": "v22.0.0" },
		});
		checkPrerequisites({ sh, exit });
		expect(exit).not.toHaveBeenCalled();
	});

	it("exits when git is missing", () => {
		const exit = vi.fn();
		const sh = createMockShell({
			failChecks: ["git --version"],
			outputs: { "node --version": "v22.0.0" },
		});
		checkPrerequisites({ sh, exit });
		expect(exit).toHaveBeenCalledWith(2);
	});
});

describe("installDependencies", () => {
	it("skips when node_modules exists", () => {
		const fs = createMockFs({ "/mock/root/node_modules/placeholder": "" });
		const sh = createMockShell();
		const result = installDependencies("/mock/root", { fs, sh });
		expect(result.alreadyPresent).toBe(true);
		expect(result.installed).toBe(false);
	});

	it("installs when node_modules is missing", () => {
		const fs = createMockFs();
		const sh = createMockShell();
		const exit = vi.fn();
		const result = installDependencies("/mock/root", { fs, sh, exit });
		expect(result.installed).toBe(true);
		expect(result.alreadyPresent).toBe(false);
		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toBe("npm install");
	});

	it("exits on npm install failure", () => {
		const fs = createMockFs();
		const sh = createMockShell({ exitCodes: { "npm install": 1 } });
		const exit = vi.fn();
		installDependencies("/mock/root", { fs, sh, exit });
		expect(exit).toHaveBeenCalledWith(1);
	});
});

describe("ensureDependencies", () => {
	it("skips when node_modules exists", () => {
		const fs = createMockFs({ "/mock/root/node_modules/placeholder": "" });
		const sh = createMockShell();
		ensureDependencies("/mock/root", { fs, sh });
		expect(sh.calls).toHaveLength(0);
	});

	it("runs npm install when node_modules is missing", () => {
		const fs = createMockFs();
		const sh = createMockShell();
		const exit = vi.fn();
		ensureDependencies("/mock/root", { fs, sh, exit });
		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toBe("npm install");
		expect(sh.calls[0].opts?.cwd).toBe("/mock/root");
	});

	it("exits on npm install failure", () => {
		const fs = createMockFs();
		const sh = createMockShell({ exitCodes: { "npm install": 1 } });
		const exit = vi.fn();
		ensureDependencies("/mock/root", { fs, sh, exit });
		expect(exit).toHaveBeenCalledWith(1);
	});
});

describe("getFirstRunStatus", () => {
	it("returns pluginBuilt: false when plugin not built", () => {
		const fs = createMockFs();
		const status = getFirstRunStatus({ fs });
		expect(status.pluginBuilt).toBe(false);
	});

	it("returns pluginBuilt: true when plugin is built", () => {
		const fs = createMockFs({
			"/mock/vault/.obsidian/plugins/flowti-ibde/main.js": "content",
		});
		const status = getFirstRunStatus({ fs });
		expect(status.pluginBuilt).toBe(true);
	});
});

describe("getPostBuildGuidance", () => {
	it("returns show: true when plugin is built", () => {
		const fs = createMockFs({
			"/mock/vault/.obsidian/plugins/flowti-ibde/main.js": "content",
		});
		const guidance = getPostBuildGuidance({ fs });
		expect(guidance.show).toBe(true);
	});

	it("returns show: false when plugin is not built", () => {
		const fs = createMockFs();
		const guidance = getPostBuildGuidance({ fs });
		expect(guidance.show).toBe(false);
	});
});
