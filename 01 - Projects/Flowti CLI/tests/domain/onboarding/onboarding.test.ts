import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockFs } from "../../mocks/mock-fs.js";
import { createMockShell } from "../../mocks/mock-shell.js";

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/infrastructure/config.js", () => ({
	ROOT: "/mock/root",
	VAULT_ROOT: "/mock/vault",
	cliConfig: { onboarding: { nodeMinVersion: 16, pluginId: "flowti-ibde" } },
}));

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
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

const mockLog = log as ReturnType<typeof vi.fn>;

beforeEach(() => mockLog.mockClear());

describe("checkPrerequisites", () => {
	it("does nothing when git and node are available", () => {
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
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Git");
	});

	it("exits when node is missing", () => {
		const exit = vi.fn();
		const sh = createMockShell({
			failChecks: [],
			// node --version returns null (not found)
		});
		checkPrerequisites({ sh, exit });
		expect(exit).toHaveBeenCalledWith(2);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("Node.js");
	});

	it("exits when node version is too old", () => {
		const exit = vi.fn();
		const sh = createMockShell({
			outputs: { "node --version": "v14.0.0" },
		});
		checkPrerequisites({ sh, exit });
		expect(exit).toHaveBeenCalledWith(2);
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("v14.0.0");
	});

	it("passes when node version meets minimum", () => {
		const exit = vi.fn();
		const sh = createMockShell({
			outputs: { "node --version": "v16.0.0" },
		});
		checkPrerequisites({ sh, exit });
		expect(exit).not.toHaveBeenCalled();
	});
});

describe("ensureDependencies", () => {
	it("skips when node_modules exists", () => {
		const fs = createMockFs({ "/mock/root/node_modules/placeholder": "" });
		const sh = createMockShell();
		ensureDependencies({ fs, sh });
		expect(sh.calls).toHaveLength(0);
	});

	it("runs npm install when node_modules is missing", () => {
		const fs = createMockFs();
		const sh = createMockShell();
		const exit = vi.fn();
		ensureDependencies({ fs, sh, exit });
		expect(sh.calls).toHaveLength(1);
		expect(sh.calls[0].cmd).toBe("npm install");
	});

	it("exits on npm install failure", () => {
		const fs = createMockFs();
		const sh = createMockShell({ exitCodes: { "npm install": 1 } });
		const exit = vi.fn();
		ensureDependencies({ fs, sh, exit });
		expect(exit).toHaveBeenCalledWith(1);
	});
});

describe("checkFirstRun", () => {
	it("logs guidance when plugin is not built", () => {
		const fs = createMockFs();
		checkFirstRun({ fs });
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("not yet built");
	});

	it("stays silent when plugin is built", () => {
		const fs = createMockFs({
			"/mock/vault/.obsidian/plugins/flowti-ibde/main.js": "content",
		});
		checkFirstRun({ fs });
		expect(mockLog).not.toHaveBeenCalled();
	});
});

describe("showPostBuildGuidance", () => {
	it("shows guidance when plugin is built", () => {
		const fs = createMockFs({
			"/mock/vault/.obsidian/plugins/flowti-ibde/main.js": "content",
		});
		showPostBuildGuidance({ fs });
		const output = mockLog.mock.calls.flat().join(" ");
		expect(output).toContain("built successfully");
	});

	it("stays silent when plugin is not built", () => {
		const fs = createMockFs();
		showPostBuildGuidance({ fs });
		expect(mockLog).not.toHaveBeenCalled();
	});
});
