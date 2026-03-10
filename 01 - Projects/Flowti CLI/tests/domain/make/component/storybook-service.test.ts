import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BackgroundProcess } from "../../../../src/infrastructure/types.js";

function createMockBackgroundProcess(overrides?: Partial<BackgroundProcess>): BackgroundProcess {
	return {
		running: true,
		output: [],
		kill: vi.fn(),
		onOutput: vi.fn(() => vi.fn()),
		waitForOutput: vi.fn().mockResolvedValue("Storybook ready!"),
		...overrides,
	};
}

vi.mock("../../../../src/infrastructure/filesystem.js", () => ({
	disk: {
		existsSync: vi.fn(() => false),
		mkdirSync: vi.fn(),
		writeFileSync: vi.fn(),
	},
}));

vi.mock("../../../../src/infrastructure/paths.js", () => ({
	paths: {
		resolve: (...args: string[]) => args.join("/"),
		join: (...args: string[]) => args.join("/"),
		basename: (p: string) => p.split("/").pop(),
		dirname: (p: string) => p.split("/").slice(0, -1).join("/"),
		sep: "/",
	},
}));

vi.mock("../../../../src/infrastructure/shell.js", () => ({
	shell: {
		run: vi.fn(() => 0),
		runSilent: vi.fn(),
		spawnBackground: vi.fn(),
	},
}));

vi.mock("../../../../src/infrastructure/ui.js", () => ({
	RESET: "", BOLD: "", DIM: "", GREEN: "", RED: "", YELLOW: "", CYAN: "",
	printHeader: vi.fn(),
}));

