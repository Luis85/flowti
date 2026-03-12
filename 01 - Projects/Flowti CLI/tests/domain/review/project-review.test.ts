import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../../src/infrastructure/paths.js", () => ({
	paths: {
		resolve: (...args: string[]) => args.join("/"),
		join: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop(),
	},
}));

vi.mock("../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		readdirSync: vi.fn(() => []),
		readFileSync: vi.fn(() => "{}"),
		mkdirSync: vi.fn(),
		copyFileSync: vi.fn(),
	},
}));

vi.mock("../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
}));

vi.mock("../../../src/infrastructure/test-vault.js", () => ({
	resolveTestVaultRoot: (name: string, _vaultRoot: string) => `/vaults/${name}`,
	scaffoldTestVault: vi.fn(),
}));

vi.mock("../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", CYAN: "", YELLOW: "",
}));

vi.mock("../../../src/infrastructure/shell.js", async () => {
	const { mockShellPreset } = await import("../../mocks/mock-presets.js");
	return mockShellPreset();
});

vi.mock("../../../src/infrastructure/menu.js", () => ({
	runMenu: vi.fn(async (_title: string, items: Array<{ key: string; action?: () => unknown }>) => {
		// return "main" by default
		return "main" as const;
	}),
}));

vi.mock("../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn(async () => "N") },
}));

