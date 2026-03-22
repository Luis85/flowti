import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BackgroundProcess } from "../../../../src/infrastructure/types.js";
import type { StorybookRenderer } from "../../../../src/domain/make/component/storybook-renderer.js";
import { nullStorybookRenderer } from "../../../../src/domain/make/component/storybook-renderer.js";

function createMockBackgroundProcess(overrides?: Partial<BackgroundProcess>): BackgroundProcess {
	return {
		pid: 1234,
		running: true,
		output: [],
		kill: vi.fn(),
		unref: vi.fn(),
		onOutput: vi.fn(() => vi.fn()),
		waitForOutput: vi.fn().mockResolvedValue("Storybook ready!"),
		waitForExit: vi.fn().mockResolvedValue(0),
		writeStdin: vi.fn(),
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
		progress: vi.fn(),
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

// Inline shell mock: per-test vi.mocked(shell) overrides require vi.fn().
// See tests/mocks/mock-presets.ts for the standard mockShellPreset() factory.
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
	getFrameworkPackages,
	startStorybookDev,
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
		expect(result).toBe("/project/components");
	});

	it("uses configured directory name", () => {
		const result = resolveStorybookDir("/project", { storybookDir: "my-storybook" }, sbDeps());
		expect(result).toBe("/project/my-storybook");
	});
});

describe("isStorybookInstalled", () => {
	it("returns false when package.json does not exist", () => {
		expect(isStorybookInstalled("/project", {}, sbDeps())).toBe(false);
		expect(mockDisk.existsSync).toHaveBeenCalledWith("/project/components/package.json");
	});

	it("returns true when package.json exists", () => {
		mockDisk.existsSync.mockReturnValue(true);
		expect(isStorybookInstalled("/project", {}, sbDeps())).toBe(true);
	});
});

describe("installStorybook", () => {
	it("creates directory and writes package.json for html", () => {
		mockShell.run.mockReturnValue(0);

		const result = installStorybook("/project", "my-project", {}, sbDeps());

		expect(result).toBe(true);
		expect(mockDisk.mkdirSync).toHaveBeenCalled();
		expect(mockDisk.writeFileSync).toHaveBeenCalled();
		const writeCalls = mockDisk.writeFileSync.mock.calls.map(([path]) => path);
		expect(writeCalls.some((p) => String(p).includes("package.json"))).toBe(true);
	});

	it("runs storybook init with docs and npm installs", () => {
		mockShell.run.mockReturnValue(0);

		installStorybook("/project", "my-project", {}, sbDeps());

		expect(mockShell.run).toHaveBeenCalledWith(
			expect.stringContaining("npx storybook@latest init --yes --disable-telemetry --features docs"),
			expect.objectContaining({ cwd: "/project/components" }),
		);
		expect(mockShell.run).toHaveBeenCalledWith(
			"npm install",
			expect.objectContaining({ cwd: "/project/components" }),
		);
	});

	it("returns false when storybook init fails", () => {
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

	it("skips storybook init when .storybook/main.ts already exists", () => {
		// package.json missing (not "installed") but .storybook/main.ts exists
		mockDisk.existsSync.mockImplementation((p) => String(p).includes("main.ts"));
		mockShell.run.mockReturnValue(0);

		const result = installStorybook("/project", "my-project", {}, sbDeps());

		expect(result).toBe(true);
		// Should run npm install twice (framework deps + update) but NOT storybook init
		const runCalls = mockShell.run.mock.calls.map(([cmd]) => cmd);
		expect(runCalls.every((cmd) => !cmd.includes("storybook@latest init"))).toBe(true);
		expect(runCalls.some((cmd) => cmd === "npm install")).toBe(true);
	});

	it("uses custom storybookDir", () => {
		mockShell.run.mockReturnValue(0);
		const config: ComponentsConfig = { storybookDir: "sb" };

		installStorybook("/project", "my-project", config, sbDeps());

		expect(mockShell.run).toHaveBeenCalledWith(
			expect.stringContaining("npx storybook@latest init"),
			expect.objectContaining({ cwd: "/project/sb" }),
		);
	});

	it("writes package.json with framework devDeps for html", () => {
		mockShell.run.mockReturnValue(0);

		installStorybook("/project", "my-project", {}, sbDeps());

		const pkgCall = mockDisk.writeFileSync.mock.calls.find(([p]) => String(p).includes("package.json"));
		expect(pkgCall).toBeDefined();
		const content = JSON.parse(pkgCall![1] as string);
		expect(content.name).toBe("my-project-components");
		expect(content.devDependencies["@storybook/html-vite"]).toBeDefined();
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
		expect(isInsideVault("/vault/01 - Projects/MyApp", "/vault", sbDeps())).toBe(true);
	});

	it("returns false for a path outside the vault", () => {
		expect(isInsideVault("/other/project", "/vault", sbDeps())).toBe(false);
	});

	it("returns true for the vault root itself", () => {
		expect(isInsideVault("/vault", "/vault", sbDeps())).toBe(true);
	});
});

describe("runStorybookDev", () => {
	it("spawns storybook in background when installed", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess();
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		await runStorybookDev("/project", {}, "/vault", sbDeps());

		expect(mockShell.spawnBackground).toHaveBeenCalledWith(
			"npm run storybook",
			expect.objectContaining({ cwd: "/project/components", env: { CI: "true", NG_CLI_ANALYTICS: "false" } }),
		);
	});

	it("calls notInstalled renderer when not installed", async () => {
		const render = createMockRenderer();
		await runStorybookDev("/project", {}, "/vault", sbDeps(), render);

		expect(mockShell.spawnBackground).not.toHaveBeenCalled();
		expect(render.notInstalled).toHaveBeenCalled();
	});

	it("waits for ready signal before opening browser", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess();
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		await runStorybookDev("/project", {}, "/vault", sbDeps());

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

		await runStorybookDev("/vault/project", {}, "/vault", sbDeps());

		expect(mockShell.runSilent).toHaveBeenCalledWith(
			"obsidian web url=http://localhost:6006 newtab",
		);
	});

	it("opens default browser when outside vault", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess();
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		await runStorybookDev("/other/project", {}, "/vault", sbDeps());

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

		await runStorybookDev("/project", {}, "/vault", sbDeps(), render);

		expect(mockShell.runSilent).not.toHaveBeenCalled();
		expect(render.failedToStart).toHaveBeenCalled();
		expect(render.failOutput).toHaveBeenCalled();
	});

	it("stops storybook when user presses Enter in live view", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess();
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		await runStorybookDev("/project", {}, "/vault", sbDeps());

		expect(mockProcess.kill).toHaveBeenCalled();
		expect(isStorybookRunning()).toBe(false);
	});

	it("streams progress to renderer while starting", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess();
		mockShell.spawnBackground.mockReturnValue(mockProcess);
		const render = createMockRenderer();

		await runStorybookDev("/project", {}, "/vault", sbDeps(), render);

		expect(mockProcess.onOutput).toHaveBeenCalled();
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

		await runStorybookDev("/project", {}, "/vault", sbDeps());
		expect(isStorybookRunning()).toBe(false);
	});
});

