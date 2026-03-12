import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BackgroundProcess } from "../../../../src/infrastructure/types.js";
import type { StorybookRenderer } from "../../../../src/domain/make/component/storybook-renderer.js";
import { nullStorybookRenderer } from "../../../../src/domain/make/component/storybook-renderer.js";

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

function createMockRenderer(): StorybookRenderer & Record<string, ReturnType<typeof vi.fn>> {
	return {
		alreadyInstalled: vi.fn(),
		installing: vi.fn(),
		installFailed: vi.fn(),
		installSuccess: vi.fn(),
		notInstalled: vi.fn(),
		alreadyRunning: vi.fn(),
		starting: vi.fn(),
		failedToStart: vi.fn(),
		failOutput: vi.fn(),
		timeout: vi.fn(),
		ready: vi.fn(),
		stopped: vi.fn(),
		notRunning: vi.fn(),
		view: vi.fn(),
		browserContext: vi.fn(),
		openedIn: vi.fn(),
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
import { paths } from "../../../../src/infrastructure/paths.js";
import { shell } from "../../../../src/infrastructure/shell.js";
import { input } from "../../../../src/infrastructure/input.js";
import { isCliAvailable, isVaultInitialized } from "../../../../src/domain/knowledgebase/vault-service.js";
import type { ComponentsConfig } from "../../../../src/infrastructure/types.js";

function sbDeps() { return { disk, paths, shell, input } as const; }

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
		const result = resolveStorybookDir("/project", {}, sbDeps());
		expect(result).toBe("/project/component-library");
	});

	it("uses configured directory name", () => {
		const result = resolveStorybookDir("/project", { storybookDir: "my-storybook" }, sbDeps());
		expect(result).toBe("/project/my-storybook");
	});
});

describe("isStorybookInstalled", () => {
	it("returns false when package.json does not exist", () => {
		expect(isStorybookInstalled("/project", {}, sbDeps())).toBe(false);
		expect(mockDisk.existsSync).toHaveBeenCalledWith("/project/component-library/package.json");
	});

	it("returns true when package.json exists", () => {
		mockDisk.existsSync.mockReturnValue(true);
		expect(isStorybookInstalled("/project", {}, sbDeps())).toBe(true);
	});
});

describe("installStorybook", () => {
	it("creates directory structure and config files", () => {
		mockShell.run.mockReturnValue(0);

		const result = installStorybook("/project", "my-project", {}, sbDeps());

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

		installStorybook("/project", "my-project", {}, sbDeps());

		expect(mockShell.run).toHaveBeenCalledWith("npm install", expect.objectContaining({
			cwd: "/project/component-library",
		}));
	});

	it("returns false when npm install fails", () => {
		mockShell.run.mockReturnValue(1);

		const result = installStorybook("/project", "my-project", {}, sbDeps());

		expect(result).toBe(false);
	});

	it("skips if already installed", () => {
		mockDisk.existsSync.mockReturnValue(true);

		const result = installStorybook("/project", "my-project", {}, sbDeps());

		expect(result).toBe(true);
		expect(mockShell.run).not.toHaveBeenCalled();
	});

	it("uses custom storybookDir", () => {
		mockShell.run.mockReturnValue(0);
		const config: ComponentsConfig = { storybookDir: "sb" };

		installStorybook("/project", "my-project", config, sbDeps());

		expect(mockShell.run).toHaveBeenCalledWith("npm install", expect.objectContaining({
			cwd: "/project/sb",
		}));
	});

	it("writes package.json with --no-open flag", () => {
		mockShell.run.mockReturnValue(0);

		installStorybook("/project", "my-project", {}, sbDeps());

		const pkgCall = mockDisk.writeFileSync.mock.calls.find(([p]) => String(p).includes("package.json"));
		expect(pkgCall).toBeDefined();
		const content = JSON.parse(pkgCall![1] as string);
		expect(content.name).toBe("my-project-component-library");
		expect(content.scripts.storybook).toContain("--no-open");
		expect(content.scripts["build-storybook"]).toBeDefined();
		expect(content.devDependencies.storybook).toBe("^10.0.0");
	});

	it("calls renderer on install success", () => {
		mockShell.run.mockReturnValue(0);
		const render = createMockRenderer();

		installStorybook("/project", "my-project", {}, sbDeps(), render);

		expect(render.installing).toHaveBeenCalled();
		expect(render.installSuccess).toHaveBeenCalled();
	});

	it("calls renderer on install failure", () => {
		mockShell.run.mockReturnValue(1);
		const render = createMockRenderer();

		installStorybook("/project", "my-project", {}, sbDeps(), render);

		expect(render.installFailed).toHaveBeenCalled();
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
		expect(isInsideVault("/vault/01 - Projects/MyApp", sbDeps())).toBe(true);
	});

	it("returns false for a path outside the vault", () => {
		expect(isInsideVault("/other/project", sbDeps())).toBe(false);
	});

	it("returns true for the vault root itself", () => {
		expect(isInsideVault("/vault", sbDeps())).toBe(true);
	});
});

describe("runStorybookDev", () => {
	it("spawns storybook in background when installed", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess();
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		await runStorybookDev("/project", {}, sbDeps());

		expect(mockShell.spawnBackground).toHaveBeenCalledWith(
			expect.stringContaining("storybook dev -p"),
			expect.objectContaining({ cwd: "/project/component-library", env: { CI: "true" } }),
		);
	});

	it("calls notInstalled renderer when not installed", async () => {
		const render = createMockRenderer();
		await runStorybookDev("/project", {}, sbDeps(), render);

		expect(mockShell.spawnBackground).not.toHaveBeenCalled();
		expect(render.notInstalled).toHaveBeenCalled();
	});

	it("waits for ready signal before opening browser", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess();
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		await runStorybookDev("/project", {}, sbDeps());

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

		await runStorybookDev("/vault/project", {}, sbDeps());

		expect(mockShell.runSilent).toHaveBeenCalledWith(
			"obsidian web url=http://localhost:6006 newtab",
		);
	});

	it("opens default browser when outside vault", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess();
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		await runStorybookDev("/other/project", {}, sbDeps());

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
		const render = createMockRenderer();

		await runStorybookDev("/project", {}, sbDeps(), render);

		expect(mockShell.runSilent).not.toHaveBeenCalled();
		expect(render.failedToStart).toHaveBeenCalled();
		expect(render.failOutput).toHaveBeenCalled();
	});

	it("stops storybook when user presses Enter in live view", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess();
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		await runStorybookDev("/project", {}, sbDeps());

		expect(mockProcess.kill).toHaveBeenCalled();
		expect(isStorybookRunning()).toBe(false);
	});

	it("does not stream live output to terminal", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess();
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		await runStorybookDev("/project", {}, sbDeps());

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

		await runStorybookDev("/project", {}, sbDeps());
		expect(isStorybookRunning()).toBe(false);
	});
});

describe("runStorybookBuild", () => {
	it("runs storybook build when installed", () => {
		mockDisk.existsSync.mockReturnValue(true);

		runStorybookBuild("/project", {}, sbDeps());

		expect(mockShell.run).toHaveBeenCalledWith("npm run build-storybook", expect.objectContaining({
			cwd: "/project/component-library",
		}));
	});

	it("calls notInstalled renderer when not installed", () => {
		const render = createMockRenderer();
		runStorybookBuild("/project", {}, sbDeps(), render);

		expect(mockShell.run).not.toHaveBeenCalled();
		expect(render.notInstalled).toHaveBeenCalled();
	});
});