vi.mock("../../../../src/infrastructure/input.js", () => ({
	input: { ask: vi.fn().mockResolvedValue("q"), waitForEnter: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock("../../../../src/infrastructure/config.js", () => ({
	VAULT_ROOT: "/vault",
}));

vi.mock("../../../../src/domain/knowledgebase/vault-service.js", () => ({
	isCliAvailable: vi.fn(() => false),
	isVaultInitialized: vi.fn(() => false),
}));

vi.mock("../../../../src/infrastructure/logger.js", () => ({
	log: vi.fn(),
}));

import {
	resolveStorybookDir,
	isStorybookInstalled,
	installStorybook,
	runStorybookDev,
	runStorybookBuild,
	isStorybookRunning,
	stopStorybook,
	isInsideVault,
	extractLocalUrl,
} from "../../../../src/domain/make/component/storybook-service.js";
import { disk } from "../../../../src/infrastructure/filesystem.js";
import { shell } from "../../../../src/infrastructure/shell.js";
import { isCliAvailable, isVaultInitialized } from "../../../../src/domain/knowledgebase/vault-service.js";
import type { ComponentsConfig } from "../../../../src/infrastructure/types.js";

const mockDisk = vi.mocked(disk);
const mockShell = vi.mocked(shell);
const mockCliAvailable = vi.mocked(isCliAvailable);
const mockVaultInitialized = vi.mocked(isVaultInitialized);

beforeEach(() => {
	vi.clearAllMocks();
	mockDisk.existsSync.mockReturnValue(false);
	// Ensure storybook process state is clean
	if (isStorybookRunning()) stopStorybook();
});

describe("resolveStorybookDir", () => {
	it("uses default directory name", () => {
		const result = resolveStorybookDir("/project", {});
		expect(result).toBe("/project/component-library");
	});

	it("uses configured directory name", () => {
		const result = resolveStorybookDir("/project", { storybookDir: "my-storybook" });
		expect(result).toBe("/project/my-storybook");
	});
});

describe("isStorybookInstalled", () => {
	it("returns false when package.json does not exist", () => {
		expect(isStorybookInstalled("/project", {})).toBe(false);
		expect(mockDisk.existsSync).toHaveBeenCalledWith("/project/component-library/package.json");
	});

	it("returns true when package.json exists", () => {
		mockDisk.existsSync.mockReturnValue(true);
		expect(isStorybookInstalled("/project", {})).toBe(true);
	});
});

describe("installStorybook", () => {
	it("creates directory structure and config files", () => {
		mockShell.run.mockReturnValue(0);

		const result = installStorybook("/project", "my-project", {});

		expect(result).toBe(true);
		expect(mockDisk.mkdirSync).toHaveBeenCalled();
		expect(mockDisk.writeFileSync).toHaveBeenCalled();
		const writeCalls = mockDisk.writeFileSync.mock.calls.map(([path]) => path);
		expect(writeCalls.some((p) => String(p).includes("package.json"))).toBe(true);
		expect(writeCalls.some((p) => String(p).includes("main.ts"))).toBe(true);
		expect(writeCalls.some((p) => String(p).includes("preview.ts"))).toBe(true);
	});

	it("runs npm install in storybook directory", () => {
		mockShell.run.mockReturnValue(0);

		installStorybook("/project", "my-project", {});

		expect(mockShell.run).toHaveBeenCalledWith("npm install", expect.objectContaining({
			cwd: "/project/component-library",
		}));
	});

	it("returns false when npm install fails", () => {
		mockShell.run.mockReturnValue(1);

		const result = installStorybook("/project", "my-project", {});

		expect(result).toBe(false);
	});

	it("skips if already installed", () => {
		mockDisk.existsSync.mockReturnValue(true);

		const result = installStorybook("/project", "my-project", {});

		expect(result).toBe(true);
		expect(mockShell.run).not.toHaveBeenCalled();
	});

	it("uses custom storybookDir", () => {
		mockShell.run.mockReturnValue(0);
		const config: ComponentsConfig = { storybookDir: "sb" };

		installStorybook("/project", "my-project", config);

		expect(mockShell.run).toHaveBeenCalledWith("npm install", expect.objectContaining({
			cwd: "/project/sb",
		}));
	});

	it("writes package.json with --no-open flag", () => {
		mockShell.run.mockReturnValue(0);

		installStorybook("/project", "my-project", {});

		const pkgCall = mockDisk.writeFileSync.mock.calls.find(([p]) => String(p).includes("package.json"));
		expect(pkgCall).toBeDefined();
		const content = JSON.parse(pkgCall![1] as string);
		expect(content.name).toBe("my-project-component-library");
		expect(content.scripts.storybook).toContain("--no-open");
		expect(content.scripts["build-storybook"]).toBeDefined();
		expect(content.devDependencies.storybook).toBe("^10.0.0");
	});
});

describe("extractLocalUrl", () => {
	it("extracts localhost URL from output lines", () => {
		const lines = [
			"storybook v10.2.16",
			"Local:                http://localhost:6007/",
			"On your network:      http://192.168.1.1:6007/",
		];
		expect(extractLocalUrl(lines)).toBe("http://localhost:6007");
	});

	it("returns default URL when no match found", () => {
		expect(extractLocalUrl(["no url here"])).toBe("http://localhost:6006");
	});

	it("handles port 6006 in output", () => {
		const lines = ["Local: http://localhost:6006/"];
		expect(extractLocalUrl(lines)).toBe("http://localhost:6006");
	});
});

describe("isInsideVault", () => {
	it("returns true for a path inside the vault", () => {
		expect(isInsideVault("/vault/01 - Projects/MyApp")).toBe(true);
	});

	it("returns false for a path outside the vault", () => {
		expect(isInsideVault("/other/project")).toBe(false);
	});

	it("returns true for the vault root itself", () => {
		expect(isInsideVault("/vault")).toBe(true);
	});
});

describe("runStorybookDev", () => {
	it("spawns storybook in background when installed", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess();
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		await runStorybookDev("/project", {});

		expect(mockShell.spawnBackground).toHaveBeenCalledWith(
			expect.stringContaining("storybook dev -p"),
			expect.objectContaining({ cwd: "/project/component-library", env: { CI: "true" } }),
		);
	});

	it("warns when not installed", async () => {
		await runStorybookDev("/project", {});

		expect(mockShell.spawnBackground).not.toHaveBeenCalled();
	});

	it("waits for ready signal before opening browser", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess();
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		await runStorybookDev("/project", {});

		expect(mockProcess.waitForOutput).toHaveBeenCalledWith(
			expect.any(RegExp),
			expect.any(Number),
		);
	});

	it("opens Obsidian Web Viewer when inside vault and CLI available", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		mockCliAvailable.mockReturnValue(true);
		mockVaultInitialized.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess();
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		await runStorybookDev("/vault/project", {});

		expect(mockShell.runSilent).toHaveBeenCalledWith(
			"obsidian web url=http://localhost:6006 newtab",
		);
	});

	it("opens default browser when outside vault", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess();
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		await runStorybookDev("/other/project", {});

		// Should have called runSilent with a browser-open command
		expect(mockShell.runSilent).toHaveBeenCalled();
		const call = mockShell.runSilent.mock.calls[0][0];
		expect(call).toContain("http://localhost:6006");
	});

	it("reports failure with output when process exits before ready", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess({
			running: false,
			output: ["npm ERR! Missing script: storybook", "npm ERR! To see a list of scripts, run: npm run"],
			waitForOutput: vi.fn().mockResolvedValue(null),
		});
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		await runStorybookDev("/project", {});

		expect(mockShell.runSilent).not.toHaveBeenCalled();
		// Should log the diagnostic output
		const { log: mockLog } = await import("../../../../src/infrastructure/logger.js");
		const logCalls = vi.mocked(mockLog).mock.calls.map(([msg]) => msg);
		expect(logCalls.some((msg) => String(msg).includes("Output"))).toBe(true);
	});

	it("stops storybook when user presses Enter in live view", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess();
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		await runStorybookDev("/project", {});

		expect(mockProcess.kill).toHaveBeenCalled();
		expect(isStorybookRunning()).toBe(false);
	});

	it("does not stream live output to terminal", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess();
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		await runStorybookDev("/project", {});

		expect(mockProcess.onOutput).not.toHaveBeenCalled();
	});
});

describe("stopStorybook", () => {
	it("does nothing when no process is running", () => {
		stopStorybook();
		// Should not throw, just log
	});
});

describe("isStorybookRunning", () => {
	it("returns false when no process started", () => {
		expect(isStorybookRunning()).toBe(false);
	});

	it("returns false after dev completes (user stops via view)", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess();
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		await runStorybookDev("/project", {});
		expect(isStorybookRunning()).toBe(false);
	});
});

describe("runStorybookBuild", () => {
	it("runs storybook build when installed", () => {
		mockDisk.existsSync.mockReturnValue(true);

		runStorybookBuild("/project", {});

		expect(mockShell.run).toHaveBeenCalledWith("npm run build-storybook", expect.objectContaining({
			cwd: "/project/component-library",
		}));
	});

	it("warns when not installed", () => {
		runStorybookBuild("/project", {});

		expect(mockShell.run).not.toHaveBeenCalled();
	});
});