describe("runStorybookBuild", () => {
	it("runs storybook build when installed", () => {
		mockDisk.existsSync.mockReturnValue(true);

		runStorybookBuild("/project", {}, sbDeps());

		expect(mockShell.run).toHaveBeenCalledWith("npm run build-storybook", expect.objectContaining({
			cwd: "/project/components",
		}));
	});

	it("calls notInstalled renderer when not installed", () => {
		const render = createMockRenderer();
		runStorybookBuild("/project", {}, sbDeps(), render);

		expect(mockShell.run).not.toHaveBeenCalled();
		expect(render.notInstalled).toHaveBeenCalled();
	});
});

describe("getFrameworkPackages", () => {
	it("returns html packages by default", () => {
		const pkgs = getFrameworkPackages("html");
		expect(pkgs.framework).toBe("@storybook/html-vite");
		expect(pkgs.extra).toBeUndefined();
	});

	it("returns angular packages with Angular dependencies", () => {
		const pkgs = getFrameworkPackages("angular");
		expect(pkgs.framework).toBe("@storybook/angular");
		expect(pkgs.extra).toBeDefined();
		expect(pkgs.extra!["@angular/core"]).toBeDefined();
		expect(pkgs.extra!["zone.js"]).toBeDefined();
	});

	it("returns react packages with React dependencies", () => {
		const pkgs = getFrameworkPackages("react");
		expect(pkgs.framework).toBe("@storybook/react-vite");
		expect(pkgs.extra!["react"]).toBeDefined();
	});

	it("returns vue packages with Vue dependencies", () => {
		const pkgs = getFrameworkPackages("vue");
		expect(pkgs.framework).toBe("@storybook/vue3-vite");
		expect(pkgs.extra!["vue"]).toBeDefined();
	});
});

