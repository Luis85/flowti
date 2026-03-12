import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readFileSync: vi.fn(() => "{}"),
		writeFileSync: vi.fn(),
		rmSync: vi.fn(),
	},
}));

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		join: (...args: string[]) => args.join("/"),
	},
}));

// Inline shell mock: per-test vi.mocked(shell.runSilent) overrides require vi.fn().
// Default returns "ok" to simulate successful Obsidian CLI calls.
// See tests/mocks/mock-presets.ts for the standard mockShellPreset() factory.
vi.mock("../../../src/infrastructure/shell.js", () => ({
	shell: {
		runSilent: vi.fn(() => "ok"),
	},
}));

vi.mock("../../../src/infrastructure/input.js", () => ({
	input: {
		askYesNo: vi.fn(async () => true),
	},
}));

vi.mock("../../../src/infrastructure/pipeline/pipeline-runner.js", () => ({
	runPipeline: vi.fn(async () => ({ steps: [], totalDurationMs: 0, passed: 1, failed: 0, skipped: 0 })),
}));

vi.mock("../../../src/domain/e2e/e2e-prerequisites.js", () => ({
	collapseFileExplorer: vi.fn(),
}));

vi.mock("../../../src/domain/e2e/pipelines/rebuild-pipeline.js", () => ({
	buildRebuildPipeline: vi.fn(() => []),
}));

import { disk } from "../../../src/infrastructure/filesystem.js";
import { paths } from "../../../src/infrastructure/paths.js";
import { shell } from "../../../src/infrastructure/shell.js";
import { input } from "../../../src/infrastructure/input.js";
import { runPipeline } from "../../../src/infrastructure/pipeline/pipeline-runner.js";
import { collapseFileExplorer } from "../../../src/domain/e2e/e2e-prerequisites.js";
import { performTeardown, teardownVault, runRebuild } from "../../../src/domain/e2e/e2e-teardown.js";
import type { E2EPaths } from "../../../src/domain/e2e/e2e-paths.js";

const mockLog = vi.fn();
const mockProc = { exit: vi.fn(), env: () => ({}), argv: () => [] } as any;
const deps = { disk, paths, shell, input, log: mockLog, proc: mockProc } as any;

const e2e: E2EPaths = {
	projectRoot: "/project",
	testVault: "/vault",
	vaultName: "test-vault",
	pluginId: "flowti-ibde",
	pluginDir: "/vault/.obsidian/plugins/flowti-ibde",
	dataJsonPath: "/vault/.obsidian/plugins/flowti-ibde/data.json",
	reportsDir: "/project/docs/reports",
} as E2EPaths;