vi.mock("../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

vi.mock("../../../src/domain/make/makers.js", () => ({
	makeJourney: vi.fn(),
}));

import { reviewMenu } from "../../../src/ui/menus/review-menu.js";
import { disk } from "../../../src/infrastructure/filesystem.js";
import { shell } from "../../../src/infrastructure/shell.js";
import { runMenu } from "../../../src/infrastructure/menu.js";
import { input } from "../../../src/infrastructure/input.js";
import type { ReviewConfig } from "../../../src/infrastructure/types.js";

const mockDisk = vi.mocked(disk);
const mockShell = vi.mocked(shell);
const mockRunMenu = vi.mocked(runMenu);
const mockInput = vi.mocked(input);

beforeEach(() => {
	vi.clearAllMocks();
	mockDisk.existsSync.mockReturnValue(false);
	mockDisk.readdirSync.mockReturnValue([]);
});

describe("reviewMenu", () => {
	const projectPath = "/project";

	it("creates menu with build and test items", async () => {
		const config: ReviewConfig = {};
		await reviewMenu(projectPath, config);

		expect(mockRunMenu).toHaveBeenCalledOnce();
		const [title, items] = mockRunMenu.mock.calls[0];
		expect(title).toBe("Review");
		const keys = (items as Array<{ key?: string }>).filter((i) => "key" in i).map((i) => i.key);
		expect(keys).toContain("1"); // build
		expect(keys).toContain("2"); // test
		expect(keys).toContain("v"); // ensure vault
		expect(keys).toContain("o"); // open vault
		expect(keys).toContain("b"); // back
		expect(keys).toContain("q"); // quit
	});

	it("uses custom build/test commands from config", async () => {
		const config: ReviewConfig = { build: "make build", test: "make test" };
		mockRunMenu.mockImplementation(async (_title, items) => {
			const buildItem = (items as Array<{ key: string; action: () => void }>).find((i) => i.key === "1");
			buildItem?.action();
			const testItem = (items as Array<{ key: string; action: () => void }>).find((i) => i.key === "2");
			testItem?.action();
			return "main";
		});

		await reviewMenu(projectPath, config);

		expect(mockShell.run).toHaveBeenCalledWith("make build", expect.objectContaining({ cwd: projectPath }));
		expect(mockShell.run).toHaveBeenCalledWith("make test", expect.objectContaining({ cwd: projectPath }));
	});

	it("scans journey files from configured directory", async () => {
		const config: ReviewConfig = { journeysDir: "e2e/journeys" };
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["login.journey.json", "setup.journey", "readme.md"] as unknown as ReturnType<typeof disk.readdirSync>);
		mockDisk.readFileSync.mockReturnValue('{ "journey": "Login Flow", "description": "Tests login" }');

		await reviewMenu(projectPath, config);

		const [, items] = mockRunMenu.mock.calls[0];
		const keys = (items as Array<{ key?: string }>).filter((i) => "key" in i).map((i) => i.key);
		expect(keys).toContain("l"); // list journeys when journeys exist
	});

	it("adds E2E item when no runner configured and journeys exist", async () => {
		const config: ReviewConfig = {};
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["test.journey.json"] as unknown as ReturnType<typeof disk.readdirSync>);
		mockDisk.readFileSync.mockReturnValue("{}");

		await reviewMenu(projectPath, config);

		const [, items] = mockRunMenu.mock.calls[0];
		const e2eItem = (items as Array<{ key: string; disabled?: () => boolean; disabledMessage?: string }>).find((i) => i.key === "3");
		expect(e2eItem).toBeDefined();
		expect(e2eItem!.disabledMessage).toBeDefined();
	});

	it("adds runner-specific items when runner configured", async () => {
		const config: ReviewConfig = { runner: "npm run e2e" };
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["test.journey.json"] as unknown as ReturnType<typeof disk.readdirSync>);
		mockDisk.readFileSync.mockReturnValue("{}");

		await reviewMenu(projectPath, config);

		const [, items] = mockRunMenu.mock.calls[0];
		const keys = (items as Array<{ key?: string }>).filter((i) => "key" in i).map((i) => i.key);
		expect(keys).toContain("3"); // run all journeys
		expect(keys).toContain("j"); // run specific journey
	});

	it("adds teardown item when config.teardown set", async () => {
		const config: ReviewConfig = { teardown: "npm run teardown" };

		await reviewMenu(projectPath, config);

		const [, items] = mockRunMenu.mock.calls[0];
		const keys = (items as Array<{ key?: string }>).filter((i) => "key" in i).map((i) => i.key);
		expect(keys).toContain("t");
	});

	it("adds rebuild item when config.rebuild set", async () => {
		const config: ReviewConfig = { rebuild: "npm run rebuild" };

		await reviewMenu(projectPath, config);

		const [, items] = mockRunMenu.mock.calls[0];
		const keys = (items as Array<{ key?: string }>).filter((i) => "key" in i).map((i) => i.key);
		expect(keys).toContain("x");
	});

	it("teardown requires confirmation", async () => {
		const config: ReviewConfig = { teardown: "npm run teardown" };
		mockInput.ask.mockResolvedValue("y");
		mockRunMenu.mockImplementation(async (_title, items) => {
			const teardownItem = (items as Array<{ key: string; action: () => Promise<void> }>).find((i) => i.key === "t");
			await teardownItem?.action();
			return "main";
		});

		await reviewMenu(projectPath, config);

		expect(mockInput.ask).toHaveBeenCalled();
		expect(mockShell.run).toHaveBeenCalledWith("npm run teardown", expect.objectContaining({ cwd: projectPath }));
	});

	it("teardown is skipped when not confirmed", async () => {
		const config: ReviewConfig = { teardown: "npm run teardown" };
		mockInput.ask.mockResolvedValue("N");
		mockRunMenu.mockImplementation(async (_title, items) => {
			const teardownItem = (items as Array<{ key: string; action: () => Promise<void> }>).find((i) => i.key === "t");
			await teardownItem?.action();
			return "main";
		});

		await reviewMenu(projectPath, config);

		expect(mockShell.run).not.toHaveBeenCalledWith("npm run teardown", expect.anything());
	});

	it("resolves test vault from config.testVault", async () => {
		const config: ReviewConfig = { testVault: "custom-e2e" };

		mockRunMenu.mockImplementation(async (_title, _items, opts) => {
			(opts as { beforeMenu?: () => void })?.beforeMenu?.();
			return "main";
		});

		await reviewMenu(projectPath, config);

		// beforeMenu logs vault info — ensure no crash
		expect(mockRunMenu).toHaveBeenCalledOnce();
	});

	it("resolves test vault from project name when not configured", async () => {
		const config: ReviewConfig = {};

		mockRunMenu.mockImplementation(async (_title, _items, opts) => {
			(opts as { beforeMenu?: () => void })?.beforeMenu?.();
			return "main";
		});

		await reviewMenu(projectPath, config);

		expect(mockRunMenu).toHaveBeenCalledOnce();
	});

	it("ensure vault action copies binary and scaffolds test vault when missing", async () => {
		const config: ReviewConfig = {};
		// Binary exists at source, but test vault does not
		mockDisk.existsSync.mockImplementation((p: string) => {
			if (typeof p === "string" && p.includes("main.js")) return true; // binary exists
			return false; // vault does not exist
		});
		mockRunMenu.mockImplementation(async (_title, items) => {
			const vaultItem = (items as Array<{ key: string; action: () => void }>).find((i) => i.key === "v");
			vaultItem?.action();
			return "main";
		});

		await reviewMenu(projectPath, config);

		// Should NOT run npm run build — just copy existing binary
		expect(mockShell.run).not.toHaveBeenCalled();
		// Should scaffold the vault
		const { scaffoldTestVault } = await import("../../../src/infrastructure/test-vault.js");
		expect(vi.mocked(scaffoldTestVault)).toHaveBeenCalled();
	});

	it("ensure vault action copies binary and refreshes bin when vault exists", async () => {
		const config: ReviewConfig = {};
		mockDisk.existsSync.mockReturnValue(true); // both binary and vault exist
		mockRunMenu.mockImplementation(async (_title, items) => {
			const vaultItem = (items as Array<{ key: string; action: () => void }>).find((i) => i.key === "v");
			vaultItem?.action();
			return "main";
		});

		await reviewMenu(projectPath, config);

		// Should NOT run npm run build
		expect(mockShell.run).not.toHaveBeenCalled();
		// Should NOT scaffold (vault already exists)
		const { scaffoldTestVault } = await import("../../../src/infrastructure/test-vault.js");
		expect(vi.mocked(scaffoldTestVault)).not.toHaveBeenCalled();
		// Should copy bin files
		expect(mockDisk.copyFileSync).toHaveBeenCalled();
	});

	it("ensure vault action aborts when no binary found", async () => {
		const config: ReviewConfig = {};
		mockDisk.existsSync.mockReturnValue(false); // no binary, no vault
		mockRunMenu.mockImplementation(async (_title, items) => {
			const vaultItem = (items as Array<{ key: string; action: () => void }>).find((i) => i.key === "v");
			vaultItem?.action();
			return "main";
		});

		await reviewMenu(projectPath, config);

		const { scaffoldTestVault } = await import("../../../src/infrastructure/test-vault.js");
		expect(vi.mocked(scaffoldTestVault)).not.toHaveBeenCalled();
	});

	it("test is disabled until build passes", async () => {
		const config: ReviewConfig = {};

		let testDisabledBeforeBuild = false;
		let testDisabledAfterBuild = false;
		mockRunMenu.mockImplementation(async (_title, items) => {
			const testItem = (items as Array<{ key: string; disabled?: () => boolean }>).find((i) => i.key === "2");
			testDisabledBeforeBuild = testItem?.disabled?.() ?? false;

			// Build succeeds
			mockShell.run.mockReturnValue(0);
			const buildItem = (items as Array<{ key: string; action: () => void }>).find((i) => i.key === "1");
			buildItem?.action();

			testDisabledAfterBuild = testItem?.disabled?.() ?? false;
			return "main";
		});

		await reviewMenu(projectPath, config);

		expect(testDisabledBeforeBuild).toBe(true);
		expect(testDisabledAfterBuild).toBe(false);
	});

	it("E2E is disabled until build and test pass", async () => {
		const config: ReviewConfig = {};
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["test.journey"] as unknown as ReturnType<typeof disk.readdirSync>);
		mockDisk.readFileSync.mockReturnValue("{}");

		let e2eDisabledBeforeBuild = false;
		let e2eDisabledAfterBuildOnly = false;
		let e2eDisabledAfterBuildAndTest = false;
		mockRunMenu.mockImplementation(async (_title, items) => {
			const e2eItem = (items as Array<{ key: string; disabled?: () => boolean }>).find((i) => i.key === "3");
			e2eDisabledBeforeBuild = e2eItem?.disabled?.() ?? false;

			// Build succeeds
			mockShell.run.mockReturnValue(0);
			const buildItem = (items as Array<{ key: string; action: () => void }>).find((i) => i.key === "1");
			buildItem?.action();
			e2eDisabledAfterBuildOnly = e2eItem?.disabled?.() ?? false;

			// Test succeeds
			const testItem = (items as Array<{ key: string; action: () => void }>).find((i) => i.key === "2");
			testItem?.action();
			e2eDisabledAfterBuildAndTest = e2eItem?.disabled?.() ?? false;

			return "main";
		});

		await reviewMenu(projectPath, config);

		expect(e2eDisabledBeforeBuild).toBe(true);
		expect(e2eDisabledAfterBuildOnly).toBe(true);
		expect(e2eDisabledAfterBuildAndTest).toBe(false);
	});

	it("failed build resets testPassed", async () => {
		const config: ReviewConfig = {};
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["test.journey"] as unknown as ReturnType<typeof disk.readdirSync>);
		mockDisk.readFileSync.mockReturnValue("{}");

		let e2eDisabledAfterFailedBuild = false;
		mockRunMenu.mockImplementation(async (_title, items) => {
			const buildItem = (items as Array<{ key: string; action: () => void }>).find((i) => i.key === "1");
			const testItem = (items as Array<{ key: string; action: () => void }>).find((i) => i.key === "2");
			const e2eItem = (items as Array<{ key: string; disabled?: () => boolean }>).find((i) => i.key === "3");

			// Build succeeds, test succeeds
			mockShell.run.mockReturnValue(0);
			buildItem?.action();
			testItem?.action();

			// Build fails — should reset testPassed
			mockShell.run.mockReturnValue(1);
			buildItem?.action();
			e2eDisabledAfterFailedBuild = e2eItem?.disabled?.() ?? false;

			return "main";
		});

		await reviewMenu(projectPath, config);

		expect(e2eDisabledAfterFailedBuild).toBe(true);
	});

	it("includes 'Run all' item when journeys exist", async () => {
		const config: ReviewConfig = {};
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["test.journey"] as unknown as ReturnType<typeof disk.readdirSync>);
		mockDisk.readFileSync.mockReturnValue("{}");

		await reviewMenu(projectPath, config);

		const [, items] = mockRunMenu.mock.calls[0];
		const keys = (items as Array<{ key?: string }>).filter((i) => "key" in i).map((i) => i.key);
		expect(keys).toContain("a");
	});

	it("'Run all' stops on build failure", async () => {
		const config: ReviewConfig = { build: "make build", test: "make test" };
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["test.journey"] as unknown as ReturnType<typeof disk.readdirSync>);
		mockDisk.readFileSync.mockReturnValue("{}");
		mockShell.run.mockReturnValue(1);

		mockRunMenu.mockImplementation(async (_title, items) => {
			const runAllItem = (items as Array<{ key: string; action: () => void }>).find((i) => i.key === "a");
			runAllItem?.action();
			return "main";
		});

		await reviewMenu(projectPath, config);

		expect(mockShell.run).toHaveBeenCalledTimes(1); // only build, no test or E2E
		expect(mockShell.run).toHaveBeenCalledWith("make build", expect.objectContaining({ label: "Step 1/3: Build" }));
	});

	it("'Run all' stops on test failure", async () => {
		const config: ReviewConfig = { build: "make build", test: "make test" };
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["test.journey"] as unknown as ReturnType<typeof disk.readdirSync>);
		mockDisk.readFileSync.mockReturnValue("{}");
		mockShell.run
			.mockReturnValueOnce(0)  // build passes
			.mockReturnValueOnce(1); // test fails

		mockRunMenu.mockImplementation(async (_title, items) => {
			const runAllItem = (items as Array<{ key: string; action: () => void }>).find((i) => i.key === "a");
			runAllItem?.action();
			return "main";
		});

		await reviewMenu(projectPath, config);

		expect(mockShell.run).toHaveBeenCalledTimes(2); // build + test, no E2E
	});

	it("'Run all' runs all three stages on success", async () => {
		const config: ReviewConfig = { build: "make build", test: "make test", runner: "npm run e2e" };
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["test.journey"] as unknown as ReturnType<typeof disk.readdirSync>);
		mockDisk.readFileSync.mockReturnValue("{}");
		mockShell.run.mockReturnValue(0);

		mockRunMenu.mockImplementation(async (_title, items) => {
			const runAllItem = (items as Array<{ key: string; action: () => void }>).find((i) => i.key === "a");
			runAllItem?.action();
			return "main";
		});

		await reviewMenu(projectPath, config);

		// build + test + E2E = 3 calls (ensureTestVault just copies binary, no shell call)
		expect(mockShell.run).toHaveBeenCalledTimes(3);
		expect(mockShell.run).toHaveBeenCalledWith("make build", expect.objectContaining({ label: "Step 1/3: Build" }));
		expect(mockShell.run).toHaveBeenCalledWith("make test", expect.objectContaining({ label: "Step 2/3: Test" }));
		expect(mockShell.run).toHaveBeenCalledWith("npm run e2e", expect.objectContaining({ label: "E2E tests" }));
	});

	it("pipeline display shows three stages", async () => {
		const config: ReviewConfig = {};
		const logMessages: string[] = [];
		const { log: mockLog } = await import("../../../src/infrastructure/logger.js");
		vi.mocked(mockLog).mockImplementation((...args: unknown[]) => {
			if (args.length > 0) logMessages.push(String(args[0]));
		});

		mockRunMenu.mockImplementation(async (_title, _items, opts) => {
			(opts as { beforeMenu?: () => void })?.beforeMenu?.();
			return "main";
		});

		await reviewMenu(projectPath, config);

		const pipelineLine = logMessages.find((m) => m.includes("Pipeline:"));
		expect(pipelineLine).toBeDefined();
		expect(pipelineLine).toContain("Build");
		expect(pipelineLine).toContain("Test");
		expect(pipelineLine).toContain("E2E");
	});

	it("E2E gated behind test when runner configured", async () => {
		const config: ReviewConfig = { runner: "npm run e2e" };
		mockDisk.existsSync.mockReturnValue(true);
		mockDisk.readdirSync.mockReturnValue(["test.journey"] as unknown as ReturnType<typeof disk.readdirSync>);
		mockDisk.readFileSync.mockReturnValue("{}");

		let runAllDisabled = false;
		let journeyDisabled = false;
		mockRunMenu.mockImplementation(async (_title, items) => {
			const runAllItem = (items as Array<{ key: string; disabled?: () => boolean }>).find((i) => i.key === "3");
			const journeyItem = (items as Array<{ key: string; disabled?: () => boolean }>).find((i) => i.key === "j");
			runAllDisabled = runAllItem?.disabled?.() ?? false;
			journeyDisabled = journeyItem?.disabled?.() ?? false;
			return "main";
		});

		await reviewMenu(projectPath, config);

		expect(runAllDisabled).toBe(true);
		expect(journeyDisabled).toBe(true);
	});
});