describe("startStorybookDev", () => {
	it("returns started result with URL on success", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess({
			output: ["Local: http://localhost:6006/"],
		});
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		const result = await startStorybookDev("/project", {}, "/vault", { disk, paths, shell });

		expect(result.started).toBe(true);
		expect(result.url).toBe("http://localhost:6006");
		expect(result.error).toBeUndefined();
	});

	it("returns error when not installed", async () => {
		const render = createMockRenderer();
		const result = await startStorybookDev("/project", {}, "/vault", { disk, paths, shell }, render);

		expect(result.started).toBe(false);
		expect(result.error).toBe("not-installed");
		expect(render.notInstalled).toHaveBeenCalled();
	});

	it("returns error when already running", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		// Start a process to make isStorybookRunning() return true
		const firstProcess = createMockBackgroundProcess({
			output: ["Local: http://localhost:6006/"],
		});
		mockShell.spawnBackground.mockReturnValue(firstProcess);
		await startStorybookDev("/project", {}, "/vault", { disk, paths, shell });

		const render = createMockRenderer();
		const result = await startStorybookDev("/project", {}, "/vault", { disk, paths, shell }, render);

		expect(result.started).toBe(false);
		expect(result.error).toBe("already-running");
		expect(render.alreadyRunning).toHaveBeenCalled();
	});

	it("returns error on timeout", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess({
			running: true,
			waitForOutput: vi.fn().mockResolvedValue(null),
		});
		mockShell.spawnBackground.mockReturnValue(mockProcess);
		const render = createMockRenderer();

		const result = await startStorybookDev("/project", {}, "/vault", { disk, paths, shell }, render);

		expect(result.started).toBe(false);
		expect(result.error).toBe("timeout");
		expect(render.timeout).toHaveBeenCalled();
	});

	it("returns error when process exits before ready", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess({
			running: false,
			output: ["npm ERR! Missing script: storybook"],
			waitForOutput: vi.fn().mockResolvedValue(null),
		});
		mockShell.spawnBackground.mockReturnValue(mockProcess);
		const render = createMockRenderer();

		const result = await startStorybookDev("/project", {}, "/vault", { disk, paths, shell }, render);

		expect(result.started).toBe(false);
		expect(result.error).toBe("failed-to-start");
		expect(render.failedToStart).toHaveBeenCalled();
	});

	it("returns error when node_modules missing", async () => {
		// package.json exists (installed) but node_modules does not
		mockDisk.existsSync.mockImplementation((p) => !String(p).includes("node_modules"));
		const render = createMockRenderer();

		const result = await startStorybookDev("/project", {}, "/vault", { disk, paths, shell }, render);

		expect(result.started).toBe(false);
		expect(result.error).toBe("deps-not-installed");
		expect(render.failedToStart).toHaveBeenCalled();
		expect(render.failOutput).toHaveBeenCalled();
	});

	it("does not block on user input (no waitForEnter)", async () => {
		mockDisk.existsSync.mockReturnValue(true);
		const mockProcess = createMockBackgroundProcess({
			output: ["Local: http://localhost:6006/"],
		});
		mockShell.spawnBackground.mockReturnValue(mockProcess);

		await startStorybookDev("/project", {}, "/vault", { disk, paths, shell });

		// Process should still be running (not killed by enterStorybookView)
		expect(mockProcess.kill).not.toHaveBeenCalled();
	});
});

describe("installStorybook — framework-aware", () => {
	it("scaffolds angular workspace before storybook init", () => {
		mockShell.run.mockReturnValue(0);

		installStorybook("/project", "my-project", { framework: "angular" }, sbDeps());

		// Should write Angular package.json with Angular deps
		const pkgCall = mockDisk.writeFileSync.mock.calls.find(([p]) => String(p).includes("package.json"));
		const content = JSON.parse(pkgCall![1] as string);
		expect(content.devDependencies["@angular/core"]).toBeDefined();

		// Should write angular.json
		const angularCall = mockDisk.writeFileSync.mock.calls.find(([p]) => String(p).includes("angular.json"));
		expect(angularCall).toBeDefined();

		// Should run npm install for Angular deps, then storybook init, then final npm install
		const runCalls = mockShell.run.mock.calls.map(([cmd]) => cmd);
		expect(runCalls[0]).toBe("npm install");
		expect(runCalls[1]).toContain("npx storybook@latest init");
		expect(runCalls[1]).toContain("--features docs");
		expect(runCalls[2]).toBe("npm install");
	});

	it("returns false if angular npm install fails", () => {
		mockShell.run.mockReturnValue(1);

		const result = installStorybook("/project", "my-project", { framework: "angular" }, sbDeps());

		expect(result).toBe(false);
		// Should have tried npm install but not storybook init
		expect(mockShell.run).toHaveBeenCalledTimes(1);
		expect(mockShell.run).toHaveBeenCalledWith("npm install", expect.anything());
	});

	it("writes html package.json by default when no framework specified", () => {
		mockShell.run.mockReturnValue(0);

		installStorybook("/project", "my-project", {}, sbDeps());

		const pkgCall = mockDisk.writeFileSync.mock.calls.find(([p]) => String(p).includes("package.json"));
		const content = JSON.parse(pkgCall![1] as string);
		expect(content.devDependencies["@storybook/html-vite"]).toBeDefined();
	});
});