describe("performTeardown", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.mocked(shell.runSilent).mockReturnValue("ok");
		vi.mocked(disk.existsSync).mockReturnValue(false);
	});

	it("deletes vault content via obsidian CLI", async () => {
		const log = vi.fn();
		await performTeardown(e2e, { ...deps, log });
		expect(shell.runSilent).toHaveBeenCalledWith(expect.stringContaining("app.vault.delete"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Vault content deleted"));
	});

	it("purges ghost file entries", async () => {
		const log = vi.fn();
		await performTeardown(e2e, { ...deps, log });
		expect(shell.runSilent).toHaveBeenCalledWith(expect.stringContaining("ghosts"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Ghost entries purged"));
	});

	it("resets data.json installer state", async () => {
		vi.mocked(disk.existsSync).mockReturnValue(true);
		vi.mocked(disk.readFileSync).mockReturnValue(JSON.stringify({ installer: { installed: true } }));
		const log = vi.fn();
		await performTeardown(e2e, { ...deps, log });
		expect(disk.writeFileSync).toHaveBeenCalledWith(
			e2e.dataJsonPath,
			expect.stringContaining('"installed":false'),
			"utf-8",
		);
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Installer state reset"));
	});

	it("logs when data.json is not found", async () => {
		vi.mocked(disk.existsSync).mockReturnValue(false);
		const log = vi.fn();
		await performTeardown(e2e, { ...deps, log });
		expect(log).toHaveBeenCalledWith(expect.stringContaining("data.json not found"));
	});

	it("handles data.json parse errors", async () => {
		vi.mocked(disk.existsSync).mockImplementation((p: string) =>
			p === e2e.dataJsonPath,
		);
		vi.mocked(disk.readFileSync).mockReturnValue("not json");
		const log = vi.fn();
		await performTeardown(e2e, { ...deps, log });
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Failed to reset"));
	});

	it("deactivates the plugin", async () => {
		const log = vi.fn();
		await performTeardown(e2e, { ...deps, log });
		expect(shell.runSilent).toHaveBeenCalledWith(expect.stringContaining("disablePlugin"));
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Plugin deactivated"));
	});

	it("logs skip when plugin deactivation fails", async () => {
		vi.mocked(shell.runSilent).mockImplementation((cmd: string) => {
			if (cmd.includes("disablePlugin")) return null;
			return "ok";
		});
		const log = vi.fn();
		await performTeardown(e2e, { ...deps, log });
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Plugin deactivation skipped"));
	});

	it("clears workspace.json when it exists", async () => {
		vi.mocked(disk.existsSync).mockImplementation((p: string) =>
			typeof p === "string" && p.includes("workspace.json"),
		);
		const log = vi.fn();
		await performTeardown(e2e, { ...deps, log });
		expect(disk.rmSync).toHaveBeenCalled();
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Workspace layout cleared"));
	});

	it("collapses file explorer", async () => {
		await performTeardown(e2e, deps);
		expect(collapseFileExplorer).toHaveBeenCalledWith(e2e, expect.objectContaining({ shell, log: expect.any(Function) }));
	});

	it("logs fresh state at the end", async () => {
		const log = vi.fn();
		await performTeardown(e2e, { ...deps, log });
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Fresh state"));
	});

	it("handles vault delete failure", async () => {
		vi.mocked(shell.runSilent).mockImplementation((cmd: string) => {
			if (cmd.includes("app.vault.delete")) return null;
			return "ok";
		});
		const log = vi.fn();
		await performTeardown(e2e, { ...deps, log });
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Failed to delete"));
	});
});

describe("teardownVault", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("prompts for confirmation before teardown", async () => {
		vi.mocked(input.askYesNo).mockResolvedValue(true);
		vi.mocked(shell.runSilent).mockReturnValue("ok");
		await teardownVault(e2e, deps);
		expect(input.askYesNo).toHaveBeenCalledWith("Proceed?", true);
	});

	it("cancels when user says no", async () => {
		vi.mocked(input.askYesNo).mockResolvedValue(false);
		const log = vi.fn();
		await teardownVault(e2e, { ...deps, log });
		expect(log).toHaveBeenCalledWith(expect.stringContaining("cancelled"));
		// performTeardown should not have been called — no vault delete
		const shellCalls = vi.mocked(shell.runSilent).mock.calls.map((c) => c[0] as string);
		expect(shellCalls.some((c) => c.includes("app.vault.delete"))).toBe(false);
	});

	it("logs teardown description before prompting", async () => {
		vi.mocked(input.askYesNo).mockResolvedValue(false);
		const log = vi.fn();
		await teardownVault(e2e, { ...deps, log });
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Teardown will"));
	});
});

describe("runRebuild", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("prompts for confirmation", async () => {
		vi.mocked(input.askYesNo).mockResolvedValue(true);
		await runRebuild(e2e, deps);
		expect(input.askYesNo).toHaveBeenCalledWith(expect.stringContaining("teardown and rebuild"), true);
	});

	it("returns 0 when user cancels", async () => {
		vi.mocked(input.askYesNo).mockResolvedValue(false);
		const result = await runRebuild(e2e, deps);
		expect(result).toBe(0);
	});

	it("runs pipeline when user confirms", async () => {
		vi.mocked(input.askYesNo).mockResolvedValue(true);
		vi.mocked(runPipeline).mockResolvedValue({ steps: [], totalDurationMs: 0, passed: 1, failed: 0, skipped: 0 });
		const result = await runRebuild(e2e, deps);
		expect(runPipeline).toHaveBeenCalled();
		expect(result).toBe(0);
	});

	it("returns 1 when pipeline has failures", async () => {
		vi.mocked(input.askYesNo).mockResolvedValue(true);
		vi.mocked(runPipeline).mockResolvedValue({ steps: [], totalDurationMs: 0, passed: 0, failed: 1, skipped: 0 });
		const result = await runRebuild(e2e, deps);
		expect(result).toBe(1);
	});

	it("logs rebuild start message", async () => {
		vi.mocked(input.askYesNo).mockResolvedValue(true);
		const log = vi.fn();
		await runRebuild(e2e, { ...deps, log });
		expect(log).toHaveBeenCalledWith(expect.stringContaining("Rebuilding vault"));
	});
});
